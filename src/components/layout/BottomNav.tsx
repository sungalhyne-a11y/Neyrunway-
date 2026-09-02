import React from 'react';
import { AppRoute } from '../../types';
import { useTranslation } from '../../i18n';
import { LayoutDashboard, MessageSquare, Brain, Target, Compass, Settings } from 'lucide-react';

interface BottomNavProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentRoute, onNavigate }) => {
  const { t } = useTranslation();

  const navItems: { id: AppRoute; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: t.nav.dashboard, shortLabel: t.nav.dashboardShort, icon: LayoutDashboard },
    { id: 'chat', label: t.brand.copilotName, shortLabel: t.nav.chatShort, icon: MessageSquare },
    { id: 'transactions', label: t.nav.transactions, shortLabel: t.nav.transactionsShort, icon: Brain },
    { id: 'goals', label: t.nav.goals, shortLabel: t.nav.goalsShort, icon: Target },
    { id: 'resources', label: t.nav.resources, shortLabel: t.nav.resourcesShort, icon: Compass },
    { id: 'settings', label: t.nav.settings, shortLabel: t.nav.settingsShort, icon: Settings },
  ];

  return (
    <nav 
      id="bottom-navigation-bar"
      className="bottom-nav-container md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0E17]/95 backdrop-blur-xl border-t border-[#1e293b] px-1 py-1 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-between w-full max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              className={`flex-1 flex flex-col items-center justify-center min-h-[48px] min-w-0 py-1 px-0.5 min-[340px]:px-2 md:px-4 rounded-xl transition-all cursor-pointer relative active:scale-95 ${
                isActive 
                  ? 'text-[#D4FF3D]' 
                  : 'text-[#8A8F98] hover:text-[#F5F5F0]'
              }`}
            >
              <div className={`relative p-1 rounded-lg transition-all flex items-center justify-center ${
                isActive ? 'bg-[#D4FF3D]/15' : 'hover:bg-[#161b27]'
              }`}>
                <Icon className="w-5 h-5 shrink-0" />
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#D4FF3D] shadow-[0_0_6px_#D4FF3D]" />
                )}
              </div>
              <span className="hidden min-[340px]:block text-[10px] tracking-tight mt-0.5 font-medium whitespace-nowrap text-center leading-tight">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
