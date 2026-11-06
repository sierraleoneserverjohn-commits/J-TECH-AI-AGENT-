/**
 * Audio PCM conversion and Web Audio Analyser utilities for Gemini Live API
 * Rules: 16kHz PCM input, 24kHz PCM output, manual little-endian encoding/decoding.
 */

// Convert Float32 array from Web Audio API into 16-bit PCM little-endian Base64
export function floatTo16BitPCMBase64(input: Float32Array): string {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  let binary = '';
  const bytes = new Uint8Array(output.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 24kHz 16-bit PCM into AudioBuffer
export function base64ToAudioBuffer(
  base64: string,
  audioCtx: AudioContext,
  sampleRate: number = 24000
): AudioBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const buffer = audioCtx.createBuffer(1, int16Array.length, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < int16Array.length; i++) {
    channelData[i] = int16Array[i] / 32768.0;
  }
  return buffer;
}

// Compute normalized RMS audio level from AnalyserNode (0.0 to 1.0)
export function getNormalizedAudioLevel(analyser: AnalyserNode): number {
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i];
  }
  const average = sum / buffer.length;
  return Math.min(1, Math.max(0, average / 128));
}
