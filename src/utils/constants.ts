import { CarrierStatProfile, HealthCarrierInfo, StrategyPathConfig } from '../types';

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
  { id: 'oscar', name: 'Oscar Health', category: 'Silver CSR 94/87/73 & Bronze Copay', note: 'Top Rate in Stuart / Martin County' },
  { id: 'fl_blue', name: 'Florida Blue (BlueCross)', category: 'Silver Essential / Gold Preferred PPO', note: 'Largest Local Hospital Network' },
  { id: 'ambetter', name: 'Ambetter Sunshine Health', category: 'Bronze HDHP & Balanced Care Silver', note: 'Lowest Out-of-Pocket Premiums' },
  { id: 'fhcp', name: 'Florida Health Care Plans (FHCP)', category: 'Standard Silver (70% AV) & Gold Copay', note: 'Top Value HMO & Integrated DPC' },
  { id: 'aetna', name: 'Aetna CVS Health', category: 'Gold Copay & Silver CarePass', note: 'Best MinuteClinic & Retail Value' },
  { id: 'uhc', name: 'UnitedHealthcare ACA Marketplace', category: 'Choice Silver & Essential Bronze', note: 'Extensive Regional Doctor Network' },
];

export const ALL_PATHS: StrategyPathConfig[] = [
  { id: 'atlasbridge', category: 'health', label: 'ACA + Atlasbridge System', icon: 'fa-bridge', color: 'blue', desc: 'Fiduciary ACA optimization + pre-tax wealth accumulation & local DPC access.' },
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
