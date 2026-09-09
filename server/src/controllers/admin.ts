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

// ----------------------------------------------------
// 8. Claim Owner / Admin Role (with Master Passcode)
// ----------------------------------------------------
export async function claimOwnerRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { passcode } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!passcode || passcode.trim() !== OWNER_MASTER_KEY.trim()) {
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
      message: 'Crown verified! You are now the official Royal Owner / Admin.',
    });
  } catch (error) {
    console.error('claimOwnerRole error:', error);
    res.status(500).json({ error: 'Failed to claim owner role' });
  }
}
