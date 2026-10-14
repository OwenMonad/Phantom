/**
 * Persona 5 Style Offline Audio Player
 * 100% Offline Local Engine, 3D Particle Visualizer, Tilted Queue, 5-Band Equalizer
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Track, LyricLine, VisualizerMode, ThemeId } from './types';
import { INITIAL_DEMO_TRACKS, generateSyntheticSongBlob } from './utils/demoTracks';
import { parseAudioFile } from './utils/audioMetadata';
import { globalAudioEngine, EqualizerGains } from './utils/audioEngine';
import { playP5Sound } from './utils/sfx';
import { COLOR_THEMES } from './utils/theme';
import { PersonaVisualizer3D } from './components/PersonaVisualizer3D';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import { PlayerControls } from './components/PlayerControls';
import { EqualizerModal } from './components/EqualizerModal';
import { ThemeSelector } from './components/ThemeSelector';
import { TopBar } from './components/TopBar';
import { LyricsModal } from './components/LyricsModal';
import { parseLrcString } from './utils/lrcParser';
import { fetchOnlineLyrics } from './utils/onlineLyrics';
import confetti from 'canvas-confetti';
import { FolderDown } from 'lucide-react';
import {
  loadStoredTracks,
  saveTracksToStorage,
  saveTrackToStorage,
  deleteTrackFromStorage,
  updateTrackFavoriteInStorage,
  updateTrackLyricsInStorage,
  cleanupIndexedDB,
} from './utils/trackStorage';
import { recordPlaybackHistory } from './utils/historyStorage';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_DEMO_TRACKS);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(INITIAL_DEMO_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(INITIAL_DEMO_TRACKS[0].duration);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('particles');
  const [showLyrics, setShowLyrics] = useState(true);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>('phantom-red');
  const [showSpeedlines, setShowSpeedlines] = useState(true);
  const [soundFxEnabled, setSoundFxEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isQueueExpanded, setIsQueueExpanded] = useState(true);
  const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ isScanning: boolean; current: number; total: number } | null>(null);

  const currentTheme = COLOR_THEMES[themeId] || COLOR_THEMES['phantom-red'];

  // Sync theme CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--theme-accent', currentTheme.accent);
    document.documentElement.style.setProperty('--theme-glow', currentTheme.accentGlow);
    document.documentElement.style.setProperty('--theme-accent-hover', currentTheme.accentHover);
  }, [currentTheme]);

  const [equalizerGains, setEqualizerGains] = useState<EqualizerGains>({
    band60: 4,
    band250: 2,
    band1k: -1,
    band4k: 3,
    band12k: 4,
    bassBoost: 3,
  });

  // Reference to current track to prevent stale closures in audio event listeners
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const isShuffleRef = useRef(isShuffle);
  isShuffleRef.current = isShuffle;

  // Load previously scanned music library from offline IndexedDB storage on startup
  useEffect(() => {
    let isMounted = true;
    cleanupIndexedDB().catch(() => {});
    loadStoredTracks().then((storedTracks) => {
      if (!isMounted) return;
      if (storedTracks.length > 0) {
        // User has previously scanned or imported songs! Restore them immediately!
        setTracks(storedTracks);
        // Restore last played track or default to first stored track
        const savedLastId = localStorage.getItem('p5_last_track_id');
        const found = storedTracks.find((t) => t.id === savedLastId) || storedTracks[0];
        setCurrentTrack(found);
        setDuration(found.duration);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Save last selected track ID to restore on next launch
  useEffect(() => {
    if (currentTrack?.id) {
      localStorage.setItem('p5_last_track_id', currentTrack.id);
    }
  }, [currentTrack]);

  // Initialize Synthetic audio for demo tracks if not generated yet
  const ensureTrackPlayable = useCallback((track: Track): Track => {
    if (track.url && track.url.length > 0) return track;
    // Generate synthetic audio for demo track
    const mood = track.id.includes('life') ? 'rock' : track.id.includes('beneath') ? 'lofi' : 'funk';
    const blobUrl = generateSyntheticSongBlob(112, Math.min(80, track.duration || 60), mood);
    const updated = { ...track, url: blobUrl };
    setTracks((prev) => prev.map((t) => (t.id === track.id ? updated : t)));
    return updated;
  }, []);

  // Play a specific track
  const handlePlayTrack = useCallback(async (track: Track) => {
    const readyTrack = ensureTrackPlayable(track);
    setCurrentTrack(readyTrack);
    setDuration(readyTrack.duration);
    recordPlaybackHistory(readyTrack, tracksRef.current);
    try {
      await globalAudioEngine.playTrack(readyTrack);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [ensureTrackPlayable]);

  // Next Track logic
  const handleNextTrack = useCallback(() => {
    const currentList = tracksRef.current;
    if (currentList.length === 0) return;

    if (isShuffleRef.current) {
      const randomIdx = Math.floor(Math.random() * currentList.length);
      handlePlayTrack(currentList[randomIdx]);
      return;
    }

    const currentIndex = currentList.findIndex((t) => t.id === currentTrackRef.current?.id);
    if (currentIndex >= 0 && currentIndex < currentList.length - 1) {
      handlePlayTrack(currentList[currentIndex + 1]);
    } else {
      // Loop back to start if repeat is not off
      if (repeatModeRef.current !== 'off') {
        handlePlayTrack(currentList[0]);
      } else {
        setIsPlaying(false);
      }
    }
  }, [handlePlayTrack]);

  // Prev Track logic
  const handlePrevTrack = useCallback(() => {
    const currentList = tracksRef.current;
    if (currentList.length === 0) return;

    // If more than 3 seconds played, restart song
    if (globalAudioEngine.getCurrentTime() > 3) {
      globalAudioEngine.seek(0);
      return;
    }

    const currentIndex = currentList.findIndex((t) => t.id === currentTrackRef.current?.id);
    if (currentIndex > 0) {
      handlePlayTrack(currentList[currentIndex - 1]);
    } else {
      handlePlayTrack(currentList[currentList.length - 1]);
    }
  }, [handlePlayTrack]);

  // Audio Engine event subscriptions
  useEffect(() => {
    const unsubscribeTime = globalAudioEngine.onTimeUpdate((time, dur) => {
      setCurrentTime(time);
      if (dur > 0 && Number.isFinite(dur)) {
        setDuration(dur);
      }
    });

    const unsubscribeEnded = globalAudioEngine.onEnded(() => {
      if (repeatModeRef.current === 'one') {
        globalAudioEngine.seek(0);
        globalAudioEngine.resume().catch(() => {});
      } else {
        handleNextTrack();
      }
    });

    // Apply initial EQ
    globalAudioEngine.setEqualizer(equalizerGains);

    return () => {
      unsubscribeTime();
      unsubscribeEnded();
    };
  }, [equalizerGains, handleNextTrack]);

  // Toggle Play / Pause
  const handleTogglePlay = async () => {
    if (isPlaying) {
      globalAudioEngine.pause();
      setIsPlaying(false);
    } else {
      if (currentTrack) {
        const ready = ensureTrackPlayable(currentTrack);
        recordPlaybackHistory(ready, tracksRef.current);
        try {
          await globalAudioEngine.playTrack(ready);
          setIsPlaying(true);
        } catch {
          // Audio play fallback
        }
      } else if (tracks.length > 0) {
        handlePlayTrack(tracks[0]);
      }
    }
  };

  // Seek
  const handleSeek = (seconds: number) => {
    globalAudioEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  // Sync Android MediaSession & Lock screen controls
  useEffect(() => {
    globalAudioEngine.updateMediaSession(currentTrack, isPlaying, {
      onPlay: () => {
        globalAudioEngine.resume().then(() => setIsPlaying(true)).catch(() => {});
      },
      onPause: () => {
        globalAudioEngine.pause();
        setIsPlaying(false);
      },
      onNext: () => handleNextTrack(),
      onPrev: () => handlePrevTrack(),
      onSeek: (time: number) => handleSeek(time),
    });
  }, [currentTrack, isPlaying, handleNextTrack, handlePrevTrack]);

  // Volume
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    globalAudioEngine.setVolume(newVol);
    if (isMuted && newVol > 0) {
      setIsMuted(false);
      globalAudioEngine.setMuted(false);
    }
  };

  // Mute
  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    globalAudioEngine.setMuted(nextMute);
  };

  // Shuffle toggle
  const handleToggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  // Repeat toggle
  const handleToggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  // Equalizer Gains Change
  const handleChangeGains = (newGains: EqualizerGains) => {
    setEqualizerGains(newGains);
    globalAudioEngine.setEqualizer(newGains);
  };

  // Favorite toggle with Persona 5 comic burst effect
  const handleToggleFavorite = async (id: string) => {
    const target = tracks.find((t) => t.id === id);
    const nextFav = target ? !target.isFavorite : true;
    await updateTrackFavoriteInStorage(id, nextFav);

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          if (nextFav) {
            confetti({
              particleCount: 35,
              spread: 60,
              origin: { y: 0.85 },
              colors: ['#e60012', '#ffd700', '#ffffff'],
            });
          }
          return { ...t, isFavorite: nextFav };
        }
        return t;
      })
    );
    if (currentTrack?.id === id) {
      setCurrentTrack((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  // Delete Track from playlist and remove from IndexedDB storage
  const handleDeleteTrack = async (id: string) => {
    await deleteTrackFromStorage(id);
    setTracks((prev) => prev.filter((t) => t.id !== id));
    if (currentTrack?.id === id) {
      const remaining = tracks.filter((t) => t.id !== id);
      if (remaining.length > 0) {
        handlePlayTrack(remaining[0]);
      } else {
        globalAudioEngine.pause();
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    }
  };

  // Save lyrics to track and persist permanently in IndexedDB without re-storing audio blobs
  const handleSaveLyrics = async (trackId: string, lyrics: LyricLine[]) => {
    const updated = tracks.map((t) => (t.id === trackId ? { ...t, lyrics } : t));
    setTracks(updated);
    if (currentTrack?.id === trackId) {
      setCurrentTrack((prev) => (prev ? { ...prev, lyrics } : null));
    }
    await updateTrackLyricsInStorage(trackId, lyrics);
  };

  // Automatic online lyrics stream whenever a track is played without lyrics
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [lyricsNotice, setLyricsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTrack || (currentTrack.lyrics && currentTrack.lyrics.length > 0)) {
      return;
    }

    const abortCtrl = new AbortController();
    let isCancelled = false;

    const streamLyrics = async () => {
      setIsFetchingLyrics(true);
      try {
        const result = await fetchOnlineLyrics(
          currentTrack.title,
          currentTrack.artist,
          currentTrack.duration,
          abortCtrl.signal
        );

        if (!isCancelled && result && result.lyrics.length > 0) {
          await handleSaveLyrics(currentTrack.id, result.lyrics);
          setLyricsNotice(`Synced lyrics streamed for "${result.trackName || currentTrack.title}"!`);
          setTimeout(() => setLyricsNotice(null), 4000);
        }
      } catch {
        // Ignored if cancelled or offline
      } finally {
        if (!isCancelled) {
          setIsFetchingLyrics(false);
        }
      }
    };

    streamLyrics();

    return () => {
      isCancelled = true;
      abortCtrl.abort();
    };
  }, [currentTrack?.id]);

  // Import files from input or drop with permanent IndexedDB persistence & auto LRC pairing
  const handleImportFiles = async (fileList: FileList) => {
    playP5Sound('slash');
    const totalFiles = fileList.length;
    setScanStatus({ isScanning: true, current: 0, total: totalFiles });

    // 1. Separate LRC files first to auto-match with audio files by filename
    const lrcMap = new Map<string, LyricLine[]>();
    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      if (file.name.match(/\.lrc$/i)) {
        try {
          const text = await file.text();
          const baseName = file.name.replace(/\.lrc$/i, '').trim().toLowerCase();
          const parsed = parseLrcString(text);
          if (parsed.length > 0) {
            lrcMap.set(baseName, parsed);
          }
        } catch {
          // ignore
        }
      }
    }

    const newTracks: Track[] = [];

    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      // Check audio mime type or extension
      if (file.type.startsWith('audio/') || file.name.match(/\.(flac|mp3|wav|ogg|m4a|aac|opus|webm)$/i)) {
        try {
          const parsed = await parseAudioFile(file);
          // Check if there is an accompanying .lrc file in the same folder / drop
          const baseName = file.name.replace(/\.[^/.]+$/, '').trim().toLowerCase();
          if (lrcMap.has(baseName)) {
            parsed.lyrics = lrcMap.get(baseName);
          }
          newTracks.push(parsed);
        } catch {
          // ignore unreadable file
        }
      }
      setScanStatus({ isScanning: true, current: i + 1, total: totalFiles });
    }

    if (newTracks.length > 0) {
      // 1. Immediately persist newly scanned tracks into IndexedDB
      await saveTracksToStorage(newTracks);

      setTracks((prev) => [...newTracks, ...prev]);
      // Immediately play the first newly imported file
      handlePlayTrack(newTracks[0]);
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.2 },
        colors: ['#e60012', '#00d2ff', '#ffffff', '#ffd700'],
      });
    }

    setScanStatus(null);
  };

  // Drag & Drop handlers on window
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleImportFiles(e.dataTransfer.files);
    }
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      id="phantom-app-root"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-screen h-screen text-white overflow-hidden select-none font-sans"
      style={{ backgroundColor: currentTheme.bgDark }}
    >
      {/* Background Graphic Persona 5 Accent Slits & Dynamic Album Art Aura */}
      <div className="absolute inset-0 pointer-events-none opacity-25 overflow-hidden transition-opacity duration-700">
        {currentTrack?.coverUrl && (
          <img
            src={currentTrack.coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 opacity-25 mix-blend-screen"
          />
        )}
        <div
          className="absolute -top-40 -left-20 w-[600px] h-[900px] transform rotate-12 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${currentTheme.accent} 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-[600px] h-[900px] bg-gradient-to-tl from-[#00d2ff] to-transparent transform -rotate-12 blur-3xl opacity-30"
        />
      </div>

      {/* Manga Speed Lines Overlay */}
      {showSpeedlines && (
        <div
          className="p5-speedlines absolute inset-0 pointer-events-none transition-opacity duration-500"
          style={{ opacity: isPlaying ? 0.35 : 0.15 }}
        />
      )}

      {/* SCANNING & SAVING PROGRESS OVERLAY */}
      {scanStatus && scanStatus.isScanning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
          <div
            className="p5-badge-cut px-6 py-3 border-2 border-black flex items-center gap-3 text-white font-display text-sm tracking-wider shadow-[4px_4px_0px_#000]"
            style={{ backgroundColor: currentTheme.accent, color: currentTheme.textOnAccent }}
          >
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>
              SCANNING & SAVING OFFLINE: {scanStatus.current} / {scanStatus.total} TRACKS
            </span>
          </div>
        </div>
      )}

      {/* ONLINE LYRICS STREAMED NOTIFICATION */}
      {lyricsNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
          <div
            className="p5-badge-cut px-5 py-2.5 border-2 border-black flex items-center gap-2.5 font-display text-xs tracking-wider shadow-[4px_4px_0px_#000]"
            style={{ backgroundColor: currentTheme.accent, color: currentTheme.textOnAccent }}
          >
            <span>★</span>
            <span className="font-bold uppercase">{lyricsNotice}</span>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <TopBar
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenThemeSelector={() => setIsThemeSelectorOpen(true)}
        onImportFiles={handleImportFiles}
        onToggleQueue={() => setIsQueueExpanded((prev) => !prev)}
        isQueueExpanded={isQueueExpanded}
        trackCount={tracks.length}
        soundFxEnabled={soundFxEnabled}
        onToggleSoundFx={() => setSoundFxEnabled(!soundFxEnabled)}
        currentTheme={currentTheme}
      />

      {/* CENTER STAGE: 3D Audio-Reactive Visualizer & Synced 3D Floating Queue */}
      <main className="absolute inset-0 z-10">
        <PersonaVisualizer3D
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          mode={visualizerMode}
          onModeChange={setVisualizerMode}
          showLyrics={showLyrics}
          currentTheme={currentTheme}
          tracks={tracks}
          onSelectTrack={handlePlayTrack}
          isQueueExpanded={isQueueExpanded}
          onToggleQueue={() => setIsQueueExpanded(!isQueueExpanded)}
          onOpenLyricsModal={() => setIsLyricsModalOpen(true)}
          isFetchingLyrics={isFetchingLyrics}
        />
      </main>

      {/* SLIDE-OUT LEFT: Full Local Library Drawer */}
      <PlaylistDrawer
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        tracks={tracks}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onSelectTrack={handlePlayTrack}
        onToggleFavorite={handleToggleFavorite}
        onDeleteTrack={handleDeleteTrack}
        onImportFiles={handleImportFiles}
        currentTheme={currentTheme}
      />

      {/* BOTTOM BAR: Audio Playback Controls & Waveform Scrubber */}
      <PlayerControls
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        showLyrics={showLyrics}
        onTogglePlay={handleTogglePlay}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleLyrics={() => setShowLyrics(!showLyrics)}
        onToggleFavorite={handleToggleFavorite}
        onOpenEqualizer={() => setIsEqualizerOpen(true)}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        currentTheme={currentTheme}
      />

      {/* EQUALIZER MODAL */}
      <EqualizerModal
        isOpen={isEqualizerOpen}
        onClose={() => setIsEqualizerOpen(false)}
        gains={equalizerGains}
        onChangeGains={handleChangeGains}
        currentTheme={currentTheme}
      />

      {/* THEME & COMIC STYLE SELECTOR MODAL */}
      <ThemeSelector
        isOpen={isThemeSelectorOpen}
        onClose={() => setIsThemeSelectorOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={(id) => setThemeId(id)}
        showSpeedlines={showSpeedlines}
        onToggleSpeedlines={() => setShowSpeedlines(!showSpeedlines)}
      />

      {/* LYRICS IMPORT & SYNCHRONIZER MODAL */}
      <LyricsModal
        isOpen={isLyricsModalOpen}
        onClose={() => setIsLyricsModalOpen(false)}
        currentTrack={currentTrack}
        onSaveLyrics={handleSaveLyrics}
        currentTheme={currentTheme}
      />

      {/* DRAG & DROP FULLSCREEN COMIC OVERLAY */}
      {isDragOver && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none p-6 text-center"
          style={{ backgroundColor: `${currentTheme.accent}e6` }}
        >
          <div
            className="bg-black text-white p-8 border-4 border-white shadow-[0_0_50px_rgba(0,0,0,0.8)] transform -rotate-3"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 25px) 0, 100% 25px, 100% 100%, 25px 100%, 0 calc(100% - 25px))',
            }}
          >
            <FolderDown className="w-16 h-16 text-[#ffd700] mx-auto mb-4 animate-bounce" />
            <h2 className="text-4xl font-extrabold font-display tracking-widest text-white uppercase">
              DROP AUDIO FILES OR FOLDERS!
            </h2>
            <p className="text-sm font-mono text-white/80 mt-2">
              Supports FLAC, WAV, MP3, OGG, AAC, M4A, OPUS • 100% Offline
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
