import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, PlaySquare } from 'lucide-react';
import { api, setAuthToken } from './lib/api';
import {
  addSearchHistory,
  clearSearchHistory,
  clearWatchHistory,
  createPlaylist,
  deletePlaylist,
  getLikedVideos,
  getPlaylists,
  getSearchHistory,
  getStoredBrandTheme,
  getStoredTheme,
  getUiSettings,
  getWatchHistory,
  getWatchLater,
  recordWatchHistory,
  removeSearchHistoryItem,
  removeWatchHistoryItem,
  saveUiSettings,
  setLikedVideoState,
  setStoredBrandTheme,
  setStoredTheme,
  toggleVideoInPlaylist,
  toggleWatchLater,
  updatePlaybackProgress,
} from './lib/storage';
import type { BrandThemeId } from './lib/themes';
import {
  CATEGORIES,
  type AppView,
  type CategoryName,
  type LocalPlaylist,
  type NotificationItem,
  type SearchFilters,
  type UiSettings,
  type UserProfile,
  type VideoItem,
  type WatchHistoryEntry,
} from './types';
import { AuthModal } from './components/AuthModal';
import { ChannelView } from './components/ChannelView';
import { Hero3DBanner } from './components/Hero3DBanner';
import {
  LocalCollectionView,
  PlaylistsView,
  SubscriptionsView,
  historyToVideoList,
} from './components/LibraryViews';
import { PlaylistModal, ShareModal } from './components/Modals';
import { Navbar } from './components/Navbar';
import { ShortsView } from './components/ShortsView';
import { Showcase3DView } from './components/Showcase3DView';
import { Sidebar } from './components/Sidebar';
import { UploadStudio } from './components/UploadStudio';
import { VideoCard } from './components/VideoCard';
import { WatchView } from './components/WatchView';
import type { ModelPresetId } from './three/proceduralModels';

function isLikelyYouTubeLink(text: string): boolean {
  return /(?:youtube\.com\/|youtu\.be\/)/i.test(text.trim());
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getStoredTheme());
  const [brandTheme, setBrandTheme] = useState<BrandThemeId>(() => getStoredBrandTheme());
  const [uiSettings, setUiSettings] = useState<UiSettings>(() => getUiSettings());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [activeView, setActiveView] = useState<AppView>('home');
  const [activeCategory, setActiveCategory] = useState<CategoryName>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    duration: 'any',
    uploadDate: 'any',
    order: 'relevance',
  });

  const [feedVideos, setFeedVideos] = useState<VideoItem[]>([]);
  const [shortsFeed, setShortsFeed] = useState<VideoItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [feedLoading, setFeedLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [shortsLoading, setShortsLoading] = useState(false);
  const [feedError, setFeedError] = useState('');

  // Active watch / channel / 3D showcase state
  const [watchingVideo, setWatchingVideo] = useState<VideoItem | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<VideoItem[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [uploadDefaultShort, setUploadDefaultShort] = useState(false);
  const [initial3DModel, setInitial3DModel] = useState<ModelPresetId>('fairytale-castle');

  // Local Storage collections
  const [searchHistory, setSearchHistory] = useState<string[]>(() => getSearchHistory());
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>(() => getWatchHistory());
  const [watchLater, setWatchLater] = useState<VideoItem[]>(() => getWatchLater());
  const [likedVideos, setLikedVideos] = useState<VideoItem[]>(() => getLikedVideos());
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>(() => getPlaylists());

  // Modals
  const [playlistModalVideo, setPlaylistModalVideo] = useState<VideoItem | null>(null);
  const [shareModalVideo, setShareModalVideo] = useState<VideoItem | null>(null);

  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Sync Tailwind dark mode class and brand color theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    setStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.brandTheme = brandTheme;
    setStoredBrandTheme(brandTheme);
  }, [brandTheme]);

  useEffect(() => {
    saveUiSettings(uiSettings);
  }, [uiSettings]);

  // Initial boot: auth, deep link check
  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const watchParam = params.get('watch');
    if (watchParam) {
      openVideoByKey(watchParam);
    }
  }, []);

  // Load notifications when logged in
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    api
      .getNotifications()
      .then((res) => setNotifications(res.notifications))
      .catch(() => {});
  }, [user?.id]);

  // Load Home / Trending / Category / Search feed
  const fetchMainFeed = useCallback(
    async (opts: { append?: boolean; token?: string } = {}) => {
      const isTrendingView = activeView === 'trending';
      const categoryToUse = isTrendingView ? 'Trending Videos' : activeCategory;

      if (opts.append) {
        setLoadingMore(true);
      } else {
        setFeedLoading(true);
        setFeedError('');
      }

      try {
        const [localRes, ytRes] = await Promise.all([
          opts.append
            ? Promise.resolve({ items: [] as VideoItem[] })
            : api.listLocalVideos({
                category: categoryToUse,
                q: searchQuery || undefined,
                isShort: categoryToUse === 'Shorts' ? true : undefined,
              }),
          api.youtubeSearch({
            q: searchQuery || undefined,
            category: categoryToUse,
            filters,
            isShort: categoryToUse === 'Shorts',
            pageToken: opts.token,
          }),
        ]);

        if (ytRes.error) setFeedError(ytRes.error);

        const combined = opts.append
          ? [...feedVideos, ...ytRes.items]
          : [...localRes.items, ...ytRes.items];

        // Deduplicate by key
        const seen = new Set<string>();
        const deduped = combined.filter((item) => {
          if (seen.has(item.key)) return false;
          seen.add(item.key);
          return true;
        });

        setFeedVideos(deduped);
        setNextPageToken(ytRes.nextPageToken);
      } catch (err: any) {
        setFeedError(err?.message || 'Unable to load videos.');
      } finally {
        setFeedLoading(false);
        setLoadingMore(false);
      }
    },
    [activeView, activeCategory, searchQuery, filters, feedVideos]
  );

  // Trigger feed refresh when view/category/search/filters change
  useEffect(() => {
    if (activeView === 'home' || activeView === 'trending') {
      fetchMainFeed({ append: false });
    }
  }, [activeView, activeCategory, searchQuery, filters]);

  // Load Shorts feed when entering Shorts view
  const fetchShortsFeed = useCallback(async () => {
    setShortsLoading(true);
    try {
      const [localRes, ytRes] = await Promise.all([
        api.listLocalVideos({ isShort: true }),
        api.youtubeSearch({ category: 'Shorts', isShort: true }),
      ]);
      const combined = [...localRes.items, ...ytRes.items];
      const seen = new Set<string>();
      setShortsFeed(
        combined.filter((v) => {
          if (seen.has(v.key)) return false;
          seen.add(v.key);
          return true;
        })
      );
    } catch {
      // keep existing
    } finally {
      setShortsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'shorts') {
      fetchShortsFeed();
    }
  }, [activeView, fetchShortsFeed]);

  // Infinite scroll observer for YouTube pagination
  useEffect(() => {
    const el = loadMoreTriggerRef.current;
    if (!el || !nextPageToken || loadingMore || feedLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextPageToken && !loadingMore) {
          fetchMainFeed({ append: true, token: nextPageToken });
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextPageToken, loadingMore, feedLoading, fetchMainFeed]);

  const openVideo = async (video: VideoItem) => {
    setWatchingVideo(video);
    setActiveView('watch');
    setWatchHistory(recordWatchHistory(video));
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load related videos from backend
    try {
      if (video.source === 'youtube' && video.youtubeId) {
        const res = await api.youtubeVideo(video.youtubeId);
        if (res.video) setWatchingVideo(res.video);
        setRelatedVideos(res.related || []);
      } else if (video.source === 'local') {
        const res = await api.getLocalVideo(video.id);
        setWatchingVideo(res.video);
        setRelatedVideos(res.related || []);
      }
    } catch {
      setRelatedVideos(feedVideos.filter((v) => v.key !== video.key).slice(0, 8));
    }
  };

  const openVideoByKey = async (videoKey: string) => {
    if (videoKey.startsWith('yt:')) {
      const ytId = videoKey.slice(3);
      try {
        const res = await api.youtubeVideo(ytId);
        if (res.video) openVideo(res.video);
      } catch {
        // ignore
      }
    } else if (videoKey.startsWith('local:')) {
      const localId = videoKey.slice(6);
      try {
        const res = await api.getLocalVideo(localId);
        if (res.video) openVideo(res.video);
      } catch {
        // ignore
      }
    }
  };

  const handleSearchSubmit = async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (trimmed) {
      setSearchHistory(addSearchHistory(trimmed));
    }

    if (trimmed && isLikelyYouTubeLink(trimmed)) {
      try {
        const res = await api.youtubeResolveUrl(trimmed);
        if (res.video) {
          openVideo(res.video);
          return;
        }
      } catch (err: any) {
        setFeedError(err.message);
      }
    }

    setSearchQuery(trimmed);
    setActiveView('home');
  };

  const handleNavigate = (view: AppView, payload?: string) => {
    if (view === 'watch' && payload) {
      openVideoByKey(payload);
      return;
    }
    if (view === 'channel' && payload) {
      setActiveChannelId(payload);
      setActiveView('channel');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (view === 'upload') {
      setUploadDefaultShort(false);
    }
    if (view === 'your-videos') {
      setUploadDefaultShort(false);
      setActiveView('upload');
      return;
    }
    if (view === 'home') {
      setActiveCategory('All');
      setSearchQuery('');
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChannelClick = (video: VideoItem) => {
    if (video.source === 'local') {
      setActiveChannelId(video.channelId);
      setActiveView('channel');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // For external YouTube creators, filter search by channel title
      setSearchQuery(video.channelTitle);
      setActiveView('home');
    }
  };

  const handleToggleWatchLater = (video: VideoItem) => {
    const res = toggleWatchLater(video);
    setWatchLater(res.items);
  };

  const watchLaterIds = useMemo(() => new Set(watchLater.map((v) => v.key)), [watchLater]);

  const continueWatchingEntries = useMemo(
    () =>
      watchHistory.filter(
        (e) =>
          e.progressSeconds > 5 &&
          (!e.durationSeconds || e.progressSeconds < e.durationSeconds - 5)
      ),
    [watchHistory]
  );

  const initialResumeTime = useMemo(() => {
    if (!watchingVideo) return 0;
    const found = watchHistory.find((e) => e.video.key === watchingVideo.key);
    return found?.progressSeconds || 0;
  }, [watchingVideo?.key]);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileMenuOpen((p) => !p);
    } else {
      setUiSettings((prev) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
    }
  };

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    setAuthToken(null);
    setUser(null);
    if (activeView === 'channel') setActiveView('home');
  };

  const historyCollection = useMemo(() => historyToVideoList(watchHistory), [watchHistory]);
  const continueCollection = useMemo(
    () => historyToVideoList(continueWatchingEntries),
    [continueWatchingEntries]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B0F1A] text-neutral-900 dark:text-neutral-100">
      <Navbar
        user={user}
        theme={theme}
        brandTheme={brandTheme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onChangeBrandTheme={setBrandTheme}
        onToggleSidebar={handleToggleSidebar}
        searchQuery={searchQuery}
        onSearchSubmit={handleSearchSubmit}
        searchHistory={searchHistory}
        onRemoveSearchHistory={(q) => setSearchHistory(removeSearchHistoryItem(q))}
        onClearSearchHistory={() => setSearchHistory(clearSearchHistory())}
        filters={filters}
        onChangeFilters={setFilters}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        notifications={notifications}
        onMarkNotificationsRead={() => {
          api.markNotificationsRead().catch(() => {});
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        }}
      />

      <div className="flex flex-1 min-w-0">
        {activeView !== 'watch' && (
          <Sidebar
            activeView={activeView}
            activeCategory={activeCategory}
            collapsed={uiSettings.sidebarCollapsed}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
            onSelectView={(v) => handleNavigate(v)}
            onSelectCategory={(cat) => {
              if (cat === 'Shorts') {
                setActiveView('shorts');
              } else {
                setActiveCategory(cat);
                setSearchQuery('');
                setActiveView('home');
              }
            }}
          />
        )}

        <main className="flex-1 min-w-0">
          {/* Home & Trending Feed */}
          {(activeView === 'home' || activeView === 'trending') && (
            <div className="max-w-[1680px] mx-auto px-3 md:px-6 py-3 pb-20 md:pb-12 space-y-5">
              {/* Interactive Category Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {CATEGORIES.map((cat) => {
                  const isActive =
                    activeView === 'trending'
                      ? cat === 'Trending Videos'
                      : activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        if (cat === 'Shorts') {
                          setActiveView('shorts');
                          return;
                        }
                        setActiveView('home');
                        setActiveCategory(cat);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                        isActive
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Interactive 3D Showcase Hero on Homepage */}
              {!searchQuery &&
                activeCategory === 'All' &&
                activeView === 'home' && (
                  <Hero3DBanner
                    theme={theme}
                    brandTheme={brandTheme}
                    onOpen3DGallery={(modelId) => {
                      if (modelId) setInitial3DModel(modelId);
                      setActiveView('3d-studio');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onOpenCartoons={() => {
                      setActiveCategory('Cartoons and Animation');
                      setSearchQuery('');
                      setActiveView('home');
                    }}
                    onOpenIslamicVideos={() => {
                      setActiveCategory('Islamic Videos');
                      setSearchQuery('');
                      setActiveView('home');
                    }}
                  />
                )}

              {/* Continue Watching Strip (if user has partial playback progress) */}
              {!searchQuery &&
                activeCategory === 'All' &&
                activeView === 'home' &&
                continueWatchingEntries.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold">Continue Watching</h2>
                      <button
                        type="button"
                        onClick={() => setActiveView('continue-watching')}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {continueWatchingEntries.slice(0, 4).map((entry) => (
                        <VideoCard
                          key={entry.video.key}
                          video={entry.video}
                          progressSeconds={entry.progressSeconds}
                          isInWatchLater={watchLaterIds.has(entry.video.key)}
                          onPlay={openVideo}
                          onChannelClick={handleChannelClick}
                          onToggleWatchLater={handleToggleWatchLater}
                          onOpenPlaylistModal={setPlaylistModalVideo}
                          onOpenShareModal={setShareModalVideo}
                        />
                      ))}
                    </div>
                  </section>
                )}

              {/* Search Result Header */}
              {searchQuery && (
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Search results for <span className="font-bold text-neutral-900 dark:text-white">&ldquo;{searchQuery}&rdquo;</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {feedError && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
                  {feedError}
                </div>
              )}

              {/* Video Grid */}
              {feedLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="aspect-video rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                      <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-5/6 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                          <div className="h-3 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : feedVideos.length === 0 ? (
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-10 text-center space-y-3">
                  <PlaySquare className="w-10 h-10 mx-auto text-red-600" />
                  <h2 className="text-lg font-bold">No Videos Found</h2>
                  <p className="text-sm text-neutral-500 max-w-md mx-auto">
                    {searchQuery
                      ? 'Try another search term, adjust your filters, or paste a direct YouTube watch URL.'
                      : 'Upload a video from Creator Studio or configure YOUTUBE_API_KEY in Secrets to stream worldwide YouTube videos.'}
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleNavigate('upload')}
                      className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                    >
                      Upload Video
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {!searchQuery && (
                    <div className="flex items-center justify-between pt-1">
                      <h2 className="text-base md:text-lg font-bold tracking-tight">
                        {activeView === 'trending'
                          ? 'Trending Worldwide'
                          : activeCategory === 'All'
                          ? 'Islamic & Featured Streams'
                          : activeCategory}
                      </h2>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {feedVideos.length} videos
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7">
                    {feedVideos.map((v) => (
                      <VideoCard
                        key={v.key}
                        video={v}
                        isInWatchLater={watchLaterIds.has(v.key)}
                        onPlay={openVideo}
                        onChannelClick={handleChannelClick}
                        onToggleWatchLater={handleToggleWatchLater}
                        onOpenPlaylistModal={setPlaylistModalVideo}
                        onOpenShareModal={setShareModalVideo}
                      />
                    ))}
                  </div>

                  {/* Pagination Trigger */}
                  <div ref={loadMoreTriggerRef} className="py-6 flex justify-center">
                    {loadingMore && (
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                        <span>Loading more videos...</span>
                      </div>
                    )}
                    {!loadingMore && nextPageToken && (
                      <button
                        type="button"
                        onClick={() => fetchMainFeed({ append: true, token: nextPageToken })}
                        className="px-5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold"
                      >
                        Load more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Watch View */}
          {activeView === 'watch' && watchingVideo && (
            <WatchView
              video={watchingVideo}
              relatedVideos={relatedVideos}
              user={user}
              autoplay={uiSettings.autoplay}
              theaterMode={uiSettings.theaterMode}
              initialTimeSeconds={initialResumeTime}
              isInWatchLater={watchLaterIds.has(watchingVideo.key)}
              onToggleAutoplay={() =>
                setUiSettings((p) => ({ ...p, autoplay: !p.autoplay }))
              }
              onToggleTheaterMode={() =>
                setUiSettings((p) => ({ ...p, theaterMode: !p.theaterMode }))
              }
              onProgressUpdate={(sec, dur) => {
                updatePlaybackProgress(watchingVideo.key, sec, dur);
                setWatchHistory(getWatchHistory());
              }}
              onPlayVideo={openVideo}
              onOpenChannel={handleChannelClick}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenPlaylistModal={setPlaylistModalVideo}
              onOpenShareModal={setShareModalVideo}
              onLikedSync={(vid, liked) => setLikedVideos(setLikedVideoState(vid, liked))}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}

          {/* Vertical Shorts */}
          {activeView === 'shorts' && (
            <ShortsView
              shorts={shortsFeed}
              loading={shortsLoading}
              user={user}
              onRequireAuth={() => setAuthModalOpen(true)}
              onOpenShare={setShareModalVideo}
              onOpenUploadShort={() => {
                setUploadDefaultShort(true);
                setActiveView('upload');
              }}
              onOpenChannel={handleChannelClick}
              onLikedSync={(vid, liked) => setLikedVideos(setLikedVideoState(vid, liked))}
            />
          )}

          {/* Subscriptions */}
          {activeView === 'subscriptions' && (
            <SubscriptionsView
              user={user}
              watchLaterIds={watchLaterIds}
              onRequireAuth={() => setAuthModalOpen(true)}
              onPlayVideo={openVideo}
              onOpenChannel={(id) => handleNavigate('channel', id)}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenPlaylistModal={setPlaylistModalVideo}
              onOpenShareModal={setShareModalVideo}
            />
          )}

          {/* Local Collections */}
          {activeView === 'history' && (
            <LocalCollectionView
              title="Watch History"
              emptyMessage="Videos you watch will appear here."
              videos={historyCollection.videos}
              progressMap={historyCollection.progressMap}
              watchLaterIds={watchLaterIds}
              onClearAll={() => setWatchHistory(clearWatchHistory())}
              onRemoveItem={(key) => setWatchHistory(removeWatchHistoryItem(key))}
              onPlayVideo={openVideo}
              onChannelClick={handleChannelClick}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenPlaylistModal={setPlaylistModalVideo}
              onOpenShareModal={setShareModalVideo}
            />
          )}

          {activeView === 'continue-watching' && (
            <LocalCollectionView
              title="Continue Watching"
              emptyMessage="Partially watched videos will appear here so you can pick up right where you left off."
              videos={continueCollection.videos}
              progressMap={continueCollection.progressMap}
              watchLaterIds={watchLaterIds}
              onPlayVideo={openVideo}
              onChannelClick={handleChannelClick}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenPlaylistModal={setPlaylistModalVideo}
              onOpenShareModal={setShareModalVideo}
            />
          )}

          {activeView === 'watch-later' && (
            <LocalCollectionView
              title="Watch Later"
              emptyMessage="Save videos to Watch Later to find them easily here."
              videos={watchLater}
              watchLaterIds={watchLaterIds}
              onPlayVideo={openVideo}
              onChannelClick={handleChannelClick}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenPlaylistModal={setPlaylistModalVideo}
              onOpenShareModal={setShareModalVideo}
            />
          )}

          {activeView === 'liked' && (
            <LocalCollectionView
              title="Liked Videos"
              emptyMessage="Videos you like will appear here."
              videos={likedVideos}
              watchLaterIds={watchLaterIds}
              onPlayVideo={openVideo}
              onChannelClick={handleChannelClick}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenPlaylistModal={setPlaylistModalVideo}
              onOpenShareModal={setShareModalVideo}
            />
          )}

          {activeView === 'playlists' && (
            <PlaylistsView
              playlists={playlists}
              watchLaterIds={watchLaterIds}
              onCreatePlaylist={(name) => setPlaylists(createPlaylist(name))}
              onDeletePlaylist={(id) => setPlaylists(deletePlaylist(id))}
              onPlayVideo={openVideo}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenPlaylistModal={setPlaylistModalVideo}
              onOpenShareModal={setShareModalVideo}
            />
          )}

          {/* Creator Upload & Management */}
          {activeView === 'upload' && (
            <UploadStudio
              user={user}
              defaultShortMode={uploadDefaultShort}
              onRequireAuth={() => setAuthModalOpen(true)}
              onPlayVideo={openVideo}
              onVideosChanged={() => {
                if (activeCategory === 'All') fetchMainFeed({ append: false });
              }}
            />
          )}

          {/* Channel Page */}
          {activeView === 'channel' && activeChannelId && (
            <ChannelView
              channelId={activeChannelId}
              currentUser={user}
              playlists={playlists}
              watchLaterIds={watchLaterIds}
              brandTheme={brandTheme}
              onChangeBrandTheme={setBrandTheme}
              onUserUpdated={setUser}
              onPlayVideo={openVideo}
              onNavigateUpload={() => handleNavigate('upload')}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenPlaylistModal={setPlaylistModalVideo}
              onOpenShareModal={setShareModalVideo}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          )}

          {/* Interactive 3D Showcase Gallery */}
          {activeView === '3d-studio' && (
            <Showcase3DView theme={theme} initialModel={initial3DModel} />
          )}
        </main>
      </div>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(u) => setUser(u)}
      />

      <PlaylistModal
        video={playlistModalVideo}
        playlists={playlists}
        isInWatchLater={
          playlistModalVideo ? watchLaterIds.has(playlistModalVideo.key) : false
        }
        onClose={() => setPlaylistModalVideo(null)}
        onToggleWatchLater={handleToggleWatchLater}
        onToggleInPlaylist={(plId, vid) =>
          setPlaylists(toggleVideoInPlaylist(plId, vid))
        }
        onCreatePlaylist={(name) => setPlaylists(createPlaylist(name))}
      />

      <ShareModal
        video={shareModalVideo}
        onClose={() => setShareModalVideo(null)}
      />
    </div>
  );
}
