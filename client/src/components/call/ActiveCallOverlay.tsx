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
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';
import axios from 'axios';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/95 backdrop-blur-xl animate-in fade-in duration-300">
      
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between z-20 bg-gradient-to-b from-dark-950/80 to-transparent">
        <div className="flex items-center gap-3">
          <Avatar src={peer.avatar_url} name={peer.full_name} size="sm" planId={peer.plan_id} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white leading-none">{peer.full_name}</h3>
              <PlanBadge planId={peer.plan_id} size="sm" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-xs text-dark-300">
                {callStatus === 'ringing' ? 'Ringing...' : callStatus === 'connecting' ? 'Connecting WebRTC...' : formattedDuration}
              </span>
              {peerMicMuted && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 flex items-center gap-1">
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
                ? 'bg-brand-600 text-white border-brand-500'
                : 'bg-dark-900/80 text-dark-300 hover:text-white border-dark-700/60'
            }`}
            title="In-call chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-dark-900/80 hover:bg-dark-800 text-dark-300 hover:text-white border border-dark-700/60 transition-all"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video & Stream Canvas Area */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-4 sm:p-6 pb-28">
        
        {/* Remote Video (Full Screen / Main Display) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full max-w-6xl max-h-[82vh] rounded-3xl object-cover bg-dark-900 ring-1 ring-white/10 shadow-2xl transition-all ${
            peerCameraOff && !peerScreenSharing ? 'hidden' : 'block'
          }`}
        />

        {/* Audio Visualizer Fallback (When peer camera is off or call is Audio-only) */}
        {(peerCameraOff && !peerScreenSharing) && (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping opacity-50" />
              <div className="relative">
                <Avatar
                  src={peer.avatar_url}
                  name={peer.full_name}
                  size="2xl"
                  planId={peer.plan_id}
                />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{peer.full_name}</h2>
            <p className="text-xs text-dark-400 mb-4">{peer.bio || 'High Definition Audio Call'}</p>
            
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-dark-900/80 border border-dark-700 text-xs text-emerald-400">
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>{callStatus === 'connected' ? 'Encrypted HD Voice Live' : 'Establishing Secure Connection...'}</span>
            </div>
          </div>
        )}

        {/* Local Video Preview (Floating PIP Corner) */}
        <div className="absolute bottom-28 right-6 w-36 h-48 sm:w-52 sm:h-36 rounded-2xl overflow-hidden bg-dark-900 ring-2 ring-brand-500/50 shadow-2xl z-20 group transition-all hover:scale-105">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isCameraOff && !isScreenSharing ? 'hidden' : 'block'}`}
          />
          {isCameraOff && !isScreenSharing && (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-dark-900">
              <Avatar src={user?.avatar_url} name={user?.full_name || ''} size="sm" />
              <span className="text-[10px] text-dark-400 mt-1">Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-dark-950/70 text-[10px] text-white backdrop-blur-sm">
            You {isMicMuted && '(Muted)'}
          </div>
        </div>

        {/* Error message toast if any */}
        {errorMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs shadow-lg z-30">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Floating In-Call Chat Drawer */}
      {isChatOpen && (
        <div className="absolute right-4 top-20 bottom-28 w-80 sm:w-96 bg-dark-900/95 backdrop-blur-xl border border-dark-700/80 rounded-2xl shadow-2xl flex flex-col z-30 overflow-hidden animate-in slide-in-from-right duration-200">
          <div className="p-3.5 border-b border-dark-800 flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
              In-Call Chat
            </h4>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="text-dark-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-dark-500 mt-8">No in-call messages yet. Send a quick note!</p>
            ) : (
              chatMessages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                return (
                  <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                        isMe
                          ? 'bg-brand-600 text-white rounded-br-none'
                          : 'bg-dark-800 text-dark-100 rounded-bl-none border border-dark-700'
                      }`}
                    >
                      <p>{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSendInCallMessage} className="p-2.5 border-t border-dark-800 flex gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Send message in call..."
              className="flex-1 bg-dark-800 border border-dark-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition-all"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* In-Call Controls Bottom Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 sm:gap-4 p-3 rounded-2xl bg-dark-900/90 border border-dark-700/80 shadow-2xl backdrop-blur-xl">
        
        {/* Toggle Microphone */}
        <button
          type="button"
          onClick={toggleMicrophone}
          className={`p-3.5 rounded-xl border transition-all ${
            isMicMuted
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
              : 'bg-dark-800 border-dark-700 text-white hover:bg-dark-700'
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
              : 'bg-dark-800 border-dark-700 text-white hover:bg-dark-700'
          }`}
          title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share (Available for Pro & VIP tiers or general) */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-xl border transition-all ${
            isScreenSharing
              ? 'bg-brand-600 border-brand-500 text-white'
              : 'bg-dark-800 border-dark-700 text-dark-300 hover:text-white hover:bg-dark-700'
          }`}
          title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={hangup}
          className="p-3.5 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 flex items-center gap-2 font-semibold text-sm transition-all transform active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline">End Call</span>
        </button>
      </div>
    </div>
  );
};
