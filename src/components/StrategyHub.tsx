import React, { useState } from 'react';
import { ActiveStrategySnapshot, ClientData, StrategyPathId } from '../types';
import { ALL_PATHS, COLOR_HEX_MAP } from '../utils/constants';
import { isOutsideAcaEnrollmentWindow } from '../utils/calculations';
import { SoundFX } from '../utils/audio';

import { AtlasBridgeDashboard } from './dashboards/AtlasBridgeDashboard';
import { SelfEmployedAcaDashboard } from './dashboards/SelfEmployedAcaDashboard';
import { UnwantedLifeDashboard } from './dashboards/UnwantedLifeDashboard';
import { LifeInsuranceDashboard } from './dashboards/LifeInsuranceDashboard';
import { AnnuitiesDashboard } from './dashboards/AnnuitiesDashboard';
import { RolloversDashboard } from './dashboards/RolloversDashboard';
import { TraditionalAcaDashboard } from './dashboards/TraditionalAcaDashboard';
import { PrivateHealthDashboard } from './dashboards/PrivateHealthDashboard';
import { GroupHealthDashboard } from './dashboards/GroupHealthDashboard';
import { SettlementsDashboard } from './dashboards/SettlementsDashboard';

interface StrategyHubProps {
  clientData: ClientData;
  eligiblePathIds: StrategyPathId[];
  activePathId: StrategyPathId;
  onSelectPath: (pathId: StrategyPathId) => void;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
  onUpdateStrategySnapshot: (snapshot: ActiveStrategySnapshot) => void;
}

export const StrategyHub: React.FC<StrategyHubProps> = ({
  clientData,
  eligiblePathIds,
  activePathId,
  onSelectPath,
  onChangeClientData,
  onOpenBooking,
  onUpdateStrategySnapshot,
}) => {
  const [isHubExpanded, setIsHubExpanded] = useState<boolean>(false);

  const isOutsideWindow = isOutsideAcaEnrollmentWindow(clientData.acaWindow);
  const isHighIncome =
    (clientData.filingStatus === 'married' ? clientData.grossAGI > 200000 : clientData.grossAGI > 150000) ||
    clientData.fplPct > 500;
  const hasHealthPaths = eligiblePathIds.some((id) =>
    ['atlasbridge', 'self_employed_aca', 'traditional_aca', 'private_health'].includes(id)
  );

  // Preserve recommendation priority order (index 0 is always the Top Recommended Path)
  const orderedAvailablePaths = ALL_PATHS.filter((p) => eligiblePathIds.includes(p.id)).sort(
    (a, b) => eligiblePathIds.indexOf(a.id) - eligiblePathIds.indexOf(b.id)
  );

  const topRecommendedPath = orderedAvailablePaths[0] || ALL_PATHS[0];
  const visibleHubPaths = isHubExpanded ? orderedAvailablePaths : [topRecommendedPath];
  const activePathObj = ALL_PATHS.find((p) => p.id === activePathId) || ALL_PATHS[0];

  return (
    <div className="space-y-8">
      {/* Outside ACA Window Notice */}
      {isOutsideWindow && hasHealthPaths && (
        <div className="glass-card p-5 sm:p-6 border-l-4 border-l-rose-500 glow-red space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-950 border border-rose-500/40 flex items-center justify-center text-rose-400 text-xl shrink-0">
              <i className="fa-solid fa-calendar-xmark"></i>
            </div>
            <div>
              <h4 className="text-base font-extrabold text-white">
                Outside Open Enrollment Notice: Private PPO Coverage Redirect
              </h4>
              <p className="text-xs text-slate-300">
                You are filling out information outside the standard ACA Marketplace Open Enrollment window (Nov 1 – Jan 15) without a qualifying Special Enrollment Period (SEP). Standard ACA subsidies cannot be initiated now. You have been automatically directed to <strong>Underwritten Private Health Plans (Med-Guard PPO / Choice PPO)</strong> for year-round enrollment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* High Income Ineligibility Notice */}
      {isHighIncome && !isOutsideWindow && hasHealthPaths && !eligiblePathIds.includes('atlasbridge') && (
        <div className="glass-card p-5 sm:p-6 border-l-4 border-l-amber-500 glow-gold space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-950 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl shrink-0">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h4 className="text-base font-extrabold text-white">Income Eligibility Notice: High-Income Carrier Route</h4>
              <p className="text-xs text-slate-300">
                Your reported gross income (<strong>${clientData.grossAGI.toLocaleString()}</strong>, ~{clientData.fplPct}% FPL) exceeds the threshold where standard individual pre-tax IRA diversion unlocks ACA Premium Tax Credits (APTC). You have been directed to the best-fit high-income health options below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Selector Hub (Collapsible, Collapsed by Default Showing Top Recommended Choice) */}
      <section className="glass-card p-5 sm:p-6 border-l-4 border-l-blue-500 glow-blue space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-4">
          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <i className="fa-solid fa-compass text-xs"></i> Step 3 of 3: Unlocked Strategy Suite
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Your Customized Strategy Hub</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              {isHubExpanded
                ? 'Showing all qualified strategy views tailored to your profile. Click any card below to switch dashboards.'
                : `Collapsed to your Top Recommended strategy${activePathId !== topRecommendedPath.id ? ` (Currently viewing: ${activePathObj.label})` : ''}. Expand to explore all ${orderedAvailablePaths.length} unlocked views.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
            {orderedAvailablePaths.length > 1 && (
              <button
                type="button"
                aria-expanded={isHubExpanded}
                onClick={() => {
                  SoundFX.playClick();
                  setIsHubExpanded((prev) => !prev);
                }}
                className="px-3.5 py-2 rounded-xl bg-navy-950 hover:bg-navy-900 border border-blue-500/40 hover:border-blue-400 text-xs font-extrabold text-blue-300 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <i className={`fa-solid ${isHubExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[11px]`}></i>
                <span>
                  {isHubExpanded ? 'Collapse Strategy Hub' : `Expand All Views (${orderedAvailablePaths.length})`}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
              <i className="fa-solid fa-star text-gold-400"></i>
              {isHubExpanded
                ? `All Qualified Strategy Views (${orderedAvailablePaths.length})`
                : 'Top Recommended Choice (Click to Open or Expand All)'}
            </h3>
          </div>

          <div
            className={
              isHubExpanded
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5'
                : 'grid grid-cols-1 gap-3.5'
            }
          >
            {visibleHubPaths.map((path, idx) => {
              const isSelected = path.id === activePathId;
              const isTopRec = path.id === topRecommendedPath.id && idx === 0;
              const isSettlements = path.id === 'settlements';
              return (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    onSelectPath(path.id);
                  }}
                  className={`glass-card p-4 relative transition-all cursor-pointer text-left flex flex-col justify-between ${
                    isSelected ? 'path-card-active' : 'glass-card-hover'
                  } ${isSettlements ? 'glow-silver border-silver-400' : ''}`}
                  style={{ borderTop: `2px solid ${COLOR_HEX_MAP[path.color] || '#3b82f6'}` }}
                >
                  <div className={isHubExpanded ? '' : 'flex flex-col sm:flex-row sm:items-center justify-between gap-3'}>
                    <div className={isHubExpanded ? '' : 'flex items-center gap-3'}>
                      <div className={`flex items-center justify-between ${isHubExpanded ? 'mb-2' : 'shrink-0'}`}>
                        <div className="w-9 h-9 rounded-lg bg-navy-900 border border-navy-700 flex items-center justify-center text-sm shrink-0">
                          <i className={`fa-solid ${path.icon}`} style={{ color: COLOR_HEX_MAP[path.color] }}></i>
                        </div>
                        {isHubExpanded && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                              isSelected
                                ? 'bg-blue-500/30 text-blue-200 border border-blue-400'
                                : isTopRec
                                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {isSelected ? 'Active View' : isTopRec ? 'Top Recommended' : 'Qualified Path'}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-xs sm:text-sm tracking-tight">{path.label}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{path.desc}</p>
                      </div>
                    </div>

                    {!isHubExpanded && (
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                            isSelected
                              ? 'bg-blue-500/25 text-blue-200 border-blue-400'
                              : 'bg-gold-500/20 text-gold-300 border-gold-500/40'
                          }`}
                        >
                          {isSelected ? 'Top Recommended · Active' : 'Top Recommended · Switch Back'}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Render Active Dashboard */}
      <div className="space-y-8">
        {activePathId === 'atlasbridge' && (
          <AtlasBridgeDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}
        {activePathId === 'self_employed_aca' && (
          <SelfEmployedAcaDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}
        {activePathId === 'unwanted_life' && (
          <UnwantedLifeDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}
        {activePathId === 'life' && (
          <LifeInsuranceDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}
        {activePathId === 'annuities' && (
          <AnnuitiesDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}
        {activePathId === 'rollovers' && (
          <RolloversDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}
        {activePathId === 'traditional_aca' && (
          <TraditionalAcaDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
            onNavigateToPrivateHealth={() => onSelectPath('private_health')}
          />
        )}
        {activePathId === 'private_health' && (
          <PrivateHealthDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}
        {activePathId === 'group' && (
          <GroupHealthDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}
        {activePathId === 'settlements' && (
          <SettlementsDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
            onUpdateStrategySnapshot={onUpdateStrategySnapshot}
          />
        )}

        {/* Global Bottom CTA Action Card */}
        <div className="glass-card p-6 border-t-4 border-t-emerald-400 glow-emerald flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
          <div>
            <h4 className="text-lg font-extrabold text-white">Ready to execute your personalized strategy?</h4>
            <p className="text-xs text-slate-300 mt-1">
              Book an appointment with an AtlasBridge specialist to review and implement the{' '}
              <strong>{activePathObj.label}</strong>.
            </p>
          </div>
          <button
            onClick={() => {
              SoundFX.playUnlock();
              onOpenBooking();
            }}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <i className="fa-solid fa-calendar-check"></i> Submit Strategy &amp; Book Appointment
          </button>
        </div>
      </div>
    </div>
  );
};
