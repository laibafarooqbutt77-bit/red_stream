import type { LocalPlaylist, UiSettings, VideoItem, WatchHistoryEntry } from '../types';
import type { BrandThemeId } from './themes';

const KEYS = {
  SEARCH_HISTORY: 'redstream_search_history',
  WATCH_HISTORY: 'redstream_watch_history',
  WATCH_LATER: 'redstream_watch_later',
  PLAYLISTS: 'redstream_playlists',
  LIKED_VIDEOS: 'redstream_liked_videos',
  THEME: 'redstream_theme_v2',
  BRAND_THEME: 'redstream_brand_theme_v2',
  UI_SETTINGS: 'redstream_ui_settings',
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

// Search History
export function getSearchHistory(): string[] {
  const list = readJson<string[]>(KEYS.SEARCH_HISTORY, []);
  return Array.isArray(list) ? list : [];
}

export function addSearchHistory(query: string): string[] {
  const clean = query.trim();
  if (!clean) return getSearchHistory();
  const next = [clean, ...getSearchHistory().filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(0, 15);
  writeJson(KEYS.SEARCH_HISTORY, next);
  return next;
}

export function removeSearchHistoryItem(query: string): string[] {
  const next = getSearchHistory().filter((q) => q !== query);
  writeJson(KEYS.SEARCH_HISTORY, next);
  return next;
}

export function clearSearchHistory(): string[] {
  writeJson(KEYS.SEARCH_HISTORY, []);
  return [];
}

// Watch History & Continue Watching
export function getWatchHistory(): WatchHistoryEntry[] {
  const list = readJson<WatchHistoryEntry[]>(KEYS.WATCH_HISTORY, []);
  return Array.isArray(list) ? list : [];
}

export function recordWatchHistory(video: VideoItem, progressSeconds = 0): WatchHistoryEntry[] {
  const existing = getWatchHistory();
  const prev = existing.find((e) => e.video.key === video.key);
  const nextEntry: WatchHistoryEntry = {
    video,
    watchedAt: new Date().toISOString(),
    progressSeconds: progressSeconds > 0 ? progressSeconds : prev?.progressSeconds || 0,
    durationSeconds: video.durationSeconds || prev?.durationSeconds || 0,
  };
  const next = [nextEntry, ...existing.filter((e) => e.video.key !== video.key)].slice(0, 60);
  writeJson(KEYS.WATCH_HISTORY, next);
  return next;
}

export function updatePlaybackProgress(videoKey: string, progressSeconds: number, durationSeconds: number) {
  const existing = getWatchHistory();
  const next = existing.map((entry) => {
    if (entry.video.key !== videoKey) return entry;
    return {
      ...entry,
      progressSeconds: Math.floor(progressSeconds),
      durationSeconds: Math.floor(durationSeconds || entry.durationSeconds),
    };
  });
  writeJson(KEYS.WATCH_HISTORY, next);
}

export function removeWatchHistoryItem(videoKey: string): WatchHistoryEntry[] {
  const next = getWatchHistory().filter((e) => e.video.key !== videoKey);
  writeJson(KEYS.WATCH_HISTORY, next);
  return next;
}

export function clearWatchHistory(): WatchHistoryEntry[] {
  writeJson(KEYS.WATCH_HISTORY, []);
  return [];
}

// Watch Later
export function getWatchLater(): VideoItem[] {
  const list = readJson<VideoItem[]>(KEYS.WATCH_LATER, []);
  return Array.isArray(list) ? list : [];
}

export function toggleWatchLater(video: VideoItem): { items: VideoItem[]; saved: boolean } {
  const existing = getWatchLater();
  const exists = existing.some((v) => v.key === video.key);
  const next = exists ? existing.filter((v) => v.key !== video.key) : [video, ...existing];
  writeJson(KEYS.WATCH_LATER, next);
  return { items: next, saved: !exists };
}

// Liked Videos (local catalog mirror so Liked Videos view displays full metadata)
export function getLikedVideos(): VideoItem[] {
  const list = readJson<VideoItem[]>(KEYS.LIKED_VIDEOS, []);
  return Array.isArray(list) ? list : [];
}

export function setLikedVideoState(video: VideoItem, liked: boolean): VideoItem[] {
  const existing = getLikedVideos();
  const next = liked
    ? [video, ...existing.filter((v) => v.key !== video.key)].slice(0, 100)
    : existing.filter((v) => v.key !== video.key);
  writeJson(KEYS.LIKED_VIDEOS, next);
  return next;
}

// Local Playlists
export function getPlaylists(): LocalPlaylist[] {
  const list = readJson<LocalPlaylist[]>(KEYS.PLAYLISTS, []);
  return Array.isArray(list) ? list : [];
}

export function createPlaylist(name: string, description = ''): LocalPlaylist[] {
  const clean = name.trim();
  if (!clean) return getPlaylists();
  const next: LocalPlaylist[] = [
    {
      id: crypto.randomUUID ? crypto.randomUUID() : `pl_${Date.now()}`,
      name: clean,
      description: description.trim(),
      videos: [],
      createdAt: new Date().toISOString(),
    },
    ...getPlaylists(),
  ];
  writeJson(KEYS.PLAYLISTS, next);
  return next;
}

export function deletePlaylist(playlistId: string): LocalPlaylist[] {
  const next = getPlaylists().filter((p) => p.id !== playlistId);
  writeJson(KEYS.PLAYLISTS, next);
  return next;
}

export function toggleVideoInPlaylist(playlistId: string, video: VideoItem): LocalPlaylist[] {
  const next = getPlaylists().map((pl) => {
    if (pl.id !== playlistId) return pl;
    const exists = pl.videos.some((v) => v.key === video.key);
    return {
      ...pl,
      videos: exists ? pl.videos.filter((v) => v.key !== video.key) : [video, ...pl.videos],
    };
  });
  writeJson(KEYS.PLAYLISTS, next);
  return next;
}

// Theme & UI Preferences
export function getStoredTheme(): 'light' | 'dark' {
  try {
    const val = window.localStorage.getItem(KEYS.THEME);
    if (val === 'dark' || val === 'light') return val;
  } catch {
    // ignore
  }
  return 'dark';
}

export function setStoredTheme(theme: 'light' | 'dark') {
  try {
    window.localStorage.setItem(KEYS.THEME, theme);
  } catch {
    // ignore
  }
}

export function getStoredBrandTheme(): BrandThemeId {
  try {
    const val = window.localStorage.getItem(KEYS.BRAND_THEME);
    if (
      val === 'crimson' ||
      val === 'royal' ||
      val === 'emerald' ||
      val === 'fairy' ||
      val === 'violet' ||
      val === 'amber'
    ) {
      return val;
    }
  } catch {
    // ignore
  }
  return 'royal';
}

export function setStoredBrandTheme(brandTheme: BrandThemeId) {
  try {
    window.localStorage.setItem(KEYS.BRAND_THEME, brandTheme);
  } catch {
    // ignore
  }
}

export function getUiSettings(): UiSettings {
  return readJson<UiSettings>(KEYS.UI_SETTINGS, {
    autoplay: true,
    theaterMode: false,
    sidebarCollapsed: false,
  });
}

export function saveUiSettings(settings: UiSettings) {
  writeJson(KEYS.UI_SETTINGS, settings);
}
