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
