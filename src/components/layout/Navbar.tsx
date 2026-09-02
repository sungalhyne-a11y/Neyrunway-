import React, { useState, useRef, useEffect } from 'react';
import { Logo } from '../common/Logo';
import { LanguageCurrencySelector } from '../common/LanguageCurrencySelector';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { AppRoute } from '../../types';
import { 
  LogIn, 
  LogOut, 
  User, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  ChevronDown, 
  Settings as SettingsIcon,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { AuthModal } from '../auth/AuthModal';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate }) => {
  const { t, formatDays, formatCurrency, language } = useTranslation();
  const { 
    currentUser, 
    userProfile, 
    computedRunway, 
    signOut,
    secondaryAuth,
    isSecondaryAuthenticated,
    lockSensitiveViews,
    requestUnlock
  } = useAuth();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const displayDays = computedRunway?.runwayDays ?? 34;
  const displayBalance = computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250;

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const getUserInitials = () => {
    if (userProfile?.displayName) {
      const parts = userProfile.displayName.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.slice(0, 2).toUpperCase();
    }
    return 'ET';
  };

  const isGuestUser = currentUser?.isAnonymous || (!currentUser?.email && Boolean(currentUser));

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-[#0B0E17]/90 backdrop-blur-md border-b border-[#1e293b] px-3 sm:px-6 md:px-8 lg:px-10 h-16 sm:h-20 flex items-center transition-colors">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div 
            onClick={() => onNavigate('dashboard')} 
            className="cursor-pointer flex items-center gap-2 sm:gap-3 shrink-0"
          >
            <Logo size="md" />
          </div>

          {/* Center: Live Financial Runway Quick Indicator (Desktop) */}
          <div className="hidden md:flex items-center gap-3 px-4 py-1.5 rounded-full bg-[#161b27] border border-[#1e293b]">
            <div className="w-2 h-2 rounded-full bg-[#D4FF3D] animate-pulse"></div>
            <span className="text-xs text-[#8A8F98]">{t.views.dashboard.currentRunway} :</span>
            <span className="text-xs font-bold text-[#D4FF3D] font-mono">
              {formatDays(displayDays)}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0B0E17] text-[#B8BCC4] border border-[#1e293b] font-mono">
              {t.views.dashboard.liquidBalanceShort} : {formatCurrency(displayBalance)}
            </span>
          </div>

          {/* Right Action Tools: Language/Region + Lock Status + Auth Status */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <LanguageCurrencySelector />

            {/* Quick Secondary Lock status button when enabled */}
            {secondaryAuth.enabled && (
              <button
                type="button"
                id="btn-nav-quick-lock"
                onClick={() => {
                  if (isSecondaryAuthenticated) {
                    lockSensitiveViews();
                  } else {
                    requestUnlock();
                  }
                }}
                title={isSecondaryAuthenticated 
                  ? (t.security?.quickLockTooltip || 'Lock sensitive financial view') 
                  : (t.security?.sessionLocked || 'Session locked')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[38px] sm:min-h-[44px] rounded-xl text-xs font-mono transition-all cursor-pointer border shrink-0 ${
                  isSecondaryAuthenticated
                    ? 'bg-[#161b27] hover:bg-[#1e293b] text-[#D4FF3D] border-[#1e293b] hover:border-[#D4FF3D]/30'
                    : 'bg-[#F43F5E]/15 text-[#FB7185] border-[#F43F5E]/40 animate-pulse'
                }`}
              >
                {isSecondaryAuthenticated ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-[#D4FF3D]" />
                    <span className="hidden lg:inline text-[11px]">{language === 'fr' ? 'Déverrouillé' : 'Unlocked'}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#FB7185]" />
                    <span className="hidden lg:inline text-[11px]">{language === 'fr' ? 'Verrouillé' : 'Locked'}</span>
                  </>
                )}
              </button>
            )}

            {/* User Session / Auth Controls */}
            {currentUser ? (
              <div className="relative flex items-center gap-1.5 shrink-0" ref={userMenuRef}>
                {/* User Capsule Button (Trigger Dropdown) */}
                <button
                  id="btn-nav-user-menu"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 min-h-[38px] sm:min-h-[44px] rounded-2xl text-xs font-medium transition-all cursor-pointer border shrink-0 ${
                    isUserMenuOpen || currentRoute === 'settings'
                      ? 'bg-[#1e293b] text-[#F5F5F0] border-[#D4FF3D]/50 shadow-[0_0_12px_rgba(212,255,61,0.15)]'
                      : 'bg-[#161b27] text-[#F5F5F0] border-[#1e293b] hover:border-[#D4FF3D]/30 hover:bg-[#1a2233]'
                  }`}
                >
                  {/* Avatar with Online Status Dot */}
                  <div className="relative flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-br from-[#D4FF3D]/20 to-[#10B981]/20 border border-[#D4FF3D]/40 text-[#D4FF3D] font-mono font-bold text-[10px] sm:text-[11px] shrink-0">
                    {getUserInitials()}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#10B981] border border-[#0B0E17] ring-1 ring-[#10B981]/40" />
                  </div>

                  {/* Name / Identifier */}
                  <span className="hidden sm:inline max-w-[100px] md:max-w-[120px] truncate font-medium text-[#F5F5F0]">
                    {userProfile?.displayName || currentUser.email?.split('@')[0] || t.common.anonymousUser}
                  </span>

                  <ChevronDown className={`w-3.5 h-3.5 text-[#8A8F98] transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180 text-[#D4FF3D]' : ''}`} />
                </button>

                {/* Direct 1-Click Sign-Out Button */}
                <button
                  id="btn-nav-quick-signout"
                  onClick={() => signOut()}
                  title={t.nav.signOut || 'Déconnexion'}
                  aria-label={t.nav.signOut || 'Déconnexion'}
                  className="min-w-[38px] min-h-[38px] sm:min-w-[44px] sm:min-h-[44px] p-2 sm:p-2.5 rounded-xl bg-[#161b27] text-[#8A8F98] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 border border-[#1e293b] hover:border-[#F43F5E]/40 transition-all cursor-pointer flex items-center justify-center active:scale-95 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {/* User Dropdown Menu */}
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-72 bg-[#161b27] border border-[#1e293b] rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.7)] p-3 z-50 overflow-hidden"
                    >
                      {/* User Account Info Header */}
                      <div className="p-3 rounded-xl bg-[#0B0E17] border border-[#1e293b] mb-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F98]">
                            {language === 'fr' ? 'Compte actif' : 'Active Account'}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1 ${
                            isGuestUser 
                              ? 'bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30'
                              : 'bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30'
                          }`}>
                            <Cloud className="w-2.5 h-2.5" />
                            {isGuestUser ? (language === 'fr' ? 'Invité' : 'Guest') : (language === 'fr' ? 'Synchro Cloud' : 'Cloud Sync')}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-[#F5F5F0] truncate">
                          {userProfile?.displayName || currentUser.email?.split('@')[0] || t.common.anonymousUser}
                        </p>
                        <p className="text-[11px] text-[#8A8F98] font-mono truncate">
                          {currentUser.email || (language === 'fr' ? 'Session locale anonyme' : 'Anonymous local session')}
                        </p>
                      </div>

                      {/* Menu Actions */}
                      <div className="space-y-1">
                        <button
                          id="btn-dropdown-settings"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onNavigate('settings');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-[#F5F5F0] hover:bg-[#0B0E17] transition-all cursor-pointer text-left"
                        >
                          <SettingsIcon className="w-4 h-4 text-[#D4FF3D]" />
                          <span>{t.nav.settings} &amp; {t.common.userProfile || 'Profil'}</span>
                        </button>

                        {secondaryAuth.enabled && (
                          <button
                            id="btn-dropdown-lock"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              lockSensitiveViews();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-[#FB7185] hover:bg-[#F43F5E]/10 transition-all cursor-pointer text-left"
                          >
                            <Lock className="w-4 h-4 text-[#FB7185]" />
                            <span>{language === 'fr' ? 'Verrouiller la session' : 'Lock session'}</span>
                          </button>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-[#1e293b] my-2" />

                      {/* Full Sign-Out Action Button */}
                      <button
                        id="btn-dropdown-signout"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25 text-[#FB7185] border border-[#F43F5E]/30 text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t.nav.signOut || 'Se déconnecter'}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Enhanced Log In / Connexion Button - Visible & optimized on Mobile */
              <button
                id="btn-nav-open-auth"
                onClick={() => setShowAuthModal(true)}
                className="group relative flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 min-h-[38px] sm:min-h-[44px] rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all duration-200 shadow-[0_0_16px_rgba(212,255,61,0.25)] hover:shadow-[0_0_24px_rgba(212,255,61,0.4)] cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                <span className="tracking-wide">{t.nav.signIn || (language === 'fr' ? 'Connexion' : 'Sign In')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};

