import {
  AcaMetalTier,
  AcaWindowOption,
  FilingStatus,
  HealthCarrierId,
  PrivateHealthCarrierId,
  PrivatePpoTierId,
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
  isSpouseCoveredByWorkplacePlan: boolean = false
): IRADeductionResult {
  const statCap = getIRSLimitForAge(age);
  const isMarried = filingStatus === 'married';

  // Case 1: Taxpayer is covered by workplace plan
  if (isCoveredByWorkplacePlan) {
    const startRange = isMarried ? 130000 : 81000;
    const endRange = isMarried ? 150000 : 91000;
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
    const startRange = 240000;
    const endRange = 250000;
    const rangeSpan = endRange - startRange;

    if (magiAfter401k < startRange) {
      return {
        maxDeductible: statCap,
        phaseOutStatus: 'full',
        phaseOutPct: 100,
        notice: `Full $${statCap.toLocaleString()} Spousal IRA deduction qualified under IRC § 219(g)(7) (Non-covered spouse threshold MAGI < $240,000).`,
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
        notice: `Partial phase-out for non-covered spouse ($240k - $250k MAGI range). Capped at $${partialCap.toLocaleString()} deductible under IRC § 219(g)(7).`,
      };
    } else {
      return {
        maxDeductible: 0,
        phaseOutStatus: 'none',
        phaseOutPct: 0,
        notice: `Joint MAGI ($${Math.round(magiAfter401k).toLocaleString()}) exceeds the $250,000 threshold for non-covered spouses under IRC § 219(g)(7). Contributions are after-tax ($0 MAGI reduction).`,
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

export interface SelfEmployedStrategyResult {
  solo401kMaxTotal: number;
  solo401kEmployeeMax: number;
  solo401kEmployerMax: number;
  sepIraMax: number;
  traditionalIraStatLimit: number;
  spousalIraStatLimit: number;
  clientIraDeductible: number;
  clientIraPhaseOutStatus: 'full' | 'partial' | 'none';
  clientIraPhaseOutNotice: string;
  spouseIraDeductible: number;
  spouseIraPhaseOutStatus: 'full' | 'partial' | 'none';
  spouseIraPhaseOutNotice: string;
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
  customSoloEmployee?: number;
  customSoloEmployer?: number;
  customSepContribution?: number;
  stackClientTradIra?: boolean;
  stackSpousalIra?: boolean;
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
    stackClientTradIra = true,
    stackSpousalIra = true,
    spouseAge = 52,
    spouseCoveredByPlan = false,
    taxYear = '2027',
    carrierId = 'oscar',
  } = params;

  const isMarried = filingStatus === 'married';
  const is50Plus = clientAge >= 50;
  const isSpouse50Plus = spouseAge >= 50;

  // 1. Statutory Caps (2026/2027)
  const soloEmployeeCap = 23500 + (is50Plus ? 7500 : 0);
  // Net self-employed profit cap for employer share: approx 20% of net Schedule C profit (adjusted for SE tax)
  const soloEmployerMax = Math.min(Math.max(0, netBusinessProfit * 0.20), 48500);
  const solo401kCombinedCap = 72000 + (is50Plus ? 7500 : 0);
  const solo401kMaxTotal = Math.min(soloEmployeeCap + soloEmployerMax, solo401kCombinedCap);

  // SEP-IRA Max (25% of W2 or ~20% of net SE profit, capped at $72,000)
  const sepIraMax = Math.min(Math.max(0, netBusinessProfit * 0.20), 72000);

  // Traditional IRA statutory limit
  const clientIraCap = getIRSLimitForAge(clientAge, filingStatus);
  const spouseIraCap = getIRSLimitForAge(spouseAge, filingStatus);

  // 2. Determine Primary Vehicle Contribution
  let primaryPlanContribution = 0;
  if (selectedVehicle === 'solo401k' || selectedVehicle === 'stacked_solo') {
    const employeeVal = params.customSoloEmployee !== undefined ? params.customSoloEmployee : soloEmployeeCap;
    const employerVal = params.customSoloEmployer !== undefined ? params.customSoloEmployer : soloEmployerMax;
    primaryPlanContribution = Math.min(employeeVal + employerVal, solo401kMaxTotal);
  } else {
    // SEP-IRA
    const sepVal = params.customSepContribution !== undefined ? params.customSepContribution : sepIraMax;
    primaryPlanContribution = Math.min(sepVal, sepIraMax);
  }

  // Intermediary MAGI after primary retirement plan deduction
  // Contributing to Solo 401k or SEP-IRA automatically flags client as ACTIVE PARTICIPANT
  const magiAfterPrimaryPlan = Math.max(0, grossAGI - primaryPlanContribution);

  // 3. Active Participant Phase-Out for Client Traditional IRA
  // Solo 401(k) and SEP-IRA both trigger active participant status
  let clientIraDeductible = 0;
  let clientIraPhaseOutStatus: 'full' | 'partial' | 'none' = 'none';
  let clientIraPhaseOutNotice = '';

  if (stackClientTradIra) {
    const startRange = isMarried ? 129000 : 79000;
    const endRange = isMarried ? 149000 : 89000;
    const rangeSpan = endRange - startRange;

    if (magiAfterPrimaryPlan < startRange) {
      clientIraDeductible = clientIraCap;
      clientIraPhaseOutStatus = 'full';
      clientIraPhaseOutNotice = `Full $${clientIraCap.toLocaleString()} deduction qualified (MAGI $${Math.round(magiAfterPrimaryPlan).toLocaleString()} < $${startRange.toLocaleString()}). Drops AGI dollar-for-dollar.`;
    } else if (magiAfterPrimaryPlan < endRange) {
      const remainingSpan = endRange - magiAfterPrimaryPlan;
      const ratio = remainingSpan / rangeSpan;
      clientIraDeductible = Math.max(200, Math.round((clientIraCap * ratio) / 10) * 10);
      clientIraPhaseOutStatus = 'partial';
      clientIraPhaseOutNotice = `Partial phase-out ($${startRange.toLocaleString()} - $${endRange.toLocaleString()} MAGI range). Deductible capped at $${clientIraDeductible.toLocaleString()} under IRC § 219(g).`;
    } else {
      clientIraDeductible = 0;
      clientIraPhaseOutStatus = 'none';
      clientIraPhaseOutNotice = `Active Participant Trap: MAGI ($${Math.round(magiAfterPrimaryPlan).toLocaleString()}) exceeds the $${endRange.toLocaleString()} limit. Any IRA contribution is non-deductible after-tax and provides $0 ACA AGI reduction.`;
    }
  }

  // 4. Spousal IRA Loophole (IRC § 219(g)(7))
  let spouseIraDeductible = 0;
  let spouseIraPhaseOutStatus: 'full' | 'partial' | 'none' = 'none';
  let spouseIraPhaseOutNotice = '';
  let isSpousalLoopholeActive = false;

  if (isMarried && stackSpousalIra) {
    const magiBeforeSpouse = Math.max(0, magiAfterPrimaryPlan - clientIraDeductible);
    if (!spouseCoveredByPlan) {
      // Uncovered spouse faces high phase-out: $242,000 to $252,000
      const spousalStart = 242000;
      const spousalEnd = 252000;
      const spousalSpan = spousalEnd - spousalStart;

      if (magiBeforeSpouse < spousalStart) {
        spouseIraDeductible = spouseIraCap;
        spouseIraPhaseOutStatus = 'full';
        spouseIraPhaseOutNotice = `Spousal IRA Loophole Active: Uncovered spouse qualifies for full $${spouseIraCap.toLocaleString()} deduction up to $${spousalStart.toLocaleString()} MAGI under IRC § 219(g)(7).`;
        if (clientIraDeductible < clientIraCap) {
          isSpousalLoopholeActive = true;
        }
      } else if (magiBeforeSpouse < spousalEnd) {
        const ratio = (spousalEnd - magiBeforeSpouse) / spousalSpan;
        spouseIraDeductible = Math.max(200, Math.round((spouseIraCap * ratio) / 10) * 10);
        spouseIraPhaseOutStatus = 'partial';
        spouseIraPhaseOutNotice = `Partial Spousal IRA phase-out ($242k - $252k MAGI). Capped at $${spouseIraDeductible.toLocaleString()} deductible under IRC § 219(g)(7).`;
        isSpousalLoopholeActive = true;
      } else {
        spouseIraDeductible = 0;
        spouseIraPhaseOutStatus = 'none';
        spouseIraPhaseOutNotice = `Joint MAGI ($${Math.round(magiBeforeSpouse).toLocaleString()}) exceeds the $252,000 limit for non-covered spouses under IRC § 219(g)(7).`;
      }
    } else {
      // Spouse is also covered by their own workplace plan -> standard MFJ phaseout $129k - $149k
      const startRange = 129000;
      const endRange = 149000;
      if (magiBeforeSpouse < startRange) {
        spouseIraDeductible = spouseIraCap;
        spouseIraPhaseOutStatus = 'full';
        spouseIraPhaseOutNotice = `Spouse covered by plan: full $${spouseIraCap.toLocaleString()} deduction qualified (MAGI < $129,000).`;
      } else if (magiBeforeSpouse < endRange) {
        const ratio = (endRange - magiBeforeSpouse) / (endRange - startRange);
        spouseIraDeductible = Math.max(200, Math.round((spouseIraCap * ratio) / 10) * 10);
        spouseIraPhaseOutStatus = 'partial';
        spouseIraPhaseOutNotice = `Spouse covered by plan: partial phase-out ($129k - $149k range). Capped at $${spouseIraDeductible.toLocaleString()}.`;
      } else {
        spouseIraDeductible = 0;
        spouseIraPhaseOutStatus = 'none';
        spouseIraPhaseOutNotice = `Spouse covered by workplace plan: phased out above $149,000 joint MAGI.`;
      }
    }
  }

  // 5. Total Combined Pre-Tax Deduction & Final Optimized AGI
  const totalPreTaxDeduction = primaryPlanContribution + clientIraDeductible + spouseIraDeductible;
  const povertyFloor = get100PercentFPL(householdSize, taxYear) + 100;
  const optimizedAgi =
    grossAGI <= povertyFloor
      ? Math.max(0, grossAGI - totalPreTaxDeduction)
      : Math.max(povertyFloor, grossAGI - totalPreTaxDeduction);

  // 6. ACA Benchmark & Subsidy Math: Baseline vs Optimized (synced with taxYear & carrierId)
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

  // 7. Federal Tax Savings
  const marginalTaxRate = getMarginalTaxRate(grossAGI, filingStatus);
  const annualTaxSavings = Math.round(totalPreTaxDeduction * marginalTaxRate);
  const totalAnnualBenefit = annualSubsidyGain + annualTaxSavings;

  return {
    solo401kMaxTotal,
    solo401kEmployeeMax: soloEmployeeCap,
    solo401kEmployerMax: soloEmployerMax,
    sepIraMax,
    traditionalIraStatLimit: clientIraCap,
    spousalIraStatLimit: spouseIraCap,
    clientIraDeductible,
    clientIraPhaseOutStatus,
    clientIraPhaseOutNotice,
    spouseIraDeductible,
    spouseIraPhaseOutStatus,
    spouseIraPhaseOutNotice,
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

