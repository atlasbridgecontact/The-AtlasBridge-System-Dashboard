import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { ClientData, LifeCarrier, LifeTabType } from '../../types';
import { CARRIER_STAT_PROFILES } from '../../utils/constants';
import { SoundFX } from '../../utils/audio';

Chart.register(...registerables);

interface LifeInsuranceDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const LifeInsuranceDashboard: React.FC<LifeInsuranceDashboardProps> = ({
  clientData,
}) => {
  const [activeTab, setActiveTab] = useState<LifeTabType>('term');
  const [selectedCarrier, setSelectedCarrier] = useState<LifeCarrier>('Mutual of Omaha');
  const [selectedCrediting, setSelectedCrediting] = useState<string>('sp500_cap_9.5');
  const [deathBenefit, setDeathBenefit] = useState<number>(
    Math.min(5000000, Math.max(25000, clientData.grossAGI * 10 || 500000))
  );
  const [timeHorizon, setTimeHorizon] = useState<number>(20);
  const [riderBudget, setRiderBudget] = useState<number>(18);
  const [selectedOther, setSelectedOther] = useState<string>('key_person');
  const [subPolicyType, setSubPolicyType] = useState<string>('term_20');

  const [riders, setRiders] = useState<Record<string, boolean>>({
    waiver: false,
    adb: true,
    rop: false,
    guaranteed: false,
    accidental: false,
    pua_rider: false,
    overloan: false,
    business_key: false,
  });

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const profile = CARRIER_STAT_PROFILES[selectedCarrier] || CARRIER_STAT_PROFILES['Mutual of Omaha'];

  // Calculate carrier & age factors
  let carrierFactor = 1.0;
  if (selectedCarrier === 'Corebridge Financial') carrierFactor = 1.07;
  else if (selectedCarrier === 'Lincoln Financial') carrierFactor = 1.12;
  else if (selectedCarrier === 'Pacific Life') carrierFactor = 1.03;
  else if (selectedCarrier === 'Principal') carrierFactor = 1.09;

  const ageFactor = Math.pow(1.045, Math.max(0, clientData.clientAge - 30));
  const riderMultiplier = 1.0 + riderBudget / 100;

  let baseRate = 4.2;
  if (activeTab === 'whole') baseRate = 16.0;
  else if (activeTab === 'universal') baseRate = 24.0;
  else if (activeTab === 'other') {
    if (subPolicyType === 'final_expense') baseRate = 35.0;
    else if (subPolicyType === 'exec_bonus') baseRate = 28.0;
    else baseRate = 12.0;
  }

  const monthlyPrem = Math.round((deathBenefit / 100000) * baseRate * ageFactor * riderMultiplier * carrierFactor);

  // Growth rate calculation
  let growthRate = 0.068;
  if (selectedCrediting === 'sp500_monthly_8.2') growthRate = 0.078;
  else if (selectedCrediting === 'fixed_floor_4.5') growthRate = 0.045;
  else if (selectedCrediting === 'blended_dynamic') growthRate = 0.085;

  if (selectedCarrier === 'Pacific Life') growthRate += 0.007;
  if (selectedCarrier === 'Corebridge Financial') growthRate += 0.005;

  let estCashValue = 0;
  if (activeTab !== 'term') {
    let currentCV = 0;
    const annualContribution = monthlyPrem * 12;
    for (let i = 1; i <= timeHorizon; i++) {
      currentCV = (currentCV + annualContribution * 0.85) * (1 + growthRate);
    }
    estCashValue = Math.round(currentCV);
  }

  const livingBenefitAmount = Math.round(deathBenefit * 0.8);

  const handleRiderCheckbox = (key: string, checked: boolean) => {
    SoundFX.playClick();
    const updated = { ...riders, [key]: checked };
    setRiders(updated);
    let count = 0;
    Object.values(updated).forEach((val) => {
      if (val) count += 6;
    });
    setRiderBudget(Math.min(35, count));
  };

  // Chart setup
  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const annualPrem = monthlyPrem * 12;
    const years = [1, 5, 10, 15, 20, 25, 30].filter((y) => y <= timeHorizon || y === 1 || y === 5);
    const cumPremiums = years.map((y) => Math.round(annualPrem * y));

    const cashGrowth = years.map((y) => {
      if (activeTab === 'term') return 0;
      let cv = 0;
      for (let i = 1; i <= y; i++) {
        cv = (cv + annualPrem * 0.85) * (1 + growthRate);
      }
      return Math.round(cv);
    });

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years.map((y) => `Yr ${y}`),
        datasets: [
          {
            label: 'Cumulative Premiums Paid',
            data: cumPremiums,
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            borderDash: [5, 5],
            fill: true,
            tension: 0.2,
          },
          {
            label:
              activeTab === 'term'
                ? 'Policy Cash Value ($0 for Term)'
                : `Policy Cash Value Growth (${selectedCarrier})`,
            data: cashGrowth,
            borderColor: '#fbbf24',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            fill: true,
            tension: 0.3,
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
  }, [monthlyPrem, timeHorizon, growthRate, activeTab, selectedCarrier]);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-red-500 glow-red space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-red-500/40 flex items-center justify-center text-red-400 text-2xl">
              <i className="fa-solid fa-shield-heart"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Independent Life Platform</span>
                <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">
                  Fiduciary Coverage
                </span>
              </div>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white">Life Insurance Suite</h3>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2 bg-navy-950 p-2 rounded-2xl border border-navy-700">
          <button
            onClick={() => {
              SoundFX.playClick();
              setActiveTab('term');
              setSubPolicyType('term_20');
            }}
            className={`flex-1 min-w-[110px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'term'
                ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-navy-900'
            }`}
          >
            <i className="fa-solid fa-clock-rotate-left"></i> Term Life
          </button>
          <button
            onClick={() => {
              SoundFX.playClick();
              setActiveTab('whole');
              setSubPolicyType('whole_standard');
            }}
            className={`flex-1 min-w-[110px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'whole'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-navy-900'
            }`}
          >
            <i className="fa-solid fa-vault"></i> Whole Life
          </button>
          <button
            onClick={() => {
              SoundFX.playClick();
              setActiveTab('universal');
              setSubPolicyType('iul');
            }}
            className={`flex-1 min-w-[110px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'universal'
                ? 'bg-gold-500 text-navy-950 shadow-lg shadow-gold-500/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-navy-900'
            }`}
          >
            <i className="fa-solid fa-chart-line"></i> Universal Life
          </button>
          <button
            onClick={() => {
              SoundFX.playClick();
              setActiveTab('other');
              setSubPolicyType(selectedOther);
            }}
            className={`flex-1 min-w-[110px] py-3 px-4 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'other'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-navy-900'
            }`}
          >
            <i className="fa-solid fa-briefcase"></i> Other Options
          </button>
        </div>

        {/* Tab Description Container */}
        <div className="bg-navy-950 p-4 sm:p-5 rounded-2xl border border-navy-700 space-y-4">
          {activeTab === 'term' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-red-400 uppercase tracking-wider">
                  <i className="fa-solid fa-clock-rotate-left mr-1.5"></i> Term Life Option Summary
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30">
                  Pure Protection (No Cash Value)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Temporary coverage (10-30 years) delivering maximum death benefit per premium dollar. Displays premiums paid only ($0 cash value balance).
              </p>
            </div>
          )}

          {activeTab === 'whole' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-purple-400 uppercase tracking-wider">
                  <i className="fa-solid fa-vault mr-1.5"></i> Whole Life Option Summary
                </span>
                <span className="text-[10px] text-purple-300 font-bold bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/30">
                  Guaranteed Estate
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Permanent lifetime coverage with fixed premiums, guaranteed cash value accumulation, and annual dividend performance (4.5% - 5.5% scale).
              </p>
            </div>
          )}

          {activeTab === 'universal' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-gold-400 uppercase tracking-wider">
                  <i className="fa-solid fa-chart-line mr-1.5"></i> Universal Life / IUL Option Summary
                </span>
                <span className="text-[10px] text-gold-400 font-bold bg-gold-500/10 px-2.5 py-0.5 rounded border border-gold-500/30">
                  Tax-Free Income
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Flexible permanent policy linked to index interest crediting (S&amp;P 500) featuring 0% downside floors and tax-free policy loan streams under IRC Sec 7702.
              </p>
            </div>
          )}

          {activeTab === 'other' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider">
                  <i className="fa-solid fa-briefcase mr-1.5"></i> Specialized &amp; Corporate Solutions
                </span>
                <span className="text-[10px] text-blue-300 font-bold bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/30">
                  Business &amp; Senior
                </span>
              </div>
              <p className="text-xs text-slate-300">Select a specialized corporate or senior option below to calibrate accumulation parameters:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {[
                  { key: 'key_person', title: 'Key-Person Insurance', desc: 'Protects operational business revenue if a key executive passes.' },
                  { key: 'buy_sell', title: 'Buy-Sell Agreements', desc: 'Funded cross-purchase partner buyouts & entity transfers.' },
                  { key: 'exec_bonus', title: 'Executive Bonus (162)', desc: 'Tax-deductible executive retention with cash growth.' },
                  { key: 'final_expense', title: 'Final Expense Senior', desc: 'Simplified whole life covering funeral & end-of-life expenses.' },
                ].map((opt) => (
                  <div
                    key={opt.key}
                    onClick={() => {
                      SoundFX.playClick();
                      setSelectedOther(opt.key);
                      setSubPolicyType(opt.key);
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition space-y-1 ${
                      selectedOther === opt.key
                        ? 'bg-navy-900 border-2 border-blue-500 glow-blue'
                        : 'bg-navy-900 border border-navy-800 hover:border-blue-400'
                    }`}
                  >
                    <span className="text-[10px] text-blue-300 font-extrabold uppercase flex items-center justify-between">
                      {opt.title}
                      <i className={`fa-solid fa-circle-check ${selectedOther === opt.key ? 'text-blue-400' : 'text-slate-600'}`}></i>
                    </span>
                    <p className="text-[10.5px] text-slate-300 leading-tight">{opt.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Customization Parameters */}
        <div className="bg-navy-950/90 p-5 sm:p-6 rounded-2xl border border-navy-700 space-y-6">
          <h4 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-sliders text-xs"></i> Customize Policy Accumulation Parameters &amp; Crediting Strategy
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="main-life-carrier-select" className="block text-xs text-red-400 font-extrabold flex items-center gap-1 cursor-pointer">
                <i className="fa-solid fa-building-shield"></i> Preferred Carrier:
              </label>
              <select
                id="main-life-carrier-select"
                value={selectedCarrier}
                onChange={(e) => {
                  SoundFX.playClick();
                  setSelectedCarrier(e.target.value as LifeCarrier);
                }}
                className="w-full bg-navy-900 text-xs font-extrabold text-white px-3 py-2.5 rounded-lg border border-red-500/50 focus:outline-none focus:border-red-400 cursor-pointer"
              >
                <option value="Mutual of Omaha" className="bg-navy-900 text-white">Mutual of Omaha (Top Term Value)</option>
                <option value="Corebridge Financial" className="bg-navy-900 text-white">Corebridge Financial (Top IUL)</option>
                <option value="Lincoln Financial" className="bg-navy-900 text-white">Lincoln Financial (Top Whole/GUL)</option>
                <option value="Pacific Life" className="bg-navy-900 text-white">Pacific Life (Advanced Indexing)</option>
                <option value="Principal" className="bg-navy-900 text-white">Principal (Executive Benefits)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-slate-300 font-semibold">Policy Type:</label>
              <select
                value={subPolicyType}
                onChange={(e) => setSubPolicyType(e.target.value)}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-gold-500 cursor-pointer"
              >
                {activeTab === 'term' && (
                  <>
                    <option value="term_10" className="bg-navy-900 text-white">10-Year Level Term</option>
                    <option value="term_20" className="bg-navy-900 text-white">20-Year Level Term (Recommended)</option>
                    <option value="term_30" className="bg-navy-900 text-white">30-Year Level Term</option>
                  </>
                )}
                {activeTab === 'whole' && (
                  <>
                    <option value="whole_standard" className="bg-navy-900 text-white">Standard Participating Whole Life</option>
                    <option value="whole_paid_up" className="bg-navy-900 text-white">Paid-Up Additions (PUA) Focus</option>
                  </>
                )}
                {activeTab === 'universal' && (
                  <>
                    <option value="iul" className="bg-navy-900 text-white">Indexed Universal Life (IUL - S&amp;P 500)</option>
                    <option value="vul" className="bg-navy-900 text-white">Variable Universal Life (VUL)</option>
                    <option value="gul" className="bg-navy-900 text-white">Guaranteed Universal Life (GUL - Age 120)</option>
                  </>
                )}
                {activeTab === 'other' && (
                  <>
                    <option value="key_person" className="bg-navy-900 text-white">Key-Person Business Protection</option>
                    <option value="buy_sell" className="bg-navy-900 text-white">Buy-Sell Partnership Agreement</option>
                    <option value="exec_bonus" className="bg-navy-900 text-white">Executive Bonus (Sec. 162 Plan)</option>
                    <option value="final_expense" className="bg-navy-900 text-white">Senior Final Expense Whole Life</option>
                  </>
                )}
              </select>
            </div>

            {activeTab === 'universal' && (
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-300 font-semibold">Index Crediting Strategy &amp; Cap:</label>
                <select
                  value={selectedCrediting}
                  onChange={(e) => setSelectedCrediting(e.target.value)}
                  className="w-full bg-navy-900 text-xs font-bold text-gold-300 px-3 py-2.5 rounded-lg border border-gold-500/40 focus:border-gold-500 cursor-pointer"
                >
                  <option value="sp500_cap_9.5" className="bg-navy-900 text-white">S&amp;P 500 Annual Point-to-Point (9.5% Cap)</option>
                  <option value="sp500_monthly_8.2" className="bg-navy-900 text-white">S&amp;P 500 Monthly Average (8.2% Cap)</option>
                  <option value="fixed_floor_4.5" className="bg-navy-900 text-white">Fixed Account Guaranteed Floor (4.5%)</option>
                  <option value="blended_dynamic" className="bg-navy-900 text-white">Blended Dynamic Strategy (Uncapped)</option>
                </select>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="block text-xs text-slate-300 font-semibold">Desired Death Benefit:</label>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-gold-500/40">
                  <span className="text-gold-400 font-bold text-xs">$</span>
                  <input
                    type="number"
                    min="25000"
                    max="5000000"
                    step="25000"
                    value={deathBenefit}
                    onChange={(e) => setDeathBenefit(Math.max(25000, parseFloat(e.target.value) || 25000))}
                    className="w-24 bg-transparent text-white font-extrabold text-xs focus:outline-none text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="25000"
                max="5000000"
                step="25000"
                value={deathBenefit}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 25000;
                  SoundFX.playSlideHum((val - 25000) / (5000000 - 25000));
                  setDeathBenefit(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
              />
            </div>

            {activeTab !== 'term' && (
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-300 font-semibold">Time Horizon:</label>
                <select
                  value={timeHorizon}
                  onChange={(e) => setTimeHorizon(parseInt(e.target.value) || 20)}
                  className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-gold-500 cursor-pointer"
                >
                  <option value="10" className="bg-navy-900 text-white">10 Years</option>
                  <option value="15" className="bg-navy-900 text-white">15 Years</option>
                  <option value="20" className="bg-navy-900 text-white">20 Years</option>
                  <option value="25" className="bg-navy-900 text-white">25 Years</option>
                  <option value="30" className="bg-navy-900 text-white">30 Years</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Carrier Comparison Overview (Accordion - Relocated below accumulation parameters) */}
        <details className="glass-card p-4 sm:p-6 space-y-6 border border-red-500/40">
          <summary className="cursor-pointer font-black text-white text-base sm:text-lg flex items-center justify-between outline-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-navy-950 border border-red-500/40 flex items-center justify-center text-red-400 text-xl shrink-0">
                <i className="fa-solid fa-building-shield"></i>
              </div>
              <div>
                <h3 className="text-base sm:text-xl font-black text-white">
                  Popular Life Solutions in Stuart &amp; Martin County (Click to Expand)
                </h3>
              </div>
            </div>
            <span className="text-xs text-red-400 font-bold bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/30">
              Toggle View
            </span>
          </summary>

          <div className="pt-4 space-y-6 border-t border-navy-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Option 1 */}
              <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      PURE PROTECTION
                    </span>
                    <i className="fa-solid fa-clock-rotate-left text-emerald-400 text-lg"></i>
                  </div>
                  <h4 className="text-base font-extrabold text-white">1. Term Life with Living Benefits</h4>

                  <div className="bg-navy-900/90 p-2.5 rounded-xl border border-emerald-500/40 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Policy Death Benefit Amount</span>
                    <strong className="text-xl font-black text-emerald-400">${deathBenefit.toLocaleString()}</strong>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Provides maximum death benefit for 10, 20, or 30 years. Includes riders to access cash early if diagnosed with heart attack, stroke, cancer, or chronic illness.
                  </p>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-navy-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Selected Carrier:</span>
                      <strong className="text-emerald-400">{selectedCarrier}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. Monthly Premium:</span>
                      <strong className="text-white">${profile.termPrem} / mo</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Living Benefits:</span>
                      <strong className="text-emerald-400">{profile.termLiving}</strong>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-navy-800 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <i className="fa-solid fa-circle-check"></i> Highest Death Benefit per Dollar
                </div>
              </div>

              {/* Option 2 */}
              <div className="bg-navy-950 p-5 rounded-2xl border-2 border-gold-500 space-y-4 glow-gold flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-gold-400 bg-gold-500/20 px-2 py-0.5 rounded border border-gold-500/40">
                      TOP STUART GROWTH CHOICE
                    </span>
                    <i className="fa-solid fa-chart-line text-gold-400 text-lg"></i>
                  </div>
                  <h4 className="text-base font-extrabold text-white">2. Indexed Universal Life (IUL)</h4>

                  <div className="bg-navy-900/90 p-2.5 rounded-xl border border-gold-500/40 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Policy Death Benefit Amount</span>
                    <strong className="text-xl font-black text-gold-400">${deathBenefit.toLocaleString()}</strong>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Permanent life coverage with equity-indexed growth (S&amp;P 500). 0% downside floor with tax-free income stream potential under IRS Code 7702.
                  </p>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-navy-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Selected Carrier:</span>
                      <strong className="text-gold-300">{selectedCarrier}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Premium:</span>
                      <strong className="text-gold-400">${profile.iulPrem} / mo</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. Cash Value Growth:</span>
                      <strong className="text-gold-400">${profile.iulCash.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-navy-800 text-[11px] text-gold-300 font-semibold flex items-center gap-1">
                  <i className="fa-solid fa-gem"></i> Tax-Free Retirement Income Vehicle
                </div>
              </div>

              {/* Option 3 */}
              <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                      GUARANTEED ESTATE LEGACY
                    </span>
                    <i className="fa-solid fa-vault text-purple-400 text-lg"></i>
                  </div>
                  <h4 className="text-base font-extrabold text-white">3. Guaranteed Universal / Whole Life</h4>

                  <div className="bg-navy-900/90 p-2.5 rounded-xl border border-purple-500/40 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Policy Death Benefit Amount</span>
                    <strong className="text-xl font-black text-purple-300">${deathBenefit.toLocaleString()}</strong>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Permanent lifetime protection guaranteed to Age 120. Locked-in premiums, fixed dividend performance, and estate liquidity for heirs.
                  </p>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-navy-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Selected Carrier:</span>
                      <strong className="text-purple-300">{selectedCarrier}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. Monthly Premium:</span>
                      <strong className="text-white">${profile.wholePrem} / mo</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Guarantee Period:</span>
                      <strong className="text-purple-300">{profile.wholeGuarantee}</strong>
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-navy-800 text-[11px] text-purple-300 font-semibold flex items-center gap-1">
                  <i className="fa-solid fa-shield-check"></i> Ironclad Estate &amp; Final Expense Lock
                </div>
              </div>
            </div>
          </div>
        </details>

        {/* Riders & Enhancements */}
        <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-navy-800 pb-3">
            <div>
              <h4 className="text-xs font-extrabold text-red-400 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-sliders text-xs"></i> Optional Riders &amp; Enhancement Selector
              </h4>
              <p className="text-[11px] text-slate-400">Rider protection intensity is directly 1:1 synced with the Rider Cost Multiplier.</p>
            </div>
            <div className="bg-navy-900 px-3 py-1.5 rounded-lg border border-red-500/30 text-xs flex items-center gap-2">
              <span className="text-slate-400">Rider Cost Multiplier:</span>
              <strong className="text-red-400 font-extrabold">+{Math.round(riderBudget)}%</strong>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold">Rider Protection Intensity Slider:</span>
              <span className="text-red-400 font-bold">
                +{Math.round(riderBudget)}% Rider Cost Multiplier (
                {riderBudget < 10 ? 'Standard' : riderBudget < 25 ? 'Enhanced' : 'Maximum Protection'})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="35"
              step="1"
              value={riderBudget}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                SoundFX.playSlideHum(val / 35);
                setRiderBudget(val);
              }}
              className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {[
              { key: 'waiver', name: 'Waiver of Premium', desc: 'Waives premiums upon total disability' },
              { key: 'adb', name: 'Accelerated Death Benefit', desc: 'Critical / Chronic / Terminal access' },
              { key: 'rop', name: 'Return of Premium (ROP)', desc: 'Refunds 100% of base premiums at term end' },
              { key: 'guaranteed', name: 'Guaranteed Insurability', desc: 'Add coverage without medical exam' },
              { key: 'accidental', name: 'Accidental Death Benefit', desc: 'Double indemnity on accidental death' },
              { key: 'overloan', name: 'Overloan Protection', desc: 'Prevents policy lapse from outstanding loans' },
            ].map((r) => (
              <label
                key={r.key}
                className="flex items-center gap-2.5 bg-navy-900 p-3 rounded-xl border border-navy-800 hover:border-red-500/50 cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={!!riders[r.key]}
                  onChange={(e) => handleRiderCheckbox(r.key, e.target.checked)}
                  className="rounded border-navy-700 bg-navy-950 text-red-500 focus:ring-red-500 cursor-pointer"
                />
                <div className="text-xs">
                  <strong className="text-white block">{r.name}</strong>
                  <span className="text-[10px] text-slate-400">{r.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-navy-900 p-4 rounded-xl border border-navy-700/80 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Monthly Premium</span>
            <div className="text-2xl font-black text-white">${monthlyPrem.toLocaleString()} / mo</div>
            <span className="text-[10px] text-emerald-400 font-bold">{selectedCarrier} (Active)</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-gold-500/40 space-y-1 bg-gold-950/15 glow-gold">
            <span className="text-[10px] text-gold-400 uppercase font-bold">
              {activeTab === 'term' ? 'Death Benefit Protection' : 'Est. Cash Accumulation'}
            </span>
            <div className="text-2xl font-black text-gold-300">
              ${activeTab === 'term' ? deathBenefit.toLocaleString() : estCashValue.toLocaleString()}
            </div>
            <span className="text-[10px] text-gold-400 font-semibold">
              {activeTab === 'term' ? 'Tax-Free Legacy' : 'IRC Sec 7702 Tax-Deferred'}
            </span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-purple-500/40 space-y-1">
            <span className="text-[10px] text-purple-300 uppercase font-bold">Living Benefit Acceleration</span>
            <div className="text-2xl font-black text-purple-300">${livingBenefitAmount.toLocaleString()}</div>
            <span className="text-[10px] text-slate-400">Critical / Chronic / Terminal</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-blue-500/40 space-y-1">
            <span className="text-[10px] text-blue-300 uppercase font-bold">Policy Structure</span>
            <div className="text-2xl font-black text-blue-400">
              {activeTab === 'term' ? `${timeHorizon}-Yr Term` : activeTab === 'whole' ? 'Age 120 Lock' : 'IUL S&P 500'}
            </div>
            <span className="text-[10px] text-slate-400">Guaranteed Level Rate</span>
          </div>
        </div>
      </section>

      {/* Interactive Growth Projection Chart Accordion */}
      <details className="glass-card p-4 sm:p-6 border-2 border-gold-500/50 glow-gold space-y-6" open>
        <summary className="cursor-pointer font-black text-white text-base sm:text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 outline-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-950 border border-gold-500/40 flex items-center justify-center text-gold-400 text-xl shrink-0">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <div>
              <span className="text-[10px] text-gold-400 font-extrabold uppercase tracking-wider block">
                Interactive Estimator &amp; Asset Growth
              </span>
              <h3 className="text-base sm:text-xl font-black text-white">
                Policy Cash Value &amp; Growth Projection Estimator (Click to Expand)
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gold-400 font-bold bg-gold-500/10 px-3 py-1.5 rounded-lg border border-gold-500/30 whitespace-nowrap">
              Est. Cash Value: <strong>${estCashValue.toLocaleString()}</strong>
            </span>
            <span className="text-xs text-slate-300 font-bold bg-navy-900 px-3 py-1.5 rounded-lg border border-navy-700">
              Toggle View
            </span>
          </div>
        </summary>

        <div className="pt-4 space-y-6 border-t border-navy-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-4">
            <div>
              <span className="text-xs font-black text-gold-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-sm"></i> Expanded Asset Accumulation Engine
              </span>
              <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                Growth Projection Estimator Chart (<span className="text-gold-400">{selectedCarrier}</span>)
              </h3>
            </div>
            <div className="bg-navy-950 px-4 py-2 rounded-xl border border-gold-500/40 text-left lg:text-right shrink-0">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Est. Projected Cash Value</span>
              <strong className="text-xl font-black text-gold-400">${estCashValue.toLocaleString()}</strong>
            </div>
          </div>

          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 h-80 sm:h-[400px]">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>
      </details>
    </div>
  );
};
