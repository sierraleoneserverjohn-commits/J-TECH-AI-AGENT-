import React, { useRef, useState } from 'react';

interface EdgeDrawerHandleProps {
  side: 'left' | 'right';
  isOpen: boolean;
  onToggle: () => void;
  onSwipeOpen?: () => void;
  onSwipeClose?: () => void;
}

export const EdgeDrawerHandle: React.FC<EdgeDrawerHandleProps> = ({
  side,
  isOpen,
  onToggle,
  onSwipeOpen,
  onSwipeClose,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);

  const isLeft = side === 'left';

  // Pointer / Touch gesture handling for edge tap and swipe
  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    isDragging.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const deltaX = e.clientX - dragStartX.current;
    if (Math.abs(deltaX) > 10) {
      isDragging.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current !== null) {
      const deltaX = e.clientX - dragStartX.current;
      dragStartX.current = null;

      // Swipes (25px threshold)
      if (Math.abs(deltaX) > 25) {
        if (isLeft) {
          // Left side: swipe right (deltaX > 25) = inward = open
          if (deltaX > 25 && !isOpen) {
            onSwipeOpen ? onSwipeOpen() : onToggle();
            isDragging.current = false;
            return;
          }
          // Left side: swipe left (deltaX < -25) = outward = close
          if (deltaX < -25 && isOpen) {
            onSwipeClose ? onSwipeClose() : onToggle();
            isDragging.current = false;
            return;
          }
        } else {
          // Right side: swipe left (deltaX < -25) = inward = open
          if (deltaX < -25 && !isOpen) {
            onSwipeOpen ? onSwipeOpen() : onToggle();
            isDragging.current = false;
            return;
          }
          // Right side: swipe right (deltaX > 25) = outward = close
          if (deltaX > 25 && isOpen) {
            onSwipeClose ? onSwipeClose() : onToggle();
            isDragging.current = false;
            return;
          }
        }
      }
    }

    // Tap/Click if not a drag gesture
    if (!isDragging.current) {
      onToggle();
    }
    isDragging.current = false;
  };

  return (
    <div
      className={`relative z-30 shrink-0 self-center flex items-center justify-center select-none ${
        isLeft ? '-mr-[22px] left-0' : '-ml-[22px] right-0'
      }`}
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={`${isOpen ? 'Close' : 'Open'} ${side} panel drawer`}
        aria-expanded={isOpen}
        title={`Tap or swipe inward to ${isOpen ? 'close' : 'open'} ${side} drawer`}
        className="group relative flex items-center justify-center w-[44px] h-[140px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer touch-none"
      >
        {/* Thin glowing vertical line: 4px wide, 120px tall, vertically centered */}
        <div
          className={`w-[4px] h-[120px] rounded-full transition-all duration-300 ${
            isOpen
              ? 'bg-cyan-300 shadow-[0_0_16px_rgba(0,240,255,0.9),0_0_24px_rgba(0,240,255,0.5)] opacity-95'
              : isHovered
              ? 'bg-cyan-400 shadow-[0_0_14px_rgba(0,240,255,0.85)] opacity-90 scale-y-105'
              : 'bg-cyan-400/70 shadow-[0_0_10px_rgba(0,240,255,0.5)] opacity-70 group-hover:opacity-100'
          }`}
          style={{
            backgroundColor: 'var(--jexa-accent)',
            boxShadow: isOpen
              ? '0 0 16px var(--jexa-accent), 0 0 24px var(--jexa-accent-glow)'
              : '0 0 10px var(--jexa-accent-glow)',
          }}
        />

        {/* Floating tooltip label */}
        <span
          className={`absolute pointer-events-none whitespace-nowrap px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded bg-[#040c17]/95 border border-cyan-500/40 text-cyan-300 shadow-xl opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 z-50 ${
            isLeft ? 'left-12' : 'right-12'
          }`}
        >
          {isOpen ? `Close ${side} drawer` : `Open ${side} drawer`}
        </span>
      </button>
    </div>
  );
};
