import { Request, Response } from 'express';
import { db } from '../db.js';
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

    const rows = (db.prepare(`
      SELECT * FROM call_logs
      WHERE caller_id = ? OR receiver_id = ?
      ORDER BY started_at DESC
      LIMIT 100
    `).all(userId, userId) as unknown) as CallLog[];

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
