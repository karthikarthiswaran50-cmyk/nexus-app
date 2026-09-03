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

import { initDatabase } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { setupSocket } from './socket.js';

import * as authCtrl from './controllers/auth.js';
import * as usersCtrl from './controllers/users.js';
import * as chatCtrl from './controllers/chat.js';
import * as callsCtrl from './controllers/calls.js';
import * as subsCtrl from './controllers/subscriptions.js';
import * as webrtcCtrl from './controllers/webrtc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB and Seed Data
initDatabase();

const app = express();

// Trust proxy for reverse proxies (Nginx / Render / Railway / Cloudflare)
app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for flexible media stream and avatar loading
    crossOriginEmbedderPolicy: false,
  })
);

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 minutes for login/register
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' },
});

// Uploads directory
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// Middleware
app.use(cors({ origin: '*', credentials: true }));

// Razorpay Webhook Endpoint
app.post(
  '/api/subscriptions/razorpay-webhook',
  express.json(),
  subsCtrl.razorpayWebhook
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

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
app.get('/api/auth/me', requireAuth, authCtrl.getMe);
app.post('/api/auth/update-password', requireAuth, authCtrl.updatePassword);

// 2. Users & Profile Routes
app.get('/api/users', requireAuth, apiLimiter, usersCtrl.getUsers);
app.get('/api/users/settings', requireAuth, usersCtrl.getSettings);
app.put('/api/users/settings', requireAuth, usersCtrl.updateSettings);
app.put('/api/users/profile', requireAuth, usersCtrl.updateProfile);
app.get('/api/users/:id', requireAuth, usersCtrl.getUserByIdOrUsername);

// 3. Chat Routes
app.get('/api/chat/conversations', requireAuth, chatCtrl.getConversations);
app.get('/api/chat/messages/:otherUserId', requireAuth, chatCtrl.getMessages);
app.post('/api/chat/send', requireAuth, chatCtrl.sendMessageHttp);
app.post('/api/chat/mark-read', requireAuth, chatCtrl.markRead);
app.post('/api/chat/upload', requireAuth, upload.single('file'), (req: any, res: any) => {
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
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
} else {
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

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
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
});
