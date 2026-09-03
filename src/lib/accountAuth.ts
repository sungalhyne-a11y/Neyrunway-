import { User } from 'firebase/auth';

export interface LocalAccount {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

const STORAGE_KEY_ACCOUNTS = 'neyrunway_registered_accounts';
const STORAGE_KEY_CURRENT_USER = 'neyrunway_current_auth_user';

// Simple fallback sha256 for non-crypto environments
async function sha256Hex(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic fallback hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fb_' + Math.abs(hash).toString(16);
}

function generateRandomSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return 'salt_' + Math.random().toString(36).substring(2, 12);
}

export function getRegisteredAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Notice reading registered accounts:', err);
    return [];
  }
}

export function findLocalAccountByEmail(email: string): LocalAccount | null {
  const normalized = email.trim().toLowerCase();
  const accounts = getRegisteredAccounts();
  return accounts.find(a => a.email.toLowerCase() === normalized) || null;
}

export async function registerLocalAccount(email: string, pass: string): Promise<LocalAccount> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    const err: any = new Error('Invalid email');
    err.code = 'auth/invalid-email';
    throw err;
  }

  if (!pass || pass.length < 6) {
    const err: any = new Error('Weak password');
    err.code = 'auth/weak-password';
    throw err;
  }

  const existing = findLocalAccountByEmail(cleanEmail);
  if (existing) {
    const err: any = new Error('Email already in use');
    err.code = 'auth/email-already-in-use';
    throw err;
  }

  const salt = generateRandomSalt();
  const passwordHash = await sha256Hex(`${salt}:${pass.trim()}`);
  const id = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const displayName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');

  const newAccount: LocalAccount = {
    id,
    email: cleanEmail,
    displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  const accounts = getRegisteredAccounts();
  accounts.push(newAccount);

  try {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
  } catch (saveErr) {
    console.warn('Notice saving account to storage:', saveErr);
  }

  return newAccount;
}

export async function verifyLocalAccount(email: string, pass: string): Promise<LocalAccount | null> {
  const cleanEmail = email.trim().toLowerCase();
  const account = findLocalAccountByEmail(cleanEmail);
  if (!account) {
    return null;
  }

  const computedHash = await sha256Hex(`${account.salt}:${pass.trim()}`);
  if (computedHash !== account.passwordHash) {
    const err: any = new Error('Wrong password');
    err.code = 'auth/wrong-password';
    throw err;
  }

  return account;
}

export function createCompatibleUser(params: {
  id: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
  createdAt?: string;
}): User {
  const email = params.email || null;
  const displayName = params.displayName || (email ? email.split('@')[0] : 'Étudiant');
  const uid = params.id;
  const isAnonymous = !!params.isAnonymous;

  return {
    uid,
    email,
    displayName,
    photoURL: params.photoURL || null,
    emailVerified: !isAnonymous,
    isAnonymous,
    phoneNumber: null,
    tenantId: null,
    providerId: isAnonymous ? 'anonymous' : 'password',
    metadata: {
      creationTime: params.createdAt || new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
    },
    providerData: [
      {
        providerId: isAnonymous ? 'anonymous' : 'password',
        uid,
        displayName,
        email,
        phoneNumber: null,
        photoURL: null,
      },
    ],
    refreshToken: '',
    getIdToken: async () => 'mock-token',
    getIdTokenResult: async () => ({
      token: 'mock-token',
      claims: {},
      authTime: new Date().toISOString(),
      issuedAtTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 3600000).toISOString(),
      signInProvider: isAnonymous ? 'anonymous' : 'password',
      signInSecondFactor: null,
    }),
    reload: async () => {},
    toJSON: () => ({ uid, email, displayName, isAnonymous }),
    delete: async () => {},
  } as unknown as User;
}

export function getActiveLocalSession(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.uid) return null;
    return createCompatibleUser({
      id: parsed.uid,
      email: parsed.email,
      displayName: parsed.displayName,
      photoURL: parsed.photoURL,
      isAnonymous: parsed.isAnonymous,
    });
  } catch {
    return null;
  }
}

export function saveActiveLocalSession(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
}): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_CURRENT_USER,
      JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL || null,
        isAnonymous: !!user.isAnonymous,
      })
    );
  } catch (err) {
    console.warn('Notice saving active session:', err);
  }
}

export function clearActiveLocalSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  } catch {}
}
