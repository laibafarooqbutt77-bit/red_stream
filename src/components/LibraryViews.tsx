import React, { useEffect, useState } from 'react';
import { FolderPlus, ListVideo, Trash2, Users } from 'lucide-react';
import { api } from '../lib/api';
import {
  formatSubscribers,
  safeMediaUrl,
  type LocalPlaylist,
  type SubscribedChannel,
  type UserProfile,
  type VideoItem,
  type WatchHistoryEntry,
} from '../types';
import { VideoCard } from './VideoCard';

interface SubscriptionsViewProps {
  user: UserProfile | null;
  watchLaterIds: Set<string>;
  onRequireAuth: () => void;
  onPlayVideo: (video: VideoItem) => void;
  onOpenChannel: (channelId: string) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenPlaylistModal: (video: VideoItem) => void;
  onOpenShareModal: (video: VideoItem) => void;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  user,
  watchLaterIds,
  onRequireAuth,
  onPlayVideo,
  onOpenChannel,
  onToggleWatchLater,
  onOpenPlaylistModal,
  onOpenShareModal,
}) => {
  const [channels, setChannels] = useState<SubscribedChannel[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .getSubscriptions()
      .then((res) => {
        setChannels(res.channels);
        setVideos(res.videos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <Users className="w-12 h-12 mx-auto text-red-600 mb-3" />
        <h2 className="text-lg font-bold">Don&apos;t miss new videos</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Sign in to see updates from your favorite channels and creators.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="mt-5 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-5 pb-20 md:pb-12 space-y-6">
      <h1 className="text-xl font-bold">Subscriptions</h1>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-video rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-500">
            You haven&apos;t subscribed to any channels yet. Open any video and click Subscribe to follow creators.
          </p>
        </div>
      ) : (
        <>
          {/* Subscribed Channels Strip */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
            {channels.map((ch) => (
              <button
                key={ch.channelId}
                type="button"
                onClick={() => {
                  if (!ch.isExternal) onOpenChannel(ch.channelId);
                }}
                className="flex flex-col items-center gap-1.5 min-w-[84px] max-w-[96px] shrink-0 group"
              >
                <img
                  src={safeMediaUrl(ch.channelAvatar)}
                  alt={ch.channelTitle}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 group-hover:border-red-600 transition-colors"
                />
                <span className="text-xs font-medium truncate w-full text-center">
                  {ch.channelTitle}
                </span>
                <span className="text-[10px] text-neutral-500 tabular-nums">
                  {formatSubscribers(ch.subscriberCount)}
                </span>
              </button>
            ))}
          </div>

          {/* Latest Uploads */}
          {videos.length === 0 ? (
            <p className="text-sm text-neutral-500 py-8">
              No recent uploads found from your subscribed channels yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {videos.map((v) => (
                <VideoCard
                  key={v.key}
                  video={v}
                  isInWatchLater={watchLaterIds.has(v.key)}
                  onPlay={onPlayVideo}
                  onToggleWatchLater={onToggleWatchLater}
                  onOpenPlaylistModal={onOpenPlaylistModal}
                  onOpenShareModal={onOpenShareModal}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface LocalCollectionViewProps {
  title: string;
  emptyMessage: string;
  videos: VideoItem[];
  progressMap?: Map<string, number>;
  watchLaterIds: Set<string>;
  onClearAll?: () => void;
  onRemoveItem?: (videoKey: string) => void;
  onPlayVideo: (video: VideoItem) => void;
  onChannelClick: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenPlaylistModal: (video: VideoItem) => void;
  onOpenShareModal: (video: VideoItem) => void;
}

export const LocalCollectionView: React.FC<LocalCollectionViewProps> = ({
  title,
  emptyMessage,
  videos,
  progressMap,
  watchLaterIds,
  onClearAll,
  onRemoveItem,
  onPlayVideo,
  onChannelClick,
  onToggleWatchLater,
  onOpenPlaylistModal,
  onOpenShareModal,
}) => (
  <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-5 pb-20 md:pb-12 space-y-5">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-xs text-neutral-500 tabular-nums mt-0.5">
          {videos.length} {videos.length === 1 ? 'video' : 'videos'}
        </p>
      </div>
      {onClearAll && videos.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="px-3.5 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-red-600 flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear all</span>
        </button>
      )}
    </div>

    {videos.length === 0 ? (
      <div className="p-12 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800 text-sm text-neutral-500">
        {emptyMessage}
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {videos.map((v) => (
          <div key={v.key} className="relative">
            <VideoCard
              video={v}
              progressSeconds={progressMap?.get(v.key)}
              isInWatchLater={watchLaterIds.has(v.key)}
              onPlay={onPlayVideo}
              onChannelClick={onChannelClick}
              onToggleWatchLater={onToggleWatchLater}
              onOpenPlaylistModal={onOpenPlaylistModal}
              onOpenShareModal={onOpenShareModal}
            />
            {onRemoveItem && (
              <button
                type="button"
                onClick={() => onRemoveItem(v.key)}
                className="mt-1.5 text-xs text-neutral-500 hover:text-red-600 font-medium"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

interface PlaylistsViewProps {
  playlists: LocalPlaylist[];
  watchLaterIds: Set<string>;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onPlayVideo: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenPlaylistModal: (video: VideoItem) => void;
  onOpenShareModal: (video: VideoItem) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  playlists,
  watchLaterIds,
  onCreatePlaylist,
  onDeletePlaylist,
  onPlayVideo,
  onToggleWatchLater,
  onOpenPlaylistModal,
  onOpenShareModal,
}) => {
  const [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(playlists[0]?.id || null);

  const selected = playlists.find((p) => p.id === selectedId) || playlists[0] || null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreatePlaylist(newName.trim());
    setNewName('');
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-5 pb-20 md:pb-12 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Saved Playlists</h1>
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist name..."
            className="rounded-full border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-1.5 text-sm focus:outline-none focus:border-red-600"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </form>
      </div>

      {playlists.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <ListVideo className="w-10 h-10 mx-auto text-neutral-400 mb-3" />
          <p className="text-sm text-neutral-500">
            No playlists created yet. Create one above or click &ldquo;Save&rdquo; on any video.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm ${
                  selected?.id === pl.id
                    ? 'border-red-600 bg-red-50 dark:bg-red-950/30 text-red-600 font-semibold'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <button type="button" onClick={() => setSelectedId(pl.id)}>
                  {pl.name} ({pl.videos.length})
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePlaylist(pl.id)}
                  aria-label={`Delete ${pl.name}`}
                  className="text-neutral-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {selected && (
            selected.videos.length === 0 ? (
              <p className="text-sm text-neutral-500 py-8">
                This playlist is empty. Click &ldquo;Save&rdquo; on any video to add it here.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {selected.videos.map((v) => (
                  <VideoCard
                    key={v.key}
                    video={v}
                    isInWatchLater={watchLaterIds.has(v.key)}
                    onPlay={onPlayVideo}
                    onToggleWatchLater={onToggleWatchLater}
                    onOpenPlaylistModal={onOpenPlaylistModal}
                    onOpenShareModal={onOpenShareModal}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export function historyToVideoList(entries: WatchHistoryEntry[]): {
  videos: VideoItem[];
  progressMap: Map<string, number>;
} {
  const progressMap = new Map<string, number>();
  const videos: VideoItem[] = [];
  for (const e of entries) {
    videos.push(e.video);
    if (e.progressSeconds > 0) progressMap.set(e.video.key, e.progressSeconds);
  }
  return { videos, progressMap };
}
