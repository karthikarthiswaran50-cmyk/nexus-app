import { Request, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';
import { UserWithPlan, UserSettings } from '../types.js';

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.userId;
    const query = (req.query.q as string || '').trim().toLowerCase();

    let sql = `
      SELECT u.id, u.email, u.username, u.full_name, u.avatar_url, u.bio, u.status, u.country, u.created_at, u.updated_at,
             COALESCE(s.plan_id, 'free') as plan_id,
             COALESCE(s.status, 'active') as subscription_status,
             s.current_period_end as subscription_expires_at
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (currentUserId) {
      conditions.push('u.id != ?');
      params.push(currentUserId);
    }

    if (query) {
      conditions.push('(lower(u.full_name) LIKE ? OR lower(u.username) LIKE ? OR lower(u.email) LIKE ?)');
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY u.created_at DESC LIMIT 50';

    const users = (db.prepare(sql).all(...params) as unknown) as UserWithPlan[];
    res.json({ users });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
}

export async function getUserByIdOrUsername(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Check by ID or username
    let user = getUserWithPlan(id);
    if (!user) {
      const byUsername = db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(id.toLowerCase()) as unknown as { id: string } | undefined;
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

    const { full_name, avatar_url, bio, status, country } = req.body;

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!current) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const updatedName = full_name !== undefined ? full_name.trim() : current.full_name;
    const updatedAvatar = avatar_url !== undefined ? avatar_url.trim() : current.avatar_url;
    const updatedBio = bio !== undefined ? bio.trim() : current.bio;
    const updatedStatus = status !== undefined ? status.trim() : current.status;
    const updatedCountry = country !== undefined ? country.trim() : current.country;

    db.prepare(`
      UPDATE users 
      SET full_name = ?, avatar_url = ?, bio = ?, status = ?, country = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(updatedName, updatedAvatar, updatedBio, updatedStatus, updatedCountry, userId);

    const user = getUserWithPlan(userId);
    res.json({ user, message: 'Profile updated successfully.' });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
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
