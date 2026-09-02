import React from 'react';
import { useTranslation } from '../../i18n';
import { AppRoute, ClarificationPrompt } from '../../types';
import { 
  HelpCircle, 
  PlusCircle, 
  Target, 
  LifeBuoy, 
  RefreshCw, 
  ArrowRight, 
  Sparkles, 
  ChevronRight,
  Receipt,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';

export interface ChatFallbackProps {
  userQuery?: string;
  clarification?: ClarificationPrompt;
  onSelectPrompt: (prompt: string) => void;
  onNavigate?: (route: AppRoute) => void;
  onFocusInput?: () => void;
  className?: string;
}

export const ChatFallback: React.FC<ChatFallbackProps> = ({
  userQuery,
  clarification,
  onSelectPrompt,
  onNavigate,
  onFocusInput,
  className = '',
}) => {
  const { language } = useTranslation();
  const isFrench = language === 'fr';

  const defaultQuickActions = [
    {
      id: 'add-transaction',
      label: isFrench ? 'Ajouter une transaction' : 'Add transaction',
      sublabel: isFrench ? 'Enregistrer une dépense ou rentrée' : 'Log an expense or inflow',
      icon: PlusCircle,
      action: () => {
        if (onNavigate) {
          onNavigate('transactions');
        } else {
          onSelectPrompt(isFrench ? 'Comment ajouter une transaction ?' : 'How to add a transaction?');
        }
      },
      colorClass: 'text-[#D4FF3D] bg-[#D4FF3D]/10 border-[#D4FF3D]/30 group-hover:border-[#D4FF3D]/60',
    },
    {
      id: 'view-goals',
      label: isFrench ? 'Voir mes objectifs' : 'View goals',
      sublabel: isFrench ? 'Suivre mon épargne & projets' : 'Track savings & safety buffer',
      icon: Target,
      action: () => {
        if (onNavigate) {
          onNavigate('goals');
        } else {
          onSelectPrompt(isFrench ? 'Comment fonctionne mon objectif d\'épargne ?' : 'How do my savings goals work?');
        }
      },
      colorClass: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/30 group-hover:border-[#38BDF8]/60',
    },
    {
      id: 'support-resources',
      label: isFrench ? 'Aides & Support' : 'Support & Grants',
      sublabel: isFrench ? 'Bourses et contacts d\'urgence' : 'Grants, campus aid & assistance',
      icon: LifeBuoy,
      action: () => {
        if (onNavigate) {
          onNavigate('resources');
        } else {
          onSelectPrompt(isFrench ? 'Quelles sont les bourses et aides disponibles ?' : 'What student grants and aids are available?');
        }
      },
      colorClass: 'text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/30 group-hover:border-[#A78BFA]/60',
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`mt-3.5 pt-3.5 border-t border-[#FACC15]/25 space-y-3.5 ${className}`}
    >
      {/* Friendly Clarification Header Banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/30">
        <div className="p-1.5 rounded-lg bg-[#FACC15]/20 text-[#FACC15] shrink-0 mt-0.5">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FACC15]">
              {clarification?.title || (isFrench ? 'Besoin d\'un peu plus de contexte' : 'Clarification Needed')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/40 font-semibold">
              {isFrench ? 'Confiance faible' : 'Low confidence'}
            </span>
          </div>
          <p className="text-xs text-[#E2E8F0] leading-relaxed">
            {clarification?.reason || (isFrench
              ? 'Je n\'ai pas bien compris votre intention exacte. Pourriez-vous reformuler votre phrase ou apporter quelques précisions (montant, type d\'achat ou objectif) ?'
              : 'I couldn\'t match your request with high confidence. Would you like to rephrase, or provide a few details such as amount, purchase type, or goal?')}
          </p>
        </div>
      </div>

      {/* Structured Aspects Breakdown if available */}
      {clarification?.suggestedAspects && clarification.suggestedAspects.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FACC15]" />
            <span>{isFrench ? 'Détails utiles à préciser :' : 'Helpful details to include:'}</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {clarification.suggestedAspects.map((aspect, idx) => (
              <div 
                key={idx}
                className="p-2.5 rounded-xl bg-[#161b27] border border-[#1e293b] hover:border-[#FACC15]/40 transition-colors space-y-1 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F5F5F0]">
                    {aspect.label}
                  </span>
                  {aspect.suggestedPrompt && (
                    <button
                      type="button"
                      onClick={() => onSelectPrompt(aspect.suggestedPrompt!)}
                      className="text-[10px] font-mono text-[#D4FF3D] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{isFrench ? 'Utiliser' : 'Use'}</span>
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-tight">
                  {aspect.description}
                </p>
                {aspect.example && (
                  <p className="text-[10px] font-mono text-[#FACC15]/90 bg-[#0B0E17] px-1.5 py-0.5 rounded border border-[#1e293b] inline-block">
                    {aspect.example}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clarification Dynamic Quick Actions if provided */}
      {clarification?.quickActions && clarification.quickActions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
            {isFrench ? 'Suggestions directes de reformulation :' : 'Direct reply suggestions:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {clarification.quickActions.map((action, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => onSelectPrompt(action.prompt)}
                className="group px-3 py-1.5 rounded-xl bg-[#161b27] hover:bg-[#FACC15]/15 border border-[#1e293b] hover:border-[#FACC15]/50 text-xs text-[#E2E8F0] hover:text-[#F5F5F0] flex items-center gap-1.5 transition-all cursor-pointer text-left shadow-sm"
              >
                <span>{action.label}</span>
                <ArrowRight className="w-3 h-3 text-[#FACC15] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Common Tasks Quick Action Buttons */}
      <div className="space-y-2 pt-1 border-t border-[#1e293b]/70">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] flex items-center justify-between">
          <span>{isFrench ? 'Actions rapides courantes :' : 'Common quick actions:'}</span>
          {onFocusInput && (
            <button
              type="button"
              onClick={onFocusInput}
              className="text-[10px] text-[#D4FF3D] hover:underline flex items-center gap-1 font-sans capitalize cursor-pointer"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>{isFrench ? 'Reformuler mon texte' : 'Rephrase text'}</span>
            </button>
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {defaultQuickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className="group p-2.5 rounded-xl bg-[#161b27] hover:bg-[#1f2738] border border-[#1e293b] hover:border-[#FACC15]/40 transition-all text-left flex flex-col justify-between gap-2 cursor-pointer shadow-sm"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className={`p-1.5 rounded-lg border ${item.colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#8A8F98] group-hover:text-[#F5F5F0] group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#F5F5F0] group-hover:text-[#D4FF3D] transition-colors">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-[#8A8F98] line-clamp-1 leading-tight mt-0.5">
                    {item.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
