import React from 'react';
import { ClientData } from '../../types';

interface PrivateHealthDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const PrivateHealthDashboard: React.FC<PrivateHealthDashboardProps> = ({
  clientData,
}) => {
  const ageFactor = Math.pow(1.03, Math.max(0, clientData.clientAge - 25));
  const basePrem = Math.round(285 * ageFactor);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-purple-500 glow-purple space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-purple-500/40 flex items-center justify-center text-purple-400 text-2xl">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <div>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Medically Underwritten Platform
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white">Private PPO Health Plans</h3>
            </div>
          </div>
          <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-purple-500/30 text-xs text-purple-300 font-bold">
            <i className="fa-solid fa-calendar-check mr-1"></i> Year-Round Open Enrollment
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Medically underwritten private health plans reward good health with <strong>substantially lower premiums (often 30% to 50% less than unsubsidized ACA plans)</strong>, zero referral requirements, and unrestricted access to nationwide PPO networks (Cigna Open Access / UnitedHealthcare Choice Plus).
        </p>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 space-y-2">
            <div className="text-purple-400 text-lg"><i className="fa-solid fa-map-location-dot"></i></div>
            <strong className="text-white text-xs block">True Nationwide PPO Network</strong>
            <p className="text-[11px] text-slate-400">See any specialist or hospital across all 50 states without gatekeeper referrals.</p>
          </div>
          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 space-y-2">
            <div className="text-emerald-400 text-lg"><i className="fa-solid fa-clock"></i></div>
            <strong className="text-white text-xs block">Zero Open Enrollment Deadlines</strong>
            <p className="text-[11px] text-slate-400">Apply and begin coverage on any day of the year without qualifying life events (SEP).</p>
          </div>
          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 space-y-2">
            <div className="text-gold-400 text-lg"><i className="fa-solid fa-file-invoice-dollar"></i></div>
            <strong className="text-white text-xs block">Preferred Health Rate Locks</strong>
            <p className="text-[11px] text-slate-400">Healthy individuals don&apos;t subsidize the high-risk claims of general exchange pools.</p>
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-navy-950 p-5 rounded-2xl border border-purple-500/50 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/40">
                MED-GUARD PREFERRED PPO
              </span>
              <strong className="text-2xl font-black text-white">${basePrem} / mo</strong>
            </div>
            <p className="text-xs text-slate-300">Comprehensive first-dollar doctor visit copays, laboratory coverage, and emergency hospital care.</p>
            <div className="space-y-1.5 text-xs text-slate-300 border-t border-navy-800 pt-3">
              <div className="flex justify-between"><span>Primary Care:</span> <strong className="text-emerald-400">$30 Copay (No Ded.)</strong></div>
              <div className="flex justify-between"><span>Specialist Visit:</span> <strong className="text-emerald-400">$60 Copay</strong></div>
              <div className="flex justify-between"><span>Annual Deductible:</span> <strong>$2,500</strong></div>
              <div className="flex justify-between"><span>Max Out of Pocket:</span> <strong>$5,000</strong></div>
            </div>
          </div>

          <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-slate-300 bg-navy-800 px-2 py-0.5 rounded border border-navy-700">
                CHOICE VALUE PPO
              </span>
              <strong className="text-2xl font-black text-white">${Math.round(basePrem * 0.82)} / mo</strong>
            </div>
            <p className="text-xs text-slate-300">Affordable catastrophic and outpatient shield tailored for cost-conscious healthy families and 1099 contractors.</p>
            <div className="space-y-1.5 text-xs text-slate-300 border-t border-navy-800 pt-3">
              <div className="flex justify-between"><span>Preventive Wellness:</span> <strong className="text-emerald-400">100% Covered ($0)</strong></div>
              <div className="flex justify-between"><span>Urgent Care:</span> <strong className="text-emerald-400">$50 Copay</strong></div>
              <div className="flex justify-between"><span>Annual Deductible:</span> <strong>$5,000</strong></div>
              <div className="flex justify-between"><span>Max Out of Pocket:</span> <strong>$7,500</strong></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
