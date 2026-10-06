import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Mic,
  MicOff,
  Hand,
  Users,
  PhoneOff,
  Crown,
  Volume2,
  X,
  ChevronDown,
  Sparkles,
  Shield,
  UserCheck,
} from 'lucide-react';
import { VoiceSpace, VoiceSpaceParticipant } from '../../types';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../common/Avatar';

interface VoiceStageModalProps {
  space: VoiceSpace;
  onClose: () => void;
  onLeave: () => void;
}

export const VoiceStageModal: React.FC<VoiceStageModalProps> = ({
  space: initialSpace,
  onClose,
  onLeave,
}) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [space, setSpace] = useState<VoiceSpace>(initialSpace);
  const [isMinimized, setIsMinimized] = useState(false);
  const [localMuted, setLocalMuted] = useState(true);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Sync space updates from socket
  useEffect(() => {
    if (!socket) return;

    const handleUpdated = (updatedSpace: VoiceSpace) => {
      if (updatedSpace.id === space.id) {
        setSpace(updatedSpace);
      }
    };

    const handleEnded = (data: { spaceId: string }) => {
      if (data.spaceId === space.id) {
        cleanupLocalStream();
        onLeave();
      }
    };

    socket.on('space:updated', handleUpdated);
    socket.on('space:ended', handleEnded);

    return () => {
      socket.off('space:updated', handleUpdated);
      socket.off('space:ended', handleEnded);
    };
  }, [socket, space.id]);

  const currentParticipant = user ? space.participants[user.id] : null;
  const isHost = currentParticipant?.isHost || space.hostId === user?.id;
  const isSpeaker = currentParticipant?.isSpeaker || isHost;

  // Manage local microphone when speaking
  useEffect(() => {
    if (isSpeaker && !localStreamRef.current) {
      navigator.mediaDevices?.getUserMedia({ audio: true })
        .then((stream) => {
          localStreamRef.current = stream;
          stream.getAudioTracks().forEach((track) => {
            track.enabled = !localMuted;
          });
        })
        .catch((err) => {
          console.warn('Microphone access for Voice Stage:', err);
        });
    }

    return () => {
      if (!isSpeaker) {
        cleanupLocalStream();
      }
    };
  }, [isSpeaker]);

  const cleanupLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  const handleToggleMute = () => {
    if (!isSpeaker) return;
    const nextMuted = !localMuted;
    setLocalMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    socket?.emit('space:toggle_mute', { spaceId: space.id, isMuted: nextMuted });
  };

  const handleRaiseHand = () => {
    if (!currentParticipant) return;
    if (currentParticipant.raisedHand) {
      socket?.emit('space:lower_hand', { spaceId: space.id });
    } else {
      socket?.emit('space:raise_hand', { spaceId: space.id });
    }
  };

  const handlePromoteSpeaker = (targetUserId: string) => {
    if (!isHost) return;
    socket?.emit('space:promote_speaker', { spaceId: space.id, targetUserId });
  };

  const handleDemoteSpeaker = (targetUserId: string) => {
    if (!isHost) return;
    socket?.emit('space:demote_speaker', { spaceId: space.id, targetUserId });
  };

  const handleEndStage = () => {
    if (!window.confirm('Are you sure you want to end this Voice Stage for everyone?')) return;
    cleanupLocalStream();
    socket?.emit('space:end', { spaceId: space.id });
    onLeave();
  };

  const handleLeaveQuietly = () => {
    cleanupLocalStream();
    socket?.emit('space:leave', { spaceId: space.id });
    onLeave();
  };

  const participantsList = Object.values(space.participants || {});
  const speakers = participantsList.filter((p) => p.isSpeaker || p.isHost);
  const listeners = participantsList.filter((p) => !p.isSpeaker && !p.isHost);
  const handRaisers = listeners.filter((p) => p.raisedHand);

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 sm:right-8 z-50 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center gap-3 p-3 px-4 rounded-2xl bg-dark-900/95 border border-gold-500/40 shadow-2xl backdrop-blur-xl">
          <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 animate-pulse shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0 pr-2">
            <p className="text-xs font-bold text-white truncate max-w-[140px]">{space.title}</p>
            <p className="text-[10px] text-amber-300 flex items-center gap-1">
              <span>{speakers.length} Speaking</span> • <span>{listeners.length} Listening</span>
            </p>
          </div>
          {isSpeaker && (
            <button
              type="button"
              onClick={handleToggleMute}
              className={`p-2 rounded-xl transition-all ${
                localMuted
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {localMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-white"
          >
            <ChevronDown className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-dark-900 border border-gold-500/30 rounded-t-3xl sm:rounded-3xl shadow-2xl royal-card flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Stage Header */}
        <div className="p-4 sm:p-5 px-6 border-b border-gold-500/15 flex items-center justify-between shrink-0 bg-dark-950/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  Live Voice Stage
                </span>
                <span className="text-xs text-dark-400">• {participantsList.length} members</span>
              </div>
              <h2 className="text-base font-black text-white truncate mt-0.5">{space.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-all"
              title="Minimize"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-dark-800 transition-all"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Stage Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* 👑 Speakers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-gold-400" />
                <span>Speakers ({speakers.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
              {speakers.map((s) => {
                const isTalking = !s.isMuted;
                return (
                  <div
                    key={s.userId}
                    className="relative flex flex-col items-center text-center p-3 rounded-2xl bg-dark-850/90 border border-gold-500/15 group"
                  >
                    <div className="relative mb-2">
                      <div className={`p-1 rounded-full transition-all ${
                        isTalking
                          ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-dark-900 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                          : ''
                      }`}>
                        <Avatar
                          src={s.avatarUrl}
                          name={s.fullName}
                          size="lg"
                        />
                      </div>
                      
                      {/* Host Crown Badge */}
                      {s.isHost && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-dark-950 shadow-md">
                          <Crown className="w-3 h-3 stroke-[2.5]" />
                        </div>
                      )}

                      {/* Mic Status Badge */}
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md border ${
                        s.isMuted
                          ? 'bg-rose-500/90 text-white border-rose-400/40'
                          : 'bg-emerald-500 text-white border-emerald-400/40 animate-pulse'
                      }`}>
                        {s.isMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                      </div>
                    </div>

                    <p className="text-xs font-bold text-white truncate max-w-full">{s.fullName}</p>
                    <p className="text-[10px] text-dark-400 truncate max-w-full">
                      {s.isHost ? 'Host' : 'Speaker'}
                    </p>

                    {/* Host action menu on other speakers */}
                    {isHost && s.userId !== user?.id && (
                      <button
                        type="button"
                        onClick={() => handleDemoteSpeaker(s.userId)}
                        className="mt-2 text-[10px] text-dark-400 hover:text-rose-400 underline"
                      >
                        Move to listeners
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ✋ Raised Hands Queue (visible to Host) */}
          {isHost && handRaisers.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Hand className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>Raised Hands Requesting to Speak ({handRaisers.length})</span>
              </div>
              <div className="space-y-2">
                {handRaisers.map((hr) => (
                  <div
                    key={hr.userId}
                    className="flex items-center justify-between p-2 rounded-xl bg-dark-900 border border-amber-500/20"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar src={hr.avatarUrl} name={hr.fullName} size="sm" />
                      <span className="text-xs font-bold text-white">{hr.fullName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePromoteSpeaker(hr.userId)}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-dark-950 text-xs font-black shadow-md hover:scale-105 active:scale-95 transition-all"
                    >
                      Invite to Speak
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🎧 Listeners Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-dark-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Listeners ({listeners.length})</span>
            </h3>

            {listeners.length === 0 ? (
              <p className="text-xs text-dark-500 italic py-2">No other listeners yet.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {listeners.map((l) => (
                  <div
                    key={l.userId}
                    className="flex flex-col items-center text-center p-2 rounded-2xl bg-dark-850/50 border border-dark-800"
                  >
                    <div className="relative mb-1">
                      <Avatar src={l.avatarUrl} name={l.fullName} size="md" />
                      {l.raisedHand && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-dark-950 flex items-center justify-center text-[10px] animate-bounce">
                          ✋
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-dark-300 truncate max-w-full">
                      {l.fullName.split(' ')[0]}
                    </p>
                    {isHost && (
                      <button
                        type="button"
                        onClick={() => handlePromoteSpeaker(l.userId)}
                        className="text-[9px] text-amber-400 hover:underline mt-1"
                      >
                        Make speaker
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stage Bottom Action Bar */}
        <div className="p-4 px-6 border-t border-gold-500/15 bg-dark-950/80 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0">
          
          {/* Leave Button */}
          <button
            type="button"
            onClick={handleLeaveQuietly}
            className="px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-dark-300 hover:text-white border border-dark-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
          >
            <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
            <span>Leave Quietly</span>
          </button>

          {/* Center Action (Mic or Raise Hand) */}
          <div className="flex items-center gap-2">
            {isSpeaker ? (
              <button
                type="button"
                onClick={handleToggleMute}
                className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all active:scale-95 ${
                  localMuted
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {localMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{localMuted ? 'Muted' : 'Speaking'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRaiseHand}
                className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all active:scale-95 ${
                  currentParticipant?.raisedHand
                    ? 'bg-amber-500 text-dark-950 shadow-gold-500/30 ring-2 ring-amber-300'
                    : 'bg-dark-800 hover:bg-dark-750 text-amber-300 border border-gold-500/30'
                }`}
              >
                <Hand className={`w-4 h-4 ${currentParticipant?.raisedHand ? 'animate-bounce' : ''}`} />
                <span>{currentParticipant?.raisedHand ? 'Hand Raised ✋' : 'Raise Hand ✋'}</span>
              </button>
            )}
          </div>

          {/* Host Controls */}
          {isHost ? (
            <button
              type="button"
              onClick={handleEndStage}
              className="px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-black transition-all active:scale-95"
            >
              End Stage
            </button>
          ) : (
            <div className="w-20" />
          )}

        </div>
      </div>
    </div>
  );
};
