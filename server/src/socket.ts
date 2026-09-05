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

export function setupSocket(io: Server) {
  // Map: userId -> Set of socket IDs
  const userSockets = new Map<string, Set<string>>();
  // Map: socketId -> userId
  const socketUsers = new Map<string, string>();
  // Map: active call pairs (to track in-progress calls)
  const activeCalls = new Map<string, { callerId: string; receiverId: string; callType: CallType; startedAt: number }>();
  // Map: pending call invitations for offline/sleeping devices (receiverId -> PendingCall)
  const pendingCalls = new Map<string, PendingCall>();

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
        if (!receiverId || (!content && !mediaUrl)) return;

        const result = saveMessage({
          senderId: userId,
          receiverId,
          content: content || '',
          type,
          mediaUrl,
          replyToId,
          replyToContent,
          replyToSender,
        });

        // Emit to all active sockets of receiver
        const receiverSocketIds = getSocketsForUser(receiverId);
        receiverSocketIds.forEach((sId) => {
          io.to(sId).emit('chat:new_message', result);
        });

        // Emit back to sender
        socket.emit('chat:message_sent', result);

        // If recipient is Nexus AI Assistant, generate an instant response
        if (receiverId === 'user_nexus_ai') {
          setTimeout(async () => {
            try {
              const aiReplyText = generateAiAssistantReply(content || '');
              const aiResult = saveMessage({
                senderId: 'user_nexus_ai',
                receiverId: userId,
                content: aiReplyText,
                type: 'text',
              });
              socket.emit('chat:new_message', aiResult);
            } catch (aiErr) {
              console.error('Nexus AI response error:', aiErr);
            }
          }, 800);
        }

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
        db.prepare(`
          UPDATE messages
          SET is_read = 1
          WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
        `).run(userId, data.senderId);

        const senderSocketIds = getSocketsForUser(data.senderId);
        senderSocketIds.forEach((sId) => {
          io.to(sId).emit('chat:messages_read', { readBy: userId });
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

      // Enforce paywall: Video calls require paid subscription (Pro ₹99 or VIP ₹199)
      if (callType === 'video' && caller.plan_id === 'free') {
        socket.emit('call:error', {
          message: '🌟 HD Video Calling requires an active Nexus Pro (₹99/month) or Ultra VIP (₹199/month) subscription. Please upgrade to make video calls.',
          requiresUpgrade: true,
        });
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
    });

    socket.on('call:reject', (data: {
      callerId: string;
      reason?: string;
    }) => {
      const { callerId, reason = 'declined' } = data;
      activeCalls.delete(`${callerId}-${userId}`);

      if (pendingCalls.has(userId)) {
        clearTimeout(pendingCalls.get(userId)!.timeoutId);
        pendingCalls.delete(userId);
      }

      recordCallLog({
        callerId,
        receiverId: userId,
        callType: 'video',
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
      
      // Cleanup active call map & pending calls
      activeCalls.delete(`${userId}-${targetUserId}`);
      activeCalls.delete(`${targetUserId}-${userId}`);

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

function generateAiAssistantReply(userMsg: string): string {
  const query = userMsg.toLowerCase().trim();
  
  if (query.includes('hi') || query.includes('hello') || query.includes('வணக்கம்') || query.includes('hey')) {
    return "Hello! 👋 Welcome to Nexus Royal. I'm your Nexus AI Assistant. How can I help you today? You can ask me anything about features, coding, language translations, or writing messages!";
  }
  
  if (query.includes('who are you') || query.includes('யாரு')) {
    return "I am Nexus AI Assistant 🤖, the official built-in intelligent companion for Nexus Royal. I can help you craft replies, explain app features, and answer your daily questions!";
  }

  if (query.includes('features') || query.includes('upgrade') || query.includes('வசதிகள்')) {
    return "Nexus Royal offers cutting-edge capabilities:\n✨ Ultra-clear HD Audio & Video Calls\n🎙️ High-Fidelity Voice Messages\n📸 24-Hour Disappearing Stories\n🔒 End-to-End Chat Reactions & Quoted Replies\n📱 Native App Installation (PWA)";
  }

  if (query.includes('call') || query.includes('வீடியோ')) {
    return "To start a call on Nexus Royal, simply click on any contact from the Directory or open their Chat and click the Phone 📞 or Video 📹 button on the top right!";
  }

  if (query.includes('story') || query.includes('status')) {
    return "You can share Stories on Nexus Royal! Tap the '+' button on the Stories bar above your chats to upload photos or write stylish gradient status cards that stay active for 24 hours.";
  }

  if (query.includes('nexus') || query.includes('royal')) {
    return "Nexus Royal is our premium next-generation social and communication platform, engineered for speed, privacy, and seamless connections!";
  }

  // General helpful responses
  const generalReplies = [
    `I understand you're saying: "${userMsg}". How can I best assist you with that on Nexus Royal?`,
    `Got it! As your Nexus AI, I'm here to make your experience royal. Would you like tips, suggestions, or help with sending messages and stories?`,
    `Thank you for reaching out! Nexus AI is always active to help you stay connected with friends and family smoothly. ✨`
  ];
  return generalReplies[Math.floor(Math.random() * generalReplies.length)];
}

