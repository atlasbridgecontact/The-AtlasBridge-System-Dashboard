import React from 'react';
import { SoundFX } from '../utils/audio';

interface DisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-navy-950/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card max-w-2xl w-full p-6 sm:p-8 space-y-6 border-l-4 border-l-blue-500 glow-blue relative my-auto max-h-[90vh] flex flex-col justify-between">
        <div className="flex items-center gap-3 border-b border-navy-700/80 pb-4 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-navy-950 border border-blue-500/40 flex items-center justify-center text-blue-400 text-2xl shrink-0">
            <i className="fa-solid fa-scale-balanced"></i>
          </div>
          <div>
            <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-wider block">Legal & Advisory Notice</span>
            <h3 className="text-xl sm:text-2xl font-black text-white">Terms of Use & Disclosure</h3>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-300 space-y-3 leading-relaxed overflow-y-auto pr-2 my-2">
          <p>
            <strong>Important Disclosure:</strong> The AtlasBridge System and associated dashboard tools are designed strictly for educational, illustrative, and strategic planning purposes. Projections, tax-diversion calculations (including MAGI optimization), and benefit estimates are based on user-provided inputs and current public tax/insurance guidelines, but do not constitute formal tax, legal, or binding insurance advice.
          </p>
          <p>
            Official insurance coverage, premium tax credits (APTC), and policy terms are subject to final carrier underwriting, federal/state marketplace verification (CMS), and formal contract execution. Formal applications and consent documentation will be executed through licensed carrier platforms in accordance with state and federal regulations.
          </p>
          <p>
            By clicking &quot;I Agree &amp; Continue,&quot; you acknowledge that you are using this tool to explore strategic options and request a consultation with a licensed insurance professional.
          </p>
        </div>

        <div className="pt-4 border-t border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <span className="text-[11px] text-slate-400 italic font-semibold">AtlasBridge Insurance Group LLC</span>
          <button
            onClick={() => {
              SoundFX.playUnlock();
              onAccept();
            }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-circle-check"></i> I Agree &amp; Continue to Strategy Builder
          </button>
        </div>
      </div>
    </div>
  );
};
