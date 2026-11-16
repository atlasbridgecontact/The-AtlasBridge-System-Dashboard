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

export type HealthCarrierId = 'oscar' | 'fl_blue' | 'ambetter' | 'fhcp' | 'molina' | 'uhc';
export type PrivateHealthCarrierId = 'cigna_ppo' | 'uhc_ppo' | 'multiplan_ppo' | 'aetna_ppo';
export type PrivatePpoTierId = 'preferred' | 'choice' | 'executive';

export type LifeTabType = 'term' | 'whole' | 'universal' | 'other';

export type LifePolicySubtype =
  | 'term_10'
  | 'term_20'
  | 'term_30'
  | 'whole_standard'
  | 'whole_paid_up'
  | 'iul'
  | 'vul'
  | 'gul'
  | 'key_person'
  | 'buy_sell'
  | 'exec_bonus'
  | 'final_expense';

export type LifeRiderKey =
  | 'waiver'
  | 'adb'
  | 'rop'
  | 'guaranteed'
  | 'accidental'
  | 'pua_rider'
  | 'overloan'
  | 'business_key';

export interface LifeRiderDefinition {
  key: LifeRiderKey;
  defaultName: string;
  defaultDesc: string;
  costWeightPct: number;
  eligibleCarriers: LifeCarrier[];
  eligibleSubtypes: LifePolicySubtype[];
  labelByTab?: Partial<Record<LifeTabType, { name: string; desc: string }>>;
  carrierNote?: Partial<Record<LifeCarrier, string>>;
}

export type AcaMetalTier = 'bronze' | 'silver' | 'gold';
export type UtilizationScenarioId = 'low' | 'moderate' | 'catastrophic';

export type SettlementPolicyType = 'universal_life' | 'whole_life' | 'convertible_term' | 'iul';
export type SettlementHealthRating = 'standard' | 'mild_change' | 'impaired' | 'severe';
export type RolloverTransferMode = 'qualified_rollover' | 'exchange_1035';
export type SelfEmployedEntityBasis = 'schedule_c' | 'scorp';

export type StrategyPathId =
  | 'atlasbridge'
  | 'self_employed_aca'
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
  zipCode: string;
  householdSize: number;
  grossAGI: number;
  liquidSavings: number;
  healthStatus: HealthStatus;
  isSelfEmployed?: boolean;
  netSelfEmploymentProfit?: number;
  spouseCoveredByPlan?: boolean;
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

export interface CarrierNetworkInfo<T extends string = string> {
  id: T;
  name: string;
  category: string;
  note: string;
  directoryUrl: string;
  networkSearchHint: string;
  carrierQueries?: string[];
}

export type HealthCarrierInfo = CarrierNetworkInfo<HealthCarrierId>;

export interface PrivateCarrierInfo extends CarrierNetworkInfo<PrivateHealthCarrierId> {
  rateFactor: number;
  networkType: string;
  networkStrength: string;
}

export interface StrategyPathConfig {
  id: StrategyPathId;
  category: PrimaryCategory;
  label: string;
  icon: string;
  color: 'blue' | 'emerald' | 'gold' | 'cyan' | 'purple' | 'red' | 'indigo' | 'silver';
  desc: string;
}

export interface ActiveStrategySnapshot {
  pathId: StrategyPathId;
  pathLabel: string;
  summaryHeadline: string;
  selectedCarrierOrVendor?: string;
  selectedTierOrOption?: string;
  sliders: Array<{ label: string; value: string }>;
  impactMetrics: Array<{ label: string; value: string }>;
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
