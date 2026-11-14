import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { ActiveStrategySnapshot, ClientData, HealthCarrierId } from '../../types';
import {
  calculateSelfEmployedAcaStrategy,
  getHouseholdSize,
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
  onOpenBooking,
  onUpdateStrategySnapshot,
}) => {
  const isMarried = clientData.filingStatus === 'married';
  const is50Plus = clientData.clientAge >= 50;
  const spouseAge = clientData.spouseAge || clientData.clientAge;

  const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);
  const netProfit = clientData.netSelfEmploymentProfit || Math.round(clientData.grossAGI * 0.85);

  // Strategy Mode State
  const [selectedVehicle, setSelectedVehicle] = useState<'solo401k' | 'sep_ira' | 'stacked_solo'>('stacked_solo');
  
  // Custom Slider States
  const soloEmployeeStatCap = 23500 + (is50Plus ? 7500 : 0);
  const soloEmployerMax = Math.min(Math.max(0, netProfit * 0.20), 48500);
  const sepIraMax = Math.min(Math.max(0, netProfit * 0.20), 72000);

  const [customSoloEmployee, setCustomSoloEmployee] = useState<number>(soloEmployeeStatCap);
  const [customSoloEmployer, setCustomSoloEmployer] = useState<number>(soloEmployerMax);
  const [customSepContribution, setCustomSepContribution] = useState<number>(sepIraMax);
  
  const [stackClientTradIra, setStackClientTradIra] = useState<boolean>(true);
  const [stackSpousalIra, setStackSpousalIra] = useState<boolean>(isMarried);
  const spouseCovered = Boolean(clientData.spouseCoveredByPlan);
  const activeCarrier = clientData.selectedHealthCarrier || 'oscar';

  // Chart References
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Calculate strategy results in real-time
  const strategyResult = calculateSelfEmployedAcaStrategy({
    grossAGI: clientData.grossAGI,
    netBusinessProfit: netProfit,
    clientAge: clientData.clientAge,
    filingStatus: clientData.filingStatus,
    householdSize,
    selectedVehicle,
    customSoloEmployee: selectedVehicle === 'sep_ira' ? 0 : customSoloEmployee,
    customSoloEmployer: selectedVehicle === 'sep_ira' ? 0 : customSoloEmployer,
    customSepContribution: selectedVehicle === 'sep_ira' ? customSepContribution : 0,
    stackClientTradIra,
    stackSpousalIra: isMarried && stackSpousalIra,
    spouseAge,
    spouseCoveredByPlan: spouseCovered,
  });

  // Keep state synced when net profit or age changes
  useEffect(() => {
    setCustomSoloEmployer(Math.min(Math.max(0, netProfit * 0.20), 48500));
    setCustomSepContribution(Math.min(Math.max(0, netProfit * 0.20), 72000));
  }, [netProfit]);

  useEffect(() => {
    setCustomSoloEmployee((prev) => Math.min(prev, soloEmployeeStatCap));
  }, [soloEmployeeStatCap]);

  useEffect(() => {
    if (!onUpdateStrategySnapshot) return;
    const carrierObj = REGIONAL_HEALTH_CARRIERS.find((c) => c.id === activeCarrier) || REGIONAL_HEALTH_CARRIERS[0];
    const vehicleLabel = selectedVehicle === 'sep_ira' ? 'SEP-IRA Annuity' : 'Solo 401(k) + Stacked IRAs';
    const sliders: Array<{ label: string; value: string }> = [
      { label: 'Selected Retirement Vehicle', value: vehicleLabel },
      { label: 'Net Schedule C / 1099 Profit', value: `$${netProfit.toLocaleString()}/yr` },
    ];
    if (selectedVehicle === 'sep_ira') {
      sliders.push({ label: 'SEP-IRA Employer Contribution', value: `$${customSepContribution.toLocaleString()}/yr` });
    } else {
      sliders.push(
        { label: 'Solo 401(k) Employee Deferral', value: `$${customSoloEmployee.toLocaleString()}/yr` },
        { label: 'Solo 401(k) Employer Profit Share', value: `$${customSoloEmployer.toLocaleString()}/yr` }
      );
    }
    sliders.push({
      label: 'Stack Client Traditional IRA',
      value: stackClientTradIra ? `Enabled ($${strategyResult.clientIraDeductible.toLocaleString()} deductible)` : 'Disabled',
    });
    if (isMarried) {
      sliders.push({
        label: 'Stack Spousal IRA (IRC 219(g)(7))',
        value: stackSpousalIra
          ? `Enabled ($${strategyResult.spouseIraDeductible.toLocaleString()} deductible; spouse 401k: ${spouseCovered ? 'Yes' : 'No'})`
          : 'Disabled',
      });
    }
    sliders.push({ label: 'Selected Regional Carrier', value: carrierObj.name });

    onUpdateStrategySnapshot({
      pathId: 'self_employed_aca',
      pathLabel: 'Self-Employed ACA Optimizer',
      summaryHeadline: `${vehicleLabel} delivering $${strategyResult.totalPreTaxDeduction.toLocaleString()} Schedule 1 deduction`,
      selectedCarrierOrVendor: carrierObj.name,
      selectedTierOrOption: `${vehicleLabel} · ${strategyResult.optimizedAca.csrLevel}`,
      sliders,
      impactMetrics: [
        { label: 'Total Pre-Tax Deduction', value: `$${strategyResult.totalPreTaxDeduction.toLocaleString()}/yr` },
        { label: 'Baseline AGI -> Optimized ACA MAGI', value: `$${clientData.grossAGI.toLocaleString()} -> $${strategyResult.optimizedAgi.toLocaleString()}` },
        { label: 'FPL Shift', value: `${strategyResult.baselineFplPct}% -> ${strategyResult.optimizedFplPct}% FPL` },
        { label: 'Net Monthly ACA Premium', value: `$${strategyResult.optimizedAca.netMonthlyPremium}/mo (+$${strategyResult.monthlySubsidyGain.toLocaleString()}/mo APTC boost)` },
        { label: 'Qualified CSR Tier & Deductible', value: `${strategyResult.optimizedAca.csrLevel} ($${strategyResult.optimizedAca.deductible.toLocaleString()} ded)` },
        { label: 'Est. Annual ACA Subsidy + Tax Benefit', value: `$${strategyResult.totalAnnualBenefit.toLocaleString()}/yr` },
      ],
    });
  }, [
    onUpdateStrategySnapshot,
    activeCarrier,
    selectedVehicle,
    netProfit,
    customSepContribution,
    customSoloEmployee,
    customSoloEmployer,
    stackClientTradIra,
    stackSpousalIra,
    spouseCovered,
    isMarried,
    clientData.grossAGI,
    strategyResult.clientIraDeductible,
    strategyResult.spouseIraDeductible,
    strategyResult.totalPreTaxDeduction,
    strategyResult.optimizedAgi,
    strategyResult.baselineFplPct,
    strategyResult.optimizedFplPct,
    strategyResult.optimizedAca.netMonthlyPremium,
    strategyResult.optimizedAca.csrLevel,
    strategyResult.optimizedAca.deductible,
    strategyResult.monthlySubsidyGain,
    strategyResult.totalAnnualBenefit,
  ]);

  // Render Compounding Wealth & Subsidy Chart
  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const years = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
    const annualDeduction = strategyResult.totalPreTaxDeduction;
    const annualHealthSubsidy = strategyResult.annualSubsidyGain;
    const annualTaxSavings = strategyResult.annualTaxSavings;

    // Projected 5-year compounding with 5.5% annual return in qualified annuity vehicle
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

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [strategyResult.totalPreTaxDeduction, strategyResult.annualSubsidyGain, strategyResult.annualTaxSavings]);

  const handleProfitChange = (val: number) => {
    SoundFX.playSlideHum(0.3);
    onChangeClientData({ netSelfEmploymentProfit: val });
  };

  return (
    <div className="space-y-8">
      {/* Hero Header Card */}
      <section className="glass-card p-6 sm:p-8 border-l-4 border-l-purple-500 glow-purple space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-extrabold uppercase tracking-wider border border-purple-500/30 mb-2">
              <i className="fa-solid fa-briefcase"></i> Self-Employed ACA Optimization Suite
            </div>
            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              Solo 401(k), SEP-IRA &amp; Pre-Tax Health Optimization
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Fiduciary architecture designed specifically for 1099 contractors, sole proprietors, and small business owners.
              Legally reduce Form 1040 Schedule 1 Adjusted Gross Income to drop your Federal Poverty Level (FPL %) and unlock maximum ACA Advance Premium Tax Credits.
            </p>
          </div>

          <div className="bg-navy-950 px-4 py-3 rounded-xl border border-purple-500/30 text-left lg:text-right shrink-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Max Annual Pre-Tax Capacity</span>
            <span className="text-sm sm:text-base font-extrabold text-purple-300 tabular-nums">
              ${(strategyResult.solo401kMaxTotal + strategyResult.traditionalIraStatLimit + (isMarried ? strategyResult.spousalIraStatLimit : 0)).toLocaleString()} / yr
            </span>
          </div>
        </div>

        {/* 4-KPI Overview Bar */}
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
              ${strategyResult.optimizedAca.netMonthlyPremium}
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

        {strategyResult.optimizedFplPct <= 138 && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
            <i className="fa-solid fa-shield-halved text-amber-400 mt-0.5 shrink-0"></i>
            <span>
              <strong>Medicaid &amp; 100% FPL ACA Safeguard Active:</strong> Optimized MAGI (~{strategyResult.optimizedFplPct}% FPL) is within the ≤138% FPL Medicaid / minimum ACA threshold. Note: If household MAGI falls below 100% FPL in a non-expansion state, ACA subsidies are replaced by Medicaid screening (which you may apply for, with no guarantees).
            </span>
          </div>
        )}
      </section>

      {/* Main Interactive Optimization Sandbox */}
      <section className="glass-card p-6 sm:p-8 border-l-4 border-l-blue-500 glow-blue space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-700/60 pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <i className="fa-solid fa-sliders text-blue-400"></i> Qualified Retirement Vehicle &amp; Deduction Controls
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Adjust your net Schedule C earnings and configure contribution tiers across Solo 401(k), SEP-IRA, and Stacked IRAs.
            </p>
          </div>

          {/* Vehicle Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-navy-950 rounded-xl border border-navy-700 self-start sm:self-auto">
            <button
              onClick={() => {
                SoundFX.playClick();
                setSelectedVehicle('stacked_solo');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedVehicle === 'stacked_solo'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Solo 401(k) + IRA Stack
            </button>
            <button
              onClick={() => {
                SoundFX.playClick();
                setSelectedVehicle('sep_ira');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedVehicle === 'sep_ira'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SEP-IRA Annuity
            </button>
          </div>
        </div>

        {/* Diagnostic Input: Net Business Profit */}
        <div className="bg-navy-950/80 p-5 rounded-2xl border border-navy-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-white flex items-center gap-2">
                <i className="fa-solid fa-cash-register text-gold-400"></i> Net Self-Employment Profit (Schedule C / 1099 Net):
              </span>
              <p className="text-[11px] text-slate-400">
                Determines statutory maximum employer profit sharing and SEP-IRA contribution limits (20% adjusted cap).
              </p>
            </div>
            <div className="flex items-center gap-2 bg-navy-900 px-3 py-1.5 rounded-xl border border-gold-500/40 self-start sm:self-auto">
              <span className="text-gold-400 font-extrabold text-xs">$</span>
              <input
                type="number"
                min="10000"
                max="500000"
                step="1000"
                value={netProfit}
                onChange={(e) => handleProfitChange(parseInt(e.target.value) || 10000)}
                className="w-24 bg-transparent text-gold-400 font-black text-sm focus:outline-none text-right tabular-nums"
              />
            </div>
          </div>
          <input
            type="range"
            min="10000"
            max="300000"
            step="2500"
            value={Math.min(300000, netProfit)}
            onChange={(e) => handleProfitChange(parseFloat(e.target.value) || 10000)}
            className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
          />
        </div>

        {/* Sliders Grid depending on Selected Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {selectedVehicle !== 'sep_ira' ? (
            <>
              {/* Solo 401(k) Employee Deferral */}
              <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-700 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white block">Solo 401(k) Employee Deferral:</span>
                    <span className="text-[10.5px] text-slate-400">
                      Elective deferral (Max ${strategyResult.solo401kEmployeeMax.toLocaleString()} with {is50Plus ? '50+ Catch-up' : 'under 50'})
                    </span>
                  </div>
                  <span className="text-purple-400 font-black text-sm tabular-nums">
                    ${customSoloEmployee.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={strategyResult.solo401kEmployeeMax}
                  step="500"
                  value={customSoloEmployee}
                  onChange={(e) => {
                    SoundFX.playSlideHum(0.2);
                    setCustomSoloEmployee(parseFloat(e.target.value) || 0);
                  }}
                  className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Solo 401(k) Employer Profit Sharing */}
              <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-700 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white block">Solo 401(k) Employer Profit Share:</span>
                    <span className="text-[10.5px] text-slate-400">
                      Up to 20% of net self-employment profit (Max ${strategyResult.solo401kEmployerMax.toLocaleString()})
                    </span>
                  </div>
                  <span className="text-purple-400 font-black text-sm tabular-nums">
                    ${customSoloEmployer.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(1000, strategyResult.solo401kEmployerMax)}
                  step="500"
                  value={customSoloEmployer}
                  onChange={(e) => {
                    SoundFX.playSlideHum(0.2);
                    setCustomSoloEmployer(parseFloat(e.target.value) || 0);
                  }}
                  className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </>
          ) : (
            /* SEP-IRA Employer Contribution */
            <div className="md:col-span-2 bg-navy-950/80 p-5 rounded-xl border border-navy-700 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-white block text-sm">SEP-IRA Annuity Employer Contribution:</span>
                  <span className="text-[11px] text-slate-400">
                    Funded 100% by employer profit sharing (Capped at 20% of net earnings or $72,000 maximum).
                  </span>
                </div>
                <span className="text-purple-400 font-black text-base tabular-nums">
                  ${customSepContribution.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(1000, strategyResult.sepIraMax)}
                step="500"
                value={customSepContribution}
                onChange={(e) => {
                  SoundFX.playSlideHum(0.2);
                  setCustomSepContribution(parseFloat(e.target.value) || 0);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          )}
        </div>

        {/* Stacked Individual & Spousal IRA Sub-section */}
        <div className="bg-navy-950/60 p-5 rounded-2xl border border-navy-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-navy-800 pb-3">
            <div>
              <h4 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-layer-group"></i> Stacked Individual &amp; Spousal Traditional IRAs
              </h4>
              <p className="text-[11px] text-slate-400">
                Stacking individual IRAs on top of a Solo 401(k) or SEP-IRA is subject to strict active-participant phaseouts.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stackClientTradIra}
                  onChange={(e) => setStackClientTradIra(e.target.checked)}
                  className="rounded border-navy-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                Stack Client IRA ($7.5k–$8.6k)
              </label>
              {isMarried && (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stackSpousalIra}
                    onChange={(e) => setStackSpousalIra(e.target.checked)}
                    className="rounded border-navy-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  Stack Spousal IRA ($7.5k–$8.6k)
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client IRA Phase-out Box */}
            <div className="p-4 rounded-xl bg-navy-900/60 border border-navy-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-user text-purple-400"></i> Client Traditional IRA:
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    strategyResult.clientIraPhaseOutStatus === 'full'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : strategyResult.clientIraPhaseOutStatus === 'partial'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {strategyResult.clientIraPhaseOutStatus === 'full'
                    ? '100% Tax Deductible'
                    : strategyResult.clientIraPhaseOutStatus === 'partial'
                    ? 'Partially Phased Out'
                    : '100% Phased Out (Trap)'}
                </span>
              </div>
              <div className="text-sm font-black text-purple-300 tabular-nums">
                ${strategyResult.clientIraDeductible.toLocaleString()} deductible
                <span className="text-xs text-slate-400 font-normal"> / ${strategyResult.traditionalIraStatLimit.toLocaleString()} max</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                {strategyResult.clientIraPhaseOutNotice}
              </p>
            </div>

            {/* Spousal IRA Loophole Box */}
            {isMarried && (
              <div className={`p-4 rounded-xl bg-navy-900/60 border space-y-2 ${
                strategyResult.isSpousalLoopholeActive
                  ? 'border-gold-500/50 glow-gold bg-gold-950/10'
                  : 'border-navy-700'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <i className="fa-solid fa-heart text-rose-400"></i> Spousal IRA Loophole:
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      strategyResult.spouseIraPhaseOutStatus === 'full'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : strategyResult.spouseIraPhaseOutStatus === 'partial'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {strategyResult.spouseIraPhaseOutStatus === 'full'
                      ? 'Fully Deductible (IRC § 219(g)(7))'
                      : strategyResult.spouseIraPhaseOutStatus === 'partial'
                      ? 'Partially Phased Out'
                      : 'Phased Out'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black text-gold-300 tabular-nums">
                    ${strategyResult.spouseIraDeductible.toLocaleString()} deductible
                    <span className="text-xs text-slate-400 font-normal"> / ${strategyResult.spousalIraStatLimit.toLocaleString()} max</span>
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
            )}
          </div>
        </div>
      </section>

      {/* Critical Statutory Guidance & Educational Advisory Callout */}
      <section className="glass-card p-6 sm:p-7 border-l-4 border-l-amber-500 glow-gold space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy-950 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl shrink-0">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h4 className="text-base font-extrabold text-white">
              Critical IRS Rules: Active Participant Classification &amp; Phase-Out Caveats
            </h4>
            <p className="text-xs text-slate-300">
              Review how contributing to Solo 401(k) or SEP-IRA alters individual IRA tax deductibility and ACA calculations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-800 space-y-2">
            <h5 className="font-extrabold text-amber-400 flex items-center gap-1.5">
              <i className="fa-solid fa-flag"></i> 1. Active Participant Flag
            </h5>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              Contributing even $1 into a Solo 401(k) or SEP-IRA automatically flags you as an <strong>"active participant"</strong> for the tax year. This triggers strict IRS Modified AGI phase-out thresholds for any additional individual Traditional IRA contributions.
            </p>
          </div>

          <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-800 space-y-2">
            <h5 className="font-extrabold text-amber-400 flex items-center gap-1.5">
              <i className="fa-solid fa-ban"></i> 2. The Traditional IRA Trap
            </h5>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              If active in a plan, Single filers face phaseouts between <strong>$79,000–$89,000 MAGI</strong> ($0 deduction above $89k). Married joint filers face phaseouts between <strong>$129,000–$149,000 MAGI</strong>. An un-deductible IRA contribution does <em>not</em> lower ACA MAGI!
            </p>
          </div>

          <div className="bg-navy-950/80 p-4 rounded-xl border border-navy-800 space-y-2">
            <h5 className="font-extrabold text-emerald-400 flex items-center gap-1.5">
              <i className="fa-solid fa-key"></i> 3. The Spousal Loophole
            </h5>
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              Under <strong>IRC § 219(g)(7)</strong>, if your spouse is not covered by an employer plan, their Traditional IRA faces a much higher phaseout bracket: <strong>$242,000–$252,000 MAGI</strong>. Deducting $7,500–$8,600 directly drops joint AGI and slashes ACA costs.
            </p>
          </div>
        </div>

        {/* Matrix Comparison Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs border border-navy-700/80 rounded-xl overflow-hidden">
            <thead className="bg-navy-900 text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-navy-700">
              <tr>
                <th className="py-2.5 px-3">Qualified Vehicle</th>
                <th className="py-2.5 px-3">Max Contribution Limit</th>
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
                <td className="py-2.5 px-3 font-semibold tabular-nums">Up to $72,000 (+ catch-up)</td>
                <td className="py-2.5 px-3">Direct: Salary Deferral + Profit Share lowers W-2/Sched 1</td>
                <td className="py-2.5 px-3 text-amber-400 font-bold">Yes (Triggers limits)</td>
                <td className="py-2.5 px-3 text-emerald-300 font-bold">Top choice: Largest dollar-for-dollar reduction</td>
              </tr>
              <tr className="bg-navy-950/40 hover:bg-navy-900/40">
                <td className="py-2.5 px-3 font-bold text-purple-300 flex items-center gap-1.5">
                  <i className="fa-solid fa-briefcase"></i> SEP-IRA Annuity
                </td>
                <td className="py-2.5 px-3 font-semibold tabular-nums">Up to 20% net profit ($72k max)</td>
                <td className="py-2.5 px-3">Direct: Schedule 1 Line 16 SE retirement deduction</td>
                <td className="py-2.5 px-3 text-amber-400 font-bold">Yes (Even with $1)</td>
                <td className="py-2.5 px-3">Simple administration for high single-owner profits</td>
              </tr>
              <tr className="bg-navy-950/60 hover:bg-navy-900/40">
                <td className="py-2.5 px-3 font-bold text-gold-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-piggy-bank"></i> Stacked Trad-IRA
                </td>
                <td className="py-2.5 px-3 font-semibold tabular-nums">$7,500 ($8,600 if 50+)</td>
                <td className="py-2.5 px-3">Conditional: Only deductible if MAGI &lt; phase-out limits</td>
                <td className="py-2.5 px-3 text-slate-400">Evaluated against other plans</td>
                <td className="py-2.5 px-3">Stack only if income is below $79k (Single) / $129k (MFJ)</td>
              </tr>
              <tr className="bg-navy-950/40 hover:bg-navy-900/40">
                <td className="py-2.5 px-3 font-bold text-rose-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-heart"></i> Stacked Spousal IRA
                </td>
                <td className="py-2.5 px-3 font-semibold tabular-nums">$7,500 ($8,600 if 50+)</td>
                <td className="py-2.5 px-3 text-emerald-300 font-bold">High Potential: Deductible up to $242k–$252k MAGI</td>
                <td className="py-2.5 px-3 text-emerald-400 font-bold">No (For uncovered spouse)</td>
                <td className="py-2.5 px-3 text-emerald-300 font-bold">Primary workaround for high-income married filers</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Before vs. After Comparative Table */}
      <section className="glass-card p-6 sm:p-8 border-l-4 border-l-emerald-500 glow-emerald space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-700/60 pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <i className="fa-solid fa-scale-balanced text-emerald-400"></i> Baseline vs. Optimized ACA Health &amp; Tax Impact
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Direct comparison of your healthcare costs, Silver CSR actuarial tiers, and retained tax-deferred wealth.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-slate-400 font-semibold">Select Regional Carrier:</span>
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
                  ${strategyResult.baselineAca.netMonthlyPremium}/mo
                </td>
                <td className="py-3 px-4 text-emerald-300 font-extrabold tabular-nums">
                  ${strategyResult.optimizedAca.netMonthlyPremium}/mo
                </td>
                <td className="py-3 px-4 text-emerald-400 font-bold tabular-nums">
                  -${strategyResult.monthlySubsidyGain.toLocaleString()}/mo out-of-pocket savings
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
                  ${strategyResult.baselineAca.deductible.toLocaleString()} ded / ${strategyResult.baselineAca.primaryCopay} copay
                </td>
                <td className="py-3 px-4 text-emerald-300 font-extrabold tabular-nums">
                  ${strategyResult.optimizedAca.deductible.toLocaleString()} ded / ${strategyResult.optimizedAca.primaryCopay} copay
                </td>
                <td className="py-3 px-4 text-emerald-400 font-bold tabular-nums">
                  -${(strategyResult.baselineAca.deductible - strategyResult.optimizedAca.deductible).toLocaleString()} deductible reduction
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
      </section>

      {/* Bottom Action Card & Booking Trigger */}
      <section className="glass-card p-6 border-t-4 border-t-purple-500 glow-purple flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-purple-400 font-bold mb-1">
            <i className="fa-solid fa-check-double"></i> Fiduciary Execution Ready
          </div>
          <h4 className="text-lg font-black text-white">
            Ready to implement your Self-Employed ACA &amp; Retirement Plan?
          </h4>
          <p className="text-xs text-slate-300 mt-0.5">
            Lock in up to <strong>${strategyResult.totalPreTaxDeduction.toLocaleString()}</strong> in pre-tax write-offs and secure <strong>${strategyResult.annualSubsidyGain.toLocaleString()}</strong> in annual ACA subsidies.
          </p>
        </div>

        <button
          onClick={() => {
            SoundFX.playUnlock();
            onOpenBooking();
          }}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <i className="fa-solid fa-calendar-check"></i> Book Fiduciary Self-Employed Review
        </button>
      </section>
    </div>
  );
};
