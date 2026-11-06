import React, { useEffect, useRef, useState } from 'react';
import { OrbState } from '../events/eventBus';
import { ActivityChip, ActiveProviderUsage } from '../events/useJexaStore';
import { Mic, MicOff, AlertCircle, Sparkles, Activity, Server, Database, Globe, Wrench } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { playSciFiSound } from '../utils/soundCues';

interface HolographicGlobeProps {
  state: OrbState;
  orbMessage?: string;
  reasoningLine?: string;
  activityChips?: ActivityChip[];
  activeProviderUsage?: ActiveProviderUsage | null;
  audioLevel?: number;
  isListening?: boolean;
  onMicClick?: () => void;
  onOpenCommandPalette?: () => void;
  width?: number;
  height?: number;
}

// State color schemes [R, G, B]
const STATE_COLORS: Record<OrbState, [number, number, number]> = {
  idle: [0, 240, 255], // Theme cyan
  listening: [16, 185, 129], // Green-cyan
  understanding: [56, 189, 248], // Ice electric cyan
  thinking: [168, 85, 247], // Purple-blue
  reasoning: [192, 132, 252], // Concentric violet
  searching: [245, 158, 11], // Amber gold
  accessing_database: [6, 182, 212], // Cyan-database blue
  running_tools: [249, 115, 22], // Bright orange
  calling_provider: [56, 189, 248], // Sky-blue pulse
  working: [249, 115, 22], // Orange
  executing: [249, 115, 22], // Orange
  typing: [224, 242, 254], // Luminous white-cyan
  chatting: [0, 240, 255], // Cyan
  speaking: [0, 240, 255], // Cyan
  completed: [34, 197, 94], // Emerald green shockwave
  error: [239, 68, 68], // Crimson red flicker
};

export const HolographicGlobe: React.FC<HolographicGlobeProps> = ({
  state,
  orbMessage = '',
  reasoningLine = '',
  activityChips = [],
  activeProviderUsage = null,
  audioLevel = 0,
  isListening = false,
  onMicClick,
  onOpenCommandPalette,
  width = 360,
  height = 230,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const prevStateRef = useRef<OrbState>(state);

  // Long press timer for mic button
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef<boolean>(false);

  // Sound and haptic cue trigger on real state transitions
  useEffect(() => {
    if (prevStateRef.current !== state) {
      if (state === 'listening') {
        triggerHaptic('listening');
        playSciFiSound('listening');
      } else if (state === 'completed') {
        triggerHaptic('completed');
        playSciFiSound('completed');
      } else if (state === 'error') {
        triggerHaptic('error');
        playSciFiSound('error');
      }
      prevStateRef.current = state;
    }
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let shockwaveRadius = 0;
    let errorFlickerTime = 0;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Color transition interpolation (400ms smooth blend)
    let curR = STATE_COLORS[state][0];
    let curG = STATE_COLORS[state][1];
    let curB = STATE_COLORS[state][2];

    // Particles for understanding inward drift
    const inwardParticles = Array.from({ length: 32 }, () => ({
      dist: 55 + Math.random() * 40,
      angle: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.4,
      size: 1 + Math.random() * 1.5,
    }));

    // Particles for thinking vortex
    const vortexParticles = Array.from({ length: 28 }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: 8 + Math.random() * 38,
      speed: 0.03 + Math.random() * 0.05,
      size: 1.2 + Math.random() * 1.6,
    }));

    // Data dots for database stream
    const dbDots = Array.from({ length: 20 }, () => ({
      y: Math.random() * 50,
      xOffset: (Math.random() - 0.5) * 16,
      speed: 1.2 + Math.random() * 1.8,
      size: 1.2 + Math.random() * 1.5,
    }));

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = () => {
      time += prefersReducedMotion ? 0.005 : 0.025;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height * 0.43;
      const sphereRadius = 52;

      // 400ms Smooth Color Interpolation
      const targetRGB = STATE_COLORS[state] || [0, 240, 255];
      const lerpFactor = prefersReducedMotion ? 0.2 : 0.08;
      curR += (targetRGB[0] - curR) * lerpFactor;
      curG += (targetRGB[1] - curG) * lerpFactor;
      curB += (targetRGB[2] - curB) * lerpFactor;

      const baseR = Math.round(curR);
      const baseG = Math.round(curG);
      const baseB = Math.round(curB);

      // Handle error flicker
      let alphaMultiplier = 1;
      if (state === 'error') {
        errorFlickerTime += 0.05;
        if (errorFlickerTime < 0.8) {
          alphaMultiplier = Math.sin(time * 35) > 0 ? 1 : 0.45;
        }
      } else {
        errorFlickerTime = 0;
      }

      const colorAlpha = (a: number) =>
        `rgba(${baseR}, ${baseG}, ${baseB}, ${Math.min(1, Math.max(0, a * alphaMultiplier))})`;

      // 1. GLOWING CIRCULAR PLATFORM
      const platformY = cy + sphereRadius + 18;
      const platformRX = 78;
      const platformRY = 20;

      ctx.save();
      // Platform base gradient
      const platGrad = ctx.createRadialGradient(cx, platformY, 4, cx, platformY, platformRX + 15);
      platGrad.addColorStop(0, colorAlpha(0.28));
      platGrad.addColorStop(0.7, colorAlpha(0.04));
      platGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = platGrad;
      ctx.beginPath();
      ctx.ellipse(cx, platformY, platformRX + 15, platformRY + 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Platform ripples: speaking ripples vigorously; completed ripples shockwave; idle gentle
      const rippleSpeed = state === 'speaking' ? 2.5 : 0.6;
      for (let r = 1; r <= 3; r++) {
        const rippleFactor = ((time * rippleSpeed + r * 0.33) % 1);
        const curRX = platformRX * rippleFactor;
        const curRY = platformRY * rippleFactor;
        const alpha = (1 - rippleFactor) * (state === 'speaking' ? 0.6 : 0.35);

        ctx.strokeStyle = colorAlpha(alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, platformY, curRX, curRY, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Platform rim
      ctx.strokeStyle = colorAlpha(0.5);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(cx, platformY, platformRX, platformRY, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 2. DYNAMIC SPHERE RADIUS & BREATHING
      // Idle: 8-second slow breathing cycle, no fast jitter
      let breath = 0;
      if (state === 'idle') {
        breath = Math.sin(time * (Math.PI * 2 / 8)) * 2.2;
      } else if (state === 'listening') {
        // Pulses with live microphone volume
        breath = audioLevel * 14;
      } else if (state === 'understanding') {
        // Wireframe tightens: radius slightly contracts
        breath = -3 + Math.sin(time * 2) * 1;
      } else {
        breath = Math.sin(time * 2) * 1.8;
      }

      const currentRadius = Math.max(30, sphereRadius + breath);

      // Core radial glow
      ctx.save();
      const coreGrad = ctx.createRadialGradient(cx, cy, 3, cx, cy, currentRadius + 14);
      coreGrad.addColorStop(0, colorAlpha(0.3));
      coreGrad.addColorStop(0.7, colorAlpha(0.08));
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius + 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. 3D WIREFRAME SPHERE
      // Idle: NO rotation per user spec! Other states rotate smoothly.
      const rotY =
        state === 'idle' || prefersReducedMotion
          ? 0.4
          : time * (state === 'running_tools' ? 1.6 : 0.65);
      const tiltX = state === 'thinking' ? 0.32 + Math.sin(time * 1.5) * 0.15 : 0.28;

      ctx.save();
      // Longitude rings
      const numLongitudes = state === 'understanding' ? 8 : 6;
      for (let l = 0; l < numLongitudes; l++) {
        const lonAngle = rotY + (l * Math.PI) / numLongitudes;
        const scaleX = Math.cos(lonAngle);

        ctx.strokeStyle = colorAlpha(0.18 + Math.abs(scaleX) * 0.28);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          Math.abs(scaleX) * currentRadius,
          currentRadius * 0.96,
          tiltX,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      // Latitude rings
      for (let lat = -2; lat <= 2; lat++) {
        const latY = cy + (lat * currentRadius) / 3;
        const latRadius = Math.sqrt(
          Math.max(0, currentRadius * currentRadius - (latY - cy) * (latY - cy))
        );
        ctx.strokeStyle = colorAlpha(0.22);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(cx, latY, latRadius, latRadius * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 4. ORBIT RING & PROVIDER INITIAL
      ctx.save();
      const ringRX = currentRadius * 1.48;
      const ringRY = currentRadius * 0.54;
      const ringTilt = state === 'thinking' ? -0.25 + Math.sin(time) * 0.1 : -0.2;

      ctx.strokeStyle = colorAlpha(0.32);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ringRX, ringRY, ringTilt, 0, Math.PI * 2);
      ctx.stroke();

      // Tracing photon
      const tracerAngle = time * (state === 'idle' ? 0.4 : 1.8);
      const tx = cx + Math.cos(tracerAngle) * ringRX;
      const ty = cy + Math.sin(tracerAngle) * ringRY;

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = colorAlpha(0.9);
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(tx, ty, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // EXTRA FEATURE: Provider Ring Logo & Latency
      // Small provider logo or initial appears on orbit ring only while in use
      if (activeProviderUsage && activeProviderUsage.active) {
        const provAngle = Math.PI * 0.25;
        const px = cx + Math.cos(provAngle) * ringRX;
        const py = cy + Math.sin(provAngle) * ringRY;

        // Node badge
        ctx.save();
        ctx.fillStyle = 'rgba(7, 19, 36, 0.95)';
        ctx.strokeStyle = colorAlpha(0.9);
        ctx.lineWidth = 1.5;
        ctx.shadowColor = colorAlpha(0.8);
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Initial
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Chakra Petch, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = activeProviderUsage.name.charAt(0).toUpperCase();
        ctx.fillText(initial, px, py);

        // Latency tag underneath
        const latencyText = activeProviderUsage.latencyMs
          ? `${activeProviderUsage.latencyMs}ms`
          : 'Active';
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.fillStyle = colorAlpha(0.95);
        ctx.fillText(latencyText, px, py + 16);
        ctx.restore();
      }
      ctx.restore();

      // 5. STATE-SPECIFIC REAL VISUALS
      ctx.save();

      // UNDERSTANDING: wireframe particles drift inward toward center
      if (state === 'understanding') {
        inwardParticles.forEach((p) => {
          p.dist -= p.speed;
          if (p.dist < 6) p.dist = currentRadius + 30;
          const px = cx + Math.cos(p.angle) * p.dist;
          const py = cy + Math.sin(p.angle) * (p.dist * 0.7);
          ctx.fillStyle = colorAlpha(0.85);
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // THINKING: particles swirl inside globe
      else if (state === 'thinking') {
        vortexParticles.forEach((p) => {
          p.angle += p.speed;
          const px = cx + Math.cos(p.angle) * p.distance;
          const py = cy + Math.sin(p.angle) * (p.distance * 0.6);
          ctx.fillStyle = colorAlpha(0.9);
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // REASONING: concentric rings pulse outward from core
      else if (state === 'reasoning') {
        for (let ring = 0; ring < 3; ring++) {
          const rProgress = ((time * 0.8 + ring * 0.33) % 1);
          const rRadius = rProgress * (currentRadius * 0.85);
          const rAlpha = (1 - rProgress) * 0.85;

          ctx.strokeStyle = colorAlpha(rAlpha);
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(cx, cy, rRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // SEARCHING: amber radar sweep + laser lines to edge
      else if (state === 'searching') {
        const sweepAngle = time * 2.8;
        const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentRadius * 0.8);
        sweepGrad.addColorStop(0, colorAlpha(0.6));
        sweepGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, currentRadius * 0.8, sweepAngle, sweepAngle + Math.PI * 0.45);
        ctx.closePath();
        ctx.fill();

        // Thin lines shooting out to edge of canvas
        for (let l = 0; l < 4; l++) {
          const lAngle = sweepAngle + l * (Math.PI / 2);
          const endX = cx + Math.cos(lAngle) * width;
          const endY = cy + Math.sin(lAngle) * height;
          ctx.strokeStyle = colorAlpha(0.2);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }

      // ACCESSING DATABASE: stream of data dots flows from globe down into platform
      else if (state === 'accessing_database') {
        dbDots.forEach((dot) => {
          dot.y = (dot.y + dot.speed) % (platformY - cy);
          const px = cx + dot.xOffset;
          const py = cy + 10 + dot.y;
          const alpha = 1 - dot.y / (platformY - cy);
          ctx.fillStyle = colorAlpha(alpha);
          ctx.beginPath();
          ctx.arc(px, py, dot.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // RUNNING TOOLS / WORKING / EXECUTING: orange fast segmented rings with progress arc
      else if (state === 'running_tools' || state === 'working' || state === 'executing') {
        const segRot = time * 3.5;
        for (let i = 0; i < 6; i++) {
          const a1 = segRot + (i / 6) * Math.PI * 2;
          const a2 = a1 + (Math.PI * 2 / 6) * 0.6;
          ctx.strokeStyle = colorAlpha(0.85);
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, currentRadius * 0.55, a1, a2);
          ctx.stroke();
        }

        // Progress arc around outer globe
        const arcAngle = (time * 1.5) % (Math.PI * 2);
        ctx.strokeStyle = colorAlpha(0.95);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, currentRadius * 0.85, arcAngle, arcAngle + Math.PI * 0.7);
        ctx.stroke();
      }

      // CALLING PROVIDER: glowing pulse travels toward left AI network panel
      else if (state === 'calling_provider') {
        const pulseProgress = (time * 2.2) % 1;
        const pulseX = cx - pulseProgress * (width * 0.48);
        const pulseY = cy + Math.sin(time * 4) * 8;
        ctx.fillStyle = colorAlpha(1);
        ctx.shadowColor = colorAlpha(0.9);
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = colorAlpha(0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(0, cy);
        ctx.stroke();
      }

      // TYPING: three bouncing dots inside globe
      else if (state === 'typing') {
        [-14, 0, 14].forEach((offset, idx) => {
          const bounce = Math.sin(time * 5 + idx * 0.8) * 5;
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = colorAlpha(0.8);
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(cx + offset, cy + bounce, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // SPEAKING / CHATTING: waveform inside globe follows speech & platform ripples
      else if (state === 'speaking' || state === 'chatting') {
        const barCount = 11;
        const totalW = currentRadius * 0.62;
        const barW = 2.4;
        const gap = (totalW - barCount * barW) / (barCount - 1);
        const startX = cx - totalW / 2;

        for (let i = 0; i < barCount; i++) {
          const heightFactor = Math.abs(Math.sin(time * 6 + i * 0.55)) * 0.85;
          const barH = Math.max(4, heightFactor * 22);
          const bx = startX + i * (barW + gap);
          const by = cy - barH / 2;

          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = colorAlpha(0.8);
          ctx.shadowBlur = 5;
          ctx.fillRect(bx, by, barW, barH);
        }
      }

      // COMPLETED: green shockwave ring, then return to idle
      else if (state === 'completed') {
        shockwaveRadius += 3.5;
        if (shockwaveRadius > width * 0.6) {
          shockwaveRadius = width * 0.6;
        }
        const shockAlpha = Math.max(0, 1 - shockwaveRadius / (width * 0.6));
        ctx.strokeStyle = `rgba(34, 197, 94, ${shockAlpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, shockwaveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // IDLE or LISTENING fallback waveform
      else {
        shockwaveRadius = 0;
        const barCount = 9;
        const totalW = currentRadius * 0.58;
        const barW = 2.2;
        const gap = (totalW - barCount * barW) / (barCount - 1);
        const startX = cx - totalW / 2;

        for (let i = 0; i < barCount; i++) {
          let heightFactor = 0.15;
          if (state === 'listening') {
            heightFactor = Math.max(0.15, audioLevel * 1.6 * Math.sin(time * 6 + i));
          } else {
            // Idle gentle 8s breathing wave
            heightFactor = Math.sin(time * 0.8 + i * 0.4) * 0.15 + 0.22;
          }

          const barH = Math.max(3, heightFactor * 18);
          const bx = startX + i * (barW + gap);
          const by = cy - barH / 2;

          ctx.fillStyle = colorAlpha(0.85);
          ctx.fillRect(bx, by, barW, barH);
        }
      }

      ctx.restore();

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [state, audioLevel, width, height, activeProviderUsage]);

  // Clean formatted state display names
  const stateLabels: Record<OrbState, string> = {
    idle: 'Idle • Standby',
    listening: 'Listening Live...',
    understanding: 'Understanding Directive...',
    thinking: 'Synthesizing Thought...',
    reasoning: 'Deep Reasoning...',
    searching: 'Searching Knowledge Nodes...',
    accessing_database: 'Accessing Database...',
    running_tools: 'Running Active Tools...',
    calling_provider: 'Connecting to Provider...',
    working: 'Executing Routines...',
    executing: 'Executing Task...',
    typing: 'Drafting Response...',
    chatting: 'Responding...',
    speaking: 'Speaking Response...',
    completed: 'Routine Completed',
    error: 'System Anomaly Detected',
  };

  // Mic Button Pointer handlers for tap vs. long press
  const handleMicPointerDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      triggerHaptic('listening');
      if (onOpenCommandPalette) {
        onOpenCommandPalette();
      }
    }, 500); // 500ms long-press threshold
  };

  const handleMicPointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isLongPress.current && onMicClick) {
      onMicClick();
    }
    isLongPress.current = false;
  };

  const handleMicPointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    isLongPress.current = false;
  };

  // Icon mapping for dynamic activity chips
  const getActivityIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('search')) return Globe;
    if (l.includes('database') || l.includes('memory')) return Database;
    if (l.includes('tool') || l.includes('calc')) return Wrench;
    if (l.includes('provider') || l.includes('gemini')) return Server;
    return Activity;
  };

  return (
    <div className="relative flex flex-col items-center justify-between select-none w-full max-w-[390px] h-full py-1">
      {/* 1. DYNAMIC ACTIVITY CHIPS (Shows ONLY while activity is really happening!) */}
      <div className="w-full flex items-center justify-center gap-1.5 px-2 min-h-[26px] shrink-0">
        {activityChips.map((chip) => {
          const Icon = getActivityIcon(chip.label);
          return (
            <div
              key={chip.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/70 text-cyan-200 text-[9.5px] font-mono shadow-[0_0_12px_rgba(0,240,255,0.45)] transition-all duration-300 animate-in fade-in zoom-in-95 ${
                chip.active ? 'animate-pulse scale-100' : 'opacity-0 scale-90'
              }`}
            >
              <Icon className="w-3 h-3 text-cyan-300 shrink-0" />
              <span className="truncate max-w-[120px]">{chip.label}</span>
            </div>
          );
        })}
      </div>

      {/* 2. HOLOGRAPHIC CANVAS AREA */}
      <div className="relative flex-1 flex items-center justify-center min-h-[165px] max-h-[210px] w-full">
        <canvas
          ref={canvasRef}
          style={{ width: `${width}px`, height: `${height}px` }}
          className="pointer-events-none"
        />
      </div>

      {/* 3. JEXA AI CORE LABEL & STATE NAME UNDER THE GLOBE */}
      <div className="flex flex-col items-center shrink-0 mb-1 z-10">
        <span className="text-[10px] font-heading font-bold tracking-[0.25em] text-cyan-200 text-glow-cyan uppercase opacity-95">
          JEXA AI CORE
        </span>

        {/* State name under the core label */}
        <div className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/35 text-[9px] font-mono text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.2)]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state === 'error'
                ? 'bg-rose-500 animate-ping'
                : state === 'listening'
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-cyan-400'
            }`}
          />
          <span className="uppercase tracking-wider">{stateLabels[state]}</span>
        </div>

        {/* EXTRA FEATURE 1: Live Reasoning Line */}
        {reasoningLine ? (
          <div className="mt-1 text-[9px] font-mono text-cyan-300/90 text-center px-2 max-w-[280px] truncate animate-in fade-in duration-300">
            {reasoningLine}
          </div>
        ) : state === 'error' && orbMessage ? (
          <div className="mt-1 flex items-center gap-1 text-[9px] font-mono text-rose-300 text-center px-2 max-w-[280px] truncate">
            <AlertCircle className="w-2.5 h-2.5 shrink-0 text-rose-400" />
            <span className="truncate">{orbMessage}</span>
          </div>
        ) : null}
      </div>

      {/* 4. MIC BUTTON IN GLASS BAR WITH WAVEFORMS (Always visible at bottom) */}
      <div className="w-full max-w-[330px] px-2.5 py-1 rounded-xl hud-corner-box flex items-center justify-between border border-cyan-500/35 glow-cyan-border shrink-0">
        {/* Left mini waveform */}
        <div className="flex items-center gap-0.5 h-4 w-11 justify-end">
          {[4, 10, 14, 8, 12, 6].map((h, i) => (
            <span
              key={`lw-${i}`}
              className="w-1 bg-cyan-400/80 rounded-full transition-all duration-75"
              style={{
                height: isListening
                  ? `${Math.max(3, h * (audioLevel * 1.5 + 0.3))}px`
                  : `${h * 0.35 + 2}px`,
              }}
            />
          ))}
        </div>

        {/* Central Large Mic Button with Long-Press for Command Palette */}
        <button
          type="button"
          onPointerDown={handleMicPointerDown}
          onPointerUp={handleMicPointerUp}
          onPointerLeave={handleMicPointerLeave}
          onContextMenu={(e) => {
            e.preventDefault();
            if (onOpenCommandPalette) onOpenCommandPalette();
          }}
          aria-label={isListening ? 'Stop listening' : 'Start microphone (Long-press for palette)'}
          title="Tap to speak, or hold 0.5s for Command Palette"
          className={`mx-1.5 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider transition-all duration-200 min-h-[44px] active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer ${
            isListening
              ? 'bg-rose-600 text-white shadow-[0_0_16px_rgba(244,63,94,0.75)] animate-pulse'
              : 'bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.35)]'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-3.5 h-3.5 text-rose-200" />
              <span>Listening...</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-cyan-300" />
              <span className="whitespace-nowrap">Tap or Hold for Palette</span>
            </>
          )}
        </button>

        {/* Right mini waveform */}
        <div className="flex items-center gap-0.5 h-4 w-11 justify-start">
          {[6, 12, 8, 14, 10, 4].map((h, i) => (
            <span
              key={`rw-${i}`}
              className="w-1 bg-cyan-400/80 rounded-full transition-all duration-75"
              style={{
                height: isListening
                  ? `${Math.max(3, h * (audioLevel * 1.5 + 0.3))}px`
                  : `${h * 0.35 + 2}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
