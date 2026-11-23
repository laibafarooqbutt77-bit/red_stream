export interface UnifiedVideoItem {
  key: string; // "yt:<id>" or "local:<id>"
  id: string;
  source: 'youtube' | 'local';
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  channelAvatar: string;
  subscriberCount?: number;
  views: number;
  likes: number;
  durationSeconds: number;
  durationLabel: string;
  publishedAt: string;
  category: string;
  tags: string[];
  isShort: boolean;
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T) {
  if (cache.size > 250) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data });
}

export function isYouTubeApiConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.trim().length > 0);
}

export function parseIsoDurationToSeconds(iso: string): number {
  if (!iso) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseClockDurationToSeconds(text: string): number {
  if (!text) return 0;
  const parts = text.trim().split(':').map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

export function formatDurationSeconds(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function parseCompactNumber(text?: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/views?|watching|subscribers?/gi, '').replace(/,/g, '').trim();
  const match = /^([\d.]+)\s*([KMB])?$/i.exec(cleaned);
  if (!match) {
    const digits = cleaned.replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }
  const num = Number(match[1]);
  const unit = (match[2] || '').toUpperCase();
  if (unit === 'B') return Math.round(num * 1_000_000_000);
  if (unit === 'M') return Math.round(num * 1_000_000);
  if (unit === 'K') return Math.round(num * 1_000);
  return Math.round(num);
}

function parseRelativeTimeToIso(text?: string): string {
  if (!text) return new Date().toISOString();
  const clean = text.toLowerCase().replace('streamed', '').trim();
  const match = /(\d+)\s*(second|sec|s|minute|min|m|hour|hr|h|day|d|week|wk|w|month|mo|year|yr|y)/i.exec(clean);
  if (!match) return new Date().toISOString();
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    sec: 1000,
    second: 1000,
    m: 60_000,
    min: 60_000,
    minute: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hour: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    w: 7 * 86_400_000,
    wk: 7 * 86_400_000,
    week: 7 * 86_400_000,
    mo: 30 * 86_400_000,
    month: 30 * 86_400_000,
    y: 365 * 86_400_000,
    yr: 365 * 86_400_000,
    year: 365 * 86_400_000,
  };
  const ms = (multipliers[unit] || 86_400_000) * amount;
  return new Date(Date.now() - ms).toISOString();
}

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(pathParts[0])) {
        const candidate = pathParts[1];
        return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

const CATEGORY_CONFIG: Record<string, { query: string; altQueries: string[]; videoCategoryId?: string }> = {
  All: {
    query: 'Islamic bayan lectures',
    altQueries: [
      'Quran recitation tilawat',
      'Naat sharif nasheed',
    ],
  },
  'Trending Videos': {
    query: 'popular videos today',
    altQueries: ['most viewed music videos 2026', 'viral sports comedy highlights'],
    videoCategoryId: '0',
  },
  'Cartoons and Animation': {
    query: 'cartoons animation full episodes',
    altQueries: ['animated short films cartoons', 'kids cartoons animation'],
    videoCategoryId: '1',
  },
  'Islamic Videos': {
    query: 'Islamic lectures Quran recitation nasheed',
    altQueries: ['bayan islamic reminder quran tilawat', 'naat sharif islamic stories'],
  },
  'Dramas and Movies': {
    query: 'full drama movie official trailer',
    altQueries: ['pakistani drama full episode', 'action drama full movie HD'],
  },
  'Songs and Music': {
    query: 'official music video hit songs',
    altQueries: ['trending songs music playlist', 'new music video 2026'],
    videoCategoryId: '10',
  },
  Comedy: {
    query: 'comedy standup funny sketches',
    altQueries: ['try not to laugh comedy show', 'funny stand up comedy'],
    videoCategoryId: '23',
  },
  Gaming: {
    query: 'gaming gameplay walkthrough 4K',
    altQueries: ['esports highlights gaming stream', 'new games gameplay'],
    videoCategoryId: '20',
  },
  Education: {
    query: 'educational science history documentary',
    altQueries: ['how things work documentary science', 'math physics coding tutorial'],
    videoCategoryId: '27',
  },
  Technology: {
    query: 'technology review smartphones gadgets',
    altQueries: ['AI tech news hardware review', 'coding software engineering'],
    videoCategoryId: '28',
  },
  Sports: {
    query: 'sports highlights football cricket',
    altQueries: ['best goals cricket match highlights', 'champions league sports'],
    videoCategoryId: '17',
  },
  News: {
    query: 'world news breaking report',
    altQueries: ['international news headlines today', 'live news analysis'],
    videoCategoryId: '25',
  },
  Entertainment: {
    query: 'entertainment talk shows celebrity interviews',
    altQueries: ['entertainment tonight film reviews', 'variety show highlights'],
    videoCategoryId: '24',
  },
  Shorts: {
    query: 'trending #shorts',
    altQueries: ['funny gaming music #shorts', 'viral #shorts'],
  },
};

function computePublishedAfter(uploadDate?: string): string | undefined {
  if (!uploadDate || uploadDate === 'any') return undefined;
  const now = Date.now();
  const offsets: Record<string, number> = {
    hour: 3600 * 1000,
    today: 24 * 3600 * 1000,
    week: 7 * 24 * 3600 * 1000,
    month: 30 * 24 * 3600 * 1000,
    year: 365 * 24 * 3600 * 1000,
  };
  const ms = offsets[uploadDate];
  return ms ? new Date(now - ms).toISOString() : undefined;
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`YouTube API error (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function hydrateYouTubeVideosFromApi(
  videoIds: string[],
  apiKey: string,
  categoryLabel: string,
  forceShort = false
): Promise<UnifiedVideoItem[]> {
  if (videoIds.length === 0) return [];

  const videosParams = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    id: videoIds.join(','),
    key: apiKey,
  });
  const videosData = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${videosParams}`);
  const items = Array.isArray(videosData.items) ? videosData.items : [];

  const channelIds = Array.from(
    new Set(items.map((v: any) => v?.snippet?.channelId).filter(Boolean))
  ) as string[];

  const channelMap = new Map<string, { avatar: string; subs: number }>();
  if (channelIds.length > 0) {
    const chParams = new URLSearchParams({
      part: 'snippet,statistics',
      id: channelIds.join(','),
      key: apiKey,
    });
    const chData = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${chParams}`);
    for (const ch of chData.items || []) {
      channelMap.set(ch.id, {
        avatar: ch.snippet?.thumbnails?.default?.url || ch.snippet?.thumbnails?.medium?.url || '',
        subs: Number(ch.statistics?.subscriberCount || 0),
      });
    }
  }

  return items.map((v: any) => {
    const durationSeconds = parseIsoDurationToSeconds(v.contentDetails?.duration || '');
    const chInfo = channelMap.get(v.snippet?.channelId) || { avatar: '', subs: 0 };
    const title: string = v.snippet?.title || 'Untitled Video';
    const description: string = v.snippet?.description || '';
    const isShort =
      forceShort ||
      (durationSeconds > 0 && durationSeconds <= 61 && /#shorts|\bshort\b/i.test(`${title} ${description}`));

    return {
      key: `yt:${v.id}`,
      id: v.id,
      source: 'youtube' as const,
      title,
      description,
      thumbnailUrl:
        v.snippet?.thumbnails?.maxres?.url ||
        v.snippet?.thumbnails?.high?.url ||
        v.snippet?.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      youtubeId: v.id,
      channelId: `yt:${v.snippet?.channelId || ''}`,
      channelTitle: v.snippet?.channelTitle || 'YouTube Creator',
      channelAvatar: chInfo.avatar,
      subscriberCount: chInfo.subs,
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0),
      durationSeconds,
      durationLabel: formatDurationSeconds(durationSeconds),
      publishedAt: v.snippet?.publishedAt || new Date().toISOString(),
      category: categoryLabel,
      tags: Array.isArray(v.snippet?.tags) ? v.snippet.tags.slice(0, 10) : [],
      isShort,
    };
  });
}

// ── Live Public YouTube Search Fallback (used when YOUTUBE_API_KEY is unset) ──
function pickYouTubeSpParam(options: {
  duration?: string;
  uploadDate?: string;
  order?: string;
  isShort?: boolean;
}): string | undefined {
  if (options.isShort) return 'EgIYAQ%3D%3D';
  if (options.duration === 'short') return 'EgIYAQ%3D%3D';
  if (options.duration === 'medium') return 'EgIYAw%3D%3D';
  if (options.duration === 'long') return 'EgIYAg%3D%3D';
  if (options.uploadDate === 'hour') return 'EgQIARAB';
  if (options.uploadDate === 'today') return 'EgQIAhAB';
  if (options.uploadDate === 'week') return 'EgQIAxAB';
  if (options.uploadDate === 'month') return 'EgQIBBAB';
  if (options.uploadDate === 'year') return 'EgQIBRAB';
  if (options.order === 'date') return 'CAI%3D';
  if (options.order === 'viewCount') return 'CAM%3D';
  if (options.order === 'rating') return 'CAE%3D';
  return undefined;
}

async function searchPublicYouTube(options: {
  q?: string;
  category?: string;
  duration?: string;
  uploadDate?: string;
  order?: string;
  isShort?: boolean;
  pageToken?: string;
}): Promise<{ items: UnifiedVideoItem[]; nextPageToken?: string }> {
  const category = options.category || 'All';
  const isShort = Boolean(options.isShort || category === 'Shorts');
  const pageNum = options.pageToken?.startsWith('pub:')
    ? Number(options.pageToken.slice(4)) || 1
    : 1;

  const catCfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.All;
  let queryText = (options.q || '').trim();
  if (!queryText) {
    if (pageNum === 1) {
      queryText = catCfg.query;
    } else {
      const alts = catCfg.altQueries;
      queryText = alts[(pageNum - 2) % alts.length] || catCfg.query;
    }
  } else if (pageNum > 1) {
    queryText = `${queryText} ${pageNum === 2 ? 'HD' : 'popular'}`;
  }
  if (isShort && !/#shorts/i.test(queryText)) {
    queryText = `${queryText} #shorts`;
  }

  const sp = pickYouTubeSpParam({
    duration: options.duration,
    uploadDate: options.uploadDate,
    order: options.order,
    isShort,
  });

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryText)}${
    sp ? `&sp=${sp}` : ''
  }&hl=en&gl=US`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) return { items: [] };
  const html = await res.text();
  const marker = 'var ytInitialData = ';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return { items: [] };
  const endIdx = html.indexOf(';</script>', startIdx);
  if (endIdx === -1) return { items: [] };

  const data = JSON.parse(html.slice(startIdx + marker.length, endIdx));
  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
      ?.contents || [];

  const results: UnifiedVideoItem[] = [];
  const seenIds = new Set<string>();

  for (const sec of sections) {
    for (const entry of sec?.itemSectionRenderer?.contents || []) {
      // Short shelf cards
      if (entry.gridShelfViewModel && isShort) {
        for (const item of entry.gridShelfViewModel.contents || []) {
          const s = item?.shortsLockupViewModel;
          const vidId = s?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
          if (!vidId || seenIds.has(vidId)) continue;
          seenIds.add(vidId);
          const title = s?.overlayMetadata?.primaryText?.content || 'YouTube Short';
          const viewsText = s?.overlayMetadata?.secondaryText?.content || '';
          results.push({
            key: `yt:${vidId}`,
            id: vidId,
            source: 'youtube',
            title,
            description: title,
            thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
            youtubeId: vidId,
            channelId: 'yt:shorts',
            channelTitle: 'YouTube Shorts',
            channelAvatar: '',
            views: parseCompactNumber(viewsText),
            likes: 0,
            durationSeconds: 45,
            durationLabel: 'SHORT',
            publishedAt: new Date().toISOString(),
            category: 'Shorts',
            tags: ['shorts'],
            isShort: true,
          });
        }
      }

      if (entry.videoRenderer) {
        const v = entry.videoRenderer;
        const vidId = v.videoId;
        if (!vidId || seenIds.has(vidId)) continue;
        seenIds.add(vidId);

        const title =
          v.title?.runs?.map((r: any) => r.text).join('') ||
          v.title?.simpleText ||
          'YouTube Video';
        const durationText = v.lengthText?.simpleText || '';
        const durationSeconds = parseClockDurationToSeconds(durationText);
        const viewsText =
          v.viewCountText?.simpleText ||
          v.shortViewCountText?.simpleText ||
          v.viewCountText?.runs?.map((r: any) => r.text).join('') ||
          '';
        const pubText = v.publishedTimeText?.simpleText || '';
        const chName = v.ownerText?.runs?.[0]?.text || 'YouTube Creator';
        const chId = v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || chName;
        const chAvatar =
          v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail
            ?.thumbnails?.[0]?.url || '';
        const desc =
          v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') ||
          '';
        const thumbs = v.thumbnail?.thumbnails || [];
        const bestThumb =
          thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;

        const detectedShort =
          isShort ||
          (durationSeconds > 0 && durationSeconds <= 61 && /#shorts/i.test(title));

        if (isShort && durationSeconds > 65) continue;

        results.push({
          key: `yt:${vidId}`,
          id: vidId,
          source: 'youtube',
          title,
          description: desc || `${title} — ${chName}`,
          thumbnailUrl: bestThumb,
          youtubeId: vidId,
          channelId: `yt:${chId}`,
          channelTitle: chName,
          channelAvatar: chAvatar,
          views: parseCompactNumber(viewsText),
          likes: 0,
          durationSeconds,
          durationLabel: detectedShort ? 'SHORT' : durationText || 'HD',
          publishedAt: parseRelativeTimeToIso(pubText),
          category,
          tags: [],
          isShort: detectedShort,
        });
      }
    }
  }

  // For the Homepage ('All'), blend Quran recitation + Naat/Nasheed + a few clean educational videos
  // so the homepage is rich with Islamic videos (20+ items).
  if (category === 'All' && !options.q?.trim() && pageNum === 1) {
    try {
      const [quranBatch, naatBatch, generalExtra] = await Promise.all([
        searchPublicYouTube({
          ...options,
          category: 'Islamic Videos',
          q: 'Quran recitation tilawat',
          pageToken: undefined,
        }),
        searchPublicYouTube({
          ...options,
          category: 'Islamic Videos',
          q: 'Naat sharif nasheed',
          pageToken: undefined,
        }),
        searchPublicYouTube({
          ...options,
          category: 'Education',
          q: 'science documentary nature 4K',
          pageToken: undefined,
        }),
      ]);
      for (const item of [...quranBatch.items.slice(0, 10), ...naatBatch.items.slice(0, 8)]) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
      for (const item of generalExtra.items.slice(0, 3)) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    } catch {
      // ignore supplement error
    }
  } else if (results.length < 10 && !options.q?.trim() && pageNum === 1 && catCfg.altQueries[0]) {
    try {
      const sup = await searchPublicYouTube({
        ...options,
        q: catCfg.altQueries[0],
        pageToken: undefined,
      });
      for (const item of sup.items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    } catch {
      // ignore supplement error
    }
  }

  return {
    items: results,
    nextPageToken: pageNum < 4 && results.length > 0 ? `pub:${pageNum + 1}` : undefined,
  };
}

export async function searchYouTubeVideos(options: {
  q?: string;
  category?: string;
  duration?: string;
  uploadDate?: string;
  order?: string;
  isShort?: boolean;
  pageToken?: string;
  maxResults?: number;
}): Promise<{
  configured: boolean;
  items: UnifiedVideoItem[];
  nextPageToken?: string;
  error?: string;
}> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const cacheKey = `${Boolean(apiKey)}:${JSON.stringify(options)}`;
  const cached = getCached<{
    configured: boolean;
    items: UnifiedVideoItem[];
    nextPageToken?: string;
  }>(cacheKey);
  if (cached) return cached;

  const q = (options.q || '').trim();
  const category = options.category || 'All';
  const maxResults = Math.min(Math.max(options.maxResults || 16, 4), 24);
  const isShort = Boolean(options.isShort || category === 'Shorts');

  if (apiKey && !options.pageToken?.startsWith('pub:')) {
    try {
      const canUseTrendingChart =
        !q &&
        !isShort &&
        (!options.duration || options.duration === 'any') &&
        (!options.uploadDate || options.uploadDate === 'any') &&
        (category === 'Trending Videos');

      if (canUseTrendingChart) {
        const params = new URLSearchParams({
          part: 'snippet,contentDetails,statistics',
          chart: 'mostPopular',
          maxResults: String(maxResults),
          key: apiKey,
        });
        if (options.pageToken) params.set('pageToken', options.pageToken);
        const data = await fetchJson(`https://www.googleapis.com/youtube/v3/videos?${params}`);
        const ids = (data.items || []).map((i: any) => i.id).filter(Boolean);
        const hydrated = await hydrateYouTubeVideosFromApi(ids, apiKey, category, false);
        const result = {
          configured: true,
          items: hydrated,
          nextPageToken: data.nextPageToken,
        };
        setCached(cacheKey, result);
        return result;
      }

      const catCfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.All;
      const searchQuery = isShort
        ? `${q || catCfg.query} #shorts`.trim()
        : q || catCfg.query;

      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        videoEmbeddable: 'true',
        safeSearch: 'moderate',
        maxResults: String(maxResults),
        q: searchQuery,
        key: apiKey,
      });

      if (options.pageToken) params.set('pageToken', options.pageToken);
      if (options.order && ['relevance', 'date', 'viewCount', 'rating'].includes(options.order)) {
        params.set('order', options.order);
      }
      if (isShort) {
        params.set('videoDuration', 'short');
      } else if (options.duration && ['short', 'medium', 'long'].includes(options.duration)) {
        params.set('videoDuration', options.duration);
      }
      const publishedAfter = computePublishedAfter(options.uploadDate);
      if (publishedAfter) params.set('publishedAfter', publishedAfter);
      if (!q && catCfg.videoCategoryId && catCfg.videoCategoryId !== '0') {
        params.set('videoCategoryId', catCfg.videoCategoryId);
      }

      const searchData = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const ids = (searchData.items || [])
        .map((item: any) => item?.id?.videoId)
        .filter(Boolean) as string[];

      const hydrated = await hydrateYouTubeVideosFromApi(ids, apiKey, category, isShort);
      const result = {
        configured: true,
        items: hydrated,
        nextPageToken: searchData.nextPageToken,
      };
      setCached(cacheKey, result);
      return result;
    } catch {
      // Seamless fallback to live public YouTube search if API key quota is exceeded or invalid
    }
  }

  try {
    const pub = await searchPublicYouTube({
      q: options.q,
      category,
      duration: options.duration,
      uploadDate: options.uploadDate,
      order: options.order,
      isShort,
      pageToken: options.pageToken,
    });
    const result = {
      configured: Boolean(apiKey),
      items: pub.items,
      nextPageToken: pub.nextPageToken,
    };
    setCached(cacheKey, result);
    return result;
  } catch (err: any) {
    return {
      configured: Boolean(apiKey),
      items: [],
      error: err?.message || 'Unable to fetch videos from YouTube.',
    };
  }
}

export async function getYouTubeVideoById(videoId: string): Promise<{
  configured: boolean;
  video: UnifiedVideoItem | null;
  related: UnifiedVideoItem[];
  error?: string;
}> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return { configured: Boolean(apiKey), video: null, related: [], error: 'Invalid YouTube video ID.' };
  }

  const cacheKey = `video:${videoId}:${Boolean(apiKey)}`;
  const cached = getCached<{ configured: boolean; video: UnifiedVideoItem | null; related: UnifiedVideoItem[] }>(
    cacheKey
  );
  if (cached) return cached;

  if (apiKey) {
    try {
      const [video] = await hydrateYouTubeVideosFromApi([videoId], apiKey, 'YouTube', false);
      if (video) {
        const keywordQuery = video.title
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 2)
          .slice(0, 5)
          .join(' ');
        const relatedSearch = await searchYouTubeVideos({
          q: keywordQuery || video.channelTitle,
          maxResults: 12,
        });
        const related = relatedSearch.items.filter((item) => item.id !== videoId).slice(0, 10);
        const result = { configured: true, video, related };
        setCached(cacheKey, result);
        return result;
      }
    } catch {
      // Fallback below
    }
  }

  // Live fallback using YouTube search by videoId + oEmbed
  try {
    const [searchById, oembedRes] = await Promise.all([
      searchPublicYouTube({ q: videoId }).catch(() => ({ items: [] as UnifiedVideoItem[] })),
      fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
      ).catch(() => null),
    ]);

    const exact = searchById.items.find((i) => i.id === videoId);
    let video: UnifiedVideoItem | null = exact || null;

    if (!video && oembedRes?.ok) {
      const oembed: any = await oembedRes.json();
      video = {
        key: `yt:${videoId}`,
        id: videoId,
        source: 'youtube',
        title: oembed.title || 'YouTube Video',
        description: `Creator: ${oembed.author_name || 'YouTube'}`,
        thumbnailUrl: oembed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        youtubeId: videoId,
        channelId: `yt:${oembed.author_name || 'youtube'}`,
        channelTitle: oembed.author_name || 'YouTube Creator',
        channelAvatar: '',
        views: 0,
        likes: 0,
        durationSeconds: 0,
        durationLabel: 'HD',
        publishedAt: new Date().toISOString(),
        category: 'YouTube',
        tags: [],
        isShort: false,
      };
    }

    if (!video) {
      return { configured: Boolean(apiKey), video: null, related: [], error: 'Video not found.' };
    }

    const keywordQuery = video.title
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 4)
      .join(' ');
    const relRes = await searchPublicYouTube({ q: keywordQuery || video.channelTitle });
    const related = relRes.items.filter((i) => i.id !== videoId).slice(0, 10);

    const result = { configured: Boolean(apiKey), video, related };
    setCached(cacheKey, result);
    return result;
  } catch {
    return { configured: Boolean(apiKey), video: null, related: [], error: 'Unable to resolve YouTube video.' };
  }
}

export async function getYouTubeSuggestions(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = `suggest:${trimmed.toLowerCase()}`;
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(trimmed)}`
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const list = Array.isArray(data?.[1]) ? data[1].slice(0, 8).map(String) : [];
    setCached(cacheKey, list);
    return list;
  } catch {
    return [];
  }
}

export async function getChannelLatestYouTubeVideos(channelId: string): Promise<UnifiedVideoItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const cleanId = channelId.replace(/^yt:/, '');
  if (!cleanId) return [];

  const cacheKey = `ch_latest:${cleanId}`;
  const cached = getCached<UnifiedVideoItem[]>(cacheKey);
  if (cached) return cached;

  if (apiKey && /^UC[\w-]{10,}$/.test(cleanId)) {
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        channelId: cleanId,
        order: 'date',
        type: 'video',
        videoEmbeddable: 'true',
        maxResults: '4',
        key: apiKey,
      });
      const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const ids = (data.items || []).map((i: any) => i?.id?.videoId).filter(Boolean) as string[];
      const hydrated = await hydrateYouTubeVideosFromApi(ids, apiKey, 'Subscriptions', false);
      setCached(cacheKey, hydrated);
      return hydrated;
    } catch {
      // fallback below
    }
  }

  // Public YouTube channel RSS feed (works with no API key!)
  if (/^UC[\w-]{10,}$/.test(cleanId)) {
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(cleanId)}`);
      if (!res.ok) return [];
      const xml = await res.text();
      const entries = xml.split('<entry>').slice(1, 5);
      const list: UnifiedVideoItem[] = [];
      for (const entry of entries) {
        const vidId = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(entry)?.[1];
        const title = /<title>([^<]+)<\/title>/.exec(entry)?.[1] || 'YouTube Video';
        const author = /<name>([^<]+)<\/name>/.exec(entry)?.[1] || 'YouTube Creator';
        const published = /<published>([^<]+)<\/published>/.exec(entry)?.[1] || new Date().toISOString();
        const views = Number(/views="(\d+)"/.exec(entry)?.[1] || 0);
        if (vidId) {
          list.push({
            key: `yt:${vidId}`,
            id: vidId,
            source: 'youtube',
            title,
            description: title,
            thumbnailUrl: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
            youtubeId: vidId,
            channelId: `yt:${cleanId}`,
            channelTitle: author,
            channelAvatar: '',
            views,
            likes: 0,
            durationSeconds: 0,
            durationLabel: 'HD',
            publishedAt: published,
            category: 'Subscriptions',
            tags: [],
            isShort: false,
          });
        }
      }
      setCached(cacheKey, list);
      return list;
    } catch {
      return [];
    }
  }

  return [];
}
