import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAcaDetails,
  calculateRollover1035Analysis,
  calculateSelfEmployedAcaStrategy,
  computeAtlasBridgeIraMilestones,
  computeAtlasBridgeMaxPreset,
  computeSelfEmployedSliderMilestones,
  get100PercentFPL,
  getIRSLimitForAge,
  getTraditionalIRADeductionLimit,
} from './calculations';

test('IRS Traditional IRA contribution caps enforce $7,500 under 50 and $8,600 age 50+', () => {
  assert.equal(getIRSLimitForAge(42), 7500);
  assert.equal(getIRSLimitForAge(49), 7500);
  assert.equal(getIRSLimitForAge(50), 8600);
  assert.equal(getIRSLimitForAge(62), 8600);
});

test('Traditional IRA IRC § 219(g) deductibility follows 2026 vs 2027 phaseouts', () => {
  // Single covered active participant: 2026 phaseout starts $81k, ends $91k; 2027 starts $83k, ends $93k
  const below2027 = getTraditionalIRADeductionLimit(82000, 52, true, 'single', false, '2027');
  assert.equal(below2027.phaseOutStatus, 'full');
  assert.equal(below2027.maxDeductible, 8600);

  const partial2026 = getTraditionalIRADeductionLimit(82000, 52, true, 'single', false, '2026');
  assert.equal(partial2026.phaseOutStatus, 'partial');
  assert.ok(partial2026.maxDeductible > 0 && partial2026.maxDeductible < 8600);

  const phasedOut2027 = getTraditionalIRADeductionLimit(95000, 52, true, 'single', false, '2027');
  assert.equal(phasedOut2027.phaseOutStatus, 'none');
  assert.equal(phasedOut2027.maxDeductible, 0);

  // Married uncovered spouse rule (IRC § 219(g)(7)): 2027 phaseout $250k-$260k
  const uncoveredSpouse = getTraditionalIRADeductionLimit(180000, 52, false, 'married', true, '2027');
  assert.equal(uncoveredSpouse.phaseOutStatus, 'full');
  assert.equal(uncoveredSpouse.maxDeductible, 8600);
});

test('ACA details apply CSR tiers and 100%-400% FPL APTC boundaries accurately', () => {
  const fpl100Single = get100PercentFPL(1, '2027');
  const under100 = calculateAcaDetails(fpl100Single - 1000, 1, 50, '2027');
  assert.equal(under100.isBelow100Fpl, true);
  assert.equal(under100.monthlySubsidy, 0);

  const at150 = calculateAcaDetails(Math.floor(fpl100Single * 1.5), 1, 50, '2027');
  assert.equal(at150.deductible, 0);
  assert.match(at150.csrLevel, /94%/);

  const at200 = calculateAcaDetails(Math.floor(fpl100Single * 2.0), 1, 50, '2027');
  assert.equal(at200.deductible, 800);
  assert.match(at200.csrLevel, /87%/);

  const over400 = calculateAcaDetails(fpl100Single * 4 + 500, 1, 50, '2027');
  assert.equal(over400.isAbove400Cliff, true);
  assert.equal(over400.monthlySubsidy, 0);
});

test('Self-Employed strategy starting at $0 yields $0 deduction and exact baseline ACA MAGI', () => {
  const result = calculateSelfEmployedAcaStrategy({
    grossAGI: 52000,
    netBusinessProfit: 52000,
    clientAge: 52,
    filingStatus: 'single',
    householdSize: 1,
    selectedVehicle: 'stacked_solo',
    entityBasis: 'schedule_c',
    customSoloEmployee: 0,
    customSoloEmployer: 0,
    stackClientTradIra: true,
    customClientIraAmount: 0,
    taxYear: '2027',
    carrierId: 'oscar',
  });

  assert.equal(result.totalPreTaxDeduction, 0);
  assert.equal(result.optimizedAgi, 52000);
  assert.equal(result.monthlySubsidyGain, 0);
  assert.equal(result.acaSafeFloor138, Math.ceil(get100PercentFPL(1, '2027') * 1.38));
});

test('Self-Employed 138% FPL floor & exact milestone ladder include moderate jumps and IRA unlock', () => {
  const fpl100 = get100PercentFPL(1, '2027');
  const safeFloor138 = Math.ceil(fpl100 * 1.38);

  // Even with oversized deductions, MAGI never drops below 138% FPL floor
  const clamped = calculateSelfEmployedAcaStrategy({
    grossAGI: 40000,
    netBusinessProfit: 40000,
    clientAge: 54,
    filingStatus: 'single',
    householdSize: 1,
    selectedVehicle: 'stacked_solo',
    entityBasis: 'schedule_c',
    customSoloEmployee: 24500,
    customSoloEmployer: 7000,
    stackClientTradIra: true,
    customClientIraAmount: 8600,
    taxYear: '2027',
    carrierId: 'oscar',
  });
  assert.ok(clamped.optimizedAgi >= safeFloor138);
  assert.equal(clamped.isAtAcaSafeFloor, true);

  // At $90k baseline with $0 current contributions, dropping Solo Employee by moderate amount unlocks 250%/200%/150% etc.
  const ladder = computeSelfEmployedSliderMilestones({
    sliderField: 'soloEmployee',
    currentSliderValue: 0,
    sliderSafeCap: 32500,
    strategyParams: {
      grossAGI: 46000,
      netBusinessProfit: 46000,
      clientAge: 54,
      filingStatus: 'single',
      householdSize: 1,
      selectedVehicle: 'stacked_solo',
      entityBasis: 'schedule_c',
      customSoloEmployee: 0,
      customSoloEmployer: 0,
      stackClientTradIra: true,
      customClientIraAmount: 0,
      taxYear: '2027',
      carrierId: 'oscar',
    },
  });

  assert.ok(ladder.milestones.length >= 2);
  assert.ok(ladder.nextJump !== null);
  // First step from $0 should be moderate and strictly positive
  assert.ok(ladder.nextJump!.targetSliderValue > 0 && ladder.nextJump!.targetSliderValue < 25000);
});

test('S-Corp entity basis bases 25% employer cap strictly on W-2 officer wages rather than total profit', () => {
  const scorpRes = calculateSelfEmployedAcaStrategy({
    grossAGI: 100000,
    netBusinessProfit: 100000,
    clientAge: 45,
    filingStatus: 'single',
    householdSize: 1,
    selectedVehicle: 'stacked_solo',
    entityBasis: 'scorp',
    scorpW2Wages: 50000,
    customSoloEmployee: 0,
    customSoloEmployer: 12500,
    taxYear: '2027',
    carrierId: 'oscar',
  });

  assert.equal(scorpRes.limits.w2Compensation, 50000);
  assert.equal(scorpRes.limits.k1Distribution, 50000);
  assert.equal(scorpRes.limits.soloEmployerMax, 12500);
});

test('AtlasBridge preset and milestone ladder enforce 138% FPL Medicaid-safe floor', () => {
  const fpl100 = get100PercentFPL(1, '2027');
  const safeFloor138 = Math.ceil(fpl100 * 1.38);

  const preset = computeAtlasBridgeMaxPreset({
    grossAGI: safeFloor138 + 3000,
    clientAge: 52,
    spouseAge: 52,
    filingStatus: 'single',
    householdSize: 1,
    isClientCovered: false,
    isSpouseCovered: false,
    taxYear: '2027',
  });
  assert.equal(preset.clientIra, 3000);

  const ladder = computeAtlasBridgeIraMilestones({
    sliderRole: 'client',
    grossAGI: Math.round(fpl100 * 1.6),
    clientAge: 52,
    spouseAge: 52,
    filingStatus: 'single',
    householdSize: 1,
    currentClientIra: 0,
    currentSpouseIra: 0,
    effectiveMaxClientIRA: 8600,
    effectiveMaxSpouseIRA: 0,
    clientMaxDeductible: 8600,
    spouseMaxDeductible: 0,
    taxYear: '2027',
  });
  assert.ok(ladder.nextJump !== null);
  assert.ok(ladder.milestones.some((m) => m.id === 'csr_150'));
});

test('Rollover 1035 analysis preserves Day-1 principal + bonus and eliminates cash-out erosion', () => {
  const res = calculateRollover1035Analysis({
    transferMode: 'qualified_rollover',
    capital: 120000,
    costBasisPct: 0,
    currentFeeRate: 1.95,
    legacySurrenderPct: 0,
    bonusRatePct: 8,
    clientAge: 54,
    taxBracket: 22,
    expectedGrossYield: 6.2,
  });

  assert.equal(res.upfrontBonusDollar, 9600);
  assert.equal(res.protectedStartingBase, 129600);
  assert.ok(res.totalCashOutErosion > 30000);
  assert.ok(res.tenYearAdvantageOverLegacy > 0);
});

test('Employer Profit Share and Trad-IRA produce tiered multi-step ladders inside wide FPL bands', () => {
  // AGI $62,000 single (between 400% Cliff $63,840 and 300% FPL $47,880) — previously only showed MAX
  const employerPlan = computeSelfEmployedSliderMilestones({
    sliderField: 'soloEmployer',
    currentSliderValue: 0,
    sliderSafeCap: 10200,
    strategyParams: {
      grossAGI: 62000,
      netBusinessProfit: 55000,
      clientAge: 54,
      filingStatus: 'single',
      householdSize: 1,
      selectedVehicle: 'stacked_solo',
      entityBasis: 'schedule_c',
      customSoloEmployee: 0,
      customSoloEmployer: 0,
      stackClientTradIra: false,
      customClientIraAmount: 0,
      taxYear: '2027',
      carrierId: 'oscar',
    },
  });

  assert.ok(
    employerPlan.milestones.length >= 3,
    `Expected >= 3 tiered Employer Profit Share milestones, got ${employerPlan.milestones.length}`
  );
  assert.ok(employerPlan.nextJump !== null);
  assert.ok(employerPlan.nextJump!.targetSliderValue < 10200);
  assert.ok(employerPlan.nextJump!.monthlyPremiumDropFromCurrent >= 8);

  // Client Trad-IRA inside the same band ($62,000 -> max $8,600) must also be multi-tiered, not MAX-only
  const seIraPlan = computeSelfEmployedSliderMilestones({
    sliderField: 'clientIra',
    currentSliderValue: 0,
    sliderSafeCap: 8600,
    strategyParams: {
      grossAGI: 62000,
      netBusinessProfit: 55000,
      clientAge: 54,
      filingStatus: 'single',
      householdSize: 1,
      selectedVehicle: 'stacked_solo',
      entityBasis: 'schedule_c',
      customSoloEmployee: 0,
      customSoloEmployer: 0,
      stackClientTradIra: true,
      customClientIraAmount: 0,
      taxYear: '2027',
      carrierId: 'oscar',
    },
  });
  assert.ok(
    seIraPlan.milestones.length >= 3,
    `Expected >= 3 tiered Trad-IRA milestones, got ${seIraPlan.milestones.length}`
  );
  assert.ok(seIraPlan.nextJump !== null && seIraPlan.nextJump.targetSliderValue < 8600);

  // AtlasBridge Trad-IRA inside a single FPL bracket must also be tiered and include direct Silver premium drop
  const atlasIraPlan = computeAtlasBridgeIraMilestones({
    sliderRole: 'client',
    grossAGI: 62000,
    clientAge: 54,
    spouseAge: 54,
    filingStatus: 'single',
    householdSize: 1,
    currentClientIra: 0,
    currentSpouseIra: 0,
    effectiveMaxClientIRA: 8600,
    effectiveMaxSpouseIRA: 0,
    clientMaxDeductible: 8600,
    spouseMaxDeductible: 0,
    taxYear: '2027',
    carrierId: 'oscar',
  });
  assert.ok(
    atlasIraPlan.milestones.length >= 3,
    `Expected >= 3 AtlasBridge tiered Trad-IRA milestones, got ${atlasIraPlan.milestones.length}`
  );
  assert.ok(atlasIraPlan.nextJump !== null && atlasIraPlan.nextJump.targetSliderValue < 8600);
  assert.ok(atlasIraPlan.nextJump!.resultingSilverMonthlyPremium > 0);
  assert.ok(atlasIraPlan.nextJump!.monthlyPremiumDropFromZero >= 8);
});

test('Employee Deferral never emits a $100 first recommendation that yields zero ACA premium/CSR benefit', () => {
  // Case 1: $100 above 138% floor yields zero Silver CSR change and <$10/mo change -> must NOT emit $100 jump
  const fpl100 = get100PercentFPL(1, '2027');
  const nearFloorAgi = Math.ceil(fpl100 * 1.38) + 100;

  const nearFloorPlan = computeSelfEmployedSliderMilestones({
    sliderField: 'soloEmployee',
    currentSliderValue: 0,
    sliderSafeCap: 100,
    strategyParams: {
      grossAGI: nearFloorAgi,
      netBusinessProfit: 35000,
      clientAge: 54,
      filingStatus: 'single',
      householdSize: 1,
      selectedVehicle: 'stacked_solo',
      entityBasis: 'schedule_c',
      customSoloEmployee: 0,
      customSoloEmployer: 0,
      stackClientTradIra: false,
      customClientIraAmount: 0,
      taxYear: '2027',
      carrierId: 'oscar',
    },
  });
  assert.equal(nearFloorPlan.nextJump, null);
  assert.equal(nearFloorPlan.milestones.length, 0);

  // Case 2: Family of 2 at $24,000 (below 150% FPL where Silver net premium on Ambetter is already $0/mo)
  // $100-$2,000 slider movement changes Silver deductible by $0 and Silver premium by $0 -> no empty recommendations
  const alreadyZeroSilverPlan = computeSelfEmployedSliderMilestones({
    sliderField: 'soloEmployee',
    currentSliderValue: 0,
    sliderSafeCap: 2000,
    strategyParams: {
      grossAGI: 24000,
      netBusinessProfit: 24000,
      clientAge: 54,
      filingStatus: 'married',
      householdSize: 2,
      selectedVehicle: 'stacked_solo',
      entityBasis: 'schedule_c',
      customSoloEmployee: 0,
      customSoloEmployer: 0,
      stackClientTradIra: false,
      customClientIraAmount: 0,
      taxYear: '2027',
      carrierId: 'ambetter',
    },
  });
  assert.equal(alreadyZeroSilverPlan.nextJump, null);
  assert.equal(alreadyZeroSilverPlan.milestones.length, 0);

  // Case 3: Every emitted milestone must deliver a real Silver premium drop or CSR deductible cut
  const realSavingsPlan = computeSelfEmployedSliderMilestones({
    sliderField: 'soloEmployee',
    currentSliderValue: 0,
    sliderSafeCap: 24500,
    strategyParams: {
      grossAGI: 65000,
      netBusinessProfit: 55000,
      clientAge: 54,
      filingStatus: 'single',
      householdSize: 1,
      selectedVehicle: 'stacked_solo',
      entityBasis: 'schedule_c',
      customSoloEmployee: 0,
      customSoloEmployer: 0,
      stackClientTradIra: false,
      customClientIraAmount: 0,
      taxYear: '2027',
      carrierId: 'oscar',
    },
  });
  assert.ok(realSavingsPlan.nextJump !== null);
  assert.ok(realSavingsPlan.nextJump!.targetSliderValue >= 1200);
  assert.ok(realSavingsPlan.nextJump!.monthlyPremiumDropFromCurrent >= 100);
  for (const m of realSavingsPlan.milestones) {
    assert.ok(
      m.monthlyPremiumDropFromZero > 0 || m.resultingDeductible < 5800,
      `Milestone ${m.thresholdLabel} must materially improve ACA premium or deductible`
    );
  }
});
