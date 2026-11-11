import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { ClientData, HealthCarrierId } from '../../types';
import {
  getIRSLimitForAge,
  getHouseholdSize,
  getMarginalTaxRate,
  calculateAcaDetails,
  getTraditionalIRADeductionLimit,
} from '../../utils/calculations';
import { REGIONAL_HEALTH_CARRIERS } from '../../utils/constants';
import { SoundFX } from '../../utils/audio';

Chart.register(...registerables);

interface AtlasBridgeDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const AtlasBridgeDashboard: React.FC<AtlasBridgeDashboardProps> = ({
  clientData,
  onChangeClientData,
  onOpenBooking,
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
    : Math.min(1000, iraCap);

  const initialSpouseIRA = (clientData.spouseExistingAnnuityCash && clientData.spouseExistingAnnuityCash > 0)
    ? clientData.spouseExistingAnnuityCash
    : (isMarried ? Math.min(1000, spouseIraCap) : 0);

  const [iraContrib, setIraContrib] = useState<number>(Math.min(initialIRA, iraCap));
  const [spouseIraContrib, setSpouseIraContrib] = useState<number>(Math.min(initialSpouseIRA, spouseIraCap));
  const [selectedTier, setSelectedTier] = useState<string>('auto');
  const [isScenariosOpen, setIsScenariosOpen] = useState<boolean>(false);
  const [walkInDate, setWalkInDate] = useState<string>('2026-11-05');

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Household & ACA Benchmark Details for Poverty Floor
  const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);
  const origAca = calculateAcaDetails(clientData.grossAGI, householdSize, clientData.clientAge);

  // Poverty floor for pre-tax deductions ($100 above 100% FPL)
  const povertyFloor = origAca.fpl100 + 100;
  const maxSafeTotalPreTax = Math.max(0, clientData.grossAGI - povertyFloor);

  // Trad-IRA & Qualified Annuity Pre-Tax Diversion (Clamped to poverty floor)
  const effectiveMaxClientIRA = Math.max(0, Math.min(iraCap, maxSafeTotalPreTax));
  const actualClientIRA = Math.min(iraContrib, effectiveMaxClientIRA);

  const remainingAfterClientIRA = Math.max(0, maxSafeTotalPreTax - actualClientIRA);
  const effectiveMaxSpouseIRA = isMarried ? Math.max(0, Math.min(spouseIraCap, remainingAfterClientIRA)) : 0;
  const actualSpouseIRA = isMarried ? Math.min(spouseIraContrib, effectiveMaxSpouseIRA) : 0;

  // Trad-IRA deductibility under IRC § 219(g)
  // Active participant coverage determined from questionnaire answers
  const isClientCovered = hasClient401k;
  const isSpouseCovered = hasSpouse401k;

  // Primary Client IRA
  const clientIraDeductionInfo = getTraditionalIRADeductionLimit(
    clientData.grossAGI,
    clientData.clientAge,
    isClientCovered,
    clientData.filingStatus,
    isSpouseCovered
  );
  const deductibleClientIRA = Math.min(actualClientIRA, clientIraDeductionInfo.maxDeductible);
  const afterTaxClientIRA = Math.max(0, actualClientIRA - deductibleClientIRA);

  // Spouse IRA (under IRC § 219(c))
  const spouseIraDeductionInfo = isMarried
    ? getTraditionalIRADeductionLimit(
        clientData.grossAGI,
        spouseAge,
        isSpouseCovered,
        clientData.filingStatus,
        isClientCovered
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

  // Adjusted ACA
  const adjustedMAGI = Math.max(povertyFloor, clientData.grossAGI - totalPreTaxMAGIReduction);
  const adjAca = calculateAcaDetails(adjustedMAGI, householdSize, clientData.clientAge);

  const subsidyShiftAnnual = Math.max(0, (adjAca.monthlySubsidy - origAca.monthlySubsidy) * 12);
  const deductibleShield = Math.max(0, origAca.deductible - adjAca.deductible);
  const totalComprehensiveSavings = subsidyShiftAnnual + deductibleShield + taxRelief;
  const netFinancialSwing = totalComprehensiveSavings + combinedIRA;

  const currentCarrier = REGIONAL_HEALTH_CARRIERS.find((c) => c.id === clientData.selectedHealthCarrier) || REGIONAL_HEALTH_CARRIERS[0];

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
    });
  }, [iraContrib, spouseIraContrib]);

  // Chart setup
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
        labels: ['Status Quo (No Optimization)', 'Traditional ACA Exchange', 'AtlasBridge System (Dual Engine)'],
        datasets: [
          {
            label: 'Healthcare Out-of-Pocket / Loss ($)',
            data: [
              Math.round(origAca.netMonthlyPremium * 12 + origAca.deductible * 0.5),
              Math.round(origAca.netMonthlyPremium * 12),
              Math.round(adjAca.netMonthlyPremium * 12),
            ],
            backgroundColor: ['rgba(239, 68, 68, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(16, 185, 129, 0.7)'],
            borderColor: ['#ef4444', '#3b82f6', '#10b981'],
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Retained Wealth & Tax Advantage ($)',
            data: [0, 0, Math.round(netFinancialSwing)],
            backgroundColor: ['rgba(148, 163, 184, 0.2)', 'rgba(148, 163, 184, 0.2)', 'rgba(245, 158, 11, 0.7)'],
            borderColor: ['#94a3b8', '#94a3b8', '#f59e0b'],
            borderWidth: 1,
            borderRadius: 6,
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
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [isScenariosOpen, origAca, adjAca, netFinancialSwing]);

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
                        min="15000"
                        max="300000"
                        step="500"
                        value={clientData.grossAGI}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 15000;
                          onChangeClientData({ grossAGI: Math.max(15000, val) });
                        }}
                        className="w-24 bg-transparent text-white font-extrabold text-sm focus:outline-none text-right"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min="15000"
                    max="250000"
                    step="500"
                    value={Math.min(250000, clientData.grossAGI)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 65000;
                      SoundFX.playSlideHum((val - 15000) / (250000 - 15000));
                      onChangeClientData({ grossAGI: val });
                    }}
                    className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium px-0.5">
                    <span>$15,000 Min</span>
                    <span>IRS Form 1040 Base</span>
                    <span>$250,000+ Max</span>
                  </div>
                </div>
              </div>

              {/* Adjusted MAGI & ACA Impact Box */}
              <div className="pt-2.5 border-t border-navy-800/80 space-y-2 text-xs">
                <div className="bg-navy-900 p-3 rounded-lg border border-purple-500/40 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                      <i className="fa-solid fa-sliders mr-1"></i> Adjusted MAGI &amp; ACA Impact:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      +${subsidyShiftAnnual.toLocaleString()}/yr Subsidy Shift
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="bg-navy-950 p-2 rounded border border-navy-800">
                      <span className="text-[9px] text-slate-400 block font-semibold">Original Gross AGI:</span>
                      <strong className="text-white font-bold block">${clientData.grossAGI.toLocaleString()}</strong>
                      <span className="text-[9.5px] text-amber-400 block truncate">{origAca.av} ({currentCarrier.name})</span>
                    </div>

                    <div className="bg-navy-950 p-2 rounded border border-purple-500/30">
                      <span className="text-[9px] text-purple-300 block font-semibold">Adjusted MAGI:</span>
                      <strong className="text-purple-200 font-bold block">${adjustedMAGI.toLocaleString()}</strong>
                      <span className="text-[9.5px] text-emerald-400 block truncate">{adjAca.av} ({currentCarrier.name})</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 italic flex items-center justify-between pt-0.5">
                    <span>* Auto-adjusted for Pre-Tax Diversion (Trad-IRA / Qual-Annuity).</span>
                    <span className="text-purple-300 font-semibold">
                      {totalPreTaxMAGIReduction > 0
                        ? `-$${combinedDeductibleIRA.toLocaleString()} Trad-IRA Deduction`
                        : '$0 reduction'}
                    </span>
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
                    <div className="text-base font-black text-emerald-400">+${totalComprehensiveSavings.toLocaleString()} / yr</div>
                    <span className="text-[9px] text-emerald-300 font-semibold">~{adjAca.fplPct}% FPL</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Pre-Tax Diversion Slider (Trad-IRA / Qual-Annuity - original format) */}
            <div className="bg-navy-950/90 p-5 rounded-2xl border border-gold-500/40 space-y-4 shadow-xl glow-gold flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 text-sm">
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
                  <div className="text-right">
                    <span className="text-[9.5px] text-slate-400 uppercase font-semibold block">{isMarried ? 'Combined IRA' : 'IRA Contribution'}</span>
                    <strong className="text-gold-400 font-black text-sm sm:text-base tabular-nums font-mono">${combinedIRA.toLocaleString()} / yr</strong>
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
                          step="50"
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
                      step="50"
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
                            step="50"
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
                        step="50"
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
                    </div>
                  )}

                  {/* Poverty Floor Safeguard Warning (if pre-tax room is constrained by poverty level) */}
                  {maxSafeTotalPreTax < (iraCap + (isMarried ? spouseIraCap : 0)) && (
                    <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <i className="fa-solid fa-shield-halved text-amber-400 text-xs shrink-0"></i>
                      <span>
                        <strong>Poverty Floor Protected:</strong> Pre-tax diversion capped at $100 above 100% FPL (${povertyFloor.toLocaleString()}) to safeguard ACA tax credit eligibility.
                      </span>
                    </div>
                  )}

                  {/* Dynamic Deductibility Badge */}
                  <div className="pt-1">
                    {isMarried ? (
                      clientIraDeductionInfo.phaseOutStatus === 'full' && (!spouseIraDeductionInfo || spouseIraDeductionInfo.phaseOutStatus === 'full') ? (
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-circle-check text-emerald-400"></i> Full Deduction Qualified (Joint MAGI &lt; $130,000)
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
                          <i className="fa-solid fa-circle-check text-emerald-400"></i> Full Deduction Qualified (MAGI &lt; $81,000)
                        </span>
                      ) : clientIraDeductionInfo.phaseOutStatus === 'partial' ? (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-triangle-exclamation text-amber-400"></i> Partial Deduction ($81k-$91k) · Max ${clientIraDeductionInfo.maxDeductible.toLocaleString()} Deductible
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-ban text-rose-400"></i> $0 Deduction · MAGI &gt; $91,000 Phase-Out Limit
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
              <h4 className="font-bold text-white text-sm sm:text-base">
                Active Plan Category: <span className="text-emerald-400">{adjAca.csrLevel}</span>
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
                    setSelectedTier(e.target.value);
                  }}
                  className="bg-navy-950 text-xs font-bold text-white px-2.5 py-1 rounded border border-navy-700 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[170px] sm:max-w-[190px]"
                >
                  <option value="auto" className="bg-navy-900 text-white">Auto-Matched Recommended Tier</option>
                  <option value="bronze" className="bg-navy-900 text-white">Bronze Plan</option>
                  <option value="silver" className="bg-navy-900 text-white">Standard Silver (70% AV)</option>
                  <option value="gold" className="bg-navy-900 text-white">Gold Plan</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="bg-navy-900/80 p-3 rounded-lg border border-navy-700/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Monthly ACA Premium</span>
              <div className="text-base sm:text-lg font-black text-white">${adjAca.netMonthlyPremium} / mo</div>
              <div className="text-[10px] text-emerald-400">APTC Subsidy Active</div>
            </div>
            <div className="bg-navy-900/80 p-3 rounded-lg border border-navy-700/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Family/Ind. Deductible</span>
              <div className="text-base sm:text-lg font-black text-blue-400">${adjAca.deductible.toLocaleString()} / yr</div>
              <div className="text-[10px] text-slate-400">CSR Reduced</div>
            </div>
            <div className="bg-navy-900/80 p-3 rounded-lg border border-navy-700/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Max Out-of-Pocket</span>
              <div className="text-base sm:text-lg font-black text-purple-300">${adjAca.oopMax.toLocaleString()} / yr</div>
              <div className="text-[10px] text-slate-400">Protection Cap</div>
            </div>
            <div className="bg-navy-900/80 p-3 rounded-lg border border-navy-700/60 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Actuarial Value (AV)</span>
              <div className="text-base sm:text-lg font-black text-gold-400">{adjAca.av}</div>
              <div className="text-[10px] text-slate-400">~{adjAca.fplPct}% FPL</div>
            </div>
          </div>
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
            +${(annualContrib + taxRelief + subsidyShiftAnnual).toLocaleString()} / yr
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

      {/* Scenario Accordion & Comparison Breakdown */}
      <section className="glass-card p-5 sm:p-6 border border-navy-700/80 space-y-4">
        <button
          onClick={() => {
            SoundFX.playClick();
            setIsScenariosOpen(!isScenariosOpen);
          }}
          className="w-full flex items-center justify-between text-left cursor-pointer outline-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-950 border border-blue-500/40 flex items-center justify-center text-blue-400 text-lg shrink-0">
              <i className="fa-solid fa-table-columns"></i>
            </div>
            <div>
              <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider block">Fiduciary Scenario Analysis</span>
              <h4 className="text-base sm:text-lg font-black text-white group-hover:text-blue-300 transition-colors">
                {isScenariosOpen ? 'Hide Detailed Financial & Scenario Breakdown' : 'Show Detailed Financial & Scenario Breakdown'}
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400 font-bold hidden sm:inline-block">
              {isScenariosOpen ? 'Collapse Table & Chart' : 'Expand Table & Chart'}
            </span>
            <i className={`fa-solid ${isScenariosOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-blue-400 text-sm`}></i>
          </div>
        </button>

        {isScenariosOpen && (
          <div className="pt-4 border-t border-navy-800 space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-navy-700 text-slate-400 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Metric / Feature</th>
                    <th className="py-2.5 px-3 text-rose-400">Scenario A: Status Quo</th>
                    <th className="py-2.5 px-3 text-blue-400">Scenario B: Standard ACA</th>
                    <th className="py-2.5 px-3 text-emerald-400 bg-emerald-950/20 rounded-t-lg">
                      Scenario C: AtlasBridge System
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/80 text-slate-300">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Reported Annual Gross Income</td>
                    <td className="py-2.5 px-3">${clientData.grossAGI.toLocaleString()}</td>
                    <td className="py-2.5 px-3">${clientData.grossAGI.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-300 bg-emerald-950/10">
                      ${adjustedMAGI.toLocaleString()} (Reduced MAGI)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Pre-Tax Wealth Diversion</td>
                    <td className="py-2.5 px-3">$0</td>
                    <td className="py-2.5 px-3">$0</td>
                    <td className="py-2.5 px-3 font-bold text-gold-400 bg-emerald-950/10">
                      +${annualContrib.toLocaleString()} / yr (Tax-Deferred Asset)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Monthly Health Premium (Net)</td>
                    <td className="py-2.5 px-3">${origAca.benchmarkCostMonthly} / mo (Full)</td>
                    <td className="py-2.5 px-3">${origAca.netMonthlyPremium} / mo</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400 bg-emerald-950/10">
                      ${adjAca.netMonthlyPremium} / mo (Optimized APTC)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Annual Health Deductible</td>
                    <td className="py-2.5 px-3">$7,500 / yr</td>
                    <td className="py-2.5 px-3">${origAca.deductible.toLocaleString()} / yr</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-300 bg-emerald-950/10">
                      ${adjAca.deductible.toLocaleString()} / yr (CSR Reduced)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Federal Income Tax Relief</td>
                    <td className="py-2.5 px-3">$0</td>
                    <td className="py-2.5 px-3">$0</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400 bg-emerald-950/10">
                      +${taxRelief.toLocaleString()} / yr (Form 1040 Sched 1)
                    </td>
                  </tr>
                  <tr className="bg-navy-900/90 font-bold">
                    <td className="py-3 px-3 text-white">Net Annual Financial Impact</td>
                    <td className="py-3 px-3 text-rose-400">-$9,200 (Total Loss)</td>
                    <td className="py-3 px-3 text-blue-400">-$3,400 (Basic Subsidy)</td>
                    <td className="py-3 px-3 text-gold-400 bg-emerald-950/30 text-sm">
                      +${netFinancialSwing.toLocaleString()} Net Advantage
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 h-72 sm:h-80">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
