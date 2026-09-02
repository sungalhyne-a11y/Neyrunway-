import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CategoryBudget, Transaction, CategorySpendingSummary } from '../../types';
import { db } from '../../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  updateDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { 
  Utensils, 
  Home, 
  Bus, 
  Tv, 
  PartyPopper, 
  BookOpen, 
  ShoppingBag, 
  Coffee, 
  Laptop, 
  Gamepad2, 
  Sparkles, 
  Heart,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Flame,
  MessageSquare,
  X,
  SlidersHorizontal,
  RotateCcw,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Color theme mapping
export const COLOR_THEMES = {
  lime: {
    badge: 'bg-[#D4FF3D]/15 text-[#D4FF3D] border-[#D4FF3D]/30',
    bar: 'bg-[#D4FF3D]',
    glow: 'shadow-[0_0_10px_rgba(212,255,61,0.4)]',
    dot: 'bg-[#D4FF3D]',
  },
  cyan: {
    badge: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
    bar: 'bg-[#38BDF8]',
    glow: 'shadow-[0_0_10px_rgba(56,189,248,0.4)]',
    dot: 'bg-[#38BDF8]',
  },
  purple: {
    badge: 'bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30',
    bar: 'bg-[#A855F7]',
    glow: 'shadow-[0_0_10px_rgba(168,85,247,0.4)]',
    dot: 'bg-[#A855F7]',
  },
  amber: {
    badge: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
    bar: 'bg-[#F59E0B]',
    glow: 'shadow-[0_0_10px_rgba(245,158,11,0.4)]',
    dot: 'bg-[#F59E0B]',
  },
  rose: {
    badge: 'bg-[#F43F5E]/15 text-[#F43F5E] border-[#F43F5E]/30',
    bar: 'bg-[#F43F5E]',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.4)]',
    dot: 'bg-[#F43F5E]',
  },
  emerald: {
    badge: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
    bar: 'bg-[#10B981]',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.4)]',
    dot: 'bg-[#10B981]',
  },
  blue: {
    badge: 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30',
    bar: 'bg-[#60A5FA]',
    glow: 'shadow-[0_0_10px_rgba(96,165,250,0.4)]',
    dot: 'bg-[#60A5FA]',
  },
};

// Available icons mapping
export const AVAILABLE_ICONS = [
  { id: 'Utensils', label: 'Food & Dining', icon: Utensils },
  { id: 'Coffee', label: 'Coffee & Snacks', icon: Coffee },
  { id: 'PartyPopper', label: 'Entertainment & Outings', icon: PartyPopper },
  { id: 'Home', label: 'Rent & Housing', icon: Home },
  { id: 'Bus', label: 'Transport & Commute', icon: Bus },
  { id: 'Tv', label: 'Subscriptions & Media', icon: Tv },
  { id: 'ShoppingBag', label: 'Shopping & Clothes', icon: ShoppingBag },
  { id: 'BookOpen', label: 'Books & Studies', icon: BookOpen },
  { id: 'Laptop', label: 'Tech & Hardware', icon: Laptop },
  { id: 'Gamepad2', label: 'Gaming & Hobby', icon: Gamepad2 },
  { id: 'Heart', label: 'Health & Wellbeing', icon: Heart },
  { id: 'Sparkles', label: 'Extras & Personal', icon: Sparkles },
];

export const getIconComponent = (iconName?: string) => {
  const match = AVAILABLE_ICONS.find((i) => i.id === iconName);
  return match ? match.icon : Tag;
};

interface CategoryBudgetManagerProps {
  onNavigateToChat?: (initialQuery?: string) => void;
}

export const CategoryBudgetManager: React.FC<CategoryBudgetManagerProps> = ({ onNavigateToChat }) => {
  const { t, formatCurrency, currency, region, language } = useTranslation();
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<CategoryBudget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Form state
  const [formName, setFormName] = useState('');
  const [formLimit, setFormLimit] = useState('');
  const [formColor, setFormColor] = useState<keyof typeof COLOR_THEMES>('lime');
  const [formIcon, setFormIcon] = useState('Utensils');
  const [formNotes, setFormNotes] = useState('');

  // Edit Form state
  const [editLimitValue, setEditLimitValue] = useState('');

  // Default initial calibrated student categories
  const defaultSampleCategories = useMemo<CategoryBudget[]>(() => {
    const isCH = region === 'CH';
    const isUS = region === 'US';
    const isGB = region === 'GB';

    return [
      {
        id: 'cat-food',
        userId: 'local',
        categoryKey: 'food',
        name: language === 'fr' ? 'Alimentation & Courses' : 'Food & Groceries',
        monthlyLimit: isCH ? 350 : isUS ? 300 : isGB ? 220 : 200,
        color: 'emerald',
        icon: 'Utensils',
        isCustom: false,
        notes: language === 'fr' ? 'Courses hebdomadaires + Resto U Crous' : 'Weekly supermarket + Campus dining',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cat-housing',
        userId: 'local',
        categoryKey: 'housing',
        name: language === 'fr' ? 'Loyer & Charges' : 'Rent & Utilities',
        monthlyLimit: isCH ? 800 : isUS ? 700 : isGB ? 550 : 450,
        color: 'cyan',
        icon: 'Home',
        isCustom: false,
        notes: language === 'fr' ? 'Logement, électricité & internet' : 'Room rent, energy & wifi',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cat-leisure',
        userId: 'local',
        categoryKey: 'leisure',
        name: language === 'fr' ? 'Sorties, Soirées & Bars' : 'Entertainment & Outings',
        monthlyLimit: isCH ? 160 : isUS ? 130 : isGB ? 100 : 90,
        color: 'amber',
        icon: 'PartyPopper',
        isCustom: false,
        notes: language === 'fr' ? 'Cinéma, bars, restaurants du week-end' : 'Pubs, cinema, weekend meals',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cat-transport',
        userId: 'local',
        categoryKey: 'transport',
        name: language === 'fr' ? 'Transports & Mobilité' : 'Transit & Commute',
        monthlyLimit: isCH ? 70 : isUS ? 60 : isGB ? 50 : 38,
        color: 'blue',
        icon: 'Bus',
        isCustom: false,
        notes: language === 'fr' ? 'Abonnement mensuel bus/métro/train' : 'Monthly transit pass',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cat-subscriptions',
        userId: 'local',
        categoryKey: 'subscriptions',
        name: language === 'fr' ? 'Abonnements & Forfaits' : 'Subscriptions & Phone',
        monthlyLimit: isCH ? 45 : isUS ? 35 : isGB ? 30 : 25,
        color: 'purple',
        icon: 'Tv',
        isCustom: false,
        notes: language === 'fr' ? 'Forfait mobile, Spotify, streaming' : 'Mobile carrier, streaming, cloud',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cat-shopping',
        userId: 'local',
        categoryKey: 'shopping',
        name: language === 'fr' ? 'Shopping & Équipement' : 'Shopping & Gear',
        monthlyLimit: isCH ? 80 : isUS ? 65 : isGB ? 50 : 45,
        color: 'rose',
        icon: 'ShoppingBag',
        isCustom: false,
        notes: language === 'fr' ? 'Vêtements, petits matériels, extras' : 'Clothes, essential study items',
        createdAt: new Date().toISOString(),
      },
    ];
  }, [region, language]);

  // Load category budgets from Firestore or fallback
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) {
      setCategoryBudgets(defaultSampleCategories);
      return;
    }

    try {
      const catRef = collection(db, 'users', currentUser.uid, 'categoryBudgets');
      const unsubscribe = onSnapshot(catRef, (snapshot) => {
        if (!snapshot.empty) {
          const loaded: CategoryBudget[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CategoryBudget, 'id'>),
          }));
          setCategoryBudgets(loaded);
        } else {
          setCategoryBudgets(defaultSampleCategories);
        }
      }, (err) => {
        console.warn('Category budgets sync notice:', err);
        setCategoryBudgets(defaultSampleCategories);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Category budgets listener error:', err);
      setCategoryBudgets(defaultSampleCategories);
    }
  }, [currentUser, defaultSampleCategories]);

  // Load current month transactions from Firestore to compute real-time spending
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) {
      // Mock sample transactions for guest/preview
      setTransactions([
        {
          id: 'tx-1',
          userId: 'local',
          title: 'Courses Carrefour',
          amount: 42.5,
          category: 'food',
          type: 'variable',
          date: new Date().toISOString().split('T')[0],
          status: 'settled',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tx-2',
          userId: 'local',
          title: 'Sortie Bar & Ciné',
          amount: 28,
          category: 'leisure',
          type: 'variable',
          date: new Date().toISOString().split('T')[0],
          status: 'settled',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tx-3',
          userId: 'local',
          title: 'Pass Navigo',
          amount: 38,
          category: 'transport',
          type: 'fixed',
          date: new Date().toISOString().split('T')[0],
          status: 'settled',
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    try {
      const txRef = collection(db, 'users', currentUser.uid, 'transactions');
      const q = query(txRef, orderBy('date', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const loaded: Transaction[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Transaction, 'id'>),
          }));
          setTransactions(loaded);
        }
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('Transactions listener for categories notice:', err);
    }
  }, [currentUser]);

  // Calculate current month spending per category
  const currentMonthPrefix = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const categorySummaries = useMemo<CategorySpendingSummary[]>(() => {
    // Current month transactions
    const monthTx = transactions.filter((tx) => tx.date && tx.date.startsWith(currentMonthPrefix));

    return categoryBudgets.map((cat) => {
      // Sum transactions matching categoryKey or exact custom category name or id
      const spent = monthTx
        .filter((tx) => {
          if (tx.category === cat.categoryKey) return true;
          if (tx.category === cat.id) return true;
          if (tx.customCategoryName && tx.customCategoryName.toLowerCase() === cat.name.toLowerCase()) return true;
          return false;
        })
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      const limit = Math.max(1, cat.monthlyLimit);
      const pct = Math.round((spent / limit) * 100);
      const isExceeded = spent > limit;
      const excess = Math.max(0, spent - limit);
      const remaining = Math.max(0, limit - spent);

      return {
        categoryKey: cat.categoryKey || cat.id,
        name: cat.name,
        monthlyLimit: cat.monthlyLimit,
        currentSpent: spent,
        percentageUsed: pct,
        isExceeded,
        excessAmount: excess,
        remainingAmount: remaining,
        color: cat.color || 'lime',
        icon: cat.icon || 'Utensils',
        isCustom: cat.isCustom,
      };
    });
  }, [categoryBudgets, transactions, currentMonthPrefix]);

  // Overall category aggregate metrics
  const totalAllocatedLimits = useMemo(() => {
    return categoryBudgets.reduce((sum, c) => sum + (Number(c.monthlyLimit) || 0), 0);
  }, [categoryBudgets]);

  const totalSpentThisMonth = useMemo(() => {
    return categorySummaries.reduce((sum, c) => sum + c.currentSpent, 0);
  }, [categorySummaries]);

  const exceededCategoriesCount = useMemo(() => {
    return categorySummaries.filter((c) => c.isExceeded).length;
  }, [categorySummaries]);

  const warningCategoriesCount = useMemo(() => {
    return categorySummaries.filter((c) => c.percentageUsed >= 80 && !c.isExceeded).length;
  }, [categorySummaries]);

  // Add Custom Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formLimit || isNaN(Number(formLimit))) return;

    setIsSubmitting(true);
    const limit = Math.abs(parseFloat(formLimit));
    const generatedKey = 'custom_' + formName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();

    const newCategory: Omit<CategoryBudget, 'id'> = {
      userId: currentUser?.uid || 'local',
      categoryKey: generatedKey,
      name: formName.trim(),
      monthlyLimit: limit,
      color: formColor,
      icon: formIcon,
      isCustom: true,
      notes: formNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    if (currentUser && !currentUser.isAnonymous) {
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'categoryBudgets'), {
          ...newCategory,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error adding custom category to Firestore:', err);
      }
    } else {
      setCategoryBudgets((prev) => [{ id: 'cat-' + Date.now(), ...newCategory }, ...prev]);
    }

    showToast({
      type: 'success',
      title: t.views.goals.categoryBudgets.toastCreated,
      message: `${formName.trim()} (${formatCurrency(limit)}/mois)`,
    });

    setFormName('');
    setFormLimit('');
    setFormNotes('');
    setShowAddModal(false);
    setIsSubmitting(false);
  };

  // Edit Category Limit
  const handleSaveEditLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;
    const newLimit = parseFloat(editLimitValue);
    if (isNaN(newLimit) || newLimit <= 0) return;

    setIsSubmitting(true);

    if (currentUser && !currentUser.isAnonymous && !editingBudget.id.startsWith('cat-')) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'categoryBudgets', editingBudget.id), {
          monthlyLimit: newLimit,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error updating category limit in Firestore:', err);
      }
    } else {
      setCategoryBudgets((prev) =>
        prev.map((c) => (c.id === editingBudget.id ? { ...c, monthlyLimit: newLimit } : c))
      );
    }

    showToast({
      type: 'success',
      title: t.views.goals.categoryBudgets.toastUpdated,
      message: `${editingBudget.name} : ${formatCurrency(newLimit)}/mois`,
    });

    setEditingBudget(null);
    setIsSubmitting(false);
  };

  // Delete Custom Category
  const handleDeleteCategory = async (id: string, name: string) => {
    if (currentUser && !currentUser.isAnonymous && !id.startsWith('cat-')) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'categoryBudgets', id));
      } catch (err) {
        console.error('Error deleting category budget:', err);
      }
    } else {
      setCategoryBudgets((prev) => prev.filter((c) => c.id !== id));
    }

    showToast({
      type: 'info',
      title: t.views.goals.categoryBudgets.toastDeleted,
      message: name,
    });
  };

  // Reset / Re-populate default student categories
  const handleResetDefaults = async () => {
    if (currentUser && !currentUser.isAnonymous) {
      try {
        for (const cat of defaultSampleCategories) {
          await addDoc(collection(db, 'users', currentUser.uid, 'categoryBudgets'), {
            userId: currentUser.uid,
            categoryKey: cat.categoryKey,
            name: cat.name,
            monthlyLimit: cat.monthlyLimit,
            color: cat.color,
            icon: cat.icon,
            isCustom: false,
            notes: cat.notes,
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Error seeding categories in Firestore:', err);
      }
    } else {
      setCategoryBudgets(defaultSampleCategories);
    }

    showToast({
      type: 'success',
      title: t.views.goals.categoryBudgets.initDefaults,
      message: `${defaultSampleCategories.length} catégories chargées.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Category Budget Banner & Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Allocated Limits */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#161b27] border border-[#1e293b] space-y-1">
          <span className="text-[11px] font-mono text-[#8A8F98] uppercase tracking-wider block">
            {t.views.goals.categoryBudgets.totalAllocated}
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#F5F5F0]">
            {formatCurrency(totalAllocatedLimits)}
          </div>
          <span className="text-[10px] text-[#8A8F98] font-mono">
            {categoryBudgets.length} {t.views.goals.categoryBudgets.categoriesCount.toLowerCase()}
          </span>
        </div>

        {/* Total Spent this Month */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#161b27] border border-[#1e293b] space-y-1">
          <span className="text-[11px] font-mono text-[#8A8F98] uppercase tracking-wider block">
            {t.views.goals.categoryBudgets.totalSpent}
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#38BDF8]">
            {formatCurrency(totalSpentThisMonth)}
          </div>
          <span className="text-[10px] text-[#8A8F98] font-mono">
            {Math.round((totalSpentThisMonth / Math.max(1, totalAllocatedLimits)) * 100)}% de l'enveloppe globale
          </span>
        </div>

        {/* Categories Under Strain / Exceeded */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
          exceededCategoriesCount > 0 
            ? 'bg-[#F43F5E]/10 border-[#F43F5E]/30' 
            : warningCategoriesCount > 0 
            ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30' 
            : 'bg-[#161b27] border-[#1e293b]'
        } space-y-1`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#8A8F98] uppercase tracking-wider block">
              {t.views.goals.categoryBudgets.exceededCount}
            </span>
            {exceededCategoriesCount > 0 ? (
              <Flame className="w-4 h-4 text-[#F43F5E] animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#D4FF3D]" />
            )}
          </div>
          <div className={`text-xl sm:text-2xl font-bold font-mono ${
            exceededCategoriesCount > 0 ? 'text-[#F43F5E]' : warningCategoriesCount > 0 ? 'text-[#F59E0B]' : 'text-[#D4FF3D]'
          }`}>
            {exceededCategoriesCount > 0 ? `${exceededCategoriesCount} dépassé(s)` : `${warningCategoriesCount} sous tension`}
          </div>
          <span className="text-[10px] text-[#8A8F98] font-mono">
            {exceededCategoriesCount === 0 && warningCategoriesCount === 0 
              ? 'Toutes les catégories sont saines' 
              : 'Attention aux dépassements'}
          </span>
        </div>

        {/* Quick Add Custom Category Button Card */}
        <button
          id="btn-add-custom-category"
          onClick={() => setShowAddModal(true)}
          className="p-4 sm:p-5 rounded-2xl bg-[#0B0E17] hover:bg-[#121722] border border-[#D4FF3D]/30 hover:border-[#D4FF3D] transition-all flex flex-col justify-between items-start text-left group cursor-pointer shadow-[0_0_15px_rgba(212,255,61,0.08)]"
        >
          <div className="w-8 h-8 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 flex items-center justify-center text-[#D4FF3D] group-hover:scale-110 transition-transform">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold text-[#F5F5F0] block">
              {t.views.goals.categoryBudgets.addCategory}
            </span>
            <span className="text-[10px] text-[#8A8F98] font-mono">
              Enveloppe & Plafond sur-mesure
            </span>
          </div>
        </button>
      </div>

      {/* Categories Grid List */}
      <div 
        id="category-budgets-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <AnimatePresence>
          {categoryBudgets.length === 0 ? (
            <div className="col-span-full p-10 text-center rounded-3xl bg-[#161b27] border border-[#1e293b] space-y-4">
              <SlidersHorizontal className="w-8 h-8 text-[#8A8F98] mx-auto" />
              <h4 className="text-sm font-semibold text-[#F5F5F0]">
                {t.views.goals.categoryBudgets.emptyTitle}
              </h4>
              <p className="text-xs text-[#8A8F98] max-w-sm mx-auto">
                {t.views.goals.categoryBudgets.emptyDesc}
              </p>
              <button
                onClick={handleResetDefaults}
                className="px-4 py-2 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(212,255,61,0.2)]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.views.goals.categoryBudgets.initDefaults}</span>
              </button>
            </div>
          ) : (
            categoryBudgets.map((cat) => {
              const summary = categorySummaries.find((s) => s.categoryKey === (cat.categoryKey || cat.id)) || {
                categoryKey: cat.categoryKey || cat.id,
                name: cat.name,
                monthlyLimit: cat.monthlyLimit,
                currentSpent: 0,
                percentageUsed: 0,
                isExceeded: false,
                excessAmount: 0,
                remainingAmount: cat.monthlyLimit,
              };

              const IconComponent = getIconComponent(cat.icon);
              const theme = COLOR_THEMES[cat.color as keyof typeof COLOR_THEMES] || COLOR_THEMES.lime;
              const isOver = summary.isExceeded;
              const isWarning = summary.percentageUsed >= 80 && !isOver;
              const percentCapped = Math.min(100, summary.percentageUsed);

              return (
                <motion.div
                  key={cat.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-5 rounded-2xl bg-[#161b27] border ${
                    isOver 
                      ? 'border-[#F43F5E]/50 bg-[#F43F5E]/5' 
                      : isWarning 
                      ? 'border-[#F59E0B]/50' 
                      : 'border-[#1e293b]'
                  } space-y-4 shadow-lg relative group flex flex-col justify-between hover:border-[#8A8F98]/40 transition-colors`}
                >
                  <div className="space-y-3">
                    {/* Header: Icon, Name, Badge, Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${theme.badge}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-semibold text-[#F5F5F0] truncate max-w-[150px] sm:max-w-[180px]">
                              {cat.name}
                            </h3>
                            {cat.isCustom && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
                                {t.views.goals.categoryBudgets.customBadge}
                              </span>
                            )}
                          </div>
                          {cat.notes && (
                            <p className="text-[10px] text-[#8A8F98] truncate max-w-[180px] font-sans mt-0.5">
                              {cat.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Top Right Actions */}
                      <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingBudget(cat);
                            setEditLimitValue(cat.monthlyLimit.toString());
                          }}
                          title={t.views.goals.categoryBudgets.editLimit}
                          className="p-1.5 rounded-lg text-[#8A8F98] hover:text-[#D4FF3D] hover:bg-[#0B0E17] transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {cat.isCustom && (
                          <button
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            title={t.views.goals.categoryBudgets.deleteCategory}
                            className="p-1.5 rounded-lg text-[#8A8F98] hover:text-[#F43F5E] hover:bg-[#0B0E17] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Amount Metrics */}
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-baseline text-xs font-mono">
                        <span className="text-[#8A8F98]">
                          {t.views.goals.categoryBudgets.spentOfLimit
                            .replace('{spent}', formatCurrency(summary.currentSpent))
                            .replace('{limit}', formatCurrency(cat.monthlyLimit))}
                        </span>
                        <span className={`font-bold ${
                          isOver ? 'text-[#F43F5E]' : isWarning ? 'text-[#F59E0B]' : 'text-[#D4FF3D]'
                        }`}>
                          {summary.percentageUsed}%
                        </span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-[#0B0E17] h-2 rounded-full overflow-hidden border border-[#1e293b] relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOver 
                              ? 'bg-[#F43F5E] shadow-[0_0_10px_rgba(244,63,94,0.6)]' 
                              : isWarning 
                              ? 'bg-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.5)]' 
                              : theme.bar
                          }`}
                          style={{ width: `${percentCapped}%` }}
                        />
                      </div>

                      {/* Buffer or Excess Indicator */}
                      <div className="flex justify-between items-center text-[10px] font-mono pt-0.5">
                        <span className="text-[#8A8F98]">
                          Plafond : {formatCurrency(cat.monthlyLimit)}/mois
                        </span>
                        {isOver ? (
                          <span className="text-[#F43F5E] font-bold flex items-center gap-1 bg-[#F43F5E]/15 px-2 py-0.5 rounded border border-[#F43F5E]/30">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {t.views.goals.categoryBudgets.overspentBy.replace('{amount}', formatCurrency(summary.excessAmount))}
                          </span>
                        ) : (
                          <span className="text-[#B8BCC4]">
                            {t.views.goals.categoryBudgets.remainingToSpend.replace('{amount}', formatCurrency(summary.remainingAmount))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ask Copilot Ney on this Category */}
                  <button
                    onClick={() => {
                      if (onNavigateToChat) {
                        const prompt = t.views.goals.categoryBudgets.consultNeyPrompt
                          .replace('{name}', cat.name)
                          .replace('{limit}', formatCurrency(cat.monthlyLimit))
                          .replace('{spent}', formatCurrency(summary.currentSpent));
                        onNavigateToChat(prompt);
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#0B0E17] hover:bg-[#121722] text-[#8A8F98] hover:text-[#D4FF3D] border border-[#1e293b] hover:border-[#D4FF3D]/30 text-[11px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer mt-3"
                  >
                    <MessageSquare className="w-3 h-3 text-[#D4FF3D]" />
                    <span>{t.views.goals.categoryBudgets.consultNey}</span>
                  </button>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Add Custom Category Modal */}
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
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-[#F5F5F0]">
                    {t.views.goals.categoryBudgets.modalAddTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-full hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#F5F5F0] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddCategory} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.categoryBudgets.formName}
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t.views.goals.categoryBudgets.formNamePlaceholder}
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.categoryBudgets.formLimit} ({currency}/mois)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={formLimit}
                    onChange={(e) => setFormLimit(e.target.value)}
                    placeholder="80"
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]"
                  />
                </div>

                {/* Icon Selector */}
                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.categoryBudgets.formIcon}
                  </label>
                  <div className="grid grid-cols-6 gap-2 bg-[#0B0E17] p-2.5 rounded-2xl border border-[#1e293b]">
                    {AVAILABLE_ICONS.map((item) => {
                      const Icon = item.icon;
                      const isSelected = formIcon === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormIcon(item.id)}
                          className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#D4FF3D] text-[#0B0E17] shadow-[0_0_10px_rgba(212,255,61,0.4)]'
                              : 'text-[#8A8F98] hover:text-[#F5F5F0] hover:bg-[#161b27]'
                          }`}
                          title={item.label}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Theme Selector */}
                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.categoryBudgets.formColor}
                  </label>
                  <div className="flex items-center gap-2.5 bg-[#0B0E17] p-2.5 rounded-2xl border border-[#1e293b]">
                    {Object.keys(COLOR_THEMES).map((cKey) => {
                      const theme = COLOR_THEMES[cKey as keyof typeof COLOR_THEMES];
                      const isSelected = formColor === cKey;
                      return (
                        <button
                          key={cKey}
                          type="button"
                          onClick={() => setFormColor(cKey as keyof typeof COLOR_THEMES)}
                          className={`w-6 h-6 rounded-full ${theme.dot} transition-all cursor-pointer relative ${
                            isSelected ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.categoryBudgets.formNotes}
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder={t.views.goals.categoryBudgets.formNotesPlaceholder}
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 rounded-full bg-[#0B0E17] hover:bg-[#1e293b] text-[#8A8F98] border border-[#1e293b] text-xs font-semibold transition-all cursor-pointer"
                  >
                    {t.views.goals.form.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] cursor-pointer"
                  >
                    {t.views.goals.categoryBudgets.formSubmitAdd}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Category Limit Modal */}
      <AnimatePresence>
        {editingBudget && (
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
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#F5F5F0]">
                      {t.views.goals.categoryBudgets.modalEditTitle}
                    </h3>
                    <p className="text-xs text-[#8A8F98]">
                      {editingBudget.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingBudget(null)}
                  className="p-1.5 rounded-full hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#F5F5F0] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditLimit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.categoryBudgets.formLimit} ({currency}/mois)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={editLimitValue}
                    onChange={(e) => setEditLimitValue(e.target.value)}
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-sm text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] text-xs text-[#8A8F98] space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Ancien plafond :</span>
                    <span className="text-[#F5F5F0]">{formatCurrency(editingBudget.monthlyLimit)}/mois</span>
                  </div>
                  <div className="flex justify-between text-[#D4FF3D]">
                    <span>Nouveau plafond :</span>
                    <span>{formatCurrency(parseFloat(editLimitValue) || 0)}/mois</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingBudget(null)}
                    className="flex-1 py-3 rounded-full bg-[#0B0E17] hover:bg-[#1e293b] text-[#8A8F98] border border-[#1e293b] text-xs font-semibold transition-all cursor-pointer"
                  >
                    {t.views.goals.form.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] cursor-pointer"
                  >
                    {t.views.goals.categoryBudgets.formSubmitEdit}
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
