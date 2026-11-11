import React, { useState } from 'react';
import { ClientData, PrimaryCategory } from '../types';
import { getIRSLimitForAge, getRetirementPlanLimitForAge } from '../utils/calculations';
import { SoundFX } from '../utils/audio';

interface StepTwoQuestionnaireProps {
  selectedCategory: PrimaryCategory;
  clientData: ClientData;
  onChangeClientData: (updates: Partial<ClientData>) => void;
  onSubmit: () => void;
}

export const StepTwoQuestionnaire: React.FC<StepTwoQuestionnaireProps> = ({
  selectedCategory,
  clientData,
  onChangeClientData,
  onSubmit,
}) => {
  const isMarried = clientData.filingStatus === 'married';
  const [spouseAge50Plus, setSpouseAge50Plus] = useState<boolean>(false);
  const currentIRSLimit = getIRSLimitForAge(clientData.clientAge, clientData.filingStatus);
  const retirementCap = getRetirementPlanLimitForAge(clientData.clientAge, clientData.filingStatus, spouseAge50Plus);

  const categoryNames: Record<PrimaryCategory, string> = {
    unwanted_life: 'Unwanted Life Policy Audit',
    health: 'Health Insurance',
    life: 'Life Insurance',
    annuities: 'Annuities',
    rollovers: 'Rollovers & 1035 Exchanges',
    settlements: 'Life Settlements',
  };

  const handleSliderChange = (key: keyof ClientData, val: number) => {
    SoundFX.playSlideHum((val - 0) / 100);
    onChangeClientData({ [key]: val });
  };

  return (
    <section className="glass-card p-5 sm:p-8 border-l-4 border-l-purple-500 glow-purple space-y-6 sm:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-extrabold uppercase tracking-wider border border-purple-500/30 mb-2">
            <i className="fa-solid fa-wand-magic-sparkles"></i> Step 2 of 3: Diagnostic Onboarding
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">Eligibility Questions</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
            Configure client tax profile, household liquidity, and policy parameters. All metrics sync instantly across all strategy dashboards.
          </p>
        </div>
        <div className="bg-navy-950 px-4 py-3 rounded-xl border border-purple-500/30 text-left lg:text-right shrink-0">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Primary Selected Focus</span>
          <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 capitalize">
            <i className="fa-solid fa-circle-dot"></i> {categoryNames[selectedCategory]}
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-6 sm:space-y-8"
      >
        {/* Group 1: General Profile & Tax */}
        <div className="bg-navy-950/80 p-4 sm:p-5 rounded-2xl border border-navy-700/80 space-y-4 sm:space-y-5">
          <h4 className="text-xs sm:text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-user-gear"></i> 1. Demographic &amp; Tax Profile
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1.5">Target Tax Year:</label>
              <select
                value={clientData.taxYear}
                onChange={(e) => onChangeClientData({ taxYear: e.target.value as ClientData['taxYear'] })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-blue-500 cursor-pointer"
              >
                <option value="2026">2026 Tax Year (Current Year)</option>
                <option value="2027">2027 Tax Year (Open Enrollment Default)</option>
                <option value="2028">2028 Tax Year (Projected)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1.5">Tobacco / Nicotine Use?</label>
              <select
                value={clientData.tobacco}
                onChange={(e) => onChangeClientData({ tobacco: e.target.value as 'no' | 'yes' })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-blue-500 cursor-pointer"
              >
                <option value="no">Non-Tobacco User</option>
                <option value="yes">Tobacco / Nicotine User</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1.5">Tax Filing Status:</label>
              <select
                value={clientData.filingStatus}
                onChange={(e) => onChangeClientData({ filingStatus: e.target.value as ClientData['filingStatus'] })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-blue-500 cursor-pointer"
              >
                <option value="single">Single Filer</option>
                <option value="hoh">Head of Household (HOH)</option>
                <option value="married">Married Filing Jointly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1.5">Pre-Existing Conditions?</label>
              <select
                value={clientData.preExisting}
                onChange={(e) => onChangeClientData({ preExisting: e.target.value as 'no' | 'yes' })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-blue-500 cursor-pointer"
              >
                <option value="no">No Major Pre-Existing Conditions</option>
                <option value="yes">Yes (Ongoing Treatment / Chronic Care)</option>
              </select>
            </div>
          </div>

          {/* ACA Enrollment Window Option */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-navy-800/80">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1.5">ACA Enrollment Status:</label>
              <select
                value={clientData.acaWindow}
                onChange={(e) => onChangeClientData({ acaWindow: e.target.value as ClientData['acaWindow'] })}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-blue-500 cursor-pointer"
              >
                <option value="auto">Auto-Detect (Nov 1 - Jan 15 Window)</option>
                <option value="open">Currently IN Open Enrollment (Nov 1 - Jan 15)</option>
                <option value="outside_no_sep">Outside Enrollment &amp; NO Qualifying Special Event (SEP)</option>
                <option value="outside_with_sep">Outside Enrollment WITH Qualifying Event (SEP)</option>
              </select>
            </div>
            <div className="flex items-center text-xs text-slate-400 italic pt-6">
              <span>
                <i className="fa-solid fa-info-circle text-blue-400 mr-1"></i> Outside standard window without SEP redirects clients directly to Underwritten Private Health Plans.
              </span>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${isMarried ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 pt-2 border-t border-navy-800`}>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Client Age:</span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-blue-500/40">
                  <input
                    type="number"
                    min="18"
                    max="85"
                    step="1"
                    value={clientData.clientAge}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 18;
                      onChangeClientData({ clientAge: Math.min(85, Math.max(18, val)) });
                    }}
                    className="w-12 bg-transparent text-blue-400 font-extrabold text-xs focus:outline-none text-right"
                  />
                  <span className="text-slate-400 text-[10px]">yrs</span>
                </div>
              </div>
              <input
                type="range"
                min="18"
                max="85"
                step="1"
                value={clientData.clientAge}
                onChange={(e) => {
                  const newAge = parseInt(e.target.value) || 54;
                  handleSliderChange('clientAge', newAge);
                }}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              {/* Dynamic IRS Pre-tax Contribution Limits Badge */}
              <div className="flex flex-col gap-1 text-[10.5px] pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">IRS Pre-Tax Contribution Limits:</span>
                  {clientData.clientAge >= 50 ? (
                    <span className="text-amber-400 font-extrabold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                      <i className="fa-solid fa-sparkles"></i> Age 50+ Catch-up Unlocked (+$7,500)
                    </span>
                  ) : (
                    <span className="text-slate-400 font-semibold text-[10px]">Standard Caps (&lt;50)</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] bg-navy-950/80 px-2.5 py-1 rounded-lg border border-navy-800">
                  <span className="text-blue-300 font-bold">
                    401(k): ${retirementCap.toLocaleString()}/yr
                  </span>
                  <span className="text-gold-300 font-bold">
                    IRA: ${currentIRSLimit.toLocaleString()}/yr
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isMarried ? 'Joint Married' : 'Single'}
                  </span>
                </div>
              </div>
            </div>

            {isMarried && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-300 font-semibold">Spouse Age:</span>
                    <span className="text-[9.5px] text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded font-extrabold">MFJ Spousal Cap</span>
                  </div>
                  <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                    <input
                      type="number"
                      min="18"
                      max="85"
                      step="1"
                      value={clientData.spouseAge || 52}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 18;
                        onChangeClientData({ spouseAge: Math.min(85, Math.max(18, val)) });
                      }}
                      className="w-12 bg-transparent text-emerald-400 font-extrabold text-xs focus:outline-none text-right"
                    />
                    <span className="text-slate-400 text-[10px]">yrs</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="18"
                  max="85"
                  step="1"
                  value={clientData.spouseAge || 52}
                  onChange={(e) => {
                    const newSpouseAge = parseInt(e.target.value) || 52;
                    handleSliderChange('spouseAge', newSpouseAge);
                  }}
                  className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex flex-col gap-1 text-[10.5px] pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Spouse Statutory Cap:</span>
                    {(clientData.spouseAge || 52) >= 50 ? (
                      <span className="text-emerald-400 font-extrabold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                        <i className="fa-solid fa-sparkles"></i> Age 50+ Catch-up Included
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold text-[10px]">Standard Cap (&lt;50)</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] bg-navy-950/80 px-2.5 py-1 rounded-lg border border-navy-800">
                    <span className="text-emerald-300 font-bold">
                      IRA: ${getIRSLimitForAge(clientData.spouseAge || 52, 'married').toLocaleString()}/yr
                    </span>
                    <span className="text-blue-300 font-bold">
                      401(k): ${getRetirementPlanLimitForAge(clientData.spouseAge || 52, 'married', (clientData.spouseAge || 52) >= 50).toLocaleString()}/yr
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Tax Dependents:</span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-gold-500/40">
                  <input
                    type="number"
                    min="0"
                    max="8"
                    step="1"
                    value={clientData.dependents}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      onChangeClientData({ dependents: Math.min(8, Math.max(0, val)) });
                    }}
                    className="w-12 bg-transparent text-gold-400 font-extrabold text-xs focus:outline-none text-right"
                  />
                  <span className="text-slate-400 text-[10px]">dep</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={clientData.dependents}
                onChange={(e) => handleSliderChange('dependents', parseInt(e.target.value) || 0)}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-gold-500"
              />
            </div>
          </div>
        </div>

        {/* Group 2: Income & Household Wealth */}
        <div className="bg-navy-950/80 p-4 sm:p-5 rounded-2xl border border-navy-700/80 space-y-4 sm:space-y-5">
          <h4 className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-wallet"></i> 2. Income &amp; Household Liquidity
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">
                  Projected Gross AGI ($/yr){' '}
                  {isMarried && <span className="text-gold-400 font-extrabold">(Including Spouse)</span>}:
                </span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                  <span className="text-emerald-400 font-bold">$</span>
                  <input
                    type="number"
                    min="15000"
                    max="300000"
                    step="500"
                    value={clientData.grossAGI}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 15000;
                      onChangeClientData({ grossAGI: Math.max(15000, val) });
                    }}
                    className="w-24 bg-transparent text-emerald-400 font-extrabold text-xs focus:outline-none text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="15000"
                max="250000"
                step="500"
                value={Math.min(250000, clientData.grossAGI)}
                onChange={(e) => handleSliderChange('grossAGI', parseFloat(e.target.value) || 65000)}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold">Liquid Savings &amp; Reserves ($):</span>
                <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                  <span className="text-emerald-400 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    max="500000"
                    step="1000"
                    value={clientData.liquidSavings}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onChangeClientData({ liquidSavings: Math.max(0, val) });
                    }}
                    className="w-24 bg-transparent text-emerald-400 font-extrabold text-xs focus:outline-none text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="200000"
                step="1000"
                value={Math.min(200000, clientData.liquidSavings)}
                onChange={(e) => handleSliderChange('liquidSavings', parseFloat(e.target.value) || 0)}
                className="w-full h-2 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-navy-800">
            <label className="block text-xs text-slate-300 font-semibold mb-1.5">Health Status &amp; Care Need:</label>
            <select
              value={clientData.healthStatus}
              onChange={(e) => onChangeClientData({ healthStatus: e.target.value as ClientData['healthStatus'] })}
              className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-emerald-500 cursor-pointer"
            >
              <option value="healthy">Healthy (Routine Care / Wellness)</option>
              <option value="moderate">Moderate (Occasional Prescriptions / Specialists)</option>
              <option value="high">Major Pre-Existing / Ongoing Severe Treatment</option>
            </select>
          </div>
        </div>

        {/* Group 3: Business Ownership */}
        <div className="bg-navy-950/80 p-4 sm:p-5 rounded-2xl border border-navy-700/80 space-y-4">
          <h4 className="text-xs sm:text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
            <i className="fa-solid fa-building-user"></i> 3. Business Ownership &amp; Group Coverage
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1.5">Do you own a business entity?</label>
              <select
                value={clientData.ownsBusiness ? 'yes' : 'no'}
                onChange={(e) => {
                  const isYes = e.target.value === 'yes';
                  onChangeClientData({ ownsBusiness: isYes, w2Employees: isYes ? clientData.w2Employees : 0 });
                }}
                className="w-full bg-navy-900 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-purple-500 cursor-pointer"
              >
                <option value="no">No (Individual / W2 Employee)</option>
                <option value="yes">Yes (Sole Prop, LLC, S-Corp, C-Corp)</option>
              </select>
            </div>

            <div className={`transition-all ${clientData.ownsBusiness ? 'opacity-100' : 'opacity-40'}`}>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">
                {clientData.ownsBusiness ? 'W2 Employees (Excluding Owners):' : 'W2 Employees (Inactive):'}
              </label>
              <input
                type="number"
                min="0"
                max="500"
                disabled={!clientData.ownsBusiness}
                value={clientData.w2Employees}
                onChange={(e) => onChangeClientData({ w2Employees: parseInt(e.target.value) || 0 })}
                className={`w-full text-xs font-bold px-3 py-2 rounded-lg border ${
                  clientData.ownsBusiness
                    ? 'bg-navy-900 text-white border-navy-700 focus:border-purple-500'
                    : 'bg-navy-900/50 text-slate-500 border-navy-800 cursor-not-allowed'
                }`}
              />
            </div>

            <div className={`transition-all ${clientData.ownsBusiness ? 'opacity-100' : 'opacity-40'}`}>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">
                {clientData.ownsBusiness ? 'Employer Group Health Offered?' : 'Employer Group Health Offered (Inactive):'}
              </label>
              <select
                disabled={!clientData.ownsBusiness}
                value={clientData.employerGroup}
                onChange={(e) => onChangeClientData({ employerGroup: e.target.value as ClientData['employerGroup'] })}
                className={`w-full text-xs font-bold px-3 py-2.5 rounded-lg border ${
                  clientData.ownsBusiness
                    ? 'bg-navy-900 text-white border-navy-700 focus:border-purple-500 cursor-pointer'
                    : 'bg-navy-900/50 text-slate-500 border-navy-800 cursor-not-allowed'
                }`}
              >
                <option value="no">No Group Plan Available</option>
                <option value="yes_affordable">Yes (Affordable Group Plan)</option>
                <option value="yes_unaffordable">Yes (Unaffordable Employer Plan)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Group 4: Existing Retirement & Life Assets */}
        <div className="bg-navy-950/80 p-4 sm:p-5 rounded-2xl border border-navy-700/80 space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-navy-800 pb-3">
            <h4 className="text-xs sm:text-sm font-bold text-gold-400 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-piggy-bank"></i> 4. Existing Retirement &amp; Life Insurance Assets
            </h4>
            {isMarried && (
              <span className="text-[11px] font-bold text-gold-400 bg-gold-500/15 border border-gold-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
                <i className="fa-solid fa-user-group text-[10px]"></i> Married Joint Filing Mode Active
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {/* Box 1: Active 401(k) / Employer Plan */}
            <div className="flex flex-col justify-between bg-navy-900/60 p-4 rounded-xl border border-navy-700/80 hover:border-navy-600 transition-colors h-full">
              <div className="space-y-1 mb-3 flex-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-briefcase text-gold-400"></i> Active 401(k) / Employer Plan
                </span>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {isMarried ? 'Employer plans for client or spouse (401k/403b)' : 'Active employer plan (401k, 403b, TSP)'}
                </p>
              </div>
              <select
                value={
                  isMarried
                    ? (clientData.active401k === true ? 'both' : (clientData.active401k === false ? 'neither' : clientData.active401k || 'neither'))
                    : (clientData.active401k === true || clientData.active401k === 'client_only' || clientData.active401k === 'both' ? 'yes' : 'no')
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (isMarried) {
                    const hasClient = val === 'client_only' || val === 'both';
                    const hasSpouse = val === 'spouse_only' || val === 'both';
                    onChangeClientData({
                      active401k: val as ClientData['active401k'],
                      dormantRetirement: hasClient ? (clientData.dormantRetirement || 6000) : 0,
                      spouseDormantRetirement: hasSpouse ? (clientData.spouseDormantRetirement || 6000) : 0,
                    });
                  } else {
                    const isYes = val === 'yes';
                    onChangeClientData({
                      active401k: isYes,
                      dormantRetirement: isYes ? (clientData.dormantRetirement || 6000) : 0,
                      spouseDormantRetirement: 0,
                    });
                  }
                }}
                className="w-full bg-navy-950 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-gold-500 cursor-pointer"
              >
                {isMarried ? (
                  <>
                    <option value="neither">Neither Has Active Plan</option>
                    <option value="client_only">Client Only Has 401(k)</option>
                    <option value="spouse_only">Spouse Only Has 401(k)</option>
                    <option value="both">Both Have Active 401(k)s</option>
                  </>
                ) : (
                  <>
                    <option value="no">No Active Employer Plan</option>
                    <option value="yes">Yes (Active Employer 401k/403b)</option>
                  </>
                )}
              </select>
            </div>

            {/* Box 2: Existing IRA Account */}
            <div className="flex flex-col justify-between bg-navy-900/60 p-4 rounded-xl border border-gold-500/30 hover:border-gold-500/50 transition-colors h-full">
              <div className="space-y-1 mb-3 flex-1">
                <span className="text-xs font-bold text-gold-300 flex items-center gap-1.5">
                  <i className="fa-solid fa-landmark text-gold-400"></i> Existing IRA Account
                </span>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {isMarried ? 'Traditional IRA / Annuity (Client or Spouse)' : 'Traditional IRA or Qualified Annuity'}
                </p>
              </div>
              <select
                value={
                  isMarried
                    ? (clientData.annuityType === 'yes' || clientData.annuityType === 'both' ? 'both' : (clientData.annuityType === 'none' || clientData.annuityType === 'no' ? 'neither' : clientData.annuityType || 'neither'))
                    : (clientData.annuityType === 'yes' || clientData.annuityType === 'client_only' || clientData.annuityType === 'both' || clientData.hasTraditionalIraAnnuity ? 'yes' : 'no')
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (isMarried) {
                    const hasClient = val === 'client_only' || val === 'both';
                    const hasSpouse = val === 'spouse_only' || val === 'both';
                    onChangeClientData({
                      hasTraditionalIraAnnuity: hasClient || hasSpouse,
                      annuityType: val as ClientData['annuityType'],
                      existingAnnuityCash: hasClient ? (clientData.existingAnnuityCash || Math.min(6000, currentIRSLimit)) : 0,
                      spouseExistingAnnuityCash: hasSpouse ? (clientData.spouseExistingAnnuityCash || Math.min(6000, currentIRSLimit)) : 0,
                      annuityAnnualContribution: (hasClient ? (clientData.existingAnnuityCash || 6000) : 0) + (hasSpouse ? (clientData.spouseExistingAnnuityCash || 6000) : 0),
                    });
                  } else {
                    const isYes = val === 'yes';
                    onChangeClientData({
                      hasTraditionalIraAnnuity: isYes,
                      annuityType: isYes ? 'yes' : 'no',
                      existingAnnuityCash: isYes ? (clientData.existingAnnuityCash || Math.min(6000, currentIRSLimit)) : 0,
                      spouseExistingAnnuityCash: 0,
                      annuityAnnualContribution: isYes ? (clientData.annuityAnnualContribution || Math.min(6000, currentIRSLimit)) : 0,
                    });
                  }
                }}
                className="w-full bg-navy-950 text-xs font-bold text-gold-300 px-3 py-2.5 rounded-lg border border-gold-500/40 focus:border-gold-500 cursor-pointer"
              >
                {isMarried ? (
                  <>
                    <option value="neither">Neither Has Traditional IRA</option>
                    <option value="client_only">Client Only Has Traditional IRA</option>
                    <option value="spouse_only">Spouse Only Has Traditional IRA</option>
                    <option value="both">Both Have Traditional IRAs</option>
                  </>
                ) : (
                  <>
                    <option value="no">No existing IRA</option>
                    <option value="yes">Yes (Active Traditional IRA)</option>
                  </>
                )}
              </select>
            </div>

            {/* Box 3: Existing Life Insurance */}
            <div className="flex flex-col justify-between bg-navy-900/60 p-4 rounded-xl border border-navy-700/80 hover:border-navy-600 transition-colors h-full">
              <div className="space-y-1 mb-3 flex-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-heart text-rose-400"></i> Existing Life Insurance
                </span>
                <p className="text-[11px] text-slate-400 leading-snug">Current policy type, structure, and retention intent</p>
              </div>
              <select
                value={clientData.lifePolicyStatus}
                onChange={(e) => onChangeClientData({ lifePolicyStatus: e.target.value as ClientData['lifePolicyStatus'] })}
                className="w-full bg-navy-950 text-xs font-bold text-white px-3 py-2.5 rounded-lg border border-navy-700 focus:border-gold-500 cursor-pointer"
              >
                <option value="no">No Life Policy</option>
                <option value="perm_unwanted">Permanent Life (Unwanted / High Premium)</option>
                <option value="perm_wanted">Permanent Life (Active / Keep)</option>
                <option value="term">Term Life Policy</option>
              </select>
            </div>
          </div>

          {/* Sliders Container: Shown when at least one retirement or IRA coverage is active */}
          {((clientData.active401k && clientData.active401k !== 'neither') ||
            (clientData.annuityType && clientData.annuityType !== 'none' && clientData.annuityType !== 'no' && clientData.annuityType !== 'neither')) && (
            <div className="grid gap-5 pt-4 border-t border-navy-800 grid-cols-1 lg:grid-cols-2">
              {/* Slider 1: 401(k) Deferrals (Client and/or Spouse) */}
              {(clientData.active401k && clientData.active401k !== 'neither') && (
                <div className="bg-navy-900/80 p-4 sm:p-5 rounded-xl border border-emerald-500/40 space-y-4 shadow-lg flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                        <i className="fa-solid fa-briefcase text-emerald-400"></i> Employer 401(k) Deferral
                      </span>
                      {isMarried && (
                        <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                          Combined: ${((clientData.dormantRetirement || 0) + (clientData.spouseDormantRetirement || 0)).toLocaleString()}/yr
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Annual elective deferrals into employer 401(k), 403(b), or TSP
                    </p>
                  </div>

                  {/* Primary Client 401(k) Slider */}
                  {(!isMarried || clientData.active401k === 'client_only' || clientData.active401k === 'both') && (
                    <div className={`space-y-2 ${isMarried ? 'bg-navy-950/60 p-3 rounded-lg border border-navy-800' : ''}`}>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-semibold">{isMarried ? 'Client 401(k) Contribution:' : 'Annual 401(k) Deferral:'}</span>
                        <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                          <span className="text-emerald-400 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            max={retirementCap}
                            step="250"
                            value={clientData.dormantRetirement || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              onChangeClientData({ dormantRetirement: Math.min(retirementCap, Math.max(0, val)) });
                            }}
                            className="w-20 bg-transparent text-emerald-400 font-extrabold text-xs focus:outline-none text-right"
                          />
                          <span className="text-[10px] text-slate-400">/yr</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={retirementCap}
                        step="250"
                        value={Math.min(retirementCap, clientData.dormantRetirement || 0)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          handleSliderChange('dormantRetirement', Math.min(retirementCap, val));
                        }}
                        className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>$0</span>
                        <span>${Math.round(retirementCap / 2).toLocaleString()}</span>
                        <span className="text-emerald-400 font-bold">Max: ${retirementCap.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Spouse 401(k) Slider */}
                  {isMarried && (clientData.active401k === 'spouse_only' || clientData.active401k === 'both') && (
                    <div className="space-y-2 bg-navy-950/60 p-3 rounded-lg border border-emerald-500/30">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-emerald-300 font-semibold">Spouse 401(k) Contribution:</span>
                        <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                          <span className="text-emerald-400 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            max={retirementCap}
                            step="250"
                            value={clientData.spouseDormantRetirement || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              onChangeClientData({ spouseDormantRetirement: Math.min(retirementCap, Math.max(0, val)) });
                            }}
                            className="w-20 bg-transparent text-emerald-400 font-extrabold text-xs focus:outline-none text-right"
                          />
                          <span className="text-[10px] text-slate-400">/yr</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={retirementCap}
                        step="250"
                        value={Math.min(retirementCap, clientData.spouseDormantRetirement || 0)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          handleSliderChange('spouseDormantRetirement', Math.min(retirementCap, val));
                        }}
                        className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>$0</span>
                        <span>${Math.round(retirementCap / 2).toLocaleString()}</span>
                        <span className="text-emerald-400 font-bold">Max: ${retirementCap.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Cap detail */}
                  <div className="bg-navy-950/90 p-2.5 rounded-lg border border-navy-800 text-[10.5px] text-slate-400 flex items-center justify-between">
                    <span>Individual statutory cap: ${retirementCap.toLocaleString()}/ea</span>
                    <span className="text-emerald-400 font-bold">{clientData.clientAge >= 50 ? 'Age 50+ Catch-up Included' : 'Standard Cap'}</span>
                  </div>
                </div>
              )}

              {/* Slider 2: Traditional IRA / Annuity (Client and/or Spouse) */}
              {(clientData.annuityType && clientData.annuityType !== 'none' && clientData.annuityType !== 'no' && clientData.annuityType !== 'neither') && (
                <div className="bg-navy-900/80 p-4 sm:p-5 rounded-xl border border-gold-500/40 space-y-4 shadow-lg flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-gold-300 flex items-center gap-1.5">
                        <i className="fa-solid fa-piggy-bank text-gold-400"></i> Traditional IRA / Annuity
                      </span>
                      {isMarried && (
                        <span className="text-[10px] font-extrabold text-gold-400 bg-gold-500/15 border border-gold-500/30 px-2 py-0.5 rounded">
                          Combined: ${((clientData.existingAnnuityCash || 0) + (clientData.spouseExistingAnnuityCash || 0)).toLocaleString()}/yr
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Annual contributions to Traditional IRA or Qualified Annuity (IRC § 219)
                    </p>
                  </div>

                  {/* Primary Client IRA Slider */}
                  {(!isMarried || clientData.annuityType === 'client_only' || clientData.annuityType === 'both' || clientData.annuityType === 'yes') && (
                    <div className={`space-y-2 ${isMarried ? 'bg-navy-950/60 p-3 rounded-lg border border-navy-800' : ''}`}>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-semibold">{isMarried ? 'Client Trad-IRA Contribution:' : 'Annual IRA Contribution:'}</span>
                        <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-gold-500/40">
                          <span className="text-gold-400 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            max={currentIRSLimit}
                            step="100"
                            value={clientData.existingAnnuityCash || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              onChangeClientData({ existingAnnuityCash: Math.min(currentIRSLimit, Math.max(0, val)) });
                            }}
                            className="w-20 bg-transparent text-gold-400 font-extrabold text-xs focus:outline-none text-right"
                          />
                          <span className="text-[10px] text-slate-400">/yr</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={currentIRSLimit}
                        step="100"
                        value={Math.min(currentIRSLimit, clientData.existingAnnuityCash || 0)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          handleSliderChange('existingAnnuityCash', Math.min(currentIRSLimit, val));
                        }}
                        className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-gold-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>$0</span>
                        <span>${Math.round(currentIRSLimit / 2).toLocaleString()}</span>
                        <span className="text-gold-400 font-bold">Max: ${currentIRSLimit.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Spouse IRA Slider */}
                  {isMarried && (clientData.annuityType === 'spouse_only' || clientData.annuityType === 'both') && (
                    <div className="space-y-2 bg-navy-950/60 p-3 rounded-lg border border-amber-500/30">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-amber-300 font-semibold">Spouse Trad-IRA (IRC § 219(c)):</span>
                        <div className="flex items-center gap-1 bg-navy-900 px-2.5 py-1 rounded-lg border border-amber-500/40">
                          <span className="text-amber-400 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            max={currentIRSLimit}
                            step="100"
                            value={clientData.spouseExistingAnnuityCash || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              onChangeClientData({ spouseExistingAnnuityCash: Math.min(currentIRSLimit, Math.max(0, val)) });
                            }}
                            className="w-20 bg-transparent text-amber-400 font-extrabold text-xs focus:outline-none text-right"
                          />
                          <span className="text-[10px] text-slate-400">/yr</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={currentIRSLimit}
                        step="100"
                        value={Math.min(currentIRSLimit, clientData.spouseExistingAnnuityCash || 0)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          handleSliderChange('spouseExistingAnnuityCash', Math.min(currentIRSLimit, val));
                        }}
                        className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                        <span>$0</span>
                        <span>${Math.round(currentIRSLimit / 2).toLocaleString()}</span>
                        <span className="text-amber-400 font-bold">Max: ${currentIRSLimit.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Cap detail */}
                  <div className="bg-navy-950/90 p-2.5 rounded-lg border border-navy-800 text-[10.5px] text-slate-400 flex items-center justify-between">
                    <span>Individual statutory cap: ${currentIRSLimit.toLocaleString()}/ea</span>
                    <span className="text-gold-400 font-bold">{clientData.clientAge >= 50 ? '+$1,100 Catch-up Included' : 'Standard Cap'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-extrabold text-sm shadow-xl hover:from-blue-500 hover:to-purple-500 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-calculator"></i> Finish &amp; Generate Optimal Plans
          </button>
        </div>
      </form>
    </section>
  );
};
