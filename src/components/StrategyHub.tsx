import React from 'react';
import { ClientData, StrategyPathConfig, StrategyPathId } from '../types';
import { ALL_PATHS, COLOR_HEX_MAP } from '../utils/constants';
import { isOutsideAcaEnrollmentWindow } from '../utils/calculations';
import { SoundFX } from '../utils/audio';

import { AtlasBridgeDashboard } from './dashboards/AtlasBridgeDashboard';
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
}

export const StrategyHub: React.FC<StrategyHubProps> = ({
  clientData,
  eligiblePathIds,
  activePathId,
  onSelectPath,
  onChangeClientData,
  onOpenBooking,
}) => {
  const isOutsideWindow = isOutsideAcaEnrollmentWindow(clientData.acaWindow);
  const isHighIncome =
    (clientData.filingStatus === 'married' ? clientData.grossAGI > 200000 : clientData.grossAGI > 150000) ||
    clientData.fplPct > 500;

  const availablePaths = ALL_PATHS.filter((p) => eligiblePathIds.includes(p.id)).sort((a, b) => {
    if (a.id === activePathId) return -1;
    if (b.id === activePathId) return 1;
    return eligiblePathIds.indexOf(a.id) - eligiblePathIds.indexOf(b.id);
  });

  const activePathObj = ALL_PATHS.find((p) => p.id === activePathId) || ALL_PATHS[0];

  return (
    <div className="space-y-8">
      {/* Outside ACA Window Notice */}
      {isOutsideWindow && (
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
      {isHighIncome && !isOutsideWindow && (
        <div className="glass-card p-5 sm:p-6 border-l-4 border-l-amber-500 glow-gold space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-950 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl shrink-0">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <h4 className="text-base font-extrabold text-white">Income Eligibility Notice: High-Income Carrier Route</h4>
              <p className="text-xs text-slate-300">
                Your reported gross income (<strong>${clientData.grossAGI.toLocaleString()}</strong>, ~{clientData.fplPct}% FPL) exceeds the threshold where pre-tax MAGI reduction unlocks ACA Premium Tax Credits (APTC). Consequently, the Atlasbridge System health module has been bypassed, and you have been unlocked directly for <strong>Private PPO Health Plans</strong> and <strong>Traditional ACA Signup</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Selector Hub */}
      <section className="glass-card p-5 sm:p-6 border-l-4 border-l-blue-500 glow-blue space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-4">
          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <i className="fa-solid fa-compass text-xs"></i> Step 3 of 3: Unlocked Strategy Suite
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">Your Customized Strategy Hub</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Filtered strictly according to your selected primary focus and eligibility criteria. Select any strategy view below to switch dashboards instantly.
            </p>
          </div>

          <div className="bg-navy-950 px-4 py-3 rounded-xl border border-blue-500/30 text-left lg:text-right shrink-0">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Unlocked Views</span>
            <span className="text-xs font-bold text-blue-400">{availablePaths.length} Available Strategy Views</span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <i className="fa-solid fa-grid-2 text-blue-400"></i> Available Strategy Views (Click to Switch)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {availablePaths.map((path) => {
              const isSelected = path.id === activePathId;
              const isSettlements = path.id === 'settlements';
              return (
                <div
                  key={path.id}
                  onClick={() => {
                    SoundFX.playClick();
                    onSelectPath(path.id);
                  }}
                  className={`glass-card p-3.5 relative transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected ? 'path-card-active' : 'glass-card-hover'
                  } ${isSettlements ? 'glow-silver border-silver-400' : ''}`}
                  style={{ borderTop: `2px solid ${COLOR_HEX_MAP[path.color] || '#3b82f6'}` }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-navy-900 border border-navy-700 flex items-center justify-center text-sm">
                        <i className={`fa-solid ${path.icon}`} style={{ color: COLOR_HEX_MAP[path.color] }}></i>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-blue-500/30 text-blue-200 border border-blue-400'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isSelected ? 'Active View' : 'Recommended Path'}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-white text-xs sm:text-sm tracking-tight">{path.label}</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{path.desc}</p>
                  </div>
                </div>
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
          />
        )}
        {activePathId === 'unwanted_life' && (
          <UnwantedLifeDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
          />
        )}
        {activePathId === 'life' && (
          <LifeInsuranceDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
          />
        )}
        {activePathId === 'annuities' && (
          <AnnuitiesDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
          />
        )}
        {activePathId === 'rollovers' && (
          <RolloversDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
          />
        )}
        {activePathId === 'traditional_aca' && (
          <TraditionalAcaDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
          />
        )}
        {activePathId === 'private_health' && (
          <PrivateHealthDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
          />
        )}
        {activePathId === 'group' && (
          <GroupHealthDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
          />
        )}
        {activePathId === 'settlements' && (
          <SettlementsDashboard
            clientData={clientData}
            onChangeClientData={onChangeClientData}
            onOpenBooking={onOpenBooking}
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
