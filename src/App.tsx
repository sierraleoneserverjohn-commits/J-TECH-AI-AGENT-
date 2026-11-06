/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useJexaStore } from './events/useJexaStore';
import { useVoice } from './hooks/useVoice';
import { useDeviceData } from './hooks/useDeviceData';
import { TopBar } from './components/TopBar';
import { LeftColumn } from './components/left/LeftColumn';
import { RightColumn } from './components/right/RightColumn';
import { HolographicGlobe } from './components/HolographicGlobe';
import { OrientationLockOverlay } from './components/OrientationLockOverlay';
import { ActionConfirmCard } from './components/ActionConfirmCard';
import { SettingsModal } from './components/SettingsModal';
import { FullLogModal } from './components/FullLogModal';
import { EdgeDrawerHandle } from './components/EdgeDrawerHandle';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { AmbientModeOverlay } from './components/AmbientModeOverlay';
import { getSavedTheme, applyTheme } from './utils/theme';
import { Eye, EyeOff } from 'lucide-react';

export default function App() {
  const {
    orbState,
    orbMessage,
    reasoningLine,
    activityChips,
    activeProviderUsage,
    logs,
    messages,
    systemStatus,
    currentAction,
    setCurrentAction,
    refreshBackendStatus,
  } = useJexaStore();

  const voice = useVoice();
  const deviceData = useDeviceData();

  // Active neural model selector
  const [activeModel, setActiveModel] = useState<string>(() => {
    return localStorage.getItem('jexa_active_model') || systemStatus.models[0] || '';
  });

  useEffect(() => {
    if (!activeModel && systemStatus.models.length > 0) {
      const saved = localStorage.getItem('jexa_active_model');
      const initial = saved && systemStatus.models.includes(saved) ? saved : systemStatus.models[0];
      setActiveModel(initial);
      localStorage.setItem('jexa_active_model', initial);
    }
  }, [systemStatus.models, activeModel]);

  // Apply accent theme on mount
  useEffect(() => {
    const theme = getSavedTheme();
    applyTheme(theme);
  }, []);

  // Both drawers start closed per user requirement
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState<boolean>(false);

  // Focus Mode (closes both drawers and hides everything except globe and mic)
  const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
    return localStorage.getItem('jexa_focus_mode') === 'true';
  });

  // Collapsed state per individual panel
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('jexa_panels_collapsed_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modals and Overlays
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFullLogsOpen, setIsFullLogsOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [allowPortraitPreview, setAllowPortraitPreview] = useState<boolean>(false);

  // Ambient Mode: 60 seconds idle detection
  const [isAmbientMode, setIsAmbientMode] = useState<boolean>(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = useCallback(() => {
    setIsAmbientMode(false);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setIsAmbientMode(true);
    }, 60000); // 60 seconds
  }, []);

  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    const handleUserActivity = () => resetIdleTimer();
    activityEvents.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));
    resetIdleTimer();

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // Edge Swipe Gestures (Swipe inward from screen edge to open, swipe back to close)
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        // Ensure predominantly horizontal swipe
        if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
          const screenW = window.innerWidth;

          // Left edge swipe: touch started within 50px of left edge -> swipe right to open
          if (touchStartX <= 55 && deltaX > 35) {
            setIsLeftDrawerOpen(true);
          } else if (deltaX < -35 && touchStartX < 320 && isLeftDrawerOpen) {
            setIsLeftDrawerOpen(false);
          }

          // Right edge swipe: touch started within 55px of right edge -> swipe left to open
          if (touchStartX >= screenW - 55 && deltaX < -35) {
            setIsRightDrawerOpen(true);
          } else if (deltaX > 35 && touchStartX > screenW - 320 && isRightDrawerOpen) {
            setIsRightDrawerOpen(false);
          }
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isLeftDrawerOpen, isRightDrawerOpen]);

  const toggleLeftDrawer = () => {
    setIsLeftDrawerOpen((prev) => !prev);
  };

  const toggleRightDrawer = () => {
    setIsRightDrawerOpen((prev) => !prev);
  };

  const toggleFocusMode = () => {
    const next = !isFocusMode;
    setIsFocusMode(next);
    localStorage.setItem('jexa_focus_mode', String(next));
    if (next) {
      setIsLeftDrawerOpen(false);
      setIsRightDrawerOpen(false);
    }
  };

  const togglePanelCollapse = (panelId: string) => {
    setCollapsedPanels((prev) => {
      const next = { ...prev, [panelId]: !prev[panelId] };
      localStorage.setItem('jexa_panels_collapsed_map', JSON.stringify(next));
      return next;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      if (screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Recent user commands for the command palette
  const recentCommands = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.text)
    .slice(-10)
    .reverse();

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden jexa-backdrop text-slate-100 flex flex-col select-none font-sans">
      {/* Cityscape skyline silhouette at bottom */}
      <div className="cityscape-silhouette" />

      {/* 1. Orientation Lock Overlay for Portrait mode */}
      {!allowPortraitPreview && (
        <OrientationLockOverlay onDismiss={() => setAllowPortraitPreview(true)} />
      )}

      {/* 2. Top Bar (Hides in Focus Mode for maximum immersion) */}
      {!isFocusMode ? (
        <TopBar
          deviceData={deviceData}
          isFocusMode={isFocusMode}
          onToggleFocusMode={toggleFocusMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleFullscreen={toggleFullscreen}
        />
      ) : (
        /* Minimalist floating Exit Focus Mode Button */
        <div className="absolute top-2 right-3 z-30 animate-in fade-in duration-300">
          <button
            onClick={toggleFocusMode}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#050e1c]/90 border border-cyan-500/40 text-cyan-300 hover:text-white text-[10px] font-mono shadow-[0_0_12px_rgba(0,240,255,0.4)] backdrop-blur-md transition-all active:scale-95"
          >
            <EyeOff className="w-3 h-3 text-cyan-400" />
            <span>Exit Focus Mode</span>
          </button>
        </div>
      )}

      {/* 3. Main Landscape 3-Column Command Centre Layout with Edge Drawers */}
      <main className="relative z-10 flex-1 w-full min-h-0 overflow-hidden flex items-stretch">
        {/* LEFT DRAWER COLUMN */}
        <div
          className={`h-full flex shrink-0 overflow-hidden transition-[width,opacity] duration-[250ms] ease-out motion-reduce:transition-none ${
            isLeftDrawerOpen && !isFocusMode
              ? 'w-[225px] sm:w-[245px] md:w-[265px] opacity-100'
              : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-[225px] sm:w-[245px] md:w-[265px] h-full p-1.5 overflow-hidden flex flex-col">
            <LeftColumn
              systemStatus={systemStatus}
              activeModel={activeModel}
              setActiveModel={setActiveModel}
              collapsedPanels={collapsedPanels}
              toggleCollapse={togglePanelCollapse}
            />
          </div>
        </div>

        {/* LEFT EDGE DRAWER HANDLE: Thin glowing vertical line (4px wide, 120px tall) */}
        {!isFocusMode && (
          <EdgeDrawerHandle
            side="left"
            isOpen={isLeftDrawerOpen}
            onToggle={toggleLeftDrawer}
            onSwipeOpen={() => setIsLeftDrawerOpen(true)}
            onSwipeClose={() => setIsLeftDrawerOpen(false)}
          />
        )}

        {/* CENTER STAGE: Holographic Globe + Dynamic Activity Chips + Mic Bar */}
        {/* Shrinks and shifts smoothly with 250ms ease without overlapping */}
        <section className="flex-1 min-w-0 h-full flex flex-col items-center justify-between relative overflow-hidden px-1 py-1 sm:py-2 transition-all duration-[250ms] ease-out motion-reduce:transition-none">
          <div className="w-full h-full flex flex-col items-center justify-between">
            <HolographicGlobe
              state={orbState}
              orbMessage={orbMessage}
              reasoningLine={reasoningLine}
              activityChips={activityChips}
              activeProviderUsage={activeProviderUsage}
              audioLevel={voice.audioLevel}
              isListening={voice.isListening}
              onMicClick={voice.toggleListening}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            />
          </div>
        </section>

        {/* RIGHT EDGE DRAWER HANDLE: Thin glowing vertical line (4px wide, 120px tall) */}
        {!isFocusMode && (
          <EdgeDrawerHandle
            side="right"
            isOpen={isRightDrawerOpen}
            onToggle={toggleRightDrawer}
            onSwipeOpen={() => setIsRightDrawerOpen(true)}
            onSwipeClose={() => setIsRightDrawerOpen(false)}
          />
        )}

        {/* RIGHT DRAWER COLUMN */}
        <div
          className={`h-full flex shrink-0 overflow-hidden transition-[width,opacity] duration-[250ms] ease-out motion-reduce:transition-none ${
            isRightDrawerOpen && !isFocusMode
              ? 'w-[225px] sm:w-[245px] md:w-[265px] opacity-100'
              : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-[225px] sm:w-[245px] md:w-[265px] h-full p-1.5 overflow-hidden flex flex-col">
            <RightColumn
              logs={logs}
              deviceData={deviceData}
              onViewAllLogs={() => setIsFullLogsOpen(true)}
              collapsedPanels={collapsedPanels}
              toggleCollapse={togglePanelCollapse}
            />
          </div>
        </div>
      </main>

      {/* Action Confirmation & Android requirement modal */}
      <ActionConfirmCard
        action={currentAction}
        onClose={() => setCurrentAction(null)}
      />

      {/* Full Event Logs Modal */}
      <FullLogModal
        isOpen={isFullLogsOpen}
        onClose={() => setIsFullLogsOpen(false)}
        logs={logs}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onBackendUpdated={refreshBackendStatus}
      />

      {/* Command Palette Modal (Triggered by long-press on mic button) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        recentCommands={recentCommands}
      />

      {/* Ambient Standby Mode Overlay (Triggered after 60 seconds idle) */}
      <AmbientModeOverlay
        isAmbient={isAmbientMode}
        onWake={resetIdleTimer}
      />
    </div>
  );
}
