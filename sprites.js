/* NEBULA 3.0 — asset loading + pre-rendered neon sprites (glow baked once, cheap to draw) */
'use strict';

const IMG = {};
const SPR = {};
const SPR_SCALE = 2; // sprites rendered at 2x logical size for crispness

function loadImages(done) {
  const names = ['ship', 'meteor1', 'meteor2', 'meteor3', 'crystal', 'shield', 'turbo', 'repair', 'ammo', 'bullet'];
  let left = names.length + 1, fired = false;
  const finish = () => { if (!fired && --left <= 0) { fired = true; done(); } };
  const fallback = setTimeout(() => { if (!fired) { fired = true; done(); } }, 6000);
  names.forEach(n => {
    const im = new Image();
    im.onload = finish; im.onerror = finish;
    im.src = 'assets/' + n + '.png'; IMG[n] = im;
  });
  const bg = new Image(); bg.onload = finish; bg.onerror = finish; bg.src = 'assets/bg.jpg'; IMG.bg = bg;
  IMG._fallback = fallback;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  return c;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Create glowy sprite: size in logical px, draw(ctx, r) with origin at center, unit = logical px */
function neonSprite(size, color, draw) {
  const S = SPR_SCALE, pad = 14;
  const c = makeCanvas((size + pad * 2) * S, (size + pad * 2) * S);
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2); x.scale(S, S);
  x.lineJoin = 'round'; x.lineCap = 'round';
  x.shadowColor = color; x.shadowBlur = 12;
  draw(x, size / 2, color);
  return { c, w: size + pad * 2, h: size + pad * 2 };
}

/** Pure white silhouette of a sprite (used for hit flash) */
function whiteOf(sp) {
  const c = makeCanvas(sp.c.width, sp.c.height), x = c.getContext('2d');
  x.drawImage(sp.c, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  return { c, w: sp.w, h: sp.h };
}

function poly(x, pts) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); }
function regular(x, n, r, rot = 0) { const pts = []; for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } poly(x, pts); }
function bodyFill(x, r, color) {
  const g = x.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, hexA(color, 0.55)); g.addColorStop(0.6, 'rgba(20,10,40,0.92)'); g.addColorStop(1, 'rgba(8,4,20,0.95)');
  return g;
}

function buildSprites() {
  /* --- tinted player ships --- */
  SHIPS.forEach(s => {
    const size = 64, S = SPR_SCALE, pad = 16;
    const c = makeCanvas((size + pad * 2) * S, (size + pad * 2) * S), x = c.getContext('2d');
    // tint layer
    const tmp = makeCanvas(size * S, size * S), tx = tmp.getContext('2d');
    if (IMG.ship && IMG.ship.naturalWidth) tx.drawImage(IMG.ship, 0, 0, tmp.width, tmp.height);
    else { tx.fillStyle = '#ccd'; tx.translate(tmp.width / 2, tmp.height / 2); tx.scale(S, S); poly(tx, [[0, -30], [24, 24], [0, 12], [-24, 24]]); tx.fill(); }
    if (s.id !== 'interceptor') {
      tx.globalCompositeOperation = 'source-atop'; tx.globalAlpha = 0.45; tx.fillStyle = s.color; tx.fillRect(0, 0, tmp.width, tmp.height);
    }
    x.shadowColor = s.color; x.shadowBlur = 18 * S;
    x.drawImage(tmp, pad * S, pad * S);
    SPR['ship_' + s.id] = { c, w: size + pad * 2, h: size + pad * 2 };
  });

  /* --- enemies --- */
  const E = {};
  E.drone = neonSprite(36, ENEMY.drone.color, (x, r, col) => {
    x.fillStyle = bodyFill(x, r, col); x.strokeStyle = col; x.lineWidth = 2.5;
    poly(x, [[-r, -4], [-r * 0.45, -r * 0.55], [r * 0.45, -r * 0.55], [r, -4], [r * 0.55, r * 0.5], [0, r * 0.85], [-r * 0.55, r * 0.5]]);
    x.fill(); x.stroke();
    x.shadowBlur = 8; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 2, 4, 0, 7); x.fill();
    x.strokeStyle = hexA(col, 0.9); x.lineWidth = 1.5; x.beginPath(); x.moveTo(-r * 0.7, -2); x.lineTo(-7, 2); x.moveTo(r * 0.7, -2); x.lineTo(7, 2); x.stroke();
  });
  E.dart = neonSprite(30, ENEMY.dart.color, (x, r, col) => {
    x.fillStyle = bodyFill(x, r, col); x.strokeStyle = col; x.lineWidth = 2.5;
    poly(x, [[0, r * 1.05], [r * 0.85, -r * 0.8], [0, -r * 0.35], [-r * 0.85, -r * 0.8]]); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, r * 0.2, 2.6, 0, 7); x.fill();
  });
  E.gunner = neonSprite(46, ENEMY.gunner.color, (x, r, col) => {
    x.fillStyle = bodyFill(x, r, col); x.strokeStyle = col; x.lineWidth = 3;
    regular(x, 6, r * 0.82, Math.PI / 6); x.fill(); x.stroke();
    x.lineWidth = 4; x.beginPath();
    [-0.5, 0, 0.5].forEach(a => { x.moveTo(Math.sin(a) * r * 0.5, Math.cos(a) * r * 0.5); x.lineTo(Math.sin(a) * r * 1.05, Math.cos(a) * r * 1.05); });
    x.stroke();
    x.lineWidth = 2; regular(x, 6, r * 0.42, Math.PI / 6); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 4, 0, 7); x.fill();
  });
  E.sniper = neonSprite(38, ENEMY.sniper.color, (x, r, col) => {
    x.fillStyle = bodyFill(x, r, col); x.strokeStyle = col; x.lineWidth = 2.5;
    poly(x, [[0, r * 1.1], [r * 0.45, 0], [0, -r * 0.9], [-r * 0.45, 0]]); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-r, -r * 0.3); x.lineTo(-r * 0.4, 0); x.moveTo(r, -r * 0.3); x.lineTo(r * 0.4, 0); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, r * 0.15, 3.5, 0, 7); x.fill();
  });
  E.splitter = neonSprite(46, ENEMY.splitter.color, (x, r, col) => {
    x.fillStyle = bodyFill(x, r, col); x.strokeStyle = col; x.lineWidth = 2.5;
    [[-r * 0.38, 0], [r * 0.38, 0]].forEach(([cx, cy]) => { x.beginPath(); x.arc(cx, cy, r * 0.55, 0, 7); x.fill(); x.stroke(); });
    x.fillStyle = '#fff'; [[-r * 0.38, 0], [r * 0.38, 0]].forEach(([cx]) => { x.beginPath(); x.arc(cx, 0, 3, 0, 7); x.fill(); });
  });
  E.mini = neonSprite(22, ENEMY.mini.color, (x, r, col) => {
    x.fillStyle = bodyFill(x, r, col); x.strokeStyle = col; x.lineWidth = 2;
    regular(x, 4, r * 0.9, 0); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 2, 0, 7); x.fill();
  });
  E.mine = neonSprite(34, ENEMY.mine.color, (x, r, col) => {
    x.fillStyle = bodyFill(x, r, col); x.strokeStyle = col; x.lineWidth = 2.5;
    const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * 0.62 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    poly(x, pts); x.fill(); x.stroke();
    x.fillStyle = col; x.beginPath(); x.arc(0, 0, r * 0.3, 0, 7); x.fill();
  });
  E.tank = neonSprite(62, ENEMY.tank.color, (x, r, col) => {
    x.fillStyle = bodyFill(x, r, col); x.strokeStyle = col; x.lineWidth = 3.5;
    regular(x, 8, r * 0.95, Math.PI / 8); x.fill(); x.stroke();
    x.lineWidth = 2; regular(x, 8, r * 0.62, Math.PI / 8); x.stroke();
    x.lineWidth = 5; x.beginPath(); x.moveTo(0, r * 0.5); x.lineTo(0, r * 1.15); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 6, 0, 7); x.fill();
  });
  for (const k in E) { SPR['e_' + k] = E[k]; SPR['ew_' + k] = whiteOf(E[k]); }

  /* --- bullets --- */
  const capsule = (col, w, h) => {
    const S = SPR_SCALE, pad = 8, c = makeCanvas((w + pad * 2) * S, (h + pad * 2) * S), x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.scale(S, S); x.shadowColor = col; x.shadowBlur = 10;
    x.fillStyle = col; x.beginPath(); x.ellipse(0, 0, w / 2, h / 2, 0, 0, 7); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, w / 4, h / 2.6, 0, 0, 7); x.fill();
    return { c, w: w + pad * 2, h: h + pad * 2 };
  };
  SPR.pBullet = capsule('#00f2ff', 6, 20);
  SHIPS.forEach(s => { SPR['pb_' + s.id] = capsule(s.color, 6, 20); });
  SPR.missile = capsule('#ffd34d', 7, 16);
  const orb = (col, r) => {
    const S = SPR_SCALE, pad = 8, c = makeCanvas((r * 2 + pad * 2) * S, (r * 2 + pad * 2) * S), x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.scale(S, S); x.shadowColor = col; x.shadowBlur = 10;
    x.fillStyle = col; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, r * 0.55, 0, 7); x.fill();
    return { c, w: r * 2 + pad * 2, h: r * 2 + pad * 2 };
  };
  SPR.eb_red = orb('#ff2a5f', 6); SPR.eb_orange = orb('#ff9d1a', 6); SPR.eb_purple = orb('#c35bff', 6);
  SPR.eb_big = orb('#ff2bd6', 10); SPR.eb_yellow = orb('#ffe11f', 5); SPR.eb_reflect = orb('#00f2ff', 6);

  /* --- glow dot (white; tinted at draw using additive alpha) --- */
  const gd = makeCanvas(64, 64), gx = gd.getContext('2d');
  const gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64); SPR.glow = gd;

  /* --- magnet pickup --- */
  SPR.magnet = neonSprite(34, '#ff4d6d', (x, r) => {
    x.lineWidth = 7; x.strokeStyle = '#ff4d6d';
    x.beginPath(); x.arc(0, -2, r * 0.6, Math.PI, 0); x.lineTo(r * 0.6, r * 0.6); x.moveTo(-r * 0.6, -2); x.lineTo(-r * 0.6, r * 0.6); x.stroke();
    x.strokeStyle = '#fff'; x.lineWidth = 7; x.shadowBlur = 0;
    x.beginPath(); x.moveTo(r * 0.6, r * 0.35); x.lineTo(r * 0.6, r * 0.65); x.moveTo(-r * 0.6, r * 0.35); x.lineTo(-r * 0.6, r * 0.65); x.stroke();
  });
}

/** Cached colored glow sprites for particles (cheap additive blending) */
const _tintCache = new Map();
function glowTint(color) {
  let c = _tintCache.get(color);
  if (c) return c;
  c = makeCanvas(64, 64); const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.2, color); g.addColorStop(1, hexA(color, 0));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _tintCache.set(color, c); return c;
}

function drawSprite(ctx, sp, x, y, rot, scale = 1, alpha = 1) {
  if (!sp) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.drawImage(sp.c, -sp.w * scale / 2, -sp.h * scale / 2, sp.w * scale, sp.h * scale);
  ctx.restore();
}
