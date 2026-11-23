import React, { useState } from 'react';
import { Clock, ListPlus, MoreVertical, Play, Share2 } from 'lucide-react';
import {
  formatRelativeTime,
  formatViews,
  safeMediaUrl,
  type VideoItem,
} from '../types';

interface VideoCardProps {
  video: VideoItem;
  progressSeconds?: number;
  isInWatchLater?: boolean;
  onPlay: (video: VideoItem) => void;
  onChannelClick?: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenPlaylistModal: (video: VideoItem) => void;
  onOpenShareModal: (video: VideoItem) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  progressSeconds,
  isInWatchLater,
  onPlay,
  onChannelClick,
  onToggleWatchLater,
  onOpenPlaylistModal,
  onOpenShareModal,
}) => {
  const [thumbError, setThumbError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const thumbUrl = safeMediaUrl(video.thumbnailUrl);
  const avatarUrl = safeMediaUrl(video.channelAvatar);
  const progressPct =
    progressSeconds && video.durationSeconds > 0
      ? Math.min(100, Math.round((progressSeconds / video.durationSeconds) * 100))
      : 0;

  return (
    <article className="group flex flex-col">
      {/* 16:9 Thumbnail Frame */}
      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-200 dark:bg-[#131826] border border-slate-200/80 dark:border-slate-800/90 group-hover:border-red-500/60 transition-colors shadow-xs">
        <button
          type="button"
          onClick={() => onPlay(video)}
          className="w-full h-full block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        >
          {thumbUrl && !thumbError ? (
            <img
              src={thumbUrl}
              alt={video.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setThumbError(true)}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 via-neutral-900 to-red-950 text-white p-4 text-center">
              <Play className="w-9 h-9 text-red-500 mb-2" />
              <span className="text-xs font-medium text-neutral-300 line-clamp-2">{video.title}</span>
            </div>
          )}

          {/* Duration Overlay */}
          {video.durationLabel && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-mono font-medium tabular-nums">
              {video.isShort ? 'SHORT' : video.durationLabel}
            </span>
          )}

          {/* Continue Watching Progress Bar */}
          {progressPct > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-700/60">
              <div className="h-full bg-red-600" style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </button>
      </div>

      {/* Metadata Row */}
      <div className="flex items-start gap-3 mt-3 relative">
        <button
          type="button"
          onClick={() => (onChannelClick ? onChannelClick(video) : onPlay(video))}
          aria-label={`Open ${video.channelTitle}`}
          className="shrink-0 mt-0.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        >
          {avatarUrl && !avatarError ? (
            <img
              src={avatarUrl}
              alt={video.channelTitle}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-9 h-9 rounded-full object-cover bg-neutral-200 dark:bg-neutral-800"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center justify-center text-sm font-bold">
              {video.channelTitle.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => onPlay(video)}
            className="text-left w-full focus-visible:outline-none"
          >
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
              {video.title}
            </h3>
          </button>

          <button
            type="button"
            onClick={() => (onChannelClick ? onChannelClick(video) : onPlay(video))}
            className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 truncate block max-w-full text-left"
          >
            {video.channelTitle}
          </button>

          {/* Unboxed clean metadata with typographic separator */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums truncate">
            <span>{formatViews(video.views)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeTime(video.publishedAt)}</span>
          </div>
        </div>

        {/* 3-dot Quick Actions */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            aria-label="Video options"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 bottom-full mb-1 w-48 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 shadow-xl py-1.5 z-40">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleWatchLater(video);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                >
                  <Clock className="w-4 h-4 text-neutral-500" />
                  <span>{isInWatchLater ? 'Remove Watch Later' : 'Save to Watch Later'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenPlaylistModal(video);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                >
                  <ListPlus className="w-4 h-4 text-neutral-500" />
                  <span>Save to playlist</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenShareModal(video);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                >
                  <Share2 className="w-4 h-4 text-neutral-500" />
                  <span>Share</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
};
