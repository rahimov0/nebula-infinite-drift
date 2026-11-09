/* NEBULA 3.0 — procedural audio: SFX + synthwave music sequencer (no audio files needed) */
'use strict';

class AudioEngine {
  constructor() {
    this.ctx = null; this.sfxOn = true; this.musicOn = true;
    this.master = null; this.sfxBus = null; this.musicBus = null;
    this.noiseBuf = null; this.mode = 'off'; this.step = 0; this.nextTime = 0; this.timer = null;
    this.lastPlay = {};
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // throttle identical sounds so 20 hits in one frame don't clip
  gate(name, ms) {
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < ms) return false;
    this.lastPlay[name] = now; return true;
  }

  tone(freq, type, dur, vol, slideTo, delay = 0, bus) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, freq, q = 1, type = 'bandpass', delay = 0, bus, slideTo) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.5 + Math.random();
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus); s.start(t0); s.stop(t0 + dur + 0.02);
  }

  /* ---------- SFX ---------- */
  sfx(name) {
    if (!this.sfxOn || !this.ctx) return;
    switch (name) {
      case 'shoot': if (this.gate('shoot', 70)) this.tone(900, 'square', 0.06, 0.025, 380); break;
      case 'hit': if (this.gate('hit', 45)) this.noise(0.05, 0.08, 2400, 2); break;
      case 'explode':
        if (!this.gate('explode', 50)) break;
        this.noise(0.45, 0.35, 900, 0.7, 'lowpass', 0, null, 80); this.tone(120, 'sine', 0.3, 0.25, 35); break;
      case 'bigExplode':
        this.noise(1.4, 0.6, 1600, 0.5, 'lowpass', 0, null, 40); this.tone(80, 'sine', 1.0, 0.5, 20);
        this.tone(160, 'sawtooth', 0.6, 0.12, 30, 0.05); break;
      case 'crystal': if (this.gate('crystal', 35)) this.tone(1400 + Math.random() * 500, 'sine', 0.09, 0.05, 2400); break;
      case 'power':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'triangle', 0.14, 0.08, null, i * 0.06)); break;
      case 'damage': this.noise(0.3, 0.4, 500, 0.8, 'lowpass'); this.tone(180, 'sawtooth', 0.3, 0.18, 50); break;
      case 'shield': this.tone(300, 'sine', 0.4, 0.12, 900); this.tone(450, 'triangle', 0.4, 0.06, 1350, 0.05); break;
      case 'special':
        this.tone(60, 'sawtooth', 1.0, 0.3, 400); this.noise(1.0, 0.3, 300, 1, 'lowpass', 0, null, 6000);
        this.tone(880, 'square', 0.5, 0.05, 110, 0.15); break;
      case 'ready': this.tone(660, 'triangle', 0.12, 0.08); this.tone(990, 'triangle', 0.2, 0.08, null, 0.1); break;
      case 'ui': this.tone(720, 'sine', 0.05, 0.06, 900); break;
      case 'buy': [660, 880, 1320].forEach((f, i) => this.tone(f, 'square', 0.1, 0.05, null, i * 0.05)); break;
      case 'error': this.tone(200, 'square', 0.15, 0.06, 140); break;
      case 'warn':
        for (let i = 0; i < 3; i++) { this.tone(440, 'sawtooth', 0.35, 0.1, 330, i * 0.5); } break;
      case 'laserCharge': this.tone(200, 'sawtooth', 0.8, 0.05, 1200); break;
      case 'laserFire': this.noise(0.6, 0.25, 3000, 0.5, 'highpass'); this.tone(110, 'sawtooth', 0.6, 0.12, 90); break;
      case 'mission': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 'triangle', 0.18, 0.08, null, i * 0.08)); break;
      case 'victory': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 'triangle', 0.25, 0.09, null, i * 0.11)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 'sawtooth', 0.35, 0.07, f * 0.97, i * 0.18)); break;
      case 'combo': if (this.gate('combo', 120)) this.tone(1000, 'sine', 0.08, 0.04, 1500); break;
    }
  }

  /* ---------- Music sequencer ---------- */
  setMusic(mode) {
    if (!this.ctx) return;
    this.mode = mode;
    const target = (!this.musicOn || mode === 'off') ? 0 : (mode === 'menu' ? 0.32 : 0.42);
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
    if (target > 0 && !this.timer) {
      this.nextTime = this.ctx.currentTime + 0.05; this.step = 0;
      this.timer = setInterval(() => this.schedule(), 25);
    }
    if (target === 0 && this.timer) {
      const me = this.timer;
      setTimeout(() => { if (this.timer === me && (this.mode === 'off' || !this.musicOn)) { clearInterval(this.timer); this.timer = null; } }, 1500);
    }
  }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const bpm = this.mode === 'boss' ? 132 : (this.mode === 'menu' ? 96 : 116);
    const stepDur = 60 / bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur; this.step = (this.step + 1) % 256;
    }
  }

  playStep(step, time, sd) {
    const bus = this.musicBus, c = this.ctx;
    // progression: Am F C G   (boss: Am Am F E)
    const prog = this.mode === 'boss' ? [[110, 0], [110, 0], [87.31, 1], [82.41, 3]] : [[110, 0], [87.31, 1], [130.81, 2], [98, 3]];
    const chords = [[0, 3, 7, 12], [0, 4, 7, 12], [0, 4, 7, 11], [0, 4, 7, 10]];
    const bar = Math.floor(step / 16) % 4, s = step % 16;
    const [root, ci] = prog[bar];
    const semis = chords[this.mode === 'boss' && bar === 3 ? 0 : ci].map(x => x);
    const note = (base, semi) => base * Math.pow(2, semi / 12);
    const osc = (f, type, dur, vol, cutoff) => {
      const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
      o.type = type; o.frequency.setValueAtTime(f, time);
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, time); fl.frequency.exponentialRampToValueAtTime(cutoff * 0.3, time + dur);
      g.gain.setValueAtTime(vol, time); g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
      o.connect(fl); fl.connect(g); g.connect(bus); o.start(time); o.stop(time + dur + 0.02);
    };
    const drum = (kind) => {
      if (kind === 'kick') {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(140, time); o.frequency.exponentialRampToValueAtTime(40, time + 0.15);
        g.gain.setValueAtTime(0.55, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        o.connect(g); g.connect(bus); o.start(time); o.stop(time + 0.3);
      } else {
        const sN = c.createBufferSource(); sN.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(), g = c.createGain();
        f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 8000 : 1800;
        const dur = kind === 'hat' ? 0.04 : 0.16, vol = kind === 'hat' ? 0.08 : 0.22;
        g.gain.setValueAtTime(vol, time); g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        sN.connect(f); f.connect(g); g.connect(bus); sN.start(time); sN.stop(time + dur + 0.02);
      }
    };

    if (this.mode === 'menu') {
      if (s % 2 === 0) osc(note(root * 4, semis[(s / 2) % 4]), 'triangle', sd * 3, 0.05, 2400);
      if (s === 0) { semis.slice(0, 3).forEach(se => osc(note(root * 2, se), 'sawtooth', sd * 16, 0.025, 900)); }
      if (s % 4 === 0) osc(root, 'sine', sd * 4, 0.12, 400);
      return;
    }
    // bass: driving 8ths with octave jumps
    if (s % 2 === 0) osc(s % 4 === 2 ? root * 2 : root, 'sawtooth', sd * 1.8, 0.11, 700);
    // arp
    const arpIdx = [0, 1, 2, 3, 2, 1, 2, 3][s % 8];
    osc(note(root * 4, semis[arpIdx]), 'square', sd * 0.9, 0.028, 3200);
    // pad on bar start
    if (s === 0) semis.slice(0, 3).forEach(se => osc(note(root * 2, se), 'sawtooth', sd * 16, 0.02, 1400));
    // drums
    if (s % 4 === 0) drum('kick');
    if (this.mode === 'boss' && s % 4 === 2) drum('kick');
    if (s === 4 || s === 12) drum('snare');
    if (s % 2 === 1) drum('hat');
    // boss lead
    if (this.mode === 'boss' && (s === 0 || s === 6 || s === 12)) osc(note(root * 8, semis[(s / 6) % 3 | 0]), 'sawtooth', sd * 3, 0.03, 4000);
  }
}
const audio = new AudioEngine();

function vibrate(ms) {
  if (Save.d && !Save.d.settings.vib) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}
