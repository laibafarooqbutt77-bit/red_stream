import React, { useState } from 'react';
import { Check, Clock, Copy, FolderPlus, X } from 'lucide-react';
import type { LocalPlaylist, VideoItem } from '../types';

interface PlaylistModalProps {
  video: VideoItem | null;
  playlists: LocalPlaylist[];
  isInWatchLater: boolean;
  onClose: () => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onToggleInPlaylist: (playlistId: string, video: VideoItem) => void;
  onCreatePlaylist: (name: string) => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  video,
  playlists,
  isInWatchLater,
  onClose,
  onToggleWatchLater,
  onToggleInPlaylist,
  onCreatePlaylist,
}) => {
  const [newName, setNewName] = useState('');

  if (!video) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreatePlaylist(newName.trim());
    setNewName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Save video to...</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto thin-scrollbar">
          <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer">
            <input
              type="checkbox"
              checked={isInWatchLater}
              onChange={() => onToggleWatchLater(video)}
              className="accent-red-600 w-4 h-4"
            />
            <Clock className="w-4 h-4 text-neutral-500" />
            <span className="text-sm font-medium">Watch Later</span>
          </label>

          {playlists.map((pl) => {
            const checked = pl.videos.some((v) => v.key === video.key);
            return (
              <label
                key={pl.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleInPlaylist(pl.id, video)}
                  className="accent-red-600 w-4 h-4"
                />
                <span className="text-sm font-medium truncate flex-1">{pl.name}</span>
                <span className="text-xs text-neutral-400 tabular-nums">{pl.videos.length}</span>
              </label>
            );
          })}
        </div>

        <form onSubmit={handleCreate} className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Create new playlist..."
            className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:border-red-600"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      </div>
    </div>
  );
};

interface ShareModalProps {
  video: VideoItem | null;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ video, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!video) return null;

  const shareUrl =
    video.source === 'youtube' && video.youtubeId
      ? `https://www.youtube.com/watch?v=${video.youtubeId}`
      : `${window.location.origin}/?watch=${encodeURIComponent(video.key)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback selection
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Share Video</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-neutral-500 line-clamp-2">{video.title}</p>

        <div className="flex items-center gap-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#121212] p-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onClick={(e) => e.currentTarget.select()}
            className="flex-1 bg-transparent text-xs font-mono text-neutral-800 dark:text-neutral-200 focus:outline-none px-1"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
