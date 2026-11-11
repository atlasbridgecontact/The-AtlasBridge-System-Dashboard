import React, { useState } from 'react';
import { ClientData } from '../../types';
import { SoundFX } from '../../utils/audio';

interface RolloversDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const RolloversDashboard: React.FC<RolloversDashboardProps> = ({
  clientData,
  onChangeClientData,
}) => {
  const [rolloverCapital, setRolloverCapital] = useState<number>(
    Math.max(20000, clientData.dormantRetirement || 75000)
  );
  const [currentFeeRate, setCurrentFeeRate] = useState<number>(1.75); // 1.75% avg advisor/fund fee
  const [bonusRate] = useState<number>(8); // 8% upfront bonus

  const isMarried = clientData.filingStatus === 'married';
  const upfrontBonus = Math.round(rolloverCapital * (bonusRate / 100));
  const newStartingBalance = rolloverCapital + upfrontBonus;
  const annualFeeSaved = Math.round(rolloverCapital * (currentFeeRate / 100));
  const tenYearFeeSaved = Math.round(annualFeeSaved * 10 * 1.25);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-cyan-500 glow-blue space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-2xl">
              <i className="fa-solid fa-arrow-rotate-right"></i>
            </div>
            <div>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Tax-Free Asset Consolidation
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white">Rollovers &amp; 1035 Exchange Engine</h3>
            </div>
          </div>
          <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-cyan-500/30 text-xs text-cyan-300 font-bold">
            <i className="fa-solid fa-check-double mr-1"></i> IRC 402(c) Direct Transfer
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Consolidate dormant 401(k)s, 403(b)s, governmental TSPs, or outdated annuities into a modern high-performance contract with <strong>$0 tax penalty, 0% downside market loss</strong>, and up to an <strong>8% immediate upfront carrier bonus</strong>.
        </p>

        {/* Inputs */}
        <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">
                  Dormant Plan Balance to Roll Over ($){' '}
                  {isMarried && <span className="text-gold-400 font-bold">(Including Spouse)</span>}:
                </span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-cyan-500/40">
                  <span className="text-cyan-400 font-bold">$</span>
                  <input
                    type="number"
                    min="10000"
                    max="1000000"
                    step="5000"
                    value={rolloverCapital}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 10000;
                      setRolloverCapital(val);
                      onChangeClientData({ dormantRetirement: val });
                    }}
                    className="w-28 bg-transparent text-white font-extrabold text-xs focus:outline-none text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="10000"
                max="500000"
                step="5000"
                value={Math.min(500000, rolloverCapital)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 10000;
                  SoundFX.playSlideHum(val / 500000);
                  setRolloverCapital(val);
                  onChangeClientData({ dormantRetirement: val });
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Current Custodian / Mutual Fund Fee Drag (%/yr):</span>
                <span className="text-amber-400 font-extrabold text-xs">{currentFeeRate}% per year</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.25"
                value={currentFeeRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 1.0;
                  SoundFX.playSlideHum((val - 0.5) / 2.5);
                  setCurrentFeeRate(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-navy-900 p-4 rounded-xl border border-navy-700 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Direct Transfer Capital</span>
            <div className="text-2xl font-black text-white">${rolloverCapital.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-400">$0 Tax Withholding</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-cyan-500/40 space-y-1 bg-cyan-950/20 glow-blue">
            <span className="text-[10px] text-cyan-400 uppercase font-bold">Instant Upfront Bonus (+8%)</span>
            <div className="text-2xl font-black text-cyan-300">+${upfrontBonus.toLocaleString()}</div>
            <span className="text-[10px] text-cyan-400">Credited on Day 1</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-gold-500/40 space-y-1">
            <span className="text-[10px] text-gold-400 uppercase font-bold">New Protected Starting Base</span>
            <div className="text-2xl font-black text-gold-300">${newStartingBalance.toLocaleString()}</div>
            <span className="text-[10px] text-slate-400">Principal Protected</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/40 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-bold">10-Yr Fee Waste Eliminated</span>
            <div className="text-2xl font-black text-emerald-300">+${tenYearFeeSaved.toLocaleString()}</div>
            <span className="text-[10px] text-slate-400">Retained in Your Pocket</span>
          </div>
        </div>

        {/* Advisory Transfer Protocol Checklist */}
        <div className="bg-navy-950 p-4 sm:p-5 rounded-xl border border-navy-800 space-y-3 text-xs text-slate-300">
          <h4 className="font-extrabold text-cyan-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-list-check"></i> Fiduciary Direct Rollover Safeguards
          </h4>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>
              <strong>Direct Trustee-to-Trustee Transfer:</strong> The check is made payable directly to the receiving carrier for your benefit (FBO You), strictly bypassing the 20% mandatory federal withholding required for indirect rollovers.
            </li>
            <li>
              <strong>Preservation of Pre-Tax Tax Umbrella:</strong> The transfer qualifies under IRC Section 402(c), generating an IRS Form 1099-R with Distribution Code G (Direct Rollover) indicating $0 taxable event.
            </li>
            <li>
              <strong>Zero Market Exposure During Transfer:</strong> Lock in gains from previous volatile equity positions and eliminate unmanaged 401(k) administrative fees.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};
