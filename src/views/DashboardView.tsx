import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { computeAndSaveUserRunway } from '../lib/runwayEngine';
import { analytics } from '../lib/analytics';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { NextMoveCard } from '../components/dashboard/NextMoveCard';
import { CanIAffordThisCard } from '../components/dashboard/CanIAffordThisCard';
import { AskNeyCard } from '../components/dashboard/AskNeyCard';
import { RunwayTimeline } from '../components/dashboard/RunwayTimeline';
import { RunwayForecastChart } from '../components/dashboard/RunwayForecastChart';
import { MonthlySpendingTrendsChart } from '../components/dashboard/MonthlySpendingTrendsChart';
import { RunwayProjectionGauge } from '../components/dashboard/RunwayProjectionGauge';
import { 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  ChevronDown,
  ChevronUp,
  BarChart3,
  Calendar,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const DashboardView: React.FC<{ 
  onNavigateToChat: (initialQuery?: string) => void;
  onNavigateToRoute?: (route: any) => void;
}> = ({ onNavigateToChat, onNavigateToRoute }) => {
  const { t, formatCurrency, formatDays, formatDate, language } = useTranslation();
  const { currentUser, userProfile, computedRunway, isOnline, lastSyncedAt, recomputeRunway } = useAuth();
  const { showToast } = useToast();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);
  const [recentChanges, setRecentChanges] = useState<{ type: string; label: string; icon: string }[] | null>(null);
  const [showChangeBanner, setShowChangeBanner] = useState(true);

  const runwayDays = computedRunway?.runwayDays ?? 34;
  const safeToSpend = computedRunway?.safeToSpendToday ?? 24;
  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const dailyBurn = computedRunway?.projectedBurnPerDay ?? 38;
  const totalFixedExpenses = computedRunway?.totalFixedExpenses ?? 450;
  const nextIncomeDate = computedRunway?.nextIncomeDate;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;
  const nextIncomeSource = computedRunway?.nextIncomeSource;
  const daysUntilNextIncome = computedRunway?.daysUntilNextIncome ?? 14;

  // Track return experience & surface what changed since last visit
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('neyrunway_last_visit_snapshot');
      const now = Date.now();
      if (raw) {
        const prev = JSON.parse(raw);
        if (now - prev.timestamp > 60 * 1000) {
          const diffs: { type: string; label: string; icon: string }[] = [];

          if (runwayDays !== prev.runwayDays) {
            const diff = runwayDays - prev.runwayDays;
            diffs.push({
              type: 'runway',
              label: language === 'fr'
                ? `Ton runway a évolué de ${diff > 0 ? '+' : ''}${diff} ${Math.abs(diff) <= 1 ? 'jour' : 'jours'} (actuellement ${runwayDays} jours).`
                : `Your runway adjusted by ${diff > 0 ? '+' : ''}${diff} days (currently ${runwayDays} days).`,
              icon: '⚡',
            });
          }

          if (daysUntilNextIncome && prev.daysUntilIncome && daysUntilNextIncome !== prev.daysUntilIncome) {
            diffs.push({
              type: 'income',
              label: language === 'fr'
                ? `Ton prochain revenu approche : plus que ${daysUntilNextIncome} jours.`
                : `Upcoming income is approaching: ${daysUntilNextIncome} days left.`,
              icon: '📅',
            });
          }

          if (totalFixedExpenses > 0) {
            diffs.push({
              type: 'fixed',
              label: language === 'fr'
                ? `${formatCurrency(totalFixedExpenses)} de charges fixes restent sanctuarisés dans ton calcul.`
                : `${formatCurrency(totalFixedExpenses)} in fixed charges remain ring-fenced in your projection.`,
              icon: '🛡️',
            });
          }

          if (diffs.length > 0) {
            setRecentChanges(diffs);
            analytics.track('second_session', {
              changesCount: diffs.length,
            });
          }
        }
      }

      localStorage.setItem(
        'neyrunway_last_visit_snapshot',
        JSON.stringify({
          timestamp: now,
          runwayDays,
          safeToSpend,
          balance: currentBalance,
          daysUntilIncome: daysUntilNextIncome,
        })
      );
    } catch {}
  }, [runwayDays, safeToSpend, currentBalance, daysUntilNextIncome, totalFixedExpenses, language]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      if (!isOnline || !currentUser || currentUser.isAnonymous) {
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

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = userProfile?.displayName?.split(' ')[0] || (language === 'fr' ? 'Étudiant' : 'Student');
    if (language === 'fr') {
      return hour >= 18 ? `Bonsoir, ${name}` : `Bonjour, ${name}`;
    }
    return hour >= 18 ? `Good evening, ${name}` : `Good morning, ${name}`;
  };

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
    <div className="space-y-7">
      {/* 01 — WHERE AM I? (Contextual Student Copilot Header) */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[#D4FF3D] text-[10px] font-bold tracking-[0.2em] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[#D4FF3D]/10 border border-[#D4FF3D]/25 shadow-[0_0_12px_rgba(212,255,61,0.15)]">
              {language === 'fr' ? 'COPILOTE FINANCIER' : 'FINANCIAL COPILOT'}
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
          
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight text-[#F5F5F0]">
            {getGreeting()}
          </h2>
          <p className="text-xs sm:text-sm text-[#8A8F98] mt-1">
            {language === 'fr' 
              ? 'Sache exactement ce que tu peux faire avec ton argent aujourd\'hui.' 
              : 'Know what you can safely do with your money today.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            id="btn-dashboard-recalculate"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            title={t.views.dashboard.recalculate}
            className="px-3 py-2 rounded-full bg-[#161b27] hover:bg-[#1e293b] border border-[#1e293b] text-xs font-mono text-[#8A8F98] hover:text-[#F5F5F0] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D4FF3D] ${isRecalculating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t.views.dashboard.recalculate}</span>
          </button>

          <button
            id="btn-dashboard-open-chat"
            onClick={() => onNavigateToChat()}
            className="px-4 py-2 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Poser une question à Ney' : 'Ask Ney'}</span>
          </button>
        </div>
      </header>

      {/* Return Experience: What changed since your last visit? */}
      {showChangeBanner && recentChanges && recentChanges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="p-4 rounded-2xl bg-[#0B0E17] border border-[#D4FF3D]/25 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D4FF3D] bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 px-2 py-0.5 rounded-md">
                {language === 'fr' ? 'DEPUIS TON DERNIER PASSAGE' : 'SINCE YOUR LAST VISIT'}
              </span>
              <span className="text-[11px] text-[#8A8F98]">
                {language === 'fr' ? 'Faits financiers récents' : 'Recent factual updates'}
              </span>
            </div>
            <div className="space-y-1">
              {recentChanges.map((c, idx) => (
                <p key={idx} className="text-xs text-[#F5F5F0] flex items-center gap-2">
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </p>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowChangeBanner(false)}
            className="self-end sm:self-center px-3 py-1.5 rounded-xl bg-[#161b27] hover:bg-[#1e293b] border border-[#1e293b] text-xs font-mono text-[#8A8F98] hover:text-[#F5F5F0] transition-colors cursor-pointer whitespace-nowrap"
          >
            {language === 'fr' ? 'Compris' : 'Dismiss'}
          </button>
        </motion.div>
      )}

      {/* 01 — SAFE TO SPEND TODAY & 02 — RUNWAY & 03 — NEXT INCOME */}
      <div 
        id="dashboard-core-elevation"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6"
      >
        {/* 01 — SAFE TO SPEND TODAY (REMOVE AMBIGUITY: RIGHT NOW, NOT A FIXED DAILY BUDGET) */}
        <div 
          id="card-safe-to-spend-today"
          className="lg:col-span-5 bg-gradient-to-br from-[#161b27] via-[#141924] to-[#0B0E17] border border-[#1e293b] p-6 sm:p-7 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#38BDF8]/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/30 px-2 py-0.5 rounded-md">
                  01
                </span>
                <span className="text-[11px] text-[#F5F5F0] uppercase tracking-[0.2em] font-bold font-mono">
                  {language === 'fr' ? 'DISPONIBLE AUJOURD\'HUI' : 'SAFE TO SPEND TODAY'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#38BDF8] px-2 py-0.5 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/20">
                {language === 'fr' ? 'À cet instant' : 'Right now'}
              </span>
            </div>

            {/* Primary Amount: Clear, prominent, without fixed budget "/ jour" suffix */}
            <div className="my-3">
              <h3 className="text-4xl sm:text-5xl lg:text-6xl font-light text-[#F5F5F0] font-mono tracking-tight">
                <AnimatedCounter 
                  value={safeToSpend} 
                  duration={800} 
                  formatter={(v) => formatCurrency(v)} 
                />
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-[#8A8F98] leading-relaxed">
              {language === 'fr'
                ? `Ce que tu peux dépenser maintenant sans compromettre tes engagements prévus. Calculé à partir de ton horizon financier, ce n'est pas un budget fixe rigide.`
                : `What you can safely spend right now without putting planned commitments at risk. Calculated from your financial horizon, not a rigid budget.`}
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-[#1e293b] space-y-1.5 text-xs font-mono text-[#8A8F98]">
            <div className="flex justify-between">
              <span>{language === 'fr' ? 'Engagements mensuels prévus' : 'Planned monthly bills'} :</span>
              <span className="text-[#F5F5F0] font-medium">{formatCurrency(totalFixedExpenses)}{language === 'fr' ? '/mois' : '/mo'}</span>
            </div>
            <div className="flex justify-between">
              <span>{language === 'fr' ? 'Rythme moyen estimé' : 'Estimated pacing'} :</span>
              <span className="text-[#F5F5F0] font-medium">~{formatCurrency(dailyBurn)}{language === 'fr' ? '/j' : '/d'}</span>
            </div>
          </div>
        </div>

        {/* 02 — RUNWAY (VISUAL HERO: CALM, SPACIOUS, PREMIUM) */}
        <div 
          id="card-hero-runway"
          className="lg:col-span-7 bg-gradient-to-br from-[#161b27] via-[#121622] to-[#0B0E17] p-6 sm:p-8 md:p-9 rounded-3xl border border-[#1e293b] flex flex-col justify-between min-h-[320px] relative overflow-hidden shadow-2xl"
        >
          {/* Luminous approach light glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4FF3D]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top: Runway Concept */}
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-[#D4FF3D] bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 px-2 py-0.5 rounded-md">
                  02
                </span>
                <span className="text-[#F5F5F0] text-[11px] uppercase tracking-[0.2em] font-mono font-bold">
                  RUNWAY
                </span>
              </div>
              <span className="px-3 py-1 bg-[#D4FF3D]/10 text-[#D4FF3D] text-[10px] font-bold rounded-full border border-[#D4FF3D]/30 tracking-wider font-mono">
                {language === 'fr' ? 'HORIZON FINANCIER' : 'FINANCIAL HORIZON'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 my-2">
              <span className="text-xs sm:text-sm text-[#8A8F98] uppercase font-mono tracking-wider">
                {language === 'fr' ? 'Autonomie estimée' : 'Current Runway'}
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
              {language === 'fr' 
                ? `Tes engagements principaux sont actuellement couverts jusqu'au ${formatDate(projectedEndDate)}.`
                : `Your main upcoming commitments are currently covered through ${formatDate(projectedEndDate)}.`}
            </p>
          </div>

          {/* Bottom: Contextual Runway Milestones */}
          <div className="relative z-10 pt-5 mt-5 border-t border-[#1e293b]/70 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-2.5 text-[#8A8F98]">
              <ShieldCheck className="w-4 h-4 text-[#D4FF3D]" />
              <span>
                {language === 'fr' ? 'Couverture projetée jusqu\'au' : 'Projected coverage through'} : <strong className="text-[#F5F5F0]">{formatDate(projectedEndDate)}</strong>
              </span>
            </div>

            <div className="text-right">
              <span className="text-[#8A8F98]">{language === 'fr' ? 'Solde disponible' : 'Available balance'} : </span>
              <strong className="text-base text-[#F5F5F0] font-mono">{formatCurrency(currentBalance)}</strong>
            </div>
          </div>
        </div>

        {/* 03 — NEXT INCOME (CLEAR CONTEXTUAL STRIP) */}
        <div 
          id="card-next-income"
          className="lg:col-span-12 bg-[#121622] border border-[#1e293b] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold text-[#D4FF3D] bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 px-2 py-0.5 rounded-md shrink-0">
              03
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#0B0E17] border border-[#1e293b] flex items-center justify-center text-[#D4FF3D] shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-bold text-[#8A8F98] tracking-wider">
                  {language === 'fr' ? 'PROCHAINE RENTRÉE' : 'NEXT INCOME'}
                </span>
                <span className="text-xs font-mono font-bold text-[#D4FF3D]">
                  {nextIncomeAmount > 0 ? `+${formatCurrency(nextIncomeAmount)}` : (language === 'fr' ? 'En attente' : 'None scheduled')}
                </span>
              </div>
              <p className="text-xs text-[#8A8F98] mt-0.5">
                {nextIncomeAmount > 0 
                  ? (language === 'fr' 
                      ? `${nextIncomeSource || 'Versement'} attendu dans ${daysUntilNextIncome === 0 ? "aujourd'hui" : `${daysUntilNextIncome} jours`}. Tes échéances restent couvertes d'ici là.`
                      : `${nextIncomeSource || 'Deposit'} expected in ${daysUntilNextIncome === 0 ? 'today' : `${daysUntilNextIncome} days`}. Planned commitments remain covered until then.`)
                  : (language === 'fr' 
                      ? 'Aucune rentrée prochaine programmée. Le calcul s\'appuie sur ton solde disponible.' 
                      : 'No upcoming deposit scheduled. Calculations use current available cash.')}
              </p>
            </div>
          </div>

          {nextIncomeAmount > 0 && (
            <div className="self-end sm:self-auto shrink-0 font-mono text-xs px-3 py-1.5 rounded-xl bg-[#0B0E17] border border-[#1e293b] text-[#8A8F98]">
              {daysUntilNextIncome === 0 
                ? (language === 'fr' ? 'Arrive aujourd\'hui' : 'Arriving today') 
                : `${language === 'fr' ? 'J-' : 'T-'}${daysUntilNextIncome}`}
            </div>
          )}
        </div>
      </div>

      {/* 04 — WHAT SHOULD I DO NEXT? (The Permanent Next Move Layer) */}
      <NextMoveCard 
        onAction={(query) => onNavigateToChat(query)} 
        onNavigateToMemory={() => onNavigateToRoute?.('transactions')}
      />

      {/* SIGNATURE INTERACTION: "CAN I AFFORD THIS?" */}
      <CanIAffordThisCard onConsultNey={handleSimulatorConsult} />

      {/* ASK NEY: CONTEXTUAL FINANCIAL COPILOT LAYER */}
      <AskNeyCard onNavigateToChat={onNavigateToChat} />

      {/* PROGRESSIVE DISCLOSURE: DEEP FINANCIAL ANALYTICS & RECHARTS */}
      <div className="pt-2 border-t border-[#1e293b]/70">
        <button
          id="btn-toggle-advanced-analytics"
          type="button"
          onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
          className="w-full py-3.5 px-5 rounded-2xl bg-[#161b27]/60 hover:bg-[#161b27] border border-[#1e293b] hover:border-[#8A8F98]/40 text-xs font-mono text-[#8A8F98] hover:text-[#F5F5F0] flex items-center justify-between transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-4 h-4 text-[#D4FF3D]" />
            <span>
              {showAdvancedAnalytics 
                ? (language === 'fr' ? 'Masquer les analyses détaillées & graphiques' : 'Hide deep analytics & charts')
                : (language === 'fr' ? 'Explorer les visualisations avancées (Trajectoire 30j, Jauge horizon, Dépenses mensuelles)' : 'Explore deep financial analytics (30-day forecast, Horizon gauge, Monthly trends)')}
            </span>
          </div>
          {showAdvancedAnalytics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showAdvancedAnalytics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 pt-5"
            >
              {/* Recharts Runway Projection Multi-Month Gauge & Horizon Forecast */}
              <RunwayProjectionGauge />

              {/* Recharts 30-Day Financial Runway Trajectory Visualizer */}
              <RunwayForecastChart />

              {/* Recharts Monthly Spending Trends & Category Analytics */}
              <MonthlySpendingTrendsChart />

              {/* Visual Timeline Milestone Section */}
              <RunwayTimeline />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Philosophy & Architecture Footer */}
      <footer className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[#8A8F98] border-t border-[#1e293b] pt-6 pb-4 gap-4">
        <div className="flex flex-wrap gap-8">
          <div className="flex flex-col gap-0.5">
            <p className="text-[9px] uppercase tracking-widest font-mono text-[#8A8F98]">{t.views.dashboard.footerConnectedCopilot}</p>
            <p className="text-xs text-[#F5F5F0] font-medium">Gemini 3.7 Flash • Contexte Actif</p>
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

