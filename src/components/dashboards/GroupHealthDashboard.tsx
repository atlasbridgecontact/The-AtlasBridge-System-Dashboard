import React, { useState } from 'react';
import { ClientData } from '../../types';
import { SoundFX } from '../../utils/audio';

interface GroupHealthDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const GroupHealthDashboard: React.FC<GroupHealthDashboardProps> = ({
  clientData,
  onChangeClientData,
}) => {
  const [employeeCount, setEmployeeCount] = useState<number>(Math.max(2, clientData.w2Employees || 5));
  const [fundingModel, setFundingModel] = useState<'ichra' | 'level_funded'>('level_funded');

  const avgEmpPrem = 520;
  const employerContrib = 0.5; // 50% required min employer contrib
  const monthlyEmployerCost = Math.round(employeeCount * avgEmpPrem * employerContrib);
  const annualTaxDeduction = Math.round(monthlyEmployerCost * 12 * 0.25); // 25% corporate tax rate savings

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-indigo-500 glow-blue space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-2xl">
              <i className="fa-solid fa-users-gear"></i>
            </div>
            <div>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Small &amp; Mid Business Portfolio
              </span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white">Employer Group Benefits &amp; ICHRA</h3>
            </div>
          </div>
          <div className="bg-navy-950 px-3.5 py-1.5 rounded-xl border border-indigo-500/30 text-xs text-indigo-300 font-bold">
            IRC Sec 162 Tax Deductible
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Designed specifically for business owners with 1 to 50+ W2 employees. Transition from rigid expensive traditional group plans to <strong>Level-Funded PPOs (with claims surplus refunds)</strong> or <strong>Individual Coverage HRAs (ICHRA)</strong> where you provide tax-free healthcare allowances for employees to pick their own plans.
        </p>

        {/* Model Switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => {
              SoundFX.playClick();
              setFundingModel('level_funded');
            }}
            className={`p-4 rounded-xl cursor-pointer transition border ${
              fundingModel === 'level_funded'
                ? 'bg-navy-900 border-indigo-500 glow-blue'
                : 'bg-navy-950 border-navy-800 hover:border-indigo-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <strong className="text-sm text-white">1. Level-Funded Small Group PPO</strong>
              {fundingModel === 'level_funded' && <i className="fa-solid fa-circle-check text-indigo-400"></i>}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fixed monthly rates with up to 100% of unused claims dollars returned to the employer as a cash refund at year-end.
            </p>
          </div>

          <div
            onClick={() => {
              SoundFX.playClick();
              setFundingModel('ichra');
            }}
            className={`p-4 rounded-xl cursor-pointer transition border ${
              fundingModel === 'ichra'
                ? 'bg-navy-900 border-indigo-500 glow-blue'
                : 'bg-navy-950 border-navy-800 hover:border-indigo-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <strong className="text-sm text-white">2. ICHRA / QSEHRA Health Allowance</strong>
              {fundingModel === 'ichra' && <i className="fa-solid fa-circle-check text-indigo-400"></i>}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Set defined pre-tax dollar allowances (e.g. $400/emp/mo). Employees select their own individualized carrier and keep their plan.
            </p>
          </div>
        </div>

        {/* Dynamic Calculator */}
        <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-semibold">Total Full-Time W2 Employees:</span>
            <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-indigo-500/40">
              <input
                type="number"
                min="1"
                max="100"
                value={employeeCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setEmployeeCount(val);
                  onChangeClientData({ w2Employees: val });
                }}
                className="w-12 bg-transparent text-indigo-300 font-extrabold text-xs focus:outline-none text-right"
              />
              <span className="text-slate-400 text-[10px]">staff</span>
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={employeeCount}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1;
              SoundFX.playSlideHum(val / 50);
              setEmployeeCount(val);
              onChangeClientData({ w2Employees: val });
            }}
            className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-navy-900 p-4 rounded-xl border border-navy-700 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Est. Employer Monthly Outlay</span>
            <div className="text-2xl font-black text-white">${monthlyEmployerCost.toLocaleString()} / mo</div>
            <span className="text-[10px] text-slate-400">Based on 50% Benchmark Contribution</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-indigo-500/40 space-y-1 bg-indigo-950/20 glow-blue">
            <span className="text-[10px] text-indigo-300 uppercase font-bold">Annual Business Tax Deduction</span>
            <div className="text-2xl font-black text-indigo-300">+${annualTaxDeduction.toLocaleString()} / yr</div>
            <span className="text-[10px] text-indigo-400">100% Ordinary &amp; Necessary Expense</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/40 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-bold">FICA / Payroll Tax Reduction</span>
            <div className="text-2xl font-black text-emerald-300">
              +${Math.round(employeeCount * 12 * 45).toLocaleString()} / yr
            </div>
            <span className="text-[10px] text-slate-400">Pre-Tax Section 125 POP Savings</span>
          </div>
        </div>
      </section>
    </div>
  );
};
