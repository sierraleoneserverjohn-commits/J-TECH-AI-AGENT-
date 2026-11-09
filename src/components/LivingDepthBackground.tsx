import React, { useEffect, useRef } from 'react';
import { OrbState } from '../events/eventBus';

interface LivingDepthBackgroundProps {
  state: OrbState;
}

const STATE_AURORA_COLORS: Record<OrbState, string> = {
  idle: 'rgba(0, 240, 255, 0.12)',
  listening: 'rgba(16, 185, 129, 0.18)',
  understanding: 'rgba(56, 189, 248, 0.16)',
  thinking: 'rgba(168, 85, 247, 0.18)',
  reasoning: 'rgba(192, 132, 252, 0.18)',
  searching: 'rgba(245, 158, 11, 0.16)',
  accessing_database: 'rgba(6, 182, 212, 0.16)',
  running_tools: 'rgba(249, 115, 22, 0.18)',
  calling_provider: 'rgba(56, 189, 248, 0.16)',
  working: 'rgba(249, 115, 22, 0.18)',
  executing: 'rgba(249, 115, 22, 0.18)',
  typing: 'rgba(224, 242, 254, 0.14)',
  chatting: 'rgba(0, 240, 255, 0.14)',
  speaking: 'rgba(0, 240, 255, 0.20)',
  completed: 'rgba(34, 197, 94, 0.22)',
  error: 'rgba(239, 68, 68, 0.22)',
};

export const LivingDepthBackground: React.FC<LivingDepthBackgroundProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isBatterySaver = localStorage.getItem('jexa_battery_saver') === 'true';
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Drifting dust particles
    const particleCount = isBatterySaver ? 20 : 45;
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.6,
      speedY: -(Math.random() * 0.35 + 0.1),
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.45 + 0.15,
      pulseSpeed: Math.random() * 0.02 + 0.01,
      phase: Math.random() * Math.PI * 2,
    }));

    let animId: number;
    let lastTime = 0;
    const frameInterval = isBatterySaver ? 1000 / 30 : 0;

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (document.hidden) return;

      if (frameInterval > 0) {
        const delta = time - lastTime;
        if (delta < frameInterval) return;
        lastTime = time - (delta % frameInterval);
      }

      ctx.clearRect(0, 0, width, height);

      // Render dust particles
      const motionScale = prefersReducedMotion ? 0.2 : 1.0;
      for (const p of particles) {
        p.y += p.speedY * motionScale;
        p.x += p.speedX * motionScale;
        p.phase += p.pulseSpeed;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const currentOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.phase));

        ctx.fillStyle = `rgba(180, 230, 255, ${currentOpacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const auroraColor = STATE_AURORA_COLORS[state] || STATE_AURORA_COLORS.idle;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* 1. Deep Space Multi-Stop Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020408] via-[#05080f] to-[#040916]" />

      {/* 2. Soft Dynamic Aurora Glow Reacting to Orb State */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[90px] transition-all duration-700 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${auroraColor} 0%, rgba(5,8,15,0) 70%)`,
        }}
      />

      {/* 3. Faint Moving Perspective Grid Floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[48%] overflow-hidden opacity-30 pointer-events-none">
        <div
          className="w-[200%] h-[200%] -left-[50%] absolute bottom-0 perspective-grid animate-grid-drift motion-reduce:animate-none"
          style={{
            transform: 'rotateX(72deg) translateY(-25%)',
            backgroundImage: `
              linear-gradient(to right, rgba(0, 240, 255, 0.22) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 240, 255, 0.22) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)',
          }}
        />
      </div>

      {/* 4. Drifting Dust Particles Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* 5. Vignette Corner Shading */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 120px rgba(2, 4, 8, 0.85)',
        }}
      />
    </div>
  );
};
