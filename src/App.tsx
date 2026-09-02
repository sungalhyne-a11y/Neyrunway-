import React, { useState, useEffect } from 'react';
import { I18nProvider } from './i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SimulationProvider } from './context/SimulationContext';
import { AppRoute } from './types';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { DashboardView } from './views/DashboardView';
import { ChatView } from './views/ChatView';
import { TransactionsView } from './views/TransactionsView';
import { GoalsView } from './views/GoalsView';
import { ResourcesView } from './views/ResourcesView';
import { OnboardingView } from './views/OnboardingView';
import { SettingsView } from './views/SettingsView';
import { OfflineSyncIndicator } from './components/common/OfflineSyncIndicator';
import { ProtectedViewWrapper } from './components/auth/ProtectedViewWrapper';
import { SecurityLockModal } from './components/auth/SecurityLockModal';
import { motion, AnimatePresence } from 'motion/react';

function NeyrunwayApp() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('dashboard');
  const [chatInitialQuery, setChatInitialQuery] = useState<string>('');
  const { currentUser, userProfile, isLockModalOpen, closeLockModal } = useAuth();

  // If user is logged in and hasn't completed onboarding, guide them to onboarding
  useEffect(() => {
    if (currentUser && userProfile && userProfile.onboardingCompleted === false) {
      setCurrentRoute('onboarding');
    }
  }, [currentUser?.uid, userProfile?.onboardingCompleted]);

  const handleNavigateToChat = (query?: string) => {
    if (query) {
      setChatInitialQuery(query);
    }
    setCurrentRoute('chat');
  };

  const renderCurrentView = () => {
    switch (currentRoute) {
      case 'dashboard':
        return <DashboardView onNavigateToChat={handleNavigateToChat} />;
      case 'chat':
        return <ChatView initialQuery={chatInitialQuery} onNavigate={(route) => setCurrentRoute(route)} />;
      case 'transactions':
        return (
          <ProtectedViewWrapper 
            route="transactions" 
            onNavigateToDashboard={() => setCurrentRoute('dashboard')}
          >
            <TransactionsView onNavigateToChat={handleNavigateToChat} />
          </ProtectedViewWrapper>
        );
      case 'goals':
        return (
          <ProtectedViewWrapper 
            route="goals" 
            onNavigateToDashboard={() => setCurrentRoute('dashboard')}
          >
            <GoalsView onNavigateToChat={handleNavigateToChat} />
          </ProtectedViewWrapper>
        );
      case 'resources':
        return <ResourcesView onNavigateToChat={handleNavigateToChat} />;
      case 'onboarding':
        return <OnboardingView onCompletePreview={() => setCurrentRoute('dashboard')} />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigateToChat={handleNavigateToChat} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E17] text-[#F5F5F0] flex flex-col antialiased selection:bg-[#D4FF3D] selection:text-[#0B0E17]">
      {/* Top Header Navbar */}
      <Navbar 
        currentRoute={currentRoute} 
        onNavigate={(route) => setCurrentRoute(route)} 
      />

      {/* Discreet Offline & Cache Synchronization Banner */}
      <OfflineSyncIndicator />

      {/* Main Container Layout */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Desktop Left Sidebar */}
        <Sidebar 
          currentRoute={currentRoute} 
          onNavigate={(route) => setCurrentRoute(route)} 
        />

        {/* Dynamic Route View Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8 overflow-y-auto max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRoute}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {renderCurrentView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav 
        currentRoute={currentRoute} 
        onNavigate={(route) => setCurrentRoute(route)} 
      />

      {/* Global Secondary Authentication Lock Modal */}
      <SecurityLockModal 
        isOpen={isLockModalOpen}
        onClose={closeLockModal}
        onCancelToDashboard={() => {
          closeLockModal();
          setCurrentRoute('dashboard');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <SimulationProvider>
          <ToastProvider>
            <NeyrunwayApp />
          </ToastProvider>
        </SimulationProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
