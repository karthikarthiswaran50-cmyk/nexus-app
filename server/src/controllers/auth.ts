import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET, AuthenticatedRequest } from '../middleware/auth.js';
import { User, UserWithPlan, Subscription } from '../types.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, username, password, full_name, avatar_url, bio, country } = req.body;

    if (!email || !username || !password || !full_name) {
      res.status(400).json({ error: 'Email, username, full name, and password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (cleanUsername.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 alphanumeric characters.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    // Check unique
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(cleanEmail, cleanUsername) as unknown as { id: string } | undefined;
    if (existing) {
      res.status(409).json({ error: 'A user with this email or username already exists.' });
      return;
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const avatar = avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;
    const userBio = bio || 'Hello! I am new here on Nexus.';
    const userCountry = country || 'Global';

    // Insert user
    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, full_name, avatar_url, bio, status, country, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, cleanEmail, cleanUsername, passwordHash, full_name, avatar, userBio, 'Online on Nexus', userCountry, now, now);

    // Insert default free subscription
    db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle, created_at)
      VALUES (?, ?, 'free', 'active', ?, 'monthly', ?)
    `).run(`sub_${userId}`, userId, expiresAt, now);

    // Insert default settings
    db.prepare(`
      INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls)
      VALUES (?, ?, 'dark', 'everyone', 1, 1, 0)
    `).run(`set_${userId}`, userId);

    const token = jwt.sign(
      { userId, email: cleanEmail, username: cleanUsername },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const user = getUserWithPlan(userId);
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      res.status(400).json({ error: 'Email/Username and password are required.' });
      return;
    }

    const cleanLogin = login.trim().toLowerCase();
    const user = db.prepare(`
      SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ?
    `).get(cleanLogin, cleanLogin) as unknown as (User & { password_hash: string }) | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const fullUser = getUserWithPlan(user.id);
    res.json({ token, user: fullUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = getUserWithPlan(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);

    res.json({ user, settings });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Failed to fetch user session' });
  }
}

export async function updatePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as unknown as { password_hash: string } | undefined;
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newHash, userId);

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password.' });
  }
}

export function getUserWithPlan(userId: string): UserWithPlan | null {
  const row = db.prepare(`
    SELECT u.id, u.email, u.username, u.full_name, u.avatar_url, u.bio, u.status, u.country, u.created_at, u.updated_at,
           COALESCE(s.plan_id, 'free') as plan_id,
           COALESCE(s.status, 'active') as subscription_status,
           s.current_period_end as subscription_expires_at
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id
    WHERE u.id = ?
  `).get(userId) as unknown as UserWithPlan | undefined;

  return row || null;
}
