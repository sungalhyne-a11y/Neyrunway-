import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { ToastMessage, BudgetWarningData } from '../../types';
import { 
  AlertTriangle, 
  X, 
  TrendingDown, 
  ArrowRight, 
  Target, 
  MessageSquare, 
  Sparkles,
  Flame,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'motion/react';

export interface BudgetWarningToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const BudgetWarningToast: React.FC<BudgetWarningToastProps> = ({
  toast,
  onDismiss,
}) => {
  const { t, formatCurrency, language } = useTranslation();
  const isFrench = language === 'fr';

  const data: BudgetWarningData = toast.data || {
    currentSpending: 650,
    monthlyBudgetGoal: 500,
    excessAmount: 150,
    percentageUsed: 130,
  };

  const duration = toast.duration ?? 8000;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration <= 0) return;
    const intervalTime = 50;
    const decrement = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onDismiss(toast.id);
          return 0;
        }
        return prev - decrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [duration, toast.id, onDismiss]);

  const percentage = Math.round((data.currentSpending / Math.max(1, data.monthlyBudgetGoal)) * 100);
  const excess = Math.max(0, data.currentSpending - data.monthlyBudgetGoal);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative w-full max-w-md bg-[#111622]/95 backdrop-blur-xl border border-[#F43F5E]/40 rounded-3xl p-4 sm:p-5 shadow-[0_10px_40px_rgba(244,63,94,0.22),0_0_20px_rgba(11,14,23,0.8)] overflow-hidden pointer-events-auto"
      role="alert"
      aria-live="assertive"
    >
      {/* Subtle Ambient Radial Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#F43F5E]/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-[#FACC15]/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#FB7185]">
                {isFrench ? 'Alerte Budget Mensuel' : 'Monthly Budget Alert'}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F43F5E]/25 text-[#FFA1AD] border border-[#F43F5E]/40 font-bold">
                {percentage}%
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-[#F5F5F0] truncate">
              {toast.title || (isFrench ? 'Objectif de dépenses dépassé' : 'Spending exceeds budget goal')}
            </h4>
          </div>
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-lg text-[#8A8F98] hover:text-[#F5F5F0] hover:bg-[#1e293b]/70 transition-colors cursor-pointer shrink-0"
          aria-label={isFrench ? 'Fermer l\'alerte' : 'Dismiss alert'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Numerical Stats & Comparison Card */}
      <div className="mt-3.5 p-3 rounded-2xl bg-[#0B0E17]/80 border border-[#1e293b] space-y-2.5 relative z-10">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-1.5 rounded-xl bg-[#161b27]/60">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#8A8F98] block">
              {isFrench ? 'Dépensé ce mois' : 'Spent this month'}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#F43F5E] block mt-0.5">
              {formatCurrency(data.currentSpending)}
            </span>
          </div>

          <div className="p-1.5 rounded-xl bg-[#161b27]/60">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#8A8F98] block">
              {isFrench ? 'Budget défini' : 'Budget goal'}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#F5F5F0] block mt-0.5">
              {formatCurrency(data.monthlyBudgetGoal)}
            </span>
          </div>

          <div className="p-1.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#FB7185] block">
              {isFrench ? 'Dépassement' : 'Overage'}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#FB7185] block mt-0.5">
              +{formatCurrency(excess || data.excessAmount)}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8A8F98]">
            <span>{isFrench ? 'Utilisation du budget' : 'Budget utilization'}</span>
            <span className="text-[#FB7185] font-bold">
              {percentage}% {isFrench ? 'du plafond fixé' : 'of monthly cap'}
            </span>
          </div>
          <div className="h-2 w-full bg-[#161b27] rounded-full overflow-hidden border border-[#1e293b] relative">
            {/* 100% threshold marker */}
            <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-[#8A8F98]/50 z-20" />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (data.currentSpending / data.monthlyBudgetGoal) * 75)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                percentage > 100
                  ? 'bg-gradient-to-r from-[#FACC15] via-[#FB7185] to-[#F43F5E]'
                  : 'bg-[#D4FF3D]'
              }`}
            />
          </div>
        </div>

        {/* Context message */}
        <p className="text-[11px] text-[#B8BCC4] leading-relaxed">
          {toast.message || (
            data.recentTransactionTitle ? (
              isFrench
                ? `L'enregistrement de "${data.recentTransactionTitle}" (${formatCurrency(data.recentTransactionAmount || 0)}) a fait basculer vos dépenses au-delà de votre objectif.`
                : `Recording "${data.recentTransactionTitle}" (${formatCurrency(data.recentTransactionAmount || 0)}) pushed your spending past your monthly goal.`
            ) : (
              isFrench 
                ? 'Vos dépenses du mois en cours dépassent le seuil fixé. Consultez Ney pour rééquilibrer vos prévisions.' 
                : 'Your spending for this month exceeds your target limit. Ask Ney to help rebalance your runway.'
            )
          )}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 flex items-center gap-2 relative z-10">
        {toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onDismiss(toast.id);
            }}
            className="flex-1 px-3 py-2 rounded-xl bg-[#F43F5E] hover:bg-[#E11D48] text-[#FFFFFF] text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)] cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{toast.actionLabel || (isFrench ? 'Conseil Copilot Ney' : 'Ask Ney Copilot')}</span>
          </button>
        )}

        {toast.onSecondaryAction && (
          <button
            type="button"
            onClick={() => {
              toast.onSecondaryAction?.();
              onDismiss(toast.id);
            }}
            className="px-3 py-2 rounded-xl bg-[#161b27] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#8A8F98]/40 text-xs font-medium text-[#F5F5F0] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Target className="w-3.5 h-3.5 text-[#D4FF3D]" />
            <span>{toast.secondaryActionLabel || (isFrench ? 'Ajuster l\'objectif' : 'Adjust goal')}</span>
          </button>
        )}
      </div>

      {/* Auto-dismiss countdown bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#161b27]">
          <div
            className="h-full bg-gradient-to-r from-[#FACC15] to-[#F43F5E] transition-all ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
};
