import { AcaWindowOption, FilingStatus } from '../types';
import { TAX_YEAR_PARAMS_2027 } from './constants';

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

export function get100PercentFPL(householdSize: number): number {
  return TAX_YEAR_PARAMS_2027.baseFPL + (householdSize - 1) * TAX_YEAR_PARAMS_2027.perAddFPL;
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

// Calculate ACA Benchmark Silver Premium and Subsidy based on FPL percentage
export function calculateAcaDetails(agi: number, householdSize: number, clientAge: number) {
  const fpl100 = get100PercentFPL(householdSize);
  const fplPct = Math.round((agi / fpl100) * 100);

  // Age based base benchmark silver cost for Martin County / Stuart, FL
  const ageFactor = 1 + Math.max(0, clientAge - 21) * 0.035;
  const benchmarkCostAnnual = 6800 * ageFactor;
  const benchmarkCostMonthly = benchmarkCostAnnual / 12;

  // Expected contribution percentage based on ACA sliding scale
  let expectedContribPct = 0.085;
  if (fplPct <= 150) expectedContribPct = 0.0;
  else if (fplPct <= 200) expectedContribPct = 0.02;
  else if (fplPct <= 250) expectedContribPct = 0.04;
  else if (fplPct <= 300) expectedContribPct = 0.06;
  else if (fplPct <= 400) expectedContribPct = 0.085;
  else expectedContribPct = 0.085;

  const maxExpectedAnnual = agi * expectedContribPct;
  const maxExpectedMonthly = maxExpectedAnnual / 12;

  const monthlySubsidy = Math.max(0, benchmarkCostMonthly - maxExpectedMonthly);
  const netBenchmarkMonthly = Math.max(0, benchmarkCostMonthly - monthlySubsidy);

  // CSR tier and plan metrics
  let csrLevel = 'Standard Silver (70% AV)';
  let deductible = 5800;
  let oopMax = 9100;
  let primaryCopay = 35;
  let av = '70% Silver';

  if (fplPct <= 150) {
    csrLevel = 'Silver CSR 94% (Max Assistance)';
    deductible = 0;
    oopMax = 1500;
    primaryCopay = 0;
    av = '94% Silver';
  } else if (fplPct <= 200) {
    csrLevel = 'Silver CSR 87% (High Assistance)';
    deductible = 800;
    oopMax = 3000;
    primaryCopay = 10;
    av = '87% Silver';
  } else if (fplPct <= 250) {
    csrLevel = 'Enhanced Silver CSR 73%';
    deductible = 2500;
    oopMax = 5800;
    primaryCopay = 20;
    av = '73% Silver';
  }

  return {
    fpl100,
    fplPct,
    benchmarkCostMonthly: Math.round(benchmarkCostMonthly),
    monthlySubsidy: Math.round(monthlySubsidy),
    netMonthlyPremium: Math.round(netBenchmarkMonthly),
    csrLevel,
    deductible,
    oopMax,
    primaryCopay,
    av,
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
  const povertyFloor = get100PercentFPL(householdSize) + 100;
  const optimizedAgi =
    grossAGI <= povertyFloor
      ? Math.max(0, grossAGI - totalPreTaxDeduction)
      : Math.max(povertyFloor, grossAGI - totalPreTaxDeduction);

  // 6. ACA Benchmark & Subsidy Math: Baseline vs Optimized
  const baselineAca = calculateAcaDetails(grossAGI, householdSize, clientAge);
  const optimizedAca = calculateAcaDetails(optimizedAgi, householdSize, clientAge);

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
    monthlySubsidyGain,
    annualSubsidyGain,
    annualTaxSavings,
    totalAnnualBenefit,
    marginalTaxRate,
    isSpousalLoopholeActive,
  };
}
