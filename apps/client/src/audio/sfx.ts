class SoundManager {
  private ctx: AudioContext | null = null;
  private bgmEl: HTMLAudioElement | null = null;
  private currentBgmSrc = '/assets/audio/bgm.mp3';
  public muted = false;
  public bgmPlaying = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playClip(src: string, volume = 0.55) {
    if (this.muted || typeof window === 'undefined') return;
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.play().catch(() => {});
    } catch {
      // ignore playback restrictions
    }
  }

  private ensureBgm(src = this.currentBgmSrc): HTMLAudioElement {
    if (!this.bgmEl) {
      this.bgmEl = new Audio(src);
      this.bgmEl.loop = true;
      this.bgmEl.volume = 0.25;
      this.bgmEl.muted = this.muted;
      this.currentBgmSrc = src;
    } else if (this.currentBgmSrc !== src) {
      const wasPlaying = this.bgmPlaying;
      this.bgmEl.pause();
      this.bgmEl.src = src;
      this.bgmEl.loop = true;
      this.bgmEl.muted = this.muted;
      this.currentBgmSrc = src;
      if (wasPlaying && !this.muted) {
        this.bgmEl.play().catch(() => {});
      }
    }
    return this.bgmEl;
  }

  setBgmTrack(mode: 'lobby' | 'battle'): void {
    if (typeof window === 'undefined') return;
    const targetSrc =
      mode === 'battle' ? '/assets/pokiguard/audio/fight1.wav' : '/assets/audio/bgm.mp3';
    this.ensureBgm(targetSrc);
  }

  playBattleBgm(): void {
    this.setBgmTrack('battle');
  }

  playLobbyBgm(): void {
    this.setBgmTrack('lobby');
  }

  toggleBgm(): boolean {
    if (typeof window === 'undefined') return false;
    const bgm = this.ensureBgm(this.currentBgmSrc);
    if (this.bgmPlaying) {
      bgm.pause();
      this.bgmPlaying = false;
    } else {
      bgm.play().catch(() => {});
      this.bgmPlaying = true;
    }
    return this.bgmPlaying;
  }

  setMuted(mute: boolean) {
    this.muted = mute;
    if (this.bgmEl) {
      this.bgmEl.muted = mute;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.08,
    delay = 0,
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playSwap() {
    this.playClip('/assets/pokiguard/audio/tick1.wav', 0.45);
  }

  playMatch(combo: number) {
    const idx = Math.max(1, Math.min(6, combo));
    this.playClip(`/assets/pokiguard/audio/match${idx}.wav`, 0.58);
  }

  playSkill() {
    this.playClip('/assets/pokiguard/audio/tick2.wav', 0.65);
    this.tone(240, 0.2, 'sawtooth', 0.06);
    this.tone(580, 0.24, 'triangle', 0.07, 0.05);
  }

  playHit() {
    this.tone(140, 0.15, 'square', 0.06);
  }

  playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.tone(f, 0.22, 'triangle', 0.09, idx * 0.09);
    });
  }

  playLose() {
    [392, 349.23, 311.13, 261.63].forEach((f, idx) => {
      this.tone(f, 0.25, 'sawtooth', 0.06, idx * 0.11);
    });
  }
}

export const sfx = new SoundManager();
