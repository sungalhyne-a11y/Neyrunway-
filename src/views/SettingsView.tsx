import React, { useState } from 'react';
import { ViewSkeleton } from '../components/skeleton/ViewSkeleton';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { SupportedLanguage, SupportedCurrency, SupportedRegion } from '../types';
import { Database, ShieldCheck, User, Globe, Coins, MapPin, Sparkles, Check, LogIn, LogOut, Target, Lock, Cloud, KeyRound, Shield, Trash2, CheckCircle2 } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { SecuritySettingsCard } from '../components/settings/SecuritySettingsCard';
import { AuthModal } from '../components/auth/AuthModal';
import { analytics } from '../lib/analytics';

export const SettingsView: React.FC = () => {
  const { language, setLanguage, currency, setCurrency, region, setRegion, t } = useTranslation();
  const { currentUser, userProfile, signInGuest, signInWithGoogle, signOut, updateUserProfile } = useAuth();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(analytics.isTrackingAllowed());
  const [clearedAnalyticsNotice, setClearedAnalyticsNotice] = useState<boolean>(false);

  const languages: { code: SupportedLanguage; label: string }[] = [
    { code: 'fr', label: 'Français (FR)' },
    { code: 'en', label: 'English (EN)' },
    { code: 'es', label: 'Español (ES)' },
    { code: 'pt', label: 'Português (PT/BR)' },
    { code: 'hi', label: 'हिन्दी (HI)' },
  ];

  const currencies: { code: SupportedCurrency; label: string }[] = [
    { code: 'EUR', label: 'Euro (€ EUR)' },
    { code: 'USD', label: 'US Dollar ($ USD)' },
    { code: 'CAD', label: 'Canadian Dollar ($ CAD)' },
    { code: 'GBP', label: 'British Pound (£ GBP)' },
    { code: 'CHF', label: 'Swiss Franc (CHF)' },
    { code: 'BRL', label: 'Real Brésilien (R$ BRL)' },
    { code: 'INR', label: 'Roupie Indienne (₹ INR)' },
  ];

  const regions: { code: SupportedRegion; label: string }[] = [
    { code: 'FR', label: 'France (Format 24h / Virgule / EUR)' },
    { code: 'US', label: 'United States (12h / Decimal dot / USD)' },
    { code: 'CA', label: 'Canada (CAD)' },
    { code: 'GB', label: 'United Kingdom (GBP)' },
    { code: 'BE', label: 'Belgique (EUR)' },
    { code: 'CH', label: 'Suisse (CHF)' },
    { code: 'ES', label: 'España (EUR)' },
    { code: 'BR', label: 'Brasil (BRL)' },
    { code: 'IN', label: 'India (INR)' },
  ];

  const handleLanguageChange = (l: SupportedLanguage) => {
    setLanguage(l);
    updateUserProfile({ preferredLanguage: l });
    triggerSuccess();
  };

  const handleCurrencyChange = (c: SupportedCurrency) => {
    setCurrency(c);
    updateUserProfile({ currency: c });
    triggerSuccess();
  };

  const handleRegionChange = (r: SupportedRegion) => {
    setRegion(r);
    updateUserProfile({ region: r });
    triggerSuccess();
  };

  const handleToggleAnalytics = (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    analytics.setConsent(enabled ? 'granted' : 'denied');
    triggerSuccess();
  };

  const handleClearAnalyticsData = () => {
    analytics.clearAllAnalyticsData();
    setClearedAnalyticsNotice(true);
    setTimeout(() => setClearedAnalyticsNotice(false), 3000);
  };

  const triggerSuccess = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <ViewSkeleton
      title={t.views.settings.title}
      subtitle={t.views.settings.subtitle}
      badgeText={t.views.settings.badgeText}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Localization & Preferences */}
        <div className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#D4FF3D]/10 text-[#D4FF3D] border border-[#D4FF3D]/20 shadow-[0_0_10px_rgba(212,255,61,0.2)]">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#F5F5F0]">
                {t.views.settings.regionalPreferencesTitle}
              </h3>
            </div>
            {saveSuccess && (
              <span className="text-[11px] text-[#D4FF3D] font-mono flex items-center gap-1">
                <Check className="w-3 h-3" />
                {t.views.settings.updatedBadge}
              </span>
            )}
          </div>

          {/* Language Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8A8F98]">
              {t.views.settings.language}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {languages.map((l) => (
                <button
                  key={l.code}
                  id={`settings-lang-${l.code}`}
                  onClick={() => handleLanguageChange(l.code)}
                  className={`py-2.5 px-3.5 rounded-2xl text-xs font-medium transition-all text-left flex items-center justify-between cursor-pointer ${
                    language === l.code
                      ? 'bg-[#D4FF3D]/15 text-[#D4FF3D] border border-[#D4FF3D]/40 font-semibold shadow-sm'
                      : 'bg-[#0B0E17] text-[#B8BCC4] border border-[#1e293b] hover:bg-[#161b27]'
                  }`}
                >
                  <span>{l.label}</span>
                  {language === l.code && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8A8F98] flex items-center gap-1.5 font-mono">
              <Coins className="w-3.5 h-3.5 text-[#D4FF3D]" />
              <span>{t.views.settings.currency}</span>
            </label>
            <select
              id="settings-currency-select"
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value as SupportedCurrency)}
              className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]/50 cursor-pointer"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#0B0E17] text-[#F5F5F0]">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#8A8F98] flex items-center gap-1.5 font-mono">
              <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>{t.views.settings.region}</span>
            </label>
            <select
              id="settings-region-select"
              value={region}
              onChange={(e) => handleRegionChange(e.target.value as SupportedRegion)}
              className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]/50 cursor-pointer"
            >
              {regions.map((r) => (
                <option key={r.code} value={r.code} className="bg-[#0B0E17] text-[#F5F5F0]">
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly Budget Goal */}
          <div className="space-y-2 pt-2 border-t border-[#1e293b]">
            <label className="text-xs font-semibold text-[#8A8F98] flex items-center justify-between font-mono">
              <span className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#D4FF3D]" />
                <span>{language === 'fr' ? 'Plafond Budget Mensuel' : 'Monthly Budget Goal'}</span>
              </span>
              <span className="text-[10px] text-[#8A8F98]">
                {language === 'fr' ? 'Seuil d\'alerte toast' : 'Toast warning limit'}
              </span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  step="10"
                  defaultValue={userProfile?.monthlyBudgetGoal || (region === 'CH' ? 1000 : region === 'US' ? 900 : region === 'GB' ? 750 : 550)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      updateUserProfile({ monthlyBudgetGoal: val });
                      triggerSuccess();
                    }
                  }}
                  className="w-full bg-[#0B0E17] border border-[#1e293b] rounded-2xl px-4 py-2.5 text-xs font-mono text-[#F5F5F0] focus:outline-none focus:border-[#D4FF3D]/50"
                  placeholder="e.g. 500"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-[#8A8F98] font-mono">
                  {currency}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#8A8F98]">
              {language === 'fr' 
                ? 'Une notification toast vous prévient dès que vos dépenses mensuelles dépassent ce plafond.' 
                : 'A toast warning appears whenever monthly spending exceeds this target.'}
            </p>
          </div>
        </div>

        {/* Firebase & Account Status */}
        <div className="bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-[#1e293b]">
            <div className="p-2.5 rounded-xl bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F5F5F0]">
                {t.views.settings.firebaseStatus}
              </h3>
              <p className="text-[11px] text-[#8A8F98]">
                Cloud Firestore & Firebase Auth
              </p>
            </div>
          </div>

          {/* Connection status badges */}
          <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#8A8F98]">{t.views.settings.firebaseProject} :</span>
              <span className="text-[#F5F5F0] font-mono font-medium">{firebaseConfig.projectId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8A8F98]">{t.views.settings.firestoreDatabase} :</span>
              <span className="text-[#D4FF3D] font-mono text-[11px]">{firebaseConfig.firestoreDatabaseId || 'default'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8A8F98]">{t.views.settings.securityRules} :</span>
              <span className="text-[#D4FF3D] font-medium flex items-center gap-1 font-mono text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t.views.settings.securityRulesStrict}
              </span>
            </div>
          </div>

          {/* User Account / Session */}
          <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8F98] font-mono">
                <User className="w-3.5 h-3.5 text-[#D4FF3D]" />
                <span>{t.views.settings.userSession}</span>
              </div>
              {currentUser && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1 ${
                  currentUser.isAnonymous 
                    ? 'bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30' 
                    : 'bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30'
                }`}>
                  <Cloud className="w-2.5 h-2.5" />
                  {currentUser.isAnonymous ? (language === 'fr' ? 'Invité' : 'Guest') : (language === 'fr' ? 'Synchro Cloud' : 'Cloud Sync')}
                </span>
              )}
            </div>

            {currentUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#161b27] border border-[#1e293b]">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4FF3D]/20 to-[#10B981]/20 border border-[#D4FF3D]/40 flex items-center justify-center text-[#D4FF3D] font-mono font-bold text-xs shrink-0">
                    {userProfile?.displayName ? userProfile.displayName.slice(0, 2).toUpperCase() : (currentUser.email ? currentUser.email.slice(0, 2).toUpperCase() : 'ET')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#F5F5F0] truncate">
                      {userProfile?.displayName || currentUser.email?.split('@')[0] || t.common.anonymousUser}
                    </p>
                    <p className="text-[11px] text-[#8A8F98] font-mono truncate">
                      {currentUser.email || t.views.settings.guestSessionActive}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-[#8A8F98]">UID :</span>
                    <span className="font-mono text-[#F5F5F0] text-[10px] bg-[#161b27] px-2 py-0.5 rounded border border-[#1e293b]">{currentUser.uid}</span>
                  </div>
                </div>

                <button
                  id="btn-settings-sign-out"
                  onClick={signOut}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25 text-[#FB7185] border border-[#F43F5E]/30 text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t.nav.signOut}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#8A8F98] leading-relaxed">
                  {t.views.settings.noSessionNotice}
                </p>
                <div className="space-y-2">
                  <button
                    id="btn-settings-open-auth-modal"
                    onClick={() => setShowAuthModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_12px_rgba(212,255,61,0.2)] cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{language === 'fr' ? 'Se connecter / S\'inscrire' : 'Sign In / Sign Up'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="btn-settings-guest-login"
                      onClick={signInGuest}
                      className="py-2 px-3 rounded-xl bg-[#161b27] hover:bg-[#1e293b] text-[#B8BCC4] hover:text-[#F5F5F0] border border-[#1e293b] text-[11px] font-medium transition-all cursor-pointer text-center"
                    >
                      {t.views.settings.startGuest}
                    </button>
                    <button
                      id="btn-settings-google-login"
                      onClick={signInWithGoogle}
                      className="py-2 px-3 rounded-xl bg-[#161b27] hover:bg-[#1e293b] text-[#B8BCC4] hover:text-[#F5F5F0] border border-[#1e293b] text-[11px] font-medium transition-all cursor-pointer text-center"
                    >
                      Google
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Authentication & Biometrics */}
        <div className="md:col-span-2">
          <SecuritySettingsCard onNotifySuccess={triggerSuccess} />
        </div>

        {/* Privacy & RGPD Analytics Card */}
        <div className="md:col-span-2 bg-[#161b27] border border-[#1e293b] rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F5F5F0]">
                  {language === 'fr' ? 'Confidentialité & Données d\'Usage (RGPD / Privacy)' : 'Privacy & Usage Analytics (GDPR)'}
                </h3>
                <p className="text-[11px] text-[#8A8F98]">
                  {language === 'fr' 
                    ? 'Architecture Zero-PII — Vos données financières ne quittent jamais votre terminal' 
                    : 'Zero-PII Architecture — Your financial telemetry never leaves your device'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30">
              {language === 'fr' ? 'Local Only' : 'Local Only'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tracking Toggle */}
            <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <p className="text-xs font-bold text-[#F5F5F0]">
                  {language === 'fr' ? 'Télémétrie des parcours produit' : 'Product Journey Telemetry'}
                </p>
                <p className="text-[11px] text-[#8A8F98] leading-relaxed">
                  {language === 'fr' 
                    ? 'Comptage local des étapes franchies (onboarding, calculs). Stocké à 100% dans le navigateur.' 
                    : 'Local milestone counts (onboarding, calculations). Stored 100% locally in browser.'}
                </p>
              </div>
              <button
                type="button"
                id="toggle-analytics-consent"
                onClick={() => handleToggleAnalytics(!analyticsEnabled)}
                className={`min-w-[48px] h-7 rounded-full p-1 transition-colors cursor-pointer flex items-center shrink-0 ${
                  analyticsEnabled ? 'bg-[#D4FF3D]' : 'bg-[#1e293b]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-[#0B0E17] transition-transform ${
                    analyticsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Clear Data Button */}
            <div className="p-4 rounded-2xl bg-[#0B0E17] border border-[#1e293b] flex flex-col justify-between space-y-3">
              <div>
                <p className="text-xs font-bold text-[#F5F5F0]">
                  {language === 'fr' ? 'Suppression des données d\'usage' : 'Purge Usage Telemetry'}
                </p>
                <p className="text-[11px] text-[#8A8F98]">
                  {language === 'fr'
                    ? 'Efface immédiatement tous les journaux d\'événements et jalons locaux.'
                    : 'Immediately clears all event logs and milestone records from local storage.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="btn-clear-analytics-data"
                  onClick={handleClearAnalyticsData}
                  className="px-4 py-2 rounded-xl bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25 text-[#FB7185] border border-[#F43F5E]/30 text-xs font-semibold font-mono flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'Supprimer mes données d\'usage' : 'Delete my usage data'}</span>
                </button>
                {clearedAnalyticsNotice && (
                  <span className="text-[11px] text-[#34D399] font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {language === 'fr' ? 'Données effacées' : 'Data cleared'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </ViewSkeleton>
  );
};
