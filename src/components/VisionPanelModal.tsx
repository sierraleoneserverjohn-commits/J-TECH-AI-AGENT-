import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Monitor, X, Eye, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { toolRegistry } from '../tools';

interface VisionPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VisionPanelModal: React.FC<VisionPanelModalProps> = ({ isOpen, onClose }) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('Describe this image in detail and identify key elements.');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera on modal close or unmount
  useEffect(() => {
    if (!isOpen && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleStartCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable.');
    }
  };

  const handleCaptureCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    setImagePreview(dataUrl);
    setAnalysisResult(null);

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const imageCapture = (window as any).ImageCapture
        ? new (window as any).ImageCapture(track)
        : null;

      if (imageCapture) {
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(bitmap, 0, 0);
        setImagePreview(canvas.toDataURL('image/png'));
      } else {
        // Fallback video element capture
        const vid = document.createElement('video');
        vid.srcObject = stream;
        await vid.play();
        const canvas = document.createElement('canvas');
        canvas.width = vid.videoWidth || 1280;
        canvas.height = vid.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(vid, 0, 0);
        setImagePreview(canvas.toDataURL('image/png'));
      }

      track.stop();
      setAnalysisResult(null);
    } catch {
      // Screen share cancelled
    }
  };

  const handleRunAnalysis = async () => {
    if (!imagePreview) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const result = await toolRegistry.executeTool('vision_engine', prompt, {
        imageDataUrl: imagePreview,
      });

      setAnalysisResult(result.output);
    } catch (err: any) {
      setAnalysisResult(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vision-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in select-none font-mono text-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[92dvh] rounded-xl hud-corner-box hud-corner-accent p-4 flex flex-col border border-cyan-500/40 glow-cyan-border shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-cyan-950/80">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <h2 id="vision-modal-title" className="font-heading font-bold text-sm tracking-wider uppercase text-slate-100">
              JEXA Vision Engine
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close vision panel"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Source Buttons */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-2 px-2.5 rounded-lg bg-[#061222] hover:bg-[#0c223e] border border-cyan-500/30 text-cyan-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload Image</span>
          </button>

          <button
            onClick={handleStartCamera}
            className="py-2 px-2.5 rounded-lg bg-[#061222] hover:bg-[#0c223e] border border-cyan-500/30 text-cyan-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>Camera Photo</span>
          </button>

          <button
            onClick={handleScreenCapture}
            className="py-2 px-2.5 rounded-lg bg-[#061222] hover:bg-[#0c223e] border border-cyan-500/30 text-cyan-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            <span>Screen Capture</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Live Camera View if Active */}
        {cameraActive && (
          <div className="relative mb-3 rounded-lg overflow-hidden border border-cyan-400 bg-black flex flex-col items-center">
            <video ref={videoRef} autoPlay playsInline className="w-full max-h-[220px] object-cover" />
            <div className="absolute bottom-2 flex gap-2">
              <button
                onClick={handleCaptureCamera}
                className="px-4 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg"
              >
                Snap Photo
              </button>
              <button
                onClick={() => {
                  streamRef.current?.getTracks().forEach((t) => t.stop());
                  setCameraActive(false);
                }}
                className="px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="mb-2 p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[10px]">
            {cameraError}
          </div>
        )}

        {/* Image Preview */}
        {imagePreview ? (
          <div className="relative mb-3 rounded-lg overflow-hidden border border-cyan-500/30 bg-[#020710] flex items-center justify-center max-h-[190px]">
            <img src={imagePreview} alt="Preview" className="max-h-[190px] w-auto object-contain" />
            <button
              onClick={() => setImagePreview(null)}
              aria-label="Remove image"
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="mb-3 py-6 rounded-lg border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500 text-[11px]">
            <Eye className="w-6 h-6 text-slate-600 mb-1" />
            <span>Select an image, camera snapshot, or screenshot</span>
          </div>
        )}

        {/* Prompt Input */}
        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
            Vision Directive
          </label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What would you like JEXA to analyze about this image?"
            className="w-full py-2 px-3 bg-[#06101c] border border-cyan-500/30 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 font-mono"
          />
        </div>

        {/* Run Button */}
        <button
          onClick={handleRunAnalysis}
          disabled={!imagePreview || isAnalyzing}
          className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 min-h-[40px] mb-3"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
              <span>Analyzing Image with Gemini...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>Analyze with Gemini Vision</span>
            </>
          )}
        </button>

        {/* Analysis Output */}
        {analysisResult && (
          <div className="p-3 rounded-lg bg-[#040d18] border border-cyan-500/40 text-slate-200 space-y-1.5 animate-in fade-in text-xs max-h-[160px] overflow-y-auto">
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>JEXA Visual Assessment</span>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed text-[11px] text-slate-300">
              {analysisResult}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
