import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Film,
  Image as ImageIcon,
  Play,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  CATEGORIES,
  formatRelativeTime,
  formatViews,
  safeMediaUrl,
  type UserProfile,
  type VideoItem,
} from '../types';

interface UploadStudioProps {
  user: UserProfile | null;
  defaultShortMode?: boolean;
  onRequireAuth: () => void;
  onPlayVideo: (video: VideoItem) => void;
  onVideosChanged: () => void;
}

const UPLOAD_CATEGORIES = CATEGORIES.filter((c) => !['All', 'Trending Videos', 'Shorts'].includes(c));

export const UploadStudio: React.FC<UploadStudioProps> = ({
  user,
  defaultShortMode = false,
  onRequireAuth,
  onPlayVideo,
  onVideosChanged,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Entertainment');
  const [tags, setTags] = useState('');
  const [isShort, setIsShort] = useState(defaultShortMode);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [myVideos, setMyVideos] = useState<VideoItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('Entertainment');
  const [editTags, setEditTags] = useState('');
  const [editIsShort, setEditIsShort] = useState(false);
  const [editThumb, setEditThumb] = useState<File | null>(null);

  useEffect(() => {
    setIsShort(defaultShortMode);
  }, [defaultShortMode]);

  const fetchMyVideos = async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const res = await api.listLocalVideos({ userId: user.id });
      setMyVideos(res.items);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchMyVideos();
  }, [user?.id]);

  const handleVideoFileChange = (file: File | null) => {
    setVideoFile(file);
    setError('');
    setSuccessMsg('');
    if (!file) {
      setDurationSeconds(0);
      return;
    }
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    }
    // Extract duration safely via temporary object URL
    const objUrl = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      setDurationSeconds(Math.round(probe.duration || 0));
      if (probe.videoHeight > probe.videoWidth && probe.duration <= 65) {
        setIsShort(true);
      }
      URL.revokeObjectURL(objUrl);
    };
    probe.onerror = () => URL.revokeObjectURL(objUrl);
    probe.src = objUrl;
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return onRequireAuth();
    if (!videoFile) {
      setError('Please choose an MP4, WebM, or MOV video file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title for your video.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError('');
    setSuccessMsg('');

    try {
      const fd = new FormData();
      fd.append('video', videoFile);
      if (thumbnailFile) fd.append('thumbnail', thumbnailFile);
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('category', category);
      fd.append('tags', tags);
      fd.append('isShort', String(isShort));
      fd.append('durationSeconds', String(durationSeconds));

      const res = await api.uploadVideoWithProgress(fd, setProgress);
      setMyVideos((prev) => [res.video, ...prev]);
      setSuccessMsg(`"${res.video.title}" uploaded and published!`);
      setTitle('');
      setDescription('');
      setTags('');
      setVideoFile(null);
      setThumbnailFile(null);
      setDurationSeconds(0);
      onVideosChanged();
    } catch (err: any) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteLocalVideo(id);
      setMyVideos((prev) => prev.filter((v) => v.id !== id));
      onVideosChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditModal = (v: VideoItem) => {
    setEditingVideo(v);
    setEditTitle(v.title);
    setEditDesc(v.description);
    setEditCategory(v.category);
    setEditTags(v.tags.join(', '));
    setEditIsShort(v.isShort);
    setEditThumb(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;
    try {
      const fd = new FormData();
      fd.append('title', editTitle.trim());
      fd.append('description', editDesc.trim());
      fd.append('category', editCategory);
      fd.append('tags', editTags);
      fd.append('isShort', String(editIsShort));
      if (editThumb) fd.append('thumbnail', editThumb);

      const res = await api.updateLocalVideo(editingVideo.id, fd);
      setMyVideos((prev) => prev.map((v) => (v.id === editingVideo.id ? res.video : v)));
      setEditingVideo(null);
      onVideosChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161616]">
          <img
            src="/src/assets/images/creator_studio_banner_1795436424458.jpg"
            alt="RedStream Creator Studio"
            className="w-full h-56 object-cover"
          />
          <div className="p-8 text-center">
            <h1 className="text-2xl font-bold">Creator Studio</h1>
            <p className="text-sm text-neutral-500 mt-2 max-w-md mx-auto">
              Sign in or create a free RedStream account to upload MP4 and WebM videos, publish vertical Shorts, and manage your channel.
            </p>
            <button
              type="button"
              onClick={onRequireAuth}
              className="mt-6 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
            >
              Sign in to Upload
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-20 md:pb-12 space-y-8">
      {/* Studio Header Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-white">
        <img
          src="/src/assets/images/creator_studio_banner_1795436424458.jpg"
          alt="Creator Studio"
          className="w-full h-40 object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent p-6 flex flex-col justify-center">
          <h1 className="text-2xl font-bold tracking-tight">Creator Studio</h1>
          <p className="text-sm text-neutral-300 mt-1">
            Publish HD videos and vertical Shorts directly to {user.channelName}.
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <form
        onSubmit={handleUploadSubmit}
        className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161616] p-5 md:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Upload New Video</h2>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setIsShort(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                !isShort ? 'bg-white dark:bg-[#121212] text-red-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              Standard Video (16:9)
            </button>
            <button
              type="button"
              onClick={() => setIsShort(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isShort ? 'bg-white dark:bg-[#121212] text-red-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              Short (9:16)
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* File Dropzone */}
          <div className="space-y-4">
            <label className="block rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-red-500 transition-colors p-6 text-center cursor-pointer bg-neutral-50 dark:bg-[#121212]">
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => handleVideoFileChange(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Film className="w-10 h-10 mx-auto text-red-600 mb-2" />
              <p className="text-sm font-semibold">
                {videoFile ? videoFile.name : 'Select MP4, WebM, or MOV video'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {videoFile
                  ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB · ${durationSeconds}s`
                  : 'Maximum file size 200 MB'}
              </p>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3.5 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900">
              <ImageIcon className="w-5 h-5 text-neutral-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">
                  {thumbnailFile ? thumbnailFile.name : 'Optional custom thumbnail (JPG, PNG, WebP)'}
                </p>
                <p className="text-[11px] text-neutral-500">Recommended 1280×720 for videos</p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          {/* Metadata Fields */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a clear, descriptive title"
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm focus:outline-none focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell viewers about your video..."
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm focus:outline-none focus:border-red-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-3 py-2 text-sm focus:outline-none focus:border-red-600"
                >
                  {UPLOAD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="vlog, tutorial, music"
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3.5 py-2 text-sm focus:outline-none focus:border-red-600"
                />
              </div>
            </div>
          </div>
        </div>

        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium tabular-nums">
              <span>Uploading video...</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Publish Video'}</span>
          </button>
        </div>
      </form>

      {/* Manage Uploaded Videos */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161616] overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h2 className="text-base font-bold">Your Uploaded Content ({myVideos.length})</h2>
        </div>

        {loadingList ? (
          <div className="p-8 text-center text-sm text-neutral-500">Loading your videos...</div>
        ) : myVideos.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            You haven&apos;t uploaded any videos yet. Use the form above to publish your first video or Short.
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {myVideos.map((v) => (
              <div
                key={v.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onPlayVideo(v)}
                    className="relative w-32 aspect-video rounded-lg overflow-hidden bg-neutral-900 shrink-0 group"
                  >
                    {safeMediaUrl(v.thumbnailUrl) ? (
                      <img
                        src={safeMediaUrl(v.thumbnailUrl)}
                        alt={v.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        <Play className="w-5 h-5" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-white text-[10px] font-mono">
                      {v.isShort ? 'SHORT' : v.durationLabel}
                    </span>
                  </button>

                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onPlayVideo(v)}
                      className="text-sm font-semibold hover:text-red-600 text-left line-clamp-1"
                    >
                      {v.title}
                    </button>
                    <p className="text-xs text-neutral-500 mt-1 tabular-nums">
                      {v.category} · {formatViews(v.views)} · {formatRelativeTime(v.publishedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => openEditModal(v)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit Video Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Edit Video Details</h3>
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Description</label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-3 py-2 text-sm"
                >
                  {UPLOAD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Format</label>
                <select
                  value={editIsShort ? 'short' : 'video'}
                  onChange={(e) => setEditIsShort(e.target.value === 'short')}
                  className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-3 py-2 text-sm"
                >
                  <option value="video">Standard Video</option>
                  <option value="short">Short (9:16)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Tags</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Replace Thumbnail</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setEditThumb(e.target.files?.[0] || null)}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 rounded-full text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
