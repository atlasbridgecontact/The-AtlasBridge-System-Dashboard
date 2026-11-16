import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  ActiveStrategySnapshot,
  ClientData,
  HealthCarrierId,
  SelfEmployedEntityBasis,
} from '../../types';
import {
  calculateSelfEmployedAcaStrategy,
  computeMaxAcaOptimizationPreset,
  computeRealisticSelfEmployedDefaults,
  getHouseholdSize,
  getIRSLimitForAge,
  getNextBenefitThresholdForSlider,
  SliderThresholdJump,
} from '../../utils/calculations';
import { REGIONAL_HEALTH_CARRIERS } from '../../utils/constants';
import { SoundFX } from '../../utils/audio';

Chart.register(...registerables);

interface SelfEmployedAcaDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
  onUpdateStrategySnapshot?: (snapshot: ActiveStrategySnapshot) => void;
}

export const SelfEmployedAcaDashboard: React.FC<SelfEmployedAcaDashboardProps> = ({
  clientData,
  onChangeClientData,
  onUpdateStrategySnapshot,
}) => {
  const isMarried = clientData.filingStatus === 'married';
  const spouseAge = clientData.spouseAge || clientData.clientAge;
  const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);
  const taxYear = clientData.taxYear || '2027';

  const netProfit =
    clientData.netSelfEmploymentProfit !== undefined
      ? clientData.netSelfEmploymentProfit
      : Math.round(clientData.grossAGI * 0.85);

  // Strategy & Plain-Language Entity Classification State
  const [selectedVehicle, setSelectedVehicle] = useState<'stacked_solo' | 'sep_ira'>('stacked_solo');
  const [entityBasis, setEntityBasis] = useState<SelfEmployedEntityBasis>('schedule_c');

  // Seed realistic profit-aware defaults targeting 150% FPL Silver CSR within sustainable cash flow & 138% FPL floor
  const initialDefaults = computeRealisticSelfEmployedDefaults({
    grossAGI: clientData.grossAGI,
    netBusinessProfit: netProfit,
    clientAge: clientData.clientAge,
    spouseAge,
    filingStatus: clientData.filingStatus,
    householdSize,
    entityBasis: 'schedule_c',
    taxYear,
  });

  const [scorpW2Wages, setScorpW2Wages] = useState<number>(
    Math.round(netProfit * (netProfit <= 60000 ? 0.6 : 0.55) / 500) * 500
  );
  const [customSoloEmployee, setCustomSoloEmployee] = useState<number>(initialDefaults.soloEmployee);
  const [customSoloEmployer, setCustomSoloEmployer] = useState<number>(initialDefaults.soloEmployer);
  const [customSepContribution, setCustomSepContribution] = useState<number>(initialDefaults.sepContribution);

  const [stackClientTradIra, setStackClientTradIra] = useState<boolean>(initialDefaults.stackClientIra);
  const [customClientIraAmount, setCustomClientIraAmount] = useState<number>(initialDefaults.clientIraAmount);
  const [stackSpousalIra, setStackSpousalIra] = useState<boolean>(initialDefaults.stackSpouseIra);
  const [customSpouseIraAmount, setCustomSpouseIraAmount] = useState<number>(initialDefaults.spouseIraAmount);

  // Collapsible Baseline vs. Optimized Impact Section & IRS Matrix Table (both collapsed by default)
  const [isImpactExpanded, setIsImpactExpanded] = useState<boolean>(false);
  const [isIrsMatrixExpanded, setIsIrsMatrixExpanded] = useState<boolean>(false);

  const spouseCovered = Boolean(clientData.spouseCoveredByPlan);
  const activeCarrier = clientData.selectedHealthCarrier || 'oscar';

  // Chart References & Snapshot Deduplication
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const lastSnapshotJsonRef = useRef<string>('');
  const prevReseedKeyRef = useRef<string>(
    `${netProfit}|${clientData.grossAGI}|${clientData.clientAge}|${spouseAge}|${clientData.filingStatus}|${householdSize}|${taxYear}`
  );

  // Apply realistic profit-proportional defaults cleanly when income/profit/household inputs change
  const applyRealisticDefaults = (targetBasis: SelfEmployedEntityBasis = entityBasis) => {
    const realistic = computeRealisticSelfEmployedDefaults({
      grossAGI: clientData.grossAGI,
      netBusinessProfit: netProfit,
      clientAge: clientData.clientAge,
      spouseAge,
      filingStatus: clientData.filingStatus,
      householdSize,
      entityBasis: targetBasis,
      taxYear,
    });
    if (targetBasis === 'scorp') {
      setScorpW2Wages(realistic.scorpW2Wages);
    }
    setCustomSoloEmployee(realistic.soloEmployee);
    setCustomSoloEmployer(realistic.soloEmployer);
    setCustomSepContribution(realistic.sepContribution);
    setStackClientTradIra(realistic.stackClientIra);
    setCustomClientIraAmount(realistic.clientIraAmount);
    setStackSpousalIra(realistic.stackSpouseIra);
    setCustomSpouseIraAmount(realistic.spouseIraAmount);
  };

  useEffect(() => {
    const nextKey = `${netProfit}|${clientData.grossAGI}|${clientData.clientAge}|${spouseAge}|${clientData.filingStatus}|${householdSize}|${taxYear}`;
    if (nextKey !== prevReseedKeyRef.current) {
      prevReseedKeyRef.current = nextKey;
      applyRealisticDefaults(entityBasis);
    }
  });

  // Calculate strategy results in real-time (strictly guarded at >= 138% FPL floor)
  const strategyResult = calculateSelfEmployedAcaStrategy({
    grossAGI: clientData.grossAGI,
    netBusinessProfit: netProfit,
    clientAge: clientData.clientAge,
    filingStatus: clientData.filingStatus,
    householdSize,
    selectedVehicle,
    entityBasis,
    scorpW2Wages: entityBasis === 'scorp' ? scorpW2Wages : undefined,
    customSoloEmployee: selectedVehicle === 'sep_ira' ? 0 : customSoloEmployee,
    customSoloEmployer: selectedVehicle === 'sep_ira' ? 0 : customSoloEmployer,
    customSepContribution: selectedVehicle === 'sep_ira' ? customSepContribution : 0,
    stackClientTradIra,
    customClientIraAmount,
    stackSpousalIra: isMarried && stackSpousalIra,
    customSpouseIraAmount,
    spouseAge,
    spouseCoveredByPlan: spouseCovered,
    taxYear,
    carrierId: activeCarrier,
  });

  const { limits } = strategyResult;

  // Keep raw slider state aligned with calculated 138% FPL & statutory caps whenever profit/W-2/caps shrink
  useEffect(() => {
    setCustomSoloEmployee((prev) => Math.min(prev, limits.soloEmployeeMax, strategyResult.maxSafeDeductionBudget));
    setCustomSoloEmployer((prev) => Math.min(prev, limits.soloEmployerMax, strategyResult.maxSafeDeductionBudget));
    setCustomSepContribution((prev) => Math.min(prev, limits.sepIraMax, strategyResult.maxSafeDeductionBudget));
  }, [limits.soloEmployeeMax, limits.soloEmployerMax, limits.sepIraMax, strategyResult.maxSafeDeductionBudget]);

  useEffect(() => {
    const clientCap = getIRSLimitForAge(clientData.clientAge);
    const spouseCap = getIRSLimitForAge(spouseAge);
    setCustomClientIraAmount((prev) => Math.min(prev, clientCap));
    setCustomSpouseIraAmount((prev) => Math.min(prev, spouseCap));
  }, [clientData.clientAge, spouseAge]);

  // Live per-slider 138% FPL safe caps (remaining headroom + current slider value)
  const soloEmployeeSafeCap = Math.min(
    strategyResult.solo401kEmployeeMax,
    Math.max(0, strategyResult.solo401kMaxTotal - strategyResult.activeSoloEmployer),
    Math.max(
      0,
      strategyResult.maxSafeDeductionBudget -
        strategyResult.activeSoloEmployer -
        strategyResult.clientIraDeductible -
        strategyResult.spouseIraDeductible
    )
  );
  const soloEmployerSafeCap = Math.min(
    strategyResult.solo401kEmployerMax,
    Math.max(0, strategyResult.solo401kMaxTotal - strategyResult.activeSoloEmployee),
    Math.max(
      0,
      strategyResult.maxSafeDeductionBudget -
        strategyResult.activeSoloEmployee -
        strategyResult.clientIraDeductible -
        strategyResult.spouseIraDeductible
    )
  );
  const sepIraSafeCap = Math.min(
    strategyResult.sepIraMax,
    Math.max(
      0,
      strategyResult.maxSafeDeductionBudget -
        strategyResult.clientIraDeductible -
        strategyResult.spouseIraDeductible
    )
  );
  const clientIraSafeCap = Math.min(
    strategyResult.traditionalIraStatLimit,
    Math.max(
      0,
      strategyResult.maxSafeDeductionBudget -
        strategyResult.activePrimaryPlanContribution -
        strategyResult.spouseIraDeductible
    )
  );
  const spouseIraSafeCap = Math.min(
    strategyResult.spousalIraStatLimit,
    Math.max(
      0,
      strategyResult.maxSafeDeductionBudget -
        strategyResult.activePrimaryPlanContribution -
        strategyResult.clientIraDeductible
    )
  );

  // Switch Entity Tax Basis & re-seed realistic defaults cleanly
  const handleEntityBasisChange = (basis: SelfEmployedEntityBasis) => {
    SoundFX.playClick();
    setEntityBasis(basis);
    applyRealisticDefaults(basis);
  };

  // Apply 1-Click Ideal Phase-Out Fix
  const handleApplyPhaseOutFix = () => {
    SoundFX.playUnlock();
    const { idealFix } = strategyResult;
    if (selectedVehicle === 'sep_ira') {
      setCustomSepContribution(idealFix.sepContribution);
    } else {
      setCustomSoloEmployee(idealFix.soloEmployee);
      setCustomSoloEmployer(idealFix.soloEmployer);
    }
    setStackClientTradIra(idealFix.stackClientIra);
    setCustomClientIraAmount(idealFix.clientIraAmount);
    if (isMarried) {
      setStackSpousalIra(idealFix.stackSpouseIra);
      setCustomSpouseIraAmount(idealFix.spouseIraAmount);
    }
  };

  // Master Preset: Maximize ACA Savings down to the 138% FPL Medicaid-Safe Floor
  const handleApplyMaxAcaPreset = () => {
    SoundFX.playUnlock();
    const maxPreset = computeMaxAcaOptimizationPreset({
      grossAGI: clientData.grossAGI,
      netBusinessProfit: netProfit,
      clientAge: clientData.clientAge,
      spouseAge,
      filingStatus: clientData.filingStatus,
      householdSize,
      selectedVehicle,
      entityBasis,
      scorpW2Wages: entityBasis === 'scorp' ? scorpW2Wages : undefined,
      spouseCoveredByPlan: spouseCovered,
      taxYear,
    });
    if (selectedVehicle === 'sep_ira') {
      setCustomSepContribution(maxPreset.sepContribution);
    } else {
      setCustomSoloEmployee(maxPreset.soloEmployee);
      setCustomSoloEmployer(maxPreset.soloEmployer);
    }
    setStackClientTradIra(maxPreset.stackClientIra);
    setCustomClientIraAmount(maxPreset.clientIraAmount);
    if (isMarried) {
      setStackSpousalIra(maxPreset.stackSpouseIra);
      setCustomSpouseIraAmount(maxPreset.spouseIraAmount);
    }
  };

  // Live Per-Slider Next-Benefit Threshold Proximity & Jump Calculations
  const employeeThresholdJump: SliderThresholdJump | null =
    selectedVehicle !== 'sep_ira'
      ? getNextBenefitThresholdForSlider({
          sliderType: 'primary_plan',
          currentSliderValue: strategyResult.activeSoloEmployee,
          sliderSafeCap: soloEmployeeSafeCap,
          currentOptimizedAgi: strategyResult.optimizedAgi,
          grossAGI: clientData.grossAGI,
          magiAfterPrimaryPlan: strategyResult.magiAfterPrimaryPlan,
          clientAge: clientData.clientAge,
          householdSize,
          taxYear,
          clientPhaseOutStart: limits.clientPhaseOutStart,
          isClientIraActive: stackClientTradIra && customClientIraAmount > 0,
        })
      : null;

  const employerThresholdJump: SliderThresholdJump | null =
    selectedVehicle !== 'sep_ira'
      ? getNextBenefitThresholdForSlider({
          sliderType: 'primary_plan',
          currentSliderValue: strategyResult.activeSoloEmployer,
          sliderSafeCap: soloEmployerSafeCap,
          currentOptimizedAgi: strategyResult.optimizedAgi,
          grossAGI: clientData.grossAGI,
          magiAfterPrimaryPlan: strategyResult.magiAfterPrimaryPlan,
          clientAge: clientData.clientAge,
          householdSize,
          taxYear,
          clientPhaseOutStart: limits.clientPhaseOutStart,
          isClientIraActive: stackClientTradIra && customClientIraAmount > 0,
        })
      : null;

  const sepThresholdJump: SliderThresholdJump | null =
    selectedVehicle === 'sep_ira'
      ? getNextBenefitThresholdForSlider({
          sliderType: 'primary_plan',
          currentSliderValue: strategyResult.activeSepContribution,
          sliderSafeCap: sepIraSafeCap,
          currentOptimizedAgi: strategyResult.optimizedAgi,
          grossAGI: clientData.grossAGI,
          magiAfterPrimaryPlan: strategyResult.magiAfterPrimaryPlan,
          clientAge: clientData.clientAge,
          householdSize,
          taxYear,
          clientPhaseOutStart: limits.clientPhaseOutStart,
          isClientIraActive: stackClientTradIra && customClientIraAmount > 0,
        })
      : null;

  const canClientIraLowerAgi =
    strategyResult.activePrimaryPlanContribution === 0 ||
    strategyResult.magiAfterPrimaryPlan < limits.clientPhaseOutEnd;

  const clientIraThresholdJump: SliderThresholdJump | null = canClientIraLowerAgi
    ? getNextBenefitThresholdForSlider({
        sliderType: 'client_ira',
        currentSliderValue: stackClientTradIra ? strategyResult.clientIraRequested : 0,
        sliderSafeCap: clientIraSafeCap,
        currentOptimizedAgi: strategyResult.optimizedAgi,
        grossAGI: clientData.grossAGI,
        magiAfterPrimaryPlan: strategyResult.magiAfterPrimaryPlan,
        clientAge: clientData.clientAge,
        householdSize,
        taxYear,
        clientPhaseOutStart: limits.clientPhaseOutStart,
        isClientIraActive: true,
      })
    : null;

  const canSpouseIraLowerAgi =
    isMarried &&
    (!spouseCovered
      ? clientData.grossAGI < limits.spousalPhaseOutEnd ||
        strategyResult.magiAfterPrimaryPlan < limits.spousalPhaseOutEnd
      : strategyResult.magiAfterPrimaryPlan < limits.clientPhaseOutEnd);

  const spouseIraThresholdJump: SliderThresholdJump | null = canSpouseIraLowerAgi
    ? getNextBenefitThresholdForSlider({
        sliderType: 'spouse_ira',
        currentSliderValue: stackSpousalIra ? strategyResult.spouseIraRequested : 0,
        sliderSafeCap: spouseIraSafeCap,
        currentOptimizedAgi: strategyResult.optimizedAgi,
        grossAGI: clientData.grossAGI,
        magiAfterPrimaryPlan: strategyResult.magiAfterPrimaryPlan,
        clientAge: clientData.clientAge,
        householdSize,
        taxYear,
        clientPhaseOutStart: limits.clientPhaseOutStart,
        isClientIraActive: false,
      })
    : null;

  // Publish live StrategySnapshot for Booking / Summary Modal (deduplicated)
  useEffect(() => {
    if (!onUpdateStrategySnapshot) return;
    const carrierObj =
      REGIONAL_HEALTH_CARRIERS.find((c) => c.id === activeCarrier) || REGIONAL_HEALTH_CARRIERS[0];
    const vehicleLabel =
      selectedVehicle === 'sep_ira' ? 'SEP-IRA Annuity' : 'Solo 401(k) + Stacked IRAs';
    const basisLabel =
      entityBasis === 'schedule_c'
        ? 'Sole Prop / Single-Member LLC (Schedule C)'
        : 'S-Corp / LLC Taxed as S-Corp (W-2)';

    const sliders: Array<{ label: string; value: string }> = [
      { label: 'Selected Retirement Vehicle', value: vehicleLabel },
      { label: 'Entity Tax Classification', value: basisLabel },
      {
        label: entityBasis === 'schedule_c' ? 'Net Schedule C / 1099 Profit' : 'Total S-Corp Business Profit',
        value: `$${netProfit.toLocaleString()}/yr`,
      },
    ];

    if (entityBasis === 'scorp') {
      sliders.push({
        label: 'S-Corp Officer W-2 Salary',
        value: `$${limits.w2Compensation.toLocaleString()}/yr (K-1: $${limits.k1Distribution.toLocaleString()})`,
      });
    }

    if (selectedVehicle === 'sep_ira') {
      sliders.push({
        label: 'SEP-IRA Employer Contribution',
        value: `$${strategyResult.activeSepContribution.toLocaleString()}/yr ($${Math.round(strategyResult.activeSepContribution / 12).toLocaleString()}/mo)`,
      });
    } else {
      sliders.push(
        {
          label: 'Solo 401(k) Employee Deferral',
          value: `$${strategyResult.activeSoloEmployee.toLocaleString()}/yr ($${Math.round(strategyResult.activeSoloEmployee / 12).toLocaleString()}/mo)`,
        },
        {
          label: 'Solo 401(k) Employer Profit Share',
          value: `$${strategyResult.activeSoloEmployer.toLocaleString()}/yr ($${Math.round(strategyResult.activeSoloEmployer / 12).toLocaleString()}/mo)`,
        }
      );
    }

    sliders.push({
      label: 'Client Traditional IRA',
      value: stackClientTradIra
        ? `$${strategyResult.clientIraRequested.toLocaleString()} allocated ($${strategyResult.clientIraDeductible.toLocaleString()} deductible)`
        : 'Disabled ($0)',
    });

    if (isMarried) {
      sliders.push({
        label: 'Spousal IRA (IRC § 219(g)(7))',
        value: stackSpousalIra
          ? `$${strategyResult.spouseIraRequested.toLocaleString()} allocated ($${strategyResult.spouseIraDeductible.toLocaleString()} deductible; spouse 401k: ${spouseCovered ? 'Yes' : 'No'})`
          : 'Disabled ($0)',
      });
    }
    sliders.push({ label: 'Selected Regional Carrier', value: carrierObj.name });

    const nextSnapshot: ActiveStrategySnapshot = {
      pathId: 'self_employed_aca',
      pathLabel: 'Self-Employed ACA Optimizer',
      summaryHeadline: `${vehicleLabel} delivering $${strategyResult.totalPreTaxDeduction.toLocaleString()} Schedule 1 deduction`,
      selectedCarrierOrVendor: carrierObj.name,
      selectedTierOrOption: `${vehicleLabel} · ${strategyResult.optimizedAca.csrLevel}`,
      sliders,
      impactMetrics: [
        { label: 'Total Pre-Tax Deduction', value: `$${strategyResult.totalPreTaxDeduction.toLocaleString()}/yr` },
        {
          label: 'Baseline AGI -> Optimized ACA MAGI',
          value: `$${clientData.grossAGI.toLocaleString()} -> $${strategyResult.optimizedAgi.toLocaleString()}`,
        },
        {
          label: 'FPL Shift (138% Floor Enforced)',
          value: `${strategyResult.baselineFplPct}% -> ${strategyResult.optimizedFplPct}% FPL`,
        },
        {
          label: 'Net Monthly ACA Premium',
          value: `$${strategyResult.optimizedSilverTier.monthlyPremium}/mo (+$${strategyResult.monthlySubsidyGain.toLocaleString()}/mo APTC boost)`,
        },
        {
          label: 'Qualified CSR Tier & Deductible',
          value: `${strategyResult.optimizedAca.csrLevel} ($${strategyResult.optimizedSilverTier.deductible.toLocaleString()} ded)`,
        },
        {
          label: 'Est. Annual ACA Subsidy + Tax Benefit',
          value: `$${strategyResult.totalAnnualBenefit.toLocaleString()}/yr`,
        },
      ],
    };

    const serialized = JSON.stringify(nextSnapshot);
    if (serialized === lastSnapshotJsonRef.current) return;
    lastSnapshotJsonRef.current = serialized;
    onUpdateStrategySnapshot(nextSnapshot);
  }, [
    onUpdateStrategySnapshot,
    activeCarrier,
    taxYear,
    selectedVehicle,
    entityBasis,
    netProfit,
    limits.w2Compensation,
    limits.k1Distribution,
    strategyResult.activeSepContribution,
    strategyResult.activeSoloEmployee,
    strategyResult.activeSoloEmployer,
    stackClientTradIra,
    stackSpousalIra,
    spouseCovered,
    isMarried,
    clientData.grossAGI,
    strategyResult.clientIraRequested,
    strategyResult.clientIraDeductible,
    strategyResult.spouseIraRequested,
    strategyResult.spouseIraDeductible,
    strategyResult.totalPreTaxDeduction,
    strategyResult.optimizedAgi,
    strategyResult.baselineFplPct,
    strategyResult.optimizedFplPct,
    strategyResult.optimizedSilverTier.monthlyPremium,
    strategyResult.optimizedSilverTier.deductible,
    strategyResult.optimizedAca.csrLevel,
    strategyResult.monthlySubsidyGain,
    strategyResult.totalAnnualBenefit,
  ]);

  // Mount & update 5-Year Chart cleanly only while Impact section is expanded
  useEffect(() => {
    if (!isImpactExpanded) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const years = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
    const annualDeduction = strategyResult.totalPreTaxDeduction;
    const annualHealthSubsidy = strategyResult.annualSubsidyGain;
    const annualTaxSavings = strategyResult.annualTaxSavings;

    let cumulativeWealth = 0;
    const wealthData: number[] = [];
    const cumulativeBenefitData: number[] = [];
    let cumulativeBenefit = 0;

    for (let i = 1; i <= 5; i++) {
      cumulativeWealth = (cumulativeWealth + annualDeduction) * 1.055;
      cumulativeBenefit += annualHealthSubsidy + annualTaxSavings;
      wealthData.push(Math.round(cumulativeWealth));
      cumulativeBenefitData.push(Math.round(cumulativeBenefit));
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.data.labels = years;
      chartInstanceRef.current.data.datasets[0].data = wealthData;
      chartInstanceRef.current.data.datasets[1].data = cumulativeBenefitData;
      chartInstanceRef.current.update('none');
      return;
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Tax-Deferred Annuity Wealth ($)',
            data: wealthData,
            backgroundColor: 'rgba(168, 85, 247, 0.7)',
            borderColor: '#c084fc',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Cumulative ACA Subsidies + Tax Saved ($)',
            data: cumulativeBenefitData,
            backgroundColor: 'rgba(52, 211, 153, 0.7)',
            borderColor: '#34d399',
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#cbd5e1',
              font: { size: 11, weight: 'bold' },
              boxWidth: 14,
            },
          },
          tooltip: {
            backgroundColor: '#0b1120',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: $${(context.raw as number).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: (value) => `$${(Number(value) / 1000).toFixed(0)}k`,
            },
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
          },
        },
      },
    });
  }, [
    isImpactExpanded,
    strategyResult.totalPreTaxDeduction,
    strategyResult.annualSubsidyGain,
    strategyResult.annualTaxSavings,
  ]);

  // Destroy Chart cleanly on component unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  const handleProfitChange = (val: number) => {
    const clean = Math.max(0, Math.min(500000, Math.round(val)));
    SoundFX.playSlideHum(0.3);
    onChangeClientData({ netSelfEmploymentProfit: clean });
  };

  // Dynamic Recommendation Strings
  const gapTo150Fpl = Math.max(0, strategyResult.optimizedAgi - strategyResult.target150FplAgi);
  const gapTo400Cliff = Math.max(0, strategyResult.optimizedAgi - strategyResult.cliff400FplAgi);

  const w2ProfitPct =
    netProfit > 0 ? Math.round((limits.w2Compensation / netProfit) * 100) : 0;
  const deferralPctOfW2 =
    limits.w2Compensation > 0
      ? Math.round((strategyResult.activeSoloEmployee / limits.w2Compensation) * 100)
      : 0;

  const singleStartK = taxYear === '2026' ? '$81,000' : '$83,000';
  const singleEndK = taxYear === '2026' ? '$91,000' : '$93,000';
  const mfjStartK = taxYear === '2026' ? '$129,000' : '$133,000';
  const mfjEndK = taxYear === '2026' ? '$149,000' : '$153,000';
  const spousalStartK = taxYear === '2026' ? '$242,000' : '$250,000';
  const spousalEndK = taxYear === '2026' ? '$252,000' : '$260,000';

  const combinedSoloRequested = customSoloEmployee + customSoloEmployer;
  const soloCapClamped = selectedVehicle !== 'sep_ira' && combinedSoloRequested > limits.solo401kMaxTotal;

  // Helper to render the itemized Personal AGI Reduction Waterfall card
  const renderAgiWaterfallCard = (fullWidth: boolean) => {
    const monthlyCombined = Math.round(strategyResult.totalPreTaxDeduction / 12);
    return (
      <div
        className={`p-4 sm:p-5 rounded-xl bg-navy-900/70 border border-emerald-500/35 space-y-3 flex flex-col justify-between ${
          fullWidth ? 'md:col-span-2' : ''
        }`}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-700/80 pb-2">
            <span className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
              <i className="fa-solid fa-layer-group"></i> Personal AGI Reduction Waterfall
            </span>
            <span className="text-[10.5px] font-semibold text-slate-300 tabular-nums">
              138% Safe Floor: ${strategyResult.acaSafeFloor138.toLocaleString()}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span>1. Starting Gross AGI ({strategyResult.baselineFplPct}% FPL)</span>
              <span className="font-bold text-white tabular-nums">
                ${clientData.grossAGI.toLocaleString()}
              </span>
            </div>

            {selectedVehicle !== 'sep_ira' ? (
              <>
                <div className="flex justify-between items-center text-purple-300">
                  <span>
                    2a. {entityBasis === 'scorp' ? 'S-Corp W-2' : 'LLC / Sched C'} Employee Deferral
                  </span>
                  <span className="font-bold tabular-nums">
                    -${strategyResult.activeSoloEmployee.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-purple-300">
                  <span>
                    2b. {entityBasis === 'scorp' ? 'S-Corp (25% W-2)' : 'LLC (20% Net)'} Employer Share
                  </span>
                  <span className="font-bold tabular-nums">
                    -${strategyResult.activeSoloEmployer.toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center text-purple-300">
                <span>
                  2. {entityBasis === 'scorp' ? 'S-Corp' : 'LLC / Sched C'} SEP-IRA Deduction
                </span>
                <span className="font-bold tabular-nums">
                  -${strategyResult.activeSepContribution.toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-slate-300 pt-0.5 border-t border-navy-800/80">
              <span>Intermediate MAGI (Active-Participant Test)</span>
              <span className="font-semibold text-slate-200 tabular-nums">
                ${Math.round(strategyResult.magiAfterPrimaryPlan).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center text-gold-300">
              <span>3. Client Deductible Traditional IRA</span>
              <span className="font-bold tabular-nums">
                -${strategyResult.clientIraDeductible.toLocaleString()}
              </span>
            </div>

            {isMarried && (
              <div className="flex justify-between items-center text-rose-300">
                <span>4. Spousal Deductible IRA (IRC § 219(g)(7))</span>
                <span className="font-bold tabular-nums">
                  -${strategyResult.spouseIraDeductible.toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-emerald-500/40 text-sm">
              <span className="font-extrabold text-white">Final Projected ACA MAGI</span>
              <span className="font-black text-emerald-400 tabular-nums">
                ${strategyResult.optimizedAgi.toLocaleString()} ({strategyResult.optimizedFplPct}% FPL)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-navy-950/90 border border-navy-700/80 rounded-lg px-3 py-2 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            Funding Pace:{' '}
            <strong className="text-emerald-300 tabular-nums">${monthlyCombined.toLocaleString()}/mo</strong>{' '}
            or{' '}
            <strong className="text-white tabular-nums">
              ${strategyResult.totalPreTaxDeduction.toLocaleString()}
            </strong>{' '}
            total
          </span>
          <span className="text-cyan-300 font-semibold tabular-nums">
            {strategyResult.isAtAcaSafeFloor
              ? 'At 138% Safe Floor'
              : `$${strategyResult.remainingSafeBudget.toLocaleString()} safe headroom left`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Compact Hero Header Banner */}
      <section className="glass-card p-6 sm:p-7 border-l-4 border-l-purple-500 glow-purple">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-extrabold uppercase tracking-wider border border-purple-500/30 mb-2">
              <i className="fa-solid fa-briefcase"></i> Self-Employed ACA Optimization Suite ({taxYear} IRS Limits)
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              Solo 401(k), SEP-IRA &amp; Pre-Tax Health Optimization
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Fiduciary architecture designed specifically for 1099 contractors, LLC owners, and S-Corp shareholder-employees.
              Legally reduce Form 1040 Schedule 1 AGI to target maximum Silver CSR benefits while strictly respecting the 138% FPL Medicaid-safe ACA floor.
            </p>
          </div>

          <div className="bg-navy-950 px-4 py-3 rounded-xl border border-purple-500/30 text-left lg:text-right shrink-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Max Annual Pre-Tax Capacity ({taxYear})
            </span>
            <span className="text-sm sm:text-base font-extrabold text-purple-300 tabular-nums">
              $
              {(
                strategyResult.solo401kMaxTotal +
                strategyResult.traditionalIraStatLimit +
                (isMarried ? strategyResult.spousalIraStatLimit : 0)
              ).toLocaleString()}{' '}
              / yr
            </span>
          </div>
        </div>
      </section>

      {/* Main Interactive Optimization Sandbox */}
      <section className="glass-card p-6 sm:p-8 border-l-4 border-l-blue-500 glow-blue space-y-6">
        <div className="space-y-3 border-b border-navy-700/60 pb-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                <i className="fa-solid fa-sliders text-blue-400"></i> Qualified Retirement Vehicle &amp; Deduction Controls
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Adjust earnings, choose your LLC/entity tax classification, and fine-tune contributions safely above the 138% FPL floor.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
              {/* Plain-Language Entity Tax Classification Toggle */}
              <div className="flex items-center gap-1 p-1 bg-navy-950 rounded-xl border border-navy-700">
                <button
                  type="button"
                  onClick={() => handleEntityBasisChange('schedule_c')}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    entityBasis === 'schedule_c'
                      ? 'bg-gold-500 text-navy-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sole Prop / Single-Member LLC (Sched C)
                </button>
                <button
                  type="button"
                  onClick={() => handleEntityBasisChange('scorp')}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    entityBasis === 'scorp'
                      ? 'bg-gold-500 text-navy-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  S-Corp / LLC Taxed as S-Corp (W-2)
                </button>
              </div>

              {/* Vehicle Selector Tabs */}
              <div className="flex items-center gap-1 p-1 bg-navy-950 rounded-xl border border-navy-700">
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setSelectedVehicle('stacked_solo');
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedVehicle === 'stacked_solo'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Solo 401(k) + IRA Stack
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setSelectedVehicle('sep_ira');
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedVehicle === 'sep_ira'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  SEP-IRA Annuity
                </button>
              </div>
            </div>
          </div>

          {/* Plain-English LLC Guidance Bar + Preset Optimization Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-navy-950/70 border border-navy-700/80 rounded-xl px-3.5 py-2.5 text-[11px] text-slate-300">
            <span>
              <strong className="text-gold-400">Which tab fits an LLC?</strong> Standard 1-owner LLCs &amp; 1099 sole proprietors file on{' '}
              <strong>Schedule C</strong>. Select <strong>S-Corp (W-2)</strong> only if you filed Form 2553 to pay yourself W-2 officer wages + K-1 distributions.
            </span>
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  SoundFX.playUnlock();
                  applyRealisticDefaults(entityBasis);
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 font-bold text-[11px] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <i className="fa-solid fa-rotate-left mr-1"></i> Reset to 150% FPL Target
              </button>
              <button
                type="button"
                onClick={handleApplyMaxAcaPreset}
                disabled={strategyResult.isAtAcaSafeFloor || clientData.grossAGI <= strategyResult.acaSafeFloor138}
                className={`px-3 py-1.5 rounded-lg font-extrabold text-[11px] whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${
                  strategyResult.isAtAcaSafeFloor || clientData.grossAGI <= strategyResult.acaSafeFloor138
                    ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-300/70 cursor-default'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-navy-950 shadow-md shadow-emerald-500/20 cursor-pointer'
                }`}
              >
                <i className="fa-solid fa-bolt"></i>{' '}
                {strategyResult.isAtAcaSafeFloor
                  ? 'Maxed at 138% FPL Floor'
                  : 'Maximize ACA (138% FPL Floor)'}
              </button>
            </div>
          </div>
        </div>

        {/* Diagnostic Input: Net Business Profit ($500 increments supported cleanly) */}
        <div className="bg-navy-950/80 p-5 rounded-2xl border border-navy-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-white flex items-center gap-2">
                <i className="fa-solid fa-cash-register text-gold-400"></i>{' '}
                {entityBasis === 'schedule_c'
                  ? 'Net Self-Employment Profit (Schedule C / Single-Member LLC):'
                  : 'Total S-Corp Net Business Profit (Before Officer W-2 Salary & K-1 Split):'}
              </span>
              <p className="text-[11px] text-slate-400">
                {entityBasis === 'schedule_c'
                  ? `Deducts ½ SE tax (-$${limits.halfSeTax.toLocaleString()} → $${limits.earnedIncomeBase.toLocaleString()} plan base) before the 20% employer cap.`
                  : `Your total S-Corp profit splits into W-2 Officer Wages ($${limits.w2Compensation.toLocaleString()}) + K-1 Distribution ($${limits.k1Distribution.toLocaleString()}).`}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-navy-900 px-3 py-1.5 rounded-xl border border-gold-500/40 self-start sm:self-auto">
              <span className="text-gold-400 font-extrabold text-xs">$</span>
              <input
                type="number"
                min="0"
                max="500000"
                step="500"
                value={netProfit}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleProfitChange(Number.isNaN(val) ? 0 : val);
                }}
                className="w-28 bg-transparent text-gold-400 font-black text-sm focus:outline-none text-right tabular-nums"
              />
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="300000"
            step="500"
            value={Math.min(300000, netProfit)}
            onChange={(e) => handleProfitChange(parseFloat(e.target.value) || 0)}
            className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 tabular-nums">
            <span>$0</span>
            <span>$75,000</span>
            <span>$150,000 ($500 steps)</span>
            <span>$225,000</span>
            <span>$300,000+</span>
          </div>

          {/* Profit Slider Recommendation */}
          <div className="bg-navy-900/70 border border-navy-700/70 rounded-lg px-3 py-2 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-gold-300">ACA Planning Window:</strong> Safe ACA Floor (138% FPL) ={' '}
              <strong className="text-white tabular-nums">${strategyResult.acaSafeFloor138.toLocaleString()}</strong> · Optimal Silver CSR Target (150% FPL) ={' '}
              <strong className="text-emerald-300 tabular-nums">${strategyResult.target150FplAgi.toLocaleString()}</strong>
            </span>
            <span className="text-slate-400 tabular-nums">
              Max Safe Deduction Room: ${strategyResult.maxSafeDeductionBudget.toLocaleString()}/yr
            </span>
          </div>
        </div>

        {/* Notice if Baseline AGI is already <= 138% FPL */}
        {clientData.grossAGI <= strategyResult.acaSafeFloor138 && (
          <div className="bg-amber-500/15 border border-amber-400/50 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-2.5">
            <i className="fa-solid fa-shield-halved text-amber-400 mt-0.5 shrink-0"></i>
            <span>
              <strong>138% FPL Minimum Guard Active:</strong> Your Baseline Gross AGI (${clientData.grossAGI.toLocaleString()}) is already at or below the 138% FPL ACA safe floor (${strategyResult.acaSafeFloor138.toLocaleString()}). Sliders are locked at $0 additional ACA MAGI reduction so you do not inadvertently trigger Medicaid displacement.
            </span>
          </div>
        )}

        {/* Sliders Grid depending on Selected Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {selectedVehicle !== 'sep_ira' ? (
            <>
              {/* Solo 401(k) Employee Deferral (+ Nested S-Corp W-2 Salary Slider when in S-Corp mode) */}
              <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-700 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs gap-2">
                    <div>
                      <span className="font-bold text-white block">Solo 401(k) Employee Deferral:</span>
                      <span className="text-[10.5px] text-slate-400">
                        ${limits.baseElectiveDeferral.toLocaleString()} {taxYear} base
                        {limits.isSuperCatchUp
                          ? ` + $${limits.superCatchUp.toLocaleString()} SECURE 2.0 (Age 60–63)`
                          : limits.catchUpCap > 0
                          ? ` + $${limits.catchUpCap.toLocaleString()} Catch-up (50+)`
                          : ' (Under 50)'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-purple-400 font-black text-sm tabular-nums block">
                        ${strategyResult.activeSoloEmployee.toLocaleString()}
                      </span>
                      {soloEmployeeSafeCap < strategyResult.solo401kEmployeeMax && (
                        <span className="text-[10px] text-cyan-300 font-semibold tabular-nums">
                          138% Safe Max: ${soloEmployeeSafeCap.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(100, strategyResult.solo401kEmployeeMax)}
                    step="100"
                    value={Math.min(strategyResult.activeSoloEmployee, strategyResult.solo401kEmployeeMax)}
                    onChange={(e) => {
                      const requested = parseFloat(e.target.value) || 0;
                      const clamped = Math.min(requested, soloEmployeeSafeCap);
                      SoundFX.playSlideHum(0.2);
                      setCustomSoloEmployee(clamped);
                    }}
                    className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />

                  {/* S-Corp Officer W-2 Salary Allocation Slider (Omitted cleanly in Schedule C mode) */}
                  {entityBasis === 'scorp' && (
                    <div className="mt-2 pt-3 border-t border-navy-800 space-y-2 bg-navy-900/50 p-3 rounded-lg">
                      <div className="flex justify-between items-center text-[11px] gap-2">
                        <div>
                          <span className="font-bold text-gold-300 block">
                            S-Corp W-2 Officer Wages ({w2ProfitPct}% of Profit):
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Only W-2 wages qualify for Solo 401(k); remaining ${limits.k1Distribution.toLocaleString()} stays K-1 profit.
                          </span>
                        </div>
                        <span className="text-gold-400 font-black tabular-nums shrink-0">
                          ${limits.w2Compensation.toLocaleString()}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(500, netProfit)}
                        step="500"
                        value={Math.min(scorpW2Wages, netProfit)}
                        onChange={(e) => {
                          SoundFX.playSlideHum(0.15);
                          setScorpW2Wages(parseFloat(e.target.value) || 0);
                        }}
                        className="w-full h-1.5 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-300 tabular-nums">
                        <span>Employee 401(k) = {deferralPctOfW2}% of W-2</span>
                        <span>25% Employer Cap = ${limits.soloEmployerMax.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Threshold Proximity Indicator + Per-Slider Next-Benefit Jump */}
                {employeeThresholdJump && (
                  <div
                    className={`rounded-lg px-3 py-2 border flex flex-wrap items-center justify-between gap-2 ${
                      employeeThresholdJump.isCloseProximity
                        ? 'bg-emerald-500/12 border-emerald-400/50'
                        : 'bg-cyan-500/10 border-cyan-500/35'
                    }`}
                  >
                    <div className="text-[11px] leading-snug">
                      <span
                        className={`font-extrabold ${
                          employeeThresholdJump.isCloseProximity ? 'text-emerald-300' : 'text-cyan-300'
                        }`}
                      >
                        {employeeThresholdJump.isCloseProximity ? 'Close Threshold: ' : 'Next Benefit: '}
                        {employeeThresholdJump.thresholdLabel}
                      </span>
                      <span className="block text-[10.5px] text-slate-300">
                        {employeeThresholdJump.benefitLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        SoundFX.playUnlock();
                        setCustomSoloEmployee(employeeThresholdJump.targetSliderValue);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        employeeThresholdJump.isCloseProximity
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-navy-950'
                          : 'bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200'
                      }`}
                    >
                      Jump (+${employeeThresholdJump.deltaNeeded.toLocaleString()})
                    </button>
                  </div>
                )}

                {/* Subtle Per-Slider Recommendation */}
                <div className="bg-navy-900/70 border border-navy-700/70 rounded-lg px-3 py-2 text-[11px] text-slate-300 space-y-0.5">
                  <div className="flex justify-between items-center tabular-nums">
                    <span className="text-purple-300 font-bold">
                      Pace: ${Math.round(strategyResult.activeSoloEmployee / 12).toLocaleString()}/mo
                    </span>
                    <span className="text-slate-400">
                      or ${strategyResult.activeSoloEmployee.toLocaleString()} lump sum by Dec 31
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-snug">
                    {gapTo400Cliff > 0
                      ? `Increase by $${gapTo400Cliff.toLocaleString()} across plan/IRA to cross below the 400% FPL cliff ($${strategyResult.cliff400FplAgi.toLocaleString()}) and unlock APTC.`
                      : gapTo150Fpl > 0
                      ? `Still $${gapTo150Fpl.toLocaleString()} above 150% FPL CSR target — fund steadily to prevent unexpected year-end Form 8962 subsidy clawback.`
                      : `Target met cleanly at ${strategyResult.optimizedFplPct}% FPL. Automate $${Math.round(strategyResult.activeSoloEmployee / 12).toLocaleString()}/mo payroll/owner draws to lock in ACA savings.`}
                  </p>
                </div>
              </div>

              {/* Solo 401(k) Employer Profit Sharing */}
              <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-700 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs gap-2">
                    <div>
                      <span className="font-bold text-white block">Solo 401(k) Employer Profit Share:</span>
                      <span className="text-[10.5px] text-slate-400">
                        Up to {entityBasis === 'schedule_c' ? '20% after ½ SE tax' : '25% of W-2 wages'} (Max $
                        {strategyResult.solo401kEmployerMax.toLocaleString()} · § 415(c) ${limits.section415cCap.toLocaleString()} cap)
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-purple-400 font-black text-sm tabular-nums block">
                        ${strategyResult.activeSoloEmployer.toLocaleString()}
                      </span>
                      {soloEmployerSafeCap < strategyResult.solo401kEmployerMax && (
                        <span className="text-[10px] text-cyan-300 font-semibold tabular-nums">
                          138% Safe Max: ${soloEmployerSafeCap.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(100, strategyResult.solo401kEmployerMax)}
                    step="100"
                    value={Math.min(strategyResult.activeSoloEmployer, strategyResult.solo401kEmployerMax)}
                    onChange={(e) => {
                      const requested = parseFloat(e.target.value) || 0;
                      const clamped = Math.min(requested, soloEmployerSafeCap);
                      SoundFX.playSlideHum(0.2);
                      setCustomSoloEmployer(clamped);
                    }}
                    className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Threshold Proximity Indicator + Per-Slider Next-Benefit Jump */}
                {employerThresholdJump && (
                  <div
                    className={`rounded-lg px-3 py-2 border flex flex-wrap items-center justify-between gap-2 ${
                      employerThresholdJump.isCloseProximity
                        ? 'bg-emerald-500/12 border-emerald-400/50'
                        : 'bg-cyan-500/10 border-cyan-500/35'
                    }`}
                  >
                    <div className="text-[11px] leading-snug">
                      <span
                        className={`font-extrabold ${
                          employerThresholdJump.isCloseProximity ? 'text-emerald-300' : 'text-cyan-300'
                        }`}
                      >
                        {employerThresholdJump.isCloseProximity ? 'Close Threshold: ' : 'Next Benefit: '}
                        {employerThresholdJump.thresholdLabel}
                      </span>
                      <span className="block text-[10.5px] text-slate-300">
                        {employerThresholdJump.benefitLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        SoundFX.playUnlock();
                        setCustomSoloEmployer(employerThresholdJump.targetSliderValue);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        employerThresholdJump.isCloseProximity
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-navy-950'
                          : 'bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200'
                      }`}
                    >
                      Jump (+${employerThresholdJump.deltaNeeded.toLocaleString()})
                    </button>
                  </div>
                )}

                {/* Subtle Per-Slider Recommendation */}
                <div className="bg-navy-900/70 border border-navy-700/70 rounded-lg px-3 py-2 text-[11px] text-slate-300 space-y-0.5">
                  <div className="flex justify-between items-center tabular-nums">
                    <span className="text-purple-300 font-bold">
                      Reserve: ${Math.round(strategyResult.activeSoloEmployer / 12).toLocaleString()}/mo
                    </span>
                    <span className="text-slate-400">
                      or ${strategyResult.activeSoloEmployer.toLocaleString()} by tax deadline
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-snug">
                    Employer profit-sharing can be trued up until your tax filing deadline (Apr 15 / Oct 15)—ideal for adjusting final MAGI so you don&apos;t exceed ACA income estimates.
                  </p>
                </div>
              </div>

              {soloCapClamped && (
                <div className="md:col-span-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3.5 py-2 flex items-center gap-2">
                  <i className="fa-solid fa-circle-info text-amber-400 shrink-0"></i>
                  <span>
                    Combined Solo 401(k) contributions are capped at the IRS § 415(c) ceiling of{' '}
                    <strong>${limits.solo401kMaxTotal.toLocaleString()}</strong> for {taxYear}.
                  </span>
                </div>
              )}
            </>
          ) : (
            /* SEP-IRA Employer Contribution */
            <div className="md:col-span-2 bg-navy-950/80 p-5 rounded-xl border border-navy-700 space-y-3">
              <div className="flex justify-between items-center text-xs gap-2">
                <div>
                  <span className="font-bold text-white block text-sm">SEP-IRA Annuity Employer Contribution:</span>
                  <span className="text-[11px] text-slate-400">
                    Funded 100% by employer profit sharing (Capped at{' '}
                    {entityBasis === 'schedule_c' ? '20% after ½ SE tax' : '25% of W-2 wages'} or $
                    {limits.section415cCap.toLocaleString()} {taxYear} max; no catch-up permitted).
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-purple-400 font-black text-base tabular-nums block">
                    ${strategyResult.activeSepContribution.toLocaleString()}
                  </span>
                  {sepIraSafeCap < strategyResult.sepIraMax && (
                    <span className="text-[10px] text-cyan-300 font-semibold tabular-nums">
                      138% Safe Max: ${sepIraSafeCap.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(100, strategyResult.sepIraMax)}
                step="100"
                value={Math.min(strategyResult.activeSepContribution, strategyResult.sepIraMax)}
                onChange={(e) => {
                  const requested = parseFloat(e.target.value) || 0;
                  const clamped = Math.min(requested, sepIraSafeCap);
                  SoundFX.playSlideHum(0.2);
                  setCustomSepContribution(clamped);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />

              {entityBasis === 'scorp' && (
                <div className="pt-3 border-t border-navy-800 space-y-2 bg-navy-900/50 p-3 rounded-lg">
                  <div className="flex justify-between items-center text-[11px] gap-2">
                    <span className="font-bold text-gold-300">
                      S-Corp W-2 Officer Wages ({w2ProfitPct}% of Profit · Sets 25% SEP Limit):
                    </span>
                    <span className="text-gold-400 font-black tabular-nums">
                      ${limits.w2Compensation.toLocaleString()} (K-1: ${limits.k1Distribution.toLocaleString()})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(500, netProfit)}
                    step="500"
                    value={Math.min(scorpW2Wages, netProfit)}
                    onChange={(e) => {
                      SoundFX.playSlideHum(0.15);
                      setScorpW2Wages(parseFloat(e.target.value) || 0);
                    }}
                    className="w-full h-1.5 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
                  />
                </div>
              )}

              {/* Threshold Proximity Indicator + Per-Slider Next-Benefit Jump */}
              {sepThresholdJump && (
                <div
                  className={`rounded-lg px-3 py-2 border flex flex-wrap items-center justify-between gap-2 ${
                    sepThresholdJump.isCloseProximity
                      ? 'bg-emerald-500/12 border-emerald-400/50'
                      : 'bg-cyan-500/10 border-cyan-500/35'
                  }`}
                >
                  <div className="text-[11px] leading-snug">
                    <span
                      className={`font-extrabold ${
                        sepThresholdJump.isCloseProximity ? 'text-emerald-300' : 'text-cyan-300'
                      }`}
                    >
                      {sepThresholdJump.isCloseProximity ? 'Close Threshold: ' : 'Next Benefit: '}
                      {sepThresholdJump.thresholdLabel}
                    </span>
                    <span className="block text-[10.5px] text-slate-300">
                      {sepThresholdJump.benefitLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      SoundFX.playUnlock();
                      setCustomSepContribution(sepThresholdJump.targetSliderValue);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      sepThresholdJump.isCloseProximity
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-navy-950'
                        : 'bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200'
                    }`}
                  >
                    Jump (+${sepThresholdJump.deltaNeeded.toLocaleString()})
                  </button>
                </div>
              )}

              {/* Subtle Per-Slider Recommendation */}
              <div className="bg-navy-900/70 border border-navy-700/70 rounded-lg px-3 py-2 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-purple-300 tabular-nums">
                    Pace: ${Math.round(strategyResult.activeSepContribution / 12).toLocaleString()}/mo
                  </strong>{' '}
                  or{' '}
                  <strong className="text-white tabular-nums">
                    ${strategyResult.activeSepContribution.toLocaleString()}
                  </strong>{' '}
                  lump sum by tax filing deadline (+ extensions)
                </span>
                <span className="text-[10.5px] text-slate-400">
                  {gapTo150Fpl > 0
                    ? `$${gapTo150Fpl.toLocaleString()} left to 150% FPL CSR target`
                    : `Locked at ${strategyResult.optimizedFplPct}% FPL`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Stacked Individual & Spousal IRA Sub-section + Personal AGI Reduction Waterfall */}
        <div className="bg-navy-950/60 p-5 rounded-2xl border border-navy-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-navy-800 pb-3">
            <div>
              <h4 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-layer-group"></i> Stacked Individual &amp; Spousal Traditional IRAs + Personal AGI Waterfall
              </h4>
              <p className="text-[11px] text-slate-400">
                Exact $100 steps up to ${strategyResult.traditionalIraStatLimit.toLocaleString()} ({clientData.clientAge >= 50 ? '50+ Catch-Up Included' : 'Under 50 Limit'}), guarded strictly at 138% FPL.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stackClientTradIra}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setStackClientTradIra(checked);
                    if (checked && customClientIraAmount === 0 && clientIraSafeCap > 0) {
                      setCustomClientIraAmount(clientIraSafeCap);
                    }
                  }}
                  className="rounded border-navy-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                Stack Client IRA (${strategyResult.traditionalIraStatLimit.toLocaleString()})
              </label>
              {isMarried && (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stackSpousalIra}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setStackSpousalIra(checked);
                      if (checked && customSpouseIraAmount === 0 && spouseIraSafeCap > 0) {
                        setCustomSpouseIraAmount(spouseIraSafeCap);
                      }
                    }}
                    className="rounded border-navy-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  Stack Spousal IRA (${strategyResult.spousalIraStatLimit.toLocaleString()})
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Client IRA Card + $100-Step Slider (hits exact $7,500 / $8,600) */}
            <div className="p-4 rounded-xl bg-navy-900/60 border border-navy-700 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <i className="fa-solid fa-user text-purple-400"></i> Client Traditional IRA:
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                      !stackClientTradIra || strategyResult.clientIraRequested === 0
                        ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
                        : strategyResult.clientIraPhaseOutStatus === 'full'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : strategyResult.clientIraPhaseOutStatus === 'partial'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {!stackClientTradIra || strategyResult.clientIraRequested === 0
                      ? 'Stacking Off'
                      : strategyResult.clientIraPhaseOutStatus === 'full'
                      ? '100% Tax Deductible'
                      : strategyResult.clientIraPhaseOutStatus === 'partial'
                      ? 'Partially Phased Out'
                      : '100% Phased Out (Trap)'}
                  </span>
                </div>

                {stackClientTradIra && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] text-slate-300 gap-2">
                      <span>Contribution Allocation:</span>
                      <div className="text-right tabular-nums">
                        <span className="font-black text-purple-300">
                          ${strategyResult.clientIraRequested.toLocaleString()} / ${strategyResult.traditionalIraStatLimit.toLocaleString()}
                        </span>
                        {clientIraSafeCap < strategyResult.traditionalIraStatLimit && (
                          <span className="block text-[10px] text-cyan-300 font-semibold">
                            138% Safe Max: ${clientIraSafeCap.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={strategyResult.traditionalIraStatLimit}
                      step="100"
                      value={Math.min(strategyResult.clientIraRequested, strategyResult.traditionalIraStatLimit)}
                      onChange={(e) => {
                        const requested = parseFloat(e.target.value) || 0;
                        const clamped = Math.min(requested, clientIraSafeCap);
                        SoundFX.playSlideHum(0.15);
                        setCustomClientIraAmount(clamped);
                      }}
                      className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-baseline gap-2 text-sm font-black text-purple-300 tabular-nums">
                  <span>${strategyResult.clientIraDeductible.toLocaleString()} deductible</span>
                  {strategyResult.clientIraNonDeductible > 0 && (
                    <span className="text-xs font-bold text-rose-400">
                      (${strategyResult.clientIraNonDeductible.toLocaleString()} non-deductible)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {strategyResult.clientIraPhaseOutNotice}
                </p>
              </div>

              {/* Threshold Proximity Indicator + Per-Slider Next-Benefit Jump */}
              {clientIraThresholdJump && (
                <div
                  className={`rounded-lg px-3 py-2 border flex flex-wrap items-center justify-between gap-2 ${
                    clientIraThresholdJump.isCloseProximity
                      ? 'bg-emerald-500/12 border-emerald-400/50'
                      : 'bg-cyan-500/10 border-cyan-500/35'
                  }`}
                >
                  <div className="text-[11px] leading-snug">
                    <span
                      className={`font-extrabold ${
                        clientIraThresholdJump.isCloseProximity ? 'text-emerald-300' : 'text-cyan-300'
                      }`}
                    >
                      {clientIraThresholdJump.isCloseProximity ? 'Close Threshold: ' : 'Next Benefit: '}
                      {clientIraThresholdJump.thresholdLabel}
                    </span>
                    <span className="block text-[10.5px] text-slate-300">
                      {clientIraThresholdJump.benefitLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      SoundFX.playUnlock();
                      setStackClientTradIra(true);
                      setCustomClientIraAmount(clientIraThresholdJump.targetSliderValue);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      clientIraThresholdJump.isCloseProximity
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-navy-950'
                        : 'bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200'
                    }`}
                  >
                    Jump (+${clientIraThresholdJump.deltaNeeded.toLocaleString()})
                  </button>
                </div>
              )}

              {/* Subtle Per-Slider Recommendation */}
              <div className="bg-navy-950/75 border border-navy-700/70 rounded-lg px-3 py-2 text-[11px] text-slate-300 space-y-0.5">
                <div className="flex justify-between items-center tabular-nums">
                  <span className="text-purple-300 font-bold">
                    Pace: ${Math.round(strategyResult.clientIraRequested / 12).toLocaleString()}/mo
                  </span>
                  <span className="text-slate-400">
                    or ${strategyResult.clientIraRequested.toLocaleString()} by Apr 15
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-400 leading-snug">
                  {strategyResult.activePrimaryPlanContribution > 0
                    ? strategyResult.magiAfterPrimaryPlan < limits.clientPhaseOutStart
                      ? `Safe margin: $${(limits.clientPhaseOutStart - strategyResult.magiAfterPrimaryPlan).toLocaleString()} below active-participant phaseout.`
                      : `Lower Solo 401(k)/SEP intermediate MAGI below $${limits.clientPhaseOutStart.toLocaleString()} to deduct Trad IRA penalty-free.`
                    : `Full $${strategyResult.traditionalIraStatLimit.toLocaleString()} cap open with $0 active-participant restriction.`}
                </p>
              </div>
            </div>

            {/* Single Filers: Personal AGI Reduction Waterfall sits directly in the right-hand slot! */}
            {!isMarried && renderAgiWaterfallCard(false)}

            {/* Married Filers: Spousal IRA Loophole Card on Right + Full-Width AGI Waterfall directly below */}
            {isMarried && (
              <div
                className={`p-4 rounded-xl bg-navy-900/60 border space-y-3 flex flex-col justify-between ${
                  strategyResult.isSpousalLoopholeActive
                    ? 'border-gold-500/50 glow-gold bg-gold-950/10'
                    : 'border-navy-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <i className="fa-solid fa-heart text-rose-400"></i> Spousal IRA Loophole:
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                        !stackSpousalIra || strategyResult.spouseIraRequested === 0
                          ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
                          : strategyResult.spouseIraPhaseOutStatus === 'full'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : strategyResult.spouseIraPhaseOutStatus === 'partial'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {!stackSpousalIra || strategyResult.spouseIraRequested === 0
                        ? 'Stacking Off'
                        : strategyResult.spouseIraPhaseOutStatus === 'full'
                        ? 'Fully Deductible (IRC § 219(g)(7))'
                        : strategyResult.spouseIraPhaseOutStatus === 'partial'
                        ? 'Partially Phased Out'
                        : 'Phased Out'}
                    </span>
                  </div>

                  {stackSpousalIra && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[11px] text-slate-300 gap-2">
                        <span>Spousal Allocation:</span>
                        <div className="text-right tabular-nums">
                          <span className="font-black text-gold-300">
                            ${strategyResult.spouseIraRequested.toLocaleString()} / ${strategyResult.spousalIraStatLimit.toLocaleString()}
                          </span>
                          {spouseIraSafeCap < strategyResult.spousalIraStatLimit && (
                            <span className="block text-[10px] text-cyan-300 font-semibold">
                              138% Safe Max: ${spouseIraSafeCap.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={strategyResult.spousalIraStatLimit}
                        step="100"
                        value={Math.min(strategyResult.spouseIraRequested, strategyResult.spousalIraStatLimit)}
                        onChange={(e) => {
                          const requested = parseFloat(e.target.value) || 0;
                          const clamped = Math.min(requested, spouseIraSafeCap);
                          SoundFX.playSlideHum(0.15);
                          setCustomSpouseIraAmount(clamped);
                        }}
                        className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm font-black text-gold-300 tabular-nums">
                      ${strategyResult.spouseIraDeductible.toLocaleString()} deductible
                      {strategyResult.spouseIraNonDeductible > 0 && (
                        <span className="text-xs font-bold text-rose-400 ml-1.5">
                          (${strategyResult.spouseIraNonDeductible.toLocaleString()} non-deductible)
                        </span>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={spouseCovered}
                        onChange={(e) => onChangeClientData({ spouseCoveredByPlan: e.target.checked })}
                        className="rounded border-navy-700 text-rose-500 focus:ring-rose-500"
                      />
                      Spouse has own 401(k)
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {strategyResult.spouseIraPhaseOutNotice}
                  </p>
                </div>

                {/* Threshold Proximity Indicator + Per-Slider Next-Benefit Jump */}
                {spouseIraThresholdJump && (
                  <div
                    className={`rounded-lg px-3 py-2 border flex flex-wrap items-center justify-between gap-2 ${
                      spouseIraThresholdJump.isCloseProximity
                        ? 'bg-emerald-500/12 border-emerald-400/50'
                        : 'bg-cyan-500/10 border-cyan-500/35'
                    }`}
                  >
                    <div className="text-[11px] leading-snug">
                      <span
                        className={`font-extrabold ${
                          spouseIraThresholdJump.isCloseProximity ? 'text-emerald-300' : 'text-cyan-300'
                        }`}
                      >
                        {spouseIraThresholdJump.isCloseProximity ? 'Close Threshold: ' : 'Next Benefit: '}
                        {spouseIraThresholdJump.thresholdLabel}
                      </span>
                      <span className="block text-[10.5px] text-slate-300">
                        {spouseIraThresholdJump.benefitLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        SoundFX.playUnlock();
                        setStackSpousalIra(true);
                        setCustomSpouseIraAmount(spouseIraThresholdJump.targetSliderValue);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        spouseIraThresholdJump.isCloseProximity
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-navy-950'
                          : 'bg-cyan-500/25 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200'
                      }`}
                    >
                      Jump (+${spouseIraThresholdJump.deltaNeeded.toLocaleString()})
                    </button>
                  </div>
                )}

                {/* Subtle Per-Slider Recommendation */}
                <div className="bg-navy-950/75 border border-navy-700/70 rounded-lg px-3 py-2 text-[11px] text-slate-300 space-y-0.5">
                  <div className="flex justify-between items-center tabular-nums">
                    <span className="text-gold-300 font-bold">
                      Pace: ${Math.round(strategyResult.spouseIraRequested / 12).toLocaleString()}/mo
                    </span>
                    <span className="text-slate-400">
                      or ${strategyResult.spouseIraRequested.toLocaleString()} by Apr 15
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-snug">
                    {spouseCovered
                      ? `Spouse workplace plan limits apply (${mfjStartK}–${mfjEndK} joint MAGI).`
                      : `Uncovered spouse keeps full deductibility up to ${spousalStartK} joint MAGI to drop ACA premium tiers.`}
                  </p>
                </div>
              </div>
            )}

            {/* Married Filers: Full-Width Personal & Household AGI Waterfall directly below */}
            {isMarried && renderAgiWaterfallCard(true)}
          </div>

          {/* Phase-Out Penalty Warning Alert + 1-Click Quick-Fix Button */}
          {strategyResult.hasPhaseOutWarning && (
            <div className="bg-amber-500/15 border border-amber-400/50 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation text-amber-400"></i>
                  {strategyResult.phaseOutWarningHeadline}
                </div>
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  <strong>Recommended Adjustment:</strong> {strategyResult.idealFix.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplyPhaseOutFix}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> Auto-Adjust Sliders to Avoid Phase-Out
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Solo 401(k), SEP-IRA & Pre-Tax Health Optimization Stats (Directly Below Deduction Sliders) */}
      <section className="glass-card p-6 sm:p-7 border-l-4 border-l-purple-500 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
            <i className="fa-solid fa-gauge-high text-purple-400"></i> Solo 401(k), SEP-IRA &amp; Pre-Tax Health Optimization Results
          </h3>
          <span className="text-[11px] font-bold text-purple-300 tabular-nums">
            Total Active Pre-Tax Deduction: ${strategyResult.totalPreTaxDeduction.toLocaleString()} / yr (${Math.round(strategyResult.totalPreTaxDeduction / 12).toLocaleString()}/mo)
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-700">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Baseline Gross AGI</span>
            <div className="text-lg sm:text-xl font-black text-slate-200 tabular-nums">
              ${clientData.grossAGI.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">{strategyResult.baselineFplPct}% of FPL</span>
          </div>

          <div className="bg-navy-950/80 p-4 rounded-xl border border-purple-500/40 glow-purple">
            <span className="text-[10px] uppercase font-bold text-purple-300 block mb-1">Optimized ACA MAGI</span>
            <div className="text-lg sm:text-xl font-black text-purple-400 tabular-nums">
              ${strategyResult.optimizedAgi.toLocaleString()}
            </div>
            <span className="text-[11px] text-purple-300 font-semibold">
              {strategyResult.optimizedFplPct}% of FPL (-{strategyResult.baselineFplPct - strategyResult.optimizedFplPct}% drop)
            </span>
          </div>

          <div className="bg-navy-950/80 p-4 rounded-xl border border-emerald-500/40 glow-emerald">
            <span className="text-[10px] uppercase font-bold text-emerald-300 block mb-1">Net Monthly ACA Premium</span>
            <div className="text-lg sm:text-xl font-black text-emerald-400 tabular-nums">
              ${strategyResult.optimizedSilverTier.monthlyPremium.toLocaleString()}
              <span className="text-xs text-slate-400 font-normal"> / mo</span>
            </div>
            <span className="text-[11px] text-emerald-300 font-semibold">
              +${strategyResult.monthlySubsidyGain.toLocaleString()}/mo extra APTC
            </span>
          </div>

          <div className="bg-navy-950/80 p-4 rounded-xl border border-gold-500/40 glow-gold">
            <span className="text-[10px] uppercase font-bold text-gold-400 block mb-1">Annual Combined Value</span>
            <div className="text-lg sm:text-xl font-black text-gold-400 tabular-nums">
              ${strategyResult.totalAnnualBenefit.toLocaleString()}
            </div>
            <span className="text-[11px] text-gold-300 font-semibold">Subsidy boost + Tax deduction</span>
          </div>
        </div>

        {strategyResult.isAtAcaSafeFloor && (
          <div className="bg-cyan-500/10 border border-cyan-500/40 rounded-xl p-3.5 text-xs text-cyan-200 flex items-start gap-2.5">
            <i className="fa-solid fa-shield-halved text-cyan-400 mt-0.5 shrink-0"></i>
            <span>
              <strong>138% FPL Medicaid-Safe Floor Reached (${strategyResult.acaSafeFloor138.toLocaleString()}):</strong> Deductions are capped right at the 138% FPL threshold so you realize maximum 94% AV Silver CSR + APTC subsidies without dropping into Medicaid territory.
            </span>
          </div>
        )}
      </section>

      {/* Critical Statutory Guidance & Verified IRS Matrix */}
      <section className="glass-card p-6 sm:p-7 border-l-4 border-l-amber-500 glow-gold space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy-950 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl shrink-0">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h4 className="text-base font-extrabold text-white">
              Critical IRS Rules ({taxYear}): Active Participant Classification &amp; Phase-Out Caveats
            </h4>
            <p className="text-xs text-slate-300">
              Review how contributing to a Solo 401(k) or SEP-IRA affects Traditional IRA deductibility and ACA MAGI calculations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Notice 1 + Plain-English Translation */}
          <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h5 className="font-extrabold text-amber-400 flex items-center gap-1.5">
                <i className="fa-solid fa-flag"></i> 1. Active Participant Flag
              </h5>
              <p className="text-slate-300 leading-relaxed text-[11.5px]">
                Contributing even $1 into a Solo 401(k) or SEP-IRA automatically checks the Form W-2 / IRS <strong>&quot;active participant&quot;</strong> status for the tax year, triggering strict Modified AGI phase-outs on separate Traditional IRA deductions.
              </p>
            </div>
            <div className="rounded-lg p-2.5 bg-cyan-500/10 border border-cyan-500/35 text-[11px] leading-relaxed text-cyan-200">
              <strong className="text-cyan-300 uppercase tracking-wider text-[10px] block mb-0.5">
                Plain-English Translation:
              </strong>
              Once you put even $1 into a Solo 401(k) or SEP-IRA, the IRS considers you &quot;covered at work&quot;—so adding a personal Traditional IRA on top is subject to income caps.
            </div>
          </div>

          {/* Notice 2 + Plain-English Translation */}
          <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h5 className="font-extrabold text-amber-400 flex items-center gap-1.5">
                <i className="fa-solid fa-ban"></i> 2. The Traditional IRA Trap
              </h5>
              <p className="text-slate-300 leading-relaxed text-[11.5px]">
                For {taxYear}, active participants face phaseouts at <strong>{singleStartK}–{singleEndK} MAGI</strong> (Single) or <strong>{mfjStartK}–{mfjEndK} MAGI</strong> (Married Joint) under IRC § 219(g). Non-deductible contributions give $0 ACA reduction.
              </p>
            </div>
            <div className="rounded-lg p-2.5 bg-cyan-500/10 border border-cyan-500/35 text-[11px] leading-relaxed text-cyan-200">
              <strong className="text-cyan-300 uppercase tracking-wider text-[10px] block mb-0.5">
                Plain-English Translation:
              </strong>
              If your income after your 401(k)/SEP deduction is still above {singleEndK} (single) or {mfjEndK} (married), putting money in your own Traditional IRA won&apos;t save tax or lower your health insurance cost.
            </div>
          </div>

          {/* Notice 3 + Plain-English Translation */}
          <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h5 className="font-extrabold text-emerald-400 flex items-center gap-1.5">
                <i className="fa-solid fa-key"></i> 3. The Spousal Loophole
              </h5>
              <p className="text-slate-300 leading-relaxed text-[11.5px]">
                Under <strong>IRC § 219(g)(7)</strong>, if your spouse does not have their own employer retirement plan, their {taxYear} Traditional IRA faces a much higher bracket: <strong>{spousalStartK}–{spousalEndK} MAGI</strong>.
              </p>
            </div>
            <div className="rounded-lg p-2.5 bg-cyan-500/10 border border-cyan-500/35 text-[11px] leading-relaxed text-cyan-200">
              <strong className="text-cyan-300 uppercase tracking-wider text-[10px] block mb-0.5">
                Plain-English Translation:
              </strong>
              Even if you have a Solo 401(k), your spouse without their own workplace 401(k) can still contribute up to $7,500 ($8,600 if 50+) pre-tax as long as joint income stays under {spousalStartK}.
            </div>
          </div>
        </div>

        {/* Collapsible Verified IRS Solo 401(k) / SEP / IRA Matrix Table (Collapsed by Default) */}
        <div className="pt-2 border-t border-navy-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h5 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <i className="fa-solid fa-table text-amber-400"></i> Detailed IRS Plan Limits &amp; Vehicle Matrix ({taxYear})
              </h5>
              <p className="text-[11px] text-slate-400">
                Compare verified Solo 401(k), SEP-IRA, Traditional IRA, and Spousal IRA ceilings, eligibility, and deadlines.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={isIrsMatrixExpanded}
              onClick={() => {
                SoundFX.playClick();
                setIsIrsMatrixExpanded((prev) => !prev);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-navy-950 hover:bg-navy-800 border border-amber-500/40 text-xs font-extrabold text-amber-300 flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer transition-all"
            >
              <i className={`fa-solid ${isIrsMatrixExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              {isIrsMatrixExpanded ? 'Hide Detailed Plan Limits Matrix' : 'Show Detailed Plan Limits Matrix'}
            </button>
          </div>

          {isIrsMatrixExpanded && (
            <div className="overflow-x-auto space-y-2">
              <table className="w-full text-left text-xs border border-navy-700/80 rounded-xl overflow-hidden">
                <thead className="bg-navy-900 text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-navy-700">
                  <tr>
                    <th className="py-2.5 px-3">Qualified Vehicle ({taxYear})</th>
                    <th className="py-2.5 px-3">Verified IRS Contribution Ceiling</th>
                    <th className="py-2.5 px-3">AGI Reduction Impact</th>
                    <th className="py-2.5 px-3">Active Participant Status</th>
                    <th className="py-2.5 px-3">Primary Advisor Strategy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800 text-slate-300">
                  <tr className="bg-navy-950/60 hover:bg-navy-900/40">
                    <td className="py-2.5 px-3 font-bold text-purple-300 flex items-center gap-1.5">
                      <i className="fa-solid fa-vault"></i> Solo 401(k) Annuity
                    </td>
                    <td className="py-2.5 px-3 font-semibold tabular-nums">
                      ${limits.baseElectiveDeferral.toLocaleString()} deferral + 20% Sched C / 25% S-Corp W-2 up to ${limits.section415cCap.toLocaleString()} base (${(limits.section415cCap + limits.standardCatchUp).toLocaleString()} age 50+ · ${(limits.section415cCap + limits.superCatchUp).toLocaleString()} age 60–63)
                    </td>
                    <td className="py-2.5 px-3">Direct: Employee deferral + Employer profit share lowers Schedule 1 / W-2 MAGI</td>
                    <td className="py-2.5 px-3 text-amber-400 font-bold">Yes (Triggers § 219(g))</td>
                    <td className="py-2.5 px-3 text-emerald-300 font-bold">
                      Top choice for owner-only businesses (no full-time non-spouse W-2 staff)
                    </td>
                  </tr>
                  <tr className="bg-navy-950/40 hover:bg-navy-900/40">
                    <td className="py-2.5 px-3 font-bold text-purple-300 flex items-center gap-1.5">
                      <i className="fa-solid fa-briefcase"></i> SEP-IRA Annuity
                    </td>
                    <td className="py-2.5 px-3 font-semibold tabular-nums">
                      Up to 20% after ½ SE tax (25% W-2), ${limits.section415cCap.toLocaleString()} max (No catch-up)
                    </td>
                    <td className="py-2.5 px-3">Direct: Form 1040 Schedule 1 Line 16 SE retirement deduction</td>
                    <td className="py-2.5 px-3 text-amber-400 font-bold">Yes (Even with $1)</td>
                    <td className="py-2.5 px-3">Simple setup when employer-only percentage covers target MAGI</td>
                  </tr>
                  <tr className="bg-navy-950/60 hover:bg-navy-900/40">
                    <td className="py-2.5 px-3 font-bold text-gold-400 flex items-center gap-1.5">
                      <i className="fa-solid fa-piggy-bank"></i> Stacked Trad-IRA
                    </td>
                    <td className="py-2.5 px-3 font-semibold tabular-nums">$7,500 ($8,600 if 50+)</td>
                    <td className="py-2.5 px-3">Conditional: Deductible only below active-participant phaseout</td>
                    <td className="py-2.5 px-3 text-slate-400">Tested after 401(k)/SEP</td>
                    <td className="py-2.5 px-3">
                      Stack when intermediate MAGI &lt; {singleStartK} (Single) / {mfjStartK} (MFJ)
                    </td>
                  </tr>
                  <tr className="bg-navy-950/40 hover:bg-navy-900/40">
                    <td className="py-2.5 px-3 font-bold text-rose-400 flex items-center gap-1.5">
                      <i className="fa-solid fa-heart"></i> Stacked Spousal IRA
                    </td>
                    <td className="py-2.5 px-3 font-semibold tabular-nums">$7,500 ($8,600 if 50+)</td>
                    <td className="py-2.5 px-3 text-emerald-300 font-bold">
                      High Potential: Deductible up to {spousalStartK}–{spousalEndK} joint MAGI
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">No (For uncovered spouse)</td>
                    <td className="py-2.5 px-3 text-emerald-300 font-bold">
                      Primary extra deduction for higher-income married households
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-slate-400">
                <strong>IRS Eligibility &amp; Deadlines:</strong> Solo 401(k) requires zero common-law W-2 employees working ≥1,000 hrs/yr (or 500+ hrs for 2 consecutive years under SECURE 2.0) other than your spouse; elective deferrals generally require plan adoption by Dec 31, while employer profit-sharing &amp; SEP contributions can be funded up to your tax filing deadline (+ extensions).
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Collapsible Baseline vs. Optimized ACA Health & Tax Impact (Collapsed by Default) */}
      <section className="glass-card p-6 sm:p-8 border-l-4 border-l-emerald-500 glow-emerald space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <i className="fa-solid fa-scale-balanced text-emerald-400"></i> Baseline vs. Optimized ACA Health &amp; Tax Impact
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Optimized Silver Premium:{' '}
              <strong className="text-emerald-300 tabular-nums">
                ${strategyResult.optimizedSilverTier.monthlyPremium.toLocaleString()}/mo
              </strong>{' '}
              ({strategyResult.optimizedAca.csrLevel}) · Combined Annual Benefit:{' '}
              <strong className="text-gold-400 tabular-nums">
                +${strategyResult.totalAnnualBenefit.toLocaleString()}/yr
              </strong>
            </p>
          </div>

          <button
            type="button"
            aria-expanded={isImpactExpanded}
            onClick={() => {
              SoundFX.playClick();
              setIsImpactExpanded((prev) => !prev);
            }}
            className="px-3.5 py-2 rounded-xl bg-navy-950 hover:bg-navy-800 border border-emerald-500/40 text-xs font-extrabold text-emerald-300 flex items-center gap-2 whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer transition-all"
          >
            <i className={`fa-solid ${isImpactExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
            {isImpactExpanded ? 'Hide Comparison & 5-Year Chart' : 'Show Comparison & 5-Year Chart'}
          </button>
        </div>

        {isImpactExpanded && (
          <div className="space-y-6 pt-4 border-t border-navy-700/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-300">
                Side-by-side comparison of your healthcare costs, Silver CSR actuarial tiers, and 5-year compounding retirement projection.
              </span>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Regional Carrier:</span>
                <select
                  value={activeCarrier}
                  onChange={(e) => {
                    SoundFX.playClick();
                    onChangeClientData({ selectedHealthCarrier: e.target.value as HealthCarrierId });
                  }}
                  className="bg-navy-950 text-xs font-bold text-white px-2.5 py-1.5 rounded-lg border border-navy-700 focus:border-emerald-500 cursor-pointer"
                >
                  {REGIONAL_HEALTH_CARRIERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-navy-700/80 rounded-xl overflow-hidden">
                <thead className="bg-navy-900 text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-navy-700">
                  <tr>
                    <th className="py-3 px-4">Financial &amp; Healthcare Metric</th>
                    <th className="py-3 px-4 text-slate-400">1. Baseline (Un-optimized)</th>
                    <th className="py-3 px-4 text-purple-300 font-extrabold">2. Self-Employed Pre-Tax Strategy</th>
                    <th className="py-3 px-4 text-emerald-400 font-extrabold">Net Advantage / Benefit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800 text-slate-200">
                  <tr className="bg-navy-950/60">
                    <td className="py-3 px-4 font-bold text-white">Schedule 1 Pre-Tax Retirement Deduction</td>
                    <td className="py-3 px-4 text-slate-400 tabular-nums">$0</td>
                    <td className="py-3 px-4 text-purple-300 font-extrabold tabular-nums">
                      ${strategyResult.totalPreTaxDeduction.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold tabular-nums">
                      +${strategyResult.totalPreTaxDeduction.toLocaleString()} added to retirement
                    </td>
                  </tr>

                  <tr className="bg-navy-950/40">
                    <td className="py-3 px-4 font-bold text-white">Reported ACA MAGI</td>
                    <td className="py-3 px-4 tabular-nums">${clientData.grossAGI.toLocaleString()}</td>
                    <td className="py-3 px-4 text-purple-300 font-extrabold tabular-nums">
                      ${strategyResult.optimizedAgi.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold tabular-nums">
                      -${(clientData.grossAGI - strategyResult.optimizedAgi).toLocaleString()} reduction
                    </td>
                  </tr>

                  <tr className="bg-navy-950/60">
                    <td className="py-3 px-4 font-bold text-white">Federal Poverty Level (FPL %)</td>
                    <td className="py-3 px-4 tabular-nums">{strategyResult.baselineFplPct}% FPL</td>
                    <td className="py-3 px-4 text-purple-300 font-extrabold tabular-nums">
                      {strategyResult.optimizedFplPct}% FPL
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold tabular-nums">
                      -{strategyResult.baselineFplPct - strategyResult.optimizedFplPct}% drop
                    </td>
                  </tr>

                  <tr className="bg-navy-950/40">
                    <td className="py-3 px-4 font-bold text-white">Monthly Federal ACA Subsidy (APTC)</td>
                    <td className="py-3 px-4 tabular-nums">${strategyResult.baselineAca.monthlySubsidy}/mo</td>
                    <td className="py-3 px-4 text-emerald-300 font-extrabold tabular-nums">
                      ${strategyResult.optimizedAca.monthlySubsidy}/mo
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold tabular-nums">
                      +${strategyResult.monthlySubsidyGain.toLocaleString()}/mo (+${strategyResult.annualSubsidyGain.toLocaleString()}/yr)
                    </td>
                  </tr>

                  <tr className="bg-navy-950/60">
                    <td className="py-3 px-4 font-bold text-white">Net Monthly Health Plan Premium</td>
                    <td className="py-3 px-4 tabular-nums text-rose-300">
                      ${strategyResult.baselineSilverTier.monthlyPremium.toLocaleString()}/mo
                    </td>
                    <td className="py-3 px-4 text-emerald-300 font-extrabold tabular-nums">
                      ${strategyResult.optimizedSilverTier.monthlyPremium.toLocaleString()}/mo
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold tabular-nums">
                      -${Math.max(0, strategyResult.baselineSilverTier.monthlyPremium - strategyResult.optimizedSilverTier.monthlyPremium).toLocaleString()}/mo premium savings
                    </td>
                  </tr>

                  <tr className="bg-navy-950/40">
                    <td className="py-3 px-4 font-bold text-white">Silver CSR Plan Tier &amp; Actuarial Value</td>
                    <td className="py-3 px-4 text-slate-400">{strategyResult.baselineAca.csrLevel}</td>
                    <td className="py-3 px-4 text-emerald-300 font-extrabold">
                      {strategyResult.optimizedAca.csrLevel}
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      {strategyResult.optimizedAca.av} Cost-Sharing Upgrade
                    </td>
                  </tr>

                  <tr className="bg-navy-950/60">
                    <td className="py-3 px-4 font-bold text-white">Medical Deductible / Copay</td>
                    <td className="py-3 px-4 text-slate-400 tabular-nums">
                      ${strategyResult.baselineSilverTier.deductible.toLocaleString()} ded / ${strategyResult.baselineAca.primaryCopay} copay
                    </td>
                    <td className="py-3 px-4 text-emerald-300 font-extrabold tabular-nums">
                      ${strategyResult.optimizedSilverTier.deductible.toLocaleString()} ded / ${strategyResult.optimizedAca.primaryCopay} copay
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold tabular-nums">
                      -${Math.max(0, strategyResult.baselineSilverTier.deductible - strategyResult.optimizedSilverTier.deductible).toLocaleString()} deductible reduction
                    </td>
                  </tr>

                  <tr className="bg-navy-900/80 font-bold">
                    <td className="py-3 px-4 text-gold-300">Estimated Immediate Federal Income Tax Savings</td>
                    <td className="py-3 px-4 text-slate-400 tabular-nums">$0</td>
                    <td className="py-3 px-4 text-gold-400 font-black tabular-nums">
                      ${strategyResult.annualTaxSavings.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-gold-400 font-black tabular-nums">
                      {(strategyResult.marginalTaxRate * 100).toFixed(0)}% Marginal Bracket Deduction
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Chart Visualization Container */}
            <div className="bg-navy-950/80 p-5 rounded-2xl border border-navy-700/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-chart-column text-purple-400"></i> 5-Year Wealth Accumulation &amp; Subsidy Compounding Projection
                </h4>
                <span className="text-[11px] text-slate-400">Assuming 5.5% fixed indexed growth rate</span>
              </div>
              <div className="h-64 sm:h-72 w-full">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
