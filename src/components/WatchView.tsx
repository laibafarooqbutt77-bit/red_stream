import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  Clock,
  Edit3,
  ListPlus,
  MessageSquare,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  formatRelativeTime,
  formatSubscribers,
  formatViews,
  safeMediaUrl,
  type CommentItem,
  type UserProfile,
  type VideoItem,
} from '../types';
import { VideoPlayer } from './VideoPlayer';

interface WatchViewProps {
  video: VideoItem;
  relatedVideos: VideoItem[];
  user: UserProfile | null;
  autoplay: boolean;
  theaterMode: boolean;
  initialTimeSeconds?: number;
  isInWatchLater: boolean;
  onToggleAutoplay: () => void;
  onToggleTheaterMode: () => void;
  onProgressUpdate: (seconds: number, duration: number) => void;
  onPlayVideo: (video: VideoItem) => void;
  onOpenChannel: (video: VideoItem) => void;
  onToggleWatchLater: (video: VideoItem) => void;
  onOpenPlaylistModal: (video: VideoItem) => void;
  onOpenShareModal: (video: VideoItem) => void;
  onLikedSync: (video: VideoItem, liked: boolean) => void;
  onRequireAuth: () => void;
}

export const WatchView: React.FC<WatchViewProps> = ({
  video,
  relatedVideos,
  user,
  autoplay,
  theaterMode,
  initialTimeSeconds,
  isInWatchLater,
  onToggleAutoplay,
  onToggleTheaterMode,
  onProgressUpdate,
  onPlayVideo,
  onOpenChannel,
  onToggleWatchLater,
  onOpenPlaylistModal,
  onOpenShareModal,
  onLikedSync,
  onRequireAuth,
}) => {
  const [likes, setLikes] = useState(video.likes || 0);
  const [dislikes, setDislikes] = useState(0);
  const [userReaction, setUserReaction] = useState(0);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subCount, setSubCount] = useState(video.subscriberCount || 0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [actionError, setActionError] = useState('');

  // Load interactions & subscription state
  useEffect(() => {
    let active = true;
    setActionError('');
    setDescExpanded(false);

    const loadData = async () => {
      try {
        const [inter, sub] = await Promise.all([
          api.getInteractions(video.key),
          api.getSubscriptionStatus(video.channelId),
        ]);
        if (!active) return;
        setLikes((video.source === 'youtube' ? video.likes : 0) + inter.likes);
        setDislikes(inter.dislikes);
        setUserReaction(inter.userReaction);
        setComments(inter.comments);
        setIsSubscribed(sub.isSubscribed);
        setSubCount(
          video.source === 'local'
            ? sub.subscriberDelta
            : (video.subscriberCount || 0) + sub.subscriberDelta
        );
      } catch {
        // Keep base metadata on offline/transient error
      }
    };
    loadData();

    if (video.source === 'local') {
      api.recordLocalView(video.id).catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [video.key, user?.id]);

  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments]
  );

  const repliesMap = useMemo(() => {
    const map = new Map<string, CommentItem[]>();
    for (const c of comments) {
      if (c.parentId) {
        const list = map.get(c.parentId) || [];
        list.push(c);
        map.set(c.parentId, list);
      }
    }
    // Sort replies chronologically
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return map;
  }, [comments]);

  const handleVideoReact = async (value: 1 | -1) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await api.reactToVideo(video.key, value);
      setLikes((video.source === 'youtube' ? video.likes : 0) + res.likes);
      setDislikes(res.dislikes);
      setUserReaction(res.userReaction);
      onLikedSync(video, res.userReaction === 1);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleToggleSubscribe = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (video.channelId === user.id) {
      setActionError('You cannot subscribe to your own channel.');
      return;
    }
    try {
      const res = await api.toggleSubscription({
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        channelAvatar: video.channelAvatar,
      });
      setIsSubscribed(res.subscribed);
      setSubCount(
        video.source === 'local'
          ? res.subscriberCount
          : (video.subscriberCount || 0) + res.subscriberCount
      );
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handlePostComment = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    const text = (parentId ? replyText : commentText).trim();
    if (!text) return;

    setSubmittingComment(true);
    try {
      const res = await api.addComment(video.key, text, parentId);
      setComments((prev) => [res.comment, ...prev]);
      if (parentId) {
        setReplyText('');
        setReplyingToId(null);
      } else {
        setCommentText('');
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    try {
      const res = await api.editComment(commentId, trimmed);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, content: res.content, updatedAt: res.updatedAt } : c))
      );
      setEditingId(null);
      setEditText('');
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parentId !== commentId));
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCommentReact = async (commentId: string, value: 1 | -1) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await api.reactToComment(commentId, value);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, likes: res.likes, dislikes: res.dislikes, userReaction: res.userReaction }
            : c
        )
      );
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleAutoplayEnd = () => {
    if (autoplay && relatedVideos.length > 0) {
      onPlayVideo(relatedVideos[0]);
    }
  };

  const renderCommentNode = (comment: CommentItem, isReply = false) => {
    const isOwner = user?.id === comment.userId;
    const replies = repliesMap.get(comment.id) || [];

    return (
      <div key={comment.id} className={`${isReply ? 'mt-3 pl-3 border-l border-neutral-200 dark:border-neutral-800' : ''}`}>
        <div className="flex items-start gap-3">
          <img
            src={safeMediaUrl(comment.authorAvatar)}
            alt={comment.authorName}
            referrerPolicy="no-referrer"
            className={`${isReply ? 'w-7 h-7' : 'w-9 h-9'} rounded-full object-cover shrink-0 bg-neutral-200 dark:bg-neutral-800`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {comment.authorName}
              </span>
              <span className="text-neutral-500">{formatRelativeTime(comment.createdAt)}</span>
              {comment.updatedAt !== comment.createdAt && (
                <span className="text-neutral-400">(edited)</span>
              )}
            </div>

            {editingId === comment.id ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] p-2.5 text-sm focus:outline-none focus:border-red-600"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(comment.id)}
                    className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            )}

            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => handleCommentReact(comment.id, 1)}
                className={`flex items-center gap-1 text-xs py-1 px-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  comment.userReaction === 1 ? 'text-red-600 font-semibold' : 'text-neutral-500'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">{comment.likes > 0 ? comment.likes : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCommentReact(comment.id, -1)}
                aria-label="Dislike comment"
                className={`flex items-center gap-1 text-xs py-1 px-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  comment.userReaction === -1 ? 'text-red-600 font-semibold' : 'text-neutral-500'
                }`}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>

              {!isReply && (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) return onRequireAuth();
                    setReplyingToId(replyingToId === comment.id ? null : comment.id);
                    setReplyText('');
                  }}
                  className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Reply
                </button>
              )}

              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditText(comment.content);
                    }}
                    aria-label="Edit comment"
                    className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white p-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment.id)}
                    aria-label="Delete comment"
                    className="text-xs text-neutral-500 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {replyingToId === comment.id && (
              <form onSubmit={(e) => handlePostComment(e, comment.id)} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 border-b border-neutral-300 dark:border-neutral-700 bg-transparent py-1.5 text-sm focus:outline-none focus:border-red-600"
                />
                <button
                  type="button"
                  onClick={() => setReplyingToId(null)}
                  className="px-3 py-1 rounded-full text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!replyText.trim() || submittingComment}
                  className="px-3.5 py-1 rounded-full bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  Reply
                </button>
              </form>
            )}

            {replies.length > 0 && (
              <div className="mt-2">{replies.map((r) => renderCommentNode(r, true))}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 pb-20 md:pb-10">
      {/* Theater mode spans player full width above the 2-col split */}
      {theaterMode && (
        <div className="mb-5">
          <VideoPlayer
            video={video}
            autoplay={autoplay}
            theaterMode={true}
            initialTimeSeconds={initialTimeSeconds}
            onToggleTheaterMode={onToggleTheaterMode}
            onProgressUpdate={onProgressUpdate}
            onEnded={handleAutoplayEnd}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Column */}
        <div className="lg:col-span-8 space-y-4">
          {!theaterMode && (
            <VideoPlayer
              video={video}
              autoplay={autoplay}
              theaterMode={false}
              initialTimeSeconds={initialTimeSeconds}
              onToggleTheaterMode={onToggleTheaterMode}
              onProgressUpdate={onProgressUpdate}
              onEnded={handleAutoplayEnd}
            />
          )}

          <h1 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white leading-snug">
            {video.title}
          </h1>

          {actionError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {actionError}
            </div>
          )}

          {/* Channel Bar + Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => onOpenChannel(video)}
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <img
                  src={safeMediaUrl(video.channelAvatar)}
                  alt={video.channelTitle}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover bg-neutral-200 dark:bg-neutral-800"
                />
              </button>

              <div className="min-w-0 mr-2">
                <button
                  type="button"
                  onClick={() => onOpenChannel(video)}
                  className="text-sm font-bold text-neutral-900 dark:text-white hover:text-red-600 truncate block max-w-[200px]"
                >
                  {video.channelTitle}
                </button>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                  {formatSubscribers(subCount)}
                </span>
              </div>

              {user?.id !== video.channelId && (
                <button
                  type="button"
                  onClick={handleToggleSubscribe}
                  className={`h-9 px-4 rounded-full text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    isSubscribed
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isSubscribed && <Bell className="w-4 h-4" />}
                  <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {/* Like / Dislike Segmented Control */}
              <div className="flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => handleVideoReact(1)}
                  className={`h-9 px-3.5 flex items-center gap-1.5 text-xs md:text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${
                    userReaction === 1 ? 'text-red-600 font-semibold' : 'text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="font-mono tabular-nums">{likes > 0 ? formatViews(likes).replace(' views', '') : 'Like'}</span>
                </button>
                <div className="w-px h-5 bg-neutral-300 dark:bg-neutral-700" />
                <button
                  type="button"
                  onClick={() => handleVideoReact(-1)}
                  aria-label="Dislike video"
                  className={`h-9 px-3 flex items-center gap-1 text-xs md:text-sm hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${
                    userReaction === -1 ? 'text-red-600 font-semibold' : 'text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  {dislikes > 0 && <span className="font-mono tabular-nums">{dislikes}</span>}
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenShareModal(video)}
                className="h-9 px-3.5 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs md:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleWatchLater(video)}
                className={`h-9 px-3.5 rounded-full text-xs md:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  isInWatchLater
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {isInWatchLater ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                <span>Watch Later</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenPlaylistModal(video)}
                className="h-9 px-3.5 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs md:text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <ListPlus className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Video Description Box */}
          <div className="rounded-xl bg-neutral-100 dark:bg-[#1A1A1A] p-3.5 md:p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
              <span>{formatViews(video.views)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(video.publishedAt)}</span>
              <span aria-hidden="true">·</span>
              <span className="text-neutral-600 dark:text-neutral-400 font-medium">{video.category}</span>
            </div>

            <p
              className={`mt-2 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words leading-relaxed ${
                descExpanded ? '' : 'line-clamp-3'
              }`}
            >
              {video.description || 'No description provided.'}
            </p>

            {video.tags.length > 0 && descExpanded && (
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                Tags: {video.tags.join(' · ')}
              </p>
            )}

            {(video.description.length > 140 || video.tags.length > 0) && (
              <button
                type="button"
                onClick={() => setDescExpanded((p) => !p)}
                className="mt-2 text-xs font-bold text-neutral-900 dark:text-white hover:underline"
              >
                {descExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          {/* Comments Section */}
          <section aria-label="Comments" className="pt-2 space-y-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
              <h2 className="text-base font-bold tabular-nums">
                {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
              </h2>
            </div>

            {/* New Comment Form */}
            <form onSubmit={(e) => handlePostComment(e, null)} className="flex items-start gap-3">
              {user ? (
                <img
                  src={safeMediaUrl(user.avatarUrl)}
                  alt={user.channelName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 shrink-0" />
              )}
              <div className="flex-1">
                <input
                  type="text"
                  value={commentText}
                  onFocus={() => {
                    if (!user) onRequireAuth();
                  }}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={user ? 'Add a comment...' : 'Sign in to add a comment...'}
                  className="w-full border-b border-neutral-300 dark:border-neutral-700 bg-transparent py-2 text-sm focus:outline-none focus:border-red-600"
                />
                {commentText.trim() && (
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setCommentText('')}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingComment}
                      className="px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      Comment
                    </button>
                  </div>
                )}
              </div>
            </form>

            {/* Comments List */}
            {topLevelComments.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4">
                No comments yet. Start the conversation below.
              </p>
            ) : (
              <div className="space-y-5">
                {topLevelComments.map((c) => renderCommentNode(c, false))}
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar: Autoplay & Related Videos */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold">Up Next</h2>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <span>Autoplay</span>
              <input
                type="checkbox"
                checked={autoplay}
                onChange={onToggleAutoplay}
                className="accent-red-600 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>

          {relatedVideos.length === 0 ? (
            <p className="text-sm text-neutral-500 px-1 py-4">
              No related videos available yet.
            </p>
          ) : (
            <div className="space-y-3">
              {relatedVideos.map((rel) => (
                <button
                  key={rel.key}
                  type="button"
                  onClick={() => onPlayVideo(rel)}
                  className="w-full flex gap-3 text-left group rounded-xl p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors"
                >
                  <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0">
                    {safeMediaUrl(rel.thumbnailUrl) ? (
                      <img
                        src={safeMediaUrl(rel.thumbnailUrl)}
                        alt={rel.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-[10px] text-neutral-400">
                        HD
                      </div>
                    )}
                    {rel.durationLabel && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono tabular-nums">
                        {rel.durationLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug group-hover:text-red-600">
                      {rel.title}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 truncate">{rel.channelTitle}</p>
                    <p className="text-xs text-neutral-500 tabular-nums mt-0.5 truncate">
                      {formatViews(rel.views)} · {formatRelativeTime(rel.publishedAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
