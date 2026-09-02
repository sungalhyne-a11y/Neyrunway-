/**
 * NEYRUNWAY — Feature Flag Architecture
 * Clean decoupling of Core Free MVP features from prospective PRO capabilities.
 */

export type FeatureKey =
  | 'core_runway_calculator'
  | 'safe_to_spend_engine'
  | 'ask_ney_ai'
  | 'decision_simulator'
  | 'money_memory'
  | 'multilingual_support'
  | 'offline_persistence'
  | 'cloud_firestore_sync'
  | 'multi_bank_open_banking'
  | 'advanced_tax_simulator'
  | 'export_accountant_reports'
  | 'multi_currency_portfolio';

export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  description: string;
  tier: 'free' | 'pro';
  enabled: boolean;
}

export const APP_FEATURES: Record<FeatureKey, FeatureDefinition> = {
  core_runway_calculator: {
    key: 'core_runway_calculator',
    name: 'Runway Calculator',
    description: 'Deterministic day-by-day financial autonomy calculation.',
    tier: 'free',
    enabled: true,
  },
  safe_to_spend_engine: {
    key: 'safe_to_spend_engine',
    name: 'Safe-to-Spend Engine',
    description: 'Dynamic daily safe discretionary spending allowance.',
    tier: 'free',
    enabled: true,
  },
  ask_ney_ai: {
    key: 'ask_ney_ai',
    name: 'Ask Ney AI Copilot',
    description: 'Conversational decision assistance powered by Gemini 3.7 Flash.',
    tier: 'free',
    enabled: true,
  },
  decision_simulator: {
    key: 'decision_simulator',
    name: 'Decision Simulator',
    description: 'Instant before/after impact simulation on runway and daily safe spend.',
    tier: 'free',
    enabled: true,
  },
  money_memory: {
    key: 'money_memory',
    name: 'Money Memory',
    description: 'Frictionless logging of expenses, recurring bills, and income events.',
    tier: 'free',
    enabled: true,
  },
  multilingual_support: {
    key: 'multilingual_support',
    name: 'Multilingual Support',
    description: 'Native English, French, Spanish, Portuguese, and Hindi localization.',
    tier: 'free',
    enabled: true,
  },
  offline_persistence: {
    key: 'offline_persistence',
    name: 'Offline Persistence',
    description: 'Deterministic offline calculation with automatic cloud sync.',
    tier: 'free',
    enabled: true,
  },
  cloud_firestore_sync: {
    key: 'cloud_firestore_sync',
    name: 'Cloud Firestore Sync',
    description: 'Secure, per-user authenticated cloud storage in production mode.',
    tier: 'free',
    enabled: true,
  },
  multi_bank_open_banking: {
    key: 'multi_bank_open_banking',
    name: 'Direct Bank Sync (Open Banking)',
    description: 'Live banking API connection to automate transaction imports.',
    tier: 'pro',
    enabled: false,
  },
  advanced_tax_simulator: {
    key: 'advanced_tax_simulator',
    name: 'Advanced Tax & Grant Simulator',
    description: 'International student tax brackets and cross-border grant optimization.',
    tier: 'pro',
    enabled: false,
  },
  export_accountant_reports: {
    key: 'export_accountant_reports',
    name: 'Accountant PDF/CSV Reports',
    description: 'Certified PDF export for scholarship renewals or loan applications.',
    tier: 'pro',
    enabled: false,
  },
  multi_currency_portfolio: {
    key: 'multi_currency_portfolio',
    name: 'Multi-Currency Hedging',
    description: 'Real-time FX rates for international students managing dual accounts.',
    tier: 'pro',
    enabled: false,
  },
};

export const isFeatureEnabled = (key: FeatureKey, isProUser = false): boolean => {
  const feat = APP_FEATURES[key];
  if (!feat) return false;
  if (feat.tier === 'free') return feat.enabled;
  return isProUser && feat.enabled;
};
