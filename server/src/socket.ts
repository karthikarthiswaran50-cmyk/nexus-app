import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware/auth.js';
import { AuthPayload, CallType, UserWithPlan } from './types.js';
import { saveMessage } from './controllers/chat.js';
import { recordCallLog } from './controllers/calls.js';
import { getUserWithPlan } from './controllers/auth.js';
import { db } from './db.js';

interface SocketUser {
  userId: string;
  socketId: string;
  user: UserWithPlan | null;
}

export function setupSocket(io: Server) {
  // Map: userId -> Set of socket IDs
  const userSockets = new Map<string, Set<string>>();
  // Map: socketId -> userId
  const socketUsers = new Map<string, string>();
  // Map: active call pairs (to track in-progress calls)
  const activeCalls = new Map<string, { callerId: string; receiverId: string; callType: CallType; startedAt: number }>();

  function getSocketsForUser(userId: string): string[] {
    return Array.from(userSockets.get(userId) || []);
  }

  function broadcastOnlineList() {
    const onlineUserIds = Array.from(userSockets.keys());
    io.emit('presence:online_list', onlineUserIds);
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

    // Broadcast updated online list
    broadcastOnlineList();

    // ----------------------------------------------------
    // 1. PRESENCE
    // ----------------------------------------------------
    socket.on('presence:get_online', () => {
      socket.emit('presence:online_list', Array.from(userSockets.keys()));
    });

    // ----------------------------------------------------
    // 2. REAL-TIME CHAT
    // ----------------------------------------------------
    socket.on('chat:send_message', (data: {
      receiverId: string;
      content: string;
      type?: 'text' | 'image' | 'audio' | 'system' | 'call_log';
      mediaUrl?: string;
    }) => {
      try {
        const { receiverId, content, type = 'text', mediaUrl } = data;
        if (!receiverId || (!content && !mediaUrl)) return;

        const result = saveMessage({
          senderId: userId,
          receiverId,
          content: content || '',
          type,
          mediaUrl,
        });

        // Emit to all sockets of receiver
        const receiverSocketIds = getSocketsForUser(receiverId);
        receiverSocketIds.forEach((sId) => {
          io.to(sId).emit('chat:new_message', result);
        });

        // Emit back to sender
        socket.emit('chat:message_sent', result);
      } catch (err) {
        console.error('Socket chat:send_message error:', err);
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
    socket.on('call:initiate', (data: {
      receiverId: string;
      callType: CallType;
      sdpOffer: any;
    }) => {
      const { receiverId, callType, sdpOffer } = data;
      const caller = getUserWithPlan(userId);
      const receiver = getUserWithPlan(receiverId);

      if (!caller || !receiver) {
        socket.emit('call:error', { message: 'User not found.' });
        return;
      }

      // Check if receiver is online
      const receiverSockets = getSocketsForUser(receiverId);
      if (receiverSockets.length === 0) {
        // Log missed call
        recordCallLog({
          callerId: userId,
          receiverId,
          callType,
          status: 'missed',
          duration: 0,
        });

        socket.emit('call:user_offline', {
          receiverId,
          message: `${receiver.full_name} is currently offline.`,
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

      // Track call start
      activeCalls.set(`${userId}-${receiverId}`, {
        callerId: userId,
        receiverId,
        callType,
        startedAt: Date.now(),
      });

      // Forward incoming call signal to receiver
      receiverSockets.forEach((sId) => {
        io.to(sId).emit('call:incoming', {
          caller,
          callType,
          sdpOffer,
        });
      });
    });

    socket.on('call:accept', (data: {
      callerId: string;
      sdpAnswer: any;
    }) => {
      const { callerId, sdpAnswer } = data;
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
      
      // Cleanup active call map
      activeCalls.delete(`${userId}-${targetUserId}`);
      activeCalls.delete(`${targetUserId}-${userId}`);

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

      // Check if this user was in any active calls
      for (const [key, call] of activeCalls.entries()) {
        if (call.callerId === userId || call.receiverId === userId) {
          const peerId = call.callerId === userId ? call.receiverId : call.callerId;
          const peerSockets = getSocketsForUser(peerId);
          peerSockets.forEach((sId) => {
            io.to(sId).emit('call:ended', {
              fromUserId: userId,
              duration: Math.round((Date.now() - call.startedAt) / 1000),
            });
          });
          activeCalls.delete(key);
        }
      }

      broadcastOnlineList();
    });
  });
}
