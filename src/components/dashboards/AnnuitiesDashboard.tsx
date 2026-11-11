import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { ClientData } from '../../types';
import { SoundFX } from '../../utils/audio';

Chart.register(...registerables);

interface AnnuitiesDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const AnnuitiesDashboard: React.FC<AnnuitiesDashboardProps> = ({
  clientData,
  onChangeClientData,
}) => {
  const [fundingSource, setFundingSource] = useState<'qualified' | 'non_qualified'>('qualified');
  const [annuityCategory, setAnnuityCategory] = useState<'fia' | 'myga' | 'spia' | 'fpa'>('fia');
  const [principalDeposit, setPrincipalDeposit] = useState<number>(
    Math.max(25000, clientData.dormantRetirement || clientData.existingAnnuityCash || 100000)
  );
  const [deferralYears, setDeferralYears] = useState<number>(5);

  const isQualified = fundingSource === 'qualified';
  const age = clientData.clientAge;

  // FIA calculation
  const fiaBonusPct = 0.08; // 8% upfront premium bonus
  const fiaGrowthRate = 0.072; // ~7.2% S&P 500 participation
  const bonusCapital = principalDeposit * (annuityCategory === 'fia' ? fiaBonusPct : 0);
  const startingBase = principalDeposit + bonusCapital;

  let projectedValue = startingBase;
  const rate = annuityCategory === 'myga' ? 0.0565 : annuityCategory === 'fia' ? fiaGrowthRate : 0.048;
  for (let i = 1; i <= deferralYears; i++) {
    projectedValue *= 1 + rate;
  }
  const estFutureValue = Math.round(projectedValue);

  // Lifelong guaranteed income withdrawal rate (starts around 5.2% at age 60, rises by 0.1% per year)
  const incomeAge = age + deferralYears;
  const payoutFactor = Math.min(0.085, Math.max(0.045, 0.05 + (incomeAge - 60) * 0.0015));
  const annualGuaranteedIncome = Math.round(estFutureValue * payoutFactor);
  const monthlyGuaranteedIncome = Math.round(annualGuaranteedIncome / 12);

  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const simYears = Math.max(5, deferralYears);
    const labels = ['Start'];
    const fiaData = [Math.round(startingBase)];
    const sp500Data = [Math.round(principalDeposit)];

    // Historical simulated market sequence with realistic pullbacks
    const sp500Returns = [0.18, -0.18, 0.14, 0.22, -0.12, 0.16, 0.08, -0.15, 0.21, 0.10, 0.12, -0.09, 0.19, 0.07, 0.15];

    let fiaBalance = startingBase;
    let sp500Balance = principalDeposit;

    for (let i = 0; i < simYears; i++) {
      labels.push(`Year ${i + 1}`);
      const marketReturn = sp500Returns[i % sp500Returns.length];
      sp500Balance = Math.max(1000, sp500Balance * (1 + marketReturn));
      sp500Data.push(Math.round(sp500Balance));

      // FIA crediting: Participation with 0% Downside Floor
      const creditedRate = marketReturn > 0 ? Math.min(rate, marketReturn * 0.75) : 0.0;
      fiaBalance = fiaBalance * (1 + creditedRate);
      fiaData.push(Math.round(fiaBalance));
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Fixed Indexed Annuity (0% Floor Guarantee)',
            data: fiaData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            fill: true,
            tension: 0.3,
            borderWidth: 3,
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
          },
          {
            label: 'S&P 500 Direct Volatility (Unprotected)',
            data: sp500Data,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            borderWidth: 2,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 3,
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
              font: { family: 'Poppins', size: 11, weight: 'bold' },
            },
          },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.dataset.label}: $${Number(item.raw).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'Poppins', size: 10 } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Poppins', size: 10 },
              callback: (val) => '$' + Number(val).toLocaleString(),
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [startingBase, principalDeposit, deferralYears, rate, annuityCategory]);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-gold-500 glow-gold space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-gold-500/40 flex items-center justify-center text-gold-400 text-2xl">
              <i className="fa-solid fa-vault"></i>
            </div>
            <div>
              <span className="text-xs font-bold text-gold-400 uppercase tracking-wider">
                Fiduciary Wealth Preservation
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white">Annuities &amp; Guaranteed Income Suite</h3>
            </div>
          </div>
          <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-gold-500/30 text-xs text-gold-300 font-bold">
            <i className="fa-solid fa-shield-halved mr-1"></i> 0% Market Downside Floor
          </div>
        </div>

        {/* Funding Type Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => {
              SoundFX.playClick();
              setFundingSource('qualified');
            }}
            className={`p-4 rounded-xl cursor-pointer transition border flex items-start gap-3 ${
              isQualified
                ? 'bg-navy-900 border-gold-500/80 glow-gold'
                : 'bg-navy-950/70 border-navy-800 hover:border-gold-500/40'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-gold-500/20 text-gold-400 flex items-center justify-center text-lg shrink-0 mt-0.5">
              <i className="fa-solid fa-building-columns"></i>
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                Qualified Annuity (Pre-Tax)
                {isQualified && <i className="fa-solid fa-circle-check text-gold-400 text-xs"></i>}
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Funded with pre-tax IRA, 401(k), 403(b), or TSP rollovers. Contributions lower AGI and grow tax-deferred under IRC Section 408.
              </p>
            </div>
          </div>

          <div
            onClick={() => {
              SoundFX.playClick();
              setFundingSource('non_qualified');
            }}
            className={`p-4 rounded-xl cursor-pointer transition border flex items-start gap-3 ${
              !isQualified
                ? 'bg-navy-900 border-gold-500/80 glow-gold'
                : 'bg-navy-950/70 border-navy-800 hover:border-gold-500/40'
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0 mt-0.5">
              <i className="fa-solid fa-money-check-dollar"></i>
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                Non-Qualified Annuity (After-Tax / 1035)
                {!isQualified && <i className="fa-solid fa-circle-check text-emerald-400 text-xs"></i>}
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Funded with personal savings or tax-free IRC 1035 transfers from unwanted life insurance. Only interest earnings are taxable upon withdrawal.
              </p>
            </div>
          </div>
        </div>

        {/* Product Type Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'fia', name: 'Fixed Indexed (FIA)', desc: 'S&P 500 index upside + 0% floor', badge: 'Top Growth' },
            { id: 'myga', name: 'MYGA (Fixed Rate)', desc: 'Guaranteed 5.65% multi-year lock', badge: 'CD Alternative' },
            { id: 'spia', name: 'Immediate (SPIA)', desc: 'Instant lifelong paycheck in 30 days', badge: 'Immediate Cash' },
            { id: 'fpa', name: 'Flexible Premium (FPA)', desc: 'Ongoing monthly/annual deposits', badge: 'Flexible Saver' },
          ].map((prod) => (
            <button
              key={prod.id}
              onClick={() => {
                SoundFX.playClick();
                setAnnuityCategory(prod.id as typeof annuityCategory);
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                annuityCategory === prod.id
                  ? 'bg-navy-900 border-2 border-gold-500 glow-gold'
                  : 'bg-navy-950 border-navy-800 hover:border-gold-500/40'
              }`}
            >
              <div>
                <span className="text-[9px] font-bold uppercase text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/30 inline-block mb-1">
                  {prod.badge}
                </span>
                <strong className="text-white text-xs block">{prod.name}</strong>
                <p className="text-[10.5px] text-slate-400 mt-1 leading-tight">{prod.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Interactive Calculator Controls */}
        <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-6">
          <h4 className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-sliders text-xs"></i> Calibrate Deposit &amp; Income Horizon
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Initial Rollover / Principal Deposit ($):</span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-gold-500/40">
                  <span className="text-gold-400 font-bold">$</span>
                  <input
                    type="number"
                    min="10000"
                    max="1000000"
                    step="5000"
                    value={principalDeposit}
                    onChange={(e) => setPrincipalDeposit(Math.max(10000, parseFloat(e.target.value) || 10000))}
                    className="w-28 bg-transparent text-white font-extrabold text-xs focus:outline-none text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="10000"
                max="500000"
                step="5000"
                value={Math.min(500000, principalDeposit)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 10000;
                  SoundFX.playSlideHum((val - 10000) / 490000);
                  setPrincipalDeposit(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Growth Deferral Period:</span>
                <span className="text-gold-400 font-extrabold text-xs">{deferralYears} Years (Age {incomeAge})</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={deferralYears}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  SoundFX.playSlideHum(val / 15);
                  setDeferralYears(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
              />
            </div>
          </div>
        </div>

        {/* Live KPI Projections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-navy-900 p-4 rounded-xl border border-navy-700 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Starting Account Base</span>
            <div className="text-2xl font-black text-white">${startingBase.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-400">
              {bonusCapital > 0 ? `+${(fiaBonusPct * 100)}% Bonus Applied ($${bonusCapital.toLocaleString()})` : '100% Principal Guaranteed'}
            </span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-gold-500/40 space-y-1 bg-gold-950/20 glow-gold">
            <span className="text-[10px] text-gold-400 uppercase font-bold">Projected Future Account Value</span>
            <div className="text-2xl font-black text-gold-300">${estFutureValue.toLocaleString()}</div>
            <span className="text-[10px] text-gold-400">Compound Growth at Year {deferralYears}</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/40 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-bold">Monthly Guaranteed Payout</span>
            <div className="text-2xl font-black text-emerald-300">${monthlyGuaranteedIncome.toLocaleString()} / mo</div>
            <span className="text-[10px] text-slate-400">Lifelong Guaranteed Check</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-blue-500/40 space-y-1">
            <span className="text-[10px] text-blue-300 uppercase font-bold">Annual Guaranteed Income</span>
            <div className="text-2xl font-black text-blue-400">${annualGuaranteedIncome.toLocaleString()} / yr</div>
            <span className="text-[10px] text-slate-400">Never Outlive Your Capital</span>
          </div>
        </div>

        {/* Interactive FIA vs S&P 500 Volatility Chart Card */}
        <div className="bg-navy-950 p-5 rounded-2xl border border-gold-500/40 space-y-4 shadow-xl glow-gold w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-800 pb-3">
            <div>
              <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block">
                Asymmetric Upside Architecture
              </span>
              <h4 className="text-base sm:text-lg font-black text-white">
                Fixed Indexed Annuity vs. S&amp;P 500 Market Volatility
              </h4>
              <p className="text-xs text-slate-300">
                Annual index resets lock in your high-water mark gains. When the market plunges, your return is 0% (zero loss of principal).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 whitespace-nowrap">
                <i className="fa-solid fa-shield-halved"></i> 0% Downside Principal Floor
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-80 w-full relative">
            <canvas ref={chartRef}></canvas>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="bg-navy-900/80 p-3 rounded-xl border border-navy-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Capital Preservation</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">Zero Downside Risk</div>
              <p className="text-[10px] text-slate-400 mt-1">Market crashes (-18%, -22%) receive 0%. Principal &amp; credited interest remain 100% intact.</p>
            </div>
            <div className="bg-navy-900/80 p-3 rounded-xl border border-navy-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Annual Reset &amp; Ratchet</div>
              <div className="text-sm font-black text-gold-400 mt-0.5">Locks In Profits Annually</div>
              <p className="text-[10px] text-slate-400 mt-1">Once gains are locked at policy anniversary, your new baseline is permanent and can never drop.</p>
            </div>
            <div className="bg-navy-900/80 p-3 rounded-xl border border-navy-800">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Triple Compounding</div>
              <div className="text-sm font-black text-blue-400 mt-0.5">100% Tax-Deferred</div>
              <p className="text-[10px] text-slate-400 mt-1">Compounds without annual 1099 tax drag, resulting in higher compounded lifetime wealth.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
