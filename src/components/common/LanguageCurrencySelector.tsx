import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { SupportedLanguage, SupportedCurrency, SupportedRegion } from '../../types';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LanguageCurrencySelector: React.FC = () => {
  const { language, setLanguage, currency, setCurrency, region, setRegion, t } = useTranslation();
  const { updateUserProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const languages: { code: SupportedLanguage; label: string; flag: string }[] = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'pt', label: 'Português', flag: '🇧🇷' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  ];

  const regions: { code: SupportedRegion; label: string; defaultCurrency: SupportedCurrency }[] = [
    { code: 'FR', label: 'France (EUR €)', defaultCurrency: 'EUR' },
    { code: 'US', label: 'United States (USD $)', defaultCurrency: 'USD' },
    { code: 'ES', label: 'España (EUR €)', defaultCurrency: 'EUR' },
    { code: 'BR', label: 'Brasil (BRL R$)', defaultCurrency: 'BRL' },
    { code: 'IN', label: 'India (INR ₹)', defaultCurrency: 'INR' },
    { code: 'GB', label: 'United Kingdom (GBP £)', defaultCurrency: 'GBP' },
    { code: 'CA', label: 'Canada (CAD $)', defaultCurrency: 'CAD' },
    { code: 'CH', label: 'Suisse (CHF CHF)', defaultCurrency: 'CHF' },
    { code: 'BE', label: 'Belgique (EUR €)', defaultCurrency: 'EUR' },
  ];

  const handleSelectLanguage = (lang: SupportedLanguage) => {
    setLanguage(lang);
    updateUserProfile({ preferredLanguage: lang });
  };

  const handleSelectRegion = (reg: SupportedRegion) => {
    setRegion(reg);
    const matched = regions.find((r) => r.code === reg);
    if (matched) {
      setCurrency(matched.defaultCurrency);
      updateUserProfile({ region: reg, currency: matched.defaultCurrency });
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        id="btn-lang-currency-selector"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 min-h-[38px] sm:min-h-[44px] rounded-full bg-[#161b27] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-xs font-medium text-[#F5F5F0] transition-all cursor-pointer shadow-sm shrink-0"
        title="Change Language & Region"
      >
        <Globe className="w-3.5 h-3.5 text-[#D4FF3D] shrink-0" />
        <span className="uppercase font-bold text-[#D4FF3D]">{language}</span>
        <span className="text-[#8A8F98] text-[10px] hidden xs:inline">|</span>
        <span className="hidden xs:inline text-[#B8BCC4]">{currency}</span>
        <ChevronDown className="w-3 h-3 text-[#8A8F98] shrink-0 hidden sm:inline" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div 
            id="popover-lang-currency"
            className="absolute right-0 mt-2 w-64 p-3.5 bg-[#161b27] border border-[#1e293b] rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Language Selection */}
            <div className="mb-3">
              <div className="text-[10px] font-bold text-[#8A8F98] uppercase tracking-[0.2em] mb-2">
                {t.common.language}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    id={`btn-select-lang-${lang.code}`}
                    onClick={() => {
                      handleSelectLanguage(lang.code);
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      language === lang.code
                        ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-sm'
                        : 'bg-[#0B0E17] text-[#B8BCC4] hover:bg-[#1e293b] border border-[#1e293b]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                    {language === lang.code && <Check className="w-3.5 h-3.5 text-[#0B0E17] stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Region / Currency */}
            <div>
              <div className="text-[10px] font-bold text-[#8A8F98] uppercase tracking-[0.2em] mb-2">
                {t.common.region} & {t.common.currency}
              </div>
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                {regions.map((reg) => (
                  <button
                    key={reg.code}
                    id={`btn-select-region-${reg.code}`}
                    onClick={() => {
                      handleSelectRegion(reg.code);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-xs transition-all text-left cursor-pointer ${
                      region === reg.code
                        ? 'bg-[#D4FF3D]/15 text-[#D4FF3D] border border-[#D4FF3D]/40 font-semibold'
                        : 'bg-[#0B0E17] text-[#B8BCC4] hover:bg-[#1e293b] border border-[#1e293b]/60'
                    }`}
                  >
                    <span>{reg.label}</span>
                    {region === reg.code && <Check className="w-3.5 h-3.5 text-[#D4FF3D]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
