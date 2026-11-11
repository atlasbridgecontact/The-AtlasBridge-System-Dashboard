import React from 'react';
import { TaxYear } from '../types';
import { SoundFX } from '../utils/audio';

interface HeaderProps {
  taxYear: TaxYear;
  isWizardCompleted: boolean;
  onToggleQuestionnaire: () => void;
  onRestartFlow: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  taxYear,
  isWizardCompleted,
  onToggleQuestionnaire,
  onRestartFlow,
}) => {
  return (
    <header className="border-b border-navy-700/60 bg-navy-900/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-10 rounded-xl bg-navy-950 flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/20 shrink-0">
            <i className="fa-solid fa-bridge text-blue-400 text-lg sm:text-xl"></i>
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-sm sm:text-xl text-white tracking-tight flex items-center gap-2 truncate">
              ATLASBRIDGE <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider">Master Suite v7</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">AtlasBridge Insurance Group LLC</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {isWizardCompleted && (
            <>
              <button
                onClick={() => {
                  SoundFX.playClick();
                  onToggleQuestionnaire();
                }}
                className="text-xs bg-navy-800 hover:bg-navy-700 text-purple-300 font-extrabold px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl border border-purple-500/30 hover:border-purple-400 transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer"
              >
                <i className="fa-solid fa-user-pen text-purple-400"></i>
                <span className="hidden sm:inline">Change Personal Info</span>
                <span className="sm:hidden">Info</span>
              </button>

              <button
                onClick={() => {
                  SoundFX.playClick();
                  onRestartFlow();
                }}
                className="text-xs bg-navy-800 hover:bg-navy-700 text-blue-400 font-extrabold px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl border border-blue-500/30 hover:border-blue-400 transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/10 cursor-pointer"
              >
                <i className="fa-solid fa-bolt text-gold-400"></i>
                <span className="hidden sm:inline">Re-Pivot Focus Strategy</span>
                <span className="sm:hidden">Re-Pivot</span>
              </button>
            </>
          )}

          <div className="hidden lg:flex items-center gap-3 bg-navy-950 px-4 py-2 rounded-xl border border-blue-500/30 text-xs shrink-0">
            <i className="fa-solid fa-calendar-check text-blue-400"></i>
            <span className="text-slate-400">Target Tax Year:</span>
            <span className={isWizardCompleted ? 'text-white font-extrabold' : 'text-amber-400 font-extrabold'}>
              {isWizardCompleted ? `${taxYear} Open Enrollment` : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
