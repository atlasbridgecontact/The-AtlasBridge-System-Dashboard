import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  AcaMetalTier,
  ActiveStrategySnapshot,
  ClientData,
  HealthCarrierId,
  UtilizationScenarioId,
} from '../../types';
import {
  calculateAcaTierProjection,
  calculatePrivatePpoEstimate,
  getHouseholdSize,
} from '../../utils/calculations';
import { REGIONAL_HEALTH_CARRIERS } from '../../utils/constants';
import { SoundFX } from '../../utils/audio';
import { ProviderNetworkMap } from './ProviderNetworkMap';

Chart.register(...registerables);

interface TraditionalAcaDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
  onUpdateStrategySnapshot?: (snapshot: ActiveStrategySnapshot) => void;
  onNavigateToPrivateHealth?: () => void;
}

const SCENARIO_META: Record<
  UtilizationScenarioId,
  { label: string; shortLabel: string; desc: string }
> = {
  low: {
    label: 'Low / Preventive Care Only',
    shortLabel: 'Low Usage',
    desc: '$0 ACA preventive wellness checkups plus 2–3 routine doctor/generic Rx visits.',
  },
  moderate: {
    label: 'Moderate Care (Outpatient & Rx)',
    shortLabel: 'Moderate Usage',
    desc: 'Diagnostic labs, specialist follow-ups, imaging, and ongoing brand/tier prescriptions.',
  },
  catastrophic: {
    label: 'High / Catastrophic Max OOP Ceiling',
    shortLabel: 'Max OOP Event',
    desc: 'Major hospitalization, surgery, or ER trauma reaching the plan statutory OOP cap.',
  },
};

export const TraditionalAcaDashboard: React.FC<TraditionalAcaDashboardProps> = ({
  clientData,
  onChangeClientData,
  onOpenBooking,
  onUpdateStrategySnapshot,
  onNavigateToPrivateHealth,
}) => {
  const [selectedTier, setSelectedTier] = useState<AcaMetalTier>('silver');
  const [utilizationScenario, setUtilizationScenario] = useState<UtilizationScenarioId>('moderate');
  const [isProviderMapOpen, setIsProviderMapOpen] = useState<boolean>(false);
  const [isPrivateModalOpen, setIsPrivateModalOpen] = useState<boolean>(false);

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const lastSnapshotJsonRef = useRef<string>('');

  const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);
  const carrier = useMemo(
    () =>
      REGIONAL_HEALTH_CARRIERS.find((c) => c.id === clientData.selectedHealthCarrier) ||
      REGIONAL_HEALTH_CARRIERS[0],
    [clientData.selectedHealthCarrier]
  );

  // Memoize projection strictly on primitive inputs to prevent Chart & snapshot render thrashing
  const { baseAca, tiers } = useMemo(
    () =>
      calculateAcaTierProjection({
        agi: clientData.grossAGI,
        householdSize,
        clientAge: clientData.clientAge,
        carrierId: carrier.id,
        scenario: utilizationScenario,
        taxYear: clientData.taxYear,
      }),
    [
      clientData.grossAGI,
      householdSize,
      clientData.clientAge,
      carrier.id,
      utilizationScenario,
      clientData.taxYear,
    ]
  );

  const privateQuote = useMemo(
    () =>
      calculatePrivatePpoEstimate({
        clientAge: clientData.clientAge,
        householdSize,
        tobacco: clientData.tobacco,
        preExisting: clientData.preExisting,
      }),
    [clientData.clientAge, householdSize, clientData.tobacco, clientData.preExisting]
  );

  const activeTierData = tiers[selectedTier];
  const scenarioInfo = SCENARIO_META[utilizationScenario];
  const annualSubsidyTotal = baseAca.monthlySubsidy * 12;

  const isMarried = clientData.filingStatus === 'married';
  const expectedContribPctDisplay = baseAca.isBelow100Fpl
    ? 'Below 100% FPL Min'
    : baseAca.isAbove400Cliff
    ? 'Over 400% Cliff'
    : `${(baseAca.expectedContribPct * 100).toFixed(2)}%`;

  // Show Private Coverage Popup toggle whenever client exceeds exact 250% FPL (no Silver CSR) or receives $0 APTC
  const showPrivateCoveragePrompt = baseAca.exactFplPct > 250 || baseAca.monthlySubsidy === 0;

  // Close modal cleanly with Escape key
  useEffect(() => {
    if (!isPrivateModalOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPrivateModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isPrivateModalOpen]);

  // Sync live interactive state into ActiveStrategySnapshot (deduplicated to eliminate render loops)
  useEffect(() => {
    if (!onUpdateStrategySnapshot) return;
    const nextSnapshot: ActiveStrategySnapshot = {
      pathId: 'traditional_aca',
      pathLabel: 'Traditional ACA Signup',
      summaryHeadline: `${activeTierData.title} via ${carrier.name} on unadjusted $${clientData.grossAGI.toLocaleString()} AGI (${baseAca.fplPct}% FPL)`,
      selectedCarrierOrVendor: carrier.name,
      selectedTierOrOption: `${activeTierData.badge} · ${scenarioInfo.shortLabel}`,
      sliders: [
        { label: 'Target Tax Year', value: clientData.taxYear },
        {
          label: 'Unadjusted Gross Annual AGI (Slider)',
          value: `$${clientData.grossAGI.toLocaleString()}/yr (${baseAca.fplPct}% FPL)`,
        },
        { label: 'Selected Carrier', value: carrier.name },
        { label: 'Selected Metal Tier', value: `${activeTierData.title} (${activeTierData.avLabel})` },
        { label: 'Projected Care Utilization Scenario', value: scenarioInfo.label },
        { label: 'Service ZIP Code', value: clientData.zipCode || '34994' },
      ],
      impactMetrics: [
        {
          label: 'Monthly & Annual Federal APTC Subsidy',
          value: `$${baseAca.monthlySubsidy.toLocaleString()}/mo ($${annualSubsidyTotal.toLocaleString()}/yr)`,
        },
        {
          label: 'Active Tier Net Premium',
          value: `$${activeTierData.monthlyPremium.toLocaleString()}/mo ($${activeTierData.annualPremium.toLocaleString()}/yr)`,
        },
        {
          label: 'Active Tier Deductible & Max OOP Cap',
          value: `$${activeTierData.deductible.toLocaleString()} Deductible | $${activeTierData.applicableOopMax.toLocaleString()} Max OOP`,
        },
        {
          label: 'Estimated Medical Out-of-Pocket Spend',
          value: `$${activeTierData.scenarioOopEstimate.toLocaleString()}/yr (${scenarioInfo.shortLabel})`,
        },
        {
          label: 'Total Projected Annual Healthcare Cost',
          value: `$${activeTierData.totalProjectedAnnualCost.toLocaleString()}/yr (All-In)`,
        },
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
    clientData.zipCode,
    carrier.name,
    activeTierData.title,
    activeTierData.badge,
    activeTierData.avLabel,
    activeTierData.monthlyPremium,
    activeTierData.annualPremium,
    activeTierData.deductible,
    activeTierData.applicableOopMax,
    activeTierData.scenarioOopEstimate,
    activeTierData.totalProjectedAnnualCost,
    baseAca.fplPct,
    baseAca.monthlySubsidy,
    annualSubsidyTotal,
    scenarioInfo.label,
    scenarioInfo.shortLabel,
  ]);

  // Create Chart.js instance ONCE on mount and destroy strictly on unmount
  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Bronze (60% AV)', `Silver (${tiers.silver.avLabel})`, 'Gold (80% AV)'],
        datasets: [
          {
            label: 'Annual Net Premiums Paid',
            data: [
              tiers.bronze.annualPremium,
              tiers.silver.annualPremium,
              tiers.gold.annualPremium,
            ],
            backgroundColor: '#10b981',
          },
          {
            label: `Est. Medical Out-of-Pocket (${scenarioInfo.shortLabel})`,
            data: [
              tiers.bronze.scenarioOopEstimate,
              tiers.silver.scenarioOopEstimate,
              tiers.gold.scenarioOopEstimate,
            ],
            backgroundColor: '#f59e0b',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Poppins', size: 11 } },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            stacked: true,
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: (v) => '$' + Number(v).toLocaleString(),
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // Update Chart datasets cleanly in-place (zero destroy/recreate jitter on slider drags)
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    chart.data.labels = ['Bronze (60% AV)', `Silver (${tiers.silver.avLabel})`, 'Gold (80% AV)'];
    chart.data.datasets[0].data = [
      tiers.bronze.annualPremium,
      tiers.silver.annualPremium,
      tiers.gold.annualPremium,
    ];
    chart.data.datasets[1].label = `Est. Medical Out-of-Pocket (${scenarioInfo.shortLabel})`;
    chart.data.datasets[1].data = [
      tiers.bronze.scenarioOopEstimate,
      tiers.silver.scenarioOopEstimate,
      tiers.gold.scenarioOopEstimate,
    ];
    chart.update('none');
  }, [
    tiers.bronze.annualPremium,
    tiers.silver.annualPremium,
    tiers.gold.annualPremium,
    tiers.bronze.scenarioOopEstimate,
    tiers.silver.scenarioOopEstimate,
    tiers.gold.scenarioOopEstimate,
    tiers.silver.avLabel,
    scenarioInfo.shortLabel,
  ]);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-emerald-500 glow-emerald space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl shrink-0">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-500/30 mb-1">
                <i className="fa-solid fa-scale-balanced"></i> {clientData.taxYear} CMS ACA Guidelines · Total Cost Explorer
              </div>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                Traditional ACA Exchange Cost &amp; Carrier Explorer
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 bg-navy-950 p-3 rounded-2xl border border-emerald-500/40 shadow-xl self-start lg:self-auto">
            <div className="flex items-center gap-2 bg-navy-900/90 px-3 py-1.5 rounded-xl border border-navy-700">
              <span className="text-xs text-emerald-400 font-bold whitespace-nowrap">
                <i className="fa-solid fa-users mr-1"></i> Household:
              </span>
              <span className="text-xs font-extrabold text-white tabular-nums">
                {householdSize} ({baseAca.fplPct}% FPL)
              </span>
            </div>
            <div className="h-6 w-px bg-navy-700 hidden sm:block"></div>
            <div className="flex items-center gap-2 bg-navy-900/90 px-3 py-1.5 rounded-xl border border-navy-700">
              <label
                htmlFor="trad-aca-tax-year"
                className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="fa-solid fa-calendar-days"></i> Tax Year:
              </label>
              <select
                id="trad-aca-tax-year"
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

        {/* Two-Column Interactive Income & Care Utilization Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Gross AGI Slider & Statutory ACA Eligibility Box */}
          <div className="bg-navy-950/85 p-5 rounded-2xl border border-navy-700/80 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-slate-300 font-bold">
                    <i className="fa-solid fa-wallet text-emerald-400 mr-1.5"></i> Unadjusted Gross Annual AGI{' '}
                    {isMarried && <span className="text-gold-400 font-bold">(Household Joint)</span>}:
                  </span>
                  <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                    <span className="text-emerald-400 font-bold">$</span>
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
                      className="w-24 bg-transparent text-white font-extrabold text-sm focus:outline-none text-right tabular-nums"
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
                  className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium px-0.5 tabular-nums">
                  <span>$0 Min</span>
                  <span>100% FPL: ${baseAca.fpl100.toLocaleString()}</span>
                  <span>400% Cliff: ${(baseAca.fpl100 * 4).toLocaleString()}</span>
                </div>
              </div>

              {/* Statutory ACA Eligibility & Subsidy Impact Box */}
              <div className="bg-navy-900 p-3.5 rounded-xl border border-emerald-500/40 space-y-3 text-xs">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
                    <i className="fa-solid fa-landmark mr-1"></i> Statutory ACA APTC &amp; CSR Bracket
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded border tabular-nums ${
                      baseAca.monthlySubsidy === 0
                        ? 'text-rose-300 bg-rose-500/15 border-rose-500/40'
                        : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
                    }`}
                  >
                    {baseAca.isBelow100Fpl
                      ? '$0 APTC (Below 100% FPL Min)'
                      : baseAca.isAbove400Cliff
                      ? '$0 APTC (Above 400% FPL Cliff)'
                      : `+$${baseAca.monthlySubsidy.toLocaleString()}/mo APTC ($${annualSubsidyTotal.toLocaleString()}/yr)`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-navy-950 p-2 rounded border border-navy-800">
                    <span className="text-[9px] text-slate-400 block font-semibold">Household FPL %</span>
                    <strong className="text-white font-extrabold tabular-nums">{baseAca.fplPct}% FPL</strong>
                  </div>
                  <div className="bg-navy-950 p-2 rounded border border-navy-800">
                    <span className="text-[9px] text-slate-400 block font-semibold">IRC § 36B Income Cap</span>
                    <strong className="text-blue-300 font-extrabold tabular-nums">{expectedContribPctDisplay}</strong>
                  </div>
                  <div className="bg-navy-950 p-2 rounded border border-navy-800">
                    <span className="text-[9px] text-slate-400 block font-semibold">SLCSP Benchmark</span>
                    <strong className="text-gold-400 font-extrabold tabular-nums">
                      ${baseAca.benchmarkCostMonthly.toLocaleString()}/mo
                    </strong>
                  </div>
                </div>

                {baseAca.isBelow100Fpl && (
                  <div className="text-[10.5px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg">
                    <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                    <strong>Below 100% FPL Coverage Gap (&lt;${baseAca.fpl100.toLocaleString()}/yr):</strong> Under IRC § 36B, ACA APTC subsidies start at 100% FPL. Check state Medicaid eligibility first.
                  </div>
                )}

                {!baseAca.isBelow100Fpl && baseAca.isMedicaidRange && (
                  <div className="text-[10.5px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg">
                    <i className="fa-solid fa-circle-info mr-1"></i>
                    <strong>Medicaid &amp; 94% CSR Range (100%–138% FPL):</strong> Depending on state expansion/categorical rules, household may qualify for Medicaid or 94% Silver CSR.
                  </div>
                )}

                {baseAca.isAbove400Cliff && (
                  <div className="text-[10.5px] text-rose-300 bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg">
                    <i className="fa-solid fa-circle-info mr-1"></i>
                    <strong>400% FPL Statutory Cliff Active:</strong> Without pre-tax MAGI reduction below ${(baseAca.fpl100 * 4).toLocaleString()}/yr, unadjusted enrollment pays full non-subsidized carrier rates.
                  </div>
                )}

                {/* Conditional Private Coverage Toggle inside Eligibility Card when ACA benefits are limited */}
                {showPrivateCoveragePrompt && (
                  <div className="bg-purple-500/10 border border-purple-500/40 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="text-[11px] text-purple-200 leading-snug">
                      <strong className="text-purple-300 block">
                        <i className="fa-solid fa-user-shield mr-1"></i>{' '}
                        {baseAca.monthlySubsidy > 0
                          ? `No Silver CSR (>250% FPL) — +$${baseAca.monthlySubsidy.toLocaleString()}/mo APTC Active`
                          : 'Limited ACA Benefits Detected ($0 APTC)'}
                      </strong>
                      {baseAca.monthlySubsidy > 0
                        ? 'CSR deductible help ends above 250% FPL (Standard 70% Silver applies), while federal APTC subsidies stay active up to 400% FPL. Compare Private PPO plans side-by-side.'
                        : `Household is ${baseAca.isBelow100Fpl ? 'below the 100% FPL minimum' : 'above the 400% FPL cliff'} ($0 APTC). Preview medically underwritten Private PPO options calibrated to your profile.`}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        SoundFX.playClick();
                        setIsPrivateModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md shadow-purple-500/20"
                    >
                      <i className="fa-solid fa-layer-group mr-1"></i> Preview Private Coverage
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-navy-800/80 text-[10.5px] text-slate-400 flex items-center justify-between gap-2">
              <span>{clientData.taxYear} CMS Statutory Max OOP Limit:</span>
              <strong className="text-slate-200 tabular-nums">
                ${baseAca.statutoryIndOopMax.toLocaleString()} Individual / ${baseAca.statutoryFamOopMax.toLocaleString()} Family
              </strong>
            </div>
          </div>

          {/* Right Panel: Utilization Scenario Selector & Active Tier Total Cost Projection */}
          <div className="bg-navy-950/90 p-5 rounded-2xl border border-gold-500/40 space-y-4 shadow-xl glow-gold flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <i className="fa-solid fa-calculator text-gold-400"></i>
                    <span>Annual Medical Utilization Scenario</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Stress-test total annual healthcare spend (Premiums + Deductible/Copays up to Max OOP).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(Object.keys(SCENARIO_META) as UtilizationScenarioId[]).map((key) => {
                  const meta = SCENARIO_META[key];
                  const isActive = utilizationScenario === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        SoundFX.playClick();
                        setUtilizationScenario(key);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                        isActive
                          ? 'bg-navy-900 border-2 border-gold-500 shadow-lg shadow-gold-500/15'
                          : 'bg-navy-900/60 border-navy-800 hover:border-slate-600'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-extrabold uppercase block ${
                          isActive ? 'text-gold-400' : 'text-slate-400'
                        }`}
                      >
                        {meta.shortLabel}
                      </span>
                      <p className="text-[10px] text-slate-300 leading-snug">{meta.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Tier Total Projected Cost Summary Box with Monthly Breakdown under Annual Net Premiums */}
            <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs border-b border-navy-800 pb-2 gap-2">
                <span className="text-slate-300 font-bold truncate">
                  Selected Plan Total Cost ({activeTierData.badge}):
                </span>
                <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                  {carrier.name}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs items-start">
                <div>
                  <span className="text-[10px] text-slate-400 block">Annual Net Premiums</span>
                  <strong className="text-white font-extrabold tabular-nums block text-sm">
                    ${activeTierData.annualPremium.toLocaleString()} / yr
                  </strong>
                  <span className="text-[11px] text-emerald-300 font-bold tabular-nums block mt-0.5">
                    ${activeTierData.monthlyPremium.toLocaleString()} / mo × 12
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Est. Care OOP ({scenarioInfo.shortLabel})</span>
                  <strong className="text-amber-400 font-extrabold tabular-nums block text-sm">
                    +${activeTierData.scenarioOopEstimate.toLocaleString()}
                  </strong>
                  <span className="text-[10.5px] text-slate-400 tabular-nums block mt-0.5">
                    ~${Math.round(activeTierData.scenarioOopEstimate / 12).toLocaleString()} / mo avg
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gold-300 font-bold block">Total Projected Spend</span>
                  <strong className="text-gold-400 font-black text-base sm:text-lg tabular-nums block">
                    ${activeTierData.totalProjectedAnnualCost.toLocaleString()} / yr
                  </strong>
                  <span className="text-[11px] text-gold-300/90 font-semibold tabular-nums block mt-0.5">
                    ~${Math.round(activeTierData.totalProjectedAnnualCost / 12).toLocaleString()} / mo all-in
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Carrier Selector & Local Provider Map Banner */}
        <div className="bg-navy-950 p-5 rounded-xl border border-blue-500/50 space-y-4 glow-blue">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/80 pb-3">
            <div>
              <h4 className="text-base sm:text-lg font-extrabold text-white">
                Active Plan Selection: <span className="text-emerald-400">{activeTierData.title}</span> ({activeTierData.avLabel})
              </h4>
              <p className="text-[11px] text-slate-400">
                Carrier: <strong className="text-blue-400">{carrier.name}</strong> — {activeTierData.carrierPositionNote}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-navy-900 px-3 py-1.5 rounded-lg border border-emerald-500/40">
                <label
                  htmlFor="trad-aca-carrier-select"
                  className="text-xs text-emerald-300 font-semibold whitespace-nowrap cursor-pointer"
                >
                  <i className="fa-solid fa-hospital mr-1"></i> Carrier Option:
                </label>
                <select
                  id="trad-aca-carrier-select"
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
                <span>
                  {isProviderMapOpen ? 'Hide Providers Map' : `Local Providers (${clientData.zipCode || '34994'})`}
                </span>
              </button>

              {showPrivateCoveragePrompt && (
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    setIsPrivateModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-purple-500/50 bg-purple-600/20 hover:bg-purple-600/35 text-purple-200 text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <i className="fa-solid fa-user-shield text-purple-300"></i>
                  <span>Private PPO Options</span>
                </button>
              )}
            </div>
          </div>

          {isProviderMapOpen && (
            <ProviderNetworkMap
              zipCode={clientData.zipCode || '34994'}
              onChangeZipCode={(zip) => onChangeClientData({ zipCode: zip })}
              carrier={carrier}
              onChangeCarrier={(carrierId) => onChangeClientData({ selectedHealthCarrier: carrierId })}
              selectedTier={selectedTier}
              displayPlanName={activeTierData.title}
            />
          )}
        </div>

        {/* Interactive Metal Tier Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['bronze', 'silver', 'gold'] as AcaMetalTier[]).map((tierKey) => {
            const tier = tiers[tierKey];
            const isSelected = selectedTier === tierKey;
            const accentClass =
              tierKey === 'bronze'
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                : tierKey === 'silver'
                ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40'
                : 'text-gold-400 bg-gold-500/10 border-gold-500/30';

            return (
              <button
                key={tierKey}
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setSelectedTier(tierKey);
                }}
                className={`bg-navy-950 p-5 rounded-2xl text-left transition-all flex flex-col justify-between space-y-4 cursor-pointer ${
                  isSelected
                    ? 'border-2 border-emerald-500 glow-emerald shadow-xl'
                    : 'border border-navy-700 hover:border-emerald-500/40'
                }`}
              >
                <div className="space-y-3 w-full">
                  <div className="flex justify-between items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${accentClass}`}>
                      {tier.badge}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-300 shrink-0">
                      {isSelected ? (
                        <span className="text-emerald-400">
                          <i className="fa-solid fa-circle-check mr-1"></i>Selected
                        </span>
                      ) : (
                        'Select Tier'
                      )}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-white">{tier.title}</h4>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-emerald-400 tabular-nums">
                        ${tier.monthlyPremium.toLocaleString()} / mo
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        (${tier.annualPremium.toLocaleString()}/yr)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-navy-800 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Annual Deductible:</span>
                      <strong className="text-white tabular-nums">${tier.deductible.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{clientData.taxYear} Max OOP Cap:</span>
                      <strong className="text-purple-300 tabular-nums">
                        ${tier.applicableOopMax.toLocaleString()} {baseAca.isFamily ? '(Fam)' : '(Ind)'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Primary Care Visit:</span>
                      <strong className="text-slate-200">{tier.primaryCopayLabel}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. OOP ({scenarioInfo.shortLabel}):</span>
                      <strong className="text-amber-400 tabular-nums">+${tier.scenarioOopEstimate.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                <div className="w-full pt-3 border-t border-navy-800 flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-bold">Total Annual Cost:</span>
                  <strong className="text-gold-400 font-black text-base tabular-nums">
                    ${tier.totalProjectedAnnualCost.toLocaleString()} / yr
                  </strong>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stacked Total Annual Cost Projection Chart + Action CTA */}
        <div className="bg-navy-950/90 p-5 sm:p-6 rounded-2xl border border-navy-700/80 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-800 pb-3">
            <div>
              <span className="text-[10px] text-gold-400 font-extrabold uppercase tracking-wider block">
                Premium + Deductible + OOP Utilization Stress-Test
              </span>
              <h4 className="text-base sm:text-xl font-black text-white">
                Total Annual Healthcare Exposure Comparison ({carrier.name})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                SoundFX.playClick();
                onOpenBooking();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-calendar-check"></i> Lock {carrier.name} Enrollment Quote
            </button>
          </div>

          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 h-72 sm:h-80">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>
      </section>

      {/* Private Coverage Preview Modal (shown when ACA benefits are limited or APTC is $0) */}
      {isPrivateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm"
            onClick={() => setIsPrivateModalOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="private-coverage-modal-title"
            className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto glass-card p-6 sm:p-7 border-l-4 border-l-purple-500 glow-purple bg-navy-950 space-y-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-navy-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-300 text-xl shrink-0">
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                  <span className="text-[10px] text-purple-300 font-extrabold uppercase tracking-wider block">
                    Year-Round Medically Underwritten Alternative
                  </span>
                  <h4 id="private-coverage-modal-title" className="text-lg sm:text-2xl font-black text-white">
                    Potential Private PPO Coverage Comparison
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivateModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-navy-900 hover:bg-navy-800 border border-navy-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Pre-Existing Condition Underwriting & Eligibility Callout */}
            {privateQuote.hasPreExisting ? (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-2 text-xs">
                <div className="font-extrabold text-amber-300 flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  Pre-Existing Condition Underwriting Alert: Rate-Up &amp; Guaranteed-Issue Comparison
                </div>
                <p className="text-amber-100/90 leading-relaxed">
                  You indicated <strong>Pre-Existing Conditions: Yes</strong>. Because private PPO health plans are medically underwritten, underwriters may apply a <strong>+35% to +60% rate-up surcharge</strong>, attach condition exclusion riders, or decline coverage for active/severe conditions. Traditional ACA plans remain <strong>Guaranteed-Issue</strong> (no health questions, all pre-existing conditions covered Day 1).
                </p>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-4 space-y-1.5 text-xs">
                <div className="font-extrabold text-emerald-300 flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i>
                  No Pre-Existing Conditions Reported — Preferred Underwriting Tier Eligible
                </div>
                <p className="text-emerald-100/90 leading-relaxed">
                  Calibrated for age <strong>{clientData.clientAge}</strong>, household size <strong>{householdSize}</strong>, and{' '}
                  <strong>{clientData.tobacco === 'yes' ? 'Tobacco' : 'Non-Tobacco'}</strong> rating with Nationwide PPO access and $0 ACA open enrollment deadline restrictions.
                </p>
              </div>
            )}

            {/* Side-by-Side Private PPO vs Guaranteed-Issue Traditional ACA */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Med-Guard Preferred PPO */}
              <div className="bg-navy-900 p-4 rounded-xl border border-purple-500/50 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/40 inline-block">
                    Med-Guard Preferred PPO
                  </span>
                  <div className="text-xl font-black text-white tabular-nums">
                    {privateQuote.hasPreExisting
                      ? `$${privateQuote.preferredRatedLowMonthly.toLocaleString()}–$${privateQuote.preferredRatedHighMonthly.toLocaleString()}`
                      : `$${privateQuote.preferredMonthly.toLocaleString()}`}{' '}
                    <span className="text-xs font-bold text-slate-400">/ mo</span>
                  </div>
                  {privateQuote.hasPreExisting && (
                    <span className="text-[10px] text-amber-300 block font-semibold tabular-nums">
                      Est. +35%–60% rated (Base preferred: ${privateQuote.preferredMonthly.toLocaleString()}/mo)
                    </span>
                  )}
                  <div className="space-y-1 text-[11px] text-slate-300 pt-2 border-t border-navy-800">
                    <div className="flex justify-between"><span>Annualized:</span> <strong className="text-white tabular-nums">${((privateQuote.hasPreExisting ? privateQuote.preferredRatedLowMonthly : privateQuote.preferredMonthly) * 12).toLocaleString()}+/yr</strong></div>
                    <div className="flex justify-between"><span>Deductible:</span> <strong className="tabular-nums">${privateQuote.preferredDeductible.toLocaleString()}</strong></div>
                    <div className="flex justify-between"><span>Max OOP:</span> <strong className="text-emerald-300 tabular-nums">${privateQuote.preferredOopMax.toLocaleString()}</strong></div>
                    <div className="flex justify-between"><span>Underwriting:</span> <strong className={privateQuote.hasPreExisting ? 'text-amber-300' : 'text-emerald-300'}>{privateQuote.hasPreExisting ? 'Rated / Review' : 'Preferred'}</strong></div>
                  </div>
                </div>
              </div>

              {/* Choice Value PPO */}
              <div className="bg-navy-900 p-4 rounded-xl border border-navy-700 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded border border-blue-500/30 inline-block">
                    Choice Value PPO
                  </span>
                  <div className="text-xl font-black text-white tabular-nums">
                    {privateQuote.hasPreExisting
                      ? `$${privateQuote.choiceRatedLowMonthly.toLocaleString()}–$${privateQuote.choiceRatedHighMonthly.toLocaleString()}`
                      : `$${privateQuote.choiceValueMonthly.toLocaleString()}`}{' '}
                    <span className="text-xs font-bold text-slate-400">/ mo</span>
                  </div>
                  {privateQuote.hasPreExisting && (
                    <span className="text-[10px] text-amber-300 block font-semibold tabular-nums">
                      Est. +35%–60% rated (Base preferred: ${privateQuote.choiceValueMonthly.toLocaleString()}/mo)
                    </span>
                  )}
                  <div className="space-y-1 text-[11px] text-slate-300 pt-2 border-t border-navy-800">
                    <div className="flex justify-between"><span>Annualized:</span> <strong className="text-white tabular-nums">${((privateQuote.hasPreExisting ? privateQuote.choiceRatedLowMonthly : privateQuote.choiceValueMonthly) * 12).toLocaleString()}+/yr</strong></div>
                    <div className="flex justify-between"><span>Deductible:</span> <strong className="tabular-nums">${privateQuote.choiceDeductible.toLocaleString()}</strong></div>
                    <div className="flex justify-between"><span>Max OOP:</span> <strong className="text-emerald-300 tabular-nums">${privateQuote.choiceOopMax.toLocaleString()}</strong></div>
                    <div className="flex justify-between"><span>Underwriting:</span> <strong className={privateQuote.hasPreExisting ? 'text-amber-300' : 'text-emerald-300'}>{privateQuote.hasPreExisting ? 'Rated / Review' : 'Preferred'}</strong></div>
                  </div>
                </div>
              </div>

              {/* Guaranteed-Issue Traditional ACA Baseline */}
              <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/40 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 inline-block">
                    Your Selected ACA Tier
                  </span>
                  <div className="text-xl font-black text-emerald-400 tabular-nums">
                    ${activeTierData.monthlyPremium.toLocaleString()}{' '}
                    <span className="text-xs font-bold text-slate-400">/ mo</span>
                  </div>
                  <span className="text-[10px] text-emerald-300/90 block font-semibold">
                    Guaranteed Issue (All Pre-Existing Covered)
                  </span>
                  <div className="space-y-1 text-[11px] text-slate-300 pt-2 border-t border-navy-800">
                    <div className="flex justify-between"><span>Annualized:</span> <strong className="text-white tabular-nums">${activeTierData.annualPremium.toLocaleString()}/yr</strong></div>
                    <div className="flex justify-between"><span>Deductible:</span> <strong className="tabular-nums">${activeTierData.deductible.toLocaleString()}</strong></div>
                    <div className="flex justify-between"><span>Max OOP:</span> <strong className="text-purple-300 tabular-nums">${activeTierData.applicableOopMax.toLocaleString()}</strong></div>
                    <div className="flex justify-between"><span>Guarantee:</span> <strong className="text-emerald-400">100% Guaranteed</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsPrivateModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-700 text-xs font-bold text-slate-200 cursor-pointer"
              >
                Return to Traditional ACA
              </button>
              <button
                type="button"
                onClick={() => {
                  SoundFX.playUnlock();
                  setIsPrivateModalOpen(false);
                  if (onNavigateToPrivateHealth) {
                    onNavigateToPrivateHealth();
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-right-to-bracket"></i>
                <span>Go to Private Health Insurance Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

