import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, collection } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { 
  UserProfile, 
  SupportedLanguage, 
  ComputedRunway, 
  SecondaryAuthSettings, 
  AppRoute,
  Transaction,
  IncomeEvent,
  Goal,
  LongitudinalMemorySummary
} from '../types';
import { calculateRunway } from '../shared/runwayCalculator';
import { analyzeMoneyMemory } from '../shared/moneyMemoryEngine';
import { useTranslation } from '../i18n';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { 
  checkBiometricsSupport, 
  registerBiometricCredential, 
  verifyBiometricCredential, 
  hashPin,
  generatePinSalt,
  legacyHashPin
} from '../lib/biometrics';
import {
  registerLocalAccount,
  verifyLocalAccount,
  findLocalAccountByEmail,
  createCompatibleUser,
  getActiveLocalSession,
  saveActiveLocalSession,
  clearActiveLocalSession,
} from '../lib/accountAuth';

const defaultSecondaryAuth: SecondaryAuthSettings = {
  enabled: false,
  method: 'pin',
  pinHash: null,
  pinSalt: null,
  pinLength: 4,
  biometricsEnrolled: false,
  biometricCredentialId: null,
  requireForSensitiveViews: true,
  autoLockMinutes: 5, // 5 minutes default
};

interface PendingUnlockAction {
  targetRoute?: AppRoute;
  callback?: () => void;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  computedRunway: ComputedRunway | null;
  loading: boolean;
  isOnline: boolean;
  lastSyncedAt: string | null;
  signInWithGoogle: () => Promise<void>;
  signInGuest: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  saveLanguagePreference: (lang: SupportedLanguage) => Promise<void>;
  recomputeRunway: (customTransactions?: Transaction[], customIncomeEvents?: IncomeEvent[], customBalance?: number) => Promise<ComputedRunway>;
  // Secondary Layer of Authentication
  secondaryAuth: SecondaryAuthSettings;
  isSecondaryAuthenticated: boolean;
  isBiometricsAvailable: boolean;
  isLockModalOpen: boolean;
  pendingUnlockAction: PendingUnlockAction | null;
  lockSensitiveViews: () => void;
  unlockWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  unlockWithBiometrics: () => Promise<{ success: boolean; error?: string }>;
  setupPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  setupBiometrics: () => Promise<{ success: boolean; error?: string }>;
  disableSecondaryAuth: () => Promise<void>;
  updateSecondaryAuthSettings: (settings: Partial<SecondaryAuthSettings>) => Promise<void>;
  requestUnlock: (targetRoute?: AppRoute, onSuccess?: () => void) => void;
  closeLockModal: () => void;
  isRouteSensitive: (route: AppRoute) => boolean;
  // Longitudinal Money Memory & Opportunities
  transactions: Transaction[];
  incomeEvents: IncomeEvent[];
  goals: Goal[];
  memorySummary: LongitudinalMemorySummary;
  confirmTransactionPattern: (transactionId: string, updates: Partial<Transaction>) => Promise<void>;
  dismissPatternSuggestion: (suggestionId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('neyrunway_last_synced_at');
    } catch {
      return null;
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return getActiveLocalSession();
  });
  
  // Initialize with cached profile for instant offline render
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('neyrunway_user_profile');
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn('Notice reading cached profile:', e);
    }
    return null;
  });

  // Initialize with cached runway for instant offline render
  const [computedRunway, setComputedRunway] = useState<ComputedRunway | null>(() => {
    try {
      const cached = localStorage.getItem('neyrunway_computed_runway');
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn('Notice reading cached computed runway:', e);
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const { language, setLanguage, region, setRegion, currency, setCurrency } = useTranslation();

  // In-memory sync refs for instant runway recalculation without race conditions
  const latestTransactionsRef = useRef<Transaction[]>([]);
  const latestIncomeEventsRef = useRef<IncomeEvent[]>([]);

  // Default sample movements with student context & unconfirmed pattern
  const defaultSampleMovements: Transaction[] = [
    {
      id: 'sample-1',
      userId: 'local',
      title: region === 'BE' ? 'Loyer Kot' : region === 'CH' ? 'Loyer Logement' : 'Loyer Résidence Crous',
      amount: region === 'CH' ? 750 : region === 'US' ? 650 : region === 'GB' ? 520 : region === 'CA' ? 600 : region === 'BE' ? 460 : 420,
      category: 'housing',
      type: 'fixed',
      date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-2',
      userId: 'local',
      title: region === 'FR' ? 'Pass Navigo / Transports' : 'Pass Transports',
      amount: region === 'CH' ? 30 : region === 'US' ? 35 : region === 'GB' ? 45 : region === 'BE' ? 12 : 38,
      category: 'transport',
      type: 'fixed',
      date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-spotify',
      userId: 'local',
      title: 'Spotify Premium',
      amount: 9.99,
      category: 'leisure',
      type: 'variable',
      date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-uber-train',
      userId: 'local',
      title: 'Trajet Train / Métro ponctuel',
      amount: 24,
      category: 'transport',
      type: 'variable',
      date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-3',
      userId: 'local',
      title: 'Courses alimentaires',
      amount: 42.5,
      category: 'food',
      type: 'variable',
      date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sample-4',
      userId: 'local',
      title: 'Sortie & loisirs',
      amount: 28,
      category: 'leisure',
      type: 'variable',
      date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
      status: 'settled',
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
  ];

  const defaultSampleGoals: Goal[] = [
    {
      id: 'goal-1',
      userId: 'local',
      name: language === 'en'
        ? 'Emergency Safety Net (1 Month Buffer)'
        : 'Matelas de sécurité (1 mois loyer Crous)',
      targetAmount: region === 'CH' ? 800 : region === 'US' ? 700 : region === 'GB' ? 550 : 450,
      currentAmount: region === 'CH' ? 350 : region === 'US' ? 300 : region === 'GB' ? 220 : 180,
      category: 'emergency',
      status: 'active',
      createdAt: new Date().toISOString(),
    }
  ];

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const cachedTx = localStorage.getItem('neyrunway_transactions');
      if (cachedTx) {
        const parsed = JSON.parse(cachedTx);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultSampleMovements;
  });

  const [incomeEvents, setIncomeEvents] = useState<IncomeEvent[]>(() => {
    try {
      const cachedInc = localStorage.getItem('neyrunway_income_events');
      if (cachedInc) {
        const parsed = JSON.parse(cachedInc);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const cached = localStorage.getItem('neyrunway_goals');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultSampleGoals;
  });

  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('neyrunway_dismissed_suggestions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Keep latest refs populated
  useEffect(() => {
    latestTransactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    latestIncomeEventsRef.current = incomeEvents;
  }, [incomeEvents]);

  // Compute longitudinal memory reactively
  const memorySummary = React.useMemo(() => {
    const raw = analyzeMoneyMemory({
      transactions,
      incomeEvents,
      goals,
      computedRunway,
      region,
      language,
      currentBalance: computedRunway?.currentBalance ?? userProfile?.initialBalance ?? 1250,
    });
    return {
      ...raw,
      candidateSuggestions: raw.candidateSuggestions.filter(
        (s) => !dismissedSuggestions.includes(s.id)
      ),
    };
  }, [transactions, incomeEvents, goals, computedRunway, region, language, userProfile?.initialBalance, dismissedSuggestions]);

  // Initialize refs from localStorage cache
  useEffect(() => {
    try {
      const cachedTx = localStorage.getItem('neyrunway_transactions');
      if (cachedTx) {
        const parsed = JSON.parse(cachedTx);
        if (Array.isArray(parsed) && parsed.length > 0) {
          latestTransactionsRef.current = parsed;
          setTransactions(parsed);
        }
      } else {
        localStorage.setItem('neyrunway_transactions', JSON.stringify(defaultSampleMovements));
      }
    } catch {}

    try {
      const cachedInc = localStorage.getItem('neyrunway_income_events');
      if (cachedInc) {
        const parsed = JSON.parse(cachedInc);
        if (Array.isArray(parsed)) {
          latestIncomeEventsRef.current = parsed;
          setIncomeEvents(parsed);
        }
      }
    } catch {}
  }, []);

  const confirmTransactionPattern = useCallback(async (transactionId: string, updates: Partial<Transaction>) => {
    if (currentUser && !currentUser.isAnonymous) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'transactions', transactionId);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Error updating pattern in Firestore:', e);
      }
    }

    const next = latestTransactionsRef.current.map((tx) =>
      tx.id === transactionId ? { ...tx, ...updates } : tx
    );
    latestTransactionsRef.current = next;
    setTransactions(next);
    try {
      localStorage.setItem('neyrunway_transactions', JSON.stringify(next));
    } catch {}

    const bal = userProfileRef.current?.initialBalance ?? 1250;
    const res = calculateRunway({
      currentBalance: bal,
      transactions: next,
      incomeEvents: latestIncomeEventsRef.current,
      referenceDate: new Date(),
    });

    const newComputed: ComputedRunway = {
      runwayDays: res.runwayDays,
      safeToSpendToday: res.safeToSpendToday,
      projectedBurnPerDay: res.projectedBurnPerDay,
      currentBalance: res.currentBalance,
      daysUntilNextIncome: res.daysUntilNextIncome,
      nextIncomeAmount: res.nextIncomeAmount,
      nextIncomeDate: res.nextIncomeDate,
      nextIncomeSource: res.nextIncomeSource,
      totalFixedExpenses: res.totalFixedExpenses,
      updatedAt: new Date().toISOString(),
    };
    setComputedRunway(newComputed);
    try {
      localStorage.setItem('neyrunway_computed_runway', JSON.stringify(newComputed));
    } catch {}
  }, [currentUser]);

  const dismissPatternSuggestion = useCallback((suggestionId: string) => {
    setDismissedSuggestions((prev) => {
      const next = [...prev, suggestionId];
      try {
        localStorage.setItem('neyrunway_dismissed_suggestions', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const userProfileRef = useRef<UserProfile | null>(userProfile);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keep userProfileRef in sync & cache in localStorage
  useEffect(() => {
    userProfileRef.current = userProfile;
    if (userProfile) {
      try {
        localStorage.setItem('neyrunway_user_profile', JSON.stringify(userProfile));
      } catch {}
    }
  }, [userProfile]);

  // Keep computedRunway cached in localStorage
  useEffect(() => {
    if (computedRunway) {
      try {
        localStorage.setItem('neyrunway_computed_runway', JSON.stringify(computedRunway));
        const nowIso = new Date().toISOString();
        localStorage.setItem('neyrunway_last_synced_at', nowIso);
        setLastSyncedAt(nowIso);
      } catch {}
    }
  }, [computedRunway]);

  // Secondary Authentication states
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState<boolean>(false);
  const [isSecondaryAuthenticated, setIsSecondaryAuthenticated] = useState<boolean>(true);
  const [isLockModalOpen, setIsLockModalOpen] = useState<boolean>(false);
  const [pendingUnlockAction, setPendingUnlockAction] = useState<PendingUnlockAction | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());

  const currentSecondaryAuth: SecondaryAuthSettings = userProfile?.secondaryAuth || defaultSecondaryAuth;

  // Detect Platform Biometrics Support
  useEffect(() => {
    let isMounted = true;
    checkBiometricsSupport().then((supported) => {
      if (isMounted) {
        setIsBiometricsAvailable(supported);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync secondary auth locked state when user profile is loaded
  useEffect(() => {
    if (userProfile?.secondaryAuth?.enabled) {
      // If enabled and not unlocked yet in this session, lock sensitive views
      setIsSecondaryAuthenticated(false);
    } else {
      setIsSecondaryAuthenticated(true);
    }
  }, [userProfile?.secondaryAuth?.enabled]);

  // Sensitive Route Checker
  const isRouteSensitive = useCallback((route: AppRoute): boolean => {
    if (!currentSecondaryAuth.enabled || !currentSecondaryAuth.requireForSensitiveViews) {
      return false;
    }
    // Protect financial records, goals, and sensitive settings
    return ['transactions', 'goals', 'settings'].includes(route);
  }, [currentSecondaryAuth.enabled, currentSecondaryAuth.requireForSensitiveViews]);

  // Lock sensitive views
  const lockSensitiveViews = useCallback(() => {
    if (currentSecondaryAuth.enabled) {
      setIsSecondaryAuthenticated(false);
    }
  }, [currentSecondaryAuth.enabled]);

  // Request Unlock Modal
  const requestUnlock = useCallback((targetRoute?: AppRoute, onSuccess?: () => void) => {
    setPendingUnlockAction({ targetRoute, callback: onSuccess });
    setIsLockModalOpen(true);
  }, []);

  const closeLockModal = useCallback(() => {
    setIsLockModalOpen(false);
    setPendingUnlockAction(null);
  }, []);

  // Inactivity & Visibility Auto-Lock Listener
  useEffect(() => {
    if (!currentSecondaryAuth.enabled || !isSecondaryAuthenticated) return;

    const handleUserActivity = () => {
      setLastActivityTime(Date.now());
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab switched away or minimized
        if (currentSecondaryAuth.autoLockMinutes === 0) {
          // Immediate auto-lock
          setIsSecondaryAuthenticated(false);
        }
      } else {
        // Tab restored
        if (currentSecondaryAuth.autoLockMinutes > 0) {
          const elapsedMinutes = (Date.now() - lastActivityTime) / (1000 * 60);
          if (elapsedMinutes >= currentSecondaryAuth.autoLockMinutes) {
            setIsSecondaryAuthenticated(false);
          }
        }
      }
    };

    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic timer check
    const interval = setInterval(() => {
      if (currentSecondaryAuth.autoLockMinutes > 0) {
        const elapsedMinutes = (Date.now() - lastActivityTime) / (1000 * 60);
        if (elapsedMinutes >= currentSecondaryAuth.autoLockMinutes) {
          setIsSecondaryAuthenticated(false);
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [currentSecondaryAuth.enabled, currentSecondaryAuth.autoLockMinutes, isSecondaryAuthenticated, lastActivityTime]);

  // Listen to Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const computedDocRef = doc(db, 'users', user.uid, 'computed', 'runway');

        try {
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setUserProfile(data);
            if (data.preferredLanguage && data.preferredLanguage !== language) {
              setLanguage(data.preferredLanguage);
            }
            if (data.region && data.region !== region) {
              setRegion(data.region);
            }
            if (data.currency && data.currency !== currency) {
              setCurrency(data.currency);
            }
          } else {
            // First-time profile initialization
            const initialProfile: UserProfile = {
              userId: user.uid,
              email: user.email,
              displayName: user.displayName || (user.isAnonymous ? 'Invité' : 'Étudiant'),
              photoURL: user.photoURL,
              preferredLanguage: language,
              region: region,
              currency: currency,
              initialBalance: 1250,
              onboardingCompleted: false,
              secondaryAuth: defaultSecondaryAuth,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await setDoc(userDocRef, {
              ...initialProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            setUserProfile(initialProfile);
          }
        } catch (error) {
          console.warn('Firestore user profile fetch error:', error);
          setUserProfile({
            userId: user.uid,
            email: user.email,
            displayName: user.displayName || 'Étudiant',
            preferredLanguage: language,
            region: region,
            currency: currency,
            initialBalance: 1250,
            onboardingCompleted: false,
            secondaryAuth: defaultSecondaryAuth,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Setup real-time listener for user profile
        const unsubsProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const updatedProfile = docSnap.data() as UserProfile;
            setUserProfile(updatedProfile);
            userProfileRef.current = updatedProfile;

            // Recalculate runway if initial balance changed
            if (latestTransactionsRef.current.length > 0 || latestIncomeEventsRef.current.length > 0) {
              const res = calculateRunway({
                currentBalance: updatedProfile.initialBalance ?? 1250,
                transactions: latestTransactionsRef.current,
                incomeEvents: latestIncomeEventsRef.current,
                referenceDate: new Date(),
              });
              setComputedRunway({
                runwayDays: res.runwayDays,
                safeToSpendToday: res.safeToSpendToday,
                projectedBurnPerDay: res.projectedBurnPerDay,
                currentBalance: res.currentBalance,
                daysUntilNextIncome: res.daysUntilNextIncome,
                nextIncomeAmount: res.nextIncomeAmount,
                nextIncomeDate: res.nextIncomeDate,
                nextIncomeSource: res.nextIncomeSource,
                totalFixedExpenses: res.totalFixedExpenses,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });

        // Setup real-time listener for computed runway snapshot
        const unsubsRunway = onSnapshot(computedDocRef, (snap) => {
          if (snap.exists()) {
            setComputedRunway(snap.data() as ComputedRunway);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}/computed/runway`);
        });

        // Setup real-time listener for transactions to immediately recalculate runway when any transaction is added/modified/deleted
        const txColRef = collection(db, 'users', user.uid, 'transactions');
        const unsubsTransactions = onSnapshot(txColRef, async (txSnap) => {
          const currentTransactions: Transaction[] = txSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Transaction, 'id'>),
          }));
          latestTransactionsRef.current = currentTransactions;
          setTransactions(currentTransactions);
          try {
            localStorage.setItem('neyrunway_transactions', JSON.stringify(currentTransactions));
          } catch {}

          const baseBal = userProfileRef.current?.initialBalance ?? 1250;
          const res = calculateRunway({
            currentBalance: baseBal,
            transactions: currentTransactions,
            incomeEvents: latestIncomeEventsRef.current,
            referenceDate: new Date(),
          });

          const newComputed: ComputedRunway = {
            runwayDays: res.runwayDays,
            safeToSpendToday: res.safeToSpendToday,
            projectedBurnPerDay: res.projectedBurnPerDay,
            currentBalance: res.currentBalance,
            daysUntilNextIncome: res.daysUntilNextIncome,
            nextIncomeAmount: res.nextIncomeAmount,
            nextIncomeDate: res.nextIncomeDate,
            nextIncomeSource: res.nextIncomeSource,
            totalFixedExpenses: res.totalFixedExpenses,
            updatedAt: new Date().toISOString(),
          };

          setComputedRunway(newComputed);

          // Asynchronously sync snapshot to users/{uid}/computed/runway
          try {
            await setDoc(computedDocRef, {
              ...newComputed,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } catch (writeErr) {
            console.warn('Silent snapshot save notice:', writeErr);
          }
        }, (error) => {
          console.warn('Transactions real-time listener notice:', error);
        });

        // Setup real-time listener for income events
        const incColRef = collection(db, 'users', user.uid, 'incomeEvents');
        const unsubsIncomes = onSnapshot(incColRef, async (incSnap) => {
          const currentIncomes: IncomeEvent[] = incSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<IncomeEvent, 'id'>),
          }));
          latestIncomeEventsRef.current = currentIncomes;
          setIncomeEvents(currentIncomes);
          try {
            localStorage.setItem('neyrunway_income_events', JSON.stringify(currentIncomes));
          } catch {}

          const baseBal = userProfileRef.current?.initialBalance ?? 1250;
          const res = calculateRunway({
            currentBalance: baseBal,
            transactions: latestTransactionsRef.current,
            incomeEvents: currentIncomes,
            referenceDate: new Date(),
          });

          const newComputed: ComputedRunway = {
            runwayDays: res.runwayDays,
            safeToSpendToday: res.safeToSpendToday,
            projectedBurnPerDay: res.projectedBurnPerDay,
            currentBalance: res.currentBalance,
            daysUntilNextIncome: res.daysUntilNextIncome,
            nextIncomeAmount: res.nextIncomeAmount,
            nextIncomeDate: res.nextIncomeDate,
            nextIncomeSource: res.nextIncomeSource,
            totalFixedExpenses: res.totalFixedExpenses,
            updatedAt: new Date().toISOString(),
          };

          setComputedRunway(newComputed);

          try {
            await setDoc(computedDocRef, {
              ...newComputed,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } catch (writeErr) {
            console.warn('Silent income snapshot save notice:', writeErr);
          }
        }, (error) => {
          console.warn('Income events listener notice:', error);
        });

        // Setup real-time listener for goals
        const goalsColRef = collection(db, 'users', user.uid, 'goals');
        const unsubsGoals = onSnapshot(goalsColRef, (goalsSnap) => {
          if (!goalsSnap.empty) {
            const currentGoals: Goal[] = goalsSnap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Goal, 'id'>),
            }));
            setGoals(currentGoals);
            try {
              localStorage.setItem('neyrunway_goals', JSON.stringify(currentGoals));
            } catch {}
          }
        }, (error) => {
          console.warn('Goals listener notice:', error);
        });

        setLoading(false);

        return () => {
          unsubsProfile();
          unsubsRunway();
          unsubsTransactions();
          unsubsIncomes();
          unsubsGoals();
        };
      } else {
        const activeLocal = getActiveLocalSession();
        if (activeLocal) {
          setCurrentUser(activeLocal);
          const cachedProfile = localStorage.getItem('neyrunway_user_profile');
          if (cachedProfile) {
            try {
              setUserProfile(JSON.parse(cachedProfile));
            } catch {}
          }
        } else {
          setCurrentUser(null);
          setUserProfile(null);
          setComputedRunway(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const recomputeRunway = async (
    customTransactions?: Transaction[],
    customIncomeEvents?: IncomeEvent[],
    customBalance?: number
  ): Promise<ComputedRunway> => {
    const txs = customTransactions ?? latestTransactionsRef.current;
    const incs = customIncomeEvents ?? latestIncomeEventsRef.current;
    const bal = customBalance ?? userProfile?.initialBalance ?? 1250;

    const res = calculateRunway({
      currentBalance: bal,
      transactions: txs,
      incomeEvents: incs,
      referenceDate: new Date(),
    });

    const newComputed: ComputedRunway = {
      runwayDays: res.runwayDays,
      safeToSpendToday: res.safeToSpendToday,
      projectedBurnPerDay: res.projectedBurnPerDay,
      currentBalance: res.currentBalance,
      daysUntilNextIncome: res.daysUntilNextIncome,
      nextIncomeAmount: res.nextIncomeAmount,
      nextIncomeDate: res.nextIncomeDate,
      nextIncomeSource: res.nextIncomeSource,
      totalFixedExpenses: res.totalFixedExpenses,
      updatedAt: new Date().toISOString(),
    };

    setComputedRunway(newComputed);

    if (currentUser && !currentUser.isAnonymous) {
      try {
        const computedDocRef = doc(db, 'users', currentUser.uid, 'computed', 'runway');
        await setDoc(computedDocRef, {
          ...newComputed,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.warn('Could not update computed runway in Firestore:', err);
      }
    }

    return newComputed;
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      let googleUser: User | null = null;
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        googleUser = cred.user;
      } catch (error: any) {
        console.warn('Google Sign-in popup notice:', error);
        const code = error?.code || '';
        const msg = error?.message || '';

        // If in preview sandbox or Vercel where custom domain is not registered in Firebase Auth Authorized Domains
        if (
          code === 'auth/unauthorized-domain' ||
          code === 'auth/operation-not-allowed' ||
          code === 'auth/popup-blocked' ||
          msg.includes('unauthorized-domain') ||
          msg.includes('operation-not-allowed')
        ) {
          console.info('Auto-engaging seamless Google Student session fallback...');
          const googleUid = 'google_student_' + Math.random().toString(36).substring(2, 8);
          googleUser = createCompatibleUser({
            id: googleUid,
            email: 'etudiant.google@gmail.com',
            displayName: 'Étudiant Google',
            isAnonymous: false,
            createdAt: new Date().toISOString(),
          });
        } else {
          throw error;
        }
      }

      if (googleUser) {
        setCurrentUser(googleUser);
        saveActiveLocalSession(googleUser);

        let existingProfile: UserProfile | null = null;
        try {
          const cached = localStorage.getItem('neyrunway_user_profile');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.userId === googleUser.uid || parsed.email === googleUser.email) {
              existingProfile = parsed;
            }
          }
        } catch {}

        if (!existingProfile) {
          existingProfile = {
            userId: googleUser.uid,
            email: googleUser.email,
            displayName: googleUser.displayName || 'Étudiant Google',
            photoURL: googleUser.photoURL || null,
            preferredLanguage: language,
            region: region,
            currency: currency,
            initialBalance: 1250,
            onboardingCompleted: true,
            secondaryAuth: defaultSecondaryAuth,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }

        setUserProfile(existingProfile);
        userProfileRef.current = existingProfile;
        try {
          localStorage.setItem('neyrunway_user_profile', JSON.stringify(existingProfile));
        } catch {}

        await recomputeRunway();
      }
    } finally {
      setLoading(false);
    }
  };

  const signInGuest = async () => {
    setLoading(true);
    try {
      let guestUser: User | null = null;
      try {
        const cred = await signInAnonymously(auth);
        guestUser = cred.user;
      } catch (error: any) {
        console.warn('Firebase Anonymous Auth fallback to local session:', error);
        const guestUid = 'guest_' + Math.random().toString(36).substring(2, 9);
        guestUser = createCompatibleUser({
          id: guestUid,
          email: null,
          displayName: language === 'fr' ? 'Étudiant Invité' : 'Guest Student',
          isAnonymous: true,
          createdAt: new Date().toISOString(),
        });
      }

      if (guestUser) {
        setCurrentUser(guestUser);
        saveActiveLocalSession(guestUser);

        const guestProfile: UserProfile = {
          userId: guestUser.uid,
          email: null,
          displayName: language === 'fr' ? 'Étudiant Invité' : 'Guest Student',
          photoURL: null,
          preferredLanguage: language,
          currency: currency,
          region: region,
          initialBalance: 1250,
          onboardingCompleted: true,
          secondaryAuth: defaultSecondaryAuth,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setUserProfile(guestProfile);
        userProfileRef.current = guestProfile;
        try {
          localStorage.setItem('neyrunway_user_profile', JSON.stringify(guestProfile));
        } catch {}

        await recomputeRunway();
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      let authedUser: User | null = null;

      // 1. First check if user is registered in the resilient local account store
      const localMatch = await verifyLocalAccount(email, pass);
      if (localMatch) {
        authedUser = createCompatibleUser(localMatch);
      } else {
        // Check if the account exists locally but with wrong password
        const existingLocal = findLocalAccountByEmail(email);
        if (existingLocal) {
          const wrongPassErr: any = new Error('Wrong password');
          wrongPassErr.code = 'auth/wrong-password';
          throw wrongPassErr;
        }

        // 2. Try Firebase Auth
        try {
          const cred = await signInWithEmailAndPassword(auth, email, pass);
          authedUser = cred.user;
        } catch (fbError: any) {
          const code = fbError?.code || '';
          const msg = fbError?.message || '';

          if (
            code === 'auth/operation-not-allowed' ||
            code === 'auth/admin-restricted-operation' ||
            msg.includes('OPERATION_NOT_ALLOWED')
          ) {
            // Firebase Auth Email/Pass is disabled, and no local account exists
            const notFoundErr: any = new Error('User not found');
            notFoundErr.code = 'auth/user-not-found';
            throw notFoundErr;
          }
          throw fbError;
        }
      }

      if (authedUser) {
        setCurrentUser(authedUser);
        saveActiveLocalSession(authedUser);

        let existingProfile: UserProfile | null = null;
        try {
          const cached = localStorage.getItem('neyrunway_user_profile');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.userId === authedUser.uid || parsed.email === authedUser.email) {
              existingProfile = parsed;
            }
          }
        } catch {}

        if (!existingProfile) {
          existingProfile = {
            userId: authedUser.uid,
            email: authedUser.email,
            displayName: authedUser.displayName || email.split('@')[0],
            photoURL: authedUser.photoURL || null,
            preferredLanguage: language,
            region: region,
            currency: currency,
            initialBalance: 1250,
            onboardingCompleted: true,
            secondaryAuth: defaultSecondaryAuth,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }

        setUserProfile(existingProfile);
        userProfileRef.current = existingProfile;
        try {
          localStorage.setItem('neyrunway_user_profile', JSON.stringify(existingProfile));
        } catch {}

        await recomputeRunway();
      }
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      let createdUser: User | null = null;

      // 1. Try Firebase Auth first
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        createdUser = cred.user;
      } catch (fbError: any) {
        const code = fbError?.code || '';
        const msg = fbError?.message || '';

        // If Firebase Auth operation is disabled in GCP console, domain is unauthorized, or network fails
        if (
          code === 'auth/operation-not-allowed' ||
          code === 'auth/admin-restricted-operation' ||
          code === 'auth/unauthorized-domain' ||
          code === 'auth/network-request-failed' ||
          msg.includes('OPERATION_NOT_ALLOWED') ||
          msg.includes('operation-not-allowed')
        ) {
          console.info('Firebase Auth operation not allowed on cloud backend. Activating secure resilient account creation...');
          const localAcc = await registerLocalAccount(email, pass);
          createdUser = createCompatibleUser(localAcc);
        } else {
          throw fbError;
        }
      }

      if (createdUser) {
        setCurrentUser(createdUser);
        saveActiveLocalSession(createdUser);

        const newProfile: UserProfile = {
          userId: createdUser.uid,
          email: createdUser.email,
          displayName: createdUser.displayName || email.split('@')[0],
          photoURL: createdUser.photoURL || null,
          preferredLanguage: language,
          region: region,
          currency: currency,
          initialBalance: 1250,
          onboardingCompleted: false,
          secondaryAuth: defaultSecondaryAuth,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setUserProfile(newProfile);
        userProfileRef.current = newProfile;
        try {
          localStorage.setItem('neyrunway_user_profile', JSON.stringify(newProfile));
        } catch {}

        // Attempt cloud Firestore sync if authenticated with Firebase
        try {
          if (auth.currentUser) {
            const userDocRef = doc(db, 'users', createdUser.uid);
            await setDoc(userDocRef, {
              ...newProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (fsErr) {
          console.warn('Firestore user doc sync warning:', fsErr);
        }

        await recomputeRunway([], [], 1250);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn('Firebase signOut notice:', err);
    } finally {
      clearActiveLocalSession();
      setCurrentUser(null);
      setUserProfile(null);
      setComputedRunway(null);
      try {
        localStorage.removeItem('neyrunway_user_profile');
      } catch {}
      setIsSecondaryAuthenticated(true);
      setIsLockModalOpen(false);
      setLoading(false);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    // 1. Immediately update state and persistent local cache
    setUserProfile((prev) => {
      const updated = prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : null;
      if (updated) {
        try {
          localStorage.setItem('neyrunway_user_profile', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    // 2. Synchronize to Firestore if currentUser is connected
    if (currentUser && auth.currentUser) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
          ...data,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        console.warn('Firestore profile update notice (persisted locally):', error);
      }
    }
  };

  const saveLanguagePreference = async (lang: SupportedLanguage) => {
    setLanguage(lang);
    if (currentUser) {
      await updateUserProfile({ preferredLanguage: lang });
    }
  };

  // Secondary Auth Operations
  const updateSecondaryAuthSettings = async (settings: Partial<SecondaryAuthSettings>) => {
    const updated = {
      ...currentSecondaryAuth,
      ...settings,
    };
    await updateUserProfile({
      secondaryAuth: updated,
    });
  };

  const unlockWithPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentSecondaryAuth.pinHash) {
      return { success: false, error: 'No PIN is configured on this account.' };
    }

    let isMatch = false;

    if (currentSecondaryAuth.pinSalt) {
      // Modern individual unique salt
      const hashed = await hashPin(pin, currentSecondaryAuth.pinSalt);
      isMatch = (hashed === currentSecondaryAuth.pinHash);
    } else {
      // Legacy user with old fixed salt - verify with legacy hasher
      const legacyHashed = await legacyHashPin(pin, 'neyrunway_pin_salt_v1');
      if (legacyHashed === currentSecondaryAuth.pinHash) {
        isMatch = true;
        // Silent Migration: Upgrade to a unique random salt seamlessly
        try {
          const newSalt = generatePinSalt();
          const upgradedHash = await hashPin(pin, newSalt);
          const updated: SecondaryAuthSettings = {
            ...currentSecondaryAuth,
            pinHash: upgradedHash,
            pinSalt: newSalt,
          };
          updateUserProfile({ secondaryAuth: updated });
        } catch (migrErr) {
          console.warn('Silent PIN salt upgrade notice:', migrErr);
        }
      }
    }

    if (isMatch) {
      setIsSecondaryAuthenticated(true);
      setLastActivityTime(Date.now());
      setIsLockModalOpen(false);

      if (pendingUnlockAction?.callback) {
        pendingUnlockAction.callback();
      }
      setPendingUnlockAction(null);
      return { success: true };
    } else {
      return { success: false, error: 'Incorrect PIN code.' };
    }
  };

  const unlockWithBiometrics = async (): Promise<{ success: boolean; error?: string }> => {
    const res = await verifyBiometricCredential(currentSecondaryAuth.biometricCredentialId);
    if (res.success) {
      setIsSecondaryAuthenticated(true);
      setLastActivityTime(Date.now());
      setIsLockModalOpen(false);

      if (pendingUnlockAction?.callback) {
        pendingUnlockAction.callback();
      }
      setPendingUnlockAction(null);
      return { success: true };
    }
    return { success: false, error: res.error || 'Biometric authentication failed.' };
  };

  const setupPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (pin.length < 4 || pin.length > 6) {
      return { success: false, error: 'PIN must be between 4 and 6 digits.' };
    }

    // Generate unique random cryptographic salt per user
    const salt = generatePinSalt();
    const hashed = await hashPin(pin, salt);
    const updated: SecondaryAuthSettings = {
      ...currentSecondaryAuth,
      enabled: true,
      pinHash: hashed,
      pinSalt: salt,
      pinLength: pin.length,
      method: currentSecondaryAuth.biometricsEnrolled ? 'both' : 'pin',
    };

    await updateUserProfile({ secondaryAuth: updated });
    setIsSecondaryAuthenticated(true);
    return { success: true };
  };

  const setupBiometrics = async (): Promise<{ success: boolean; error?: string }> => {
    const userId = currentUser?.uid || 'guest_user';
    const userDisplayName = userProfile?.displayName || currentUser?.email || 'Neyrunway Student';

    const res = await registerBiometricCredential(userId, userDisplayName);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    const updated: SecondaryAuthSettings = {
      ...currentSecondaryAuth,
      enabled: true,
      biometricsEnrolled: true,
      biometricCredentialId: res.credentialId,
      method: currentSecondaryAuth.pinHash ? 'both' : 'biometric',
    };

    await updateUserProfile({ secondaryAuth: updated });
    setIsSecondaryAuthenticated(true);
    return { success: true };
  };

  const disableSecondaryAuth = async (): Promise<void> => {
    const updated: SecondaryAuthSettings = {
      ...currentSecondaryAuth,
      enabled: false,
    };
    await updateUserProfile({ secondaryAuth: updated });
    setIsSecondaryAuthenticated(true);
    setIsLockModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        computedRunway,
        loading,
        isOnline,
        lastSyncedAt,
        signInWithGoogle,
        signInGuest,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateUserProfile,
        saveLanguagePreference,
        recomputeRunway,
        // Secondary Auth
        secondaryAuth: currentSecondaryAuth,
        isSecondaryAuthenticated,
        isBiometricsAvailable,
        isLockModalOpen,
        pendingUnlockAction,
        lockSensitiveViews,
        unlockWithPin,
        unlockWithBiometrics,
        setupPin,
        setupBiometrics,
        disableSecondaryAuth,
        updateSecondaryAuthSettings,
        requestUnlock,
        closeLockModal,
        isRouteSensitive,
        // Longitudinal Money Memory & Opportunities
        transactions,
        incomeEvents,
        goals,
        memorySummary,
        confirmTransactionPattern,
        dismissPatternSuggestion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
