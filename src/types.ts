export type AppView =
  | 'home'
  | 'shorts'
  | 'subscriptions'
  | 'trending'
  | 'history'
  | 'continue-watching'
  | 'watch-later'
  | 'liked'
  | 'playlists'
  | 'your-videos'
  | 'upload'
  | '3d-studio'
  | 'watch'
  | 'channel';

export const CATEGORIES = [
  'All',
  'Trending Videos',
  'Shorts',
  'Cartoons and Animation',
  'Islamic Videos',
  'Dramas and Movies',
  'Songs and Music',
  'Comedy',
  'Gaming',
  'Education',
  'Technology',
  'Sports',
  'News',
  'Entertainment',
] as const;

export type CategoryName = (typeof CATEGORIES)[number];

export interface VideoItem {
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

export interface WatchHistoryEntry {
  video: VideoItem;
  watchedAt: string;
  progressSeconds: number;
  durationSeconds: number;
}

export interface LocalPlaylist {
  id: string;
  name: string;
  description: string;
  videos: VideoItem[];
  createdAt: string;
}

export interface UiSettings {
  autoplay: boolean;
  theaterMode: boolean;
  sidebarCollapsed: boolean;
}

export interface SearchFilters {
  duration: 'any' | 'short' | 'medium' | 'long';
  uploadDate: 'any' | 'hour' | 'today' | 'week' | 'month' | 'year';
  order: 'relevance' | 'date' | 'viewCount' | 'rating';
}

export interface UserProfile {
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

export interface ChannelProfile {
  id: string;
  username: string;
  accountName: string;
  channelName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  subscriberCount: number;
  isSubscribed: boolean;
  createdAt: string;
}

export interface CommentItem {
  id: string;
  videoKey: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  likes: number;
  dislikes: number;
  userReaction: number; // 1, -1, or 0
}

export interface SubscribedChannel {
  channelId: string;
  channelTitle: string;
  channelAvatar: string;
  isExternal: boolean;
  subscriberCount: number;
}

export interface NotificationItem {
  id: string;
  actorName: string;
  actorAvatar: string;
  message: string;
  videoKey: string;
  isRead: boolean;
  createdAt: string;
}

export function formatViews(views: number): string {
  if (!Number.isFinite(views) || views < 0) return '0 views';
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B views`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${views} ${views === 1 ? 'view' : 'views'}`;
}

export function formatSubscribers(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0 subscribers';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M subscribers`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K subscribers`;
  return `${count} ${count === 1 ? 'subscriber' : 'subscribers'}`;
}

export function formatRelativeTime(isoDate: string): string {
  const time = new Date(isoDate).getTime();
  if (!Number.isFinite(time)) return 'Recently';
  const diffSec = Math.max(1, Math.floor((Date.now() - time) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

export function safeMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('/uploads/') || url.startsWith('/src/assets/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}
