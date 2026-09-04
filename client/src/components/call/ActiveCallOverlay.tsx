import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Maximize2,
  Minimize2,
  MessageSquare,
  Sparkles,
  Shield,
  Volume2,
  Send,
  X,
  Crown,
  Lock,
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';

export const ActiveCallOverlay: React.FC = () => {
  const { activeCall, socket } = useSocket();
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender_id: string; content: string; created_at: string }>>([]);
  const [inputMsg, setInputMsg] = useState('');

  const {
    callStatus,
    formattedDuration,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    peerMicMuted,
    peerCameraOff,
    peerScreenSharing,
    errorMessage,
    localVideoRef,
    remoteVideoRef,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    hangup,
  } = useWebRTC(activeCall);

  // In-call chat real-time listeners
  useEffect(() => {
    if (!socket || !activeCall) return;

    const handleInCallMsg = (data: { message: any }) => {
      if (data.message.sender_id === activeCall.peerUser.id || data.message.sender_id === user?.id) {
        setChatMessages(prev => [...prev, data.message]);
      }
    };

    socket.on('chat:new_message', handleInCallMsg);
    socket.on('chat:message_sent', handleInCallMsg);

    return () => {
      socket.off('chat:new_message', handleInCallMsg);
      socket.off('chat:message_sent', handleInCallMsg);
    };
  }, [socket, activeCall?.peerUser.id, user?.id]);

  const handleSendInCallMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !socket || !activeCall) return;

    socket.emit('chat:send_message', {
      receiverId: activeCall.peerUser.id,
      content: inputMsg.trim(),
      type: 'text',
    });
    setInputMsg('');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!activeCall) return null;

  const peer = activeCall.peerUser;
  const isVideoCall = activeCall.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/95 backdrop-blur-2xl animate-in fade-in duration-300 font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* 👑 Top Header Bar (Royal Glass) */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between z-20 bg-gradient-to-b from-dark-950/90 to-transparent">
        <div className="flex items-center gap-3">
          <Avatar src={peer.avatar_url} name={peer.full_name} size="sm" planId={peer.plan_id} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white leading-none">{peer.full_name}</h3>
              <PlanBadge planId={peer.plan_id} size="sm" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-gold-400 animate-pulse'}`} />
              <span className="text-xs text-amber-200/90 font-mono font-medium">
                {callStatus === 'ringing' ? 'Royal Ringing...' : callStatus === 'connecting' ? 'Establishing 4K Quantum WebRTC...' : formattedDuration}
              </span>
              {peerMicMuted && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 flex items-center gap-1 border border-rose-500/30">
                  <MicOff className="w-2.5 h-2.5" /> Peer Muted
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* In-Call Chat Toggle */}
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2.5 rounded-xl border transition-all ${
              isChatOpen
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 border-gold-400 font-bold shadow-md shadow-gold-500/20'
                : 'bg-dark-900/80 text-dark-300 hover:text-amber-200 border-gold-500/20'
            }`}
            title="In-call chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-dark-900/80 hover:bg-dark-850 text-dark-300 hover:text-amber-200 border border-gold-500/20 transition-all shadow-sm"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video & Stream Canvas Area */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4 sm:p-6 pb-28">
        
        {/* Remote Video (4K Frame with Gold Sheen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full max-w-6xl max-h-[82vh] rounded-3xl object-cover bg-dark-900 ring-1 ring-gold-500/30 shadow-2xl transition-all ${
            peerCameraOff && !peerScreenSharing ? 'hidden' : 'block'
          }`}
        />

        {/* Royal Audio Visualizer Fallback */}
        {(peerCameraOff && !peerScreenSharing) && (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-gold-500/20 animate-ping opacity-60" />
              <div className="relative">
                <Avatar
                  src={peer.avatar_url}
                  name={peer.full_name}
                  size="2xl"
                  planId={peer.plan_id}
                  className="ring-4 ring-gold-400 shadow-2xl shadow-gold-500/30"
                />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white mb-1">{peer.full_name}</h2>
            <p className="text-xs text-dark-400 mb-4">{peer.bio || 'Ultra-HD Royal Voice Stream'}</p>
            
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-dark-900/90 border border-gold-500/30 text-xs text-amber-200 shadow-lg shadow-gold-500/10">
              <Volume2 className="w-4 h-4 text-gold-400 animate-pulse" />
              <span className="font-semibold">{callStatus === 'connected' ? '256-Bit Encrypted HD Voice Live' : 'Establishing Secure Gateway...'}</span>
            </div>
          </div>
        )}

        {/* Local Video Preview (Floating Gold PIP Corner) */}
        <div className="absolute bottom-28 right-6 w-36 h-48 sm:w-52 sm:h-36 rounded-2xl overflow-hidden bg-dark-900 ring-2 ring-gold-400/70 shadow-2xl shadow-gold-500/20 z-20 group transition-all hover:scale-105">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraOff && !isScreenSharing ? 'hidden' : 'block'}`}
          />
          {isCameraOff && !isScreenSharing && (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-dark-900">
              <Avatar src={user?.avatar_url} name={user?.full_name || ''} size="sm" planId={user?.plan_id} />
              <span className="text-[10px] text-dark-400 mt-1">Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-dark-950/80 border border-gold-500/20 text-[10px] text-amber-200 font-bold backdrop-blur-sm">
            You {isMicMuted && '(Muted)'}
          </div>
        </div>

        {/* Error message toast if any */}
        {errorMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs shadow-lg z-30 font-bold">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Floating In-Call Chat Drawer (Royal Glass) */}
      {isChatOpen && (
        <div className="absolute right-4 top-20 bottom-28 w-80 sm:w-96 bg-dark-900/95 backdrop-blur-2xl border border-gold-500/25 rounded-2xl shadow-2xl flex flex-col z-30 overflow-hidden animate-in slide-in-from-right duration-200 royal-card">
          <div className="p-3.5 border-b border-gold-500/20 flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-gold-400" />
              <span>In-Call Royal Chat</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="p-1 rounded-full hover:bg-dark-800 text-dark-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
            {chatMessages.length === 0 ? (
              <p className="text-center text-dark-500 py-8">No messages yet in this call.</p>
            ) : (
              chatMessages.map((m) => {
                const isMe = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-2 rounded-xl max-w-[80%] ${
                        isMe ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark-950 font-bold' : 'bg-dark-800 text-white border border-gold-500/15'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendInCallMessage} className="p-2 border-t border-gold-500/15 flex items-center gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Send message in call..."
              className="flex-1 bg-dark-850 border border-gold-500/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-dark-950 font-black transition-all"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </form>
        </div>
      )}

      {/* 👑 In-Call Controls Bottom Bar (Royal Glass) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 sm:gap-4 p-3 rounded-2xl bg-dark-900/90 border border-gold-500/25 shadow-2xl shadow-black/80 backdrop-blur-2xl royal-card">
        
        {/* Toggle Microphone */}
        <button
          type="button"
          onClick={toggleMicrophone}
          className={`p-3.5 rounded-xl border transition-all ${
            isMicMuted
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
              : 'bg-dark-850 border-gold-500/20 text-amber-200 hover:bg-dark-800'
          }`}
          title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Camera */}
        <button
          type="button"
          onClick={toggleCamera}
          className={`p-3.5 rounded-xl border transition-all ${
            isCameraOff
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
              : 'bg-dark-850 border-gold-500/20 text-amber-200 hover:bg-dark-800'
          }`}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-xl border transition-all ${
            isScreenSharing
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 border-gold-400 text-dark-950 font-bold shadow-md'
              : 'bg-dark-850 border-gold-500/20 text-amber-200 hover:bg-dark-800'
          }`}
          title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={hangup}
          className="p-3.5 px-6 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-xl shadow-rose-600/30 flex items-center gap-2 font-black text-sm transition-all transform active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline">End Call</span>
        </button>
      </div>
    </div>
  );
};
