import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { SupportedLanguage } from '../../types';
import { Shield, Sparkles, Mail, Lock, ArrowRight, UserCircle, Globe, AlertCircle, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialMode?: 'signIn' | 'signUp';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'signIn' }) => {
  const [mode, setMode] = useState<'signIn' | 'signUp'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInGuest } = useAuth();
  const { t, language, setLanguage } = useTranslation();

  if (!isOpen) return null;

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
  };

  const getTranslatedErrorMessage = (err: any): string => {
    const code = err?.code || '';
    const msg = err?.message || String(err || '');

    if (code === 'auth/popup-blocked' || msg.includes('popup-blocked') || msg.includes('popup was blocked') || msg.includes('blocked')) {
      return t.auth.errors.popupBlocked;
    }
    if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user') || msg.includes('closed-by-user')) {
      return t.auth.errors.popupClosed;
    }
    if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
      return t.auth.errors.unauthorizedDomain;
    }
    if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed') || msg.includes('admin-restricted-operation')) {
      return t.auth.errors.operationNotAllowed;
    }
    if (code === 'auth/network-request-failed' || msg.includes('network-request-failed')) {
      return t.auth.errors.networkFailed;
    }
    if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
      return t.auth.errors.tooManyRequests;
    }
    if (code === 'auth/invalid-email' || msg.includes('auth/invalid-email') || msg.includes('invalid-email')) {
      return t.auth.errors.invalidEmail;
    }
    if (code === 'auth/user-not-found' || msg.includes('auth/user-not-found') || msg.includes('user-not-found')) {
      return t.auth.errors.userNotFound;
    }
    if (
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      msg.includes('auth/wrong-password') ||
      msg.includes('auth/invalid-credential') ||
      msg.includes('wrong-password')
    ) {
      return t.auth.errors.wrongPassword;
    }
    if (code === 'auth/email-already-in-use' || msg.includes('auth/email-already-in-use') || msg.includes('email-already-in-use')) {
      return t.auth.errors.emailInUse;
    }
    if (code === 'auth/weak-password' || msg.includes('auth/weak-password') || msg.includes('weak-password')) {
      return t.auth.errors.weakPassword;
    }
    if (code === 'auth/user-disabled' || msg.includes('auth/user-disabled') || msg.includes('user-disabled')) {
      return t.auth.errors.userDisabled;
    }
    if (code === 'auth/cancelled-popup-request' || msg.includes('cancelled-popup-request')) {
      return t.auth.errors.popupClosed;
    }
    return t.auth.errors.generic;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'signIn') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMessage(getTranslatedErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMessage(getTranslatedErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestAuth = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signInGuest();
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMessage(getTranslatedErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0E17]/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
      >
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#D4FF3D]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header with Language Switcher and Close Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B0E17] border border-[#1e293b] flex items-center justify-center">
              <span className="font-mono font-bold text-xs text-[#D4FF3D]">NR</span>
            </div>
            <span className="text-xs font-mono tracking-widest text-[#8A8F98] uppercase">
              {t.brand.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#0B0E17] p-1 rounded-full border border-[#1e293b]">
              <Globe className="w-3.5 h-3.5 text-[#8A8F98] ml-1.5" />
              <button
                type="button"
                onClick={() => handleLanguageChange('fr')}
                className={`px-2.5 py-1 min-h-[32px] rounded-full text-xs font-mono transition-all cursor-pointer ${
                  language === 'fr' 
                    ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold' 
                    : 'text-[#8A8F98] hover:text-[#F5F5F0]'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`px-2.5 py-1 min-h-[32px] rounded-full text-xs font-mono transition-all cursor-pointer ${
                  language === 'en' 
                    ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold' 
                    : 'text-[#8A8F98] hover:text-[#F5F5F0]'
                }`}
              >
                EN
              </button>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-w-[40px] min-h-[40px] rounded-xl text-[#8A8F98] hover:text-[#F5F5F0] hover:bg-[#0B0E17] transition-all flex items-center justify-center cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5 mb-6">
          <h3 className="text-xl sm:text-2xl font-light text-[#F5F5F0]">
            {mode === 'signIn' ? t.auth.titleSignIn : t.auth.titleSignUp}
          </h3>
          <p className="text-xs text-[#8A8F98] leading-relaxed">
            {mode === 'signIn' ? t.auth.subtitleSignIn : t.auth.subtitleSignUp}
          </p>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google & Guest Quick Access */}
        <div className="space-y-2.5 mb-6">
          <button
            id="btn-auth-google"
            type="button"
            onClick={handleGoogleAuth}
            disabled={submitting}
            className="w-full py-3 px-4 rounded-2xl bg-[#0B0E17] hover:bg-[#1e293b] border border-[#1e293b] text-xs font-semibold text-[#F5F5F0] flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{t.auth.googleSignIn}</span>
          </button>

          <button
            id="btn-auth-guest"
            type="button"
            onClick={handleGuestAuth}
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-2xl bg-[#0B0E17]/60 hover:bg-[#0B0E17] border border-[#1e293b]/70 text-[#8A8F98] hover:text-[#F5F5F0] text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <UserCircle className="w-4 h-4 text-[#8A8F98]" />
            <span>{t.auth.guestSignIn}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-[#1e293b] w-full" />
          <span className="bg-[#161b27] px-3 text-[10px] uppercase font-mono tracking-widest text-[#8A8F98] absolute">
            {t.auth.orDivider}
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] mb-1.5">
              {t.auth.emailLabel}
            </label>
            <div className="relative">
              <input
                id="auth-input-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                className="w-full px-4 py-2.5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] focus:border-[#D4FF3D] text-xs text-[#F5F5F0] placeholder-[#8A8F98]/50 outline-none transition-all pl-9"
              />
              <Mail className="w-4 h-4 text-[#8A8F98] absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#8A8F98] mb-1.5">
              {t.auth.passwordLabel}
            </label>
            <div className="relative">
              <input
                id="auth-input-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                className="w-full px-4 py-2.5 rounded-2xl bg-[#0B0E17] border border-[#1e293b] focus:border-[#D4FF3D] text-xs text-[#F5F5F0] placeholder-[#8A8F98]/50 outline-none transition-all pl-9"
              />
              <Lock className="w-4 h-4 text-[#8A8F98] absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.25)] flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#0B0E17]" />
            ) : (
              <>
                <span>{mode === 'signIn' ? t.auth.signInButton : t.auth.signUpButton}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Switch Mode Prompt */}
        <div className="mt-6 text-center text-xs text-[#8A8F98]">
          <span>
            {mode === 'signIn' ? t.auth.noAccountPrompt : t.auth.hasAccountPrompt}{' '}
          </span>
          <button
            id="btn-auth-toggle-mode"
            type="button"
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setErrorMessage(null);
            }}
            className="text-[#D4FF3D] hover:underline font-semibold ml-1 cursor-pointer"
          >
            {mode === 'signIn' ? t.auth.signUpLink : t.auth.signInLink}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
