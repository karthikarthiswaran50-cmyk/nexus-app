import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, persistUserToPg, persistSubscriptionToPg, persistSettingsToPg } from '../db.js';
import { JWT_SECRET, AuthenticatedRequest } from '../middleware/auth.js';
import { User, UserWithPlan, Subscription } from '../types.js';
import { sanitizeText, sanitizeUsername, sanitizeEmail, validatePasswordStrength } from '../utils/sanitize.js';
import { verifyFirebaseIdToken } from '../services/firebase.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, username, password, full_name, avatar_url, bio, country } = req.body;

    if (!email || !username || !password || !full_name) {
      res.status(400).json({ error: 'Email, username, full name, and password are required.' });
      return;
    }

    const cleanEmail = sanitizeEmail(email);
    const cleanUsername = sanitizeUsername(username);

    if (cleanUsername.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 alphanumeric characters.' });
      return;
    }

    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      res.status(400).json({ error: pwCheck.reason });
      return;
    }

    // Check unique
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(cleanEmail, cleanUsername) as unknown as { id: string } | undefined;
    if (existing) {
      res.status(409).json({ error: 'A user with this email or username already exists.' });
      return;
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const salt = bcrypt.genSaltSync(12); // High-security 12 rounds bcrypt salt
    const passwordHash = bcrypt.hashSync(password, salt);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const cleanFullName = sanitizeText(full_name);
    const avatar = avatar_url ? String(avatar_url).substring(0, 500) : `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;
    const userBio = sanitizeText(bio || 'Hello! I am new here on Nexus.');
    const userCountry = sanitizeText(country || 'Global');

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

    // Asynchronously persist to permanent PostgreSQL Database
    persistUserToPg({
      id: userId,
      email: cleanEmail,
      username: cleanUsername,
      password_hash: passwordHash,
      full_name,
      avatar_url: avatar,
      bio: userBio,
      status: 'Online on Nexus',
      country: userCountry,
    });
    persistSubscriptionToPg({
      id: `sub_${userId}`,
      user_id: userId,
      plan_id: 'free',
      status: 'active',
      current_period_end: expiresAt,
      billing_cycle: 'monthly',
    });
    persistSettingsToPg({
      id: `set_${userId}`,
      user_id: userId,
      theme: 'dark',
      allow_calls_from: 'everyone',
      notification_sound: 1,
      read_receipts: 1,
      auto_accept_calls: 0,
    });

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

export async function firebaseLogin(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'Firebase ID token is required.' });
      return;
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded || !decoded.email) {
      res.status(401).json({ error: 'Invalid or unverified Firebase ID token.' });
      return;
    }

    const cleanEmail = sanitizeEmail(decoded.email);
    let user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(cleanEmail) as unknown as User | undefined;

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (!user) {
      // Auto-provision user from Google / Firebase profile
      const rawName = decoded.name || cleanEmail.split('@')[0];
      const baseUsername = sanitizeUsername(rawName.replace(/\s+/g, '_'));
      const cleanUsername = (baseUsername || 'user') + '_' + Math.random().toString(36).substring(2, 6);
      const userId = 'usr_fb_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36);
      const randomPasswordHash = bcrypt.hashSync(Math.random().toString(36), 12);
      const avatar = decoded.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;
      const fullName = sanitizeText(decoded.name || cleanUsername);

      db.prepare(`
        INSERT INTO users (id, email, username, password_hash, full_name, avatar_url, bio, status, country, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, cleanEmail, cleanUsername, randomPasswordHash, fullName, avatar, 'Joined via Google', 'Online on Nexus', 'Global', now, now);

      db.prepare(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle, created_at)
        VALUES (?, ?, 'free', 'active', ?, 'monthly', ?)
      `).run(`sub_${userId}`, userId, expiresAt, now);

      db.prepare(`
        INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls)
        VALUES (?, ?, 'dark', 'everyone', 1, 1, 0)
      `).run(`set_${userId}`, userId);

      // Persist to PostgreSQL
      persistUserToPg({
        id: userId,
        email: cleanEmail,
        username: cleanUsername,
        password_hash: randomPasswordHash,
        full_name: fullName,
        avatar_url: avatar,
        bio: 'Joined via Google',
        status: 'Online on Nexus',
        country: 'Global',
      });
      persistSubscriptionToPg({
        id: `sub_${userId}`,
        user_id: userId,
        plan_id: 'free',
        status: 'active',
        current_period_end: expiresAt,
        billing_cycle: 'monthly',
      });
      persistSettingsToPg({
        id: `set_${userId}`,
        user_id: userId,
        theme: 'dark',
        allow_calls_from: 'everyone',
        notification_sound: 1,
        read_receipts: 1,
        auto_accept_calls: 0,
      });

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as User;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const userWithPlan = getUserWithPlan(user.id);
    res.json({ token, user: userWithPlan });
  } catch (error) {
    console.error('Firebase login error:', error);
    res.status(500).json({ error: 'Authentication with Firebase failed.' });
  }
}

export async function setUsername(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rawUsername = (req.body.username || '').trim().replace(/^@/, '').toLowerCase();
    const cleanUsername = sanitizeUsername(rawUsername);

    if (cleanUsername.length < 3 || cleanUsername.length > 25) {
      res.status(400).json({ error: 'Username must be between 3 and 25 characters.' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE lower(username) = ? AND id != ?').get(cleanUsername, userId);
    if (existing) {
      res.status(409).json({ error: 'This username is already taken. Please choose another.' });
      return;
    }

    db.prepare('UPDATE users SET username = ?, updated_at = datetime(\'now\') WHERE id = ?').run(cleanUsername, userId);

    const user = getUserWithPlan(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    persistUserToPg({
      id: user.id,
      email: user.email,
      username: cleanUsername,
      password_hash: '',
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      status: user.status,
      country: user.country,
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, username: cleanUsername },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ success: true, token, user, message: 'Unique username claimed successfully!' });
  } catch (error) {
    console.error('setUsername error:', error);
    res.status(500).json({ error: 'Failed to claim username.' });
  }
}


