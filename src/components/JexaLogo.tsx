import React from 'react';

interface JexaLogoProps {
  size?: number;
  className?: string;
}

export const JexaLogo: React.FC<JexaLogoProps> = ({ size = 24, className = '' }) => {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="JEXA Logo"
    >
      <defs>
        <radialGradient id="jexaBgGlow" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#0a182c" />
          <stop offset="60%" stopColor="#05080f" />
          <stop offset="100%" stopColor="#020408" />
        </radialGradient>
        <linearGradient id="jexaCyanEnergy" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f3ff" />
          <stop offset="50%" stopColor="#00a8ff" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <radialGradient id="jexaOrbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#67e8f9" />
          <stop offset="70%" stopColor="#00f3ff" />
          <stop offset="100%" stopColor="#0066cc" stopOpacity="0.2" />
        </radialGradient>
        <filter id="jexaNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur1" />
          <feGaussianBlur stdDeviation="18" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="jexaOrbPulse" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#jexaBgGlow)" />
      <circle cx="256" cy="256" r="216" fill="none" stroke="#00f3ff" strokeWidth="2" strokeOpacity="0.15" strokeDasharray="6 8" />
      <circle cx="256" cy="256" r="156" fill="none" stroke="url(#jexaCyanEnergy)" strokeWidth="16" strokeLinecap="round" filter="url(#jexaNeonGlow)" />
      <path d="M 296 148 L 296 308 C 296 358 262 384 218 384 C 182 384 156 362 148 334" fill="none" stroke="url(#jexaCyanEnergy)" strokeWidth="20" strokeLinecap="round" filter="url(#jexaNeonGlow)" />
      <path d="M 264 148 L 328 148" fill="none" stroke="#ffffff" strokeWidth="16" strokeLinecap="round" filter="url(#jexaNeonGlow)" />
      <circle cx="220" cy="240" r="34" fill="url(#jexaOrbGlow)" filter="url(#jexaOrbPulse)" />
      <circle cx="220" cy="240" r="14" fill="#ffffff" />
      <circle cx="390" cy="200" r="7" fill="#00f3ff" filter="url(#jexaNeonGlow)" />
      <circle cx="120" cy="290" r="6" fill="#38bdf8" filter="url(#jexaNeonGlow)" />
      <circle cx="256" cy="100" r="5" fill="#67e8f9" filter="url(#jexaNeonGlow)" />
    </svg>
  );
};
