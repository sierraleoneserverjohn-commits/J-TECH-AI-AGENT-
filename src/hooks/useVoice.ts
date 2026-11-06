import { useState, useEffect, useRef, useCallback } from 'react';
import { eventBus } from '../events/eventBus';
import { getActiveBrain } from '../brains';

export function useVoice() {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.05);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [wakeMode, setWakeMode] = useState<'ptt' | 'wakeword'>('ptt');

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Check support & load voices
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition && !window.speechSynthesis) {
      setIsSupported(false);
      eventBus.emit('health', {
        key: 'voice',
        value: 'warning',
        message: 'Browser does not support Web Speech API',
      });
    }

    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedVoiceURI) {
          // Prefer English Google/natural/standard voice
          const natural = voices.find(
            (v) => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')) && v.lang.startsWith('en')
          ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];
          setSelectedVoiceURI(natural.voiceURI);
        }
      }
    };

    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceURI]);

  // Handle 'speak' event from EventBus
  useEffect(() => {
    const unsub = eventBus.on('speak', (payload) => {
      speak(payload.text);
    });
    return unsub;
  }, [selectedVoiceURI, speechRate]);

  // Clean text-to-speech speaker
  const speak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) return;

      window.speechSynthesis.cancel();
      // Strip markdown asterisks or code symbols for smooth JARVIS voice
      const cleanText = text
        .replace(/[*_#`~[\]]/g, '')
        .replace(/https?:\/\/\S+/g, 'link')
        .slice(0, 300);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      if (selectedVoiceURI && availableVoices.length > 0) {
        const voice = availableVoices.find((v) => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;
      }

      utterance.rate = speechRate;
      utterance.pitch = 0.95; // slightly deeper, calm JARVIS tone

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [availableVoices, selectedVoiceURI, speechRate]
  );

  // Setup Web Audio API volume listener
  const startAudioMeter = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Compute average frequency power
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, avg / 128);
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn('Microphone audio analyser unavailable:', err);
    }
  };

  const stopAudioMeter = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const startListening = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      eventBus.emit('log', {
        text: 'Speech recognition is not supported in this browser. Please use Chrome/Edge or text input.',
        level: 'warn',
      });
      return;
    }

    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      await startAudioMeter();

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
        eventBus.emit('state', { state: 'listening' });
        eventBus.emit('log', { text: 'Voice listener engaged. Speak command...', level: 'info' });
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const currentText = final || interim;
        setTranscript(currentText);

        if (final) {
          stopListening();
          // Dispatch final command to brain
          getActiveBrain().send(final);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        stopListening();
        eventBus.emit('state', { state: 'idle' });
        if (e.error !== 'no-speech') {
          eventBus.emit('log', { text: `Mic input issue: ${e.error}`, level: 'warn' });
        }
      };

      recognition.onend = () => {
        stopListening();
      };

      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      stopListening();
      eventBus.emit('log', { text: 'Failed to access microphone permissions', level: 'error' });
      eventBus.emit('state', { state: 'idle' });
    }
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    stopAudioMeter();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
      eventBus.emit('state', { state: 'idle' });
    } else {
      startListening();
    }
  };

  return {
    isSupported,
    isListening,
    isSpeaking,
    transcript,
    audioLevel,
    availableVoices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    speechRate,
    setSpeechRate,
    wakeMode,
    setWakeMode,
    toggleListening,
    speak,
  };
}
