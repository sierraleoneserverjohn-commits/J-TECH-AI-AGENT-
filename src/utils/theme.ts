/**
 * Accent theme configuration and manager
 * Options: Cyan (default), Purple, Green, Red.
 */

export type AccentTheme = 'cyan' | 'purple' | 'green' | 'red';

export interface ThemeColors {
  primary: string;
  glow: string;
  soft: string;
  gradientFrom: string;
  ring: string;
}

export const THEMES: Record<AccentTheme, ThemeColors> = {
  cyan: {
    primary: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.45)',
    soft: 'rgba(0, 240, 255, 0.15)',
    gradientFrom: '#00f0ff',
    ring: '#38bdf8',
  },
  purple: {
    primary: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.5)',
    soft: 'rgba(192, 132, 252, 0.18)',
    gradientFrom: '#c084fc',
    ring: '#a855f7',
  },
  green: {
    primary: '#34d399',
    glow: 'rgba(52, 211, 153, 0.5)',
    soft: 'rgba(52, 211, 153, 0.18)',
    gradientFrom: '#34d399',
    ring: '#10b981',
  },
  red: {
    primary: '#f87171',
    glow: 'rgba(248, 113, 113, 0.5)',
    soft: 'rgba(248, 113, 113, 0.18)',
    gradientFrom: '#f87171',
    ring: '#ef4444',
  },
};

export function getSavedTheme(): AccentTheme {
  if (typeof window === 'undefined') return 'cyan';
  const saved = localStorage.getItem('jexa_accent_theme') as AccentTheme;
  if (saved && THEMES[saved]) return saved;
  return 'cyan';
}

export function applyTheme(theme: AccentTheme): void {
  if (typeof document === 'undefined') return;
  localStorage.setItem('jexa_accent_theme', theme);
  const colors = THEMES[theme];
  const root = document.documentElement;

  root.style.setProperty('--jexa-accent', colors.primary);
  root.style.setProperty('--jexa-accent-glow', colors.glow);
  root.style.setProperty('--jexa-accent-soft', colors.soft);
  root.style.setProperty('--jexa-accent-ring', colors.ring);
  
  // Set theme data-theme attribute
  root.setAttribute('data-theme', theme);
}
