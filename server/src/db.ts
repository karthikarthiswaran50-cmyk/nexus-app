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

const isCloudPostgres = Boolean(
  process.env.NODE_ENV === 'production' ||
  databaseUrl?.includes('supabase.co') ||
  databaseUrl?.includes('supabase.com') ||
  databaseUrl?.includes('render.com') ||
  databaseUrl?.includes('sslmode=require')
);

export const pgPool: pg.Pool | null = isPostgres
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: isCloudPostgres ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // Short 5s timeout so server never hangs if Supabase is paused
    })
  : null;

if (pgPool) {
  // Prevent unhandled error events on idle clients from crashing Node.js process
  pgPool.on('error', (err: any) => {
    console.warn('⚠️ [PostgreSQL Pool] Client connection note (auto-handled):', err?.message || err);
  });
  const isSupabase = databaseUrl?.includes('supabase');
  console.log(`🐘 ${isSupabase ? 'Supabase' : 'PostgreSQL'} Database Pool initialized!`);
} else {
  console.log('📦 Local SQLite engine running (standalone mode).');
}

// Helper to ensure a column exists in an SQLite table
function ensureColumn(tableName: string, columnName: string, columnDef: string) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    const columnExists = tableInfo.some((col) => col.name === columnName);
    if (!columnExists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
    }
  } catch (e: any) {
    // Fallback try/catch in case PRAGMA fails or ALTER TABLE fails
    try {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
    } catch {}
  }
}

// ----------------------------------------------------
// Database Schema Initialization
// ----------------------------------------------------
export function initDatabase() {
  // 1. Core Tables Creation (with full schema)
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
      last_seen TEXT DEFAULT (datetime('now')),
      role TEXT DEFAULT 'user',
      is_banned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_end TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT NOT NULL DEFAULT 'dark',
      allow_calls_from TEXT NOT NULL DEFAULT 'everyone',
      notification_sound INTEGER NOT NULL DEFAULT 1,
      read_receipts INTEGER NOT NULL DEFAULT 1,
      auto_accept_calls INTEGER NOT NULL DEFAULT 0,
      who_can_call_me TEXT DEFAULT 'everyone',
      who_can_see_last_seen TEXT DEFAULT 'everyone',
      who_can_see_online_status TEXT DEFAULT 'everyone',
      who_can_see_profile_photo TEXT DEFAULT 'everyone',
      fcm_token TEXT
    );

    CREATE TABLE IF NOT EXISTS system_announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      author TEXT NOT NULL DEFAULT 'Royal Admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user2_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user1_id, user2_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      group_id TEXT,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      media_url TEXT,
      file_name TEXT,
      file_size INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0,
      reactions TEXT DEFAULT '{}',
      reply_to_id TEXT,
      reply_to_content TEXT,
      reply_to_sender TEXT,
      is_deleted_for_all INTEGER DEFAULT 0,
      deleted_for_users TEXT DEFAULT '[]',
      edited_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS blocked_users (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, blocked_user_id)
    );

    CREATE TABLE IF NOT EXISTS user_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_url TEXT,
      content TEXT DEFAULT '',
      background_color TEXT DEFAULT '#0f172a',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_views (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      viewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(story_id, viewer_id)
    );

    CREATE TABLE IF NOT EXISTS user_activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Safe idempotent column migrations for existing databases created before newer fields were added
  ensureColumn('users', 'last_seen', "TEXT DEFAULT (datetime('now'))");
  ensureColumn('users', 'role', "TEXT DEFAULT 'user'");
  ensureColumn('users', 'is_banned', 'INTEGER DEFAULT 0');

  ensureColumn('user_settings', 'fcm_token', 'TEXT');
  ensureColumn('user_settings', 'who_can_call_me', "TEXT DEFAULT 'everyone'");
  ensureColumn('user_settings', 'who_can_see_last_seen', "TEXT DEFAULT 'everyone'");
  ensureColumn('user_settings', 'who_can_see_online_status', "TEXT DEFAULT 'everyone'");
  ensureColumn('user_settings', 'who_can_see_profile_photo', "TEXT DEFAULT 'everyone'");

  ensureColumn('messages', 'group_id', 'TEXT');
  ensureColumn('messages', 'file_name', 'TEXT');
  ensureColumn('messages', 'file_size', 'INTEGER');
  ensureColumn('messages', 'reactions', "TEXT DEFAULT '{}'");
  ensureColumn('messages', 'reply_to_id', 'TEXT');
  ensureColumn('messages', 'reply_to_content', 'TEXT');
  ensureColumn('messages', 'reply_to_sender', 'TEXT');
  ensureColumn('messages', 'is_deleted_for_all', 'INTEGER DEFAULT 0');
  ensureColumn('messages', 'deleted_for_users', "TEXT DEFAULT '[]'");
  ensureColumn('messages', 'edited_at', 'TEXT');

  // 3. Performance & Integrity Indexes (created ONLY after all tables and columns are guaranteed to exist)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC);
    CREATE INDEX IF NOT EXISTS idx_call_logs_users ON call_logs(caller_id, receiver_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_started ON call_logs(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_blocked_users_pair ON blocked_users(user_id, blocked_user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON user_reports(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_user_activities_user ON user_activities(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action, created_at);
  `);

  // If PostgreSQL is configured, initialize remote tables and restore all saved users!
  if (pgPool) {
    initPostgresAndRestore();
  }
  purgeDemoData();
}

export async function wipeAllUsersOnce() {
  // Wipe logic permanently disabled to safeguard persistent user accounts and PostgreSQL data
  return;
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
        last_seen TIMESTAMPTZ DEFAULT NOW(),
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
        auto_accept_calls INT DEFAULT 0,
        fcm_token TEXT
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

      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned INT DEFAULT 0;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id VARCHAR(100);
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size INT;
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS who_can_call_me VARCHAR(50) DEFAULT 'everyone';
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS who_can_see_last_seen VARCHAR(50) DEFAULT 'everyone';
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS who_can_see_online_status VARCHAR(50) DEFAULT 'everyone';
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS who_can_see_profile_photo VARCHAR(50) DEFAULT 'everyone';

      CREATE TABLE IF NOT EXISTS groups (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        created_by VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS group_members (
        id VARCHAR(100) PRIMARY KEY,
        group_id VARCHAR(100) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS blocked_users (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, blocked_user_id)
      );

      CREATE TABLE IF NOT EXISTS user_reports (
        id VARCHAR(100) PRIMARY KEY,
        reporter_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reported_user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS system_announcements (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        author VARCHAR(100) DEFAULT 'Royal Admin',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_activities (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Helper for bulletproof ISO date conversion
    const toIsoSafe = (d: any) => {
      if (!d) return new Date().toISOString();
      try {
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
      } catch {
        return new Date().toISOString();
      }
    };

    // 2. Check if users exist in PostgreSQL
    const res = await pgPool.query('SELECT * FROM users');
    if (res.rows.length > 0) {
      console.log(`📥 Restoring ${res.rows.length} persistent users from PostgreSQL into local cache...`);

      for (const row of res.rows) {
        upsertUserToSqlite(row);
      }

      // Restore subscriptions
      try {
        const subRes = await pgPool.query('SELECT * FROM subscriptions');
        const insertSub = db.prepare(`
          INSERT OR REPLACE INTO subscriptions (id, user_id, plan_id, status, current_period_end, billing_cycle, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const sub of subRes.rows) {
          try {
            insertSub.run(
              sub.id,
              sub.user_id,
              sub.plan_id || 'free',
              sub.status || 'active',
              toIsoSafe(sub.current_period_end),
              sub.billing_cycle || 'monthly',
              toIsoSafe(sub.created_at)
            );
          } catch (_) {}
        }
      } catch (subErr: any) {
        console.warn('Subscriptions restore note:', subErr.message);
      }

      // Restore settings
      try {
        const setRes = await pgPool.query('SELECT * FROM user_settings');
        const insertSet = db.prepare(`
          INSERT OR REPLACE INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls, who_can_call_me, who_can_see_last_seen, who_can_see_online_status, who_can_see_profile_photo, fcm_token)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const st of setRes.rows) {
          try {
            insertSet.run(
              st.id,
              st.user_id,
              st.theme || 'dark',
              st.allow_calls_from || 'everyone',
              st.notification_sound ?? 1,
              st.read_receipts ?? 1,
              st.auto_accept_calls ?? 0,
              st.who_can_call_me || 'everyone',
              st.who_can_see_last_seen || 'everyone',
              st.who_can_see_online_status || 'everyone',
              st.who_can_see_profile_photo || 'everyone',
              st.fcm_token || null
            );
          } catch (_) {}
        }
      } catch (setErr: any) {
        console.warn('Settings restore note:', setErr.message);
      }

      // Restore push_subscriptions
      try {
        const pushRes = await pgPool.query('SELECT * FROM push_subscriptions');
        const insertPush = db.prepare(`
          INSERT OR REPLACE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const pr of pushRes.rows) {
          try {
            insertPush.run(pr.id, pr.user_id, pr.endpoint, pr.p256dh, pr.auth, toIsoSafe(pr.created_at));
          } catch (_) {}
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
// Safe Upsert to Local SQLite Cache
// ----------------------------------------------------
export function upsertUserToSqlite(row: any) {
  if (!row || !row.id || !row.username) return;
  const toIsoSafe = (d: any) => {
    if (!d) return new Date().toISOString();
    try {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  try {
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, username, password_hash, full_name, avatar_url, bio, status, country, last_seen, role, is_banned, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      row.id,
      row.email || '',
      row.username,
      row.password_hash || '',
      row.full_name || row.username,
      row.avatar_url || '',
      row.bio || '',
      row.status || '',
      row.country || 'Global',
      toIsoSafe(row.last_seen),
      row.role || 'user',
      row.is_banned ? 1 : 0,
      toIsoSafe(row.created_at),
      toIsoSafe(row.updated_at)
    );
  } catch (e: any) {
    console.warn(`Could not cache user ${row.id} into SQLite:`, e.message);
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
  last_seen?: string;
  role?: string;
  is_banned?: number;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO users (id, email, username, password_hash, full_name, avatar_url, bio, status, country, last_seen, role, is_banned)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       password_hash = CASE WHEN EXCLUDED.password_hash != '' THEN EXCLUDED.password_hash ELSE users.password_hash END,
       full_name = EXCLUDED.full_name,
       avatar_url = EXCLUDED.avatar_url,
       bio = EXCLUDED.bio,
       status = EXCLUDED.status,
       country = EXCLUDED.country,
       last_seen = COALESCE(EXCLUDED.last_seen, users.last_seen),
       role = COALESCE(EXCLUDED.role, users.role),
       is_banned = COALESCE(EXCLUDED.is_banned, users.is_banned),
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
      user.last_seen ? new Date(user.last_seen) : new Date(),
      user.role || 'user',
      user.is_banned || 0,
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
  who_can_call_me?: string;
  who_can_see_last_seen?: string;
  who_can_see_online_status?: string;
  who_can_see_profile_photo?: string;
  fcm_token?: string | null;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO user_settings (id, user_id, theme, allow_calls_from, notification_sound, read_receipts, auto_accept_calls, who_can_call_me, who_can_see_last_seen, who_can_see_online_status, who_can_see_profile_photo, fcm_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (user_id) DO UPDATE SET
       theme = EXCLUDED.theme,
       allow_calls_from = EXCLUDED.allow_calls_from,
       notification_sound = EXCLUDED.notification_sound,
       read_receipts = EXCLUDED.read_receipts,
       auto_accept_calls = EXCLUDED.auto_accept_calls,
       who_can_call_me = COALESCE(EXCLUDED.who_can_call_me, user_settings.who_can_call_me),
       who_can_see_last_seen = COALESCE(EXCLUDED.who_can_see_last_seen, user_settings.who_can_see_last_seen),
       who_can_see_online_status = COALESCE(EXCLUDED.who_can_see_online_status, user_settings.who_can_see_online_status),
       who_can_see_profile_photo = COALESCE(EXCLUDED.who_can_see_profile_photo, user_settings.who_can_see_profile_photo),
       fcm_token = COALESCE(EXCLUDED.fcm_token, user_settings.fcm_token)`,
    [
      st.id,
      st.user_id,
      st.theme,
      st.allow_calls_from,
      st.notification_sound,
      st.read_receipts,
      st.auto_accept_calls,
      st.who_can_call_me || 'everyone',
      st.who_can_see_last_seen || 'everyone',
      st.who_can_see_online_status || 'everyone',
      st.who_can_see_profile_photo || 'everyone',
      st.fcm_token || null
    ]
  ).catch(err => console.error('Error persisting settings to PostgreSQL:', err.message));
}

export function persistMessageToPg(msg: {
  id: string;
  conversation_id?: string | null;
  group_id?: string | null;
  sender_id: string;
  receiver_id?: string | null;
  content: string;
  type?: string;
  media_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  is_read?: number;
  edited_at?: string | null;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO messages (id, conversation_id, group_id, sender_id, receiver_id, content, type, media_url, file_name, file_size, is_read, edited_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       content = EXCLUDED.content,
       edited_at = EXCLUDED.edited_at,
       is_read = EXCLUDED.is_read`,
    [
      msg.id,
      msg.conversation_id || null,
      msg.group_id || null,
      msg.sender_id,
      msg.receiver_id || null,
      msg.content,
      msg.type || 'text',
      msg.media_url || null,
      msg.file_name || null,
      msg.file_size || null,
      msg.is_read || 0,
      msg.edited_at ? new Date(msg.edited_at) : null,
    ]
  ).catch(err => console.error('Error persisting message to PostgreSQL:', err.message));
}

export function persistGroupToPg(group: {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  created_by: string;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO groups (id, name, description, avatar_url, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       avatar_url = EXCLUDED.avatar_url`,
    [group.id, group.name, group.description || '', group.avatar_url || '', group.created_by]
  ).catch(err => console.error('Error persisting group to PostgreSQL:', err.message));
}

export function persistGroupMemberToPg(member: {
  id: string;
  group_id: string;
  user_id: string;
  role?: string;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO group_members (id, group_id, user_id, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (group_id, user_id) DO UPDATE SET
       role = EXCLUDED.role`,
    [member.id, member.group_id, member.user_id, member.role || 'member']
  ).catch(err => console.error('Error persisting group member to PostgreSQL:', err.message));
}

export function persistBlockToPg(block: {
  id: string;
  user_id: string;
  blocked_user_id: string;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO blocked_users (id, user_id, blocked_user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, blocked_user_id) DO NOTHING`,
    [block.id, block.user_id, block.blocked_user_id]
  ).catch(err => console.error('Error persisting block to PostgreSQL:', err.message));
}

export function persistReportToPg(report: {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  status: string;
}) {
  if (!pgPool) return;
  pgPool.query(
    `INSERT INTO user_reports (id, reporter_id, reported_user_id, reason, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       resolved_at = CASE WHEN EXCLUDED.status != 'pending' THEN NOW() ELSE NULL END`,
    [report.id, report.reporter_id, report.reported_user_id, report.reason, report.status]
  ).catch(err => console.error('Error persisting report to PostgreSQL:', err.message));
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
      WHERE id IN (${placeholders})
    `).run(...demoIds);

    if (result.changes > 0) {
      console.log(`🧹 Purged ${result.changes} demo / mock user accounts from database.`);
    }

    // Also purge from PostgreSQL if connected
    if (pgPool) {
      pgPool.query(`
        DELETE FROM users 
        WHERE id = ANY($1::varchar[])
      `, [demoIds]).catch(() => {});
    }
  } catch (err: any) {
    console.warn('purgeDemoData note:', err.message);
  }
}

export function recordActivity(userId: string, action: string, details: Record<string, any> = {}) {
  try {
    if (!userId) return;
    const id = 'act_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const detailsJson = typeof details === 'string' ? details : JSON.stringify(details || {});
    db.prepare(`
      INSERT INTO user_activities (id, user_id, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, action, detailsJson, now);

    if (pgPool) {
      pgPool.query(
        'INSERT INTO user_activities (id, user_id, action, details, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (id) DO NOTHING',
        [id, userId, action, detailsJson]
      ).catch(() => {});
    }
  } catch (err) {
    console.warn('recordActivity non-fatal error:', err);
  }
}

// ----------------------------------------------------
// Complete Permanent User Data Erasure (Google Play Requirement)
// ----------------------------------------------------
export async function purgeUserPermanently(userId: string): Promise<boolean> {
  try {
    if (!userId) return false;

    // 1. Clean up user media files from disk
    try {
      const userRow = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId) as any;
      if (userRow?.avatar_url && userRow.avatar_url.startsWith('/uploads/')) {
        const filePath = path.resolve(__dirname, '..', userRow.avatar_url.replace(/^\//, ''));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      const mediaRows = db.prepare('SELECT media_url FROM messages WHERE sender_id = ? AND media_url IS NOT NULL').all(userId) as any[];
      for (const m of mediaRows) {
        if (m.media_url && m.media_url.startsWith('/uploads/')) {
          const filePath = path.resolve(__dirname, '..', m.media_url.replace(/^\//, ''));
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      console.warn('Error purging user upload files:', e);
    }

    // 2. Delete SQLite records across all dependent and standalone tables
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_activities WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM story_views WHERE viewer_id = ?').run(userId);
    db.prepare('DELETE FROM stories WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_reports WHERE reporter_id = ? OR reported_user_id = ?').run(userId, userId);
    db.prepare('DELETE FROM blocked_users WHERE user_id = ? OR blocked_user_id = ?').run(userId, userId);
    db.prepare('DELETE FROM call_logs WHERE caller_id = ? OR receiver_id = ?').run(userId, userId);
    db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(userId, userId);
    db.prepare('DELETE FROM conversations WHERE user1_id = ? OR user2_id = ?').run(userId, userId);
    db.prepare('DELETE FROM group_members WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM groups WHERE created_by = ?').run(userId);
    db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    // 3. Permanently delete PostgreSQL records if connected
    if (pgPool) {
      try {
        await pgPool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
        await pgPool.query('DELETE FROM user_activities WHERE user_id = $1', [userId]);
        await pgPool.query('DELETE FROM user_reports WHERE reporter_id = $1 OR reported_user_id = $1', [userId, userId]);
        await pgPool.query('DELETE FROM blocked_users WHERE user_id = $1 OR blocked_user_id = $1', [userId, userId]);
        await pgPool.query('DELETE FROM call_logs WHERE caller_id = $1 OR receiver_id = $1', [userId, userId]);
        await pgPool.query('DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1', [userId, userId]);
        await pgPool.query('DELETE FROM conversations WHERE user1_id = $1 OR user2_id = $1', [userId, userId]);
        await pgPool.query('DELETE FROM group_members WHERE user_id = $1', [userId]);
        await pgPool.query('DELETE FROM groups WHERE created_by = $1', [userId]);
        await pgPool.query('DELETE FROM user_settings WHERE user_id = $1', [userId]);
        await pgPool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
        await pgPool.query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (pgErr) {
        console.error('Error purging user from PostgreSQL:', pgErr);
      }
    }

    console.log(`🗑️ Permanently purged user ${userId} and all related database records and media.`);
    return true;
  } catch (err: any) {
    console.error('purgeUserPermanently error:', err);
    return false;
  }
}


