import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { SupportedLanguage, SupportedCurrency, SupportedRegion } from '../types';
import { fr } from './locales/fr';
import { en } from './locales/en';
import { es } from './locales/es';
import { pt } from './locales/pt';
import { hi } from './locales/hi';

type TranslationType = typeof fr;

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  currency: SupportedCurrency;
  setCurrency: (curr: SupportedCurrency) => void;
  region: SupportedRegion;
  setRegion: (reg: SupportedRegion) => void;
  t: TranslationType;
  formatCurrency: (amount: number) => string;
  formatNumber: (amount: number) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatDays: (days: number) => string;
  formatDaysShort: (days: number) => string;
}

const translations: Record<SupportedLanguage, TranslationType> = {
  fr,
  en,
  es,
  pt,
  hi,
};

const getRegionalLocale = (region: SupportedRegion, language: SupportedLanguage): string => {
  if (language === 'fr') {
    switch (region) {
      case 'CA': return 'fr-CA';
      case 'BE': return 'fr-BE';
      case 'CH': return 'fr-CH';
      case 'FR':
      default:
        return 'fr-FR';
    }
  } else if (language === 'es') {
    return 'es-ES';
  } else if (language === 'pt') {
    return 'pt-BR';
  } else if (language === 'hi') {
    return 'hi-IN';
  } else {
    // English language
    switch (region) {
      case 'GB': return 'en-GB';
      case 'CA': return 'en-CA';
      case 'IN': return 'en-IN';
      case 'US':
      default:
        return 'en-US';
    }
  }
};

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_LANG_KEY = 'neyrunway_preferred_language';
const STORAGE_CURRENCY_KEY = 'neyrunway_preferred_currency';
const STORAGE_REGION_KEY = 'neyrunway_preferred_region';

function detectBrowserLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'fr';
  const navLang = navigator.language?.toLowerCase() || 'fr';
  if (navLang.startsWith('fr')) return 'fr';
  if (navLang.startsWith('es')) return 'es';
  if (navLang.startsWith('pt')) return 'pt';
  if (navLang.startsWith('hi')) return 'hi';
  return 'en';
}

function detectDefaultRegion(_lang?: SupportedLanguage): SupportedRegion {
  return 'FR';
}

function detectDefaultCurrency(region: SupportedRegion): SupportedCurrency {
  switch (region) {
    case 'FR':
    case 'BE':
      return 'EUR';
    case 'US':
      return 'USD';
    case 'CA':
      return 'CAD';
    case 'GB':
      return 'GBP';
    case 'CH':
      return 'CHF';
    case 'BR':
      return 'BRL';
    case 'IN':
      return 'INR';
    case 'ES':
      return 'EUR';
    default:
      return 'EUR';
  }
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem(STORAGE_LANG_KEY) as SupportedLanguage;
    if (saved && (saved === 'fr' || saved === 'en' || saved === 'es' || saved === 'pt' || saved === 'hi')) return saved;
    return detectBrowserLanguage();
  });

  const [region, setRegionState] = useState<SupportedRegion>(() => {
    const saved = localStorage.getItem(STORAGE_REGION_KEY) as SupportedRegion;
    if (saved) return saved;
    return detectDefaultRegion(language);
  });

  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => {
    const saved = localStorage.getItem(STORAGE_CURRENCY_KEY) as SupportedCurrency;
    if (saved) return saved;
    return detectDefaultCurrency(region);
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_LANG_KEY, lang);
  };

  const setRegion = (reg: SupportedRegion) => {
    setRegionState(reg);
    localStorage.setItem(STORAGE_REGION_KEY, reg);
    const suggestedCurrency = detectDefaultCurrency(reg);
    setCurrencyState(suggestedCurrency);
    localStorage.setItem(STORAGE_CURRENCY_KEY, suggestedCurrency);
  };

  const setCurrency = (curr: SupportedCurrency) => {
    setCurrencyState(curr);
    localStorage.setItem(STORAGE_CURRENCY_KEY, curr);
  };

  const formatCurrency = (amount: number): string => {
    const locale = getRegionalLocale(region, language);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (amount: number): string => {
    const locale = getRegionalLocale(region, language);
    return new Intl.NumberFormat(locale).format(amount);
  };

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const locale = getRegionalLocale(region, language);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    return new Intl.DateTimeFormat(locale, options || defaultOptions).format(d);
  };

  const formatTime = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const locale = getRegionalLocale(region, language);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };
    return new Intl.DateTimeFormat(locale, options || defaultOptions).format(d);
  };

  const formatDays = (days: number): string => {
    if (language === 'fr') {
      return `${days} ${days > 1 ? 'jours' : 'jour'}`;
    }
    if (language === 'es') {
      return `${days} ${days > 1 ? 'días' : 'día'}`;
    }
    if (language === 'pt') {
      return `${days} ${days > 1 ? 'dias' : 'dia'}`;
    }
    if (language === 'hi') {
      return `${days} दिन`;
    }
    return `${days} ${days > 1 ? 'days' : 'day'}`;
  };

  const formatDaysShort = (days: number): string => {
    if (language === 'fr') return `${days}j`;
    if (language === 'es') return `${days}d`;
    if (language === 'pt') return `${days}d`;
    if (language === 'hi') return `${days}d`;
    return `${days}d`;
  };

  const t = useMemo(() => translations[language] || translations.fr, [language]);

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        currency,
        setCurrency,
        region,
        setRegion,
        t,
        formatCurrency,
        formatNumber,
        formatDate,
        formatTime,
        formatDays,
        formatDaysShort,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
