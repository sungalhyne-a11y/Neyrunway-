import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastMessage, BudgetWarningData, ToastType } from '../types';
import { BudgetWarningToast } from '../components/common/BudgetWarningToast';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X, AlertCircle } from 'lucide-react';

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => string;
  showBudgetWarning: (data: BudgetWarningData, options?: {
    title?: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    duration?: number;
  }) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>): string => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const newToast: ToastMessage = {
      ...toast,
      id,
      createdAt: Date.now(),
    };

    // Replace if there's already a budget warning toast to prevent spamming
    setToasts((prev) => {
      if (newToast.type === 'budget_warning') {
        const filtered = prev.filter((t) => t.type !== 'budget_warning');
        return [newToast, ...filtered];
      }
      return [newToast, ...prev.slice(0, 4)];
    });

    return id;
  }, []);

  const showBudgetWarning = useCallback((
    data: BudgetWarningData,
    options?: {
      title?: string;
      message?: string;
      actionLabel?: string;
      onAction?: () => void;
      secondaryActionLabel?: string;
      onSecondaryAction?: () => void;
      duration?: number;
    }
  ): string => {
    return showToast({
      type: 'budget_warning',
      title: options?.title || 'Monthly Budget Exceeded',
      message: options?.message,
      data,
      duration: options?.duration ?? 9000,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      secondaryActionLabel: options?.secondaryActionLabel,
      onSecondaryAction: options?.onSecondaryAction,
    });
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        showBudgetWarning,
        dismissToast,
        clearAllToasts,
      }}
    >
      {children}

      {/* Floating Toast Portal Container */}
      <div 
        id="toast-notifications-container"
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] flex flex-col gap-3 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] pointer-events-none"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            if (toast.type === 'budget_warning') {
              return (
                <BudgetWarningToast
                  key={toast.id}
                  toast={toast}
                  onDismiss={dismissToast}
                />
              );
            }

            // Generic toast renderer for success / info / warning
            const isSuccess = toast.type === 'success';
            const isWarning = toast.type === 'warning';
            const isDanger = toast.type === 'danger';

            const borderClass = isSuccess 
              ? 'border-[#D4FF3D]/40 bg-[#161b27]/95'
              : isWarning
                ? 'border-[#FACC15]/40 bg-[#161b27]/95'
                : isDanger
                  ? 'border-[#F43F5E]/40 bg-[#161b27]/95'
                  : 'border-[#1e293b] bg-[#161b27]/95';

            const iconClass = isSuccess
              ? 'text-[#D4FF3D] bg-[#D4FF3D]/10'
              : isWarning
                ? 'text-[#FACC15] bg-[#FACC15]/10'
                : isDanger
                  ? 'text-[#F43F5E] bg-[#F43F5E]/10'
                  : 'text-[#38BDF8] bg-[#38BDF8]/10';

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`p-4 rounded-2xl border ${borderClass} shadow-xl backdrop-blur-md pointer-events-auto flex items-start gap-3 relative`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${iconClass}`}>
                  {isSuccess && <CheckCircle2 className="w-4 h-4" />}
                  {isWarning && <AlertTriangle className="w-4 h-4" />}
                  {isDanger && <AlertCircle className="w-4 h-4" />}
                  {!isSuccess && !isWarning && !isDanger && <Info className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <h4 className="text-xs sm:text-sm font-semibold text-[#F5F5F0]">
                    {toast.title}
                  </h4>
                  {toast.message && (
                    <p className="text-xs text-[#8A8F98] leading-relaxed">
                      {toast.message}
                    </p>
                  )}
                  {toast.onAction && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.onAction?.();
                        dismissToast(toast.id);
                      }}
                      className="mt-2 text-xs font-mono text-[#D4FF3D] hover:underline block cursor-pointer"
                    >
                      {toast.actionLabel || 'Details'}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="p-1 text-[#8A8F98] hover:text-[#F5F5F0] rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
