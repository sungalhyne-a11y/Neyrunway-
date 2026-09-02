import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { Lock, X, Check, AlertCircle, Delete, KeyRound, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { setupPin, secondaryAuth } = useAuth();
  const { t, language } = useTranslation();

  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [pinLength, setPinLength] = useState<number>(secondaryAuth.pinLength || 4);

  if (!isOpen) return null;

  const currentInput = step === 'enter' ? firstPin : confirmPin;

  const handleDigitPress = (digit: string) => {
    if (submitting) return;

    if (step === 'enter') {
      if (firstPin.length < 6) {
        const next = firstPin + digit;
        setFirstPin(next);
        setErrorMsg(null);
      }
    } else {
      if (confirmPin.length < firstPin.length) {
        const next = confirmPin + digit;
        setConfirmPin(next);
        setErrorMsg(null);
      }
    }
  };

  const handleBackspace = () => {
    if (submitting) return;
    if (step === 'enter') {
      setFirstPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
    setErrorMsg(null);
  };

  const handleProceedToConfirm = () => {
    if (firstPin.length < 4) {
      setErrorMsg(t.security?.pinTooShort || 'PIN must be at least 4 digits.');
      return;
    }
    setPinLength(firstPin.length);
    setStep('confirm');
    setConfirmPin('');
    setErrorMsg(null);
  };

  const handleFinalSubmit = async () => {
    if (confirmPin !== firstPin) {
      setErrorMsg(t.security?.pinMismatch || 'PIN codes do not match.');
      setConfirmPin('');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await setupPin(firstPin);
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to save PIN.');
      }
    } catch {
      setErrorMsg('Failed to save PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0E17]/90 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8A8F98] hover:text-[#F5F5F0] min-w-[44px] min-h-[44px] p-2.5 rounded-xl hover:bg-[#0B0E17] transition-all flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-3 rounded-2xl bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/20 mb-3">
          <KeyRound className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-[#F5F5F0]">
          {step === 'enter'
            ? (t.security?.enterNewPin || (language === 'fr' ? 'Créer un code PIN' : 'Create a PIN code'))
            : (t.security?.confirmPin || (language === 'fr' ? 'Confirmer le code PIN' : 'Confirm PIN code'))}
        </h3>
        <p className="text-xs text-[#8A8F98] mt-1 max-w-[240px]">
          {step === 'enter'
            ? (language === 'fr' ? 'Choisissez 4 à 6 chiffres pour verrouiller vos vues sensibles.' : 'Choose 4 to 6 digits to lock sensitive financial views.')
            : (language === 'fr' ? 'Retapez votre code PIN pour valider la configuration.' : 'Re-enter your PIN to verify.')}
        </p>

        {errorMsg && (
          <div className="mt-3 px-3 py-1.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-[#FB7185] text-xs flex items-center gap-1.5 font-mono">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dots */}
        <div className="flex items-center justify-center gap-3 my-5">
          {Array.from({ length: step === 'enter' ? Math.max(4, firstPin.length) : firstPin.length }).map((_, index) => {
            const isFilled = index < currentInput.length;
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
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] active:bg-[#D4FF3D]/20 border border-[#1e293b] hover:border-[#D4FF3D]/40 text-base font-bold font-mono text-[#F5F5F0] hover:text-[#D4FF3D] transition-all flex items-center justify-center cursor-pointer"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              if (step === 'enter') setFirstPin('');
              else setConfirmPin('');
            }}
            className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] text-xs font-mono text-[#8A8F98] flex items-center justify-center cursor-pointer"
          >
            C
          </button>

          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-base font-bold font-mono text-[#F5F5F0] hover:text-[#D4FF3D] transition-all flex items-center justify-center cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] text-[#8A8F98] hover:text-[#FB7185] transition-all flex items-center justify-center cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Step Buttons */}
        <div className="w-full pt-5 mt-4 border-t border-[#1e293b] flex gap-3">
          {step === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('enter');
                  setConfirmPin('');
                }}
                className="flex-1 py-3 min-h-[44px] rounded-full bg-[#0B0E17] hover:bg-[#1e293b] text-[#8A8F98] border border-[#1e293b] text-xs font-semibold cursor-pointer flex items-center justify-center"
              >
                {language === 'fr' ? 'Corriger' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={confirmPin.length !== firstPin.length || submitting}
                className="flex-1 py-3 min-h-[44px] rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(212,255,61,0.25)]"
              >
                <Check className="w-4 h-4" />
                <span>{language === 'fr' ? 'Valider le PIN' : 'Save PIN'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleProceedToConfirm}
              disabled={firstPin.length < 4}
              className="w-full py-3 min-h-[44px] rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(212,255,61,0.25)]"
            >
              <span>{language === 'fr' ? 'Suivant (Confirmer)' : 'Next (Confirm)'}</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
