/**
 * Haptic feedback utility using navigator.vibrate
 * Safe for all browsers, honors user preference in localStorage.
 */

export type HapticType = 'listening' | 'completed' | 'error';

export function triggerHaptic(type: HapticType): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  const enabled = localStorage.getItem('jexa_haptics_enabled') !== 'false';
  if (!enabled) return;

  try {
    switch (type) {
      case 'listening':
        // Short crisp buzz on listening start
        navigator.vibrate(40);
        break;
      case 'completed':
        // Positive confirmation buzz
        navigator.vibrate([35, 30, 45]);
        break;
      case 'error':
        // Double warning buzz
        navigator.vibrate([60, 40, 60]);
        break;
    }
  } catch {
    // Vibration ignored if blocked by browser policy
  }
}
