import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pgPool, persistUserToPg, persistSettingsToPg, persistBlockToPg, persistReportToPg, recordActivity, purgeUserPermanently, upsertUserToSqlite } from '../db.js';
import { disconnectUserSockets } from '../socket.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';
import { UserWithPlan, UserSettings } from '../types.js';
import { sanitizeText } from '../utils/sanitize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rawQuery = (req.query.q as string || '').trim();

    // Redaction helper respecting user privacy settings
    const redactUsers = (list: any[]) => list.map(u => {
      if (u.id === currentUserId) return u;
      let avatar = u.avatar_url;
      let lastSeen = u.last_seen;
      try {
        const st = db.prepare('SELECT who_can_see_profile_photo, who_can_see_last_seen FROM user_settings WHERE user_id = ?').get(u.id) as any;
        if (st?.who_can_see_profile_photo === 'nobody') {
          avatar = '';
        }
        if (st?.who_can_see_last_seen === 'nobody') {
          lastSeen = undefined;
        }
      } catch (_) {}
      return { ...u, email: '', avatar_url: avatar, last_seen: lastSeen };
    });

    // Privacy Protection: If no explicit query, return current user's existing contacts / conversation partners
    // (Used by ForwardMessageModal, CreateGroupModal, etc. without exposing public user directory)
    if (!rawQuery) {
      try {
        const convUsers = db.prepare(`
          SELECT u.id, '' as email, u.username, u.full_name, u.avatar_url, u.bio, u.status, u.country, u.created_at, u.updated_at,
                 'free' as plan_id, 'active' as subscription_status
          FROM users u
          JOIN conversations c ON (c.user1_id = u.id OR c.user2_id = u.id)
          WHERE (c.user1_id = ? OR c.user2_id = ?) AND u.id != ? AND COALESCE(u.is_banned, 0) = 0
          ORDER BY c.last_message_at DESC
          LIMIT 30
        `).all(currentUserId, currentUserId, currentUserId) as any[];

        res.json({ users: redactUsers(convUsers) });
        return;
      } catch (convErr) {
        res.json({ users: [] });
        return;
      }
    }

    const query = rawQuery.replace(/^@+/, '').trim().toLowerCase();

    const sql = `
      SELECT u.id, '' as email, u.username, u.full_name, u.avatar_url, u.bio, u.status, u.country, u.created_at, u.updated_at,
             COALESCE(s.plan_id, 'free') as plan_id,
             COALESCE(s.status, 'active') as subscription_status,
             s.current_period_end as subscription_expires_at
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      WHERE COALESCE(u.is_banned, 0) = 0 
        AND (LOWER(REPLACE(u.username, '@', '')) LIKE ? OR LOWER(u.full_name) LIKE ?)
      ORDER BY 
        CASE 
          WHEN LOWER(REPLACE(u.username, '@', '')) = ? THEN 1
          WHEN LOWER(REPLACE(u.username, '@', '')) LIKE ? THEN 2
          WHEN LOWER(u.full_name) LIKE ? THEN 3
          ELSE 4
        END,
        u.created_at DESC
      LIMIT 30
    `;

    const users = (db.prepare(sql).all(
      `%${query}%`,
      `%${query}%`,
      query,
      `${query}%`,
      `%${query}%`
    ) as unknown) as UserWithPlan[];

    // If PostgreSQL is configured, also search PostgreSQL to guarantee live synchronization
    if (pgPool) {
      try {
        const pgRes = await pgPool.query(`
          SELECT u.id, '' as email, u.username, u.full_name, u.avatar_url, u.bio, u.status, u.country, u.created_at, u.updated_at,
                 u.password_hash, u.role, u.is_banned,
                 COALESCE(s.plan_id, 'free') as plan_id,
                 COALESCE(s.status, 'active') as subscription_status,
                 s.current_period_end as subscription_expires_at
          FROM users u
          LEFT JOIN subscriptions s ON u.id = s.user_id
          WHERE COALESCE(u.is_banned, 0) = 0
            AND (LOWER(REPLACE(u.username, '@', '')) LIKE $1 OR LOWER(u.full_name) LIKE $1)
          ORDER BY
            CASE
              WHEN LOWER(REPLACE(u.username, '@', '')) = $2 THEN 1
              WHEN LOWER(REPLACE(u.username, '@', '')) LIKE $3 THEN 2
              WHEN LOWER(u.full_name) LIKE $1 THEN 3
              ELSE 4
            END,
            u.created_at DESC
          LIMIT 30
        `, [`%${query}%`, query, `${query}%`]);

        for (const row of pgRes.rows) {
          upsertUserToSqlite(row);
          if (!users.some(existing => existing.id === row.id)) {
            users.push({
              id: row.id,
              email: '',
              username: row.username,
              full_name: row.full_name,
              avatar_url: row.avatar_url || '',
              bio: row.bio || '',
              status: row.status || '',
              country: row.country || 'Global',
              created_at: row.created_at,
              updated_at: row.updated_at,
              plan_id: row.plan_id || 'free',
              subscription_status: row.subscription_status || 'active',
              subscription_expires_at: row.subscription_expires_at,
            } as any);
          }
        }
      } catch (pgErr: any) {
        console.warn('PostgreSQL search fallback note:', pgErr.message);
      }
    }

    res.json({ users: redactUsers(users) });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
}

export async function checkUsernameAvailable(req: Request, res: Response): Promise<void> {
  try {
    const raw = (req.params.username || '').trim().replace(/^@+/, '').toLowerCase();
    const clean = sanitizeText(raw);
    if (clean.length < 3 || clean.length > 25 || !/^[a-zA-Z0-9_]+$/.test(clean)) {
      res.json({ available: false, reason: 'Must be 3-25 alphanumeric characters or underscores' });
      return;
    }

    const existing = db.prepare("SELECT id FROM users WHERE LOWER(REPLACE(username, '@', '')) = ?").get(clean);
    if (existing) {
      res.json({ available: false });
      return;
    }

    if (pgPool) {
      try {
        const pgRes = await pgPool.query("SELECT id FROM users WHERE LOWER(REPLACE(username, '@', '')) = $1 LIMIT 1", [clean]);
        if (pgRes.rows.length > 0) {
          res.json({ available: false });
          return;
        }
      } catch (_) {}
    }

    res.json({ available: true });
  } catch (err) {
    res.status(500).json({ available: false });
  }
}

export async function getUserByIdOrUsername(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = (req.params.id || '').replace(/^@+/, '');
    
    // Check by ID or username
    let user = getUserWithPlan(rawId);
    if (!user) {
      const byUsername = db.prepare("SELECT id FROM users WHERE LOWER(REPLACE(username, '@', '')) = ?").get(rawId.toLowerCase()) as unknown as { id: string } | undefined;
      if (byUsername) {
        user = getUserWithPlan(byUsername.id);
      }
    }

    // Check PostgreSQL fallback if not found in local SQLite
    if (!user && pgPool) {
      try {
        const pgRes = await pgPool.query(
          "SELECT * FROM users WHERE id = $1 OR LOWER(REPLACE(username, '@', '')) = LOWER($2) LIMIT 1",
          [rawId, rawId]
        );
        if (pgRes.rows[0]) {
          upsertUserToSqlite(pgRes.rows[0]);
          user = getUserWithPlan(pgRes.rows[0].id);
        }
      } catch (_) {}
    }

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Privacy protection: Redact email unless viewing own profile
    if (user.id !== req.user?.userId) {
      user = { ...user, email: '' };
      const st = db.prepare('SELECT who_can_see_profile_photo, who_can_see_last_seen FROM user_settings WHERE user_id = ?').get(user.id) as any;
      if (st?.who_can_see_profile_photo === 'nobody') {
        user = { ...user, avatar_url: '' };
      }
      if (st?.who_can_see_last_seen === 'nobody') {
        user = { ...user, last_seen: undefined };
      }
    }

    res.json({ user });
  } catch (error) {
    console.error('getUserById error:', error);
    res.status(500).json({ error: 'Failed to retrieve user.' });
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { full_name, username, avatar_url, bio, status, country } = req.body;

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!current) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    let updatedUsername = current.username;
    if (username !== undefined) {
      const cleanUser = String(username).trim().replace(/^@/, '').toLowerCase();
      if (cleanUser !== current.username.toLowerCase()) {
        if (cleanUser.length < 3 || cleanUser.length > 25 || !/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
          res.status(400).json({ error: 'Username must be 3-25 alphanumeric characters or underscores.' });
          return;
        }
        const existing = db.prepare('SELECT id FROM users WHERE lower(username) = ? AND id != ?').get(cleanUser, userId);
        if (existing) {
          res.status(409).json({ error: 'This username is already taken. Please choose another.' });
          return;
        }
        updatedUsername = cleanUser;
      }
    }

    const updatedName = full_name !== undefined ? sanitizeText(full_name) : current.full_name;
    const updatedAvatar = avatar_url !== undefined ? String(avatar_url) : current.avatar_url;
    const updatedBio = bio !== undefined ? sanitizeText(bio) : current.bio;
    const updatedStatus = status !== undefined ? sanitizeText(status) : current.status;
    const updatedCountry = country !== undefined ? sanitizeText(country) : current.country;

    db.prepare(`
      UPDATE users 
      SET full_name = ?, username = ?, avatar_url = ?, bio = ?, status = ?, country = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(updatedName, updatedUsername, updatedAvatar, updatedBio, updatedStatus, updatedCountry, userId);

    // Persist to PostgreSQL
    persistUserToPg({
      id: userId,
      email: current.email,
      username: updatedUsername,
      password_hash: current.password_hash,
      full_name: updatedName,
      avatar_url: updatedAvatar,
      bio: updatedBio,
      status: updatedStatus,
      country: updatedCountry,
    });

    recordActivity(userId, 'profile_updated', {
      full_name: updatedName,
      username: updatedUsername,
      status: updatedStatus,
      country: updatedCountry,
    });

    const user = getUserWithPlan(userId);
    res.json({ user, message: 'Profile updated successfully.' });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
}

export async function uploadAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let finalAvatarUrl = '';

    // 1. If file was uploaded via multipart (multer)
    if (req.file) {
      finalAvatarUrl = `/uploads/${req.file.filename}`;
    } else if (req.body?.avatarData && typeof req.body.avatarData === 'string') {
      // 2. Base64 data URL
      const match = req.body.avatarData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const buffer = Buffer.from(match[2], 'base64');
        const filename = `avatar-${userId}-${Date.now()}.${ext}`;
        const uploadsDir = path.resolve(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadsDir, filename), buffer);
        finalAvatarUrl = `/uploads/${filename}`;
      } else if (req.body.avatarData.startsWith('http://') || req.body.avatarData.startsWith('https://')) {
        finalAvatarUrl = req.body.avatarData;
      }
    } else if (req.body?.avatar_url && typeof req.body.avatar_url === 'string') {
      finalAvatarUrl = req.body.avatar_url;
    }

    if (!finalAvatarUrl) {
      res.status(400).json({ error: 'No image provided for avatar.' });
      return;
    }

    db.prepare('UPDATE users SET avatar_url = ?, updated_at = datetime(\'now\') WHERE id = ?').run(finalAvatarUrl, userId);

    const user = getUserWithPlan(userId);
    if (user) {
      persistUserToPg({
        id: user.id,
        email: user.email,
        username: user.username,
        password_hash: '',
        full_name: user.full_name,
        avatar_url: finalAvatarUrl,
        bio: user.bio,
        status: user.status,
        country: user.country,
      });
    }

    res.json({ success: true, avatar_url: finalAvatarUrl, user });
  } catch (err: any) {
    console.error('uploadAvatar error:', err);
    res.status(500).json({ error: 'Failed to upload avatar: ' + err.message });
  }
}


export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as any;
    if (!settings) {
      db.prepare(`
        INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls, who_can_call_me, who_can_see_last_seen, who_can_see_online_status, who_can_see_profile_photo)
        VALUES (?, ?, 'dark', 'everyone', 1, 1, 0, 'everyone', 'everyone', 'everyone', 'everyone')
      `).run(`set_${userId}`, userId);
      settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as any;
    }

    res.json({
      settings: {
        ...settings,
        who_can_call_me: settings.who_can_call_me || 'everyone',
        who_can_see_last_seen: settings.who_can_see_last_seen || 'everyone',
        who_can_see_online_status: settings.who_can_see_online_status || 'everyone',
        who_can_see_profile_photo: settings.who_can_see_profile_photo || 'everyone',
      }
    });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
}

export async function updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const {
      theme,
      allow_calls_from,
      notification_sound,
      read_receipts,
      auto_accept_calls,
      who_can_call_me,
      who_can_see_last_seen,
      who_can_see_online_status,
      who_can_see_profile_photo
    } = req.body;

    const current = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as any;
    
    const newTheme = theme || current?.theme || 'dark';
    const newAllowCalls = who_can_call_me || allow_calls_from || current?.allow_calls_from || 'everyone';
    const newNotifSound = notification_sound !== undefined ? (notification_sound ? 1 : 0) : (current?.notification_sound ?? 1);
    const newReadReceipts = read_receipts !== undefined ? (read_receipts ? 1 : 0) : (current?.read_receipts ?? 1);
    const newAutoAccept = auto_accept_calls !== undefined ? (auto_accept_calls ? 1 : 0) : (current?.auto_accept_calls ?? 0);
    const newWhoCanCallMe = who_can_call_me || current?.who_can_call_me || 'everyone';
    const newWhoCanSeeLastSeen = who_can_see_last_seen || current?.who_can_see_last_seen || 'everyone';
    const newWhoCanSeeOnlineStatus = who_can_see_online_status || current?.who_can_see_online_status || 'everyone';
    const newWhoCanSeeProfilePhoto = who_can_see_profile_photo || current?.who_can_see_profile_photo || 'everyone';

    if (current) {
      db.prepare(`
        UPDATE user_settings
        SET theme = ?, allow_calls_from = ?, notification_sound = ?, read_receipts = ?, auto_accept_calls = ?, who_can_call_me = ?, who_can_see_last_seen = ?, who_can_see_online_status = ?, who_can_see_profile_photo = ?
        WHERE user_id = ?
      `).run(
        newTheme,
        newAllowCalls,
        newNotifSound,
        newReadReceipts,
        newAutoAccept,
        newWhoCanCallMe,
        newWhoCanSeeLastSeen,
        newWhoCanSeeOnlineStatus,
        newWhoCanSeeProfilePhoto,
        userId
      );
    } else {
      db.prepare(`
        INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls, who_can_call_me, who_can_see_last_seen, who_can_see_online_status, who_can_see_profile_photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `set_${userId}`,
        userId,
        newTheme,
        newAllowCalls,
        newNotifSound,
        newReadReceipts,
        newAutoAccept,
        newWhoCanCallMe,
        newWhoCanSeeLastSeen,
        newWhoCanSeeOnlineStatus,
        newWhoCanSeeProfilePhoto
      );
    }

    persistSettingsToPg({
      id: current?.id || `set_${userId}`,
      user_id: userId,
      theme: newTheme,
      allow_calls_from: newAllowCalls,
      notification_sound: newNotifSound,
      read_receipts: newReadReceipts,
      auto_accept_calls: newAutoAccept,
      who_can_call_me: newWhoCanCallMe,
      who_can_see_last_seen: newWhoCanSeeLastSeen,
      who_can_see_online_status: newWhoCanSeeOnlineStatus,
      who_can_see_profile_photo: newWhoCanSeeProfilePhoto,
    });

    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as any;
    res.json({ settings, message: 'Settings saved successfully.' });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
}

export async function updateFcmToken(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { token } = req.body;
    if (!userId || !token) {
      res.status(400).json({ error: 'User ID and FCM token are required.' });
      return;
    }

    db.prepare(`
      UPDATE user_settings
      SET fcm_token = ?
      WHERE user_id = ?
    `).run(String(token).trim(), userId);

    res.json({ success: true, message: 'FCM push token registered.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update FCM token.' });
  }
}

// ----------------------------------------------------
// Blocking & Reporting
// ----------------------------------------------------
export async function blockUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id: targetUserId } = req.params;

    if (!userId || !targetUserId || userId === targetUserId) {
      res.status(400).json({ error: 'Invalid user to block.' });
      return;
    }

    const blockId = 'blk_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO blocked_users (id, user_id, blocked_user_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(blockId, userId, targetUserId, now);

    persistBlockToPg({
      id: blockId,
      user_id: userId,
      blocked_user_id: targetUserId,
    });

    recordActivity(userId, 'block_user', { blocked_user_id: targetUserId });

    res.json({ success: true, message: 'User blocked.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to block user.' });
  }
}

export async function unblockUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { id: targetUserId } = req.params;

    if (!userId || !targetUserId) {
      res.status(400).json({ error: 'Invalid user to unblock.' });
      return;
    }

    db.prepare('DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?').run(userId, targetUserId);
    if (pgPool) {
      pgPool.query('DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2', [userId, targetUserId]).catch(() => {});
    }
    recordActivity(userId, 'unblock_user', { unblocked_user_id: targetUserId });

    res.json({ success: true, message: 'User unblocked.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to unblock user.' });
  }
}

export async function getBlockedUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const blockedRows = (db.prepare(`
      SELECT b.id, b.blocked_user_id, b.created_at,
             u.username, u.full_name, u.avatar_url, u.status
      FROM blocked_users b
      JOIN users u ON b.blocked_user_id = u.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(userId) as any[]).map(b => ({
      id: b.id,
      blocked_user_id: b.blocked_user_id,
      created_at: b.created_at,
      user: {
        id: b.blocked_user_id,
        username: b.username,
        full_name: b.full_name,
        avatar_url: b.avatar_url,
        status: b.status,
      },
    }));

    res.json({ blocks: blockedRows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch blocked users.' });
  }
}

export async function reportUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reporterId = req.user?.userId;
    const { reportedUserId, reason } = req.body;

    if (!reporterId || !reportedUserId || !reason?.trim()) {
      res.status(400).json({ error: 'Missing required report fields.' });
      return;
    }

    const reportId = 'rep_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const now = new Date().toISOString();
    const cleanReason = sanitizeText(reason.trim());

    db.prepare(`
      INSERT INTO user_reports (id, reporter_id, reported_user_id, reason, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(reportId, reporterId, reportedUserId, cleanReason, now);

    persistReportToPg({
      id: reportId,
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reason: cleanReason,
      status: 'pending',
    });

    recordActivity(reporterId, 'report_user', { reportedUserId, reason: cleanReason });

    res.status(201).json({ success: true, message: 'Report submitted for review.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to report user.' });
  }
}

// ----------------------------------------------------
// Account Management (Self Delete & Logout All)
// ----------------------------------------------------
export async function deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Disconnect active socket connections immediately
    disconnectUserSockets(userId);

    // Completely and permanently purge all database records, credentials, conversations, and media
    const success = await purgeUserPermanently(userId);
    if (!success) {
      res.status(500).json({ error: 'Failed to completely purge user account.' });
      return;
    }

    res.json({ success: true, message: 'Your Nexus account and all associated data have been permanently erased.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete account.' });
  }
}

export async function logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Clear push tokens to invalidate notifications to all sessions
    db.prepare('UPDATE user_settings SET fcm_token = NULL WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
    recordActivity(userId, 'logout_all_devices');

    res.json({ success: true, message: 'Logged out of all mobile and web devices.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to logout from all devices.' });
  }
}

