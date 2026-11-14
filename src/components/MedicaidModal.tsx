import React from 'react';
import { ClientData } from '../types';
import { SoundFX } from '../utils/audio';

interface MedicaidModalProps {
  isOpen: boolean;
  clientData: ClientData;
  onClose: () => void;
}

export const MedicaidModal: React.FC<MedicaidModalProps> = ({
  isOpen,
  clientData,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-navy-950/90 backdrop-blur-md z-[115] flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card max-w-lg w-full p-6 sm:p-8 space-y-5 border-2 border-emerald-500/60 glow-emerald relative">
        <button
          type="button"
          onClick={() => {
            SoundFX.playClick();
            onClose();
          }}
          aria-label="Close Medicaid Notice"
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl cursor-pointer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="flex items-start gap-3 border-b border-navy-700/80 pb-4 pr-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xl shrink-0">
            <i className="fa-solid fa-house-medical"></i>
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
              Diagnostic Screening Alert
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
              Potential Medicaid Eligibility Detected
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
          <div className="bg-navy-950/90 p-2.5 rounded-xl border border-navy-800">
            <span className="text-[10px] text-slate-400 block">Reported AGI</span>
            <strong className="text-white font-extrabold">${clientData.grossAGI.toLocaleString()}/yr</strong>
          </div>
          <div className="bg-navy-950/90 p-2.5 rounded-xl border border-navy-800">
            <span className="text-[10px] text-slate-400 block">Household Size</span>
            <strong className="text-white font-extrabold">{clientData.householdSize} Person(s)</strong>
          </div>
          <div className="bg-navy-950/90 p-2.5 rounded-xl border border-emerald-500/40">
            <span className="text-[10px] text-emerald-400 block">FPL Level</span>
            <strong className="text-emerald-300 font-extrabold">~{clientData.fplPct}% FPL</strong>
          </div>
        </div>

        <div className="bg-navy-950/90 p-4 rounded-xl border border-emerald-500/40 space-y-3 text-xs sm:text-sm text-slate-200 leading-relaxed">
          <p>
            Based on your questionnaire responses, your household income (~<strong>{clientData.fplPct}% FPL</strong>) indicates that you <strong className="text-emerald-400">could potentially qualify for Medicaid</strong>{clientData.dependents > 0 ? ' (or state CHIP / KidCare coverage for dependents)' : ''}.
          </p>
          <p>
            <strong className="text-white">Recommended Next Step:</strong> You should apply for Medicaid through your state Medicaid agency or <strong className="text-blue-300">HealthCare.gov</strong> so an official eligibility determination can be made.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 flex items-start gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5 shrink-0"></i>
            <span>
              <strong>No Guarantees:</strong> This screening is an estimate only and there are <strong>no guarantees of approval</strong>. Actual Medicaid eligibility is determined exclusively by state and federal agencies based on state expansion rules, verified MAGI income, household rules, and residency/categorical criteria.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            SoundFX.playClick();
            onClose();
          }}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-circle-check"></i> I Understand — Continue to Strategy Hub
        </button>
      </div>
    </div>
  );
};
