import React, { useEffect, useMemo } from 'react';
import { ActiveStrategySnapshot, ClientData } from '../../types';
import { calculatePrivatePpoEstimate, getHouseholdSize } from '../../utils/calculations';

interface PrivateHealthDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
  onUpdateStrategySnapshot?: (snapshot: ActiveStrategySnapshot) => void;
}

export const PrivateHealthDashboard: React.FC<PrivateHealthDashboardProps> = ({
  clientData,
  onUpdateStrategySnapshot,
}) => {
  const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);

  const ppoQuote = useMemo(
    () =>
      calculatePrivatePpoEstimate({
        clientAge: clientData.clientAge,
        householdSize,
        tobacco: clientData.tobacco,
        preExisting: clientData.preExisting,
      }),
    [clientData.clientAge, householdSize, clientData.tobacco, clientData.preExisting]
  );

  const preferredDisplay = ppoQuote.hasPreExisting
    ? `$${ppoQuote.preferredRatedLowMonthly.toLocaleString()}–$${ppoQuote.preferredRatedHighMonthly.toLocaleString()}`
    : `$${ppoQuote.preferredMonthly.toLocaleString()}`;

  const choiceDisplay = ppoQuote.hasPreExisting
    ? `$${ppoQuote.choiceRatedLowMonthly.toLocaleString()}–$${ppoQuote.choiceRatedHighMonthly.toLocaleString()}`
    : `$${ppoQuote.choiceValueMonthly.toLocaleString()}`;

  useEffect(() => {
    if (!onUpdateStrategySnapshot) return;
    onUpdateStrategySnapshot({
      pathId: 'private_health',
      pathLabel: 'Private Health Plans',
      summaryHeadline: `Year-round medically underwritten Nationwide PPO (${choiceDisplay}–${preferredDisplay}/mo${ppoQuote.hasPreExisting ? ' rated est.' : ''})`,
      selectedTierOrOption: ppoQuote.hasPreExisting
        ? 'Med-Guard Preferred PPO / Choice Value PPO (Rated Est. - Pre-Existing Reported)'
        : 'Med-Guard Preferred PPO / Choice Value PPO',
      sliders: [
        { label: 'Pre-Existing Condition Underwriting', value: ppoQuote.hasPreExisting ? 'YES (+35% to +60% Rate-Up Risk)' : 'NO (Preferred Health Qualified)' },
        { label: 'Self-Reported Health Underwriting Tier', value: clientData.healthStatus.toUpperCase() },
        { label: 'Client Age & Household Size', value: `${clientData.clientAge} yrs · Household of ${householdSize}` },
        { label: 'Tobacco Status', value: clientData.tobacco === 'yes' ? 'Tobacco (+20% rated)' : 'Non-Tobacco' },
        { label: 'Enrollment Window Status', value: clientData.acaWindow },
      ],
      impactMetrics: [
        { label: 'Med-Guard Preferred PPO Est.', value: `${preferredDisplay}/mo ($${ppoQuote.preferredDeductible.toLocaleString()} ded | $${ppoQuote.preferredOopMax.toLocaleString()} Max OOP)` },
        { label: 'Choice Value PPO Est.', value: `${choiceDisplay}/mo ($${ppoQuote.choiceDeductible.toLocaleString()} ded | $${ppoQuote.choiceOopMax.toLocaleString()} Max OOP)` },
      ],
    });
  }, [
    onUpdateStrategySnapshot,
    preferredDisplay,
    choiceDisplay,
    ppoQuote.hasPreExisting,
    ppoQuote.preferredDeductible,
    ppoQuote.preferredOopMax,
    ppoQuote.choiceDeductible,
    ppoQuote.choiceOopMax,
    clientData.healthStatus,
    clientData.clientAge,
    clientData.tobacco,
    clientData.acaWindow,
    householdSize,
  ]);

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

        {ppoQuote.hasPreExisting && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-200 space-y-1.5">
            <div className="font-extrabold text-amber-300 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              Pre-Existing Condition Underwriting Notice (+35% to +60% Rate-Up Range Applied)
            </div>
            <p className="text-[11.5px] leading-relaxed text-amber-100/90">
              Because pre-existing conditions were indicated in your profile, private PPO underwriters may apply a +35% to +60% rate-up, condition waiver rider, or decline depending on medications/diagnosis. Always compare against Guaranteed-Issue Traditional ACA coverage before switching.
            </p>
          </div>
        )}

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
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/40">
                MED-GUARD PREFERRED PPO
              </span>
              <strong className="text-xl sm:text-2xl font-black text-white tabular-nums">{preferredDisplay} / mo</strong>
            </div>
            <p className="text-xs text-slate-300">Comprehensive first-dollar doctor visit copays, laboratory coverage, and emergency hospital care.</p>
            <div className="space-y-1.5 text-xs text-slate-300 border-t border-navy-800 pt-3">
              <div className="flex justify-between"><span>Household Size:</span> <strong className="text-white">{householdSize} {householdSize > 1 ? 'Members' : 'Individual'}</strong></div>
              <div className="flex justify-between"><span>Primary Care:</span> <strong className="text-emerald-400">$30 Copay (No Ded.)</strong></div>
              <div className="flex justify-between"><span>Specialist Visit:</span> <strong className="text-emerald-400">$60 Copay</strong></div>
              <div className="flex justify-between"><span>Annual Deductible:</span> <strong className="tabular-nums">${ppoQuote.preferredDeductible.toLocaleString()}</strong></div>
              <div className="flex justify-between"><span>Max Out of Pocket:</span> <strong className="tabular-nums">${ppoQuote.preferredOopMax.toLocaleString()}</strong></div>
            </div>
          </div>

          <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-4">
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-300 bg-navy-800 px-2 py-0.5 rounded border border-navy-700">
                CHOICE VALUE PPO
              </span>
              <strong className="text-xl sm:text-2xl font-black text-white tabular-nums">{choiceDisplay} / mo</strong>
            </div>
            <p className="text-xs text-slate-300">Affordable catastrophic and outpatient shield tailored for cost-conscious healthy families and 1099 contractors.</p>
            <div className="space-y-1.5 text-xs text-slate-300 border-t border-navy-800 pt-3">
              <div className="flex justify-between"><span>Household Size:</span> <strong className="text-white">{householdSize} {householdSize > 1 ? 'Members' : 'Individual'}</strong></div>
              <div className="flex justify-between"><span>Preventive Wellness:</span> <strong className="text-emerald-400">100% Covered ($0)</strong></div>
              <div className="flex justify-between"><span>Urgent Care:</span> <strong className="text-emerald-400">$50 Copay</strong></div>
              <div className="flex justify-between"><span>Annual Deductible:</span> <strong className="tabular-nums">${ppoQuote.choiceDeductible.toLocaleString()}</strong></div>
              <div className="flex justify-between"><span>Max Out of Pocket:</span> <strong className="tabular-nums">${ppoQuote.choiceOopMax.toLocaleString()}</strong></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
