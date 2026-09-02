import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { Goal } from '../types';
import { db } from '../lib/firebase';
import { CategoryBudgetManager } from '../components/goals/CategoryBudgetManager';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  updateDoc 
} from 'firebase/firestore';
import { 
  Target, 
  Plus, 
  Sparkles, 
  ShieldCheck, 
  Plane, 
  Laptop, 
  GraduationCap, 
  Compass, 
  Trash2, 
  MessageSquare, 
  X,
  TrendingUp,
  Clock,
  SlidersHorizontal,
  FolderLock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const GoalsView: React.FC<{ onNavigateToChat?: (initialQuery?: string) => void }> = ({ onNavigateToChat }) => {
  const { t, formatCurrency, formatDate, currency, region, language } = useTranslation();
  const { currentUser, userProfile, computedRunway } = useAuth();

  const [activeTab, setActiveTab] = useState<'categories' | 'goals'>('categories');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formCurrent, setFormCurrent] = useState('');
  const [formCategory, setFormCategory] = useState<Goal['category']>('emergency');
  const [formDeadline, setFormDeadline] = useState('');

  // Sample initial student goals
  const defaultSampleGoals: Goal[] = [
    {
      id: 'goal-1',
      userId: 'local',
      name: language === 'en'
        ? (region === 'GB' ? 'Emergency Buffer (1 Month Rent)' : 'Emergency Safety Net (1 Month Buffer)')
        : (region === 'BE' ? 'Matelas de secours (1 mois loyer Kot)' : region === 'CH' ? 'Réserve d\'urgence (1 mois loyer)' : 'Matelas de sécurité (1 mois loyer Crous)'),
      targetAmount: region === 'CH' ? 800 : region === 'US' ? 700 : region === 'GB' ? 550 : 450,
      currentAmount: region === 'CH' ? 350 : region === 'US' ? 300 : region === 'GB' ? 220 : 180,
      category: 'emergency',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'goal-2',
      userId: 'local',
      name: language === 'en'
        ? (region === 'US' ? 'Spring Break Trip & Flight' : region === 'GB' ? 'Summer Festival & Eurostar' : 'Summer Trip & Festival')
        : 'Voyage d\'été & festival',
      targetAmount: 350,
      currentAmount: 140,
      deadline: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      category: 'trip',
      createdAt: new Date().toISOString(),
    },
  ];

  // Firestore synchronization
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) {
      setGoals(defaultSampleGoals);
      return;
    }

    try {
      const goalsRef = collection(db, 'users', currentUser.uid, 'goals');
      const unsubscribe = onSnapshot(goalsRef, (snapshot) => {
        if (!snapshot.empty) {
          const loaded: Goal[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Goal, 'id'>),
          }));
          setGoals(loaded);
        } else {
          setGoals(defaultSampleGoals);
        }
      }, (err) => {
        console.warn('Goals sync fallback:', err);
        setGoals(defaultSampleGoals);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Firestore goals listener error:', err);
      setGoals(defaultSampleGoals);
    }
  }, [currentUser, region]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formTarget || isNaN(Number(formTarget))) return;

    setIsSubmitting(true);
    const targetAmt = Math.abs(parseFloat(formTarget));
    const currentAmt = formCurrent ? Math.abs(parseFloat(formCurrent)) : 0;

    const newGoal: Omit<Goal, 'id'> = {
      userId: currentUser?.uid || 'local',
      name: formName,
      targetAmount: targetAmt,
      currentAmount: currentAmt,
      category: formCategory,
      deadline: formDeadline || undefined,
      createdAt: new Date().toISOString(),
    };

    if (currentUser && !currentUser.isAnonymous) {
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'goals'), {
          ...newGoal,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error adding goal to Firestore:', err);
      }
    } else {
      setGoals((prev) => [{ id: 'goal-' + Date.now(), ...newGoal }, ...prev]);
    }

    setFormName('');
    setFormTarget('');
    setFormCurrent('');
    setFormDeadline('');
    setShowAddModal(false);
    setIsSubmitting(false);
  };

  const handleDeleteGoal = async (id: string) => {
    if (currentUser && !currentUser.isAnonymous && !id.startsWith('goal-')) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'goals', id));
      } catch (err) {
        console.error('Error deleting goal:', err);
      }
    } else {
      setGoals((prev) => prev.filter((g) => g.id !== id));
    }
  };

  const getCategoryVisual = (category: Goal['category']) => {
    switch (category) {
      case 'emergency':
        return {
          icon: ShieldCheck,
          label: t.views.goals.types.emergency,
          badgeColor: 'bg-[#D4FF3D]/15 text-[#D4FF3D] border-[#D4FF3D]/30',
        };
      case 'trip':
        return {
          icon: Plane,
          label: t.views.goals.types.trip,
          badgeColor: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
        };
      case 'equipment':
        return {
          icon: Laptop,
          label: t.views.goals.types.equipment,
          badgeColor: 'bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30',
        };
      case 'tuition':
        return {
          icon: GraduationCap,
          label: t.views.goals.types.tuition,
          badgeColor: 'bg-[#FACC15]/15 text-[#FACC15] border-[#FACC15]/30',
        };
      default:
        return {
          icon: Compass,
          label: t.views.goals.types.other,
          badgeColor: 'bg-[#8A8F98]/15 text-[#F5F5F0] border-[#1e293b]',
        };
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#D4FF3D] text-[11px] font-bold tracking-[0.15em] uppercase font-mono px-2 py-0.5 rounded-md bg-[#D4FF3D]/10 border border-[#D4FF3D]/20">
              {t.views.goals.badge}
            </span>
            <span className="text-xs text-[#8A8F98] font-mono">
              • Context Injection Live
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-[#F5F5F0]">
            {t.views.goals.title}
          </h2>
          <p className="text-xs md:text-sm text-[#8A8F98] mt-1 max-w-2xl">
            {t.views.goals.subtitle}
          </p>
        </div>

        {activeTab === 'goals' && (
          <button
            id="btn-add-goal"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.views.goals.addGoal}</span>
          </button>
        )}
      </header>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#161b27] border border-[#1e293b] w-fit">
        <button
          id="tab-category-budgets"
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-[#D4FF3D] text-[#0B0E17] shadow-[0_0_15px_rgba(212,255,61,0.3)]'
              : 'text-[#8A8F98] hover:text-[#F5F5F0]'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{t.views.goals.tabs?.categories || 'Plafonds & Catégories Personnalisées'}</span>
        </button>

        <button
          id="tab-savings-goals"
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'goals'
              ? 'bg-[#D4FF3D] text-[#0B0E17] shadow-[0_0_15px_rgba(212,255,61,0.3)]'
              : 'text-[#8A8F98] hover:text-[#F5F5F0]'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>{t.views.goals.tabs?.goals || 'Objectifs d\'Épargne'}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
            activeTab === 'goals' ? 'bg-[#0B0E17]/20 text-[#0B0E17]' : 'bg-[#0B0E17] text-[#8A8F98]'
          }`}>
            {goals.length}
          </span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'categories' ? (
        <CategoryBudgetManager onNavigateToChat={onNavigateToChat} />
      ) : (
        /* Goals Grid */
        <div 
          id="goals-intentions-grid"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          <AnimatePresence>
            {goals.length === 0 ? (
              <div className="col-span-full p-12 text-center rounded-3xl bg-[#161b27] border border-[#1e293b] space-y-3">
                <Target className="w-8 h-8 text-[#8A8F98] mx-auto" />
                <h4 className="text-sm font-semibold text-[#F5F5F0]">
                  {t.views.goals.emptyTitle}
                </h4>
                <p className="text-xs text-[#8A8F98] max-w-sm mx-auto">
                  {t.views.goals.emptyDesc}
                </p>
              </div>
            ) : (
              goals.map((g) => {
                const visual = getCategoryVisual(g.category);
                const Icon = visual.icon;
                const percent = Math.min(100, Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100));
                const remaining = Math.max(0, g.targetAmount - g.currentAmount);

                return (
                  <motion.div
                    key={g.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-6 rounded-3xl bg-[#161b27] border border-[#1e293b] space-y-5 shadow-xl relative group flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-2xl border ${visual.badgeColor}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-semibold text-[#F5F5F0]">
                              {g.name}
                            </h3>
                            <span className="text-[10px] text-[#8A8F98] font-mono">
                              {visual.label}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteGoal(g.id)}
                          className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-[#8A8F98] hover:text-[#F43F5E] hover:bg-[#0B0E17] opacity-80 group-hover:opacity-100 transition-all cursor-pointer flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Progress Bar & Numerical Metrics */}
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between items-baseline text-xs font-mono">
                          <span className="text-[#8A8F98]">
                            {t.views.goals.savedSoFar}: <strong className="text-[#F5F5F0]">{formatCurrency(g.currentAmount)}</strong>
                          </span>
                          <span className="text-[#D4FF3D] font-bold">
                            {percent}%
                          </span>
                        </div>

                        <div className="w-full bg-[#0B0E17] h-2 rounded-full overflow-hidden border border-[#1e293b]">
                          <div
                            className="bg-[#D4FF3D] h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(212,255,61,0.5)]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-[#8A8F98] font-mono pt-1">
                          <span>{t.views.goals.targetLabel}: {formatCurrency(g.targetAmount)}</span>
                          <span>{t.views.goals.remaining}: {formatCurrency(remaining)}</span>
                        </div>
                      </div>

                      {g.deadline && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#B8BCC4] font-mono bg-[#0B0E17] px-3 py-1.5 rounded-xl border border-[#1e293b] w-fit">
                          <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>{t.views.goals.deadlineLabel} : {formatDate(new Date(g.deadline))}</span>
                        </div>
                      )}
                    </div>

                    {/* Ask Ney Action */}
                    <button
                      onClick={() => {
                        if (onNavigateToChat) {
                          const targetFormatted = formatCurrency(g.targetAmount);
                          const deadlineText = g.deadline ? formatDate(new Date(g.deadline)) : t.views.goals.defaultGoalDeadline;
                          const query = t.views.goals.consultNeyGoalPrompt
                            .replace('{name}', g.name)
                            .replace('{target}', targetFormatted)
                            .replace('{deadline}', deadlineText);
                          onNavigateToChat(query);
                        }
                      }}
                      className="w-full py-3 px-4 min-h-[44px] rounded-2xl bg-[#0B0E17] hover:bg-[#121722] text-[#D4FF3D] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer mt-4"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{t.views.goals.consultNeyForGoal}</span>
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Add Goal Modal */}
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
                    <Target className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-[#F5F5F0]">
                    {t.views.goals.createCta}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl hover:bg-[#1e293b] text-[#8A8F98] hover:text-[#F5F5F0] transition-colors cursor-pointer flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddGoal} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.form.name}
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t.views.goals.form.placeholders?.[region] || t.views.goals.form.placeholders?.FR || "ex: Caution nouveau Kot, Festival..."}
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                      {t.views.goals.form.target} ({currency})
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={formTarget}
                      onChange={(e) => setFormTarget(e.target.value)}
                      placeholder="500"
                      className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                      {t.views.goals.form.current} ({currency})
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formCurrent}
                      onChange={(e) => setFormCurrent(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.form.category}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as Goal['category'])}
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]"
                  >
                    <option value="emergency">{t.views.goals.types.emergency}</option>
                    <option value="trip">{t.views.goals.types.trip}</option>
                    <option value="equipment">{t.views.goals.types.equipment}</option>
                    <option value="tuition">{t.views.goals.types.tuition}</option>
                    <option value="other">{t.views.goals.types.other}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#8A8F98] block mb-1.5">
                    {t.views.goals.form.deadline}
                  </label>
                  <input
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]"
                  />
                </div>

                <div className="pt-3 flex gap-3">
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
                    {t.views.goals.form.submit}
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
