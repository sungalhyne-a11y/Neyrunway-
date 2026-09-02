import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Dot
} from 'recharts';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { Transaction, IncomeEvent } from '../../types';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RunwayForecastChartProps {
  className?: string;
  initialScenario?: 'realistic' | 'fixedOnly' | 'frugal';
}

type ScenarioType = 'realistic' | 'fixedOnly' | 'frugal';

interface DayPoint {
  day: number;
  dayLabel: string;
  dateKey: string;
  formattedDate: string;
  shortDate: string;
  balance: number;
  rawBalance: number;
  fixedOutflow: number;
  fixedTitle?: string;
  discretionarySpend: number;
  inflowAmount: number;
  inflowSource?: string;
  netChange: number;
  isDipPoint?: boolean;
}

export const RunwayForecastChart: React.FC<RunwayForecastChartProps> = ({
  className = '',
  initialScenario = 'realistic',
}) => {
  const { t, formatCurrency, formatDate, formatDays, formatDaysShort, language, region } = useTranslation();
  const { currentUser, userProfile, computedRunway } = useAuth();

  const [scenario, setScenario] = useState<ScenarioType>(initialScenario);
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
  const [incomeEvents, setIncomeEvents] = useState<IncomeEvent[]>(() => {
    try {
      const cached = localStorage.getItem('neyrunway_income_events');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  // Base financial variables
  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const safeToSpendDaily = computedRunway?.safeToSpendToday ?? 24;
  const projectedBurnPerDay = computedRunway?.projectedBurnPerDay ?? 38;
  const totalMonthlyFixed = computedRunway?.totalFixedExpenses ?? 450;
  const nextIncomeDate = computedRunway?.nextIncomeDate;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;
  const nextIncomeSource = computedRunway?.nextIncomeSource || t.views.dashboard.timelineDefaultIncomeSource;

  // Default regional fallback movements if offline or empty
  const defaultSampleMovements: Transaction[] = useMemo(() => [
    {
      id: 's-rent',
      userId: 'local',
      title: t.views.transactions?.sampleMovements?.housing?.[region] || 'Loyer Résidence / Studio',
      amount: region === 'CH' ? 750 : region === 'US' ? 650 : region === 'GB' ? 520 : region === 'CA' ? 600 : region === 'BE' ? 460 : 420,
      category: 'housing',
      type: 'fixed',
      date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0], // 5 days from now
      status: 'recurring_active',
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 's-transport',
      userId: 'local',
      title: t.views.transactions?.sampleMovements?.transport?.[region] || 'Abonnement Transports',
      amount: region === 'CH' ? 30 : region === 'US' ? 35 : region === 'GB' ? 45 : region === 'BE' ? 12 : 38,
      category: 'transport',
      type: 'fixed',
      date: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0], // 12 days from now
      status: 'recurring_active',
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 's-subs',
      userId: 'local',
      title: 'Abonnements (Mobile & Cloud)',
      amount: 25,
      category: 'subscriptions',
      type: 'fixed',
      date: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0], // 18 days from now
      status: 'recurring_active',
      isRecurring: true,
      createdAt: new Date().toISOString(),
    }
  ], [region, t]);

  const defaultSampleIncomes: IncomeEvent[] = useMemo(() => [
    {
      id: 'inc-1',
      userId: 'local',
      source: nextIncomeSource || 'Bourse CROUS / Allocation',
      amount: nextIncomeAmount > 0 ? nextIncomeAmount : (region === 'CH' ? 800 : region === 'US' ? 600 : region === 'GB' ? 550 : 500),
      expectedDate: nextIncomeDate || new Date(Date.now() + 16 * 86400000).toISOString().split('T')[0],
      type: 'grant',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    }
  ], [nextIncomeAmount, nextIncomeDate, nextIncomeSource, region]);

  // Load live transactions from Firestore if logged in
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) {
      setTransactions(defaultSampleMovements);
      return;
    }

    try {
      const txRef = collection(db, 'users', currentUser.uid, 'transactions');
      const q = query(txRef, orderBy('date', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const loaded = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));
          setTransactions(loaded);
        } else {
          setTransactions(prev => (prev.length > 0 ? prev : defaultSampleMovements));
        }
      }, (err) => {
        console.warn('Forecast Firestore transactions notice (using cached data):', err);
        setTransactions(prev => (prev.length > 0 ? prev : defaultSampleMovements));
      });
      return () => unsub();
    } catch (err) {
      console.warn('Forecast Firestore sync error:', err);
      setTransactions(prev => (prev.length > 0 ? prev : defaultSampleMovements));
    }
  }, [currentUser, defaultSampleMovements]);

  // Load live income events from Firestore if logged in
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) {
      setIncomeEvents(defaultSampleIncomes);
      return;
    }

    try {
      const incRef = collection(db, 'users', currentUser.uid, 'incomeEvents');
      const q = query(incRef, orderBy('expectedDate', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const loaded = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<IncomeEvent, 'id'>) }));
          setIncomeEvents(loaded);
        } else {
          setIncomeEvents(prev => (prev.length > 0 ? prev : defaultSampleIncomes));
        }
      }, (err) => {
        console.warn('Forecast Firestore incomes notice (using cached data):', err);
        setIncomeEvents(prev => (prev.length > 0 ? prev : defaultSampleIncomes));
      });
      return () => unsub();
    } catch (err) {
      console.warn('Forecast Firestore income sync error:', err);
      setIncomeEvents(prev => (prev.length > 0 ? prev : defaultSampleIncomes));
    }
  }, [currentUser, defaultSampleIncomes]);

  // Compute 30-Day Day-by-Day Financial Trajectory
  const { trajectoryData, summaryStats, nextInflowDateLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recurringExpenses = transactions.filter(
      t => t.type === 'fixed' || t.isRecurring || t.status === 'recurring_active'
    );

    // Group recurring bills by day-of-month or offset within 30 days
    const expensesByDayMap: Record<string, { amount: number; titles: string[] }> = {};
    recurringExpenses.forEach(exp => {
      if (exp.date) {
        const expDate = new Date(exp.date);
        if (!isNaN(expDate.getTime())) {
          // If transaction has an explicit future date in next 30 days
          const dayDiff = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (dayDiff >= 0 && dayDiff <= 30) {
            const key = exp.date.split('T')[0];
            if (!expensesByDayMap[key]) {
              expensesByDayMap[key] = { amount: 0, titles: [] };
            }
            expensesByDayMap[key].amount += Number(exp.amount) || 0;
            expensesByDayMap[key].titles.push(exp.title);
          } else {
            // Map monthly recurring to day-of-month relative to this simulation window
            const dayOfMonth = expDate.getDate();
            // Find target date in this 30d window
            for (let i = 0; i <= 30; i++) {
              const target = new Date(today);
              target.setDate(today.getDate() + i);
              if (target.getDate() === dayOfMonth) {
                const key = target.toISOString().split('T')[0];
                if (!expensesByDayMap[key]) {
                  expensesByDayMap[key] = { amount: 0, titles: [] };
                }
                expensesByDayMap[key].amount += Number(exp.amount) || 0;
                expensesByDayMap[key].titles.push(exp.title);
              }
            }
          }
        }
      }
    });

    // If no explicit recurring dates mapped, distribute monthly fixed total evenly or on 1st & 15th
    if (Object.keys(expensesByDayMap).length === 0 && totalMonthlyFixed > 0) {
      // Put 80% on rent checkpoint (+5d) and 20% on subscriptions (+15d)
      const rentDay = new Date(today);
      rentDay.setDate(today.getDate() + 5);
      const rentKey = rentDay.toISOString().split('T')[0];
      expensesByDayMap[rentKey] = { amount: totalMonthlyFixed * 0.8, titles: ['Loyer / Logement'] };

      const subDay = new Date(today);
      subDay.setDate(today.getDate() + 15);
      const subKey = subDay.toISOString().split('T')[0];
      expensesByDayMap[subKey] = { amount: totalMonthlyFixed * 0.2, titles: ['Abonnements & Charges'] };
    }

    // Group incoming cash events by date string
    const incomeByDayMap: Record<string, { amount: number; sources: string[] }> = {};
    incomeEvents.forEach(inc => {
      if (inc.expectedDate) {
        const incDate = new Date(inc.expectedDate);
        if (!isNaN(incDate.getTime())) {
          const key = inc.expectedDate.split('T')[0];
          if (!incomeByDayMap[key]) {
            incomeByDayMap[key] = { amount: 0, sources: [] };
          }
          incomeByDayMap[key].amount += Number(inc.amount) || 0;
          incomeByDayMap[key].sources.push(inc.source);
        }
      }
    });

    let runningBalance = currentBalance;
    let minBalance = currentBalance;
    let minBalanceDate = today.toISOString().split('T')[0];
    let total30dFixed = 0;
    let total30dInflows = 0;
    let nextInflowMarkerLabel: string | undefined = undefined;

    const points: DayPoint[] = [];

    // Daily variable burn parameter depending on scenario
    const dailyDiscretionaryBurn = 
      scenario === 'fixedOnly' 
        ? 0 
        : scenario === 'frugal' 
          ? safeToSpendDaily * 0.5 
          : safeToSpendDaily;

    for (let i = 0; i <= 30; i++) {
      const simDate = new Date(today);
      simDate.setDate(today.getDate() + i);
      const dateKey = simDate.toISOString().split('T')[0];

      const dayFixed = expensesByDayMap[dateKey]?.amount || 0;
      const dayFixedTitle = expensesByDayMap[dateKey]?.titles?.join(', ');
      const dayInflow = incomeByDayMap[dateKey]?.amount || 0;
      const dayInflowSource = incomeByDayMap[dateKey]?.sources?.join(', ');

      total30dFixed += dayFixed;
      total30dInflows += dayInflow;

      // On day 0 (today), balance starts at currentBalance before daily burn
      if (i > 0) {
        runningBalance = runningBalance - dayFixed - dailyDiscretionaryBurn + dayInflow;
      }

      if (runningBalance < minBalance) {
        minBalance = runningBalance;
        minBalanceDate = dateKey;
      }

      if (dayInflow > 0 && !nextInflowMarkerLabel) {
        const monthShort = simDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
        nextInflowMarkerLabel = monthShort;
      }

      // Date formatter
      const formattedDate = simDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
        day: 'numeric',
        month: 'short',
      });

      const dayLabel = i === 0 
        ? (t.views.dashboard?.forecastChart?.today || 'Aujourd\'hui')
        : `${t.views.dashboard?.forecastChart?.dayPrefix || 'J+'}${i}`;

      points.push({
        day: i,
        dayLabel,
        dateKey,
        formattedDate,
        shortDate: simDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit' }),
        balance: Math.round(runningBalance * 10) / 10,
        rawBalance: runningBalance,
        fixedOutflow: dayFixed,
        fixedTitle: dayFixedTitle,
        discretionarySpend: i > 0 ? dailyDiscretionaryBurn : 0,
        inflowAmount: dayInflow,
        inflowSource: dayInflowSource,
        netChange: dayInflow - (dayFixed + (i > 0 ? dailyDiscretionaryBurn : 0)),
      });
    }

    // Flag the minimum dip point
    const pointsWithDip = points.map(p => ({
      ...p,
      isDipPoint: p.dateKey === minBalanceDate,
    }));

    const finalBalance = points[points.length - 1]?.balance || 0;

    return {
      trajectoryData: pointsWithDip,
      summaryStats: {
        currentBalance,
        finalBalance,
        minBalance: Math.round(minBalance * 10) / 10,
        minBalanceDate,
        total30dFixed: Math.round(total30dFixed),
        total30dInflows: Math.round(total30dInflows),
        isDeficitExpected: minBalance < 0,
      },
      nextInflowDateLabel: nextInflowMarkerLabel,
    };
  }, [
    currentBalance,
    incomeEvents,
    language,
    safeToSpendDaily,
    scenario,
    t,
    totalMonthlyFixed,
    transactions
  ]);

  // Determine overall health status
  const trajectoryHealth = useMemo(() => {
    if (summaryStats.minBalance < 0) return 'critical';
    if (summaryStats.minBalance < 150) return 'attention';
    return 'comfortable';
  }, [summaryStats.minBalance]);

  // Custom Tooltip Component for Recharts
  const CustomForecastTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: DayPoint = payload[0].payload;
      const isNegative = data.balance < 0;

      return (
        <div 
          id="recharts-runway-tooltip"
          className="bg-[#0B0E17]/95 backdrop-blur-md border border-[#1e293b] p-3.5 rounded-2xl shadow-2xl text-xs font-mono min-w-[210px] space-y-2 z-50 pointer-events-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-1.5">
            <span className="text-[#8A8F98] text-[10px] uppercase font-bold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#D4FF3D]" />
              {data.dayLabel} • {data.formattedDate}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              isNegative 
                ? 'bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/30' 
                : data.balance < 150 
                  ? 'bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30' 
                  : 'bg-[#D4FF3D]/20 text-[#D4FF3D] border border-[#D4FF3D]/30'
            }`}>
              {isNegative 
                ? (t.views.dashboard?.forecastChart?.statusCritical || 'Déficit') 
                : (t.views.dashboard?.forecastChart?.statusComfortable || 'Sûr')}
            </span>
          </div>

          {/* Projected Balance */}
          <div className="flex items-baseline justify-between pt-0.5">
            <span className="text-[#8A8F98] text-[11px] font-sans">
              {t.views.dashboard?.forecastChart?.projectedBalance || 'Solde projeté'} :
            </span>
            <span className={`text-sm font-bold ${isNegative ? 'text-[#FB7185]' : 'text-[#D4FF3D]'}`}>
              {formatCurrency(data.balance)}
            </span>
          </div>

          {/* Daily Outflow / Inflow Details */}
          {(data.fixedOutflow > 0 || data.inflowAmount > 0 || data.discretionarySpend > 0) && (
            <div className="pt-1.5 border-t border-[#1e293b]/70 space-y-1 text-[11px]">
              {data.inflowAmount > 0 && (
                <div className="flex items-center justify-between text-[#38BDF8]">
                  <span className="flex items-center gap-1 text-[10px]">
                    <ArrowUpRight className="w-3 h-3" />
                    {data.inflowSource || t.views.dashboard?.forecastChart?.nextIncomeLabel || 'Rentrée'}
                  </span>
                  <span className="font-bold">+{formatCurrency(data.inflowAmount)}</span>
                </div>
              )}

              {data.fixedOutflow > 0 && (
                <div className="flex items-center justify-between text-[#FB7185]">
                  <span className="flex items-center gap-1 text-[10px]">
                    <ArrowDownRight className="w-3 h-3" />
                    {data.fixedTitle || t.views.dashboard?.forecastChart?.recurringDeduction || 'Charge fixe'}
                  </span>
                  <span className="font-bold">-{formatCurrency(data.fixedOutflow)}</span>
                </div>
              )}

              {data.discretionarySpend > 0 && (
                <div className="flex items-center justify-between text-[#8A8F98]">
                  <span className="text-[10px]">
                    {t.views.dashboard?.forecastChart?.dailyDiscretionary || 'Dépenses courantes'}
                  </span>
                  <span>-{formatCurrency(data.discretionarySpend)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      id="runway-forecast-recharts-card"
      className={`bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col justify-between ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#38BDF8]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header: Title & Scenario Toggles */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#D4FF3D] text-[10px] font-bold tracking-[0.15em] uppercase font-mono px-2 py-0.5 rounded-md bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {t.views.dashboard?.forecastChart?.badge || 'Visualisation Recharts 30j'}
            </span>
            <span className="text-xs text-[#8A8F98] font-mono">
              • {userProfile?.currency || 'EUR'}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-light text-[#F5F5F0] tracking-tight">
            {t.views.dashboard?.forecastChart?.title || 'Trajectoire Runway sur 30 Jours'}
          </h3>
          <p className="text-xs text-[#8A8F98] mt-0.5 max-w-xl">
            {t.views.dashboard?.forecastChart?.subtitle || 'Simulation prévisionnelle du solde selon vos charges récurrentes et rentrées attendues.'}
          </p>
        </div>

        {/* Scenario Switcher Controls */}
        <div className="flex items-center p-1 bg-[#0B0E17] border border-[#1e293b] rounded-2xl self-start md:self-auto">
          <button
            type="button"
            id="btn-forecast-scenario-realistic"
            onClick={() => setScenario('realistic')}
            title={t.views.dashboard?.forecastChart?.scenarioRealisticDesc || 'Charges fixes + Dépenses sûres'}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              scenario === 'realistic'
                ? 'bg-[#161b27] text-[#D4FF3D] border border-[#D4FF3D]/30 shadow-sm font-bold'
                : 'text-[#8A8F98] hover:text-[#F5F5F0]'
            }`}
          >
            {t.views.dashboard?.forecastChart?.scenarioRealistic || 'Réaliste'}
          </button>

          <button
            type="button"
            id="btn-forecast-scenario-fixed-only"
            onClick={() => setScenario('fixedOnly')}
            title={t.views.dashboard?.forecastChart?.scenarioFixedOnlyDesc || 'Charges fixes uniquement'}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              scenario === 'fixedOnly'
                ? 'bg-[#161b27] text-[#38BDF8] border border-[#38BDF8]/30 shadow-sm font-bold'
                : 'text-[#8A8F98] hover:text-[#F5F5F0]'
            }`}
          >
            {t.views.dashboard?.forecastChart?.scenarioFixedOnly || 'Charges Fixes'}
          </button>

          <button
            type="button"
            id="btn-forecast-scenario-frugal"
            onClick={() => setScenario('frugal')}
            title={t.views.dashboard?.forecastChart?.scenarioFrugalDesc || 'Mode économe (-50% dépenses libres)'}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              scenario === 'frugal'
                ? 'bg-[#161b27] text-[#A78BFA] border border-[#A78BFA]/30 shadow-sm font-bold'
                : 'text-[#8A8F98] hover:text-[#F5F5F0]'
            }`}
          >
            {t.views.dashboard?.forecastChart?.scenarioFrugal || 'Économe (-50%)'}
          </button>
        </div>
      </div>

      {/* High-Level Metric Pills */}
      <div 
        id="forecast-metric-pills"
        className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
      >
        {/* Metric: Final 30d Balance */}
        <div className="bg-[#0B0E17]/60 border border-[#1e293b] p-3 rounded-2xl">
          <span className="text-[10px] text-[#8A8F98] uppercase font-mono block">
            {t.views.dashboard?.forecastChart?.finalBalance30d || 'Solde à J+30'}
          </span>
          <span className={`text-base sm:text-lg font-mono font-bold ${
            summaryStats.finalBalance >= 0 ? 'text-[#D4FF3D]' : 'text-[#FB7185]'
          }`}>
            {formatCurrency(summaryStats.finalBalance)}
          </span>
        </div>

        {/* Metric: Lowest Dip */}
        <div className="bg-[#0B0E17]/60 border border-[#1e293b] p-3 rounded-2xl">
          <span className="text-[10px] text-[#8A8F98] uppercase font-mono block">
            {t.views.dashboard?.forecastChart?.lowestDip || 'Point bas (Dip)'}
          </span>
          <span className={`text-base sm:text-lg font-mono font-bold ${
            summaryStats.minBalance < 0 ? 'text-[#FB7185]' : summaryStats.minBalance < 150 ? 'text-[#FACC15]' : 'text-[#F5F5F0]'
          }`}>
            {formatCurrency(summaryStats.minBalance)}
          </span>
        </div>

        {/* Metric: 30d Fixed Outflows */}
        <div className="bg-[#0B0E17]/60 border border-[#1e293b] p-3 rounded-2xl">
          <span className="text-[10px] text-[#8A8F98] uppercase font-mono block">
            {t.views.dashboard?.forecastChart?.totalRecurring30d || 'Charges fixes (30j)'}
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-[#FB7185]">
            -{formatCurrency(summaryStats.total30dFixed)}
          </span>
        </div>

        {/* Metric: 30d Inflows */}
        <div className="bg-[#0B0E17]/60 border border-[#1e293b] p-3 rounded-2xl">
          <span className="text-[10px] text-[#8A8F98] uppercase font-mono block">
            {t.views.dashboard?.forecastChart?.totalInflow30d || 'Rentrées prévues'}
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-[#38BDF8]">
            +{formatCurrency(summaryStats.total30dInflows)}
          </span>
        </div>
      </div>

      {/* Main Recharts Area Chart Container */}
      <div className="relative z-10 w-full h-[280px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={trajectoryData}
            margin={{ top: 15, right: 10, left: -15, bottom: 5 }}
          >
            <defs>
              {/* Healthy Lime-to-Cyan gradient */}
              <linearGradient id="runwayGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D4FF3D" stopOpacity={0.4} />
                <stop offset="60%" stopColor="#38BDF8" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#0B0E17" stopOpacity={0.0} />
              </linearGradient>

              {/* Frugal Scenario Purple Gradient */}
              <linearGradient id="frugalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.45} />
                <stop offset="60%" stopColor="#38BDF8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0B0E17" stopOpacity={0.0} />
              </linearGradient>

              {/* Fixed Only Scenario Cyan Gradient */}
              <linearGradient id="fixedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#0B0E17" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid 
              stroke="#1e293b" 
              strokeDasharray="3 3" 
              vertical={false} 
            />

            <XAxis 
              dataKey="formattedDate"
              stroke="#8A8F98"
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              tick={{ fontSize: 11, fill: '#8A8F98', fontFamily: 'monospace' }}
              interval={4}
            />

            <YAxis 
              stroke="#8A8F98"
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              tick={{ fontSize: 10, fill: '#8A8F98', fontFamily: 'monospace' }}
              tickFormatter={(val: number) => `${Math.round(val)}`}
              domain={['auto', 'auto']}
            />

            <Tooltip content={<CustomForecastTooltip />} />

            {/* Zero balance critical threshold */}
            <ReferenceLine 
              y={0} 
              stroke="#F43F5E" 
              strokeDasharray="4 4" 
              strokeWidth={1.5}
              label={{ 
                value: t.views.dashboard?.forecastChart?.zeroFloor || 'Seuil 0', 
                fill: '#FB7185', 
                fontSize: 10, 
                position: 'insideBottomLeft',
                fontFamily: 'monospace'
              }} 
            />

            {/* Next incoming grant / salary reference marker if available */}
            {nextInflowDateLabel && (
              <ReferenceLine 
                x={nextInflowDateLabel} 
                stroke="#38BDF8" 
                strokeDasharray="3 3" 
                strokeWidth={1.5}
                label={{ 
                  value: `+${nextIncomeAmount > 0 ? formatCurrency(nextIncomeAmount) : 'Rentrée'}`, 
                  fill: '#38BDF8', 
                  fontSize: 10, 
                  position: 'top',
                  fontFamily: 'monospace'
                }} 
              />
            )}

            {/* Trajectory Main Area Curve */}
            <Area 
              type="monotone" 
              dataKey="balance" 
              stroke={scenario === 'frugal' ? '#A78BFA' : scenario === 'fixedOnly' ? '#38BDF8' : '#D4FF3D'} 
              strokeWidth={2.5}
              fill={scenario === 'frugal' ? 'url(#frugalGradient)' : scenario === 'fixedOnly' ? 'url(#fixedGradient)' : 'url(#runwayGradient)'}
              activeDot={{ 
                r: 6, 
                fill: scenario === 'frugal' ? '#A78BFA' : scenario === 'fixedOnly' ? '#38BDF8' : '#D4FF3D', 
                stroke: '#0B0E17', 
                strokeWidth: 2 
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Insights and Action Banner */}
      <div className="relative z-10 mt-4 pt-4 border-t border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono text-[#8A8F98] gap-3">
        <div className="flex items-center gap-2">
          {trajectoryHealth === 'comfortable' ? (
            <div className="flex items-center gap-1.5 text-[#D4FF3D]">
              <CheckCircle2 className="w-4 h-4 text-[#D4FF3D]" />
              <span>
                {t.views.dashboard?.forecastChart?.noDeficitNotice || '✓ Trajectoire saine : aucun découvert anticipé sur les 30 prochains jours.'}
              </span>
            </div>
          ) : trajectoryHealth === 'attention' ? (
            <div className="flex items-center gap-1.5 text-[#FACC15]">
              <Info className="w-4 h-4 text-[#FACC15]" />
              <span>
                {(t.views.dashboard?.forecastChart?.dipAlertNotice || 'Point le plus bas : {amount}')
                  .replace('{amount}', formatCurrency(summaryStats.minBalance))
                  .replace('{date}', summaryStats.minBalanceDate)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#FB7185]">
              <AlertTriangle className="w-4 h-4 text-[#FB7185]" />
              <span>
                {(t.views.dashboard?.forecastChart?.dipAlertNotice || 'Alerte déficit : {amount}')
                  .replace('{amount}', formatCurrency(summaryStats.minBalance))
                  .replace('{date}', summaryStats.minBalanceDate)}
              </span>
            </div>
          )}
        </div>

        {/* Legend Indicators */}
        <div className="flex items-center gap-4 text-[11px] text-[#8A8F98]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4FF3D]" />
            <span>{t.views.dashboard?.forecastChart?.legendBalance || 'Solde projeté'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
            <span>{t.views.dashboard?.forecastChart?.legendInflow || 'Rentrée attendue'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
