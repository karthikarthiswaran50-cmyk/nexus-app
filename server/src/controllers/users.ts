import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, persistUserToPg, persistSettingsToPg } from '../db.js';
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


    // Instagram style: Only return profiles if user actively searches
    if (!rawQuery) {
      res.json({ users: [] });
      return;
    }

    const query = rawQuery.replace(/^@/, '').toLowerCase(); // strip leading '@' if user typed @username

    const sql = `
      SELECT u.id, u.email, u.username, u.full_name, u.avatar_url, u.bio, u.status, u.country, u.created_at, u.updated_at,
             COALESCE(s.plan_id, 'free') as plan_id,
             COALESCE(s.status, 'active') as subscription_status,
             s.current_period_end as subscription_expires_at
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      WHERE u.id != ? AND (lower(u.username) LIKE ? OR lower(u.full_name) LIKE ?)
      ORDER BY 
        CASE 
          WHEN lower(u.username) = ? THEN 1
          WHEN lower(u.username) LIKE ? THEN 2
          ELSE 3
        END,
        u.created_at DESC
      LIMIT 25
    `;

    const users = (db.prepare(sql).all(
      currentUserId,
      `%${query}%`,
      `%${query}%`,
      query,
      `${query}%`
    ) as unknown) as UserWithPlan[];

    res.json({ users });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
}

export async function checkUsernameAvailable(req: Request, res: Response): Promise<void> {
  try {
    const raw = (req.params.username || '').trim().replace(/^@/, '').toLowerCase();
    const clean = sanitizeText(raw);
    if (clean.length < 3 || clean.length > 25 || !/^[a-zA-Z0-9_]+$/.test(clean)) {
      res.json({ available: false, reason: 'Must be 3-25 alphanumeric characters or underscores' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(clean);
    res.json({ available: !existing });
  } catch (err) {
    res.status(500).json({ available: false });
  }
}

export async function getUserByIdOrUsername(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = (req.params.id || '').replace(/^@/, '');
    
    // Check by ID or username
    let user = getUserWithPlan(rawId);
    if (!user) {
      const byUsername = db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(rawId.toLowerCase()) as unknown as { id: string } | undefined;
      if (byUsername) {
        user = getUserWithPlan(byUsername.id);
      }
    }

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
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

    let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as unknown as UserSettings | undefined;
    if (!settings) {
      db.prepare(`
        INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls)
        VALUES (?, ?, 'dark', 'everyone', 1, 1, 0)
      `).run(`set_${userId}`, userId);
      settings = (db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as unknown) as UserSettings;
    }

    res.json({ settings });
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

    const { theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls } = req.body;

    const current = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as any;
    
    const newTheme = theme || current?.theme || 'dark';
    const newAllowCalls = allow_calls_from || current?.allow_calls_from || 'everyone';
    const newNotifSound = notification_sound !== undefined ? (notification_sound ? 1 : 0) : (current?.notification_sound ?? 1);
    const newReadReceipts = read_receipts !== undefined ? (read_receipts ? 1 : 0) : (current?.read_receipts ?? 1);
    const newAutoAccept = auto_accept_calls !== undefined ? (auto_accept_calls ? 1 : 0) : (current?.auto_accept_calls ?? 0);

    if (current) {
      db.prepare(`
        UPDATE user_settings
        SET theme = ?, allow_calls_from = ?, notification_sound = ?, read_receipts = ?, auto_accept_calls = ?
        WHERE user_id = ?
      `).run(newTheme, newAllowCalls, newNotifSound, newReadReceipts, newAutoAccept, userId);
    } else {
      db.prepare(`
        INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`set_${userId}`, userId, newTheme, newAllowCalls, newNotifSound, newReadReceipts, newAutoAccept);
    }

    const settings = (db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as unknown) as UserSettings;
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

