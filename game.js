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
    PARALLAX_LAYERS: [
        { count: 30, speedMult: 0.1, size: 1, color: '#ffffff55' },
        { count: 15, speedMult: 0.3, size: 2, color: '#00f2ff33' }
    ]
};

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.bgmOsc = null;
        this.bgmGain = null;
        this.thrusterNode = null;
        this.thrusterGain = null;
        this.thrusterFilter = null;
    }
    
    init() {
        if (!this.ctx && window.AudioContext) {
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, vol=0.1, slideFreq=null) {
        if (!this.enabled || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (slideFreq) {
                osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
            }
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    }
    
    playShoot() { this.playTone(800, 'square', 0.1, 0.03, 300); }
    playExplosion() { this.playTone(100, 'sawtooth', 0.4, 0.1, 10); }
    playPowerup() {
        if(!this.enabled || !this.ctx) return;
        this.playTone(400, 'sine', 0.1, 0.05);
        setTimeout(() => this.playTone(600, 'sine', 0.1, 0.05), 100);
        setTimeout(() => this.playTone(800, 'sine', 0.2, 0.05), 200);
    }
    playDamage() { this.playTone(150, 'sawtooth', 0.2, 0.15, 50); }
    playUI() { this.playTone(600, 'sine', 0.05, 0.05); }

    startBGM() {
        if (!this.enabled || !this.ctx) return;
        if (this.bgmOsc) return;
        try {
            this.bgmOsc = this.ctx.createOscillator();
            this.bgmGain = this.ctx.createGain();
            this.bgmOsc.type = 'sine';
            this.bgmOsc.frequency.setValueAtTime(60, this.ctx.currentTime);
            this.bgmGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            this.bgmOsc.connect(this.bgmGain);
            this.bgmGain.connect(this.ctx.destination);
            this.bgmOsc.start();
        } catch(e) {}
    }

    startThruster() {
        if (!this.enabled || !this.ctx) return;
        if (this.thrusterNode) return;
        try {
            const bufferSize = this.ctx.sampleRate * 2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            
            this.thrusterNode = this.ctx.createBufferSource();
            this.thrusterNode.buffer = buffer;
            this.thrusterNode.loop = true;
            
            this.thrusterFilter = this.ctx.createBiquadFilter();
            this.thrusterFilter.type = 'lowpass';
            this.thrusterFilter.frequency.value = 400; 
            
            this.thrusterGain = this.ctx.createGain();
            this.thrusterGain.gain.value = 0.01; 
            
            this.thrusterNode.connect(this.thrusterFilter);
            this.thrusterFilter.connect(this.thrusterGain);
            this.thrusterGain.connect(this.ctx.destination);
            this.thrusterNode.start();
        } catch(e) {}
    }
    
    updateThruster(isMoving) {
        if (!this.enabled || !this.thrusterGain || !this.ctx) return;
        const targetVol = isMoving ? 0.06 : 0.01;
        this.thrusterGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
    }

    stopBGM() {
        if (this.bgmOsc) {
            try { this.bgmOsc.stop(); this.bgmOsc.disconnect(); } catch(e) {}
            this.bgmOsc = null;
        }
        if (this.thrusterNode) {
            try { this.thrusterNode.stop(); this.thrusterNode.disconnect(); } catch(e) {}
            this.thrusterNode = null;
        }
    }
}
const audio = new AudioEngine();

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

// --- Shooting Stars ---
class ShootingStar {
    constructor() { this.active = false; }
    reset() {
        this.x = Math.random() * window.innerWidth * 1.5;
        this.y = -50;
        this.speedX = -10 - Math.random() * 20;
        this.speedY = 15 + Math.random() * 25;
        this.color = Math.random() > 0.5 ? '#ffffff' : '#00f2ff';
        this.active = true;
    }
    update() {
        if (!this.active) return;
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.y > window.innerHeight + 100 || this.x < -100) this.active = false;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.speedX * 3, this.y - this.speedY * 3);
        ctx.stroke();
        ctx.restore();
    }
}

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
        if (rand < 0.33) { this.image = ASSETS.meteor1; this.radius = 20; this.hp = 1; }
        else if (rand < 0.66) { this.image = ASSETS.meteor2; this.radius = 28; this.hp = 2; }
        else { this.image = ASSETS.meteor3; this.radius = 15; this.hp = 1; }
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
    constructor() { super(); this.radius = 18; }
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

class EnemyShip extends GameObject {
    constructor() { super(); this.radius = 25; this.fightDuration = 3500; } 
    reset(x, y) {
        super.reset(x, y);
        this.hp = 2;
        this.startX = x;
        this.lastFireTime = Date.now() + Math.random() * 1000;
        this.spawnTime = Date.now();
        this.phase = 'entering';
        this.targetY = 100 + Math.random() * 80;
    }
    update(speed) {
        if (!this.active) return;
        const now = Date.now();
        
        if (this.phase === 'entering') {
            this.y += speed * 0.4;
            this.x = this.startX + Math.sin((now - this.spawnTime) * 0.001) * 80;
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                this.phase = 'fighting';
                this.fightStartTime = now;
            }
        } else if (this.phase === 'fighting') {
            this.x = this.startX + Math.sin((now - this.fightStartTime) * 0.001) * 80;
            if (now - this.fightStartTime > this.fightDuration) {
                this.phase = 'leaving';
                this.fightStartTime = now;
            }
        } else if (this.phase === 'leaving') {
            this.y -= speed * 0.4;
            this.x = this.startX + Math.sin((now - this.fightStartTime) * 0.001) * 80;
            if (this.y < -150) this.active = false;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI);
        ctx.shadowBlur = 20; ctx.shadowColor = '#ff004c';
        ctx.drawImage(ASSETS.ship, -25, -25, 50, 50);
        ctx.restore();
    }
}

class SpaceShuttle extends EnemyShip {
    constructor() { super(); this.radius = 30; this.fightDuration = 5000; }
    reset(x, y) {
        super.reset(x, y);
        this.hp = 10;
        this.targetY = 70 + Math.random() * 50;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.PI);
        ctx.shadowBlur = 30; ctx.shadowColor = '#ff5e00'; // Orange glow
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

class Player {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = canvas.width / 2;
        this.y = canvas.height - 250;
        this.targetX = this.x;
        this.radius = 12;
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
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 15, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f2ff'; ctx.lineWidth = 4; ctx.stroke();
        }
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 20; ctx.shadowColor = this.isTurbo ? '#ffbd00' : '#00f2ff';
        ctx.drawImage(ASSETS.ship, -20, -20, 40, 40);
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
        this.bossEnemies = Array.from({ length: 2 }, () => new SpaceShuttle());
        this.enemyBullets = Array.from({ length: 40 }, () => new EnemyBullet());
        
        this.score = 0;
        this.gameSpeed = CONFIG.BASE_SPEED;
        this.bgY = 0;
        this.lastSpawnTime = 0;
        this.shakeIntensity = 0;
        this.newRecordReached = false;
        this.shootingStars = Array.from({ length: 5 }, () => new ShootingStar());
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
            const menuImg = document.getElementById('menu-ship-img');
            if (menuImg && ASSETS.ship.src) menuImg.src = ASSETS.ship.src;
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
        
        this.dragTouchId = null;

        this.canvas.addEventListener('touchstart', (e) => {
            if (this.state !== 'PLAYING' || this.controlMode !== 'DRAG') return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (this.dragTouchId === null) {
                    this.dragTouchId = e.changedTouches[i].identifier;
                    const rect = this.canvas.getBoundingClientRect();
                    this.player.targetX = e.changedTouches[i].clientX - rect.left;
                    break;
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (this.state !== 'PLAYING' || this.controlMode !== 'DRAG') return;
            e.preventDefault(); // Stop scrolling while dragging
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.dragTouchId) {
                    const rect = this.canvas.getBoundingClientRect();
                    this.player.targetX = e.changedTouches[i].clientX - rect.left;
                    break;
                }
            }
        }, { passive: false });

        const releaseDrag = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.dragTouchId) {
                    this.dragTouchId = null;
                }
            }
        };
        this.canvas.addEventListener('touchend', releaseDrag, { passive: false });
        this.canvas.addEventListener('touchcancel', releaseDrag, { passive: false });

        // Desktop mouse fallback for drag
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state === 'PLAYING' && this.controlMode === 'DRAG') {
                const rect = this.canvas.getBoundingClientRect();
                this.player.targetX = e.clientX - rect.left;
            }
        });

        // HUD & Overlays
        document.getElementById('pause-btn').onclick = (e) => { e.stopPropagation(); this.togglePause(); };
        document.getElementById('resume-btn').onclick = () => this.togglePause();
        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('restart-btn').onclick = () => this.start();
        document.getElementById('quit-btn').onclick = () => this.exitToMenu();
        document.getElementById('menu-back-btn').onclick = () => this.exitToMenu();
        document.getElementById('settings-btn').onclick = () => this.showSettings(true);
        document.getElementById('pause-settings-btn').onclick = (e) => { e.stopPropagation(); this.showSettings(true); audio.playUI(); };
        document.getElementById('close-settings').onclick = () => this.showSettings(false);
        document.getElementById('sound-on').onclick = () => { this.setSound(true); audio.playUI(); };
        document.getElementById('sound-off').onclick = () => { this.setSound(false); audio.playUI(); };
        document.getElementById('mode-drag').onclick = () => this.setControlMode('DRAG');
        document.getElementById('mode-buttons').onclick = () => this.setControlMode('BUTTONS');

        // Robust Manual Controls
        const L = document.getElementById('left-btn');
        const R = document.getElementById('right-btn');
        const F = document.getElementById('fire-btn');

        const checkTouches = (e) => {
            let l = false, r = false, f = false;
            for(let i=0; i<e.touches.length; i++) {
                const t = e.touches[i];
                const el = document.elementFromPoint(t.clientX, t.clientY);
                if (el === L || L.contains(el)) l = true;
                if (el === R || R.contains(el)) r = true;
                if (el === F || document.getElementById('fire-btn-container').contains(el)) f = true;
            }
            this.moveState.left = l; this.moveState.right = r;
            if (this.player) {
                if (this.controlMode === 'BUTTONS') {
                    this.player.isFiring = (l && r);
                } else {
                    this.player.isFiring = f;
                }
            }
        };

        const attachTouch = (btn) => {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); checkTouches(e); }, {passive: false});
            btn.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); checkTouches(e); }, {passive: false});
            btn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); checkTouches(e); }, {passive: false});
            btn.addEventListener('touchcancel', (e) => { e.preventDefault(); e.stopPropagation(); checkTouches(e); }, {passive: false});
        };
        attachTouch(L); attachTouch(R); attachTouch(F);

        // Desktop Button Mousedown Fallback
        L.onmousedown = (e) => { e.preventDefault(); this.moveState.left = true; if(this.controlMode==='BUTTONS' && this.moveState.right && this.player) this.player.isFiring=true; };
        L.onmouseup = L.onmouseleave = (e) => { this.moveState.left = false; if(this.controlMode==='BUTTONS' && this.player) this.player.isFiring=false; };
        
        R.onmousedown = (e) => { e.preventDefault(); this.moveState.right = true; if(this.controlMode==='BUTTONS' && this.moveState.left && this.player) this.player.isFiring=true; };
        R.onmouseup = R.onmouseleave = (e) => { this.moveState.right = false; if(this.controlMode==='BUTTONS' && this.player) this.player.isFiring=false; };
        
        F.onmousedown = (e) => { e.preventDefault(); if (this.controlMode !== 'BUTTONS' && this.player) this.player.isFiring = true; };
        F.onmouseup = F.onmouseleave = (e) => { if (this.controlMode !== 'BUTTONS' && this.player) this.player.isFiring = false; };

        window.addEventListener('mouseup', () => {
            this.moveState.left = false; this.moveState.right = false;
            if (this.player) this.player.isFiring = false;
        });

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
        document.getElementById('action-controls').classList.toggle('hidden', !isPlaying || this.controlMode === 'BUTTONS');
    }

    setControlMode(mode) {
        this.controlMode = mode;
        document.getElementById('mode-drag').classList.toggle('active', mode === 'DRAG');
        document.getElementById('mode-buttons').classList.toggle('active', mode === 'BUTTONS');
        this.updateControlsVisibility();
    }

    setSound(enabled) {
        audio.enabled = enabled;
        document.getElementById('sound-on').classList.toggle('active', enabled);
        document.getElementById('sound-off').classList.toggle('active', !enabled);
        if (enabled) {
            audio.init();
            if (this.state === 'PLAYING') audio.startBGM();
        } else {
            audio.stopBGM();
        }
    }

    showSettings(show) {
        if (show) {
            document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
            document.getElementById('settings-overlay').classList.add('active');
        } else {
            document.getElementById('settings-overlay').classList.remove('active');
            if (this.state === 'PAUSED') {
                document.getElementById('pause-overlay').classList.add('active');
            } else if (this.state === 'MENU') {
                document.getElementById('menu-overlay').classList.add('active');
            }
        }
        audio.playUI();
    }

    togglePause() {
        audio.playUI();
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
            document.getElementById('pause-overlay').classList.add('active');
            audio.stopBGM();
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
            audio.startBGM();
        }
        this.updateControlsVisibility();
    }

    exitToMenu() {
        audio.playUI();
        audio.stopBGM();
        this.state = 'MENU';
        document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
        document.getElementById('menu-overlay').classList.add('active');
        this.updateHUD();
        this.updateControlsVisibility();
    }

    start() {
        audio.init();
        audio.playUI();
        audio.startBGM();
        audio.startThruster();
        this.player = new Player(this.canvas);
        this.score = 0; this.gameSpeed = CONFIG.BASE_SPEED; this.startTime = Date.now();
        this.lastSpawnTime = Date.now();
        this.shakeIntensity = 0;
        this.newRecordReached = false;
        this.asteroids.forEach(a => a.active = false);
        this.powerups.forEach(p => p.active = false);
        this.bullets.forEach(b => b.active = false);
        this.enemies.forEach(e => e.active = false);
        this.bossEnemies.forEach(e => e.active = false);
        this.enemyBullets.forEach(eb => eb.active = false);
        this.floatingTexts.forEach(ft => ft.active = false);
        this.state = 'PLAYING';
        document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
        this.updateHUD();
        this.updateControlsVisibility();
        if (!this.loopStarted) { this.loopStarted = true; this.gameLoop(); }
    }

    gameOver() {
        audio.stopBGM();
        audio.playExplosion();
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

    addShake(val) {
        this.shakeIntensity = Math.min(this.shakeIntensity + val, 30);
    }

    spawnText(x, y, text, color) {
        const t = this.floatingTexts.find(tf => !tf.active);
        if (t) t.reset(x, y, text, color);
    }

    spawnEntities() {
        const now = Date.now();
        let activeBosses = this.bossEnemies.filter(e => e.active).length;
        let activeEnemies = this.enemies.filter(e => e.active).length;

        let interval = CONFIG.SPAWN_INTERVAL / (this.gameSpeed / CONFIG.BASE_SPEED);
        if (now - this.lastSpawnTime > interval) {
            this.lastSpawnTime = now;
            const rand = Math.random();
            if (this.score > 5000 && rand < 0.05 && activeBosses < 1) {
                const b = this.bossEnemies.find(en => !en.active);
                if (b) b.reset(Math.random() * (this.canvas.width - 200) + 100, -100);
            } else if (this.score > 1000 && rand < 0.20 && activeEnemies < 2 && activeBosses === 0) {
                const e = this.enemies.find(en => !en.active);
                if (e) e.reset(Math.random() * (this.canvas.width - 200) + 100, -100);
            } else if (rand < 0.40) {
                const pool = this.powerups.find(p => !p.active);
                if (pool) {
                    const types = ['crystal', 'repair', 'shield', 'turbo', 'ammo', 'ammo', 'ammo'];
                    pool.reset(Math.random() * this.canvas.width, -100, types[Math.floor(Math.random() * types.length)]);
                }
            } else {
                const pool = this.asteroids.find(a => !a.active);
                if (pool) pool.reset(Math.random() * this.canvas.width, -100);
            }
        }
    }

    shoot() {
        if (this.player.isFiring && Date.now() - this.player.lastFireTime > CONFIG.FIRE_RATE) {
            const b = this.bullets.find(b => !b.active);
            if (b) {
                b.reset(this.player.x, this.player.y - 40);
                this.player.lastFireTime = Date.now();
                audio.playShoot();
                
                // Triple shot if ammo > 0
                if (this.player.ammo > 0) {
                    for(let i of [-1, 1]) {
                        const sb = this.bullets.find(bl => !bl.active);
                        if (sb) sb.reset(this.player.x + i*20, this.player.y - 20);
                    }
                    this.player.ammo--;
                }
                
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

        const checkEnemyCollisions = (enemiesArray, scoreReward, pReward, dmg) => {
            enemiesArray.forEach(e => {
                if (!e.active) return;
                this.bullets.forEach(b => {
                    if (b.active && distance(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
                        e.hp--; b.active = false;
                        this.particles.spawn(b.x, b.y, 10, '#ff004c');
                        if (e.hp <= 0) {
                            e.active = false; this.score += scoreReward;
                            this.particles.spawn(e.x, e.y, 30, '#ff004c');
                            this.spawnText(e.x, e.y, `+${scoreReward}`, "#ff004c");
                            audio.playExplosion();
                            if (scoreReward > 1000) this.addShake(15); // Boss explosion
                            else this.addShake(5);
                            
                            // Chance to drop ammo on kill
                            if (Math.random() < 0.40) {
                                const pool = this.powerups.find(p => !p.active);
                                if (pool) pool.reset(e.x, e.y, 'ammo');
                            }
                        } else {
                            audio.playShoot();
                        }
                    }
                });
                if (distance(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
                    e.active = false;
                    this.particles.spawn(e.x, e.y, 30, '#ff004c');
                    audio.playExplosion();
                    if (!p.isGhost && !p.isShielded && !p.isTurbo) {
                        p.hp -= dmg; this.particles.spawn(p.x, p.y, 30, '#ff004c');
                        this.spawnText(p.x, p.y, `-${dmg} HP`, "#ff004c");
                        audio.playDamage();
                        this.addShake(20);
                        if (p.hp <= 0) this.gameOver();
                        else { p.isGhost = true; setTimeout(() => p.isGhost = false, 1500); }
                    } else { this.particles.spawn(p.x, p.y, 10, '#00f2ff'); }
                    this.updateHUD();
                }
            });
        };

        checkEnemyCollisions(this.enemies, 500, "+500", 40);
        checkEnemyCollisions(this.bossEnemies, 2500, "+2500", 60);

        this.enemyBullets.forEach(eb => {
            if (eb.active && distance(p.x, p.y, eb.x, eb.y) < p.radius + eb.radius) {
                eb.active = false;
                if (!p.isGhost && !p.isShielded && !p.isTurbo) {
                    p.hp -= 15; this.particles.spawn(p.x, p.y, 20, '#ff004c');
                    this.spawnText(p.x, p.y, "-15 HP", "#ff004c");
                    audio.playDamage();
                    this.addShake(15);
                    if (p.hp <= 0) this.gameOver();
                    else { p.isGhost = true; setTimeout(() => p.isGhost = false, 1500); }
                } else { this.particles.spawn(p.x, p.y, 10, '#00f2ff'); }
                this.updateHUD();
            }
        });

        this.powerups.forEach(pu => {
            if (pu.active && distance(p.x, p.y, pu.x, pu.y) < p.radius + pu.radius) {
                audio.playPowerup();
                this.addShake(2);
                if (pu.type === 'crystal') { this.score += 100; this.spawnText(pu.x, pu.y, "+100 Puan", '#00f2ff'); }
                else if (pu.type === 'repair') { p.hp = Math.min(CONFIG.MAX_HP, p.hp + 50); this.spawnText(pu.x, pu.y, "+50 Can", '#00ff88'); }
                else if (pu.type === 'ammo') { p.ammo += 50; this.spawnText(pu.x, pu.y, "+50 Mermi", '#ff5e00'); }
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
            if (this.score > this.highScore && this.highScore > 0 && !this.newRecordReached) {
                this.newRecordReached = true;
                this.spawnText(this.canvas.width / 2, 250, "NEW BEST SCORE!", '#ff00ea');
                audio.playPowerup();
            }

            // Update thruster noise
            const isMoving = this.moveState.left || this.moveState.right || (this.controlMode === 'DRAG' && Math.abs(this.player.targetX - this.player.x) > 5);
            audio.updateThruster(isMoving);
        } else {
            audio.updateThruster(false);
        }

        const speed = (this.player?.isTurbo ? this.gameSpeed * 3 : this.gameSpeed);
        this.bgY += speed * 0.1; if (this.bgY >= this.canvas.height) this.bgY = 0;
        
        this.ctx.save();
        if (this.shakeIntensity > 0) {
            const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(shakeX, shakeY);
            this.shakeIntensity *= 0.85; // Damping
            if (this.shakeIntensity < 0.5) this.shakeIntensity = 0;
        }

        this.ctx.globalAlpha = 0.5;
        this.ctx.drawImage(ASSETS.bg, 0, this.bgY, this.canvas.width, this.canvas.height);
        this.ctx.save(); this.ctx.translate(0, this.bgY - this.canvas.height); this.ctx.scale(1, -1);
        this.ctx.drawImage(ASSETS.bg, 0, -this.canvas.height, this.canvas.width, this.canvas.height);
        this.ctx.restore(); this.ctx.globalAlpha = 1.0;

        this.stars.forEach(s => {
            s.y += speed * s.layer.speedMult; if (s.y > this.canvas.height) s.y = -20;
            this.ctx.fillStyle = s.layer.color; this.ctx.fillRect(s.x, s.y, s.layer.size, s.layer.size);
        });

        if (Math.random() < 0.01) {
            const ss = this.shootingStars.find(st => !st.active);
            if (ss) ss.reset();
        }
        this.shootingStars.forEach(st => { st.update(); st.draw(this.ctx); });

        if (this.state === 'PLAYING') {
            this.score += speed * 0.1; this.updateHUD();
            this.player.update(this.controlMode, this.moveState);
            this.spawnEntities();
            this.shoot();
            this.asteroids.forEach(a => a.update(speed));
            this.powerups.forEach(p => p.update(speed));
            this.bullets.forEach(b => { if (b.active) b.update(); });
            
            this.bossEnemies.forEach(e => {
                e.update(speed * 0.8);
                if (e.active && e.phase !== 'leaving' && Date.now() - e.lastFireTime > 800) {
                    for(let i=-1; i<=1; i++) {
                        const b = this.enemyBullets.find(eb => !eb.active);
                        if (b) {
                            b.reset(e.x + i*30, e.y + e.radius);
                        }
                    }
                    e.lastFireTime = Date.now();
                }
            });
            this.enemies.forEach(e => {
                e.update(speed);
                if (e.active && e.phase !== 'leaving' && Date.now() - e.lastFireTime > 1500) {
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
        this.bossEnemies.forEach(e => e.draw(this.ctx));
        this.enemyBullets.forEach(b => b.draw(this.ctx));
        this.particles.draw(this.ctx);
        this.floatingTexts.forEach(t => t.draw(this.ctx));
        if (this.player) this.player.draw(this.ctx);

        this.ctx.restore(); // Restore after shake

        requestAnimationFrame(() => this.gameLoop());
    }
}

window.onload = () => new GameEngine();
