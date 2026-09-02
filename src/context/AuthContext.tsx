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
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { 
  UserProfile, 
  SupportedLanguage, 
  ComputedRunway, 
  SecondaryAuthSettings, 
  AppRoute,
  Transaction,
  IncomeEvent
} from '../types';
import { calculateRunway } from '../shared/runwayCalculator';
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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
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

  // Initialize refs from localStorage cache
  useEffect(() => {
    try {
      const cachedTx = localStorage.getItem('neyrunway_transactions');
      if (cachedTx) {
        const parsed = JSON.parse(cachedTx);
        if (Array.isArray(parsed)) latestTransactionsRef.current = parsed;
      }
    } catch {}

    try {
      const cachedInc = localStorage.getItem('neyrunway_income_events');
      if (cachedInc) {
        const parsed = JSON.parse(cachedInc);
        if (Array.isArray(parsed)) latestIncomeEventsRef.current = parsed;
      }
    } catch {}
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

        setLoading(false);

        return () => {
          unsubsProfile();
          unsubsRunway();
          unsubsTransactions();
          unsubsIncomes();
        };
      } else {
        setUserProfile(null);
        setComputedRunway(null);
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
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign-in failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInGuest = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.warn('Firebase Anonymous Auth fallback to local session:', error);
      // Fallback to local guest profile so student is never blocked in dev/preview
      const guestUid = 'guest_' + Math.random().toString(36).substring(2, 9);
      const guestProfile: UserProfile = {
        userId: guestUid,
        email: null,
        displayName: language === 'fr' ? 'Étudiant Invité' : 'Guest Student',
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

      const res = calculateRunway({
        currentBalance: 1250,
        transactions: latestTransactionsRef.current,
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
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
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
    if (!currentUser) {
      // Local fallback for guest or offline mode
      setUserProfile((prev) => prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : null);
      return;
    }
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, {
        ...data,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setUserProfile((prev) => prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
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
