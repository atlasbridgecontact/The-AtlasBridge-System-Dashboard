import React from 'react';
import { BookingFormData, ClientData, StrategyPathConfig } from '../types';
import { getIRSLimitForAge } from '../utils/calculations';

interface AdvisoryDocModalProps {
  isOpen: boolean;
  bookingData: BookingFormData | null;
  activePath: StrategyPathConfig;
  clientData: ClientData;
  onClose: () => void;
}

export const AdvisoryDocModal: React.FC<AdvisoryDocModalProps> = ({
  isOpen,
  bookingData,
  activePath,
  clientData,
  onClose,
}) => {
  if (!isOpen || !bookingData) return null;

  const currentIRSLimit = getIRSLimitForAge(clientData.clientAge, clientData.filingStatus);

  return (
    <div className="fixed inset-0 bg-navy-950/95 backdrop-blur-xl z-[120] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="max-w-4xl w-full my-6 bg-navy-900 text-white rounded-2xl border border-blue-500/40 shadow-2xl p-4 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header Actions (hidden during print) */}
        <div className="flex items-center justify-between border-b border-navy-700 pb-4 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xl">
              <i className="fa-solid fa-file-pdf"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg sm:text-xl">
                Strategy Execution &amp; IRS Compliance Document
              </h3>
              <p className="text-xs text-slate-400">Confirmation Sent &amp; Generated for Client Advisory</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <i className="fa-solid fa-print"></i> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-navy-800 hover:bg-navy-700 text-slate-300 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i> Close
            </button>
          </div>
        </div>

        {/* PAGE 1: STRATEGY BREAKDOWN & APPOINTMENT SUMMARY */}
        <div className="print-page bg-navy-950 p-6 sm:p-8 rounded-xl border border-navy-700 space-y-6">
          {/* Dispatch Badge */}
          <div className="bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-emerald-300 font-extrabold">
              <i className="fa-solid fa-paper-plane text-emerald-400"></i> Auto-Dispatched Copy Sent To:{' '}
              <strong className="text-white underline">atlasbridge.contact@gmail.com</strong>
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border border-emerald-500/30">
              WEB3FORMS DISPATCHED
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-navy-700 pb-4">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <i className="fa-solid fa-bridge text-blue-400"></i> ATLASBRIDGE INSURANCE GROUP LLC
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Strategy Execution Docket &amp; Appointment Summary (Page 1 of 2)</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">
                STATUS: CONFIRMED
              </span>
              <span className="text-[11px] text-slate-400">Date: {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-navy-900 p-4 rounded-xl border border-navy-800 space-y-1">
              <span className="text-slate-400 font-semibold block">Client Information:</span>
              <div className="text-sm font-bold text-white">{bookingData.fullName}</div>
              <div className="text-slate-300">{bookingData.email}</div>
              <div className="text-slate-300">{bookingData.phone}</div>
              <div className="text-slate-400 text-[10.5px] pt-1">
                Age: {clientData.clientAge} | Filing: {clientData.filingStatus.toUpperCase()}{' '}
                {clientData.filingStatus === 'married' ? '(Joint)' : ''}
              </div>
            </div>
            <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/30 space-y-1">
              <span className="text-slate-400 font-semibold block">Appointment Details:</span>
              <div className="text-sm font-bold text-emerald-400">
                {bookingData.date} @ {bookingData.time}
              </div>
              <div className="text-slate-300">{bookingData.location}</div>
              <div className="text-slate-400 text-[10px] pt-1">
                CMS ACA Consumer Consent: <span className="text-emerald-400 font-bold">Approved &amp; Documented</span>
              </div>
            </div>
          </div>

          <div className="bg-navy-900 p-5 rounded-xl border border-blue-500/40 space-y-3">
            <h4 className="text-sm font-extrabold text-blue-400 uppercase tracking-wider flex items-center justify-between">
              <span>
                Selected Strategy: <strong className="text-white">{activePath.label}</strong>
              </span>
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded border border-blue-500/30">
                Target Tax Year: {clientData.taxYear}
              </span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-navy-800">
              <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                <span className="text-slate-400 text-[10px] block font-semibold">Reported AGI</span>
                <strong className="text-white text-sm">${clientData.grossAGI.toLocaleString()}/yr</strong>
              </div>
              <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                <span className="text-slate-400 text-[10px] block font-semibold">IRS Statutory Cap</span>
                <strong className="text-amber-400 text-sm">${currentIRSLimit.toLocaleString()}/yr</strong>
              </div>
              <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                <span className="text-slate-400 text-[10px] block font-semibold">Household Size</span>
                <strong className="text-white text-sm">{clientData.householdSize} Person(s)</strong>
              </div>
              <div className="bg-navy-950 p-2.5 rounded-lg border border-navy-800">
                <span className="text-slate-400 text-[10px] block font-semibold">Federal Bracket</span>
                <strong className="text-emerald-400 text-sm">~{clientData.fplPct}% FPL</strong>
              </div>
            </div>
            {(clientData.hasTraditionalIraAnnuity || clientData.annuityType === 'yes') && (
              <div className="bg-gold-500/10 border border-gold-500/30 p-2.5 rounded-lg flex items-center justify-between text-xs text-gold-300">
                <span>
                  <i className="fa-solid fa-vault mr-1.5 text-gold-400"></i> Active Traditional IRA:
                </span>
                <span className="font-bold text-white">
                  ${clientData.annuityAnnualContribution.toLocaleString()} / yr Appx. Contribution
                </span>
              </div>
            )}
            {clientData.active401k && (
              <div className="bg-blue-500/10 border border-blue-500/30 p-2.5 rounded-lg flex items-center justify-between text-xs text-blue-300">
                <span>
                  <i className="fa-solid fa-building-columns mr-1.5 text-blue-400"></i> Active Employer 401(k) / 403(b){clientData.filingStatus === 'married' ? ' (Joint / Spouse)' : ''}:
                </span>
                <span className="font-bold text-white">
                  ${clientData.dormantRetirement.toLocaleString()} / yr Appx. Contribution {clientData.clientAge >= 50 ? '(Includes 50+ Catch-up)' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 text-xs text-slate-300">
            <strong className="text-white font-bold block">Advisor Pre-Consultation Summary &amp; Instructions:</strong>
            <p className="leading-relaxed">
              Your strategy consultation has been successfully booked with our Stuart, FL office. Please bring your latest federal tax return (Form 1040), existing health or life policy contracts, current retirement account statements, and a list of active prescription medications to your appointment.
            </p>
          </div>
        </div>

        {/* PAGE 2: IRS TAX COMPLIANCE & REGULATORY GUIDE */}
        <div className="print-page bg-navy-950 p-6 sm:p-8 rounded-xl border border-navy-700 space-y-6">
          <div className="bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-xl flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-emerald-300 font-extrabold">
              <i className="fa-solid fa-paper-plane text-emerald-400"></i> Auto-Dispatched Copy Sent To:{' '}
              <strong className="text-white underline">atlasbridge.contact@gmail.com</strong>
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-navy-700 pb-4">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <i className="fa-solid fa-scale-balanced text-gold-400"></i> IRS TAX COMPLIANCE &amp; REGULATORY GUIDE
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Pre-Tax Diversion &amp; Statutory Framework (Page 2 of 2)</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-gold-400 uppercase tracking-wider block">IRS COMPLIANCE SHEET</span>
              <span className="text-[11px] text-slate-400">Pub 590 / Sec 7702</span>
            </div>
          </div>

          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <div className="bg-navy-900 p-4 rounded-xl border border-gold-500/30 space-y-2">
              <h4 className="font-extrabold text-gold-400 uppercase text-xs">
                1. Internal Revenue Code (IRC) Pre-Tax Diversion Principles
              </h4>
              <p>
                Pre-tax contributions diverted toward qualified retirement vehicles (Traditional IRA, 401(k), 403(b), HSA) directly lower Adjusted Gross Income (AGI) on Form 1040 Line 11. Under Section 36B of the Internal Revenue Code, Modified Adjusted Gross Income (MAGI) governs eligibility for ACA Premium Tax Credits (APTC) and Cost-Sharing Reductions (CSR). For taxpayers filing Married Filing Jointly, combined household IRA contributions are allowed up to $15,000/yr (under 50) or $17,200/yr (50+ with dual catch-up), significantly expanding pre-tax MAGI reduction capabilities.
              </p>
            </div>

            <div className="bg-navy-900 p-4 rounded-xl border border-purple-500/30 space-y-2">
              <h4 className="font-extrabold text-purple-300 uppercase text-xs">
                2. Section 7702 Policy Cash Value Deferral Rules
              </h4>
              <p>
                Life insurance cash accumulations under IRC Section 7702 grow tax-deferred. Policy loans and direct 1035 non-taxable exchanges into non-qualified annuities preserve tax basis without triggering immediate ordinary income tax, provided the policy maintains statutory corridor compliance.
              </p>
            </div>

            <div className="bg-navy-900 p-4 rounded-xl border border-emerald-500/30 space-y-2">
              <h4 className="font-extrabold text-emerald-400 uppercase text-xs">
                3. Mandatory Actions to Remain IRS Compliant
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Report exact MAGI deductions on IRS Form 1040 Schedule 1 (Part II).</li>
                <li>Reconcile Advance Premium Tax Credits (APTC) using IRS Form 8962 during tax filing.</li>
                <li>Ensure non-qualified annuity transfers strictly follow direct Trustee-to-Trustee IRC 1035 guidelines to avoid constructive receipt.</li>
                <li>Verify client &amp; spouse filing status contribution limits ($7.5k/$8.6k single vs. $15k/$17.2k joint) for qualified IRA deductions.</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-navy-800 text-[10px] text-slate-400 flex flex-col sm:flex-row justify-between gap-2">
              <span>AtlasBridge Insurance Group LLC • Fiduciary Compliance Documentation</span>
              <span>Document ID: AB-CONF-2026-9921</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
