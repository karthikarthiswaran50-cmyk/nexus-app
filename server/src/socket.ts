import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware/auth.js';
import { AuthPayload, CallType, UserWithPlan } from './types.js';
import { saveMessage, toggleReaction, deleteMessage } from './controllers/chat.js';
import { recordCallLog } from './controllers/calls.js';
import { getUserWithPlan } from './controllers/auth.js';
import { db } from './db.js';
import { sendPushToUser } from './services/webpush.js';

interface SocketUser {
  userId: string;
  socketId: string;
  user: UserWithPlan | null;
}

interface PendingCall {
  callerId: string;
  receiverId: string;
  caller: UserWithPlan;
  callType: CallType;
  sdpOffer: any;
  createdAt: number;
  expiresAt: number;
  timeoutId: NodeJS.Timeout;
}

let activeIo: Server | null = null;
const userSockets = new Map<string, Set<string>>();

export function getOnlineUsersCount(): number {
  return userSockets.size;
}

export function disconnectUserSockets(userId: string) {
  const socketIds = userSockets.get(userId);
  if (socketIds && activeIo) {
    for (const sid of socketIds) {
      const s = activeIo.sockets.sockets.get(sid);
      if (s) {
        s.emit('auth:banned', { reason: 'Your account has been suspended by Royal Admin.' });
        s.disconnect(true);
      }
    }
  }
}

export function broadcastAnnouncementSocket(announcement: any) {
  if (activeIo) {
    activeIo.emit('system:announcement', announcement);
  }
}

export function setupSocket(io: Server) {
  activeIo = io;
  // Map: socketId -> userId
  const socketUsers = new Map<string, string>();
  // Map: active call pairs (to track in-progress calls)
  const activeCalls = new Map<string, { callerId: string; receiverId: string; callType: CallType; startedAt: number }>();
  // Map: pending call invitations for offline/sleeping devices (receiverId -> PendingCall)
  const pendingCalls = new Map<string, PendingCall>();
  // Map: targetUserId -> list of buffered ICE candidates
  const bufferedCandidates = new Map<string, Array<{ fromUserId: string; candidate: any }>>();

  function addBufferedCandidate(targetUserId: string, item: { fromUserId: string; candidate: any }) {
    if (!bufferedCandidates.has(targetUserId)) {
      bufferedCandidates.set(targetUserId, []);
    }
    const list = bufferedCandidates.get(targetUserId)!;
    // Limit to latest 100 candidates to prevent memory leaks
    if (list.length < 100) {
      list.push(item);
    }
  }

  function getAndClearBufferedCandidates(targetUserId: string) {
    const list = bufferedCandidates.get(targetUserId) || [];
    bufferedCandidates.delete(targetUserId);
    return list;
  }

  function getSocketsForUser(userId: string): string[] {
    return Array.from(userSockets.get(userId) || []);
  }

  function broadcastOnlineList() {
    const onlineUserIds = Array.from(userSockets.keys());
    let reachableUserIds: string[] = [];
    try {
      const subRows = db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all() as any[];
      const settingRows = db.prepare('SELECT user_id FROM user_settings WHERE fcm_token IS NOT NULL').all() as any[];
      reachableUserIds = Array.from(new Set([
        ...onlineUserIds,
        ...subRows.map(r => r.user_id),
        ...settingRows.map(r => r.user_id),
      ]));
    } catch (e) {
      reachableUserIds = onlineUserIds;
    }

    io.emit('presence:online_list', onlineUserIds);
    io.emit('presence:reachable_list', reachableUserIds);
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token as string, JWT_SECRET) as AuthPayload;
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authUser = (socket as any).user as AuthPayload | undefined;
    if (!authUser) {
      socket.disconnect();
      return;
    }

    const userId = authUser.userId;
    socketUsers.set(socket.id, userId);

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Broadcast updated presence lists
    broadcastOnlineList();

    // Check if this connecting user has a pending incoming call waiting
    const checkAndDeliverPendingCall = () => {
      if (pendingCalls.has(userId)) {
        const pending = pendingCalls.get(userId)!;
        if (Date.now() < pending.expiresAt) {
          socket.emit('call:incoming', {
            caller: pending.caller,
            callType: pending.callType,
            sdpOffer: pending.sdpOffer,
          });
        } else {
          clearTimeout(pending.timeoutId);
          pendingCalls.delete(userId);
        }
      }
    };

    checkAndDeliverPendingCall();
    socket.on('call:check_pending', checkAndDeliverPendingCall);

    // ----------------------------------------------------
    // 1. PRESENCE
    // ----------------------------------------------------
    socket.on('presence:get_online', () => {
      broadcastOnlineList();
    });

    // ----------------------------------------------------
    // 2. REAL-TIME CHAT
    // ----------------------------------------------------
    socket.on('chat:send_message', async (data: {
      receiverId: string;
      content: string;
      type?: 'text' | 'image' | 'audio' | 'system' | 'call_log';
      mediaUrl?: string;
      replyToId?: string;
      replyToContent?: string;
      replyToSender?: string;
    }) => {
      try {
        const { receiverId, content, type = 'text', mediaUrl, replyToId, replyToContent, replyToSender } = data;
        if (typeof receiverId !== 'string' || !receiverId.trim() || (!content && !mediaUrl)) return;

        const safeContent = typeof content === 'string' ? content.slice(0, 10000) : '';
        const safeType = ['text', 'image', 'audio', 'system', 'call_log'].includes(type) ? type : 'text';
        const safeMediaUrl = typeof mediaUrl === 'string' && (mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('https://'))
          ? mediaUrl.slice(0, 500)
          : undefined;

        const result = saveMessage({
          senderId: userId,
          receiverId: receiverId.trim(),
          content: safeContent,
          type: safeType as any,
          mediaUrl: safeMediaUrl,
          replyToId: typeof replyToId === 'string' ? replyToId.slice(0, 100) : undefined,
          replyToContent: typeof replyToContent === 'string' ? replyToContent.slice(0, 500) : undefined,
          replyToSender: typeof replyToSender === 'string' ? replyToSender.slice(0, 100) : undefined,
        });

        // Emit to all active sockets of receiver
        const receiverSocketIds = getSocketsForUser(receiverId);
        receiverSocketIds.forEach((sId) => {
          io.to(sId).emit('chat:new_message', result);
        });

        // Emit back to sender
        socket.emit('chat:message_sent', result);

        // Always dispatch high-priority Web Push / FCM to receiver's mobile device
        const sender = getUserWithPlan(userId);
        const preview = type === 'text'
          ? (content || '')
          : (type as string) === 'audio' || (type as string) === 'voice'
          ? '🎤 Voice Message'
          : type === 'image'
          ? '📷 Photo'
          : '📎 Attachment';

        sendPushToUser(
          receiverId,
          {
            notification: {
              title: `💬 ${sender?.full_name || 'Nexus Contact'}`,
              body: preview,
              icon: sender?.avatar_url || '/icon-192.svg',
              badge: '/icon-192.svg',
            },
            data: {
              type: 'message',
              conversationId: result.conversationId,
              senderId: userId,
              senderName: sender?.full_name || 'Nexus Contact',
              tag: `nexus-msg-${result.conversationId}`,
              url: '/',
            },
          },
          false
        ).catch(() => {});
      } catch (err) {
        console.error('Socket chat:send_message error:', err);
      }
    });

    // Message Emoji Reaction Handler
    socket.on('chat:reaction', (data: { messageId: string; emoji: string; receiverId: string }) => {
      try {
        const res = toggleReaction(data.messageId, userId, data.emoji);
        if (res) {
          const payload = {
            messageId: res.messageId,
            reactions: res.reactions,
            conversationId: res.conversationId,
            userId,
          };

          // Broadcast to sender and receiver
          socket.emit('chat:reaction_updated', payload);
          const receiverSocketIds = getSocketsForUser(data.receiverId);
          receiverSocketIds.forEach((sId) => {
            io.to(sId).emit('chat:reaction_updated', payload);
          });
        }
      } catch (err) {
        console.error('Socket chat:reaction error:', err);
      }
    });

    // Delete Message Handler (for_everyone | for_me)
    socket.on('chat:delete_message', (data: { messageId: string; deleteType: 'for_everyone' | 'for_me'; receiverId: string }) => {
      try {
        const res = deleteMessage(data.messageId, userId, data.deleteType);
        if (res) {
          const payload = {
            messageId: res.messageId,
            deleteType: data.deleteType,
            isDeletedForAll: res.isDeletedForAll,
            deletedForUsers: res.deletedForUsers,
            deletedBy: userId,
            conversationId: res.conversationId,
          };

          socket.emit('chat:message_deleted', payload);
          if (data.deleteType === 'for_everyone') {
            const receiverSocketIds = getSocketsForUser(data.receiverId);
            receiverSocketIds.forEach((sId) => {
              io.to(sId).emit('chat:message_deleted', payload);
            });
          }
        }
      } catch (err) {
        console.error('Socket chat:delete_message error:', err);
      }
    });

    socket.on('chat:typing', (data: { receiverId: string; isTyping: boolean }) => {
      const receiverSocketIds = getSocketsForUser(data.receiverId);
      receiverSocketIds.forEach((sId) => {
        io.to(sId).emit('chat:user_typing', {
          senderId: userId,
          isTyping: data.isTyping,
        });
      });
    });

    socket.on('chat:read', (data: { senderId: string }) => {
      try {
        // Find conversation between these two users
        const conv = db.prepare(`
          SELECT id FROM conversations
          WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        `).get(userId, data.senderId, data.senderId, userId) as any;

        db.prepare(`
          UPDATE messages
          SET is_read = 1
          WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
        `).run(userId, data.senderId);

        const senderSocketIds = getSocketsForUser(data.senderId);
        senderSocketIds.forEach((sId) => {
          io.to(sId).emit('chat:messages_read', { readBy: userId, conversationId: conv?.id });
        });
      } catch (err) {
        console.error('Socket chat:read error:', err);
      }
    });

    // ----------------------------------------------------
    // 3. WEBRTC CALL SIGNALING (AUDIO & VIDEO)
    // ----------------------------------------------------
    socket.on('call:initiate', async (data: {
      receiverId: string;
      callType: CallType;
      sdpOffer: any;
    }) => {
      const { receiverId, callType, sdpOffer } = data;
      if (!receiverId || receiverId === userId) {
        socket.emit('call:error', { message: 'Invalid call recipient.' });
        return;
      }

      const caller = getUserWithPlan(userId);
      const receiver = getUserWithPlan(receiverId);

      if (!caller || !receiver) {
        socket.emit('call:error', { message: 'User not found.' });
        return;
      }

      // Check if receiver is already in an active call
      const isReceiverBusy = Array.from(activeCalls.values()).some(
        c => c.callerId === receiverId || c.receiverId === receiverId
      );

      if (isReceiverBusy) {
        socket.emit('call:busy', {
          receiverId,
          message: `${receiver.full_name} is on another call.`,
        });
        return;
      }

      // 1. Dispatch Instant Web Push / FCM to wake up recipient's phone / lock screen
      sendPushToUser(
        receiverId,
        {
          notification: {
            title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
            body: `${caller.full_name} is calling you on Nexus Royal... Tap to answer!`,
            icon: caller.avatar_url || '/icon-192.svg',
            badge: '/icon-192.svg',
          },
          data: {
            type: 'call',
            callType,
            callerId: userId,
            callerName: caller.full_name,
            callerAvatar: caller.avatar_url || '',
            tag: 'nexus-incoming-call',
            url: '/',
          },
        },
        true
      ).catch(() => {});

      // Track active call
      activeCalls.set(`${userId}-${receiverId}`, {
        callerId: userId,
        receiverId,
        callType,
        startedAt: Date.now(),
      });

      const receiverSockets = getSocketsForUser(receiverId);

      if (receiverSockets.length > 0) {
        // Forward incoming call signal directly to active receiver sockets
        receiverSockets.forEach((sId) => {
          io.to(sId).emit('call:incoming', {
            caller,
            callType,
            sdpOffer,
          });
        });
        socket.emit('call:ringing', { receiverId, status: 'ringing' });
      } else {
        // Recipient is not actively in socket (phone screen locked, background PWA, or data on)
        // DO NOT ABORT! Put into pending call state with 45s ringing timer (WhatsApp style)
        if (pendingCalls.has(receiverId)) {
          clearTimeout(pendingCalls.get(receiverId)!.timeoutId);
        }

        const timeoutId = setTimeout(() => {
          if (pendingCalls.has(receiverId)) {
            pendingCalls.delete(receiverId);
            activeCalls.delete(`${userId}-${receiverId}`);
            recordCallLog({
              callerId: userId,
              receiverId,
              callType,
              status: 'missed',
              duration: 0,
            });
            socket.emit('call:user_offline', {
              receiverId,
              message: `${receiver.full_name} is not answering. Missed call recorded.`,
            });
          }
        }, 45000);

        pendingCalls.set(receiverId, {
          callerId: userId,
          receiverId,
          caller,
          callType,
          sdpOffer,
          createdAt: Date.now(),
          expiresAt: Date.now() + 45000,
          timeoutId,
        });

        // Inform caller device to keep ringing and showing "Ringing mobile..."
        socket.emit('call:ringing', {
          receiverId,
          status: 'ringing',
          message: `Ringing ${receiver.full_name}'s phone...`,
        });
      }
    });

    socket.on('call:accept', (data: {
      callerId: string;
      sdpAnswer: any;
    }) => {
      const { callerId, sdpAnswer } = data;

      // Clear any pending call for this user
      if (pendingCalls.has(userId)) {
        clearTimeout(pendingCalls.get(userId)!.timeoutId);
        pendingCalls.delete(userId);
      }

      const callerSockets = getSocketsForUser(callerId);
      callerSockets.forEach((sId) => {
        io.to(sId).emit('call:accepted', {
          receiverId: userId,
          sdpAnswer,
        });
      });

      // Deliver all buffered ICE candidates sent by caller to this receiver
      const candidatesForReceiver = getAndClearBufferedCandidates(userId);
      if (candidatesForReceiver.length > 0) {
        socket.emit('call:buffered_ice_candidates', { candidates: candidatesForReceiver });
      }
    });

    socket.on('call:get_buffered_candidates', () => {
      const candidates = getAndClearBufferedCandidates(userId);
      if (candidates.length > 0) {
        socket.emit('call:buffered_ice_candidates', { candidates });
      }
    });

    socket.on('call:reject', (data: {
      callerId: string;
      reason?: string;
    }) => {
      const { callerId, reason = 'declined' } = data;
      
      // Get the actual call type from the active calls map
      const activeCallEntry = activeCalls.get(`${callerId}-${userId}`);
      const actualCallType: CallType = activeCallEntry?.callType || 'audio';
      
      activeCalls.delete(`${callerId}-${userId}`);
      bufferedCandidates.delete(userId);
      bufferedCandidates.delete(callerId);

      if (pendingCalls.has(userId)) {
        clearTimeout(pendingCalls.get(userId)!.timeoutId);
        pendingCalls.delete(userId);
      }

      recordCallLog({
        callerId,
        receiverId: userId,
        callType: actualCallType,
        status: 'rejected',
        duration: 0,
      });

      const callerSockets = getSocketsForUser(callerId);
      callerSockets.forEach((sId) => {
        io.to(sId).emit('call:rejected', {
          receiverId: userId,
          reason,
        });
      });
    });

    socket.on('call:ice_candidate', (data: {
      targetUserId: string;
      candidate: any;
    }) => {
      const { targetUserId, candidate } = data;
      if (!targetUserId || !candidate) return;

      // Always buffer for target user in case their peer connection is still initializing or ringing
      addBufferedCandidate(targetUserId, { fromUserId: userId, candidate });

      const targetSockets = getSocketsForUser(targetUserId);
      targetSockets.forEach((sId) => {
        io.to(sId).emit('call:ice_candidate', {
          fromUserId: userId,
          candidate,
        });
      });
    });

    socket.on('call:end', (data: {
      targetUserId: string;
      callType: CallType;
      duration?: number;
    }) => {
      const { targetUserId, callType = 'video', duration = 0 } = data;
      
      // Cleanup active call map, buffered candidates & pending calls
      activeCalls.delete(`${userId}-${targetUserId}`);
      activeCalls.delete(`${targetUserId}-${userId}`);
      bufferedCandidates.delete(userId);
      bufferedCandidates.delete(targetUserId);

      if (pendingCalls.has(targetUserId)) {
        clearTimeout(pendingCalls.get(targetUserId)!.timeoutId);
        pendingCalls.delete(targetUserId);
      }
      if (pendingCalls.has(userId)) {
        clearTimeout(pendingCalls.get(userId)!.timeoutId);
        pendingCalls.delete(userId);
      }

      // Record call log
      recordCallLog({
        callerId: userId,
        receiverId: targetUserId,
        callType,
        status: duration > 0 ? 'completed' : 'missed',
        duration,
      });

      const targetSockets = getSocketsForUser(targetUserId);
      targetSockets.forEach((sId) => {
        io.to(sId).emit('call:ended', {
          fromUserId: userId,
          duration,
        });
      });
    });

    socket.on('call:media_state_change', (data: {
      targetUserId: string;
      trackType: 'audio' | 'video';
      enabled: boolean;
    }) => {
      const targetSockets = getSocketsForUser(data.targetUserId);
      targetSockets.forEach((sId) => {
        io.to(sId).emit('call:peer_media_state_change', {
          fromUserId: userId,
          trackType: data.trackType,
          enabled: data.enabled,
        });
      });
    });

    socket.on('call:screen_share_toggle', (data: {
      targetUserId: string;
      isSharing: boolean;
    }) => {
      const targetSockets = getSocketsForUser(data.targetUserId);
      targetSockets.forEach((sId) => {
        io.to(sId).emit('call:peer_screen_share_toggle', {
          fromUserId: userId,
          isSharing: data.isSharing,
        });
      });
    });

    // ----------------------------------------------------
    // DISCONNECT
    // ----------------------------------------------------
    socket.on('disconnect', () => {
      const userSocketsSet = userSockets.get(userId);
      if (userSocketsSet) {
        userSocketsSet.delete(socket.id);
        if (userSocketsSet.size === 0) {
          userSockets.delete(userId);
        }
      }
      socketUsers.delete(socket.id);

      // Clean up any active call initiated by or involving this user
      for (const [key, call] of activeCalls.entries()) {
        if (call.callerId === userId || call.receiverId === userId) {
          const peerId = call.callerId === userId ? call.receiverId : call.callerId;
          const peerSockets = getSocketsForUser(peerId);
          peerSockets.forEach((sId) => {
            io.to(sId).emit('call:ended', { fromUserId: userId, duration: 0 });
          });
          activeCalls.delete(key);
        }
      }

      // If user has no active sockets remaining, record last_seen in database & broadcast
      if (!userSockets.has(userId)) {
        const now = new Date().toISOString();
        try {
          db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, userId);
          io.emit('presence:last_seen', { userId, lastSeen: now });
        } catch (e) {}
      }

      broadcastOnlineList();
    });
  });
}

