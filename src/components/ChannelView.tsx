import React, { useEffect, useState } from 'react';
import { Bell, Camera, Check, Edit3, Palette, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { BRAND_THEMES, type BrandThemeId } from '../lib/themes';
import {
  formatSubscribers,
  safeMediaUrl,
  type ChannelProfile,
  type LocalPlaylist,
  type UserProfile,
  type VideoItem,
} from '../types';
import { VideoCard } from './VideoCard';

interface ChannelViewProps {
  channelId: string;
  currentUser: UserProfile | null;
  playlists: LocalPlaylist[];
  watchLaterIds: Set<string>;
  brandTheme: BrandThemeId;
  onChangeBrandTheme: (id: BrandThemeId) => void;
  onUserUpdated: (user: UserProfile) => void;
  onPlayVideo: (video: VideoItem) => void;
  onNavigateUpload: () => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenPlaylistModal: (video: VideoItem) => void;
  onOpenShareModal: (video: VideoItem) => void;
  onRequireAuth: () => void;
}

export const ChannelView: React.FC<ChannelViewProps> = ({
  channelId,
  currentUser,
  playlists,
  watchLaterIds,
  brandTheme,
  onChangeBrandTheme,
  onUserUpdated,
  onPlayVideo,
  onNavigateUpload,
  onToggleWatchLater,
  onOpenPlaylistModal,
  onOpenShareModal,
  onRequireAuth,
}) => {
  const [channel, setChannel] = useState<ChannelProfile | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'shorts' | 'playlists' | 'about'>('videos');
  const [editOpen, setEditOpen] = useState(false);

  const [accountName, setAccountName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadChannel = async () => {
    setLoading(true);
    try {
      const res = await api.getChannel(channelId);
      setChannel(res.channel);
      setVideos(res.videos);
    } catch {
      setChannel(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannel();
  }, [channelId, currentUser?.id]);

  const isOwner = Boolean(currentUser && channel && currentUser.id === channel.id);

  const openCustomize = () => {
    if (!currentUser) return;
    setAccountName(currentUser.accountName);
    setChannelName(currentUser.channelName);
    setUsername(currentUser.username);
    setBio(currentUser.bio);
    setAvatarFile(null);
    setBannerFile(null);
    setError('');
    setEditOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('accountName', accountName.trim());
      fd.append('channelName', channelName.trim());
      fd.append('username', username.trim());
      fd.append('bio', bio.trim());
      if (avatarFile) fd.append('avatar', avatarFile);
      if (bannerFile) fd.append('banner', bannerFile);

      const res = await api.updateProfile(fd);
      onUserUpdated(res.user);
      setEditOpen(false);
      loadChannel();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubscribe = async () => {
    if (!channel) return;
    if (!currentUser) return onRequireAuth();
    const res = await api.toggleSubscription({
      channelId: channel.id,
      channelTitle: channel.channelName,
      channelAvatar: channel.avatarUrl,
    });
    setChannel((prev) =>
      prev
        ? {
            ...prev,
            isSubscribed: res.subscribed,
            subscriberCount: res.subscriberCount,
          }
        : prev
    );
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="h-44 rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
        <div className="h-20 w-80 rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-bold">Channel not found</h2>
        <p className="text-sm text-neutral-500 mt-1">
          This channel may belong to an external YouTube creator or does not exist.
        </p>
      </div>
    );
  }

  const standardVideos = videos.filter((v) => !v.isShort);
  const shortVideos = videos.filter((v) => v.isShort);

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-6 py-4 pb-20 md:pb-12 space-y-6">
      {/* Channel Banner with Theme Gradient Accent */}
      <div className="relative h-36 sm:h-48 md:h-60 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <img
          src={safeMediaUrl(channel.bannerUrl)}
          alt={`${channel.channelName} cover`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: 'var(--color-red-600, #DC2626)' }}
        />
      </div>

      {/* Channel Identity */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={safeMediaUrl(channel.avatarUrl)}
            alt={channel.channelName}
            referrerPolicy="no-referrer"
            className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-red-600 ring-4 ring-white dark:ring-[#0F0F0F] shrink-0 shadow-md"
          />
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">{channel.channelName}</h1>
            <p className="text-xs md:text-sm text-neutral-500 mt-0.5 tabular-nums">
              @{channel.username} · {formatSubscribers(channel.subscriberCount)} · {videos.length} videos
            </p>
            {channel.bio && (
              <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2 line-clamp-2 max-w-xl">
                {channel.bio}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={openCustomize}
                className="h-9 px-4 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs md:text-sm font-semibold flex items-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                <span>Customize Channel</span>
              </button>
              <button
                type="button"
                onClick={onNavigateUpload}
                className="h-9 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Upload</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSubscribe}
              className={`h-10 px-5 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors ${
                channel.isSubscribed
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {channel.isSubscribed && <Bell className="w-4 h-4" />}
              <span>{channel.isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Attractive Channel Theme & Design Studio Strip */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-[#16171C] p-3.5 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-900 dark:text-white">
              Channel Theme &amp; Color Model
            </p>
            <p className="text-[11px] text-neutral-500">
              Preview an attractive theme across your channel header, buttons &amp; 3D studio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 md:pb-0">
          {BRAND_THEMES.map((item) => {
            const active = brandTheme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeBrandTheme(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'border-red-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.swatch }}
                />
                <span>{item.name.split(' ')[0]}</span>
                {active && <Check className="w-3.5 h-3.5 text-red-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'videos', label: `Videos (${standardVideos.length})` },
            { id: 'shorts', label: `Shorts (${shortVideos.length})` },
            ...(isOwner ? [{ id: 'playlists', label: `Playlists (${playlists.length})` }] : []),
            { id: 'about', label: 'About' },
          ] as { id: 'videos' | 'shorts' | 'playlists' | 'about'; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'videos' && (
        standardVideos.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No standard videos published on this channel yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {standardVideos.map((v) => (
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

      {activeTab === 'shorts' && (
        shortVideos.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No Shorts published on this channel yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {shortVideos.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onPlayVideo(s)}
                className="group text-left"
              >
                <div className="aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
                  {safeMediaUrl(s.thumbnailUrl) ? (
                    <img
                      src={safeMediaUrl(s.thumbnailUrl)}
                      alt={s.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <video
                      src={safeMediaUrl(s.videoUrl)}
                      muted
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <h3 className="text-sm font-semibold mt-2 line-clamp-2">{s.title}</h3>
              </button>
            ))}
          </div>
        )
      )}

      {activeTab === 'playlists' && (
        playlists.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            No saved playlists yet. Click &ldquo;Save&rdquo; on any video to organize a playlist.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-2"
              >
                <h3 className="font-bold text-base">{pl.name}</h3>
                <p className="text-xs text-neutral-500 tabular-nums">{pl.videos.length} videos</p>
                {pl.videos[0] && (
                  <button
                    type="button"
                    onClick={() => onPlayVideo(pl.videos[0])}
                    className="mt-2 text-xs font-semibold text-red-600 hover:underline"
                  >
                    Play first video
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'about' && (
        <div className="max-w-2xl space-y-4 py-2 text-sm">
          <div>
            <h3 className="font-bold mb-1">Description</h3>
            <p className="text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">
              {channel.bio || 'No channel bio yet.'}
            </p>
          </div>
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-1 text-neutral-500 tabular-nums">
            <p>Channel owner: {channel.accountName}</p>
            <p>Joined {new Date(channel.createdAt).toLocaleDateString()}</p>
            <p>{formatSubscribers(channel.subscriberCount)}</p>
          </div>
        </div>
      )}

      {/* Customize Profile / Channel Settings Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProfile}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto thin-scrollbar rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Account &amp; Channel Settings</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-xs text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">Account Name</label>
              <input
                type="text"
                required
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Channel Name</label>
              <input
                type="text"
                required
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Username (@handle)</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Channel Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <Camera className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-xs font-medium truncate">
                  {avatarFile ? avatarFile.name : 'Change Profile Picture'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800">
                <Camera className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-xs font-medium truncate">
                  {bannerFile ? bannerFile.name : 'Change Cover Photo'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
