import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { Transaction, TransactionCategory, TransactionType } from '../../types';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Target, 
  Sparkles, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  AlertCircle,
  BarChart3,
  PieChart,
  SlidersHorizontal,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewMode = 'stacked' | 'categories' | 'budget';
type TimeRange = 3 | 6;

interface MonthSpendingData {
  monthKey: string; // YYYY-MM
  label: string;
  monthIndex: number;
  year: number;
  fixed: number;
  essential: number;
  impulse: number;
  total: number;
  budgetGoal: number;
  isCurrentMonth: boolean;
  housing: number;
  food: number;
  transport: number;
  subscriptions: number;
  leisure: number;
  other: number;
}

export const MonthlySpendingTrendsChart: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t, formatCurrency, language, region, currency } = useTranslation();
  const { currentUser, userProfile, computedRunway } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('stacked');
  const [timeRange, setTimeRange] = useState<TimeRange>(6);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const cached = localStorage.getItem('neyrunway_transactions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Baseline user variables
  const fixedMonthly = computedRunway?.totalFixedExpenses ?? userProfile?.monthlyFixedExpenses ?? 450;
  const defaultBudgetLimit = region === 'CH' ? 1000 : region === 'US' ? 900 : region === 'GB' ? 750 : region === 'CA' ? 850 : 550;
  const monthlyBudgetGoal = userProfile?.monthlyBudgetGoal ?? defaultBudgetLimit;

  // Real-time Firestore transaction sync
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) {
      return;
    }

    try {
      const q = query(
        collection(db, 'users', currentUser.uid, 'transactions'),
        orderBy('date', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const loaded: Transaction[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Transaction, 'id'>),
          }));
          setTransactions(loaded);
        }
      }, (error) => {
        console.warn('Firestore spending trends notice (using cached data):', error);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Transactions listener error:', err);
    }
  }, [currentUser]);

  // Generate realistic historical student data if user is new or has few records
  const processedMonthlyData = useMemo<MonthSpendingData[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth(); // 0 to 11

    const monthsCount = timeRange;
    const generatedMonths: MonthSpendingData[] = [];

    // Create month buckets starting from (monthsCount - 1) months ago up to current month
    for (let i = monthsCount - 1; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonthIndex - i, 1);
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      
      const monthName = targetDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
        month: 'short',
      });
      const capitalizedLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      const isCurrentMonth = i === 0;

      // Realistic regional variations for student baseline fallback
      const baseHousing = Math.round(fixedMonthly * 0.72);
      const baseSubs = Math.round(fixedMonthly * 0.15);
      const baseTransport = Math.round(fixedMonthly * 0.13);

      // Variation factor per past month to simulate realistic seasonality
      const variationCoeff = i === 0 ? 0.85 : (1 + Math.sin(i * 1.5) * 0.12);
      const baseFood = Math.round((region === 'CH' ? 320 : region === 'US' ? 280 : region === 'GB' ? 240 : 210) * variationCoeff);
      const baseLeisure = Math.round((region === 'CH' ? 140 : region === 'US' ? 120 : region === 'GB' ? 95 : 85) * variationCoeff);
      const baseOther = Math.round(45 * variationCoeff);

      // Look for actual user transactions in this month
      const userMonthTx = transactions.filter((tx) => {
        if (!tx.date) return false;
        return tx.date.startsWith(monthKey);
      });

      let fixed = 0;
      let essential = 0;
      let impulse = 0;
      let housing = 0;
      let food = 0;
      let transport = 0;
      let subscriptions = 0;
      let leisure = 0;
      let other = 0;

      if (userMonthTx.length > 0) {
        userMonthTx.forEach((tx) => {
          const amt = Math.max(0, Number(tx.amount) || 0);
          
          // Categorize by Type
          if (tx.type === 'fixed' || tx.isRecurring) {
            fixed += amt;
          } else if (tx.category === 'leisure' || tx.category === 'shopping' || (tx as any).tag === 'impulse') {
            impulse += amt;
          } else {
            essential += amt;
          }

          // Categorize by Category
          switch (tx.category) {
            case 'housing':
              housing += amt;
              break;
            case 'food':
              food += amt;
              break;
            case 'transport':
              transport += amt;
              break;
            case 'subscriptions':
              subscriptions += amt;
              break;
            case 'leisure':
            case 'shopping':
              leisure += amt;
              break;
            default:
              other += amt;
              break;
          }
        });
      } else {
        // Fallback realistic seed adapted to current student profile
        fixed = fixedMonthly;
        housing = baseHousing;
        subscriptions = baseSubs;
        transport = baseTransport;

        essential = baseFood + baseOther;
        food = baseFood;
        other = baseOther;

        impulse = baseLeisure;
        leisure = baseLeisure;
      }

      const total = Math.round(fixed + essential + impulse);

      generatedMonths.push({
        monthKey,
        label: capitalizedLabel,
        monthIndex: m,
        year: y,
        fixed: Math.round(fixed),
        essential: Math.round(essential),
        impulse: Math.round(impulse),
        total,
        budgetGoal: monthlyBudgetGoal,
        isCurrentMonth,
        housing: Math.round(housing),
        food: Math.round(food),
        transport: Math.round(transport),
        subscriptions: Math.round(subscriptions),
        leisure: Math.round(leisure),
        other: Math.round(other),
      });
    }

    return generatedMonths;
  }, [timeRange, language, region, fixedMonthly, monthlyBudgetGoal, transactions]);

  // Aggregate Key Performance Metrics
  const metrics = useMemo(() => {
    if (processedMonthlyData.length === 0) {
      return {
        currentMonthSpend: 0,
        monthlyAverage: 0,
        impulseRatio: 0,
        momVelocity: 0,
        isVelocityPositive: false,
        topCategory: 'food',
        topCategoryAmount: 0,
      };
    }

    const current = processedMonthlyData[processedMonthlyData.length - 1];
    const previous = processedMonthlyData.length >= 2 
      ? processedMonthlyData[processedMonthlyData.length - 2] 
      : current;

    const totalSum = processedMonthlyData.reduce((acc, m) => acc + m.total, 0);
    const monthlyAverage = Math.round(totalSum / processedMonthlyData.length);

    const totalImpulseSum = processedMonthlyData.reduce((acc, m) => acc + m.impulse, 0);
    const impulseRatio = totalSum > 0 ? Math.round((totalImpulseSum / totalSum) * 100) : 15;

    // Month-over-Month Velocity
    let momVelocity = 0;
    if (previous.total > 0) {
      momVelocity = Math.round(((current.total - previous.total) / previous.total) * 100);
    }

    // Top Category across period
    const catSums = {
      housing: processedMonthlyData.reduce((acc, m) => acc + m.housing, 0),
      food: processedMonthlyData.reduce((acc, m) => acc + m.food, 0),
      transport: processedMonthlyData.reduce((acc, m) => acc + m.transport, 0),
      subscriptions: processedMonthlyData.reduce((acc, m) => acc + m.subscriptions, 0),
      leisure: processedMonthlyData.reduce((acc, m) => acc + m.leisure, 0),
      other: processedMonthlyData.reduce((acc, m) => acc + m.other, 0),
    };

    let topCategory = 'food';
    let topCategoryAmount = 0;
    (Object.keys(catSums) as Array<keyof typeof catSums>).forEach((cat) => {
      if (catSums[cat] > topCategoryAmount) {
        topCategoryAmount = catSums[cat];
        topCategory = cat;
      }
    });

    return {
      currentMonthSpend: current.total,
      monthlyAverage,
      impulseRatio,
      momVelocity,
      isVelocityPositive: momVelocity > 0,
      topCategory,
      topCategoryAmount,
    };
  }, [processedMonthlyData]);

  // Color Palette tailored to Neyrunway Dark Luxury Design System
  const palette = {
    fixed: '#38BDF8', // Cyan / Steel Blue
    essential: '#34D399', // Emerald
    impulse: '#FBBF24', // Amber
    housing: '#60A5FA', // Blue
    food: '#34D399', // Emerald
    transport: '#F472B6', // Rose
    subscriptions: '#A78BFA', // Purple
    leisure: '#FBBF24', // Amber
    other: '#94A3B8', // Slate
    budget: '#D4FF3D', // Electric Lime
    trendLine: '#D4FF3D',
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data: MonthSpendingData = payload[0]?.payload;
    if (!data) return null;

    return (
      <div 
        id="spending-trends-tooltip"
        className="bg-[#0B0E17]/95 backdrop-blur-md border border-[#1e293b] p-4 rounded-2xl shadow-2xl font-mono text-xs z-50 min-w-[220px]"
      >
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-2">
          <span className="text-[#F5F5F0] font-bold text-sm">{data.label} {data.year}</span>
          {data.isCurrentMonth && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/20">
              {language === 'fr' ? 'En cours' : 'Current'}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {viewMode === 'stacked' && (
            <>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
                  <span>{t.views.dashboard.spendingTrends?.fixedCommitments || 'Fixed Commitments'}</span>
                </div>
                <span className="font-medium text-[#F5F5F0]">{formatCurrency(data.fixed)}</span>
              </div>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
                  <span>{t.views.dashboard.spendingTrends?.essentialLiving || 'Essential Variable'}</span>
                </div>
                <span className="font-medium text-[#F5F5F0]">{formatCurrency(data.essential)}</span>
              </div>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" />
                  <span>{t.views.dashboard.spendingTrends?.impulseDiscretionary || 'Impulse & Leisure'}</span>
                </div>
                <span className="font-medium text-[#F5F5F0]">{formatCurrency(data.impulse)}</span>
              </div>
            </>
          )}

          {viewMode === 'categories' && (
            <>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#60A5FA]" />
                  <span>{t.views.dashboard.spendingTrends?.categoryLabels?.housing || 'Housing'}</span>
                </div>
                <span className="font-medium text-[#F5F5F0]">{formatCurrency(data.housing)}</span>
              </div>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                  <span>{t.views.dashboard.spendingTrends?.categoryLabels?.food || 'Food'}</span>
                </div>
                <span className="font-medium text-[#F5F5F0]">{formatCurrency(data.food)}</span>
              </div>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F472B6]" />
                  <span>{t.views.dashboard.spendingTrends?.categoryLabels?.transport || 'Transport'}</span>
                </div>
                <span className="font-medium text-[#F5F5F0]">{formatCurrency(data.transport)}</span>
              </div>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#A78BFA]" />
                  <span>{t.views.dashboard.spendingTrends?.categoryLabels?.subscriptions || 'Subscriptions'}</span>
                </div>
                <span className="font-medium text-[#F5F5F0]">{formatCurrency(data.subscriptions)}</span>
              </div>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                  <span>{t.views.dashboard.spendingTrends?.categoryLabels?.leisure || 'Leisure'}</span>
                </div>
                <span className="font-medium text-[#F5F5F0]">{formatCurrency(data.leisure)}</span>
              </div>
            </>
          )}

          {viewMode === 'budget' && (
            <>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <span>{t.views.dashboard.spendingTrends?.totalSpend || 'Total Spend'}</span>
                <span className="font-bold text-[#F5F5F0]">{formatCurrency(data.total)}</span>
              </div>
              <div className="flex items-center justify-between text-[#8A8F98]">
                <span>{t.views.dashboard.spendingTrends?.budgetCap || 'Budget Cap'}</span>
                <span className="font-medium text-[#D4FF3D]">{formatCurrency(data.budgetGoal)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#1e293b]">
                <span className={data.total <= data.budgetGoal ? 'text-emerald-400' : 'text-amber-400'}>
                  {data.total <= data.budgetGoal 
                    ? `✓ -${formatCurrency(data.budgetGoal - data.total)}` 
                    : `⚠ +${formatCurrency(data.total - data.budgetGoal)}`}
                </span>
                <span className="text-[#8A8F98]">
                  {Math.round((data.total / (data.budgetGoal || 1)) * 100)}%
                </span>
              </div>
            </>
          )}

          <div className="border-t border-[#1e293b] pt-2 mt-2 flex items-center justify-between font-bold">
            <span className="text-[#8A8F98] uppercase text-[10px]">
              {t.views.dashboard.spendingTrends?.totalSpend || 'Total Outflow'}
            </span>
            <span className="text-[#D4FF3D] text-sm">{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>
    );
  };

  const getLocalizedCategoryName = (cat: string) => {
    const labels = t.views.dashboard.spendingTrends?.categoryLabels;
    switch (cat) {
      case 'housing':
        return labels?.housing || 'Housing & Rent';
      case 'food':
        return labels?.food || 'Food & Groceries';
      case 'transport':
        return labels?.transport || 'Transport';
      case 'subscriptions':
        return labels?.subscriptions || 'Subscriptions';
      case 'leisure':
        return labels?.leisure || 'Leisure & Outings';
      case 'education':
        return labels?.education || 'Studies';
      case 'shopping':
        return labels?.shopping || 'Shopping';
      case 'health':
        return labels?.health || 'Health';
      default:
        return labels?.other || 'Other';
    }
  };

  return (
    <div 
      id="monthly-spending-trends-container"
      className={`bg-gradient-to-br from-[#161b27] via-[#121622] to-[#0B0E17] border border-[#1e293b] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[#38BDF8]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10 pb-6 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[#38BDF8] text-[10px] font-bold tracking-[0.15em] uppercase font-mono px-2 py-0.5 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              {t.views.dashboard.spendingTrends?.badge || 'Recharts Spending Analytics'}
            </span>
            <span className="text-xs text-[#8A8F98] font-mono">
              • {timeRange} {language === 'fr' ? 'mois' : 'months'}
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-light text-[#F5F5F0] tracking-tight">
            {t.views.dashboard.spendingTrends?.title || 'Monthly Spending Trends & Patterns'}
          </h3>
          <p className="text-xs text-[#8A8F98] mt-1 max-w-2xl leading-relaxed">
            {t.views.dashboard.spendingTrends?.subtitle || 'Multi-month retrospective expenditure analysis comparing fixed commitments, essential living and discretionary flows'}
          </p>
        </div>

        {/* Action Controls: View Modes & Time Range */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Range Selector */}
          <div className="bg-[#0B0E17] p-1 rounded-full border border-[#1e293b] flex items-center">
            <button
              id="btn-spending-range-3m"
              onClick={() => setTimeRange(3)}
              className={`px-3 py-1 text-xs font-mono rounded-full transition-all cursor-pointer ${
                timeRange === 3 
                  ? 'bg-[#1e293b] text-[#F5F5F0] font-bold shadow-sm' 
                  : 'text-[#8A8F98] hover:text-[#F5F5F0]'
              }`}
            >
              {t.views.dashboard.spendingTrends?.range3Months || '3M'}
            </button>
            <button
              id="btn-spending-range-6m"
              onClick={() => setTimeRange(6)}
              className={`px-3 py-1 text-xs font-mono rounded-full transition-all cursor-pointer ${
                timeRange === 6 
                  ? 'bg-[#1e293b] text-[#F5F5F0] font-bold shadow-sm' 
                  : 'text-[#8A8F98] hover:text-[#F5F5F0]'
              }`}
            >
              {t.views.dashboard.spendingTrends?.range6Months || '6M'}
            </button>
          </div>

          {/* View Mode Selector Tabs */}
          <div className="bg-[#0B0E17] p-1 rounded-2xl border border-[#1e293b] flex items-center">
            <button
              id="btn-spending-view-stacked"
              onClick={() => setViewMode('stacked')}
              className={`px-3 py-1.5 text-xs font-mono rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'stacked'
                  ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_10px_rgba(212,255,61,0.2)]'
                  : 'text-[#8A8F98] hover:text-[#F5F5F0]'
              }`}
              title={t.views.dashboard.spendingTrends?.viewTypeStacked}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Par Nature' : 'By Type'}</span>
            </button>

            <button
              id="btn-spending-view-categories"
              onClick={() => setViewMode('categories')}
              className={`px-3 py-1.5 text-xs font-mono rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'categories'
                  ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_10px_rgba(212,255,61,0.2)]'
                  : 'text-[#8A8F98] hover:text-[#F5F5F0]'
              }`}
              title={t.views.dashboard.spendingTrends?.viewTypeCategories}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Catégories' : 'Categories'}</span>
            </button>

            <button
              id="btn-spending-view-budget"
              onClick={() => setViewMode('budget')}
              className={`px-3 py-1.5 text-xs font-mono rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'budget'
                  ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_10px_rgba(212,255,61,0.2)]'
                  : 'text-[#8A8F98] hover:text-[#F5F5F0]'
              }`}
              title={t.views.dashboard.spendingTrends?.viewTypeBudget}
            >
              <Target className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Vs Budget' : 'Vs Budget'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Elevators Summary Bar */}
      <div 
        id="spending-trends-metrics-grid"
        className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6"
      >
        {/* Metric 1: Current Month Spend */}
        <div className="bg-[#0B0E17]/60 border border-[#1e293b] p-4 rounded-2xl">
          <span className="text-[10px] text-[#8A8F98] uppercase font-mono tracking-wider block mb-1">
            {t.views.dashboard.spendingTrends?.currentMonthTotal || 'Current Month'}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-[#F5F5F0]">
              {formatCurrency(metrics.currentMonthSpend)}
            </span>
          </div>
          <span className="text-[10px] text-[#8A8F98] font-mono mt-1 block">
            {Math.round((metrics.currentMonthSpend / (monthlyBudgetGoal || 1)) * 100)}% {language === 'fr' ? 'du budget' : 'of budget'}
          </span>
        </div>

        {/* Metric 2: Monthly Average */}
        <div className="bg-[#0B0E17]/60 border border-[#1e293b] p-4 rounded-2xl">
          <span className="text-[10px] text-[#8A8F98] uppercase font-mono tracking-wider block mb-1">
            {t.views.dashboard.spendingTrends?.monthlyAverage || 'Monthly Average'}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-[#38BDF8]">
              {formatCurrency(metrics.monthlyAverage)}
            </span>
          </div>
          <span className="text-[10px] text-[#8A8F98] font-mono mt-1 block">
            {timeRange} {language === 'fr' ? 'mois glissants' : 'rolling months'}
          </span>
        </div>

        {/* Metric 3: Impulse / Variable Ratio */}
        <div className="bg-[#0B0E17]/60 border border-[#1e293b] p-4 rounded-2xl">
          <span className="text-[10px] text-[#8A8F98] uppercase font-mono tracking-wider block mb-1">
            {t.views.dashboard.spendingTrends?.impulseRatio || 'Impulse Ratio'}
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${metrics.impulseRatio > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {metrics.impulseRatio}%
            </span>
          </div>
          <span className="text-[10px] text-[#8A8F98] font-mono mt-1 block">
            {metrics.impulseRatio <= 20 
              ? (language === 'fr' ? '✓ Maîtrisé' : '✓ Well balanced') 
              : (language === 'fr' ? '⚠ À surveiller' : '⚠ High leisure')}
          </span>
        </div>

        {/* Metric 4: MoM Velocity & Top Category */}
        <div className="bg-[#0B0E17]/60 border border-[#1e293b] p-4 rounded-2xl">
          <span className="text-[10px] text-[#8A8F98] uppercase font-mono tracking-wider block mb-1">
            {t.views.dashboard.spendingTrends?.highestCategory || 'Top Category'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm sm:text-base font-bold font-mono text-[#F5F5F0] truncate">
              {getLocalizedCategoryName(metrics.topCategory)}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {metrics.momVelocity <= 0 ? (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center">
                <ArrowDownRight className="w-3 h-3" /> {Math.abs(metrics.momVelocity)}% MoM
              </span>
            ) : (
              <span className="text-[10px] font-mono text-amber-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> +{metrics.momVelocity}% MoM
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recharts Chart Visualization Canvas */}
      <div 
        id="spending-trends-recharts-stage"
        className="w-full h-[320px] sm:h-[360px] relative mt-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'stacked' ? (
            <ComposedChart
              data={processedMonthlyData}
              margin={{ top: 20, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#1e293b" 
                vertical={false} 
                opacity={0.6}
              />
              <XAxis 
                dataKey="label" 
                stroke="#8A8F98" 
                fontSize={11} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
              />
              <YAxis 
                stroke="#8A8F98" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val} ${currency === 'EUR' ? '€' : currency}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine 
                y={monthlyBudgetGoal} 
                stroke="#D4FF3D" 
                strokeDasharray="4 4" 
                strokeOpacity={0.6}
                label={{
                  value: `${language === 'fr' ? 'Budget' : 'Cap'} (${monthlyBudgetGoal} ${currency === 'EUR' ? '€' : currency})`,
                  fill: '#D4FF3D',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  position: 'insideTopRight',
                }}
              />
              {/* Stacked Bars: Fixed, Essential, Impulse */}
              <Bar 
                dataKey="fixed" 
                name={t.views.dashboard.spendingTrends?.fixedCommitments || 'Fixed'} 
                stackId="spend" 
                fill={palette.fixed} 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="essential" 
                name={t.views.dashboard.spendingTrends?.essentialLiving || 'Essential'} 
                stackId="spend" 
                fill={palette.essential} 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="impulse" 
                name={t.views.dashboard.spendingTrends?.impulseDiscretionary || 'Impulse'} 
                stackId="spend" 
                fill={palette.impulse} 
                radius={[6, 6, 0, 0]}
              />
              {/* Overall Monthly Spend Trajectory Line */}
              <Line
                type="monotone"
                dataKey="total"
                name={t.views.dashboard.spendingTrends?.trendLine || 'Total Trajectory'}
                stroke={palette.trendLine}
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0B0E17', stroke: palette.trendLine, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: palette.trendLine, stroke: '#0B0E17', strokeWidth: 2 }}
              />
            </ComposedChart>
          ) : viewMode === 'categories' ? (
            <BarChart
              data={processedMonthlyData}
              margin={{ top: 20, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#1e293b" 
                vertical={false} 
                opacity={0.6}
              />
              <XAxis 
                dataKey="label" 
                stroke="#8A8F98" 
                fontSize={11} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
              />
              <YAxis 
                stroke="#8A8F98" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val} ${currency === 'EUR' ? '€' : currency}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="housing" name={t.views.dashboard.spendingTrends?.categoryLabels?.housing || 'Housing'} fill={palette.housing} radius={[4, 4, 0, 0]} />
              <Bar dataKey="food" name={t.views.dashboard.spendingTrends?.categoryLabels?.food || 'Food'} fill={palette.food} radius={[4, 4, 0, 0]} />
              <Bar dataKey="transport" name={t.views.dashboard.spendingTrends?.categoryLabels?.transport || 'Transport'} fill={palette.transport} radius={[4, 4, 0, 0]} />
              <Bar dataKey="subscriptions" name={t.views.dashboard.spendingTrends?.categoryLabels?.subscriptions || 'Subscriptions'} fill={palette.subscriptions} radius={[4, 4, 0, 0]} />
              <Bar dataKey="leisure" name={t.views.dashboard.spendingTrends?.categoryLabels?.leisure || 'Leisure'} fill={palette.leisure} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <BarChart
              data={processedMonthlyData}
              margin={{ top: 20, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#1e293b" 
                vertical={false} 
                opacity={0.6}
              />
              <XAxis 
                dataKey="label" 
                stroke="#8A8F98" 
                fontSize={11} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
              />
              <YAxis 
                stroke="#8A8F98" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val} ${currency === 'EUR' ? '€' : currency}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine 
                y={monthlyBudgetGoal} 
                stroke="#D4FF3D" 
                strokeDasharray="4 4" 
                label={{
                  value: `${t.views.dashboard.spendingTrends?.budgetGoal || 'Target'} (${monthlyBudgetGoal} ${currency === 'EUR' ? '€' : currency})`,
                  fill: '#D4FF3D',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  position: 'insideTopRight',
                }}
              />
              <Bar 
                dataKey="total" 
                name={t.views.dashboard.spendingTrends?.totalSpend || 'Total Spend'} 
                radius={[6, 6, 0, 0]}
              >
                {processedMonthlyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.total > entry.budgetGoal ? '#F87171' : entry.isCurrentMonth ? '#D4FF3D' : '#38BDF8'} 
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Interactive Legend and Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-2 border-t border-[#1e293b] text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === 'stacked' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
                <span className="text-[#8A8F98]">{t.views.dashboard.spendingTrends?.fixedCommitments || 'Fixed'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
                <span className="text-[#8A8F98]">{t.views.dashboard.spendingTrends?.essentialLiving || 'Essential'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" />
                <span className="text-[#8A8F98]">{t.views.dashboard.spendingTrends?.impulseDiscretionary || 'Impulse'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#D4FF3D]" />
                <span className="text-[#D4FF3D] font-medium">{t.views.dashboard.spendingTrends?.trendLine || 'Trajectory'}</span>
              </div>
            </>
          )}

          {viewMode === 'categories' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#60A5FA]" />
                <span className="text-[#8A8F98]">{t.views.dashboard.spendingTrends?.categoryLabels?.housing || 'Housing'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                <span className="text-[#8A8F98]">{t.views.dashboard.spendingTrends?.categoryLabels?.food || 'Food'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F472B6]" />
                <span className="text-[#8A8F98]">{t.views.dashboard.spendingTrends?.categoryLabels?.transport || 'Transport'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#A78BFA]" />
                <span className="text-[#8A8F98]">{t.views.dashboard.spendingTrends?.categoryLabels?.subscriptions || 'Subs'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                <span className="text-[#8A8F98]">{t.views.dashboard.spendingTrends?.categoryLabels?.leisure || 'Leisure'}</span>
              </div>
            </>
          )}

          {viewMode === 'budget' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
                <span className="text-[#8A8F98]">{language === 'fr' ? 'Sous objectif' : 'Under target'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
                <span className="text-[#8A8F98]">{language === 'fr' ? 'Dépassement' : 'Exceeded'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4FF3D]" />
                <span className="text-[#D4FF3D] font-medium">{language === 'fr' ? 'Mois en cours' : 'Current month'}</span>
              </div>
            </>
          )}
        </div>

        {/* Dynamic Insight Badge */}
        <div className="flex items-center gap-2 text-[11px] text-[#8A8F98] bg-[#0B0E17] px-3 py-1.5 rounded-xl border border-[#1e293b]">
          <Sparkles className="w-3.5 h-3.5 text-[#D4FF3D]" />
          <span>
            {metrics.momVelocity <= 0 
              ? (language === 'fr' 
                  ? `Dépenses stables avec ${metrics.impulseRatio}% d'achats libres.` 
                  : `Stable trend with ${metrics.impulseRatio}% in discretionary spend.`)
              : (language === 'fr'
                  ? `Hausse de ${metrics.momVelocity}% ce mois-ci par rapport au mois dernier.`
                  : `Outflow up by ${metrics.momVelocity}% compared to last month.`)}
          </span>
        </div>
      </div>
    </div>
  );
};
