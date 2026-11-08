/* NEBULA 3.0 — game engine: player, enemies, bosses, director, specials, rendering */
'use strict';

const W = 480; // logical play-field width (height adapts to the screen)
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function compact(arr) { let j = 0; for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i]; arr.length = j; }
function weighted(obj) {
  let sum = 0; for (const k in obj) sum += obj[k];
  let r = Math.random() * sum; for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
}
function segDist2(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const tt = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return dist2(px, py, x1 + dx * tt, y1 + dy * tt);
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.state = 'boot'; // boot | menu | play | pause | over
    this.H = 800; this.scale = 1; this.offX = 0; this.dpr = 1;
    this.bgY = 0; this.time = 0; this.last = 0;
    this.stars = [];
    this.input = { keys: {}, drag: null, joy: null, mouse: null };
    this.resetWorld();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  /* ================= setup ================= */
  resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    const q = Save.d ? Save.d.settings.quality : 'high';
    this.dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : 1.25);
    this.canvas.width = Math.round(cw * this.dpr); this.canvas.height = Math.round(ch * this.dpr);
    this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
    const playW = Math.min(cw, ch * 0.72);
    this.scale = playW / W; this.offX = (cw - playW) / 2;
    this.H = ch / this.scale; this.cw = cw; this.ch = ch;
    this.makeStars();
    if (this.player) { this.player.x = clamp(this.player.x, 16, W - 16); this.player.y = clamp(this.player.y, this.H * 0.2, this.H - 30); }
  }

  makeStars() {
    this.stars = [];
    const n = (Save.d && Save.d.settings.quality === 'low') ? 50 : 110;
    const worldW = this.cw / this.scale;
    for (let i = 0; i < n; i++) {
      const layer = i % 3;
      this.stars.push({ x: rand(-this.offX / this.scale, worldW), y: rand(0, this.H), l: layer, s: [0.6, 1.1, 1.8][layer], v: [12, 30, 70][layer], a: rand(0.3, 1) });
    }
  }

  resetWorld() {
    this.player = null;
    this.pBullets = []; this.eBullets = []; this.enemies = []; this.pickups = [];
    this.particles = []; this.texts = []; this.lasers = []; this.waves = []; this.markers = [];
    this.queue = []; this.boss = null;
    this.shake = 0; this.flash = 0; this.flashColor = '#fff'; this.dmgFlash = 0;
    this.warp = 0; this.slowmo = 0; this.timeScale = 1;
  }

  quality() { return Save.d.settings.quality; }

  /* ================= run lifecycle ================= */
  startLevel(id) { this.startRun({ mode: 'campaign', level: LEVELS[id - 1] }); }
  startEndless() { this.startRun({ mode: 'endless', level: null }); }

  startRun(cfg) {
    audio.init();
    this.resetWorld();
    this.mode = cfg.mode; this.level = cfg.level;
    this.sector = this.level ? SECTORS[this.level.s - 1] : SECTORS[0];
    const ship = Save.ship(), up = Save.d.upg;
    const maxHp = Math.round(ship.hp * (1 + 0.15 * up.hull));
    this.player = {
      x: W / 2, y: this.H - 140, tx: W / 2, ty: this.H - 140, vx: 0, r: 7, vr: 20,
      ship, hp: maxHp, maxHp, power: 1, inv: 2, shield: 0, overdrive: 0, magnet: 0,
      charge: 0, fireT: 0, missileT: 0, tilt: 0, fortress: 0, beam: 0, dead: false,
      dmgMult: ship.dmg * (1 + 0.12 * up.damage),
      fireInt: 0.15 / (ship.rate * (1 + 0.1 * up.rate)),
      speed: 380 * ship.speed,
      magR: 70 + 35 * up.magnet,
      chargeMult: 1 + 0.15 * up.special,
      luck: 1 + 0.12 * up.luck
    };
    this.run = {
      t: 0, score: 0, kills: 0, asteroids: 0, crystals: 0, combo: 0, comboT: 0, maxCombo: 0,
      specials: 0, pickups: 0, bossesKilled: 0, done: false, outcome: null, endT: 0
    };
    this.dir = { waveT: 2, astT: 1.5, pickT: 10, showerT: this.level && this.level.meteorShowers ? 18 : 70, bossCycle: 0, nextBossT: 100, bossPending: false };
    this.diff = this.level ? this.level.diff : 0.3;
    this.state = 'play';
    UI.enterGame();
    audio.setMusic('game');
    const hint = Save.d.settings.control === 'joystick' ? t('hint_joy') : t('hint_drag');
    UI.banner(this.level ? `${t('level')} ${this.level.id}` : t('endless'), hint, 2.2);
    if (!Save.d.tutorial) setTimeout(() => { if (this.state === 'play') UI.toast(t('hint_special'), '⚡'); }, 3500);
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; this.input.drag = null; this.input.joy = null;
    audio.setMusic('off'); UI.showPause(true);
  }
  resume() {
    if (this.state !== 'pause') return;
    this.state = 'play'; this.last = performance.now();
    audio.init(); audio.setMusic(this.boss ? 'boss' : 'game'); UI.showPause(false);
  }
  quitToMenu() {
    this.state = 'menu'; this.resetWorld();
    audio.setMusic('menu'); UI.showMenu();
  }

  /* ================= input ================= */
  toLogical(cx, cy) { return { x: (cx - this.offX) / this.scale, y: cy / this.scale }; }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.state !== 'play' || !this.player) return;
      e.preventDefault();
      const mode = Save.d.settings.control;
      if (e.pointerType === 'mouse' && mode === 'drag') { this.input.mouse = this.toLogical(e.clientX, e.clientY); return; }
      if (mode === 'joystick') {
        this.input.joy = { id: e.pointerId, bx: e.clientX, by: e.clientY, dx: 0, dy: 0 };
      } else {
        this.input.drag = { id: e.pointerId, px: e.clientX, py: e.clientY, sx: this.player.tx, sy: this.player.ty };
      }
      try { c.setPointerCapture(e.pointerId); } catch (err) {}
    }, { passive: false });
    c.addEventListener('pointermove', (e) => {
      if (this.state !== 'play' || !this.player) return;
      const mode = Save.d.settings.control;
      if (e.pointerType === 'mouse' && mode === 'drag') { this.input.mouse = this.toLogical(e.clientX, e.clientY); return; }
      const d = this.input.drag, j = this.input.joy;
      if (d && d.id === e.pointerId) {
        const s = Save.d.settings.sens / this.scale;
        this.player.tx = d.sx + (e.clientX - d.px) * s;
        this.player.ty = d.sy + (e.clientY - d.py) * s;
      }
      if (j && j.id === e.pointerId) {
        let dx = e.clientX - j.bx, dy = e.clientY - j.by; const m = Math.hypot(dx, dy), R = 56;
        if (m > R) { j.bx += dx - dx / m * R; j.by += dy - dy / m * R; dx = dx / m * R; dy = dy / m * R; }
        j.dx = dx / R; j.dy = dy / R;
      }
    });
    const end = (e) => {
      if (this.input.drag && this.input.drag.id === e.pointerId) {
        this.input.drag = null;
        // re-anchor target to actual position to avoid jumps on next touch
        if (this.player) { this.player.tx = this.player.x; this.player.ty = this.player.y; }
      }
      if (this.input.joy && this.input.joy.id === e.pointerId) this.input.joy = null;
    };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.input.mouse = null; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      this.input.keys[e.code] = true;
      if (e.code === 'Escape' || e.code === 'KeyP') { if (this.state === 'play') this.pause(); else if (this.state === 'pause') this.resume(); }
      if ((e.code === 'Space' || e.code === 'KeyE') && this.state === 'play') { e.preventDefault(); this.useSpecial(); }
    });
    window.addEventListener('keyup', (e) => { this.input.keys[e.code] = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.pause(); audio.suspend(); } else audio.resume();
    });
    window.addEventListener('blur', () => this.pause());
  }

  /* ================= main loop ================= */
  loop(ts) {
    requestAnimationFrame((t2) => this.loop(t2));
    let dt = (ts - (this.last || ts)) / 1000; this.last = ts;
    if (dt > 0.05) dt = 0.05;
    this.time += dt;
    if (this.state === 'play') this.update(dt);
    else this.ambient(dt);
    this.render();
  }

  ambient(dt) {
    this.bgY += dt * 14;
    for (const s of this.stars) { s.y += s.v * dt * 0.5; if (s.y > this.H) { s.y = -2; } }
    if (this.state === 'over') this.updateFx(dt * 0.5);
  }

  update(rdt) {
    const p = this.player, run = this.run;
    // global slow-motion (boss death / player death)
    if (this.slowmo > 0) { this.slowmo -= rdt; this.timeScale = 0.25; } else this.timeScale = 1;
    const dt = rdt * this.timeScale;
    const edt = dt * (this.warp > 0 ? 0.3 : 1); // enemy-side dt
    if (this.warp > 0) this.warp -= rdt;

    run.t += dt;
    const speedBoost = p.overdrive > 0 ? 2.2 : 1;
    this.bgY += dt * 22 * speedBoost;
    for (const s of this.stars) { s.y += s.v * dt * speedBoost; if (s.y > this.H) { s.y = -2; s.x = rand(-this.offX / this.scale, this.cw / this.scale); } }

    if (!p.dead) this.updatePlayer(dt, rdt);
    if (this.mode === 'endless') this.diff = Math.min(6, 0.3 + run.t / 40);
    if (!run.done) this.director(dt);
    this.processQueue(dt);
    this.updateEnemies(edt);
    if (this.boss) this.updateBoss(edt);
    this.updateBullets(dt, edt);
    this.updateLasers(edt);
    this.updatePickups(dt);
    this.updateFx(dt);
    if (!p.dead) this.collide();

    // combo decay
    if (run.combo > 0) { run.comboT -= dt; if (run.comboT <= 0) run.combo = 0; }
    this.checkObjective(rdt);
    UI.updateHUD(this);
  }

  /* ================= player ================= */
  updatePlayer(dt, rdt) {
    const p = this.player, k = this.input.keys;
    if (this.run.done && this.run.outcome === 'victory') {
      // warp-out after mission success
      p.y -= rdt * (150 + (2.4 - this.run.endT) * 700); p.tilt *= 0.9;
      this.addParticle(p.x + rand(-5, 5), p.y + 26, 0, rand(300, 500), 0.4, rand(8, 14), p.ship.color, 'glow');
      return;
    }
    const minY = this.H * 0.18, maxY = this.H - 34;
    const speed = p.speed * (p.overdrive > 0 ? 1.15 : 1);
    let kx = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
    let ky = (k.ArrowDown || k.KeyS ? 1 : 0) - (k.ArrowUp || k.KeyW ? 1 : 0);
    const prevX = p.x;
    if (kx || ky) {
      p.tx = p.x + kx * speed * rdt; p.ty = p.y + ky * speed * rdt;
    } else if (this.input.joy) {
      const j = this.input.joy; p.tx = p.x + j.dx * speed * rdt; p.ty = p.y + j.dy * speed * rdt;
    } else if (this.input.mouse && !this.input.drag) {
      p.tx = this.input.mouse.x; p.ty = this.input.mouse.y;
    }
    p.tx = clamp(p.tx, 16, W - 16); p.ty = clamp(p.ty, minY, maxY);
    const f = 1 - Math.exp(-rdt * 22);
    p.x += (p.tx - p.x) * f; p.y += (p.ty - p.y) * f;
    p.vx = (p.x - prevX) / Math.max(rdt, 0.001);
    p.tilt += (clamp(p.vx / 700, -0.35, 0.35) - p.tilt) * Math.min(1, rdt * 10);

    for (const key of ['inv', 'shield', 'overdrive', 'magnet', 'fortress', 'beam']) if (p[key] > 0) p[key] = Math.max(0, p[key] - rdt);

    // engine trail
    if (Math.random() < (this.quality() === 'high' ? 0.9 : 0.4)) {
      this.addParticle(p.x + rand(-4, 4), p.y + 24, rand(-20, 20), rand(160, 260), rand(0.2, 0.4), rand(5, 9), p.overdrive > 0 ? '#ffbd00' : p.ship.color, 'glow');
    }

    // firing (auto)
    p.fireT -= rdt * (p.overdrive > 0 ? 2 : 1) * (this.warp > 0 ? 1.5 : 1);
    if (p.fireT <= 0 && p.beam <= 0) { p.fireT = p.fireInt; this.firePlayer(); }
    if (p.power >= 5) {
      p.missileT -= rdt;
      if (p.missileT <= 0) { p.missileT = 0.55; [-1, 1].forEach(s => this.pBullets.push({ x: p.x + s * 18, y: p.y, vx: s * 160, vy: -260, dmg: 2.5 * p.dmgMult, sp: SPR.missile, homing: true, life: 3 })); }
    }

    // beam special
    if (p.beam > 0) this.beamTick(rdt);
  }

  firePlayer() {
    const p = this.player, sp = SPR['pb_' + p.ship.id] || SPR.pBullet, d = p.dmgMult, V = 950;
    const shots = [];
    const lv = p.power;
    if (lv === 1) shots.push([0, 0]);
    else if (lv === 2) shots.push([-7, 0], [7, 0]);
    else if (lv === 3) shots.push([-11, 0], [0, 0], [11, 0]);
    else if (lv === 4) shots.push([-11, 0], [0, 0], [11, 0], [-14, -0.13], [14, 0.13]);
    else shots.push([-11, 0], [0, 0], [11, 0], [-14, -0.13], [14, 0.13], [-16, -0.26], [16, 0.26]);
    for (const [dx, a] of shots) this.pBullets.push({ x: p.x + dx, y: p.y - 18, vx: Math.sin(a) * V, vy: -Math.cos(a) * V, dmg: d, sp, rot: a });
    audio.sfx('shoot');
  }

  useSpecial() {
    const p = this.player;
    if (!p || p.dead || p.charge < 100 || this.state !== 'play') return;
    p.charge = 0; this.run.specials++;
    Save.d.stats.specials++;
    this.trackMission('special', 1);
    audio.sfx('special'); vibrate(80);
    Save.d.tutorial = true;
    const type = p.ship.special;
    UI.specialFired(type);
    if (type === 'nova') {
      this.waves.push({ x: p.x, y: p.y, r: 0, max: Math.max(W, this.H) * 1.2, speed: 1200, hit: new Set(), color: p.ship.color, dmg: 28 * p.dmgMult });
      for (const b of this.eBullets) { b.dead = true; this.addParticle(b.x, b.y, 0, 0, 0.3, 10, '#ffffff', 'glow'); }
      this.flash = 0.6; this.flashColor = '#bff8ff'; this.shake = 14;
      p.inv = Math.max(p.inv, 1);
    } else if (type === 'fortress') {
      p.fortress = 5.5; this.flash = 0.3; this.flashColor = '#ffd59e';
    } else if (type === 'timewarp') {
      this.warp = 5.5; this.flash = 0.4; this.flashColor = '#d7b8ff';
    } else if (type === 'laser') {
      p.beam = 3.6; audio.sfx('laserFire'); this.shake = 8;
    }
  }

  beamTick(dt) {
    const p = this.player, half = 26, dps = 46 * p.dmgMult;
    const x1 = p.x - half, x2 = p.x + half;
    for (const e of this.enemies) if (!e.dead && e.y < p.y && e.x + e.r > x1 && e.x - e.r < x2) this.damageEnemy(e, dps * dt, true);
    if (this.boss && !this.boss.dead && this.boss.ready && this.boss.y < p.y && Math.abs(this.boss.x - p.x) < this.boss.r + half) this.damageBoss(dps * dt * 0.8, p.x, this.boss.y + this.boss.r * 0.6, true);
    for (const b of this.eBullets) if (b.y < p.y && Math.abs(b.x - p.x) < half + 4) { b.dead = true; }
    this.shake = Math.max(this.shake, 3);
    if (Math.random() < 0.6) this.addParticle(p.x + rand(-half, half), rand(0, p.y), rand(-40, 40), rand(-300, -100), 0.3, rand(6, 12), p.ship.color, 'glow');
  }

  hurtPlayer(dmg, x, y) {
    const p = this.player;
    if (p.dead || p.inv > 0 || p.shield > 0 || p.fortress > 0 || p.overdrive > 0 || this.run.done) {
      if (p.shield > 0 || p.fortress > 0) this.burst(x ?? p.x, y ?? p.y, 6, '#7ff9ff', 160);
      return false;
    }
    const dScale = 1 + this.diff * 0.06;
    dmg = Math.round(dmg * dScale);
    p.hp -= dmg; p.inv = 1.3; this.run.combo = 0;
    if (p.power > 1) { p.power--; this.floatText(p.x, p.y - 34, 'WEAPON -1', '#ff6b8b', 14); }
    this.run.damaged = true;
    this.floatText(p.x, p.y - 20, '-' + dmg, '#ff2a5f', 20);
    this.burst(p.x, p.y, 18, '#ff2a5f', 260);
    this.shake = 16; this.dmgFlash = 0.5; audio.sfx('damage'); vibrate(90);
    if (p.hp <= 0) { p.hp = 0; this.killPlayer(); }
    return true;
  }

  killPlayer() {
    const p = this.player; p.dead = true;
    this.explosion(p.x, p.y, 2.2, p.ship.color);
    this.explosion(p.x, p.y, 1.4, '#ffffff');
    this.slowmo = 1.2; this.shake = 30; this.flash = 0.7; this.flashColor = '#ff3b5c';
    audio.sfx('bigExplode'); vibrate([100, 50, 200]);
    this.endRun('defeat', 2.2);
  }

  /* ================= director (spawning) ================= */
  director(dt) {
    const d = this.dir, run = this.run, lvl = this.level, diff = this.diff;
    const bossFight = !!this.boss;

    // boss scheduling
    if (this.mode === 'campaign' && lvl.obj.type === 'boss' && !bossFight && !d.bossPending && !run.bossDone && run.t >= lvl.obj.warmup) {
      d.bossPending = true; this.spawnBoss(lvl.obj.boss, lvl.obj.bossHp || 1);
    }
    if (this.mode === 'endless' && !bossFight && !d.bossPending && run.t >= d.nextBossT) {
      d.bossPending = true;
      const order = ['kraken', 'twinfang', 'voidcore'];
      this.spawnBoss(order[d.bossCycle % 3], 0.8 + d.bossCycle * 0.45);
      d.bossCycle++;
    }
    const enemyCap = 5 + Math.floor(diff * 1.6);
    const activeEnemies = this.enemies.filter(e => !e.ast).length;

    // waves
    d.waveT -= dt;
    if (d.waveT <= 0 && !d.bossPending) {
      d.waveT = rand(2.4, 3.6) / (1 + diff * 0.14) * (bossFight ? 2.2 : 1);
      if (activeEnemies < enemyCap && !(bossFight && activeEnemies > 2)) this.spawnWave(bossFight);
    }
    // asteroids
    const astMul = lvl ? lvl.ast : 1;
    d.astT -= dt;
    if (d.astT <= 0) {
      d.astT = rand(1.4, 2.6) / astMul / (1 + diff * 0.08) * (bossFight ? 2 : 1);
      this.spawnAsteroid(lvl && lvl.crystalAst && Math.random() < 0.35 ? 'crystal' : (Math.random() < 0.35 ? 'big' : 'med'));
    }
    // meteor shower
    const showers = (lvl && lvl.meteorShowers) || this.mode === 'endless';
    if (showers && !bossFight) {
      d.showerT -= dt;
      if (d.showerT <= 0) { d.showerT = lvl ? rand(22, 30) : rand(60, 80); this.meteorShower(); }
    }
    // random pickup drop from above
    d.pickT -= dt;
    if (d.pickT <= 0) { d.pickT = rand(10, 15); this.spawnPickup(rand(40, W - 40), -20, this.randomPowerup()); }
  }

  enemyPool() {
    if (this.level) return this.level.pool;
    const t = this.run.t, pool = { drone: 4, dart: 3 };
    if (t > 25) pool.gunner = 2;
    if (t > 50) { pool.sniper = 2; pool.splitter = 2; }
    if (t > 80) pool.mine = 2;
    if (t > 110) pool.tank = 1 + Math.min(2, (t - 110) / 120);
    return pool;
  }

  spawnWave(light) {
    const type = weighted(this.enemyPool());
    const diff = this.diff;
    const at = (delay, fn) => this.queue.push({ t: delay, fn });
    if (type === 'drone') {
      const form = pick(['line', 'v', 'snake']);
      const n = light ? 3 : Math.min(7, 3 + Math.floor(diff));
      if (form === 'line') { const gap = (W - 80) / Math.max(1, n - 1); for (let i = 0; i < n; i++) at(i * 0.05, () => this.spawnEnemy('drone', 40 + i * gap, -30)); }
      else if (form === 'v') { const cx = rand(120, W - 120); for (let i = 0; i < n; i++) { const o = i - (n - 1) / 2; at(Math.abs(o) * 0.18, () => this.spawnEnemy('drone', cx + o * 42, -30)); } }
      else { const x = rand(80, W - 80); for (let i = 0; i < n; i++) at(i * 0.32, () => this.spawnEnemy('drone', x, -30, { amp: 110 })); }
    } else if (type === 'dart') {
      const n = light ? 2 : Math.min(6, 2 + Math.floor(diff * 0.9));
      for (let i = 0; i < n; i++) at(i * 0.35, () => this.spawnEnemy('dart', rand(40, W - 40), -30));
    } else if (type === 'gunner') {
      const n = diff > 2 && !light ? 2 : 1;
      for (let i = 0; i < n; i++) at(i * 0.6, () => this.spawnEnemy('gunner', n === 1 ? rand(100, W - 100) : (i ? W * 0.72 : W * 0.28), -40));
    } else if (type === 'sniper') {
      const n = diff > 2.5 ? 2 : 1;
      for (let i = 0; i < n; i++) at(i * 0.8, () => this.spawnEnemy('sniper', rand(60, W - 60), -30));
    } else if (type === 'splitter') {
      at(0, () => this.spawnEnemy('splitter', rand(80, W - 80), -40));
      if (diff > 2) at(1, () => this.spawnEnemy('splitter', rand(80, W - 80), -40));
    } else if (type === 'mine') {
      const n = 2 + Math.floor(diff * 0.6);
      for (let i = 0; i < n; i++) at(i * 0.5, () => this.spawnEnemy('mine', rand(40, W - 40), -30));
    } else if (type === 'tank') {
      at(0, () => this.spawnEnemy('tank', rand(110, W - 110), -50));
    }
  }

  processQueue(dt) {
    for (const q of this.queue) { q.t -= dt; if (q.t <= 0 && !q.dead) { q.dead = true; if (!this.run.done) q.fn(); } }
    compact(this.queue);
  }

  spawnEnemy(type, x, y, opt = {}) {
    const base = ENEMY[type], hpScale = 1 + this.diff * 0.25;
    const e = {
      type, x, y, r: base.r, hp: base.hp * hpScale, maxHp: base.hp * hpScale, t: 0, flash: 0,
      x0: x, vx: 0, vy: 0, state: 'enter', fireT: rand(0.8, 1.8), rot: 0, sp: SPR['e_' + type], spw: SPR['ew_' + type],
      ty: rand(70, Math.min(230, this.H * 0.32)), amp: opt.amp || rand(20, 50), ...opt
    };
    this.enemies.push(e); return e;
  }

  spawnAsteroid(kind, x, y, vx, vy) {
    const cfg = {
      big: { img: IMG.meteor1, r: 30, hp: 9 },
      med: { img: IMG.meteor2, r: 19, hp: 3 },
      crystal: { img: IMG.meteor3, r: 22, hp: 5 }
    }[kind];
    this.enemies.push({
      ast: kind, x: x ?? rand(30, W - 30), y: y ?? -40, vx: vx ?? rand(-30, 30), vy: vy ?? rand(80, 150) * (1 + this.diff * 0.08),
      r: cfg.r, hp: cfg.hp * (1 + this.diff * 0.15), img: cfg.img, rot: rand(0, TAU), vr: rand(-1.5, 1.5), flash: 0, t: 0
    });
  }

  meteorShower() {
    UI.banner(t('meteorWarn'), '', 1.6, 'warn');
    audio.sfx('warn');
    const n = 10 + Math.floor(this.diff * 3);
    for (let i = 0; i < n; i++) {
      const x = rand(25, W - 25), delay = 1 + i * 0.28;
      this.markers.push({ x, t: delay, max: delay });
      this.queue.push({ t: delay, fn: () => this.spawnAsteroid('med', x, -30, rand(-20, 20), rand(330, 420)) });
    }
  }

  randomPowerup() {
    const p = this.player, w = { power: p.power < 5 ? 34 : 4, repair: p.hp < p.maxHp ? 26 : 4, shield: 14, overdrive: 12, magnet: 12 };
    return weighted(w);
  }

  /* ================= enemies ================= */
  updateEnemies(dt) {
    const p = this.player, H = this.H;
    const bspd = (170 + this.diff * 22);
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.ast) {
        e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.vr * dt;
        if (e.y > H + 60) e.dead = true;
        continue;
      }
      switch (e.type) {
        case 'drone':
          e.y += (90 + this.diff * 10) * dt; e.x = e.x0 + Math.sin(e.t * 2.2) * e.amp;
          e.fireT -= dt;
          if (e.fireT <= 0 && e.y > 20 && e.y < H * 0.7) { e.fireT = Math.max(1.2, 2.6 - this.diff * 0.25); this.aimedShot(e, bspd, 'eb_red'); }
          break;
        case 'dart':
          if (e.state === 'enter') { e.y += 220 * dt; if (e.y >= e.ty * 0.7) { e.state = 'aim'; e.t = 0; } }
          else if (e.state === 'aim') {
            e.rot = Math.atan2(p.y - e.y, p.x - e.x) - Math.PI / 2;
            if (e.t > 0.55) { e.state = 'dash'; const a = Math.atan2(p.y - e.y, p.x - e.x), v = 440 + this.diff * 30; e.vx = Math.cos(a) * v; e.vy = Math.sin(a) * v; }
          } else { e.x += e.vx * dt; e.y += e.vy * dt; if (Math.random() < 0.5) this.addParticle(e.x, e.y, 0, 0, 0.25, 7, '#ff8a1f', 'glow'); }
          break;
        case 'gunner':
          if (e.state === 'enter') { e.y += 120 * dt; if (e.y >= e.ty) { e.state = 'hold'; e.t = 0; } }
          else if (e.state === 'hold') {
            e.x = clamp(e.x0 + Math.sin(e.t * 0.9) * 70, 30, W - 30);
            e.fireT -= dt;
            if (e.fireT <= 0) { e.fireT = Math.max(0.9, 1.7 - this.diff * 0.12); this.spread(e, 3 + (this.diff > 2.5 ? 2 : 0), 0.22, bspd, 'eb_purple'); }
            if (e.t > 7) e.state = 'leave';
          } else { e.y += 170 * dt; }
          break;
        case 'sniper':
          if (e.state === 'enter') { e.y += 140 * dt; if (e.y >= e.ty) { e.state = 'hold'; e.t = 0; e.fireT = 0.6; } }
          else if (e.state === 'hold') {
            e.x = clamp(e.x0 + Math.sin(e.t * 0.7) * 50, 30, W - 30);
            e.fireT -= dt;
            if (e.fireT <= 0 && !e.aim) { e.aim = { a: Math.atan2(p.y - e.y, p.x - e.x), t: 0.75 }; }
            if (e.aim) {
              e.aim.t -= dt;
              if (e.aim.t > 0.25) e.aim.a = Math.atan2(p.y - e.y, p.x - e.x); // locks 0.25s before firing
              if (e.aim.t <= 0) {
                const v = 480 + this.diff * 30;
                this.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(e.aim.a) * v, vy: Math.sin(e.aim.a) * v, r: 5, sp: SPR.eb_yellow });
                e.aim = null; e.fireT = Math.max(1.6, 2.8 - this.diff * 0.2); audio.sfx('shoot');
              }
            }
            if (e.t > 9) e.state = 'leave';
          } else { e.y += 160 * dt; }
          break;
        case 'splitter':
          e.y += 70 * dt; e.x = e.x0 + Math.sin(e.t * 1.4) * 60; e.rot += dt;
          break;
        case 'mini': {
          const a = Math.atan2(p.y - e.y, p.x - e.x), v = 150 + this.diff * 15;
          e.vx += (Math.cos(a) * v - e.vx) * dt * 1.5; e.vy += (Math.sin(a) * v - e.vy) * dt * 1.5;
          e.vy = Math.max(e.vy, 40);
          e.x += e.vx * dt; e.y += e.vy * dt; e.rot += dt * 4;
          break;
        }
        case 'mine':
          e.y += 55 * dt; e.rot += dt * 0.8;
          if (!e.armed && dist2(e.x, e.y, p.x, p.y) < 90 * 90) { e.armed = 0.65; }
          if (e.armed) { e.armed -= dt; if (e.armed <= 0) { this.ring(e, 10, 150 + this.diff * 15, 'eb_big', rand(0, 1)); this.explosion(e.x, e.y, 0.8, ENEMY.mine.color); e.dead = true; audio.sfx('explode'); } }
          break;
        case 'tank':
          if (e.state === 'enter') { e.y += 60 * dt; if (e.y >= e.ty) { e.state = 'hold'; e.t = 0; } }
          else { e.y += 14 * dt; e.x = clamp(e.x0 + Math.sin(e.t * 0.5) * 60, 40, W - 40); }
          e.fireT -= dt;
          if (e.fireT <= 0 && e.y > 30) { e.fireT = Math.max(1.5, 2.4 - this.diff * 0.12); this.ring(e, 12, bspd * 0.8, 'eb_red', e.t); this.aimedShot(e, bspd * 1.1, 'eb_orange'); }
          break;
      }
      if (e.y > H + 60 || e.y < -200 || e.x < -100 || e.x > W + 100) e.dead = true;
    }
    compact(this.enemies);
  }

  aimedShot(e, v, sp) {
    const p = this.player, a = Math.atan2(p.y - e.y, p.x - e.x);
    this.eBullets.push({ x: e.x, y: e.y + e.r * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 5, sp: SPR[sp] });
  }
  spread(e, n, gap, v, sp, baseA) {
    const p = this.player, a0 = baseA ?? Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * gap; this.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 5, sp: SPR[sp] }); }
  }
  ring(e, n, v, sp, off = 0) {
    const big = sp === 'eb_big';
    for (let i = 0; i < n; i++) { const a = off + i / n * TAU; this.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: big ? 8 : 5, sp: SPR[sp] }); }
  }

  damageEnemy(e, dmg, silent) {
    if (e.dead) return;
    e.hp -= dmg; e.flash = 0.06;
    if (!silent) audio.sfx('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.dead = true;
    const run = this.run, p = this.player;
    if (e.ast) {
      run.asteroids++; Save.d.stats.asteroids++; this.trackMission('asteroids', 1);
      this.debris(e.x, e.y, e.r, e.ast === 'crystal' ? '#7fdcff' : '#ffb067');
      audio.sfx('explode'); this.shake = Math.max(this.shake, 4);
      if (e.ast === 'big') for (const s of [-1, 1]) this.spawnAsteroid('med', e.x + s * 10, e.y, s * rand(60, 110), e.vy * 0.8);
      const shards = e.ast === 'crystal' ? 7 : (e.ast === 'big' ? 2 : 1);
      for (let i = 0; i < shards; i++) this.spawnPickup(e.x, e.y, 'shard');
      this.addScore(e.ast === 'big' ? 80 : 40, e.x, e.y, false);
      return;
    }
    const base = ENEMY[e.type];
    run.kills++; Save.d.stats.kills++; this.trackMission('kills', 1);
    run.combo++; run.comboT = 2.6; if (run.combo > run.maxCombo) { run.maxCombo = run.combo; this.trackMission('combo', run.combo, true); }
    if (run.combo > 1 && run.combo % 10 === 0) { this.floatText(e.x, e.y - 30, `COMBO x${run.combo}`, '#ffe11f', 22); audio.sfx('combo'); }
    p.charge = Math.min(100, p.charge + base.charge * p.chargeMult * (p.charge < 100 ? 1 : 0));
    if (p.charge >= 100 && !p.readyNotified) { p.readyNotified = true; audio.sfx('ready'); UI.specialReady(); }
    if (p.charge < 100) p.readyNotified = false;
    this.addScore(base.score, e.x, e.y, true);
    this.explosion(e.x, e.y, e.r / 22, base.color);
    audio.sfx('explode'); this.shake = Math.max(this.shake, e.type === 'tank' ? 10 : 4);
    // drops
    const shards = e.type === 'tank' ? 6 : (e.type === 'gunner' ? 3 : randi(1, 2));
    for (let i = 0; i < shards; i++) this.spawnPickup(e.x, e.y, 'shard');
    if (Math.random() < 0.07 * p.luck * (e.type === 'tank' ? 4 : 1)) this.spawnPickup(e.x, e.y, this.randomPowerup());
    if (e.type === 'splitter') for (const s of [-1, 1]) { const m = this.spawnEnemy('mini', e.x + s * 12, e.y, {}); m.vx = s * 140; m.vy = 60; }
    if (e.type === 'mine') this.ring(e, 6, 120, 'eb_big', rand(0, 1));
  }

  addScore(base, x, y, useCombo) {
    const mult = useCombo ? this.comboMult() : 1;
    const pts = Math.round(base * mult * (1 + this.diff * 0.1));
    this.run.score += pts;
    if (useCombo && Save.d.settings.quality === 'high') this.floatText(x, y, '+' + pts, mult > 1 ? '#ffe11f' : '#ffffff', 13);
  }
  comboMult() { return 1 + Math.min(this.run.combo, 100) / 20; }

  /* ================= bosses ================= */
  spawnBoss(kind, hpMul) {
    const cfg = BOSSES[kind];
    audio.sfx('warn'); vibrate([60, 60, 60]);
    UI.banner(t('bossWarn'), cfg.name, 2.6, 'boss');
    audio.setMusic('boss');
    const runRef = this.run;
    setTimeout(() => {
      if (this.run !== runRef || runRef.done || (this.state !== 'play' && this.state !== 'pause')) return;
      const hp = cfg.hp * hpMul * (this.mode === 'campaign' ? 1 : 1);
      this.boss = { kind, name: cfg.name, color: cfg.color, r: cfg.r, x: W / 2, y: -140, ty: Math.min(235, this.H * 0.3), hp, maxHp: hp, t: 0, pt: 0, pattern: 'enter', pIdx: 0, phase: 1, flash: 0, ready: false, nodes: [], fireT: 0, a: 0 };
      if (kind === 'voidcore') for (let i = 0; i < 6; i++) this.boss.nodes.push({ a: i / 6 * TAU, hp: 14 * hpMul, maxHp: 14 * hpMul, dead: 0, flash: 0 });
      UI.bossBar(this.boss);
      this.dir.bossPending = false;
    }, 2400);
  }

  updateBoss(dt) {
    const b = this.boss, p = this.player;
    b.t += dt; b.pt += dt; if (b.flash > 0) b.flash -= dt;
    if (b.dying) { this.bossDying(dt); return; }
    if (b.pattern === 'enter') {
      b.y += (b.ty - b.y) * Math.min(1, dt * 1.6);
      if (Math.abs(b.y - b.ty) < 4) { b.ready = true; this.nextPattern(); }
      return;
    }
    const hpF = b.hp / b.maxHp;
    const newPhase = hpF < 0.33 ? 3 : hpF < 0.66 ? 2 : 1;
    if (newPhase > b.phase) { b.phase = newPhase; this.flash = 0.35; this.flashColor = b.color; this.shake = 12; audio.sfx('warn'); this.ring(b, 20, 160, 'eb_big', b.t); }
    const rage = 1 + (b.phase - 1) * 0.35;
    const bspd = (180 + this.diff * 18) * (b.phase === 3 ? 1.12 : 1);
    if (b.kind === 'kraken') this.bossKraken(b, dt, rage, bspd);
    else if (b.kind === 'twinfang') this.bossTwin(b, dt, rage, bspd);
    else this.bossVoid(b, dt, rage, bspd);
  }

  nextPattern() {
    const b = this.boss;
    const lists = {
      kraken: ['spiral', 'burst', 'summon', 'rain', 'spiral', 'rings'],
      twinfang: ['lasers', 'shotgun', 'sweep', 'darts', 'lasers', 'shotgun'],
      voidcore: ['flower', 'cross', 'rings', 'aimed', 'cross', 'flower']
    }[b.kind];
    b.pattern = lists[b.pIdx % lists.length]; b.pIdx++; b.pt = 0; b.fireT = 0; b.sub = 0;
  }

  bossKraken(b, dt, rage, bspd) {
    b.x = W / 2 + Math.sin(b.t * 0.55) * (W * 0.26);
    b.y = b.ty + Math.sin(b.t * 1.3) * 10;
    b.fireT -= dt * rage;
    switch (b.pattern) {
      case 'spiral':
        if (b.fireT <= 0) {
          b.fireT = 0.075; b.a += 0.33;
          const arms = b.phase >= 2 ? 3 : 2;
          for (let i = 0; i < arms; i++) { const a = b.a + i * TAU / arms; this.eBullets.push({ x: b.x, y: b.y + 20, vx: Math.cos(a) * bspd * 0.8, vy: Math.sin(a) * bspd * 0.8, r: 5, sp: SPR.eb_red }); }
        }
        if (b.pt > 3.2) this.nextPattern(); break;
      case 'burst':
        if (b.fireT <= 0) { b.fireT = 0.38; this.spread({ x: b.x, y: b.y + 40 }, 5 + b.phase, 0.16, bspd * 1.15, 'eb_orange'); b.sub++; }
        if (b.sub >= 4) this.nextPattern(); break;
      case 'summon':
        if (b.sub === 0) { b.sub = 1; for (let i = 0; i < 2 + b.phase; i++) this.queue.push({ t: i * 0.25, fn: () => { if (this.boss) this.spawnEnemy('drone', clamp(b.x + rand(-120, 120), 30, W - 30), b.y + 30); } }); }
        if (b.pt > 1.6) this.nextPattern(); break;
      case 'rain':
        if (b.fireT <= 0) { b.fireT = 0.09; this.eBullets.push({ x: b.x + rand(-60, 60), y: b.y + 40, vx: rand(-60, 60), vy: bspd * rand(0.7, 1.2), r: 5, sp: SPR.eb_red }); }
        if (b.pt > 2.5) this.nextPattern(); break;
      case 'rings':
        if (b.fireT <= 0) { b.fireT = 0.55; this.ring(b, 16 + b.phase * 2, bspd * 0.75, 'eb_big', b.sub * 0.2); b.sub++; }
        if (b.sub >= 3) this.nextPattern(); break;
    }
  }

  bossTwin(b, dt, rage, bspd) {
    const spread = 100 + Math.sin(b.t * 0.8) * 30;
    b.x = W / 2 + Math.sin(b.t * 0.4) * 50; b.y = b.ty + Math.sin(b.t * 1.1) * 8;
    b.pods = [{ x: b.x - spread, y: b.y + 18 }, { x: b.x + spread, y: b.y + 18 }];
    b.fireT -= dt * rage;
    switch (b.pattern) {
      case 'lasers':
        if (b.sub === 0) {
          b.sub = 1; audio.sfx('laserCharge');
          const xs = [b.pods[0].x, b.pods[1].x]; if (b.phase >= 2) xs.push(this.player.x); if (b.phase >= 3) xs.push(rand(30, W - 30));
          xs.forEach((x, i) => this.lasers.push({ x, y: i < 2 ? b.pods[i].y : b.y + 30, a: Math.PI / 2, len: 2000, w: 26, tele: 1.0, life: 0.8, color: b.color, follow: i < 2 ? i : -1 }));
        }
        if (b.pt > 2.4) this.nextPattern(); break;
      case 'sweep':
        if (b.sub === 0) {
          b.sub = 1; audio.sfx('laserCharge');
          [0, 1].forEach(i => this.lasers.push({ x: b.pods[i].x, y: b.pods[i].y, a: Math.PI / 2 + (i ? -0.75 : 0.75), len: 2000, w: 20, tele: 1.1, life: 2.2, color: b.color, follow: i, sweep: (i ? 1 : -1) * 0.7 * rage }));
        }
        if (b.fireT <= 0 && b.pt > 1.2) { b.fireT = 0.6; this.aimedShot({ x: b.x, y: b.y, r: 30 }, bspd, 'eb_orange'); }
        if (b.pt > 3.6) this.nextPattern(); break;
      case 'shotgun':
        if (b.fireT <= 0) { b.fireT = 0.5; const pod = b.pods[b.sub % 2]; this.spread({ x: pod.x, y: pod.y + 20 }, 7, 0.12, bspd * 1.2, 'eb_orange'); b.sub++; }
        if (b.sub >= 4 + b.phase) this.nextPattern(); break;
      case 'darts':
        if (b.sub === 0) { b.sub = 1; for (let i = 0; i < 3 + b.phase; i++) this.queue.push({ t: i * 0.3, fn: () => { if (this.boss) this.spawnEnemy('dart', rand(40, W - 40), -20); } }); }
        if (b.fireT <= 0 && b.phase >= 2) { b.fireT = 0.7; this.ring(b, 14, bspd * 0.7, 'eb_orange', b.t); }
        if (b.pt > 2.2) this.nextPattern(); break;
    }
  }

  bossVoid(b, dt, rage, bspd) {
    b.x = W / 2 + Math.cos(b.t * 0.5) * 60; b.y = b.ty + Math.sin(b.t * 0.7) * 25;
    const nodeR = 86;
    for (const n of b.nodes) {
      n.a += dt * (0.9 + b.phase * 0.25); n.x = b.x + Math.cos(n.a) * nodeR; n.y = b.y + Math.sin(n.a) * nodeR;
      if (n.flash > 0) n.flash -= dt;
      if (n.dead > 0) { n.dead -= dt; if (n.dead <= 0) n.hp = n.maxHp; }
    }
    b.fireT -= dt * rage;
    switch (b.pattern) {
      case 'flower':
        if (b.fireT <= 0) { b.fireT = 0.16; b.a += 0.19; const n = 10 + b.phase * 2; for (let i = 0; i < n; i++) { const a = b.a + i / n * TAU; this.eBullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * bspd * 0.75, vy: Math.sin(a) * bspd * 0.75, r: 5, sp: SPR.eb_purple }); } }
        if (b.pt > 3.0) this.nextPattern(); break;
      case 'cross':
        if (b.sub === 0) {
          b.sub = 1; audio.sfx('laserCharge');
          const n = b.phase >= 3 ? 6 : 4, off = rand(0, 1);
          for (let i = 0; i < n; i++) this.lasers.push({ x: b.x, y: b.y, a: off + i / n * TAU, len: 2000, w: 18, tele: 1.2, life: 2.6, color: b.color, follow: 'core', sweep: 0.45 * (b.pIdx % 4 < 2 ? 1 : -1) });
        }
        if (b.phase >= 2 && b.fireT <= 0 && b.pt > 1.2) { b.fireT = 0.9; this.aimedShot({ x: b.x, y: b.y, r: 30 }, bspd * 1.1, 'eb_purple'); }
        if (b.pt > 4.0) this.nextPattern(); break;
      case 'rings':
        if (b.fireT <= 0) { b.fireT = 0.45; this.ring(b, 22, bspd * 0.7, b.sub % 2 ? 'eb_purple' : 'eb_big', b.sub % 2 ? 0.14 : 0); b.sub++; }
        if (b.sub >= 5) this.nextPattern(); break;
      case 'aimed':
        if (b.fireT <= 0) { b.fireT = 0.35; for (const n of b.nodes) if (n.dead <= 0 && Math.random() < 0.5) this.aimedShot({ x: n.x, y: n.y, r: 8 }, bspd * 1.05, 'eb_red'); b.sub++; }
        if (b.sub >= 7) this.nextPattern(); break;
    }
  }

  damageBoss(dmg, x, y, silent) {
    const b = this.boss;
    if (!b || !b.ready || b.dying) return;
    b.hp -= dmg; b.flash = 0.05;
    if (!silent) { audio.sfx('hit'); if (Math.random() < 0.3) this.addParticle(x, y, rand(-80, 80), rand(-150, -30), 0.3, 8, b.color, 'glow'); }
    this.run.score += Math.round(dmg * 3);
    if (b.hp <= 0) {
      b.hp = 0; b.dying = 2.4; b.ready = false;
      this.lasers.length = 0;
      for (const eb of this.eBullets) eb.dead = true;
      this.slowmo = 1.6; this.flash = 0.8; this.flashColor = '#ffffff';
      audio.sfx('bigExplode'); vibrate([80, 40, 80, 40, 200]);
    }
  }

  bossDying(dt) {
    const b = this.boss;
    b.dying -= dt; b.y += dt * 12; this.shake = Math.max(this.shake, 8);
    if (Math.random() < 0.35) { this.explosion(b.x + rand(-b.r, b.r), b.y + rand(-b.r, b.r), rand(0.6, 1.3), Math.random() < 0.5 ? b.color : '#ffffff'); audio.sfx('explode'); }
    if (b.dying <= 0) {
      this.explosion(b.x, b.y, 4, b.color); this.explosion(b.x, b.y, 2.5, '#ffffff');
      this.waves.push({ x: b.x, y: b.y, r: 0, max: 900, speed: 900, hit: new Set(), color: b.color, dmg: 0 });
      this.flash = 1; this.flashColor = '#ffffff'; this.shake = 30; audio.sfx('bigExplode');
      for (let i = 0; i < 30; i++) this.spawnPickup(b.x + rand(-40, 40), b.y + rand(-40, 40), 'shard');
      this.spawnPickup(b.x, b.y, 'power'); this.spawnPickup(b.x + 30, b.y, 'repair');
      const pts = 5000 + Math.round(b.maxHp * 10);
      this.run.score += pts; this.floatText(b.x, b.y, '+' + pts, '#ffe11f', 30);
      this.run.bossesKilled++; Save.d.stats.bosses++; this.trackMission('boss', 1);
      this.boss = null; UI.bossBar(null);
      audio.setMusic('game');
      if (this.mode === 'campaign') { this.run.bossDone = true; }
      else { this.dir.nextBossT = this.run.t + 100; }
    }
  }

  /* ================= lasers ================= */
  updateLasers(dt) {
    const b = this.boss;
    for (const L of this.lasers) {
      if (b) {
        if (L.follow === 'core') { L.x = b.x; L.y = b.y; }
        else if (typeof L.follow === 'number' && L.follow >= 0 && b.pods) { L.x = b.pods[L.follow].x; L.y = b.pods[L.follow].y; }
      }
      if (L.tele > 0) { L.tele -= dt; if (L.tele <= 0) { audio.sfx('laserFire'); this.shake = Math.max(this.shake, 6); } continue; }
      L.life -= dt; if (L.sweep) L.a += L.sweep * dt;
      if (L.life <= 0) L.dead = true;
    }
    compact(this.lasers);
  }

  /* ================= bullets ================= */
  updateBullets(dt, edt) {
    const H = this.H;
    for (const b of this.pBullets) {
      if (b.homing) {
        b.life -= dt;
        const tgt = this.nearestTarget(b.x, b.y);
        if (tgt) { const a = Math.atan2(tgt.y - b.y, tgt.x - b.x), v = 620; b.vx += (Math.cos(a) * v - b.vx) * dt * 5; b.vy += (Math.sin(a) * v - b.vy) * dt * 5; }
        else b.vy -= 600 * dt;
        b.rot = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        if (b.life <= 0) b.dead = true;
        if (Math.random() < 0.5) this.addParticle(b.x, b.y, 0, 0, 0.2, 5, '#ffd34d', 'glow');
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) b.dead = true;
    }
    compact(this.pBullets);
    const p = this.player;
    for (const b of this.eBullets) {
      b.x += b.vx * edt; b.y += b.vy * edt;
      if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) b.dead = true;
      // fortress reflect
      if (p.fortress > 0 && !b.dead && dist2(b.x, b.y, p.x, p.y) < 52 * 52) {
        b.dead = true;
        this.pBullets.push({ x: b.x, y: b.y, vx: -b.vx * 1.6, vy: -Math.abs(b.vy) * 1.8 - 200, dmg: 2 * p.dmgMult, sp: SPR.eb_reflect });
      }
    }
    compact(this.eBullets);
  }

  nearestTarget(x, y) {
    let best = null, bd = 1e12;
    for (const e of this.enemies) { if (e.dead || e.y < 0) continue; const d = dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    if (this.boss && this.boss.ready) { const d = dist2(x, y, this.boss.x, this.boss.y); if (d < bd) best = this.boss; }
    return best;
  }

  /* ================= pickups ================= */
  spawnPickup(x, y, type) {
    const shard = type === 'shard';
    this.pickups.push({
      type, x, y, vx: shard ? rand(-110, 110) : 0, vy: shard ? rand(-180, -40) : 60, t: 0, r: shard ? 8 : 16,
      drift: rand(0, TAU)
    });
  }

  updatePickups(dt) {
    const p = this.player;
    const magR = p.magnet > 0 ? 9999 : p.magR;
    for (const k of this.pickups) {
      k.t += dt;
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
      const pull = !p.dead && (k.type === 'shard' ? d < magR : d < Math.min(magR, 140)) && k.t > 0.25;
      if (pull) {
        const v = 520 + (p.magnet > 0 ? 300 : 0);
        k.vx += (dx / d * v - k.vx) * Math.min(1, dt * 7); k.vy += (dy / d * v - k.vy) * Math.min(1, dt * 7);
      } else if (k.type === 'shard') {
        k.vx *= Math.pow(0.1, dt); k.vy += (90 - k.vy) * Math.min(1, dt * 2.5);
      } else {
        k.vx = Math.sin(k.t * 2 + k.drift) * 30;
      }
      k.x += k.vx * dt; k.y += k.vy * dt;
      if (k.y > this.H + 40) k.dead = true;
      if (!p.dead && d < k.r + 20) { k.dead = true; this.collect(k); }
    }
    compact(this.pickups);
  }

  collect(k) {
    const p = this.player, run = this.run;
    if (k.type === 'shard') {
      run.crystals++; Save.d.stats.crystals++; this.trackMission('crystals', 1);
      run.score += 10; audio.sfx('crystal');
      this.addParticle(k.x, k.y, 0, 0, 0.25, 12, '#7ff9ff', 'glow');
      return;
    }
    run.pickups++; this.trackMission('pickups', 1);
    audio.sfx('power'); vibrate(25);
    this.burst(k.x, k.y, 14, '#ffffff', 200);
    switch (k.type) {
      case 'power':
        if (p.power < 5) { p.power++; this.floatText(p.x, p.y - 40, p.power === 5 ? t('p_maxpower') : t('p_power'), '#ffb000', 18); }
        else { run.score += 500; this.floatText(p.x, p.y - 40, '+500', '#ffb000', 18); }
        break;
      case 'repair': { const h = Math.round(p.maxHp * 0.35); p.hp = Math.min(p.maxHp, p.hp + h); this.floatText(p.x, p.y - 40, t('p_repair'), '#3dff93', 18); break; }
      case 'shield': p.shield = 6; audio.sfx('shield'); this.floatText(p.x, p.y - 40, t('p_shield'), '#ff3df2', 18); break;
      case 'overdrive': p.overdrive = 4.5; this.floatText(p.x, p.y - 40, t('p_overdrive'), '#ffbd00', 20); this.flash = 0.25; this.flashColor = '#ffbd00'; break;
      case 'magnet': p.magnet = 8; this.floatText(p.x, p.y - 40, t('p_magnet'), '#ff4d6d', 18); break;
    }
  }

  /* ================= collisions ================= */
  collide() {
    const p = this.player, b = this.boss;
    // player bullets vs enemies / boss
    for (const bl of this.pBullets) {
      if (bl.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const rr = e.r + 4;
        if (dist2(bl.x, bl.y, e.x, e.y) < rr * rr) {
          bl.dead = true; this.damageEnemy(e, bl.dmg);
          if (Math.random() < 0.5) this.addParticle(bl.x, bl.y, rand(-60, 60), rand(-120, 0), 0.18, 7, e.ast ? '#ffd0a0' : ENEMY[e.type].color, 'glow');
          break;
        }
      }
      if (bl.dead || !b || !b.ready) continue;
      if (b.kind === 'voidcore') {
        let blocked = false;
        for (const n of b.nodes) {
          if (n.dead > 0) continue;
          if (dist2(bl.x, bl.y, n.x, n.y) < 20 * 20) {
            bl.dead = true; blocked = true; n.hp -= bl.dmg; n.flash = 0.05;
            if (n.hp <= 0) { n.dead = 7; this.explosion(n.x, n.y, 0.7, b.color); audio.sfx('explode'); this.run.score += 300; }
            break;
          }
        }
        if (blocked) continue;
      }
      const hitR = b.r * (b.kind === 'twinfang' ? 0.8 : 0.85);
      if (dist2(bl.x, bl.y, b.x, b.y) < hitR * hitR) { bl.dead = true; this.damageBoss(bl.dmg, bl.x, bl.y); continue; }
      if (b.kind === 'twinfang' && b.pods) for (const pod of b.pods) if (dist2(bl.x, bl.y, pod.x, pod.y) < 26 * 26) { bl.dead = true; this.damageBoss(bl.dmg * 0.5, bl.x, bl.y); break; }
    }
    // nova waves
    for (const w of this.waves) {
      if (!w.dmg) continue;
      for (const e of this.enemies) {
        if (e.dead || w.hit.has(e)) continue;
        const d = Math.sqrt(dist2(w.x, w.y, e.x, e.y));
        if (d < w.r) { w.hit.add(e); this.damageEnemy(e, w.dmg, true); }
      }
      if (b && b.ready && !w.hit.has(b) && Math.sqrt(dist2(w.x, w.y, b.x, b.y)) < w.r) { w.hit.add(b); this.damageBoss(w.dmg * 1.4, b.x, b.y); }
    }
    if (p.dead || this.run.done) return;
    // enemies vs player (ram)
    for (const e of this.enemies) {
      if (e.dead) continue;
      const rr = e.r * 0.8 + p.r + 6;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        const invuln = p.shield > 0 || p.fortress > 0 || p.overdrive > 0;
        if (invuln) { this.damageEnemy(e, 40); }
        else if (p.inv <= 0) { this.hurtPlayer(e.ast ? 18 : 24, e.x, e.y); this.damageEnemy(e, e.ast ? 99 : 6); }
      }
    }
    // enemy bullets vs player (small hitbox = fair bullet-hell)
    for (const eb of this.eBullets) {
      if (eb.dead) continue;
      const rr = eb.r + p.r;
      if (dist2(eb.x, eb.y, p.x, p.y) < rr * rr) { eb.dead = true; this.hurtPlayer(11, eb.x, eb.y); }
    }
    // lasers
    for (const L of this.lasers) {
      if (L.tele > 0) continue;
      const x2 = L.x + Math.cos(L.a) * L.len, y2 = L.y + Math.sin(L.a) * L.len;
      const rr = L.w / 2 + p.r;
      if (segDist2(p.x, p.y, L.x, L.y, x2, y2) < rr * rr) this.hurtPlayer(22, p.x, p.y);
    }
    // boss body
    if (b && b.ready) {
      const rr = b.r * 0.7 + p.r;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) this.hurtPlayer(30, p.x, p.y);
    }
  }

  /* ================= objectives & end ================= */
  objectiveProgress() {
    if (!this.level) return null;
    const o = this.level.obj, r = this.run;
    if (o.type === 'kill') return { cur: r.kills, max: o.n };
    if (o.type === 'collect') return { cur: r.crystals, max: o.n };
    if (o.type === 'survive') return { cur: Math.floor(r.t), max: o.n };
    if (o.type === 'boss') return { cur: r.bossDone ? 1 : 0, max: 1, boss: true, bossIn: Math.max(0, Math.ceil(o.warmup - r.t)) };
  }

  checkObjective(rdt) {
    const run = this.run;
    if (run.done) {
      run.endT -= rdt;
      if (run.endT <= 0 && this.state === 'play') this.finish();
      return;
    }
    if (this.mode === 'endless') { this.trackMission('endlessTime', Math.floor(run.t), true); return; }
    const pr = this.objectiveProgress();
    if (pr && pr.cur >= pr.max) {
      // clear the screen, warp out
      for (const e of this.enemies) if (!e.dead) { this.explosion(e.x, e.y, 0.7, e.ast ? '#ffb067' : ENEMY[e.type].color); e.dead = true; }
      for (const eb of this.eBullets) eb.dead = true;
      this.lasers.length = 0;
      this.player.inv = 99;
      audio.sfx('victory');
      UI.banner(t('victory'), '', 2, 'win');
      this.endRun('victory', 2.4);
    }
  }

  endRun(outcome, delay) {
    this.run.done = true; this.run.outcome = outcome; this.run.endT = delay;
  }

  finish() {
    const run = this.run, p = this.player, lvl = this.level;
    this.state = 'over';
    audio.setMusic('menu');
    Save.d.stats.runs++;
    const res = { mode: this.mode, outcome: run.outcome, score: run.score, kills: run.kills, crystals: run.crystals, time: run.t, maxCombo: run.maxCombo, level: lvl };
    let credits = run.crystals + Math.floor(run.score / 60);
    if (this.mode === 'campaign' && run.outcome === 'victory') {
      const stars = [true, this.secondaryMet(), p.hp / p.maxHp >= 0.6];
      const starCount = stars.filter(Boolean).length;
      const rec = Save.recordLevel(lvl.id, starCount, run.score);
      credits += lvl.reward + (rec.firstClear ? lvl.reward : 0) + rec.newStars * 100;
      res.stars = stars; res.firstClear = rec.firstClear;
      this.trackMission('clears', 1);
    }
    if (this.mode === 'endless') {
      res.best = Save.d.endlessBest;
      if (run.score > Save.d.endlessBest) { Save.d.endlessBest = run.score; res.newBest = true; }
      Save.d.stats.endlessBest = Save.d.endlessBest;
    }
    if (this.mode === 'campaign' && run.outcome !== 'victory') credits = Math.floor(credits * 0.6);
    res.credits = credits;
    Save.d.credits += credits;
    res.xp = Math.round(run.score / 8 + (run.outcome === 'victory' ? 200 : 0));
    res.levelUps = Save.addXP(res.xp);
    Save.persist();
    UI.results(res);
  }

  secondaryMet() {
    const s = this.level.sec, r = this.run;
    switch (s.type) {
      case 'combo': return r.maxCombo >= s.n;
      case 'crystals': return r.crystals >= s.n;
      case 'asteroids': return r.asteroids >= s.n;
      case 'kills': return r.kills >= s.n;
      case 'time': return r.t <= s.n;
      case 'nospecial': return r.specials === 0;
    }
    return false;
  }
  secondaryProgress() {
    const s = this.level.sec, r = this.run;
    switch (s.type) {
      case 'combo': return Math.min(r.maxCombo, s.n) + '/' + s.n;
      case 'crystals': return Math.min(r.crystals, s.n) + '/' + s.n;
      case 'asteroids': return Math.min(r.asteroids, s.n) + '/' + s.n;
      case 'kills': return Math.min(r.kills, s.n) + '/' + s.n;
      case 'time': return Math.floor(r.t) + 's/' + s.n + 's';
      case 'nospecial': return r.specials === 0 ? '✓' : '✗';
    }
  }

  trackMission(type, amount, isMax) {
    const done = Save.track(type, amount, isMax);
    for (const m of done) { UI.toast(t('missionDone') + ' ' + t('m_' + m.type, { n: m.n }), '★'); audio.sfx('mission'); }
  }

  /* ================= effects ================= */
  addParticle(x, y, vx, vy, life, size, color, kind = 'glow', drag = 0) {
    if (this.particles.length > (this.quality() === 'high' ? 700 : 260)) return;
    this.particles.push({ x, y, vx, vy, life, max: life, size, color, kind, drag });
  }
  burst(x, y, n, color, speed) {
    if (this.quality() === 'low') n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), v = rand(0.3, 1) * speed; this.addParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.25, 0.6), rand(4, 9), color, 'glow', 2.5); }
  }
  explosion(x, y, size, color) {
    const q = this.quality() === 'high';
    this.addParticle(x, y, 0, 0, 0.25, 70 * size, '#ffffff', 'flash');
    this.addParticle(x, y, 0, 0, 0.45, 60 * size, color, 'ring');
    const n = Math.round((q ? 22 : 10) * Math.min(size, 2.5));
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), v = rand(60, 340) * Math.sqrt(size); this.addParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.8), rand(5, 13) * Math.sqrt(size), Math.random() < 0.3 ? '#ffffff' : color, 'glow', 3); }
    if (q) for (let i = 0; i < 6 * size; i++) { const a = rand(0, TAU), v = rand(150, 450); this.addParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.45), 2, color, 'spark', 4); }
  }
  debris(x, y, r, color) {
    this.addParticle(x, y, 0, 0, 0.35, r * 2.4, color, 'ring');
    for (let i = 0; i < 10; i++) { const a = rand(0, TAU), v = rand(40, 200); this.addParticle(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.4, 0.9), rand(2, 4), '#b8a48f', 'rock', 1.5); }
    this.burst(x, y, 8, color, 160);
  }
  floatText(x, y, text, color, size) {
    if (this.texts.length > 30) this.texts.shift();
    this.texts.push({ x, y, text, color, size, life: 0.9, max: 0.9 });
  }

  updateFx(dt) {
    for (const q of this.particles) {
      q.life -= dt;
      if (q.life <= 0) { q.dead = true; continue; }
      if (q.drag) { const f = Math.exp(-q.drag * dt); q.vx *= f; q.vy *= f; }
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    compact(this.particles);
    for (const tx of this.texts) { tx.life -= dt; tx.y -= 50 * dt; if (tx.life <= 0) tx.dead = true; }
    compact(this.texts);
    for (const w of this.waves) { w.r += w.speed * dt; if (w.r > w.max) w.dead = true; }
    compact(this.waves);
    for (const m of this.markers) { m.t -= dt; if (m.t <= 0) m.dead = true; }
    compact(this.markers);
    this.shake *= Math.exp(-dt * 8); if (this.shake < 0.3) this.shake = 0;
    if (this.flash > 0) this.flash -= dt * 1.8;
    if (this.dmgFlash > 0) this.dmgFlash -= dt * 1.5;
  }

  /* ================= rendering ================= */
  render() {
    const c = this.ctx, d = this.dpr, s = this.scale;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = '#04030c'; c.fillRect(0, 0, this.cw, this.ch);
    this.renderBackground(c);

    // world transform
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = rand(-this.shake, this.shake); sy = rand(-this.shake, this.shake); }
    c.setTransform(d * s, 0, 0, d * s, d * (this.offX + sx), d * sy);
    this.renderStars(c);
    if (this.state === 'play' || this.state === 'pause' || this.state === 'over') this.renderWorld(c);

    // screen-space overlays
    c.setTransform(d, 0, 0, d, 0, 0);
    if (this.offX > 2) this.renderSideRails(c);
    if (this.warp > 0) { c.fillStyle = `rgba(140,90,255,${0.12 + Math.sin(this.time * 6) * 0.03})`; c.fillRect(0, 0, this.cw, this.ch); }
    if (this.flash > 0) { c.globalAlpha = clamp(this.flash, 0, 1) * 0.6; c.fillStyle = this.flashColor; c.fillRect(0, 0, this.cw, this.ch); c.globalAlpha = 1; }
    if (this.dmgFlash > 0) {
      const g = c.createRadialGradient(this.cw / 2, this.ch / 2, Math.min(this.cw, this.ch) * 0.3, this.cw / 2, this.ch / 2, Math.max(this.cw, this.ch) * 0.7);
      g.addColorStop(0, 'rgba(255,0,60,0)'); g.addColorStop(1, `rgba(255,0,60,${this.dmgFlash * 0.7})`);
      c.fillStyle = g; c.fillRect(0, 0, this.cw, this.ch);
    }
    if (this.player && !this.player.dead && this.player.hp / this.player.maxHp < 0.3 && this.state === 'play') {
      const a = 0.18 + Math.sin(this.time * 6) * 0.1;
      const g = c.createRadialGradient(this.cw / 2, this.ch / 2, Math.min(this.cw, this.ch) * 0.35, this.cw / 2, this.ch / 2, Math.max(this.cw, this.ch) * 0.75);
      g.addColorStop(0, 'rgba(255,0,60,0)'); g.addColorStop(1, `rgba(255,0,60,${a})`);
      c.fillStyle = g; c.fillRect(0, 0, this.cw, this.ch);
    }
    if (this.input.joy && this.state === 'play') {
      const j = this.input.joy;
      c.strokeStyle = 'rgba(0,242,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(j.bx, j.by, 56, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(0,242,255,0.35)'; c.beginPath(); c.arc(j.bx + j.dx * 56, j.by + j.dy * 56, 22, 0, TAU); c.fill();
    }
  }

  renderBackground(c) {
    const sec = this.sector || SECTORS[0];
    const img = IMG.bg;
    if (img && img.naturalWidth) {
      const size = Math.max(this.cw, this.ch) * 1.1;
      const y = (this.bgY * this.scale * 0.6) % size;
      c.globalAlpha = 0.55;
      c.drawImage(img, (this.cw - size) / 2, y - size, size, size);
      c.drawImage(img, (this.cw - size) / 2, y, size, size);
      c.globalAlpha = 1;
    }
    c.fillStyle = sec.tint; c.fillRect(0, 0, this.cw, this.ch);
    // distant planet
    if (this.quality() === 'high') {
      const pr = Math.min(this.cw, this.ch) * 0.35;
      const py = ((this.bgY * this.scale * 0.15) % (this.ch + pr * 3)) - pr * 1.5;
      const px = this.cw * 0.82;
      const g = c.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
      g.addColorStop(0, sec.planet[0]); g.addColorStop(0.55, sec.planet[1]); g.addColorStop(1, 'rgba(0,0,0,0.95)');
      c.globalAlpha = 0.55; c.fillStyle = g; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
      c.strokeStyle = sec.planet[0]; c.globalAlpha = 0.25; c.lineWidth = 3; c.beginPath(); c.arc(px, py, pr + 3, 0, TAU); c.stroke();
      c.globalAlpha = 1;
    }
  }

  renderStars(c) {
    const streak = this.player && this.player.overdrive > 0;
    c.fillStyle = '#fff';
    for (const s of this.stars) {
      c.globalAlpha = s.a * (s.l === 2 ? 0.9 : 0.6);
      if (streak && s.l > 0) c.fillRect(s.x, s.y, s.s, s.s * 14);
      else c.fillRect(s.x, s.y, s.s, s.s);
    }
    c.globalAlpha = 1;
  }

  renderSideRails(c) {
    const g1 = c.createLinearGradient(0, 0, this.offX, 0);
    g1.addColorStop(0, 'rgba(2,1,8,0.92)'); g1.addColorStop(1, 'rgba(2,1,8,0.55)');
    c.fillStyle = g1; c.fillRect(0, 0, this.offX, this.ch);
    const g2 = c.createLinearGradient(this.cw, 0, this.cw - this.offX, 0);
    g2.addColorStop(0, 'rgba(2,1,8,0.92)'); g2.addColorStop(1, 'rgba(2,1,8,0.55)');
    c.fillStyle = g2; c.fillRect(this.cw - this.offX, 0, this.offX, this.ch);
    c.strokeStyle = 'rgba(0,242,255,0.35)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(this.offX, 0); c.lineTo(this.offX, this.ch); c.moveTo(this.cw - this.offX, 0); c.lineTo(this.cw - this.offX, this.ch); c.stroke();
  }

  renderWorld(c) {
    const p = this.player, T = this.time;
    // meteor markers
    for (const m of this.markers) {
      const a = 0.4 + Math.sin(T * 20) * 0.4;
      c.globalAlpha = a; c.fillStyle = '#ff5a3a';
      c.beginPath(); c.moveTo(m.x, 30); c.lineTo(m.x - 10, 12); c.lineTo(m.x + 10, 12); c.closePath(); c.fill();
      c.fillRect(m.x - 1, 0, 2, 10);
    }
    c.globalAlpha = 1;

    // lasers (telegraph + beam)
    for (const L of this.lasers) this.drawLaser(c, L);

    // pickups
    for (const k of this.pickups) this.drawPickup(c, k);

    // enemies
    for (const e of this.enemies) {
      if (e.ast) {
        const img = e.img, sz = e.r * 2.6;
        if (img && img.naturalWidth) {
          c.save(); c.translate(e.x, e.y); c.rotate(e.rot);
          c.drawImage(img, -sz / 2, -sz / 2, sz, sz);
          if (e.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.drawImage(img, -sz / 2, -sz / 2, sz, sz); }
          c.restore();
        } else { c.fillStyle = '#776'; c.beginPath(); c.arc(e.x, e.y, e.r, 0, TAU); c.fill(); }
        continue;
      }
      // sniper telegraph
      if (e.type === 'sniper' && e.aim) {
        const locked = e.aim.t <= 0.25;
        c.strokeStyle = locked ? 'rgba(255,240,80,0.9)' : 'rgba(255,225,31,0.35)'; c.lineWidth = locked ? 2 : 1;
        c.setLineDash(locked ? [] : [8, 8]);
        c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + Math.cos(e.aim.a) * 1200, e.y + Math.sin(e.aim.a) * 1200); c.stroke();
        c.setLineDash([]);
      }
      if (e.type === 'mine' && e.armed) { c.globalAlpha = 0.3 + Math.sin(T * 40) * 0.3; c.strokeStyle = '#ff2bd6'; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y, 90, 0, TAU); c.stroke(); c.globalAlpha = 1; }
      let rot = e.rot || 0;
      if (e.type === 'dart' && e.state === 'dash') rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
      drawSprite(c, e.flash > 0 || (e.type === 'mine' && e.armed && Math.sin(T * 40) > 0) ? e.spw : e.sp, e.x, e.y, rot);
      // hp bar for tough ones
      if ((e.type === 'tank' || e.type === 'gunner') && e.hp < e.maxHp) {
        const w = e.r * 1.6; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
        c.fillStyle = ENEMY[e.type].color; c.fillRect(e.x - w / 2, e.y - e.r - 10, w * clamp(e.hp / e.maxHp, 0, 1), 4);
      }
    }

    if (this.boss) this.drawBoss(c, this.boss);

    // player bullets
    for (const b of this.pBullets) drawSprite(c, b.sp, b.x, b.y, b.rot || 0);

    // player
    if (p && !p.dead) this.drawPlayer(c, p);

    // enemy bullets (on top for readability)
    for (const b of this.eBullets) c.drawImage(b.sp.c, b.x - b.sp.w / 2, b.y - b.sp.h / 2, b.sp.w, b.sp.h);

    // nova waves
    for (const w of this.waves) {
      const a = 1 - w.r / w.max;
      c.globalAlpha = a; c.strokeStyle = w.color; c.lineWidth = 18 * a + 2;
      c.beginPath(); c.arc(w.x, w.y, w.r, 0, TAU); c.stroke();
      c.globalAlpha = a * 0.5; c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
    }
    c.globalAlpha = 1;

    // particles (additive)
    c.globalCompositeOperation = 'lighter';
    for (const q of this.particles) {
      const a = q.life / q.max;
      if (q.kind === 'glow') { const sz = q.size * (0.5 + a * 0.5) * 2; c.globalAlpha = a; c.drawImage(glowTint(q.color), q.x - sz / 2, q.y - sz / 2, sz, sz); }
      else if (q.kind === 'flash') { const sz = q.size * (1.5 - a * 0.5) * 2; c.globalAlpha = a; c.drawImage(SPR.glow, q.x - sz / 2, q.y - sz / 2, sz, sz); }
      else if (q.kind === 'ring') { c.globalAlpha = a; c.strokeStyle = q.color; c.lineWidth = 4 * a + 1; c.beginPath(); c.arc(q.x, q.y, q.size * (1 - a) + 4, 0, TAU); c.stroke(); }
      else if (q.kind === 'spark') { c.globalAlpha = a; c.strokeStyle = q.color; c.lineWidth = 2; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); c.stroke(); }
    }
    c.globalCompositeOperation = 'source-over';
    for (const q of this.particles) if (q.kind === 'rock') { c.globalAlpha = q.life / q.max; c.fillStyle = q.color; c.fillRect(q.x, q.y, q.size, q.size); }
    c.globalAlpha = 1;

    // floating texts
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const tx of this.texts) {
      const a = Math.min(1, tx.life / tx.max * 2);
      c.globalAlpha = a; c.font = `800 ${tx.size}px Orbitron, Outfit, sans-serif`;
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.65)'; c.strokeText(tx.text, tx.x, tx.y);
      c.fillStyle = tx.color; c.fillText(tx.text, tx.x, tx.y);
    }
    c.globalAlpha = 1;
  }

  drawPlayer(c, p) {
    const T = this.time;
    // beam special
    if (p.beam > 0) {
      const w = 52 * (0.85 + Math.sin(T * 50) * 0.15) * Math.min(1, p.beam * 3);
      c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(p.x - w, 0, p.x + w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, hexA(p.ship.color, 0.5)); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(0.7, hexA(p.ship.color, 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(p.x - w, -20, w * 2, p.y);
      c.drawImage(glowTint(p.ship.color), p.x - 50, p.y - 70, 100, 100);
      c.globalCompositeOperation = 'source-over';
    }
    const blink = p.inv > 0 && p.inv < 50 && Math.floor(T * 18) % 2 === 0;
    const sp = SPR['ship_' + p.ship.id];
    // thruster flame
    c.globalCompositeOperation = 'lighter';
    const fl = 18 + Math.sin(T * 40) * 5 + (p.overdrive > 0 ? 18 : 0);
    c.globalAlpha = 0.9; c.drawImage(glowTint(p.overdrive > 0 ? '#ffbd00' : p.ship.color), p.x - 12, p.y + 14, 24, fl + 10);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    if (!blink) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.tilt * 0.4); c.scale(1 - Math.abs(p.tilt) * 0.5, 1);
      c.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
      c.restore();
    }
    // shields
    if (p.shield > 0 || p.overdrive > 0) {
      const col = p.shield > 0 ? '#ff3df2' : '#ffbd00';
      const fade = (p.shield > 0 ? p.shield : p.overdrive) < 1.2 && Math.floor(T * 10) % 2 ? 0.2 : 1;
      c.globalAlpha = 0.6 * fade; c.strokeStyle = col; c.lineWidth = 3;
      c.beginPath(); c.arc(p.x, p.y, 34 + Math.sin(T * 8) * 2, 0, TAU); c.stroke();
      c.globalAlpha = 0.12 * fade; c.fillStyle = col; c.fill(); c.globalAlpha = 1;
    }
    if (p.fortress > 0) {
      const fade = p.fortress < 1.2 && Math.floor(T * 10) % 2 ? 0.3 : 1;
      c.globalAlpha = 0.85 * fade; c.strokeStyle = '#ffd36b'; c.lineWidth = 4;
      for (let i = 0; i < 6; i++) { const a = T * 2 + i / 6 * TAU; c.beginPath(); c.arc(p.x, p.y, 52, a, a + 0.75); c.stroke(); }
      c.globalAlpha = 0.15 * fade; c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(p.x, p.y, 52, 0, TAU); c.fill(); c.globalAlpha = 1;
    }
    // hitbox core (helps dodging)
    c.fillStyle = '#ffffff'; c.globalAlpha = 0.85; c.beginPath(); c.arc(p.x, p.y + 2, 3, 0, TAU); c.fill(); c.globalAlpha = 1;
    if (p.magnet > 0) { c.globalAlpha = 0.25 + Math.sin(T * 10) * 0.1; c.strokeStyle = '#ff4d6d'; c.lineWidth = 1.5; c.setLineDash([4, 6]); c.beginPath(); c.arc(p.x, p.y, 60 + (T * 60) % 40, 0, TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
  }

  drawPickup(c, k) {
    const T = this.time;
    if (k.type === 'shard') {
      const img = IMG.crystal, sz = 18 + Math.sin(T * 8 + k.drift) * 2;
      if (img && img.naturalWidth) c.drawImage(img, k.x - sz / 2, k.y - sz / 2, sz, sz);
      return;
    }
    const map = { power: ['ammo', '#ffb000'], repair: ['repair', '#3dff93'], shield: ['shield', '#ff3df2'], overdrive: ['turbo', '#ffbd00'], magnet: [null, '#ff4d6d'] };
    const [imgKey, col] = map[k.type];
    const pulse = 1 + Math.sin(T * 6 + k.drift) * 0.08;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
    c.drawImage(glowTint(col), k.x - 30 * pulse, k.y - 30 * pulse, 60 * pulse, 60 * pulse);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.strokeStyle = col; c.lineWidth = 2; c.globalAlpha = 0.8;
    c.beginPath(); c.arc(k.x, k.y, 20 * pulse, T * 3, T * 3 + 4.5); c.stroke(); c.globalAlpha = 1;
    if (imgKey && IMG[imgKey] && IMG[imgKey].naturalWidth) c.drawImage(IMG[imgKey], k.x - 17, k.y - 17, 34, 34);
    else drawSprite(c, SPR.magnet, k.x, k.y, 0, 0.75);
  }

  drawLaser(c, L) {
    const x2 = L.x + Math.cos(L.a) * L.len, y2 = L.y + Math.sin(L.a) * L.len;
    if (L.tele > 0) {
      c.globalAlpha = 0.35 + Math.sin(this.time * 30) * 0.25;
      c.strokeStyle = L.color; c.lineWidth = 2; c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(L.x, L.y); c.lineTo(x2, y2); c.stroke(); c.setLineDash([]);
      c.globalAlpha = 0.12; c.lineWidth = L.w; c.beginPath(); c.moveTo(L.x, L.y); c.lineTo(x2, y2); c.stroke();
      c.globalAlpha = 1; return;
    }
    const f = Math.min(1, L.life * 4), w = L.w * (0.9 + Math.sin(this.time * 60) * 0.1) * f;
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = L.color; c.globalAlpha = 0.35; c.lineWidth = w * 2.2; c.beginPath(); c.moveTo(L.x, L.y); c.lineTo(x2, y2); c.stroke();
    c.globalAlpha = 0.9; c.lineWidth = w; c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = w * 0.35; c.stroke();
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }

  drawBoss(c, b) {
    const T = this.time, col = b.flash > 0 ? '#ffffff' : b.color;
    const glowStroke = (lw) => { c.globalAlpha = 0.25; c.lineWidth = lw * 3; c.stroke(); c.globalAlpha = 1; c.lineWidth = lw; c.stroke(); };
    c.save(); c.translate(b.x, b.y);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
    c.drawImage(glowTint(b.color), -b.r * 2, -b.r * 2, b.r * 4, b.r * 4);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    const body = c.createRadialGradient(0, -b.r * 0.3, 4, 0, 0, b.r * 1.1);
    body.addColorStop(0, hexA(b.color, 0.6)); body.addColorStop(0.6, 'rgba(25,8,35,0.95)'); body.addColorStop(1, 'rgba(6,2,12,0.98)');

    if (b.kind === 'kraken') {
      // tentacles
      c.strokeStyle = col;
      for (let i = 0; i < 7; i++) {
        const bx = (i - 3) * 16; c.beginPath(); c.moveTo(bx, b.r * 0.5);
        for (let j = 1; j <= 8; j++) c.lineTo(bx + Math.sin(T * 3 + i * 0.9 + j * 0.7) * (5 + j * 2.2) + (i - 3) * j * 2.5, b.r * 0.5 + j * 13);
        glowStroke(3.5 - Math.abs(i - 3) * 0.3);
      }
      c.fillStyle = body; c.strokeStyle = col;
      c.beginPath(); c.ellipse(0, 0, b.r, b.r * 0.72, 0, 0, TAU); c.fill(); glowStroke(3);
      // crown spikes
      c.beginPath(); for (let i = -3; i <= 3; i++) { c.moveTo(i * 18, -b.r * 0.62); c.lineTo(i * 22, -b.r * 0.62 - 18 + Math.abs(i) * 3); } glowStroke(3);
      // eye tracking player
      const p = this.player, ea = p ? Math.atan2(p.y - b.y, p.x - b.x) : Math.PI / 2;
      c.fillStyle = '#12020a'; c.beginPath(); c.arc(0, 4, 22, 0, TAU); c.fill(); c.strokeStyle = col; glowStroke(2.5);
      c.fillStyle = b.phase >= 2 ? '#ffe11f' : '#ff3b5c'; c.beginPath(); c.arc(Math.cos(ea) * 9, 4 + Math.sin(ea) * 9, 9, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(Math.cos(ea) * 9 - 3, 1 + Math.sin(ea) * 9, 3, 0, TAU); c.fill();
    } else if (b.kind === 'twinfang') {
      c.restore(); c.save();
      if (b.pods) for (const [i, pod] of b.pods.entries()) {
        c.save(); c.translate(pod.x, pod.y); const s = i ? 1 : -1;
        c.fillStyle = body; c.strokeStyle = col;
        c.beginPath(); c.moveTo(0, -34); c.lineTo(s * 26, -10); c.lineTo(s * 14, 40); c.lineTo(0, 54); c.lineTo(-s * 12, 20); c.closePath(); c.fill(); glowStroke(3);
        const charging = this.lasers.some(L => L.follow === i && L.tele > 0);
        c.fillStyle = charging ? '#ffffff' : b.color; c.beginPath(); c.arc(0, 30, charging ? 8 + Math.sin(T * 40) * 3 : 6, 0, TAU); c.fill();
        c.restore();
      }
      c.translate(b.x, b.y);
      // connecting arms
      if (b.pods) { c.strokeStyle = col; c.beginPath(); c.moveTo(-b.r * 0.6, 0); c.lineTo(b.pods[0].x - b.x + 10, b.pods[0].y - b.y - 10); c.moveTo(b.r * 0.6, 0); c.lineTo(b.pods[1].x - b.x - 10, b.pods[1].y - b.y - 10); glowStroke(2); }
      c.fillStyle = body; c.strokeStyle = col;
      poly(c, [[0, -b.r * 0.9], [b.r * 0.75, -b.r * 0.1], [b.r * 0.35, b.r * 0.8], [0, b.r * 0.55], [-b.r * 0.35, b.r * 0.8], [-b.r * 0.75, -b.r * 0.1]]); c.fill(); glowStroke(3);
      c.beginPath(); c.moveTo(-18, -6); c.lineTo(-6, 6); c.moveTo(18, -6); c.lineTo(6, 6); glowStroke(3);
      c.fillStyle = b.phase >= 2 ? '#ff3b5c' : '#fff'; c.beginPath(); c.arc(0, 14, 7 + Math.sin(T * 8) * 1.5, 0, TAU); c.fill();
    } else {
      // void core: rotating rings + orbit nodes
      c.strokeStyle = col;
      for (let i = 0; i < 3; i++) {
        const rr = b.r * (0.55 + i * 0.25), dir = i % 2 ? -1 : 1, segs = 3 + i;
        for (let sgm = 0; sgm < segs; sgm++) { const a = T * (1 + i * 0.4) * dir + sgm / segs * TAU; c.beginPath(); c.arc(0, 0, rr, a, a + TAU / segs * 0.6); glowStroke(2.5); }
      }
      c.fillStyle = body; c.beginPath(); c.arc(0, 0, b.r * 0.42, 0, TAU); c.fill(); glowStroke(3);
      const pulse = 10 + Math.sin(T * 5) * 3 + (b.phase - 1) * 3;
      c.globalCompositeOperation = 'lighter'; c.drawImage(glowTint(b.color), -pulse * 2.5, -pulse * 2.5, pulse * 5, pulse * 5); c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, pulse * 0.5, 0, TAU); c.fill();
      c.restore(); c.save();
      for (const n of b.nodes) {
        if (n.dead > 0 || n.x === undefined) continue;
        c.save(); c.translate(n.x, n.y); c.rotate(T * 2);
        c.fillStyle = 'rgba(20,6,40,0.9)'; c.strokeStyle = n.flash > 0 ? '#fff' : '#d48bff';
        regular(c, 6, 15, 0); c.fill(); glowStroke(2.5);
        c.fillStyle = '#d48bff'; c.globalAlpha = n.hp / n.maxHp; c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fill(); c.globalAlpha = 1;
        c.restore();
      }
    }
    c.restore();
  }
}
