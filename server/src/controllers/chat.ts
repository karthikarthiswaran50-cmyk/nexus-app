import { Request, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';
import { Conversation, Message } from '../types.js';

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

    const messages = (db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT 200
    `).all(conv.id) as unknown) as Message[];

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
}): { message: Message; conversationId: string } {
  const { senderId, receiverId, content, type = 'text', mediaUrl } = params;

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
  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, type, media_url, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(msgId, conv.id, senderId, receiverId, content, type, mediaUrl || null, now);

  const message: Message = {
    id: msgId,
    conversation_id: conv.id,
    sender_id: senderId,
    receiver_id: receiverId,
    content,
    type,
    media_url: mediaUrl,
    is_read: false,
    created_at: now,
  };

  return { message, conversationId: conv.id };
}

export async function sendMessageHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const senderId = req.user?.userId;
    const { receiverId, content, type = 'text', mediaUrl } = req.body;

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
