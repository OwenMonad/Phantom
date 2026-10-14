import React, { useState } from 'react';
import { Track, ColorTheme } from '../types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  Sliders,
  Maximize2,
  Minimize2,
  FileText,
  Sparkles
} from 'lucide-react';
import { playP5Sound } from '../utils/sfx';

interface Props {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  showLyrics: boolean;
  currentTheme: ColorTheme;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleLyrics: () => void;
  onToggleFavorite: (id: string) => void;
  onOpenEqualizer: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export const PlayerControls: React.FC<Props> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  repeatMode,
  showLyrics,
  currentTheme,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLyrics,
  onToggleFavorite,
  onOpenEqualizer,
  onToggleFullscreen,
  isFullscreen,
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoverTime(ratio * duration);
  };

  const handleProgressBarTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches[0]) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, touchX / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <footer
      id="persona-player-bar"
      className="fixed bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 z-40 bg-[#0e0f14] border-2 border-black select-none pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      style={{
        boxShadow: `4px 4px 0px ${currentTheme.accent}`,
        clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
      }}
      aria-label="Audio Playback Controls"
    >
      {/* Top Scrubber Bar (Edge to Edge within Player with touch & click) */}
      <div
        className="relative w-full h-3 sm:h-2.5 bg-[#171822] cursor-pointer group flex items-center touch-none"
        onClick={handleProgressBarClick}
        onMouseMove={handleProgressBarMouseMove}
        onMouseLeave={() => setHoverTime(null)}
        onTouchStart={handleProgressBarTouch}
        onTouchMove={handleProgressBarTouch}
      >
        {/* Track Buffer background */}
        <div
          className="absolute left-0 top-0 bottom-0 transition-all"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: currentTheme.accent,
            boxShadow: `0 0 12px ${currentTheme.accent}`,
          }}
        />

        {/* Playhead Diamond Handle */}
        <div
          className="absolute w-3.5 h-3.5 bg-white border rotate-45 transform -translate-x-1/2 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none"
          style={{
            left: `${progressPercent}%`,
            borderColor: currentTheme.accent,
          }}
        />

        {/* Hover Time Tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 px-2 py-0.5 text-white text-[10px] font-mono font-bold tracking-wider transform -translate-x-1/2 pointer-events-none border border-black shadow-[2px_2px_0px_#000]"
            style={{
              left: `${(hoverTime / duration) * 100}%`,
              backgroundColor: currentTheme.accent,
              color: currentTheme.textOnAccent,
              clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
            }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      {/* MOBILE COMPACT VIEW (< sm) */}
      <div className="sm:hidden px-2.5 py-2 space-y-2">
        {/* Row 1: Track Details & Primary Quick Controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Cover & Title */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative w-10 h-10 bg-black border border-black flex-shrink-0 overflow-hidden shadow-[2px_2px_0px_#000]">
              {currentTrack?.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#181922] flex items-center justify-center text-white/30 text-xs font-mono">
                  P5
                </div>
              )}
              {isPlaying && (
                <div
                  className="absolute top-0 right-0 w-2 h-2"
                  style={{
                    backgroundColor: currentTheme.accent,
                    boxShadow: `0 0 8px ${currentTheme.accent}`,
                  }}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-extrabold text-white truncate font-sans tracking-wide">
                  {currentTrack?.title || 'No Audio'}
                </h3>
                {currentTrack?.format && (
                  <span
                    className="text-[8px] font-mono px-1 py-0.2 border border-black tracking-widest uppercase flex-shrink-0 font-bold"
                    style={{
                      backgroundColor: currentTheme.accent,
                      color: currentTheme.textOnAccent,
                    }}
                  >
                    {currentTrack.format}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-white/60 truncate font-mono">
                {currentTrack?.artist || 'Ready to play'}
              </p>
            </div>

            {currentTrack && (
              <button
                onClick={() => {
                  playP5Sound('click');
                  onToggleFavorite(currentTrack.id);
                }}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/50 active:scale-95"
                style={{
                  color: currentTrack.isFavorite ? currentTheme.accent : undefined,
                }}
              >
                <Heart
                  className="w-4 h-4"
                  style={{
                    fill: currentTrack.isFavorite ? currentTheme.accent : 'none',
                  }}
                />
              </button>
            )}
          </div>

          {/* Quick Play/Pause button */}
          <button
            onClick={() => {
              playP5Sound('slash');
              onTogglePlay();
            }}
            className="p5-badge-cut p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center border-2 border-black active:scale-90 transition-transform cursor-pointer"
            style={{
              backgroundColor: currentTheme.accent,
              color: currentTheme.textOnAccent,
              boxShadow: '2px 2px 0px #000',
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* Row 2: Media Navigation Buttons & Time Display */}
        <div className="flex items-center justify-between border-t border-white/10 pt-1.5 px-0.5">
          {/* Time Counter */}
          <div className="text-[10px] font-mono tracking-wider text-white/70 tabular-nums min-w-[72px]">
            <span className="text-white font-bold">{formatTime(currentTime)}</span>
            <span> / {formatTime(duration)}</span>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={() => {
                playP5Sound('toggle');
                onToggleShuffle();
              }}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              style={{
                color: isShuffle ? currentTheme.accent : 'rgba(255,255,255,0.4)',
              }}
              title="Shuffle"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                playP5Sound('slash');
                onPrevTrack();
              }}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/80 active:scale-90 cursor-pointer"
              title="Previous"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                playP5Sound('slash');
                onNextTrack();
              }}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/80 active:scale-90 cursor-pointer"
              title="Next"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                playP5Sound('toggle');
                onToggleRepeat();
              }}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              style={{
                color: repeatMode !== 'off' ? currentTheme.accent : 'rgba(255,255,255,0.4)',
              }}
              title="Repeat"
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-3.5 h-3.5" />
              ) : (
                <Repeat className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Lyrics toggle */}
            <button
              onClick={() => {
                playP5Sound('toggle');
                onToggleLyrics();
              }}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              style={{
                color: showLyrics ? currentTheme.accent : 'rgba(255,255,255,0.4)',
              }}
              title="Lyrics"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            {/* EQ toggle */}
            <button
              onClick={() => {
                playP5Sound('select');
                onOpenEqualizer();
              }}
              className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/60 active:text-[#ffd700] cursor-pointer"
              title="Equalizer"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP & TABLET VIEW (>= sm): Strictly anchored 3-column CSS Grid to eliminate layout shifting on song change */}
      <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] px-4 py-2.5 items-center gap-4">
        {/* LEFT: Current Track Info */}
        <div className="flex items-center gap-3.5 min-w-0 max-w-[320px] lg:max-w-xs justify-self-start">
          {/* Cover Thumbnail */}
          <div className="relative w-12 h-12 bg-black border-2 border-black flex-shrink-0 overflow-hidden shadow-[2px_2px_0px_#000]">
            {currentTrack?.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#181922] flex items-center justify-center text-white/30 text-xs font-mono">
                P5
              </div>
            )}
            {isPlaying && (
              <div
                className="absolute top-0 right-0 w-2.5 h-2.5"
                style={{
                  backgroundColor: currentTheme.accent,
                  boxShadow: `0 0 8px ${currentTheme.accent}`,
                }}
              />
            )}
          </div>

          {/* Song Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs md:text-sm font-extrabold text-white truncate font-sans tracking-wide">
                {currentTrack?.title || 'No Audio Playing'}
              </h3>
              {currentTrack?.format && (
                <span
                  className="text-[9px] font-mono px-1.5 py-0.2 border border-black tracking-widest uppercase flex-shrink-0 font-bold"
                  style={{
                    backgroundColor: currentTheme.accent,
                    color: currentTheme.textOnAccent,
                  }}
                >
                  {currentTrack.format}
                </span>
              )}
            </div>

            <p className="text-[11px] text-white/60 truncate font-mono mt-0.5">
              {currentTrack?.artist || 'Select a song or scan folder'}
            </p>

            {currentTrack?.sampleRate && (
              <div className="text-[9px] text-[#00d2ff] font-mono flex items-center gap-1 mt-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                <span>{currentTrack.sampleRate / 1000} kHz • {currentTrack.bitDepth || 16}-bit</span>
              </div>
            )}
          </div>

          {/* Favorite Heart */}
          {currentTrack && (
            <button
              onClick={() => {
                playP5Sound('click');
                onToggleFavorite(currentTrack.id);
              }}
              className="p-1.5 transition-colors cursor-pointer"
              style={{
                color: currentTrack.isFavorite ? currentTheme.accent : 'rgba(255,255,255,0.4)',
              }}
            >
              <Heart
                className="w-4 h-4"
                style={{
                  fill: currentTrack.isFavorite ? currentTheme.accent : 'none',
                }}
              />
            </button>
          )}
        </div>

        {/* CENTER: Main Playback Controls & Time (Locked dead-center) */}
        <div className="flex flex-col items-center justify-center gap-1 justify-self-center select-none">
          <div className="flex items-center gap-3 md:gap-5">
            {/* Shuffle Button */}
            <button
              onClick={() => {
                playP5Sound('toggle');
                onToggleShuffle();
              }}
              className="p-1.5 transition-colors cursor-pointer w-7 h-7 flex items-center justify-center"
              style={{
                color: isShuffle ? currentTheme.accent : 'rgba(255,255,255,0.4)',
              }}
              title="Shuffle Mode"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Previous */}
            <button
              onClick={() => {
                playP5Sound('slash');
                onPrevTrack();
              }}
              className="p-1.5 text-white/80 hover:text-white hover:scale-110 active:scale-90 transition-all cursor-pointer w-8 h-8 flex items-center justify-center"
              title="Previous Track"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* PLAY / PAUSE Main Action Button */}
            <button
              onClick={() => {
                playP5Sound('slash');
                onTogglePlay();
              }}
              className="relative p-3 border-2 border-black transform hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[3px_3px_0px_#000] w-12 h-12 flex items-center justify-center"
              style={{
                backgroundColor: currentTheme.accent,
                color: currentTheme.textOnAccent,
                clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={() => {
                playP5Sound('slash');
                onNextTrack();
              }}
              className="p-1.5 text-white/80 hover:text-white hover:scale-110 active:scale-90 transition-all cursor-pointer w-8 h-8 flex items-center justify-center"
              title="Next Track"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Repeat Mode */}
            <button
              onClick={() => {
                playP5Sound('toggle');
                onToggleRepeat();
              }}
              className="p-1.5 transition-colors cursor-pointer w-7 h-7 flex items-center justify-center"
              style={{
                color: repeatMode !== 'off' ? currentTheme.accent : 'rgba(255,255,255,0.4)',
              }}
              title={`Repeat: ${repeatMode.toUpperCase()}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Time Counter with non-shifting Tabular Figures */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono tracking-wider text-white/60 tabular-nums">
            <span className="text-white font-bold inline-block min-w-[34px] text-right">{formatTime(currentTime)}</span>
            <span className="text-white/40">/</span>
            <span className="inline-block min-w-[34px] text-left">{formatTime(duration)}</span>
          </div>
        </div>

        {/* RIGHT: Extra Audio Controls */}
        <div className="flex items-center gap-2 md:gap-3 justify-self-end">
          {/* Synchronized Lyrics Toggle */}
          <button
            onClick={() => {
              playP5Sound('toggle');
              onToggleLyrics();
            }}
            className="p5-badge-cut px-2.5 py-1 text-xs font-mono font-black tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-black"
            style={{
              backgroundColor: showLyrics ? currentTheme.accent : 'rgba(255,255,255,0.1)',
              color: showLyrics ? currentTheme.textOnAccent : 'rgba(255,255,255,0.6)',
              boxShadow: showLyrics ? '2px 2px 0px #000' : 'none',
            }}
            title="Toggle Floating Comic Lyrics"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">LYRICS</span>
          </button>

          {/* Equalizer Modal Toggle */}
          <button
            onClick={() => {
              playP5Sound('select');
              onOpenEqualizer();
            }}
            className="p-1.5 text-white/60 hover:text-[#ffd700] transition-colors cursor-pointer"
            title="5-Band Equalizer & Bass Boost"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Volume Control with Popover / Inline Slider */}
          <div
            className="relative flex items-center gap-2"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={() => {
                playP5Sound('toggle');
                onToggleMute();
              }}
              className="p-1.5 text-white/60 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-500" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            {/* Slider */}
            <div
              className={`transition-all duration-200 overflow-hidden flex items-center gap-1.5 ${
                showVolumeSlider ? 'w-24 opacity-100' : 'w-0 opacity-0 pointer-events-none'
              }`}
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-20 cursor-pointer h-1.5 bg-white/20"
                style={{ accentColor: currentTheme.accent }}
              />
              <span className="text-[10px] font-mono text-white/70">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => {
              playP5Sound('click');
              onToggleFullscreen();
            }}
            className="p-1.5 text-white/60 hover:text-white transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </footer>
  );
};
