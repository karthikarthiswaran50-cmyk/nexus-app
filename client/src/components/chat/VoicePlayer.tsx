import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic, Volume2 } from 'lucide-react';

interface VoicePlayerProps {
  audioUrl: string;
  isMe?: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ audioUrl, isMe = false }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => console.error('Audio play error:', err));
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleSpeed = () => {
    const audio = audioRef.current;
    const rates: (1 | 1.5 | 2)[] = [1, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    if (audio) audio.playbackRate = nextRate;
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 18 waveform bars with distinct heights
  const waveformHeights = [35, 60, 45, 90, 75, 40, 65, 80, 100, 70, 50, 85, 95, 60, 40, 75, 50, 65];

  return (
    <div className="flex items-center gap-3 py-1.5 px-1 min-w-[220px] sm:min-w-[260px] max-w-full select-none">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Royal 24K Gold & Emerald Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition-all shadow-lg active:scale-95 ${
          isMe
            ? 'bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 text-dark-950 shadow-gold-500/30 hover:scale-105'
            : 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/30 hover:scale-105'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Scrubber Container */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div
          onClick={handleSeek}
          className="h-7 flex items-center gap-[3px] cursor-pointer group py-1"
          title="Click to seek"
        >
          {waveformHeights.map((height, idx) => {
            const barProgress = (idx / waveformHeights.length) * 100;
            const isPlayed = barProgress <= progressPercent;

            return (
              <span
                key={idx}
                style={{ height: `${height}%` }}
                className={`w-[3px] rounded-full transition-all duration-100 ${
                  isPlayed
                    ? isMe
                      ? 'bg-gradient-to-t from-amber-300 to-yellow-100 shadow-[0_0_6px_#fde047]'
                      : 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                    : isMe
                    ? 'bg-white/30'
                    : 'bg-dark-700 group-hover:bg-dark-600'
                }`}
              />
            );
          })}
        </div>

        {/* Time and Mic indicator */}
        <div className="flex items-center justify-between text-[11px] leading-none font-mono">
          <span className={isMe ? 'text-amber-100 font-bold' : 'text-dark-300'}>
            {isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleSpeed}
              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all ${
                isMe
                  ? 'bg-amber-400/20 text-amber-200 border border-amber-400/30'
                  : 'bg-dark-800 text-dark-300 hover:text-white border border-dark-700'
              }`}
            >
              {playbackRate}x
            </button>
            <Mic className={`w-3.5 h-3.5 ${isMe ? 'text-amber-300' : 'text-emerald-400'}`} />
          </div>
        </div>
      </div>
    </div>
  );
};
