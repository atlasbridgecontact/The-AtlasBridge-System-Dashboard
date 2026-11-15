import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveStrategySnapshot,
  ClientData,
  PrivateHealthCarrierId,
  PrivatePpoTierId,
} from '../../types';
import {
  calculatePrivatePpoComparison,
  getHouseholdSize,
} from '../../utils/calculations';
import { PRIVATE_HEALTH_CARRIERS } from '../../utils/constants';
import { SoundFX } from '../../utils/audio';
import { ProviderNetworkMap } from './ProviderNetworkMap';

interface PrivateHealthDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
  onUpdateStrategySnapshot?: (snapshot: ActiveStrategySnapshot) => void;
}

const DEDUCTIBLE_TARGETS = [1500, 2500, 5000, 7500, 10000] as const;

export const PrivateHealthDashboard: React.FC<PrivateHealthDashboardProps> = ({
  clientData,
  onChangeClientData,
  onOpenBooking,
  onUpdateStrategySnapshot,
}) => {
  const [selectedCarrierId, setSelectedCarrierId] = useState<PrivateHealthCarrierId>('cigna_ppo');
  const [selectedTier, setSelectedTier] = useState<PrivatePpoTierId>('preferred');
  const [targetDeductible, setTargetDeductible] = useState<number>(2500);
  const [isProviderMapOpen, setIsProviderMapOpen] = useState<boolean>(false);

  const lastSnapshotJsonRef = useRef<string>('');

  const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);

  const carrier = useMemo(
    () =>
      PRIVATE_HEALTH_CARRIERS.find((c) => c.id === selectedCarrierId) || PRIVATE_HEALTH_CARRIERS[0],
    [selectedCarrierId]
  );

  const comparison = useMemo(
    () =>
      calculatePrivatePpoComparison({
        clientAge: clientData.clientAge,
        householdSize,
        tobacco: clientData.tobacco,
        preExisting: clientData.preExisting,
        carrierId: carrier.id,
        targetDeductibleInd: targetDeductible,
      }),
    [
      clientData.clientAge,
      householdSize,
      clientData.tobacco,
      clientData.preExisting,
      carrier.id,
      targetDeductible,
    ]
  );

  const activeTier = comparison.tiers[selectedTier];

  const activeMonthlyDisplay = comparison.hasPreExisting
    ? `$${activeTier.monthlyRatedLow.toLocaleString()}–$${activeTier.monthlyRatedHigh.toLocaleString()}`
    : `$${activeTier.monthlyPreferred.toLocaleString()}`;

  const activeAnnualDisplay = comparison.hasPreExisting
    ? `$${activeTier.annualRatedLow.toLocaleString()}–$${activeTier.annualRatedHigh.toLocaleString()}`
    : `$${activeTier.annualPreferred.toLocaleString()}`;

  // Sync live interactive state into ActiveStrategySnapshot (deduplicated)
  useEffect(() => {
    if (!onUpdateStrategySnapshot) return;
    const nextSnapshot: ActiveStrategySnapshot = {
      pathId: 'private_health',
      pathLabel: 'Private Health Plans',
      summaryHeadline: `${activeTier.title} via ${carrier.name} (${activeMonthlyDisplay}/mo${comparison.hasPreExisting ? ' rated est.' : ''})`,
      selectedCarrierOrVendor: carrier.name,
      selectedTierOrOption: `${activeTier.title} · $${activeTier.deductible.toLocaleString()} Ded`,
      sliders: [
        { label: 'Selected PPO Carrier', value: `${carrier.name} (${carrier.networkType})` },
        { label: 'Selected Plan Tier', value: `${activeTier.title} (${activeTier.badge})` },
        {
          label: 'Target Deductible Baseline',
          value: `$${targetDeductible.toLocaleString()} Ind ($${(targetDeductible * (householdSize > 1 ? 2 : 1)).toLocaleString()} ${householdSize > 1 ? 'Family' : 'Active'})`,
        },
        {
          label: 'Primary Applicant Age & Household',
          value: `${clientData.clientAge} yrs · Household of ${householdSize}`,
        },
        {
          label: 'Pre-Existing Underwriting',
          value: comparison.hasPreExisting
            ? 'YES (+35% to +60% Rate-Up Range)'
            : 'NO (Preferred Underwriting Qualified)',
        },
        {
          label: 'Tobacco Status',
          value: clientData.tobacco === 'yes' ? 'Tobacco (+20% rated)' : 'Non-Tobacco',
        },
        { label: 'Service ZIP Code', value: clientData.zipCode || '34994' },
      ],
      impactMetrics: [
        {
          label: 'Estimated Monthly PPO Premium',
          value: `${activeMonthlyDisplay}/mo (${activeAnnualDisplay}/yr)`,
        },
        {
          label: 'Deductible & Max Out-of-Pocket',
          value: `$${activeTier.deductible.toLocaleString()} Ded | $${activeTier.maxOop.toLocaleString()} Max OOP`,
        },
        {
          label: 'Outpatient & Coinsurance Terms',
          value: `${activeTier.primaryCopayLabel} | ${activeTier.coinsuranceLabel}`,
        },
      ],
    };

    const serialized = JSON.stringify(nextSnapshot);
    if (serialized === lastSnapshotJsonRef.current) return;
    lastSnapshotJsonRef.current = serialized;
    onUpdateStrategySnapshot(nextSnapshot);
  }, [
    onUpdateStrategySnapshot,
    carrier.name,
    carrier.networkType,
    activeTier.title,
    activeTier.badge,
    activeTier.deductible,
    activeTier.maxOop,
    activeTier.primaryCopayLabel,
    activeTier.coinsuranceLabel,
    activeMonthlyDisplay,
    activeAnnualDisplay,
    targetDeductible,
    clientData.clientAge,
    clientData.tobacco,
    clientData.zipCode,
    comparison.hasPreExisting,
    householdSize,
  ]);

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-purple-500 glow-purple space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-purple-500/40 flex items-center justify-center text-purple-400 text-2xl shrink-0">
              <i className="fa-solid fa-user-shield"></i>
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-purple-300 uppercase tracking-wider block">
                Medically Underwritten PPO Explorer
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                Private PPO Health Plans &amp; Network Explorer
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 bg-navy-950 p-3 rounded-2xl border border-purple-500/40 shadow-xl self-start lg:self-auto">
            <div className="flex items-center gap-2 bg-navy-900/90 px-3 py-1.5 rounded-xl border border-navy-700">
              <span className="text-xs text-purple-300 font-bold whitespace-nowrap">
                <i className="fa-solid fa-users mr-1"></i> Household:
              </span>
              <span className="text-xs font-extrabold text-white tabular-nums">
                {householdSize} {householdSize > 1 ? 'Members' : 'Individual'}
              </span>
            </div>
            <div className="h-6 w-px bg-navy-700 hidden sm:block"></div>
            <div className="bg-navy-900/90 px-3 py-1.5 rounded-xl border border-emerald-500/30 text-xs text-emerald-300 font-extrabold whitespace-nowrap">
              <i className="fa-solid fa-calendar-check mr-1"></i> Year-Round Open Enrollment
            </div>
          </div>
        </div>

        {/* Pre-Existing Condition Underwriting Alert */}
        {comparison.hasPreExisting && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-200 space-y-1.5">
            <div className="font-extrabold text-amber-300 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              Pre-Existing Condition Underwriting Notice (+35% to +60% Rate-Up Range Applied)
            </div>
            <p className="text-[11.5px] leading-relaxed text-amber-100/90">
              Because pre-existing conditions are active in your underwriting profile, private PPO carriers may apply a <strong>+35% to +60% rate-up</strong>, attach condition exclusion riders, or decline coverage based on medications/diagnosis. Always weigh rated PPO pricing against Guaranteed-Issue Traditional ACA coverage.
            </p>
          </div>
        )}

        {/* Two-Column Interactive Underwriting Calibration & Selected Plan Cost Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Interactive Underwriting, Age & Deductible Controls */}
          <div className="bg-navy-950/85 p-5 rounded-2xl border border-navy-700/80 space-y-5 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              {/* Primary Age Slider + Numeric Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-slate-300 font-bold">
                    <i className="fa-solid fa-user-clock text-purple-400 mr-1.5"></i> Primary Applicant Age:
                  </span>
                  <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-purple-500/40">
                    <input
                      type="number"
                      min={18}
                      max={64}
                      value={clientData.clientAge}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val)) {
                          onChangeClientData({ clientAge: Math.min(64, Math.max(18, val)) });
                        }
                      }}
                      className="w-12 bg-transparent text-white font-extrabold text-sm focus:outline-none text-right tabular-nums"
                    />
                    <span className="text-purple-300 font-bold text-xs">yrs</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={18}
                  max={64}
                  step={1}
                  value={Math.min(64, Math.max(18, clientData.clientAge))}
                  onChange={(e) => {
                    const ageVal = parseInt(e.target.value, 10);
                    SoundFX.playSlideHum((ageVal - 18) / (64 - 18));
                    onChangeClientData({ clientAge: ageVal });
                  }}
                  className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium px-0.5 tabular-nums">
                  <span>Age 18</span>
                  <span>Age 40 Baseline</span>
                  <span>Age 64 Pre-Medicare</span>
                </div>
              </div>

              {/* Underwriting Factor Toggles (Pre-Existing + Tobacco) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-navy-900 p-3 rounded-xl border border-navy-800 space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Pre-Existing Conditions
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        SoundFX.playClick();
                        onChangeClientData({ preExisting: 'no' });
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                        clientData.preExisting === 'no'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-navy-950 text-slate-400 hover:text-white border border-navy-800'
                      }`}
                    >
                      No (Preferred)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SoundFX.playClick();
                        onChangeClientData({ preExisting: 'yes' });
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                        clientData.preExisting === 'yes'
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-navy-950 text-slate-400 hover:text-white border border-navy-800'
                      }`}
                    >
                      Yes (+35–60%)
                    </button>
                  </div>
                </div>

                <div className="bg-navy-900 p-3 rounded-xl border border-navy-800 space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Tobacco Underwriting
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        SoundFX.playClick();
                        onChangeClientData({ tobacco: 'no' });
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                        clientData.tobacco === 'no'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-navy-950 text-slate-400 hover:text-white border border-navy-800'
                      }`}
                    >
                      Non-Tobacco
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        SoundFX.playClick();
                        onChangeClientData({ tobacco: 'yes' });
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
                        clientData.tobacco === 'yes'
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-navy-950 text-slate-400 hover:text-white border border-navy-800'
                      }`}
                    >
                      Tobacco (+20%)
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Deductible Baseline Selector */}
              <div className="bg-navy-900 p-3.5 rounded-xl border border-purple-500/30 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">
                    <i className="fa-solid fa-sliders mr-1"></i> Target Preferred Deductible
                  </span>
                  <span className="text-[10.5px] text-slate-400 tabular-nums">
                    {comparison.isFamily
                      ? `Family 2× scaling: $${(targetDeductible * 2).toLocaleString()}`
                      : `Individual: $${targetDeductible.toLocaleString()}`}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {DEDUCTIBLE_TARGETS.map((ded) => {
                    const isSelected = targetDeductible === ded;
                    return (
                      <button
                        key={ded}
                        type="button"
                        onClick={() => {
                          SoundFX.playClick();
                          setTargetDeductible(ded);
                        }}
                        className={`py-1.5 px-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer tabular-nums ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 border border-purple-400'
                            : 'bg-navy-950 text-slate-300 hover:text-white border border-navy-800 hover:border-purple-500/40'
                        }`}
                      >
                        ${(ded / 1000).toFixed(ded % 1000 === 0 ? 0 : 1)}k
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-navy-800/80 text-[10.5px] text-slate-400 flex items-center justify-between gap-2">
              <span>Carrier Rate Calibration:</span>
              <strong className="text-purple-300">{carrier.name} · {carrier.networkType}</strong>
            </div>
          </div>

          {/* Right Panel: Selected Private PPO Plan Total Cost Box */}
          <div className="bg-navy-950/90 p-5 rounded-2xl border border-gold-500/40 space-y-4 shadow-xl glow-gold flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 border-b border-navy-800 pb-3">
                <div>
                  <span className="text-[10px] text-purple-300 font-extrabold uppercase tracking-wider block">
                    {activeTier.badge} · Active Plan Estimate
                  </span>
                  <h4 className="text-base sm:text-xl font-black text-white">{activeTier.title}</h4>
                </div>
                <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/30 shrink-0">
                  {carrier.name}
                </span>
              </div>

              {/* Monthly & Annualized Premium Display */}
              <div className="bg-navy-900 p-4 rounded-xl border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Estimated Monthly PPO Rate
                  </span>
                  <strong className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                    {activeMonthlyDisplay} <span className="text-xs font-bold text-slate-400">/ mo</span>
                  </strong>
                  {comparison.hasPreExisting && (
                    <span className="text-[10.5px] text-amber-300 font-semibold block mt-0.5 tabular-nums">
                      +35%–60% rated range (Preferred base: ${activeTier.monthlyPreferred.toLocaleString()}/mo)
                    </span>
                  )}
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] text-gold-300 font-bold uppercase block">
                    Annualized Premiums
                  </span>
                  <strong className="text-lg font-extrabold text-gold-400 tabular-nums">
                    {activeAnnualDisplay} / yr
                  </strong>
                </div>
              </div>

              {/* 4-Cell Coverage Metrics */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-navy-900 p-3 rounded-xl border border-navy-800">
                  <span className="text-[10px] text-slate-400 block">
                    Annual Deductible {comparison.isFamily ? '(Family)' : '(Individual)'}
                  </span>
                  <strong className="text-white font-extrabold tabular-nums text-sm">
                    ${activeTier.deductible.toLocaleString()}
                  </strong>
                </div>
                <div className="bg-navy-900 p-3 rounded-xl border border-navy-800">
                  <span className="text-[10px] text-slate-400 block">
                    Max Out-of-Pocket Cap
                  </span>
                  <strong className="text-emerald-300 font-extrabold tabular-nums text-sm">
                    ${activeTier.maxOop.toLocaleString()}
                  </strong>
                </div>
                <div className="bg-navy-900 p-3 rounded-xl border border-navy-800">
                  <span className="text-[10px] text-slate-400 block">Primary / Specialist Copay</span>
                  <strong className="text-slate-100 font-bold text-xs block">
                    {activeTier.primaryCopayLabel}
                  </strong>
                  <span className="text-[10.5px] text-slate-400 block">
                    Spec: {activeTier.specialistCopayLabel}
                  </span>
                </div>
                <div className="bg-navy-900 p-3 rounded-xl border border-navy-800">
                  <span className="text-[10px] text-slate-400 block">Coinsurance &amp; Status</span>
                  <strong className="text-blue-300 font-bold text-xs block">
                    {activeTier.coinsuranceLabel}
                  </strong>
                  <span
                    className={`text-[10.5px] font-bold block ${
                      comparison.hasPreExisting ? 'text-amber-300' : 'text-emerald-400'
                    }`}
                  >
                    {comparison.hasPreExisting ? 'Medically Rated Review' : 'Preferred Rate Eligible'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                SoundFX.playClick();
                onOpenBooking();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-calendar-check"></i>
              <span>Lock {carrier.name} Underwriting Quote</span>
            </button>
          </div>
        </div>

        {/* Interactive Private PPO Carrier Selector & Local Provider Network Map Banner */}
        <div className="bg-navy-950 p-5 rounded-xl border border-blue-500/50 space-y-4 glow-blue">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/80 pb-3">
            <div>
              <h4 className="text-base sm:text-lg font-extrabold text-white">
                Active PPO Network: <span className="text-purple-400">{carrier.name}</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                <strong className="text-blue-300">{carrier.networkType}</strong> — {carrier.networkStrength}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-navy-900 px-3 py-1.5 rounded-lg border border-purple-500/40">
                <label
                  htmlFor="private-ppo-carrier-select"
                  className="text-xs text-purple-300 font-semibold whitespace-nowrap cursor-pointer"
                >
                  <i className="fa-solid fa-hospital mr-1"></i> Carrier Option:
                </label>
                <select
                  id="private-ppo-carrier-select"
                  value={carrier.id}
                  onChange={(e) => {
                    SoundFX.playClick();
                    setSelectedCarrierId(e.target.value as PrivateHealthCarrierId);
                  }}
                  className="bg-navy-950 text-xs font-bold text-white px-2.5 py-1 rounded border border-navy-700 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {PRIVATE_HEALTH_CARRIERS.map((c) => (
                    <option key={c.id} value={c.id} className="bg-navy-900 text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                aria-expanded={isProviderMapOpen}
                onClick={() => {
                  SoundFX.playClick();
                  setIsProviderMapOpen((prev) => !prev);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  isProviderMapOpen
                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-500/20'
                    : 'bg-navy-900 hover:bg-navy-800 text-blue-300 border-blue-500/40 hover:border-blue-400'
                }`}
              >
                <i className="fa-solid fa-map-location-dot"></i>
                <span>
                  {isProviderMapOpen ? 'Hide Providers Map' : `Local Providers (${clientData.zipCode || '34994'})`}
                </span>
              </button>
            </div>
          </div>

          {isProviderMapOpen && (
            <ProviderNetworkMap<PrivateHealthCarrierId>
              zipCode={clientData.zipCode || '34994'}
              onChangeZipCode={(zip) => onChangeClientData({ zipCode: zip })}
              carrier={carrier}
              carriers={PRIVATE_HEALTH_CARRIERS}
              onChangeCarrier={(carrierId) => setSelectedCarrierId(carrierId)}
              selectedTier={selectedTier}
              displayPlanName={activeTier.title}
            />
          )}
        </div>

        {/* Interactive 3-Tier Private PPO Plan Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['choice', 'preferred', 'executive'] as PrivatePpoTierId[]).map((tierKey) => {
            const tier = comparison.tiers[tierKey];
            const isSelected = selectedTier === tierKey;
            const monthlyStr = comparison.hasPreExisting
              ? `$${tier.monthlyRatedLow.toLocaleString()}–$${tier.monthlyRatedHigh.toLocaleString()}`
              : `$${tier.monthlyPreferred.toLocaleString()}`;
            const annualStr = comparison.hasPreExisting
              ? `$${tier.annualRatedLow.toLocaleString()}–$${tier.annualRatedHigh.toLocaleString()}`
              : `$${tier.annualPreferred.toLocaleString()}`;

            const badgeClass =
              tierKey === 'choice'
                ? 'text-blue-300 bg-blue-500/15 border-blue-500/30'
                : tierKey === 'preferred'
                ? 'text-purple-300 bg-purple-500/20 border-purple-500/40'
                : 'text-gold-300 bg-gold-500/15 border-gold-500/30';

            return (
              <button
                key={tierKey}
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setSelectedTier(tierKey);
                }}
                className={`bg-navy-950 p-5 rounded-2xl text-left transition-all flex flex-col justify-between space-y-4 cursor-pointer ${
                  isSelected
                    ? 'border-2 border-purple-500 glow-purple shadow-xl'
                    : 'border border-navy-700 hover:border-purple-500/40'
                }`}
              >
                <div className="space-y-3 w-full">
                  <div className="flex justify-between items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badgeClass}`}>
                      {tier.badge}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-300 shrink-0">
                      {isSelected ? (
                        <span className="text-purple-300">
                          <i className="fa-solid fa-circle-check mr-1"></i>Selected
                        </span>
                      ) : (
                        'Select Plan'
                      )}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-white">{tier.title}</h4>
                    <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                      <span className="text-2xl font-black text-white tabular-nums">
                        {monthlyStr} <span className="text-xs font-bold text-slate-400">/ mo</span>
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        ({annualStr}/yr)
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug">{tier.tagline}</p>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-navy-800 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Annual Deductible:</span>
                      <strong className="text-white tabular-nums">${tier.deductible.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Out-of-Pocket:</span>
                      <strong className="text-emerald-300 tabular-nums">${tier.maxOop.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Primary Care:</span>
                      <strong className="text-slate-200">{tier.primaryCopayLabel}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Specialist:</span>
                      <strong className="text-slate-200">{tier.specialistCopayLabel}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Post-Ded Coinsurance:</span>
                      <strong className="text-blue-300">{tier.coinsuranceLabel}</strong>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Core Private PPO Structural Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 space-y-1.5">
            <div className="text-purple-400 text-base"><i className="fa-solid fa-map-location-dot"></i></div>
            <strong className="text-white text-xs block">True Nationwide PPO Network</strong>
            <p className="text-[11px] text-slate-400">See specialists or hospitals across all 50 states without HMO gatekeeper referrals.</p>
          </div>
          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 space-y-1.5">
            <div className="text-emerald-400 text-base"><i className="fa-solid fa-clock"></i></div>
            <strong className="text-white text-xs block">Zero Open Enrollment Deadlines</strong>
            <p className="text-[11px] text-slate-400">Apply and lock effective dates any day of the year without needing a Qualifying Life Event.</p>
          </div>
          <div className="bg-navy-950 p-4 rounded-xl border border-navy-800 space-y-1.5">
            <div className="text-gold-400 text-base"><i className="fa-solid fa-file-invoice-dollar"></i></div>
            <strong className="text-white text-xs block">Preferred Health Rate Locks</strong>
            <p className="text-[11px] text-slate-400">Healthy households qualify for risk-rated underwriting often 30%–50% below unsubsidized ACA tiers.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
