import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types.js';

import crypto from 'node:crypto';

const DEFAULT_INSECURE_SECRET = 'nexus_ultra_secure_jwt_secret_key_2026';

function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.trim().length >= 16 && envSecret !== DEFAULT_INSECURE_SECRET) {
    return envSecret.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '⚠️ [SECURITY ALERT]: No strong JWT_SECRET provided in production environment variables! ' +
      'Generating an ephemeral cryptographically-secure 256-bit secret for this session to prevent token forgery attacks. ' +
      'Please set a permanent JWT_SECRET in your Render Dashboard.'
    );
    return crypto.randomBytes(32).toString('hex');
  }

  return DEFAULT_INSECURE_SECRET;
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
