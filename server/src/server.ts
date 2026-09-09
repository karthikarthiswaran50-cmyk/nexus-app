import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';

import { initDatabase, db } from './db.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { setupSocket } from './socket.js';

import * as authCtrl from './controllers/auth.js';
import * as usersCtrl from './controllers/users.js';
import * as chatCtrl from './controllers/chat.js';
import * as callsCtrl from './controllers/calls.js';
import * as subsCtrl from './controllers/subscriptions.js';
import * as webrtcCtrl from './controllers/webrtc.js';
import * as storiesCtrl from './controllers/stories.js';
import * as adminCtrl from './controllers/admin.js';
import { getVapidPublicKey, savePushSubscription, sendPushToUser } from './services/webpush.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB and Seed Data
initDatabase();

const app = express();

// Disable x-powered-by header to prevent fingerprinting
app.disable('x-powered-by');

// Trust proxy for reverse proxies (Nginx / Render / Railway / Cloudflare)
app.set('trust proxy', 1);

// Production-Grade Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'sameorigin' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

// Rate Limiting (Anti-DDoS & Brute-Force Protection)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded: Too many requests. Please try again in 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 login/register attempts per 15 minutes (strictly blocks brute-force bots)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Security Alert: Too many authentication attempts. Please wait 15 minutes.' },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // Max 15 payment checkout operations per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for payment operations.' },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Max 30 upload requests per 15 minutes per IP (prevents storage & network DoS)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached. Please wait a few minutes before uploading more media.' },
});

// Uploads directory
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Strict Whitelist for Safe Uploads (Prevents script injection & executable exploits)
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/webm',
  'audio/ogg',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',   // iOS Safari
  'audio/aac',   // iOS Safari alternative
  'video/webm',
  'video/mp4',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.webm',
  '.ogg',
  '.mp3',
  '.wav',
  '.mp4',
  '.aac',
]);

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
    const uniqueName = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${cleanExt}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB maximum limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Security violation: Dangerous or unauthorized file format detected.'));
    }
    cb(null, true);
  },
});

// Dynamic Origin Security for CORS & Socket.IO
const rawCorsOrigin = process.env.CORS_ORIGIN;
const allowedOrigins = rawCorsOrigin
  ? rawCorsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow mobile apps, curl, native web workers, same-server requests without Origin header
  if (!origin) return true;

  // In non-production, allow all local origins
  if (process.env.NODE_ENV !== 'production') return true;

  // Always allow configured origins
  if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) return true;

  // Allow Render deployed domains and custom domains (e.g., nexusroyal.online)
  if (origin.endsWith('.onrender.com') || origin.includes('nexusroyal') || origin.includes('nuxesroyal')) return true;

  // Allow localhost even in production if testing
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;

  // If no explicit whitelist is defined in production, allow same-origin requests
  return allowedOrigins.length === 0;
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS Security Violation: Origin ${origin} is not allowed.`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Razorpay Webhook Endpoint
app.post(
  '/api/subscriptions/razorpay-webhook',
  express.json(),
  subsCtrl.razorpayWebhook
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Strict static file security headers (prevents script execution & XSS in upload directory)
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    next();
  },
  express.static(uploadsDir)
);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// 1. Auth Routes (Rate limited)
app.post('/api/auth/register', authLimiter, authCtrl.register);
app.post('/api/auth/login', authLimiter, authCtrl.login);
app.post('/api/auth/firebase-login', authLimiter, authCtrl.firebaseLogin);
app.get('/api/auth/me', requireAuth, authCtrl.getMe);
app.post('/api/auth/set-username', requireAuth, authCtrl.setUsername);
app.post('/api/auth/update-password', requireAuth, authCtrl.updatePassword);

// 2. Users & Profile Routes
app.get('/api/users', requireAuth, apiLimiter, usersCtrl.getUsers);
app.get('/api/users/check-username/:username', usersCtrl.checkUsernameAvailable);
app.get('/api/users/settings', requireAuth, usersCtrl.getSettings);
app.put('/api/users/settings', requireAuth, usersCtrl.updateSettings);
app.put('/api/users/profile', requireAuth, usersCtrl.updateProfile);
app.post('/api/users/avatar', requireAuth, uploadLimiter, upload.single('avatar'), usersCtrl.uploadAvatar);
app.post('/api/users/fcm-token', requireAuth, usersCtrl.updateFcmToken);
app.get('/api/users/:id', requireAuth, usersCtrl.getUserByIdOrUsername);

// Stories & Status Routes (24-Hour Stories)
app.get('/api/stories', requireAuth, storiesCtrl.getActiveStories);
app.post('/api/stories', requireAuth, uploadLimiter, upload.single('media'), storiesCtrl.createStory);
app.post('/api/stories/:id/view', requireAuth, storiesCtrl.viewStory);
app.delete('/api/stories/:id', requireAuth, storiesCtrl.deleteStory);

// WebRTC ICE Configuration Endpoint
app.get('/api/webrtc/config', (_req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:80?transport=tcp',
          'turn:openrelay.metered.ca:443',
          'turns:openrelay.metered.ca:443?transport=tcp',
          'turns:openrelay.metered.ca:5349',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: [
          'turn:global.relay.metered.ca:80',
          'turn:global.relay.metered.ca:80?transport=tcp',
          'turn:global.relay.metered.ca:443',
          'turns:global.relay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
  });
});

// Push Notification & VAPID Endpoints
app.get('/api/notifications/vapid-public-key', (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.post('/api/notifications/subscribe', requireAuth, (req: any, res) => {
  const userId = req.user?.userId;
  const { subscription } = req.body;
  if (!userId || !subscription) {
    return res.status(400).json({ error: 'Missing subscription details' });
  }
  savePushSubscription(userId, subscription);
  console.log(`✅ Push subscription saved for user ${userId}: ${subscription.endpoint?.slice(0, 60)}...`);
  res.json({ success: true, message: 'Web Push subscription registered' });
});


app.post('/api/notifications/test', requireAuth, async (req: any, res) => {
  const userId = req.user?.userId;
  const { type = 'message' } = req.body;
  const isCall = type === 'call';

  const sent = await sendPushToUser(
    userId,
    {
      notification: {
        title: isCall ? '📞 Incoming Call (Test)' : '💬 Nexus Royal Alert (Test)',
        body: isCall
          ? 'Nexus Royal is calling your device. Background ringing is active!'
          : '👑 Push notifications and vibration are working smoothly!',
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
      },
      data: {
        type: isCall ? 'call' : 'message',
        callType: 'video',
        callerName: 'Nexus Royal Tester',
        tag: isCall ? 'nexus-incoming-call' : 'nexus-chat-message',
        url: '/',
      },
    },
    isCall
  );

  res.json({ success: true, delivered: sent });
});

// Debug: List push subscriptions for current user (dev only)
app.get('/api/notifications/subscriptions', requireAuth, (req: any, res) => {
  const userId = req.user?.userId;
  try {
    const subs = db.prepare('SELECT id, endpoint, created_at FROM push_subscriptions WHERE user_id = ?').all(userId);
    const settings = db.prepare('SELECT fcm_token FROM user_settings WHERE user_id = ?').get(userId) as any;
    res.json({
      userId,
      webPushSubscriptions: subs.length,
      hasFcmToken: !!settings?.fcm_token,
      subscriptions: subs.map((s: any) => ({
        id: s.id,
        endpointPrefix: s.endpoint?.slice(0, 60) + '...',
        createdAt: s.created_at,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2.5 Stories Routes
app.get('/api/stories', requireAuth, storiesCtrl.getActiveStories);
app.post('/api/stories', requireAuth, uploadLimiter, upload.single('media'), storiesCtrl.createStory);
app.post('/api/stories/:id/view', requireAuth, storiesCtrl.viewStory);
app.get('/api/stories/:id/viewers', requireAuth, storiesCtrl.getStoryViewers);
app.delete('/api/stories/:id', requireAuth, storiesCtrl.deleteStory);

// 3. Chat Routes
app.get('/api/chat/conversations', requireAuth, chatCtrl.getConversations);
app.get('/api/chat/messages/:otherUserId', requireAuth, chatCtrl.getMessages);
app.post('/api/chat/send', requireAuth, chatCtrl.sendMessageHttp);
app.post('/api/chat/mark-read', requireAuth, chatCtrl.markRead);
app.post('/api/chat/upload', requireAuth, uploadLimiter, upload.single('file'), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// 4. Calls Routes
app.get('/api/calls/history', requireAuth, callsCtrl.getCallHistory);
app.post('/api/calls/log', requireAuth, callsCtrl.createCallLogHttp);

// 5. WebRTC ICE Server Discovery & TURN Configuration
app.get('/api/webrtc/config', webrtcCtrl.getWebRtcConfig);

// 6. Subscriptions & Razorpay Payment Routes
app.get('/api/subscriptions/plans', subsCtrl.getPlans);
app.get('/api/subscriptions/current', requireAuth, subsCtrl.getCurrentSubscription);
app.post('/api/subscriptions/subscribe', requireAuth, subsCtrl.subscribePlan);
app.post('/api/subscriptions/cancel', requireAuth, subsCtrl.cancelSubscription);
app.post('/api/subscriptions/create-razorpay-order', requireAuth, subsCtrl.createRazorpayOrderHttp);
app.post('/api/subscriptions/verify-payment', requireAuth, subsCtrl.verifyRazorpayPaymentHttp);

// 6.5 Royal Owner & Admin Control Routes
app.get('/api/admin/stats', requireAdmin, adminCtrl.getAdminStats);
app.get('/api/admin/users', requireAdmin, adminCtrl.getAdminUsers);
app.post('/api/admin/users/:id/ban', requireAdmin, adminCtrl.toggleUserBan);
app.post('/api/admin/users/:id/role', requireAdmin, adminCtrl.updateUserRole);
app.delete('/api/admin/users/:id', requireAdmin, adminCtrl.deleteUserAdmin);
app.post('/api/admin/broadcast', requireAdmin, adminCtrl.broadcastAnnouncement);
app.get('/api/admin/announcements', requireAuth, adminCtrl.getAnnouncements);
app.post('/api/admin/claim', requireAuth, adminCtrl.claimOwnerRole);
app.post('/api/admin/change-passcode', requireAdmin, adminCtrl.changeOwnerPasscode);

// 7. Serve static client in production (with multi-path fallback for local, Render, and Docker)
const candidateDistPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(__dirname, './client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
];
const clientDistDir = candidateDistPaths.find((dirPath) => fs.existsSync(dirPath));

if (clientDistDir) {
  console.log(`🚀 Serving static web client from: ${clientDistDir}`);
  app.use(express.static(clientDistDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'API route not found' });
      return;
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
} else {
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });
  console.warn('⚠️ Warning: client/dist not found. Please run `npm run build:client`.');
}

// 8. Server Protocol Setup (HTTPS or HTTP)
const isHttps = process.env.HTTPS_ENABLED === 'true';
const sslKeyPath = process.env.SSL_KEY_PATH || path.resolve(__dirname, '../certs/server.key');
const sslCertPath = process.env.SSL_CERT_PATH || path.resolve(__dirname, '../certs/server.cert');

let server: http.Server | https.Server;

if (isHttps && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const options = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  };
  server = https.createServer(options, app);
  console.log('🔒 HTTPS Server Mode Enabled with SSL certificates');
} else {
  server = http.createServer(app);
}

// Initialize Socket.io with strict origin security
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Socket.IO CORS policy violation: Origin not allowed'), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Nexus Production Server running on ${isHttps ? 'https' : 'http'}://localhost:${PORT}`);
  console.log(`📡 WebSocket / WebRTC Signaling Gateway ready`);

  // 🤖 24/7 Keep-Alive Robot: Pings external URL every 10 minutes to prevent Render idle sleep
  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || 'https://nexusroyal.online';
  if (process.env.NODE_ENV === 'production' && keepAliveUrl) {
    console.log(`🤖 [Keep-Alive Robot]: Activated. Pinging ${keepAliveUrl} every 10 minutes to prevent sleep.`);
    setInterval(async () => {
      try {
        const pingUrl = `${keepAliveUrl.replace(/\/$/, '')}/api/health`;
        const res = await fetch(pingUrl);
        console.log(`🤖 [Keep-Alive Robot]: Ping sent to ${pingUrl} - Status: ${res.status}`);
      } catch (err: any) {
        console.warn(`🤖 [Keep-Alive Robot]: Ping attempt:`, err.message);
      }
    }, 10 * 60 * 1000); // 10 minutes
  }
});
