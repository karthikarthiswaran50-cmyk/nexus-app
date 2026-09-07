import { Request, Response } from 'express';
import { db, persistMessageToPg } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';
import { Conversation, Message } from '../types.js';
import { sanitizeText } from '../utils/sanitize.js';

export async function getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rows = (db.prepare(`
      SELECT c.*,
             CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END as other_user_id
      FROM conversations c
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.last_message_at DESC
    `).all(userId, userId, userId) as unknown) as any[];

    const conversations: Conversation[] = rows.map((row) => {
      const otherUser = getUserWithPlan(row.other_user_id);
      
      const lastMsg = db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(row.id) as unknown as Message | undefined;

      const unread = db.prepare(`
        SELECT count(*) as count FROM messages
        WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0
      `).get(row.id, userId) as unknown as { count: number } | undefined;

      return {
        id: row.id,
        user1_id: row.user1_id,
        user2_id: row.user2_id,
        last_message_at: row.last_message_at,
        created_at: row.created_at,
        other_user: otherUser || undefined,
        last_message: lastMsg,
        unread_count: unread ? unread.count : 0,
      };
    });

    res.json({ conversations });
  } catch (error) {
    console.error('getConversations error:', error);
    res.status(500).json({ error: 'Failed to retrieve conversations.' });
  }
}

export async function getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { otherUserId } = req.params;

    if (!userId || !otherUserId) {
      res.status(400).json({ error: 'Missing parameters.' });
      return;
    }

    // Find conversation
    const conv = db.prepare(`
      SELECT id FROM conversations
      WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    `).get(userId, otherUserId, otherUserId, userId) as unknown as { id: string } | undefined;

    if (!conv) {
      res.json({ messages: [], conversationId: null });
      return;
    }

    // Mark unread messages as read
    db.prepare(`
      UPDATE messages
      SET is_read = 1
      WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0
    `).run(conv.id, userId);

    const rawMessages = (db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT 200
    `).all(conv.id) as unknown) as any[];

    // Parse reactions, deleted_for_users, and filter deleted for current user
    const messages: Message[] = rawMessages
      .filter((m) => {
        let deletedUsers: string[] = [];
        try {
          deletedUsers = m.deleted_for_users ? JSON.parse(m.deleted_for_users) : [];
        } catch (e) {}
        return !deletedUsers.includes(userId);
      })
      .map((m) => {
        let reactions = {};
        try {
          reactions = m.reactions ? JSON.parse(m.reactions) : {};
        } catch (e) {}

        const isDeletedForAll = !!m.is_deleted_for_all;

        return {
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          receiver_id: m.receiver_id,
          content: isDeletedForAll ? '🚫 This message was deleted' : m.content,
          type: isDeletedForAll ? 'system' : m.type,
          media_url: isDeletedForAll ? undefined : m.media_url,
          is_read: !!m.is_read,
          reactions,
          reply_to_id: m.reply_to_id,
          reply_to_content: m.reply_to_content,
          reply_to_sender: m.reply_to_sender,
          is_deleted_for_all: isDeletedForAll,
          created_at: m.created_at,
          sender: getUserWithPlan(m.sender_id) || undefined,
        };
      });

    res.json({ messages, conversationId: conv.id });
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
}

export function saveMessage(params: {
  senderId: string;
  receiverId: string;
  content: string;
  type?: 'text' | 'image' | 'audio' | 'system' | 'call_log';
  mediaUrl?: string;
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
}): { message: Message; conversationId: string } {
  const { senderId, receiverId, content, type = 'text', mediaUrl, replyToId, replyToContent, replyToSender } = params;

  // Find or create conversation
  let conv = db.prepare(`
    SELECT id FROM conversations
    WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
  `).get(senderId, receiverId, receiverId, senderId) as unknown as { id: string } | undefined;

  const now = new Date().toISOString();

  if (!conv) {
    const newConvId = 'conv_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    db.prepare(`
      INSERT INTO conversations (id, user1_id, user2_id, last_message_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(newConvId, senderId, receiverId, now, now);
    conv = { id: newConvId };
  } else {
    db.prepare(`
      UPDATE conversations
      SET last_message_at = ?
      WHERE id = ?
    `).run(now, conv.id);
  }

  const msgId = 'msg_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const cleanContent = type === 'text' ? sanitizeText(content) : content;

  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, type, media_url, is_read, reactions, reply_to_id, reply_to_content, reply_to_sender, is_deleted_for_all, deleted_for_users, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, '{}', ?, ?, ?, 0, '[]', ?)
  `).run(
    msgId,
    conv.id,
    senderId,
    receiverId,
    cleanContent,
    type,
    mediaUrl || null,
    replyToId || null,
    replyToContent || null,
    replyToSender || null,
    now
  );

  // Asynchronously persist to PostgreSQL
  persistMessageToPg({
    id: msgId,
    conversation_id: conv.id,
    sender_id: senderId,
    receiver_id: receiverId,
    content: cleanContent,
    type,
    media_url: mediaUrl || undefined,
    is_read: 0,
  });

  const message: Message = {
    id: msgId,
    conversation_id: conv.id,
    sender_id: senderId,
    receiver_id: receiverId,
    content: cleanContent,
    type,
    media_url: mediaUrl,
    is_read: false,
    reactions: {},
    reply_to_id: replyToId,
    reply_to_content: replyToContent,
    reply_to_sender: replyToSender,
    is_deleted_for_all: false,
    created_at: now,
    sender: getUserWithPlan(senderId) || undefined,
  };

  return { message, conversationId: conv.id };
}

export function toggleReaction(messageId: string, userId: string, emoji: string): { messageId: string; reactions: Record<string, string[]>; conversationId: string } | null {
  const msg = db.prepare('SELECT id, conversation_id, reactions FROM messages WHERE id = ?').get(messageId) as any;
  if (!msg) return null;

  let reactions: Record<string, string[]> = {};
  try {
    reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
  } catch (e) {
    reactions = {};
  }

  // If user already reacted with this emoji, toggle it off
  if (reactions[emoji] && reactions[emoji].includes(userId)) {
    reactions[emoji] = reactions[emoji].filter((uid: string) => uid !== userId);
    if (reactions[emoji].length === 0) {
      delete reactions[emoji];
    }
  } else {
    // Remove previous reaction by this user if any (optional, single-reaction per user like WhatsApp)
    Object.keys(reactions).forEach((em) => {
      reactions[em] = reactions[em].filter((uid: string) => uid !== userId);
      if (reactions[em].length === 0) {
        delete reactions[em];
      }
    });

    if (!reactions[emoji]) reactions[emoji] = [];
    reactions[emoji].push(userId);
  }

  const updatedJson = JSON.stringify(reactions);
  db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(updatedJson, messageId);

  return { messageId, reactions, conversationId: msg.conversation_id };
}

export function deleteMessage(messageId: string, userId: string, deleteType: 'for_everyone' | 'for_me'): { messageId: string; isDeletedForAll: boolean; deletedForUsers: string[]; conversationId: string } | null {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any;
  if (!msg) return null;

  if (deleteType === 'for_everyone') {
    // Only sender can delete for everyone
    if (msg.sender_id !== userId) return null;

    db.prepare(`
      UPDATE messages
      SET is_deleted_for_all = 1,
          content = '🚫 This message was deleted',
          media_url = NULL
      WHERE id = ?
    `).run(messageId);

    return {
      messageId,
      isDeletedForAll: true,
      deletedForUsers: [],
      conversationId: msg.conversation_id,
    };
  } else {
    // Delete for me
    let deletedUsers: string[] = [];
    try {
      deletedUsers = msg.deleted_for_users ? JSON.parse(msg.deleted_for_users) : [];
    } catch (e) {
      deletedUsers = [];
    }

    if (!deletedUsers.includes(userId)) {
      deletedUsers.push(userId);
      db.prepare('UPDATE messages SET deleted_for_users = ? WHERE id = ?').run(JSON.stringify(deletedUsers), messageId);
    }

    return {
      messageId,
      isDeletedForAll: false,
      deletedForUsers: deletedUsers,
      conversationId: msg.conversation_id,
    };
  }
}

export async function sendMessageHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const senderId = req.user?.userId;
    const { receiverId, content, type = 'text', mediaUrl, replyToId, replyToContent, replyToSender } = req.body;

    if (!senderId || !receiverId || (!content && !mediaUrl)) {
      res.status(400).json({ error: 'Missing required message content or receiver.' });
      return;
    }

    const result = saveMessage({
      senderId,
      receiverId,
      content: content || '',
      type,
      mediaUrl,
      replyToId,
      replyToContent,
      replyToSender,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('sendMessageHttp error:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
}

export async function markRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { senderId } = req.body;

    if (!userId || !senderId) {
      res.status(400).json({ error: 'Missing sender ID.' });
      return;
    }

    db.prepare(`
      UPDATE messages
      SET is_read = 1
      WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
    `).run(userId, senderId);

    res.json({ success: true });
  } catch (error) {
    console.error('markRead error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read.' });
  }
}
