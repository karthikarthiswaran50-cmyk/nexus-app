import React from 'react';
import { useSocket } from '../../context/SocketContext';
import { Phone, PhoneOff, Video, Mic, Sparkles } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { PlanBadge } from '../common/Badge';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptIncomingCall, rejectIncomingCall } = useSocket();

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/85 backdrop-blur-lg animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-sm bg-dark-900 border border-dark-700/70 rounded-3xl p-8 shadow-2xl text-center overflow-hidden">
        
        {/* Glowing Background Radial */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Ringing Animation Avatar */}
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 rounded-full bg-brand-500/30 animate-ping opacity-75" />
          <div className="relative">
            <Avatar
              src={incomingCall.caller.avatar_url}
              name={incomingCall.caller.full_name}
              size="2xl"
              planId={incomingCall.caller.plan_id}
            />
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-bold text-white mb-1">
          {incomingCall.caller.full_name}
        </h3>
        <p className="text-xs text-dark-400 mb-2">@{incomingCall.caller.username}</p>

        <div className="flex items-center justify-center gap-2 mb-6">
          <PlanBadge planId={incomingCall.caller.plan_id} size="sm" />
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-dark-800 text-dark-300 border border-dark-700">
            {isVideo ? 'Incoming Video Call...' : 'Incoming Audio Call...'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-6">
          {/* Decline Button */}
          <button
            type="button"
            onClick={rejectIncomingCall}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/20 transition-all transform active:scale-95 group-hover:scale-105">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-dark-400 group-hover:text-rose-300">Decline</span>
          </button>

          {/* Accept Button */}
          <button
            type="button"
            onClick={acceptIncomingCall}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-all transform active:scale-95 group-hover:scale-105 animate-bounce">
              {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </div>
            <span className="text-xs font-medium text-emerald-400">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};
