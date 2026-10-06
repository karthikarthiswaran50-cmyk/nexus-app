import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';

interface VideoCirclePlayerProps {
  videoUrl: string;
  isMe?: boolean;
}

export const VideoCirclePlayer: React.FC<VideoCirclePlayerProps> = ({ videoUrl, isMe }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(100);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Video play error:', err));
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div className="relative inline-block my-1 select-none">
      {/* Outer circular rotating progress ring */}
      <div
        onClick={togglePlay}
        className={`relative w-44 h-44 sm:w-48 sm:h-48 rounded-full p-1 cursor-pointer transition-transform hover:scale-[1.02] active:scale-95 ${
          isMe
            ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 shadow-xl shadow-gold-500/25'
            : 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-xl shadow-emerald-500/25'
        }`}
      >
        {/* SVG Progress Ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="48"
            className="stroke-black/30 fill-none"
            strokeWidth="3"
          />
          <circle
            cx="50"
            cy="50"
            r="48"
            className={`fill-none transition-all duration-100 ${
              isMe ? 'stroke-amber-300' : 'stroke-emerald-300'
            }`}
            strokeWidth="3.5"
            strokeDasharray={2 * Math.PI * 48}
            strokeDashoffset={2 * Math.PI * 48 * (1 - progress / 100)}
            strokeLinecap="round"
          />
        </svg>

        {/* Circular Video Container */}
        <div className="w-full h-full rounded-full overflow-hidden bg-black flex items-center justify-center relative">
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            muted={isMuted}
            preload="metadata"
            className="w-full h-full object-cover rounded-full"
          />

          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
              <div className="w-12 h-12 rounded-full bg-dark-900/90 border border-gold-400/50 flex items-center justify-center text-amber-300 shadow-lg">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
          )}

          {/* Sound Mute/Unmute Button */}
          <button
            type="button"
            onClick={toggleMute}
            className="absolute bottom-2.5 right-2.5 p-1.5 rounded-full bg-dark-900/80 border border-white/20 text-white hover:text-amber-300 backdrop-blur-sm transition-all"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
