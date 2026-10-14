import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Track, ColorTheme } from '../types';
import {
  FolderOpen,
  FileAudio,
  Search,
  X,
  Heart,
  Trash2,
  Play,
  Pause,
  HardDrive,
  Sparkles,
  Volume2,
  User,
  Disc,
  ChevronDown,
  ChevronRight,
  Database,
  CheckCircle,
} from 'lucide-react';
import { playP5Sound } from '../utils/sfx';
import { getStorageUsage, cleanupIndexedDB } from '../utils/trackStorage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteTrack: (id: string) => void;
  onImportFiles: (files: FileList) => void;
  currentTheme: ColorTheme;
}

export const PlaylistDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  tracks,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onToggleFavorite,
  onDeleteTrack,
  onImportFiles,
  currentTheme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'artists' | 'albums' | 'favorites'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; quotaBytes: number; trackCount: number } | null>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [storageCleanNotice, setStorageCleanNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Refresh storage usage whenever drawer opens or tracks change
  const refreshStorage = () => {
    getStorageUsage().then(setStorageUsage).catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      refreshStorage();
    }
  }, [isOpen, tracks.length]);

  const handleCleanStorage = async () => {
    playP5Sound('slash');
    setIsCleaningStorage(true);
    try {
      await cleanupIndexedDB();
      refreshStorage();
      setStorageCleanNotice('IndexedDB cleaned & compacted!');
      setTimeout(() => setStorageCleanNotice(null), 3000);
    } catch {
      // ignore
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const toggleGroup = (key: string) => {
    playP5Sound('toggle');
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Filtered tracks for 'all' and 'favorites'
  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (activeTab === 'favorites') return t.isFavorite;
      return true;
    });
  }, [tracks, searchQuery, activeTab]);

  // Grouped by Artist
  const artistGroups = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const t of tracks) {
      const artist = t.artist?.trim() || 'Unknown Artist';
      if (!map.has(artist)) map.set(artist, []);
      map.get(artist)!.push(t);
    }
    const q = searchQuery.toLowerCase().trim();
    return Array.from(map.entries())
      .map(([artist, artistTracks]) => ({
        artist,
        tracks: artistTracks,
        coverUrl: artistTracks.find((tr) => tr.coverUrl)?.coverUrl || '',
        totalDuration: artistTracks.reduce((acc, tr) => acc + tr.duration, 0),
      }))
      .filter((g) => {
        if (!q) return true;
        return (
          g.artist.toLowerCase().includes(q) ||
          g.tracks.some((tr) => tr.title.toLowerCase().includes(q) || tr.album.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.artist.localeCompare(b.artist));
  }, [tracks, searchQuery]);

  // Grouped by Album
  const albumGroups = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const t of tracks) {
      const album = t.album?.trim() || 'Unknown Album';
      if (!map.has(album)) map.set(album, []);
      map.get(album)!.push(t);
    }
    const q = searchQuery.toLowerCase().trim();
    return Array.from(map.entries())
      .map(([album, albumTracks]) => ({
        album,
        artist: albumTracks[0]?.artist || 'Various Artists',
        tracks: albumTracks,
        coverUrl: albumTracks.find((tr) => tr.coverUrl)?.coverUrl || '',
        totalDuration: albumTracks.reduce((acc, tr) => acc + tr.duration, 0),
      }))
      .filter((g) => {
        if (!q) return true;
        return (
          g.album.toLowerCase().includes(q) ||
          g.artist.toLowerCase().includes(q) ||
          g.tracks.some((tr) => tr.title.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.album.localeCompare(b.album));
  }, [tracks, searchQuery]);

  const totalSeconds = tracks.reduce((acc, t) => acc + t.duration, 0);

  return (
    <>
      {/* Hidden File Inputs for Scanning */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac"
        className="hidden"
        onChange={(e) => e.target.files && onImportFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browsers for folder picking
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onImportFiles(e.target.files)}
      />

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => {
            playP5Sound('back');
            onClose();
          }}
        />
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-50 w-full sm:w-[460px] bg-[#0c0d12] border-r-3 border-black transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          boxShadow: isOpen ? `8px 0px 0px ${currentTheme.accent}, 16px 0px 24px rgba(0,0,0,0.8)` : 'none',
        }}
      >
        {/* Header (Persona 5 Comic Angled Cut) */}
        <div
          className="relative p-4 sm:p-5 text-black border-b-2 border-black flex items-center justify-between overflow-hidden"
          style={{
            backgroundColor: currentTheme.accent,
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), 0 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rotate-45 bg-black" />
            <div>
              <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase font-sans leading-none drop-shadow-sm">
                LOCAL LIBRARY
              </h2>
              <p className="text-[10px] font-mono tracking-widest font-black uppercase mt-1 opacity-80">
                100% OFFLINE DATABASE // PERSONA 5
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playP5Sound('back');
              onClose();
            }}
            className="p5-badge-cut p-2 bg-black text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer border border-white/20"
            title="Close Library"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Actions & Quick Importer */}
        <div className="p-4 bg-[#12131a] border-b border-white/10 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                playP5Sound('select');
                folderInputRef.current?.click();
              }}
              className="p5-badge-cut py-2 px-3 bg-[#1e202d] text-white hover:bg-white hover:text-black border border-white/20 flex items-center justify-center gap-2 text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer group"
            >
              <FolderOpen className="w-4 h-4 text-[#ffd700] group-hover:text-black" />
              <span>SCAN FOLDER</span>
            </button>

            <button
              onClick={() => {
                playP5Sound('select');
                fileInputRef.current?.click();
              }}
              className="p5-badge-cut py-2 px-3 bg-[#1e202d] text-white hover:bg-white hover:text-black border border-white/20 flex items-center justify-center gap-2 text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer group"
            >
              <FileAudio className="w-4 h-4 text-[#00d2ff] group-hover:text-black" />
              <span>ADD FILES</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search title, artist, or album..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#08090d] border border-white/20 text-white pl-9 pr-8 py-2 text-xs font-mono focus:outline-hidden focus:border-[#ffd700] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clean storage toast notice */}
          {storageCleanNotice && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{storageCleanNotice}</span>
            </div>
          )}

          {/* Library Category Tabs (ALL, ARTIST, ALBUM, FAVORITES) - Responsive Grid, Never Cut Off */}
          <div className="grid grid-cols-4 gap-1 border-b border-white/10 pt-1">
            <button
              onClick={() => {
                playP5Sound('toggle');
                setActiveTab('all');
              }}
              className={`pb-2.5 px-1 text-center font-mono font-bold tracking-wider transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                activeTab === 'all'
                  ? 'border-b-2 font-black text-white'
                  : 'text-white/45 hover:text-white'
              }`}
              style={{
                color: activeTab === 'all' ? currentTheme.accent : undefined,
                borderBottomColor: activeTab === 'all' ? currentTheme.accent : 'transparent',
              }}
            >
              <span className="text-xs">ALL</span>
              <span className="text-[10px] font-normal opacity-75">({tracks.length})</span>
            </button>

            <button
              onClick={() => {
                playP5Sound('toggle');
                setActiveTab('artists');
              }}
              className={`pb-2.5 px-1 text-center font-mono font-bold tracking-wider transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                activeTab === 'artists'
                  ? 'border-b-2 font-black text-white'
                  : 'text-white/45 hover:text-white'
              }`}
              style={{
                color: activeTab === 'artists' ? currentTheme.accent : undefined,
                borderBottomColor: activeTab === 'artists' ? currentTheme.accent : 'transparent',
              }}
            >
              <span className="flex items-center gap-1 text-xs">
                <User className="w-3 h-3 hidden sm:inline" />
                ARTIST
              </span>
              <span className="text-[10px] font-normal opacity-75">({artistGroups.length})</span>
            </button>

            <button
              onClick={() => {
                playP5Sound('toggle');
                setActiveTab('albums');
              }}
              className={`pb-2.5 px-1 text-center font-mono font-bold tracking-wider transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                activeTab === 'albums'
                  ? 'border-b-2 font-black text-white'
                  : 'text-white/45 hover:text-white'
              }`}
              style={{
                color: activeTab === 'albums' ? currentTheme.accent : undefined,
                borderBottomColor: activeTab === 'albums' ? currentTheme.accent : 'transparent',
              }}
            >
              <span className="flex items-center gap-1 text-xs">
                <Disc className="w-3 h-3 hidden sm:inline" />
                ALBUM
              </span>
              <span className="text-[10px] font-normal opacity-75">({albumGroups.length})</span>
            </button>

            <button
              onClick={() => {
                playP5Sound('toggle');
                setActiveTab('favorites');
              }}
              className={`pb-2.5 px-1 text-center font-mono font-bold tracking-wider transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 ${
                activeTab === 'favorites'
                  ? 'border-b-2 font-black text-white'
                  : 'text-white/45 hover:text-white'
              }`}
              style={{
                color: activeTab === 'favorites' ? currentTheme.accent : undefined,
                borderBottomColor: activeTab === 'favorites' ? currentTheme.accent : 'transparent',
              }}
            >
              <span className="flex items-center gap-1 text-xs">
                <Heart className="w-3 h-3 hidden sm:inline" />
                <span className="sm:hidden">FAV</span>
                <span className="hidden sm:inline">FAVORITE</span>
              </span>
              <span className="text-[10px] font-normal opacity-75">({tracks.filter((t) => t.isFavorite).length})</span>
            </button>
          </div>
        </div>

        {/* Content View: ALL, ARTIST, ALBUM, FAVORITES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
          {/* 1. ARTISTS VIEW */}
          {activeTab === 'artists' && (
            artistGroups.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-white/40">
                <User className="w-10 h-10 mb-3 text-white/20" />
                <p className="text-sm font-bold text-white/70">No Artists Found</p>
                <p className="text-xs font-mono mt-1">Import audio files or scan a folder to populate artists.</p>
              </div>
            ) : (
              artistGroups.map((g) => {
                const isExpanded = !!expandedGroups[g.artist];
                return (
                  <div key={g.artist} className="border border-white/10 bg-[#101116] overflow-hidden">
                    {/* Artist Header Accordion */}
                    <div
                      onClick={() => toggleGroup(g.artist)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-black flex-shrink-0 border border-white/10 overflow-hidden relative">
                          {g.coverUrl ? (
                            <img src={g.coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white/40 font-mono text-xs font-bold">
                              {g.artist.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-white truncate font-sans">{g.artist}</h3>
                          <p className="text-[11px] font-mono text-white/50 mt-0.5">
                            {g.tracks.length} {g.tracks.length === 1 ? 'TRACK' : 'TRACKS'} • {formatTime(g.totalDuration)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-white/60" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white/60" />
                        )}
                      </div>
                    </div>

                    {/* Artist Sub-Tracks */}
                    {isExpanded && (
                      <div className="border-t border-white/10 bg-[#0a0b0f] p-2 space-y-1">
                        {g.tracks.map((track, idx) => {
                          const isCurrent = currentTrack?.id === track.id;
                          return (
                            <div
                              key={track.id}
                              onClick={() => {
                                playP5Sound('select');
                                onSelectTrack(track);
                              }}
                              className={`p-2 flex items-center justify-between gap-2.5 transition-all cursor-pointer border ${
                                isCurrent
                                  ? 'bg-[#181922] border-white/40'
                                  : 'bg-[#12131a]/60 hover:bg-[#181922] border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[10px] font-mono text-white/40 w-4 text-center">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <h4
                                    className="text-xs font-bold truncate"
                                    style={{ color: isCurrent ? currentTheme.accent : '#ffffff' }}
                                  >
                                    {track.title}
                                  </h4>
                                  <p className="text-[10px] font-mono text-white/40 truncate">{track.album}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-white/5 text-white/60 border border-white/10 uppercase">
                                  {track.format}
                                </span>
                                <span className="text-xs font-mono text-white/40">{formatTime(track.duration)}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playP5Sound('click');
                                    onToggleFavorite(track.id);
                                  }}
                                  className="p-1 cursor-pointer"
                                  style={{ color: track.isFavorite ? currentTheme.accent : 'rgba(255,255,255,0.3)' }}
                                >
                                  <Heart
                                    className="w-3.5 h-3.5"
                                    style={{ fill: track.isFavorite ? currentTheme.accent : 'none' }}
                                  />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}

          {/* 2. ALBUMS VIEW */}
          {activeTab === 'albums' && (
            albumGroups.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-white/40">
                <Disc className="w-10 h-10 mb-3 text-white/20" />
                <p className="text-sm font-bold text-white/70">No Albums Found</p>
                <p className="text-xs font-mono mt-1">Import songs with album metadata to view them here.</p>
              </div>
            ) : (
              albumGroups.map((g) => {
                const isExpanded = !!expandedGroups[g.album];
                return (
                  <div key={g.album} className="border border-white/10 bg-[#101116] overflow-hidden">
                    {/* Album Header Accordion */}
                    <div
                      onClick={() => toggleGroup(g.album)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 bg-black flex-shrink-0 border border-white/10 overflow-hidden relative shadow-[2px_2px_0px_#000]">
                          {g.coverUrl ? (
                            <img src={g.coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-[#ffd700] font-mono text-xs font-bold">
                              ALBUM
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-white truncate font-sans">{g.album}</h3>
                          <p className="text-[11px] font-mono text-white/60 truncate">{g.artist}</p>
                          <p className="text-[10px] font-mono text-white/40 mt-0.5">
                            {g.tracks.length} {g.tracks.length === 1 ? 'TRACK' : 'TRACKS'} • {formatTime(g.totalDuration)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-white/60" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white/60" />
                        )}
                      </div>
                    </div>

                    {/* Album Tracks */}
                    {isExpanded && (
                      <div className="border-t border-white/10 bg-[#0a0b0f] p-2 space-y-1">
                        {g.tracks.map((track, idx) => {
                          const isCurrent = currentTrack?.id === track.id;
                          return (
                            <div
                              key={track.id}
                              onClick={() => {
                                playP5Sound('select');
                                onSelectTrack(track);
                              }}
                              className={`p-2 flex items-center justify-between gap-2.5 transition-all cursor-pointer border ${
                                isCurrent
                                  ? 'bg-[#181922] border-white/40'
                                  : 'bg-[#12131a]/60 hover:bg-[#181922] border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[10px] font-mono text-white/40 w-4 text-center">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <h4
                                    className="text-xs font-bold truncate"
                                    style={{ color: isCurrent ? currentTheme.accent : '#ffffff' }}
                                  >
                                    {track.title}
                                  </h4>
                                  <p className="text-[10px] font-mono text-white/40 truncate">{track.artist}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-white/5 text-white/60 border border-white/10 uppercase">
                                  {track.format}
                                </span>
                                <span className="text-xs font-mono text-white/40">{formatTime(track.duration)}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playP5Sound('click');
                                    onToggleFavorite(track.id);
                                  }}
                                  className="p-1 cursor-pointer"
                                  style={{ color: track.isFavorite ? currentTheme.accent : 'rgba(255,255,255,0.3)' }}
                                >
                                  <Heart
                                    className="w-3.5 h-3.5"
                                    style={{ fill: track.isFavorite ? currentTheme.accent : 'none' }}
                                  />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}

          {/* 3. ALL SONGS & FAVORITES VIEW */}
          {(activeTab === 'all' || activeTab === 'favorites') && (
            filteredTracks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-white/40">
                <HardDrive className="w-10 h-10 mb-3 text-white/20" />
                <p className="text-sm font-bold text-white/70">
                  {activeTab === 'favorites' ? 'No Favorites Yet' : 'No Audio Files Found'}
                </p>
                <p className="text-xs font-mono mt-1">
                  {activeTab === 'favorites'
                    ? 'Click the heart icon on any song to add it here.'
                    : 'Click "Scan Folder" or drag audio files anywhere into the window.'}
                </p>
              </div>
            ) : (
              filteredTracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      playP5Sound('select');
                      onSelectTrack(track);
                    }}
                    className={`group relative p-2 pr-3 flex items-center gap-3 transition-all border-2 border-black cursor-pointer ${
                      isCurrent
                        ? 'bg-[#181922]'
                        : 'bg-[#101116]/80 hover:bg-[#15161f]'
                    }`}
                    style={{
                      boxShadow: isCurrent ? `3px 3px 0px ${currentTheme.accent}` : '2px 2px 0px #000',
                      clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                    }}
                  >
                    {/* Index or Equalizer */}
                    <div className="w-6 text-center text-xs font-mono text-white/40 flex-shrink-0">
                      {isCurrent && isPlaying ? (
                        <Volume2 className="w-4 h-4 mx-auto animate-pulse" style={{ color: currentTheme.accent }} />
                      ) : (
                        <span>{String(idx + 1).padStart(2, '0')}</span>
                      )}
                    </div>

                    {/* Thumbnail */}
                    <div className="relative w-10 h-10 bg-black flex-shrink-0 border border-white/10 overflow-hidden">
                      <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        {isCurrent && isPlaying ? (
                          <Pause className="w-4 h-4 text-white" />
                        ) : (
                          <Play className="w-4 h-4 text-white fill-white" />
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className="text-xs font-bold truncate font-sans"
                          style={{ color: isCurrent ? currentTheme.accent : '#ffffff' }}
                        >
                          {track.title}
                        </h4>
                        {track.lyrics && track.lyrics.length > 0 && (
                          <span className="text-[8px] font-mono px-1 py-0.2 bg-[#ffd700] text-black font-black uppercase tracking-tight">
                            LRC
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/50 truncate font-mono">
                        {track.artist} • {track.album}
                      </p>
                    </div>

                    {/* Format Badge & Duration */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 uppercase tracking-wider font-bold"
                        style={{
                          backgroundColor: track.format === 'FLAC' || track.format === 'WAV' ? '#00d2ff' : 'rgba(255,255,255,0.1)',
                          color: track.format === 'FLAC' || track.format === 'WAV' ? '#000' : 'rgba(255,255,255,0.8)',
                        }}
                      >
                        {track.format}
                      </span>

                      <span className="text-xs font-mono text-white/40">{formatTime(track.duration)}</span>

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playP5Sound('click');
                          onToggleFavorite(track.id);
                        }}
                        className="p-1 transition-colors cursor-pointer"
                        style={{
                          color: track.isFavorite ? currentTheme.accent : 'rgba(255,255,255,0.2)',
                        }}
                        title={track.isFavorite ? 'Unfavorite' : 'Favorite'}
                      >
                        <Heart
                          className="w-4 h-4"
                          style={{
                            fill: track.isFavorite ? currentTheme.accent : 'none',
                          }}
                        />
                      </button>

                      {/* Delete Track */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playP5Sound('slash');
                          onDeleteTrack(track.id);
                        }}
                        className="p-1 text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove from player"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Footer Library Stats & IndexedDB Storage Management */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-[#090a0d] flex items-center justify-between text-[11px] font-mono text-white/50">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-zinc-400" />
            <span>
              {storageUsage
                ? `IDB: ${(storageUsage.usedBytes / (1024 * 1024)).toFixed(1)} MB`
                : 'IDB STORAGE'}
            </span>
            <button
              onClick={handleCleanStorage}
              disabled={isCleaningStorage}
              className="ml-1 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer disabled:opacity-50"
              title="Compact IndexedDB and remove demo synthetic blobs"
            >
              {isCleaningStorage ? 'CLEANING...' : 'PURGE BLOAT'}
            </button>
          </div>

          <div>
            <span>{tracks.length} TRACKS</span> • <span>{formatTime(totalSeconds)}</span>
          </div>
        </div>
      </div>
    </>
  );
};