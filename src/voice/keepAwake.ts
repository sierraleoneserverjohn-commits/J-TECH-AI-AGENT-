import { KeepAwake } from '@capacitor-community/keep-awake';

let sentinel: any = null;
let isAwake = false;

/**
 * Screen Keep-Awake Manager
 * Uses @capacitor-community/keep-awake on native Android/iOS and
 * navigator.wakeLock on modern web browsers to keep screen active
 * while always-listening is enabled.
 */
export async function enableKeepAwake(): Promise<boolean> {
  if (isAwake) return true;

  try {
    // 1. Capacitor native keep awake
    if (typeof (KeepAwake as any)?.keepAwake === 'function') {
      await KeepAwake.keepAwake();
      isAwake = true;
      return true;
    }
  } catch (nativeErr) {
    // Fallback to web wakeLock
  }

  // 2. Web WakeLock API fallback
  try {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      sentinel = await (navigator as any).wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        if (isAwake) {
          // Re-request if still intended to be awake
          enableKeepAwake().catch(() => {});
        }
      });
      isAwake = true;
      return true;
    }
  } catch (webErr) {
    console.warn('[KeepAwake] Web screen wake lock unavailable:', webErr);
  }

  return false;
}

export async function disableKeepAwake(): Promise<void> {
  isAwake = false;

  try {
    if (typeof (KeepAwake as any)?.allowSleep === 'function') {
      await KeepAwake.allowSleep();
    }
  } catch (nativeErr) {
    // Ignore
  }

  try {
    if (sentinel) {
      await sentinel.release();
      sentinel = null;
    }
  } catch (webErr) {
    // Ignore
  }
}

export function isKeepAwakeActive(): boolean {
  return isAwake;
}
