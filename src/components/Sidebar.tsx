import React from 'react';
import {
  BookOpen,
  Box,
  Clock,
  Cpu,
  Film,
  Flame,
  Gamepad2,
  History,
  Home,
  Laugh,
  ListVideo,
  MoonStar,
  Music2,
  Newspaper,
  PlaySquare,
  PlusCircle,
  Sparkles,
  ThumbsUp,
  Trophy,
  Tv,
  Users,
  Video,
} from 'lucide-react';
import type { AppView, CategoryName } from '../types';

interface SidebarProps {
  activeView: AppView;
  activeCategory: CategoryName;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectView: (view: AppView) => void;
  onSelectCategory: (category: CategoryName) => void;
}

const EXPLORE_ITEMS: { label: CategoryName; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Trending Videos', shortLabel: 'Trending', icon: Flame },
  { label: 'Cartoons and Animation', shortLabel: 'Cartoons', icon: Sparkles },
  { label: 'Islamic Videos', shortLabel: 'Islamic', icon: MoonStar },
  { label: 'Dramas and Movies', shortLabel: 'Dramas', icon: Film },
  { label: 'Songs and Music', shortLabel: 'Music', icon: Music2 },
  { label: 'Comedy', shortLabel: 'Comedy', icon: Laugh },
  { label: 'Gaming', shortLabel: 'Gaming', icon: Gamepad2 },
  { label: 'Education', shortLabel: 'Education', icon: BookOpen },
  { label: 'Technology', shortLabel: 'Tech', icon: Cpu },
  { label: 'Sports', shortLabel: 'Sports', icon: Trophy },
  { label: 'News', shortLabel: 'News', icon: Newspaper },
  { label: 'Entertainment', shortLabel: 'Entertainment', icon: Tv },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  activeCategory,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onSelectView,
  onSelectCategory,
}) => {
  const mainItems: { view: AppView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { view: 'home', label: 'Home', icon: Home },
    { view: 'shorts', label: 'Shorts', icon: PlaySquare },
    { view: '3d-studio', label: '3D Studio', icon: Box },
    { view: 'subscriptions', label: 'Subscriptions', icon: Users },
    { view: 'trending', label: 'Trending', icon: Flame },
  ];

  const libraryItems: { view: AppView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { view: 'history', label: 'History', icon: History },
    { view: 'continue-watching', label: 'Continue Watching', icon: Clock },
    { view: 'playlists', label: 'Playlists', icon: ListVideo },
    { view: 'your-videos', label: 'Your Videos', icon: Video },
    { view: 'watch-later', label: 'Watch Later', icon: Clock },
    { view: 'liked', label: 'Liked Videos', icon: ThumbsUp },
  ];

  const renderSidebarBody = (isDrawer: boolean) => {
    const compact = collapsed && !isDrawer;
    return (
      <div className="flex flex-col h-full overflow-y-auto thin-scrollbar py-3 px-2 select-none">
        {/* Primary Navigation */}
        <nav aria-label="Main navigation" className="space-y-0.5">
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeView === item.view && (item.view !== 'home' || activeCategory === 'All');
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => {
                  onSelectView(item.view);
                  if (isDrawer) onCloseMobile();
                }}
                className={`w-full flex ${
                  compact ? 'flex-col items-center justify-center py-3 px-1 gap-1' : 'items-center gap-4 px-3 py-2.5'
                } rounded-xl text-left transition-colors ${
                  isActive
                    ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-500 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`${compact ? 'text-[10px]' : 'text-sm'} truncate`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {!compact && (
          <>
            <hr className="my-3 border-neutral-200 dark:border-neutral-800" />

            {/* Library */}
            <div className="px-3 mb-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Library
            </div>
            <nav aria-label="Library navigation" className="space-y-0.5">
              {libraryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;
                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => {
                      onSelectView(item.view);
                      if (isDrawer) onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-4 px-3 py-2 rounded-xl text-left transition-colors ${
                      isActive
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-500 font-semibold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-sm truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <hr className="my-3 border-neutral-200 dark:border-neutral-800" />

            {/* Categories */}
            <div className="px-3 mb-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Explore Categories
            </div>
            <nav aria-label="Categories navigation" className="space-y-0.5 pb-6">
              {EXPLORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === 'home' && activeCategory === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      onSelectCategory(item.label);
                      if (isDrawer) onCloseMobile();
                    }}
                    className={`w-full flex items-center gap-4 px-3 py-2 rounded-xl text-left transition-colors ${
                      isActive
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-500 font-semibold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-sm truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] bg-white dark:bg-[#0B0F1A] border-r border-slate-200 dark:border-slate-800/80 transition-all duration-200 ${
          collapsed ? 'w-[74px]' : 'w-60'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile & Tablet Slide-over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[82vw] h-full bg-white dark:bg-[#0B0F1A] border-r border-slate-200 dark:border-slate-800/80 z-10 shadow-2xl">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (52px high to stay within mobile sticky height budget) */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[52px] bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-5 items-center"
      >
        <button
          type="button"
          onClick={() => onSelectView('home')}
          className={`flex flex-col items-center justify-center h-full ${
            activeView === 'home' ? 'text-red-600' : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Home</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView('shorts')}
          className={`flex flex-col items-center justify-center h-full ${
            activeView === 'shorts' ? 'text-red-600' : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <PlaySquare className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Shorts</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView('upload')}
          aria-label="Upload video"
          className={`flex flex-col items-center justify-center h-full ${
            activeView === 'upload' ? 'text-red-600' : 'text-neutral-800 dark:text-neutral-200'
          }`}
        >
          <PlusCircle className="w-6 h-6" />
          <span className="text-[10px] font-medium mt-0.5">Upload</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView('subscriptions')}
          className={`flex flex-col items-center justify-center h-full ${
            activeView === 'subscriptions' ? 'text-red-600' : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Subs</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView('playlists')}
          className={`flex flex-col items-center justify-center h-full ${
            ['playlists', 'history', 'watch-later', 'liked'].includes(activeView)
              ? 'text-red-600'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <ListVideo className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Library</span>
        </button>
      </nav>
    </>
  );
};
