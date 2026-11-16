import {
  AcaMetalTier,
  AcaWindowOption,
  FilingStatus,
  HealthCarrierId,
  PrivateHealthCarrierId,
  PrivatePpoTierId,
  SelfEmployedEntityBasis,
  TaxYear,
  UtilizationScenarioId,
} from '../types';
import { PRIVATE_HEALTH_CARRIERS, TAX_YEAR_PARAMS_2027 } from './constants';

export function getIRSLimitForAge(age: number, _filingStatus?: FilingStatus): number {
  const baseCap = 7500;
  const catchUp = age >= 50 ? 1100 : 0;
  return baseCap + catchUp;
}

export function getHouseholdSize(filingStatus: FilingStatus, dependents: number): number {
  return (filingStatus === 'married' ? 2 : 1) + dependents;
}

export interface IRADeductionResult {
  maxDeductible: number;
  phaseOutStatus: 'full' | 'partial' | 'none';
  phaseOutPct: number;
  notice: string;
}

export function getTraditionalIRADeductionLimit(
  magiAfter401k: number,
  age: number,
  isCoveredByWorkplacePlan: boolean,
  filingStatus: FilingStatus = 'single',
  isSpouseCoveredByWorkplacePlan: boolean = false,
  taxYear: TaxYear = '2027'
): IRADeductionResult {
  const statCap = getIRSLimitForAge(age);
  const isMarried = filingStatus === 'married';
  const is2026 = taxYear === '2026';

  // Case 1: Taxpayer is covered by workplace plan (IRS Notice 2025-67 for 2026; Notice 2026-66 for 2027+)
  if (isCoveredByWorkplacePlan) {
    const startRange = isMarried ? (is2026 ? 129000 : 133000) : (is2026 ? 81000 : 83000);
    const endRange = isMarried ? (is2026 ? 149000 : 153000) : (is2026 ? 91000 : 93000);
    const rangeSpan = endRange - startRange;

    if (magiAfter401k < startRange) {
      return {
        maxDeductible: statCap,
        phaseOutStatus: 'full',
        phaseOutPct: 100,
        notice: `Full $${statCap.toLocaleString()} Traditional IRA deduction qualified (MAGI < $${startRange.toLocaleString()}). Drops final MAGI dollar-for-dollar.`,
      };
    } else if (magiAfter401k < endRange) {
      const remainingSpan = endRange - magiAfter401k;
      const ratio = remainingSpan / rangeSpan;
      const partialCap = Math.max(200, Math.round((statCap * ratio) / 10) * 10);
      const pctDeductible = Math.round(ratio * 100);
      return {
        maxDeductible: partialCap,
        phaseOutStatus: 'partial',
        phaseOutPct: pctDeductible,
        notice: `Partial deduction phase-out ($${startRange.toLocaleString()} - $${endRange.toLocaleString()} MAGI range). Capped at $${partialCap.toLocaleString()} deductible under IRC § 219(g).`,
      };
    } else {
      return {
        maxDeductible: 0,
        phaseOutStatus: 'none',
        phaseOutPct: 0,
        notice: `MAGI ($${Math.round(magiAfter401k).toLocaleString()}) exceeds the $${endRange.toLocaleString()} IRS phase-out limit for workplace plan participants. Traditional IRA contributions are non-deductible after-tax and provide $0 MAGI reduction.`,
      };
    }
  }

  // Case 2: Taxpayer is NOT covered by workplace plan, but spouse IS covered (IRC § 219(g)(7))
  if (isMarried && isSpouseCoveredByWorkplacePlan) {
    const startRange = is2026 ? 242000 : 250000;
    const endRange = is2026 ? 252000 : 260000;
    const rangeSpan = endRange - startRange;

    if (magiAfter401k < startRange) {
      return {
        maxDeductible: statCap,
        phaseOutStatus: 'full',
        phaseOutPct: 100,
        notice: `Full $${statCap.toLocaleString()} Spousal IRA deduction qualified under IRC § 219(g)(7) (Non-covered spouse threshold MAGI < $${startRange.toLocaleString()}).`,
      };
    } else if (magiAfter401k < endRange) {
      const remainingSpan = endRange - magiAfter401k;
      const ratio = remainingSpan / rangeSpan;
      const partialCap = Math.max(200, Math.round((statCap * ratio) / 10) * 10);
      const pctDeductible = Math.round(ratio * 100);
      return {
        maxDeductible: partialCap,
        phaseOutStatus: 'partial',
        phaseOutPct: pctDeductible,
        notice: `Partial phase-out for non-covered spouse ($${startRange.toLocaleString()} - $${endRange.toLocaleString()} MAGI range). Capped at $${partialCap.toLocaleString()} deductible under IRC § 219(g)(7).`,
      };
    } else {
      return {
        maxDeductible: 0,
        phaseOutStatus: 'none',
        phaseOutPct: 0,
        notice: `Joint MAGI ($${Math.round(magiAfter401k).toLocaleString()}) exceeds the $${endRange.toLocaleString()} threshold for non-covered spouses under IRC § 219(g)(7). Contributions are after-tax ($0 MAGI reduction).`,
      };
    }
  }

  // Case 3: Neither spouse is covered by workplace plan (or Single and not covered)
  return {
    maxDeductible: statCap,
    phaseOutStatus: 'full',
    phaseOutPct: 100,
    notice: `Full $${statCap.toLocaleString()} Traditional IRA deduction qualified (not covered by workplace plan).`,
  };
}

export function get100PercentFPL(householdSize: number, taxYear: TaxYear = '2027'): number {
  // 2026 Marketplace Plan Year uses 2025 HHS Poverty Guidelines ($15,650 + $5,500)
  // 2027+ Marketplace Plan Year uses 2026 HHS Poverty Guidelines ($15,960 + $5,680)
  const baseFPL = taxYear === '2026' ? 15650 : TAX_YEAR_PARAMS_2027.baseFPL;
  const perAddFPL = taxYear === '2026' ? 5500 : TAX_YEAR_PARAMS_2027.perAddFPL;
  return baseFPL + Math.max(0, householdSize - 1) * perAddFPL;
}

export function getMarginalTaxRate(agi: number, filingStatus: FilingStatus): number {
  if (filingStatus === 'married') {
    if (agi <= 23200) return 0.10;
    if (agi <= 94300) return 0.12;
    if (agi <= 201050) return 0.22;
    return 0.24;
  } else {
    if (agi <= 11600) return 0.10;
    if (agi <= 47150) return 0.12;
    if (agi <= 100525) return 0.22;
    return 0.24;
  }
}

export function isOutsideAcaEnrollmentWindow(acaWindow: AcaWindowOption): boolean {
  if (acaWindow === 'open') return false;
  if (acaWindow === 'outside_no_sep') return true;
  if (acaWindow === 'outside_with_sep') return false;

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Standard ACA window is Nov 1 - Jan 15
  const isInWindow = month === 11 || month === 12 || (month === 1 && day <= 15);
  return !isInWindow;
}

export function formatBoundaryAwareFpl(exact: number): number {
  const rounded = Math.round(exact);
  const boundaries = [100, 133, 138, 150, 200, 250, 300, 400, 500];
  for (const b of boundaries) {
    if ((exact < b && rounded >= b) || (exact > b && rounded <= b)) {
      return Number(exact.toFixed(2));
    }
  }
  return rounded;
}

// Calculate ACA Benchmark Silver Premium, Subsidy, and 2026/2027 CMS CSR Tiers based on exact unrounded FPL percentage
export function calculateAcaDetails(
  agi: number,
  householdSize: number,
  clientAge: number,
  taxYear: TaxYear = '2027'
) {
  const fpl100 = get100PercentFPL(householdSize, taxYear);
  const exactFplPct = fpl100 > 0 ? (agi / fpl100) * 100 : 0;
  const fplPct = formatBoundaryAwareFpl(exactFplPct);
  const isFamily = householdSize > 1;
  const is2026 = taxYear === '2026';

  // Age-based base benchmark Silver SLCSP cost for Martin County / Treasure Coast, FL
  const ageFactor = 1 + Math.max(0, clientAge - 21) * 0.035;
  const householdRatingFactor = householdSize > 1 ? 1 + (householdSize - 1) * 0.48 : 1.0;
  const benchmarkCostAnnual = 6800 * ageFactor * householdRatingFactor;
  const benchmarkCostMonthly = benchmarkCostAnnual / 12;

  // IRC § 36B Statutory APTC Eligibility Bounds: exact 100% FPL minimum to exact 400% FPL statutory cliff
  const isBelow100Fpl = agi < fpl100;
  const isAbove400Cliff = agi > fpl100 * 4;
  let expectedContribPct = 0.0996;
  if (isBelow100Fpl) expectedContribPct = 0;
  else if (exactFplPct <= 133) expectedContribPct = 0.021;
  else if (exactFplPct <= 150) expectedContribPct = 0.0314;
  else if (exactFplPct <= 200) expectedContribPct = 0.054;
  else if (exactFplPct <= 250) expectedContribPct = 0.0752;
  else if (exactFplPct <= 300) expectedContribPct = 0.092;
  else if (!isAbove400Cliff) expectedContribPct = 0.0996;
  else expectedContribPct = 1.0;

  const maxExpectedAnnual = agi * expectedContribPct;
  const maxExpectedMonthly = maxExpectedAnnual / 12;

  const monthlySubsidy =
    isBelow100Fpl || isAbove400Cliff
      ? 0
      : Math.max(0, benchmarkCostMonthly - maxExpectedMonthly);
  const netBenchmarkMonthly = Math.max(0, benchmarkCostMonthly - monthlySubsidy);

  // CMS Statutory OOP Maximums: 2026 ($10,600 Ind / $21,200 Fam), 2027+ ($12,000 Ind / $24,000 Fam)
  const statutoryIndOopMax = is2026 ? 10600 : 12000;
  let csrLevel = 'Standard Silver (70% AV)';
  let deductible = 5800;
  let oopMax = statutoryIndOopMax;
  let primaryCopay = 35;
  let av = '70% Silver';

  if (!isBelow100Fpl && exactFplPct <= 150) {
    csrLevel = 'Silver CSR 94% (Max Assistance)';
    deductible = 0;
    oopMax = is2026 ? 1800 : 2000;
    primaryCopay = 0;
    av = '94% Silver';
  } else if (exactFplPct > 150 && exactFplPct <= 200) {
    csrLevel = 'Silver CSR 87% (High Assistance)';
    deductible = 800;
    oopMax = is2026 ? 3500 : 4000;
    primaryCopay = 10;
    av = '87% Silver';
  } else if (exactFplPct > 200 && exactFplPct <= 250) {
    csrLevel = 'Enhanced Silver CSR 73%';
    deductible = 2500;
    oopMax = is2026 ? 8450 : 9600;
    primaryCopay = 20;
    av = '73% Silver';
  } else if (isBelow100Fpl) {
    csrLevel = 'Below 100% FPL (Medicaid / Coverage Gap)';
    deductible = 5800;
    oopMax = statutoryIndOopMax;
    primaryCopay = 35;
    av = '70% Silver (Unsubsidized)';
  }

  const familyOopMax = isFamily ? oopMax * 2 : oopMax;

  return {
    fpl100,
    fplPct,
    exactFplPct,
    isFamily,
    isBelow100Fpl,
    isAbove400Cliff,
    isMedicaidRange: exactFplPct <= 138,
    statutoryIndOopMax,
    statutoryFamOopMax: statutoryIndOopMax * 2,
    expectedContribPct: isBelow100Fpl || isAbove400Cliff ? 0 : expectedContribPct,
    benchmarkCostMonthly: Math.round(benchmarkCostMonthly),
    monthlySubsidy: Math.round(monthlySubsidy),
    netMonthlyPremium: Math.round(netBenchmarkMonthly),
    csrLevel,
    deductible,
    oopMax,
    familyOopMax,
    primaryCopay,
    av,
  };
}

export interface AcaTierProjectionResult {
  tier: AcaMetalTier;
  title: string;
  badge: string;
  avLabel: string;
  monthlyPremium: number;
  annualPremium: number;
  deductible: number;
  individualOopMax: number;
  familyOopMax: number;
  applicableOopMax: number;
  primaryCopayLabel: string;
  scenarioOopEstimate: number;
  totalProjectedAnnualCost: number;
  carrierPositionNote: string;
}

const CARRIER_RATE_FACTORS: Record<HealthCarrierId, { bronzeMult: number; silverMult: number; goldMult: number; note: string }> = {
  oscar: {
    bronzeMult: 0.94,
    silverMult: 0.97,
    goldMult: 0.98,
    note: 'Competitive EPO pricing in Treasure Coast / Martin County',
  },
  fl_blue: {
    bronzeMult: 1.05,
    silverMult: 1.04,
    goldMult: 1.02,
    note: 'Broadest statewide PPO/HMO hospital contracting',
  },
  ambetter: {
    bronzeMult: 0.90,
    silverMult: 0.95,
    goldMult: 0.99,
    note: 'Aggressive entry-level Bronze & CSR Silver monthly premiums',
  },
  fhcp: {
    bronzeMult: 0.97,
    silverMult: 0.99,
    goldMult: 0.95,
    note: 'Integrated HMO model with lower Tier-1 Gold copay structures',
  },
  molina: {
    bronzeMult: 0.92,
    silverMult: 0.96,
    goldMult: 1.01,
    note: 'Strong low-income Silver CSR & value Bronze Exchange pricing',
  },
  uhc: {
    bronzeMult: 1.02,
    silverMult: 1.02,
    goldMult: 1.03,
    note: 'Extensive regional specialist & Optum primary network access',
  },
};

export function calculateAcaTierProjection(params: {
  agi: number;
  householdSize: number;
  clientAge: number;
  carrierId: HealthCarrierId;
  scenario: UtilizationScenarioId;
  taxYear?: TaxYear;
}): {
  baseAca: ReturnType<typeof calculateAcaDetails>;
  tiers: Record<AcaMetalTier, AcaTierProjectionResult>;
} {
  const { agi, householdSize, clientAge, carrierId, scenario, taxYear = '2027' } = params;
  const baseAca = calculateAcaDetails(agi, householdSize, clientAge, taxYear);
  const carrierFactor = CARRIER_RATE_FACTORS[carrierId] || CARRIER_RATE_FACTORS.oscar;
  const isFamily = householdSize > 1;
  const dedMult = isFamily ? 2 : 1;
  const is2026 = taxYear === '2026';

  // Gross monthly rates prior to APTC (Bronze ~74% of SLCSP, Silver = SLCSP, Gold ~118% of SLCSP)
  const bronzeGrossMonthly = baseAca.benchmarkCostMonthly * 0.74 * carrierFactor.bronzeMult;
  const silverGrossMonthly = baseAca.benchmarkCostMonthly * carrierFactor.silverMult;
  const goldGrossMonthly = baseAca.benchmarkCostMonthly * 1.18 * carrierFactor.goldMult;

  const bronzeNetMonthly = Math.max(0, Math.round(bronzeGrossMonthly - baseAca.monthlySubsidy));
  const silverNetMonthly = Math.max(0, Math.round(silverGrossMonthly - baseAca.monthlySubsidy));
  const goldNetMonthly = Math.max(0, Math.round(goldGrossMonthly - baseAca.monthlySubsidy));

  // Statutory 2026 vs 2027 CMS Deductibles & OOP Maximums
  const bronzeDeductible = 7500 * dedMult;
  const bronzeIndOop = baseAca.statutoryIndOopMax;
  const bronzeFamOop = baseAca.statutoryFamOopMax;
  const bronzeApplicableOop = isFamily ? bronzeFamOop : bronzeIndOop;

  const silverDeductible = baseAca.deductible * dedMult;
  const silverIndOop = baseAca.oopMax;
  const silverFamOop = baseAca.familyOopMax;
  const silverApplicableOop = isFamily ? silverFamOop : silverIndOop;

  const goldDeductible = 1500 * dedMult;
  const goldIndOop = is2026 ? 7800 : 8500;
  const goldFamOop = goldIndOop * 2;
  const goldApplicableOop = isFamily ? goldFamOop : goldIndOop;

  const estimateScenarioOop = (
    tier: AcaMetalTier,
    ded: number,
    oopCap: number,
    copay: number
  ): number => {
    if (scenario === 'low') {
      const visitsCost = tier === 'bronze' ? 320 * (isFamily ? 1.6 : 1) : copay * 3 * (isFamily ? 1.6 : 1);
      return Math.min(oopCap, Math.round(visitsCost));
    }
    if (scenario === 'moderate') {
      const targetCareSpend = isFamily ? 6800 : 4200;
      if (tier === 'silver' && !baseAca.isBelow100Fpl && baseAca.exactFplPct <= 150) {
        return Math.min(oopCap, Math.round(targetCareSpend * 0.08));
      }
      if (targetCareSpend <= ded) {
        return Math.min(oopCap, Math.round(targetCareSpend * (tier === 'gold' ? 0.65 : 0.92)));
      }
      const postDedCoinsurance = tier === 'bronze' ? 0.4 : tier === 'gold' ? 0.2 : !baseAca.isBelow100Fpl && baseAca.exactFplPct <= 200 ? 0.15 : 0.3;
      return Math.min(oopCap, Math.round(ded + (targetCareSpend - ded) * postDedCoinsurance));
    }
    return oopCap;
  };

  const bronzeScenarioOop = estimateScenarioOop('bronze', bronzeDeductible, bronzeApplicableOop, 45);
  const silverScenarioOop = estimateScenarioOop('silver', silverDeductible, silverApplicableOop, baseAca.primaryCopay);
  const goldScenarioOop = estimateScenarioOop('gold', goldDeductible, goldApplicableOop, 20);

  return {
    baseAca,
    tiers: {
      bronze: {
        tier: 'bronze',
        title: 'Bronze Catastrophic Protection',
        badge: 'BRONZE (60% AV)',
        avLabel: '60% AV',
        monthlyPremium: bronzeNetMonthly,
        annualPremium: bronzeNetMonthly * 12,
        deductible: bronzeDeductible,
        individualOopMax: bronzeIndOop,
        familyOopMax: bronzeFamOop,
        applicableOopMax: bronzeApplicableOop,
        primaryCopayLabel: '$45 after deductible (preventive $0)',
        scenarioOopEstimate: bronzeScenarioOop,
        totalProjectedAnnualCost: bronzeNetMonthly * 12 + bronzeScenarioOop,
        carrierPositionNote: carrierFactor.note,
      },
      silver: {
        tier: 'silver',
        title: !baseAca.isBelow100Fpl && baseAca.exactFplPct <= 250 ? 'CSR-Enhanced Silver Plan' : 'Standard Benchmark Silver',
        badge: baseAca.csrLevel.toUpperCase(),
        avLabel: baseAca.av,
        monthlyPremium: silverNetMonthly,
        annualPremium: silverNetMonthly * 12,
        deductible: silverDeductible,
        individualOopMax: silverIndOop,
        familyOopMax: silverFamOop,
        applicableOopMax: silverApplicableOop,
        primaryCopayLabel: baseAca.primaryCopay === 0 ? '$0 PCP copay' : `$${baseAca.primaryCopay} PCP copay`,
        scenarioOopEstimate: silverScenarioOop,
        totalProjectedAnnualCost: silverNetMonthly * 12 + silverScenarioOop,
        carrierPositionNote: carrierFactor.note,
      },
      gold: {
        tier: 'gold',
        title: 'Gold Comprehensive Care',
        badge: 'GOLD (80% AV)',
        avLabel: '80% AV',
        monthlyPremium: goldNetMonthly,
        annualPremium: goldNetMonthly * 12,
        deductible: goldDeductible,
        individualOopMax: goldIndOop,
        familyOopMax: goldFamOop,
        applicableOopMax: goldApplicableOop,
        primaryCopayLabel: '$20 flat PCP copay',
        scenarioOopEstimate: goldScenarioOop,
        totalProjectedAnnualCost: goldNetMonthly * 12 + goldScenarioOop,
        carrierPositionNote: carrierFactor.note,
      },
    },
  };
}

export interface PrivatePpoQuoteEstimate {
  hasPreExisting: boolean;
  preferredMonthly: number;
  preferredRatedLowMonthly: number;
  preferredRatedHighMonthly: number;
  choiceValueMonthly: number;
  choiceRatedLowMonthly: number;
  choiceRatedHighMonthly: number;
  preferredDeductible: number;
  preferredOopMax: number;
  choiceDeductible: number;
  choiceOopMax: number;
}

export interface PrivatePpoTierOption {
  tierId: PrivatePpoTierId;
  title: string;
  badge: string;
  tagline: string;
  monthlyPreferred: number;
  monthlyRatedLow: number;
  monthlyRatedHigh: number;
  annualPreferred: number;
  annualRatedLow: number;
  annualRatedHigh: number;
  deductible: number;
  maxOop: number;
  primaryCopayLabel: string;
  specialistCopayLabel: string;
  coinsuranceLabel: string;
}

export interface PrivatePpoComparisonResult {
  carrierName: string;
  carrierId: PrivateHealthCarrierId;
  hasPreExisting: boolean;
  isFamily: boolean;
  tiers: Record<PrivatePpoTierId, PrivatePpoTierOption>;
}

const PRIVATE_DEDUCTIBLE_MULTIPLIERS: Record<number, number> = {
  1500: 1.18,
  2500: 1.0,
  5000: 0.84,
  7500: 0.73,
  10000: 0.64,
};

export function calculatePrivatePpoComparison(params: {
  clientAge: number;
  householdSize: number;
  tobacco: 'no' | 'yes';
  preExisting: 'no' | 'yes';
  carrierId: PrivateHealthCarrierId;
  targetDeductibleInd: number;
}): PrivatePpoComparisonResult {
  const { clientAge, householdSize, tobacco, preExisting, carrierId, targetDeductibleInd } = params;
  const carrierInfo =
    PRIVATE_HEALTH_CARRIERS.find((c) => c.id === carrierId) || PRIVATE_HEALTH_CARRIERS[0];
  const isFamily = householdSize > 1;
  const famMult = isFamily ? 2 : 1;
  const ageFactor = Math.pow(1.03, Math.max(0, clientAge - 25));
  const householdMult = householdSize > 1 ? 1 + (householdSize - 1) * 0.65 : 1.0;
  const tobaccoMult = tobacco === 'yes' ? 1.2 : 1.0;
  const dedMult = PRIVATE_DEDUCTIBLE_MULTIPLIERS[targetDeductibleInd] ?? 1.0;

  const basePreferred = 285 * ageFactor * householdMult * tobaccoMult * carrierInfo.rateFactor * dedMult;
  const preferredMonthly = Math.round(basePreferred);
  const choiceMonthly = Math.round(basePreferred * 0.82);
  const executiveMonthly = Math.round(basePreferred * 1.16);
  const hasPreExisting = preExisting === 'yes';

  const makeTier = (
    tierId: PrivatePpoTierId,
    title: string,
    badge: string,
    tagline: string,
    monthlyPreferred: number,
    dedInd: number,
    oopInd: number,
    primaryCopayLabel: string,
    specialistCopayLabel: string,
    coinsuranceLabel: string
  ): PrivatePpoTierOption => {
    const monthlyRatedLow = Math.round(monthlyPreferred * 1.35);
    const monthlyRatedHigh = Math.round(monthlyPreferred * 1.6);
    return {
      tierId,
      title,
      badge,
      tagline,
      monthlyPreferred,
      monthlyRatedLow,
      monthlyRatedHigh,
      annualPreferred: monthlyPreferred * 12,
      annualRatedLow: monthlyRatedLow * 12,
      annualRatedHigh: monthlyRatedHigh * 12,
      deductible: dedInd * famMult,
      maxOop: oopInd * famMult,
      primaryCopayLabel,
      specialistCopayLabel,
      coinsuranceLabel,
    };
  };

  return {
    carrierName: carrierInfo.name,
    carrierId: carrierInfo.id,
    hasPreExisting,
    isFamily,
    tiers: {
      choice: makeTier(
        'choice',
        'Choice Value PPO',
        'VALUE SHIELD',
        'Lower monthly rate tailored for healthy individuals & 1099 contractors needing catastrophic protection.',
        choiceMonthly,
        Math.round(targetDeductibleInd * 1.5),
        Math.round(targetDeductibleInd * 1.5) + 2500,
        '$45 Copay (3 visits/yr)',
        'Deductible then 30%',
        '70% / 30% Post-Ded'
      ),
      preferred: makeTier(
        'preferred',
        'Med-Guard Preferred PPO',
        'MOST POPULAR PPO',
        'Balanced first-dollar primary care, diagnostics & prescription coverage with nationwide PPO access.',
        preferredMonthly,
        targetDeductibleInd,
        targetDeductibleInd + 2500,
        '$30 Copay (No Ded.)',
        '$60 Copay',
        '80% / 20% Post-Ded'
      ),
      executive: makeTier(
        'executive',
        'Executive Direct Care PPO',
        '0% COINSURANCE',
        'Comprehensive low-risk structure dropping post-deductible coinsurance to 0% with immediate outpatient copays.',
        executiveMonthly,
        Math.max(1000, Math.round(targetDeductibleInd * 0.6)),
        Math.max(2500, Math.round(targetDeductibleInd * 0.6) + 1500),
        '$20 Copay (Unlimited)',
        '$40 Copay (No Referral)',
        '100% / 0% Post-Ded'
      ),
    },
  };
}

export function calculatePrivatePpoEstimate(params: {
  clientAge: number;
  householdSize: number;
  tobacco: 'no' | 'yes';
  preExisting: 'no' | 'yes';
}): PrivatePpoQuoteEstimate {
  const { clientAge, householdSize, tobacco, preExisting } = params;
  const ageFactor = Math.pow(1.03, Math.max(0, clientAge - 25));
  const householdMult = householdSize > 1 ? 1 + (householdSize - 1) * 0.65 : 1.0;
  const tobaccoMult = tobacco === 'yes' ? 1.2 : 1.0;

  const preferredMonthly = Math.round(285 * ageFactor * householdMult * tobaccoMult);
  const choiceValueMonthly = Math.round(preferredMonthly * 0.82);

  // Underwritten private health carriers typically apply +35% to +60% rate-ups (or exclusion/decline) when pre-existing conditions are present
  const hasPreExisting = preExisting === 'yes';

  return {
    hasPreExisting,
    preferredMonthly,
    preferredRatedLowMonthly: Math.round(preferredMonthly * 1.35),
    preferredRatedHighMonthly: Math.round(preferredMonthly * 1.6),
    choiceValueMonthly,
    choiceRatedLowMonthly: Math.round(choiceValueMonthly * 1.35),
    choiceRatedHighMonthly: Math.round(choiceValueMonthly * 1.6),
    preferredDeductible: householdSize > 1 ? 5000 : 2500,
    preferredOopMax: householdSize > 1 ? 10000 : 5000,
    choiceDeductible: householdSize > 1 ? 10000 : 5000,
    choiceOopMax: householdSize > 1 ? 15000 : 7500,
  };
}

export interface Solo401kYearLimits {
  baseElectiveDeferral: number;
  standardCatchUp: number;
  superCatchUp: number;
  catchUpCap: number;
  isSuperCatchUp: boolean;
  section415cCap: number;
  halfSeTax: number;
  earnedIncomeBase: number;
  w2Compensation: number;
  k1Distribution: number;
  soloEmployeeMax: number;
  soloEmployerMax: number;
  solo401kMaxTotal: number;
  sepIraMax: number;
  clientPhaseOutStart: number;
  clientPhaseOutEnd: number;
  spousalPhaseOutStart: number;
  spousalPhaseOutEnd: number;
}

export function getSolo401kLimitsForYearAndAge(
  taxYear: TaxYear = '2027',
  age: number,
  netBusinessProfit: number,
  entityBasis: SelfEmployedEntityBasis = 'schedule_c',
  filingStatus: FilingStatus = 'single',
  scorpW2Wages?: number
): Solo401kYearLimits {
  const is2026 = taxYear === '2026';
  const isMarried = filingStatus === 'married';

  // IRS Notice 2025-67 (2026) vs IRS Notice 2026-66 (2027+)
  const baseElectiveDeferral = is2026 ? 24500 : 25500;
  const standardCatchUp = is2026 ? 8000 : 8500;
  const superCatchUp = is2026 ? 11250 : 11750; // SECURE 2.0 ages 60–63
  const isSuperCatchUp = age >= 60 && age <= 63;
  const catchUpCap = isSuperCatchUp ? superCatchUp : age >= 50 ? standardCatchUp : 0;
  const section415cCap = is2026 ? 72000 : 75000;

  const cleanProfit = Math.max(0, netBusinessProfit);
  // Schedule C deducts 1/2 Self-Employment Tax before 20% net employer profit share;
  // S-Corp bases Solo 401(k)/SEP eligibility strictly on W-2 officer wages (K-1 distributions excluded)
  const w2Compensation =
    entityBasis === 'scorp'
      ? Math.min(cleanProfit, Math.max(0, scorpW2Wages !== undefined ? scorpW2Wages : Math.round(cleanProfit * 0.55)))
      : 0;
  const k1Distribution = entityBasis === 'scorp' ? Math.max(0, cleanProfit - w2Compensation) : 0;

  const halfSeTax =
    entityBasis === 'schedule_c' ? Math.round(cleanProfit * 0.9235 * 0.0765) : 0;
  const earnedIncomeBase =
    entityBasis === 'schedule_c' ? Math.max(0, cleanProfit - halfSeTax) : w2Compensation;

  const soloEmployeeMax = Math.min(earnedIncomeBase, baseElectiveDeferral + catchUpCap);
  const employerPctRaw =
    entityBasis === 'schedule_c'
      ? Math.round(earnedIncomeBase * 0.20)
      : Math.round(w2Compensation * 0.25);

  const baseDeferralUsedMax = Math.min(earnedIncomeBase, baseElectiveDeferral);
  const employerRoom415c = Math.max(0, section415cCap - baseDeferralUsedMax);
  const soloEmployerMax = Math.min(
    employerPctRaw,
    employerRoom415c,
    Math.max(0, earnedIncomeBase - soloEmployeeMax)
  );
  const solo401kMaxTotal = Math.min(earnedIncomeBase, section415cCap + catchUpCap);
  const sepIraMax = Math.min(section415cCap, employerPctRaw);

  const clientPhaseOutStart = isMarried ? (is2026 ? 129000 : 133000) : (is2026 ? 81000 : 83000);
  const clientPhaseOutEnd = clientPhaseOutStart + (isMarried ? 20000 : 10000);
  const spousalPhaseOutStart = is2026 ? 242000 : 250000;
  const spousalPhaseOutEnd = spousalPhaseOutStart + 10000;

  return {
    baseElectiveDeferral,
    standardCatchUp,
    superCatchUp,
    catchUpCap,
    isSuperCatchUp,
    section415cCap,
    halfSeTax,
    earnedIncomeBase,
    w2Compensation,
    k1Distribution,
    soloEmployeeMax,
    soloEmployerMax,
    solo401kMaxTotal,
    sepIraMax,
    clientPhaseOutStart,
    clientPhaseOutEnd,
    spousalPhaseOutStart,
    spousalPhaseOutEnd,
  };
}

export interface RealisticSelfEmployedDefaults {
  scorpW2Wages: number;
  soloEmployee: number;
  soloEmployer: number;
  sepContribution: number;
  stackClientIra: boolean;
  clientIraAmount: number;
  stackSpouseIra: boolean;
  spouseIraAmount: number;
  acaSafeFloor138: number;
  target150FplAgi: number;
  cliff400FplAgi: number;
  maxSafeDeductionBudget: number;
  sustainableCashFlowCap: number;
}

export function computeRealisticSelfEmployedDefaults(params: {
  grossAGI: number;
  netBusinessProfit: number;
  clientAge: number;
  spouseAge?: number;
  filingStatus: FilingStatus;
  householdSize: number;
  entityBasis?: SelfEmployedEntityBasis;
  taxYear?: TaxYear;
}): RealisticSelfEmployedDefaults {
  const {
    grossAGI,
    netBusinessProfit,
    clientAge,
    spouseAge = clientAge,
    filingStatus,
    householdSize,
    entityBasis = 'schedule_c',
    taxYear = '2027',
  } = params;

  const isMarried = filingStatus === 'married';
  const fpl100 = get100PercentFPL(householdSize, taxYear);
  const acaSafeFloor138 = Math.ceil(fpl100 * 1.38);
  const target150FplAgi = Math.max(acaSafeFloor138, Math.floor(fpl100 * 1.495));
  const cliff400FplAgi = Math.floor(fpl100 * 4.0);
  const maxSafeDeductionBudget = Math.max(0, grossAGI - acaSafeFloor138);

  const cleanProfit = Math.max(0, netBusinessProfit);
  // Reasonable S-Corp officer W-2 salary (~60% at lower profits, ~55% mid-high, capped for QBI balance)
  const scorpW2Ratio = cleanProfit <= 60000 ? 0.60 : cleanProfit <= 150000 ? 0.55 : 0.45;
  const scorpW2Wages =
    entityBasis === 'scorp'
      ? Math.min(cleanProfit, Math.round((cleanProfit * scorpW2Ratio) / 500) * 500)
      : 0;

  const limits = getSolo401kLimitsForYearAndAge(
    taxYear,
    clientAge,
    cleanProfit,
    entityBasis,
    filingStatus,
    scorpW2Wages
  );

  // Cash-flow sustainability factor scales gently with business profit
  // Modest earners (~$30k) retain ~70%+ cash flow for living expenses; higher earners save more to hit ACA cliffs
  const cashFlowRate =
    cleanProfit <= 45000
      ? 0.28
      : cleanProfit <= 90000
      ? 0.38
      : cleanProfit <= 160000
      ? 0.50
      : 0.60;
  const sustainableCashFlowCap = Math.round((cleanProfit * cashFlowRate) / 500) * 500;

  // Desired reduction aims for 150% FPL Silver CSR within sustainable cash flow and strict 138% FPL floor
  const reductionFor150Fpl = Math.max(0, grossAGI - target150FplAgi);
  const desiredTotal = Math.min(
    maxSafeDeductionBudget,
    Math.max(0, Math.min(reductionFor150Fpl, sustainableCashFlowCap))
  );

  // Allocate realistically across Solo 401(k) employee deferral + employer profit share (both sides!)
  const targetPrimary = Math.min(desiredTotal, limits.solo401kMaxTotal);
  const empShareGoal = Math.round((targetPrimary * 0.65) / 500) * 500;
  let soloEmployee = Math.min(limits.soloEmployeeMax, empShareGoal);
  let soloEmployer = Math.min(
    limits.soloEmployerMax,
    Math.round(Math.max(0, targetPrimary - soloEmployee) / 500) * 500
  );
  // Top up employee deferral if employer cap was lower
  if (soloEmployee + soloEmployer < targetPrimary) {
    soloEmployee = Math.min(
      limits.soloEmployeeMax,
      Math.floor((targetPrimary - soloEmployer) / 500) * 500
    );
  }
  const actualSoloTotal = Math.min(soloEmployee + soloEmployer, maxSafeDeductionBudget);
  if (soloEmployee + soloEmployer > maxSafeDeductionBudget) {
    soloEmployer = Math.min(soloEmployer, Math.max(0, maxSafeDeductionBudget - soloEmployee));
    soloEmployee = Math.min(soloEmployee, Math.max(0, maxSafeDeductionBudget - soloEmployer));
  }

  // SEP-IRA realistic default
  const sepContribution = Math.min(
    limits.sepIraMax,
    maxSafeDeductionBudget,
    Math.floor(desiredTotal / 500) * 500
  );

  // Stacked Traditional IRA realistic defaults (avoid active-participant phaseout & respect 138% floor)
  const clientIraStat = getIRSLimitForAge(clientAge);
  const spouseIraStat = getIRSLimitForAge(spouseAge);
  const remainingBudgetAfterSolo = Math.max(0, desiredTotal - actualSoloTotal);
  const magiAfterSolo = Math.max(0, grossAGI - actualSoloTotal);

  let clientIraAmount = 0;
  if (
    remainingBudgetAfterSolo >= 500 &&
    (actualSoloTotal === 0 || magiAfterSolo < limits.clientPhaseOutStart)
  ) {
    clientIraAmount = Math.min(
      clientIraStat,
      Math.floor(remainingBudgetAfterSolo / 100) * 100
    );
  } else if (
    grossAGI - actualSoloTotal > target150FplAgi &&
    (actualSoloTotal === 0 || magiAfterSolo < limits.clientPhaseOutStart) &&
    actualSoloTotal < sustainableCashFlowCap
  ) {
    const spareHeadroom = Math.min(
      maxSafeDeductionBudget - actualSoloTotal,
      Math.max(0, sustainableCashFlowCap - actualSoloTotal)
    );
    clientIraAmount = Math.min(clientIraStat, Math.floor(spareHeadroom / 100) * 100);
  }

  const remainingForSpouse = Math.max(
    0,
    Math.min(
      maxSafeDeductionBudget - actualSoloTotal - clientIraAmount,
      sustainableCashFlowCap - actualSoloTotal - clientIraAmount
    )
  );
  const spouseIraAmount =
    isMarried &&
    remainingForSpouse >= 500 &&
    magiAfterSolo - clientIraAmount < limits.spousalPhaseOutStart
      ? Math.min(spouseIraStat, Math.floor(remainingForSpouse / 100) * 100)
      : 0;

  return {
    scorpW2Wages,
    soloEmployee,
    soloEmployer,
    sepContribution,
    stackClientIra: clientIraAmount > 0 || actualSoloTotal === 0 || magiAfterSolo < limits.clientPhaseOutStart,
    clientIraAmount,
    stackSpouseIra: isMarried && (spouseIraAmount > 0 || magiAfterSolo - clientIraAmount < limits.spousalPhaseOutStart),
    spouseIraAmount,
    acaSafeFloor138,
    target150FplAgi,
    cliff400FplAgi,
    maxSafeDeductionBudget,
    sustainableCashFlowCap,
  };
}

export interface SelfEmployedStrategyResult {
  limits: Solo401kYearLimits;
  acaSafeFloor138: number;
  target150FplAgi: number;
  cliff400FplAgi: number;
  maxSafeDeductionBudget: number;
  remainingSafeBudget: number;
  isAtAcaSafeFloor: boolean;
  solo401kMaxTotal: number;
  solo401kEmployeeMax: number;
  solo401kEmployerMax: number;
  sepIraMax: number;
  traditionalIraStatLimit: number;
  spousalIraStatLimit: number;
  clientIraRequested: number;
  clientIraDeductible: number;
  clientIraNonDeductible: number;
  clientIraPhaseOutStatus: 'full' | 'partial' | 'none';
  clientIraPhaseOutNotice: string;
  spouseIraRequested: number;
  spouseIraDeductible: number;
  spouseIraNonDeductible: number;
  spouseIraPhaseOutStatus: 'full' | 'partial' | 'none';
  spouseIraPhaseOutNotice: string;
  hasPhaseOutWarning: boolean;
  phaseOutWarningHeadline: string;
  idealFix: {
    summary: string;
    soloEmployee: number;
    soloEmployer: number;
    sepContribution: number;
    stackClientIra: boolean;
    clientIraAmount: number;
    stackSpouseIra: boolean;
    spouseIraAmount: number;
  };
  activeSoloEmployee: number;
  activeSoloEmployer: number;
  activeSepContribution: number;
  activePrimaryPlanContribution: number;
  magiAfterPrimaryPlan: number;
  totalPreTaxDeduction: number;
  baselineAgi: number;
  baselineFplPct: number;
  optimizedAgi: number;
  optimizedFplPct: number;
  baselineAca: ReturnType<typeof calculateAcaDetails>;
  optimizedAca: ReturnType<typeof calculateAcaDetails>;
  baselineSilverTier: AcaTierProjectionResult;
  optimizedSilverTier: AcaTierProjectionResult;
  monthlySubsidyGain: number;
  annualSubsidyGain: number;
  annualTaxSavings: number;
  totalAnnualBenefit: number;
  marginalTaxRate: number;
  isSpousalLoopholeActive: boolean;
}

export function calculateSelfEmployedAcaStrategy(params: {
  grossAGI: number;
  netBusinessProfit: number;
  clientAge: number;
  filingStatus: FilingStatus;
  householdSize: number;
  selectedVehicle: 'solo401k' | 'sep_ira' | 'stacked_solo' | 'stacked_sep';
  entityBasis?: SelfEmployedEntityBasis;
  scorpW2Wages?: number;
  customSoloEmployee?: number;
  customSoloEmployer?: number;
  customSepContribution?: number;
  stackClientTradIra?: boolean;
  customClientIraAmount?: number;
  stackSpousalIra?: boolean;
  customSpouseIraAmount?: number;
  spouseAge?: number;
  spouseCoveredByPlan?: boolean;
  taxYear?: TaxYear;
  carrierId?: HealthCarrierId;
}): SelfEmployedStrategyResult {
  const {
    grossAGI,
    netBusinessProfit,
    clientAge,
    filingStatus,
    householdSize,
    selectedVehicle,
    entityBasis = 'schedule_c',
    scorpW2Wages,
    stackClientTradIra = true,
    stackSpousalIra = true,
    spouseAge = 52,
    spouseCoveredByPlan = false,
    taxYear = '2027',
    carrierId = 'oscar',
  } = params;

  const isMarried = filingStatus === 'married';
  const limits = getSolo401kLimitsForYearAndAge(
    taxYear,
    clientAge,
    netBusinessProfit,
    entityBasis,
    filingStatus,
    scorpW2Wages
  );

  // Strict 138% FPL Medicaid-safe ACA floor guard
  const fpl100 = get100PercentFPL(householdSize, taxYear);
  const acaSafeFloor138 = Math.ceil(fpl100 * 1.38);
  const target150FplAgi = Math.max(acaSafeFloor138, Math.floor(fpl100 * 1.495));
  const cliff400FplAgi = Math.floor(fpl100 * 4.0);
  const maxSafeDeductionBudget = Math.max(0, grossAGI - acaSafeFloor138);

  // Traditional IRA statutory limit ($7,500 under 50 / $8,600 age 50+)
  const clientIraCap = getIRSLimitForAge(clientAge, filingStatus);
  const spouseIraCap = getIRSLimitForAge(spouseAge, filingStatus);

  // Determine Primary Vehicle Contribution bounded by IRS caps & 138% FPL Safe Budget
  let primaryPlanContribution = 0;
  let activeSoloEmp = 0;
  let activeSoloEr = 0;
  let activeSep = 0;

  if (selectedVehicle === 'solo401k' || selectedVehicle === 'stacked_solo') {
    activeSoloEmp = Math.min(
      params.customSoloEmployee !== undefined ? params.customSoloEmployee : limits.soloEmployeeMax,
      limits.soloEmployeeMax,
      maxSafeDeductionBudget
    );
    activeSoloEr = Math.min(
      params.customSoloEmployer !== undefined ? params.customSoloEmployer : limits.soloEmployerMax,
      limits.soloEmployerMax,
      Math.max(0, maxSafeDeductionBudget - activeSoloEmp)
    );
    primaryPlanContribution = Math.min(
      activeSoloEmp + activeSoloEr,
      limits.solo401kMaxTotal,
      maxSafeDeductionBudget
    );
  } else {
    activeSep = Math.min(
      params.customSepContribution !== undefined ? params.customSepContribution : limits.sepIraMax,
      limits.sepIraMax,
      maxSafeDeductionBudget
    );
    primaryPlanContribution = activeSep;
  }

  const magiAfterPrimaryPlan = Math.max(0, grossAGI - primaryPlanContribution);
  const budgetAfterPrimary = Math.max(0, maxSafeDeductionBudget - primaryPlanContribution);

  const clientRequested = stackClientTradIra
    ? Math.min(
        clientIraCap,
        budgetAfterPrimary,
        Math.max(0, params.customClientIraAmount !== undefined ? params.customClientIraAmount : clientIraCap)
      )
    : 0;

  // Evaluate Active Participant Phase-Out for Client Traditional IRA (only active if contributing > $0 to Solo 401k / SEP)
  const isParticipantActive = primaryPlanContribution > 0;
  let clientIraMaxAllowed = clientIraCap;
  let clientIraPhaseOutStatus: 'full' | 'partial' | 'none' = 'full';
  let clientIraPhaseOutNotice = '';

  if (clientRequested === 0) {
    clientIraPhaseOutNotice =
      budgetAfterPrimary === 0 && grossAGI > acaSafeFloor138
        ? `138% FPL Safe Cap Reached: $${primaryPlanContribution.toLocaleString()} primary plan contribution already lowers MAGI to the $${acaSafeFloor138.toLocaleString()} (138% FPL) ACA safety floor.`
        : 'Client Traditional IRA stacking disabled ($0 allocated).';
  } else if (!isParticipantActive) {
    clientIraPhaseOutStatus = 'full';
    clientIraPhaseOutNotice = `Full $${clientRequested.toLocaleString()} deductible ($0 contributed to Solo 401(k)/SEP, so no active-participant phaseout applies).`;
  } else if (magiAfterPrimaryPlan < limits.clientPhaseOutStart) {
    clientIraPhaseOutStatus = 'full';
    clientIraPhaseOutNotice = `Full $${clientRequested.toLocaleString()} deduction qualified (MAGI $${Math.round(magiAfterPrimaryPlan).toLocaleString()} < $${limits.clientPhaseOutStart.toLocaleString()}). Drops ACA MAGI dollar-for-dollar.`;
  } else if (magiAfterPrimaryPlan < limits.clientPhaseOutEnd) {
    const ratio =
      (limits.clientPhaseOutEnd - magiAfterPrimaryPlan) /
      (limits.clientPhaseOutEnd - limits.clientPhaseOutStart);
    clientIraMaxAllowed = Math.max(200, Math.round((clientIraCap * ratio) / 10) * 10);
    clientIraPhaseOutStatus = clientRequested > clientIraMaxAllowed ? 'partial' : 'full';
    clientIraPhaseOutNotice = `Partial phase-out ($${limits.clientPhaseOutStart.toLocaleString()}–$${limits.clientPhaseOutEnd.toLocaleString()} MAGI range). Max IRS deductible limit is $${clientIraMaxAllowed.toLocaleString()} under IRC § 219(g).`;
  } else {
    clientIraMaxAllowed = 0;
    clientIraPhaseOutStatus = 'none';
    clientIraPhaseOutNotice = `Active Participant Trap: Intermediate MAGI ($${Math.round(magiAfterPrimaryPlan).toLocaleString()}) exceeds the $${limits.clientPhaseOutEnd.toLocaleString()} IRS cutoff. $${clientRequested.toLocaleString()} allocated here becomes non-deductible after-tax with $0 ACA reduction.`;
  }

  const clientIraDeductible = Math.min(clientRequested, clientIraMaxAllowed);
  const clientIraNonDeductible = Math.max(0, clientRequested - clientIraDeductible);

  // Spousal IRA Loophole (IRC § 219(g)(7))
  const budgetAfterClient = Math.max(0, budgetAfterPrimary - clientIraDeductible);
  const spouseRequested =
    isMarried && stackSpousalIra
      ? Math.min(
          spouseIraCap,
          budgetAfterClient,
          Math.max(0, params.customSpouseIraAmount !== undefined ? params.customSpouseIraAmount : spouseIraCap)
        )
      : 0;

  let spouseIraMaxAllowed = spouseIraCap;
  let spouseIraPhaseOutStatus: 'full' | 'partial' | 'none' = 'full';
  let spouseIraPhaseOutNotice = '';
  let isSpousalLoopholeActive = false;
  const magiBeforeSpouse = Math.max(0, magiAfterPrimaryPlan - clientIraDeductible);

  if (isMarried) {
    if (spouseRequested === 0) {
      spouseIraPhaseOutNotice =
        budgetAfterClient === 0 && grossAGI > acaSafeFloor138
          ? `138% FPL Safe Cap Reached: Remaining deductions already place household MAGI at the $${acaSafeFloor138.toLocaleString()} ACA safety floor.`
          : 'Spousal IRA stacking disabled ($0 allocated).';
    } else if (!spouseCoveredByPlan) {
      if (magiBeforeSpouse < limits.spousalPhaseOutStart) {
        spouseIraPhaseOutStatus = 'full';
        spouseIraPhaseOutNotice = `Spousal IRA Loophole Active: Uncovered spouse qualifies for full $${spouseRequested.toLocaleString()} deduction up to $${limits.spousalPhaseOutStart.toLocaleString()} MAGI under IRC § 219(g)(7).`;
        if (clientIraDeductible < clientIraCap) isSpousalLoopholeActive = true;
      } else if (magiBeforeSpouse < limits.spousalPhaseOutEnd) {
        const ratio =
          (limits.spousalPhaseOutEnd - magiBeforeSpouse) /
          (limits.spousalPhaseOutEnd - limits.spousalPhaseOutStart);
        spouseIraMaxAllowed = Math.max(200, Math.round((spouseIraCap * ratio) / 10) * 10);
        spouseIraPhaseOutStatus = spouseRequested > spouseIraMaxAllowed ? 'partial' : 'full';
        spouseIraPhaseOutNotice = `Partial Spousal IRA phase-out ($${limits.spousalPhaseOutStart.toLocaleString()}–$${limits.spousalPhaseOutEnd.toLocaleString()} MAGI). Max deductible: $${spouseIraMaxAllowed.toLocaleString()}.`;
        isSpousalLoopholeActive = true;
      } else {
        spouseIraMaxAllowed = 0;
        spouseIraPhaseOutStatus = 'none';
        spouseIraPhaseOutNotice = `Joint MAGI ($${Math.round(magiBeforeSpouse).toLocaleString()}) exceeds the $${limits.spousalPhaseOutEnd.toLocaleString()} limit for uncovered spouses under IRC § 219(g)(7).`;
      }
    } else {
      if (magiBeforeSpouse < limits.clientPhaseOutStart) {
        spouseIraPhaseOutStatus = 'full';
        spouseIraPhaseOutNotice = `Spouse covered by plan: full $${spouseRequested.toLocaleString()} deduction qualified (MAGI < $${limits.clientPhaseOutStart.toLocaleString()}).`;
      } else if (magiBeforeSpouse < limits.clientPhaseOutEnd) {
        const ratio =
          (limits.clientPhaseOutEnd - magiBeforeSpouse) /
          (limits.clientPhaseOutEnd - limits.clientPhaseOutStart);
        spouseIraMaxAllowed = Math.max(200, Math.round((spouseIraCap * ratio) / 10) * 10);
        spouseIraPhaseOutStatus = spouseRequested > spouseIraMaxAllowed ? 'partial' : 'full';
        spouseIraPhaseOutNotice = `Spouse covered by plan: partial phase-out ($${limits.clientPhaseOutStart.toLocaleString()}–$${limits.clientPhaseOutEnd.toLocaleString()}). Max deductible: $${spouseIraMaxAllowed.toLocaleString()}.`;
      } else {
        spouseIraMaxAllowed = 0;
        spouseIraPhaseOutStatus = 'none';
        spouseIraPhaseOutNotice = `Spouse covered by workplace plan: phased out above $${limits.clientPhaseOutEnd.toLocaleString()} joint MAGI.`;
      }
    }
  }

  const spouseIraDeductible = Math.min(spouseRequested, spouseIraMaxAllowed);
  const spouseIraNonDeductible = Math.max(0, spouseRequested - spouseIraDeductible);

  // Phase-Out Alert & Ideal 1-Click Fix Computation (respecting 138% FPL Safe Budget)
  const hasPhaseOutWarning = clientIraNonDeductible > 0 || spouseIraNonDeductible > 0;
  let idealSoloEmp = activeSoloEmp;
  let idealSoloEr = activeSoloEr;
  let idealSep = activeSep;
  let idealSummary = '';

  if (hasPhaseOutWarning) {
    if (selectedVehicle === 'sep_ira') {
      const targetNeeded = Math.min(
        maxSafeDeductionBudget,
        Math.max(0, grossAGI - (limits.clientPhaseOutStart - 500))
      );
      idealSep = Math.min(
        limits.sepIraMax,
        maxSafeDeductionBudget,
        Math.max(activeSep, Math.floor(targetNeeded / 500) * 500)
      );
    } else {
      const targetNeeded = Math.min(
        maxSafeDeductionBudget,
        Math.max(0, grossAGI - (limits.clientPhaseOutStart - 500))
      );
      if (activeSoloEmp + activeSoloEr < targetNeeded) {
        idealSoloEmp = Math.min(
          limits.soloEmployeeMax,
          maxSafeDeductionBudget,
          Math.max(activeSoloEmp, Math.floor(targetNeeded / 500) * 500)
        );
        const remainingNeeded = Math.max(0, targetNeeded - idealSoloEmp);
        idealSoloEr = Math.min(
          limits.soloEmployerMax,
          Math.max(0, maxSafeDeductionBudget - idealSoloEmp),
          Math.max(activeSoloEr, Math.floor(remainingNeeded / 500) * 500)
        );
      }
    }
  }

  const idealPrimary =
    selectedVehicle === 'sep_ira'
      ? idealSep
      : Math.min(idealSoloEmp + idealSoloEr, limits.solo401kMaxTotal, maxSafeDeductionBudget);
  const idealMagiAfterPrimary = Math.max(0, grossAGI - idealPrimary);
  const idealBudgetAfterPrimary = Math.max(0, maxSafeDeductionBudget - idealPrimary);

  let idealClientMax = clientIraCap;
  if (idealPrimary > 0) {
    if (idealMagiAfterPrimary >= limits.clientPhaseOutEnd) {
      idealClientMax = 0;
    } else if (idealMagiAfterPrimary >= limits.clientPhaseOutStart) {
      const r =
        (limits.clientPhaseOutEnd - idealMagiAfterPrimary) /
        (limits.clientPhaseOutEnd - limits.clientPhaseOutStart);
      idealClientMax = Math.max(200, Math.round((clientIraCap * r) / 10) * 10);
    }
  }
  const idealClientIraAmount = stackClientTradIra
    ? Math.min(clientRequested || clientIraCap, idealClientMax, idealBudgetAfterPrimary)
    : 0;
  const idealMagiBeforeSpouse = Math.max(0, idealMagiAfterPrimary - idealClientIraAmount);
  const idealBudgetAfterClient = Math.max(0, idealBudgetAfterPrimary - idealClientIraAmount);

  let idealSpouseMax = spouseIraCap;
  if (isMarried) {
    const spStart = spouseCoveredByPlan ? limits.clientPhaseOutStart : limits.spousalPhaseOutStart;
    const spEnd = spouseCoveredByPlan ? limits.clientPhaseOutEnd : limits.spousalPhaseOutEnd;
    if (idealMagiBeforeSpouse >= spEnd) {
      idealSpouseMax = 0;
    } else if (idealMagiBeforeSpouse >= spStart) {
      const r = (spEnd - idealMagiBeforeSpouse) / (spEnd - spStart);
      idealSpouseMax = Math.max(200, Math.round((spouseIraCap * r) / 10) * 10);
    }
  }
  const idealSpouseIraAmount =
    isMarried && stackSpousalIra
      ? Math.min(spouseRequested || spouseIraCap, idealSpouseMax, idealBudgetAfterClient)
      : 0;

  const boostedPrimary = idealPrimary > primaryPlanContribution;
  if (hasPhaseOutWarning) {
    if (boostedPrimary && idealClientIraAmount > 0 && idealSpouseIraAmount >= spouseRequested) {
      idealSummary = `Boost ${selectedVehicle === 'sep_ira' ? 'SEP-IRA' : 'Solo 401(k)'} to $${idealPrimary.toLocaleString()} to drop intermediate MAGI to $${Math.round(idealMagiAfterPrimary).toLocaleString()} — unlocking full IRA deductibility with $0 phase-out.`;
    } else if (boostedPrimary) {
      idealSummary = `Max ${selectedVehicle === 'sep_ira' ? 'SEP-IRA' : 'Solo 401(k)'} to $${idealPrimary.toLocaleString()} and clear $${((clientRequested - idealClientIraAmount) + (spouseRequested - idealSpouseIraAmount)).toLocaleString()} of non-deductible IRA overflow (keep $${idealClientIraAmount.toLocaleString()} Client / $${idealSpouseIraAmount.toLocaleString()} Spousal deductible).`;
    } else {
      idealSummary = `Your ${selectedVehicle === 'sep_ira' ? 'SEP-IRA' : 'Solo 401(k)'} is already maximized — clear the trapped non-deductible IRA portion (Client: $${idealClientIraAmount.toLocaleString()}${isMarried ? ` · Spousal: $${idealSpouseIraAmount.toLocaleString()}` : ''}) to avoid after-tax IRA basis paperwork or re-route to Roth.`;
    }
  }

  const totalNonDeductibleTrapped = clientIraNonDeductible + spouseIraNonDeductible;
  const phaseOutWarningHeadline = hasPhaseOutWarning
    ? `IRS Phase-Out Alert: $${totalNonDeductibleTrapped.toLocaleString()} of Your Traditional IRA Allocation Is Non-Deductible ($0 ACA Reduction)`
    : '';

  // Total Combined Pre-Tax Deduction & Final Optimized AGI (strictly >= 138% FPL unless Baseline AGI <= 138% FPL)
  const totalPreTaxDeduction = primaryPlanContribution + clientIraDeductible + spouseIraDeductible;
  const remainingSafeBudget = Math.max(0, maxSafeDeductionBudget - totalPreTaxDeduction);
  const optimizedAgi =
    grossAGI <= acaSafeFloor138
      ? grossAGI
      : Math.max(acaSafeFloor138, grossAGI - totalPreTaxDeduction);
  const isAtAcaSafeFloor = grossAGI > acaSafeFloor138 && optimizedAgi <= acaSafeFloor138;

  // ACA Benchmark & Subsidy Math: Baseline vs Optimized (synced with taxYear & carrierId)
  const baselineProjection = calculateAcaTierProjection({
    agi: grossAGI,
    householdSize,
    clientAge,
    carrierId,
    scenario: 'moderate',
    taxYear,
  });
  const optimizedProjection = calculateAcaTierProjection({
    agi: optimizedAgi,
    householdSize,
    clientAge,
    carrierId,
    scenario: 'moderate',
    taxYear,
  });
  const baselineAca = baselineProjection.baseAca;
  const optimizedAca = optimizedProjection.baseAca;
  const baselineSilverTier = baselineProjection.tiers.silver;
  const optimizedSilverTier = optimizedProjection.tiers.silver;

  const monthlySubsidyGain = Math.max(0, optimizedAca.monthlySubsidy - baselineAca.monthlySubsidy);
  const annualSubsidyGain = monthlySubsidyGain * 12;

  // Federal Tax Savings
  const marginalTaxRate = getMarginalTaxRate(grossAGI, filingStatus);
  const annualTaxSavings = Math.round(totalPreTaxDeduction * marginalTaxRate);
  const totalAnnualBenefit = annualSubsidyGain + annualTaxSavings;

  return {
    limits,
    acaSafeFloor138,
    target150FplAgi,
    cliff400FplAgi,
    maxSafeDeductionBudget,
    remainingSafeBudget,
    isAtAcaSafeFloor,
    solo401kMaxTotal: limits.solo401kMaxTotal,
    solo401kEmployeeMax: limits.soloEmployeeMax,
    solo401kEmployerMax: limits.soloEmployerMax,
    sepIraMax: limits.sepIraMax,
    traditionalIraStatLimit: clientIraCap,
    spousalIraStatLimit: spouseIraCap,
    clientIraRequested: clientRequested,
    clientIraDeductible,
    clientIraNonDeductible,
    clientIraPhaseOutStatus,
    clientIraPhaseOutNotice,
    spouseIraRequested: spouseRequested,
    spouseIraDeductible,
    spouseIraNonDeductible,
    spouseIraPhaseOutStatus,
    spouseIraPhaseOutNotice,
    hasPhaseOutWarning,
    phaseOutWarningHeadline,
    idealFix: {
      summary: idealSummary,
      soloEmployee: idealSoloEmp,
      soloEmployer: idealSoloEr,
      sepContribution: idealSep,
      stackClientIra: idealClientIraAmount > 0,
      clientIraAmount: idealClientIraAmount,
      stackSpouseIra: idealSpouseIraAmount > 0,
      spouseIraAmount: idealSpouseIraAmount,
    },
    activeSoloEmployee: activeSoloEmp,
    activeSoloEmployer: activeSoloEr,
    activeSepContribution: activeSep,
    activePrimaryPlanContribution: primaryPlanContribution,
    magiAfterPrimaryPlan,
    totalPreTaxDeduction,
    baselineAgi: grossAGI,
    baselineFplPct: baselineAca.fplPct,
    optimizedAgi,
    optimizedFplPct: optimizedAca.fplPct,
    baselineAca,
    optimizedAca,
    baselineSilverTier,
    optimizedSilverTier,
    monthlySubsidyGain,
    annualSubsidyGain,
    annualTaxSavings,
    totalAnnualBenefit,
    marginalTaxRate,
    isSpousalLoopholeActive,
  };
}

export interface MaxAcaOptimizationPreset {
  soloEmployee: number;
  soloEmployer: number;
  sepContribution: number;
  stackClientIra: boolean;
  clientIraAmount: number;
  stackSpouseIra: boolean;
  spouseIraAmount: number;
  projectedAgi: number;
}

export function computeMaxAcaOptimizationPreset(params: {
  grossAGI: number;
  netBusinessProfit: number;
  clientAge: number;
  spouseAge?: number;
  filingStatus: FilingStatus;
  householdSize: number;
  selectedVehicle: 'stacked_solo' | 'sep_ira';
  entityBasis: SelfEmployedEntityBasis;
  scorpW2Wages?: number;
  spouseCoveredByPlan?: boolean;
  taxYear?: TaxYear;
}): MaxAcaOptimizationPreset {
  const {
    grossAGI,
    netBusinessProfit,
    clientAge,
    spouseAge = clientAge,
    filingStatus,
    householdSize,
    selectedVehicle,
    entityBasis,
    scorpW2Wages,
    spouseCoveredByPlan = false,
    taxYear = '2027',
  } = params;

  const isMarried = filingStatus === 'married';
  const fpl100 = get100PercentFPL(householdSize, taxYear);
  const acaSafeFloor138 = Math.ceil(fpl100 * 1.38);
  const maxSafeBudget = Math.max(0, grossAGI - acaSafeFloor138);

  const limits = getSolo401kLimitsForYearAndAge(
    taxYear,
    clientAge,
    netBusinessProfit,
    entityBasis,
    filingStatus,
    scorpW2Wages
  );

  // First maximize primary business retirement deduction up to 138% FPL floor budget
  let soloEmployee = 0;
  let soloEmployer = 0;
  let sepContribution = 0;
  let usedPrimary = 0;

  if (selectedVehicle === 'sep_ira') {
    sepContribution = Math.min(limits.sepIraMax, maxSafeBudget);
    usedPrimary = sepContribution;
  } else {
    soloEmployee = Math.min(limits.soloEmployeeMax, maxSafeBudget);
    soloEmployer = Math.min(
      limits.soloEmployerMax,
      Math.max(0, limits.solo401kMaxTotal - soloEmployee),
      Math.max(0, maxSafeBudget - soloEmployee)
    );
    usedPrimary = Math.min(soloEmployee + soloEmployer, limits.solo401kMaxTotal, maxSafeBudget);
  }

  let remainingBudget = Math.max(0, maxSafeBudget - usedPrimary);
  const magiAfterPrimary = Math.max(0, grossAGI - usedPrimary);

  // Next allocate Client Traditional IRA only up to deductible limit + remaining 138% FPL budget
  const clientIraStat = getIRSLimitForAge(clientAge);
  const clientIraRes = getTraditionalIRADeductionLimit(
    magiAfterPrimary,
    clientAge,
    usedPrimary > 0,
    filingStatus,
    spouseCoveredByPlan,
    taxYear
  );
  const clientIraAmount = Math.min(clientIraStat, clientIraRes.maxDeductible, remainingBudget);
  remainingBudget = Math.max(0, remainingBudget - clientIraAmount);

  // Next allocate Spousal IRA (when married) up to deductible limit + remaining 138% FPL budget
  const spouseIraStat = getIRSLimitForAge(spouseAge);
  let spouseIraAmount = 0;
  if (isMarried && remainingBudget > 0) {
    const magiBeforeSpouse = Math.max(0, magiAfterPrimary - clientIraAmount);
    const spouseIraRes = getTraditionalIRADeductionLimit(
      magiBeforeSpouse,
      spouseAge,
      spouseCoveredByPlan,
      filingStatus,
      usedPrimary > 0,
      taxYear
    );
    spouseIraAmount = Math.min(spouseIraStat, spouseIraRes.maxDeductible, remainingBudget);
  }

  const totalUsed = usedPrimary + clientIraAmount + spouseIraAmount;
  const projectedAgi = grossAGI <= acaSafeFloor138 ? grossAGI : Math.max(acaSafeFloor138, grossAGI - totalUsed);

  return {
    soloEmployee,
    soloEmployer,
    sepContribution,
    stackClientIra: clientIraAmount > 0,
    clientIraAmount,
    stackSpouseIra: spouseIraAmount > 0,
    spouseIraAmount,
    projectedAgi,
  };
}

export interface SliderThresholdJump {
  thresholdLabel: string;
  benefitLabel: string;
  targetSliderValue: number;
  deltaNeeded: number;
  monthlyAptcGain: number;
  isCloseProximity: boolean;
}

export function getNextBenefitThresholdForSlider(params: {
  sliderType: 'primary_plan' | 'client_ira' | 'spouse_ira';
  currentSliderValue: number;
  sliderSafeCap: number;
  currentOptimizedAgi: number;
  grossAGI: number;
  magiAfterPrimaryPlan: number;
  clientAge: number;
  householdSize: number;
  taxYear?: TaxYear;
  clientPhaseOutStart: number;
  isClientIraActive?: boolean;
}): SliderThresholdJump | null {
  const {
    sliderType,
    currentSliderValue,
    sliderSafeCap,
    currentOptimizedAgi,
    clientAge,
    householdSize,
    taxYear = '2027',
    clientPhaseOutStart,
    isClientIraActive = false,
  } = params;

  const headroom = Math.max(0, sliderSafeCap - currentSliderValue);
  if (headroom <= 50) return null;

  const fpl100 = get100PercentFPL(householdSize, taxYear);
  const acaSafeFloor138 = Math.ceil(fpl100 * 1.38);
  const currentAca = calculateAcaDetails(currentOptimizedAgi, householdSize, clientAge, taxYear);

  type Candidate = {
    thresholdLabel: string;
    benefitLabel: string;
    delta: number;
    targetAgi: number;
  };
  const candidates: Candidate[] = [];

  // 1. ACA FPL Thresholds (in descending AGI order, find exact delta to cross cleanly)
  const fplBreakpoints: Array<{ mult: number; label: string; badge: string }> = [
    { mult: 4.0, label: '400% FPL Cliff', badge: 'Unlocks ACA APTC Subsidies' },
    { mult: 2.5, label: '250% FPL Tier', badge: 'Unlocks 73% Silver CSR + Higher APTC' },
    { mult: 2.0, label: '200% FPL Tier', badge: 'Unlocks 87% Silver CSR ($800 Ded.)' },
    { mult: 1.495, label: '150% FPL Tier', badge: 'Unlocks 94% Silver CSR ($0 Ded.)' },
  ];

  for (const bp of fplBreakpoints) {
    const cutoffAgi = Math.floor(fpl100 * bp.mult);
    if (cutoffAgi >= acaSafeFloor138 && currentOptimizedAgi > cutoffAgi) {
      const delta = currentOptimizedAgi - cutoffAgi;
      if (delta > 0 && delta <= headroom) {
        candidates.push({
          thresholdLabel: bp.label,
          benefitLabel: bp.badge,
          delta,
          targetAgi: cutoffAgi,
        });
      }
    }
  }

  // 2. IRS Traditional IRA Active-Participant Phase-Out Unlock (for Solo 401k / SEP sliders)
  if (
    sliderType === 'primary_plan' &&
    isClientIraActive &&
    currentSliderValue > 0 &&
    params.magiAfterPrimaryPlan >= clientPhaseOutStart
  ) {
    const unlockAgi = clientPhaseOutStart - 100;
    const deltaToUnlock = params.magiAfterPrimaryPlan - unlockAgi;
    if (deltaToUnlock > 0 && deltaToUnlock <= headroom) {
      candidates.push({
        thresholdLabel: 'IRS IRA Unlock',
        benefitLabel: 'Unlocks Full Deductible Trad IRA',
        delta: deltaToUnlock,
        targetAgi: Math.max(acaSafeFloor138, currentOptimizedAgi - deltaToUnlock),
      });
    }
  }

  // 3. Max 138% FPL Safe Floor option if still above floor and no closer breakpoint exists (or within close range)
  if (currentOptimizedAgi > acaSafeFloor138) {
    const deltaTo138 = Math.min(headroom, currentOptimizedAgi - acaSafeFloor138);
    if (deltaTo138 > 0) {
      const resultingAgi = Math.max(acaSafeFloor138, currentOptimizedAgi - deltaTo138);
      const nextAca = calculateAcaDetails(resultingAgi, householdSize, clientAge, taxYear);
      const gain = Math.max(0, nextAca.monthlySubsidy - currentAca.monthlySubsidy);
      if (candidates.length === 0 && (gain > 0 || resultingAgi === acaSafeFloor138)) {
        candidates.push({
          thresholdLabel: resultingAgi === acaSafeFloor138 ? '138% FPL Max ACA' : 'Max Slider ACA',
          benefitLabel: gain > 0 ? `+$${gain.toLocaleString()}/mo APTC Boost` : 'Lowest Safe ACA MAGI',
          delta: deltaTo138,
          targetAgi: resultingAgi,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Choose nearest actionable breakpoint
  candidates.sort((a, b) => a.delta - b.delta);
  const best = candidates[0];
  const targetSliderValue = Math.min(sliderSafeCap, currentSliderValue + best.delta);
  const actualDelta = Math.max(0, targetSliderValue - currentSliderValue);
  if (actualDelta <= 0) return null;

  const afterAca = calculateAcaDetails(best.targetAgi, householdSize, clientAge, taxYear);
  const monthlyAptcGain = Math.max(0, afterAca.monthlySubsidy - currentAca.monthlySubsidy);

  return {
    thresholdLabel: best.thresholdLabel,
    benefitLabel:
      monthlyAptcGain > 0
        ? `${best.benefitLabel} (+$${monthlyAptcGain.toLocaleString()}/mo APTC)`
        : best.benefitLabel,
    targetSliderValue,
    deltaNeeded: actualDelta,
    monthlyAptcGain,
    isCloseProximity: actualDelta <= 5000,
  };
}

export function getRegionLabelForZip(zipCode?: string): string {
  const clean = (zipCode || '34994').replace(/\D/g, '').slice(0, 5);
  if (clean.startsWith('349')) return `Treasure Coast / Martin & St. Lucie (${clean})`;
  if (clean.startsWith('334') || clean.startsWith('331') || clean.startsWith('330')) {
    return `South Florida Coastal (${clean})`;
  }
  if (clean.startsWith('32') || clean.startsWith('33') || clean.startsWith('34')) {
    return `Florida Regional Market (${clean})`;
  }
  if (/^(07|08|10|11|12|13|14)/.test(clean)) return `Northeast Metro Corridor (${clean})`;
  if (/^(75|76|77|78)/.test(clean)) return `Texas Metro Corridor (${clean})`;
  if (/^(90|91|92|93|94|95|96)/.test(clean)) return `California Coastal Market (${clean})`;
  return clean.length === 5 ? `Local Market (ZIP ${clean})` : 'Local Regional Market';
}

export function getCorrelatedCsvForPolicy(
  faceValue: number,
  policyType: 'universal_life' | 'whole_life' | 'convertible_term' | 'iul',
  insuredAge: number
): number {
  if (policyType === 'convertible_term') return 0;
  const ageRatio = Math.min(1, Math.max(0, (insuredAge - 55) / 30));
  const csvRatio =
    policyType === 'whole_life'
      ? 0.15 + ageRatio * 0.10
      : policyType === 'iul'
      ? 0.09 + ageRatio * 0.06
      : 0.065 + ageRatio * 0.045; // universal_life
  return Math.round((faceValue * csvRatio) / 1000) * 1000;
}

export interface LifeSettlementAnalysisResult {
  faceValue: number;
  cashSurrenderVal: number;
  policyType: 'universal_life' | 'whole_life' | 'convertible_term' | 'iul';
  insuredAge: number;
  healthRating: 'standard' | 'mild_change' | 'impaired' | 'severe';
  estimatedCostBasis: number;
  surrenderChargeDollar: number;
  netCsvBeforeTax: number;
  surrenderTaxableGain: number;
  surrenderTaxDollar: number;
  netSurrenderAfterTax: number;
  forfeitedDeathBenefit: number;
  estGrossSettlement: number;
  estLowSettlement: number;
  estHighSettlement: number;
  settlementRatioPct: number;
  settlementTaxDollar: number;
  netSettlementAfterTax: number;
  netAfterTaxSurplus: number;
  surrenderMultiple: number | null;
  retainedDeathBenefit: number;
}

export function calculateLifeSettlementAnalysis(params: {
  faceValue: number;
  cashSurrenderVal: number;
  policyType: 'universal_life' | 'whole_life' | 'convertible_term' | 'iul';
  insuredAge: number;
  healthRating: 'standard' | 'mild_change' | 'impaired' | 'severe';
  taxBracket: number;
  inSurrenderChargePeriod: boolean;
}): LifeSettlementAnalysisResult {
  const {
    faceValue,
    cashSurrenderVal,
    policyType,
    insuredAge,
    healthRating,
    taxBracket,
    inSurrenderChargePeriod,
  } = params;

  const cleanCsv = policyType === 'convertible_term' ? 0 : Math.max(0, cashSurrenderVal);

  // Surrender Downsides
  const surrenderChargeRate =
    policyType === 'convertible_term' || !inSurrenderChargePeriod
      ? 0
      : policyType === 'whole_life'
      ? 0.05
      : 0.08;
  const surrenderChargeDollar = Math.round(cleanCsv * surrenderChargeRate);
  const netCsvBeforeTax = Math.max(0, cleanCsv - surrenderChargeDollar);

  // Realistic cost basis (cumulative premiums paid)
  const estimatedCostBasis =
    policyType === 'convertible_term'
      ? Math.round(faceValue * 0.03)
      : Math.round(cleanCsv * 0.68);

  const surrenderTaxableGain = Math.max(0, netCsvBeforeTax - estimatedCostBasis);
  const surrenderTaxDollar = Math.round(surrenderTaxableGain * (taxBracket / 100));
  const netSurrenderAfterTax = Math.max(0, netCsvBeforeTax - surrenderTaxDollar);
  const forfeitedDeathBenefit = Math.max(0, faceValue - netSurrenderAfterTax);

  // Institutional Settlement Valuation Model (Age x Policy Type x Health Rating)
  const ageBaseRatio = Math.max(0.08, Math.min(0.40, 0.09 + (insuredAge - 55) * 0.0085));
  const policyFactor =
    policyType === 'universal_life'
      ? 1.06
      : policyType === 'iul'
      ? 1.0
      : policyType === 'whole_life'
      ? 0.94
      : 0.86;
  const healthFactor =
    healthRating === 'standard'
      ? 0.72
      : healthRating === 'mild_change'
      ? 1.0
      : healthRating === 'impaired'
      ? 1.32
      : 1.62;

  const rawRatio = Math.max(0.07, Math.min(0.56, ageBaseRatio * policyFactor * healthFactor));
  const minimumMarketFloor =
    cleanCsv > 0 ? Math.round(cleanCsv * 1.35) : Math.round(faceValue * 0.07);
  const estGrossSettlement = Math.max(minimumMarketFloor, Math.round(faceValue * rawRatio));
  const estLowSettlement = Math.round(estGrossSettlement * 0.88);
  const estHighSettlement = Math.min(
    Math.round(faceValue * 0.65),
    Math.round(estGrossSettlement * 1.14)
  );
  const settlementRatioPct = faceValue > 0 ? Math.round((estGrossSettlement / faceValue) * 100) : 0;

  // Life Settlement Tax Treatment (Rev. Rul. 2009-13 / TCJA basis recovery):
  // 1) Up to cost basis = tax-free return of basis
  // 2) Gain up to net CSV = ordinary income tax
  // 3) Excess above CSV = long-term capital gains (15% / 20%)
  const ordinarySlice = Math.max(
    0,
    Math.min(estGrossSettlement, netCsvBeforeTax) - estimatedCostBasis
  );
  const ltcgSlice = Math.max(
    0,
    estGrossSettlement - Math.max(estimatedCostBasis, netCsvBeforeTax)
  );
  const ltcgRate = taxBracket >= 32 ? 0.20 : 0.15;
  const settlementTaxDollar = Math.round(
    ordinarySlice * (taxBracket / 100) + ltcgSlice * ltcgRate
  );
  const netSettlementAfterTax = Math.max(0, estGrossSettlement - settlementTaxDollar);

  const netAfterTaxSurplus = netSettlementAfterTax - netSurrenderAfterTax;
  const surrenderMultiple =
    netSurrenderAfterTax > 0
      ? Number((netSettlementAfterTax / netSurrenderAfterTax).toFixed(1))
      : null;

  const retainedDeathBenefit = Math.round(
    faceValue * (insuredAge >= 75 ? 0.45 : insuredAge >= 68 ? 0.38 : 0.30)
  );

  return {
    faceValue,
    cashSurrenderVal: cleanCsv,
    policyType,
    insuredAge,
    healthRating,
    estimatedCostBasis,
    surrenderChargeDollar,
    netCsvBeforeTax,
    surrenderTaxableGain,
    surrenderTaxDollar,
    netSurrenderAfterTax,
    forfeitedDeathBenefit,
    estGrossSettlement,
    estLowSettlement,
    estHighSettlement,
    settlementRatioPct,
    settlementTaxDollar,
    netSettlementAfterTax,
    netAfterTaxSurplus,
    surrenderMultiple,
    retainedDeathBenefit,
  };
}

export interface Rollover1035AnalysisResult {
  transferMode: 'qualified_rollover' | 'exchange_1035';
  capital: number;
  costBasisDollar: number;
  legacySurrenderFeeDollar: number;
  ordinaryTaxDollar: number;
  earlyPenaltyPct: number;
  earlyPenaltyDollar: number;
  totalCashOutErosion: number;
  netCashOutToday: number;
  mandatoryWithholdingAvoided: number;
  upfrontBonusDollar: number;
  protectedStartingBase: number;
  annualFeeSaved: number;
  tenYearFeeDragTotal: number;
  yearLabels: string[];
  directTransferSeries: number[];
  stayLegacySeries: number[];
  cashOutSeries: number[];
  tenYearProtectedEnd: number;
  tenYearLegacyEnd: number;
  tenYearCashOutEnd: number;
  tenYearAdvantageOverLegacy: number;
  tenYearAdvantageOverCashOut: number;
}

export function calculateRollover1035Analysis(params: {
  transferMode: 'qualified_rollover' | 'exchange_1035';
  capital: number;
  costBasisPct: number;
  currentFeeRate: number;
  legacySurrenderPct: number;
  bonusRatePct: number;
  clientAge: number;
  taxBracket: number;
  expectedGrossYield: number;
}): Rollover1035AnalysisResult {
  const {
    transferMode,
    capital,
    costBasisPct,
    currentFeeRate,
    legacySurrenderPct,
    bonusRatePct,
    clientAge,
    taxBracket,
    expectedGrossYield,
  } = params;

  const isQualified = transferMode === 'qualified_rollover';
  const costBasisDollar = isQualified ? 0 : Math.round(capital * (costBasisPct / 100));

  // Cash-out downside
  const legacySurrenderFeeDollar = isQualified
    ? 0
    : Math.round(capital * (legacySurrenderPct / 100));
  const taxableGainOrDistribution = isQualified
    ? capital
    : Math.max(0, capital - legacySurrenderFeeDollar - costBasisDollar);

  const ordinaryTaxDollar = Math.round(taxableGainOrDistribution * (taxBracket / 100));
  const earlyPenaltyPct = clientAge < 59.5 ? 10 : 0;
  const earlyPenaltyDollar = Math.round(taxableGainOrDistribution * (earlyPenaltyPct / 100));
  const totalCashOutErosion =
    legacySurrenderFeeDollar + ordinaryTaxDollar + earlyPenaltyDollar;
  const netCashOutToday = Math.max(0, capital - totalCashOutErosion);

  // Direct Rollover / 1035 Upside
  const mandatoryWithholdingAvoided = isQualified ? Math.round(capital * 0.20) : 0;
  const upfrontBonusDollar = Math.round(capital * (bonusRatePct / 100));
  const protectedStartingBase = Math.max(0, capital - legacySurrenderFeeDollar) + upfrontBonusDollar;

  // 10-year projections
  const grossRate = expectedGrossYield / 100;
  const legacyNetRate = Math.max(0.005, (expectedGrossYield - currentFeeRate) / 100);
  // Institutional FIA/MYGA/Direct Custodian friction (~0.35% vs legacy)
  const targetPlatformFee = 0.35;
  const directNetRate = Math.max(0.01, (expectedGrossYield - targetPlatformFee) / 100);
  // After-tax brokerage reinvestment suffers annual tax drag
  const cashOutNetRate = Math.max(
    0.005,
    (expectedGrossYield - 0.65) * (1 - (taxBracket / 100) * 0.7) / 100
  );

  const yearLabels: string[] = [];
  const directTransferSeries: number[] = [];
  const stayLegacySeries: number[] = [];
  const cashOutSeries: number[] = [];

  let grossNoFeeEnd = capital;
  for (let yr = 0; yr <= 10; yr++) {
    yearLabels.push(`Yr ${yr}`);
    directTransferSeries.push(Math.round(protectedStartingBase * Math.pow(1 + directNetRate, yr)));
    stayLegacySeries.push(Math.round(capital * Math.pow(1 + legacyNetRate, yr)));
    cashOutSeries.push(Math.round(netCashOutToday * Math.pow(1 + cashOutNetRate, yr)));
    if (yr === 10) {
      grossNoFeeEnd = Math.round(capital * Math.pow(1 + grossRate, 10));
    }
  }

  const tenYearProtectedEnd = directTransferSeries[10];
  const tenYearLegacyEnd = stayLegacySeries[10];
  const tenYearCashOutEnd = cashOutSeries[10];
  const annualFeeSaved = Math.round(capital * Math.max(0, (currentFeeRate - targetPlatformFee) / 100));
  const tenYearFeeDragTotal = Math.max(0, grossNoFeeEnd - tenYearLegacyEnd);

  return {
    transferMode,
    capital,
    costBasisDollar,
    legacySurrenderFeeDollar,
    ordinaryTaxDollar,
    earlyPenaltyPct,
    earlyPenaltyDollar,
    totalCashOutErosion,
    netCashOutToday,
    mandatoryWithholdingAvoided,
    upfrontBonusDollar,
    protectedStartingBase,
    annualFeeSaved,
    tenYearFeeDragTotal,
    yearLabels,
    directTransferSeries,
    stayLegacySeries,
    cashOutSeries,
    tenYearProtectedEnd,
    tenYearLegacyEnd,
    tenYearCashOutEnd,
    tenYearAdvantageOverLegacy: tenYearProtectedEnd - tenYearLegacyEnd,
    tenYearAdvantageOverCashOut: tenYearProtectedEnd - tenYearCashOutEnd,
  };
}

