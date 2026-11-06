import { useState, useEffect, useRef, useCallback } from 'react';
import { speechManager } from '../voice/SpeechEngineManager';
import { LiveVoiceName, VoiceProviderType } from '../voice/types';
import { eventBus } from '../events/eventBus';

export function useVoice() {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [selectedVoice, setSelectedVoiceState] = useState<LiveVoiceName>(speechManager.getSelectedVoice());
  const [activeProvider, setActiveProvider] = useState<VoiceProviderType>(speechManager.getPreferredProvider());

  const animFrameRef = useRef<number | null>(null);

  // Sync state with active engine
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncLoop = () => {
      const engine = speechManager.getActiveEngine();
      setIsListening(engine.isListening);
      setAudioLevel(engine.audioLevel);
      setSessionDuration(engine.sessionDuration);
      setActiveProvider(speechManager.getPreferredProvider());
      setSelectedVoiceState(speechManager.getSelectedVoice());

      animFrameRef.current = requestAnimationFrame(syncLoop);
    };

    animFrameRef.current = requestAnimationFrame(syncLoop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Subscribe to speech synthesis & transcription events
  useEffect(() => {
    const unsubState = eventBus.on('state', (payload) => {
      if (payload.state === 'speaking') {
        setIsSpeaking(true);
      } else {
        setIsSpeaking(false);
      }
    });

    const unsubMsg = eventBus.on('message', (msg) => {
      if (msg.role === 'user') {
        setTranscript(msg.text);
      }
    });

    const unsubSpeak = eventBus.on('speak', (payload) => {
      // If browser speech fallback is active, play TTS
      if (window.speechSynthesis && !speechManager.getActiveEngine().isListening) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(payload.text.replace(/[*_#`~[\]]/g, '').slice(0, 300));
        utterance.rate = 1.05;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    });

    return () => {
      unsubState();
      unsubMsg();
      unsubSpeak();
    };
  }, []);

  const setSelectedVoice = useCallback((voice: LiveVoiceName) => {
    speechManager.setSelectedVoice(voice);
    setSelectedVoiceState(voice);
  }, []);

  const toggleListening = useCallback(async () => {
    await speechManager.toggleListening();
  }, []);

  return {
    isSupported,
    isListening,
    isSpeaking,
    transcript,
    audioLevel,
    sessionDuration,
    selectedVoice,
    setSelectedVoice,
    activeProvider,
    toggleListening,
  };
}
