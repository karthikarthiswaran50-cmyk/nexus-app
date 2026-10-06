import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Send, RotateCcw, StopCircle, RefreshCw } from 'lucide-react';

interface VideoCircleRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (videoBlob: Blob) => void;
}

export const VideoCircleRecorder: React.FC<VideoCircleRecorderProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasPreview, setHasPreview] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 480 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera access error:', err);
    }
  };

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setHasPreview(false);
    setRecordedBlob(null);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setSecondsLeft(60);

    const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? { mimeType: 'video/webm;codecs=vp9' }
      : MediaRecorder.isTypeSupported('video/mp4')
      ? { mimeType: 'video/mp4' }
      : undefined;

    const recorder = new MediaRecorder(streamRef.current, options);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const mime = recorder.mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      setRecordedBlob(blob);
      setHasPreview(true);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
        videoRef.current.loop = true;
        videoRef.current.play().catch(() => {});
      }
    };

    recorder.start(250);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSend = () => {
    if (recordedBlob) {
      onSend(recordedBlob);
      onClose();
    }
  };

  const handleRetake = () => {
    setHasPreview(false);
    setRecordedBlob(null);
    setSecondsLeft(60);
    startCamera();
  };

  const flipCamera = () => {
    if (isRecording) return;
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isOpen) return null;

  const progress = ((60 - secondsLeft) / 60) * 100;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative flex flex-col items-center space-y-6">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-full bg-dark-800 text-dark-300 hover:text-white border border-dark-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Circular Camera Viewfinder with Progress Ring */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full p-2 bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 shadow-2xl shadow-gold-500/30">
          
          {/* Progress ring when recording */}
          {isRecording && (
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="48"
                className="stroke-rose-500/40 fill-none"
                strokeWidth="4"
              />
              <circle
                cx="50"
                cy="50"
                r="48"
                className="stroke-rose-500 fill-none transition-all duration-300"
                strokeWidth="4"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 * (1 - progress / 100)}
                strokeLinecap="round"
              />
            </svg>
          )}

          {/* Video Container */}
          <div className="w-full h-full rounded-full overflow-hidden bg-black flex items-center justify-center relative">
            <video
              ref={videoRef}
              playsInline
              muted={!hasPreview}
              className="w-full h-full object-cover rounded-full"
            />

            {/* Recording timer badge */}
            {isRecording && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-black flex items-center gap-1.5 shadow-lg animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                <span>0:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions Controls Bar */}
        <div className="flex items-center gap-4">
          {!hasPreview ? (
            <>
              {/* Flip camera */}
              <button
                type="button"
                onClick={flipCamera}
                disabled={isRecording}
                className="p-3.5 rounded-full bg-dark-800 hover:bg-dark-750 text-white border border-dark-700 shadow-md transition-all active:scale-95 disabled:opacity-40"
                title="Flip Camera"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {/* Start/Stop Recording Button */}
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-6 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-xl shadow-rose-600/30 flex items-center gap-2 transition-all active:scale-95 animate-pulse"
                >
                  <StopCircle className="w-5 h-5 fill-current" />
                  <span>Stop Recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-6 py-3.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-sm shadow-xl shadow-gold-500/30 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Camera className="w-5 h-5 stroke-[2.5]" />
                  <span>Hold to Record</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Retake */}
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-white border border-dark-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake</span>
              </button>

              {/* Send Video Bubble */}
              <button
                type="button"
                onClick={handleSend}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-300 text-dark-950 font-black text-xs shadow-lg shadow-gold-500/30 flex items-center gap-2 transition-all active:scale-95"
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
                <span>Send Video Bubble 📹</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
