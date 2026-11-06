import React, { useEffect, useRef } from 'react';
import { OrbState } from '../events/eventBus';

interface VoiceOrbProps {
  state: OrbState;
  message?: string;
  audioLevel?: number;
  onClick?: () => void;
  size?: number;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  message,
  audioLevel = 0,
  onClick,
  size = 220,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Particles for thinking state
    const particles = Array.from({ length: 32 }, (_, i) => ({
      angle: (i / 32) * Math.PI * 2,
      distance: 25 + Math.random() * 35,
      speed: 0.02 + Math.random() * 0.03,
      size: 1.5 + Math.random() * 2,
    }));

    // Bouncing dots for typing state
    const dots = [
      { offset: -24, phase: 0 },
      { offset: 0, phase: Math.PI / 3 },
      { offset: 24, phase: (2 * Math.PI) / 3 },
    ];

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = () => {
      time += prefersReducedMotion ? 0.005 : 0.035;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = size * 0.36;

      // Color themes per state
      let primaryGlow = 'rgba(0, 240, 255, 0.4)';
      let secondaryGlow = 'rgba(14, 165, 233, 0.2)';
      let coreColor = 'rgba(2, 24, 43, 0.9)';
      let ringColor = 'rgba(56, 189, 248, 0.6)';

      if (state === 'error') {
        primaryGlow = 'rgba(239, 68, 68, 0.6)';
        secondaryGlow = 'rgba(185, 28, 28, 0.3)';
        coreColor = 'rgba(40, 6, 6, 0.9)';
        ringColor = 'rgba(248, 113, 113, 0.8)';
      } else if (state === 'completed') {
        primaryGlow = 'rgba(34, 197, 94, 0.6)';
        secondaryGlow = 'rgba(16, 185, 129, 0.3)';
        coreColor = 'rgba(4, 30, 18, 0.9)';
        ringColor = 'rgba(74, 222, 128, 0.8)';
      } else if (state === 'reasoning') {
        primaryGlow = 'rgba(168, 85, 247, 0.5)';
        ringColor = 'rgba(192, 132, 252, 0.7)';
      } else if (state === 'searching') {
        primaryGlow = 'rgba(6, 182, 212, 0.5)';
        ringColor = 'rgba(34, 211, 238, 0.8)';
      }

      // 1. Outer ambient breathing aura
      const breath = Math.sin(time * 1.5) * 6;
      const auraRadius = baseRadius + breath + (state === 'listening' ? audioLevel * 30 : 4);

      const auraGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.3, cx, cy, auraRadius + 28);
      auraGrad.addColorStop(0, primaryGlow);
      auraGrad.addColorStop(0.6, secondaryGlow);
      auraGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.save();
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, auraRadius + 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Base Dark Glass Sphere Core
      const coreGrad = ctx.createRadialGradient(cx - baseRadius * 0.25, cy - baseRadius * 0.25, 5, cx, cy, baseRadius);
      coreGrad.addColorStop(0, 'rgba(18, 48, 75, 0.95)');
      coreGrad.addColorStop(0.7, coreColor);
      coreGrad.addColorStop(1, 'rgba(2, 6, 12, 0.98)');

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = ringColor;
      ctx.stroke();
      ctx.restore();

      // 3. STATE-SPECIFIC ANIMATIONS
      switch (state) {
        case 'idle': {
          // Slow breathing inner pulse & subtle orbital arcs
          const idlePulse = Math.sin(time) * 4;
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius * 0.65 + idlePulse, time * 0.5, time * 0.5 + Math.PI * 1.2);
          ctx.stroke();

          ctx.beginPath();
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.3)';
          ctx.arc(cx, cy, baseRadius * 0.82 - idlePulse, -time * 0.3, -time * 0.3 + Math.PI * 0.9);
          ctx.stroke();

          // Soft central beacon
          const beaconGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
          beaconGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          beaconGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.7)');
          beaconGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = beaconGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'listening': {
          // React to live mic audio level with expanding concentric acoustic rings
          const level = Math.max(0.08, audioLevel);
          const rings = 4;
          ctx.save();
          for (let i = 1; i <= rings; i++) {
            const r = (baseRadius * 0.25) * i + level * 26 * Math.sin(time * 4 + i);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.8 - i * 0.16})`;
            ctx.lineWidth = 1.5 + level * 2.5;
            ctx.arc(cx, cy, Math.min(baseRadius - 2, Math.max(8, r)), 0, Math.PI * 2);
            ctx.stroke();
          }

          // Reactive central audio core
          const micCoreSize = 12 + level * 28;
          const micGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, micCoreSize);
          micGrad.addColorStop(0, '#ffffff');
          micGrad.addColorStop(0.5, '#00f0ff');
          micGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
          ctx.fillStyle = micGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, micCoreSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'thinking': {
          // Swirling inner particles vortex
          ctx.save();
          particles.forEach((p) => {
            p.angle += p.speed;
            const px = cx + Math.cos(p.angle) * p.distance;
            const py = cy + Math.sin(p.angle) * p.distance;

            ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
          });

          // Connecting filaments
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let i = 0; i < particles.length; i += 3) {
            const p1 = particles[i];
            const p2 = particles[(i + 4) % particles.length];
            ctx.moveTo(cx + Math.cos(p1.angle) * p1.distance, cy + Math.sin(p1.angle) * p1.distance);
            ctx.lineTo(cx + Math.cos(p2.angle) * p2.distance, cy + Math.sin(p2.angle) * p2.distance);
          }
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'reasoning': {
          // Rotating concentric rings with a pulse that moves outward
          ctx.save();
          const pulseR = ((time * 30) % baseRadius);
          
          // Outer expanding pulse
          ctx.strokeStyle = `rgba(192, 132, 252, ${1 - pulseR / baseRadius})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          // Concentric geometric rings rotating opposite directions
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius * 0.45, time * 1.2, time * 1.2 + Math.PI * 1.3);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(216, 180, 254, 0.6)';
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius * 0.7, -time * 0.9, -time * 0.9 + Math.PI * 1.4);
          ctx.stroke();

          // Center nucleus
          ctx.fillStyle = '#f3e8ff';
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'searching': {
          // 360 degree radar sweep
          ctx.save();
          const sweepAngle = time * 2.2;
          const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius - 4);
          sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0.6)');
          sweepGrad.addColorStop(1, 'rgba(6, 182, 212, 0.1)');

          ctx.fillStyle = sweepGrad;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, baseRadius - 4, sweepAngle, sweepAngle + Math.PI * 0.45);
          ctx.closePath();
          ctx.fill();

          // Sweep beam
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(sweepAngle + Math.PI * 0.45) * (baseRadius - 4), cy + Math.sin(sweepAngle + Math.PI * 0.45) * (baseRadius - 4));
          ctx.stroke();

          // Target crosshairs
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - baseRadius * 0.8, cy);
          ctx.lineTo(cx + baseRadius * 0.8, cy);
          ctx.moveTo(cx, cy - baseRadius * 0.8);
          ctx.lineTo(cx, cy + baseRadius * 0.8);
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'working':
        case 'executing': {
          // Fast segmented ring with a progress arc
          ctx.save();
          const rot = time * 3.5;
          const segments = 12;
          for (let i = 0; i < segments; i++) {
            const startA = rot + (i / segments) * Math.PI * 2;
            const endA = startA + (Math.PI * 2 / segments) * 0.55;
            ctx.beginPath();
            ctx.strokeStyle = (i % 2 === 0) ? 'rgba(56, 189, 248, 0.9)' : 'rgba(14, 165, 233, 0.4)';
            ctx.lineWidth = 4;
            ctx.arc(cx, cy, baseRadius * 0.75, startA, endA);
            ctx.stroke();
          }

          // Inner rotating gear tick
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius * 0.45, -rot * 1.5, -rot * 1.5 + Math.PI * 1.2);
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'typing': {
          // Small bouncing dots inside the orb
          ctx.save();
          dots.forEach((dot) => {
            const bounce = Math.sin(time * 4 + dot.phase) * 7;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx + dot.offset, cy + bounce, 4.5, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
          break;
        }

        case 'chatting':
        case 'speaking': {
          // Waveform bars undulating while speaking
          ctx.save();
          const barCount = 11;
          const totalWidth = baseRadius * 1.1;
          const barWidth = 4;
          const gap = (totalWidth - barCount * barWidth) / (barCount - 1);
          const startX = cx - totalWidth / 2;

          for (let i = 0; i < barCount; i++) {
            const factor = Math.sin(time * 5 + i * 0.6) * 0.5 + 0.5;
            const barHeight = 8 + factor * 32;
            const x = startX + i * (barWidth + gap);
            const y = cy - barHeight / 2;

            const barGrad = ctx.createLinearGradient(x, y, x, y + barHeight);
            barGrad.addColorStop(0, '#ffffff');
            barGrad.addColorStop(0.5, '#38bdf8');
            barGrad.addColorStop(1, '#0284c7');

            ctx.fillStyle = barGrad;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 6;
            ctx.fillRect(x, y, barWidth, barHeight);
          }
          ctx.restore();
          break;
        }

        case 'completed': {
          // Green ripple shockwave moving outward
          ctx.save();
          const ripple = (time * 45) % (baseRadius * 1.2);
          ctx.strokeStyle = `rgba(74, 222, 128, ${Math.max(0, 1 - ripple / (baseRadius * 1.2))})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, ripple, 0, Math.PI * 2);
          ctx.stroke();

          // Green checkmark / glow core
          ctx.fillStyle = '#4ade80';
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'error': {
          // Red flicker with glitch lines
          ctx.save();
          const flicker = Math.random() > 0.4 ? 1 : 0.4;
          ctx.strokeStyle = `rgba(248, 113, 113, ${flicker})`;
          ctx.lineWidth = 2;
          
          // Glitch slices
          ctx.beginPath();
          ctx.moveTo(cx - 25, cy - 8);
          ctx.lineTo(cx + 25, cy - 8);
          ctx.moveTo(cx - 30, cy + 6);
          ctx.lineTo(cx + 20, cy + 6);
          ctx.stroke();

          // Exclamation indicator
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(cx, cy - 8, 4, 0, Math.PI * 2);
          ctx.rect(cx - 3, cy - 2, 6, 14);
          ctx.arc(cx, cy + 18, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [state, audioLevel, size]);

  // Format display label
  const stateLabels: Record<OrbState, string> = {
    idle: 'Idle // Standby',
    listening: 'Listening Live',
    understanding: 'Understanding Directive',
    thinking: 'Synthesizing',
    reasoning: 'Deep Reasoning',
    searching: 'Radar Searching',
    accessing_database: 'Accessing Database',
    running_tools: 'Running Tools',
    calling_provider: 'Connecting Provider',
    working: 'Executing Routines',
    executing: 'Executing Task',
    typing: 'Drafting Response',
    chatting: 'Responding',
    speaking: 'Vocalizing Output',
    completed: 'Routine Completed',
    error: 'System Exception',
  };

  const stateColors: Record<OrbState, string> = {
    idle: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20',
    listening: 'text-cyan-300 border-cyan-400 bg-cyan-500/20 animate-pulse',
    understanding: 'text-sky-300 border-sky-400/40 bg-sky-950/30',
    thinking: 'text-sky-300 border-sky-400/40 bg-sky-950/30',
    reasoning: 'text-purple-300 border-purple-400/50 bg-purple-950/30',
    searching: 'text-amber-300 border-amber-400/50 bg-amber-950/30',
    accessing_database: 'text-cyan-300 border-cyan-400/50 bg-cyan-950/30',
    running_tools: 'text-orange-300 border-orange-400/50 bg-orange-950/30',
    calling_provider: 'text-sky-300 border-sky-400/50 bg-sky-950/30',
    working: 'text-amber-300 border-amber-400/50 bg-amber-950/30',
    executing: 'text-amber-300 border-amber-400/50 bg-amber-950/30',
    typing: 'text-blue-300 border-blue-400/40 bg-blue-950/30',
    chatting: 'text-cyan-200 border-cyan-400/60 bg-cyan-950/40',
    speaking: 'text-cyan-200 border-cyan-400/60 bg-cyan-950/40',
    completed: 'text-emerald-300 border-emerald-400/50 bg-emerald-950/30',
    error: 'text-rose-400 border-rose-500/60 bg-rose-950/40 animate-pulse',
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Voice orb status: ${stateLabels[state]}`}
      className="relative flex flex-col items-center justify-center cursor-pointer select-none group focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-full"
      style={{ width: size, height: size + 48 }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="transition-transform duration-300 group-hover:scale-105"
      />

      {/* State label under orb */}
      <div className="mt-1 flex flex-col items-center">
        <div
          className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded border transition-all ${
            stateColors[state] || stateColors.idle
          }`}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-2 animate-ping" />
          {stateLabels[state]}
        </div>
        {message && (
          <p className="mt-1 text-[10px] text-rose-400 font-mono max-w-[200px] text-center truncate">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};
