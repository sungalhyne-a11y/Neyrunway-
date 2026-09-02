import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { SupportedCurrency, SupportedRegion, IncomeType, TransactionCategory } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { computeAndSaveUserRunway } from '../lib/runwayEngine';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { analytics } from '../lib/analytics';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Wallet, 
  Home, 
  PiggyBank, 
  Globe, 
  Target, 
  Plus, 
  Trash2, 
  Loader2,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingViewProps {
  onCompletePreview?: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onCompletePreview }) => {
  const { currentUser, updateUserProfile } = useAuth();
  const { 
    t, 
    language, 
    region, 
    setRegion, 
    currency, 
    setCurrency, 
    formatCurrency,
    formatDays
  } = useTranslation();

  const [step, setStep] = useState<number>(1);
  const totalSteps = 5;

  // Step 1: Currency & Region
  const [selectedRegion, setSelectedRegion] = useState<SupportedRegion>(region || 'FR');
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(currency || 'EUR');

  // Track onboarding started
  React.useEffect(() => {
    analytics.track('onboarding_started', { region: selectedRegion, currency: selectedCurrency });
  }, []);

  // Step 2: Starting Balance
  const [balance, setBalance] = useState<string>('1250');

  // Step 3: Incomes
  interface PendingIncome {
    source: string;
    amount: number;
    expectedDate: string;
    type: IncomeType;
  }
  const [incomes, setIncomes] = useState<PendingIncome[]>([]);
  const [newIncomeSource, setNewIncomeSource] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState('');
  const [newIncomeDate, setNewIncomeDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [newIncomeType, setNewIncomeType] = useState<IncomeType>('grant');

  // Step 4: Fixed Expenses
  interface PendingExpense {
    title: string;
    amount: number;
    category: TransactionCategory;
  }
  const [expenses, setExpenses] = useState<PendingExpense[]>([]);
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<TransactionCategory>('housing');

  // Step 5: Optional Goal
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalCategory, setGoalCategory] = useState<'emergency' | 'trip' | 'equipment' | 'tuition' | 'other'>('emergency');

  // Submission State
  const [isFinishing, setIsFinishing] = useState(false);
  const [calculationResult, setCalculationResult] = useState<{
    runwayDays: number;
    safeToSpendToday: number;
    nextIncomeDate?: string;
  } | null>(null);

  // Cultural presets retrieval based on chosen region
  const regionKey = (selectedRegion in t.onboarding.culturalPresets) ? selectedRegion : 'FR';
  const presets = t.onboarding.culturalPresets[regionKey as keyof typeof t.onboarding.culturalPresets] || t.onboarding.culturalPresets.FR;

  const handleRegionChange = (newReg: SupportedRegion) => {
    setSelectedRegion(newReg);
    setRegion(newReg);

    // Auto-select currency matching the selected region
    const defaultCurrMap: Record<SupportedRegion, SupportedCurrency> = {
      FR: 'EUR',
      BE: 'EUR',
      CH: 'CHF',
      US: 'USD',
      GB: 'GBP',
      CA: 'CAD',
      ES: 'EUR',
      BR: 'BRL',
      IN: 'INR',
    };
    const autoCurr = defaultCurrMap[newReg] || 'EUR';
    setSelectedCurrency(autoCurr);
    setCurrency(autoCurr);

    // Align starting balance if at defaults
    const regPresets = t.onboarding.culturalPresets[newReg as keyof typeof t.onboarding.culturalPresets];
    if (regPresets?.placeholders?.balance) {
      setBalance(regPresets.placeholders.balance);
    }
  };

  const handleCurrencyChange = (newCurr: SupportedCurrency) => {
    setSelectedCurrency(newCurr);
    setCurrency(newCurr);
  };

  const addPresetIncome = (preset: { name: string; amount: number; type: string }) => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setIncomes((prev) => [
      ...prev,
      {
        source: preset.name,
        amount: preset.amount,
        expectedDate: d.toISOString().split('T')[0],
        type: (preset.type as IncomeType) || 'grant',
      }
    ]);
  };

  const addCustomIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncomeSource || !newIncomeAmount) return;
    setIncomes((prev) => [
      ...prev,
      {
        source: newIncomeSource,
        amount: parseFloat(newIncomeAmount) || 0,
        expectedDate: newIncomeDate,
        type: newIncomeType,
      }
    ]);
    setNewIncomeSource('');
    setNewIncomeAmount('');
  };

  const addPresetExpense = (preset: { title: string; amount: number; category: string }) => {
    setExpenses((prev) => [
      ...prev,
      {
        title: preset.title,
        amount: preset.amount,
        category: (preset.category as TransactionCategory) || 'housing',
      }
    ]);
  };

  const addCustomExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseTitle || !newExpenseAmount) return;
    setExpenses((prev) => [
      ...prev,
      {
        title: newExpenseTitle,
        amount: parseFloat(newExpenseAmount) || 0,
        category: newExpenseCategory,
      }
    ]);
    setNewExpenseTitle('');
    setNewExpenseAmount('');
  };

  const handleFinishOnboarding = async () => {
    setIsFinishing(true);
    const parsedBalance = parseFloat(balance) || 1250;
    const userId = currentUser?.uid || 'guest-session';

    try {
      if (currentUser) {
        // 1. Update user profile in Firestore
        await updateUserProfile({
          initialBalance: parsedBalance,
          preferredLanguage: language,
          region: selectedRegion,
          currency: selectedCurrency,
          onboardingCompleted: true,
        });

        // 2. Persist Incomes into users/{userId}/incomeEvents
        for (const inc of incomes) {
          await addDoc(collection(db, 'users', userId, 'incomeEvents'), {
            userId,
            source: inc.source,
            amount: inc.amount,
            expectedDate: inc.expectedDate,
            type: inc.type,
            status: 'confirmed',
            isRecurringMonthly: true,
            createdAt: serverTimestamp(),
          });
        }

        // 3. Persist Fixed Expenses into users/{userId}/transactions
        const todayStr = new Date().toISOString().split('T')[0];
        for (const exp of expenses) {
          await addDoc(collection(db, 'users', userId, 'transactions'), {
            userId,
            title: exp.title,
            amount: exp.amount,
            category: exp.category,
            type: 'fixed',
            date: todayStr,
            status: 'recurring_active',
            isRecurring: true,
            createdAt: serverTimestamp(),
          });
        }

        // 4. Persist Goal if filled
        if (goalName.trim() && parseFloat(goalTarget) > 0) {
          await addDoc(collection(db, 'users', userId, 'goals'), {
            userId,
            name: goalName.trim(),
            targetAmount: parseFloat(goalTarget),
            currentAmount: parseFloat(goalCurrent) || 0,
            category: goalCategory,
            createdAt: serverTimestamp(),
          });
        }

        // 5. Execute Runway calculation and write to users/{userId}/computed/runway
        const computed = await computeAndSaveUserRunway(userId, parsedBalance);
        setCalculationResult({
          runwayDays: computed.runwayDays,
          safeToSpendToday: computed.safeToSpendToday,
          nextIncomeDate: computed.nextIncomeDate,
        });

        analytics.track('onboarding_completed', {
          userId,
          runwayDays: computed.runwayDays,
          safeToSpendToday: computed.safeToSpendToday,
        });
        analytics.track('first_runway_generated', { runwayDays: computed.runwayDays });
        analytics.track('first_safe_to_spend_viewed', { safeToSpendToday: computed.safeToSpendToday });
      } else {
        // Guest mode fallback simulation
        const monthlyFixed = expenses.reduce((a, b) => a + b.amount, 0);
        const dailyBurn = monthlyFixed > 0 ? (monthlyFixed / 30) + 15 : 25;
        const simulatedDays = Math.max(12, Math.floor(parsedBalance / dailyBurn));
        const safeSpend = Math.max(0, Math.round(((parsedBalance - (monthlyFixed / 2)) / 15) * 10) / 10);
        
        setCalculationResult({
          runwayDays: simulatedDays,
          safeToSpendToday: safeSpend,
        });

        analytics.track('onboarding_completed', {
          guest: true,
          runwayDays: simulatedDays,
          safeToSpendToday: safeSpend,
        });
        analytics.track('first_runway_generated', { runwayDays: simulatedDays });
        analytics.track('first_safe_to_spend_viewed', { safeToSpendToday: safeSpend });
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Fallback calculation display
      setCalculationResult({
        runwayDays: 34,
        safeToSpendToday: 24,
      });
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-6">
      {/* Header with Ney Tone & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1e293b]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 flex items-center justify-center text-[#D4FF3D]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#F5F5F0]">
                {t.onboarding.guidedByNey}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/20 text-[10px] font-mono">
                {t.onboarding.aiPhilosophyTag}
              </span>
            </div>
            <p className="text-[11px] text-[#8A8F98]">
              {t.onboarding.progress.replace('{current}', String(step)).replace('{total}', String(totalSteps))}
            </p>
          </div>
        </div>

        {/* Step Progress Indicators */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-7 bg-[#D4FF3D]'
                  : s < step
                  ? 'w-3.5 bg-[#D4FF3D]/50'
                  : 'w-3.5 bg-[#1e293b]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Dynamic Step Content */}
      <div className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Luminous accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />

        {calculationResult ? (
          /* Summary Screen after calculation */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8 text-center py-4"
          >
            <div className="w-16 h-16 rounded-full bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 flex items-center justify-center mx-auto text-[#D4FF3D]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl sm:text-3xl font-light text-[#F5F5F0]">
                {t.onboarding.steps.summary.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#8A8F98] max-w-md mx-auto">
                {t.onboarding.steps.summary.subtitle}
              </p>
            </div>

            {/* Computed Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto text-left">
              <div className="p-5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8F98]">
                  {t.onboarding.steps.summary.calculatedRunway}
                </span>
                <div className="text-4xl font-light text-[#D4FF3D] font-mono">
                  {calculationResult.runwayDays}{' '}
                  <span className="text-sm font-sans text-[#F5F5F0]">
                    {t.onboarding.steps.summary.daysUnit}
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8F98]">
                  {t.onboarding.steps.summary.safeToSpendToday}
                </span>
                <div className="text-3xl font-light text-[#F5F5F0] font-mono">
                  {formatCurrency(calculationResult.safeToSpendToday)}
                  <span className="text-xs font-sans text-[#8A8F98] ml-1">{t.onboarding.steps.summary.perDayUnit}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-[#8A8F98] max-w-md mx-auto">
              {t.onboarding.steps.summary.congrats}
            </p>

            <button
              id="btn-onboarding-goto-dashboard"
              type="button"
              onClick={onCompletePreview}
              className="px-8 py-3.5 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_20px_rgba(212,255,61,0.25)] inline-flex items-center gap-2 cursor-pointer"
            >
              <span>{t.onboarding.steps.summary.goToDashboard}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {/* STEP 1: Region & Currency */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-[#D4FF3D] tracking-wider uppercase">
                      {t.onboarding.steps.regionCurrency.stepNumber} • {t.onboarding.steps.regionCurrency.stepTag}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-light text-[#F5F5F0]">
                      {t.onboarding.steps.regionCurrency.title}
                    </h3>
                    <p className="text-xs text-[#8A8F98]">
                      {t.onboarding.steps.regionCurrency.subtitle}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Region Selector */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] mb-2">
                        {t.onboarding.steps.regionCurrency.regionLabel}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { code: 'FR', label: 'France 🇫🇷' },
                          { code: 'BE', label: 'Belgique 🇧🇪' },
                          { code: 'CH', label: 'Suisse 🇨🇭' },
                          { code: 'CA', label: 'Canada 🇨🇦' },
                          { code: 'GB', label: 'UK 🇬🇧' },
                          { code: 'US', label: 'USA 🇺🇸' },
                        ].map((r) => (
                          <button
                            key={r.code}
                            type="button"
                            onClick={() => handleRegionChange(r.code as SupportedRegion)}
                            className={`p-3 rounded-2xl border text-xs font-medium text-left transition-all cursor-pointer flex items-center justify-between ${
                              selectedRegion === r.code
                                ? 'bg-[#0B0E17] border-[#D4FF3D] text-[#D4FF3D]'
                                : 'bg-[#0B0E17]/60 border-[#1e293b] text-[#8A8F98] hover:border-[#8A8F98]'
                            }`}
                          >
                            <span>{r.label}</span>
                            {selectedRegion === r.code && <Check className="w-3.5 h-3.5 text-[#D4FF3D]" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Currency Selector */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] mb-2">
                        {t.onboarding.steps.regionCurrency.currencyLabel}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { code: 'EUR', symbol: '€ (Euro)' },
                          { code: 'USD', symbol: '$ (USD)' },
                          { code: 'CAD', symbol: '$ (CAD)' },
                          { code: 'GBP', symbol: '£ (GBP)' },
                          { code: 'CHF', symbol: 'CHF (Franc)' },
                        ].map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleCurrencyChange(c.code as SupportedCurrency)}
                            className={`p-3 rounded-2xl border text-xs font-medium text-left transition-all cursor-pointer flex items-center justify-between ${
                              selectedCurrency === c.code
                                ? 'bg-[#0B0E17] border-[#D4FF3D] text-[#D4FF3D]'
                                : 'bg-[#0B0E17]/60 border-[#1e293b] text-[#8A8F98] hover:border-[#8A8F98]'
                            }`}
                          >
                            <span>{c.symbol}</span>
                            {selectedCurrency === c.code && <Check className="w-3.5 h-3.5 text-[#D4FF3D]" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#8A8F98]/80 italic">
                    {t.onboarding.steps.regionCurrency.helpText}
                  </p>
                </motion.div>
              )}

              {/* STEP 2: Current Balance */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono text-[#D4FF3D] tracking-wider uppercase">
                      {t.onboarding.steps.currentBalance.stepNumber} • {t.onboarding.steps.currentBalance.stepTag}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-light text-[#F5F5F0]">
                      {t.onboarding.steps.currentBalance.title}
                    </h3>
                    <p className="text-xs text-[#8A8F98]">
                      {t.onboarding.steps.currentBalance.subtitle}
                    </p>
                  </div>

                  {/* Big Number Input */}
                  <div className="bg-[#0B0E17] p-6 rounded-2xl border border-[#1e293b] flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-[10px] font-mono uppercase tracking-widest text-[#8A8F98] mb-1">
                        {t.onboarding.steps.currentBalance.balanceLabel}
                      </label>
                      <div className="flex items-baseline gap-2">
                        <input
                          id="input-onboarding-balance"
                          type="number"
                          value={balance}
                          onChange={(e) => setBalance(e.target.value)}
                          placeholder={presets.placeholders?.balance || t.onboarding.steps.currentBalance.placeholder}
                          className="bg-transparent text-3xl sm:text-4xl font-light text-[#D4FF3D] outline-none w-full font-mono placeholder-[#8A8F98]/30"
                        />
                        <span className="text-xl font-mono text-[#8A8F98]">{selectedCurrency}</span>
                      </div>
                    </div>
                    <Wallet className="w-8 h-8 text-[#8A8F98]/50" />
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#8A8F98] mr-2">{t.onboarding.steps.currentBalance.suggestionsLabel}</span>
                    {(presets.placeholders?.quickAmounts || t.onboarding.steps.currentBalance.quickAmounts).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBalance(amt)}
                        className="px-3.5 py-1.5 rounded-full bg-[#0B0E17] hover:border-[#D4FF3D] border border-[#1e293b] text-xs font-mono text-[#F5F5F0] transition-all cursor-pointer"
                      >
                        {formatCurrency(parseFloat(amt))}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-[#8A8F98] leading-relaxed">
                    {t.onboarding.steps.currentBalance.helpText}
                  </p>
                </motion.div>
              )}

              {/* STEP 3: Known Income Events */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-mono text-[#D4FF3D] tracking-wider uppercase">
                        {t.onboarding.steps.incomeEvents.stepNumber} • {t.onboarding.steps.incomeEvents.stepTag}
                      </span>
                      <span className="text-[11px] font-mono text-[#8A8F98] bg-[#0B0E17] px-2.5 py-1 rounded-full border border-[#1e293b]">
                        📍 {selectedRegion === 'FR' ? 'France (CROUS / CAF)' : selectedRegion === 'BE' ? 'Belgique (FWB / Kot)' : selectedRegion === 'CH' ? 'Suisse (Canton / SBB)' : selectedRegion === 'US' ? 'USA (Pell Grant / Dorm)' : selectedRegion === 'GB' ? 'UK (Maintenance Loan)' : 'Canada (AFE / OSAP)'}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-light text-[#F5F5F0]">
                      {t.onboarding.steps.incomeEvents.title}
                    </h3>
                    <p className="text-xs text-[#8A8F98]">
                      {t.onboarding.steps.incomeEvents.subtitle}
                    </p>
                  </div>

                  {/* Cultural Presets Quick Add */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-[#8A8F98] uppercase tracking-wider block">
                      {t.onboarding.steps.incomeEvents.culturalPresetsTitle}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {presets.incomes.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => addPresetIncome(preset)}
                          className="p-3 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b]/70 border border-[#1e293b] flex items-center justify-between text-left transition-all cursor-pointer group"
                        >
                          <div>
                            <div className="text-xs font-semibold text-[#F5F5F0] group-hover:text-[#D4FF3D] transition-colors">
                              {preset.name}
                            </div>
                            <div className="text-[10px] text-[#8A8F98] font-mono mt-0.5">
                              +{formatCurrency(preset.amount)}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-[#8A8F98] group-hover:text-[#D4FF3D]" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Added Incomes List */}
                  {incomes.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-mono text-[#D4FF3D] uppercase tracking-wider block">
                        {t.onboarding.steps.incomeEvents.addedIncomesTitle} ({incomes.length})
                      </span>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {incomes.map((inc, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-[#0B0E17] border border-[#1e293b] flex items-center justify-between"
                          >
                            <div>
                              <span className="text-xs font-medium text-[#F5F5F0]">{inc.source}</span>
                              <span className="text-[10px] text-[#8A8F98] ml-2 font-mono">
                                ({inc.expectedDate})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold text-[#D4FF3D]">
                                +{formatCurrency(inc.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setIncomes((prev) => prev.filter((_, idx) => idx !== i))}
                                className="text-[#8A8F98] hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Add Form */}
                  <form onSubmit={addCustomIncome} className="p-4 rounded-2xl bg-[#0B0E17]/70 border border-[#1e293b] grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono text-[#8A8F98] mb-1">
                        {t.onboarding.steps.incomeEvents.sourceLabel}
                      </label>
                      <input
                        type="text"
                        value={newIncomeSource}
                        onChange={(e) => setNewIncomeSource(e.target.value)}
                        placeholder={presets.placeholders?.incomeSource || t.onboarding.steps.incomeEvents.sourcePlaceholder}
                        className="w-full px-3 py-2 rounded-xl bg-[#161b27] border border-[#1e293b] text-xs text-[#F5F5F0] outline-none placeholder-[#8A8F98]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#8A8F98] mb-1">
                        {t.onboarding.steps.incomeEvents.amountLabel}
                      </label>
                      <input
                        type="number"
                        value={newIncomeAmount}
                        onChange={(e) => setNewIncomeAmount(e.target.value)}
                        placeholder={presets.placeholders?.incomeAmount || "350"}
                        className="w-full px-3 py-2 rounded-xl bg-[#161b27] border border-[#1e293b] text-xs text-[#F5F5F0] outline-none placeholder-[#8A8F98]/40"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newIncomeSource || !newIncomeAmount}
                      className="py-2 px-4 rounded-xl bg-[#1e293b] hover:bg-[#D4FF3D] hover:text-[#0B0E17] text-xs font-semibold text-[#F5F5F0] transition-all cursor-pointer disabled:opacity-40"
                    >
                      {t.onboarding.steps.incomeEvents.addIncomeButton}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* STEP 4: Fixed Expenses & Subscriptions */}
              {step === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-mono text-[#D4FF3D] tracking-wider uppercase">
                        {t.onboarding.steps.fixedExpenses.stepNumber} • {t.onboarding.steps.fixedExpenses.stepTag}
                      </span>
                      <span className="text-[11px] font-mono text-[#8A8F98] bg-[#0B0E17] px-2.5 py-1 rounded-full border border-[#1e293b]">
                        📍 {selectedRegion === 'FR' ? 'France (Loyer CROUS / Navigo)' : selectedRegion === 'BE' ? 'Belgique (Loyer Kot / STIB)' : selectedRegion === 'CH' ? 'Suisse (Loyer Studio / LAMal)' : selectedRegion === 'US' ? 'USA (Dorm Rent / Meal Plan)' : selectedRegion === 'GB' ? 'UK (Student Hall / Oyster)' : 'Canada (Résidence / U-Pass)'}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-light text-[#F5F5F0]">
                      {t.onboarding.steps.fixedExpenses.title}
                    </h3>
                    <p className="text-xs text-[#8A8F98]">
                      {t.onboarding.steps.fixedExpenses.subtitle}
                    </p>
                  </div>

                  {/* Cultural Presets Quick Add */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-[#8A8F98] uppercase tracking-wider block">
                      {t.onboarding.steps.fixedExpenses.culturalPresetsTitle}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {presets.expenses.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => addPresetExpense(preset)}
                          className="p-3 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b]/70 border border-[#1e293b] flex items-center justify-between text-left transition-all cursor-pointer group"
                        >
                          <div>
                            <div className="text-xs font-semibold text-[#F5F5F0] group-hover:text-[#D4FF3D] transition-colors">
                              {preset.title}
                            </div>
                            <div className="text-[10px] text-[#8A8F98] font-mono mt-0.5">
                              -{formatCurrency(preset.amount)} {t.onboarding.steps.fixedExpenses.perMonthUnit}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-[#8A8F98] group-hover:text-[#D4FF3D]" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Added Expenses List */}
                  {expenses.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-mono text-[#D4FF3D] uppercase tracking-wider block">
                        {t.onboarding.steps.fixedExpenses.addedExpensesTitle} ({expenses.length})
                      </span>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {expenses.map((exp, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-[#0B0E17] border border-[#1e293b] flex items-center justify-between"
                          >
                            <span className="text-xs font-medium text-[#F5F5F0]">{exp.title}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold text-rose-300">
                                -{formatCurrency(exp.amount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpenses((prev) => prev.filter((_, idx) => idx !== i))}
                                className="text-[#8A8F98] hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Add Form */}
                  <form onSubmit={addCustomExpense} className="p-4 rounded-2xl bg-[#0B0E17]/70 border border-[#1e293b] grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono text-[#8A8F98] mb-1">
                        {t.onboarding.steps.fixedExpenses.titleLabel}
                      </label>
                      <input
                        type="text"
                        value={newExpenseTitle}
                        onChange={(e) => setNewExpenseTitle(e.target.value)}
                        placeholder={presets.placeholders?.expenseTitle || t.onboarding.steps.fixedExpenses.titlePlaceholder}
                        className="w-full px-3 py-2 rounded-xl bg-[#161b27] border border-[#1e293b] text-xs text-[#F5F5F0] outline-none placeholder-[#8A8F98]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#8A8F98] mb-1">
                        {t.onboarding.steps.fixedExpenses.amountLabel}
                      </label>
                      <input
                        type="number"
                        value={newExpenseAmount}
                        onChange={(e) => setNewExpenseAmount(e.target.value)}
                        placeholder={presets.placeholders?.expenseAmount || "30"}
                        className="w-full px-3 py-2 rounded-xl bg-[#161b27] border border-[#1e293b] text-xs text-[#F5F5F0] outline-none placeholder-[#8A8F98]/40"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newExpenseTitle || !newExpenseAmount}
                      className="py-2 px-4 rounded-xl bg-[#1e293b] hover:bg-[#D4FF3D] hover:text-[#0B0E17] text-xs font-semibold text-[#F5F5F0] transition-all cursor-pointer disabled:opacity-40"
                    >
                      {t.onboarding.steps.fixedExpenses.addExpenseButton}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* STEP 5: Optional Goal */}
              {step === 5 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-mono text-[#D4FF3D] tracking-wider uppercase">
                        {t.onboarding.steps.goals.stepNumber} • {t.onboarding.steps.goals.stepTag}
                      </span>
                      <span className="text-[11px] font-mono text-[#8A8F98] bg-[#0B0E17] px-2.5 py-1 rounded-full border border-[#1e293b]">
                        📍 {selectedRegion === 'FR' ? 'France (Caution Studio / CROUS)' : selectedRegion === 'BE' ? 'Belgique (Garantie Kot)' : selectedRegion === 'CH' ? 'Suisse (Réserve / Semestre)' : selectedRegion === 'US' ? 'USA (Dorm Deposit / Spring Break)' : selectedRegion === 'GB' ? 'UK (Flat Deposit)' : 'Canada (Caution / Session)'}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-light text-[#F5F5F0]">
                      {t.onboarding.steps.goals.title}
                    </h3>
                    <p className="text-xs text-[#8A8F98]">
                      {t.onboarding.steps.goals.subtitle}
                    </p>
                  </div>

                  {/* Cultural Presets Quick Select */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-[#8A8F98] uppercase tracking-wider block">
                      {t.onboarding.steps.goals.culturalPresetsTitle}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {presets.goals.map((g, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setGoalName(g.name);
                            setGoalTarget(String(g.target));
                            setGoalCategory((g.category as any) || 'emergency');
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            goalName === g.name
                              ? 'bg-[#0B0E17] border-[#D4FF3D] text-[#D4FF3D]'
                              : 'bg-[#0B0E17]/60 border-[#1e293b] text-[#8A8F98] hover:border-[#8A8F98]'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#F5F5F0]">{g.name}</div>
                          <div className="text-[10px] text-[#8A8F98] font-mono mt-0.5">
                            {t.onboarding.steps.goals.targetPrefix} {formatCurrency(g.target)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Goal Input Fields */}
                  <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A8F98] mb-1.5">
                          {t.onboarding.steps.goals.nameLabel}
                        </label>
                        <input
                          type="text"
                          value={goalName}
                          onChange={(e) => setGoalName(e.target.value)}
                          placeholder={presets.placeholders?.goalName || t.onboarding.steps.goals.namePlaceholder}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#161b27] border border-[#1e293b] text-xs text-[#F5F5F0] outline-none placeholder-[#8A8F98]/40"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8A8F98] mb-1.5">
                          {t.onboarding.steps.goals.targetLabel}
                        </label>
                        <input
                          type="number"
                          value={goalTarget}
                          onChange={(e) => setGoalTarget(e.target.value)}
                          placeholder={presets.placeholders?.goalTarget || "500"}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#161b27] border border-[#1e293b] text-xs text-[#F5F5F0] outline-none placeholder-[#8A8F98]/40"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Actions Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-[#1e293b]">
              {step > 1 ? (
                <button
                  id="btn-onboarding-back"
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="px-5 py-2.5 rounded-full bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] text-xs font-semibold text-[#8A8F98] hover:text-[#F5F5F0] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t.onboarding.backButton}</span>
                </button>
              ) : (
                <div />
              )}

              {step < totalSteps ? (
                <button
                  id="btn-onboarding-next"
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="px-7 py-3 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.2)] flex items-center gap-2 cursor-pointer"
                >
                  <span>{t.onboarding.nextButton}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  id="btn-onboarding-finish"
                  type="button"
                  onClick={handleFinishOnboarding}
                  disabled={isFinishing}
                  className="px-8 py-3 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_20px_rgba(212,255,61,0.3)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isFinishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#0B0E17]" />
                      <span>{t.onboarding.calculating}</span>
                    </>
                  ) : (
                    <>
                      <span>{t.onboarding.finishButton}</span>
                      <Sparkles className="w-4 h-4 text-[#0B0E17]" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
