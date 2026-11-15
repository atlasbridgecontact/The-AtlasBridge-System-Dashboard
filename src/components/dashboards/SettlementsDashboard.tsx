import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  ActiveStrategySnapshot,
  ClientData,
  SettlementHealthRating,
  SettlementPolicyType,
} from '../../types';
import {
  calculateLifeSettlementAnalysis,
  getCorrelatedCsvForPolicy,
  getRegionLabelForZip,
} from '../../utils/calculations';
import { SoundFX } from '../../utils/audio';

Chart.register(...registerables);

interface SettlementsDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
  onUpdateStrategySnapshot?: (snapshot: ActiveStrategySnapshot) => void;
}

interface AreaPolicyPreset {
  id: string;
  label: string;
  subtitle: string;
  policyType: SettlementPolicyType;
  faceValue: number;
  insuredAge: number;
  healthRating: SettlementHealthRating;
}

const AREA_POLICY_PRESETS: AreaPolicyPreset[] = [
  {
    id: 'term_250',
    label: '$250k Convertible Term',
    subtitle: 'Common expiring term · $0 CSV',
    policyType: 'convertible_term',
    faceValue: 250000,
    insuredAge: 68,
    healthRating: 'mild_change',
  },
  {
    id: 'ul_500',
    label: '$500k Universal Life',
    subtitle: 'Most common local UL policy',
    policyType: 'universal_life',
    faceValue: 500000,
    insuredAge: 72,
    healthRating: 'mild_change',
  },
  {
    id: 'wl_1m',
    label: '$1.0M Whole Life',
    subtitle: 'Retiree cash-accumulation contract',
    policyType: 'whole_life',
    faceValue: 1000000,
    insuredAge: 74,
    healthRating: 'impaired',
  },
  {
    id: 'iul_2m',
    label: '$2.0M Estate IUL',
    subtitle: 'High-net-worth coastal policy',
    policyType: 'iul',
    faceValue: 2000000,
    insuredAge: 76,
    healthRating: 'mild_change',
  },
];

const POLICY_TYPE_OPTIONS: Array<{ id: SettlementPolicyType; label: string }> = [
  { id: 'universal_life', label: 'Universal Life (UL / GUL)' },
  { id: 'whole_life', label: 'Whole Life' },
  { id: 'iul', label: 'Indexed UL (IUL)' },
  { id: 'convertible_term', label: 'Convertible Term' },
];

const HEALTH_RATING_OPTIONS: Array<{ id: SettlementHealthRating; label: string; hint: string }> = [
  { id: 'standard', label: 'Standard', hint: 'Good health' },
  { id: 'mild_change', label: 'Mild Change', hint: 'Typical senior' },
  { id: 'impaired', label: 'Impaired', hint: 'Moderate Rx/dx' },
  { id: 'severe', label: 'High-Need', hint: 'Major change' },
];

export const SettlementsDashboard: React.FC<SettlementsDashboardProps> = ({
  clientData,
  onOpenBooking,
  onUpdateStrategySnapshot,
}) => {
  const [activePresetId, setActivePresetId] = useState<string>('ul_500');
  const [policyType, setPolicyType] = useState<SettlementPolicyType>('universal_life');
  const [insuredAge, setInsuredAge] = useState<number>(Math.max(65, Math.min(88, clientData.clientAge || 72)));
  const [healthRating, setHealthRating] = useState<SettlementHealthRating>('mild_change');
  const [faceValue, setFaceValue] = useState<number>(500000);
  const [autoCorrelateCsv, setAutoCorrelateCsv] = useState<boolean>(true);
  const [manualCsv, setManualCsv] = useState<number>(() =>
    getCorrelatedCsvForPolicy(500000, 'universal_life', Math.max(65, Math.min(88, clientData.clientAge || 72)))
  );
  const [taxBracket, setTaxBracket] = useState<number>(22);
  const [inSurrenderChargePeriod, setInSurrenderChargePeriod] = useState<boolean>(true);

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const lastSnapshotJsonRef = useRef<string>('');

  const regionLabel = useMemo(() => getRegionLabelForZip(clientData.zipCode), [clientData.zipCode]);

  const correlatedCsv = useMemo(
    () => getCorrelatedCsvForPolicy(faceValue, policyType, insuredAge),
    [faceValue, policyType, insuredAge]
  );

  const effectiveCsv = policyType === 'convertible_term' ? 0 : autoCorrelateCsv ? correlatedCsv : manualCsv;

  const analysis = useMemo(
    () =>
      calculateLifeSettlementAnalysis({
        faceValue,
        cashSurrenderVal: effectiveCsv,
        policyType,
        insuredAge,
        healthRating,
        taxBracket,
        inSurrenderChargePeriod,
      }),
    [faceValue, effectiveCsv, policyType, insuredAge, healthRating, taxBracket, inSurrenderChargePeriod]
  );

  const policyTypeLabel =
    POLICY_TYPE_OPTIONS.find((p) => p.id === policyType)?.label || 'Universal Life';
  const healthRatingLabel =
    HEALTH_RATING_OPTIONS.find((h) => h.id === healthRating)?.label || 'Mild Change';

  const applyPreset = (preset: AreaPolicyPreset) => {
    SoundFX.playClick();
    setActivePresetId(preset.id);
    setPolicyType(preset.policyType);
    setFaceValue(preset.faceValue);
    setInsuredAge(preset.insuredAge);
    setHealthRating(preset.healthRating);
    setAutoCorrelateCsv(true);
    setManualCsv(getCorrelatedCsvForPolicy(preset.faceValue, preset.policyType, preset.insuredAge));
  };

  // Sync live interactive state into ActiveStrategySnapshot (deduplicated)
  useEffect(() => {
    if (!onUpdateStrategySnapshot) return;
    const nextSnapshot: ActiveStrategySnapshot = {
      pathId: 'settlements',
      pathLabel: 'Life Settlements',
      summaryHeadline: `Est. $${analysis.estGrossSettlement.toLocaleString()} gross ($${analysis.netSettlementAfterTax.toLocaleString()} net after-tax) vs $${analysis.netSurrenderAfterTax.toLocaleString()} net surrender`,
      selectedCarrierOrVendor: `Institutional Secondary Market (${regionLabel})`,
      selectedTierOrOption: `${policyTypeLabel} · Age ${insuredAge} · ${healthRatingLabel}`,
      sliders: [
        { label: 'Policy Structure & Face Value', value: `${policyTypeLabel} · $${faceValue.toLocaleString()}` },
        {
          label: 'Carrier Cash Surrender Value',
          value: `$${analysis.cashSurrenderVal.toLocaleString()} (${autoCorrelateCsv ? 'Contract-Correlated' : 'Custom Statement'})`,
        },
        { label: 'Insured Age & Health Tier', value: `Age ${insuredAge} · ${healthRatingLabel}` },
        {
          label: 'Surrender Downsides Modeled',
          value: `${inSurrenderChargePeriod ? 'Surrender Charge Active' : 'Out of Surrender'} · ${taxBracket}% Tax Bracket`,
        },
      ],
      impactMetrics: [
        {
          label: 'Est. Settlement Range (Gross)',
          value: `$${analysis.estLowSettlement.toLocaleString()}–$${analysis.estHighSettlement.toLocaleString()} (${analysis.settlementRatioPct}% of face)`,
        },
        {
          label: 'Net After-Tax Settlement vs Surrender',
          value: `$${analysis.netSettlementAfterTax.toLocaleString()} vs $${analysis.netSurrenderAfterTax.toLocaleString()} (+$${analysis.netAfterTaxSurplus.toLocaleString()} surplus)`,
        },
        {
          label: 'Surrender Charges & Taxes Avoided',
          value: `$${analysis.surrenderChargeDollar.toLocaleString()} carrier fee + $${analysis.surrenderTaxDollar.toLocaleString()} surrender tax`,
        },
        {
          label: 'Paid-Up Retained Death Benefit Alt.',
          value: `$${analysis.retainedDeathBenefit.toLocaleString()} ($0 future premiums)`,
        },
      ],
    };

    const serialized = JSON.stringify(nextSnapshot);
    if (serialized === lastSnapshotJsonRef.current) return;
    lastSnapshotJsonRef.current = serialized;
    onUpdateStrategySnapshot(nextSnapshot);
  }, [
    onUpdateStrategySnapshot,
    regionLabel,
    policyTypeLabel,
    healthRatingLabel,
    insuredAge,
    faceValue,
    autoCorrelateCsv,
    inSurrenderChargePeriod,
    taxBracket,
    analysis.estGrossSettlement,
    analysis.estLowSettlement,
    analysis.estHighSettlement,
    analysis.settlementRatioPct,
    analysis.netSettlementAfterTax,
    analysis.netSurrenderAfterTax,
    analysis.netAfterTaxSurplus,
    analysis.cashSurrenderVal,
    analysis.surrenderChargeDollar,
    analysis.surrenderTaxDollar,
    analysis.retainedDeathBenefit,
  ]);

  // Mount Chart.js instance once and destroy on unmount
  useEffect(() => {
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Carrier Policy Surrender', 'Institutional Life Settlement'],
        datasets: [
          {
            label: 'Net Cash in Your Pocket',
            data: [analysis.netSurrenderAfterTax, analysis.netSettlementAfterTax],
            backgroundColor: '#10b981',
          },
          {
            label: 'Carrier Surrender Charges',
            data: [analysis.surrenderChargeDollar, 0],
            backgroundColor: '#f43f5e',
          },
          {
            label: 'Est. Federal Taxes',
            data: [analysis.surrenderTaxDollar, analysis.settlementTaxDollar],
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
            ticks: { color: '#cbd5e1', font: { size: 12, weight: 'bold' } },
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

  // Update Chart datasets cleanly in-place (zero flicker on slider drags)
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    chart.data.datasets[0].data = [analysis.netSurrenderAfterTax, analysis.netSettlementAfterTax];
    chart.data.datasets[1].data = [analysis.surrenderChargeDollar, 0];
    chart.data.datasets[2].data = [analysis.surrenderTaxDollar, analysis.settlementTaxDollar];
    chart.update('none');
  }, [
    analysis.netSurrenderAfterTax,
    analysis.netSettlementAfterTax,
    analysis.surrenderChargeDollar,
    analysis.surrenderTaxDollar,
    analysis.settlementTaxDollar,
  ]);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-silver-400 glow-silver space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-silver-500/40 flex items-center justify-center text-silver-300 text-2xl shrink-0">
              <i className="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-silver-400 uppercase tracking-wider block">
                Secondary Life Policy Market · {regionLabel}
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                Life Settlement vs. Surrender Valuation Suite
              </h3>
            </div>
          </div>

          <div className="bg-navy-950 px-3.5 py-2 rounded-xl border border-silver-500/30 text-xs text-silver-200 font-bold whitespace-nowrap self-start lg:self-auto tabular-nums">
            Projected Payout Ratio: <span className="text-emerald-400">{analysis.settlementRatioPct}% of Face</span>
          </div>
        </div>

        {/* Common Local Area Policy Presets */}
        <div className="bg-navy-950/90 p-4 rounded-2xl border border-navy-700/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-white flex items-center gap-2">
              <i className="fa-solid fa-location-dot text-silver-400"></i>
              Common In-Force Policy Presets ({regionLabel})
            </span>
            <span className="text-[11px] text-slate-400">
              Select a local benchmark or fine-tune sliders below
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {AREA_POLICY_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-0.5 ${
                    isSelected
                      ? 'bg-navy-900 border-silver-400 shadow-lg shadow-slate-500/15'
                      : 'bg-navy-900/60 border-navy-800 hover:border-silver-500/40'
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

        {/* Two-Column Interactive Policy & Underwriting Calibration Deck */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Policy Type, Insured Age, Health Rating & Surrender Tax Parameters */}
          <div className="bg-navy-950/85 p-5 rounded-2xl border border-navy-700/80 space-y-4 shadow-xl">
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                1. Policy Contract Structure
              </span>
              <div className="grid grid-cols-2 gap-2">
                {POLICY_TYPE_OPTIONS.map((opt) => {
                  const isActive = policyType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        SoundFX.playClick();
                        setActivePresetId('');
                        setPolicyType(opt.id);
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap text-left border ${
                        isActive
                          ? 'bg-silver-500/20 text-white border-silver-400'
                          : 'bg-navy-900 text-slate-400 hover:text-white border-navy-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Insured Age Slider */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Insured Age (Valuation Driver):</span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-silver-500/40">
                  <input
                    type="number"
                    min={55}
                    max={90}
                    value={insuredAge}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!Number.isNaN(val)) {
                        setActivePresetId('');
                        setInsuredAge(Math.min(90, Math.max(55, val)));
                      }
                    }}
                    className="w-10 bg-transparent text-white font-extrabold text-xs focus:outline-none text-right tabular-nums"
                  />
                  <span className="text-silver-400 font-bold text-[11px]">yrs</span>
                </div>
              </div>
              <input
                type="range"
                min={55}
                max={90}
                step={1}
                value={insuredAge}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  SoundFX.playSlideHum((val - 55) / 35);
                  setActivePresetId('');
                  setInsuredAge(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-silver-400"
              />
            </div>

            {/* Health Underwriting Rating */}
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                2. Current Health Status Change Since Issue
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {HEALTH_RATING_OPTIONS.map((opt) => {
                  const isActive = healthRating === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        SoundFX.playClick();
                        setActivePresetId('');
                        setHealthRating(opt.id);
                      }}
                      className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600/20 border-emerald-400 text-white'
                          : 'bg-navy-900 border-navy-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-[11px] font-extrabold block whitespace-nowrap">{opt.label}</span>
                      <span className="text-[9.5px] text-slate-400 block">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tax Bracket & Carrier Surrender Charge Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-navy-900 p-3 rounded-xl border border-navy-800 space-y-1.5">
                <label htmlFor="settlement-tax-bracket" className="text-[10px] text-slate-400 font-bold uppercase block">
                  Federal Ordinary Tax Bracket
                </label>
                <select
                  id="settlement-tax-bracket"
                  value={taxBracket}
                  onChange={(e) => setTaxBracket(parseInt(e.target.value, 10) || 22)}
                  className="w-full bg-navy-950 text-xs font-bold text-white px-2.5 py-1.5 rounded-lg border border-navy-700 focus:outline-none focus:border-silver-400 cursor-pointer"
                >
                  <option value={12}>12% Marginal Bracket</option>
                  <option value={22}>22% Marginal Bracket</option>
                  <option value={24}>24% Marginal Bracket</option>
                  <option value={32}>32%+ Marginal Bracket</option>
                </select>
              </div>

              <div className="bg-navy-900 p-3 rounded-xl border border-navy-800 space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Carrier Surrender Schedule
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={policyType === 'convertible_term'}
                    onClick={() => {
                      SoundFX.playClick();
                      setInSurrenderChargePeriod(true);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                      inSurrenderChargePeriod && policyType !== 'convertible_term'
                        ? 'bg-rose-600 text-white'
                        : 'bg-navy-950 text-slate-400 border border-navy-800'
                    }`}
                  >
                    Active Charge
                  </button>
                  <button
                    type="button"
                    disabled={policyType === 'convertible_term'}
                    onClick={() => {
                      SoundFX.playClick();
                      setInSurrenderChargePeriod(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                      !inSurrenderChargePeriod || policyType === 'convertible_term'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-navy-950 text-slate-400 border border-navy-800'
                    }`}
                  >
                    Charge Expired
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Correlated Face Value & Cash Surrender Value Sliders */}
          <div className="bg-navy-950/85 p-5 rounded-2xl border border-navy-700/80 space-y-5 shadow-xl flex flex-col justify-between">
            <div className="space-y-5">
              {/* Face Value Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-slate-300 font-bold">Policy Death Benefit / Face Value:</span>
                  <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-silver-500/40">
                    <span className="text-silver-400 font-bold">$</span>
                    <input
                      type="number"
                      min={100000}
                      max={5000000}
                      step={25000}
                      value={faceValue}
                      onChange={(e) => {
                        setActivePresetId('');
                        setFaceValue(Math.max(100000, parseFloat(e.target.value) || 100000));
                      }}
                      className="w-28 bg-transparent text-white font-extrabold text-sm focus:outline-none text-right tabular-nums"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={2500000}
                  step={25000}
                  value={Math.min(2500000, faceValue)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 100000;
                    SoundFX.playSlideHum((val - 100000) / 2400000);
                    setActivePresetId('');
                    setFaceValue(val);
                  }}
                  className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-silver-400"
                />
                <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
                  <span>$100k Min</span>
                  <span>$1.0M</span>
                  <span>$2.5M+ Face</span>
                </div>
              </div>

              {/* Correlated Cash Surrender Value Slider */}
              <div className="space-y-2 pt-2 border-t border-navy-800">
                <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
                  <span className="text-slate-300 font-bold">
                    Carrier Gross Cash Surrender Value:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={policyType === 'convertible_term'}
                      onClick={() => {
                        SoundFX.playClick();
                        setAutoCorrelateCsv((prev) => {
                          const next = !prev;
                          if (!next) setManualCsv(correlatedCsv);
                          return next;
                        });
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                        autoCorrelateCsv
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {policyType === 'convertible_term'
                        ? 'Term = $0 CSV'
                        : autoCorrelateCsv
                        ? 'Correlated to Face Value'
                        : 'Manual Override (Re-Sync)'}
                    </button>
                    <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-navy-700">
                      <span className="text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        min={0}
                        max={faceValue}
                        step={1000}
                        disabled={policyType === 'convertible_term'}
                        value={effectiveCsv}
                        onChange={(e) => {
                          setAutoCorrelateCsv(false);
                          setManualCsv(Math.max(0, parseFloat(e.target.value) || 0));
                        }}
                        className="w-24 bg-transparent text-white font-extrabold text-xs focus:outline-none text-right tabular-nums disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(100000, Math.round(faceValue * 0.4))}
                  step={1000}
                  disabled={policyType === 'convertible_term'}
                  value={Math.min(Math.max(100000, Math.round(faceValue * 0.4)), effectiveCsv)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    SoundFX.playSlideHum(val / Math.max(100000, Math.round(faceValue * 0.4)));
                    setAutoCorrelateCsv(false);
                    setManualCsv(val);
                  }}
                  className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-slate-400 disabled:opacity-40"
                />
                <p className="text-[10.5px] text-slate-400 leading-snug">
                  {policyType === 'convertible_term'
                    ? 'Convertible Term contracts accumulate $0 cash surrender value—without a settlement, lapsing returns $0.'
                    : `Realistic contract accumulation curves scale Cash Surrender Value (~${faceValue > 0 ? Math.round((effectiveCsv / faceValue) * 100) : 0}% of face value) based on ${policyTypeLabel} reserves and age ${insuredAge}.`}
                </p>
              </div>
            </div>

            {/* Instant Summary KPI Strip inside right panel */}
            <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-emerald-300 font-bold uppercase block">
                  Projected Secondary Market Range
                </span>
                <strong className="text-xl sm:text-2xl font-black text-white tabular-nums">
                  ${analysis.estLowSettlement.toLocaleString()} – ${analysis.estHighSettlement.toLocaleString()}
                </strong>
                <span className="text-[11px] text-slate-400 block tabular-nums">
                  Midpoint Valuation: ${analysis.estGrossSettlement.toLocaleString()} ({analysis.settlementRatioPct}% of face)
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] text-gold-300 font-bold uppercase block">
                  Net After-Tax Advantage
                </span>
                <strong className="text-xl font-black text-emerald-400 tabular-nums">
                  +${analysis.netAfterTaxSurplus.toLocaleString()}
                </strong>
                <span className="text-[10.5px] text-slate-300 block tabular-nums">
                  {analysis.surrenderMultiple ? `${analysis.surrenderMultiple}× Net Surrender Cash` : 'Over $0 Term Surrender'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Downsides of Surrender vs. Upside Potential of Life Settlement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Surrender Downsides Ledger */}
          <div className="bg-navy-950 p-5 rounded-2xl border border-rose-500/40 space-y-4">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div>
                <span className="text-[10px] text-rose-400 font-extrabold uppercase tracking-wider block">
                  Carrier Surrender Downsides
                </span>
                <h4 className="text-base font-extrabold text-white">Surrendering Policy Back to Insurer</h4>
              </div>
              <span className="text-lg font-black text-rose-300 tabular-nums">
                ${analysis.netSurrenderAfterTax.toLocaleString()} Net
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Gross Cash Surrender Value (CSV):</span>
                <strong className="text-white tabular-nums">${analysis.cashSurrenderVal.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-rose-300">
                <span>Less Carrier Surrender Charges:</span>
                <strong className="tabular-nums">-${analysis.surrenderChargeDollar.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>
                  Less Ordinary Income Tax ({taxBracket}% on ${analysis.surrenderTaxableGain.toLocaleString()} gain):
                </span>
                <strong className="tabular-nums">-${analysis.surrenderTaxDollar.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-navy-800 text-sm font-extrabold">
                <span className="text-slate-200">Net Take-Home Cash After Fees &amp; Tax:</span>
                <strong className="text-rose-300 tabular-nums">${analysis.netSurrenderAfterTax.toLocaleString()}</strong>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-[11px] text-rose-200 leading-relaxed">
              <i className="fa-solid fa-triangle-exclamation mr-1.5 text-rose-400"></i>
              <strong>Forfeited Legacy Value:</strong> Surrendering permanently cancels{' '}
              <strong className="tabular-nums">${analysis.forfeitedDeathBenefit.toLocaleString()}</strong> in net death benefit protection in exchange for carrier reserve liquidation.
            </div>
          </div>

          {/* Life Settlement Upside Ledger */}
          <div className="bg-navy-950 p-5 rounded-2xl border border-emerald-500/40 space-y-4">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div>
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block">
                  Institutional Secondary Market Upside
                </span>
                <h4 className="text-base font-extrabold text-white">Life Settlement Institutional Buyout</h4>
              </div>
              <span className="text-lg font-black text-emerald-400 tabular-nums">
                ${analysis.netSettlementAfterTax.toLocaleString()} Net
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Projected Institutional Gross Payout:</span>
                <strong className="text-white tabular-nums">${analysis.estGrossSettlement.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-emerald-300">
                <span>Tax-Free Cost Basis Recovery (Rev. Rul. 2009-13):</span>
                <strong className="tabular-nums">${analysis.estimatedCostBasis.toLocaleString()} (0% Tax)</strong>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>Less Blended Settlement Tax (Ordinary + LTCG):</span>
                <strong className="tabular-nums">-${analysis.settlementTaxDollar.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-navy-800 text-sm font-extrabold">
                <span className="text-slate-200">Net Take-Home Cash Proceeds:</span>
                <strong className="text-emerald-400 tabular-nums">${analysis.netSettlementAfterTax.toLocaleString()}</strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
              <div className="text-[11px] text-emerald-100 leading-snug">
                <strong>Additional Net Cash Over Surrender:</strong>{' '}
                <span className="text-emerald-300 font-extrabold tabular-nums">
                  +${analysis.netAfterTaxSurplus.toLocaleString()}
                </span>{' '}
                immediate tax-advantaged liquidity.
              </div>
              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  onOpenBooking();
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Request Institutional Bids
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Chart: Settlement vs. Surrender (Net Cash, Surrender Charges, Taxes) */}
        <div className="bg-navy-950/90 p-5 sm:p-6 rounded-2xl border border-navy-700/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-navy-800 pb-3">
            <div>
              <span className="text-[10px] text-silver-400 font-extrabold uppercase tracking-wider block">
                Net Cash vs. Carrier Fees &amp; Tax Erosion
              </span>
              <h4 className="text-base sm:text-xl font-black text-white">
                Surrender vs. Life Settlement Financial Breakdown
              </h4>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              Face Value: ${faceValue.toLocaleString()} · {policyTypeLabel}
            </span>
          </div>

          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 h-72 sm:h-80">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>

        {/* Retained Death Benefit Option */}
        <div className="bg-navy-950 p-4 rounded-xl border border-silver-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            <strong className="text-white block font-bold">Retained Paid-Up Death Benefit Alternative:</strong>
            <p className="text-slate-400 mt-0.5">
              Instead of an all-cash buyout, institutional buyers can carve out an estimated{' '}
              <strong className="text-silver-200 tabular-nums">${analysis.retainedDeathBenefit.toLocaleString()}</strong>{' '}
              irrevocably paid-up death benefit for your heirs with <strong>$0 future premium payments</strong> forever.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-navy-900 border border-silver-500/40 text-silver-300 font-bold whitespace-nowrap shrink-0">
            $0 Future Premiums
          </span>
        </div>
      </section>
    </div>
  );
};
