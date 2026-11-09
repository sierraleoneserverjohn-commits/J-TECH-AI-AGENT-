import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbState } from '../events/eventBus';

interface ThreeHolographicOrbProps {
  state: OrbState;
  audioLevel: number;
  width?: number;
  height?: number;
}

// Color palette mapping per state
const STATE_COLORS: Record<OrbState, THREE.Color> = {
  idle: new THREE.Color(0x00f0ff), // Cyan
  listening: new THREE.Color(0x10b981), // Green-cyan
  understanding: new THREE.Color(0x38bdf8), // Electric ice cyan
  thinking: new THREE.Color(0xa855f7), // Purple-blue
  reasoning: new THREE.Color(0xc084fc), // Concentric violet
  searching: new THREE.Color(0xf59e0b), // Amber gold
  accessing_database: new THREE.Color(0x06b6d4), // Database cyan
  running_tools: new THREE.Color(0xf97316), // Bright orange
  calling_provider: new THREE.Color(0x38bdf8), // Sky blue
  working: new THREE.Color(0xf97316), // Orange
  executing: new THREE.Color(0xf97316), // Orange
  typing: new THREE.Color(0xe0f2fe), // Luminous ice
  chatting: new THREE.Color(0x00f0ff), // Cyan
  speaking: new THREE.Color(0x00f0ff), // Cyan
  completed: new THREE.Color(0x22c55e), // Emerald shockwave
  error: new THREE.Color(0xef4444), // Crimson flicker
};

export const ThreeHolographicOrb: React.FC<ThreeHolographicOrbProps> = ({
  state,
  audioLevel,
  width = 320,
  height = 170,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<OrbState>(state);
  const audioLevelRef = useRef<number>(audioLevel);

  stateRef.current = state;
  audioLevelRef.current = audioLevel;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isBatterySaver = localStorage.getItem('jexa_battery_saver') === 'true';
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Scene, Camera, WebGLRenderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    // Position camera to fit the 55% height comfortably with outer rings
    camera.position.z = 5.6;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isBatterySaver,
      powerPreference: 'high-performance',
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);

    container.appendChild(renderer.domElement);

    // 2. Glowing Gradient Core Texture (Cyan-to-white radial gradient with soft falloff)
    const createGlowingCoreTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const radGrad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        radGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        radGrad.addColorStop(0.2, 'rgba(207, 250, 254, 0.95)');
        radGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.7)');
        radGrad.addColorStop(0.7, 'rgba(0, 240, 255, 0.25)');
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, 128, 128);
      }
      return new THREE.CanvasTexture(canvas);
    };

    const coreTexture = createGlowingCoreTexture();

    // Secondary soft bloom texture for outer halo
    const createBloomTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const radGrad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.6)');
        radGrad.addColorStop(0.4, 'rgba(0, 168, 255, 0.25)');
        radGrad.addColorStop(0.8, 'rgba(2, 132, 199, 0.08)');
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, 128, 128);
      }
      return new THREE.CanvasTexture(canvas);
    };

    const bloomTexture = createBloomTexture();

    // 3. Glowing Gradient Core Sprite (Replaces flat opaque white disc)
    const coreMat = new THREE.SpriteMaterial({
      map: coreTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      color: 0xffffff,
    });
    const coreSprite = new THREE.Sprite(coreMat);
    coreSprite.scale.set(1.4, 1.4, 1);
    scene.add(coreSprite);

    // Volumetric Outer Bloom Sprite
    const bloomMat = new THREE.SpriteMaterial({
      map: bloomTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      color: STATE_COLORS.idle.clone(),
    });
    const bloomSprite = new THREE.Sprite(bloomMat);
    bloomSprite.scale.set(2.4, 2.4, 1);
    scene.add(bloomSprite);

    // 4. Holographic Particle Shell (Spherical Fibonacci distribution)
    const createParticleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(0, 240, 255, 0.85)');
        gradient.addColorStop(0.7, 'rgba(0, 160, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(canvas);
    };

    const particleTexture = createParticleTexture();
    const particleCount = isBatterySaver ? 700 : 1400;
    const sphereRadius = 1.35; // Proportioned to prevent overlapping bottom labels
    const basePositions = new Float32Array(particleCount * 3);
    const currentPositions = new Float32Array(particleCount * 3);

    const goldenAngle = Math.PI * (Math.sqrt(5) - 1);
    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      basePositions[i * 3] = x * sphereRadius;
      basePositions[i * 3 + 1] = y * sphereRadius;
      basePositions[i * 3 + 2] = z * sphereRadius;

      currentPositions[i * 3] = basePositions[i * 3];
      currentPositions[i * 3 + 1] = basePositions[i * 3 + 1];
      currentPositions[i * 3 + 2] = basePositions[i * 3 + 2];
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(currentPositions, 3)
    );

    const particlesMaterial = new THREE.PointsMaterial({
      size: isBatterySaver ? 0.075 : 0.06,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: STATE_COLORS.idle.clone(),
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // 5. Layered Concentric Energy Orbit Rings
    const createRing = (radius: number, tube: number, tiltX: number, tiltY: number) => {
      const ringGeo = new THREE.TorusGeometry(radius, tube, 16, 72);
      const ringMat = new THREE.MeshBasicMaterial({
        color: STATE_COLORS.idle.clone(),
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = tiltX;
      ringMesh.rotation.y = tiltY;
      return { mesh: ringMesh, material: ringMat, baseTiltX: tiltX, baseTiltY: tiltY };
    };

    const ring1 = createRing(1.72, 0.012, Math.PI / 2.7, 0.18);
    const ring2 = createRing(1.95, 0.009, -Math.PI / 3.1, -0.35);

    scene.add(ring1.mesh);
    scene.add(ring2.mesh);

    // Shockwave ring for 'completed' state
    const shockwaveGeo = new THREE.RingGeometry(0.1, 0.15, 64);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    shockwaveMesh.rotation.x = Math.PI / 2;
    scene.add(shockwaveMesh);

    // 6. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let shockwaveScale = 0;
    let lastRenderTime = 0;
    const targetFpsInterval = isBatterySaver ? 1000 / 30 : 0;
    const currentColor = STATE_COLORS.idle.clone();

    const animate = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (document.hidden) return;

      if (targetFpsInterval > 0) {
        const elapsed = timestamp - lastRenderTime;
        if (elapsed < targetFpsInterval) return;
        lastRenderTime = timestamp - (elapsed % targetFpsInterval);
      }

      const elapsedTime = clock.getElapsedTime();
      const currentState = stateRef.current;
      const currentAudio = audioLevelRef.current || 0;

      // Color interpolation
      const targetColor = STATE_COLORS[currentState] || STATE_COLORS.idle;
      currentColor.lerp(targetColor, 0.06);

      particlesMaterial.color.copy(currentColor);
      bloomMat.color.copy(currentColor);
      ring1.material.color.copy(currentColor);
      ring2.material.color.copy(currentColor);

      // Core Sprite gentle pulse & audio reaction
      const corePulse =
        1.35 +
        Math.sin(elapsedTime * 2.2) * 0.08 +
        (currentState === 'speaking' || currentState === 'listening' ? currentAudio * 0.5 : 0);
      coreSprite.scale.set(corePulse, corePulse, 1);

      const bloomPulse =
        2.3 +
        Math.sin(elapsedTime * 1.8) * 0.12 +
        (currentState === 'speaking' || currentState === 'listening' ? currentAudio * 0.8 : 0);
      bloomSprite.scale.set(bloomPulse, bloomPulse, 1);

      // Error jitter / opacity
      if (currentState === 'error') {
        coreMat.opacity = Math.random() > 0.4 ? 0.95 : 0.4;
      } else {
        coreMat.opacity = 0.92;
      }

      // Audio reactive noise displacement on particle shell
      const posAttr = particlesGeometry.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;

      const audioMultiplier =
        currentState === 'listening'
          ? Math.max(0.08, currentAudio * 1.8)
          : currentState === 'speaking'
          ? Math.max(0.12, currentAudio * 2.2)
          : currentState === 'thinking' || currentState === 'reasoning'
          ? 0.14
          : 0.03;

      const motionFactor = prefersReducedMotion ? 0.2 : 1.0;
      const timeFactor = elapsedTime * 2.2 * motionFactor;

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        const bx = basePositions[idx];
        const by = basePositions[idx + 1];
        const bz = basePositions[idx + 2];

        const noise =
          Math.sin(bx * 2.5 + timeFactor) *
          Math.cos(by * 2.5 + timeFactor * 0.8) *
          Math.sin(bz * 2.5 + timeFactor * 1.2);

        let displacement = 1.0 + noise * audioMultiplier;

        if (currentState === 'error') {
          displacement += (Math.random() - 0.5) * 0.12;
        }

        positions[idx] = bx * displacement;
        positions[idx + 1] = by * displacement;
        positions[idx + 2] = bz * displacement;
      }
      posAttr.needsUpdate = true;

      // Energy Ring rotations
      if (!prefersReducedMotion) {
        if (currentState === 'idle') {
          particlesMesh.rotation.y = elapsedTime * 0.025;
          ring1.mesh.rotation.z = elapsedTime * 0.035;
          ring2.mesh.rotation.z = -elapsedTime * 0.028;
        } else if (currentState === 'thinking' || currentState === 'reasoning') {
          particlesMesh.rotation.y += 0.02;
          particlesMesh.rotation.x = Math.sin(elapsedTime * 0.8) * 0.2;
          ring1.mesh.rotation.z += 0.03;
          ring2.mesh.rotation.z -= 0.025;
          ring1.mesh.rotation.x = ring1.baseTiltX + Math.sin(elapsedTime * 1.2) * 0.22;
          ring2.mesh.rotation.y = ring2.baseTiltY + Math.cos(elapsedTime * 1.2) * 0.22;
        } else if (currentState === 'speaking') {
          particlesMesh.rotation.y += 0.014;
          ring1.mesh.rotation.z += 0.022;
          ring2.mesh.rotation.z -= 0.022;
        } else {
          particlesMesh.rotation.y += 0.008;
          ring1.mesh.rotation.z += 0.014;
          ring2.mesh.rotation.z -= 0.014;
        }
      }

      // Completed Shockwave
      if (currentState === 'completed') {
        shockwaveScale += 0.05;
        if (shockwaveScale > 2.8) shockwaveScale = 0.1;
        shockwaveMesh.scale.set(shockwaveScale, shockwaveScale, shockwaveScale);
        shockwaveMat.opacity = Math.max(0, 1.0 - shockwaveScale / 2.8);
      } else {
        shockwaveScale = 0;
        shockwaveMat.opacity = 0;
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      coreMat.dispose();
      bloomMat.dispose();
      ring1.mesh.geometry.dispose();
      ring1.material.dispose();
      ring2.mesh.geometry.dispose();
      ring2.material.dispose();
      shockwaveGeo.dispose();
      shockwaveMat.dispose();
      coreTexture.dispose();
      bloomTexture.dispose();
      particleTexture.dispose();
      renderer.dispose();
    };
  }, [width, height]);

  return (
    <div
      ref={mountRef}
      className="relative flex items-center justify-center pointer-events-none"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
};
