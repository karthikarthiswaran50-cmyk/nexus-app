import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'nexus.sqlite');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for SQLite performance
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// ----------------------------------------------------
// Persistent PostgreSQL Connection Pool (Render / Cloud)
// ----------------------------------------------------
const databaseUrl = process.env.DATABASE_URL;
const isPostgres = !!(databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')));

export const pgPool: pg.Pool | null = isPostgres
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' || databaseUrl?.includes('render.com') ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
    })
  : null;

if (pgPool) {
  console.log('🐘 PostgreSQL Database Pool connected for permanent storage!');
} else {
  console.log('📦 Local SQLite engine running (standalone mode).');
}

// ----------------------------------------------------
// Database Schema Initialization
// ----------------------------------------------------
export function initDatabase() {
  // 1. Users table (SQLite)
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
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'paid',
      invoice_number TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // SQLite Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_users ON call_logs(caller_id, receiver_id);
  `);

  // If PostgreSQL is configured, initialize remote tables and restore all saved users!
  if (pgPool) {
    initPostgresAndRestore();
  } else {
    seedDefaultData();
  }
}

// ----------------------------------------------------
// PostgreSQL Persistent Tables & Bidirectional Restore
// ----------------------------------------------------
async function initPostgresAndRestore() {
  if (!pgPool) return;

  try {
    // 1. Create PostgreSQL tables
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        avatar_url TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        status VARCHAR(255) DEFAULT 'Hey there! I am using Nexus.',
        country VARCHAR(100) DEFAULT 'Global',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id VARCHAR(50) DEFAULT 'free',
        status VARCHAR(50) DEFAULT 'active',
        current_period_end TIMESTAMPTZ NOT NULL,
        billing_cycle VARCHAR(20) DEFAULT 'monthly',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        theme VARCHAR(20) DEFAULT 'dark',
        allow_calls_from VARCHAR(50) DEFAULT 'everyone',
        notification_sound INT DEFAULT 1,
        read_receipts INT DEFAULT 1,
        auto_accept_calls INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(100) PRIMARY KEY,
        user1_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user2_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user1_id, user2_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(100) PRIMARY KEY,
        conversation_id VARCHAR(100) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'text',
        media_url TEXT,
        is_read INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS call_logs (
        id VARCHAR(100) PRIMARY KEY,
        caller_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        call_type VARCHAR(20) DEFAULT 'video',
        status VARCHAR(50) DEFAULT 'completed',
        duration INT DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ
      );
    `);

    // 2. Check if users exist in PostgreSQL
    const res = await pgPool.query('SELECT * FROM users');
    if (res.rows.length > 0) {
      console.log(`📥 Restoring ${res.rows.length} persistent users from PostgreSQL into local cache...`);
      
      const insertUser = db.prepare(`
        INSERT OR REPLACE INTO users (id, email, username, password_hash, full_name, avatar_url, bio, status, country, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of res.rows) {
        insertUser.run(
          row.id,
          row.email,
          row.username,
          row.password_hash,
          row.full_name,
          row.avatar_url || '',
          row.bio || '',
          row.status || '',
          row.country || 'Global',
          new Date(row.created_at).toISOString(),
          new Date(row.updated_at).toISOString()
        );
      }

      // Restore subscriptions
      const subRes = await pgPool.query('SELECT * FROM subscriptions');
      const insertSub = db.prepare(`
        INSERT OR REPLACE INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const sub of subRes.rows) {
        insertSub.run(
          sub.id,
          sub.user_id,
          sub.plan_id,
          sub.status,
          new Date(sub.current_period_end).toISOString(),
          sub.billing_cycle,
          new Date(sub.created_at).toISOString()
        );
      }

      // Restore settings
      const setRes = await pgPool.query('SELECT * FROM user_settings');
      const insertSet = db.prepare(`
        INSERT OR REPLACE INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const st of setRes.rows) {
        insertSet.run(st.id, st.user_id, st.theme, st.allow_calls_from, st.notification_sound, st.read_receipts, st.auto_accept_calls);
      }

      console.log('✅ PostgreSQL database restored successfully! User sessions and accounts are intact.');
    } else {
      console.log('🌱 PostgreSQL is empty. Seeding initial accounts into PostgreSQL and local database...');
      seedDefaultData();
      await syncAllToPostgres();
    }
  } catch (err) {
    console.error('⚠️ PostgreSQL sync error, operating in local fallback mode:', err);
    seedDefaultData();
  }
}

// ----------------------------------------------------
// Persistent Asynchronous Sync to PostgreSQL
// ----------------------------------------------------
export function persistUserToPg(user: {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  status?: string;
  country?: string;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO users (id, email, username, password_hash, full_name, avatar_url, bio, status, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       avatar_url = EXCLUDED.avatar_url,
       bio = EXCLUDED.bio,
       status = EXCLUDED.status,
       country = EXCLUDED.country,
       updated_at = NOW()`,
    [
      user.id,
      user.email,
      user.username,
      user.password_hash,
      user.full_name,
      user.avatar_url || '',
      user.bio || '',
      user.status || '',
      user.country || 'Global',
    ]
  ).catch(err => console.error('Error persisting user to PostgreSQL:', err.message));
}

export function persistSubscriptionToPg(sub: {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  billing_cycle: string;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       billing_cycle = EXCLUDED.billing_cycle`,
    [sub.id, sub.user_id, sub.plan_id, sub.status, sub.current_period_end, sub.billing_cycle]
  ).catch(err => console.error('Error persisting subscription to PostgreSQL:', err.message));
}

export function persistSettingsToPg(st: {
  id: string;
  user_id: string;
  theme: string;
  allow_calls_from: string;
  notification_sound: number;
  read_receipts: number;
  auto_accept_calls: number;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       theme = EXCLUDED.theme,
       allow_calls_from = EXCLUDED.allow_calls_from,
       notification_sound = EXCLUDED.notification_sound,
       read_receipts = EXCLUDED.read_receipts,
       auto_accept_calls = EXCLUDED.auto_accept_calls`,
    [st.id, st.user_id, st.theme, st.allow_calls_from, st.notification_sound, st.read_receipts, st.auto_accept_calls]
  ).catch(err => console.error('Error persisting settings to PostgreSQL:', err.message));
}

export function persistMessageToPg(msg: {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type?: string;
  media_url?: string;
  is_read?: number;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, type, media_url, is_read)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [msg.id, msg.conversation_id, msg.sender_id, msg.receiver_id, msg.content, msg.type || 'text', msg.media_url || null, msg.is_read || 0]
  ).catch(err => console.error('Error persisting message to PostgreSQL:', err.message));
}

export function persistCallLogToPg(call: {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: string;
  status: string;
  duration: number;
  started_at: string;
  ended_at?: string;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO call_logs (id, caller_id, receiver_id, call_type, status, duration, started_at, ended_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [call.id, call.caller_id, call.receiver_id, call.call_type, call.status, call.duration, call.started_at, call.ended_at || null]
  ).catch(err => console.error('Error persisting call log to PostgreSQL:', err.message));
}

async function syncAllToPostgres() {
  if (!pgPool) return;
  try {
    const allUsers = db.prepare('SELECT * FROM users').all() as any[];
    for (const u of allUsers) {
      persistUserToPg(u);
    }
    const allSubs = db.prepare('SELECT * FROM subscriptions').all() as any[];
    for (const s of allSubs) {
      persistSubscriptionToPg(s);
    }
    const allSettings = db.prepare('SELECT * FROM user_settings').all() as any[];
    for (const st of allSettings) {
      persistSettingsToPg(st);
    }
  } catch (e) {}
}

// ----------------------------------------------------
// Default Seeding
// ----------------------------------------------------
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
    INSERT OR REPLACE INTO users (id, email, username, password_hash, full_name, avatar_url, bio, status, country, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSub = db.prepare(`
    INSERT OR REPLACE INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSettings = db.prepare(`
    INSERT OR REPLACE INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of seedUsers) {
    insertUser.run(u.id, u.email, u.username, passwordHash, u.full_name, u.avatar_url, u.bio, u.status, u.country, now, now);
    insertSub.run(`sub_${u.id}`, u.id, u.plan, 'active', u.period_end, 'monthly', now);
    insertSettings.run(`set_${u.id}`, u.id, 'dark', 'everyone', 1, 1, 0);
  }

  // Seed sample conversation between Alex (demo) and Elena
  const insertConv = db.prepare(`
    INSERT OR REPLACE INTO conversations (id, user1_id, user2_id, last_message_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMsg = db.prepare(`
    INSERT OR REPLACE INTO messages (id, conversation_id, sender_id, receiver_id, content, type, is_read, created_at)
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
    INSERT OR REPLACE INTO call_logs (id, caller_id, receiver_id, call_type, status, duration, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCallLog.run('call_1', 'usr_elena', 'usr_demo', 'video', 'completed', 342, new Date(Date.now() - 7200000).toISOString(), new Date(Date.now() - 7200000 + 342000).toISOString());
  insertCallLog.run('call_2', 'usr_demo', 'usr_marcus', 'audio', 'completed', 185, new Date(Date.now() - 90000000).toISOString(), new Date(Date.now() - 90000000 + 185000).toISOString());
  insertCallLog.run('call_3', 'usr_sophia', 'usr_demo', 'video', 'missed', 0, new Date(Date.now() - 120000000).toISOString(), new Date(Date.now() - 120000000).toISOString());
}
