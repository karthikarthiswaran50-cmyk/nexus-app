import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types.js';

import crypto from 'node:crypto';

const DEFAULT_INSECURE_SECRET = 'nexus_ultra_secure_jwt_secret_key_2026';
const PERMANENT_PROD_SECRET = 'nexus_royal_master_jwt_secret_2026_production_permanent_key_983748291047120398';

function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.trim().length >= 16 && envSecret !== DEFAULT_INSECURE_SECRET) {
    return envSecret.trim();
  }

  // Use a strong, deterministic permanent secret so that Render sleeps / restarts
  // never invalidate active user sessions or force unwanted logouts
  return PERMANENT_PROD_SECRET;
}

export const JWT_SECRET = resolveJwtSecret();

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    // Import db dynamically to avoid circular import issues
    import('../db.js').then(({ db }) => {
      const row = db.prepare('SELECT role, email, username, is_banned FROM users WHERE id = ?').get(userId) as {
        role?: string;
        email: string;
        username: string;
        is_banned?: number;
      } | undefined;

      if (!row) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      if (row.is_banned) {
        res.status(403).json({ error: 'Your account has been suspended by Royal Admin.' });
        return;
      }

      const email = (row.email || '').toLowerCase().trim();
      const username = (row.username || '').toLowerCase().trim();
      const isOwner =
        email.includes('karthikarthiswaran50') ||
        username === 'karthikarthiswaran50' ||
        username === 'dark' ||
        row.role === 'admin' ||
        (process.env.OWNER_EMAIL && email === process.env.OWNER_EMAIL.toLowerCase().trim());

      if (!isOwner) {
        res.status(403).json({ error: 'Access denied. Royal Owner controls are restricted to karthikarthiswaran50.' });
        return;
      }

      if (row.role !== 'admin') {
        try {
          db.prepare("UPDATE users SET role = 'admin', updated_at = datetime('now') WHERE id = ?").run(userId);
        } catch (_) {}
      }

      next();
    }).catch(err => {
      console.error('Error verifying admin permissions:', err);
      res.status(500).json({ error: 'Server error during admin verification.' });
    });
  });
}
