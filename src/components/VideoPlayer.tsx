import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { safeMediaUrl, type VideoItem } from '../types';

interface VideoPlayerProps {
  video: VideoItem;
  autoplay: boolean;
  theaterMode: boolean;
  initialTimeSeconds?: number;
  onToggleTheaterMode: () => void;
  onProgressUpdate?: (seconds: number, duration: number) => void;
  onEnded?: () => void;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<any> | null = null;
function loadYouTubeIframeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      resolve(window.YT);
    };
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return ytApiPromise;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${mins}:${String(s).padStart(2, '0')}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  autoplay,
  theaterMode,
  initialTimeSeconds = 0,
  onToggleTheaterMode,
  onProgressUpdate,
  onEnded,
}) => {
  // ── YouTube Official Player ──
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    if (video.source !== 'youtube' || !video.youtubeId) return;
    let cancelled = false;

    const mountPlayer = async () => {
      const YT = await loadYouTubeIframeApi();
      if (cancelled || !ytContainerRef.current) return;

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }

      ytContainerRef.current.innerHTML = '';
      const playerHost = document.createElement('div');
      playerHost.className = 'w-full h-full';
      ytContainerRef.current.appendChild(playerHost);

      ytPlayerRef.current = new YT.Player(playerHost, {
        videoId: video.youtubeId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          vq: 'hd1080',
          start: initialTimeSeconds > 5 ? Math.floor(initialTimeSeconds) : 0,
        },
        events: {
          onStateChange: (ev: any) => {
            // 0 = YT.PlayerState.ENDED
            if (ev.data === 0 && onEndedRef.current) {
              onEndedRef.current();
            }
          },
        },
      });
    };

    mountPlayer();

    return () => {
      cancelled = true;
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }
    };
  }, [video.key, video.source, video.youtubeId]);

  // ── Custom HTML5 HD Player for Creator-Uploaded Videos ──
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds || 0);
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [qualityLabel, setQualityLabel] = useState<'Auto (HD)' | '1080p HD' | '720p HD'>('Auto (HD)');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setBuffered(0);
    setSettingsOpen(false);
  }, [video.key]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const kickControlsTimer = () => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 2600);
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
    kickControlsTimer();
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    setMuted(next);
  };

  const handleVolumeChange = (val: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = val;
    el.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const handleSeek = (val: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = val;
    setCurrentTime(val);
  };

  const changeSpeed = (nextSpeed: number) => {
    const el = videoRef.current;
    if (el) el.playbackRate = nextSpeed;
    setSpeed(nextSpeed);
    setSettingsOpen(false);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const togglePiP = async () => {
    const el = videoRef.current as any;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (el.requestPictureInPicture) {
        await el.requestPictureInPicture();
      }
    } catch {
      // ignore
    }
  };

  if (video.source === 'youtube') {
    return (
      <div
        className={`w-full bg-black rounded-xl overflow-hidden relative ${
          theaterMode ? 'h-[62vh] md:h-[74vh]' : 'aspect-video'
        }`}
      >
        <div ref={ytContainerRef} className="w-full h-full" />
      </div>
    );
  }

  const videoSrc = safeMediaUrl(video.videoUrl);
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={kickControlsTimer}
      onMouseLeave={() => {
        if (playing) setShowControls(false);
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key.toLowerCase() === 'k') {
          e.preventDefault();
          togglePlay();
        } else if (e.key.toLowerCase() === 'm') {
          toggleMute();
        } else if (e.key.toLowerCase() === 'f') {
          toggleFullscreen();
        } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'l') {
          handleSeek(Math.min(duration, currentTime + 10));
        } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'j') {
          handleSeek(Math.max(0, currentTime - 10));
        }
      }}
      tabIndex={0}
      className={`group relative w-full bg-black rounded-xl overflow-hidden select-none focus:outline-none ${
        theaterMode ? 'h-[62vh] md:h-[74vh]' : 'aspect-video'
      }`}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        poster={safeMediaUrl(video.thumbnailUrl) || undefined}
        playsInline
        preload="metadata"
        autoPlay={autoplay}
        onClick={togglePlay}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setDuration(el.duration || video.durationSeconds || 0);
          if (initialTimeSeconds > 5 && initialTimeSeconds < (el.duration || 0) - 3) {
            el.currentTime = initialTimeSeconds;
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          setShowControls(true);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setCurrentTime(el.currentTime);
          if (el.buffered.length > 0) {
            setBuffered(el.buffered.end(el.buffered.length - 1));
          }
          if (onProgressUpdate && Math.floor(el.currentTime) % 3 === 0) {
            onProgressUpdate(el.currentTime, el.duration || duration);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          setShowControls(true);
          if (onEnded) onEnded();
        }}
        className="w-full h-full object-contain bg-black cursor-pointer"
      />

      {/* Center Play Overlay when paused */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity"
        >
          <span className="w-16 h-16 rounded-full bg-red-600/95 text-white flex items-center justify-center shadow-2xl">
            <Play className="w-7 h-7 ml-1 fill-white" />
          </span>
        </button>
      )}

      {/* Control Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-10 pb-2.5 px-3 md:px-4 transition-opacity duration-200 ${
          showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubbing Bar */}
        <div className="relative h-4 flex items-center cursor-pointer mb-1.5">
          <div className="w-full h-1.5 bg-white/25 rounded-full overflow-hidden relative">
            <div
              className="absolute inset-y-0 left-0 bg-white/40"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-red-600"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            aria-label="Seek video timeline"
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label="Volume"
                className="hidden sm:block w-16 accent-red-600 cursor-pointer"
              />
            </div>

            <span className="text-xs font-mono tabular-nums text-neutral-200 ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1 md:gap-2 relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((p) => !p)}
              aria-label="Playback settings"
              className="px-2 py-1 rounded-lg hover:bg-white/15 text-xs font-medium flex items-center gap-1"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline font-mono">{speed}x</span>
            </button>

            {settingsOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-52 rounded-xl bg-neutral-900/95 border border-neutral-700 p-3 shadow-2xl text-xs space-y-3 z-30">
                <div>
                  <div className="text-neutral-400 font-medium mb-1.5">Playback Speed</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => changeSpeed(r)}
                        className={`py-1 rounded font-mono ${
                          speed === r ? 'bg-red-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700'
                        }`}
                      >
                        {r}x
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-400 font-medium mb-1.5">Quality</div>
                  <div className="space-y-1">
                    {(['Auto (HD)', '1080p HD', '720p HD'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setQualityLabel(q);
                          setSettingsOpen(false);
                        }}
                        className={`w-full text-left px-2 py-1 rounded ${
                          qualityLabel === q
                            ? 'bg-red-600 text-white'
                            : 'hover:bg-neutral-800 text-neutral-200'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={togglePiP}
              aria-label="Picture in Picture"
              className="hidden sm:flex p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleTheaterMode}
              aria-label="Theater mode"
              className="hidden md:flex p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              <RectangleHorizontal className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
