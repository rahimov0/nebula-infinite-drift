/* NEBULA 3.0 — persistence, missions, achievements, pilot progression */
'use strict';

const SAVE_KEY = 'nebula3_save';

const Save = {
  d: null,

  defaults() {
    const lang = (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
    return {
      v: 3, credits: 300, xp: 0, plv: 1,
      owned: { interceptor: true }, ship: 'interceptor',
      upg: { hull: 0, damage: 0, rate: 0, magnet: 0, special: 0, luck: 0 },
      levels: {}, endlessBest: 0,
      stats: { kills: 0, asteroids: 0, crystals: 0, bosses: 0, specials: 0, runs: 0, stars: 0, endlessBest: 0 },
      daily: null, ach: {},
      tutorial: false,
      settings: { control: 'drag', sound: true, music: true, vib: true, lang, quality: 'high', sens: 1.2 }
    };
  },

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
    const def = this.defaults();
    if (!d || d.v !== 3) {
      d = def;
      // migrate the old 2.x high score
      const old = parseInt(localStorage.getItem('nebula_highscore')) || 0;
      if (old > 0) { d.endlessBest = old; d.stats.endlessBest = old; }
    }
    // fill any missing keys (forward compatible)
    for (const k in def) if (d[k] === undefined) d[k] = def[k];
    for (const k in def.settings) if (d.settings[k] === undefined) d.settings[k] = def.settings[k];
    for (const k in def.upg) if (d.upg[k] === undefined) d.upg[k] = 0;
    for (const k in def.stats) if (d.stats[k] === undefined) d.stats[k] = 0;
    this.d = d;
    LANG = d.settings.lang;
    this.ensureDaily();
    this.persist();
  },

  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.d)); } catch (e) {}
  },

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    const keepSettings = this.d.settings;
    this.d = this.defaults();
    this.d.settings = keepSettings;
    this.ensureDaily();
    this.persist();
  },

  /* ---------- campaign ---------- */
  unlockedLevel() {
    let u = 1;
    for (const l of LEVELS) if (this.d.levels[l.id] && this.d.levels[l.id].done) u = Math.max(u, l.id + 1);
    return Math.min(u, LEVELS.length);
  },
  totalStars() {
    let s = 0; for (const k in this.d.levels) s += this.d.levels[k].stars || 0; return s;
  },
  recordLevel(id, stars, score) {
    const prev = this.d.levels[id] || { done: false, stars: 0, best: 0 };
    const firstClear = !prev.done;
    const newStars = Math.max(0, stars - prev.stars);
    this.d.levels[id] = { done: true, stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
    this.d.stats.stars = this.totalStars();
    return { firstClear, newStars };
  },

  /* ---------- ships / upgrades ---------- */
  ship() { return SHIPS.find(s => s.id === this.d.ship) || SHIPS[0]; },
  spend(n) {
    if (this.d.credits < n) return false;
    this.d.credits -= n; this.persist(); return true;
  },

  /* ---------- pilot xp ---------- */
  addXP(n) {
    const ups = [];
    this.d.xp += Math.round(n);
    while (this.d.xp >= xpForLevel(this.d.plv)) {
      this.d.xp -= xpForLevel(this.d.plv);
      this.d.plv++;
      this.d.credits += 200 + this.d.plv * 20;
      ups.push(this.d.plv);
    }
    return ups;
  },

  /* ---------- daily missions ---------- */
  todayKey() {
    const n = new Date();
    return n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate();
  },
  ensureDaily() {
    const key = this.todayKey();
    if (this.d.daily && this.d.daily.date === key) return;
    // seeded pick so the day's missions are stable
    let seed = 0; for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pool = DAILY_TEMPLATES.slice();
    const list = [];
    for (let i = 0; i < 3; i++) {
      const tpl = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const tier = Math.floor(rnd() * tpl.ns.length);
      list.push({ type: tpl.type, n: tpl.ns[tier], reward: tpl.rw[tier], max: !!tpl.max, prog: 0, claimed: false, notified: false });
    }
    this.d.daily = { date: key, list, bonusClaimed: false };
  },
  /** Progress a daily stat. Returns list of missions that just completed. */
  track(type, amount, isMax) {
    this.ensureDaily();
    const done = [];
    for (const m of this.d.daily.list) {
      if (m.type !== type || m.claimed) continue;
      const before = m.prog;
      if (m.max || isMax) m.prog = Math.max(m.prog, amount);
      else m.prog += amount;
      m.prog = Math.min(m.prog, m.n);
      if (before < m.n && m.prog >= m.n && !m.notified) { m.notified = true; done.push(m); }
    }
    return done;
  },
  claimDaily(i) {
    const m = this.d.daily.list[i];
    if (!m || m.claimed || m.prog < m.n) return 0;
    m.claimed = true; this.d.credits += m.reward; this.persist(); return m.reward;
  },
  claimDailyBonus() {
    const dl = this.d.daily;
    if (dl.bonusClaimed || !dl.list.every(m => m.claimed)) return 0;
    dl.bonusClaimed = true; this.d.credits += DAILY_BONUS; this.persist(); return DAILY_BONUS;
  },
  claimableCount() {
    let c = 0;
    this.ensureDaily();
    for (const m of this.d.daily.list) if (!m.claimed && m.prog >= m.n) c++;
    if (!this.d.daily.bonusClaimed && this.d.daily.list.every(m => m.claimed)) c++;
    for (const a of ACHIEVEMENTS) { const tier = this.d.ach[a.id] || 0; if (tier < a.tiers.length && this.d.stats[a.stat] >= a.tiers[tier]) c++; }
    return c;
  },
  claimAch(id) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    const tier = this.d.ach[id] || 0;
    if (!a || tier >= a.tiers.length || this.d.stats[a.stat] < a.tiers[tier]) return 0;
    this.d.ach[id] = tier + 1; const r = ACH_REWARDS[tier]; this.d.credits += r; this.persist(); return r;
  }
};
