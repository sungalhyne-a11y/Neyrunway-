/**
 * Browser-based Biometrics (WebAuthn) and Cryptographic Helpers for Secondary Financial Security
 */

// Helper to convert ArrayBuffer to Base64URL string
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper to convert Base64URL string to Uint8Array
export function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper to generate a unique random cryptographic salt (16 bytes, Base64URL encoded)
export function generatePinSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const saltBytes = new Uint8Array(16);
    window.crypto.getRandomValues(saltBytes);
    return bufferToBase64Url(saltBytes.buffer);
  }
  return 'neyrunway_salt_' + Math.random().toString(36).substring(2, 15);
}

// SHA-256 PIN Hashing with individual or legacy salt
export async function hashPin(pin: string, salt: string = 'neyrunway_pin_salt_v1'): Promise<string> {
  const effectiveSalt = salt || 'neyrunway_pin_salt_v1';
  const msgUint8 = new TextEncoder().encode(effectiveSalt + ':' + pin.trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Legacy verification helper to verify old hashes (which were hashed without colon)
export async function legacyHashPin(pin: string, salt: string = 'neyrunway_pin_salt_v1'): Promise<string> {
  const msgUint8 = new TextEncoder().encode(salt + pin.trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Check if Platform Biometrics (Touch ID, Face ID, Windows Hello, Android Biometrics) are supported
export async function checkBiometricsSupport(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (
      window.PublicKeyCredential &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    }
  } catch (err) {
    console.warn('Biometrics check error:', err);
  }
  return false;
}

// Register Platform Biometrics Credential via WebAuthn
export async function registerBiometricCredential(
  userId: string,
  userDisplayName: string
): Promise<{ credentialId: string; success: boolean; error?: string }> {
  try {
    const isSupported = await checkBiometricsSupport();
    if (!isSupported) {
      return {
        credentialId: '',
        success: false,
        error: 'Biometrics are not supported on this browser or platform authenticator is unavailable.',
      };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Create user ID buffer
    const encoder = new TextEncoder();
    const userIdBuffer = encoder.encode(userId.slice(0, 32));

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Neyrunway Financial Guard',
        id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      },
      user: {
        id: userIdBuffer,
        name: userDisplayName || 'student@neyrunway.app',
        displayName: userDisplayName || 'Neyrunway Student',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Built-in platform biometric (TouchID/FaceID/Windows Hello)
        userVerification: 'preferred',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { credentialId: '', success: false, error: 'Registration cancelled.' };
    }

    const credentialId = bufferToBase64Url(credential.rawId);
    return { credentialId, success: true };
  } catch (err: any) {
    console.warn('WebAuthn register error:', err);
    return {
      credentialId: '',
      success: false,
      error: err?.message || 'Failed to enroll biometrics on this device.',
    };
  }
}

// Verify Platform Biometrics Credential via WebAuthn
export async function verifyBiometricCredential(
  credentialId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credentialId) {
      try {
        const rawId = base64UrlToBuffer(credentialId);
        allowCredentials.push({
          id: rawId,
          type: 'public-key',
          transports: ['internal'],
        });
      } catch {
        // Fallback with empty allowCredentials
      }
    }

    const publicKeyRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      userVerification: 'preferred',
      timeout: 60000,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyRequestOptions,
    })) as PublicKeyCredential | null;

    if (assertion && assertion.id) {
      return { success: true };
    }

    return { success: false, error: 'Biometric verification failed or was cancelled.' };
  } catch (err: any) {
    console.warn('WebAuthn authentication error:', err);
    return {
      success: false,
      error: err?.message || 'Biometric authentication was cancelled or not recognized.',
    };
  }
}
