import { Request, Response } from 'express';
import { db, recordActivity, persistCallLogToPg, pgPool } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getUserWithPlan } from './auth.js';
import { CallLog } from '../types.js';

export async function getCallHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let rows = (db.prepare(`
      SELECT * FROM call_logs
      WHERE caller_id = ? OR receiver_id = ?
      ORDER BY started_at DESC
      LIMIT 100
    `).all(userId, userId) as unknown) as CallLog[];

    // If SQLite cache has no rows and PostgreSQL is active, query PostgreSQL as fallback
    if (rows.length === 0 && pgPool) {
      try {
        const pgRes = await pgPool.query(`
          SELECT * FROM call_logs
          WHERE caller_id = $1 OR receiver_id = $1
          ORDER BY started_at DESC
          LIMIT 100
        `, [userId]);
        if (pgRes.rows.length > 0) {
          const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO call_logs (id, caller_id, receiver_id, call_type, status, duration, started_at, ended_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const r of pgRes.rows) {
            insertStmt.run(
              r.id,
              r.caller_id,
              r.receiver_id,
              r.call_type || 'video',
              r.status || 'completed',
              r.duration || 0,
              r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString(),
              r.ended_at ? new Date(r.ended_at).toISOString() : null
            );
          }
          rows = (db.prepare(`
            SELECT * FROM call_logs
            WHERE caller_id = ? OR receiver_id = ?
            ORDER BY started_at DESC
            LIMIT 100
          `).all(userId, userId) as unknown) as CallLog[];
        }
      } catch (pgErr: any) {
        console.warn('Call history PostgreSQL fallback note:', pgErr?.message);
      }
    }

    const callLogs = rows.map((log) => ({
      ...log,
      caller: getUserWithPlan(log.caller_id) || undefined,
      receiver: getUserWithPlan(log.receiver_id) || undefined,
    }));

    res.json({ callLogs });
  } catch (error) {
    console.error('getCallHistory error:', error);
    res.status(500).json({ error: 'Failed to retrieve call history.' });
  }
}

export function recordCallLog(params: {
  callerId: string;
  receiverId: string;
  callType: 'audio' | 'video';
  status: 'completed' | 'missed' | 'rejected' | 'busy' | 'failed';
  duration: number;
  startedAt?: string;
  endedAt?: string;
}): CallLog {
  const { callerId, receiverId, callType, status, duration, startedAt, endedAt } = params;
  const id = 'call_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const start = startedAt || new Date(Date.now() - duration * 1000).toISOString();
  const end = endedAt || new Date().toISOString();

  db.prepare(`
    INSERT INTO call_logs (id, caller_id, receiver_id, call_type, status, duration, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, callerId, receiverId, callType, status, duration, start, end);

  // Persist to permanent PostgreSQL database
  persistCallLogToPg({
    id,
    caller_id: callerId,
    receiver_id: receiverId,
    call_type: callType,
    status,
    duration,
    started_at: start,
    ended_at: end,
  });

  // Record activities for both caller and receiver
  recordActivity(callerId, 'call_initiated', {
    peer_id: receiverId,
    call_type: callType,
    status,
    duration,
  });
  if (receiverId) {
    recordActivity(receiverId, 'call_received', {
      peer_id: callerId,
      call_type: callType,
      status,
      duration,
    });
  }

  return {
    id,
    caller_id: callerId,
    receiver_id: receiverId,
    call_type: callType,
    status,
    duration,
    started_at: start,
    ended_at: end,
  };
}

export async function createCallLogHttp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const callerId = req.user?.userId;
    const { receiverId, callType, status, duration, startedAt, endedAt } = req.body;

    if (!callerId || !receiverId) {
      res.status(400).json({ error: 'Missing parameters.' });
      return;
    }

    const log = recordCallLog({
      callerId,
      receiverId,
      callType: callType || 'video',
      status: status || 'completed',
      duration: duration || 0,
      startedAt,
      endedAt,
    });

    res.status(201).json({ callLog: log });
  } catch (error) {
    console.error('createCallLogHttp error:', error);
    res.status(500).json({ error: 'Failed to record call log.' });
  }
}
