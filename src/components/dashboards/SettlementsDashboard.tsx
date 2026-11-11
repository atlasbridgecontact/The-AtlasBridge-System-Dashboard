import React, { useState } from 'react';
import { ClientData } from '../../types';
import { SoundFX } from '../../utils/audio';

interface SettlementsDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const SettlementsDashboard: React.FC<SettlementsDashboardProps> = ({
  clientData,
}) => {
  const [faceValue, setFaceValue] = useState<number>(500000);
  const [cashSurrenderVal, setCashSurrenderVal] = useState<number>(35000);

  // Settlement valuation (typically 18% - 32% of policy face value, heavily beating surrender value)
  const settlementPct = clientData.clientAge >= 70 ? 0.28 : clientData.clientAge >= 65 ? 0.22 : 0.16;
  const estSettlementPayout = Math.round(faceValue * settlementPct);
  const netSurplusOverSurrender = Math.max(0, estSettlementPayout - cashSurrenderVal);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-silver-400 glow-silver space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-silver-500/40 flex items-center justify-center text-silver-400 text-2xl">
              <i className="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <div>
              <span className="text-xs font-bold text-silver-400 uppercase tracking-wider">
                Secondary Life Policy Market
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white">Life Settlement Valuation Suite</h3>
            </div>
          </div>
          <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-silver-500/30 text-xs text-silver-300 font-bold">
            Institutional Secondary Market
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Did you know that over 85% of universal and term life policies lapse without ever paying a death benefit? If you are age 65+ (or have experienced a change in health status) with an unwanted, unneeded, or overly expensive life policy, you can sell your policy to an institutional buyer for a <strong>cash settlement typically 3x to 8x higher than the carrier&apos;s surrender value</strong>.
        </p>

        {/* Inputs */}
        <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Policy Death Benefit / Face Value ($):</span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-silver-500/40">
                  <span className="text-silver-400 font-bold">$</span>
                  <input
                    type="number"
                    min="100000"
                    max="5000000"
                    step="25000"
                    value={faceValue}
                    onChange={(e) => setFaceValue(Math.max(100000, parseFloat(e.target.value) || 100000))}
                    className="w-28 bg-transparent text-white font-extrabold text-xs focus:outline-none text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="100000"
                max="2000000"
                step="25000"
                value={Math.min(2000000, faceValue)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 100000;
                  SoundFX.playSlideHum((val - 100000) / 1900000);
                  setFaceValue(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-silver-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Insurance Carrier Cash Surrender Value ($):</span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-navy-700">
                  <span className="text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    max="500000"
                    step="5000"
                    value={cashSurrenderVal}
                    onChange={(e) => setCashSurrenderVal(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-transparent text-white font-extrabold text-xs focus:outline-none text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="200000"
                step="5000"
                value={Math.min(200000, cashSurrenderVal)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  SoundFX.playSlideHum(val / 200000);
                  setCashSurrenderVal(val);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-slate-500"
              />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-navy-900 p-4 rounded-xl border border-navy-700 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Carrier Surrender Cash</span>
            <div className="text-2xl font-black text-slate-400">${cashSurrenderVal.toLocaleString()}</div>
            <span className="text-[10px] text-rose-400">Low Carrier Return</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-silver-400/50 space-y-1 bg-navy-800/60 glow-silver">
            <span className="text-[10px] text-silver-300 uppercase font-bold">Est. Secondary Market Payout</span>
            <div className="text-2xl font-black text-silver-300">${estSettlementPayout.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-400">Lump-Sum Immediate Cash</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/40 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-bold">Additional Arbitrage Cash</span>
            <div className="text-2xl font-black text-emerald-300">+${netSurplusOverSurrender.toLocaleString()}</div>
            <span className="text-[10px] text-slate-400">Over Carrier Cash Surrender</span>
          </div>
        </div>

        {/* Retained Death Benefit Option */}
        <div className="bg-navy-950 p-4 rounded-xl border border-silver-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            <strong className="text-white block font-bold">Retained Death Benefit Alternative:</strong>
            <p className="text-slate-400 mt-0.5">
              Keep a portion of your death benefit (e.g., <strong>${Math.round(faceValue * 0.4).toLocaleString()}</strong>) for your beneficiaries completely paid up, with <strong>$0 further premium payments</strong> forever.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-navy-900 border border-silver-500/40 text-silver-300 font-bold whitespace-nowrap">
            Zero Premiums Forever
          </span>
        </div>
      </section>
    </div>
  );
};
