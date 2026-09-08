import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import { useToast } from '../../context/ToastContext';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShoppingBag,
  TrendingDown,
  Check,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CanIAffordThisCardProps {
  onConsultNey?: (amount: number, title?: string, simulatedDays?: number) => void;
}

export const CanIAffordThisCard: React.FC<CanIAffordThisCardProps> = ({ onConsultNey }) => {
  const { t, formatCurrency, formatDaysShort, language } = useTranslation();
  const { computedRunway, userProfile } = useAuth();
  const { showToast } = useToast();
  const { 
    simulatedAmount, 
    setSimulatedAmount, 
    expenseTitle, 
    setExpenseTitle, 
    handlePresetClick, 
    simulationResult, 
    maxSliderValue 
  } = useSimulation();

  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const runwayDays = computedRunway?.runwayDays ?? 34;
  const safeToSpendToday = computedRunway?.safeToSpendToday ?? 24;

  const [decisionFeedback, setDecisionFeedback] = useState<{ type: 'buy' | 'wait'; message: string } | null>(null);

  // Student presets tailored to common lifestyle choices (tested: 50€, 100€, 120€, 250€)
  const presets = useMemo(() => {
    if (language === 'fr') {
      return [
        { label: 'Sortie / Soirée', amount: 50 },
        { label: 'Courses & Fournitures', amount: 100 },
        { label: 'Achat moyen (Test)', amount: 120 },
        { label: 'Voyage / Équipement', amount: 250 },
      ];
    }
    return [
      { label: 'Night out / Event', amount: 50 },
      { label: 'Groceries / Supplies', amount: 100 },
      { label: 'Mid purchase (Test)', amount: 120 },
      { label: 'Travel / Gear', amount: 250 },
    ];
  }, [language]);

  const daysDifference = simulationResult.daysDifference; // negative number or 0
  const absDaysDifference = Math.abs(daysDifference);

  // Factual, calm decision-support explanation without false guarantees
  const verdictText = useMemo(() => {
    if (simulatedAmount <= 0) {
      return language === 'fr' 
        ? 'Indique un montant pour mesurer instantanément la variation de ton runway.'
        : 'Enter an amount to see the instant change in your runway.';
    }

    if (simulationResult.scenario === 'GO') {
      return language === 'fr'
        ? `Cet achat ajuste ton runway à ${simulationResult.projectedDays} jours (variation de -${absDaysDifference} ${absDaysDifference <= 1 ? 'jour' : 'jours'}). Tes engagements principaux restent couverts.`
        : `This purchase adjusts your runway to ${simulationResult.projectedDays} days (-${absDaysDifference} ${absDaysDifference <= 1 ? 'day' : 'days'}). Planned commitments remain covered.`;
    }

    if (simulationResult.scenario === 'WAIT') {
      return language === 'fr'
        ? `Ton solde actuel permet cet achat, mais ton runway passe à ${simulationResult.projectedDays} jours. Attendre ta prochaine rentrée te permettrait de préserver ta marge.`
        : `Your balance covers this, but your runway drops to ${simulationResult.projectedDays} days. Waiting for your upcoming deposit would keep your cushion intact.`;
    }

    if (simulationResult.scenario === 'ADJUST') {
      return language === 'fr'
        ? `Cet achat réduit ton disponible aujourd'hui à ${formatCurrency(simulationResult.postSafeToSpend)}. Pense à modérer tes dépenses courantes les jours suivants.`
        : `This purchase reduces your safe-to-spend to ${formatCurrency(simulationResult.postSafeToSpend)}. Consider pacing non-essential spending for the next few days.`;
    }

    return language === 'fr'
      ? `Cette dépense réduirait fortement ton runway à ${simulationResult.projectedDays} jours et mettrait tes échéances principales sous tension.`
      : `This purchase would significantly reduce your runway to ${simulationResult.projectedDays} days and put pressure on upcoming planned commitments.`;
  }, [simulatedAmount, simulationResult, absDaysDifference, language, formatCurrency]);

  const handleBuy = () => {
    const titleText = expenseTitle.trim() || (language === 'fr' ? 'Achat envisagé' : 'Purchase');
    setDecisionFeedback({
      type: 'buy',
      message: language === 'fr'
        ? `Votre décision pour "${titleText}" (${formatCurrency(simulatedAmount)}) est enregistrée. L'IA conseille, vous décidez !`
        : `Your personal choice for "${titleText}" (${formatCurrency(simulatedAmount)}) is noted. AI advises, you decide!`,
    });
    showToast({
      type: 'success',
      title: language === 'fr' ? 'Décision personnelle' : 'Personal Decision',
      message: language === 'fr' 
        ? `Choix enregistré : vous restez seul maître à bord de vos dépenses.`
        : `Choice noted: you remain in complete control of your decisions.`,
      duration: 3500,
    });
  };

  const handleWait = () => {
    setDecisionFeedback({
      type: 'wait',
      message: language === 'fr'
        ? `Choix de temporiser noté. Ton runway actuel de ${runwayDays} jours reste préservé.`
        : `Choice to postpone noted. Your current runway of ${runwayDays} days remains untouched.`,
    });
    showToast({
      type: 'info',
      title: language === 'fr' ? 'Achat temporisé' : 'Purchase Postponed',
      message: language === 'fr'
        ? `Votre disponible actuel reste de ${formatCurrency(safeToSpendToday)}.`
        : `Your safe to spend today remains ${formatCurrency(safeToSpendToday)}.`,
      duration: 3000,
    });
  };

  const handleConsult = () => {
    if (onConsultNey) {
      onConsultNey(simulatedAmount, expenseTitle, simulationResult.projectedDays);
    }
  };

  return (
    <div 
      id="card-can-i-afford-this"
      className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6"
    >
      {/* Background subtle radial glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header: Signature Entry Point & User Autonomy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b]/70 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 flex items-center justify-center text-[#D4FF3D] shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] font-mono font-bold text-[#D4FF3D]">
                {language === 'fr' ? 'SIMULATION INSTANTANÉE' : 'INSTANT SIMULATION'}
              </span>
              <span className="text-[10px] font-mono text-[#8A8F98]">
                • {language === 'fr' ? 'Conséquence en 2 secondes' : '2-second consequence'}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-light text-[#F5F5F0]">
              {language === 'fr' ? 'Puis-je me le permettre ?' : 'Can I afford this?'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[#8A8F98] bg-[#0B0E17] px-3 py-1.5 rounded-full border border-[#1e293b]">
          <UserCheck className="w-3.5 h-3.5 text-[#D4FF3D]" />
          <span>{language === 'fr' ? 'L\'IA conseille. Vous décidez.' : 'AI advises. You decide.'}</span>
        </div>
      </div>

      {/* Quick Student Presets */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase font-mono text-[#8A8F98] tracking-wider block">
          {language === 'fr' ? 'Exemples de dépenses étudiantes :' : 'Common student expenses:'}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePresetClick(p.amount, p.label)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                simulatedAmount === p.amount && expenseTitle === p.label
                  ? 'bg-[#D4FF3D]/10 border-[#D4FF3D] text-[#D4FF3D]'
                  : 'bg-[#0B0E17] border-[#1e293b] hover:border-[#D4FF3D]/40 text-[#B8BCC4]'
              }`}
            >
              <span className="text-xs font-medium block truncate">{p.label}</span>
              <span className="text-sm font-mono font-bold text-[#F5F5F0] mt-0.5 block">
                {formatCurrency(p.amount)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input: Amount & Title */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#0B0E17] p-3 sm:p-4 rounded-2xl border border-[#1e293b]">
        <div className="sm:col-span-7 flex flex-col justify-center">
          <label htmlFor="input-afford-title" className="text-[10px] font-mono uppercase text-[#8A8F98] mb-1">
            {language === 'fr' ? 'Nature de l\'achat' : 'Purchase / Decision'}
          </label>
          <input
            id="input-afford-title"
            type="text"
            value={expenseTitle}
            onChange={(e) => setExpenseTitle(e.target.value)}
            placeholder={language === 'fr' ? 'Ex: Dîner resto, Baskets, Week-end...' : 'e.g. Dinner, Sneakers, Travel...'}
            className="w-full bg-[#161b27] border border-[#1e293b] focus:border-[#D4FF3D] rounded-xl px-3.5 py-2 text-xs text-[#F5F5F0] placeholder-[#8A8F98]/50 outline-none transition-all"
          />
        </div>

        <div className="sm:col-span-5 flex flex-col justify-center">
          <label htmlFor="input-afford-amount" className="text-[10px] font-mono uppercase text-[#8A8F98] mb-1">
            {language === 'fr' ? 'Montant envisagé' : 'Amount'}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="input-afford-amount"
              type="number"
              min="0"
              max={currentBalance}
              value={simulatedAmount || ''}
              onChange={(e) => setSimulatedAmount(Math.max(0, Number(e.target.value)))}
              className="w-full bg-[#161b27] border border-[#1e293b] focus:border-[#D4FF3D] rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-[#D4FF3D] outline-none transition-all"
              placeholder="0"
            />
            <span className="text-xs font-mono text-[#8A8F98] shrink-0">
              {userProfile?.currency || 'EUR'}
            </span>
          </div>
        </div>

        {/* Quick Amount Slider */}
        <div className="sm:col-span-12 pt-2">
          <input
            id="slider-afford-amount"
            type="range"
            min="0"
            max={maxSliderValue}
            step="5"
            value={simulatedAmount}
            onChange={(e) => setSimulatedAmount(Number(e.target.value))}
            className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#D4FF3D]"
          />
        </div>
      </div>

      {/* SIGNATURE INTERACTION COMPONENT: BEFORE → AFTER → IMPACT */}
      <div className="bg-gradient-to-br from-[#121622] to-[#0B0E17] border border-[#1e293b] rounded-3xl p-5 sm:p-6 space-y-4 shadow-inner">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
          
          {/* 1. BEFORE */}
          <div className="bg-[#0B0E17] border border-[#1e293b] rounded-2xl p-4 text-center flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#8A8F98] block">
              {language === 'fr' ? 'AVANT' : 'BEFORE'}
            </span>
            <div className="my-2">
              <span className="text-3xl sm:text-4xl font-mono font-light text-[#F5F5F0]">
                {runwayDays}
              </span>
              <span className="text-xs font-mono text-[#8A8F98] ml-1.5">
                {language === 'fr' ? 'jours' : 'days'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#8A8F98]">
              {language === 'fr' ? 'Runway actuel' : 'Current runway'}
            </span>
          </div>

          {/* 2. AFTER THIS PURCHASE */}
          <div className="bg-[#0B0E17] border border-[#D4FF3D]/30 rounded-2xl p-4 text-center flex flex-col justify-between relative shadow-[0_0_15px_rgba(212,255,61,0.08)]">
            <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#D4FF3D] font-bold block">
              {language === 'fr' ? 'APRÈS CET ACHAT' : 'AFTER THIS PURCHASE'}
            </span>
            <div className="my-2">
              <span className="text-3xl sm:text-4xl font-mono font-light text-[#D4FF3D]">
                {simulationResult.projectedDays}
              </span>
              <span className="text-xs font-mono text-[#D4FF3D]/70 ml-1.5">
                {language === 'fr' ? 'jours' : 'days'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#8A8F98]">
              {language === 'fr' ? `Pour ${formatCurrency(simulatedAmount)}` : `For ${formatCurrency(simulatedAmount)}`}
            </span>
          </div>

          {/* 3. IMPACT */}
          <div className="bg-[#0B0E17] border border-[#1e293b] rounded-2xl p-4 text-center flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#8A8F98] block">
              {language === 'fr' ? 'IMPACT' : 'IMPACT'}
            </span>
            <div className="my-2">
              <span className={`text-3xl sm:text-4xl font-mono font-light ${
                daysDifference < 0 ? 'text-[#FACC15]' : 'text-[#38BDF8]'
              }`}>
                {daysDifference === 0 ? '0' : `${daysDifference}`}
              </span>
              <span className="text-xs font-mono text-[#8A8F98] ml-1.5">
                {language === 'fr' ? 'jours' : 'days'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#8A8F98]">
              {daysDifference === 0 
                ? (language === 'fr' ? 'Neutre' : 'Neutral') 
                : (language === 'fr' ? 'Sur ton autonomie' : 'On your horizon')}
            </span>
          </div>

        </div>

        {/* Verdict in calm decision-support language */}
        <div className="pt-3 border-t border-[#1e293b]/70 flex items-start gap-2.5 text-xs leading-relaxed text-[#B8BCC4]">
          <Sparkles className="w-4 h-4 text-[#D4FF3D] shrink-0 mt-0.5" />
          <p>{verdictText}</p>
        </div>
      </div>

      {/* Decision Feedback Banner if user clicked Buy or Wait */}
      <AnimatePresence>
        {decisionFeedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
              decisionFeedback.type === 'buy'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-[#38BDF8]/10 border-[#38BDF8]/30 text-[#38BDF8]'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{decisionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setDecisionFeedback(null)}
              className="text-[10px] font-mono uppercase underline hover:opacity-75 cursor-pointer shrink-0"
            >
              {language === 'fr' ? 'Fermer' : 'Dismiss'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The 3 Core Action Buttons: J'ACHÈTE, J'ATTENDS, DEMANDER À NEY */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-[#8A8F98] px-1">
          <span>{language === 'fr' ? 'Votre décision personnelle :' : 'Your personal choice:'}</span>
          <span>{language === 'fr' ? 'Ney n\'approuve ni ne bloque vos dépenses' : 'Ney does not authorize or block spending'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. J'ACHÈTE */}
          <button
            id="btn-afford-buy"
            type="button"
            onClick={handleBuy}
            disabled={simulatedAmount <= 0}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] text-[#F5F5F0] border border-[#1e293b] hover:border-[#D4FF3D]/50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-40"
          >
            <Check className="w-4 h-4 text-[#D4FF3D]" />
            <span>{language === 'fr' ? 'J\'achète' : 'I Buy'}</span>
          </button>

          {/* 2. J'ATTENDS */}
          <button
            id="btn-afford-wait"
            type="button"
            onClick={handleWait}
            disabled={simulatedAmount <= 0}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] text-[#F5F5F0] border border-[#1e293b] hover:border-[#FACC15]/50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-40"
          >
            <Clock className="w-4 h-4 text-[#FACC15]" />
            <span>{language === 'fr' ? 'J\'attends' : 'I Wait'}</span>
          </button>

          {/* 3. DEMANDER À NEY */}
          <button
            id="btn-afford-ask-ney"
            type="button"
            onClick={handleConsult}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(212,255,61,0.25)] active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>{language === 'fr' ? 'Demander à Ney' : 'Ask Ney'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
