import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'nexus.sqlite');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for performance and safety
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

export function initDatabase() {
  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Hey there! I am using Nexus.',
      country TEXT NOT NULL DEFAULT 'Global',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Subscriptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_end TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 3. User Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT NOT NULL DEFAULT 'dark',
      allow_calls_from TEXT NOT NULL DEFAULT 'everyone',
      notification_sound INTEGER NOT NULL DEFAULT 1,
      read_receipts INTEGER NOT NULL DEFAULT 1,
      auto_accept_calls INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 4. Conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user1_id, user2_id)
    );
  `);

  // 5. Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      media_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 6. Call logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      call_type TEXT NOT NULL DEFAULT 'video',
      status TEXT NOT NULL DEFAULT 'completed',
      duration INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );
  `);

  // 7. Subscription Invoices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'paid',
      invoice_number TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Indexes for high performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_users ON call_logs(caller_id, receiver_id);
  `);

  seedDefaultData();
}

function seedDefaultData() {
  const existingUsers = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (existingUsers && existingUsers.count > 0) {
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password123', salt);
  const now = new Date().toISOString();
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const seedUsers = [
    {
      id: 'usr_demo',
      email: 'demo@nexus.app',
      username: 'demo_user',
      full_name: 'Alex Rivera',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      bio: 'Digital nomad, creator & technology enthusiast.',
      status: 'Available for quick calls ☕',
      country: 'United States',
      plan: 'pro',
      period_end: nextMonth,
    },
    {
      id: 'usr_elena',
      email: 'elena@nexus.app',
      username: 'elena_ux',
      full_name: 'Elena Rostova',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
      bio: 'Lead Product Designer at Studio Matrix. Specializing in WebRTC and UI systems.',
      status: 'In design review 🎨',
      country: 'Sweden',
      plan: 'pro',
      period_end: nextMonth,
    },
    {
      id: 'usr_marcus',
      email: 'marcus@nexus.app',
      username: 'marcus_dev',
      full_name: 'Marcus Chen',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      bio: 'Real-time distributed systems engineer. Audio & Video protocol hacker.',
      status: 'Coding high performance WebRTC 🚀',
      country: 'Singapore',
      plan: 'vip',
      period_end: nextYear,
    },
    {
      id: 'usr_sophia',
      email: 'sophia@nexus.app',
      username: 'sophia_ai',
      full_name: 'Sophia Taylor',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
      bio: 'AI researcher and remote team orchestrator. Always excited to connect!',
      status: 'Exploring generative voice models 🎙️',
      country: 'Canada',
      plan: 'free',
      period_end: nextMonth,
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, username, password_hash, full_name, avatar_url, bio, status, country, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSub = db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSettings = db.prepare(`
    INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of seedUsers) {
    insertUser.run(u.id, u.email, u.username, passwordHash, u.full_name, u.avatar_url, u.bio, u.status, u.country, now, now);
    insertSub.run(`sub_${u.id}`, u.id, u.plan, 'active', u.period_end, 'monthly', now);
    insertSettings.run(`set_${u.id}`, u.id, 'dark', 'everyone', 1, 1, 0);
  }

  // Seed sample conversation between Alex (demo) and Elena
  const insertConv = db.prepare(`
    INSERT INTO conversations (id, user1_id, user2_id, last_message_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const convId1 = 'conv_demo_elena';
  insertConv.run(convId1, 'usr_demo', 'usr_elena', now, now);

  insertMsg.run('msg_1', convId1, 'usr_elena', 'usr_demo', 'Hey Alex! Ready to test the new HD video and audio calling features?', 'text', 1, new Date(Date.now() - 3600000).toISOString());
  insertMsg.run('msg_2', convId1, 'usr_demo', 'usr_elena', 'Hi Elena! Yes, let us start a video call right now to verify the WebRTC connection!', 'text', 1, new Date(Date.now() - 1800000).toISOString());
  insertMsg.run('msg_3', convId1, 'usr_elena', 'usr_demo', 'Awesome! Feel free to click the video or audio call button at the top right of this chat anytime.', 'text', 0, new Date(Date.now() - 600000).toISOString());

  // Seed conversation between Alex and Marcus
  const convId2 = 'conv_demo_marcus';
  insertConv.run(convId2, 'usr_demo', 'usr_marcus', now, now);
  insertMsg.run('msg_4', convId2, 'usr_marcus', 'usr_demo', 'Welcome to Nexus VIP Tier! Let me know if you need any screen sharing or low-latency audio setups.', 'text', 1, new Date(Date.now() - 86400000).toISOString());

  // Seed sample call logs
  const insertCallLog = db.prepare(`
    INSERT INTO call_logs (id, caller_id, receiver_id, call_type, status, duration, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCallLog.run('call_1', 'usr_elena', 'usr_demo', 'video', 'completed', 342, new Date(Date.now() - 7200000).toISOString(), new Date(Date.now() - 7200000 + 342000).toISOString());
  insertCallLog.run('call_2', 'usr_demo', 'usr_marcus', 'audio', 'completed', 185, new Date(Date.now() - 90000000).toISOString(), new Date(Date.now() - 90000000 + 185000).toISOString());
  insertCallLog.run('call_3', 'usr_sophia', 'usr_demo', 'video', 'missed', 0, new Date(Date.now() - 120000000).toISOString(), new Date(Date.now() - 120000000).toISOString());
}
