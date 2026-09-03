import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { User, CallType, Message, ActiveCallSession } from '../types';
import { soundEffects } from '../utils/soundEffects';

interface IncomingCallData {
  caller: User;
  callType: CallType;
  sdpOffer: any;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUserIds: Set<string>;
  incomingCall: IncomingCallData | null;
  activeCall: ActiveCallSession | null;
  setActiveCall: (session: ActiveCallSession | null) => void;
  startCall: (peerUser: User, callType: CallType) => void;
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => void;
  endActiveCall: () => void;
  clearIncomingCall: () => void;
  latestMessage: Message | null;
  typingMap: Record<string, boolean>; // userId -> isTyping
  sendTyping: (receiverId: string, isTyping: boolean) => void;
  callBannerMessage: string | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user, settings } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallSession | null>(null);
  const [latestMessage, setLatestMessage] = useState<Message | null>(null);
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [callBannerMessage, setCallBannerMessage] = useState<string | null>(null);

  const activeCallRef = useRef<ActiveCallSession | null>(null);
  activeCallRef.current = activeCall;

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('presence:get_online');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('presence:online_list', (userIds: string[]) => {
      setOnlineUserIds(new Set(userIds));
    });

    // Handle Incoming Call
    newSocket.on('call:incoming', (data: IncomingCallData) => {
      // Check privacy settings if available
      if (settings?.allow_calls_from === 'subscribers' && (!data.caller.plan_id || data.caller.plan_id === 'free')) {
        newSocket.emit('call:reject', { callerId: data.caller.id, reason: 'Recipient only accepts calls from Subscribers' });
        return;
      }

      setIncomingCall(data);
      if (settings?.notification_sound !== false) {
        soundEffects.playIncomingCallTone();
      }
    });

    newSocket.on('call:rejected', (data: { receiverId: string; reason?: string }) => {
      soundEffects.stopOutgoingRing();
      soundEffects.playCallEndedTone();
      setCallBannerMessage(`Call declined: ${data.reason || 'User busy'}`);
      setTimeout(() => setCallBannerMessage(null), 4000);
      setActiveCall(null);
    });

    newSocket.on('call:busy', (data: { message: string }) => {
      soundEffects.stopOutgoingRing();
      soundEffects.playCallEndedTone();
      setCallBannerMessage(data.message || 'User is on another call');
      setTimeout(() => setCallBannerMessage(null), 4000);
      setActiveCall(null);
    });

    newSocket.on('call:user_offline', (data: { message: string }) => {
      soundEffects.stopOutgoingRing();
      soundEffects.playCallEndedTone();
      setCallBannerMessage(data.message || 'User is currently offline');
      setTimeout(() => setCallBannerMessage(null), 4000);
      setActiveCall(null);
    });

    newSocket.on('call:ended', () => {
      soundEffects.stopOutgoingRing();
      soundEffects.stopIncomingCallTone();
      soundEffects.playCallEndedTone();
      setActiveCall(null);
      setIncomingCall(null);
    });

    // Real-time Messages
    newSocket.on('chat:new_message', (data: { message: Message; conversationId: string }) => {
      setLatestMessage(data.message);
      if (settings?.notification_sound !== false) {
        soundEffects.playMessageSound();
      }
    });

    newSocket.on('chat:message_sent', (data: { message: Message; conversationId: string }) => {
      setLatestMessage(data.message);
    });

    newSocket.on('chat:user_typing', (data: { senderId: string; isTyping: boolean }) => {
      setTypingMap(prev => ({ ...prev, [data.senderId]: data.isTyping }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      soundEffects.stopOutgoingRing();
      soundEffects.stopIncomingCallTone();
    };
  }, [token, user?.id]);

  const startCall = useCallback((peerUser: User, callType: CallType) => {
    if (!socket || !user) return;
    soundEffects.playOutgoingRing();
    setActiveCall({
      peerUser,
      callType,
      role: 'caller',
    });
  }, [socket, user]);

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    soundEffects.stopIncomingCallTone();
    soundEffects.playConnectedTone();

    setActiveCall({
      peerUser: incomingCall.caller,
      callType: incomingCall.callType,
      role: 'receiver',
      isIncoming: true,
      sdpOffer: incomingCall.sdpOffer,
    });
    setIncomingCall(null);
  }, [incomingCall]);

  const rejectIncomingCall = useCallback(() => {
    if (!incomingCall || !socket) return;
    soundEffects.stopIncomingCallTone();
    socket.emit('call:reject', {
      callerId: incomingCall.caller.id,
      reason: 'Call declined by user',
    });
    setIncomingCall(null);
  }, [incomingCall, socket]);

  const endActiveCall = useCallback(() => {
    soundEffects.stopOutgoingRing();
    soundEffects.stopIncomingCallTone();
    soundEffects.playCallEndedTone();
    if (activeCall && socket) {
      socket.emit('call:end', {
        targetUserId: activeCall.peerUser.id,
        callType: activeCall.callType,
      });
    }
    setActiveCall(null);
  }, [activeCall, socket]);

  const clearIncomingCall = () => {
    soundEffects.stopIncomingCallTone();
    setIncomingCall(null);
  };

  const sendTyping = useCallback((receiverId: string, isTyping: boolean) => {
    if (socket) {
      socket.emit('chat:typing', { receiverId, isTyping });
    }
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUserIds,
        incomingCall,
        activeCall,
        setActiveCall,
        startCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endActiveCall,
        clearIncomingCall,
        latestMessage,
        typingMap,
        sendTyping,
        callBannerMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
