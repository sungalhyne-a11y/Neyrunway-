import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { computeAndSaveUserRunway } from '../lib/runwayEngine';
import { analytics } from '../lib/analytics';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { DecisionSimulator } from '../components/simulator/DecisionSimulator';
import { DecisionSurfaceCard } from '../components/dashboard/DecisionSurfaceCard';
import { RunwayTimeline } from '../components/dashboard/RunwayTimeline';
import { RunwayForecastChart } from '../components/dashboard/RunwayForecastChart';
import { MonthlySpendingTrendsChart } from '../components/dashboard/MonthlySpendingTrendsChart';
import { RunwayProjectionGauge } from '../components/dashboard/RunwayProjectionGauge';
import { SampleBenchmarkCard } from '../components/common/SampleBenchmarkCard';
import { 
  Sparkles, 
  RefreshCw, 
  Wallet, 
  ShieldCheck, 
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Activity,
  WifiOff,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const DashboardView: React.FC<{ onNavigateToChat: (initialQuery?: string) => void }> = ({ onNavigateToChat }) => {
  const { t, formatCurrency, formatDays, formatDate, language } = useTranslation();
  const { currentUser, userProfile, computedRunway, isOnline, lastSyncedAt, recomputeRunway } = useAuth();
  const { showToast } = useToast();
  const [isRecalculating, setIsRecalculating] = useState(false);

  const runwayDays = computedRunway?.runwayDays ?? 34;
  const safeToSpend = computedRunway?.safeToSpendToday ?? 24;
  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const dailyBurn = computedRunway?.projectedBurnPerDay ?? 38;
  const totalFixedExpenses = computedRunway?.totalFixedExpenses ?? 450;
  const nextIncomeDate = computedRunway?.nextIncomeDate;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;
  const nextIncomeSource = computedRunway?.nextIncomeSource;

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      if (!isOnline || !currentUser || currentUser.isAnonymous) {
        // Deterministic local computation when offline or guest
        await recomputeRunway();
        showToast({
          type: 'info',
          title: t.offline?.offlineTitle || 'Mode hors-ligne',
          message: t.offline?.offlineRecalculateToast || 'Recalcul local du runway effectué avec succès.',
          duration: 3500,
        });
      } else {
        await computeAndSaveUserRunway(currentUser.uid);
        showToast({
          type: 'info',
          title: t.views.dashboard.recalculate,
          message: language === 'fr' ? 'Runway synchronisé et recalculé avec succès.' : 'Runway synchronized and recalculated.',
          duration: 3000,
        });
      }
    } catch (err) {
      console.warn('Recalculation fallback engaged:', err);
      await recomputeRunway();
    } finally {
      setIsRecalculating(false);
    }
  };

  // Projected end date of current runway
  const projectedEndDate = new Date();
  projectedEndDate.setDate(projectedEndDate.getDate() + runwayDays);

  const formattedLastSync = lastSyncedAt 
    ? new Date(lastSyncedAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleSimulatorConsult = (amount: number, title?: string, simulatedDays?: number) => {
    const formattedAmount = formatCurrency(amount);
    const daysStr = String(simulatedDays ?? 0);
    const query = title 
      ? (language === 'fr' 
          ? `J'envisage un achat "${title}" d'un montant de ${formattedAmount}. Mon simulateur indique que mon runway passerait à ${daysStr} jours. Quel est ton conseil ?`
          : `I am considering an expense "${title}" of ${formattedAmount}. My simulator indicates my runway would adjust to ${daysStr} days. What is your advice?`)
      : (language === 'fr'
          ? `Que penses-tu d'une dépense de ${formattedAmount} ? Mon runway passerait à environ ${daysStr} jours.`
          : `What do you think of spending ${formattedAmount}? My runway would adjust to about ${daysStr} days.`);
    onNavigateToChat(query);
  };

  return (
    <div className="space-y-8">
      {/* Luxury Minimalist Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#D4FF3D] text-[11px] font-bold tracking-[0.15em] uppercase font-mono px-2 py-0.5 rounded-md bg-[#D4FF3D]/10 border border-[#D4FF3D]/20">
              {t.views.dashboard.liveRunwayBadge}
            </span>
            <span className="text-xs text-[#8A8F98] font-mono">
              • {userProfile?.region || 'FR'} ({userProfile?.currency || 'EUR'})
            </span>
            {!isOnline && (
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 flex items-center gap-1">
                <WifiOff className="w-2.5 h-2.5" />
                {t.offline?.offlineTitle || 'Hors-ligne'}
              </span>
            )}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-[#F5F5F0]">
            {t.views.dashboard.title}
          </h2>
          <p className="text-xs md:text-sm text-[#8A8F98] mt-1">
            {t.views.dashboard.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            id="btn-dashboard-recalculate"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="px-3.5 py-2 rounded-full bg-[#161b27] hover:bg-[#1e293b] border border-[#1e293b] text-xs font-mono text-[#8A8F98] hover:text-[#F5F5F0] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D4FF3D] ${isRecalculating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t.views.dashboard.recalculate}</span>
          </button>

          <button
            id="btn-dashboard-open-chat"
            onClick={() => onNavigateToChat()}
            className="px-4 py-2 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.views.dashboard.openChatWithNey}</span>
          </button>
        </div>
      </header>

      {/* Hero Elevation: Runway Days + Safe to Spend Today */}
      <div 
        id="dashboard-hero-elevation"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Central Hero Runway Card */}
        <div className="lg:col-span-8 bg-gradient-to-br from-[#161b27] via-[#121622] to-[#0B0E17] p-6 sm:p-8 md:p-10 rounded-3xl border border-[#1e293b] flex flex-col justify-between min-h-[340px] relative overflow-hidden shadow-2xl">
          {/* Luminous approach light glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4FF3D]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Hero Section */}
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[#8A8F98] text-xs uppercase tracking-widest font-mono">
                {t.views.dashboard.currentRunway}
              </span>
              <span className="px-3 py-1 bg-[#D4FF3D]/10 text-[#D4FF3D] text-[10px] font-bold rounded-full border border-[#D4FF3D]/30 tracking-wider font-mono">
                {t.views.dashboard.stableBadge}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-[#8A8F98] uppercase font-mono">
                {t.views.dashboard.heroTitle}
              </span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-6xl sm:text-7xl lg:text-8xl font-light text-[#D4FF3D] tracking-tighter font-mono">
                  <AnimatedCounter value={runwayDays} duration={900} />
                </h3>
                <span className="text-2xl sm:text-3xl font-medium tracking-normal text-[#F5F5F0] font-sans">
                  {t.onboarding.steps.summary.daysUnit}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#8A8F98] mt-2 max-w-lg leading-relaxed">
              {t.views.dashboard.heroSubtitle}
            </p>
          </div>

          {/* Bottom Hero Stats & Safe to spend preview */}
          <div className="relative z-10 pt-6 mt-6 border-t border-[#1e293b]/70 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#0B0E17] border border-[#1e293b] flex items-center justify-center text-[#D4FF3D]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-[#8A8F98] font-mono uppercase block">
                  {t.views.dashboard.projectedDate}
                </span>
                <span className="text-sm font-medium text-[#F5F5F0] font-mono">
                  {formatDate(projectedEndDate)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#8A8F98] font-mono uppercase block">
                {t.views.dashboard.liquidBalance}
              </span>
              <span className="text-lg font-bold text-[#F5F5F0] font-mono">
                {formatCurrency(currentBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side Elevation: Safe to Spend Today Card */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Safe to Spend Hero Box */}
          <div className="bg-[#161b27] border border-[#1e293b] p-6 sm:p-7 rounded-3xl shadow-xl flex-1 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#38BDF8]/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#8A8F98] uppercase tracking-[0.2em] font-bold font-mono">
                  {t.views.dashboard.safeToSpendToday}
                </span>
                <span className="text-[10px] font-mono text-[#38BDF8] px-2 py-0.5 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/20">
                  {t.views.dashboard.safePerDayBadge}
                </span>
              </div>

              <div className="text-4xl sm:text-5xl font-light text-[#F5F5F0] font-mono my-3">
                <AnimatedCounter 
                  value={safeToSpend} 
                  duration={800} 
                  formatter={(v) => formatCurrency(v)} 
                />
                <span className="text-xs font-sans text-[#8A8F98] ml-1">{t.views.dashboard.perDayUnit}</span>
              </div>

              <p className="text-xs text-[#8A8F98] leading-relaxed">
                {t.views.dashboard.safeToSpendSub}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-[#1e293b] space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#8A8F98]">{t.views.dashboard.fixedTotal} :</span>
                <span className="text-[#F5F5F0] font-medium">{formatCurrency(totalFixedExpenses)}{t.views.dashboard.perMonthUnitShort || (language === 'fr' ? '/m' : '/mo')}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#8A8F98]">{t.views.dashboard.monthlyBurnRate} :</span>
                <span className="text-[#F5F5F0] font-medium">~{formatCurrency(dailyBurn)}{t.views.dashboard.perDayUnitShort || (language === 'fr' ? '/j' : '/d')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decision Surface: Next Financial Event & One Useful Insight & Quick Triggers */}
      <DecisionSurfaceCard onNavigateToChat={onNavigateToChat} />

      {/* Embedded Instant Decision Simulator */}
      <div>
        <DecisionSimulator onConsultNey={handleSimulatorConsult} />
      </div>

      {/* Recharts Runway Projection Multi-Month Gauge & Horizon Forecast */}
      <RunwayProjectionGauge />

      {/* Recharts 30-Day Financial Runway Trajectory Visualizer */}
      <RunwayForecastChart />

      {/* Recharts Monthly Spending Trends & Category Analytics */}
      <MonthlySpendingTrendsChart />

      {/* Visual Timeline Milestone Section */}
      <RunwayTimeline />

      {/* Philosophy & Architecture Footer */}
      <footer className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[#8A8F98] border-t border-[#1e293b] pt-6 pb-4 gap-4">
        <div className="flex flex-wrap gap-8">
          <div className="flex flex-col gap-0.5">
            <p className="text-[9px] uppercase tracking-widest font-mono text-[#8A8F98]">{t.views.dashboard.footerConnectedCopilot}</p>
            <p className="text-xs text-[#F5F5F0] font-medium">Gemini 3.7 Flash + Ingestion Contexte</p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[9px] uppercase tracking-widest font-mono text-[#8A8F98]">{t.views.dashboard.footerFormatsRegion}</p>
            <p className="text-xs text-[#F5F5F0] font-medium">{userProfile?.region || 'FR'} • {userProfile?.currency || 'EUR'}</p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[9px] uppercase tracking-widest font-mono text-[#8A8F98]">{t.views.dashboard.footerGoldenRule}</p>
            <p className="text-xs text-[#F5F5F0] font-medium">{t.brand.philosophies.aiAdvises}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
