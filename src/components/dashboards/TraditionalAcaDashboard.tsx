import React from 'react';
import { ClientData } from '../../types';
import { calculateAcaDetails, getHouseholdSize } from '../../utils/calculations';
import { REGIONAL_HEALTH_CARRIERS } from '../../utils/constants';

interface TraditionalAcaDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const TraditionalAcaDashboard: React.FC<TraditionalAcaDashboardProps> = ({
  clientData,
  onChangeClientData,
}) => {
  const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);
  const aca = calculateAcaDetails(clientData.grossAGI, householdSize, clientData.clientAge);
  const carrier = REGIONAL_HEALTH_CARRIERS.find((c) => c.id === clientData.selectedHealthCarrier) || REGIONAL_HEALTH_CARRIERS[0];

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-emerald-500 glow-emerald space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Direct Marketplace Enrollment
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white">Traditional ACA Exchange Signup</h3>
            </div>
          </div>
          <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-emerald-500/30 text-xs text-emerald-300 font-bold">
            Standard ACA Benchmark
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Standard Affordable Care Act (ACA) marketplace registration based strictly on your unadjusted reported gross income of <strong>${clientData.grossAGI.toLocaleString()}/yr (~{aca.fplPct}% FPL)</strong>. Note: Without pre-tax MAGI reduction via the AtlasBridge strategy, higher income levels may face reduced APTC premium subsidies or higher out-of-pocket deductibles.
        </p>

        {/* Plan Tier Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Bronze Tier */}
          <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  BRONZE (60% AV)
                </span>
                <i className="fa-solid fa-medal text-amber-400"></i>
              </div>
              <h4 className="text-base font-extrabold text-white">Catastrophic Protection</h4>
              <div className="text-2xl font-black text-white">
                ${Math.max(0, Math.round(aca.netMonthlyPremium * 0.55))} / mo
              </div>
              <p className="text-xs text-slate-400">Lowest monthly premium, but high deductible before benefits activate.</p>
              <div className="space-y-1 text-xs pt-2 border-t border-navy-800 text-slate-300">
                <div className="flex justify-between"><span>Deductible:</span> <strong>$7,500 / yr</strong></div>
                <div className="flex justify-between"><span>Max OOP:</span> <strong>$9,100 / yr</strong></div>
                <div className="flex justify-between"><span>Primary Copay:</span> <strong>$45 after ded.</strong></div>
              </div>
            </div>
          </div>

          {/* Silver Tier */}
          <div className="bg-navy-950 p-5 rounded-2xl border-2 border-emerald-500 space-y-4 glow-emerald flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
                  SILVER BENCHMARK ({aca.av})
                </span>
                <i className="fa-solid fa-medal text-emerald-400"></i>
              </div>
              <h4 className="text-base font-extrabold text-white">Benchmark Exchange Plan</h4>
              <div className="text-2xl font-black text-emerald-400">${aca.netMonthlyPremium} / mo</div>
              <p className="text-xs text-slate-400">Standard benchmark plan tier where government APTC subsidies are calculated.</p>
              <div className="space-y-1 text-xs pt-2 border-t border-navy-800 text-slate-300">
                <div className="flex justify-between"><span>Selected Carrier:</span> <strong className="text-emerald-400">{carrier.name}</strong></div>
                <div className="flex justify-between"><span>Deductible:</span> <strong>${aca.deductible.toLocaleString()} / yr</strong></div>
                <div className="flex justify-between"><span>Max OOP:</span> <strong>${aca.oopMax.toLocaleString()} / yr</strong></div>
                <div className="flex justify-between"><span>CSR Tier:</span> <strong className="text-emerald-300">{aca.csrLevel}</strong></div>
              </div>
            </div>
          </div>

          {/* Gold Tier */}
          <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/30">
                  GOLD (80% AV)
                </span>
                <i className="fa-solid fa-medal text-gold-400"></i>
              </div>
              <h4 className="text-base font-extrabold text-white">Comprehensive Care</h4>
              <div className="text-2xl font-black text-white">
                ${Math.round(aca.netMonthlyPremium * 1.45 + 50)} / mo
              </div>
              <p className="text-xs text-slate-400">Lower deductibles and predictable copays for regular medical visits.</p>
              <div className="space-y-1 text-xs pt-2 border-t border-navy-800 text-slate-300">
                <div className="flex justify-between"><span>Deductible:</span> <strong>$1,500 / yr</strong></div>
                <div className="flex justify-between"><span>Max OOP:</span> <strong>$7,000 / yr</strong></div>
                <div className="flex justify-between"><span>Primary Copay:</span> <strong>$20 flat copay</strong></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
