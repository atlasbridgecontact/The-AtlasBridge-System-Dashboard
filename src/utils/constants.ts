import {
  CarrierStatProfile,
  HealthCarrierInfo,
  LifeCarrier,
  LifePolicySubtype,
  LifeRiderDefinition,
  LifeTabType,
  PrivateCarrierInfo,
  StrategyPathConfig,
} from '../types';

export const COLOR_HEX_MAP: Record<string, string> = {
  blue: '#60a5fa',
  emerald: '#34d399',
  purple: '#c084fc',
  red: '#f87171',
  indigo: '#818cf8',
  gold: '#fbbf24',
  cyan: '#22d3ee',
  amber: '#f59e0b',
  rose: '#fb7185',
  silver: '#94a3b8',
};

export const CARRIER_STAT_PROFILES: Record<string, CarrierStatProfile> = {
  'Mutual of Omaha': {
    termPrem: 58,
    termLiving: 'Included (Terminal, Chronic, Critical)',
    iulPrem: 340,
    iulCash: 138500,
    wholePrem: 220,
    wholeGuarantee: 'Guaranteed to Age 120 (4.25% Dividend Scale)',
  },
  'Corebridge Financial': {
    termPrem: 62,
    termLiving: 'Enhanced Accelerated Benefits (Up to $500k)',
    iulPrem: 350,
    iulCash: 148200,
    wholePrem: 215,
    wholeGuarantee: 'Guaranteed to Age 120 (Max Accumulation Index)',
  },
  'Lincoln Financial': {
    termPrem: 65,
    termLiving: 'Standard Chronic & Terminal Riders',
    iulPrem: 365,
    iulCash: 141000,
    wholePrem: 205,
    wholeGuarantee: 'Guaranteed Level Estate Lock (5.10% Dividend)',
  },
  'Pacific Life': {
    termPrem: 60,
    termLiving: 'Comprehensive Living Benefit Acceleration',
    iulPrem: 330,
    iulCash: 152000,
    wholePrem: 225,
    wholeGuarantee: 'Guaranteed to Age 120 (High Horizon Index)',
  },
  'Principal': {
    termPrem: 64,
    termLiving: 'Executive Critical Care Rider',
    iulPrem: 355,
    iulCash: 144000,
    wholePrem: 210,
    wholeGuarantee: 'Guaranteed Corporate & Personal Legacy Lock',
  },
};

export const REGIONAL_HEALTH_CARRIERS: HealthCarrierInfo[] = [
  {
    id: 'oscar',
    name: 'Oscar Health',
    category: 'Silver CSR 94/87/73 & Bronze Copay',
    note: 'Top Rate in Stuart / Martin County',
    directoryUrl: 'https://www.hioscar.com/search/',
    networkSearchHint: 'primary care clinic urgent care medical center',
    carrierQueries: ['Oscar primary care clinic', 'Cleveland Clinic HCA medical center urgent care'],
  },
  {
    id: 'fl_blue',
    name: 'Florida Blue (BlueCross)',
    category: 'Silver Essential / Gold Preferred PPO & HMO',
    note: 'Largest Local Hospital Network',
    directoryUrl: 'https://www.floridablue.com/find-a-doctor',
    networkSearchHint: 'hospital primary care medical center urgent care',
    carrierQueries: ['Florida Blue Sanitas medical center', 'GuideWell Emergency hospital primary care'],
  },
  {
    id: 'ambetter',
    name: 'Ambetter Sunshine Health',
    category: 'Bronze HDHP & Balanced Care Silver',
    note: 'Lowest Out-of-Pocket Premiums',
    directoryUrl: 'https://guide.ambetterhealth.com/',
    networkSearchHint: 'community health center primary care clinic urgent care',
    carrierQueries: ['Ambetter primary care clinic', 'community health center urgent care family medicine'],
  },
  {
    id: 'fhcp',
    name: 'Florida Health Care Plans (FHCP)',
    category: 'Standard Silver (70% AV) & Gold Copay',
    note: 'Top Value HMO & Integrated Care',
    directoryUrl: 'https://www.fhcp.com/find-a-provider/',
    networkSearchHint: 'medical center primary care clinic urgent care',
    carrierQueries: ['Florida Health Care Plans care center', 'primary care medical center urgent care'],
  },
  {
    id: 'molina',
    name: 'Molina Healthcare of Florida',
    category: 'Constant Care Silver & Core Care Bronze',
    note: 'Competitive CSR Silver Value (Active 2026+)',
    directoryUrl: 'https://www.molinamarketplace.com/marketplace/fl/en-us/Find-a-Doctor',
    networkSearchHint: 'primary care clinic urgent care community health medical center',
    carrierQueries: ['Molina Healthcare primary care clinic', 'community health urgent care medical center'],
  },
  {
    id: 'uhc',
    name: 'UnitedHealthcare ACA Marketplace',
    category: 'Choice Silver & Essential Bronze',
    note: 'Extensive Regional Doctor Network',
    directoryUrl: 'https://www.uhc.com/find-a-doctor',
    networkSearchHint: 'primary care physician clinic hospital urgent care',
    carrierQueries: ['Optum primary care clinic', 'UnitedHealthcare physician medical center urgent care'],
  },
];

export const PRIVATE_HEALTH_CARRIERS: PrivateCarrierInfo[] = [
  {
    id: 'cigna_ppo',
    name: 'Cigna Open Access PPO',
    category: 'Nationwide Open Access Plus PPO',
    note: 'Broad National Hospital & Specialist Access',
    directoryUrl: 'https://hcpdirectory.cigna.com/',
    networkSearchHint: 'primary care clinic urgent care medical center hospital',
    carrierQueries: ['Cigna primary care clinic', 'Cleveland Clinic HCA medical center urgent care'],
    rateFactor: 1.03,
    networkType: 'Nationwide Open Access PPO',
    networkStrength: 'No PCP referrals required across 1.5M+ providers & major regional hospitals',
  },
  {
    id: 'uhc_ppo',
    name: 'UnitedHealthcare Choice Plus',
    category: 'UHC Choice Plus Nationwide PPO',
    note: 'Largest Direct Physician & Optum Footprint',
    directoryUrl: 'https://www.uhc.com/find-a-doctor',
    networkSearchHint: 'primary care physician clinic hospital urgent care',
    carrierQueries: ['UnitedHealthcare Optum primary care clinic', 'hospital urgent care medical center'],
    rateFactor: 1.06,
    networkType: 'Choice Plus National PPO',
    networkStrength: 'Premier physician, outpatient surgical & diagnostic imaging network nationwide',
  },
  {
    id: 'multiplan_ppo',
    name: 'MultiPlan / PHCS PPO',
    category: 'Independent Nationwide PHCS Wrap PPO',
    note: 'Top Cost-Efficiency for Healthy & 1099 Families',
    directoryUrl: 'https://www.multiplan.com/webcenter/portal/ProviderSearch',
    networkSearchHint: 'primary care medical center urgent care hospital',
    carrierQueries: ['primary care physician medical clinic', 'hospital urgent care medical center'],
    rateFactor: 0.94,
    networkType: 'MultiPlan / PHCS Practitioner & Ancillary PPO',
    networkStrength: 'Flexible nationwide network discounts paired with 0% referral restrictions',
  },
  {
    id: 'aetna_ppo',
    name: 'Aetna Open Choice PPO',
    category: 'Aetna Open Choice & MinuteClinic PPO',
    note: 'Strong Outpatient & CVS Health Integration',
    directoryUrl: 'https://www.aetna.com/dsepublic/',
    networkSearchHint: 'primary care clinic urgent care medical center hospital',
    carrierQueries: ['Aetna MinuteClinic primary care', 'hospital medical center urgent care'],
    rateFactor: 1.0,
    networkType: 'Open Choice National PPO',
    networkStrength: 'Seamless specialist access plus $0/low-cost MinuteClinic & telehealth perks',
  },
];

export const ALL_PATHS: StrategyPathConfig[] = [
  { id: 'atlasbridge', category: 'health', label: 'ACA + Atlasbridge System', icon: 'fa-bridge', color: 'blue', desc: 'Fiduciary ACA optimization + pre-tax wealth accumulation & local DPC access.' },
  { id: 'self_employed_aca', category: 'health', label: 'Self-Employed ACA Optimizer', icon: 'fa-briefcase', color: 'purple', desc: 'Maximize pre-tax deductions (Solo 401k, SEP-IRA, Spousal IRA) to unlock maximum ACA subsidies & Silver CSR plans.' },
  { id: 'unwanted_life', category: 'unwanted_life', label: 'Unwanted Life Policy Audit', icon: 'fa-file-invoice-dollar', color: 'emerald', desc: 'Audit loans, surrender charges, tax liability & 1035 non-qualified annuity rollovers.' },
  { id: 'annuities', category: 'annuities', label: 'Annuities & Guaranteed Income', icon: 'fa-vault', color: 'gold', desc: 'Fixed, Indexed, & Flexible Premium Annuities with Qualified/Non-Qual filtering.' },
  { id: 'rollovers', category: 'rollovers', label: 'Rollovers & 1035 Exchanges', icon: 'fa-arrow-rotate-right', color: 'cyan', desc: 'Tax-free transfer of dormant 401(k)s or outdated annuity policies.' },
  { id: 'traditional_aca', category: 'health', label: 'Traditional ACA Signup', icon: 'fa-shield-halved', color: 'emerald', desc: 'Standard Exchange health plan without pre-tax strategy.' },
  { id: 'private_health', category: 'health', label: 'Private Health Plans', icon: 'fa-user-shield', color: 'purple', desc: 'Underwritten PPO plans for healthy individuals or outside ACA window.' },
  { id: 'life', category: 'life', label: 'Life Insurance Strategy', icon: 'fa-shield-heart', color: 'red', desc: 'Term with Living Benefits, IUL cash accumulation & Whole Life/GUL estate planning.' },
  { id: 'group', category: 'health', label: 'Group Health Plans', icon: 'fa-users-gear', color: 'indigo', desc: 'Employer-sponsored group benefits for small/mid businesses.' },
  { id: 'settlements', category: 'settlements', label: 'Life Settlements', icon: 'fa-hand-holding-dollar', color: 'silver', desc: 'Monetize unwanted or costly life insurance policies for cash.' },
];

export const TAX_YEAR_PARAMS_2027 = { baseFPL: 15960, perAddFPL: 5680 };

export interface RegionalFpaCarrier {
  id: 'national_life' | 'lafayette' | 'anico' | 'assurity';
  name: string;
  productName: string;
  minQualified: number;
  minNonQualified: number;
  monthlyDraftMin: number;
  annualCreditingRate: number;
  summary: string;
}

export const REGIONAL_FPA_CARRIERS: RegionalFpaCarrier[] = [
  {
    id: 'national_life',
    name: 'National Life Group',
    productName: 'Systematic Indexed FPA Series',
    minQualified: 1200,
    minNonQualified: 1200,
    monthlyDraftMin: 100,
    annualCreditingRate: 0.058,
    summary: 'Lowest monthly systematic access ($100/mo or $1,200/yr) with indexed upside & 0% downside floor.',
  },
  {
    id: 'lafayette',
    name: 'Lafayette Life',
    productName: 'Marquis Flexible Deferred Annuity',
    minQualified: 1200,
    minNonQualified: 1200,
    monthlyDraftMin: 100,
    annualCreditingRate: 0.052,
    summary: 'Flexible annual/monthly accumulation starting at $1,200/yr ($100/mo) for steady tax-deferred growth.',
  },
  {
    id: 'anico',
    name: 'American National (ANICO)',
    productName: 'WealthQuest Citadel Flexible Annuity',
    minQualified: 2000,
    minNonQualified: 5000,
    monthlyDraftMin: 100,
    annualCreditingRate: 0.054,
    summary: 'Multi-tier flexible deferred crediting starting at $2,000 Qualified ($5,000 Non-Qualified).',
  },
  {
    id: 'assurity',
    name: 'Assurity',
    productName: 'SecurePath Flexible Contribution Annuity',
    minQualified: 2000,
    minNonQualified: 2000,
    monthlyDraftMin: 100,
    annualCreditingRate: 0.051,
    summary: 'Low $2,000 initial entry with $100 flexible subsequent deposits and predictable fixed guarantees.',
  },
];

/**
 * Carrier x Policy-Subtype Rider Compatibility Catalog
 * Ensures every rendered rider is genuinely issueable on the selected carrier + policy structure.
 */
export const LIFE_RIDER_CATALOG: LifeRiderDefinition[] = [
  {
    key: 'waiver',
    defaultName: 'Waiver of Premium Rider',
    defaultDesc: 'Waives base premiums during qualifying total disability (6-mo elimination period, typically up to age 60/65)',
    costWeightPct: 6,
    eligibleCarriers: ['Mutual of Omaha', 'Corebridge Financial', 'Lincoln Financial', 'Pacific Life', 'Principal'],
    eligibleSubtypes: ['term_10', 'term_20', 'term_30', 'whole_standard', 'whole_paid_up', 'iul', 'vul', 'gul', 'key_person', 'buy_sell', 'exec_bonus'],
    labelByTab: {
      term: {
        name: 'Waiver of Premium (Term)',
        desc: 'Available on 10/20/30-Yr Term: waives monthly premiums if totally disabled before age 60/65',
      },
      whole: {
        name: 'Waiver of Premium (Whole Life)',
        desc: 'Keeps permanent Whole Life & dividend growth in force with $0 premiums during total disability',
      },
      universal: {
        name: 'Waiver of Monthly Deductions',
        desc: 'Waives monthly COI & policy expense charges on Universal/IUL/VUL during total disability',
      },
      other: {
        name: 'Waiver of Premium (Business)',
        desc: 'Preserves Key-Person / Executive coverage automatically if insured becomes totally disabled',
      },
    },
    carrierNote: {
      'Pacific Life': 'Standard on PL Promise Term & UL portfolios (ages 18–59)',
      'Mutual of Omaha': 'Available on Term Life Express/Answers & IUL (issue ages 18–55)',
      'Corebridge Financial': 'Select-a-Term & QoL Max Accumulator Waiver Rider available',
    },
  },
  {
    key: 'adb',
    defaultName: 'Accelerated Death Benefit (Living Benefits)',
    defaultDesc: 'Early tax-free benefit acceleration for Terminal, Chronic, or Critical illness diagnosis',
    costWeightPct: 5,
    eligibleCarriers: ['Mutual of Omaha', 'Corebridge Financial', 'Lincoln Financial', 'Pacific Life', 'Principal'],
    eligibleSubtypes: ['term_10', 'term_20', 'term_30', 'whole_standard', 'whole_paid_up', 'iul', 'vul', 'gul', 'key_person', 'buy_sell', 'exec_bonus', 'final_expense'],
    labelByTab: {
      other: {
        name: 'Accelerated Death Benefit',
        desc: 'Terminal illness acceleration included across Final Expense & Corporate policies; Chronic/Critical varies by state',
      },
    },
    carrierNote: {
      'Corebridge Financial': 'QoL Flex Term & IUL include Terminal, Chronic & Critical Living Benefits',
      'Mutual of Omaha': 'Living Promise Final Expense provides Terminal/Nursing Home acceleration',
    },
  },
  {
    key: 'rop',
    defaultName: 'Return of Premium (ROP) Rider',
    defaultDesc: 'Refunds 100% of base level term premiums tax-free at the end of the 20- or 30-year level period',
    costWeightPct: 9,
    // Strictly available on 20/30-Yr Term and only through carriers issuing ROP term riders
    eligibleCarriers: ['Mutual of Omaha', 'Corebridge Financial'],
    eligibleSubtypes: ['term_20', 'term_30'],
    carrierNote: {
      'Mutual of Omaha': 'Eligible on 20-Yr and 30-Yr Term Life Answers structures',
      'Corebridge Financial': 'Available on Select-a-Term 20/30-Yr structures (ROP endowment)',
    },
  },
  {
    key: 'guaranteed',
    defaultName: 'Guaranteed Insurability Rider (GIR)',
    defaultDesc: 'Option to purchase additional death benefit tranches at milestone ages/events without medical underwriting',
    costWeightPct: 5,
    eligibleCarriers: ['Mutual of Omaha', 'Corebridge Financial', 'Lincoln Financial', 'Principal'],
    eligibleSubtypes: ['term_20', 'term_30', 'whole_standard', 'whole_paid_up', 'iul', 'vul', 'buy_sell', 'exec_bonus'],
    carrierNote: {
      'Mutual of Omaha': 'Guaranteed Insurability / Term Conversion upgrade without new labs',
      'Principal': 'Benefit Increase / Executive Insurability Purchase Option available',
    },
  },
  {
    key: 'accidental',
    defaultName: 'Accidental Death Benefit (ADB)',
    defaultDesc: 'Adds supplemental lump-sum indemnity payout if death results directly from a qualifying accident',
    costWeightPct: 4,
    eligibleCarriers: ['Mutual of Omaha', 'Corebridge Financial', 'Lincoln Financial', 'Principal'],
    eligibleSubtypes: ['term_10', 'term_20', 'term_30', 'whole_standard', 'whole_paid_up', 'iul', 'final_expense'],
  },
  {
    key: 'pua_rider',
    defaultName: 'Paid-Up Additions (PUA) Rider',
    defaultDesc: 'Injects supplemental paid-up death benefit & front-loads guaranteed dividend compounding cash value',
    costWeightPct: 8,
    eligibleCarriers: ['Mutual of Omaha', 'Lincoln Financial', 'Principal'],
    eligibleSubtypes: ['whole_standard', 'whole_paid_up'],
  },
  {
    key: 'overloan',
    defaultName: 'Overloan Protection Rider',
    defaultDesc: 'Automatically locks policy from lapsing due to tax-free IRC § 7702 retirement income policy loans',
    costWeightPct: 4,
    // Strictly cash-value Universal/IUL/VUL & Sec 162 permanent funding — never Term, GUL, or Final Expense
    eligibleCarriers: ['Mutual of Omaha', 'Corebridge Financial', 'Lincoln Financial', 'Pacific Life', 'Principal'],
    eligibleSubtypes: ['iul', 'vul', 'exec_bonus'],
  },
  {
    key: 'business_key',
    defaultName: 'Change of Insured / Key-Person Rider',
    defaultDesc: 'Allows corporate policy ownership transfer or key-employee substitution without surrender penalties',
    costWeightPct: 5,
    eligibleCarriers: ['Corebridge Financial', 'Lincoln Financial', 'Pacific Life', 'Principal'],
    eligibleSubtypes: ['key_person', 'buy_sell', 'exec_bonus', 'iul', 'vul', 'gul'],
  },
];

export function getCompatibleLifeRiders(
  carrier: LifeCarrier,
  tab: LifeTabType,
  subtype: LifePolicySubtype
): Array<LifeRiderDefinition & { resolvedName: string; resolvedDesc: string; resolvedNote?: string }> {
  return LIFE_RIDER_CATALOG.filter(
    (r) => r.eligibleCarriers.includes(carrier) && r.eligibleSubtypes.includes(subtype)
  ).map((r) => {
    const tabOverride = r.labelByTab?.[tab];
    return {
      ...r,
      resolvedName: tabOverride?.name || r.defaultName,
      resolvedDesc: tabOverride?.desc || r.defaultDesc,
      resolvedNote: r.carrierNote?.[carrier],
    };
  });
}
