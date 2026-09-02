import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Fingerprint, 
  KeyRound, 
  Lock, 
  Check, 
  Clock, 
  Eye, 
  AlertCircle, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Loader2
} from 'lucide-react';
import { PinSetupModal } from '../auth/PinSetupModal';

interface SecuritySettingsCardProps {
  onNotifySuccess?: () => void;
}

export const SecuritySettingsCard: React.FC<SecuritySettingsCardProps> = ({ onNotifySuccess }) => {
  const { 
    secondaryAuth, 
    isBiometricsAvailable, 
    updateSecondaryAuthSettings, 
    disableSecondaryAuth,
    setupBiometrics,
    lockSensitiveViews,
    requestUnlock
  } = useAuth();
  const { t, language } = useTranslation();

  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [isEnrollingBiometrics, setIsEnrollingBiometrics] = useState<boolean>(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const handleMasterToggle = async () => {
    if (secondaryAuth.enabled) {
      await disableSecondaryAuth();
      if (onNotifySuccess) onNotifySuccess();
    } else {
      if (!secondaryAuth.pinHash && !secondaryAuth.biometricsEnrolled) {
        // Open PIN modal first if no credential exists yet
        setShowPinModal(true);
      } else {
        await updateSecondaryAuthSettings({ enabled: true });
        if (onNotifySuccess) onNotifySuccess();
      }
    }
  };

  const handleEnrollBiometrics = async () => {
    setIsEnrollingBiometrics(true);
    setBiometricError(null);
    try {
      const res = await setupBiometrics();
      if (res.success) {
        if (onNotifySuccess) onNotifySuccess();
      } else {
        setBiometricError(res.error || t.security?.biometricFailed || 'Biometric enrollment failed.');
      }
    } catch {
      setBiometricError('Biometric enrollment failed.');
    } finally {
      setIsEnrollingBiometrics(false);
    }
  };

  const handleTimeoutChange = (minutes: number) => {
    updateSecondaryAuthSettings({ autoLockMinutes: minutes });
    if (onNotifySuccess) onNotifySuccess();
  };

  return (
    <>
      <div 
        id="security-settings-card"
        className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              secondaryAuth.enabled
                ? 'bg-[#D4FF3D]/10 text-[#D4FF3D] border-[#D4FF3D]/30 shadow-[0_0_12px_rgba(212,255,61,0.2)]'
                : 'bg-[#0B0E17] text-[#8A8F98] border-[#1e293b]'
            }`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F5F5F0]">
                {t.security?.title || (language === 'fr' ? 'Protection des Données Financières' : 'Financial Privacy & Lock')}
              </h3>
              <p className="text-[11px] text-[#8A8F98]">
                {t.security?.badge || (language === 'fr' ? 'Verrouillage secondaire biométrique & code PIN' : 'Biometrics & PIN lock')}
              </p>
            </div>
          </div>

          {/* Master Switch Button */}
          <button
            type="button"
            id="btn-toggle-secondary-auth"
            onClick={handleMasterToggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all cursor-pointer border ${
              secondaryAuth.enabled
                ? 'bg-[#D4FF3D]/15 text-[#D4FF3D] border-[#D4FF3D]/40 hover:bg-[#D4FF3D]/25'
                : 'bg-[#0B0E17] text-[#8A8F98] border-[#1e293b] hover:border-[#8A8F98]'
            }`}
          >
            <span>{secondaryAuth.enabled ? (language === 'fr' ? 'ACTIF' : 'ENABLED') : (language === 'fr' ? 'INACTIF' : 'DISABLED')}</span>
            {secondaryAuth.enabled ? (
              <ToggleRight className="w-4 h-4 text-[#D4FF3D]" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-[#8A8F98]" />
            )}
          </button>
        </div>

        {/* Description Banner */}
        <p className="text-xs text-[#8A8F98] leading-relaxed">
          {t.security?.enableDesc || (language === 'fr' 
            ? 'Protège vos transactions, objectifs et données sensibles contre les regards indiscrets sur campus ou ordinateurs partagés.'
            : 'Locks your transactions and goals against shoulder-surfing in public places or university libraries.')}
        </p>

        {/* Configuration Details */}
        <div className="space-y-4 pt-1">
          {/* Method 1: PIN Code */}
          <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#161b27] text-[#D4FF3D] border border-[#1e293b]">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#F5F5F0]">
                    {t.security?.pinMethod || (language === 'fr' ? 'Code PIN de sécurité' : 'PIN Code')}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                    secondaryAuth.pinHash
                      ? 'bg-[#D4FF3D]/10 text-[#D4FF3D] border-[#D4FF3D]/25'
                      : 'bg-[#1e293b] text-[#8A8F98] border-transparent'
                  }`}>
                    {secondaryAuth.pinHash 
                      ? (t.security?.pinConfigured || (language === 'fr' ? 'Actif' : 'Configured')) 
                      : (t.security?.pinNotConfigured || (language === 'fr' ? 'Non configuré' : 'Not set'))}
                  </span>
                </div>
                <p className="text-[11px] text-[#8A8F98] mt-0.5">
                  {secondaryAuth.pinHash
                    ? (language === 'fr' ? `PIN chiffré (${secondaryAuth.pinLength || 4} chiffres)` : `Encrypted PIN (${secondaryAuth.pinLength || 4} digits)`)
                    : (language === 'fr' ? 'Définissez un code PIN pour déverrouiller vos vues' : 'Set a PIN code to protect your views')}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-configure-pin"
              onClick={() => setShowPinModal(true)}
              className="px-3 py-1.5 rounded-xl bg-[#161b27] hover:bg-[#1e293b] text-[#D4FF3D] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-xs font-mono transition-all cursor-pointer shrink-0"
            >
              {secondaryAuth.pinHash 
                ? (t.security?.changePin || (language === 'fr' ? 'Modifier' : 'Change PIN')) 
                : (t.security?.configurePin || (language === 'fr' ? 'Configurer' : 'Configure'))}
            </button>
          </div>

          {/* Method 2: Browser Biometrics */}
          <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#161b27] text-[#38BDF8] border border-[#1e293b]">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#F5F5F0]">
                      {t.security?.biometricMethod || 'Touch ID / Face ID / Windows Hello'}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                      secondaryAuth.biometricsEnrolled
                        ? 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30'
                        : isBiometricsAvailable
                        ? 'bg-[#D4FF3D]/10 text-[#D4FF3D] border-[#D4FF3D]/20'
                        : 'bg-[#1e293b] text-[#8A8F98] border-transparent'
                    }`}>
                      {secondaryAuth.biometricsEnrolled
                        ? (t.security?.biometricsEnrolled || (language === 'fr' ? 'Associé' : 'Enrolled'))
                        : isBiometricsAvailable
                        ? (t.security?.biometricsAvailable || (language === 'fr' ? 'Disponible' : 'Available'))
                        : (t.security?.biometricsUnavailable || (language === 'fr' ? 'Non supporté' : 'Unsupported'))}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A8F98] mt-0.5">
                    {language === 'fr' 
                      ? 'Authentification biométrique matérielle sécurisée via WebAuthn' 
                      : 'Hardware-backed biometric authentication via WebAuthn'}
                  </p>
                </div>
              </div>

              {isBiometricsAvailable && (
                <button
                  type="button"
                  id="btn-enroll-biometrics"
                  onClick={handleEnrollBiometrics}
                  disabled={isEnrollingBiometrics}
                  className="px-3 py-1.5 rounded-xl bg-[#161b27] hover:bg-[#1e293b] text-[#38BDF8] border border-[#1e293b] hover:border-[#38BDF8]/40 text-xs font-mono transition-all cursor-pointer shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isEnrollingBiometrics ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.security?.biometricsEnrolling || (language === 'fr' ? 'Enregistrement...' : 'Enrolling...')}</span>
                    </>
                  ) : (
                    <span>
                      {secondaryAuth.biometricsEnrolled
                        ? (language === 'fr' ? 'Ré-associer' : 'Re-enroll')
                        : (t.security?.enrollBiometrics || (language === 'fr' ? 'Associer' : 'Enroll'))}
                    </span>
                  )}
                </button>
              )}
            </div>

            {biometricError && (
              <div className="px-3 py-1.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-[#FB7185] text-xs flex items-center gap-1.5 font-mono">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{biometricError}</span>
              </div>
            )}
          </div>

          {/* Auto-Lock Delay */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-[#8A8F98] flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-[#D4FF3D]" />
              <span>{t.security?.autoLockTitle || (language === 'fr' ? 'Délai de verrouillage automatique' : 'Auto-Lock Timeout')}</span>
            </label>
            <select
              id="security-autolock-select"
              value={secondaryAuth.autoLockMinutes ?? 5}
              onChange={(e) => handleTimeoutChange(parseInt(e.target.value, 10))}
              disabled={!secondaryAuth.enabled}
              className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs text-[#F5F5F0] font-mono focus:outline-none focus:border-[#D4FF3D]/50 disabled:opacity-40 cursor-pointer"
            >
              <option value={0} className="bg-[#0B0E17] text-[#F5F5F0]">
                {t.security?.autoLockImmediate || (language === 'fr' ? 'Immédiat (changement d\'onglet ou de vue)' : 'Immediate (tab blur or view change)')}
              </option>
              <option value={5} className="bg-[#0B0E17] text-[#F5F5F0]">
                {t.security?.autoLock5m || (language === 'fr' ? 'Après 5 minutes d\'inactivité' : 'After 5 minutes of inactivity')}
              </option>
              <option value={15} className="bg-[#0B0E17] text-[#F5F5F0]">
                {t.security?.autoLock15m || (language === 'fr' ? 'Après 15 minutes d\'inactivité' : 'After 15 minutes of inactivity')}
              </option>
              <option value={-1} className="bg-[#0B0E17] text-[#F5F5F0]">
                {t.security?.autoLockNever || (language === 'fr' ? 'Verrouillage manuel uniquement' : 'Manual lock only')}
              </option>
            </select>
          </div>

          {/* Quick Test / Manual Lock Button */}
          {secondaryAuth.enabled && (
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                id="btn-test-lock-screen"
                onClick={() => {
                  lockSensitiveViews();
                  requestUnlock();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-xs font-mono text-[#D4FF3D] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t.security?.testLock || (language === 'fr' ? 'Tester le verrouillage' : 'Test Lock Screen')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PIN Setup Modal */}
      <PinSetupModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          if (onNotifySuccess) onNotifySuccess();
        }}
      />
    </>
  );
};
