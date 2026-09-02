import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { Transaction } from '../../types';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Gauge, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  Flame, 
  Wallet, 
  Clock, 
  Sliders, 
  ArrowRight,
  Info,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ProjectionPace = 'trend' | 'recent' | 'frugal' | 'survival';

interface GaugeTierInfo {
  key: 'critical' | 'tight' | 'moderate' | 'comfortable' | 'sovereign';
  color: string;
  glowColor: string;
  minMonths: number;
  maxMonths: number;
  label: string;
  desc: string;
}

export const RunwayProjectionGauge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t, formatCurrency, formatDate, language, region, currency } = useTranslation();
  const { currentUser, userProfile, computedRunway } = useAuth();

  const [selectedPace, setSelectedPace] = useState<ProjectionPace>('trend');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [manualAdjustment, setManualAdjustment] = useState<number>(0); // -200 to +200 adjustment test

  // Baseline user data
  const liquidCash = Math.max(0, computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250);
  const fixedMonthly = Math.max(0, computedRunway?.totalFixedExpenses ?? userProfile?.monthlyFixedExpenses ?? 450);

  // Firestore transactions sync for spending trend analysis
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) {
      setTransactions([]);
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
        } else {
          setTransactions([]);
        }
      }, (error) => {
        console.warn('Firestore spending trends fetch for gauge:', error);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Transactions gauge listener error:', err);
    }
  }, [currentUser]);

  // Analyze spending trends from transactions or defaults
  const trendAnalysis = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000);

    let recent30Total = 0;
    let recent30Count = 0;
    let rolling90Total = 0;
    let rolling90Fixed = 0;
    let rolling90Variable = 0;
    let rolling90Impulse = 0;

    transactions.forEach((tx) => {
      if (!tx.date) return;
      const txDate = new Date(tx.date);
      const amt = Math.max(0, Number(tx.amount) || 0);

      if (txDate >= thirtyDaysAgo) {
        recent30Total += amt;
        recent30Count++;
      }

      if (txDate >= ninetyDaysAgo) {
        rolling90Total += amt;
        if (tx.type === 'fixed' || tx.isRecurring) {
          rolling90Fixed += amt;
        } else if (tx.category === 'leisure' || tx.category === 'shopping' || (tx as any).tag === 'impulse') {
          rolling90Impulse += amt;
        } else {
          rolling90Variable += amt;
        }
      }
    });

    // Realistic baseline calculation fallback if few transactions
    const defaultVariable = region === 'CH' ? 360 : region === 'US' ? 310 : region === 'GB' ? 260 : 230;
    const defaultImpulse = region === 'CH' ? 140 : region === 'US' ? 120 : region === 'GB' ? 95 : 85;

    const baseFixed = fixedMonthly > 0 ? fixedMonthly : 450;
    const baseVariable = rolling90Variable > 0 ? Math.round(rolling90Variable / 3) : defaultVariable;
    const baseImpulse = rolling90Impulse > 0 ? Math.round(rolling90Impulse / 3) : defaultImpulse;

    const rolling90MonthlyAvg = rolling90Total > 0 
      ? Math.round(rolling90Total / 3) 
      : (baseFixed + baseVariable + baseImpulse);

    const recent30MonthlyAvg = recent30Total > 0 
      ? Math.round(recent30Total) 
      : rolling90MonthlyAvg;

    return {
      fixed: baseFixed,
      variable: baseVariable,
      impulse: baseImpulse,
      rolling90MonthlyAvg,
      recent30MonthlyAvg,
    };
  }, [transactions, fixedMonthly, region]);

  // Compute burn rate and months of runway according to selected pace
  const projection = useMemo(() => {
    let effectiveBurn = trendAnalysis.rolling90MonthlyAvg;
    let fixedPart = trendAnalysis.fixed;
    let variablePart = trendAnalysis.variable;
    let impulsePart = trendAnalysis.impulse;

    switch (selectedPace) {
      case 'recent':
        effectiveBurn = trendAnalysis.recent30MonthlyAvg;
        break;
      case 'frugal':
        impulsePart = Math.round(trendAnalysis.impulse * 0.4); // 60% reduction in impulse
        variablePart = Math.round(trendAnalysis.variable * 0.85); // 15% reduction in variable
        effectiveBurn = fixedPart + variablePart + impulsePart;
        break;
      case 'survival':
        impulsePart = 0;
        variablePart = Math.round(trendAnalysis.variable * 0.65); // Vital groceries only
        effectiveBurn = fixedPart + variablePart;
        break;
      case 'trend':
      default:
        effectiveBurn = trendAnalysis.rolling90MonthlyAvg;
        break;
    }

    // Apply interactive slider test
    effectiveBurn = Math.max(100, effectiveBurn + manualAdjustment);

    // Calculate months of runway
    const months = liquidCash > 0 ? +(liquidCash / effectiveBurn).toFixed(1) : 0;

    // Calculate projected zero-cash horizon date
    const horizonDate = new Date();
    const daysToAdd = Math.round(months * 30.4375);
    horizonDate.setDate(horizonDate.getDate() + daysToAdd);

    return {
      months,
      effectiveBurn,
      fixedPart,
      variablePart,
      impulsePart,
      horizonDate,
      daysRemaining: daysToAdd,
    };
  }, [selectedPace, trendAnalysis, manualAdjustment, liquidCash]);

  // Determine current tier status
  const currentTier: GaugeTierInfo = useMemo(() => {
    const m = projection.months;
    const tKeys = t.views.dashboard.runwayProjection?.tiers;

    if (m < 1.0) {
      return {
        key: 'critical',
        color: '#F87171', // Red
        glowColor: 'rgba(248, 113, 113, 0.4)',
        minMonths: 0,
        maxMonths: 1,
        label: tKeys?.critical?.title || 'Critical Runway',
        desc: tKeys?.critical?.desc || 'Immediate action required to safeguard upcoming rent.',
      };
    } else if (m < 3.0) {
      return {
        key: 'tight',
        color: '#FB923C', // Orange
        glowColor: 'rgba(251, 146, 60, 0.4)',
        minMonths: 1,
        maxMonths: 3,
        label: tKeys?.tight?.title || 'Tight Buffer',
        desc: tKeys?.tight?.desc || 'Buffer is limited. Monitor upcoming bills and avoid major purchases.',
      };
    } else if (m < 6.0) {
      return {
        key: 'moderate',
        color: '#FBBF24', // Amber
        glowColor: 'rgba(251, 191, 36, 0.4)',
        minMonths: 3,
        maxMonths: 6,
        label: tKeys?.moderate?.title || 'Balanced Horizon',
        desc: tKeys?.moderate?.desc || 'Good stability. You have time to comfortably anticipate upcoming semester expenses.',
      };
    } else if (m < 12.0) {
      return {
        key: 'comfortable',
        color: '#34D399', // Emerald
        glowColor: 'rgba(52, 211, 153, 0.4)',
        minMonths: 6,
        maxMonths: 12,
        label: tKeys?.comfortable?.title || 'Comfortable Autonomy',
        desc: tKeys?.comfortable?.desc || 'Solid financial peace of mind! Your cash reserves cover you for over half a year.',
      };
    } else {
      return {
        key: 'sovereign',
        color: '#D4FF3D', // Electric Lime
        glowColor: 'rgba(212, 255, 61, 0.4)',
        minMonths: 12,
        maxMonths: 24,
        label: tKeys?.sovereign?.title || 'Sovereign Independence',
        desc: tKeys?.sovereign?.desc || 'Outstanding runway! You have over a year of full financial autonomy.',
      };
    }
  }, [projection.months, t]);

  // Recharts Gauge Chart Segments Data
  // Gauge scale represents 0 to 12+ months across 180 degrees
  // Segments: [0-1m: 1], [1-3m: 2], [3-6m: 3], [6-12m: 6] => total 12 units
  const gaugeSegmentsData = [
    { name: t.views.dashboard.runwayProjection?.gaugeLegend?.critical || '< 1m', value: 1, color: '#F87171', tier: 'critical' },
    { name: t.views.dashboard.runwayProjection?.gaugeLegend?.tight || '1-3m', value: 2, color: '#FB923C', tier: 'tight' },
    { name: t.views.dashboard.runwayProjection?.gaugeLegend?.moderate || '3-6m', value: 3, color: '#FBBF24', tier: 'moderate' },
    { name: t.views.dashboard.runwayProjection?.gaugeLegend?.comfortable || '6-12m', value: 6, color: '#34D399', tier: 'comfortable' },
  ];

  // Mathematical needle calculation for 180-degree semi-circle
  // Value capped at 12 for the gauge angle calculation
  const clampedMonths = Math.min(12, Math.max(0, projection.months));
  // 180 deg (left = 0m) to 0 deg (right = 12m)
  const needleAngle = 180 - (clampedMonths / 12) * 180;

  // Calculate needle tip coordinate on semi-circle
  const cx = 150;
  const cy = 135;
  const r = 90;
  const rad = (needleAngle * Math.PI) / 180;
  const nx = cx + r * Math.cos(rad);
  const ny = cy - r * Math.sin(rad);

  const formatHorizonMonthYear = (d: Date) => {
    return d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div 
      id="runway-projection-gauge-container"
      className={`bg-gradient-to-br from-[#161b27] via-[#121622] to-[#0B0E17] border border-[#1e293b] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl ${className}`}
    >
      {/* Dynamic ambient background glow based on current tier */}
      <div 
        className="absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-20"
        style={{ backgroundColor: currentTier.color }}
      />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#38BDF8]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Scenario Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10 pb-6 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[#D4FF3D] text-[10px] font-bold tracking-[0.15em] uppercase font-mono px-2 py-0.5 rounded-md bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 flex items-center gap-1.5">
              <Gauge className="w-3 h-3 text-[#D4FF3D]" />
              {t.views.dashboard.runwayProjection?.badge || 'Recharts Dynamic Gauge'}
            </span>
            <span className="text-xs text-[#8A8F98] font-mono">
              • {t.views.dashboard.runwayProjection?.recommendedTarget || 'Target: 6.0 Months'}
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-light text-[#F5F5F0] tracking-tight">
            {t.views.dashboard.runwayProjection?.title || 'Runway Projection & Horizon'}
          </h3>
          <p className="text-xs text-[#8A8F98] mt-1 max-w-2xl leading-relaxed">
            {t.views.dashboard.runwayProjection?.subtitle || 'Long-term financial runway forecasted in months based on your actual multi-month spending velocity and cash reserves'}
          </p>
        </div>

        {/* Projection Pace Scenarios */}
        <div className="bg-[#0B0E17] p-1 rounded-2xl border border-[#1e293b] flex flex-wrap items-center gap-1 self-start lg:self-center">
          <button
            id="btn-gauge-pace-trend"
            onClick={() => setSelectedPace('trend')}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all cursor-pointer ${
              selectedPace === 'trend'
                ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_10px_rgba(212,255,61,0.2)]'
                : 'text-[#8A8F98] hover:text-[#F5F5F0]'
            }`}
          >
            {t.views.dashboard.runwayProjection?.paceTrend || 'Trend (90d)'}
          </button>
          <button
            id="btn-gauge-pace-recent"
            onClick={() => setSelectedPace('recent')}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all cursor-pointer ${
              selectedPace === 'recent'
                ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_10px_rgba(212,255,61,0.2)]'
                : 'text-[#8A8F98] hover:text-[#F5F5F0]'
            }`}
          >
            {t.views.dashboard.runwayProjection?.paceRecent || 'Recent (30d)'}
          </button>
          <button
            id="btn-gauge-pace-frugal"
            onClick={() => setSelectedPace('frugal')}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all cursor-pointer ${
              selectedPace === 'frugal'
                ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_10px_rgba(212,255,61,0.2)]'
                : 'text-[#8A8F98] hover:text-[#F5F5F0]'
            }`}
          >
            {t.views.dashboard.runwayProjection?.paceFrugal || 'Frugal (-15%)'}
          </button>
          <button
            id="btn-gauge-pace-survival"
            onClick={() => setSelectedPace('survival')}
            className={`px-3 py-1.5 text-xs font-mono rounded-xl transition-all cursor-pointer ${
              selectedPace === 'survival'
                ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_10px_rgba(212,255,61,0.2)]'
                : 'text-[#8A8F98] hover:text-[#F5F5F0]'
            }`}
          >
            {t.views.dashboard.runwayProjection?.paceSurvival || 'Survival'}
          </button>
        </div>
      </div>

      {/* Main Section: Gauge Canvas + Projection Elevators */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-6 items-center">
        
        {/* Left Column: Recharts Radial Semi-Circle Gauge (Col 12 -> Col 6) */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
          
          {/* Gauge Stage */}
          <div className="w-full max-w-[320px] sm:max-w-[360px] h-[220px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                {/* Background Shadow Arc */}
                <Pie
                  data={[{ value: 12 }]}
                  dataKey="value"
                  cx="50%"
                  cy="75%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius="68%"
                  outerRadius="92%"
                  fill="#0B0E17"
                  stroke="#1e293b"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                
                {/* Colored Tier Segments */}
                <Pie
                  data={gaugeSegmentsData}
                  dataKey="value"
                  cx="50%"
                  cy="75%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius="72%"
                  outerRadius="88%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {gaugeSegmentsData.map((entry, index) => (
                    <Cell 
                      key={`gauge-cell-${index}`} 
                      fill={entry.color} 
                      opacity={entry.tier === currentTier.key ? 1 : 0.4}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Custom SVG Dynamic Needle Pointer & Center Hub */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 300 200"
            >
              <defs>
                <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="needle-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F5F5F0" />
                  <stop offset="100%" stopColor={currentTier.color} />
                </linearGradient>
              </defs>

              {/* Target 6.0 Months Marker Tick */}
              <line
                x1={150 + 95 * Math.cos(Math.PI / 2)}
                y1={150 - 95 * Math.sin(Math.PI / 2)}
                x2={150 + 106 * Math.cos(Math.PI / 2)}
                y2={150 - 106 * Math.sin(Math.PI / 2)}
                stroke="#D4FF3D"
                strokeWidth={2.5}
                strokeDasharray="2 2"
              />

              {/* Dynamic Needle Beam */}
              <motion.line
                x1={150}
                y1={150}
                x2={150 + 78 * Math.cos(rad)}
                y2={150 - 78 * Math.sin(rad)}
                stroke="url(#needle-gradient)"
                strokeWidth={3.5}
                strokeLinecap="round"
                filter="url(#gauge-glow)"
                initial={{ x2: 150, y2: 150 }}
                animate={{ 
                  x2: 150 + 78 * Math.cos(rad), 
                  y2: 150 - 78 * Math.sin(rad) 
                }}
                transition={{ type: 'spring', stiffness: 60, damping: 15 }}
              />

              {/* Central Pivot Hub */}
              <circle
                cx={150}
                cy={150}
                r={10}
                fill="#0B0E17"
                stroke={currentTier.color}
                strokeWidth={3}
              />
              <circle
                cx={150}
                cy={150}
                r={4}
                fill="#F5F5F0"
              />
            </svg>

            {/* In-Gauge Live Numerical Readout */}
            <div className="absolute bottom-1 text-center flex flex-col items-center">
              <span className="text-4xl sm:text-5xl font-light font-mono text-[#F5F5F0] tracking-tight leading-none">
                {projection.months}
              </span>
              <span className="text-[11px] uppercase font-mono tracking-widest text-[#8A8F98] mt-1">
                {projection.months > 1 
                  ? (t.views.dashboard.runwayProjection?.months || 'Months') 
                  : (t.views.dashboard.runwayProjection?.monthSingular || 'Month')} {language === 'fr' ? 'd\'autonomie' : 'of runway'}
              </span>
            </div>
          </div>

          {/* Gauge Tier Status Badge */}
          <div 
            className="mt-2 px-4 py-1.5 rounded-full border flex items-center gap-2 font-mono text-xs shadow-lg transition-all"
            style={{ 
              backgroundColor: `${currentTier.color}15`, 
              borderColor: `${currentTier.color}40`,
              color: currentTier.color 
            }}
          >
            <span 
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: currentTier.color }}
            />
            <span className="font-bold">{currentTier.label}</span>
          </div>

          {/* Scale Labels */}
          <div className="w-full max-w-[320px] flex items-center justify-between text-[10px] text-[#8A8F98] font-mono mt-3 px-3">
            <span>0m (Crit.)</span>
            <span>1m</span>
            <span>3m</span>
            <span className="text-[#D4FF3D] font-bold">6m (Obj.)</span>
            <span>12m+</span>
          </div>
        </div>

        {/* Right Column: Projection Horizon, Burn Analytics & Advice (Col 12 -> Col 6) */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Card 1: Projected Horizon Zero Date */}
          <div className="bg-[#0B0E17]/70 border border-[#1e293b] p-5 rounded-2xl flex items-start gap-4">
            <div 
              className="p-3 rounded-xl border flex-shrink-0"
              style={{ 
                backgroundColor: `${currentTier.color}15`, 
                borderColor: `${currentTier.color}30`,
                color: currentTier.color 
              }}
            >
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#8A8F98] uppercase font-mono tracking-wider block">
                {t.views.dashboard.runwayProjection?.forecastedHorizon || 'Projected Zero Horizon'}
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-[#F5F5F0] mt-0.5 capitalize">
                {formatHorizonMonthYear(projection.horizonDate)}
              </div>
              <span className="text-xs text-[#8A8F98] font-mono mt-0.5 block">
                ≈ {projection.daysRemaining} {language === 'fr' ? 'jours de trésorerie restante' : 'days of cash remaining'}
              </span>
            </div>
          </div>

          {/* Card 2: Burn Composition Grid */}
          <div className="bg-[#0B0E17]/70 border border-[#1e293b] p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#8A8F98] uppercase font-mono tracking-wider">
                {t.views.dashboard.runwayProjection?.monthlyBurnRate || 'Monthly Burn Rate'}
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#D4FF3D]">
                {formatCurrency(projection.effectiveBurn)} / {language === 'fr' ? 'mois' : 'mo'}
              </span>
            </div>

            {/* Visual breakdown progress bar */}
            <div className="w-full h-2.5 bg-[#161b27] rounded-full overflow-hidden flex border border-[#1e293b]">
              <div 
                style={{ width: `${Math.round((projection.fixedPart / projection.effectiveBurn) * 100)}%` }} 
                className="bg-[#38BDF8] h-full"
                title={`Fixed: ${formatCurrency(projection.fixedPart)}`}
              />
              <div 
                style={{ width: `${Math.round((projection.variablePart / projection.effectiveBurn) * 100)}%` }} 
                className="bg-[#34D399] h-full"
                title={`Variable: ${formatCurrency(projection.variablePart)}`}
              />
              <div 
                style={{ width: `${Math.round((projection.impulsePart / projection.effectiveBurn) * 100)}%` }} 
                className="bg-[#FBBF24] h-full"
                title={`Impulse: ${formatCurrency(projection.impulsePart)}`}
              />
            </div>

            {/* Mini Legend Row */}
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono pt-1">
              <div className="flex items-center gap-1.5 text-[#8A8F98]">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                <span>{t.views.dashboard.runwayProjection?.burnBreakdown?.fixed || 'Fixed'} ({formatCurrency(projection.fixedPart)})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#8A8F98]">
                <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                <span>{t.views.dashboard.runwayProjection?.burnBreakdown?.variable || 'Essential'} ({formatCurrency(projection.variablePart)})</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#8A8F98]">
                <span className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                <span>{t.views.dashboard.runwayProjection?.burnBreakdown?.discretionary || 'Impulse'} ({formatCurrency(projection.impulsePart)})</span>
              </div>
            </div>
          </div>

          {/* Card 3: AI Strategic Advice according to Tier */}
          <div className="bg-[#0B0E17]/70 border border-[#1e293b] p-4 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#D4FF3D] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#8A8F98] leading-relaxed">
              <span className="text-[#F5F5F0] font-medium block mb-0.5">
                {currentTier.label} :
              </span>
              {currentTier.desc}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Burn Sensitivity Tester Slider */}
      <div className="mt-4 pt-4 border-t border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-mono text-[#8A8F98]">
          <Sliders className="w-3.5 h-3.5 text-[#D4FF3D]" />
          <span>{language === 'fr' ? 'Simuler un ajustement de dépense :' : 'Simulate spending adjustment:'}</span>
          <span className={`font-bold ${manualAdjustment < 0 ? 'text-emerald-400' : manualAdjustment > 0 ? 'text-amber-400' : 'text-[#F5F5F0]'}`}>
            {manualAdjustment > 0 ? `+${formatCurrency(manualAdjustment)}` : formatCurrency(manualAdjustment)} / {language === 'fr' ? 'mois' : 'mo'}
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-64">
          <span className="text-[10px] font-mono text-emerald-400">-150</span>
          <input
            type="range"
            min="-150"
            max="150"
            step="25"
            value={manualAdjustment}
            onChange={(e) => setManualAdjustment(Number(e.target.value))}
            className="w-full h-1.5 bg-[#161b27] rounded-lg appearance-none cursor-pointer accent-[#D4FF3D]"
          />
          <span className="text-[10px] font-mono text-amber-400">+150</span>
          {manualAdjustment !== 0 && (
            <button
              onClick={() => setManualAdjustment(0)}
              className="text-[10px] text-[#8A8F98] hover:text-[#F5F5F0] underline font-mono cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
