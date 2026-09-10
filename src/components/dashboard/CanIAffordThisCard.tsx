import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import { useToast } from '../../context/ToastContext';
import { Transaction } from '../../types';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { analytics } from '../../lib/analytics';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShoppingBag, 
  TrendingDown, 
  Check, 
  UserCheck, 
  ShieldCheck,
  Search,
  Zap,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CanIAffordThisCardProps {
  onConsultNey?: (amount: number, title?: string, simulatedDays?: number) => void;
}

export const CanIAffordThisCard: React.FC<CanIAffordThisCardProps> = ({ onConsultNey }) => {
  const { t, formatCurrency, formatDaysShort, language } = useTranslation();
  const { currentUser, computedRunway, userProfile, recomputeRunway, transactions } = useAuth();
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
  const [omniboxInput, setOmniboxInput] = useState('');

  // 7 Student life situation presets (Courses, Achat, Transport, Loyer, Voyage, Études, Sortie)
  const presets = useMemo(() => {
    if (language === 'fr') {
      return [
        { icon: '🍎', label: 'Courses', amount: 35 },
        { icon: '🎧', label: 'Achat', amount: 89 },
        { icon: '🚆', label: 'Transport', amount: 25 },
        { icon: '🏠', label: 'Loyer', amount: 450 },
        { icon: '✈️', label: 'Voyage', amount: 120 },
        { icon: '🎓', label: 'Études', amount: 40 },
        { icon: '🎉', label: 'Sortie', amount: 30 },
      ];
    }
    return [
      { icon: '🍎', label: 'Groceries', amount: 35 },
      { icon: '🎧', label: 'Purchase', amount: 89 },
      { icon: '🚆', label: 'Transit', amount: 25 },
      { icon: '🏠', label: 'Rent', amount: 450 },
      { icon: '✈️', label: 'Trip', amount: 120 },
      { icon: '🎓', label: 'Studies', amount: 40 },
      { icon: '🎉', label: 'Night out', amount: 30 },
    ];
  }, [language]);

  // Smart Omnibox parser: handles "89 €", "Casque 89 €", "MacBook 750", "35 courses", "89"
  const handleOmniboxChange = (val: string) => {
    setOmniboxInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setSimulatedAmount(0);
      setExpenseTitle('');
      return;
    }

    // Match numeric portion
    const match = trimmed.match(/(\d+(?:[.,]\d+)?)/);
    if (match) {
      const rawNum = match[1].replace(',', '.');
      const parsedAmount = Math.max(0, parseFloat(rawNum) || 0);
      setSimulatedAmount(parsedAmount);

      // Clean title by removing numeric token and currency units
      const cleanTitle = trimmed
        .replace(match[0], '')
        .replace(/[€$£CHF]/gi, '')
        .trim();
      setExpenseTitle(cleanTitle);
    }
  };

  const handleSelectPreset = (p: { label: string; amount: number; icon: string }) => {
    handlePresetClick(p.amount, p.label);
    setOmniboxInput(`${p.label} ${p.amount} €`);
    analytics.track('repeated_simulation', { amount: p.amount, preset: p.label });
  };

  const daysDifference = simulationResult.daysDifference; // negative number or 0
  const absDaysDifference = Math.abs(daysDifference);

  // Factual, calm decision-support explanation in brotherly voice
  const verdictText = useMemo(() => {
    if (simulatedAmount <= 0) {
      return language === 'fr' 
        ? 'Indique un montant ou un achat pour voir immédiatement l\'impact sur ton autonomie.'
        : 'Enter an amount or item to see the immediate impact on your runway.';
    }

    if (simulationResult.scenario === 'GO') {
      return language === 'fr'
        ? `Si tu achètes cela (${formatCurrency(simulatedAmount)}), ton runway passe à ${simulationResult.projectedDays} jours (variation de -${absDaysDifference} ${absDaysDifference <= 1 ? 'jour' : 'jours'}). Tes échéances vitales restent sécurisées. À toi de voir.`
        : `If you buy this (${formatCurrency(simulatedAmount)}), your runway adjusts to ${simulationResult.projectedDays} days (-${absDaysDifference} ${absDaysDifference <= 1 ? 'day' : 'days'}). Your vital bills remain protected. Up to you.`;
    }

    if (simulationResult.scenario === 'WAIT') {
      return language === 'fr'
        ? `Ton solde actuel le permet, mais ton runway passe à ${simulationResult.projectedDays} jours. Si tu attends ta prochaine rentrée, ton coussin actuel reste préservé. À toi de voir.`
        : `Your balance allows this, but your runway drops to ${simulationResult.projectedDays} days. Waiting for your next deposit keeps your cushion intact. Up to you.`;
    }

    if (simulationResult.scenario === 'ADJUST') {
      return language === 'fr'
        ? `Tu es un peu juste cette semaine avec cet achat. Ton disponible passerait à ${formatCurrency(simulationResult.postSafeToSpend)} aujourd'hui. En modérant tes sorties ces prochains jours, ton runway se stabilise.`
        : `You're a bit tight this week with this purchase. Safe to spend drops to ${formatCurrency(simulationResult.postSafeToSpend)}. Pacing non-essentials stabilizes your runway.`;
    }

    return language === 'fr'
      ? `Cet achat mettrait ton loyer ou tes charges sous tension et réduirait ton horizon à ${simulationResult.projectedDays} jours.`
      : `This purchase would put pressure on upcoming rent and shorten your horizon to ${simulationResult.projectedDays} days.`;
  }, [simulatedAmount, simulationResult, absDaysDifference, language, formatCurrency]);

  const handleBuy = async () => {
    if (simulatedAmount <= 0) return;
    const titleText = expenseTitle.trim() || (language === 'fr' ? 'Achat validé' : 'Purchase');
    
    // Direct zero-homework recording without forcing category
    const newTx: Transaction = {
      id: 'tx-buy-' + Date.now(),
      userId: currentUser?.uid || 'local',
      title: titleText,
      amount: simulatedAmount,
      category: 'shopping',
      type: 'variable',
      date: new Date().toISOString().split('T')[0],
      status: 'settled',
      isRecurring: false,
      memoryStatus: 'confirmed',
      memorySource: 'user_added',
      isDisabledInRunway: false,
      createdAt: new Date().toISOString(),
    };

    if (currentUser && !currentUser.isAnonymous) {
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), {
          ...newTx,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Direct buy persist notice:', err);
      }
    }

    if (recomputeRunway && transactions) {
      recomputeRunway([newTx, ...transactions]);
    }

    analytics.track('first_decision_selected', { decision: 'buy', amount: simulatedAmount });
    analytics.track('first_simulation_completed', { amount: simulatedAmount, projectedDays: simulationResult.projectedDays });

    setDecisionFeedback({
      type: 'buy',
      message: language === 'fr'
        ? `Achat "${titleText}" (${formatCurrency(simulatedAmount)}) enregistré directement. Ton runway s'ajuste à ${simulationResult.projectedDays} jours.`
        : `Purchase "${titleText}" (${formatCurrency(simulatedAmount)}) logged. Your runway adjusts to ${simulationResult.projectedDays} days.`,
    });
    showToast({
      type: 'success',
      title: language === 'fr' ? 'Dépense enregistrée' : 'Purchase Logged',
      message: language === 'fr' 
        ? `L'IA conseille, vous décidez : ${titleText} (${formatCurrency(simulatedAmount)}) validé sans formulaire lourd.`
        : `AI advises, you decide: ${titleText} (${formatCurrency(simulatedAmount)}) logged with zero friction.`,
      duration: 3500,
    });
  };

  const handleWait = () => {
    analytics.track('first_decision_selected', { decision: 'wait', amount: simulatedAmount });
    analytics.track('first_simulation_completed', { amount: simulatedAmount, projectedDays: simulationResult.projectedDays });

    setDecisionFeedback({
      type: 'wait',
      message: language === 'fr'
        ? `Choix de temporiser pris en compte. Ton runway de ${runwayDays} jours reste intact.`
        : `Decision to wait noted. Your ${runwayDays}-day runway remains fully preserved.`,
    });
    showToast({
      type: 'info',
      title: language === 'fr' ? 'Achat temporisé' : 'Purchase Postponed',
      message: language === 'fr'
        ? `Ton disponible du jour reste de ${formatCurrency(safeToSpendToday)}.`
        : `Your safe to spend today stays at ${formatCurrency(safeToSpendToday)}.`,
      duration: 3000,
    });
  };

  const handleConsult = () => {
    analytics.track('first_ney_question', { amount: simulatedAmount, title: expenseTitle });
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
                {language === 'fr' ? 'SIMULATEUR INSTANTANÉ' : 'INSTANT SIMULATOR'}
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

      {/* 1. SMART OMNIBOX INPUT (e.g. "89 €" or "Casque 89 €") */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="omnibox-smart-input" className="text-[10px] uppercase font-mono tracking-wider text-[#D4FF3D] font-bold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Saisie rapide intelligente (Omnibox)' : 'Smart omnibox input'}</span>
          </label>
          <span className="text-[10px] font-mono text-[#8A8F98]">
            {language === 'fr' ? 'Ex: "Casque 89 €" ou "89"' : 'e.g. "Headphones 89" or "89"'}
          </span>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#D4FF3D]">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="omnibox-smart-input"
            type="text"
            value={omniboxInput}
            onChange={(e) => handleOmniboxChange(e.target.value)}
            placeholder={language === 'fr' ? 'Tape simplement "89 €" ou "Casque 89 €"...' : 'Type "89 €" or "Headphones 89 €"...'}
            className="w-full pl-11 pr-24 py-3.5 bg-[#0B0E17] border border-[#1e293b] focus:border-[#D4FF3D] rounded-2xl text-sm sm:text-base text-[#F5F5F0] placeholder-[#8A8F98]/50 outline-none transition-all shadow-inner font-mono"
          />
          {omniboxInput && (
            <button
              type="button"
              onClick={() => handleOmniboxChange('')}
              className="absolute inset-y-0 right-12 pr-2 flex items-center text-[#8A8F98] hover:text-[#F5F5F0] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs font-mono font-bold text-[#D4FF3D]">
            {formatCurrency(simulatedAmount)}
          </div>
        </div>
      </div>

      {/* 2. 7 STUDENT LIFE PRESETS (Courses, Achat, Transport, Loyer, Voyage, Études, Sortie) */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase font-mono text-[#8A8F98] tracking-wider block">
          {language === 'fr' ? 'Situations courantes de vie étudiante :' : 'Student life situations:'}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                simulatedAmount === p.amount && expenseTitle === p.label
                  ? 'bg-[#D4FF3D]/10 border-[#D4FF3D] text-[#D4FF3D] shadow-sm'
                  : 'bg-[#0B0E17] border-[#1e293b] hover:border-[#D4FF3D]/40 text-[#B8BCC4]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{p.icon}</span>
                <span className="text-xs font-medium truncate">{p.label}</span>
              </div>
              <span className="text-xs sm:text-sm font-mono font-bold text-[#F5F5F0] mt-1 block">
                {formatCurrency(p.amount)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Slider for fine adjustment */}
      <div className="pt-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-[#8A8F98] mb-1">
          <span>{language === 'fr' ? 'Ajustement précis du montant' : 'Fine adjustment'}</span>
          <span className="text-[#D4FF3D] font-bold">{formatCurrency(simulatedAmount)}</span>
        </div>
        <input
          id="slider-afford-amount"
          type="range"
          min="0"
          max={maxSliderValue}
          step="5"
          value={simulatedAmount}
          onChange={(e) => {
            const val = Number(e.target.value);
            setSimulatedAmount(val);
            setOmniboxInput(expenseTitle ? `${expenseTitle} ${val} €` : `${val} €`);
          }}
          className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#D4FF3D]"
        />
      </div>

      {/* SIGNATURE INTERACTION COMPONENT: AVANT → APRÈS → IMPACT */}
      <div className="bg-gradient-to-br from-[#121622] to-[#0B0E17] border border-[#1e293b] rounded-3xl p-5 sm:p-6 space-y-4 shadow-inner">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
          
          {/* 1. AVANT */}
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

          {/* 2. APRÈS CET ACHAT */}
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
          <span>{language === 'fr' ? 'Zéro catégorisation obligatoire • Vous décidez' : 'Zero mandatory forms • You decide'}</span>
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

