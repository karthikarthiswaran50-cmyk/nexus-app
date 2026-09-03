/**
 * Security & Sanitization Utilities
 * Protects against XSS (Cross-Site Scripting), HTML injection, and malicious payloads.
 */

export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

export function sanitizeUsername(username: unknown): string {
  if (typeof username !== 'string') return '';
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 30);
}

export function sanitizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email
    .trim()
    .toLowerCase()
    .substring(0, 100);
}

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long for security.' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one letter.' };
  }
  if (!/[0-9]/.test(password) && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one number or special character.' };
  }
  const commonWeak = ['password', '12345678', 'admin123', 'qwerty123', 'nexus123'];
  if (commonWeak.includes(password.toLowerCase())) {
    return { valid: false, reason: 'This password is too common and easily guessed. Please use a stronger password.' };
  }
  return { valid: true };
}
