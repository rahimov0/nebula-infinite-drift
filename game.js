/**
 * NEBULA: INFINITE DRIFT 2.2 - BUG FIX & STABILITY
 * Robust Controls + Responsive UI
 */

const CONFIG = {
    BASE_SPEED: 3,
    SPEED_INC: 0.1,
    PLAYER_LERP: 0.15,
    PLAYER_OFFSET_Y: 80,
    MAX_HP: 100,
    GHOST_DURATION: 1500,
    SHIELD_DURATION: 5000,
    TURBO_DURATION: 3000,
    SPAWN_INTERVAL: 1000,
    BULLET_SPEED: 12,
    FIRE_RATE: 200, // ms
    PARALLAX_LAYERS: [
        { count: 30, speedMult: 0.1, size: 1, color: '#ffffff55' },
        { count: 15, speedMult: 0.3, size: 2, color: '#00f2ff33' }
    ]
};

const ASSETS = {
    ship: new Image(),
    bg: new Image(),
    meteor1: new Image(),
    meteor2: new Image(),
    meteor3: new Image(),
    crystal: new Image(),
    shield: new Image(),
    turbo: new Image(),
    repair: new Image(),
    ammo: new Image(),
    bullet: new Image()
};

let assetsLoaded = 0;
const totalAssets = Object.keys(ASSETS).length;

function loadAssets(callback) {
    const assetKeys = Object.keys(ASSETS);
    let loadedCount = 0;
    let callbackFired = false;
    
    // Safety fallback: force start if assets take too long or events fail to fire
    const fallbackTimer = setTimeout(() => {
        if (!callbackFired) {
            callbackFired = true;
            console.warn("Asset load timeout. Forcing start...");
            callback();
        }
    }, 2500);
    
    assetKeys.forEach(key => {
        const tempImg = new Image();
        
        const checkDone = () => {
            loadedCount++;
            if (loadedCount === totalAssets && !callbackFired) {
                clearTimeout(fallbackTimer);
                callbackFired = true;
                callback();
            }
        };

        if (key === 'bg') {
            tempImg.onload = () => { ASSETS[key] = tempImg; checkDone(); };
            tempImg.onerror = () => { checkDone(); };
        } else {
            tempImg.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = tempImg.width || 80;
                canvas.height = tempImg.height || 80;
                if (tempImg.width) {
                    ctx.drawImage(tempImg, 0, 0);
                    try {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        for (let i = 0; i < data.length; i += 4) {
                            if (data[i] < 20 && data[i+1] < 20 && data[i+2] < 20) {
                                data[i+3] = 0;
                            }
                        }
                        ctx.putImageData(imageData, 0, 0);
                        const cleanImg = new Image();
                        cleanImg.onload = () => { ASSETS[key] = cleanImg; checkDone(); };
                        cleanImg.onerror = () => { ASSETS[key] = tempImg; checkDone(); };
                        cleanImg.src = canvas.toDataURL();
                        return;
                    } catch (e) { 
                        console.error('Canvas error logic skipped', e); 
                    }
                }
                ASSETS[key] = tempImg;
                checkDone();
            };
            tempImg.onerror = () => { checkDone(); };
        }
        
        tempImg.src = `assets/${key}.png`;
    });
}

const lerp = (a, b, t) => a + (b - a) * t;
const randomRange = (min, max) => Math.random() * (max - min) + min;
const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

// --- Particles ---
class Particle {
    constructor() { this.active = false; }
    reset(x, y, vx, vy, life, size, color) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life; this.size = size; this.color = color;
        this.active = true;
    }
    update() {
        if (!this.active) return;
        this.x += this.vx; this.y += this.vy;
        this.life--; if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); ctx.globalAlpha = this.life / this.maxLife; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() { this.pool = Array.from({ length: 300 }, () => new Particle()); }
    spawn(x, y, count, color = '#00f2ff') {
        let spawned = 0;
        for (let p of this.pool) {
            if (!p.active) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 5;
                p.reset(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 20 + Math.random() * 20, 2 + Math.random() * 3, color);
                spawned++; if (spawned >= count) break;
            }
        }
    }
    spawnTrail(x, y, color = '#00f2ff') {
        for (let p of this.pool) {
            if (!p.active) {
                p.reset(x, y, randomRange(-1, 1), randomRange(2, 5), 20, randomRange(1, 4), color);
                break;
            }
        }
    }
    update() { this.pool.forEach(p => p.update()); }
    draw(ctx) { this.pool.forEach(p => p.draw(ctx)); }
}

// --- Bullet ---
class Bullet {
    constructor() { this.active = false; this.radius = 8; }
    reset(x, y) { this.x = x; this.y = y; this.active = true; }
    update() {
        this.y -= CONFIG.BULLET_SPEED;
        if (this.y < -50) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = '#00f2ff';
        ctx.drawImage(ASSETS.bullet, this.x - 15, this.y - 15, 30, 30);
        ctx.restore();
    }
}

class FloatingText {
    constructor() { this.active = false; }
    reset(x, y, text, color) {
        this.x = x; this.y = y; this.text = text; this.color = color;
        this.life = 60; this.maxLife = 60; this.active = true;
    }
    update() {
        if (!this.active) return;
        this.y -= 2; this.life--;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class EnemyShip extends GameObject {
    constructor() { super(); this.radius = 35; } 
    reset(x, y) {
        super.reset(x, y);
        this.hp = 2;
        this.startX = x;
        this.lastFireTime = Date.now() + Math.random() * 1000;
    }
    update(speed) {
        if (!this.active) return;
        this.y += speed * 0.4;
        this.x = this.startX + Math.sin(this.y * 0.015) * 80;
        if (this.y > window.innerHeight + 100) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI);
        ctx.shadowBlur = 20; ctx.shadowColor = '#ff004c';
        ctx.drawImage(ASSETS.ship, -40, -40, 80, 80);
        ctx.restore();
    }
}

class EnemyBullet extends Bullet {
    update() {
        this.y += CONFIG.BULLET_SPEED * 0.6;
        if (this.y > window.innerHeight + 50) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = '#ff004c';
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI);
        ctx.drawImage(ASSETS.bullet, -15, -15, 30, 30);
        ctx.restore();
    }
}

// --- Entities ---
class GameObject {
    constructor() { this.active = false; this.x = 0; this.y = 0; this.radius = 0; }
    reset(x, y) { this.x = x; this.y = y; this.active = true; }
    update(speed) {
        if (!this.active) return;
        this.y += speed;
        if (this.y > window.innerHeight + 200) this.active = false;
    }
}

class Asteroid extends GameObject {
    constructor() { super(); this.rotation = 0; this.rotationSpeed = 0; }
    reset(x, y) {
        super.reset(x, y);
        const rand = Math.random();
        if (rand < 0.33) { this.image = ASSETS.meteor1; this.radius = 35; this.hp = 1; }
        else if (rand < 0.66) { this.image = ASSETS.meteor2; this.radius = 45; this.hp = 2; }
        else { this.image = ASSETS.meteor3; this.radius = 25; this.hp = 1; }
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = randomRange(-0.03, 0.03);
    }
    update(speed) { super.update(speed); this.rotation += this.rotationSpeed; }
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
        ctx.drawImage(this.image, -this.radius * 1.5, -this.radius * 1.5, this.radius * 3, this.radius * 3);
        ctx.restore();
    }
}

class PowerUp extends GameObject {
    constructor() { super(); this.radius = 25; }
    reset(x, y, type) { super.reset(x, y); this.type = type; }
    draw(ctx) {
        if (!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y);
        let img = ASSETS[this.type] || ASSETS.crystal;
        let glow = '#00f2ff';
        if (this.type === 'repair') glow = '#00ff88';
        if (this.type === 'shield') glow = '#ff00ea';
        if (this.type === 'turbo') glow = '#ffbd00';
        if (this.type === 'ammo') glow = '#ff5e00';
        ctx.shadowBlur = 20; ctx.shadowColor = glow;
        ctx.drawImage(img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.restore();
    }
}

class Player {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = canvas.width / 2;
        this.y = canvas.height - 250;
        this.targetX = this.x;
        this.radius = 25;
        this.hp = CONFIG.MAX_HP;
        this.ammo = 0;
        this.isGhost = false; this.isShielded = false; this.isTurbo = false;
        this.lastFireTime = 0;
        this.isFiring = false;
    }
    update(controlMode, moveState) {
        if (controlMode === 'DRAG') {
            this.x = lerp(this.x, this.targetX, CONFIG.PLAYER_LERP);
        } else {
            if (moveState.left) this.x -= 8;
            if (moveState.right) this.x += 8;
        }
        this.x = Math.max(this.radius, Math.min(this.canvas.width - this.radius, this.x));
    }
    draw(ctx) {
        ctx.save();
        if (this.isGhost) ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.02) * 0.3;
        if (this.isShielded) {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 20, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f2ff'; ctx.lineWidth = 4; ctx.stroke();
        }
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 20; ctx.shadowColor = this.isTurbo ? '#ffbd00' : '#00f2ff';
        ctx.drawImage(ASSETS.ship, -40, -40, 80, 80);
        ctx.restore();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'LOADING';
        this.controlMode = 'DRAG';
        this.moveState = { left: false, right: false };
        this.highScore = parseInt(localStorage.getItem('nebula_highscore')) || 0;
        
        this.player = null;
        this.asteroids = [];
        this.powerups = [];
        this.bullets = [];
        this.stars = [];
        this.particles = new ParticleSystem();
        this.floatingTexts = Array.from({ length: 20 }, () => new FloatingText());
        this.enemies = Array.from({ length: 5 }, () => new EnemyShip());
        this.enemyBullets = Array.from({ length: 30 }, () => new EnemyBullet());
        
        this.score = 0;
        this.gameSpeed = CONFIG.BASE_SPEED;
        this.bgY = 0;
        this.lastSpawnTime = 0;
        this.init();
        this.bindEvents();
    }

    init() {
        this.resize();
        this.createStars();
        for (let i = 0; i < 30; i++) this.asteroids.push(new Asteroid());
        for (let i = 0; i < 15; i++) this.powerups.push(new PowerUp());
        for (let i = 0; i < 20; i++) this.bullets.push(new Bullet());
        
        loadAssets(() => {
            this.state = 'MENU';
            document.getElementById('start-btn').classList.remove('hidden');
            this.updateHUD();
            this.updateControlsVisibility();
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createStars() {
        this.stars = [];
        CONFIG.PARALLAX_LAYERS.forEach(layer => {
            for (let i = 0; i < layer.count; i++) {
                this.stars.push({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height, layer: layer });
            }
        });
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        
        const handleInput = (e) => {
            if (this.state !== 'PLAYING' || this.controlMode !== 'DRAG') return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            this.player.targetX = x;
        };
        this.canvas.addEventListener('mousemove', handleInput);
        this.canvas.addEventListener('touchmove', handleInput, { passive: false });

        // HUD & Overlays
        document.getElementById('pause-btn').onclick = (e) => { e.stopPropagation(); this.togglePause(); };
        document.getElementById('resume-btn').onclick = () => this.togglePause();
        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('restart-btn').onclick = () => this.start();
        document.getElementById('quit-btn').onclick = () => this.exitToMenu();
        document.getElementById('menu-back-btn').onclick = () => this.exitToMenu();
        document.getElementById('settings-btn').onclick = () => this.showSettings(true);
        document.getElementById('close-settings').onclick = () => this.showSettings(false);
        document.getElementById('mode-drag').onclick = () => this.setControlMode('DRAG');
        document.getElementById('mode-buttons').onclick = () => this.setControlMode('BUTTONS');

        // Robust Manual Controls
        const setMove = (dir, state) => { if (this.controlMode === 'BUTTONS') this.moveState[dir] = state; };
        
        const L = document.getElementById('left-btn');
        const R = document.getElementById('right-btn');
        const F = document.getElementById('fire-btn');

        L.onmousedown = L.ontouchstart = (e) => { e.preventDefault(); setMove('left', true); };
        R.onmousedown = R.ontouchstart = (e) => { e.preventDefault(); setMove('right', true); };
        F.onmousedown = F.ontouchstart = (e) => { e.preventDefault(); if (this.player) this.player.isFiring = true; };
        
        window.onmouseup = window.ontouchend = window.ontouchcancel = () => {
            this.moveState.left = false;
            this.moveState.right = false;
            if (this.player) this.player.isFiring = false;
        };

        // Keyboard Support
        window.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') this.togglePause();
            if (this.state === 'PLAYING') {
                if (e.code === 'Space') { e.preventDefault(); if (this.player) this.player.isFiring = true; }
                if (this.controlMode === 'BUTTONS') {
                    if (e.key === 'ArrowLeft') this.moveState.left = true;
                    if (e.key === 'ArrowRight') this.moveState.right = true;
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') { if (this.player) this.player.isFiring = false; }
            if (e.key === 'ArrowLeft') this.moveState.left = false;
            if (e.key === 'ArrowRight') this.moveState.right = false;
        });
    }

    updateControlsVisibility() {
        const isPlaying = this.state === 'PLAYING';
        const isPaused = this.state === 'PAUSED';
        const showHUD = isPlaying || isPaused;
        
        document.getElementById('hud').classList.toggle('hidden', !showHUD);
        document.getElementById('mobile-controls').classList.toggle('hidden', !isPlaying || this.controlMode === 'DRAG');
        document.getElementById('action-controls').classList.toggle('hidden', !isPlaying);
    }

    setControlMode(mode) {
        this.controlMode = mode;
        document.getElementById('mode-drag').classList.toggle('active', mode === 'DRAG');
        document.getElementById('mode-buttons').classList.toggle('active', mode === 'BUTTONS');
        this.updateControlsVisibility();
    }

    showSettings(show) {
        document.getElementById('settings-overlay').classList.toggle('active', show);
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('pause-overlay').classList.add('active');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.getElementById('pause-overlay').classList.remove('active');
        }
        this.updateControlsVisibility();
    }

    exitToMenu() {
        this.state = 'MENU';
        document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
        document.getElementById('menu-overlay').classList.add('active');
        this.updateHUD();
        this.updateControlsVisibility();
    }

    start() {
        this.player = new Player(this.canvas);
        this.score = 0; this.gameSpeed = CONFIG.BASE_SPEED; this.startTime = Date.now();
        this.lastSpawnTime = Date.now();
        this.asteroids.forEach(a => a.active = false);
        this.powerups.forEach(p => p.active = false);
        this.bullets.forEach(b => b.active = false);
        this.enemies.forEach(e => e.active = false);
        this.enemyBullets.forEach(eb => eb.active = false);
        this.floatingTexts.forEach(ft => ft.active = false);
        this.state = 'PLAYING';
        document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
        this.updateHUD();
        this.updateControlsVisibility();
        if (!this.loopStarted) { this.loopStarted = true; this.gameLoop(); }
    }

    gameOver() {
        this.state = 'GAMEOVER';
        if (this.score > this.highScore) {
            this.highScore = Math.floor(this.score);
            localStorage.setItem('nebula_highscore', this.highScore);
        }
        document.getElementById('game-over-overlay').classList.add('active');
        document.getElementById('final-score').innerText = Math.floor(this.score);
        this.particles.spawn(this.player.x, this.player.y, 50, '#ff004c');
        this.updateControlsVisibility();
    }

    spawnText(x, y, text, color) {
        const t = this.floatingTexts.find(tf => !tf.active);
        if (t) t.reset(x, y, text, color);
    }

    spawnEntities() {
        const now = Date.now();
        let interval = CONFIG.SPAWN_INTERVAL / (this.gameSpeed / CONFIG.BASE_SPEED);
        if (now - this.lastSpawnTime > interval) {
            this.lastSpawnTime = now;
            const rand = Math.random();
            if (this.score > 5000 && rand < 0.15) {
                const e = this.enemies.find(en => !en.active);
                if (e) e.reset(Math.random() * (this.canvas.width - 200) + 100, -100);
            } else if (rand < 0.35) {
                const pool = this.powerups.find(p => !p.active);
                if (pool) {
                    const types = ['crystal', 'crystal', 'repair', 'shield', 'turbo', 'ammo'];
                    pool.reset(Math.random() * this.canvas.width, -100, types[Math.floor(Math.random() * types.length)]);
                }
            } else {
                const pool = this.asteroids.find(a => !a.active);
                if (pool) pool.reset(Math.random() * this.canvas.width, -100);
            }
        }
    }

    shoot() {
        if (this.player.isFiring && this.player.ammo > 0 && Date.now() - this.player.lastFireTime > CONFIG.FIRE_RATE) {
            const b = this.bullets.find(b => !b.active);
            if (b) {
                b.reset(this.player.x, this.player.y - 40);
                this.player.ammo--;
                this.player.lastFireTime = Date.now();
                this.updateHUD();
            }
        }
    }

    checkCollisions() {
        const p = this.player;
        this.asteroids.forEach(a => {
            if (!a.active) return;
            this.bullets.forEach(b => {
                if (b.active && distance(b.x, b.y, a.x, a.y) < b.radius + a.radius) {
                    a.hp--; b.active = false;
                    this.particles.spawn(b.x, b.y, 5, '#00f2ff');
                    if (a.hp <= 0) {
                        a.active = false; this.score += 50;
                        this.particles.spawn(a.x, a.y, 15, '#fff');
                    }
                }
            });
            if (distance(p.x, p.y, a.x, a.y) < p.radius + a.radius) {
                if (!p.isGhost && !p.isShielded && !p.isTurbo) {
                    this.player.hp -= 25; this.particles.spawn(a.x, a.y, 20, '#ffbd00');
                    if (this.player.hp <= 0) this.gameOver();
                    else { p.isGhost = true; setTimeout(() => p.isGhost = false, 1500); }
                } else { this.particles.spawn(a.x, a.y, 10, '#00f2ff'); }
                a.active = false; this.updateHUD();
            }
        });

        this.enemies.forEach(e => {
            if (!e.active) return;
            this.bullets.forEach(b => {
                if (b.active && distance(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
                    e.hp--; b.active = false;
                    this.particles.spawn(b.x, b.y, 10, '#ff004c');
                    if (e.hp <= 0) {
                        e.active = false; this.score += 500;
                        this.particles.spawn(e.x, e.y, 30, '#ff004c');
                        this.spawnText(e.x, e.y, "+500", "#ff004c");
                    }
                }
            });
            if (distance(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
                e.active = false;
                this.particles.spawn(e.x, e.y, 30, '#ff004c');
                if (!p.isGhost && !p.isShielded && !p.isTurbo) {
                    this.player.hp -= 40; this.particles.spawn(p.x, p.y, 30, '#ff004c');
                    this.spawnText(p.x, p.y, "-40 HP", "#ff004c");
                    if (this.player.hp <= 0) this.gameOver();
                    else { p.isGhost = true; setTimeout(() => p.isGhost = false, 1500); }
                } else { this.particles.spawn(p.x, p.y, 10, '#00f2ff'); }
                this.updateHUD();
            }
        });

        this.enemyBullets.forEach(eb => {
            if (eb.active && distance(p.x, p.y, eb.x, eb.y) < p.radius + eb.radius) {
                eb.active = false;
                if (!p.isGhost && !p.isShielded && !p.isTurbo) {
                    this.player.hp -= 15; this.particles.spawn(p.x, p.y, 20, '#ff004c');
                    this.spawnText(p.x, p.y, "-15 HP", "#ff004c");
                    if (this.player.hp <= 0) this.gameOver();
                    else { p.isGhost = true; setTimeout(() => p.isGhost = false, 1500); }
                } else { this.particles.spawn(p.x, p.y, 10, '#00f2ff'); }
                this.updateHUD();
            }
        });

        this.powerups.forEach(pu => {
            if (pu.active && distance(p.x, p.y, pu.x, pu.y) < p.radius + pu.radius) {
                if (pu.type === 'crystal') { this.score += 100; this.spawnText(pu.x, pu.y, "+100 Puan", '#00f2ff'); }
                else if (pu.type === 'repair') { p.hp = Math.min(CONFIG.MAX_HP, p.hp + 50); this.spawnText(pu.x, pu.y, "+50 Can", '#00ff88'); }
                else if (pu.type === 'ammo') { p.ammo += 20; this.spawnText(pu.x, pu.y, "+20 Mermi", '#ff5e00'); }
                else if (pu.type === 'shield') { p.isShielded = true; setTimeout(() => p.isShielded = false, 5000); this.spawnText(pu.x, pu.y, "Kalkan!", '#ff00ea'); }
                else if (pu.type === 'turbo') { p.isTurbo = true; setTimeout(() => p.isTurbo = false, 3000); this.spawnText(pu.x, pu.y, "Hız!", '#ffbd00'); }
                pu.active = false; this.particles.spawn(pu.x, pu.y, 15, '#fff'); this.updateHUD();
            }
        });
    }

    updateHUD() {
        document.getElementById('score-value').innerText = Math.floor(this.score).toString().padStart(5, '0');
        document.getElementById('best-score-game').innerText = this.highScore.toString().padStart(5, '0');
        document.getElementById('best-score-menu').innerText = this.highScore.toString().padStart(5, '0');
        document.getElementById('ammo-count').innerText = this.player ? this.player.ammo : 0;
        if (this.player) {
            document.getElementById('health-bar-fill').style.width = this.player.hp + '%';
            document.getElementById('hp-text').innerText = this.player.hp + ' HP';
        }
    }

    gameLoop() {
        if (this.state === 'PAUSED') { requestAnimationFrame(() => this.gameLoop()); return; }
        if (this.state === 'LOADING') return;

        this.ctx.fillStyle = '#05050a'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.state === 'PLAYING') {
            this.gameSpeed = CONFIG.BASE_SPEED + (this.score * 0.0003);
        }

        const speed = (this.player?.isTurbo ? this.gameSpeed * 3 : this.gameSpeed);
        this.bgY += speed * 0.1; if (this.bgY >= this.canvas.height) this.bgY = 0;
        this.ctx.globalAlpha = 0.5;
        this.ctx.drawImage(ASSETS.bg, 0, this.bgY, this.canvas.width, this.canvas.height);
        this.ctx.save(); this.ctx.translate(0, this.bgY - this.canvas.height); this.ctx.scale(1, -1);
        this.ctx.drawImage(ASSETS.bg, 0, -this.canvas.height, this.canvas.width, this.canvas.height);
        this.ctx.restore(); this.ctx.globalAlpha = 1.0;

        this.stars.forEach(s => {
            s.y += speed * s.layer.speedMult; if (s.y > this.canvas.height) s.y = -20;
            this.ctx.fillStyle = s.layer.color; this.ctx.fillRect(s.x, s.y, s.layer.size, s.layer.size);
        });

        if (this.state === 'PLAYING') {
            this.score += speed * 0.1; this.updateHUD();
            this.player.update(this.controlMode, this.moveState);
            this.spawnEntities();
            this.shoot();
            this.asteroids.forEach(a => a.update(speed));
            this.powerups.forEach(p => p.update(speed));
            this.bullets.forEach(b => { if (b.active) b.update(); });
            
            this.enemies.forEach(e => {
                e.update(speed);
                if (e.active && Date.now() - e.lastFireTime > 1500) {
                    const b = this.enemyBullets.find(eb => !eb.active);
                    if (b) { b.reset(e.x, e.y + 40); e.lastFireTime = Date.now(); }
                }
            });
            this.enemyBullets.forEach(b => { if (b.active) b.update(); });
            this.floatingTexts.forEach(t => t.update());
            
            this.particles.update();
            this.particles.spawnTrail(this.player.x, this.player.y + 30, this.player.isTurbo ? '#ffbd00' : '#00f2ff');
            this.checkCollisions();
        }

        this.asteroids.forEach(a => a.draw(this.ctx));
        this.powerups.forEach(p => p.draw(this.ctx));
        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.enemyBullets.forEach(b => b.draw(this.ctx));
        this.particles.draw(this.ctx);
        this.floatingTexts.forEach(t => t.draw(this.ctx));
        if (this.player) this.player.draw(this.ctx);

        requestAnimationFrame(() => this.gameLoop());
    }
}

window.onload = () => new GameEngine();
