export type PrimaryCategory =
  | 'health'
  | 'life'
  | 'annuities'
  | 'rollovers'
  | 'settlements'
  | 'unwanted_life';

export type TaxYear = '2026' | '2027' | '2028';
export type FilingStatus = 'single' | 'hoh' | 'married';
export type HealthStatus = 'healthy' | 'moderate' | 'high';
export type AcaWindowOption = 'auto' | 'open' | 'outside_no_sep' | 'outside_with_sep';

export type LifeCarrier =
  | 'Mutual of Omaha'
  | 'Corebridge Financial'
  | 'Lincoln Financial'
  | 'Pacific Life'
  | 'Principal';

export type HealthCarrierId = 'oscar' | 'fl_blue' | 'ambetter' | 'fhcp' | 'aetna' | 'uhc';

export type LifeTabType = 'term' | 'whole' | 'universal' | 'other';

export type StrategyPathId =
  | 'atlasbridge'
  | 'unwanted_life'
  | 'annuities'
  | 'rollovers'
  | 'traditional_aca'
  | 'private_health'
  | 'life'
  | 'group'
  | 'settlements';

export interface ClientData {
  taxYear: TaxYear;
  tobacco: 'no' | 'yes';
  filingStatus: FilingStatus;
  clientAge: number;
  dependents: number;
  preExisting: 'no' | 'yes';
  acaWindow: AcaWindowOption;
  selectedHealthCarrier: HealthCarrierId;
  householdSize: number;
  grossAGI: number;
  liquidSavings: number;
  healthStatus: HealthStatus;
  ownsBusiness: boolean;
  w2Employees: number;
  employerGroup: 'no' | 'yes_affordable' | 'yes_unaffordable';
  active401k: boolean | 'neither' | 'client_only' | 'spouse_only' | 'both';
  hasTraditionalIraAnnuity: boolean;
  annuityType: 'none' | 'no' | 'yes' | 'neither' | 'client_only' | 'spouse_only' | 'both' | 'fia' | 'spia' | 'spda' | 'fpa' | 'va';
  annuityAnnualContribution: number;
  dormantRetirement: number;
  spouseDormantRetirement?: number;
  existingAnnuityCash: number;
  spouseExistingAnnuityCash?: number;
  spouseAge?: number;
  lifePolicyStatus: 'no' | 'perm_unwanted' | 'perm_wanted' | 'term';
  fpl100: number;
  fplPct: number;
  policyGrossValue: number;
  policyCostBasis: number;
  policyLoans: number;
  policySurrenderCharges: number;
  policyMonthlyPremium: number;
}

export interface CarrierStatProfile {
  termPrem: number;
  termLiving: string;
  iulPrem: number;
  iulCash: number;
  wholePrem: number;
  wholeGuarantee: string;
}

export interface HealthCarrierInfo {
  id: HealthCarrierId;
  name: string;
  category: string;
  note: string;
}

export interface StrategyPathConfig {
  id: StrategyPathId;
  category: PrimaryCategory;
  label: string;
  icon: string;
  color: 'blue' | 'emerald' | 'gold' | 'cyan' | 'purple' | 'red' | 'indigo' | 'silver';
  desc: string;
}

export interface BookingFormData {
  fullName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  location: string;
  cmsConsent: boolean;
}
