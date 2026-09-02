import React, { useState } from 'react';
import { AppRoute } from '../../types';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Brain, 
  Target, 
  Compass, 
  Settings, 
  Lock, 
  LogIn, 
  LogOut, 
  User, 
  Cloud 
} from 'lucide-react';
import { AuthModal } from '../auth/AuthModal';

interface SidebarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate }) => {
  const { t, language } = useTranslation();
  const { 
    currentUser, 
    userProfile, 
    signOut, 
    secondaryAuth, 
    isSecondaryAuthenticated, 
    isRouteSensitive 
  } = useAuth();
  
  const [showAuthModal, setShowAuthModal] = useState(false);

  const navItems: { id: AppRoute; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'chat', label: t.brand.copilotName, icon: MessageSquare, badge: 'AI' },
    { id: 'transactions', label: t.nav.transactions, icon: Brain },
    { id: 'goals', label: t.nav.goals, icon: Target },
    { id: 'resources', label: t.nav.resources, icon: Compass, badge: 'V2' },
    { id: 'settings', label: t.nav.settings, icon: Settings },
  ];

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
      <aside 
        id="desktop-sidebar"
        className="hidden md:flex flex-col justify-between w-64 lg:w-72 shrink-0 bg-[#0B0E17] border-r border-[#1e293b] p-6 lg:p-7 min-h-[calc(100vh-80px)]"
      >
        <div className="space-y-6">
          {/* Navigation Section */}
          <div>
            <h3 className="text-[10px] text-[#8A8F98] uppercase tracking-[0.3em] font-bold mb-3.5 px-1">
              Menu
            </h3>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentRoute === item.id;
                return (
                  <button
                    key={item.id}
                    id={`sidebar-nav-${item.id}`}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#161b27] text-[#D4FF3D] border border-[#1e293b] shadow-sm'
                        : 'text-[#8A8F98] hover:text-[#F5F5F0] hover:bg-[#161b27]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-1.5 h-1.5 rounded-full transition-all ${isActive ? 'bg-[#D4FF3D] shadow-[0_0_8px_rgba(212,255,61,0.8)]' : 'bg-transparent'}`} />
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#D4FF3D]' : 'text-[#8A8F98]'}`} />
                      <span className="tracking-wide">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {secondaryAuth.enabled && isRouteSensitive(item.id) && !isSecondaryAuthenticated && (
                        <span title="Protégé par PIN / Biométrie" className="p-1 rounded-md bg-[#F43F5E]/15 text-[#FB7185] border border-[#F43F5E]/30">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}

                      {item.badge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                          isActive 
                            ? 'bg-[#D4FF3D]/20 text-[#D4FF3D]' 
                            : 'bg-[#1e293b] text-[#8A8F98]'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Mental Model Blueprint */}
          <div className="p-3.5 rounded-2xl bg-[#161b27] border border-[#1e293b]">
            <div className="text-[10px] font-bold text-[#D4FF3D] uppercase tracking-[0.2em] mb-1">
              {t.brand.philosophies.aiAdvises}
            </div>
            <p className="text-[11px] text-[#8A8F98] leading-relaxed mb-2.5">
              {t.brand.signature}
            </p>
            <div className="text-[9px] text-[#B8BCC4] font-mono bg-[#0B0E17] p-2 rounded-xl border border-[#1e293b] tracking-wider text-center">
              SEE → UNDERSTAND → FORECAST → DECIDE → ACT
            </div>
          </div>
        </div>

        {/* Bottom User Session / Auth Action Box */}
        <div className="mt-6 pt-4 border-t border-[#1e293b]/70 space-y-3">
          {currentUser ? (
            <div className="p-3 rounded-2xl bg-[#161b27] border border-[#1e293b] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#D4FF3D]/20 to-[#10B981]/20 border border-[#D4FF3D]/40 text-[#D4FF3D] font-mono font-bold text-xs shrink-0">
                    {getUserInitials()}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#10B981] border border-[#0B0E17]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F5F5F0] truncate">
                      {userProfile?.displayName || currentUser.email?.split('@')[0] || t.common.anonymousUser}
                    </p>
                    <p className="text-[10px] text-[#8A8F98] font-mono truncate">
                      {isGuestUser ? (language === 'fr' ? 'Mode Invité' : 'Guest Mode') : (currentUser.email || 'Connecté')}
                    </p>
                  </div>
                </div>

                <button
                  id="btn-sidebar-sign-out"
                  onClick={signOut}
                  title={t.nav.signOut || 'Déconnexion'}
                  aria-label={t.nav.signOut || 'Déconnexion'}
                  className="p-2 rounded-xl text-[#8A8F98] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 border border-transparent hover:border-[#F43F5E]/30 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Action row */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  id="btn-sidebar-go-profile"
                  onClick={() => onNavigate('settings')}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#0B0E17] hover:bg-[#1e293b] text-[#B8BCC4] hover:text-[#F5F5F0] border border-[#1e293b] text-[11px] font-medium transition-all text-center cursor-pointer"
                >
                  {t.common.userProfile || 'Profil'}
                </button>
                <button
                  id="btn-sidebar-quick-logout"
                  onClick={signOut}
                  className="py-1.5 px-2.5 rounded-xl bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 text-[#FB7185] border border-[#F43F5E]/30 text-[11px] font-medium transition-all text-center cursor-pointer flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>{t.nav.signOut || 'Sortir'}</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              id="btn-sidebar-open-auth"
              onClick={() => setShowAuthModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#D4FF3D] hover:bg-[#C2F028] text-[#0B0E17] text-xs font-bold transition-all shadow-[0_0_15px_rgba(212,255,61,0.2)] hover:shadow-[0_0_20px_rgba(212,255,61,0.35)] cursor-pointer active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>{t.nav.signIn || (language === 'fr' ? 'Connexion' : 'Sign In')}</span>
            </button>
          )}
        </div>
      </aside>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};


