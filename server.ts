import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import {
  db,
  DEFAULT_AVATAR_URL,
  DEFAULT_BANNER_URL,
  IMAGE_UPLOADS_DIR,
  UPLOADS_DIR,
  VIDEO_UPLOADS_DIR,
  safeDeleteUploadedFile,
} from './server/db.ts';
import {
  extractYouTubeId,
  formatDurationSeconds,
  getChannelLatestYouTubeVideos,
  getYouTubeSuggestions,
  getYouTubeVideoById,
  isYouTubeApiConfigured,
  searchYouTubeVideos,
  type UnifiedVideoItem,
} from './server/youtube.ts';

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const AUTH_COOKIE_NAME = 'redstream_session';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PublicUser {
  id: string;
  username: string;
  accountName: string;
  channelName: string;
  email: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  subscriberCount: number;
  createdAt: string;
}

interface AuthenticatedRequest extends Request {
  authUser?: PublicUser | null;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(keyHex, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.sub || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return String(parsed.sub);
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

function getSubscriberCount(channelId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM subscriptions WHERE channel_id = ?')
    .get(channelId) as { count: number } | undefined;
  return Number(row?.count || 0);
}

function getUserById(userId: string): PublicUser | null {
  const row = db
    .prepare(
      `SELECT id, username, account_name, channel_name, email, bio, avatar_url, banner_url, created_at
       FROM users WHERE id = ?`
    )
    .get(userId) as any;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    accountName: row.account_name,
    channelName: row.channel_name,
    email: row.email,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    subscriberCount: getSubscriberCount(row.id),
    createdAt: row.created_at,
  };
}

function setAuthCookie(req: Request, res: Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    partitioned: isHttps,
    maxAge: TOKEN_TTL_MS,
    path: '/',
  });
}

function clearAuthCookie(req: Request, res: Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    partitioned: isHttps,
    path: '/',
  });
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] || null;
}

function attachAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);
  if (token) {
    const userId = verifySessionToken(token);
    if (userId) {
      req.authUser = getUserById(userId);
    }
  }
  next();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  // CSRF mitigation when relying on cookie session
  const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
  if (!hasBearer && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const customHeader = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    let originValid = false;
    if (origin && host) {
      try {
        originValid = new URL(origin).host === host;
      } catch {
        originValid = false;
      }
    }
    if (customHeader !== 'RedStream' && !originValid) {
      res.status(403).json({ error: 'Invalid request origin.' });
      return;
    }
  }
  next();
}

function mapLocalVideoRow(row: any): UnifiedVideoItem {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags || '[]');
    if (Array.isArray(parsed)) tags = parsed.map(String);
  } catch {
    tags = [];
  }
  const likesRow = db
    .prepare("SELECT COUNT(*) as count FROM video_reactions WHERE video_key = ? AND value = 1")
    .get(`local:${row.id}`) as { count: number } | undefined;

  return {
    key: `local:${row.id}`,
    id: row.id,
    source: 'local',
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url || '',
    videoUrl: row.video_url,
    channelId: row.user_id,
    channelTitle: row.channel_name,
    channelHandle: `@${row.username}`,
    channelAvatar: row.avatar_url,
    subscriberCount: getSubscriberCount(row.user_id),
    views: Number(row.views || 0),
    likes: Number(likesRow?.count || 0),
    durationSeconds: Number(row.duration_seconds || 0),
    durationLabel: formatDurationSeconds(Number(row.duration_seconds || 0)),
    publishedAt: row.created_at,
    category: row.category,
    tags,
    isShort: Boolean(row.is_short),
  };
}

// Multer storage & validation
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploadMedia = multer({
  storage: multer.diskStorage({
    destination: (_req, file, cb) => {
      if (file.fieldname === 'video') {
        cb(null, VIDEO_UPLOADS_DIR);
      } else {
        cb(null, IMAGE_UPLOADS_DIR);
      }
    },
    filename: (_req, file, cb) => {
      const extMap: Record<string, string> = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
      };
      const ext = extMap[file.mimetype] || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB max per file
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'video') {
      if (!ALLOWED_VIDEO_MIMES.has(file.mimetype)) {
        cb(new Error('Unsupported video format. Please upload MP4, WebM, or MOV files.'));
        return;
      }
      cb(null, true);
      return;
    }
    if (['thumbnail', 'avatar', 'banner'].includes(file.fieldname)) {
      if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
        cb(new Error('Unsupported image format. Please upload JPG, PNG, or WebP files.'));
        return;
      }
      cb(null, true);
      return;
    }
    cb(new Error('Unexpected upload field.'));
  },
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(attachAuth);

  // Serve uploaded files safely with range streaming support
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      acceptRanges: true,
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );

  // ── Auth Routes ──────────────────────────────────────────────────────────────
  app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.authUser || null });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { username, accountName, channelName, email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanUsername = String(username || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '');
    const cleanAccountName = String(accountName || '').trim();
    const cleanChannelName = String(channelName || cleanAccountName || '').trim();
    const rawPassword = String(password || '');

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      res.status(400).json({ error: 'Username must be 3 to 30 characters (letters, numbers, _, ., -).' });
      return;
    }
    if (!cleanAccountName || cleanAccountName.length < 2) {
      res.status(400).json({ error: 'Please enter your account name.' });
      return;
    }
    if (rawPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
      .get(cleanEmail, cleanUsername);
    if (existing) {
      res.status(409).json({ error: 'An account with this email or username already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(rawPassword);

    db.prepare(
      `INSERT INTO users (id, username, account_name, channel_name, email, password_hash, bio, avatar_url, banner_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      cleanUsername,
      cleanAccountName,
      cleanChannelName || cleanAccountName,
      cleanEmail,
      passwordHash,
      'Creator on RedStream.',
      DEFAULT_AVATAR_URL,
      DEFAULT_BANNER_URL,
      now
    );

    const token = signSessionToken(id);
    setAuthCookie(req, res, token);
    res.status(201).json({ user: getUserById(id), token });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { identifier, password } = req.body || {};
    const cleanId = String(identifier || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!cleanId || !rawPassword) {
      res.status(400).json({ error: 'Email/username and password are required.' });
      return;
    }

    const row = db
      .prepare('SELECT id, password_hash FROM users WHERE email = ? OR username = ?')
      .get(cleanId, cleanId) as { id: string; password_hash: string } | undefined;

    if (!row || !verifyPassword(rawPassword, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    }

    const token = signSessionToken(row.id);
    setAuthCookie(req, res, token);
    res.json({ user: getUserById(row.id), token });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    clearAuthCookie(req, res);
    res.json({ ok: true });
  });

  // ── Profile & Channel Routes ─────────────────────────────────────────────────
  app.patch(
    '/api/profile',
    requireAuth,
    uploadMedia.fields([
      { name: 'avatar', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ]),
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.authUser!;
      const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
      const { accountName, channelName, username, bio } = req.body || {};

      let nextUsername = user.username;
      if (typeof username === 'string' && username.trim()) {
        const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
        if (cleaned.length < 3 || cleaned.length > 30) {
          res.status(400).json({ error: 'Username must be 3 to 30 characters.' });
          return;
        }
        if (cleaned !== user.username) {
          const dup = db
            .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
            .get(cleaned, user.id);
          if (dup) {
            res.status(409).json({ error: 'That username is already taken.' });
            return;
          }
          nextUsername = cleaned;
        }
      }

      const nextAccountName =
        typeof accountName === 'string' && accountName.trim()
          ? accountName.trim().slice(0, 60)
          : user.accountName;
      const nextChannelName =
        typeof channelName === 'string' && channelName.trim()
          ? channelName.trim().slice(0, 60)
          : user.channelName;
      const nextBio = typeof bio === 'string' ? bio.trim().slice(0, 500) : user.bio;

      let nextAvatar = user.avatarUrl;
      if (files.avatar?.[0]) {
        safeDeleteUploadedFile(user.avatarUrl);
        nextAvatar = `/uploads/images/${files.avatar[0].filename}`;
      }

      let nextBanner = user.bannerUrl;
      if (files.banner?.[0]) {
        safeDeleteUploadedFile(user.bannerUrl);
        nextBanner = `/uploads/images/${files.banner[0].filename}`;
      }

      db.prepare(
        `UPDATE users SET username = ?, account_name = ?, channel_name = ?, bio = ?, avatar_url = ?, banner_url = ?
         WHERE id = ?`
      ).run(nextUsername, nextAccountName, nextChannelName, nextBio, nextAvatar, nextBanner, user.id);

      res.json({ user: getUserById(user.id) });
    }
  );

  app.get('/api/channels/:id', (req: AuthenticatedRequest, res: Response) => {
    const rawId = String(req.params.id || '').trim();
    const row = db
      .prepare(
        `SELECT id, username, account_name, channel_name, bio, avatar_url, banner_url, created_at
         FROM users WHERE id = ? OR username = ?`
      )
      .get(rawId, rawId.replace(/^@/, '').toLowerCase()) as any;

    if (!row) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }

    const videosRows = db
      .prepare(
        `SELECT v.*, u.username, u.channel_name, u.avatar_url
         FROM videos v
         JOIN users u ON v.user_id = u.id
         WHERE v.user_id = ?
         ORDER BY v.created_at DESC`
      )
      .all(row.id) as any[];

    const videos = videosRows.map(mapLocalVideoRow);
    const subscriberCount = getSubscriberCount(row.id);
    const isSubscribed = req.authUser
      ? Boolean(
          db
            .prepare('SELECT 1 FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?')
            .get(req.authUser.id, row.id)
        )
      : false;

    res.json({
      channel: {
        id: row.id,
        username: row.username,
        accountName: row.account_name,
        channelName: row.channel_name,
        bio: row.bio,
        avatarUrl: row.avatar_url,
        bannerUrl: row.banner_url,
        subscriberCount,
        isSubscribed,
        createdAt: row.created_at,
      },
      videos,
    });
  });

  // ── Creator Video Upload & Management Routes ─────────────────────────────────
  app.get('/api/videos', (req: Request, res: Response) => {
    const category = String(req.query.category || '').trim();
    const isShortParam = req.query.isShort;
    const q = String(req.query.q || '').trim().toLowerCase();
    const userId = String(req.query.userId || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 60);

    const clauses: string[] = [];
    const params: any[] = [];

    if (category && !['All', 'Trending Videos', 'Shorts'].includes(category)) {
      clauses.push('v.category = ?');
      params.push(category);
    }
    if (isShortParam === 'true' || category === 'Shorts') {
      clauses.push('v.is_short = 1');
    } else if (isShortParam === 'false') {
      clauses.push('v.is_short = 0');
    }
    if (userId) {
      clauses.push('v.user_id = ?');
      params.push(userId);
    }
    if (q) {
      clauses.push('(LOWER(v.title) LIKE ? OR LOWER(v.description) LIKE ? OR LOWER(v.tags) LIKE ? OR LOWER(u.channel_name) LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderSql = category === 'Trending Videos' ? 'ORDER BY v.views DESC, v.created_at DESC' : 'ORDER BY v.created_at DESC';

    const rows = db
      .prepare(
        `SELECT v.*, u.username, u.channel_name, u.avatar_url
         FROM videos v
         JOIN users u ON v.user_id = u.id
         ${whereSql}
         ${orderSql}
         LIMIT ?`
      )
      .all(...params, limit) as any[];

    res.json({ items: rows.map(mapLocalVideoRow) });
  });

  app.post(
    '/api/videos',
    requireAuth,
    uploadMedia.fields([
      { name: 'video', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]),
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.authUser!;
      const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
      const videoFile = files.video?.[0];
      if (!videoFile) {
        res.status(400).json({ error: 'Please select a video file (MP4, WebM, or MOV).' });
        return;
      }

      const title = String(req.body?.title || '').trim();
      if (!title) {
        safeDeleteUploadedFile(`/uploads/videos/${videoFile.filename}`);
        res.status(400).json({ error: 'Video title is required.' });
        return;
      }

      const description = String(req.body?.description || '').trim().slice(0, 5000);
      const category = String(req.body?.category || 'Entertainment').trim();
      const isShort = req.body?.isShort === 'true' || req.body?.isShort === '1' ? 1 : 0;
      const durationSeconds = Math.max(0, Math.round(Number(req.body?.durationSeconds || 0)));

      const rawTags = String(req.body?.tags || '');
      const tags = rawTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 15);

      const videoUrl = `/uploads/videos/${videoFile.filename}`;
      const thumbFile = files.thumbnail?.[0];
      const thumbnailUrl = thumbFile ? `/uploads/images/${thumbFile.filename}` : '';
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO videos (id, user_id, title, description, category, tags, video_url, thumbnail_url, duration_seconds, is_short, views, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
      ).run(
        id,
        user.id,
        title.slice(0, 140),
        description,
        category,
        JSON.stringify(tags),
        videoUrl,
        thumbnailUrl,
        durationSeconds,
        isShort,
        now
      );

      // Notify subscribers
      const subscribers = db
        .prepare('SELECT subscriber_id FROM subscriptions WHERE channel_id = ?')
        .all(user.id) as { subscriber_id: string }[];
      const insertNotif = db.prepare(
        `INSERT INTO notifications (id, user_id, actor_name, actor_avatar, message, video_key, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
      );
      for (const sub of subscribers) {
        insertNotif.run(
          crypto.randomUUID(),
          sub.subscriber_id,
          user.channelName,
          user.avatarUrl,
          `${user.channelName} uploaded: ${title.slice(0, 80)}`,
          `local:${id}`,
          now
        );
      }

      const createdRow = db
        .prepare(
          `SELECT v.*, u.username, u.channel_name, u.avatar_url
           FROM videos v JOIN users u ON v.user_id = u.id WHERE v.id = ?`
        )
        .get(id);
      res.status(201).json({ video: mapLocalVideoRow(createdRow) });
    }
  );

  app.get('/api/videos/:id', (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    const row = db
      .prepare(
        `SELECT v.*, u.username, u.channel_name, u.avatar_url
         FROM videos v
         JOIN users u ON v.user_id = u.id
         WHERE v.id = ?`
      )
      .get(id) as any;

    if (!row) {
      res.status(404).json({ error: 'Video not found.' });
      return;
    }

    const relatedRows = db
      .prepare(
        `SELECT v.*, u.username, u.channel_name, u.avatar_url
         FROM videos v
         JOIN users u ON v.user_id = u.id
         WHERE v.id != ?
         ORDER BY (v.category = ?) DESC, v.created_at DESC
         LIMIT 10`
      )
      .all(id, row.category) as any[];

    res.json({
      video: mapLocalVideoRow(row),
      related: relatedRows.map(mapLocalVideoRow),
    });
  });

  app.post('/api/videos/:id/view', (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    const result = db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Video not found.' });
      return;
    }
    const row = db.prepare('SELECT views FROM videos WHERE id = ?').get(id) as { views: number } | undefined;
    res.json({ views: Number(row?.views || 0) });
  });

  app.patch(
    '/api/videos/:id',
    requireAuth,
    uploadMedia.single('thumbnail'),
    (req: AuthenticatedRequest, res: Response) => {
      const id = String(req.params.id || '').trim();
      const existing = db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;
      if (!existing) {
        res.status(404).json({ error: 'Video not found.' });
        return;
      }
      if (existing.user_id !== req.authUser!.id) {
        res.status(403).json({ error: 'You can only edit your own videos.' });
        return;
      }

      const title =
        typeof req.body?.title === 'string' && req.body.title.trim()
          ? req.body.title.trim().slice(0, 140)
          : existing.title;
      const description =
        typeof req.body?.description === 'string'
          ? req.body.description.trim().slice(0, 5000)
          : existing.description;
      const category =
        typeof req.body?.category === 'string' && req.body.category.trim()
          ? req.body.category.trim()
          : existing.category;
      const isShort =
        req.body?.isShort !== undefined
          ? req.body.isShort === 'true' || req.body.isShort === '1' || req.body.isShort === true
            ? 1
            : 0
          : existing.is_short;

      let tagsJson = existing.tags;
      if (typeof req.body?.tags === 'string') {
        const parsed = req.body.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
          .slice(0, 15);
        tagsJson = JSON.stringify(parsed);
      }

      let thumbnailUrl = existing.thumbnail_url;
      if (req.file) {
        safeDeleteUploadedFile(existing.thumbnail_url);
        thumbnailUrl = `/uploads/images/${req.file.filename}`;
      }

      db.prepare(
        `UPDATE videos SET title = ?, description = ?, category = ?, tags = ?, thumbnail_url = ?, is_short = ?
         WHERE id = ?`
      ).run(title, description, category, tagsJson, thumbnailUrl, isShort, id);

      const updated = db
        .prepare(
          `SELECT v.*, u.username, u.channel_name, u.avatar_url
           FROM videos v JOIN users u ON v.user_id = u.id WHERE v.id = ?`
        )
        .get(id);
      res.json({ video: mapLocalVideoRow(updated) });
    }
  );

  app.delete('/api/videos/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id || '').trim();
    const existing = db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'Video not found.' });
      return;
    }
    if (existing.user_id !== req.authUser!.id) {
      res.status(403).json({ error: 'You can only delete your own videos.' });
      return;
    }

    db.prepare('DELETE FROM videos WHERE id = ?').run(id);
    db.prepare('DELETE FROM comments WHERE video_key = ?').run(`local:${id}`);
    db.prepare('DELETE FROM video_reactions WHERE video_key = ?').run(`local:${id}`);
    safeDeleteUploadedFile(existing.video_url);
    safeDeleteUploadedFile(existing.thumbnail_url);
    res.json({ ok: true });
  });

  // ── Interactions: Likes, Dislikes, Comments, Replies ─────────────────────────
  app.get('/api/interactions/:videoKey', (req: AuthenticatedRequest, res: Response) => {
    const videoKey = decodeURIComponent(String(req.params.videoKey || ''));
    const likesRow = db
      .prepare('SELECT COUNT(*) as count FROM video_reactions WHERE video_key = ? AND value = 1')
      .get(videoKey) as { count: number };
    const dislikesRow = db
      .prepare('SELECT COUNT(*) as count FROM video_reactions WHERE video_key = ? AND value = -1')
      .get(videoKey) as { count: number };

    let userReaction = 0;
    if (req.authUser) {
      const ur = db
        .prepare('SELECT value FROM video_reactions WHERE video_key = ? AND user_id = ?')
        .get(videoKey, req.authUser.id) as { value: number } | undefined;
      userReaction = ur?.value || 0;
    }

    const commentRows = db
      .prepare(
        `SELECT c.*, u.username, u.channel_name, u.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.video_key = ?
         ORDER BY c.created_at DESC`
      )
      .all(videoKey) as any[];

    const comments = commentRows.map((c) => {
      const cLikes = db
        .prepare('SELECT COUNT(*) as count FROM comment_reactions WHERE comment_id = ? AND value = 1')
        .get(c.id) as { count: number };
      const cDislikes = db
        .prepare('SELECT COUNT(*) as count FROM comment_reactions WHERE comment_id = ? AND value = -1')
        .get(c.id) as { count: number };
      let cUserReaction = 0;
      if (req.authUser) {
        const cur = db
          .prepare('SELECT value FROM comment_reactions WHERE comment_id = ? AND user_id = ?')
          .get(c.id, req.authUser.id) as { value: number } | undefined;
        cUserReaction = cur?.value || 0;
      }

      return {
        id: c.id,
        videoKey: c.video_key,
        userId: c.user_id,
        parentId: c.parent_id || null,
        content: c.content,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        authorName: c.channel_name,
        authorHandle: `@${c.username}`,
        authorAvatar: c.avatar_url,
        likes: Number(cLikes?.count || 0),
        dislikes: Number(cDislikes?.count || 0),
        userReaction: cUserReaction,
      };
    });

    res.json({
      likes: Number(likesRow?.count || 0),
      dislikes: Number(dislikesRow?.count || 0),
      userReaction,
      comments,
      totalComments: comments.length,
    });
  });

  app.post('/api/interactions/:videoKey/react', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const videoKey = decodeURIComponent(String(req.params.videoKey || ''));
    const value = Number(req.body?.value);
    if (![1, -1, 0].includes(value)) {
      res.status(400).json({ error: 'Invalid reaction value.' });
      return;
    }

    const userId = req.authUser!.id;
    const existing = db
      .prepare('SELECT value FROM video_reactions WHERE video_key = ? AND user_id = ?')
      .get(videoKey, userId) as { value: number } | undefined;

    let nextReaction = value;
    if (value === 0 || (existing && existing.value === value)) {
      db.prepare('DELETE FROM video_reactions WHERE video_key = ? AND user_id = ?').run(videoKey, userId);
      nextReaction = 0;
    } else {
      db.prepare(
        `INSERT INTO video_reactions (video_key, user_id, value, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(video_key, user_id) DO UPDATE SET value = excluded.value`
      ).run(videoKey, userId, value, new Date().toISOString());
    }

    const likesRow = db
      .prepare('SELECT COUNT(*) as count FROM video_reactions WHERE video_key = ? AND value = 1')
      .get(videoKey) as { count: number };
    const dislikesRow = db
      .prepare('SELECT COUNT(*) as count FROM video_reactions WHERE video_key = ? AND value = -1')
      .get(videoKey) as { count: number };

    res.json({
      likes: Number(likesRow?.count || 0),
      dislikes: Number(dislikesRow?.count || 0),
      userReaction: nextReaction,
    });
  });

  app.post('/api/interactions/:videoKey/comments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const videoKey = decodeURIComponent(String(req.params.videoKey || ''));
    const content = String(req.body?.content || '').trim();
    const parentId = req.body?.parentId ? String(req.body.parentId) : null;

    if (!content || content.length > 2000) {
      res.status(400).json({ error: 'Comment must be between 1 and 2000 characters.' });
      return;
    }

    if (parentId) {
      const parent = db.prepare('SELECT id, user_id FROM comments WHERE id = ?').get(parentId) as any;
      if (!parent) {
        res.status(404).json({ error: 'Parent comment not found.' });
        return;
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const user = req.authUser!;

    db.prepare(
      `INSERT INTO comments (id, video_key, user_id, parent_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, videoKey, user.id, parentId, content, now, now);

    // Notify local video owner if applicable
    if (videoKey.startsWith('local:')) {
      const localId = videoKey.slice(6);
      const vid = db.prepare('SELECT user_id, title FROM videos WHERE id = ?').get(localId) as any;
      if (vid && vid.user_id !== user.id) {
        db.prepare(
          `INSERT INTO notifications (id, user_id, actor_name, actor_avatar, message, video_key, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
        ).run(
          crypto.randomUUID(),
          vid.user_id,
          user.channelName,
          user.avatarUrl,
          `${user.channelName} commented on "${String(vid.title).slice(0, 50)}"`,
          videoKey,
          now
        );
      }
    }

    res.status(201).json({
      comment: {
        id,
        videoKey,
        userId: user.id,
        parentId,
        content,
        createdAt: now,
        updatedAt: now,
        authorName: user.channelName,
        authorHandle: `@${user.username}`,
        authorAvatar: user.avatarUrl,
        likes: 0,
        dislikes: 0,
        userReaction: 0,
      },
    });
  });

  app.patch('/api/comments/:commentId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const commentId = String(req.params.commentId || '');
    const content = String(req.body?.content || '').trim();
    if (!content || content.length > 2000) {
      res.status(400).json({ error: 'Comment must be between 1 and 2000 characters.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId) as any;
    if (!existing) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }
    if (existing.user_id !== req.authUser!.id) {
      res.status(403).json({ error: 'You can only edit your own comments.' });
      return;
    }

    const updatedAt = new Date().toISOString();
    db.prepare('UPDATE comments SET content = ?, updated_at = ? WHERE id = ?').run(content, updatedAt, commentId);
    res.json({ ok: true, content, updatedAt });
  });

  app.delete('/api/comments/:commentId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const commentId = String(req.params.commentId || '');
    const existing = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId) as any;
    if (!existing) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }
    if (existing.user_id !== req.authUser!.id) {
      res.status(403).json({ error: 'You can only delete your own comments.' });
      return;
    }

    db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').run(commentId, commentId);
    res.json({ ok: true });
  });

  app.post('/api/comments/:commentId/react', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const commentId = String(req.params.commentId || '');
    const value = Number(req.body?.value);
    if (![1, -1].includes(value)) {
      res.status(400).json({ error: 'Invalid reaction.' });
      return;
    }

    const userId = req.authUser!.id;
    const existing = db
      .prepare('SELECT value FROM comment_reactions WHERE comment_id = ? AND user_id = ?')
      .get(commentId, userId) as { value: number } | undefined;

    let nextReaction = value;
    if (existing && existing.value === value) {
      db.prepare('DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ?').run(commentId, userId);
      nextReaction = 0;
    } else {
      db.prepare(
        `INSERT INTO comment_reactions (comment_id, user_id, value)
         VALUES (?, ?, ?)
         ON CONFLICT(comment_id, user_id) DO UPDATE SET value = excluded.value`
      ).run(commentId, userId, value);
    }

    const likes = db
      .prepare('SELECT COUNT(*) as count FROM comment_reactions WHERE comment_id = ? AND value = 1')
      .get(commentId) as { count: number };
    const dislikes = db
      .prepare('SELECT COUNT(*) as count FROM comment_reactions WHERE comment_id = ? AND value = -1')
      .get(commentId) as { count: number };

    res.json({
      likes: Number(likes?.count || 0),
      dislikes: Number(dislikes?.count || 0),
      userReaction: nextReaction,
    });
  });

  // ── Subscriptions & Notifications ────────────────────────────────────────────
  app.get('/api/subscriptions/status', (req: AuthenticatedRequest, res: Response) => {
    const channelId = String(req.query.channelId || '').trim();
    if (!channelId) {
      res.status(400).json({ error: 'channelId is required.' });
      return;
    }
    const localCount = getSubscriberCount(channelId);
    const isSubscribed = req.authUser
      ? Boolean(
          db
            .prepare('SELECT 1 FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?')
            .get(req.authUser.id, channelId)
        )
      : false;

    res.json({ subscriberDelta: localCount, isSubscribed });
  });

  app.post('/api/subscriptions/toggle', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const channelId = String(req.body?.channelId || '').trim();
    const channelTitle = String(req.body?.channelTitle || 'Creator').trim().slice(0, 100);
    const channelAvatar = String(req.body?.channelAvatar || '').trim().slice(0, 500);

    if (!channelId) {
      res.status(400).json({ error: 'channelId is required.' });
      return;
    }
    if (channelId === req.authUser!.id) {
      res.status(400).json({ error: 'You cannot subscribe to your own channel.' });
      return;
    }

    const subscriberId = req.authUser!.id;
    const isExternal = channelId.startsWith('yt:') ? 1 : 0;
    const existing = db
      .prepare('SELECT 1 FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?')
      .get(subscriberId, channelId);

    let subscribed = false;
    const now = new Date().toISOString();
    if (existing) {
      db.prepare('DELETE FROM subscriptions WHERE subscriber_id = ? AND channel_id = ?').run(
        subscriberId,
        channelId
      );
      subscribed = false;
    } else {
      db.prepare(
        `INSERT INTO subscriptions (subscriber_id, channel_id, channel_title, channel_avatar, is_external, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(subscriberId, channelId, channelTitle, channelAvatar, isExternal, now);
      subscribed = true;

      if (!isExternal) {
        db.prepare(
          `INSERT INTO notifications (id, user_id, actor_name, actor_avatar, message, video_key, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, '', 0, ?)`
        ).run(
          crypto.randomUUID(),
          channelId,
          req.authUser!.channelName,
          req.authUser!.avatarUrl,
          `${req.authUser!.channelName} subscribed to your channel`,
          now
        );
      }
    }

    res.json({
      subscribed,
      subscriberCount: getSubscriberCount(channelId),
    });
  });

  app.get('/api/subscriptions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const subs = db
      .prepare('SELECT * FROM subscriptions WHERE subscriber_id = ? ORDER BY created_at DESC')
      .all(req.authUser!.id) as any[];

    const localIds = subs.filter((s) => !s.is_external).map((s) => s.channel_id);
    let feed: UnifiedVideoItem[] = [];

    if (localIds.length > 0) {
      const placeholders = localIds.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT v.*, u.username, u.channel_name, u.avatar_url
           FROM videos v
           JOIN users u ON v.user_id = u.id
           WHERE v.user_id IN (${placeholders})
           ORDER BY v.created_at DESC
           LIMIT 30`
        )
        .all(...localIds) as any[];
      feed.push(...rows.map(mapLocalVideoRow));
    }

    const ytChannels = subs.filter((s) => s.is_external).slice(0, 5);
    if (ytChannels.length > 0) {
      const ytResults = await Promise.all(
        ytChannels.map((ch) => getChannelLatestYouTubeVideos(ch.channel_id))
      );
      for (const list of ytResults) feed.push(...list);
    }

    feed.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    res.json({
      channels: subs.map((s) => ({
        channelId: s.channel_id,
        channelTitle: s.channel_title,
        channelAvatar: s.channel_avatar || DEFAULT_AVATAR_URL,
        isExternal: Boolean(s.is_external),
        subscriberCount: getSubscriberCount(s.channel_id),
      })),
      videos: feed,
    });
  });

  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(req.authUser!.id) as any[];
    res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        actorName: n.actor_name,
        actorAvatar: n.actor_avatar || DEFAULT_AVATAR_URL,
        message: n.message,
        videoKey: n.video_key,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at,
      })),
    });
  });

  app.post('/api/notifications/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.authUser!.id);
    res.json({ ok: true });
  });

  // ── YouTube Data API v3 Proxy Routes ─────────────────────────────────────────
  app.get('/api/youtube/status', (_req: Request, res: Response) => {
    res.json({ configured: isYouTubeApiConfigured() });
  });

  app.get('/api/youtube/suggestions', async (req: Request, res: Response) => {
    const q = String(req.query.q || '');
    const suggestions = await getYouTubeSuggestions(q);
    res.json({ suggestions });
  });

  app.get('/api/youtube/search', async (req: Request, res: Response) => {
    const result = await searchYouTubeVideos({
      q: String(req.query.q || ''),
      category: String(req.query.category || 'All'),
      duration: String(req.query.duration || 'any'),
      uploadDate: String(req.query.uploadDate || 'any'),
      order: String(req.query.order || 'relevance'),
      isShort: req.query.isShort === 'true',
      pageToken: req.query.pageToken ? String(req.query.pageToken) : undefined,
      maxResults: req.query.maxResults ? Number(req.query.maxResults) : 16,
    });
    res.json(result);
  });

  app.get('/api/youtube/resolve', async (req: Request, res: Response) => {
    const urlOrId = String(req.query.url || '');
    const id = extractYouTubeId(urlOrId);
    if (!id) {
      res.status(400).json({ error: 'Please provide a valid YouTube link or 11-character video ID.' });
      return;
    }
    const result = await getYouTubeVideoById(id);
    if (!result.video) {
      res.status(404).json({ error: result.error || 'Video not found.' });
      return;
    }
    res.json(result);
  });

  app.get('/api/youtube/video/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const result = await getYouTubeVideoById(id);
    if (!result.video) {
      res.status(404).json({ error: result.error || 'YouTube video not found.' });
      return;
    }
    res.json(result);
  });

  // Multer & API error handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Uploaded file exceeds the 200MB size limit.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RedStream server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RedStream server:', err);
  process.exit(1);
});
