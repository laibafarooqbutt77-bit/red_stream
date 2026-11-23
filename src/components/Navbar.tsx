import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  Clock,
  Filter,
  LogOut,
  Menu,
  Mic,
  MicOff,
  Moon,
  Palette,
  Search,
  Sun,
  Trash2,
  User as UserIcon,
  Video as VideoIcon,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { BRAND_THEMES, type BrandThemeId } from '../lib/themes';
import {
  formatRelativeTime,
  safeMediaUrl,
  type AppView,
  type NotificationItem,
  type SearchFilters,
  type UserProfile,
} from '../types';

interface NavbarProps {
  user: UserProfile | null;
  theme: 'light' | 'dark';
  brandTheme: BrandThemeId;
  onToggleTheme: () => void;
  onChangeBrandTheme: (id: BrandThemeId) => void;
  onToggleSidebar: () => void;
  searchQuery: string;
  onSearchSubmit: (query: string) => void;
  searchHistory: string[];
  onRemoveSearchHistory: (query: string) => void;
  onClearSearchHistory: () => void;
  filters: SearchFilters;
  onChangeFilters: (next: SearchFilters) => void;
  onNavigate: (view: AppView, payload?: string) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  theme,
  brandTheme,
  onToggleTheme,
  onChangeBrandTheme,
  onToggleSidebar,
  searchQuery,
  onSearchSubmit,
  searchHistory,
  onRemoveSearchHistory,
  onClearSearchHistory,
  filters,
  onChangeFilters,
  onNavigate,
  onOpenAuth,
  onLogout,
  notifications,
  onMarkNotificationsRead,
}) => {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'en-US' | 'ur-PK'>('en-US');
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [voiceMessage, setVoiceMessage] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const notifsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  // Fetch autocomplete suggestions with debounce
  useEffect(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || trimmed.startsWith('http')) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.youtubeSuggestions(trimmed);
        setSuggestions(res.suggestions || []);
      } catch {
        setSuggestions([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [inputValue]);

  // Outside click handlers
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) setShowDropdown(false);
      if (filtersRef.current && !filtersRef.current.contains(target)) setShowFilters(false);
      if (notifsRef.current && !notifsRef.current.contains(target)) setShowNotifs(false);
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setShowUserMenu(false);
      if (themeMenuRef.current && !themeMenuRef.current.contains(target)) setShowThemeMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setVoiceStatus('idle');
  };

  const startVoiceSearch = async (lang: 'en-US' | 'ur-PK' = voiceLang) => {
    setVoiceOpen(true);
    setVoiceLang(lang);
    stopVoiceRecognition();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus('error');
      setVoiceMessage('Voice search is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        setVoiceStatus('error');
        setVoiceMessage('Microphone permission denied. Please allow microphone access in your browser.');
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    setVoiceStatus('listening');
    setVoiceMessage(lang === 'ur-PK' ? 'سن رہا ہے... اردو میں بولیں' : 'Listening... Speak now');

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      const display = (finalTranscript || interim).trim();
      if (display) {
        setVoiceMessage(display);
      }
      if (finalTranscript.trim()) {
        const query = finalTranscript.trim();
        setInputValue(query);
        setVoiceOpen(false);
        setVoiceStatus('idle');
        setMobileSearchOpen(false);
        onSearchSubmit(query);
      }
    };

    recognition.onerror = (event: any) => {
      setVoiceStatus('error');
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        setVoiceMessage('Microphone permission blocked. Enable microphone access and try again.');
      } else if (event?.error === 'no-speech') {
        setVoiceMessage('No speech detected. Tap the microphone to try again.');
      } else {
        setVoiceMessage(`Voice search error: ${event?.error || 'Could not recognize speech'}`);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceStatus((prev) => (prev === 'listening' ? 'idle' : prev));
    };

    try {
      recognition.start();
    } catch {
      setVoiceStatus('error');
      setVoiceMessage('Could not start speech recognition.');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    setMobileSearchOpen(false);
    onSearchSubmit(inputValue.trim());
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeFilterCount =
    (filters.duration !== 'any' ? 1 : 0) +
    (filters.uploadDate !== 'any' ? 1 : 0) +
    (filters.order !== 'relevance' ? 1 : 0);

  return (
    <>
      <header className="sticky top-0 z-40 h-12 md:h-14 bg-white/95 dark:bg-[#0B0F1A]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-3 md:px-4 flex items-center justify-between gap-2 md:gap-4">
        <div
          className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, var(--color-red-600), var(--brand-secondary, #F5B942), var(--color-red-600))',
          }}
        />
        {/* Left: Menu + Brand Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 rounded-lg px-1 py-1 whitespace-nowrap shrink-0"
          >
            <svg
              viewBox="0 0 36 26"
              className="w-8 h-6 shrink-0"
              aria-hidden="true"
            >
              <rect width="36" height="26" rx="6.5" style={{ fill: 'var(--color-red-600, #DC2626)' }} />
              <path d="M14.5 7.5L24.5 13L14.5 18.5V7.5Z" fill="#FFFFFF" />
            </svg>
            <span className="text-lg font-extrabold tracking-tight text-neutral-900 dark:text-white">
              RedStream
            </span>
          </button>
        </div>

        {/* Center: Search Bar (desktop & tablet; expandable on mobile) */}
        <div
          ref={searchBoxRef}
          className={`${
            mobileSearchOpen
              ? 'fixed inset-x-0 top-0 h-12 md:h-14 z-50 bg-white dark:bg-[#0B0F1A] px-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/80'
              : 'hidden sm:flex flex-1 max-w-2xl items-center gap-2'
          } relative`}
        >
          {mobileSearchOpen && (
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Close search"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <form onSubmit={handleFormSubmit} className="flex-1 flex items-center relative">
            <div className="flex flex-1 items-center rounded-l-full border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#121212] focus-within:border-red-600 dark:focus-within:border-red-500 transition-colors">
              <Search className="w-4 h-4 ml-3.5 text-neutral-400 shrink-0 hidden md:block" />
              <input
                type="text"
                value={inputValue}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setShowDropdown(true);
                }}
                placeholder="Search YouTube or paste a video link..."
                aria-label="Search videos"
                className="w-full h-9 md:h-10 px-3 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue('');
                    onSearchSubmit('');
                  }}
                  aria-label="Clear search"
                  className="p-1.5 mr-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              aria-label="Submit search"
              className="h-9 md:h-10 px-4 md:px-5 rounded-r-full border border-l-0 border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Suggestions + Search History Dropdown */}
            {showDropdown && (suggestions.length > 0 || searchHistory.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 shadow-lg overflow-hidden z-50">
                {searchHistory.length > 0 && !inputValue.trim() && (
                  <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
                    <span className="text-xs font-medium text-neutral-500">Recent searches</span>
                    <button
                      type="button"
                      onClick={onClearSearchHistory}
                      className="text-xs text-red-600 hover:underline font-medium"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {!inputValue.trim() &&
                  searchHistory.slice(0, 7).map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setInputValue(item);
                          setShowDropdown(false);
                          setMobileSearchOpen(false);
                          onSearchSubmit(item);
                        }}
                        className="flex items-center gap-3 flex-1 text-left text-sm text-neutral-800 dark:text-neutral-200 truncate"
                      >
                        <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className="truncate">{item}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveSearchHistory(item)}
                        aria-label={`Remove ${item} from search history`}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                {inputValue.trim() &&
                  suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setInputValue(item);
                        setShowDropdown(false);
                        setMobileSearchOpen(false);
                        onSearchSubmit(item);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                      <span className="truncate">{item}</span>
                    </button>
                  ))}
              </div>
            )}
          </form>

          {/* Voice Search Mic Button */}
          <button
            type="button"
            onClick={() => startVoiceSearch(voiceLang)}
            title="Search with voice (English / Urdu)"
            aria-label="Voice search"
            className="min-h-[40px] min-w-[40px] rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 flex items-center justify-center transition-colors shrink-0"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Filters Dropdown */}
          <div ref={filtersRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowFilters((p) => !p)}
              aria-label="Search filters"
              className={`min-h-[40px] px-3 rounded-full border flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeFilterCount > 0
                  ? 'border-red-600 text-red-600 bg-red-50 dark:bg-red-950/30'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="font-mono tabular-nums">({activeFilterCount})</span>
              )}
            </button>

            {showFilters && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 shadow-xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Search Filters</h3>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeFilters({ duration: 'any', uploadDate: 'any', order: 'relevance' })
                    }
                    className="text-xs text-red-600 hover:underline font-medium"
                  >
                    Reset
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">
                    Upload date
                  </label>
                  <select
                    value={filters.uploadDate}
                    onChange={(e) =>
                      onChangeFilters({
                        ...filters,
                        uploadDate: e.target.value as SearchFilters['uploadDate'],
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-2.5 py-1.5 text-sm"
                  >
                    <option value="any">Any time</option>
                    <option value="hour">Last hour</option>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="year">This year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">
                    Duration
                  </label>
                  <select
                    value={filters.duration}
                    onChange={(e) =>
                      onChangeFilters({
                        ...filters,
                        duration: e.target.value as SearchFilters['duration'],
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-2.5 py-1.5 text-sm"
                  >
                    <option value="any">Any duration</option>
                    <option value="short">Under 4 minutes</option>
                    <option value="medium">4 - 20 minutes</option>
                    <option value="long">Over 20 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">
                    Sort by
                  </label>
                  <select
                    value={filters.order}
                    onChange={(e) =>
                      onChangeFilters({
                        ...filters,
                        order: e.target.value as SearchFilters['order'],
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] px-2.5 py-1.5 text-sm"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="date">Upload date</option>
                    <option value="viewCount">View count</option>
                    <option value="rating">Rating</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Open search"
            className="sm:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => startVoiceSearch(voiceLang)}
            aria-label="Voice search"
            className="sm:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Channel & Site Theme Studio Picker */}
          <div ref={themeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowThemeMenu((p) => !p)}
              aria-label="Channel and website themes"
              title="Channel & Website Themes"
              className={`min-h-[40px] min-w-[40px] md:px-3 flex items-center justify-center gap-1.5 rounded-full transition-colors ${
                showThemeMenu
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-600'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
              }`}
            >
              <Palette className="w-4 h-4 text-red-600" />
              <span className="hidden lg:inline text-xs font-semibold">Themes</span>
            </button>

            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 shadow-2xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold">Channel &amp; Site Theme</h3>
                    <p className="text-[11px] text-neutral-500">
                      Pick a color palette for your channel &amp; player
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {BRAND_THEMES.map((item) => {
                    const active = brandTheme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChangeBrandTheme(item.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl border text-left transition-colors ${
                          active
                            ? 'border-red-600 bg-red-50/70 dark:bg-red-950/30'
                            : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/70'
                        }`}
                      >
                        <div className="flex items-center -space-x-1.5 shrink-0">
                          <span
                            className="w-5 h-5 rounded-full border border-white dark:border-neutral-900"
                            style={{ backgroundColor: item.swatch }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white dark:border-neutral-900"
                            style={{ backgroundColor: item.secondarySwatch }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-neutral-500 truncate">{item.tagline}</p>
                        </div>
                        {active && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => (user ? onNavigate('upload') : onOpenAuth())}
            className="hidden sm:flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm font-medium text-neutral-800 dark:text-neutral-100 transition-colors whitespace-nowrap shrink-0"
          >
            <VideoIcon className="w-4 h-4 text-red-600" />
            <span>Upload</span>
          </button>

          {user && (
            <div ref={notifsRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifs((p) => !p);
                  if (unreadCount > 0) onMarkNotificationsRead();
                }}
                aria-label="Notifications"
                className="min-h-[40px] min-w-[40px] relative flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto thin-scrollbar rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 shadow-xl z-50">
                  <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-sm font-semibold">Notifications</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-sm text-neutral-500">
                      No notifications yet. Activity from your subscribers and videos appears here.
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setShowNotifs(false);
                            if (n.videoKey) onNavigate('watch', n.videoKey);
                          }}
                          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
                        >
                          <img
                            src={safeMediaUrl(n.actorAvatar)}
                            alt={n.actorName}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover shrink-0 bg-neutral-200 dark:bg-neutral-700"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-neutral-800 dark:text-neutral-200 line-clamp-2">
                              {n.message}
                            </p>
                            <span className="text-xs text-neutral-500 mt-1 block">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu((p) => !p)}
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <img
                  src={safeMediaUrl(user.avatarUrl)}
                  alt={user.channelName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 shadow-xl py-2 z-50">
                  <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                    <img
                      src={safeMediaUrl(user.avatarUrl)}
                      alt={user.channelName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{user.channelName}</p>
                      <p className="text-xs text-neutral-500 truncate">@{user.username}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate('channel', user.id);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                  >
                    <UserIcon className="w-4 h-4 text-neutral-500" />
                    <span>Your Channel &amp; Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate('upload');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
                  >
                    <VideoIcon className="w-4 h-4 text-neutral-500" />
                    <span>Creator Studio &amp; Upload</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left border-t border-neutral-200 dark:border-neutral-800 mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="h-9 px-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <UserIcon className="w-4 h-4" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </header>

      {/* Voice Search Modal */}
      {voiceOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1E1E] border border-neutral-200 dark:border-neutral-700 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Voice Search</h2>
              <button
                type="button"
                onClick={() => {
                  stopVoiceRecognition();
                  setVoiceOpen(false);
                }}
                aria-label="Close voice search"
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <span className="text-xs text-neutral-500">Language:</span>
              <button
                type="button"
                onClick={() => startVoiceSearch('en-US')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  voiceLang === 'en-US'
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => startVoiceSearch('ur-PK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  voiceLang === 'ur-PK'
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                اردو (Urdu)
              </button>
            </div>

            <div className="flex flex-col items-center py-6 text-center">
              <button
                type="button"
                onClick={() =>
                  voiceStatus === 'listening' ? stopVoiceRecognition() : startVoiceSearch(voiceLang)
                }
                aria-label={voiceStatus === 'listening' ? 'Stop listening' : 'Start listening'}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                  voiceStatus === 'listening'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {voiceStatus === 'error' ? (
                  <MicOff className="w-8 h-8 text-red-600" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>
              <p className="mt-4 text-sm font-medium text-neutral-800 dark:text-neutral-200 min-h-[2.5rem]">
                {voiceMessage}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Tap the microphone to {voiceStatus === 'listening' ? 'stop' : 'speak again'}.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
