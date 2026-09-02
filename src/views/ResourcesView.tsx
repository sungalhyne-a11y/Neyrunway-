import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { getRegionalResources } from '../data/studentResources';
import { StudentResource, SupportedRegion, ResourceCategory } from '../types';
import { 
  Compass, 
  ExternalLink, 
  Sparkles, 
  GraduationCap, 
  Home, 
  Utensils, 
  Bus, 
  AlertTriangle, 
  Tag, 
  Globe, 
  ShieldCheck, 
  MessageSquare,
  Search,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';

export const ResourcesView: React.FC<{ onNavigateToChat?: (initialQuery?: string) => void }> = ({ onNavigateToChat }) => {
  const { t, region, setRegion, language } = useTranslation();
  const { userProfile } = useAuth();

  const [selectedRegion, setSelectedRegion] = useState<SupportedRegion>(() => {
    return (userProfile?.region as SupportedRegion) || region || 'FR';
  });
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Keep selected region in sync when region preference is explicitly changed
  useEffect(() => {
    if (region && region !== selectedRegion) {
      setSelectedRegion(region);
    }
  }, [region]);

  const regionalList: StudentResource[] = getRegionalResources(selectedRegion, language);

  const filteredResources = regionalList.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: ResourceCategory) => {
    switch (category) {
      case 'grant': return GraduationCap;
      case 'aid': return Home;
      case 'food': return Utensils;
      case 'transport': return Bus;
      case 'emergency': return AlertTriangle;
      default: return Tag;
    }
  };

  const getCategoryBadgeClass = (category: ResourceCategory) => {
    switch (category) {
      case 'grant': return 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30';
      case 'aid': return 'bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30';
      case 'food': return 'bg-[#D4FF3D]/15 text-[#D4FF3D] border-[#D4FF3D]/30';
      case 'transport': return 'bg-[#FACC15]/15 text-[#FACC15] border-[#FACC15]/30';
      case 'emergency': return 'bg-[#F43F5E]/15 text-[#F43F5E] border-[#F43F5E]/30';
      default: return 'bg-[#8A8F98]/15 text-[#F5F5F0] border-[#1e293b]';
    }
  };

  const regionsList: { code: SupportedRegion; label: string; flag: string }[] = [
    { code: 'FR', label: 'France', flag: '🇫🇷' },
    { code: 'BE', label: language === 'fr' ? 'Belgique' : 'Belgium', flag: '🇧🇪' },
    { code: 'CH', label: language === 'fr' ? 'Suisse' : 'Switzerland', flag: '🇨🇭' },
    { code: 'CA', label: 'Canada', flag: '🇨🇦' },
    { code: 'US', label: language === 'fr' ? 'États-Unis' : 'United States', flag: '🇺🇸' },
    { code: 'GB', label: language === 'fr' ? 'Royaume-Uni' : 'United Kingdom', flag: '🇬🇧' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#D4FF3D] text-[11px] font-bold tracking-[0.15em] uppercase font-mono px-2 py-0.5 rounded-md bg-[#D4FF3D]/10 border border-[#D4FF3D]/20">
              {t.views.resources.badge}
            </span>
            <span className="text-xs text-[#8A8F98] font-mono">
              • Firestore Schema: resources/{selectedRegion}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-[#F5F5F0]">
            {t.views.resources.title}
          </h2>
          <p className="text-xs md:text-sm text-[#8A8F98] mt-1 max-w-2xl">
            {t.views.resources.subtitle}
          </p>
        </div>

        {/* Region Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#161b27] border border-[#1e293b] rounded-full self-start sm:self-auto overflow-x-auto max-w-full">
          {regionsList.map((r) => (
            <button
              key={r.code}
              id={`btn-resource-region-${r.code}`}
              onClick={() => {
                setSelectedRegion(r.code);
                setRegion(r.code);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                selectedRegion === r.code
                  ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold shadow-[0_0_12px_rgba(212,255,61,0.25)]'
                  : 'text-[#8A8F98] hover:text-[#F5F5F0]'
              }`}
            >
              <span>{r.flag}</span>
              <span>{r.code}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Firestore V2 Structure Notice Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#161b27] border border-[#1e293b] flex items-start gap-3.5 shadow-xl">
        <div className="p-2.5 rounded-2xl bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20 shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs sm:text-sm font-semibold text-[#F5F5F0] flex items-center gap-2">
            <span>{t.views.resources.structureTitle}</span>
            <span className="text-[10px] text-[#D4FF3D] font-mono font-bold bg-[#D4FF3D]/10 px-2 py-0.5 rounded-md border border-[#D4FF3D]/20">
              {t.views.resources.readyForProduction}
            </span>
          </h4>
          <p className="text-xs text-[#8A8F98] leading-relaxed">
            {t.views.resources.firestoreStructureNotice}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold'
                : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
            }`}
          >
            {t.views.resources.categories.all}
          </button>
          <button
            onClick={() => setSelectedCategory('grant')}
            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'grant'
                ? 'bg-[#38BDF8] text-[#0B0E17] font-bold'
                : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
            }`}
          >
            {t.views.resources.categories.grant}
          </button>
          <button
            onClick={() => setSelectedCategory('aid')}
            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'aid'
                ? 'bg-[#A855F7] text-[#0B0E17] font-bold'
                : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
            }`}
          >
            {t.views.resources.categories.aid}
          </button>
          <button
            onClick={() => setSelectedCategory('food')}
            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'food'
                ? 'bg-[#D4FF3D] text-[#0B0E17] font-bold'
                : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
            }`}
          >
            {t.views.resources.categories.food}
          </button>
          <button
            onClick={() => setSelectedCategory('transport')}
            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'transport'
                ? 'bg-[#FACC15] text-[#0B0E17] font-bold'
                : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
            }`}
          >
            {t.views.resources.categories.transport}
          </button>
          <button
            onClick={() => setSelectedCategory('emergency')}
            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === 'emergency'
                ? 'bg-[#F43F5E] text-[#F5F5F0] font-bold'
                : 'bg-[#161b27] text-[#8A8F98] hover:text-[#F5F5F0] border border-[#1e293b]'
            }`}
          >
            {t.views.resources.categories.emergency}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-[#8A8F98] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.views.resources.searchPlaceholder || "Search for grants, public aid..."}
            className="w-full bg-[#161b27] border border-[#1e293b] rounded-full pl-9 pr-4 py-1.5 text-xs text-[#F5F5F0] placeholder:text-[#8A8F98] focus:outline-none focus:border-[#D4FF3D]"
          />
        </div>
      </div>

      {/* Resources Cards Grid */}
      <div 
        id="resources-discovery-grid"
        className="grid grid-cols-1 md:grid-cols-2 gap-5"
      >
        {filteredResources.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-3xl bg-[#161b27] border border-[#1e293b] space-y-3">
            <Compass className="w-8 h-8 text-[#8A8F98] mx-auto" />
            <h4 className="text-sm font-semibold text-[#F5F5F0]">
              {t.views.resources.emptyForRegion}
            </h4>
          </div>
        ) : (
          filteredResources.map((res) => {
            const Icon = getCategoryIcon(res.category);
            const badgeClass = getCategoryBadgeClass(res.category);
            const categoryLabel = (t.views.resources.categories as Record<string, string>)[res.category] || res.category;

            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-3xl bg-[#161b27] border border-[#1e293b] flex flex-col justify-between space-y-5 shadow-xl relative group hover:border-[#D4FF3D]/30 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-2xl border ${badgeClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8A8F98] font-mono block">
                          {res.provider}
                        </span>
                        <h3 className="text-sm sm:text-base font-semibold text-[#F5F5F0]">
                          {res.title}
                        </h3>
                      </div>
                    </div>

                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-bold uppercase tracking-wider ${badgeClass}`}>
                      {categoryLabel}
                    </span>
                  </div>

                  <p className="text-xs text-[#8A8F98] leading-relaxed">
                    {res.description}
                  </p>

                  {res.estimatedValue && (
                    <div className="p-3 rounded-2xl bg-[#0B0E17] border border-[#1e293b] space-y-1">
                      <div className="text-[10px] text-[#8A8F98] font-mono uppercase tracking-wider">
                        {t.views.resources.estimatedValueLabel}
                      </div>
                      <div className="text-xs font-bold text-[#D4FF3D] font-mono">
                        {res.estimatedValue}
                      </div>
                    </div>
                  )}

                  {res.eligibility && (
                    <div className="text-[11px] text-[#B8BCC4] bg-[#0B0E17]/60 p-2.5 rounded-xl border border-[#1e293b]/60">
                      <strong className="text-[#8A8F98]">{t.views.resources.eligibilityLabel}</strong> {res.eligibility}
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {res.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#0B0E17] text-[#8A8F98] border border-[#1e293b]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  {res.url && (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-[#0B0E17] hover:bg-[#121722] text-[#F5F5F0] hover:text-[#D4FF3D] border border-[#1e293b] hover:border-[#D4FF3D]/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>{t.views.resources.officialPortal}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => {
                      if (onNavigateToChat) {
                        const promptTemplate = t.views.resources.askNeyAboutAidPrompt || 'Could you explain how the "{title}" aid ({provider}) works for my student status in {region} and its impact on my runway?';
                        const query = promptTemplate
                          .replace('{title}', res.title)
                          .replace('{provider}', res.provider)
                          .replace('{region}', selectedRegion);
                        onNavigateToChat(query);
                      }
                    }}
                    title={t.views.resources.suggestAidToNey}
                    className="p-2.5 rounded-2xl bg-[#D4FF3D]/10 hover:bg-[#D4FF3D]/20 text-[#D4FF3D] border border-[#D4FF3D]/30 transition-all cursor-pointer shrink-0"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
