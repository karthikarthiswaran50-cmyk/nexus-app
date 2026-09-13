import { Response } from 'express';
import { db, recordActivity } from '../db.js';
import crypto from 'node:crypto';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sanitizeText } from '../utils/sanitize.js';

export async function getActiveStories(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    const stories = db.prepare(`
      SELECT 
        s.*,
        u.username,
        u.full_name,
        u.avatar_url,
        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as views_count,
        EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = ?) as has_viewed
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE datetime(s.expires_at) > datetime('now')
      ORDER BY s.created_at ASC
    `).all(currentUserId || '') as any[];

    const userStoriesMap = new Map<string, any>();

    for (const story of stories) {
      const uId = story.user_id;
      if (!userStoriesMap.has(uId)) {
        userStoriesMap.set(uId, {
          user_id: uId,
          username: story.username,
          full_name: story.full_name,
          avatar_url: story.avatar_url,
          all_viewed: true,
          stories: [],
        });
      }
      const group = userStoriesMap.get(uId);
      if (!story.has_viewed && uId !== currentUserId) {
        group.all_viewed = false;
      }
      group.stories.push({
        id: story.id,
        user_id: story.user_id,
        media_url: story.media_url,
        content: story.content,
        background_color: story.background_color,
        created_at: story.created_at,
        expires_at: story.expires_at,
        views_count: Number(story.views_count) || 0,
        has_viewed: Boolean(story.has_viewed),
      });
    }

    const storyGroups = Array.from(userStoriesMap.values());
    storyGroups.sort((a, b) => {
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      if (!a.all_viewed && b.all_viewed) return -1;
      if (a.all_viewed && !b.all_viewed) return 1;
      return 0;
    });

    res.json(storyGroups);
  } catch (err: any) {
    console.error('Error fetching stories:', err);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
}

export async function createStory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rawContent = typeof req.body.content === 'string' ? req.body.content.slice(0, 1000) : '';
    const content = sanitizeText(rawContent);
    const rawBgColor = typeof req.body.background_color === 'string' ? req.body.background_color : '';
    const background_color = /^#[0-9a-fA-F]{3,8}$/.test(rawBgColor) ? rawBgColor : '#0f172a';

    let mediaUrl: string | undefined;

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
    } else if (typeof req.body.media_url === 'string' && req.body.media_url.startsWith('/uploads/')) {
      mediaUrl = req.body.media_url.slice(0, 200);
    }

    if (!content.trim() && !mediaUrl) {
      return res.status(400).json({ error: 'Story requires text or an image' });
    }

    const id = `story_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO stories (id, user_id, media_url, content, background_color, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, mediaUrl || null, content.trim(), background_color, createdAt, expiresAt);

    recordActivity(userId, 'story_created', {
      content: content ? content.slice(0, 100) : '',
      media_url: mediaUrl || undefined,
    });

    const createdStory = {
      id,
      user_id: userId,
      media_url: mediaUrl,
      content: content.trim(),
      background_color,
      created_at: createdAt,
      expires_at: expiresAt,
      views_count: 0,
      has_viewed: true,
    };

    res.status(201).json({ success: true, story: createdStory });
  } catch (err: any) {
    console.error('Error creating story:', err);
    res.status(500).json({ error: 'Failed to create story' });
  }
}

export async function viewStory(req: AuthenticatedRequest, res: Response) {
  try {
    const viewerId = req.user?.userId;
    const storyId = req.params.id;
    if (!viewerId || !storyId) return res.status(400).json({ error: 'Missing parameters' });

    const id = `view_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    try {
      db.prepare(`
        INSERT OR IGNORE INTO story_views (id, story_id, viewer_id, viewed_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(id, storyId, viewerId);
    } catch (e) {}

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record view' });
  }
}

export async function deleteStory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const storyId = req.params.id;
    if (!userId || !storyId) return res.status(400).json({ error: 'Missing parameters' });

    db.prepare('DELETE FROM stories WHERE id = ? AND user_id = ?').run(storyId, userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
}

export async function getStoryViewers(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const storyId = req.params.id;
    if (!userId || !storyId) return res.status(400).json({ error: 'Missing parameters' });

    const viewers = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.avatar_url,
        sv.viewed_at
      FROM story_views sv
      JOIN users u ON sv.viewer_id = u.id
      WHERE sv.story_id = ?
      ORDER BY sv.viewed_at DESC
    `).all(storyId) as any[];

    res.json({ success: true, viewers });
  } catch (err: any) {
    console.error('Failed to get story viewers:', err);
    res.status(500).json({ error: 'Failed to get story viewers' });
  }
}
