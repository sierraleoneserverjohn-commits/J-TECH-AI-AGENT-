import React, { useState, useEffect } from 'react';
import { Smartphone, Maximize, RotateCcw, AlertCircle } from 'lucide-react';

interface OrientationLockOverlayProps {
  onDismiss?: () => void;
}

export const OrientationLockOverlay: React.FC<OrientationLockOverlayProps> = ({ onDismiss }) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const checkOrientation = () => {
      // If window height > width, user is in portrait orientation
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleEnterLandscapeFullscreen = async () => {
    try {
      setErrorMessage('');
      // 1. Request fullscreen
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }

      // 2. Lock orientation if supported by browser/device
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape').catch((e: any) => {
          console.warn('Orientation lock notice:', e?.message);
        });
      }
    } catch (err: any) {
      console.warn('Fullscreen/orientation notice:', err);
      setErrorMessage('Please physically rotate your phone horizontally for optimal HUD command mode.');
    }
  };

  if (!isPortrait) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#06090f]/98 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center text-slate-100 font-mono animate-in fade-in duration-200">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center glow-cyan-md">
          <Smartphone className="w-12 h-12 text-cyan-400 animate-spin [animation-duration:6s]" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center">
          <RotateCcw className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
        </div>
      </div>

      <h2 className="text-xl font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-white">
        Rotate Your Device
      </h2>

      <p className="mt-3 text-xs text-slate-400 max-w-xs leading-relaxed">
        JEXA is architected strictly as a landscape-first personal AI command centre. Please turn your phone horizontally.
      </p>

      {errorMessage && (
        <p className="mt-3 text-[11px] text-amber-300/90 flex items-center gap-1.5 max-w-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{errorMessage}</span>
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleEnterLandscapeFullscreen}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-95 transition-all min-h-[48px]"
        >
          <Maximize className="w-4 h-4" />
          Enter Fullscreen & Lock Landscape
        </button>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs border border-slate-800 transition-colors min-h-[44px]"
          >
            Continue in Windowed Preview
          </button>
        )}
      </div>
    </div>
  );
};
