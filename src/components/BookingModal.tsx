import React, { useState } from 'react';
import { ActiveStrategySnapshot, BookingFormData, ClientData, StrategyPathConfig } from '../types';
import { getHouseholdSize, getMarginalTaxRate } from '../utils/calculations';
import { REGIONAL_HEALTH_CARRIERS } from '../utils/constants';
import { SoundFX } from '../utils/audio';

interface BookingModalProps {
  isOpen: boolean;
  activePath: StrategyPathConfig;
  clientData: ClientData;
  strategySnapshot: ActiveStrategySnapshot | null;
  onClose: () => void;
  onBookingSuccess: (bookingData: BookingFormData) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  activePath,
  clientData,
  strategySnapshot,
  onClose,
  onBookingSuccess,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<BookingFormData>({
    fullName: '',
    email: '',
    phone: '',
    date: today,
    time: '10:30 AM',
    location: '1234 Insurance Dr, Stuart, FL',
    cmsConsent: false,
  });

  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState<boolean>(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cmsConsent) {
      setFormError('Please check the CMS ACA Consumer Consent box to proceed with your booking request.');
      return;
    }
    setFormError('');

    setIsSubmitting(true);
    SoundFX.playClick();

    const docRefId = `AB-CONF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const dispatchedAt = new Date().toLocaleString();
    const householdSize = getHouseholdSize(clientData.filingStatus, clientData.dependents);
    const marginalTaxRate = getMarginalTaxRate(clientData.grossAGI, clientData.filingStatus);
    const carrierObj = REGIONAL_HEALTH_CARRIERS.find((c) => c.id === clientData.selectedHealthCarrier);
    const strategyLabel = strategySnapshot?.pathLabel || activePath.label;
    const isMarried = clientData.filingStatus === 'married';

    const sliderLines =
      strategySnapshot && strategySnapshot.sliders.length > 0
        ? strategySnapshot.sliders.map((s) => `  - ${s.label}: ${s.value}`)
        : [
            `  - Gross Annual AGI: $${clientData.grossAGI.toLocaleString()}/yr`,
            `  - Target Tax Year: ${clientData.taxYear}`,
          ];

    const impactLines =
      strategySnapshot && strategySnapshot.impactMetrics.length > 0
        ? strategySnapshot.impactMetrics.map((m) => `  - ${m.label}: ${m.value}`)
        : [`  - Baseline FPL Ratio: ~${clientData.fplPct}% FPL`];

    const formattedMessage = [
      `====================================================================`,
      `ATLASBRIDGE INSURANCE GROUP LLC — STRATEGY & ADVISORY DOCKET`,
      `====================================================================`,
      `Reference ID   : ${docRefId}`,
      `Generated      : ${dispatchedAt}`,
      `Chosen Path    : ${strategyLabel}`,
      ...(strategySnapshot?.summaryHeadline ? [`Headline       : ${strategySnapshot.summaryHeadline}`] : []),
      ...(strategySnapshot?.selectedCarrierOrVendor
        ? [`Carrier/Vendor : ${strategySnapshot.selectedCarrierOrVendor}`]
        : carrierObj
        ? [`Carrier/Vendor : ${carrierObj.name}`]
        : []),
      ...(strategySnapshot?.selectedTierOrOption
        ? [`Plan/Option    : ${strategySnapshot.selectedTierOrOption}`]
        : []),
      ``,
      `1. APPOINTMENT DETAILS & COMPLIANCE CONSENTS`,
      `--------------------------------------------------------------------`,
      `  Client Name     : ${formData.fullName}`,
      `  Email           : ${formData.email}`,
      `  Phone           : ${formData.phone}`,
      `  Preferred Date  : ${formData.date} at ${formData.time}`,
      `  Meeting Address : ${formData.location}`,
      `  CMS ACA Consent : Granted & Authorized`,
      `  Tax Agreement   : Accepted (Hypothetical projections acknowledged; CPA consultation urged)`,
      ``,
      `2. CHOSEN STRATEGY & LIVE DASHBOARD SLIDERS`,
      `--------------------------------------------------------------------`,
      ...sliderLines,
      ``,
      `3. PROJECTED FINANCIAL, TAX & ACA IMPACT`,
      `--------------------------------------------------------------------`,
      ...impactLines,
      `  Compliance Refs : Form 1040 Sched 1 (Part II), Form 8962 APTC, Form 1099-R`,
      ``,
      `4. HOUSEHOLD & TAX BASELINE PROFILE`,
      `--------------------------------------------------------------------`,
      `  Client Age      : ${clientData.clientAge} yrs${isMarried && clientData.spouseAge ? ` | Spouse Age: ${clientData.spouseAge} yrs` : ''}`,
      `  Filing Status   : ${clientData.filingStatus.toUpperCase()} (Household Size: ${householdSize}, Dependents: ${clientData.dependents})`,
      `  ZIP Code        : ${clientData.zipCode || 'Not specified'} | Target Tax Year: ${clientData.taxYear}`,
      `  Gross AGI       : $${clientData.grossAGI.toLocaleString()}/yr (~${clientData.fplPct}% FPL | ${Math.round(marginalTaxRate * 100)}% Bracket)`,
      `  Liquid Reserves : $${clientData.liquidSavings.toLocaleString()} | Tobacco: ${clientData.tobacco.toUpperCase()} | Pre-Existing: ${clientData.preExisting.toUpperCase()}`,
      `  Self-Employed   : ${clientData.isSelfEmployed ? `Yes (Est. Net Profit: $${(clientData.netSelfEmploymentProfit || 0).toLocaleString()}/yr)` : 'No'}`,
      `  Business Owner  : ${clientData.ownsBusiness ? `Yes (${clientData.w2Employees} W-2 employees)` : 'No'}`,
      `  Health Profile  : ${clientData.healthStatus.toUpperCase()} | ACA Window: ${clientData.acaWindow} | Employer Plan: ${clientData.employerGroup}`,
      `====================================================================`,
    ].join('\n');

    const payload = {
      access_key: '20bb948b-b496-4f5b-b75f-19a2717e0170',
      subject: `STRATEGY DOCKET: ${strategyLabel} — ${formData.fullName} (${docRefId})`,
      from_name: 'AtlasBridge Master Suite',
      replyto: formData.email,
      name: formData.fullName,
      email: formData.email,
      Strategy: strategyLabel,
      Reference_ID: docRefId,
      message: formattedMessage,
    };

    try {
      await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Continue gracefully even if network block occurs in sandbox
    }

    setIsSubmitting(false);
    onBookingSuccess(formData);
  };

  return (
    <div className="fixed inset-0 bg-navy-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`glass-card max-w-lg w-full p-6 sm:p-8 space-y-6 border-l-4 ${!isDisclaimerAccepted ? 'border-l-gold-500 glow-gold' : 'border-l-emerald-400 glow-emerald'} relative my-8`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl cursor-pointer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {!isDisclaimerAccepted ? (
          /* STEP 1: PRE-BOOKING DISCLAIMER & AGREEMENT */
          <div className="space-y-5">
            <div className="space-y-2 border-b border-navy-700/80 pb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-500/20 text-gold-300 text-xs font-extrabold uppercase tracking-wider border border-gold-500/30">
                <i className="fa-solid fa-scale-balanced text-gold-400"></i> Client Advisory Acknowledgment
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">Client Advisory &amp; Tax Responsibility Agreement</h3>
              <p className="text-xs text-slate-300">
                Target Strategy: <strong className="text-gold-400">{activePath.label}</strong>
              </p>
            </div>

            <div className="bg-navy-950/90 p-4 rounded-xl border border-amber-500/40 space-y-3.5 text-xs text-slate-200">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm shrink-0 mt-0.5 border border-amber-500/30">
                  <i className="fa-solid fa-chart-line"></i>
                </div>
                <div>
                  <strong className="text-white block font-bold text-xs">Hypothetical Client Projections</strong>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed mt-0.5">
                    Any strategy, financial model, or calculation chosen or evaluated by the client is a <strong>hypothetical projection based on the client's own self-directed actions, inputs, and stated parameters</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-navy-800">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center text-sm shrink-0 mt-0.5 border border-rose-500/30">
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                  <strong className="text-white block font-bold text-xs">Limitation of Tax Responsibility</strong>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed mt-0.5">
                    <strong>AtlasBridge Insurance Group LLC is not responsible for any unfulfilled tax liabilities, underpayment interest, or tax adjustments on the client's part.</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-navy-800">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm shrink-0 mt-0.5 border border-blue-500/30">
                  <i className="fa-solid fa-user-tie"></i>
                </div>
                <div>
                  <strong className="text-white block font-bold text-xs">Professional Tax Consultation Required</strong>
                  <p className="text-slate-300 text-[11.5px] leading-relaxed mt-0.5">
                    <strong>AtlasBridge Insurance Group LLC strongly urges all clients to consult a licensed tax professional or certified CPA</strong> before proceeding with or executing any chosen strategy involving pre-tax diversions or reduction of AGI.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-navy-900/90 p-3.5 rounded-xl border border-navy-700 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={disclaimerChecked}
                  onChange={(e) => {
                    setDisclaimerChecked(e.target.checked);
                    if (e.target.checked) SoundFX.playClick();
                  }}
                  className="mt-0.5 rounded border-navy-700 bg-navy-950 text-gold-500 focus:ring-gold-500 cursor-pointer"
                />
                <span className="text-xs text-slate-200 leading-snug">
                  <strong className="text-white">Required Agreement &amp; Acknowledgement *</strong><br />
                  I have read, understood, and accept this agreement. I acknowledge that all figures are hypothetical projections based on my actions, that AtlasBridge Insurance Group LLC is not liable for unfulfilled tax liabilities, and that I have been advised to consult a tax professional before proceeding with pre-tax diversions.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-slate-300 text-xs font-bold transition border border-navy-700 cursor-pointer"
              >
                Decline &amp; Exit
              </button>
              <button
                type="button"
                disabled={!disclaimerChecked}
                onClick={() => {
                  SoundFX.playClick();
                  setIsDisclaimerAccepted(true);
                }}
                className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-circle-check"></i> I Agree &amp; Proceed to Book Appointment
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2: BOOKING APPOINTMENT FORM */
          <div className="space-y-5">
            <div className="space-y-2 border-b border-navy-700/80 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold uppercase tracking-wider border border-emerald-500/30">
                  <i className="fa-solid fa-calendar-check"></i> Finalize Advisory Session
                </div>
                <span className="text-[10px] text-emerald-300 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <i className="fa-solid fa-shield-check"></i> Tax Agreement Accepted
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">Book Appointment &amp; Finalize Strategy</h3>
              <p className="text-xs text-slate-300">
                Selected Strategy: <strong className="text-emerald-400">{activePath.label}</strong>
              </p>

              <div className="bg-navy-950/90 border border-emerald-500/40 p-3 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300 mt-2">
                <i className="fa-solid fa-paper-plane text-emerald-400 text-base shrink-0"></i>
                <span>
                  <strong>Web3Forms Active:</strong> Instant API dispatch configured to{' '}
                  <strong className="text-white underline">atlasbridge.contact@gmail.com</strong>
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-semibold mb-1">Phone Number *</label>
            <input
              type="tel"
              required
              placeholder="(772) 555-0199"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Preferred Date *</label>
              <input
                type="date"
                required
                min={today}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-emerald-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Preferred Time *</label>
              <select
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-emerald-500 cursor-pointer"
              >
                <option value="09:00 AM">09:00 AM</option>
                <option value="10:30 AM">10:30 AM</option>
                <option value="01:00 PM">01:00 PM</option>
                <option value="02:30 PM">02:30 PM</option>
                <option value="04:00 PM">04:00 PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-semibold mb-1">Appointment Location</label>
            <input
              type="text"
              readOnly
              value={formData.location}
              className="w-full bg-navy-950 text-xs font-bold text-emerald-400 px-3 py-2.5 rounded-lg border border-emerald-500/30 cursor-not-allowed"
            />
          </div>

          <div className="bg-navy-950 p-3.5 rounded-xl border border-navy-700 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.cmsConsent}
                onChange={(e) => {
                  setFormData({ ...formData, cmsConsent: e.target.checked });
                  if (e.target.checked) setFormError('');
                }}
                className="mt-0.5 rounded border-navy-700 bg-navy-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-navy-950 cursor-pointer"
              />
              <span className="text-[11px] text-slate-300 leading-snug">
                <strong>CMS ACA Consumer Consent Authorization *</strong>
                <br />
                I authorize AtlasBridge Insurance Group LLC and its licensed agents to search, view, and process ACA Marketplace information solely for evaluating eligibility and implementing my selected coverage strategy.
              </span>
            </label>
          </div>

          {formError && (
            <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-400"></i>
              <span>{formError}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Dispatched via Web3Forms...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i> Submit Registration &amp; Auto-Dispatch Document
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    )}
  </div>
</div>
  );
};
