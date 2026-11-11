import React, { useState } from 'react';
import { ClientData } from '../../types';
import { SoundFX } from '../../utils/audio';

interface UnwantedLifeDashboardProps {
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onOpenBooking: () => void;
}

export const UnwantedLifeDashboard: React.FC<UnwantedLifeDashboardProps> = ({
  clientData,
  onChangeClientData,
  onOpenBooking,
}) => {
  const [taxBracket, setTaxBracket] = useState<number>(22);

  const grossVal = clientData.policyGrossValue || clientData.existingAnnuityCash || 45000;
  const basis = clientData.policyCostBasis || 30000;
  const loans = clientData.policyLoans || 5000;
  const fees = clientData.policySurrenderCharges || 2000;
  const monthlyPrem = clientData.policyMonthlyPremium || 450;

  const netSurrender = Math.max(0, grossVal - loans - fees);
  const taxableGain = Math.max(0, grossVal - basis);
  const taxDue = Math.round(taxableGain * (taxBracket / 100));
  const transfer1035Value = Math.max(0, grossVal - loans - fees);
  const annualRelief = monthlyPrem * 12;

  const exportReportText = () => {
    SoundFX.playClick();
    const report = `====================================================
ATLASBRIDGE INSURANCE GROUP LLC - UNWANTED POLICY AUDIT
====================================================
Client Age: ${clientData.clientAge}
Tax Filing Status: ${clientData.filingStatus.toUpperCase()} ${clientData.filingStatus === 'married' ? '(Including Spouse)' : ''}
Federal Tax Bracket: ${taxBracket}%
Generated Date: ${new Date().toLocaleDateString()}
Auto-Dispatched Copy Sent To: atlasbridge.contact@gmail.com

1. POLICY FINANCIAL METRICS:
   - Gross Cash Value: $${grossVal.toLocaleString()}
   - Cost Basis (Total Premiums Paid): $${basis.toLocaleString()}
   - Outstanding Policy Loans: $${loans.toLocaleString()}
   - Surrender Charges / Exit Fees: $${fees.toLocaleString()}
   - Net Cash Surrender Value: $${netSurrender.toLocaleString()}
   - Calculated Taxable Gain (if Surrendered): $${taxableGain.toLocaleString()}
   - Estimated Ordinary Tax Liability: $${taxDue.toLocaleString()}
   - Current Monthly Premium Obligation: $${monthlyPrem.toLocaleString()}/mo ($${(monthlyPrem * 12).toLocaleString()}/yr)

2. STRATEGY RECOMMENDATION:
   Direct 1035 Exchange to Non-Qualified Annuity (FIA/MYGA):
   - Net Transfer Capital: $${transfer1035Value.toLocaleString()}
   - Immediate Tax Due: $0 (Tax-Free Non-Taxable Transfer under IRC Sec 1035)
   - Premium Out-of-Pocket: $0/mo (Ongoing Premium Burden Eliminated)
   - Preserves Full Tax Basis ($${basis.toLocaleString()}) without Constructive Receipt
====================================================`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Atlasbridge_Policy_Audit_Age${clientData.clientAge}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section className="glass-card p-5 sm:p-8 border-l-4 border-l-emerald-400 glow-emerald space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-navy-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Fiduciary Policy Resolution Engine</span>
              <h3 className="text-xl sm:text-3xl font-extrabold text-white">Unwanted Life Policy Audit &amp; 1035 Suite</h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportReportText}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg border border-emerald-400/30 flex items-center gap-2 transition cursor-pointer"
            >
              <i className="fa-solid fa-file-arrow-down"></i> Export Audit Report (.txt)
            </button>
          </div>
        </div>

        <div className="bg-navy-950 p-5 rounded-2xl border border-navy-700 space-y-6">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-sliders text-xs"></i> 1. In-Force Policy Diagnostics
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Gross Cash Value ($):</label>
              <div className="flex items-center gap-1 bg-navy-900 px-3 py-2 rounded-lg border border-emerald-500/40">
                <span className="text-emerald-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="500"
                  value={grossVal}
                  onChange={(e) => onChangeClientData({ policyGrossValue: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-transparent text-white font-extrabold text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Cost Basis (Premiums Paid):</label>
              <div className="flex items-center gap-1 bg-navy-900 px-3 py-2 rounded-lg border border-blue-500/40">
                <span className="text-blue-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="500"
                  value={basis}
                  onChange={(e) => onChangeClientData({ policyCostBasis: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-transparent text-white font-extrabold text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Outstanding Policy Loans ($):</label>
              <div className="flex items-center gap-1 bg-navy-900 px-3 py-2 rounded-lg border border-red-500/40">
                <span className="text-red-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  max="500000"
                  step="250"
                  value={loans}
                  onChange={(e) => onChangeClientData({ policyLoans: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-transparent text-white font-extrabold text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Surrender Charges ($):</label>
              <div className="flex items-center gap-1 bg-navy-900 px-3 py-2 rounded-lg border border-gold-500/40">
                <span className="text-gold-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="100"
                  value={fees}
                  onChange={(e) => onChangeClientData({ policySurrenderCharges: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-transparent text-white font-extrabold text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-navy-800">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Current Monthly Premium ($/mo):</label>
              <div className="flex items-center gap-1 bg-navy-900 px-3 py-2 rounded-lg border border-purple-500/40">
                <span className="text-purple-300 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="25"
                  value={monthlyPrem}
                  onChange={(e) => onChangeClientData({ policyMonthlyPremium: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-transparent text-white font-extrabold text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Federal Income Tax Bracket:</label>
              <select
                value={taxBracket}
                onChange={(e) => setTaxBracket(parseFloat(e.target.value) || 22)}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-emerald-500 cursor-pointer"
              >
                <option value="12">12% Bracket</option>
                <option value="22">22% Bracket</option>
                <option value="24">24% Bracket</option>
                <option value="32">32% Bracket</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-navy-900 p-4 rounded-xl border border-navy-700/80 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Net Cash Surrender Value</span>
            <div className="text-2xl font-black text-white">${Math.round(netSurrender).toLocaleString()}</div>
            <span className="text-[10px] text-slate-400">Cash less loans &amp; fees</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-navy-700/80 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Taxable Gain on Surrender</span>
            <div className="text-2xl font-black text-amber-400">+${Math.round(taxableGain).toLocaleString()}</div>
            <span className="text-[10px] text-amber-400/90">
              Tax Due: ${taxDue.toLocaleString()} ({taxBracket}%)
            </span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/40 space-y-1 bg-emerald-950/10 glow-emerald">
            <span className="text-[10px] text-emerald-400 uppercase font-bold">1035 Annuity Transfer Value</span>
            <div className="text-2xl font-black text-emerald-300">${Math.round(transfer1035Value).toLocaleString()}</div>
            <span className="text-[10px] text-emerald-400 font-semibold">$0 Immediate Tax Trigger</span>
          </div>

          <div className="bg-navy-900 p-4 rounded-xl border border-purple-500/40 space-y-1">
            <span className="text-[10px] text-purple-300 uppercase font-bold">Annual Premium Relief</span>
            <div className="text-2xl font-black text-purple-300">+${Math.round(annualRelief).toLocaleString()} / yr</div>
            <span className="text-[10px] text-slate-400">Out-of-pocket eliminated</span>
          </div>
        </div>

        {/* Advisory Context Guidance Box */}
        <div className="bg-navy-950 p-4 sm:p-5 rounded-xl border border-emerald-500/30 space-y-3 text-xs text-slate-300">
          <h4 className="font-extrabold text-emerald-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-shield-halved"></i> IRC Section 1035 Fiduciary Strategy
          </h4>
          <p className="leading-relaxed">
            Surrendering this contract outright causes the carrier to issue an IRS Form 1099-R showing an immediate taxable gain of <strong>${taxableGain.toLocaleString()}</strong>, resulting in approximately <strong>${taxDue.toLocaleString()}</strong> of ordinary tax liability.
          </p>
          <p className="leading-relaxed">
            By executing a <strong>Direct Trustee-to-Trustee 1035 Exchange</strong> into a Fixed Indexed Annuity (FIA) or Multi-Year Guarantee Annuity (MYGA), your entire cash value of <strong>${transfer1035Value.toLocaleString()}</strong> is rolled over tax-free, maintaining your existing cost basis (${basis.toLocaleString()}) while permanently terminating your <strong>${monthlyPrem}/month (${annualRelief}/yr)</strong> premium payments.
          </p>
        </div>
      </section>
    </div>
  );
};
