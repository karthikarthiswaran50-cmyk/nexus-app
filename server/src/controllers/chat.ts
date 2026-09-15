import { Request, Response } from 'express';
import { db, persistMessageToPg, persistGroupToPg, persistGroupMemberToPg, recordActivity } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';
import { Conversation, Message, Group, GroupMember } from '../types.js';
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
    const limitParam = Math.min(parseInt(req.query.limit as string || '100', 10), 200);
    const beforeId = req.query.before as string | undefined; // message ID cursor for pagination

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

    let rawMessages: any[];
    if (beforeId) {
      // Cursor-based pagination: get messages older than the given message ID
      const cursor = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(beforeId) as any;
      if (!cursor) {
        res.json({ messages: [], conversationId: conv.id });
        return;
      }
      rawMessages = (db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ? AND created_at < ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(conv.id, cursor.created_at, limitParam) as unknown) as any[];
      rawMessages.reverse(); // restore chronological order
    } else {
      rawMessages = (db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
        LIMIT ?
      `).all(conv.id, limitParam) as unknown) as any[];
    }

    // Parse reactions, deleted_for_users, and filter deleted for current user
    const messages: Message[] = rawMessages
      .filter((m) => {
        let deletedUsers: string[] = [];
        try {
          deletedUsers = m.deleted_for_users ? JSON.parse(m.deleted_for_users) : [];
        } catch (e) {}
        return !deletedUsers.includes(userId!);
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
          file_name: isDeletedForAll ? undefined : m.file_name,
          file_size: isDeletedForAll ? undefined : m.file_size,
          is_read: !!m.is_read,
          reactions,
          reply_to_id: m.reply_to_id,
          reply_to_content: m.reply_to_content,
          reply_to_sender: m.reply_to_sender,
          edited_at: m.edited_at,
          is_deleted_for_all: isDeletedForAll,
          created_at: m.created_at,
          sender: getUserWithPlan(m.sender_id) || undefined,
        };
      });

    res.json({ messages, conversationId: conv.id, hasMore: rawMessages.length === limitParam });
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
}

export function saveMessage(params: {
  senderId: string;
  receiverId: string;
  content: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'file' | 'system' | 'call_log';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
}): { message: Message; conversationId: string } {
  const { senderId, receiverId, content, type = 'text', mediaUrl, fileName, fileSize, replyToId, replyToContent, replyToSender } = params;

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
    INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, type, media_url, file_name, file_size, is_read, reactions, reply_to_id, reply_to_content, reply_to_sender, is_deleted_for_all, deleted_for_users, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '{}', ?, ?, ?, 0, '[]', ?)
  `).run(
    msgId,
    conv.id,
    senderId,
    receiverId,
    cleanContent,
    type,
    mediaUrl || null,
    fileName || null,
    fileSize || null,
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

  // Record user activity log
  recordActivity(senderId, 'chat_sent', {
    receiver_id: receiverId,
    content: cleanContent ? cleanContent.slice(0, 150) : '',
    type,
    media_url: mediaUrl || undefined,
  });

  const message: Message = {
    id: msgId,
    conversation_id: conv.id,
    sender_id: senderId,
    receiver_id: receiverId,
    content: cleanContent,
    type,
    media_url: mediaUrl,
    file_name: fileName,
    file_size: fileSize,
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

// ----------------------------------------------------
// Message Editing & Forwarding
// ----------------------------------------------------
export function editMessage(messageId: string, userId: string, newContent: string): { message: Message; conversationId?: string; groupId?: string } | null {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any;
  if (!msg || msg.sender_id !== userId || msg.is_deleted_for_all) return null;

  const now = new Date().toISOString();
  const cleanContent = sanitizeText(newContent);

  db.prepare(`
    UPDATE messages
    SET content = ?, edited_at = ?
    WHERE id = ?
  `).run(cleanContent, now, messageId);

  persistMessageToPg({
    id: msg.id,
    conversation_id: msg.conversation_id,
    group_id: msg.group_id,
    sender_id: msg.sender_id,
    receiver_id: msg.receiver_id,
    content: cleanContent,
    type: msg.type,
    edited_at: now,
  });

  const updated: Message = {
    ...msg,
    content: cleanContent,
    edited_at: now,
    sender: getUserWithPlan(userId) || undefined,
  };

  return { message: updated, conversationId: msg.conversation_id, groupId: msg.group_id };
}

export async function editMessageHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { content } = req.body;

    if (!userId || !id || !content?.trim()) {
      res.status(400).json({ error: 'Missing message ID or content.' });
      return;
    }

    const result = editMessage(id, userId, content);
    if (!result) {
      res.status(403).json({ error: 'Cannot edit this message or unauthorized.' });
      return;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to edit message.' });
  }
}

export async function forwardMessageHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const senderId = req.user?.userId;
    const { messageId, targetUserIds = [], targetGroupIds = [] } = req.body;

    if (!senderId || !messageId || (targetUserIds.length === 0 && targetGroupIds.length === 0)) {
      res.status(400).json({ error: 'Missing target recipients or message ID.' });
      return;
    }

    const sourceMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any;
    if (!sourceMsg || sourceMsg.is_deleted_for_all) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    const forwardedMessages: Message[] = [];

    // Forward to individual users
    for (const targetId of targetUserIds) {
      const res = saveMessage({
        senderId,
        receiverId: targetId,
        content: sourceMsg.content,
        type: sourceMsg.type,
        mediaUrl: sourceMsg.media_url,
        fileName: sourceMsg.file_name,
        fileSize: sourceMsg.file_size,
      });
      forwardedMessages.push(res.message);
    }

    // Forward to groups
    for (const groupId of targetGroupIds) {
      const res = saveGroupMessage({
        senderId,
        groupId,
        content: sourceMsg.content,
        type: sourceMsg.type,
        mediaUrl: sourceMsg.media_url,
        fileName: sourceMsg.file_name,
        fileSize: sourceMsg.file_size,
      });
      if (res) forwardedMessages.push(res.message);
    }

    res.json({ success: true, forwardedCount: forwardedMessages.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to forward message.' });
  }
}

// ----------------------------------------------------
// Global & In-Chat Search
// ----------------------------------------------------
export async function searchChatHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const query = String(req.query.q || '').trim().toLowerCase();

    if (!userId || !query) {
      res.json({ users: [], messages: [], groups: [] });
      return;
    }

    // Search users
    const matchedUsers = (db.prepare(`
      SELECT id, username, full_name, avatar_url, bio, status, country, last_seen
      FROM users
      WHERE id != ? AND is_banned = 0 AND (LOWER(username) LIKE ? OR LOWER(full_name) LIKE ?)
      LIMIT 10
    `).all(userId, `%${query}%`, `%${query}%`) as any[]).map(u => ({
      ...u,
      plan_id: 'free',
      subscription_status: 'active',
    }));

    // Search messages in user's conversations
    const matchedMessages = (db.prepare(`
      SELECT m.*
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.user1_id = ? OR c.user2_id = ?)
        AND m.is_deleted_for_all = 0
        AND LOWER(m.content) LIKE ?
      ORDER BY m.created_at DESC
      LIMIT 20
    `).all(userId, userId, `%${query}%`) as any[]).map(m => ({
      ...m,
      sender: getUserWithPlan(m.sender_id),
    }));

    // Search user's groups
    const matchedGroups = db.prepare(`
      SELECT g.*
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ? AND (LOWER(g.name) LIKE ? OR LOWER(g.description) LIKE ?)
      LIMIT 10
    `).all(userId, `%${query}%`, `%${query}%`);

    res.json({
      users: matchedUsers,
      messages: matchedMessages,
      groups: matchedGroups,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Search failed.' });
  }
}

// ----------------------------------------------------
// Group Messaging Implementation
// ----------------------------------------------------
export async function getGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const groups = (db.prepare(`
      SELECT g.*, 
             (SELECT count(*) FROM group_members WHERE group_id = g.id) as members_count,
             gm.role as my_role
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
    `).all(userId) as any[]).map(g => {
      const lastMsg = db.prepare(`
        SELECT * FROM messages
        WHERE group_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(g.id) as Message | undefined;

      return {
        ...g,
        last_message: lastMsg ? { ...lastMsg, sender: getUserWithPlan(lastMsg.sender_id) } : undefined,
      };
    });

    res.json({ groups });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch groups.' });
  }
}

export async function createGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { name, description = '', avatarUrl = '', memberIds = [] } = req.body;

    if (!userId || !name?.trim()) {
      res.status(400).json({ error: 'Group name is required.' });
      return;
    }

    const groupId = 'grp_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO groups (id, name, description, avatar_url, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(groupId, sanitizeText(name.trim()), sanitizeText(description), avatarUrl, userId, now);

    persistGroupToPg({
      id: groupId,
      name: name.trim(),
      description,
      avatar_url: avatarUrl,
      created_by: userId,
    });

    // Add creator as admin
    const adminMemberId = 'gm_' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'admin', ?)
    `).run(adminMemberId, groupId, userId, now);

    persistGroupMemberToPg({
      id: adminMemberId,
      group_id: groupId,
      user_id: userId,
      role: 'admin',
    });

    // Add selected initial members
    const validMemberIds = Array.isArray(memberIds) ? memberIds.filter(id => id && id !== userId) : [];
    for (const mId of validMemberIds) {
      const memId = 'gm_' + Math.random().toString(36).substring(2, 10);
      try {
        db.prepare(`
          INSERT INTO group_members (id, group_id, user_id, role, joined_at)
          VALUES (?, ?, ?, 'member', ?)
        `).run(memId, groupId, mId, now);

        persistGroupMemberToPg({
          id: memId,
          group_id: groupId,
          user_id: mId,
          role: 'member',
        });
      } catch (e) {}
    }

    recordActivity(userId, 'create_group', { groupId, groupName: name });

    const newGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any;
    res.status(201).json({ group: newGroup });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create group.' });
  }
}

export async function getGroupDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId || !id) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }

    // Check membership
    const membership = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(id, userId);
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this group.' });
      return;
    }

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as any;
    if (!group) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }

    const members = (db.prepare(`
      SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.joined_at,
             u.username, u.full_name, u.avatar_url, u.status, u.last_seen
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.role DESC, gm.joined_at ASC
    `).all(id) as any[]).map(m => ({
      id: m.id,
      group_id: m.group_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      user: {
        id: m.user_id,
        username: m.username,
        full_name: m.full_name,
        avatar_url: m.avatar_url,
        status: m.status,
        last_seen: m.last_seen,
        plan_id: 'free',
      },
    }));

    res.json({
      group: {
        ...group,
        members_count: members.length,
        members,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch group details.' });
  }
}

export async function addGroupMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { userIds = [] } = req.body;

    if (!userId || !id || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: 'Missing group ID or user IDs.' });
      return;
    }

    // Check if requester is admin or member
    const membership = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(id, userId) as any;
    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this group.' });
      return;
    }

    const now = new Date().toISOString();
    let addedCount = 0;

    for (const uId of userIds) {
      try {
        const memId = 'gm_' + Math.random().toString(36).substring(2, 10);
        db.prepare(`
          INSERT INTO group_members (id, group_id, user_id, role, joined_at)
          VALUES (?, ?, ?, 'member', ?)
        `).run(memId, id, uId, now);

        persistGroupMemberToPg({
          id: memId,
          group_id: id,
          user_id: uId,
          role: 'member',
        });
        addedCount++;
      } catch (e) {}
    }

    res.json({ success: true, addedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to add members.' });
  }
}

export async function removeGroupMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requesterId = req.user?.userId;
    const { id, memberUserId } = req.params;

    if (!requesterId || !id || !memberUserId) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }

    // Self-leaving is always allowed. If removing someone else, must be admin.
    if (requesterId !== memberUserId) {
      const adminCheck = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(id, requesterId) as any;
      if (!adminCheck || adminCheck.role !== 'admin') {
        res.status(403).json({ error: 'Only group admins can remove other members.' });
        return;
      }
    }

    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(id, memberUserId);
    res.json({ success: true, message: 'Member removed from group' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove member.' });
  }
}

export async function getGroupMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const limitParam = Math.min(parseInt(req.query.limit as string || '100', 10), 250);
    const beforeId = req.query.before as string | undefined;

    if (!userId || !id) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }

    // Check membership
    const mem = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(id, userId);
    if (!mem) {
      res.status(403).json({ error: 'Must be a member to view group messages.' });
      return;
    }

    let rawMessages: any[];
    if (beforeId) {
      const cursor = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(beforeId) as any;
      if (!cursor) {
        res.json({ messages: [], hasMore: false });
        return;
      }
      rawMessages = (db.prepare(`
        SELECT * FROM messages
        WHERE group_id = ? AND created_at < ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(id, cursor.created_at, limitParam) as any[]);
      rawMessages.reverse();
    } else {
      rawMessages = (db.prepare(`
        SELECT * FROM messages
        WHERE group_id = ?
        ORDER BY created_at ASC
        LIMIT ?
      `).all(id, limitParam) as any[]);
    }

    const raw = rawMessages.map(m => {
      let reactions = {};
      try { reactions = m.reactions ? JSON.parse(m.reactions) : {}; } catch (e) {}
      const isDeletedForAll = !!m.is_deleted_for_all;

      return {
        id: m.id,
        group_id: m.group_id,
        sender_id: m.sender_id,
        content: isDeletedForAll ? '🚫 This message was deleted' : m.content,
        type: isDeletedForAll ? 'system' : m.type,
        media_url: isDeletedForAll ? undefined : m.media_url,
        file_name: isDeletedForAll ? undefined : m.file_name,
        file_size: isDeletedForAll ? undefined : m.file_size,
        is_read: true,
        reactions,
        reply_to_id: m.reply_to_id,
        reply_to_content: m.reply_to_content,
        reply_to_sender: m.reply_to_sender,
        edited_at: m.edited_at,
        is_deleted_for_all: isDeletedForAll,
        created_at: m.created_at,
        sender: getUserWithPlan(m.sender_id),
      };
    });

    res.json({ messages: raw, hasMore: rawMessages.length === limitParam });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch group messages.' });
  }
}

export function saveGroupMessage(params: {
  senderId: string;
  groupId: string;
  content: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'file' | 'system' | 'call_log';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyToId?: string;
  replyToContent?: string;
  replyToSender?: string;
}): { message: Message } | null {
  const { senderId, groupId, content, type = 'text', mediaUrl, fileName, fileSize, replyToId, replyToContent, replyToSender } = params;

  // Check sender is member
  const mem = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, senderId);
  if (!mem) return null;

  const now = new Date().toISOString();
  const msgId = 'gmsg_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const cleanContent = type === 'text' ? sanitizeText(content) : content;

  db.prepare(`
    INSERT INTO messages (id, group_id, sender_id, receiver_id, content, type, media_url, file_name, file_size, is_read, reactions, reply_to_id, reply_to_content, reply_to_sender, is_deleted_for_all, deleted_for_users, created_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, 1, '{}', ?, ?, ?, 0, '[]', ?)
  `).run(
    msgId,
    groupId,
    senderId,
    cleanContent,
    type,
    mediaUrl || null,
    fileName || null,
    fileSize || null,
    replyToId || null,
    replyToContent || null,
    replyToSender || null,
    now
  );

  persistMessageToPg({
    id: msgId,
    group_id: groupId,
    sender_id: senderId,
    content: cleanContent,
    type,
    media_url: mediaUrl,
    file_name: fileName,
    file_size: fileSize,
    is_read: 1,
  });

  return {
    message: {
      id: msgId,
      group_id: groupId,
      sender_id: senderId,
      content: cleanContent,
      type,
      media_url: mediaUrl,
      file_name: fileName,
      file_size: fileSize,
      is_read: true,
      reactions: {},
      reply_to_id: replyToId,
      reply_to_content: replyToContent,
      reply_to_sender: replyToSender,
      created_at: now,
      sender: getUserWithPlan(senderId) || undefined,
    },
  };
}
