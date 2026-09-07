import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { User, CallType, Message, ActiveCallSession } from '../types';
import { soundEffects } from '../utils/soundEffects';
import { requestFcmToken, trackUserActivity } from '../config/firebase';
import { showCallNotification, closeCallNotification, showMessageNotification, subscribeToWebPush, autoRegisterPushIfGranted } from '../utils/notifications';


interface IncomingCallData {
  caller: User;
  callType: CallType;
  sdpOffer: any;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUserIds: Set<string>;
  reachableUserIds: Set<string>;
  lastSeenMap: Record<string, string>; // userId -> ISO timestamp
  incomingCall: IncomingCallData | null;
  activeCall: ActiveCallSession | null;
  setActiveCall: (session: ActiveCallSession | null) => void;
  startCall: (peerUser: User, callType: CallType) => void;
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => void;
  endActiveCall: () => void;
  clearIncomingCall: () => void;
  latestMessage: Message | null;
  reactionUpdate: { messageId: string; reactions: Record<string, string[]>; conversationId: string } | null;
  deletedMessage: { messageId: string; isDeletedForAll: boolean; deletedForUsers: string[]; conversationId: string } | null;
  sendReaction: (messageId: string, emoji: string, receiverId: string) => void;
  deleteMessage: (messageId: string, deleteType: 'for_everyone' | 'for_me', receiverId: string) => void;
  typingMap: Record<string, boolean>; // userId -> isTyping
  sendTyping: (receiverId: string, isTyping: boolean) => void;
  callBannerMessage: string | null;
  getBufferedCandidates: () => Array<{ fromUserId: string; candidate: any }>;
  subscribeToIceCandidates: (cb: (data: { fromUserId: string; candidate: any }) => void) => () => void;
  unlockAudioContext: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user, settings } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [reachableUserIds, setReachableUserIds] = useState<Set<string>>(new Set());
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallSession | null>(null);
  const [latestMessage, setLatestMessage] = useState<Message | null>(null);
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [callBannerMessage, setCallBannerMessage] = useState<string | null>(null);

  const [reactionUpdate, setReactionUpdate] = useState<{ messageId: string; reactions: Record<string, string[]>; conversationId: string } | null>(null);
  const [deletedMessage, setDeletedMessage] = useState<{ messageId: string; isDeletedForAll: boolean; deletedForUsers: string[]; conversationId: string } | null>(null);
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string>>({});

  const activeCallRef = useRef<ActiveCallSession | null>(null);
  activeCallRef.current = activeCall;

  // Global ICE candidate buffer (captured even when phone is ringing / before useWebRTC mounts)
  const bufferedCandidatesRef = useRef<Array<{ fromUserId: string; candidate: any }>>([]);
  const candidateListenersRef = useRef<Set<(data: { fromUserId: string; candidate: any }) => void>>(new Set());

  const unlockAudioContext = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      }
    } catch (e) {}
  }, []);

  const getBufferedCandidates = useCallback(() => {
    const list = [...bufferedCandidatesRef.current];
    bufferedCandidatesRef.current = [];
    return list;
  }, []);

  const subscribeToIceCandidates = useCallback((cb: (data: { fromUserId: string; candidate: any }) => void) => {
    candidateListenersRef.current.add(cb);
    return () => {
      candidateListenersRef.current.delete(cb);
    };
  }, []);

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
      newSocket.emit('call:check_pending');

      // Auto-register Web Push & FCM if permission is granted (runs every connect)
      autoRegisterPushIfGranted();
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        requestFcmToken().then((fcmToken) => {
          if (fcmToken) {
            axios.post('/api/users/fcm-token', { token: fcmToken }).catch(() => {});
          }
        }).catch(() => {});
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // 🔔 When service worker receives push (phone wakes from background),
    // reconnect socket and check for any pending calls
    const swMessageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        if (!newSocket.connected) {
          newSocket.connect();
        }
        newSocket.emit('call:check_pending');
      }

      // Handle call action buttons (Answer / Decline) from lockscreen notification
      if (event.data?.type === 'CALL_ACTION') {
        if (event.data.action === 'decline') {
          const callerId = event.data.data?.callerId;
          if (callerId && newSocket.connected) {
            newSocket.emit('call:reject', { callerId, reason: 'Call declined from notification' });
          } else if (!newSocket.connected) {
            newSocket.connect();
            newSocket.once('connect', () => {
              if (callerId) {
                newSocket.emit('call:reject', { callerId, reason: 'Call declined from notification' });
              }
            });
          }
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', swMessageHandler);

    newSocket.on('presence:online_list', (userIds: string[]) => {
      setOnlineUserIds(new Set(userIds));
    });

    newSocket.on('presence:reachable_list', (userIds: string[]) => {
      setReachableUserIds(new Set(userIds));
    });

    newSocket.on('call:ringing', (data: { receiverId: string; message?: string }) => {
      setCallBannerMessage(data.message || '📞 Ringing mobile device...');
    });

    // Handle Incoming Call
    newSocket.on('call:incoming', (data: IncomingCallData) => {
      setIncomingCall(data);
      if (settings?.notification_sound !== false) {
        soundEffects.playIncomingCallTone();
      }
      // Trigger Web/System Notification & Mobile Haptic Vibration
      showCallNotification(
        data.caller.full_name || data.caller.username || 'Nexus Royal Contact',
        data.callType,
        data.caller.avatar_url
      );
    });

    newSocket.on('call:rejected', (data: { receiverId: string; reason?: string }) => {
      closeCallNotification();
      soundEffects.stopOutgoingRing();
      soundEffects.playCallEndedTone();
      setCallBannerMessage(`Call declined: ${data.reason || 'User busy'}`);
      setTimeout(() => setCallBannerMessage(null), 4000);
      setActiveCall(null);
    });

    newSocket.on('call:busy', (data: { message: string }) => {
      closeCallNotification();
      soundEffects.stopOutgoingRing();
      soundEffects.playCallEndedTone();
      setCallBannerMessage(data.message || 'User is on another call');
      setTimeout(() => setCallBannerMessage(null), 4000);
      setActiveCall(null);
    });

    newSocket.on('call:user_offline', (data: { message: string }) => {
      closeCallNotification();
      soundEffects.stopOutgoingRing();
      soundEffects.playCallEndedTone();
      setCallBannerMessage(data.message || 'User is currently offline');
      setTimeout(() => setCallBannerMessage(null), 4000);
      setActiveCall(null);
    });

    newSocket.on('call:ended', () => {
      closeCallNotification();
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
      // If message is from another user, trigger system notification & mobile vibration
      if (data.message.sender_id !== user?.id) {
        const senderName = data.message.sender?.full_name || data.message.sender?.username || 'Nexus Contact';
        const textPreview = data.message.type === 'audio'
          ? '🎤 Voice Message'
          : data.message.type === 'image'
          ? '📷 Photo'
          : data.message.content || 'Sent an attachment';
        showMessageNotification(senderName, textPreview, data.message.sender?.avatar_url, data.conversationId);
      }
    });

    newSocket.on('chat:message_sent', (data: { message: Message; conversationId: string }) => {
      setLatestMessage(data.message);
    });

    newSocket.on('chat:user_typing', (data: { senderId: string; isTyping: boolean }) => {
      setTypingMap(prev => ({ ...prev, [data.senderId]: data.isTyping }));
    });

    newSocket.on('chat:reaction_updated', (data: { messageId: string; reactions: Record<string, string[]>; conversationId: string }) => {
      setReactionUpdate(data);
    });

    newSocket.on('chat:message_deleted', (data: { messageId: string; isDeletedForAll: boolean; deletedForUsers: string[]; conversationId: string }) => {
      setDeletedMessage(data);
    });

    newSocket.on('presence:last_seen', (data: { userId: string; lastSeen: string }) => {
      setLastSeenMap(prev => ({ ...prev, [data.userId]: data.lastSeen }));
    });

    // Global ICE candidate listeners (buffers candidates even when phone is ringing before user taps accept)
    newSocket.on('call:ice_candidate', (data: { fromUserId: string; candidate: any }) => {
      if (data?.candidate) {
        bufferedCandidatesRef.current.push(data);
        candidateListenersRef.current.forEach(cb => cb(data));
      }
    });

    newSocket.on('call:buffered_ice_candidates', (data: { candidates: Array<{ fromUserId: string; candidate: any }> }) => {
      if (data?.candidates && Array.isArray(data.candidates)) {
        bufferedCandidatesRef.current.push(...data.candidates);
        data.candidates.forEach(cand => {
          candidateListenersRef.current.forEach(cb => cb(cand));
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      soundEffects.stopOutgoingRing();
      soundEffects.stopIncomingCallTone();
      navigator.serviceWorker?.removeEventListener('message', swMessageHandler);
    };
  }, [token, user?.id]);


  const startCall = useCallback((peerUser: User, callType: CallType) => {
    if (!socket || !user) return;
    unlockAudioContext();
    bufferedCandidatesRef.current = [];
    soundEffects.playOutgoingRing();
    setActiveCall({
      peerUser,
      callType,
      role: 'caller',
    });

    // Track call initiation in Firebase Console
    trackUserActivity({
      userId: user.id,
      username: user.username,
      action: 'call_started',
      details: {
        callType,
        recipientId: peerUser.id,
        recipientUsername: peerUser.username,
      },
    });
  }, [socket, user, unlockAudioContext]);

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    unlockAudioContext();
    closeCallNotification();
    soundEffects.stopIncomingCallTone();
    soundEffects.playConnectedTone();

    setActiveCall({
      peerUser: incomingCall.caller,
      callType: incomingCall.callType,
      role: 'receiver',
      isIncoming: true,
      sdpOffer: incomingCall.sdpOffer,
    });

    // Track answered call in Firebase Console
    trackUserActivity({
      userId: user?.id,
      username: user?.username,
      action: 'call_answered',
      details: {
        callType: incomingCall.callType,
        callerId: incomingCall.caller.id,
        callerUsername: incomingCall.caller.username,
      },
    });

    setIncomingCall(null);
  }, [incomingCall, user, unlockAudioContext]);

  const rejectIncomingCall = useCallback(() => {
    closeCallNotification();
    bufferedCandidatesRef.current = [];
    if (!incomingCall || !socket) return;
    soundEffects.stopIncomingCallTone();
    socket.emit('call:reject', {
      callerId: incomingCall.caller.id,
      reason: 'Call declined by user',
    });
    setIncomingCall(null);
  }, [incomingCall, socket]);

  const endActiveCall = useCallback(() => {
    closeCallNotification();
    bufferedCandidatesRef.current = [];
    soundEffects.stopOutgoingRing();
    soundEffects.stopIncomingCallTone();
    soundEffects.playCallEndedTone();
    if (activeCall && socket) {
      socket.emit('call:end', {
        targetUserId: activeCall.peerUser.id,
        callType: activeCall.callType,
      });

      // Track call ended in Firebase Console
      trackUserActivity({
        userId: user?.id,
        username: user?.username,
        action: 'call_ended',
        details: {
          callType: activeCall.callType,
          peerUserId: activeCall.peerUser.id,
        },
      });
    }
    setActiveCall(null);
  }, [activeCall, socket, user]);

  const clearIncomingCall = () => {
    closeCallNotification();
    bufferedCandidatesRef.current = [];
    soundEffects.stopIncomingCallTone();
    setIncomingCall(null);
  };

  const sendTyping = useCallback((receiverId: string, isTyping: boolean) => {
    if (socket) {
      socket.emit('chat:typing', { receiverId, isTyping });
    }
  }, [socket]);

  const sendReaction = useCallback((messageId: string, emoji: string, receiverId: string) => {
    if (socket) {
      socket.emit('chat:reaction', { messageId, emoji, receiverId });
    }
  }, [socket]);

  const deleteMessage = useCallback((messageId: string, deleteType: 'for_everyone' | 'for_me', receiverId: string) => {
    if (socket) {
      socket.emit('chat:delete_message', { messageId, deleteType, receiverId });
    }
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUserIds,
        reachableUserIds,
        lastSeenMap,
        incomingCall,
        activeCall,
        setActiveCall,
        startCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endActiveCall,
        clearIncomingCall,
        latestMessage,
        reactionUpdate,
        deletedMessage,
        sendReaction,
        deleteMessage,
        typingMap,
        sendTyping,
        callBannerMessage,
        getBufferedCandidates,
        subscribeToIceCandidates,
        unlockAudioContext,
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
