/**
 * Web Audio API Sci-Fi Sound Synthesizer
 * Synthesizes subtle futuristic tones for listening, completed, and error.
 * Off by default per user specification.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export type SoundCueType = 'listening' | 'completed' | 'error';

export function playSciFiSound(type: SoundCueType): void {
  // Off by default
  const enabled = typeof window !== 'undefined' && localStorage.getItem('jexa_sound_enabled') === 'true';
  if (!enabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'listening') {
      // Soft rising sci-fi chirp: 520Hz -> 880Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'completed') {
      // Futuristic double chime: 660Hz -> 990Hz
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.setValueAtTime(987.77, now + 0.09); // B5

      osc2.frequency.setValueAtTime(1318.5, now); // E6 harmonic
      osc2.frequency.setValueAtTime(1975.5, now + 0.09);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.23);
      osc2.stop(now + 0.23);
    } else if (type === 'error') {
      // Low glitch warning buzz: 220Hz -> 140Hz with fast warble
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.18);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.21);
    }
  } catch {
    // Audio synthesis ignored if blocked by autoplay
  }
}
