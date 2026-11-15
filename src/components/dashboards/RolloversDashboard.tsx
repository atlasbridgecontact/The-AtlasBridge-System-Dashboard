import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  ActiveStrategySnapshot,
  ClientData,
  RolloverTransferMode,
} from '../../types';
import {
  calculateRollover1035Analysis,
  getRegionLabelForZip,
} from '../../utils/calculations';
import { SoundFX } from '../../utils/audio';

Chart.register(...registerables);

interface RolloversDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
  onUpdateStrategySnapshot?: (snapshot: ActiveStrategySnapshot) => void;
}

interface AreaAccountPreset {
  id: string;
  label: string;
  subtitle: string;
  transferMode: RolloverTransferMode;
  capital: number;
  currentFeeRate: number;
  legacySurrenderPct: number;
  costBasisPct: number;
  bonusRatePct: number;
}

const AREA_ACCOUNT_PRESETS: AreaAccountPreset[] = [
  {
    id: 'dormant_401k',
    label: '$75k Dormant 401(k)',
    subtitle: 'Former employer plan · IRC § 402(c)',
    transferMode: 'qualified_rollover',
    capital: 75000,
    currentFeeRate: 1.65,
    legacySurrenderPct: 0,
    costBasisPct: 0,
    bonusRatePct: 8,
  },
  {
    id: 'legacy_403b',
    label: '$185k Managed 403(b) / IRA',
    subtitle: 'High advisor + mutual fund drag',
    transferMode: 'qualified_rollover',
    capital: 185000,
    currentFeeRate: 1.95,
    legacySurrenderPct: 0,
    costBasisPct: 0,
    bonusRatePct: 8,
  },
  {
    id: 'annuity_1035',
    label: '$350k Outdated Annuity',
    subtitle: 'Non-Qual M&E fee trap · IRC § 1035',
    transferMode: 'exchange_1035',
    capital: 350000,
    currentFeeRate: 2.25,
    legacySurrenderPct: 4,
    costBasisPct: 60,
    bonusRatePct: 8,
  },
  {
    id: 'exec_650k',
    label: '$650k Executive Rollover',
    subtitle: 'Consolidated retirement principal lock',
    transferMode: 'qualified_rollover',
    capital: 650000,
    currentFeeRate: 1.75,
    legacySurrenderPct: 0,
    costBasisPct: 0,
    bonusRatePct: 8,
  },
];

const BONUS_TIERS = [
  { rate: 0, label: '0% Liquid', desc: 'Short surrender / liquid MYGA' },
  { rate: 5, label: '+5% Bonus', desc: 'Balanced 7-yr FIA credit' },
  { rate: 8, label: '+8% Bonus', desc: 'Max upfront institutional credit' },
] as const;

export const RolloversDashboard: React.FC<RolloversDashboardProps> = ({
  clientData,
  onChangeClientData,
  onOpenBooking,
  onUpdateStrategySnapshot,
}) => {
  const [activePresetId, setActivePresetId] = useState<string>('dormant_401k');
  const [transferMode, setTransferMode] = useState<RolloverTransferMode>('qualified_rollover');
  const [rolloverCapital, setRolloverCapital] = useState<number>(
    Math.max(20000, clientData.dormantRetirement || 75000)
  );
  const [currentFeeRate, setCurrentFeeRate] = useState<number>(1.75);
  const [legacySurrenderPct, setLegacySurrenderPct] = useState<number>(4);
  const [costBasisPct, setCostBasisPct] = useState<number>(60);
  const [bonusRatePct, setBonusRatePct] = useState<number>(8);
  const [taxBracket, setTaxBracket] = useState<number>(22);
  const [expectedGrossYield, setExpectedGrossYield] = useState<number>(6.2);

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const lastSnapshotJsonRef = useRef<string>('');

  const isMarried = clientData.filingStatus === 'married';
  const regionLabel = useMemo(() => getRegionLabelForZip(clientData.zipCode), [clientData.zipCode]);

  const analysis = useMemo(
    () =>
      calculateRollover1035Analysis({
        transferMode,
        capital: rolloverCapital,
        costBasisPct,
        currentFeeRate,
        legacySurrenderPct,
        bonusRatePct,
        clientAge: clientData.clientAge,
        taxBracket,
        expectedGrossYield,
      }),
    [
      transferMode,
      rolloverCapital,
      costBasisPct,
      currentFeeRate,
      legacySurrenderPct,
      bonusRatePct,
      clientData.clientAge,
      taxBracket,
      expectedGrossYield,
    ]
  );

  const applyPreset = (preset: AreaAccountPreset) => {
    SoundFX.playClick();
    setActivePresetId(preset.id);
    setTransferMode(preset.transferMode);
    setRolloverCapital(preset.capital);
    setCurrentFeeRate(preset.currentFeeRate);
    setLegacySurrenderPct(preset.legacySurrenderPct);
    setCostBasisPct(preset.costBasisPct);
    setBonusRatePct(preset.bonusRatePct);
    onChangeClientData({ dormantRetirement: preset.capital });
  };

  // Sync live interactive state into ActiveStrategySnapshot (deduplicated)
  useEffect(() => {
    if (!onUpdateStrategySnapshot) return;
    const modeLabel =
      transferMode === 'qualified_rollover'
        ? 'IRC § 402(c) Direct Rollover'
        : 'IRC § 1035 Non-Qualified Exchange';

    const nextSnapshot: ActiveStrategySnapshot = {
      pathId: 'rollovers',
      pathLabel: 'Rollovers & 1035 Exchanges',
      summaryHeadline: `${modeLabel} of $${rolloverCapital.toLocaleString()} preserving +$${analysis.tenYearAdvantageOverLegacy.toLocaleString()} over 10 yrs vs legacy ${currentFeeRate}% fee drag`,
      selectedCarrierOrVendor: `Tax-Free Trustee Custodian (${regionLabel})`,
      selectedTierOrOption: `${modeLabel} (+${bonusRatePct}% Upfront Bonus)`,
      sliders: [
        { label: 'Transfer Mode', value: modeLabel },
        { label: 'Transfer Principal', value: `$${rolloverCapital.toLocaleString()}` },
        { label: 'Current Legacy Fee Drag', value: `${currentFeeRate}%/yr (Assumed ${expectedGrossYield}% gross yield)` },
        {
          label: 'Client Age & Tax Bracket',
          value: `Age ${clientData.clientAge}${clientData.clientAge < 59.5 ? ' (Pre-59.5 10% Penalty Shielded)' : ''} · ${taxBracket}% Bracket`,
        },
        ...(transferMode === 'exchange_1035'
          ? [
              {
                label: '1035 Cost Basis & Exit Fee',
                value: `${costBasisPct}% Basis ($${analysis.costBasisDollar.toLocaleString()}) · ${legacySurrenderPct}% Legacy Exit Fee`,
              },
            ]
          : []),
      ],
      impactMetrics: [
        {
          label: 'Protected Starting Base (Day 1)',
          value: `$${analysis.protectedStartingBase.toLocaleString()} (+$${analysis.upfrontBonusDollar.toLocaleString()} bonus)`,
        },
        {
          label: 'Immediate Cash-Out Tax & Penalty Avoided',
          value: `$${analysis.totalCashOutErosion.toLocaleString()} ($${analysis.ordinaryTaxDollar.toLocaleString()} tax + $${analysis.earlyPenaltyDollar.toLocaleString()} penalty)`,
        },
        {
          label: '10-Yr Direct Transfer Ending Value',
          value: `$${analysis.tenYearProtectedEnd.toLocaleString()} (+$${analysis.tenYearAdvantageOverLegacy.toLocaleString()} vs Legacy)`,
        },
        {
          label: '10-Yr Cumulative Legacy Fee Drag',
          value: `$${analysis.tenYearFeeDragTotal.toLocaleString()} lost if unchanged`,
        },
      ],
    };

    const serialized = JSON.stringify(nextSnapshot);
    if (serialized === lastSnapshotJsonRef.current) return;
    lastSnapshotJsonRef.current = serialized;
    onUpdateStrategySnapshot(nextSnapshot);
  }, [
    onUpdateStrategySnapshot,
    transferMode,
    rolloverCapital,
    currentFeeRate,
    expectedGrossYield,
    clientData.clientAge,
    taxBracket,
    costBasisPct,
    legacySurrenderPct,
    bonusRatePct,
    regionLabel,
    analysis.costBasisDollar,
    analysis.protectedStartingBase,
    analysis.upfrontBonusDollar,
    analysis.totalCashOutErosion,
    analysis.ordinaryTaxDollar,
    analysis.earlyPenaltyDollar,
    analysis.tenYearProtectedEnd,
    analysis.tenYearAdvantageOverLegacy,
    analysis.tenYearFeeDragTotal,
  ]);

  // Mount Chart.js 10-year comparison chart once
  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: analysis.yearLabels,
        datasets: [
          {
            label: 'Direct Rollover / 1035 Protected Account',
            data: analysis.directTransferSeries,
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34, 211, 238, 0.12)',
            borderWidth: 3,
            tension: 0.25,
            fill: true,
          },
          {
            label: 'Stay in High-Fee Legacy Plan',
            data: analysis.stayLegacySeries,
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [6, 4],
            tension: 0.25,
            fill: false,
          },
          {
            label: 'Cash Out Today (After Tax & Penalty)',
            data: analysis.cashOutSeries,
            borderColor: '#fb7185',
            borderWidth: 2,
            borderDash: [3, 3],
            tension: 0.25,
            fill: false,
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
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
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

  // Update Chart datasets in-place (zero jitter)
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    chart.data.labels = analysis.yearLabels;
    chart.data.datasets[0].label =
      transferMode === 'qualified_rollover'
        ? 'Direct § 402(c) Rollover Protected Account'
        : 'Direct § 1035 Exchange Protected Account';
    chart.data.datasets[0].data = analysis.directTransferSeries;
    chart.data.datasets[1].data = analysis.stayLegacySeries;
    chart.data.datasets[2].data = analysis.cashOutSeries;
    chart.update('none');
  }, [
    transferMode,
    analysis.yearLabels,
    analysis.directTransferSeries,
    analysis.stayLegacySeries,
    analysis.cashOutSeries,
  ]);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-cyan-500 glow-blue space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-2xl shrink-0">
              <i className="fa-solid fa-arrow-rotate-right"></i>
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider block">
                Tax-Free Consolidation · {regionLabel}
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                Rollovers &amp; 1035 Exchange Engine
              </h3>
            </div>
          </div>

          {/* Transfer Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-navy-950 rounded-xl border border-cyan-500/40 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => {
                SoundFX.playClick();
                setActivePresetId('');
                setTransferMode('qualified_rollover');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                transferMode === 'qualified_rollover'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Qualified Rollover (§ 402c)
            </button>
            <button
              type="button"
              onClick={() => {
                SoundFX.playClick();
                setActivePresetId('');
                setTransferMode('exchange_1035');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                transferMode === 'exchange_1035'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1035 Annuity Exchange
            </button>
          </div>
        </div>

        {/* Common Local Area Account Presets */}
        <div className="bg-navy-950/90 p-4 rounded-2xl border border-navy-700/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-white flex items-center gap-2">
              <i className="fa-solid fa-location-dot text-cyan-400"></i>
              Common Local Rollover &amp; 1035 Account Presets ({regionLabel})
            </span>
            <span className="text-[11px] text-slate-400">
              Select a typical regional balance or adjust sliders manually
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {AREA_ACCOUNT_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-0.5 ${
                    isSelected
                      ? 'bg-navy-900 border-cyan-400 shadow-lg shadow-cyan-500/15'
                      : 'bg-navy-900/60 border-navy-800 hover:border-cyan-500/40'
                  }`}
                >
                  <span className={`text-xs font-extrabold block ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {preset.label}
                  </span>
                  <span className="text-[10.5px] text-slate-400 block">{preset.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Two-Column Interactive Sliders & Tax/Fee Assumptions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Capital, Fee Drag & Expected Gross Growth */}
          <div className="bg-navy-950/85 p-5 rounded-2xl border border-navy-700/80 space-y-5 shadow-xl">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-slate-300 font-bold">
                  {transferMode === 'qualified_rollover'
                    ? 'Dormant Plan Balance to Roll Over:'
                    : 'Current Annuity / Policy Transfer Capital:'}{' '}
                  {isMarried && <span className="text-gold-400 font-bold">(Household)</span>}
                </span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-cyan-500/40">
                  <span className="text-cyan-400 font-bold">$</span>
                  <input
                    type="number"
                    min={10000}
                    max={2500000}
                    step={5000}
                    value={rolloverCapital}
                    onChange={(e) => {
                      const val = Math.max(10000, parseFloat(e.target.value) || 10000);
                      setActivePresetId('');
                      setRolloverCapital(val);
                      onChangeClientData({ dormantRetirement: val });
                    }}
                    className="w-28 bg-transparent text-white font-extrabold text-sm focus:outline-none text-right tabular-nums"
                  />
                </div>
              </div>
              <input
                type="range"
                min={10000}
                max={1000000}
                step={5000}
                value={Math.min(1000000, rolloverCapital)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 10000;
                  SoundFX.playSlideHum(val / 1000000);
                  setActivePresetId('');
                  setRolloverCapital(val);
                  onChangeClientData({ dormantRetirement: val });
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                <span>$10k Min</span>
                <span>$500k</span>
                <span>$1.0M+ Principal</span>
              </div>
            </div>

            {/* Fee Drag Slider */}
            <div className="space-y-2 pt-1 border-t border-navy-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">
                  Current Custodian / Fund / M&amp;E Fee Drag:
                </span>
                <span className="text-amber-400 font-extrabold tabular-nums">
                  {currentFeeRate.toFixed(2)}% / yr
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={3.25}
                step={0.05}
                value={currentFeeRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 1.0;
                  SoundFX.playSlideHum((val - 0.5) / 2.75);
                  setActivePresetId('');
                  setCurrentFeeRate(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Expected Gross Index / Portfolio Yield */}
            <div className="space-y-2 pt-1 border-t border-navy-800">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">
                  Modeled Gross Annual Growth Rate:
                </span>
                <span className="text-emerald-400 font-extrabold tabular-nums">
                  {expectedGrossYield.toFixed(1)}% / yr
                </span>
              </div>
              <input
                type="range"
                min={4.0}
                max={8.5}
                step={0.1}
                value={expectedGrossYield}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 6.2;
                  SoundFX.playSlideHum((val - 4.0) / 4.5);
                  setExpectedGrossYield(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Right Panel: Age, Tax Bracket, Mode-Specific Surrender/Basis & Bonus Selector */}
          <div className="bg-navy-950/85 p-5 rounded-2xl border border-navy-700/80 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              {/* Age & Tax Bracket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-navy-900 p-3 rounded-xl border border-navy-800 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-bold uppercase">Client Age</span>
                    <strong className="text-white tabular-nums">
                      {clientData.clientAge} yrs {clientData.clientAge < 59.5 ? '(10% Penalty)' : ''}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={35}
                    max={80}
                    step={1}
                    value={Math.min(80, Math.max(35, clientData.clientAge))}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      SoundFX.playSlideHum((val - 35) / 45);
                      onChangeClientData({ clientAge: val });
                    }}
                    className="w-full h-1.5 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div className="bg-navy-900 p-3 rounded-xl border border-navy-800 space-y-1.5">
                  <label htmlFor="rollover-tax-bracket" className="text-[10px] text-slate-400 font-bold uppercase block">
                    Federal Ordinary Tax Bracket
                  </label>
                  <select
                    id="rollover-tax-bracket"
                    value={taxBracket}
                    onChange={(e) => setTaxBracket(parseInt(e.target.value, 10) || 22)}
                    className="w-full bg-navy-950 text-xs font-bold text-white px-2.5 py-1.5 rounded-lg border border-navy-700 focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value={12}>12% Marginal Bracket</option>
                    <option value={22}>22% Marginal Bracket</option>
                    <option value={24}>24% Marginal Bracket</option>
                    <option value={32}>32%+ Marginal Bracket</option>
                  </select>
                </div>
              </div>

              {/* 1035 Mode Specific Controls: Cost Basis & Legacy Surrender Charge */}
              {transferMode === 'exchange_1035' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-navy-900 p-3.5 rounded-xl border border-cyan-500/30">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold">Cost Basis %:</span>
                      <strong className="text-cyan-300 tabular-nums">{costBasisPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={95}
                      step={5}
                      value={costBasisPct}
                      onChange={(e) => {
                        setActivePresetId('');
                        setCostBasisPct(parseInt(e.target.value, 10));
                      }}
                      className="w-full h-1.5 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-semibold">Legacy Surrender Fee:</span>
                      <strong className="text-rose-300 tabular-nums">{legacySurrenderPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={1}
                      value={legacySurrenderPct}
                      onChange={(e) => {
                        setActivePresetId('');
                        setLegacySurrenderPct(parseInt(e.target.value, 10));
                      }}
                      className="w-full h-1.5 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-navy-900 p-3 rounded-xl border border-cyan-500/30 text-[11px] text-slate-300 leading-snug">
                  <strong className="text-cyan-300 block mb-0.5">
                    IRC § 402(c) Direct Trustee-to-Trustee Shield
                  </strong>
                  Avoids the mandatory <strong className="text-rose-300 tabular-nums">20% IRS withholding (${analysis.mandatoryWithholdingAvoided.toLocaleString()})</strong> and ordinary tax trigger assessed on indirect 60-day check distributions.
                </div>
              )}

              {/* Upfront Bonus Tier Selector */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Receiving Carrier Upfront Bonus Structure
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {BONUS_TIERS.map((tier) => {
                    const isActive = bonusRatePct === tier.rate;
                    return (
                      <button
                        key={tier.rate}
                        type="button"
                        onClick={() => {
                          SoundFX.playClick();
                          setActivePresetId('');
                          setBonusRatePct(tier.rate);
                        }}
                        className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-cyan-600/20 border-cyan-400 text-white'
                            : 'bg-navy-900 border-navy-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-xs font-extrabold block whitespace-nowrap">{tier.label}</span>
                        <span className="text-[9.5px] text-slate-400 block leading-tight mt-0.5">{tier.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Downsides (Cash-Out / Legacy Fee Drag) vs. Direct Transfer Upside */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Downsides Ledger */}
          <div className="bg-navy-950 p-5 rounded-2xl border border-rose-500/40 space-y-4">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div>
                <span className="text-[10px] text-rose-400 font-extrabold uppercase tracking-wider block">
                  Downsides of Liquidating or Doing Nothing
                </span>
                <h4 className="text-base font-extrabold text-white">Cash-Out Erosion &amp; Legacy Fee Drag</h4>
              </div>
              <span className="text-lg font-black text-rose-300 tabular-nums">
                -${analysis.totalCashOutErosion.toLocaleString()} Cash-Out Loss
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Ordinary Federal Tax if Liquidated ({taxBracket}%):</span>
                <strong className="text-rose-300 tabular-nums">-${analysis.ordinaryTaxDollar.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>IRS Early Withdrawal Penalty (&lt;Age 59.5 · {analysis.earlyPenaltyPct}%):</span>
                <strong className="text-rose-300 tabular-nums">-${analysis.earlyPenaltyDollar.toLocaleString()}</strong>
              </div>
              {transferMode === 'exchange_1035' && (
                <div className="flex justify-between text-slate-300">
                  <span>Legacy Surrender Exit Penalty ({legacySurrenderPct}%):</span>
                  <strong className="text-amber-300 tabular-nums">-${analysis.legacySurrenderFeeDollar.toLocaleString()}</strong>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-navy-800 text-xs font-extrabold">
                <span className="text-slate-200">Net Take-Home Cash if Liquidated Today:</span>
                <strong className="text-rose-300 tabular-nums">${analysis.netCashOutToday.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-amber-300 pt-1">
                <span>10-Yr Fee Drag if Left in Current Plan ({currentFeeRate.toFixed(2)}%/yr):</span>
                <strong className="tabular-nums">-${analysis.tenYearFeeDragTotal.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Direct Rollover / 1035 Upside Ledger */}
          <div className="bg-navy-950 p-5 rounded-2xl border border-cyan-500/40 space-y-4">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div>
                <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-wider block">
                  Tax-Free Direct Transfer Upside
                </span>
                <h4 className="text-base font-extrabold text-white">
                  {transferMode === 'qualified_rollover'
                    ? 'Direct IRC § 402(c) Rollover Advantage'
                    : 'Direct IRC § 1035 Tax-Free Exchange Advantage'}
                </h4>
              </div>
              <span className="text-lg font-black text-cyan-300 tabular-nums">
                ${analysis.protectedStartingBase.toLocaleString()} Day 1
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Immediate Federal Tax &amp; Penalty Trigger:</span>
                <strong className="text-emerald-400 tabular-nums">$0 (Tax-Deferred Preserved)</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Upfront Carrier Bonus Credited (+{bonusRatePct}%):</span>
                <strong className="text-cyan-300 tabular-nums">+${analysis.upfrontBonusDollar.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>10-Yr Projected Protected Account Value:</span>
                <strong className="text-gold-300 tabular-nums">${analysis.tenYearProtectedEnd.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-navy-800 text-xs font-extrabold">
                <span className="text-slate-200">10-Yr Net Advantage vs. Legacy Plan:</span>
                <strong className="text-emerald-400 tabular-nums">
                  +${analysis.tenYearAdvantageOverLegacy.toLocaleString()}
                </strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3">
              <div className="text-[11px] text-cyan-100 leading-snug">
                <strong>10-Yr Advantage vs. Cash-Out:</strong>{' '}
                <span className="text-emerald-300 font-extrabold tabular-nums">
                  +${analysis.tenYearAdvantageOverCashOut.toLocaleString()}
                </span>{' '}
                compounded wealth retained.
              </div>
              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  onOpenBooking();
                }}
                className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Execute Direct Transfer
              </button>
            </div>
          </div>
        </div>

        {/* 10-Year Growth Comparison Chart */}
        <div className="bg-navy-950/90 p-5 sm:p-6 rounded-2xl border border-navy-700/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-navy-800 pb-3">
            <div>
              <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-wider block">
                10-Year Compounded Wealth Trajectory ({expectedGrossYield.toFixed(1)}% Gross Baseline)
              </span>
              <h4 className="text-base sm:text-xl font-black text-white">
                Direct Transfer vs. High-Fee Legacy Plan vs. Cash-Out
              </h4>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              Starting Balance: ${rolloverCapital.toLocaleString()} · Fee Drag: {currentFeeRate.toFixed(2)}%
            </span>
          </div>

          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 h-72 sm:h-80">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>

        {/* Fiduciary Protocol Checklist */}
        <div className="bg-navy-950 p-4 sm:p-5 rounded-xl border border-navy-800 space-y-2.5 text-xs text-slate-300">
          <h4 className="font-extrabold text-cyan-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-list-check"></i>{' '}
            {transferMode === 'qualified_rollover'
              ? 'IRC § 402(c) Direct Rollover Fiduciary Safeguards'
              : 'IRC § 1035 Non-Qualified Exchange Safeguards'}
          </h4>
          {transferMode === 'qualified_rollover' ? (
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Direct Trustee-to-Trustee Transfer:</strong> Funds move FBO You, bypassing mandatory 20% federal withholding and the 60-day constructive receipt trap (Form 1099-R Code G).
              </li>
              <li>
                <strong>Eliminates Legacy Plan Drag:</strong> Replaces opaque target-date expense ratios and administrative wrap fees with transparent principal-protected growth.
              </li>
            </ul>
          ) : (
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Preserves Original Tax Basis:</strong> Carrier-to-carrier Section 1035 assignment transfers your{' '}
                <strong className="tabular-nums">${analysis.costBasisDollar.toLocaleString()}</strong> cost basis without triggering ordinary income tax on embedded gains.
              </li>
              <li>
                <strong>Drops M&amp;E and Rider Drag:</strong> Replaces legacy variable annuity mortality &amp; expense fees with zero-market-loss indexed caps and Day-1 bonus protection.
              </li>
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
