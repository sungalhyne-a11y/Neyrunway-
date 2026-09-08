import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface AskNeyCardProps {
  onNavigateToChat: (initialQuery?: string) => void;
}

export const AskNeyCard: React.FC<AskNeyCardProps> = ({ onNavigateToChat }) => {
  const { t, formatCurrency, formatDate, language } = useTranslation();
  const { computedRunway, userProfile } = useAuth();
  const [customQuery, setCustomQuery] = useState('');

  const runwayDays = computedRunway?.runwayDays ?? 34;
  const currentBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;
  const safeToSpendToday = computedRunway?.safeToSpendToday ?? 24;
  const totalFixedExpenses = computedRunway?.totalFixedExpenses ?? 450;
  const nextIncomeAmount = computedRunway?.nextIncomeAmount ?? 0;
  const daysUntilNextIncome = computedRunway?.daysUntilNextIncome ?? 14;

  const quickQuestions = language === 'fr' ? [
    { label: 'Puis-je sortir ce soir ?', query: 'Puis-je sortir ce soir ? Quel est le montant raisonnable pour ne pas compromettre mes échéances ?' },
    { label: 'Puis-je m\'offrir un voyage à 150 € ?', query: 'Puis-je m\'offrir un voyage à 150 € ? Quel impact direct cela aura-t-il sur mon runway ?' },
    { label: 'Que puis-je dépenser ce week-end ?', query: 'Que puis-je dépenser ce week-end tout en gardant mon runway et mes charges prévues sur les rails ?' },
    { label: 'Pourquoi mon runway a-t-il baissé ?', query: 'Pourquoi mon autonomie a-t-elle diminué ce mois-ci et quels sont mes leviers ?' },
  ] : [
    { label: 'Can I go out tonight?', query: 'Can I go out tonight? What is a safe amount without putting my planned commitments under pressure?' },
    { label: 'Can I afford a €150 trip?', query: 'Can I afford a €150 trip? How many days of runway will it cost me?' },
    { label: 'What can I spend this weekend?', query: 'What can I spend this weekend while keeping my runway and planned commitments on track?' },
    { label: 'Why is my runway running low?', query: 'Why has my runway decreased this month and what simple levers can help?' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    onNavigateToChat(customQuery.trim());
  };

  const handlePromptClick = (query: string) => {
    onNavigateToChat(query);
  };

  return (
    <div 
      id="card-ask-ney"
      className="bg-gradient-to-br from-[#161b27] via-[#121622] to-[#0B0E17] border border-[#1e293b] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-5"
    >
      {/* Intelligent ambient background aura */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4FF3D]/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header: Subtle Intelligent Visual Identity of Ney */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b]/70 pb-4">
        <div className="flex items-center gap-3">
          {/* Ney's Minimal Intelligent Orb Signature: Calm, Presence, Subtle Motion */}
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#0B0E17] border border-[#D4FF3D]/30 shadow-[0_0_15px_rgba(212,255,61,0.2)]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4FF3D] animate-pulse" />
            <span className="absolute w-5 h-5 rounded-full border border-[#D4FF3D]/40 animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-[#D4FF3D] bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 px-2 py-0.5 rounded-md">
                05
              </span>
              <h3 className="text-lg sm:text-xl font-medium text-[#F5F5F0]">
                {language === 'fr' ? 'Ney • Copilote Financier' : 'Ney • Financial Copilot'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/30">
                {language === 'fr' ? 'Contexte actif' : 'Active context'}
              </span>
            </div>
            <p className="text-xs text-[#8A8F98] mt-0.5">
              {language === 'fr'
                ? `Ney intègre déjà ta situation : ${runwayDays}j de runway, ${formatCurrency(currentBalance)} disponibles, charges prévues sanctuarisées.`
                : `Ney already integrates your context: ${runwayDays}d runway, ${formatCurrency(currentBalance)} available, planned bills secured.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8A8F98] bg-[#0B0E17] px-3 py-1 rounded-full border border-[#1e293b]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>{language === 'fr' ? 'Sans jugement • Données privées' : 'Zero shame • Private'}</span>
        </div>
      </div>

      {/* Direct Prompt Input Bar */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center bg-[#0B0E17] border border-[#1e293b] focus-within:border-[#D4FF3D] rounded-2xl p-1.5 transition-all shadow-inner">
          <input
            id="input-ask-ney-dashboard"
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder={language === 'fr' 
              ? 'Pose ta question à Ney... (ex: "Puis-je sortir ce soir ?", "Que puis-je dépenser ce week-end ?")' 
              : 'Ask Ney anything... (e.g. "Can I go out tonight?", "What can I spend this weekend?")'}
            className="w-full bg-transparent px-4 py-2.5 text-xs sm:text-sm text-[#F5F5F0] placeholder-[#8A8F98]/50 outline-none"
          />
          <button
            id="btn-ask-ney-submit"
            type="submit"
            disabled={!customQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#D4FF3D] hover:bg-[#C2F028] disabled:opacity-40 text-[#0B0E17] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(212,255,61,0.25)] shrink-0"
          >
            <span>{language === 'fr' ? 'Demander' : 'Ask'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Contextual Suggestion Chips (Real Student Questions) */}
      <div className="space-y-2 pt-1">
        <span className="text-[10px] uppercase font-mono text-[#8A8F98] tracking-wider block">
          {language === 'fr' ? 'Questions fréquentes pour ton copilote :' : 'Common questions for your copilot:'}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePromptClick(q.query)}
              className="p-3 rounded-2xl bg-[#0B0E17] hover:bg-[#161b27] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-left transition-all flex items-center justify-between gap-2 text-xs text-[#B8BCC4] hover:text-[#F5F5F0] cursor-pointer group"
            >
              <span className="truncate">{q.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#8A8F98] group-hover:text-[#D4FF3D] group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
