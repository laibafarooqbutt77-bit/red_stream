import type {
  ChannelProfile,
  CommentItem,
  NotificationItem,
  SearchFilters,
  SubscribedChannel,
  UserProfile,
  VideoItem,
} from '../types';

// Stored strictly in memory (never in localStorage) per security best practices
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'RedStream');
  if (inMemoryToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // Auth
  me: () => apiFetch<{ user: UserProfile | null }>('/api/auth/me'),
  register: (payload: {
    username: string;
    accountName: string;
    channelName: string;
    email: string;
    password: string;
  }) =>
    apiFetch<{ user: UserProfile; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { identifier: string; password: string }) =>
    apiFetch<{ user: UserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // Profile & Channels
  updateProfile: (formData: FormData) =>
    apiFetch<{ user: UserProfile }>('/api/profile', {
      method: 'PATCH',
      body: formData,
    }),
  getChannel: (channelId: string) =>
    apiFetch<{ channel: ChannelProfile; videos: VideoItem[] }>(
      `/api/channels/${encodeURIComponent(channelId)}`
    ),

  // Creator Videos
  listLocalVideos: (params: { category?: string; isShort?: boolean; q?: string; userId?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.category) sp.set('category', params.category);
    if (params.isShort !== undefined) sp.set('isShort', String(params.isShort));
    if (params.q) sp.set('q', params.q);
    if (params.userId) sp.set('userId', params.userId);
    return apiFetch<{ items: VideoItem[] }>(`/api/videos?${sp.toString()}`);
  },
  getLocalVideo: (id: string) =>
    apiFetch<{ video: VideoItem; related: VideoItem[] }>(`/api/videos/${encodeURIComponent(id)}`),
  recordLocalView: (id: string) =>
    apiFetch<{ views: number }>(`/api/videos/${encodeURIComponent(id)}/view`, { method: 'POST' }),
  updateLocalVideo: (id: string, formData: FormData) =>
    apiFetch<{ video: VideoItem }>(`/api/videos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: formData,
    }),
  deleteLocalVideo: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/videos/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  uploadVideoWithProgress: (
    formData: FormData,
    onProgress: (percent: number) => void
  ): Promise<{ video: VideoItem }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/videos');
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Requested-With', 'RedStream');
      if (inMemoryToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${inMemoryToken}`);
      }
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          onProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const parsed = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || `Upload failed (${xhr.status})`));
          }
        } catch {
          reject(new Error('Unexpected server response during upload.'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(formData);
    }),

  // Interactions
  getInteractions: (videoKey: string) =>
    apiFetch<{
      likes: number;
      dislikes: number;
      userReaction: number;
      comments: CommentItem[];
      totalComments: number;
    }>(`/api/interactions/${encodeURIComponent(videoKey)}`),
  reactToVideo: (videoKey: string, value: 1 | -1 | 0) =>
    apiFetch<{ likes: number; dislikes: number; userReaction: number }>(
      `/api/interactions/${encodeURIComponent(videoKey)}/react`,
      { method: 'POST', body: JSON.stringify({ value }) }
    ),
  addComment: (videoKey: string, content: string, parentId: string | null = null) =>
    apiFetch<{ comment: CommentItem }>(`/api/interactions/${encodeURIComponent(videoKey)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    }),
  editComment: (commentId: string, content: string) =>
    apiFetch<{ ok: boolean; content: string; updatedAt: string }>(
      `/api/comments/${encodeURIComponent(commentId)}`,
      { method: 'PATCH', body: JSON.stringify({ content }) }
    ),
  deleteComment: (commentId: string) =>
    apiFetch<{ ok: boolean }>(`/api/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    }),
  reactToComment: (commentId: string, value: 1 | -1) =>
    apiFetch<{ likes: number; dislikes: number; userReaction: number }>(
      `/api/comments/${encodeURIComponent(commentId)}/react`,
      { method: 'POST', body: JSON.stringify({ value }) }
    ),

  // Subscriptions & Notifications
  getSubscriptionStatus: (channelId: string) =>
    apiFetch<{ subscriberDelta: number; isSubscribed: boolean }>(
      `/api/subscriptions/status?channelId=${encodeURIComponent(channelId)}`
    ),
  toggleSubscription: (payload: {
    channelId: string;
    channelTitle: string;
    channelAvatar: string;
  }) =>
    apiFetch<{ subscribed: boolean; subscriberCount: number }>('/api/subscriptions/toggle', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSubscriptions: () =>
    apiFetch<{ channels: SubscribedChannel[]; videos: VideoItem[] }>('/api/subscriptions'),
  getNotifications: () =>
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications'),
  markNotificationsRead: () =>
    apiFetch<{ ok: boolean }>('/api/notifications/read', { method: 'POST' }),

  // YouTube Data API v3 Proxy
  youtubeStatus: () => apiFetch<{ configured: boolean }>('/api/youtube/status'),
  youtubeSuggestions: (q: string) =>
    apiFetch<{ suggestions: string[] }>(`/api/youtube/suggestions?q=${encodeURIComponent(q)}`),
  youtubeSearch: (params: {
    q?: string;
    category?: string;
    filters?: SearchFilters;
    isShort?: boolean;
    pageToken?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.category) sp.set('category', params.category);
    if (params.filters?.duration) sp.set('duration', params.filters.duration);
    if (params.filters?.uploadDate) sp.set('uploadDate', params.filters.uploadDate);
    if (params.filters?.order) sp.set('order', params.filters.order);
    if (params.isShort) sp.set('isShort', 'true');
    if (params.pageToken) sp.set('pageToken', params.pageToken);
    return apiFetch<{
      configured: boolean;
      items: VideoItem[];
      nextPageToken?: string;
      error?: string;
    }>(`/api/youtube/search?${sp.toString()}`);
  },
  youtubeVideo: (videoId: string) =>
    apiFetch<{ configured: boolean; video: VideoItem; related: VideoItem[] }>(
      `/api/youtube/video/${encodeURIComponent(videoId)}`
    ),
  youtubeResolveUrl: (url: string) =>
    apiFetch<{ configured: boolean; video: VideoItem; related: VideoItem[] }>(
      `/api/youtube/resolve?url=${encodeURIComponent(url)}`
    ),
};
