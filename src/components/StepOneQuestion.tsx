import React from 'react';
import { PrimaryCategory } from '../types';
import { SoundFX } from '../utils/audio';

interface StepOneQuestionProps {
  onSelectCategory: (category: PrimaryCategory) => void;
}

export const StepOneQuestion: React.FC<StepOneQuestionProps> = ({ onSelectCategory }) => {
  const handleSelect = (category: PrimaryCategory) => {
    SoundFX.playClick();
    onSelectCategory(category);
  };

  return (
    <section className="glass-card p-6 sm:p-10 border-l-4 border-l-blue-500 glow-blue space-y-8 text-center max-w-5xl mx-auto">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-extrabold uppercase tracking-wider border border-blue-500/30">
          <i className="fa-solid fa-compass"></i> Step 1 of 3: Personalized Orientation
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">What are you looking for today?</h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
          Select your primary area of focus to tailor your onboarding questionnaire and streamline your advisory options.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 text-left">
        {/* 1. Health Insurance */}
        <div
          onClick={() => handleSelect('health')}
          className="glass-card p-5 glass-card-hover cursor-pointer border border-navy-700 hover:border-blue-500 group flex flex-col justify-between border-l-4 border-l-blue-500 shadow-lg shadow-blue-500/10"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 border border-blue-500/40 flex items-center justify-center text-blue-400 text-xl group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-heart-pulse"></i>
            </div>
            <h3 className="font-extrabold text-white text-base">Health Insurance</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              ACA Exchange optimization, subsidies, private PPO coverage, &amp; Direct Primary Care.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-navy-800/80 flex items-center text-xs font-bold text-blue-400">
            Select Focus <i className="fa-solid fa-arrow-right ml-2 text-[10px]"></i>
          </div>
        </div>

        {/* 2. Life Insurance */}
        <div
          onClick={() => handleSelect('life')}
          className="glass-card p-5 glass-card-hover cursor-pointer border border-navy-700 hover:border-red-500 group flex flex-col justify-between border-l-4 border-l-red-500 shadow-lg shadow-red-500/10"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 border border-red-500/40 flex items-center justify-center text-red-400 text-xl group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-shield-heart"></i>
            </div>
            <h3 className="font-extrabold text-white text-base">Life Insurance</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Term, Indexed Universal Life (IUL), Whole Life, and living benefit asset protection.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-navy-800/80 flex items-center text-xs font-bold text-red-400">
            Select Focus <i className="fa-solid fa-arrow-right ml-2 text-[10px]"></i>
          </div>
        </div>

        {/* 3. Annuities */}
        <div
          onClick={() => handleSelect('annuities')}
          className="glass-card p-5 glass-card-hover cursor-pointer border border-navy-700 hover:border-gold-500 group flex flex-col justify-between border-l-4 border-l-gold-500 shadow-lg shadow-gold-500/10"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 border border-gold-500/40 flex items-center justify-center text-gold-400 text-xl group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-vault"></i>
            </div>
            <h3 className="font-extrabold text-white text-base">Annuities</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Guaranteed lifelong income streams, principal protection, and single premium options.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-navy-800/80 flex items-center text-xs font-bold text-gold-400">
            Select Focus <i className="fa-solid fa-arrow-right ml-2 text-[10px]"></i>
          </div>
        </div>

        {/* 4. Rollovers / 1035 */}
        <div
          onClick={() => handleSelect('rollovers')}
          className="glass-card p-5 glass-card-hover cursor-pointer border border-navy-700 hover:border-cyan-500 group flex flex-col justify-between border-l-4 border-l-cyan-500 shadow-lg shadow-cyan-500/10"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-xl group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-arrow-rotate-right"></i>
            </div>
            <h3 className="font-extrabold text-white text-base">Rollovers / 1035 Exchanges</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tax-free transfers of dormant 401(k)s, IRAs, or existing policy cash values.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-navy-800/80 flex items-center text-xs font-bold text-cyan-400">
            Select Focus <i className="fa-solid fa-arrow-right ml-2 text-[10px]"></i>
          </div>
        </div>

        {/* 5. Life Settlements */}
        <div
          onClick={() => handleSelect('settlements')}
          className="glass-card p-5 glass-card-hover cursor-pointer border border-navy-700 hover:border-silver-400 group flex flex-col justify-between border-l-4 border-l-silver-400 shadow-lg shadow-silver-500/10 glow-silver"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 border border-silver-500/40 flex items-center justify-center text-silver-400 text-xl group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <h3 className="font-extrabold text-white text-base">Life Settlements</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Monetizing unwanted, expensive, or unneeded life policies for cash payout.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-navy-800/80 flex items-center text-xs font-bold text-silver-400">
            Select Focus <i className="fa-solid fa-arrow-right ml-2 text-[10px]"></i>
          </div>
        </div>

        {/* 6. Unwanted Life Policy */}
        <div
          onClick={() => handleSelect('unwanted_life')}
          className="glass-card p-5 glass-card-hover cursor-pointer border border-navy-700 hover:border-emerald-500 group flex flex-col justify-between border-l-4 border-l-emerald-400 shadow-lg shadow-emerald-500/10"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-navy-900 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xl group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              Unwanted Life Policy{' '}
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                1035 Audit
              </span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Affordability crisis? Audit policy loans, surrender charges, &amp; 1035 transfers to annuities.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-navy-800/80 flex items-center text-xs font-bold text-emerald-400">
            Audit Policy Options <i className="fa-solid fa-arrow-right ml-2 text-[10px]"></i>
          </div>
        </div>
      </div>
    </section>
  );
};
