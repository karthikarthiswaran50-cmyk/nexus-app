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
      auto_accept_calls INTEGER NOT NULL DEFAULT 0,
      fcm_token TEXT
    );
  `);

  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN fcm_token TEXT;`);
  } catch (e) {}

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

  // Migrations for new features: reactions, reply_to, delete, and last_seen
  try { db.exec(`ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT '{}';`); } catch (e) {}
  try { db.exec(`ALTER TABLE messages ADD COLUMN reply_to_id TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE messages ADD COLUMN reply_to_content TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE messages ADD COLUMN reply_to_sender TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE messages ADD COLUMN is_deleted_for_all INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE messages ADD COLUMN deleted_for_users TEXT DEFAULT '[]';`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN last_seen TEXT DEFAULT (datetime('now'));`); } catch (e) {}

  // 8. Stories Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_url TEXT,
      content TEXT DEFAULT '',
      background_color TEXT DEFAULT '#0f172a',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, expires_at);
  `);

  // 9. Story Views Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS story_views (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(story_id, viewer_id)
    );
  `);

  // Ensure Nexus AI official bot user exists
  ensureNexusAiBot();

  // If PostgreSQL is configured, initialize remote tables and restore all saved users!
  if (pgPool) {
    initPostgresAndRestore();
  }
  purgeDemoData();
}

function ensureNexusAiBot() {
  try {
    const aiId = 'user_nexus_ai';
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(aiId);
    if (!existing) {
      db.prepare(`
        INSERT INTO users (id, email, username, password_hash, full_name, avatar_url, bio, status, country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        aiId,
        'ai@nexusroyal.online',
        'nexus_ai',
        '$2a$10$wN3r9KqV0VfG711E81uT7.Hl4G3jAeqOqm1dO8C6J5i9L6NqT.q2K', // unusable hash
        'Nexus AI Assistant 🤖',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
        'Official Nexus Royal Intelligent Assistant. Ask me anything, generate ideas, or chat 24/7!',
        '⚡ Online 24/7 to assist you',
        'Nexus Royal'
      );
      // Give VIP subscription
      db.prepare(`
        INSERT OR REPLACE INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle)
        VALUES (?, ?, 'vip', 'active', datetime('now', '+10 years'), 'yearly')
      `).run('sub_ai', aiId);
    }
  } catch (err) {
    console.error('Error ensuring Nexus AI bot user:', err);
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

      // Restore push_subscriptions
      try {
        const pushRes = await pgPool.query('SELECT * FROM push_subscriptions');
        const insertPush = db.prepare(`
          INSERT OR REPLACE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const pr of pushRes.rows) {
          insertPush.run(pr.id, pr.user_id, pr.endpoint, pr.p256dh, pr.auth, new Date(pr.created_at).toISOString());
        }
      } catch (e) {}

      console.log('✅ PostgreSQL database restored successfully! User sessions, accounts, and push subscriptions are intact.');
    } else {
      console.log('🌱 PostgreSQL is empty. Ready for authentic user registrations.');
      purgeDemoData();
    }
  } catch (err) {
    console.error('⚠️ PostgreSQL sync error, operating in local fallback mode:', err);
    purgeDemoData();
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
// Purge Demo & Mock Data Permanently
// ----------------------------------------------------
export function purgeDemoData() {
  try {
    const demoIds = ['usr_demo', 'usr_elena', 'usr_marcus', 'usr_sophia', 'usr_p86aahqcmtk12r5k'];
    const placeholders = demoIds.map(() => '?').join(',');

    // Delete conversations involving demo users
    db.prepare(`
      DELETE FROM conversations 
      WHERE user1_id IN (${placeholders}) OR user2_id IN (${placeholders})
    `).run(...demoIds, ...demoIds);

    // Delete call logs involving demo users
    db.prepare(`
      DELETE FROM call_logs 
      WHERE caller_id IN (${placeholders}) OR receiver_id IN (${placeholders})
    `).run(...demoIds, ...demoIds);

    // Delete push subscriptions & settings for demo users
    db.prepare(`
      DELETE FROM user_settings 
      WHERE user_id IN (${placeholders})
    `).run(...demoIds);

    db.prepare(`
      DELETE FROM subscriptions 
      WHERE user_id IN (${placeholders})
    `).run(...demoIds);

    // Finally delete demo users
    const result = db.prepare(`
      DELETE FROM users 
      WHERE id IN (${placeholders}) OR email LIKE '%@nexus.app'
    `).run(...demoIds);

    if (result.changes > 0) {
      console.log(`🧹 Purged ${result.changes} demo / mock user accounts from database.`);
    }

    // Also purge from PostgreSQL if connected
    if (pgPool) {
      pgPool.query(`
        DELETE FROM users 
        WHERE id = ANY($1::varchar[]) OR email LIKE '%@nexus.app'
      `, [demoIds]).catch(() => {});
    }
  } catch (err: any) {
    console.warn('purgeDemoData note:', err.message);
  }
}

