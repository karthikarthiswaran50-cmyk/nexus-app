import { Response } from 'express';
import { db, pgPool, persistUserToPg } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getOnlineUsersCount, disconnectUserSockets, broadcastAnnouncementSocket } from '../socket.js';
import { getUserWithPlan } from './auth.js';

const OWNER_MASTER_KEY = process.env.OWNER_MASTER_KEY || 'nexusroyal2026';

// ----------------------------------------------------
// 1. Overall System Analytics & Stats
// ----------------------------------------------------
export async function getAdminStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const bannedRow = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 1').get() as { count: number };
    const adminRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
    const messageRow = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
    const callRow = db.prepare('SELECT COUNT(*) as count FROM call_logs').get() as { count: number };
    const storyRow = db.prepare('SELECT COUNT(*) as count FROM stories').get() as { count: number };

    res.json({
      totalUsers: userCountRow?.count || 0,
      bannedUsers: bannedRow?.count || 0,
      adminCount: adminRow?.count || 0,
      totalMessages: messageRow?.count || 0,
      totalCalls: callRow?.count || 0,
      totalStories: storyRow?.count || 0,
      onlineUsers: getOnlineUsersCount(),
      serverUptimeSeconds: Math.floor(process.uptime()),
      dbType: pgPool ? 'PostgreSQL (Cloud / Supabase)' : 'SQLite (Local High-Performance)',
    });
  } catch (error) {
    console.error('getAdminStats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
}

// ----------------------------------------------------
// 2. Full Users Directory for Management
// ----------------------------------------------------
export async function getAdminUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rows = db.prepare(`
      SELECT id, email, username, full_name, avatar_url, bio, status, country,
             COALESCE(role, 'user') as role,
             COALESCE(is_banned, 0) as is_banned,
             created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    res.json({ users: rows });
  } catch (error) {
    console.error('getAdminUsers error:', error);
    res.status(500).json({ error: 'Failed to fetch users list' });
  }
}

// ----------------------------------------------------
// 3. Toggle User Ban
// ----------------------------------------------------
export async function toggleUserBan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const currentAdminId = req.user?.userId;

    if (id === currentAdminId) {
      res.status(400).json({ error: 'You cannot ban your own owner/admin account.' });
      return;
    }

    const user = db.prepare('SELECT id, username, email, full_name, role, is_banned FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const newBannedState = user.is_banned ? 0 : 1;
    db.prepare('UPDATE users SET is_banned = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newBannedState, id);

    if (pgPool) {
      try {
        await pgPool.query('UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2', [newBannedState, id]);
      } catch (e) {
        console.error('Failed to sync ban state to PostgreSQL:', e);
      }
    }

    // If banned, kick from real-time connections immediately
    if (newBannedState === 1) {
      disconnectUserSockets(id);
    }

    res.json({
      success: true,
      is_banned: newBannedState === 1,
      message: newBannedState === 1 ? `User @${user.username} has been suspended.` : `User @${user.username} has been unbanned.`,
    });
  } catch (error) {
    console.error('toggleUserBan error:', error);
    res.status(500).json({ error: 'Failed to update ban status' });
  }
}

// ----------------------------------------------------
// 4. Update User Role (Admin / User)
// ----------------------------------------------------
export async function updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const currentAdminId = req.user?.userId;

    if (!role || (role !== 'admin' && role !== 'user')) {
      res.status(400).json({ error: 'Role must be either "admin" or "user"' });
      return;
    }

    if (id === currentAdminId && role === 'user') {
      res.status(400).json({ error: 'You cannot revoke your own admin rights.' });
      return;
    }

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    db.prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role, id);

    if (pgPool) {
      try {
        await pgPool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, id]);
      } catch (e) {
        console.error('Failed to sync role to PostgreSQL:', e);
      }
    }

    res.json({
      success: true,
      role,
      message: `User @${user.username} is now ${role === 'admin' ? 'a Royal Admin' : 'a Member'}.`,
    });
  } catch (error) {
    console.error('updateUserRole error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
}

// ----------------------------------------------------
// 5. Delete User (Hard Delete & Clean Data)
// ----------------------------------------------------
export async function deleteUserAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const currentAdminId = req.user?.userId;

    if (id === currentAdminId) {
      res.status(400).json({ error: 'You cannot delete your own account from the Admin Panel.' });
      return;
    }

    disconnectUserSockets(id);

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    if (pgPool) {
      try {
        await pgPool.query('DELETE FROM users WHERE id = $1', [id]);
      } catch (e) {
        console.error('Failed to delete user in PostgreSQL:', e);
      }
    }

    res.json({ success: true, message: 'User account and associated data permanently removed.' });
  } catch (error) {
    console.error('deleteUserAdmin error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

// ----------------------------------------------------
// 6. Global Royal Broadcast
// ----------------------------------------------------
export async function broadcastAnnouncement(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { title, message, type } = req.body;
    const adminUser = getUserWithPlan(req.user?.userId || '');

    if (!title || !message) {
      res.status(400).json({ error: 'Title and message are required for broadcast.' });
      return;
    }

    const id = 'ann_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const author = adminUser?.full_name || adminUser?.username || 'Royal Admin';
    const annType = type === 'alert' ? 'alert' : 'info';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO system_announcements (id, title, message, type, author, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, String(title).trim(), String(message).trim(), annType, author, now);

    if (pgPool) {
      try {
        await pgPool.query(`
          INSERT INTO system_announcements (id, title, message, type, author, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [id, String(title).trim(), String(message).trim(), annType, author]);
      } catch (e) {
        console.error('Failed to sync announcement to PostgreSQL:', e);
      }
    }

    const payload = {
      id,
      title: String(title).trim(),
      message: String(message).trim(),
      type: annType,
      author,
      created_at: now,
    };

    broadcastAnnouncementSocket(payload);

    res.json({ success: true, announcement: payload, message: 'Royal broadcast dispatched to all users successfully!' });
  } catch (error) {
    console.error('broadcastAnnouncement error:', error);
    res.status(500).json({ error: 'Failed to broadcast announcement' });
  }
}

// ----------------------------------------------------
// 7. Get Recent System Announcements
// ----------------------------------------------------
export async function getAnnouncements(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rows = db.prepare('SELECT * FROM system_announcements ORDER BY created_at DESC LIMIT 20').all();
    res.json({ announcements: rows });
  } catch (error) {
    console.error('getAnnouncements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
}

export function getMasterPasscode(): string {
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'owner_master_key'").get() as { value: string } | undefined;
    if (row && row.value) return row.value;
  } catch (e) {}
  return process.env.OWNER_MASTER_KEY || 'nexusroyal2026';
}

export function setMasterPasscode(newKey: string): void {
  db.prepare("INSERT INTO system_settings (key, value) VALUES ('owner_master_key', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(newKey);
  if (pgPool) {
    pgPool.query(
      "INSERT INTO system_settings (key, value) VALUES ('owner_master_key', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [newKey]
    ).catch(e => console.error('Failed to sync master passcode to PostgreSQL:', e));
  }
}

// ----------------------------------------------------
// 8. Claim Owner / Admin Role (Exclusive to karthikarthiswaran50)
// ----------------------------------------------------
export async function claimOwnerRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { passcode } = req.body;
    const userId = req.user?.userId;
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const username = (req.user?.username || '').toLowerCase().trim();

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const isDesignatedOwner =
      userEmail === 'karthikarthiswaran50@gmail.com' ||
      userEmail.startsWith('karthikarthiswaran50@') ||
      username === 'karthikarthiswaran50' ||
      (process.env.OWNER_EMAIL && userEmail === process.env.OWNER_EMAIL.toLowerCase().trim());

    if (!isDesignatedOwner) {
      res.status(403).json({ error: 'Access restricted! Only karthikarthiswaran50 is authorized as Royal Owner.' });
      return;
    }

    const currentKey = getMasterPasscode();
    if (passcode && passcode.trim() !== currentKey.trim()) {
      res.status(403).json({ error: 'Invalid Owner Master Passcode. Access denied.' });
      return;
    }

    db.prepare("UPDATE users SET role = 'admin', updated_at = datetime('now') WHERE id = ?").run(userId);

    const user = getUserWithPlan(userId);
    if (user) {
      persistUserToPg({
        id: user.id,
        email: user.email,
        username: user.username,
        password_hash: '',
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        bio: user.bio,
        status: user.status,
        country: user.country,
        role: 'admin',
        is_banned: 0,
      });
    }

    res.json({
      success: true,
      role: 'admin',
      user,
      message: 'Crown verified! Welcome Royal Owner karthikarthiswaran50.',
    });
  } catch (error) {
    console.error('claimOwnerRole error:', error);
    res.status(500).json({ error: 'Failed to claim owner role' });
  }
}

// ----------------------------------------------------
// 9. Change Owner Master Passcode (Exclusive to karthikarthiswaran50)
// ----------------------------------------------------
export async function changeOwnerPasscode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { newPasscode } = req.body;
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const username = (req.user?.username || '').toLowerCase().trim();

    const isDesignatedOwner =
      userEmail === 'karthikarthiswaran50@gmail.com' ||
      userEmail.startsWith('karthikarthiswaran50@') ||
      username === 'karthikarthiswaran50' ||
      (process.env.OWNER_EMAIL && userEmail === process.env.OWNER_EMAIL.toLowerCase().trim());

    if (!isDesignatedOwner) {
      res.status(403).json({ error: 'Access restricted! Only karthikarthiswaran50 can change the Master Passcode.' });
      return;
    }

    if (!newPasscode || String(newPasscode).trim().length < 4) {
      res.status(400).json({ error: 'New passcode must be at least 4 characters long.' });
      return;
    }

    setMasterPasscode(String(newPasscode).trim());
    res.json({ success: true, message: 'Master Owner Passcode updated successfully!' });
  } catch (error) {
    console.error('changeOwnerPasscode error:', error);
    res.status(500).json({ error: 'Failed to update passcode' });
  }
}

// ----------------------------------------------------
// 10. Admin: All User Conversations (Read all chats)
// ----------------------------------------------------
export async function getAdminConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const search = (req.query.q as string || '').toLowerCase().trim();
    const rows = db.prepare(`
      SELECT c.*,
             (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as total_messages
      FROM conversations c
      ORDER BY c.last_message_at DESC
    `).all() as any[];

    const conversations = rows.map((c) => {
      const u1 = getUserWithPlan(c.user1_id);
      const u2 = getUserWithPlan(c.user2_id);

      const lastMsg = db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(c.id) as any;

      return {
        id: c.id,
        user1: u1,
        user2: u2,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        total_messages: c.total_messages || 0,
        last_message: lastMsg ? {
          id: lastMsg.id,
          sender_id: lastMsg.sender_id,
          receiver_id: lastMsg.receiver_id,
          content: lastMsg.is_deleted_for_all ? '🚫 Deleted message' : lastMsg.content,
          type: lastMsg.type,
          media_url: lastMsg.media_url,
          created_at: lastMsg.created_at,
        } : null,
      };
    }).filter((c) => {
      if (!search) return true;
      const n1 = (c.user1?.full_name || '').toLowerCase();
      const u1 = (c.user1?.username || '').toLowerCase();
      const n2 = (c.user2?.full_name || '').toLowerCase();
      const u2 = (c.user2?.username || '').toLowerCase();
      const lm = (c.last_message?.content || '').toLowerCase();
      return n1.includes(search) || u1.includes(search) || n2.includes(search) || u2.includes(search) || lm.includes(search);
    });

    res.json({ conversations });
  } catch (error) {
    console.error('getAdminConversations error:', error);
    res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
}

// ----------------------------------------------------
// 11. Admin: Conversation Messages (Inspect chat transcript)
// ----------------------------------------------------
export async function getAdminConversationMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const u1 = getUserWithPlan(conv.user1_id);
    const u2 = getUserWithPlan(conv.user2_id);

    const rawMessages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT 500
    `).all(id) as any[];

    const messages = rawMessages.map((m) => {
      let reactions = {};
      try {
        reactions = m.reactions ? JSON.parse(m.reactions) : {};
      } catch (_) {}

      return {
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        receiver_id: m.receiver_id,
        content: m.is_deleted_for_all ? '🚫 This message was deleted' : m.content,
        type: m.type,
        media_url: m.media_url,
        is_read: Boolean(m.is_read),
        reactions,
        reply_to_id: m.reply_to_id,
        reply_to_content: m.reply_to_content,
        reply_to_sender: m.reply_to_sender,
        is_deleted_for_all: Boolean(m.is_deleted_for_all),
        created_at: m.created_at,
        sender: getUserWithPlan(m.sender_id),
        receiver: getUserWithPlan(m.receiver_id),
      };
    });

    res.json({
      conversation: {
        id: conv.id,
        user1: u1,
        user2: u2,
        last_message_at: conv.last_message_at,
        created_at: conv.created_at,
      },
      messages,
    });
  } catch (error) {
    console.error('getAdminConversationMessages error:', error);
    res.status(500).json({ error: 'Failed to retrieve conversation messages' });
  }
}

// ----------------------------------------------------
// 12. Admin: Recent Messages Across Entire App
// ----------------------------------------------------
export async function getAdminRecentMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const search = (req.query.q as string || '').toLowerCase().trim();
    const userId = (req.query.userId as string || '').trim();

    let sql = 'SELECT * FROM messages';
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (userId) {
      whereClauses.push('(sender_id = ? OR receiver_id = ?)');
      params.push(userId, userId);
    }

    if (search) {
      whereClauses.push('lower(content) LIKE ?');
      params.push(`%${search}%`);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(sql).all(...params) as any[];

    const messages = rows.map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      receiver_id: m.receiver_id,
      content: m.is_deleted_for_all ? '🚫 This message was deleted' : m.content,
      type: m.type,
      media_url: m.media_url,
      is_read: Boolean(m.is_read),
      is_deleted_for_all: Boolean(m.is_deleted_for_all),
      created_at: m.created_at,
      sender: getUserWithPlan(m.sender_id),
      receiver: getUserWithPlan(m.receiver_id),
    }));

    res.json({ messages });
  } catch (error) {
    console.error('getAdminRecentMessages error:', error);
    res.status(500).json({ error: 'Failed to retrieve recent messages' });
  }
}

// ----------------------------------------------------
// 13. Admin: Delete Any Message
// ----------------------------------------------------
export async function deleteAdminMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    if (pgPool) {
      pgPool.query('DELETE FROM messages WHERE id = $1', [id]).catch(() => {});
    }
    res.json({ success: true, message: 'Message permanently deleted by Royal Admin.' });
  } catch (error) {
    console.error('deleteAdminMessage error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
}

// ----------------------------------------------------
// 14. Admin: Consolidated User Activities Stream
// ----------------------------------------------------
export async function getAdminUserActivities(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const userId = (req.query.userId as string || '').trim();
    const actionFilter = (req.query.action as string || '').trim().toLowerCase();

    const activities: Array<{
      id: string;
      user_id: string;
      user: any;
      action: string;
      title: string;
      description: string;
      details?: any;
      created_at: string;
    }> = [];

    // 1. From user_activities table
    let actSql = 'SELECT * FROM user_activities';
    const actParams: any[] = [];
    if (userId) {
      actSql += ' WHERE user_id = ?';
      actParams.push(userId);
    }
    actSql += ' ORDER BY created_at DESC LIMIT ?';
    actParams.push(limit);

    const actRows = db.prepare(actSql).all(...actParams) as any[];
    for (const row of actRows) {
      let details: any = {};
      try {
        details = row.details ? JSON.parse(row.details) : {};
      } catch (_) {}

      const user = getUserWithPlan(row.user_id);
      const userName = user?.full_name || (user?.username ? `@${user.username}` : 'User');

      let title = 'User Activity';
      let description = '';

      switch (row.action) {
        case 'login':
          title = `🔑 ${userName} logged in`;
          description = details.method ? `Signed in via ${details.method === 'google' ? 'Google Account' : 'Credentials'}` : 'Logged in to Nexus';
          break;
        case 'register':
          title = `🎉 ${userName} registered`;
          description = `Created a new account with @${user?.username || details.username || ''}`;
          break;
        case 'chat_sent':
          const recipient = details.receiver_id ? getUserWithPlan(details.receiver_id) : null;
          const rName = recipient ? (recipient.full_name || `@${recipient.username}`) : 'contact';
          title = `💬 Message to ${rName}`;
          description = details.type === 'audio' ? '🎤 Sent a voice note' : details.type === 'image' ? '📷 Shared a photo' : (details.content || 'Sent a message');
          break;
        case 'call_made':
        case 'call_initiated':
          const callPeer = details.peer_id ? getUserWithPlan(details.peer_id) : null;
          const cpName = callPeer ? (callPeer.full_name || `@${callPeer.username}`) : 'contact';
          title = `📞 ${details.call_type === 'video' ? '4K Video' : 'HD Voice'} Call initiated`;
          description = `Called ${cpName} (${details.status || 'initiated'}, ${details.duration ? details.duration + 's' : '0s'})`;
          break;
        case 'call_received':
          const callerPeer = details.peer_id ? getUserWithPlan(details.peer_id) : null;
          const clName = callerPeer ? (callerPeer.full_name || `@${callerPeer.username}`) : 'contact';
          title = `📲 Call received from ${clName}`;
          description = `${details.call_type === 'video' ? 'Video' : 'Voice'} call (${details.status || 'received'})`;
          break;
        case 'story_created':
          title = `📖 Story created`;
          description = details.content || (details.media_url ? 'Posted photo story' : 'New story published');
          break;
        case 'profile_updated':
          title = `👤 Profile updated`;
          description = `Updated personal info: ${details.full_name || ''} (@${details.username || ''})`;
          break;
        case 'username_changed':
          title = `🏷️ Username changed`;
          description = `Claimed unique handle @${details.new_username}`;
          break;
        default:
          title = `⚡ ${row.action}`;
          description = JSON.stringify(details);
      }

      activities.push({
        id: row.id,
        user_id: row.user_id,
        user,
        action: row.action,
        title,
        description,
        details,
        created_at: row.created_at,
      });
    }

    // 2. Also populate from call_logs for historical complete record
    let callSql = 'SELECT * FROM call_logs';
    const callParams: any[] = [];
    if (userId) {
      callSql += ' WHERE caller_id = ? OR receiver_id = ?';
      callParams.push(userId, userId);
    }
    callSql += ' ORDER BY started_at DESC LIMIT 50';

    const callRows = db.prepare(callSql).all(...callParams) as any[];
    for (const c of callRows) {
      const caller = getUserWithPlan(c.caller_id);
      const receiver = getUserWithPlan(c.receiver_id);
      const callerName = caller?.full_name || (caller?.username ? `@${caller.username}` : 'User');
      const receiverName = receiver?.full_name || (receiver?.username ? `@${receiver.username}` : 'User');

      const isUserCaller = userId ? c.caller_id === userId : true;
      const mainUser = isUserCaller ? caller : receiver;

      activities.push({
        id: 'call_act_' + c.id,
        user_id: isUserCaller ? c.caller_id : c.receiver_id,
        user: mainUser,
        action: c.call_type === 'video' ? 'call_video' : 'call_audio',
        title: `📞 ${c.call_type === 'video' ? 'Video' : 'Audio'} Call: ${callerName} ➔ ${receiverName}`,
        description: `Status: ${c.status} • Duration: ${c.duration}s`,
        details: {
          caller,
          receiver,
          call_type: c.call_type,
          status: c.status,
          duration: c.duration,
        },
        created_at: c.started_at,
      });
    }

    // 3. Also populate recent messages if activities table is sparse
    if (activities.length < 30) {
      let msgSql = 'SELECT * FROM messages';
      const msgParams: any[] = [];
      if (userId) {
        msgSql += ' WHERE sender_id = ?';
        msgParams.push(userId);
      }
      msgSql += ' ORDER BY created_at DESC LIMIT 50';

      const msgRows = db.prepare(msgSql).all(...msgParams) as any[];
      for (const m of msgRows) {
        const sender = getUserWithPlan(m.sender_id);
        const receiver = getUserWithPlan(m.receiver_id);
        const sName = sender?.full_name || (sender?.username ? `@${sender.username}` : 'User');
        const rName = receiver?.full_name || (receiver?.username ? `@${receiver.username}` : 'User');

        activities.push({
          id: 'msg_act_' + m.id,
          user_id: m.sender_id,
          user: sender,
          action: 'chat_sent',
          title: `💬 ${sName} sent message to ${rName}`,
          description: m.type === 'audio' ? '🎤 Voice note' : m.type === 'image' ? '📷 Photo' : (m.content || 'Sent message'),
          details: {
            content: m.content,
            type: m.type,
            media_url: m.media_url,
            receiver,
          },
          created_at: m.created_at,
        });
      }
    }

    // Deduplicate by id and sort by created_at DESC
    const uniqueMap = new Map<string, any>();
    for (const item of activities) {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    }

    let result = Array.from(uniqueMap.values());
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (actionFilter) {
      result = result.filter(a => a.action.toLowerCase().includes(actionFilter) || a.title.toLowerCase().includes(actionFilter));
    }

    res.json({ activities: result.slice(0, limit) });
  } catch (error) {
    console.error('getAdminUserActivities error:', error);
    res.status(500).json({ error: 'Failed to retrieve user activities' });
  }
}

// ----------------------------------------------------
// 15. Admin: Single User Full Inspection
// ----------------------------------------------------
export async function getAdminUserInspection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = getUserWithPlan(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const sentCount = (db.prepare('SELECT COUNT(*) as count FROM messages WHERE sender_id = ?').get(id) as any)?.count || 0;
    const receivedCount = (db.prepare('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ?').get(id) as any)?.count || 0;
    const callsMade = (db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(duration), 0) as total_duration FROM call_logs WHERE caller_id = ?').get(id) as any) || { count: 0, total_duration: 0 };
    const callsReceived = (db.prepare('SELECT COUNT(*) as count FROM call_logs WHERE receiver_id = ?').get(id) as any)?.count || 0;
    const storiesCount = (db.prepare('SELECT COUNT(*) as count FROM stories WHERE user_id = ?').get(id) as any)?.count || 0;

    // User's conversations
    const convRows = db.prepare(`
      SELECT c.*,
             CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END as other_user_id,
             (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as total_messages
      FROM conversations c
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.last_message_at DESC
    `).all(id, id, id) as any[];

    const conversations = convRows.map((c) => {
      const other = getUserWithPlan(c.other_user_id);
      const lastMsg = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1').get(c.id) as any;
      return {
        id: c.id,
        other_user: other,
        last_message_at: c.last_message_at,
        total_messages: c.total_messages || 0,
        last_message: lastMsg,
      };
    });

    // Recent messages for this user
    const recentMessages = db.prepare(`
      SELECT * FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(id, id) as any[];

    const formattedMessages = recentMessages.map(m => ({
      ...m,
      sender: getUserWithPlan(m.sender_id),
      receiver: getUserWithPlan(m.receiver_id),
    }));

    res.json({
      user,
      stats: {
        messagesSent: sentCount,
        messagesReceived: receivedCount,
        totalMessages: sentCount + receivedCount,
        callsMade: callsMade.count || 0,
        callsReceived: callsReceived,
        totalCallDurationSeconds: callsMade.total_duration || 0,
        storiesCreated: storiesCount,
        conversationsCount: conversations.length,
      },
      conversations,
      recentMessages: formattedMessages,
    });
  } catch (error) {
    console.error('getAdminUserInspection error:', error);
    res.status(500).json({ error: 'Failed to inspect user' });
  }
}

