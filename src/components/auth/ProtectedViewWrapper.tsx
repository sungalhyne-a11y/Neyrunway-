import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { ShieldCheck, Fingerprint, KeyRound, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { AppRoute } from '../../types';

interface ProtectedViewWrapperProps {
  route: AppRoute;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onNavigateToDashboard?: () => void;
}

export const ProtectedViewWrapper: React.FC<ProtectedViewWrapperProps> = ({
  route,
  children,
  title,
  subtitle,
  onNavigateToDashboard,
}) => {
  const { 
    secondaryAuth, 
    isSecondaryAuthenticated, 
    isBiometricsAvailable, 
    requestUnlock 
  } = useAuth();
  const { t, language } = useTranslation();

  // If secondary auth is disabled or route is not locked, render normal children
  if (!secondaryAuth.enabled || isSecondaryAuthenticated) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full flex flex-col items-center justify-center min-h-[500px] py-12 px-4"
    >
      <div 
        id="protected-view-locked-card"
        className="w-full max-w-md bg-[#161b27] border border-[#1e293b] rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center space-y-6"
      >
        {/* Glowing Shield Halo */}
        <div className="relative">
          <div className="p-4 rounded-3xl bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/25 shadow-[0_0_30px_rgba(212,255,61,0.25)]">
            <Lock className="w-10 h-10 animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#0B0E17] border border-[#1e293b]">
            <ShieldCheck className="w-4 h-4 text-[#D4FF3D]" />
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold text-[#D4FF3D] px-3 py-1 rounded-full bg-[#D4FF3D]/10 border border-[#D4FF3D]/20 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>{t.security?.badge || (language === 'fr' ? 'Confidentialité Renforcée' : 'High Security Vault')}</span>
          </span>
          <h2 className="text-xl font-bold text-[#F5F5F0] tracking-tight">
            {title || t.security?.sessionLocked || (language === 'fr' ? 'Session Financière Verrouillée' : 'Financial Session Locked')}
          </h2>
          <p className="text-xs text-[#8A8F98] max-w-sm leading-relaxed">
            {subtitle || t.security?.lockModalSubtitle || (language === 'fr' 
              ? 'Cette section contient des informations financières sensibles protégées par votre authentification secondaire.' 
              : 'This section contains sensitive financial data protected by your secondary security lock.')}
          </p>
        </div>

        {/* Action Trigger Button */}
        <div className="w-full space-y-3 pt-2">
          <button
            type="button"
            id="btn-unlock-sensitive-view"
            onClick={() => requestUnlock(route)}
            className="w-full py-3.5 px-6 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-sm font-bold transition-all shadow-[0_0_20px_rgba(212,255,61,0.3)] hover:shadow-[0_0_30px_rgba(212,255,61,0.5)] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {secondaryAuth.biometricsEnrolled ? (
              <Fingerprint className="w-4 h-4" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            <span>
              {secondaryAuth.biometricsEnrolled
                ? (t.security?.unlockWithBiometrics || (language === 'fr' ? 'Déverrouiller par Biométrie / PIN' : 'Unlock with Biometrics / PIN'))
                : (t.security?.unlockWithPin || (language === 'fr' ? 'Saisir le code PIN' : 'Enter PIN Code'))}
            </span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {onNavigateToDashboard && (
            <button
              type="button"
              id="btn-locked-back-dashboard"
              onClick={onNavigateToDashboard}
              className="text-xs text-[#8A8F98] hover:text-[#F5F5F0] transition-colors py-1 cursor-pointer"
            >
              {t.security?.backToDashboard || (language === 'fr' ? 'Retour au tableau de bord' : 'Back to Dashboard')}
            </button>
          )}
        </div>

        {/* Security Feature Indicators */}
        <div className="w-full pt-4 border-t border-[#1e293b] flex items-center justify-center gap-4 text-[11px] text-[#8A8F98] font-mono">
          <span className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#D4FF3D]" />
            <span>PIN ({secondaryAuth.pinLength || 4} digits)</span>
          </span>
          {secondaryAuth.biometricsEnrolled && (
            <span className="flex items-center gap-1.5 text-[#38BDF8]">
              <Fingerprint className="w-3.5 h-3.5" />
              <span>WebAuthn</span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
