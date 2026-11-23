import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Plus,
  Send,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  formatRelativeTime,
  formatViews,
  safeMediaUrl,
  type CommentItem,
  type UserProfile,
  type VideoItem,
} from '../types';

interface ShortsViewProps {
  shorts: VideoItem[];
  loading: boolean;
  user: UserProfile | null;
  onRequireAuth: () => void;
  onOpenShare: (video: VideoItem) => void;
  onOpenUploadShort: () => void;
  onOpenChannel: (video: VideoItem) => void;
  onLikedSync: (video: VideoItem, liked: boolean) => void;
}

export const ShortsView: React.FC<ShortsViewProps> = ({
  shorts,
  loading,
  user,
  onRequireAuth,
  onOpenShare,
  onOpenUploadShort,
  onOpenChannel,
  onLikedSync,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [likes, setLikes] = useState(0);
  const [userReaction, setUserReaction] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  const activeShort = shorts[activeIndex] || null;

  useEffect(() => {
    if (activeIndex >= shorts.length && shorts.length > 0) {
      setActiveIndex(0);
    }
  }, [shorts.length]);

  useEffect(() => {
    if (!activeShort) return;
    let mounted = true;
    setCommentsOpen(false);

    const load = async () => {
      try {
        const [inter, sub] = await Promise.all([
          api.getInteractions(activeShort.key),
          api.getSubscriptionStatus(activeShort.channelId),
        ]);
        if (!mounted) return;
        setLikes((activeShort.source === 'youtube' ? activeShort.likes : 0) + inter.likes);
        setUserReaction(inter.userReaction);
        setComments(inter.comments);
        setSubscribed(sub.isSubscribed);
      } catch {
        // ignore
      }
    };
    load();

    if (activeShort.source === 'local') {
      api.recordLocalView(activeShort.id).catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [activeShort?.key, user?.id]);

  const goToIndex = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= shorts.length) return;
    setActiveIndex(nextIdx);
    const el = containerRef.current?.children[nextIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToIndex(activeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToIndex(activeIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, shorts.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientHeight === 0) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== activeIndex && idx >= 0 && idx < shorts.length) {
      setActiveIndex(idx);
    }
  };

  const handleReact = async (value: 1 | -1) => {
    if (!activeShort) return;
    if (!user) return onRequireAuth();
    const res = await api.reactToVideo(activeShort.key, value);
    setLikes((activeShort.source === 'youtube' ? activeShort.likes : 0) + res.likes);
    setUserReaction(res.userReaction);
    onLikedSync(activeShort, res.userReaction === 1);
  };

  const handleSubscribe = async () => {
    if (!activeShort) return;
    if (!user) return onRequireAuth();
    if (activeShort.channelId === user.id) return;
    const res = await api.toggleSubscription({
      channelId: activeShort.channelId,
      channelTitle: activeShort.channelTitle,
      channelAvatar: activeShort.channelAvatar,
    });
    setSubscribed(res.subscribed);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShort || !commentInput.trim()) return;
    if (!user) return onRequireAuth();
    const res = await api.addComment(activeShort.key, commentInput.trim(), null);
    setComments((prev) => [res.comment, ...prev]);
    setCommentInput('');
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-7rem)] flex items-center justify-center">
        <div className="w-[340px] max-w-[90vw] aspect-[9/16] rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
      </div>
    );
  }

  if (shorts.length === 0) {
    return (
      <div className="max-w-lg mx-auto my-12 p-8 text-center rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161616]">
        <h2 className="text-lg font-bold">No Shorts Available Yet</h2>
        <p className="text-sm text-neutral-500 mt-2">
          Upload a vertical 9:16 Short from your Creator Studio, or configure your YouTube Data API v3 key to stream YouTube Shorts.
        </p>
        <button
          type="button"
          onClick={onOpenUploadShort}
          className="mt-5 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Upload a Short</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-6.5rem)] md:h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden bg-neutral-50 dark:bg-[#0A0A0A]">
      {/* Upload Short Floating Action */}
      <button
        type="button"
        onClick={onOpenUploadShort}
        className="hidden md:flex items-center gap-1.5 absolute top-4 right-6 z-20 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg"
      >
        <Plus className="w-4 h-4" />
        <span>Upload Short</span>
      </button>

      {/* Scroll-Snap Vertical Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
      >
        {shorts.map((short, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={short.key}
              className="h-full w-full snap-start flex items-center justify-center py-2 md:py-4 px-2"
            >
              <div className="relative flex items-end gap-3 h-full max-h-[820px]">
                {/* 9:16 Viewport */}
                <div className="relative h-full aspect-[9/16] max-w-[92vw] rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800">
                  {isActive ? (
                    short.source === 'youtube' && short.youtubeId ? (
                      <iframe
                        key={short.youtubeId}
                        src={`https://www.youtube.com/embed/${short.youtubeId}?autoplay=1&loop=1&playlist=${short.youtubeId}&rel=0&playsinline=1&mute=${muted ? 1 : 0}`}
                        title={short.title}
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    ) : (
                      <video
                        key={short.key}
                        src={safeMediaUrl(short.videoUrl)}
                        autoPlay
                        loop
                        playsInline
                        muted={muted}
                        onClick={(e) => {
                          const v = e.currentTarget;
                          if (v.paused) v.play().catch(() => {});
                          else v.pause();
                        }}
                        className="w-full h-full object-cover cursor-pointer"
                      />
                    )
                  ) : (
                    <img
                      src={safeMediaUrl(short.thumbnailUrl)}
                      alt={short.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-80"
                    />
                  )}

                  {/* Mute Toggle */}
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? 'Unmute Short' : 'Mute Short'}
                    className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>

                  {/* Bottom Scrim Metadata */}
                  <div className="absolute inset-x-0 bottom-0 p-4 pt-16 bg-gradient-to-t from-black/90 via-black/45 to-transparent text-white pointer-events-none">
                    <div className="flex items-center gap-2.5 pointer-events-auto">
                      <button
                        type="button"
                        onClick={() => onOpenChannel(short)}
                        className="flex items-center gap-2 min-w-0"
                      >
                        <img
                          src={safeMediaUrl(short.channelAvatar)}
                          alt={short.channelTitle}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-white/25 shrink-0"
                        />
                        <span className="text-sm font-bold truncate max-w-[140px]">
                          {short.channelTitle}
                        </span>
                      </button>

                      {user?.id !== short.channelId && (
                        <button
                          type="button"
                          onClick={handleSubscribe}
                          className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                            subscribed
                              ? 'bg-white/20 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                        >
                          {subscribed ? 'Subscribed' : 'Subscribe'}
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium line-clamp-2">{short.title}</p>
                    <p className="text-xs text-neutral-300 mt-1 tabular-nums">
                      {formatViews(short.views)}
                    </p>
                  </div>

                  {/* Mobile Action Rail Overlay inside Frame */}
                  <div className="sm:hidden absolute right-2.5 bottom-24 flex flex-col items-center gap-3.5 text-white">
                    <button
                      type="button"
                      onClick={() => handleReact(1)}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm ${
                          userReaction === 1 ? 'bg-red-600' : 'bg-black/50'
                        }`}
                      >
                        <ThumbsUp className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-mono tabular-nums">{likes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReact(-1)}
                      aria-label="Dislike"
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm ${
                          userReaction === -1 ? 'bg-red-600' : 'bg-black/50'
                        }`}
                      >
                        <ThumbsDown className="w-5 h-5" />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCommentsOpen(true)}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <MessageSquare className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-mono tabular-nums">{comments.length}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenShare(short)}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <Share2 className="w-5 h-5" />
                      </span>
                      <span className="text-[11px]">Share</span>
                    </button>
                  </div>
                </div>

                {/* Desktop External Action Rail */}
                <div className="hidden sm:flex flex-col items-center gap-4 pb-4">
                  <button
                    type="button"
                    onClick={() => handleReact(1)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <span
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        userReaction === 1
                          ? 'bg-red-600 text-white'
                          : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                      }`}
                    >
                      <ThumbsUp className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono tabular-nums">{likes}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReact(-1)}
                    aria-label="Dislike Short"
                    className="flex flex-col items-center gap-1"
                  >
                    <span
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        userReaction === -1
                          ? 'bg-red-600 text-white'
                          : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                      }`}
                    >
                      <ThumbsDown className="w-5 h-5" />
                    </span>
                    <span className="text-xs">Dislike</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCommentsOpen((p) => !p)}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5" />
                    </span>
                    <span className="text-xs font-mono tabular-nums">{comments.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenShare(short)}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center justify-center">
                      <Share2 className="w-5 h-5" />
                    </span>
                    <span className="text-xs">Share</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Up / Down Navigation Arrows */}
      <div className="hidden md:flex flex-col gap-2 absolute right-6 top-1/2 -translate-y-1/2 z-20">
        <button
          type="button"
          disabled={activeIndex === 0}
          onClick={() => goToIndex(activeIndex - 1)}
          aria-label="Previous Short"
          className="w-11 h-11 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-md flex items-center justify-center disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          type="button"
          disabled={activeIndex >= shorts.length - 1}
          onClick={() => goToIndex(activeIndex + 1)}
          aria-label="Next Short"
          className="w-11 h-11 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-md flex items-center justify-center disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Comments Drawer */}
      {commentsOpen && activeShort && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end items-end md:items-stretch">
          <div
            onClick={() => setCommentsOpen(false)}
            className="flex-1 h-full"
            aria-hidden="true"
          />
          <div className="w-full md:w-96 h-[70vh] md:h-full bg-white dark:bg-[#1A1A1A] rounded-t-2xl md:rounded-none border-l border-neutral-200 dark:border-neutral-800 flex flex-col shadow-2xl">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold tabular-nums">Comments ({comments.length})</h3>
              <button
                type="button"
                onClick={() => setCommentsOpen(false)}
                aria-label="Close comments"
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <img
                      src={safeMediaUrl(c.authorAvatar)}
                      alt={c.authorName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs flex items-center gap-2">
                        <span className="font-semibold">{c.authorName}</span>
                        <span className="text-neutral-500">{formatRelativeTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm mt-0.5 break-words">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleAddComment}
              className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={commentInput}
                onFocus={() => {
                  if (!user) onRequireAuth();
                }}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={user ? 'Add a comment...' : 'Sign in to comment...'}
                className="flex-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                aria-label="Post comment"
                className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
