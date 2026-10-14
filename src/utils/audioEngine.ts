import { Track } from '../types';

export interface EqualizerGains {
  band60: number;
  band250: number;
  band1k: number;
  band4k: number;
  band12k: number;
  bassBoost: number;
}

export class AudioEngine {
  private audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassBoostFilter: BiquadFilterNode | null = null;
  private freqData: Uint8Array = new Uint8Array(128);
  private timeData: Uint8Array = new Uint8Array(128);
  private isInitialized = false;
  private timeListeners: Set<(currentTime: number, duration: number) => void> = new Set();
  private timeTickerId: number | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';

    // Native timeupdate as backstop
    this.audio.addEventListener('timeupdate', () => {
      this.dispatchTimeUpdate();
    });

    this.audio.addEventListener('play', () => {
      this.startTimeTicker();
    });

    this.audio.addEventListener('pause', () => {
      this.stopTimeTicker();
      this.dispatchTimeUpdate();
    });

    this.audio.addEventListener('ended', () => {
      this.stopTimeTicker();
      this.dispatchTimeUpdate();
    });
  }

  private startTimeTicker(): void {
    if (this.timeTickerId !== null) return;
    this.timeTickerId = window.setInterval(() => {
      if (!this.audio.paused && this.timeListeners.size > 0) {
        this.dispatchTimeUpdate();
      }
    }, 45); // ~22 updates/sec - perfectly responsive lyrics sync with zero audio lag
  }

  private stopTimeTicker(): void {
    if (this.timeTickerId !== null) {
      clearInterval(this.timeTickerId);
      this.timeTickerId = null;
    }
  }

  private dispatchTimeUpdate(): void {
    const cur = this.audio.currentTime || 0;
    const dur = this.audio.duration || 0;
    this.timeListeners.forEach((cb) => cb(cur, dur));
  }

  public initContext(): void {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.ctx = new AudioCtxClass();
      this.sourceNode = this.ctx.createMediaElementSource(this.audio);

      // Analyser Node for 3D Visualizer & Spectrum
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

      // Gain Node for Master Volume
      this.gainNode = this.ctx.createGain();

      // Bass Boost filter (low shelf at 80Hz)
      this.bassBoostFilter = this.ctx.createBiquadFilter();
      this.bassBoostFilter.type = 'lowshelf';
      this.bassBoostFilter.frequency.value = 80;
      this.bassBoostFilter.gain.value = 3;

      // 5-Band Equalizer filters (60Hz, 250Hz, 1kHz, 4kHz, 12kHz)
      const freqs = [60, 250, 1000, 4000, 12000];
      const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

      this.eqFilters = freqs.map((f, i) => {
        const filter = this.ctx!.createBiquadFilter();
        filter.type = types[i];
        filter.frequency.value = f;
        filter.gain.value = 0;
        if (filter.type === 'peaking') filter.Q.value = 1.0;
        return filter;
      });

      // Chain audio: Source -> BassBoost -> EQ0 -> EQ1 -> EQ2 -> EQ3 -> EQ4 -> Gain -> Analyser -> Destination
      let lastNode: AudioNode = this.sourceNode;
      lastNode.connect(this.bassBoostFilter);
      lastNode = this.bassBoostFilter;

      for (const filter of this.eqFilters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.isInitialized = true;
    } catch {
      // In case browser restricts mediaElementSource, audio still plays via HTMLAudioElement
    }
  }

  public async playTrack(track: Track): Promise<void> {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }

    if (this.audio.src !== track.url) {
      this.audio.src = track.url;
      this.audio.load();
    }

    try {
      await this.audio.play();
    } catch {
      // User gesture might be needed
    }
  }

  public pause(): void {
    this.audio.pause();
  }

  public resume(): Promise<void> {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.audio.play();
  }

  public seek(seconds: number): void {
    if (Number.isFinite(seconds)) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || 9999));
    }
  }

  public updateMediaSession(
    track: Track | null,
    isPlaying: boolean,
    actions?: {
      onPlay?: () => void;
      onPause?: () => void;
      onNext?: () => void;
      onPrev?: () => void;
      onSeek?: (sec: number) => void;
    }
  ): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Persona 5 Offline Player',
        artwork: [
          { src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      if (actions) {
        if (actions.onPlay) {
          navigator.mediaSession.setActionHandler('play', () => actions.onPlay!());
        }
        if (actions.onPause) {
          navigator.mediaSession.setActionHandler('pause', () => actions.onPause!());
        }
        if (actions.onNext) {
          navigator.mediaSession.setActionHandler('nexttrack', () => actions.onNext!());
        }
        if (actions.onPrev) {
          navigator.mediaSession.setActionHandler('previoustrack', () => actions.onPrev!());
        }
        if (actions.onSeek) {
          navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined) {
              actions.onSeek!(details.seekTime);
            }
          });
        }
      }

      if ('setPositionState' in navigator.mediaSession && Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: this.audio.duration,
          playbackRate: this.audio.playbackRate || 1,
          position: Math.min(this.audio.currentTime, this.audio.duration),
        });
      }
    } catch {
      // Ignore mediaSession errors on unsupported environments
    }
  }

  public setVolume(val: number): void {
    this.audio.volume = Math.max(0, Math.min(1, val));
  }

  public setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }

  public setEqualizer(gains: EqualizerGains): void {
    if (this.eqFilters.length >= 5) {
      this.eqFilters[0].gain.value = gains.band60;
      this.eqFilters[1].gain.value = gains.band250;
      this.eqFilters[2].gain.value = gains.band1k;
      this.eqFilters[3].gain.value = gains.band4k;
      this.eqFilters[4].gain.value = gains.band12k;
    }
    if (this.bassBoostFilter) {
      this.bassBoostFilter.gain.value = gains.bassBoost;
    }
  }

  public getFrequencyData(): Uint8Array {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freqData as unknown as Uint8Array<ArrayBuffer>);
      return this.freqData;
    }
    // Return empty fallback array
    return this.freqData;
  }

  public getTimeDomainData(): Uint8Array {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.timeData as unknown as Uint8Array<ArrayBuffer>);
      return this.timeData;
    }
    return this.timeData;
  }

  public onTimeUpdate(callback: (currentTime: number, duration: number) => void): () => void {
    this.timeListeners.add(callback);
    // Initial call
    callback(this.audio.currentTime || 0, this.audio.duration || 0);
    return () => {
      this.timeListeners.delete(callback);
    };
  }

  public onEnded(callback: () => void): () => void {
    this.audio.addEventListener('ended', callback);
    return () => this.audio.removeEventListener('ended', callback);
  }

  public onError(callback: (err: unknown) => void): () => void {
    this.audio.addEventListener('error', callback);
    return () => this.audio.removeEventListener('error', callback);
  }

  public getCurrentTime(): number {
    return this.audio.currentTime;
  }

  public getDuration(): number {
    return this.audio.duration || 0;
  }
}

export const globalAudioEngine = new AudioEngine();
