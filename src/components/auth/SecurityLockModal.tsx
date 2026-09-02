import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { 
  ShieldCheck, 
  Fingerprint, 
  Lock, 
  Delete, 
  ArrowLeft, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SecurityLockModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancelToDashboard?: () => void;
}

const STORAGE_LOCK_FAILED_ATTEMPTS = 'neyrunway_lock_failed_attempts';
const STORAGE_LOCK_COOLDOWN_UNTIL = 'neyrunway_lock_cooldown_until';

export const SecurityLockModal: React.FC<SecurityLockModalProps> = ({ 
  isOpen, 
  onClose,
  onCancelToDashboard 
}) => {
  const { 
    secondaryAuth, 
    unlockWithPin, 
    unlockWithBiometrics, 
    isBiometricsAvailable,
    currentUser,
    userProfile 
  } = useAuth();
  const { t, language } = useTranslation();

  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [shakeKey, setShakeKey] = useState<number>(0);
  const [activeMethod, setActiveMethod] = useState<'pin' | 'biometric'>(
    secondaryAuth.biometricsEnrolled ? 'biometric' : 'pin'
  );

  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(STORAGE_LOCK_FAILED_ATTEMPTS);
        return stored ? parseInt(stored, 10) || 0 : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  });

  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const until = sessionStorage.getItem(STORAGE_LOCK_COOLDOWN_UNTIL);
        if (until) {
          const diff = Math.ceil((parseInt(until, 10) - Date.now()) / 1000);
          return diff > 0 ? diff : 0;
        }
      } catch {
        return 0;
      }
    }
    return 0;
  });

  const targetPinLength = secondaryAuth.pinLength || 4;

  // Active Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem(STORAGE_LOCK_COOLDOWN_UNTIL);
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Auto-attempt biometric verification on modal open if biometrics enrolled and activeMethod is biometric
  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg(null);

      // Re-verify cooldown status upon modal opening
      try {
        const until = sessionStorage.getItem(STORAGE_LOCK_COOLDOWN_UNTIL);
        if (until) {
          const diff = Math.ceil((parseInt(until, 10) - Date.now()) / 1000);
          if (diff > 0) {
            setCooldownRemaining(diff);
          } else {
            sessionStorage.removeItem(STORAGE_LOCK_COOLDOWN_UNTIL);
            setCooldownRemaining(0);
          }
        }
      } catch {}

      if (secondaryAuth.biometricsEnrolled) {
        setActiveMethod('biometric');
        handleBiometricAuth();
      } else {
        setActiveMethod('pin');
      }
    }
  }, [isOpen, secondaryAuth.biometricsEnrolled]);

  const handleBiometricAuth = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await unlockWithBiometrics();
      if (res.success) {
        // Clear brute-force counters on successful auth
        try {
          sessionStorage.removeItem(STORAGE_LOCK_FAILED_ATTEMPTS);
          sessionStorage.removeItem(STORAGE_LOCK_COOLDOWN_UNTIL);
        } catch {}
        setFailedAttempts(0);
        setCooldownRemaining(0);
      } else {
        setErrorMsg(t.security?.biometricFailed || 'Biometric authentication failed.');
        setActiveMethod('pin');
      }
    } catch {
      setErrorMsg(t.security?.biometricFailed || 'Biometric authentication failed.');
      setActiveMethod('pin');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePinSubmit = useCallback(async (currentPin: string) => {
    if (currentPin.length < targetPinLength || cooldownRemaining > 0) return;

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await unlockWithPin(currentPin);
      if (res.success) {
        // Clear brute-force counters on successful auth
        try {
          sessionStorage.removeItem(STORAGE_LOCK_FAILED_ATTEMPTS);
          sessionStorage.removeItem(STORAGE_LOCK_COOLDOWN_UNTIL);
        } catch {}
        setFailedAttempts(0);
        setCooldownRemaining(0);
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        try {
          sessionStorage.setItem(STORAGE_LOCK_FAILED_ATTEMPTS, String(nextAttempts));
        } catch {}

        setShakeKey((prev) => prev + 1);
        setPinInput('');

        if (nextAttempts >= 5) {
          // 2 minutes cooldown
          const cooldownEnd = Date.now() + 120000;
          try {
            sessionStorage.setItem(STORAGE_LOCK_COOLDOWN_UNTIL, String(cooldownEnd));
          } catch {}
          setCooldownRemaining(120);
          setErrorMsg(
            language === 'fr'
              ? 'Trop de tentatives infructueuses (5+). Clavier verrouillé pendant 2 minutes.'
              : 'Too many failed attempts (5+). Keypad locked for 2 minutes.'
          );
        } else if (nextAttempts >= 3) {
          // 30 seconds cooldown
          const cooldownEnd = Date.now() + 30000;
          try {
            sessionStorage.setItem(STORAGE_LOCK_COOLDOWN_UNTIL, String(cooldownEnd));
          } catch {}
          setCooldownRemaining(30);
          setErrorMsg(
            language === 'fr'
              ? '3 tentatives incorrectes. Clavier verrouillé pendant 30 secondes.'
              : '3 failed attempts. Keypad locked for 30 seconds.'
          );
        } else {
          const remainingBeforeCooldown = 3 - nextAttempts;
          setErrorMsg(
            language === 'fr'
              ? `Code PIN incorrect (${remainingBeforeCooldown} essai(s) avant temporisation).`
              : `Incorrect PIN code (${remainingBeforeCooldown} attempt(s) before delay).`
          );
        }
      }
    } catch {
      setErrorMsg(t.security?.pinIncorrect || 'Incorrect PIN. Please try again.');
      setShakeKey((prev) => prev + 1);
      setPinInput('');
    } finally {
      setIsVerifying(false);
    }
  }, [targetPinLength, cooldownRemaining, failedAttempts, unlockWithPin, t.security, language]);

  const handleDigitPress = (digit: string) => {
    if (pinInput.length < 6 && !isVerifying) {
      const newPin = pinInput + digit;
      setPinInput(newPin);
      setErrorMsg(null);

      // Auto submit if reached pin length
      if (newPin.length >= targetPinLength) {
        handlePinSubmit(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (pinInput.length > 0 && !isVerifying) {
      setPinInput(pinInput.slice(0, -1));
      setErrorMsg(null);
    }
  };

  const handleClear = () => {
    setPinInput('');
    setErrorMsg(null);
  };

  // Physical keyboard support
  useEffect(() => {
    if (!isOpen || activeMethod !== 'pin') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        if (onCancelToDashboard) onCancelToDashboard();
        else if (onClose) onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeMethod, pinInput, isVerifying]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="security-lock-modal-overlay"
        className="fixed inset-0 z-50 bg-[#0B0E17]/95 backdrop-blur-xl flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-sm bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center text-center"
        >
          {/* Header Icon Badge */}
          <div className="relative mb-4">
            <div className="p-3.5 rounded-3xl bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/25 shadow-[0_0_25px_rgba(212,255,61,0.25)] flex items-center justify-center">
              {activeMethod === 'biometric' ? (
                <Fingerprint className="w-8 h-8 animate-pulse" />
              ) : (
                <Lock className="w-8 h-8" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#0B0E17] border border-[#1e293b]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4FF3D]" />
            </div>
          </div>

          {/* Title & Subtitle */}
          <h2 className="text-lg font-bold text-[#F5F5F0] tracking-tight">
            {t.security?.lockModalTitle || (language === 'fr' ? 'Espace Financier Protégé' : 'Protected Financial Vault')}
          </h2>
          <p className="text-xs text-[#8A8F98] mt-1 max-w-[260px] leading-relaxed">
            {userProfile?.displayName || currentUser?.email || (language === 'fr' ? 'Session Étudiant' : 'Student Session')}
          </p>

          {/* Error Message */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3.5 px-3 py-1.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-[#FB7185] text-xs flex items-center gap-1.5 font-mono"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {/* Biometric Method View */}
          {activeMethod === 'biometric' && (
            <div className="w-full mt-6 space-y-5">
              <div className="p-6 rounded-2xl bg-[#0B0E17]/80 border border-[#1e293b] flex flex-col items-center justify-center space-y-3">
                <button
                  type="button"
                  id="btn-trigger-biometrics"
                  onClick={handleBiometricAuth}
                  disabled={isVerifying}
                  className="relative p-5 rounded-full bg-[#D4FF3D]/15 hover:bg-[#D4FF3D]/25 border border-[#D4FF3D]/40 text-[#D4FF3D] transition-all cursor-pointer shadow-[0_0_25px_rgba(212,255,61,0.2)] active:scale-95"
                >
                  {isVerifying ? (
                    <Loader2 className="w-10 h-10 animate-spin" />
                  ) : (
                    <Fingerprint className="w-10 h-10" />
                  )}
                </button>
                <span className="text-xs font-semibold text-[#F5F5F0]">
                  {isVerifying
                    ? (language === 'fr' ? 'Vérification biométrique en cours...' : 'Verifying biometrics...')
                    : (t.security?.unlockWithBiometrics || (language === 'fr' ? 'Touch ID / Face ID' : 'Touch ID / Face ID'))}
                </span>
                <p className="text-[11px] text-[#8A8F98]">
                  {language === 'fr' 
                    ? 'Placez votre doigt sur le capteur ou regardez la caméra' 
                    : 'Place your finger on sensor or look at camera'}
                </p>
              </div>

              {/* Fallback to PIN */}
              {secondaryAuth.pinHash && (
                <button
                  type="button"
                  id="btn-switch-to-pin"
                  onClick={() => {
                    setErrorMsg(null);
                    setActiveMethod('pin');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] text-xs font-mono text-[#D4FF3D] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{t.security?.unlockWithPin || (language === 'fr' ? 'Déverrouiller par code PIN' : 'Unlock with PIN Code')}</span>
                </button>
              )}
            </div>
          )}

          {/* PIN Method View */}
          {activeMethod === 'pin' && (
            <div className="w-full mt-4 space-y-5">
              {/* Cooldown Active Banner */}
              {cooldownRemaining > 0 && (
                <div className="p-3 rounded-2xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-[#FB7185] flex flex-col items-center justify-center space-y-1">
                  <span className="text-[11px] font-semibold">
                    {language === 'fr' ? 'Temporisation de sécurité active' : 'Security cooldown active'}
                  </span>
                  <span className="text-sm font-mono font-bold text-[#F43F5E] animate-pulse">
                    {cooldownRemaining}s
                  </span>
                </div>
              )}

              {/* PIN Dots Indicator */}
              <motion.div 
                key={shakeKey}
                animate={shakeKey > 0 ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-center gap-3 py-2"
              >
                {Array.from({ length: targetPinLength }).map((_, index) => {
                  const isFilled = index < pinInput.length;
                  return (
                    <div
                      key={index}
                      className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                        isFilled
                          ? 'bg-[#D4FF3D] border-[#D4FF3D] shadow-[0_0_10px_rgba(212,255,61,0.8)] scale-110'
                          : 'bg-[#0B0E17] border-[#1e293b]'
                      }`}
                    />
                  );
                })}
              </motion.div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    id={`lock-key-${digit}`}
                    onClick={() => handleDigitPress(digit)}
                    disabled={isVerifying || cooldownRemaining > 0}
                    className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] active:bg-[#D4FF3D]/20 border border-[#1e293b] hover:border-[#D4FF3D]/40 text-base font-bold font-mono text-[#F5F5F0] hover:text-[#D4FF3D] transition-all flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {digit}
                  </button>
                ))}

                {/* Biometric or Clear Button */}
                {secondaryAuth.biometricsEnrolled && isBiometricsAvailable ? (
                  <button
                    type="button"
                    id="lock-key-biometric"
                    onClick={() => {
                      setErrorMsg(null);
                      setActiveMethod('biometric');
                      handleBiometricAuth();
                    }}
                    title={language === 'fr' ? 'Passer à la biométrie' : 'Switch to biometrics'}
                    className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-[#D4FF3D] transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Fingerprint className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    id="lock-key-clear"
                    onClick={handleClear}
                    disabled={cooldownRemaining > 0}
                    title={language === 'fr' ? 'Effacer tout' : 'Clear all'}
                    className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] text-[11px] font-mono text-[#8A8F98] hover:text-[#F5F5F0] transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    C
                  </button>
                )}

                {/* Zero Digit */}
                <button
                  type="button"
                  id="lock-key-0"
                  onClick={() => handleDigitPress('0')}
                  disabled={isVerifying || cooldownRemaining > 0}
                  className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] active:bg-[#D4FF3D]/20 border border-[#1e293b] hover:border-[#D4FF3D]/40 text-base font-bold font-mono text-[#F5F5F0] hover:text-[#D4FF3D] transition-all flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  0
                </button>

                {/* Backspace Button */}
                <button
                  type="button"
                  id="lock-key-backspace"
                  onClick={handleBackspace}
                  disabled={isVerifying || pinInput.length === 0 || cooldownRemaining > 0}
                  className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] text-[#8A8F98] hover:text-[#FB7185] transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="w-full pt-4 mt-2 border-t border-[#1e293b] flex items-center justify-between">
            <button
              type="button"
              id="btn-lock-cancel-dashboard"
              onClick={() => {
                if (onCancelToDashboard) onCancelToDashboard();
                else if (onClose) onClose();
              }}
              className="min-h-[44px] px-3 py-2 text-xs text-[#8A8F98] hover:text-[#F5F5F0] hover:bg-[#0B0E17] rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.security?.backToDashboard || (language === 'fr' ? 'Retour au Runway' : 'Back to Dashboard')}</span>
            </button>

            <span className="text-[10px] text-[#8A8F98] font-mono flex items-center gap-1 px-2 py-1">
              <Sparkles className="w-3 h-3 text-[#D4FF3D]" />
              <span>Ney Shield</span>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
