import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { WifiOff, Cloud, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineSyncIndicator: React.FC = () => {
  const { t, language } = useTranslation();
  const auth = useAuth();
  
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : (auth?.isOnline ?? true)
  );
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    if (auth?.isOnline !== undefined) {
      setIsOnline(auth.isOnline);
    }
  }, [auth?.isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formattedLastSync = auth?.lastSyncedAt
    ? new Date(auth.lastSyncedAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          id="offline-sync-indicator-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full bg-[#121622]/90 border-b border-[#1E293B] backdrop-blur-md px-4 py-2 z-30 transition-all"
        >
          <div className="flex items-center justify-between max-w-7xl mx-auto text-xs text-[#8A8F98]">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/25 text-[11px] font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
                <WifiOff className="w-3 h-3" />
                <span>{t.offline?.offlineTitle || 'Mode hors-ligne'}</span>
              </span>
              <span className="text-[#B8BCC4] text-[11px] sm:text-xs">
                {t.offline?.offlineDesc || 'Consultation active hors-ligne. Vos données restent accessibles.'}
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] text-[#8A8F98] shrink-0">
              {formattedLastSync && (
                <span className="hidden md:inline text-[10px] text-[#64748B]">
                  {t.offline?.lastSync || 'Dernière synchro'} : {formattedLastSync}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-[#A1A1AA] bg-[#1A2030] px-2.5 py-0.5 rounded-md border border-[#273046]">
                <Cloud className="w-3 h-3 text-[#38BDF8]" />
                <span className="text-[10px]">{t.offline?.cachedBadge || 'Cache local actif'}</span>
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {showReconnected && isOnline && (
        <motion.div
          id="offline-sync-indicator-reconnected"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full bg-[#D4FF3D]/10 border-b border-[#D4FF3D]/25 backdrop-blur-md px-4 py-2 z-30"
        >
          <div className="flex items-center justify-center gap-2 max-w-7xl mx-auto text-xs text-[#D4FF3D]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#D4FF3D]" />
            <span className="font-medium text-[#F5F5F0]">
              {t.offline?.backOnline || 'Connexion rétablie • Données synchronisées'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

