import React from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { analytics } from '../../lib/analytics';
import { 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  Lightbulb, 
  DollarSign, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';
import { motion } from 'motion/react';

interface DecisionSurfaceCardProps {
  onNavigateToChat: (query?: string) => void;
}

export const DecisionSurfaceCard: React.FC<DecisionSurfaceCardProps> = ({ onNavigateToChat }) => {
  const { t, formatCurrency, formatDate, formatDays, language } = useTranslation();
  const { computedRunway, userProfile } = useAuth();

  const runwayDays = computedRunway?.runwayDays ?? 34;
  const safeToSpendToday = computedRunway?.safeToSpendToday ?? 24;
  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const nextIncomeDate = computedRunway?.nextIncomeDate;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;
  const nextIncomeSource = computedRunway?.nextIncomeSource || (language === 'fr' ? 'Bourse / Revenu' : 'Income / Deposit');
  const daysUntilNextIncome = computedRunway?.daysUntilNextIncome ?? 14;

  // Generate dynamic, supportive "One Useful Insight"
  const getDynamicInsight = () => {
    if (runwayDays < 15) {
      return {
        title: language === 'fr' ? 'Sécuriser le cap' : 'Protect your baseline',
        text: language === 'fr'
          ? `En plafonnant tes extras à ${formatCurrency(safeToSpendToday)}/j pendant 5 jours, tu repousses ton point de rupture de +4 jours.`
          : `By keeping discretionary spend at ${formatCurrency(safeToSpendToday)}/day for 5 days, you extend your runway by +4 days.`,
        tag: language === 'fr' ? 'Levier +4 jours' : '+4 days lever',
        color: 'text-[#FACC15]',
        bg: 'bg-[#FACC15]/10',
        border: 'border-[#FACC15]/30',
      };
    }
    if (daysUntilNextIncome <= 7 && nextIncomeAmount > 0) {
      return {
        title: language === 'fr' ? 'Rentrée imminente' : 'Upcoming Deposit',
        text: language === 'fr'
          ? `Ta rentrée de +${formatCurrency(nextIncomeAmount)} arrive dans ${daysUntilNextIncome} jours. Ton runway passera alors à plus de ${runwayDays + Math.round(nextIncomeAmount / 35)} jours.`
          : `Your deposit of +${formatCurrency(nextIncomeAmount)} arrives in ${daysUntilNextIncome} days, boosting your runway to ${runwayDays + Math.round(nextIncomeAmount / 35)} days.`,
        tag: language === 'fr' ? 'Recharge Trésorerie' : 'Cash Inflow',
        color: 'text-[#D4FF3D]',
        bg: 'bg-[#D4FF3D]/10',
        border: 'border-[#D4FF3D]/30',
      };
    }
    return {
      title: language === 'fr' ? 'Discrétionnaire protégé' : 'Safe Daily Spending',
      text: language === 'fr'
        ? `Avec ${formatCurrency(safeToSpendToday)}/jour disponibles en toute sérénité, tes charges fixes de fin de mois restent protégées.`
        : `With ${formatCurrency(safeToSpendToday)}/day available to spend freely, your monthly fixed commitments remain 100% protected.`,
      tag: language === 'fr' ? 'Équilibre Sain' : 'Healthy Balance',
      color: 'text-[#38BDF8]',
      bg: 'bg-[#38BDF8]/10',
      border: 'border-[#38BDF8]/30',
    };
  };

  const insight = getDynamicInsight();

  // Instant decision query prompts
  const quickDecisionPrompts = language === 'fr' ? [
    { label: 'Que puis-je dépenser aujourd\'hui ?', query: 'Quel est mon montant disponible serein pour aujourd\'hui et comment est-il calculé ?' },
    { label: 'Puis-je m\'offrir des baskets à 120€ ?', query: 'Puis-je m\'offrir des baskets à 120€ ? Quel est l\'impact sur mon runway ?' },
    { label: 'Puis-je sortir ce soir pour 35€ ?', query: 'Puis-je sortir ce soir avec un budget de 35€ sans risquer mes charges fixes ?' },
  ] : [
    { label: 'What can I afford today?', query: 'What is my safe spending limit today and how is it protected?' },
    { label: 'Can I buy these sneakers for $120?', query: 'Can I buy these sneakers for $120? What is the impact on my runway?' },
    { label: 'Can I spend $35 tonight?', query: 'Can I go out tonight with a $35 budget without risking my rent?' },
  ];

  const handlePromptClick = (promptQuery: string) => {
    analytics.track('financial_decision_assisted', { query: promptQuery });
    onNavigateToChat(promptQuery);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* 3. NEXT IMPORTANT FINANCIAL EVENT */}
      <div 
        id="card-next-financial-event"
        className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-[#8A8F98] uppercase tracking-widest font-bold">
              {language === 'fr' ? 'Prochain Événement Majeur' : 'Next Financial Event'}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
            {nextIncomeDate ? (daysUntilNextIncome === 0 ? (language === 'fr' ? 'Aujourd\'hui' : 'Today') : `J-${daysUntilNextIncome}`) : (language === 'fr' ? 'À planifier' : 'Upcoming')}
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#F5F5F0]">
              {nextIncomeAmount > 0 ? `+${formatCurrency(nextIncomeAmount)}` : formatCurrency(currentBalance)}
            </span>
            <span className="text-xs text-[#8A8F98]">
              {nextIncomeSource}
            </span>
          </div>

          <p className="text-xs text-[#8A8F98] mt-2 leading-relaxed">
            {nextIncomeDate 
              ? (language === 'fr' 
                  ? `Versement prévu le ${formatDate(nextIncomeDate)} (dans ${daysUntilNextIncome} jours).`
                  : `Expected on ${formatDate(nextIncomeDate)} (${daysUntilNextIncome} days remaining).`)
              : (language === 'fr'
                  ? 'Aucune rentrée programmée d\'ici la fin du cycle actuel.'
                  : 'No scheduled inflow before end of current cycle.')}
          </p>
        </div>

        <div className="pt-4 mt-4 border-t border-[#1e293b] flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#8A8F98]">
            {language === 'fr' ? 'Impact sur Trésorerie' : 'Cash Impact'}
          </span>
          <span className="text-xs font-mono font-bold text-[#D4FF3D]">
            {nextIncomeAmount > 0 ? `+${Math.round(nextIncomeAmount / 35)} ${language === 'fr' ? 'jours' : 'days'}` : '—'}
          </span>
        </div>
      </div>

      {/* 4. ONE USEFUL INSIGHT */}
      <div 
        id="card-one-useful-insight"
        className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 flex items-center justify-center text-[#D4FF3D]">
              <Lightbulb className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-[#8A8F98] uppercase tracking-widest font-bold">
              {language === 'fr' ? 'Éclairage Clé' : 'One Useful Insight'}
            </span>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${insight.bg} ${insight.color} ${insight.border}`}>
            {insight.tag}
          </span>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[#F5F5F0]">
            {insight.title}
          </h4>
          <p className="text-xs text-[#8A8F98] mt-1.5 leading-relaxed">
            {insight.text}
          </p>
        </div>

        {/* 5. Quick Ask Ney Decision Starters */}
        <div className="pt-3 mt-3 border-t border-[#1e293b] space-y-1.5">
          <span className="text-[10px] font-mono uppercase text-[#8A8F98] block">
            {language === 'fr' ? 'Décision Express avec Ney :' : 'Quick Decision with Ney:'}
          </span>
          <div className="flex flex-col gap-1">
            {quickDecisionPrompts.slice(0, 2).map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePromptClick(item.query)}
                className="w-full text-left text-[11px] text-[#B8BCC4] hover:text-[#D4FF3D] bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] rounded-xl px-2.5 py-1.5 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">{item.label}</span>
                <ArrowRight className="w-3 h-3 shrink-0 text-[#8A8F98] group-hover:text-[#D4FF3D]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
