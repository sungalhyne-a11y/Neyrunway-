import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { 
  Compass, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  HelpCircle, 
  Bus,
  Layers,
  CheckCircle2,
  Zap,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getPersonalizedNextMove } from '../../shared/moneyMemoryEngine';

interface NextMoveCardProps {
  onAction?: (actionQuery?: string) => void;
  onNavigateToSimulator?: () => void;
  onNavigateToMemory?: () => void;
}

export const NextMoveCard: React.FC<NextMoveCardProps> = ({ 
  onAction,
  onNavigateToMemory,
}) => {
  const { formatCurrency, language } = useTranslation();
  const { computedRunway, memorySummary } = useAuth();
  const [showSignalWhy, setShowSignalWhy] = useState(false);

  const move = getPersonalizedNextMove(
    memorySummary,
    computedRunway,
    language,
    formatCurrency
  );

  const IconComponent = move.iconName === 'Bus' 
    ? Bus 
    : move.iconName === 'Clock' 
    ? Clock 
    : move.iconName === 'AlertCircle' 
    ? AlertCircle 
    : move.iconName === 'ShieldCheck' 
    ? ShieldCheck 
    : Compass;

  const handleClick = () => {
    if (onAction) {
      onAction(move.query);
    }
  };

  const trace = move.decisionTrace;

  const getUncertaintyBadge = (level: string) => {
    switch (level) {
      case 'confirmed':
        return {
          label: language === 'fr' ? 'Confirmé' : 'Confirmed',
          color: 'text-[#D4FF3D] bg-[#D4FF3D]/10 border-[#D4FF3D]/30',
          icon: CheckCircle2,
        };
      case 'detected':
        return {
          label: language === 'fr' ? 'Détecté' : 'Detected',
          color: 'text-[#FACC15] bg-[#FACC15]/10 border-[#FACC15]/30',
          icon: Zap,
        };
      case 'estimated':
        return {
          label: language === 'fr' ? 'Estimé' : 'Estimated',
          color: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/30',
          icon: Clock,
        };
      default:
        return {
          label: language === 'fr' ? 'À vérifier' : 'To verify',
          color: 'text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/30',
          icon: Sparkles,
        };
    }
  };

  return (
    <div 
      id="card-next-move"
      className="bg-[#161b27] border border-[#1e293b] hover:border-[#D4FF3D]/40 rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden transition-all group"
    >
      {/* Ambient subtle light */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4FF3D]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left: Icon & Core Message */}
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-[#0B0E17] border border-[#1e293b] flex items-center justify-center text-[#D4FF3D] shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <IconComponent className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-mono font-bold text-[#D4FF3D] bg-[#D4FF3D]/10 border border-[#D4FF3D]/30 px-2 py-0.5 rounded-md">
                04
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-mono font-bold text-[#8A8F98]">
                NEXT MOVE
              </span>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${move.badgeColor}`}>
                {move.badge}
              </span>
              <button
                type="button"
                onClick={() => setShowSignalWhy(!showSignalWhy)}
                className="text-[10px] font-mono text-[#8A8F98] hover:text-[#D4FF3D] flex items-center gap-1 cursor-pointer underline ml-auto sm:ml-0 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#D4FF3D]" />
                <span>{language === 'fr' ? 'Pourquoi ce conseil ?' : 'Why this?'}</span>
              </button>
            </div>

            <h4 className="text-base sm:text-lg font-medium text-[#F5F5F0] leading-snug">
              {move.title}
            </h4>

            <p className="text-xs sm:text-sm text-[#8A8F98] max-w-2xl leading-relaxed">
              {move.message}
            </p>

            {/* Connected Financial Opportunity Callout */}
            {move.financialOpportunity && (
              <div className="mt-2 p-3 rounded-2xl bg-[#0B0E17]/90 border border-[#D4FF3D]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#D4FF3D]/10 flex items-center justify-center text-[#D4FF3D] shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#F5F5F0]">
                        {move.financialOpportunity.resourceTitle}
                      </span>
                      <span className="text-[9px] font-mono text-[#8A8F98]">
                        ({move.financialOpportunity.provider})
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8A8F98] mt-0.5">
                      {move.financialOpportunity.potentialImpact}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-[10px] font-mono text-[#D4FF3D] bg-[#D4FF3D]/10 px-2 py-0.5 rounded-md border border-[#D4FF3D]/20">
                    {language === 'fr' ? 'À vérifier' : 'Verify'}
                  </span>
                </div>
              </div>
            )}

            {/* Structured Memory Trust & Decision Trace Disclosure */}
            <AnimatePresence>
              {showSignalWhy && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-3"
                >
                  <div className="bg-[#0B0E17] border border-[#1e293b] rounded-2xl p-4 text-xs space-y-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[#1e293b] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#D4FF3D]" />
                        <span className="text-[11px] font-mono font-bold tracking-wider text-[#F5F5F0] uppercase">
                          {language === 'fr' ? 'CHAÎNE DE CONFIANCE & DÉCISION' : 'MEMORY TRUST & DECISION TRACE'}
                        </span>
                      </div>
                      {trace && (
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          {(() => {
                            const badge = getUncertaintyBadge(trace.uncertaintyLevel);
                            const BadgeIcon = badge.icon;
                            return (
                              <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 font-bold ${badge.color}`}>
                                <BadgeIcon className="w-3 h-3" />
                                <span>{badge.label}</span>
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Decision Trace Steps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                      {/* 1. Signal */}
                      <div className="p-2.5 rounded-xl bg-[#161b27]/70 border border-[#1e293b] space-y-1">
                        <span className="text-[#8A8F98] text-[9px] uppercase tracking-wider block font-bold">
                          1. {language === 'fr' ? 'SIGNAL DÉTECTÉ' : 'DETECTED SIGNAL'}
                        </span>
                        <p className="text-[#F5F5F0] font-sans font-medium text-xs">
                          {trace?.signal || move.what}
                        </p>
                      </div>

                      {/* 2. Memory Context */}
                      <div className="p-2.5 rounded-xl bg-[#161b27]/70 border border-[#1e293b] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[#8A8F98] text-[9px] uppercase tracking-wider block font-bold">
                            2. {language === 'fr' ? 'MÉMOIRE UTILISÉE' : 'MEMORY USED'}
                          </span>
                          {trace?.memoryItem.amount !== undefined && (
                            <span className="text-[#D4FF3D] font-bold text-xs">
                              {formatCurrency(trace.memoryItem.amount)}
                            </span>
                          )}
                        </div>
                        <p className="text-[#F5F5F0] font-sans font-medium text-xs">
                          {trace?.memoryItem.title || move.why}
                        </p>
                        <span className="text-[10px] text-[#8A8F98] block">
                          {trace?.memoryItem.source}
                        </span>
                        {trace?.memoryItem.usedFor && (
                          <span className="text-[9px] text-[#38BDF8] block">
                            {language === 'fr' ? 'Utilisé pour : ' : 'Used for: '}
                            {trace.memoryItem.usedFor.join(' • ')}
                          </span>
                        )}
                      </div>

                      {/* 3. Reasoning */}
                      <div className="p-2.5 rounded-xl bg-[#161b27]/70 border border-[#1e293b] space-y-1">
                        <span className="text-[#8A8F98] text-[9px] uppercase tracking-wider block font-bold">
                          3. {language === 'fr' ? 'RAISONNEMENT' : 'REASONING'}
                        </span>
                        <p className="text-[#FACC15] font-sans text-xs leading-relaxed">
                          {trace?.reasoning || move.why}
                        </p>
                      </div>

                      {/* 4. Impact */}
                      <div className="p-2.5 rounded-xl bg-[#161b27]/70 border border-[#1e293b] space-y-1">
                        <span className="text-[#8A8F98] text-[9px] uppercase tracking-wider block font-bold">
                          4. {language === 'fr' ? 'IMPACT ESTIMÉ' : 'ESTIMATED IMPACT'}
                        </span>
                        <p className="text-[#38BDF8] font-sans font-semibold text-xs leading-relaxed">
                          {trace?.impact || move.impact}
                        </p>
                      </div>
                    </div>

                    {/* Footer: User Sovereignty & Direct Control */}
                    <div className="pt-2 border-t border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px]">
                      <div className="text-[#8A8F98] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#D4FF3D] shrink-0" />
                        <span>
                          {language === 'fr' 
                            ? 'L\'IA conseille à partir de tes mouvements. Vous décidez toujours seul.' 
                            : 'AI advises based on your history. You always decide alone.'}
                        </span>
                      </div>

                      {onNavigateToMemory && (
                        <button
                          type="button"
                          onClick={onNavigateToMemory}
                          className="px-3 py-1.5 rounded-xl bg-[#161b27] hover:bg-[#1e293b] text-[#D4FF3D] hover:text-[#c2f028] border border-[#1e293b] text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer self-end sm:self-auto"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>{language === 'fr' ? 'Gérer cette mémoire' : 'Manage this memory'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Direct Action CTA */}
        <div className="flex sm:items-center gap-2 self-start md:self-auto shrink-0">
          <button
            id="btn-next-move-action"
            type="button"
            onClick={handleClick}
            className="px-4 py-2.5 rounded-2xl bg-[#0B0E17] hover:bg-[#D4FF3D] text-[#F5F5F0] hover:text-[#0B0E17] border border-[#1e293b] hover:border-[#D4FF3D] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 group/btn whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4FF3D] group-hover/btn:text-[#0B0E17] transition-colors" />
            <span>{move.actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};


