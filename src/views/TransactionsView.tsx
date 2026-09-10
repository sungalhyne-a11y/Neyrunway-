import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Transaction, TransactionCategory, TransactionType, CategoryBudget } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Brain, 
  Plus, 
  Repeat, 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  Tag, 
  Trash2, 
  Filter, 
  TrendingDown, 
  ArrowDownLeft, 
  Clock, 
  AlertCircle,
  X,
  Layers,
  Target,
  BellRing,
  Edit3,
  Check,
  Lock,
  SlidersHorizontal,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const TransactionsView: React.FC<{ onNavigateToChat?: (initialQuery?: string) => void }> = ({ onNavigateToChat }) => {
  const { t, formatCurrency, formatDate, language, region, currency } = useTranslation();
  const { 
    currentUser, 
    userProfile, 
    computedRunway, 
    updateUserProfile, 
    secondaryAuth, 
    lockSensitiveViews, 
    recomputeRunway,
    memorySummary,
    confirmTransactionPattern,
    dismissPatternSuggestion,
    updateTransaction,
    deleteTransaction,
    toggleTransactionInRunway,
    transactions: authTransactions,
  } = useAuth();
  const { showBudgetWarning, showToast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>(authTransactions || []);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'recurring' | 'impulse' | 'essential' | 'inferred' | 'excluded'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBudgetGoalModal, setShowBudgetGoalModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Budget Goal State (defaults by region if not yet set by user)
  const defaultBudgetLimit = region === 'CH' ? 1000 : region === 'US' ? 900 : region === 'GB' ? 750 : region === 'CA' ? 850 : 550;
  const currentBudgetGoal = userProfile?.monthlyBudgetGoal ?? defaultBudgetLimit;
  const [editingBudgetAmount, setEditingBudgetAmount] = useState<string>(String(currentBudgetGoal));

  // Sync editing amount when profile loads
  useEffect(() => {
    if (userProfile?.monthlyBudgetGoal) {
      setEditingBudgetAmount(String(userProfile.monthlyBudgetGoal));
    }
  }, [userProfile?.monthlyBudgetGoal]);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formTag, setFormTag] = useState<'recurring' | 'impulse' | 'essential'>('essential');
  const [formCategory, setFormCategory] = useState<TransactionCategory>('food');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  // Load category budgets to track individual category limits
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) return;

    try {
      const catRef = collection(db, 'users', currentUser.uid, 'categoryBudgets');
      const unsubscribe = onSnapshot(catRef, (snapshot) => {
        if (!snapshot.empty) {
          const loaded: CategoryBudget[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CategoryBudget, 'id'>),
          }));
          setCategoryBudgets(loaded);
        }
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Category budgets sync in TransactionsView notice:', err);
    }
  }, [currentUser]);

  // Seed default realistic student memory if empty
  const defaultSampleMovements: Transaction[] = [
    {
      id: 'sample-1',
      userId: 'local',
      title: t.views.transactions.sampleMovements?.housing?.[region] || 'Loyer Résidence',
      amount: region === 'CH' ? 750 : region === 'US' ? 650 : region === 'GB' ? 520 : region === 'CA' ? 600 : region === 'BE' ? 460 : 420,
      category: 'housing',
      type: 'fixed',
      date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-2',
      userId: 'local',
      title: t.views.transactions.sampleMovements?.transport?.[region] || 'Pass Transports',
      amount: region === 'CH' ? 30 : region === 'US' ? 35 : region === 'GB' ? 45 : region === 'BE' ? 12 : 38,
      category: 'transport',
      type: 'fixed',
      date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-3',
      userId: 'local',
      title: t.views.transactions.sampleMovements?.food?.[region] || 'Courses alimentaires',
      amount: 42.5,
      category: 'food',
      type: 'variable',
      date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-4',
      userId: 'local',
      title: t.views.transactions.sampleMovements?.leisure?.[region] || 'Sortie & loisirs',
      amount: 28,
      category: 'leisure',
      type: 'variable',
      date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
  ];

  // Load from Firestore if authenticated
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) {
      setTransactions(defaultSampleMovements);
      return;
    }

    try {
      const txRef = collection(db, 'users', currentUser.uid, 'transactions');
      const q = query(txRef, orderBy('date', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const loaded: Transaction[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<Transaction, 'id'>),
          }));
          setTransactions(loaded);
        } else {
          setTransactions(defaultSampleMovements);
        }
      }, (err) => {
        console.warn('Firestore transactions sync notice:', err);
        setTransactions(defaultSampleMovements);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Transactions listener error:', err);
      setTransactions(defaultSampleMovements);
    }
  }, [currentUser, region]);

  // Current Calendar Month Spending Calculation
  const currentMonthPrefix = useMemo(() => new Date().toISOString().slice(0, 7), []);
  
  const currentMonthSpent = useMemo(() => {
    return transactions
      .filter((tx) => tx.date && tx.date.startsWith(currentMonthPrefix))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }, [transactions, currentMonthPrefix]);

  const isBudgetExceeded = currentMonthSpent > currentBudgetGoal;
  const budgetExcess = Math.max(0, currentMonthSpent - currentBudgetGoal);
  const budgetPercentage = Math.round((currentMonthSpent / Math.max(1, currentBudgetGoal)) * 100);

  // Contextual Insights for Decision-Support (Money Memory: UNDERSTAND -> CONTEXT)
  const housingCommitment = useMemo(() => {
    return transactions.find((tx) => tx.category === 'housing' && (tx.isRecurring || tx.type === 'fixed'));
  }, [transactions]);

  const transportSpent = useMemo(() => {
    return transactions
      .filter((tx) => tx.category === 'transport')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }, [transactions]);

  // Trigger Budget Warning Toast manually / test
  const triggerBudgetWarningToast = (customSpent?: number, customGoal?: number, txTitle?: string, txAmount?: number) => {
    const spent = customSpent ?? currentMonthSpent;
    const goal = customGoal ?? currentBudgetGoal;
    const excess = Math.max(0, spent - goal);
    const pct = Math.round((spent / Math.max(1, goal)) * 100);

    showBudgetWarning(
      {
        currentSpending: spent,
        monthlyBudgetGoal: goal,
        excessAmount: excess,
        percentageUsed: pct,
        currency: currency || userProfile?.currency || 'EUR',
        recentTransactionTitle: txTitle,
        recentTransactionAmount: txAmount,
      },
      {
        title: language === 'fr' ? 'Objectif de Budget Dépassé' : 'Monthly Budget Goal Exceeded',
        message: txTitle ? (
          language === 'fr'
            ? `L'enregistrement de "${txTitle}" (${formatCurrency(txAmount || 0)}) porte vos dépenses mensuelles à ${formatCurrency(spent)}, dépassant votre objectif de ${formatCurrency(goal)} (+${formatCurrency(excess)}).`
            : `Adding "${txTitle}" (${formatCurrency(txAmount || 0)}) pushes your monthly spending to ${formatCurrency(spent)}, exceeding your budget goal of ${formatCurrency(goal)} (+${formatCurrency(excess)}).`
        ) : (
          language === 'fr'
            ? `Vos dépenses actuelles de ${formatCurrency(spent)} dépassent votre plafond mensuel fixé à ${formatCurrency(goal)} (+${formatCurrency(excess)}).`
            : `Your current spending of ${formatCurrency(spent)} exceeds your monthly budget goal of ${formatCurrency(goal)} (+${formatCurrency(excess)}).`
        ),
        actionLabel: language === 'fr' ? 'Conseil Copilot Ney' : 'Ask Ney Copilot',
        onAction: () => {
          const query = language === 'fr'
            ? `Mes dépenses du mois atteignent ${formatCurrency(spent)} et dépassent mon budget fixé à ${formatCurrency(goal)} (+${formatCurrency(excess)}). Comment me réajuster sans stress ?`
            : `My spending this month reached ${formatCurrency(spent)} and exceeds my budget goal of ${formatCurrency(goal)} (+${formatCurrency(excess)}). How can I rebalance without stress?`;
          onNavigateToChat?.(query);
        },
        secondaryActionLabel: language === 'fr' ? 'Ajuster l\'objectif' : 'Adjust Goal',
        onSecondaryAction: () => {
          setShowBudgetGoalModal(true);
        },
      }
    );
  };

  const handleSaveBudgetGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(editingBudgetAmount);
    if (isNaN(parsed) || parsed <= 0) return;

    try {
      await updateUserProfile({ monthlyBudgetGoal: parsed });
      setShowBudgetGoalModal(false);
      showToast({
        type: 'success',
        title: language === 'fr' ? 'Objectif mis à jour' : 'Budget Goal Updated',
        message: language === 'fr' 
          ? `Votre objectif mensuel est désormais fixé à ${formatCurrency(parsed)}.`
          : `Your monthly budget goal is now set to ${formatCurrency(parsed)}.`,
      });

      // If current spending exceeds the newly lowered goal, trigger the toast
      if (currentMonthSpent > parsed) {
        triggerBudgetWarningToast(currentMonthSpent, parsed);
      }
    } catch (err) {
      console.error('Error saving budget goal:', err);
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formAmount || isNaN(Number(formAmount))) return;

    setIsSubmitting(true);
    const parsedAmount = Math.abs(parseFloat(formAmount));

    const newTx: Omit<Transaction, 'id'> = {
      userId: currentUser?.uid || 'local',
      title: formTitle,
      amount: parsedAmount,
      category: formCategory,
      type: formTag === 'recurring' ? 'fixed' : 'variable',
      date: formDate,
      status: 'settled',
      isRecurring: formTag === 'recurring',
      memoryStatus: 'confirmed',
      memorySource: 'user_added',
      isDisabledInRunway: false,
      createdAt: new Date().toISOString(),
    };

    // Check if adding this movement causes monthly spending to exceed budget goal
    const isThisMonth = formDate.startsWith(currentMonthPrefix);
    const projectedMonthSpent = isThisMonth ? currentMonthSpent + parsedAmount : currentMonthSpent;

    // Check if adding this movement causes individual category limit to be exceeded
    const matchedCategoryBudget = categoryBudgets.find((c) => c.categoryKey === formCategory || c.name.toLowerCase() === formCategory.toLowerCase() || c.id === formCategory);
    let categoryLimitExceeded = false;

    if (isThisMonth && matchedCategoryBudget && matchedCategoryBudget.monthlyLimit > 0) {
      const currentCategorySpent = transactions
        .filter((tx) => tx.date && tx.date.startsWith(currentMonthPrefix) && (
          tx.category === formCategory || 
          tx.customCategoryName?.toLowerCase() === matchedCategoryBudget.name.toLowerCase() ||
          tx.category === matchedCategoryBudget.categoryKey
        ))
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      const projectedCategorySpent = currentCategorySpent + parsedAmount;
      if (projectedCategorySpent > matchedCategoryBudget.monthlyLimit) {
        categoryLimitExceeded = true;
        const catExcess = projectedCategorySpent - matchedCategoryBudget.monthlyLimit;
        showBudgetWarning(
          {
            currentSpending: projectedCategorySpent,
            monthlyBudgetGoal: matchedCategoryBudget.monthlyLimit,
            excessAmount: catExcess,
            percentageUsed: Math.round((projectedCategorySpent / matchedCategoryBudget.monthlyLimit) * 100),
            currency: userProfile?.currency || currency || 'EUR',
            categoryName: matchedCategoryBudget.name,
            recentTransactionTitle: formTitle,
            recentTransactionAmount: parsedAmount,
          },
          {
            title: language === 'fr' 
              ? `Plafond "${matchedCategoryBudget.name}" Dépassé` 
              : `"${matchedCategoryBudget.name}" Category Cap Exceeded`,
            message: language === 'fr'
              ? `L'ajout de "${formTitle}" (${formatCurrency(parsedAmount)}) porte les dépenses "${matchedCategoryBudget.name}" à ${formatCurrency(projectedCategorySpent)}, dépassant votre plafond de ${formatCurrency(matchedCategoryBudget.monthlyLimit)} (+${formatCurrency(catExcess)}).`
              : `Adding "${formTitle}" (${formatCurrency(parsedAmount)}) pushes "${matchedCategoryBudget.name}" spending to ${formatCurrency(projectedCategorySpent)}, exceeding your cap of ${formatCurrency(matchedCategoryBudget.monthlyLimit)} (+${formatCurrency(catExcess)}).`,
            actionLabel: language === 'fr' ? 'Optimiser avec Ney' : 'Ask Ney for Advice',
            onAction: () => {
              const query = language === 'fr'
                ? `Mes dépenses en "${matchedCategoryBudget.name}" (${formatCurrency(projectedCategorySpent)}) dépassent mon plafond mensuel de ${formatCurrency(matchedCategoryBudget.monthlyLimit)}. Quels ajustements budgétaires me conseilles-tu ?`
                : `My spending in "${matchedCategoryBudget.name}" (${formatCurrency(projectedCategorySpent)}) exceeds my monthly limit of ${formatCurrency(matchedCategoryBudget.monthlyLimit)}. What budget adjustments do you suggest?`;
              onNavigateToChat?.(query);
            },
          }
        );
      }
    }

    if (!categoryLimitExceeded) {
      if (isThisMonth && projectedMonthSpent > currentBudgetGoal) {
        triggerBudgetWarningToast(projectedMonthSpent, currentBudgetGoal, formTitle, parsedAmount);
      } else {
        showToast({
          type: 'success',
          title: language === 'fr' ? 'Mouvement enregistré' : 'Movement Recorded',
          message: `${formTitle} (${formatCurrency(parsedAmount)})`,
        });
      }
    }

    if (currentUser && !currentUser.isAnonymous) {
      try {
        const createdTx: Transaction = {
          id: 'tx-opt-' + Date.now(),
          ...newTx,
        };
        const nextList = [createdTx, ...transactions];
        setTransactions(nextList);
        recomputeRunway(nextList);

        await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), {
          ...newTx,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error adding transaction to Firestore:', err);
      }
    } else {
      const createdTx: Transaction = {
        id: 'tx-' + Date.now(),
        ...newTx,
      };
      const nextList = [createdTx, ...transactions];
      setTransactions(nextList);
      recomputeRunway(nextList);
    }

    // Reset Form
    setFormTitle('');
    setFormAmount('');
    setShowAddModal(false);
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    showToast({
      type: 'info',
      title: language === 'fr' ? 'Mouvement supprimé' : 'Transaction Deleted',
      message: language === 'fr' ? 'La transaction a été retirée de votre mémoire.' : 'Transaction removed from memory.',
    });
  };

  const handleToggleRunway = async (tx: Transaction) => {
    const willDisable = !tx.isDisabledInRunway;
    await toggleTransactionInRunway(tx.id);
    setTransactions((prev) =>
      prev.map((t) => (t.id === tx.id ? { ...t, isDisabledInRunway: willDisable } : t))
    );
    showToast({
      type: willDisable ? 'info' : 'success',
      title: willDisable
        ? (language === 'fr' ? 'Dépense neutralisée' : 'Expense Neutralized')
        : (language === 'fr' ? 'Dépense réintégrée' : 'Expense Restored'),
      message: willDisable
        ? (language === 'fr' 
            ? `"${tx.title}" est exclue du calcul de runway. L'IA n'impactera pas votre horizon.` 
            : `"${tx.title}" is excluded from runway calculations. AI will not penalize your horizon.`)
        : (language === 'fr' 
            ? `"${tx.title}" est à nouveau prise en compte dans le calcul du runway.` 
            : `"${tx.title}" is included back in runway calculation.`),
    });
  };

  const handleConfirmPattern = async (tx: Transaction) => {
    await confirmTransactionPattern(tx.id, { memoryStatus: 'confirmed', isRecurring: true, type: 'fixed' });
    setTransactions((prev) =>
      prev.map((t) => (t.id === tx.id ? { ...t, memoryStatus: 'confirmed', isRecurring: true, type: 'fixed' } : t))
    );
    showToast({
      type: 'success',
      title: language === 'fr' ? 'Récurrence validée' : 'Recurrence Confirmed',
      message: language === 'fr'
        ? `"${tx.title}" est sanctuarisée comme charge fixe prévisible.`
        : `"${tx.title}" confirmed as a predictable commitment.`,
    });
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'recurring') return !tx.isDisabledInRunway && (tx.isRecurring || tx.type === 'fixed');
    if (activeFilter === 'impulse') return !tx.isDisabledInRunway && (tx.category === 'leisure' || tx.category === 'shopping');
    if (activeFilter === 'essential') return !tx.isDisabledInRunway && (tx.category === 'housing' || tx.category === 'food' || tx.category === 'transport');
    if (activeFilter === 'inferred') return !tx.isDisabledInRunway && (tx.memoryStatus === 'detected' || tx.memorySource === 'detected_pattern' || (tx.isRecurring && tx.memoryStatus !== 'confirmed'));
    if (activeFilter === 'excluded') return Boolean(tx.isDisabledInRunway);
    return true;
  });

  // Summary counts for Trust Layer
  const excludedCount = transactions.filter((t) => t.isDisabledInRunway).length;
  const inferredCount = transactions.filter((t) => !t.isDisabledInRunway && (t.memoryStatus === 'detected' || t.memorySource === 'detected_pattern' || (t.isRecurring && t.memoryStatus !== 'confirmed'))).length;
  const recurringCount = transactions.filter((t) => !t.isDisabledInRunway && (t.isRecurring || t.type === 'fixed')).length;
  const activeCount = transactions.length - excludedCount;

  const getTagVisual = (tx: Transaction) => {
    if (tx.isRecurring || tx.type === 'fixed') {
      return {
        label: t.views.transactions.tags.recurring,
        className: 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/30',
        icon: Repeat,
      };
    }
    if (tx.category === 'leisure' || tx.category === 'shopping') {
      return {
        label: t.views.transactions.tags.impulse,
        className: 'bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/30',
        icon: Flame,
      };
    }
    return {
      label: t.views.transactions.tags.essential,
      className: 'bg-[#D4FF3D]/10 text-[#D4FF3D] border-[#D4FF3D]/30',
      icon: ShieldCheck,
    };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#D4FF3D] text-[11px] font-bold tracking-[0.15em] uppercase font-mono px-2 py-0.5 rounded-md bg-[#D4FF3D]/10 border border-[#D4FF3D]/20">
              {t.views.transactions.badge}
            </span>
            <span className="text-xs text-[#8A8F98] font-mono">
              • {userProfile?.region || region} ({userProfile?.currency || currency})
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-[#F5F5F0]">
            {t.views.transactions.title}
          </h2>
          <p className="text-xs md:text-sm text-[#8A8F98] mt-1 max-w-2xl">
            {t.views.transactions.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {secondaryAuth.enabled && (
            <button
              type="button"
              id="btn-transactions-lock-now"
              onClick={lockSensitiveViews}
              title={t.security?.lockNow || (language === 'fr' ? 'Verrouiller la session' : 'Lock session')}
              className="px-3 py-2 rounded-full bg-[#161b27] hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#D4FF3D] border border-[#1e293b] text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{language === 'fr' ? 'Verrouiller' : 'Lock'}</span>
            </button>
          )}

          <button
            id="btn-add-movement"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.views.transactions.addMovement}</span>
          </button>
        </div>
      </header>

      {/* Ney AI Learning Notice Banner & Memory Trust Layer */}
      <div 
        id="memory-trust-layer-banner"
        className="p-5 rounded-3xl bg-[#161b27] border border-[#1e293b] space-y-4 shadow-xl relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/20 shrink-0 mt-0.5">
              <Brain className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs sm:text-sm font-bold text-[#F5F5F0] tracking-wide uppercase font-mono">
                  {language === 'fr' ? 'MEMORY TRUST LAYER' : 'MEMORY TRUST LAYER'}
                </h4>
                <span className="text-[10px] text-[#D4FF3D] font-mono font-bold bg-[#D4FF3D]/10 px-2.5 py-0.5 rounded-full border border-[#D4FF3D]/30">
                  {language === 'fr' ? 'L\'IA CONSEILLE. VOUS DÉCIDEZ.' : 'AI ADVISES. YOU DECIDE.'}
                </span>
              </div>
              <p className="text-xs text-[#8A8F98] leading-relaxed max-w-3xl">
                {language === 'fr'
                  ? 'Chaque inférence de Ney est transparente et traçable. Vos récurrences sont identifiées sans corvée de saisie ("Zero homework"), et vous gardez la souveraineté totale : validez une détection ou neutralisez n\'importe quelle dépense du calcul en un geste.'
                  : 'Every inference by Ney is transparent and verifiable. Your recurring patterns are detected without tedious manual data entry ("Zero homework"), and you retain full sovereignty: confirm a pattern or neutralize any expense from calculations with a single tap.'}
              </p>
            </div>
          </div>
        </div>

        {/* Memory Trust Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-[#1e293b]/70 text-xs font-mono">
          <div className="p-3 rounded-2xl bg-[#0B0E17]/70 border border-[#1e293b]">
            <span className="text-[10px] uppercase text-[#D4FF3D] block font-bold">
              {language === 'fr' ? 'Mémoires actives' : 'Active memories'}
            </span>
            <span className="text-base sm:text-lg font-bold text-[#F5F5F0] mt-0.5 block">
              {activeCount}
            </span>
            <span className="text-[10px] text-[#8A8F98] block">
              {language === 'fr' ? 'Prises en compte dans le Runway' : 'Factored into runway'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#0B0E17]/70 border border-[#1e293b]">
            <span className="text-[10px] uppercase text-[#38BDF8] block font-bold">
              {language === 'fr' ? 'Sanctuarisées' : 'Secured'}
            </span>
            <span className="text-base sm:text-lg font-bold text-[#38BDF8] mt-0.5 block">
              {recurringCount}
            </span>
            <span className="text-[10px] text-[#8A8F98] block">
              {language === 'fr' ? 'Charges fixes réservées' : 'Predictable commitments'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#0B0E17]/70 border border-[#1e293b]">
            <span className="text-[10px] uppercase text-[#FACC15] block font-bold">
              {language === 'fr' ? 'Inférences IA' : 'AI Inferences'}
            </span>
            <span className="text-base sm:text-lg font-bold text-[#FACC15] mt-0.5 block">
              {inferredCount}
            </span>
            <span className="text-[10px] text-[#8A8F98] block">
              {language === 'fr' ? 'Détectées automatiquement' : 'Zero-homework detected'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#0B0E17]/70 border border-[#1e293b]">
            <span className="text-[10px] uppercase text-[#94A3B8] block font-bold">
              {language === 'fr' ? 'Neutralisées' : 'Neutralized'}
            </span>
            <span className="text-base sm:text-lg font-bold text-[#94A3B8] mt-0.5 block">
              {excludedCount}
            </span>
            <span className="text-[10px] text-[#8A8F98] block">
              {language === 'fr' ? 'Exclues de l\'horizon par vous' : 'Excluded by user'}
            </span>
          </div>
        </div>

        {/* Money Memory: Context for decision-making */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-[#0B0E17]/50 border border-[#1e293b] text-[#8A8F98]">
            <span className="text-[10px] uppercase text-[#38BDF8] block font-bold">
              {language === 'fr' ? 'Échéance sanctuarisée' : 'Secured Commitment'}
            </span>
            <span className="text-[#F5F5F0] text-[11px] mt-0.5 block">
              {housingCommitment 
                ? (language === 'fr' 
                    ? `Prochain loyer (${formatCurrency(housingCommitment.amount)}) déduit de l'horizon.`
                    : `Next rent (${formatCurrency(housingCommitment.amount)}) deducted from horizon.`)
                : (language === 'fr'
                    ? `Charges fixes (${formatCurrency(computedRunway?.totalFixedExpenses ?? 420)}/mois) sanctuarisées.`
                    : `Fixed commitments (${formatCurrency(computedRunway?.totalFixedExpenses ?? 420)}/mo) secured.`)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0B0E17]/50 border border-[#1e293b] text-[#8A8F98]">
            <span className="text-[10px] uppercase text-[#D4FF3D] block font-bold">
              {language === 'fr' ? 'Surveillance dépenses de vie' : 'Monitored Variable Burn'}
            </span>
            <span className="text-[#F5F5F0] text-[11px] mt-0.5 block">
              {transportSpent > 0 
                ? (language === 'fr'
                    ? `Transports à ${formatCurrency(transportSpent)} ce mois : calibré dans vos Safe-to-Spend.`
                    : `Transit at ${formatCurrency(transportSpent)} this month: calibrated in Safe-to-Spend.`)
                : (language === 'fr'
                    ? `Dépenses courantes à ${formatCurrency(currentMonthSpent)} ce mois-ci.`
                    : `Living expenses at ${formatCurrency(currentMonthSpent)} this month.`)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0B0E17]/50 border border-[#1e293b] text-[#8A8F98] flex flex-col justify-between">
            <span className="text-[10px] uppercase text-[#FACC15] block font-bold">
              {language === 'fr' ? 'Contrôle souverain' : 'Sovereign Control'}
            </span>
            <span className="text-[#F5F5F0] text-[11px] mt-0.5 block">
              {language === 'fr'
                ? 'Vous pouvez neutraliser un achat exceptionnel pour qu\'il ne raccourcisse pas votre Runway.'
                : 'Neutralize exceptional purchases so they do not artificially shorten your Runway.'}
            </span>
          </div>
        </div>

        {/* Lightweight "Memory without homework" Pattern Suggestion */}
        {memorySummary.candidateSuggestions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#1e293b]/70">
            {memorySummary.candidateSuggestions.map((suggestion) => (
              <div 
                key={suggestion.id}
                className="p-3.5 rounded-2xl bg-[#0B0E17] border border-[#D4FF3D]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[#D4FF3D]/10 text-[#D4FF3D] shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#D4FF3D] font-bold">
                        {language === 'fr' ? 'DÉTECTION SANS SAISIE LOURDE' : 'ZERO-HOMEWORK DETECTION'}
                      </span>
                      <span className="text-[9px] font-mono text-[#8A8F98] bg-[#161b27] px-2 py-0.5 rounded-full border border-[#1e293b]">
                        {Math.round((suggestion.confidence ?? 0.85) * 100)}% {language === 'fr' ? 'confiance' : 'confidence'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#F5F5F0] font-medium mt-1">
                      {suggestion.message}
                    </p>
                    <p className="text-[11px] text-[#8A8F98] mt-0.5">
                      {language === 'fr' 
                        ? 'En confirmant, Ney intègre cette charge directement dans tes calculs d\'horizon.' 
                        : 'By confirming, Ney factors this expense directly into your runway forecast.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => confirmTransactionPattern(suggestion.transactionId, { isRecurring: true, type: 'fixed' })}
                    className="px-3 py-1.5 rounded-xl bg-[#D4FF3D] text-[#0B0E17] font-bold hover:bg-[#c2f028] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{language === 'fr' ? 'Confirmer' : 'Confirm'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => dismissPatternSuggestion(suggestion.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b] hover:border-[#8A8F98] transition-colors cursor-pointer"
                  >
                    <span>{language === 'fr' ? 'Ignorer' : 'Dismiss'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Student Financial Opportunity Matching */}
        {memorySummary.opportunity && (
          <div className="pt-2 border-t border-[#1e293b]/70">
            <div 
              className="p-3 rounded-2xl bg-[#0B0E17]/80 border border-[#38BDF8]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#38BDF8]/10 text-[#38BDF8] shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#F5F5F0]">{memorySummary.opportunity.resourceTitle}</span>
                    <span className="text-[10px] text-[#38BDF8] font-mono bg-[#38BDF8]/10 px-2 py-0.5 rounded-md border border-[#38BDF8]/20">
                      {memorySummary.opportunity.provider}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A8F98] mt-0.5">
                    {memorySummary.opportunity.potentialImpact}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <span className="text-[10px] font-mono text-[#8A8F98]">
                  {language === 'fr' ? 'Éligibilité à vérifier' : 'To verify'}
                </span>
                {memorySummary.opportunity.url && (
                  <a
                    href={memorySummary.opportunity.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-[#0B0E17] hover:bg-[#38BDF8] text-[#38BDF8] hover:text-[#0B0E17] border border-[#38BDF8]/30 text-[11px] font-mono transition-all inline-flex items-center gap-1"
                  >
                    <span>{language === 'fr' ? 'Détails' : 'Details'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Monthly Budget Goal Tracker & Toast Alert Control */}
      <div 
        id="monthly-budget-tracker-card"
        className={`p-5 rounded-3xl border transition-all duration-300 ${
          isBudgetExceeded
            ? 'bg-[#161b27] border-[#F43F5E]/40 shadow-[0_0_30px_rgba(244,63,94,0.12)]'
            : 'bg-[#161b27] border-[#1e293b] shadow-xl'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-2xl border shrink-0 ${
              isBudgetExceeded 
                ? 'bg-[#F43F5E]/15 text-[#FB7185] border-[#F43F5E]/30 animate-pulse'
                : 'bg-[#D4FF3D]/10 text-[#D4FF3D] border-[#D4FF3D]/20'
            }`}>
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#F5F5F0]">
                  {t.views.transactions.budget?.title || (language === 'fr' ? 'Objectif de Budget Mensuel' : 'Monthly Spending Goal')}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border ${
                  isBudgetExceeded
                    ? 'bg-[#F43F5E]/20 text-[#FB7185] border-[#F43F5E]/30'
                    : 'bg-[#D4FF3D]/10 text-[#D4FF3D] border-[#D4FF3D]/20'
                }`}>
                  {budgetPercentage}% {isBudgetExceeded ? (language === 'fr' ? 'DÉPASSÉ' : 'OVER LIMIT') : (language === 'fr' ? 'UTILISÉ' : 'USED')}
                </span>
              </div>
              <p className="text-xs text-[#8A8F98] mt-0.5">
                {t.views.transactions.budget?.subtitle || (language === 'fr' ? 'Plafond mensuel pour toutes les dépenses de vie' : 'Target monthly spending cap')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
            {/* Simulate / Test Alert Button */}
            <button
              type="button"
              id="btn-test-budget-toast"
              onClick={() => triggerBudgetWarningToast(currentMonthSpent > currentBudgetGoal ? currentMonthSpent : currentBudgetGoal + 120, currentBudgetGoal)}
              className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#8A8F98]/40 text-xs font-mono text-[#FACC15] flex items-center gap-1.5 transition-all cursor-pointer"
              title={language === 'fr' ? 'Déclencher la notification toast' : 'Trigger budget warning toast notification'}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>{t.views.transactions.budget?.testWarning || (language === 'fr' ? 'Tester l\'alerte Toast' : 'Test Budget Toast')}</span>
            </button>

            {/* Edit Goal Button */}
            <button
              type="button"
              id="btn-edit-budget-goal"
              onClick={() => setShowBudgetGoalModal(true)}
              className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#D4FF3D]/50 text-xs font-mono text-[#D4FF3D] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t.views.transactions.budget?.editGoal || (language === 'fr' ? 'Modifier l\'objectif' : 'Edit Goal')}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Comparative Stats */}
        <div className="mt-4 pt-4 border-t border-[#1e293b]/70 space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 rounded-2xl bg-[#0B0E17]/60 border border-[#1e293b]">
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase block">
                {t.views.transactions.budget?.currentSpent || (language === 'fr' ? 'Dépensé ce mois' : 'Spent This Month')}
              </span>
              <span className={`text-base font-bold font-mono block mt-0.5 ${
                isBudgetExceeded ? 'text-[#F43F5E]' : 'text-[#F5F5F0]'
              }`}>
                {formatCurrency(currentMonthSpent)}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#0B0E17]/60 border border-[#1e293b]">
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase block">
                {t.views.transactions.budget?.monthlyLimit || (language === 'fr' ? 'Plafond mensuel' : 'Monthly Budget Goal')}
              </span>
              <span className="text-base font-bold font-mono text-[#D4FF3D] block mt-0.5">
                {formatCurrency(currentBudgetGoal)}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#0B0E17]/60 border border-[#1e293b]">
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase block">
                {isBudgetExceeded 
                  ? (language === 'fr' ? 'Dépassement' : 'Overage') 
                  : (t.views.transactions.budget?.remaining || (language === 'fr' ? 'Budget restant' : 'Remaining Budget'))
                }
              </span>
              <span className={`text-base font-bold font-mono block mt-0.5 ${
                isBudgetExceeded ? 'text-[#FB7185]' : 'text-[#38BDF8]'
              }`}>
                {isBudgetExceeded ? `+${formatCurrency(budgetExcess)}` : formatCurrency(Math.max(0, currentBudgetGoal - currentMonthSpent))}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#0B0E17]/60 border border-[#1e293b]">
              <span className="text-[10px] font-mono text-[#8A8F98] uppercase block">
                {language === 'fr' ? 'Statut Ney' : 'Ney Status'}
              </span>
              <span className={`text-xs font-semibold font-mono block mt-1 ${
                isBudgetExceeded ? 'text-[#FB7185]' : 'text-[#D4FF3D]'
              }`}>
                {isBudgetExceeded 
                  ? (language === 'fr' ? 'Alerte active' : 'Alert Triggered') 
                  : (language === 'fr' ? 'Rythme optimal' : 'On Track')
                }
              </span>
            </div>
          </div>

          {/* Mini Linear Gauge */}
          <div className="space-y-1 pt-1">
            <div className="h-2 w-full bg-[#0B0E17] rounded-full overflow-hidden border border-[#1e293b] relative">
              <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-[#8A8F98]/40 z-10" />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (currentMonthSpent / currentBudgetGoal) * 75)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  isBudgetExceeded
                    ? 'bg-gradient-to-r from-[#FACC15] via-[#FB7185] to-[#F43F5E]'
                    : 'bg-gradient-to-r from-[#38BDF8] to-[#D4FF3D]'
                }`}
              />
            </div>
            {isBudgetExceeded && (
              <p className="text-[11px] text-[#FB7185] font-mono flex items-center justify-between">
                <span>⚠ {language === 'fr' ? `Dépassement de budget de ${formatCurrency(budgetExcess)}` : `Over budget by ${formatCurrency(budgetExcess)}`}</span>
                <button
                  type="button"
                  onClick={() => triggerBudgetWarningToast()}
                  className="underline hover:text-[#FFA1AD] cursor-pointer"
                >
                  {language === 'fr' ? 'Revoir la notification' : 'View Toast Warning'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          id="filter-movements-all"
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 min-h-[44px] rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${
            activeFilter === 'all'
              ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_12px_rgba(212,255,61,0.25)]'
              : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
          }`}
        >
          {t.views.transactions.filterAll} ({transactions.length})
        </button>

        <button
          id="filter-movements-recurring"
          onClick={() => setActiveFilter('recurring')}
          className={`px-4 py-2 min-h-[44px] rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 justify-center ${
            activeFilter === 'recurring'
              ? 'bg-[#38BDF8] text-[#0B0E17] font-bold shadow-[0_0_12px_rgba(56,189,248,0.25)]'
              : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>{t.views.transactions.filterRecurring}</span>
        </button>

        <button
          id="filter-movements-essential"
          onClick={() => setActiveFilter('essential')}
          className={`px-4 py-2 min-h-[44px] rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 justify-center ${
            activeFilter === 'essential'
              ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_12px_rgba(212,255,61,0.25)]'
              : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t.views.transactions.filterEssential}</span>
        </button>

        <button
          id="filter-movements-impulse"
          onClick={() => setActiveFilter('impulse')}
          className={`px-4 py-2 min-h-[44px] rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 justify-center ${
            activeFilter === 'impulse'
              ? 'bg-[#FACC15] text-[#0B0E17] font-bold shadow-[0_0_12px_rgba(250,204,21,0.25)]'
              : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{t.views.transactions.filterImpulse}</span>
        </button>

        <button
          id="filter-movements-inferred"
          onClick={() => setActiveFilter('inferred')}
          className={`px-4 py-2 min-h-[44px] rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 justify-center ${
            activeFilter === 'inferred'
              ? 'bg-[#FACC15] text-[#0B0E17] font-bold shadow-[0_0_12px_rgba(250,204,21,0.25)]'
              : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-[#FACC15]" />
          <span>{language === 'fr' ? 'Inférences IA' : 'AI Inferred'} ({inferredCount})</span>
        </button>

        <button
          id="filter-movements-excluded"
          onClick={() => setActiveFilter('excluded')}
          className={`px-4 py-2 min-h-[44px] rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 justify-center ${
            activeFilter === 'excluded'
              ? 'bg-[#38BDF8] text-[#0B0E17] font-bold shadow-[0_0_12px_rgba(56,189,248,0.25)]'
              : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
          }`}
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>{language === 'fr' ? 'Neutralisés' : 'Neutralized'} ({excludedCount})</span>
        </button>
      </div>

      {/* Movements Stream List */}
      <div 
        id="transactions-stream-list"
        className="space-y-3"
      >
        <AnimatePresence>
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#161b27] border border-[#1e293b] space-y-3">
              <Layers className="w-8 h-8 text-[#8A8F98] mx-auto" />
              <h4 className="text-sm font-semibold text-[#F5F5F0]">
                {t.views.transactions.emptyTitle}
              </h4>
              <p className="text-xs text-[#8A8F98] max-w-sm mx-auto">
                {t.views.transactions.emptyDesc}
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const tagInfo = getTagVisual(tx);
              const TagIcon = tagInfo.icon;
              const isExcluded = Boolean(tx.isDisabledInRunway);
              const isConfirmed = tx.memoryStatus === 'confirmed' || tx.memorySource === 'user_added';
              const isInferred = !isConfirmed && (tx.memoryStatus === 'detected' || tx.memorySource === 'detected_pattern' || (tx.isRecurring && tx.memoryStatus !== 'confirmed'));

              return (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-md group ${
                    isExcluded
                      ? 'bg-[#10141e]/75 border-[#243044] opacity-75'
                      : 'bg-[#161b27] hover:bg-[#1a2130] border-[#1e293b]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                        isExcluded ? 'bg-[#1e293b]/40 border-[#1e293b] text-[#8A8F98]' : tagInfo.className
                      }`}>
                        <TagIcon className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-xs sm:text-sm font-medium truncate ${
                            isExcluded ? 'text-[#8A8F98] line-through' : 'text-[#F5F5F0]'
                          }`}>
                            {tx.title}
                          </h4>

                          {/* Memory Trust Status Badges */}
                          {isExcluded ? (
                            <span className="px-2 py-0.5 rounded-md border text-[9px] uppercase font-mono font-bold tracking-wider bg-[#1e293b]/90 text-[#94A3B8] border-[#334155] flex items-center gap-1">
                              <EyeOff className="w-2.5 h-2.5" />
                              <span>{language === 'fr' ? 'Neutralisé du Runway' : 'Excluded from Runway'}</span>
                            </span>
                          ) : isConfirmed ? (
                            <span className="px-2 py-0.5 rounded-md border text-[9px] uppercase font-mono font-bold tracking-wider bg-[#D4FF3D]/10 text-[#D4FF3D] border-[#D4FF3D]/30 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{language === 'fr' ? 'Confirmé' : 'Confirmed'}</span>
                            </span>
                          ) : isInferred ? (
                            <span className="px-2 py-0.5 rounded-md border text-[9px] uppercase font-mono font-bold tracking-wider bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/30 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" />
                              <span>{language === 'fr' ? 'Détecté par l\'IA' : 'AI Inferred'}</span>
                            </span>
                          ) : null}

                          <span className={`px-2 py-0.5 rounded-md border text-[9px] uppercase font-bold tracking-wider ${tagInfo.className}`}>
                            {tagInfo.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#8A8F98] flex-wrap">
                          <span>{formatDate(new Date(tx.date))}</span>
                          <span>•</span>
                          <span>
                            {tx.isRecurring 
                              ? (language === 'fr' ? 'Charge récurrente' : 'Recurring') 
                              : (language === 'fr' ? 'Ponctuel' : 'One-off')}
                          </span>
                          {isExcluded && (
                            <>
                              <span>•</span>
                              <span className="text-[#38BDF8]">
                                {language === 'fr' ? 'Neutralisé : non déduit de l\'horizon' : 'Neutralized: not deducted from runway'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1e293b]/50">
                      <div className="text-left sm:text-right">
                        <span className={`text-sm sm:text-base font-bold font-mono block ${
                          isExcluded ? 'text-[#8A8F98] line-through' : 'text-[#F5F5F0]'
                        }`}>
                          -{formatCurrency(tx.amount)}
                        </span>
                        <span className="text-[10px] text-[#8A8F98] font-mono">
                          {isExcluded 
                            ? (language === 'fr' ? 'Hors calcul' : 'No burn impact')
                            : tx.isRecurring 
                            ? (language === 'fr' ? 'Mensuel' : 'Monthly') 
                            : (language === 'fr' ? 'Ponctuel' : 'One-off')}
                        </span>
                      </div>

                      {/* Memory Trust Controls */}
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        {/* Quick Validate for Inferred Patterns */}
                        {isInferred && !isExcluded && (
                          <button
                            type="button"
                            onClick={() => handleConfirmPattern(tx)}
                            title={language === 'fr' ? 'Valider cette récurrence et la sanctuariser' : 'Confirm recurrence pattern'}
                            className="px-2.5 py-1.5 rounded-xl bg-[#D4FF3D]/10 hover:bg-[#D4FF3D] text-[#D4FF3D] hover:text-[#0B0E17] border border-[#D4FF3D]/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          >
                            <Check className="w-3 h-3" />
                            <span className="hidden sm:inline">{language === 'fr' ? 'Valider' : 'Confirm'}</span>
                          </button>
                        )}

                        {/* Toggle Inclusion in Runway (User Decides Sovereign Control) */}
                        <button
                          type="button"
                          onClick={() => handleToggleRunway(tx)}
                          title={isExcluded 
                            ? (language === 'fr' ? 'Réintégrer dans le Runway' : 'Restore in Runway calculation') 
                            : (language === 'fr' ? 'Neutraliser : exclure du Runway et du Safe-to-Spend' : 'Exclude from Runway calculation')}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                            isExcluded
                              ? 'bg-[#1e293b] hover:bg-[#334155] text-[#38BDF8] border-[#38BDF8]/40 shadow-sm'
                              : 'bg-[#0B0E17] hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#F5F5F0] border-[#1e293b]'
                          }`}
                        >
                          {isExcluded ? (
                            <>
                              <Eye className="w-3.5 h-3.5 text-[#38BDF8]" />
                              <span>{language === 'fr' ? 'Réintégrer' : 'Restore'}</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">{language === 'fr' ? 'Neutraliser' : 'Neutralize'}</span>
                            </>
                          )}
                        </button>

                        {/* Delete from memory */}
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id)}
                          title={language === 'fr' ? 'Supprimer de la mémoire' : 'Delete from memory'}
                          className="min-w-[36px] min-h-[36px] p-2 rounded-xl text-[#8A8F98] hover:text-[#F43F5E] hover:bg-[#0B0E17] opacity-80 group-hover:opacity-100 transition-all cursor-pointer flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Add Movement Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E17]/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 flex items-center justify-center text-[#D4FF3D]">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-[#F5F5F0]">
                    {t.views.transactions.addMovement}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#F5F5F0] transition-colors cursor-pointer flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddMovement} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.transactions.form.title}
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={t.views.transactions.form.placeholder}
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                      {t.views.transactions.form.amount} ({currency || userProfile?.currency || 'EUR'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                      {t.views.transactions.form.date}
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.transactions.form.tag}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormTag('essential')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-mono border transition-all text-center cursor-pointer ${
                        formTag === 'essential'
                          ? 'bg-[#D4FF3D]/20 text-[#D4FF3D] border-[#D4FF3D] font-bold'
                          : 'bg-[#0B0E17] text-[#8A8F98] border-[#1e293b]'
                      }`}
                    >
                      {t.views.transactions.tags.essential}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormTag('recurring')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-mono border transition-all text-center cursor-pointer ${
                        formTag === 'recurring'
                          ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8] font-bold'
                          : 'bg-[#0B0E17] text-[#8A8F98] border-[#1e293b]'
                      }`}
                    >
                      {t.views.transactions.tags.recurring}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormTag('impulse')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-mono border transition-all text-center cursor-pointer ${
                        formTag === 'impulse'
                          ? 'bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15] font-bold'
                          : 'bg-[#0B0E17] text-[#8A8F98] border-[#1e293b]'
                      }`}
                    >
                      {t.views.transactions.tags.impulse}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.transactions.form.category}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TransactionCategory)}
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]"
                  >
                    <optgroup label={language === 'fr' ? 'Catégories Principales' : 'Standard Categories'}>
                      <option value="housing">{t.views.transactions.categories.housing}</option>
                      <option value="food">{t.views.transactions.categories.food}</option>
                      <option value="subscriptions">{t.views.transactions.categories.subscriptions}</option>
                      <option value="transport">{t.views.transactions.categories.transport}</option>
                      <option value="leisure">{t.views.transactions.categories.leisure}</option>
                      <option value="education">{t.views.transactions.categories.education}</option>
                      <option value="shopping">{t.views.transactions.categories.shopping}</option>
                      <option value="other">{t.views.transactions.categories.other}</option>
                    </optgroup>
                    {categoryBudgets.filter(c => c.isCustom).length > 0 && (
                      <optgroup label={language === 'fr' ? 'Catégories Personnalisées' : 'Custom Categories'}>
                        {categoryBudgets.filter(c => c.isCustom).map((c) => (
                          <option key={c.id} value={c.categoryKey || c.id}>
                            {c.name} ({formatCurrency(c.monthlyLimit)}/m)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 rounded-full bg-[#0B0E17] hover:bg-[#1e293b] text-[#8A8F98] border border-[#1e293b] text-xs font-semibold transition-all cursor-pointer"
                  >
                    {t.views.transactions.form.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] cursor-pointer"
                  >
                    {t.views.transactions.form.submit}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Budget Goal Modal */}
        {showBudgetGoalModal && (
          <div className="fixed inset-0 bg-[#0B0E17]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 max-w-md w-full shadow-2xl relative"
            >
              <button
                onClick={() => setShowBudgetGoalModal(false)}
                className="absolute top-5 right-5 text-[#8A8F98] hover:text-[#F5F5F0] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-2xl bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/20">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F5F5F0]">
                    {t.views.transactions.budget?.editGoal || (language === 'fr' ? 'Modifier l\'objectif mensuel' : 'Set Monthly Budget Goal')}
                  </h3>
                  <p className="text-xs text-[#8A8F98]">
                    {language === 'fr' 
                      ? 'Ney surveille ce plafond et vous avertira immédiatement en cas de dépassement.'
                      : 'Ney monitors this limit and will warn you via toast alert if spending exceeds it.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveBudgetGoal} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5 font-mono">
                    {t.views.transactions.budget?.monthlyLimit || (language === 'fr' ? 'Plafond mensuel' : 'Monthly Budget Goal')} ({userProfile?.currency || currency})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={editingBudgetAmount}
                      onChange={(e) => setEditingBudgetAmount(e.target.value)}
                      className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-3 text-sm text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]"
                      placeholder="e.g. 500"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-[#8A8F98] font-mono">
                      {userProfile?.currency || currency} / {language === 'fr' ? 'mois' : 'mo'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#0B0E17]/60 border border-[#1e293b] space-y-1 text-xs text-[#8A8F98]">
                  <p>
                    {language === 'fr' 
                      ? `Dépenses actuelles ce mois-ci : ${formatCurrency(currentMonthSpent)}`
                      : `Current spent this month: ${formatCurrency(currentMonthSpent)}`}
                  </p>
                  {currentMonthSpent > parseFloat(editingBudgetAmount || '0') && (
                    <p className="text-[#FB7185] font-mono">
                      ⚠ {language === 'fr' 
                        ? 'Ce nouveau montant déclenchera une alerte de dépassement immédiate.' 
                        : 'This amount is below current spending and will trigger an immediate budget warning toast.'}
                    </p>
                  )}
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBudgetGoalModal(false)}
                    className="flex-1 py-3 rounded-full bg-[#0B0E17] hover:bg-[#1e293b] text-[#8A8F98] border border-[#1e293b] text-xs font-semibold transition-all cursor-pointer"
                  >
                    {t.views.transactions.form.cancel}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{t.views.transactions.budget?.saveGoal || (language === 'fr' ? 'Enregistrer' : 'Save Goal')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
