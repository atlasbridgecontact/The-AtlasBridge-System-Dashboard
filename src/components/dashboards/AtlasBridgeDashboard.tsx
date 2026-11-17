import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { AcaMetalTier, ActiveStrategySnapshot, ClientData, HealthCarrierId } from '../../types';
import {
  getIRSLimitForAge,
  getHouseholdSize,
  getMarginalTaxRate,
  calculateAcaTierProjection,
  getTraditionalIRADeductionLimit,
  computeAtlasBridgeIraMilestones,
  computeAtlasBridgeMaxPreset,
  SliderMilestonePlan,
} from '../../utils/calculations';
import { REGIONAL_HEALTH_CARRIERS } from '../../utils/constants';
import { SoundFX } from '../../utils/audio';
import { ProviderNetworkMap } from './ProviderNetworkMap';

Chart.register(...registerables);

interface AtlasBridgeDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
  onUpdateStrategySnapshot?: (snapshot: ActiveStrategySnapshot) => void;
}

export const AtlasBridgeDashboard: React.FC<AtlasBridgeDashboardProps> = ({
  clientData,
  onChangeClientData,
  onUpdateStrategySnapshot,
}) => {
  const isMarried = clientData.filingStatus === 'married';
  const has401k = clientData.active401k;
  const iraCap = getIRSLimitForAge(clientData.clientAge); // $7,500 (<50) or $8,600 (50+)
  const spouseAge = clientData.spouseAge || clientData.clientAge;
  const spouseIraCap = getIRSLimitForAge(spouseAge);

  const hasClient401k = (!isMarried && (has401k === true || has401k === 'client_only' || has401k === 'both')) || (isMarried && (has401k === 'client_only' || has401k === 'both'));
  const hasSpouse401k = isMarried && (has401k === 'spouse_only' || has401k === 'both');

  const initialIRA = clientData.existingAnnuityCash > 0
    ? clientData.existingAnnuityCash
    : 0;

  const initialSpouseIRA = (clientData.spouseExistingAnnuityCash && clientData.spouseExistingAnnuityCash > 0)
    ? clientData.spouseExistingAnnuityCash
    : 0;

  const [iraContrib, setIraContrib] = useState<number>(Math.min(initialIRA, iraCap));
  const [spouseIraContrib, setSpouseIraContrib] = useState<number>(Math.min(initialSpouseIRA, spouseIraCap));
  const [selectedTier, setSelectedTier] = useState<AcaMetalTier>('silver');
  const [isScenariosOpen, setIsScenariosOpen] = useState<boolean>(false);
  const [isProviderMapOpen, setIsProviderMapOpen] = useState<boolean>(false);
  const [walkInDate, setWalkInDate] = useState<string>('2026-11-05');

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const lastSnapshotJsonRef = useRef<string>('');

  // Household & ACA Benchmark Details for Poverty Floor (canonical year-aware & carrier-aware projection)
  const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);
  const origProjection = calculateAcaTierProjection({
    agi: clientData.grossAGI,
    householdSize,
    clientAge: clientData.clientAge,
    carrierId: clientData.selectedHealthCarrier,
    scenario: 'moderate',
    taxYear: clientData.taxYear,
  });
  const origAca = origProjection.baseAca;
  const origSilverTier = origProjection.tiers.silver;

  // 138% FPL Medicaid-safe floor for pre-tax deductions
  const safeFloor138 = Math.ceil(origAca.fpl100 * 1.38);
  const maxSafeTotalPreTax = Math.max(0, clientData.grossAGI - safeFloor138);

  // Trad-IRA & Qualified Annuity Pre-Tax Diversion (Clamped to 138% FPL safe floor)
  const effectiveMaxClientIRA = Math.max(0, Math.min(iraCap, maxSafeTotalPreTax));
  const actualClientIRA = Math.min(iraContrib, effectiveMaxClientIRA);

  const remainingAfterClientIRA = Math.max(0, maxSafeTotalPreTax - actualClientIRA);
  const effectiveMaxSpouseIRA = isMarried ? Math.max(0, Math.min(spouseIraCap, remainingAfterClientIRA)) : 0;
  const actualSpouseIRA = isMarried ? Math.min(spouseIraContrib, effectiveMaxSpouseIRA) : 0;

  // Trad-IRA deductibility under IRC § 219(g)
  // Active participant coverage determined from questionnaire answers
  const isClientCovered = hasClient401k;
  const isSpouseCovered = hasSpouse401k;

  // Primary Client IRA (tax-year aware)
  const clientIraDeductionInfo = getTraditionalIRADeductionLimit(
    clientData.grossAGI,
    clientData.clientAge,
    isClientCovered,
    clientData.filingStatus,
    isSpouseCovered,
    clientData.taxYear
  );
  const deductibleClientIRA = Math.min(actualClientIRA, clientIraDeductionInfo.maxDeductible);
  const afterTaxClientIRA = Math.max(0, actualClientIRA - deductibleClientIRA);

  // Spouse IRA (under IRC § 219(c), tax-year aware)
  const spouseIraDeductionInfo = isMarried
    ? getTraditionalIRADeductionLimit(
        clientData.grossAGI,
        spouseAge,
        isSpouseCovered,
        clientData.filingStatus,
        isClientCovered,
        clientData.taxYear
      )
    : null;
  const deductibleSpouseIRA = spouseIraDeductionInfo ? Math.min(actualSpouseIRA, spouseIraDeductionInfo.maxDeductible) : 0;
  const afterTaxSpouseIRA = Math.max(0, actualSpouseIRA - deductibleSpouseIRA);

  const combinedIRA = actualClientIRA + actualSpouseIRA;
  const combinedDeductibleIRA = deductibleClientIRA + deductibleSpouseIRA;
  const combinedAfterTaxIRA = afterTaxClientIRA + afterTaxSpouseIRA;

  // Total Pre-Tax MAGI Reduction (Trad-IRA / Qual-Annuity)
  const totalPreTaxMAGIReduction = combinedDeductibleIRA;
  const annualContrib = totalPreTaxMAGIReduction;

  // Tax calculations
  const marginalTaxRate = getMarginalTaxRate(clientData.grossAGI, clientData.filingStatus);
  const taxRelief = Math.round(annualContrib * marginalTaxRate);

  // Adjusted ACA (identical canonical projection engine as Traditional ACA Dashboard)
  const adjustedMAGI =
    clientData.grossAGI <= safeFloor138
      ? clientData.grossAGI
      : Math.max(safeFloor138, clientData.grossAGI - totalPreTaxMAGIReduction);
  const adjProjection = calculateAcaTierProjection({
    agi: adjustedMAGI,
    householdSize,
    clientAge: clientData.clientAge,
    carrierId: clientData.selectedHealthCarrier,
    scenario: 'moderate',
    taxYear: clientData.taxYear,
  });
  const adjAca = adjProjection.baseAca;
  const activeTierData = adjProjection.tiers[selectedTier];

  // Plan tier adjustments (Bronze / Silver Auto-CSR / Gold) matched 1:1 with Traditional ACA
  const displayPlanName = activeTierData.title;
  const displayPrem = activeTierData.monthlyPremium;
  const displayDed = activeTierData.deductible;
  const displayOop = activeTierData.applicableOopMax;
  const displayAv = activeTierData.avLabel;

  const subsidyShiftAnnual = Math.max(0, (adjAca.monthlySubsidy - origAca.monthlySubsidy) * 12);
  const monthlyAptcGain = Math.max(0, adjAca.monthlySubsidy - origAca.monthlySubsidy);
  const deductibleShield = Math.max(0, origSilverTier.deductible - displayDed);
  const oopShield = Math.max(0, origSilverTier.applicableOopMax - displayOop);
  const totalComprehensiveSavings = subsidyShiftAnnual + deductibleShield + taxRelief;
  const totalComprehensiveAdvantage = annualContrib + taxRelief + deductibleShield + subsidyShiftAnnual + oopShield;
  const netFinancialSwing = totalComprehensiveAdvantage;

  // ACA CSR Tier Thresholds & Next-Tier Headroom (exact unrounded FPL & dollar boundaries)
  const cliffThreshold400 = origAca.fpl100 * 4;
  const csrThreshold250 = Math.round(origAca.fpl100 * 2.5);
  const csrThreshold200 = Math.round(origAca.fpl100 * 2.0);
  const csrThreshold150 = Math.round(origAca.fpl100 * 1.5);
  let nextCsrLabel = 'Max 94% Silver CSR Unlocked';
  let nextCsrDollarsNeeded = 0;

  if (adjAca.isAbove400Cliff) {
    nextCsrLabel = `400% Cliff ($${cliffThreshold400.toLocaleString()}) for APTC`;
    nextCsrDollarsNeeded = Math.max(1, Math.ceil(adjustedMAGI - cliffThreshold400));
  } else if (adjAca.exactFplPct > 250) {
    nextCsrLabel = '73% Silver CSR (250% FPL)';
    nextCsrDollarsNeeded = Math.max(1, adjustedMAGI - csrThreshold250);
  } else if (adjAca.exactFplPct > 200) {
    nextCsrLabel = '87% Silver CSR (200% FPL)';
    nextCsrDollarsNeeded = Math.max(1, adjustedMAGI - csrThreshold200);
  } else if (adjAca.exactFplPct > 150) {
    nextCsrLabel = '94% Max Silver CSR (150% FPL)';
    nextCsrDollarsNeeded = Math.max(1, adjustedMAGI - csrThreshold150);
  }

  const famMult = householdSize > 1 ? 1.8 : 1.0;
  const legacyMonthlyOverhead = Math.round(600 * famMult);
  const legacyAnnualPrem = legacyMonthlyOverhead * 12;
  const monthlyDPC = Math.round(85 * (householdSize > 1 ? 1.5 : 1.0));
  const atlasAnnualPrem = (monthlyDPC + displayPrem) * 12;

  const currentCarrier = REGIONAL_HEALTH_CARRIERS.find((c) => c.id === clientData.selectedHealthCarrier) || REGIONAL_HEALTH_CARRIERS[0];

  // Engine-Simulated Multi-Step Milestone Ladders + Next-Benefit Jumps ($0 -> Max Deductible / Safe Cap)
  const clientIraMilestonePlan: SliderMilestonePlan = computeAtlasBridgeIraMilestones({
    sliderRole: 'client',
    grossAGI: clientData.grossAGI,
    clientAge: clientData.clientAge,
    spouseAge,
    filingStatus: clientData.filingStatus,
    householdSize,
    currentClientIra: actualClientIRA,
    currentSpouseIra: actualSpouseIRA,
    effectiveMaxClientIRA,
    effectiveMaxSpouseIRA,
    clientMaxDeductible: clientIraDeductionInfo.maxDeductible,
    spouseMaxDeductible: spouseIraDeductionInfo ? spouseIraDeductionInfo.maxDeductible : 0,
    taxYear: clientData.taxYear,
    carrierId: clientData.selectedHealthCarrier,
  });

  const spouseIraMilestonePlan: SliderMilestonePlan = isMarried
    ? computeAtlasBridgeIraMilestones({
        sliderRole: 'spouse',
        grossAGI: clientData.grossAGI,
        clientAge: clientData.clientAge,
        spouseAge,
        filingStatus: clientData.filingStatus,
        householdSize,
        currentClientIra: actualClientIRA,
        currentSpouseIra: actualSpouseIRA,
        effectiveMaxClientIRA,
        effectiveMaxSpouseIRA,
        clientMaxDeductible: clientIraDeductionInfo.maxDeductible,
        spouseMaxDeductible: spouseIraDeductionInfo ? spouseIraDeductionInfo.maxDeductible : 0,
        taxYear: clientData.taxYear,
        carrierId: clientData.selectedHealthCarrier,
      })
    : { nextJump: null, milestones: [] };

  const maxAcaPreset = computeAtlasBridgeMaxPreset({
    grossAGI: clientData.grossAGI,
    clientAge: clientData.clientAge,
    spouseAge,
    filingStatus: clientData.filingStatus,
    householdSize,
    isClientCovered,
    isSpouseCovered,
    taxYear: clientData.taxYear,
  });

  const isAlreadyAtMaxPreset =
    actualClientIRA === maxAcaPreset.clientIra &&
    (!isMarried || actualSpouseIRA === maxAcaPreset.spouseIra);

  const handleApplyMaxPreset = () => {
    SoundFX.playUnlock();
    setIraContrib(maxAcaPreset.clientIra);
    if (isMarried) {
      setSpouseIraContrib(maxAcaPreset.spouseIra);
    }
  };

  const handleResetSliders = () => {
    SoundFX.playClick();
    setIraContrib(0);
    if (isMarried) {
      setSpouseIraContrib(0);
    }
  };

  const is2026 = clientData.taxYear === '2026';
  const singlePhaseStartLabel = is2026 ? '$81,000' : '$83,000';
  const singlePhaseEndLabel = is2026 ? '$91,000' : '$93,000';
  const mfjPhaseStartLabel = is2026 ? '$129,000' : '$133,000';

  // Adjust if statutory limits change or poverty floor clamps
  useEffect(() => {
    if (iraContrib > effectiveMaxClientIRA) setIraContrib(effectiveMaxClientIRA);
    if (spouseIraContrib > effectiveMaxSpouseIRA) setSpouseIraContrib(effectiveMaxSpouseIRA);
  }, [effectiveMaxClientIRA, effectiveMaxSpouseIRA, iraContrib, spouseIraContrib]);

  // Sync to parent clientData when values update
  useEffect(() => {
    onChangeClientData({
      existingAnnuityCash: iraContrib,
      spouseExistingAnnuityCash: spouseIraContrib,
      annuityAnnualContribution: iraContrib + spouseIraContrib,
    });
  }, [iraContrib, spouseIraContrib]);

  // Sync live dashboard snapshot for advisor email docket
  useEffect(() => {
    if (!onUpdateStrategySnapshot) return;
    const sliders: Array<{ label: string; value: string }> = [
      { label: 'Target Tax Year', value: clientData.taxYear },
      { label: 'Gross Annual AGI (Slider)', value: `$${clientData.grossAGI.toLocaleString()}/yr` },
      {
        label: isMarried ? 'Primary Client Trad-IRA / Qual-Annuity' : 'Trad-IRA / Qual-Annuity Diversion',
        value: `$${actualClientIRA.toLocaleString()}/yr`,
      },
    ];
    if (isMarried) {
      sliders.push({
        label: 'Spouse Trad-IRA / Qual-Annuity (IRC 219(c))',
        value: `$${actualSpouseIRA.toLocaleString()}/yr`,
      });
    }
    sliders.push(
      { label: 'Selected Carrier', value: currentCarrier.name },
      { label: 'Selected Plan Tier', value: `${displayPlanName} (${selectedTier.toUpperCase()})` },
      { label: 'Preferred Walk-In / Consultation Date', value: walkInDate }
    );

    const nextSnapshot: ActiveStrategySnapshot = {
      pathId: 'atlasbridge',
      pathLabel: 'ACA + Atlasbridge System',
      summaryHeadline: `${displayPlanName} via ${currentCarrier.name} with $${combinedDeductibleIRA.toLocaleString()}/yr deductible MAGI reduction`,
      selectedCarrierOrVendor: currentCarrier.name,
      selectedTierOrOption: displayPlanName,
      sliders,
      impactMetrics: [
        { label: 'Baseline AGI -> Adjusted MAGI', value: `$${clientData.grossAGI.toLocaleString()} -> $${adjustedMAGI.toLocaleString()}` },
        { label: 'FPL Shift', value: `${origAca.fplPct}% FPL -> ${adjAca.fplPct}% FPL` },
        { label: 'Deductible Trad-IRA MAGI Reduction', value: `$${combinedDeductibleIRA.toLocaleString()}/yr` },
        { label: 'Est. Monthly Net ACA Premium', value: `$${displayPrem}/mo (Deductible $${displayDed.toLocaleString()} | Max OOP $${displayOop.toLocaleString()})` },
        { label: 'Additional Annual ACA Subsidy (APTC)', value: `+$${subsidyShiftAnnual.toLocaleString()}/yr (+$${monthlyAptcGain.toLocaleString()}/mo)` },
        { label: 'Deductible & Max OOP Protection Saved', value: `-$${deductibleShield.toLocaleString()} Deductible | -$${oopShield.toLocaleString()} Max OOP Cap` },
        { label: 'Direct IRS Income Tax Savings', value: `+$${taxRelief.toLocaleString()}/yr (${Math.round(marginalTaxRate * 100)}% bracket)` },
        { label: 'Total Comprehensive Financial Advantage', value: `+$${totalComprehensiveAdvantage.toLocaleString()}/yr` },
      ],
    };

    const serialized = JSON.stringify(nextSnapshot);
    if (serialized === lastSnapshotJsonRef.current) return;
    lastSnapshotJsonRef.current = serialized;
    onUpdateStrategySnapshot(nextSnapshot);
  }, [
    onUpdateStrategySnapshot,
    clientData.taxYear,
    clientData.grossAGI,
    isMarried,
    actualClientIRA,
    actualSpouseIRA,
    currentCarrier.name,
    displayPlanName,
    selectedTier,
    walkInDate,
    combinedDeductibleIRA,
    adjustedMAGI,
    origAca.fplPct,
    adjAca.fplPct,
    displayPrem,
    displayDed,
    displayOop,
    deductibleShield,
    oopShield,
    subsidyShiftAnnual,
    monthlyAptcGain,
    taxRelief,
    marginalTaxRate,
    totalComprehensiveAdvantage,
  ]);

  // Chart setup (Comprehensive Cost & Wealth System Comparison)
  useEffect(() => {
    if (!isScenariosOpen || !chartRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Premiums', 'Deductible', 'Subsidies', 'Max OOP'],
        datasets: [
          {
            label: 'Old Fashioned Way',
            data: [legacyAnnualPrem, origSilverTier.deductible, 0, origSilverTier.applicableOopMax],
            backgroundColor: '#ef4444',
          },
          {
            label: 'The AtlasBridge System',
            data: [atlasAnnualPrem, displayDed, subsidyShiftAnnual, displayOop],
            backgroundColor: '#10b981',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Poppins', size: 11 } },
          },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: (value) => '$' + Number(value).toLocaleString(),
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [
    isScenariosOpen,
    legacyAnnualPrem,
    atlasAnnualPrem,
    origSilverTier.deductible,
    displayDed,
    subsidyShiftAnnual,
    origSilverTier.applicableOopMax,
    displayOop,
  ]);

  // Reusable Next-Benefit Jump + Clickable Milestone Ladder ($0 -> Max) for Trad-IRA Sliders
  const renderIraMilestoneControls = (
    plan: SliderMilestonePlan,
    onSelectValue: (targetVal: number) => void
  ) => {
    if (plan.milestones.length === 0 && !plan.nextJump) return null;
    const { nextJump, milestones } = plan;

    return (
      <div className="space-y-1.5 pt-1.5">
        {nextJump && (
          <div
            className={`rounded-lg px-2.5 py-1.5 border flex flex-wrap items-center justify-between gap-2 ${
              nextJump.isCloseProximity
                ? 'bg-emerald-500/12 border-emerald-400/50'
                : 'bg-cyan-500/10 border-cyan-500/35'
            }`}
          >
            <div className="text-[10.5px] leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`font-extrabold ${
                    nextJump.isCloseProximity ? 'text-emerald-300' : 'text-cyan-300'
                  }`}
                >
                  {nextJump.isCloseProximity ? 'Close Threshold: ' : 'Next Benefit: '}
                  {nextJump.thresholdLabel}
                </span>
                {nextJump.monthlyPremiumDropFromCurrent > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold text-[9.5px] tabular-nums">
                    -${nextJump.monthlyPremiumDropFromCurrent.toLocaleString()}/mo ACA Prem.
                  </span>
                )}
              </div>
              <span className="block text-[10px] text-slate-300">{nextJump.benefitLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                SoundFX.playUnlock();
                onSelectValue(nextJump.targetSliderValue);
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors tabular-nums ${
                nextJump.isCloseProximity
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-navy-950'
                  : 'bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200'
              }`}
            >
              Jump to ${nextJump.targetSliderValue.toLocaleString()} (+${nextJump.deltaFromCurrent.toLocaleString()})
            </button>
          </div>
        )}

        {milestones.length > 0 && (
          <div className="bg-navy-950/80 border border-navy-800 rounded-lg px-2 py-1.5 space-y-1">
            <div className="flex items-center justify-between text-[9.5px] text-slate-400 font-semibold">
              <span>Tiered ACA Bonus Ladder ($0 → Max)</span>
              <span>Direct Silver Prem. Effect</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {milestones.map((m) => (
                <button
                  key={`${m.id}-${m.targetSliderValue}`}
                  type="button"
                  onClick={() => {
                    SoundFX.playUnlock();
                    onSelectValue(m.targetSliderValue);
                  }}
                  title={m.benefitLabel}
                  className={`px-2 py-1 rounded-md border text-left transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    m.isUnlocked
                      ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-200 hover:bg-emerald-500/25'
                      : nextJump?.targetSliderValue === m.targetSliderValue
                      ? 'bg-cyan-500/15 border-cyan-400/55 text-cyan-100 hover:bg-cyan-500/25'
                      : 'bg-navy-900 border-navy-700 text-slate-200 hover:border-gold-400/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[9.5px] font-extrabold leading-tight">
                    {m.isUnlocked && <i className="fa-solid fa-check text-[8.5px] text-emerald-400"></i>}
                    <span>{m.shortLabel}</span>
                  </div>
                  <div className="text-[9px] font-mono tabular-nums text-slate-300 leading-tight mt-0.5">
                    ${m.targetSliderValue.toLocaleString()}{' '}
                    <span className={m.isUnlocked ? 'text-emerald-400' : 'text-cyan-300'}>
                      {m.isUnlocked
                        ? `· $${m.resultingSilverMonthlyPremium}/mo`
                        : m.monthlyPremiumDropFromCurrent > 0
                        ? `· -$${m.monthlyPremiumDropFromCurrent}/mo`
                        : `· +$${m.deltaFromCurrent.toLocaleString()}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-gold-500 space-y-6 sm:space-y-8 glow-gold relative overflow-hidden">
        <div className="border-b border-navy-700/60 pb-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/20 text-gold-300 text-xs font-extrabold uppercase tracking-wider border border-gold-500/30 mb-2">
                <i className="fa-solid fa-bolt text-gold-400"></i> Income Simulator &amp; Timeline Engine
              </div>
              <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                How AtlasBridge Turns Healthcare Overhead Into Private Wealth
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 bg-navy-950 p-3 rounded-2xl border border-gold-500/40 shadow-xl self-start lg:self-auto">
              <div className="flex items-center gap-2 bg-navy-900/90 px-3 py-1.5 rounded-xl border border-navy-700">
                <label htmlFor="consultation-date-input" className="text-xs text-gold-400 font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
                  <i className="fa-solid fa-calendar-day"></i> Walk-In:
                </label>
                <input
                  type="date"
                  id="consultation-date-input"
                  value={walkInDate}
                  onChange={(e) => setWalkInDate(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-white focus:outline-none cursor-pointer"
                />
              </div>
              <div className="h-6 w-px bg-navy-700 hidden sm:block"></div>
              <div className="flex items-center gap-2 bg-navy-900/90 px-3 py-1.5 rounded-xl border border-navy-700">
                <label htmlFor="tax-year-select" className="text-xs text-gold-400 font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
                  <i className="fa-solid fa-calendar-days"></i> Tax Year:
                </label>
                <select
                  id="tax-year-select"
                  value={clientData.taxYear}
                  onChange={(e) => onChangeClientData({ taxYear: e.target.value as ClientData['taxYear'] })}
                  className="bg-transparent text-xs font-extrabold text-white focus:outline-none cursor-pointer"
                >
                  <option value="2026" className="bg-navy-900 text-white">2026</option>
                  <option value="2027" className="bg-navy-900 text-white">2027</option>
                  <option value="2028" className="bg-navy-900 text-white">2028</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Left Card: Baseline Gross AGI & Parameters */}
            <div className="bg-navy-950/80 p-5 rounded-2xl border border-navy-700/80 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                {/* Gross Annual AGI Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-slate-300 font-bold">
                      <i className="fa-solid fa-wallet text-blue-400 mr-1.5"></i> Gross Annual AGI{' '}
                      {isMarried && <span className="text-gold-400 font-bold">(Including Spouse)</span>}:
                    </span>
                    <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-blue-500/40">
                      <span className="text-blue-400 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        max="300000"
                        step="500"
                        value={clientData.grossAGI}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          onChangeClientData({ grossAGI: Number.isNaN(val) ? 0 : Math.max(0, val) });
                        }}
                        className="w-24 bg-transparent text-white font-extrabold text-sm focus:outline-none text-right"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="250000"
                    step="500"
                    value={Math.min(250000, clientData.grossAGI)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const cleanVal = Number.isNaN(val) ? 0 : val;
                      SoundFX.playSlideHum(cleanVal / 250000);
                      onChangeClientData({ grossAGI: cleanVal });
                    }}
                    className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium px-0.5 tabular-nums">
                    <span>$0 Min</span>
                    <span>138% Safe Floor: ${safeFloor138.toLocaleString()}</span>
                    <span>400% Cliff: ${(origAca.fpl100 * 4).toLocaleString()}</span>
                  </div>
                </div>

                {/* Adjusted MAGI & ACA Impact Box — directly under Gross Annual AGI slider */}
                <div className="bg-navy-900 p-3 rounded-lg border border-purple-500/40 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                      <i className="fa-solid fa-sliders mr-1"></i> Adjusted MAGI &amp; ACA Impact:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 tabular-nums">
                      +${subsidyShiftAnnual.toLocaleString()}/yr Subsidy Shift
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="bg-navy-950 p-2 rounded border border-navy-800">
                      <span className="text-[9px] text-slate-400 block font-semibold">Original Gross AGI:</span>
                      <strong className="text-white font-bold block tabular-nums">${clientData.grossAGI.toLocaleString()}</strong>
                      <span className="text-[9.5px] text-amber-400 block truncate">{origAca.av} ({currentCarrier.name})</span>
                    </div>

                    <div className="bg-navy-950 p-2 rounded border border-purple-500/30">
                      <span className="text-[9px] text-purple-300 block font-semibold">Adjusted MAGI:</span>
                      <strong className="text-purple-200 font-bold block tabular-nums">${adjustedMAGI.toLocaleString()}</strong>
                      <span className="text-[9.5px] text-emerald-400 block truncate">{adjAca.av} ({currentCarrier.name})</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 italic flex items-center justify-between pt-0.5">
                    <span>* Auto-adjusted for Pre-Tax Diversion (Trad-IRA / Qual-Annuity).</span>
                    <span className="text-purple-300 font-semibold tabular-nums">
                      {totalPreTaxMAGIReduction > 0
                        ? `-$${combinedDeductibleIRA.toLocaleString()} Trad-IRA Deduction`
                        : '$0 reduction'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mini Breakdown of ACA Potential (fills freed space cleanly) */}
              <div className="pt-2.5 border-t border-navy-800/80 space-y-2.5 text-xs">
                <div className="bg-navy-900/90 p-3 rounded-lg border border-blue-500/30 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">
                      <i className="fa-solid fa-layer-group mr-1"></i> Mini Breakdown: ACA Potential
                    </span>
                    <span className="text-[10.5px] text-slate-300 font-semibold tabular-nums">
                      {origAca.fplPct}% → <strong className="text-emerald-400">{adjAca.fplPct}% FPL</strong>
                    </span>
                  </div>

                  {/* Silver CSR Tier Progression Strip */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[9.5px]">
                    {[
                      { label: 'Std 70%', threshold: '>250%', active: adjAca.exactFplPct > 250 },
                      { label: '73% CSR', threshold: '≤250%', active: adjAca.exactFplPct > 200 && adjAca.exactFplPct <= 250 },
                      { label: '87% CSR', threshold: '≤200%', active: adjAca.exactFplPct > 150 && adjAca.exactFplPct <= 200 },
                      { label: '94% CSR', threshold: '≤150%', active: !adjAca.isBelow100Fpl && adjAca.exactFplPct <= 150 },
                    ].map((tier) => (
                      <div
                        key={tier.label}
                        className={`py-1.5 px-1 rounded border transition-colors ${
                          tier.active
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 font-bold'
                            : 'bg-navy-950/70 border-navy-800 text-slate-500'
                        }`}
                      >
                        <div className="leading-tight">{tier.label}</div>
                        <div className="text-[8.5px] opacity-80 tabular-nums">{tier.threshold}</div>
                      </div>
                    ))}
                  </div>

                  {/* Compact 3-Metric Potential Comparison */}
                  <div className="grid grid-cols-3 gap-2 text-[10.5px]">
                    <div className="bg-navy-950/80 p-2 rounded border border-navy-800">
                      <span className="text-[9px] text-slate-400 block">APTC Boost</span>
                      <strong className="text-emerald-400 font-extrabold tabular-nums">+${monthlyAptcGain.toLocaleString()}/mo</strong>
                    </div>
                    <div className="bg-navy-950/80 p-2 rounded border border-navy-800">
                      <span className="text-[9px] text-slate-400 block">Deductible Cut</span>
                      <strong className="text-blue-400 font-extrabold tabular-nums">-${deductibleShield.toLocaleString()}</strong>
                    </div>
                    <div className="bg-navy-950/80 p-2 rounded border border-navy-800">
                      <span className="text-[9px] text-slate-400 block">Max OOP Cut</span>
                      <strong className="text-purple-300 font-extrabold tabular-nums">-${oopShield.toLocaleString()}</strong>
                    </div>
                  </div>

                  {/* Next Threshold / Cliff Headroom */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-navy-800/80">
                    <span className="text-slate-400">
                      {adjustedMAGI <= safeFloor138 || adjAca.exactFplPct <= 138
                        ? '138% FPL Medicaid-Safe Floor (Protected)'
                        : nextCsrDollarsNeeded > 0
                        ? `To ${nextCsrLabel}:`
                        : 'Silver CSR Status:'}
                    </span>
                    <strong className="text-gold-400 font-bold tabular-nums">
                      {nextCsrDollarsNeeded > 0
                        ? `-$${nextCsrDollarsNeeded.toLocaleString()} MAGI needed`
                        : nextCsrLabel}
                    </strong>
                  </div>
                </div>

                <div className="bg-navy-900 p-3 rounded-lg border border-emerald-500/40 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">
                      <i className="fa-solid fa-piggy-bank text-emerald-400 mr-1"></i> Total Comprehensive Savings:
                    </span>
                    <span className="text-[9px] text-slate-400">APTC Subsidy + Deductible Risk + IRS Tax Relief</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-emerald-400 tabular-nums">+${totalComprehensiveSavings.toLocaleString()} / yr</div>
                    <span className="text-[9px] text-emerald-300 font-semibold tabular-nums">~{adjAca.fplPct}% FPL</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Pre-Tax Diversion Slider (Trad-IRA / Qual-Annuity) */}
            <div className="bg-navy-950/90 p-5 rounded-2xl border border-gold-500/40 space-y-4 shadow-xl glow-gold flex flex-col justify-between">
              <div className="space-y-4">
                <div className="space-y-2.5 border-b border-navy-800 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 text-sm shrink-0">
                        <i className="fa-solid fa-piggy-bank"></i>
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                          <span>Pre-Tax Diversion Slider</span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          IRC § 219 Qualified Annuity / Traditional IRA Allocation {isMarried && '· Spousal IRA (IRC § 219(c))'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9.5px] text-slate-400 uppercase font-semibold block">{isMarried ? 'Combined IRA' : 'IRA Contribution'}</span>
                      <strong className="text-gold-400 font-black text-sm sm:text-base tabular-nums font-mono">${combinedIRA.toLocaleString()} / yr</strong>
                    </div>
                  </div>

                  {/* Quick Optimization Preset Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      138% Safe Cap: <strong className="text-slate-200">${safeFloor138.toLocaleString()}</strong> MAGI floor
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleResetSliders}
                        className="px-2.5 py-1 rounded-md bg-navy-900 hover:bg-navy-800 border border-navy-700 text-slate-300 hover:text-white text-[10.5px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                      >
                        <i className="fa-solid fa-rotate-left mr-1"></i> Reset ($0)
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyMaxPreset}
                        disabled={
                          clientData.grossAGI <= safeFloor138 ||
                          (maxAcaPreset.clientIra === 0 && maxAcaPreset.spouseIra === 0) ||
                          isAlreadyAtMaxPreset
                        }
                        className={`px-2.5 py-1 rounded-md text-[10.5px] font-extrabold whitespace-nowrap shrink-0 transition-all flex items-center gap-1 ${
                          clientData.grossAGI <= safeFloor138 ||
                          (maxAcaPreset.clientIra === 0 && maxAcaPreset.spouseIra === 0) ||
                          isAlreadyAtMaxPreset
                            ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-300/75 cursor-default'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-navy-950 shadow-sm shadow-emerald-500/20 cursor-pointer'
                        }`}
                      >
                        <i className="fa-solid fa-bolt"></i>
                        <span>
                          {isAlreadyAtMaxPreset && (maxAcaPreset.clientIra > 0 || maxAcaPreset.spouseIra > 0)
                            ? 'Maxed at 138% Floor / IRS Cap'
                            : 'Maximize ACA (138% FPL Floor)'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* SINGLE OR STACKED DUAL SLIDERS: TRADITIONAL IRA / QUALIFIED ANNUITY */}
                <div className="space-y-3 font-sans">
                  {/* Primary Taxpayer IRA Slider */}
                  <div className={`space-y-1.5 ${isMarried ? 'bg-navy-900/60 p-2.5 rounded-lg border border-navy-800' : ''}`}>
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-slate-300 font-bold flex items-center gap-1.5 text-xs sm:text-sm">
                        <i className="fa-solid fa-vault text-gold-400"></i> {isMarried ? 'Your Trad-IRA / Qual-Annuity:' : 'Trad-IRA / Qual-Annuity:'}
                      </span>
                      <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-gold-500/40">
                        <span className="text-gold-400 font-bold text-xs sm:text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          max={effectiveMaxClientIRA}
                          step="1"
                          value={actualClientIRA}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setIraContrib(Math.min(effectiveMaxClientIRA, Math.max(0, val)));
                          }}
                          className="w-20 sm:w-24 bg-transparent text-gold-400 font-extrabold text-xs sm:text-sm focus:outline-none text-right font-mono tabular-nums"
                        />
                        <span className="text-[10px] text-slate-400">/yr</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={effectiveMaxClientIRA}
                      step="10"
                      value={actualClientIRA}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        SoundFX.playSlideHum(effectiveMaxClientIRA > 0 ? val / effectiveMaxClientIRA : 0);
                        setIraContrib(val);
                      }}
                      className="w-full h-2.5 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
                    />
                    <div className="grid grid-cols-3 text-[10.5px] text-slate-400 font-semibold px-0.5 font-mono tabular-nums">
                      <span className="text-left">$0</span>
                      <span className="text-center text-slate-300">${Math.round(effectiveMaxClientIRA / 2).toLocaleString()}</span>
                      <span className="text-right text-gold-400 font-bold">Max: ${effectiveMaxClientIRA.toLocaleString()}</span>
                    </div>
                    {renderIraMilestoneControls(clientIraMilestonePlan, (val) => setIraContrib(val))}
                  </div>

                  {/* Spouse Trad-IRA Slider (IRC § 219(c) Kay Bailey Hutchison Spousal IRA) */}
                  {isMarried && (
                    <div className="space-y-1.5 bg-navy-900/80 p-2.5 rounded-lg border border-amber-500/30">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-300 font-bold text-xs"><i className="fa-solid fa-heart text-amber-400 mr-1"></i> Spouse Trad-IRA / Qual-Annuity:</span>
                          <span className="text-[9px] text-amber-400 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded font-extrabold">IRC § 219(c)</span>
                        </div>
                        <div className="flex items-center gap-1 bg-navy-950 px-2 py-0.5 rounded border border-amber-500/40">
                          <span className="text-amber-400 font-bold text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            max={effectiveMaxSpouseIRA}
                            step="1"
                            value={actualSpouseIRA}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSpouseIraContrib(Math.min(effectiveMaxSpouseIRA, Math.max(0, val)));
                            }}
                            className="w-20 sm:w-24 bg-transparent text-amber-400 font-extrabold text-xs focus:outline-none text-right font-mono tabular-nums"
                          />
                          <span className="text-[10px] text-slate-400">/yr</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={effectiveMaxSpouseIRA}
                        step="10"
                        value={actualSpouseIRA}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          SoundFX.playSlideHum(effectiveMaxSpouseIRA > 0 ? val / effectiveMaxSpouseIRA : 0);
                          setSpouseIraContrib(val);
                        }}
                        className="w-full h-2.5 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="grid grid-cols-3 text-[10.5px] text-slate-400 font-semibold px-0.5 font-mono tabular-nums">
                        <span className="text-left">$0</span>
                        <span className="text-center text-slate-300">${Math.round(effectiveMaxSpouseIRA / 2).toLocaleString()}</span>
                        <span className="text-right text-amber-400 font-bold">Max: ${effectiveMaxSpouseIRA.toLocaleString()}</span>
                      </div>
                      {renderIraMilestoneControls(spouseIraMilestonePlan, (val) => setSpouseIraContrib(val))}
                    </div>
                  )}

                  {/* 138% FPL Safe Floor Safeguard Warning (if pre-tax room is constrained) */}
                  {maxSafeTotalPreTax < (iraCap + (isMarried ? spouseIraCap : 0)) && (
                    <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <i className="fa-solid fa-shield-halved text-amber-400 text-xs shrink-0"></i>
                      <span>
                        <strong>138% FPL Safe Floor Protected:</strong> Pre-tax diversion is capped at 138% FPL (${safeFloor138.toLocaleString()}) to safeguard ACA subsidy eligibility without Medicaid displacement.
                      </span>
                    </div>
                  )}

                  {/* Dynamic Deductibility Badge */}
                  <div className="pt-1">
                    {isMarried ? (
                      clientIraDeductionInfo.phaseOutStatus === 'full' && (!spouseIraDeductionInfo || spouseIraDeductionInfo.phaseOutStatus === 'full') ? (
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-circle-check text-emerald-400"></i>{' '}
                          {!isClientCovered && !isSpouseCovered
                            ? 'Full Deduction Qualified (No Workplace 401k Restriction)'
                            : `Full Deduction Qualified (Joint MAGI ≤ ${mfjPhaseStartLabel})`}
                        </span>
                      ) : clientIraDeductionInfo.phaseOutStatus === 'none' && (!spouseIraDeductionInfo || spouseIraDeductionInfo.phaseOutStatus === 'none') ? (
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-ban text-rose-400"></i> $0 Deduction · Joint MAGI Exceeds Phase-Out Limit
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-triangle-exclamation text-amber-400"></i> Dynamic MFJ Phase-Out · Combined Max Deductible: ${combinedDeductibleIRA.toLocaleString()}
                        </span>
                      )
                    ) : (
                      clientIraDeductionInfo.phaseOutStatus === 'full' ? (
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-circle-check text-emerald-400"></i>{' '}
                          {!isClientCovered
                            ? 'Full Deduction Qualified (No Workplace 401k Restriction)'
                            : `Full Deduction Qualified (MAGI ≤ ${singlePhaseStartLabel})`}
                        </span>
                      ) : clientIraDeductionInfo.phaseOutStatus === 'partial' ? (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-triangle-exclamation text-amber-400"></i> Partial Deduction ({singlePhaseStartLabel}–{singlePhaseEndLabel}) · Max ${clientIraDeductionInfo.maxDeductible.toLocaleString()} Deductible
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-ban text-rose-400"></i> $0 Deduction · MAGI ≥ {singlePhaseEndLabel} Phase-Out Limit
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-[11px] text-gold-300/90 italic font-medium">
                    <i className="fa-solid fa-circle-info mr-1"></i> {clientIraDeductionInfo.notice}
                    {spouseIraDeductionInfo && isMarried && (
                      <span className="block mt-0.5 text-amber-300">Spouse: {spouseIraDeductionInfo.notice}</span>
                    )}
                    {combinedAfterTaxIRA > 0 && (
                      <span className="text-amber-400 font-semibold block mt-0.5">
                        Note: ${combinedAfterTaxIRA.toLocaleString()}/yr is after-tax accumulation ($0 MAGI reduction).
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Asset Breakdown & Direct IRS Relief */}
              <div className="pt-2.5 border-t border-navy-800/80 space-y-2 text-xs">
                <div className="bg-navy-900 p-2.5 rounded-lg border border-gold-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">
                      <i className="fa-solid fa-piggy-bank text-gold-400 mr-1"></i> Pre-Tax Assets Built This Year
                    </span>
                    <span className="text-[9px] text-gold-300 uppercase font-semibold">
                      100% Tax-Deferred Wealth Growth (IRC § 219)
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-gold-400">${combinedIRA.toLocaleString()} / yr</div>
                    <div className="text-[9px] text-slate-400">
                      ${combinedDeductibleIRA.toLocaleString()} Deductible MAGI Reduction
                      {combinedAfterTaxIRA > 0 && ` ($${combinedAfterTaxIRA.toLocaleString()} After-Tax)`}
                    </div>
                  </div>
                </div>

                <div className="bg-navy-900 p-2.5 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">
                      <i className="fa-solid fa-percent text-emerald-400 mr-1"></i> Direct IRS Income Tax Savings
                    </span>
                    <span className="text-[9px] text-emerald-300 uppercase font-semibold">
                      Based on {Math.round(marginalTaxRate * 100)}% Tax Bracket
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-emerald-400">+${taxRelief.toLocaleString()} / yr</div>
                    <span className="text-[9px] text-slate-400">Immediate IRS Relief</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carrier & Tier Selector Banner */}
        <div className="bg-navy-950 p-5 rounded-xl border border-blue-500/50 space-y-4 glow-blue">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/80 pb-3">
            <div>
              <h4 className="text-base sm:text-lg font-extrabold text-white">
                Active Plan Category: <span className="text-emerald-400">{displayPlanName}</span> ({currentCarrier.category})
              </h4>
              <p className="text-[11px] text-slate-400">
                Selected Regional Carrier: <strong className="text-blue-400">{currentCarrier.name}</strong> ({currentCarrier.note})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-navy-900 px-3 py-1.5 rounded-lg border border-emerald-500/40">
                <label htmlFor="health-carrier-select" className="text-xs text-emerald-300 font-semibold whitespace-nowrap cursor-pointer">
                  <i className="fa-solid fa-hospital mr-1"></i> Carrier Option:
                </label>
                <select
                  id="health-carrier-select"
                  value={clientData.selectedHealthCarrier}
                  onChange={(e) => {
                    SoundFX.playClick();
                    onChangeClientData({ selectedHealthCarrier: e.target.value as HealthCarrierId });
                  }}
                  className="bg-navy-950 text-xs font-bold text-white px-2.5 py-1 rounded border border-navy-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {REGIONAL_HEALTH_CARRIERS.map((c) => (
                    <option key={c.id} value={c.id} className="bg-navy-900 text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-navy-900 px-3 py-1.5 rounded-lg border border-blue-500/30">
                <label htmlFor="plan-tier-select" className="text-xs text-blue-300 font-semibold whitespace-nowrap cursor-pointer">
                  <i className="fa-solid fa-list-ul mr-1"></i> Tier:
                </label>
                <select
                  id="plan-tier-select"
                  value={selectedTier}
                  onChange={(e) => {
                    SoundFX.playClick();
                    setSelectedTier(e.target.value as AcaMetalTier);
                  }}
                  className="bg-navy-950 text-xs font-bold text-white px-2.5 py-1 rounded border border-navy-700 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[190px] sm:max-w-[220px]"
                >
                  <option value="bronze" className="bg-navy-900 text-white">Bronze Plan (60% AV)</option>
                  <option value="silver" className="bg-navy-900 text-white">Silver Plan (Auto-CSR Matched)</option>
                  <option value="gold" className="bg-navy-900 text-white">Gold Plan (80% AV)</option>
                </select>
              </div>

              <button
                type="button"
                aria-expanded={isProviderMapOpen}
                onClick={() => {
                  SoundFX.playClick();
                  setIsProviderMapOpen((prev) => !prev);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  isProviderMapOpen
                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-500/20'
                    : 'bg-navy-900 hover:bg-navy-800 text-blue-300 border-blue-500/40 hover:border-blue-400'
                }`}
              >
                <i className="fa-solid fa-map-location-dot"></i>
                <span>{isProviderMapOpen ? 'Hide Providers Map' : `Local Providers (${clientData.zipCode || '34994'})`}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="bg-navy-900/80 p-3 rounded-lg border border-navy-700/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Monthly ACA Premium</span>
              <div className="text-base sm:text-lg font-black text-white tabular-nums">${displayPrem.toLocaleString()} / mo</div>
              <div className={`text-[10px] tabular-nums ${adjAca.monthlySubsidy > 0 ? 'text-emerald-400' : 'text-rose-300'}`}>
                {adjAca.monthlySubsidy > 0
                  ? `+$${adjAca.monthlySubsidy.toLocaleString()}/mo APTC Active`
                  : adjAca.isBelow100Fpl
                  ? '$0 APTC (Below 100% FPL)'
                  : '$0 APTC (Over 400% Cliff)'}
              </div>
            </div>
            <div className="bg-navy-900/80 p-3 rounded-lg border border-navy-700/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Family/Ind. Deductible</span>
              <div className="text-base sm:text-lg font-black text-blue-400 tabular-nums">${displayDed.toLocaleString()} / yr</div>
              <div className="text-[10px] text-slate-400">
                {selectedTier === 'silver' && !adjAca.isBelow100Fpl && adjAca.exactFplPct <= 250
                  ? 'Auto-CSR Reduced'
                  : `${clientData.taxYear} Plan Year`}
              </div>
            </div>
            <div className="bg-navy-900/80 p-3 rounded-lg border border-navy-700/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Max Out-of-Pocket</span>
              <div className="text-base sm:text-lg font-black text-purple-300 tabular-nums">${displayOop.toLocaleString()} / yr</div>
              <div className="text-[10px] text-slate-400">{clientData.taxYear} {adjAca.isFamily ? 'Family' : 'Ind.'} Cap</div>
            </div>
            <div className="bg-navy-900/80 p-3 rounded-lg border border-navy-700/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Actuarial Value (AV)</span>
              <div className="text-base sm:text-lg font-black text-gold-400">{displayAv}</div>
              <div className="text-[10px] text-slate-400 tabular-nums">~{adjAca.fplPct}% FPL</div>
            </div>
          </div>

          {isProviderMapOpen && (
            <ProviderNetworkMap
              zipCode={clientData.zipCode || '34994'}
              onChangeZipCode={(zip) => onChangeClientData({ zipCode: zip })}
              carrier={currentCarrier}
              onChangeCarrier={(carrierId) => onChangeClientData({ selectedHealthCarrier: carrierId })}
              selectedTier={selectedTier}
              displayPlanName={displayPlanName}
            />
          )}
        </div>
      </section>

      {/* KPI Cards Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-5 glass-card-hover border-t-2 border-t-emerald-400">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Value Retained</span>
            <i className="fa-solid fa-vault text-emerald-400 text-base"></i>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            +${(annualContrib + taxRelief).toLocaleString()} / yr
          </div>
          <p className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1">
            <i className="fa-solid fa-arrow-up-right"></i> Direct Pre-tax Assets + Tax Savings
          </p>
        </div>

        <div className="glass-card p-5 glass-card-hover border-t-2 border-t-blue-500">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Direct Subsidy Captured</span>
            <i className="fa-solid fa-hand-holding-dollar text-blue-400 text-base"></i>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            +${subsidyShiftAnnual.toLocaleString()} / yr
          </div>
          <p className="text-[11px] text-blue-300 mt-1 flex items-center gap-1">
            <i className="fa-solid fa-circle-check"></i> IRC Section 36B Optimization
          </p>
        </div>

        <div className="glass-card p-5 glass-card-hover border-t-2 border-t-purple-500">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Immediate Deductible Shield</span>
            <i className="fa-solid fa-shield-halved text-purple-400 text-base"></i>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            ${deductibleShield.toLocaleString()} Risk Shield
          </div>
          <p className="text-[11px] text-purple-300 mt-1 flex items-center gap-1">
            <i className="fa-solid fa-shield-heart"></i> Cost-Sharing Reduction (CSR) Lock
          </p>
        </div>

        <div className="glass-card p-5 glass-card-hover border-t-2 border-t-gold-500 glow-gold">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Net Financial Advantage</span>
            <i className="fa-solid fa-gem text-gold-400 text-base"></i>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gold-400 mt-2">
            +${netFinancialSwing.toLocaleString()} / yr
          </div>
          <p className="text-[11px] text-gold-300/90 mt-1 flex items-center gap-1">
            <i className="fa-solid fa-arrow-trend-up"></i> Net Financial Advantage Swing
          </p>
        </div>
      </section>

      {/* Direct Primary Care (DPC) Integration Card */}
      <section className="glass-card p-5 sm:p-6 border-l-4 border-l-cyan-400 glow-blue space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-700/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-xl shrink-0">
              <i className="fa-solid fa-stethoscope"></i>
            </div>
            <div>
              <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-wider block">Local Stuart, FL Care Architecture</span>
              <h4 className="text-base sm:text-lg font-black text-white">Direct Primary Care (DPC) + ACA Synergy</h4>
            </div>
          </div>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-full font-bold self-start sm:self-auto">
            Zero-Copay Primary Care
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Pairing your optimized ACA plan with Direct Primary Care provides unlimited 24/7 access to your personal Stuart-area physician with <strong>$0 copays, unhurried 45-minute appointments, and wholesale generic prescription pricing</strong>, while your ACA Silver plan acts as a catastrophic shield for hospitalizations and major specialist interventions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="bg-navy-950 p-3 rounded-xl border border-navy-800 space-y-1">
            <span className="text-cyan-400 font-bold block"><i className="fa-solid fa-phone-volume mr-1"></i> Direct Cell &amp; Telehealth</span>
            <p className="text-slate-400 text-[11px]">Same-day or next-day appointments with zero wait times.</p>
          </div>
          <div className="bg-navy-950 p-3 rounded-xl border border-navy-800 space-y-1">
            <span className="text-cyan-400 font-bold block"><i className="fa-solid fa-pills mr-1"></i> In-House Dispensary</span>
            <p className="text-slate-400 text-[11px]">Wholesale labs and 90% savings on standard generic maintenance meds.</p>
          </div>
          <div className="bg-navy-950 p-3 rounded-xl border border-navy-800 space-y-1">
            <span className="text-cyan-400 font-bold block"><i className="fa-solid fa-shield-virus mr-1"></i> Deductible Unaffected</span>
            <p className="text-slate-400 text-[11px]">Routine visits never count against your annual health deductible.</p>
          </div>
        </div>
      </section>

      {/* Reverted Detailed Financial & Scenario Breakdown Accordion (Previous v5 Form) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            SoundFX.playClick();
            setIsScenariosOpen(!isScenariosOpen);
          }}
          className="w-full glass-card p-4 hover:bg-navy-800/80 transition-all border border-blue-500/40 flex items-center justify-between text-left group shadow-lg glow-blue cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-navy-950 border border-blue-400/40 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-chart-pie"></i>
            </div>
            <div>
              <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider block">
                Advanced Analytics &amp; Breakdown
              </span>
              <h4 className="text-sm sm:text-base font-extrabold text-white">
                {isScenariosOpen
                  ? 'Hide Detailed Financial & Scenario Breakdown'
                  : 'Show Detailed Financial & Scenario Breakdown'}
              </h4>
            </div>
          </div>
          <i
            className={`fa-solid ${isScenariosOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-blue-400 text-lg transition-transform`}
          ></i>
        </button>
      </div>

      {isScenariosOpen && (
        <div className="scenarios-scroll-box space-y-8">
          <section className="glass-card p-5 sm:p-8 space-y-6 border-l-4 border-l-blue-500 glow-blue">
            <div className="border-b border-navy-700/60 pb-3">
              <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider block mb-1">
                <i className="fa-solid fa-bolt text-xs mr-1"></i> Core Strategy Pillars
              </span>
              <h3 className="text-lg sm:text-2xl font-black text-white">The Three AtlasBridge Superpowers</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-navy-950/90 border border-emerald-500/40 rounded-2xl p-5 space-y-3 relative glow-emerald flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                    Superpower #1
                  </span>
                  <h4 className="text-lg font-extrabold text-white">Pre-Tax Wealth Engine</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Redirects money into your own <strong>Qualified Annuity / IRA accounts</strong> instead of insurance company premiums.
                  </p>
                </div>
                <div className="pt-3 border-t border-navy-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Wealth Retained:</span>
                  <strong className="text-emerald-400 font-extrabold text-sm">
                    +${annualContrib.toLocaleString()} / yr
                  </strong>
                </div>
              </div>

              <div className="bg-navy-950/90 border border-purple-500/40 rounded-2xl p-5 space-y-3 relative glow-purple flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300">
                    Superpower #2
                  </span>
                  <h4 className="text-lg font-extrabold text-white">Federal Subsidy Unlocker</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Lower MAGI triggers <strong>higher federal APTC subsidies</strong> and slashes out-of-pocket medical deductible risk.
                  </p>
                </div>
                <div className="pt-3 border-t border-navy-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Subsidies &amp; Risk Saved:</span>
                  <strong className="text-purple-300 font-extrabold text-sm">
                    -${deductibleShield.toLocaleString()} Deductible Risk
                  </strong>
                </div>
              </div>

              <div className="bg-navy-950/90 border border-gold-500/40 rounded-2xl p-5 space-y-3 relative glow-gold flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gold-400">
                    Superpower #3
                  </span>
                  <h4 className="text-lg font-extrabold text-white">Direct Tax Discount</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Lowering your tax bracket rewards you with a <strong>direct IRS tax discount</strong>, putting cash back into your pocket.
                  </p>
                </div>
                <div className="pt-3 border-t border-navy-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Direct IRS Tax Relief:</span>
                  <strong className="text-gold-400 font-extrabold text-sm">
                    +${taxRelief.toLocaleString()} / yr ({Math.round(marginalTaxRate * 100)}% Bracket)
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card p-5 sm:p-8 space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center justify-between">
              <span>
                <i className="fa-solid fa-vault text-emerald-400 mr-2"></i> Comprehensive Cost &amp; Wealth System Comparison
              </span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 bg-navy-950 p-4 rounded-xl border border-navy-800 h-80 sm:h-[360px]">
                <canvas ref={chartRef}></canvas>
              </div>

              <div className="lg:col-span-5 bg-navy-900/90 border border-emerald-500/40 p-5 rounded-2xl space-y-4 shadow-xl">
                <div className="border-b border-navy-800 pb-3">
                  <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <i className="fa-solid fa-chart-line text-emerald-400"></i> Financial Performance Breakdown
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">The AtlasBridge System vs. Old Fashioned Way</p>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center bg-navy-950/80 p-2.5 rounded-lg border border-navy-800">
                    <span className="text-slate-300 font-semibold">1. Pre-Tax Wealth Built:</span>
                    <strong className="text-emerald-400 font-extrabold text-sm tabular-nums">${annualContrib.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-center bg-navy-950/80 p-2.5 rounded-lg border border-navy-800">
                    <span className="text-slate-300 font-semibold">2. Direct IRS Tax Relief:</span>
                    <strong className="text-gold-400 font-extrabold text-sm tabular-nums">${taxRelief.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-center bg-navy-950/80 p-2.5 rounded-lg border border-navy-800">
                    <span className="text-slate-300 font-semibold">3. Deductible Risk Saved:</span>
                    <strong className="text-purple-300 font-extrabold text-sm tabular-nums">${deductibleShield.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-center bg-navy-950/80 p-2.5 rounded-lg border border-navy-800">
                    <span className="text-slate-300 font-semibold">4. APTC Premium Subsidy Gained:</span>
                    <strong className="text-cyan-400 font-extrabold text-sm tabular-nums">${subsidyShiftAnnual.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-center bg-navy-950/80 p-2.5 rounded-lg border border-navy-800">
                    <span className="text-slate-300 font-semibold">5. Max Out-of-Pocket (OOP) Risk Saved:</span>
                    <strong className="text-blue-400 font-extrabold text-sm tabular-nums">${oopShield.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-navy-800 flex justify-between items-center">
                  <span className="text-xs text-slate-200 font-bold">Total Net Financial Advantage:</span>
                  <strong className="text-emerald-400 font-black text-base whitespace-nowrap tabular-nums">
                    +${totalComprehensiveAdvantage.toLocaleString()} / yr
                  </strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
