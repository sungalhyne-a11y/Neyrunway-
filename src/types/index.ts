export type SupportedLanguage = 'fr' | 'en' | 'es' | 'pt' | 'hi';
export type SupportedCurrency = 'EUR' | 'USD' | 'CAD' | 'GBP' | 'CHF' | 'BRL' | 'INR';
export type SupportedRegion = 'FR' | 'US' | 'CA' | 'GB' | 'BE' | 'CH' | 'ES' | 'BR' | 'IN';

export interface SecondaryAuthSettings {
  enabled: boolean;
  method: 'pin' | 'biometric' | 'both';
  pinHash?: string | null;
  pinSalt?: string | null;
  pinLength?: number;
  biometricsEnrolled: boolean;
  biometricCredentialId?: string | null;
  requireForSensitiveViews: boolean;
  autoLockMinutes: number; // 0 = immediate, 5, 15, 30, -1 = never
  lastUnlockedTimestamp?: number;
}

export interface UserProfile {
  userId: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  preferredLanguage: SupportedLanguage;
  region: SupportedRegion;
  currency: SupportedCurrency;
  initialBalance: number;
  monthlyFixedExpenses?: number;
  monthlyBudgetGoal?: number;
  estimatedMonthlyIncome?: number;
  secondaryAuth?: SecondaryAuthSettings;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'fixed' | 'variable' | 'recurring';
export type TransactionCategory = 
  | 'housing' 
  | 'food' 
  | 'subscriptions' 
  | 'transport' 
  | 'education' 
  | 'leisure' 
  | 'shopping' 
  | 'other'
  | string;

export interface CategoryBudget {
  id: string;
  userId: string;
  categoryKey: string;
  name: string;
  monthlyLimit: number;
  color?: 'lime' | 'cyan' | 'purple' | 'amber' | 'rose' | 'emerald' | 'blue' | string;
  icon?: string;
  isCustom?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CategorySpendingSummary {
  categoryKey: string;
  name: string;
  monthlyLimit: number;
  currentSpent: number;
  percentageUsed: number;
  isExceeded: boolean;
  excessAmount: number;
  remainingAmount: number;
  color?: string;
  icon?: string;
  isCustom?: boolean;
}

export type UncertaintyLevel = 'confirmed' | 'detected' | 'estimated' | 'to_verify';
export type MemorySource = 'user_added' | 'detected_pattern' | 'recurring_forecast' | 'external_grant';

export interface MemoryTrace {
  signal: string;
  memoryItem: {
    title: string;
    amount?: number;
    status: UncertaintyLevel;
    statusLabel: string;
    source: string;
    usedFor: string[];
  };
  reasoning: string;
  impact: string;
  recommendation: string;
  uncertaintyLevel: UncertaintyLevel;
  uncertaintyLabel: string;
}

export interface Transaction {
  id: string;
  userId: string;
  title: string;
  amount: number;
  category: TransactionCategory;
  customCategoryName?: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  status: 'settled' | 'pending' | 'recurring_active';
  isRecurring?: boolean;
  isDisabledInRunway?: boolean;
  memoryStatus?: UncertaintyLevel;
  memorySource?: MemorySource;
  createdAt: string;
}

export type IncomeType = 'grant' | 'job' | 'family' | 'freelance' | 'loan' | 'other';
export type IncomeStatus = 'confirmed' | 'estimated' | 'received';

export interface IncomeEvent {
  id: string;
  userId: string;
  source: string;
  amount: number;
  expectedDate: string; // YYYY-MM-DD
  type: IncomeType;
  status: IncomeStatus;
  isRecurringMonthly?: boolean;
  createdAt: string;
}

export interface ComputedRunway {
  runwayDays: number;
  safeToSpendToday: number;
  projectedBurnPerDay: number;
  currentBalance: number;
  daysUntilNextIncome: number;
  nextIncomeAmount: number;
  nextIncomeDate?: string;
  nextIncomeSource?: string;
  totalFixedExpenses: number;
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category: 'emergency' | 'trip' | 'equipment' | 'tuition' | 'budget' | 'other';
  status?: 'active' | 'completed';
  createdAt: string;
}

export type ResourceCategory = 'aid' | 'grant' | 'food' | 'transport' | 'emergency' | 'discount';

export interface StudentResource {
  id: string;
  region: SupportedRegion;
  title: string;
  description: string;
  category: ResourceCategory;
  provider: string;
  estimatedValue?: string;
  url?: string;
  eligibility?: string;
  tags: string[];
}

export interface ClarificationAspect {
  label: string;
  description: string;
  example: string;
  suggestedPrompt?: string;
}

export interface ClarificationQuickAction {
  label: string;
  prompt: string;
  iconType?: 'amount' | 'recurring' | 'category' | 'goal' | 'help';
}

export interface ClarificationPrompt {
  title: string;
  reason?: string;
  suggestedAspects?: ClarificationAspect[];
  quickActions?: ClarificationQuickAction[];
}

export interface FollowUpOption {
  label: string;
  prompt: string;
  type?: 'scenario' | 'question' | 'alternative' | 'action';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ney';
  content: string;
  timestamp: string;
  confidence?: 'high' | 'medium' | 'low';
  clarification?: ClarificationPrompt;
  followUpOptions?: FollowUpOption[];
  simulation?: {
    expenseTitle?: string;
    expenseAmount?: number;
    daysBefore: number;
    daysAfter: number;
    adviceText: string;
  };
}

export interface ChatThread {
  id: string;
  userId: string;
  messages: ChatMessage[];
  updatedAt: string;
}

export type AppRoute = 'onboarding' | 'dashboard' | 'chat' | 'transactions' | 'goals' | 'resources' | 'settings';

export type ToastType = 'budget_warning' | 'warning' | 'info' | 'success' | 'danger';

export interface BudgetWarningData {
  currentSpending: number;
  monthlyBudgetGoal: number;
  excessAmount: number;
  percentageUsed: number;
  currency?: SupportedCurrency;
  categoryName?: string;
  recentTransactionTitle?: string;
  recentTransactionAmount?: number;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  data?: BudgetWarningData;
  duration?: number; // ms, default e.g. 8000
  actionLabel?: string;
  onAction?: () => void;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  createdAt?: number;
}

export type MemoryDimension = 'commitments' | 'income' | 'habits' | 'goals';

export interface CandidatePatternSuggestion {
  id: string;
  transactionId: string;
  title: string;
  amount: number;
  category: TransactionCategory;
  detectedPattern: 'recurring_subscription' | 'repeated_habit' | 'high_frequency';
  message: string;
  suggestedAction: 'mark_recurring' | 'adjust_category' | 'create_goal';
  status: 'pending' | 'confirmed' | 'dismissed';
  confidence?: number;
}

export interface FinancialOpportunityMatch {
  signalType: 'high_transport' | 'high_housing' | 'food_budget_pressure' | 'low_runway_relief' | 'general_grant';
  signalDescription: string;
  resourceId: string;
  resourceTitle: string;
  provider: string;
  category: ResourceCategory;
  potentialImpact: string;
  explanationWhy: string;
  estimatedMonthlyGain?: number;
  url?: string;
  prudenceNotice: string;
}

export interface LongitudinalMemorySummary {
  commitments: {
    count: number;
    monthlyTotal: number;
    items: Transaction[];
    nextCommitment?: {
      title: string;
      amount: number;
      date?: string;
    };
  };
  income: {
    count: number;
    monthlyProjected: number;
    events: IncomeEvent[];
    nextIncome?: {
      source: string;
      amount: number;
      date?: string;
      daysRemaining: number;
    };
  };
  habits: {
    totalVariableSpentThisMonth: number;
    topExpenseCategory: string;
    topExpenseAmount: number;
    mostFrequentTitle?: string;
    transportSpendThisMonth: number;
    transportBaselineAvg: number;
    transportShiftPercent: number;
    foodSpendThisMonth: number;
    dailyVariablePace: number;
    habitInsight: string;
  };
  goals: {
    count: number;
    totalTarget: number;
    totalCurrent: number;
    items: Goal[];
  };
  candidateSuggestions: CandidatePatternSuggestion[];
  opportunity?: FinancialOpportunityMatch;
  moatSignalsCount: number;
  lifeEvents?: StudentLifeEvent[];
}

export type LifeEventType = 
  | 'semester_start' // Rentrée universitaire
  | 'trip' // Voyage / Week-end chez les parents
  | 'relocation' // Déménagement / Logement
  | 'holidays' // Vacances / Période de stage
  | 'new_term' // Nouveau semestre / Nouveaux cours
  | 'rent_due' // Loyer mensuel
  | 'grant_payout' // Bourse & Aides publiques
  | 'income_inflow'; // Rentrée d'argent / Job étudiant

export interface StudentLifeEvent {
  id: string;
  type: LifeEventType;
  title: string;
  dateOrPeriod: string;
  impactDescription: string;
  financialImpactDays?: number;
  estimatedAmount?: number;
  status: 'upcoming' | 'ongoing' | 'completed';
  suggestedPrompt: string;
}

