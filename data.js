/* NEBULA 3.0 — static game data: language, ships, upgrades, levels, missions */
'use strict';

const VERSION = '3.0.0';

/* ---------------- i18n ---------------- */
const STR = {
  tr: {
    loading: 'YÜKLENİYOR', tap: 'BAŞLAMAK İÇİN DOKUN',
    campaign: 'KAMPANYA', endless: 'SONSUZ MOD', hangar: 'HANGAR', missions: 'GÖREVLER', settings: 'AYARLAR',
    pilot: 'PİLOT', lv: 'SV', best: 'REKOR', back: 'GERİ', start: 'KALKIŞ', locked: 'KİLİTLİ',
    sector: 'SEKTÖR', level: 'BÖLÜM', objective: 'ANA HEDEF', bonus: 'BONUS HEDEFLER', reward: 'ÖDÜL',
    obj_kill: '{n} düşman yok et', obj_collect: '{n} kristal topla', obj_survive: '{n} saniye hayatta kal', obj_boss: 'Boss\'u yok et: {name}',
    sec_combo: '{n}x kombo yap', sec_crystals: '{n} kristal topla', sec_asteroids: '{n} asteroit patlat', sec_time: '{n} saniyenin altında bitir', sec_kills: '{n} düşman yok et', sec_nospecial: 'Özel güç kullanmadan bitir',
    hull_goal: 'Gövde %{n} üstünde bitir',
    ships: 'GEMİLER', upgrades: 'YÜKSELTMELER', select: 'SEÇ', selected: 'SEÇİLİ', buy: 'SATIN AL', max: 'MAKS',
    hp: 'Gövde', dmg: 'Hasar', rate: 'Atış', spd: 'Hız', special: 'Özel Güç',
    up_hull: 'Zırh Kaplama', up_hull_d: '+%15 maksimum gövde',
    up_damage: 'Plazma Çekirdeği', up_damage_d: '+%12 mermi hasarı',
    up_rate: 'Hızlı Soğutucu', up_rate_d: '+%10 atış hızı',
    up_magnet: 'Çekim Alanı', up_magnet_d: 'Kristalleri uzaktan çeker',
    up_special: 'Enerji Hücresi', up_special_d: 'Özel güç %15 daha hızlı dolar',
    up_luck: 'Şans Modülü', up_luck_d: '+%12 güçlendirici düşme şansı',
    daily: 'GÜNLÜK GÖREVLER', achievements: 'BAŞARIMLAR', claim: 'AL', claimed: 'ALINDI', refresh: 'Yenilenme', allDaily: 'Hepsini bitir: bonus sandık',
    m_kills: '{n} düşman yok et', m_asteroids: '{n} asteroit patlat', m_crystals: '{n} kristal topla', m_boss: '{n} boss yen', m_special: '{n} kez özel güç kullan',
    m_pickups: '{n} güçlendirici topla', m_combo: 'Tek oyunda {n}x kombo', m_clears: '{n} kampanya bölümü bitir', m_endlessTime: 'Sonsuz modda {n} sn dayan',
    a_kills: 'Avcı', a_bosses: 'Dev Avcısı', a_crystals: 'Madenci', a_stars: 'Yıldız Koleksiyoncusu', a_specials: 'Güç Ustası', a_endless: 'Sonsuz Efsane',
    a_kills_d: 'Toplam {n} düşman', a_bosses_d: 'Toplam {n} boss', a_crystals_d: 'Toplam {n} kristal', a_stars_d: '{n} kampanya yıldızı', a_specials_d: '{n} özel güç', a_endless_d: 'Sonsuzda {n} puan',
    control: 'KONTROL', drag: 'SÜRÜKLE', joystick: 'JOYSTİK', sound: 'SES EFEKTLERİ', music: 'MÜZİK', vibration: 'TİTREŞİM', language: 'DİL', quality: 'GRAFİK', high: 'YÜKSEK', low: 'DÜŞÜK', on: 'AÇIK', off: 'KAPALI', sensitivity: 'HASSASİYET', reset: 'İLERLEMEYİ SIFIRLA', resetConfirm: 'Tüm ilerleme silinsin mi? Tekrar dokun.',
    paused: 'DURAKLATILDI', resume: 'DEVAM', retry: 'TEKRAR', quit: 'ÇIKIŞ', menu: 'ANA MENÜ', next: 'SONRAKİ',
    victory: 'GÖREV TAMAMLANDI', defeat: 'GEMİ YOK EDİLDİ', runOver: 'OYUN BİTTİ', newBest: 'YENİ REKOR!',
    score: 'PUAN', kills: 'Düşman', crystals: 'Kristal', time: 'Süre', maxCombo: 'Max Kombo', credits: 'Kredi', xp: 'XP',
    bossWarn: 'UYARI · BÜYÜK TEHDİT', missionDone: 'Görev tamamlandı!', levelUp: 'Pilot seviyesi {n}!', achDone: 'Başarım açıldı!',
    p_power: 'SİLAH +1', p_repair: '+ONARIM', p_shield: 'KALKAN', p_overdrive: 'AŞIRI GÜÇ!', p_magnet: 'MIKNATIS', p_maxpower: 'MAKS GÜÇ',
    sp_nova: 'Nova Bombası', sp_fortress: 'Kale Kalkanı', sp_timewarp: 'Zaman Bükücü', sp_laser: 'Işın Topu',
    sp_nova_d: 'Ekrandaki tüm mermileri siler, düşmanlara büyük hasar.', sp_fortress_d: '5 sn dokunulmazlık, mermileri geri yansıtır.', sp_timewarp_d: 'Zamanı yavaşlatır, sen tam hızda kalırsın.', sp_laser_d: 'Her şeyi eriten dev ışın.',
    specialReady: 'ÖZEL GÜÇ HAZIR', hint_drag: 'Gemiyi sürükle · Otomatik ateş', hint_joy: 'Joystik ile uç · Otomatik ateş', hint_special: 'Dolunca ⚡ ile özel gücü kullan',
    wave: 'DALGA', comboLost: '', complete: 'Tamamlandı', notEnough: 'Yetersiz kredi', unlockAt: 'Bölüm {n} ile açılır',
    s1: 'ORION SINIRI', s2: 'KIZIL BULUTSU', s3: 'BOŞLUK ÇEKİRDEĞİ',
    endlessDesc: 'Sonu yok. Dalgalar sertleşir, bosslar geri döner. Ne kadar dayanabilirsin?',
    hull: 'GÖVDE', meteorWarn: 'METEOR YAĞMURU!'
  },
  en: {
    loading: 'LOADING', tap: 'TAP TO START',
    campaign: 'CAMPAIGN', endless: 'ENDLESS', hangar: 'HANGAR', missions: 'MISSIONS', settings: 'SETTINGS',
    pilot: 'PILOT', lv: 'LV', best: 'BEST', back: 'BACK', start: 'LAUNCH', locked: 'LOCKED',
    sector: 'SECTOR', level: 'LEVEL', objective: 'PRIMARY OBJECTIVE', bonus: 'BONUS OBJECTIVES', reward: 'REWARD',
    obj_kill: 'Destroy {n} enemies', obj_collect: 'Collect {n} crystals', obj_survive: 'Survive {n} seconds', obj_boss: 'Defeat the boss: {name}',
    sec_combo: 'Reach a {n}x combo', sec_crystals: 'Collect {n} crystals', sec_asteroids: 'Blast {n} asteroids', sec_time: 'Finish under {n} seconds', sec_kills: 'Destroy {n} enemies', sec_nospecial: 'Finish without using a special',
    hull_goal: 'Finish with hull above {n}%',
    ships: 'SHIPS', upgrades: 'UPGRADES', select: 'SELECT', selected: 'SELECTED', buy: 'BUY', max: 'MAX',
    hp: 'Hull', dmg: 'Damage', rate: 'Fire rate', spd: 'Speed', special: 'Special',
    up_hull: 'Armor Plating', up_hull_d: '+15% max hull',
    up_damage: 'Plasma Core', up_damage_d: '+12% bullet damage',
    up_rate: 'Rapid Coolant', up_rate_d: '+10% fire rate',
    up_magnet: 'Tractor Field', up_magnet_d: 'Pulls crystals from afar',
    up_special: 'Energy Cell', up_special_d: 'Special charges 15% faster',
    up_luck: 'Luck Module', up_luck_d: '+12% power-up drop chance',
    daily: 'DAILY MISSIONS', achievements: 'ACHIEVEMENTS', claim: 'CLAIM', claimed: 'CLAIMED', refresh: 'Refreshes in', allDaily: 'Finish all: bonus crate',
    m_kills: 'Destroy {n} enemies', m_asteroids: 'Blast {n} asteroids', m_crystals: 'Collect {n} crystals', m_boss: 'Defeat {n} bosses', m_special: 'Use specials {n} times',
    m_pickups: 'Grab {n} power-ups', m_combo: 'Reach {n}x combo in one run', m_clears: 'Clear {n} campaign levels', m_endlessTime: 'Survive {n}s in Endless',
    a_kills: 'Hunter', a_bosses: 'Giant Slayer', a_crystals: 'Miner', a_stars: 'Star Collector', a_specials: 'Power Master', a_endless: 'Endless Legend',
    a_kills_d: '{n} total enemies', a_bosses_d: '{n} total bosses', a_crystals_d: '{n} total crystals', a_stars_d: '{n} campaign stars', a_specials_d: '{n} specials', a_endless_d: '{n} points in Endless',
    control: 'CONTROLS', drag: 'DRAG', joystick: 'JOYSTICK', sound: 'SOUND FX', music: 'MUSIC', vibration: 'VIBRATION', language: 'LANGUAGE', quality: 'GRAPHICS', high: 'HIGH', low: 'LOW', on: 'ON', off: 'OFF', sensitivity: 'SENSITIVITY', reset: 'RESET PROGRESS', resetConfirm: 'Erase all progress? Tap again.',
    paused: 'PAUSED', resume: 'RESUME', retry: 'RETRY', quit: 'QUIT', menu: 'MAIN MENU', next: 'NEXT',
    victory: 'MISSION COMPLETE', defeat: 'SHIP DESTROYED', runOver: 'RUN OVER', newBest: 'NEW BEST!',
    score: 'SCORE', kills: 'Kills', crystals: 'Crystals', time: 'Time', maxCombo: 'Max combo', credits: 'Credits', xp: 'XP',
    bossWarn: 'WARNING · MAJOR THREAT', missionDone: 'Mission complete!', levelUp: 'Pilot level {n}!', achDone: 'Achievement unlocked!',
    p_power: 'WEAPON +1', p_repair: '+REPAIR', p_shield: 'SHIELD', p_overdrive: 'OVERDRIVE!', p_magnet: 'MAGNET', p_maxpower: 'MAX POWER',
    sp_nova: 'Nova Bomb', sp_fortress: 'Fortress Shield', sp_timewarp: 'Time Warp', sp_laser: 'Beam Cannon',
    sp_nova_d: 'Wipes every bullet on screen, heavy damage to all.', sp_fortress_d: '5s invulnerable, reflects bullets.', sp_timewarp_d: 'Slows time while you stay at full speed.', sp_laser_d: 'A giant beam that melts everything.',
    specialReady: 'SPECIAL READY', hint_drag: 'Drag to fly · Auto-fire', hint_joy: 'Use the joystick · Auto-fire', hint_special: 'Tap ⚡ when charged',
    wave: 'WAVE', comboLost: '', complete: 'Complete', notEnough: 'Not enough credits', unlockAt: 'Unlocks at level {n}',
    s1: 'ORION BORDER', s2: 'CRIMSON NEBULA', s3: 'VOID CORE',
    endlessDesc: 'No end. Waves get harder, bosses return. How long can you last?',
    hull: 'HULL', meteorWarn: 'METEOR SHOWER!'
  }
};
let LANG = 'tr';
function t(key, vars) {
  let s = (STR[LANG] && STR[LANG][key]) ?? STR.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}

/* ---------------- Ships ---------------- */
const SHIPS = [
  { id: 'interceptor', name: 'INTERCEPTOR', color: '#00f2ff', hp: 100, speed: 1.0, rate: 1.0, dmg: 1.0, special: 'nova', cost: 0 },
  { id: 'vanguard', name: 'VANGUARD', color: '#ff9d2e', hp: 150, speed: 0.85, rate: 0.9, dmg: 1.25, special: 'fortress', cost: 2500 },
  { id: 'phantom', name: 'PHANTOM', color: '#b36bff', hp: 85, speed: 1.25, rate: 1.25, dmg: 0.9, special: 'timewarp', cost: 4500 },
  { id: 'seraph', name: 'SERAPH', color: '#3dff93', hp: 115, speed: 1.05, rate: 1.05, dmg: 1.1, special: 'laser', cost: 7500 }
];
const SPECIAL_ICON = { nova: '✹', fortress: '⛨', timewarp: '⧗', laser: '❘' };

/* ---------------- Upgrades ---------------- */
const UPGRADES = [
  { id: 'hull', icon: '⛨', base: 200 },
  { id: 'damage', icon: '✦', base: 260 },
  { id: 'rate', icon: '≋', base: 240 },
  { id: 'magnet', icon: '◎', base: 150 },
  { id: 'special', icon: '⚡', base: 220 },
  { id: 'luck', icon: '♣', base: 180 }
];
const UPGRADE_MAX = 5;
const upgradeCost = (u, lvl) => Math.round(u.base * Math.pow(lvl + 1, 1.55) / 10) * 10;

/* ---------------- Enemies ---------------- */
const ENEMY = {
  drone:    { hp: 3,  r: 16, score: 100, color: '#ff3b5c', charge: 4 },
  dart:     { hp: 2,  r: 14, score: 120, color: '#ff8a1f', charge: 4 },
  gunner:   { hp: 9,  r: 22, score: 260, color: '#b44bff', charge: 7 },
  sniper:   { hp: 6,  r: 18, score: 220, color: '#ffe11f', charge: 6 },
  splitter: { hp: 7,  r: 22, score: 180, color: '#39ff88', charge: 5 },
  mini:     { hp: 2,  r: 11, score: 60,  color: '#39ff88', charge: 2 },
  mine:     { hp: 4,  r: 16, score: 150, color: '#ff2bd6', charge: 5 },
  tank:     { hp: 26, r: 30, score: 520, color: '#3b8bff', charge: 12 }
};

/* ---------------- Bosses ---------------- */
const BOSSES = {
  kraken:   { name: 'KRAKEN', hp: 300, color: '#ff3b5c', r: 62 },
  twinfang: { name: 'TWIN FANG', hp: 480, color: '#ffb000', r: 58 },
  voidcore: { name: 'VOID CORE', hp: 720, color: '#b44bff', r: 56 }
};

/* ---------------- Sectors & Levels ---------------- */
const SECTORS = [
  { id: 1, key: 's1', hue: 195, tint: 'rgba(0,140,255,0.10)', planet: ['#2ad1ff', '#08305a'] },
  { id: 2, key: 's2', hue: 340, tint: 'rgba(255,20,90,0.12)', planet: ['#ff5a7a', '#4a0820'] },
  { id: 3, key: 's3', hue: 275, tint: 'rgba(150,40,255,0.14)', planet: ['#c07bff', '#1d0640'] }
];

// pool: weights per enemy type. ast: asteroid frequency multiplier
const LEVELS = [
  { s: 1, obj: { type: 'kill', n: 15 },    sec: { type: 'combo', n: 8 },       diff: 0.0, pool: { drone: 5, dart: 1 }, ast: 1.0 },
  { s: 1, obj: { type: 'collect', n: 30 }, sec: { type: 'asteroids', n: 10 },  diff: 0.3, pool: { drone: 4, dart: 3 }, ast: 1.3, crystalAst: true },
  { s: 1, obj: { type: 'survive', n: 60 }, sec: { type: 'kills', n: 25 },      diff: 0.6, pool: { drone: 2, dart: 4 }, ast: 2.4, meteorShowers: true },
  { s: 1, obj: { type: 'kill', n: 30 },    sec: { type: 'combo', n: 15 },      diff: 0.9, pool: { drone: 4, dart: 3, gunner: 2 }, ast: 1.0 },
  { s: 1, obj: { type: 'boss', boss: 'kraken', warmup: 25 }, sec: { type: 'time', n: 120 }, diff: 1.1, pool: { drone: 4, dart: 3, gunner: 1 }, ast: 0.8 },

  { s: 2, obj: { type: 'kill', n: 35 },    sec: { type: 'combo', n: 20 },      diff: 1.4, pool: { drone: 3, dart: 3, sniper: 2, splitter: 2 }, ast: 0.9 },
  { s: 2, obj: { type: 'survive', n: 75 }, sec: { type: 'nospecial' },         diff: 1.6, pool: { dart: 3, mine: 3, sniper: 2 }, ast: 1.6, meteorShowers: true },
  { s: 2, obj: { type: 'collect', n: 45 }, sec: { type: 'asteroids', n: 18 },  diff: 1.8, pool: { drone: 3, splitter: 3, gunner: 2 }, ast: 1.4, crystalAst: true },
  { s: 2, obj: { type: 'kill', n: 45 },    sec: { type: 'combo', n: 25 },      diff: 2.0, pool: { drone: 3, gunner: 2, sniper: 2, tank: 1, mine: 1 }, ast: 0.8 },
  { s: 2, obj: { type: 'boss', boss: 'twinfang', warmup: 30 }, sec: { type: 'time', n: 150 }, diff: 2.2, pool: { dart: 3, sniper: 2, splitter: 2 }, ast: 0.7 },

  { s: 3, obj: { type: 'kill', n: 55 },    sec: { type: 'combo', n: 30 },      diff: 2.6, pool: { drone: 2, dart: 3, gunner: 2, sniper: 2, splitter: 2, mine: 1, tank: 1 }, ast: 0.9 },
  { s: 3, obj: { type: 'survive', n: 90 }, sec: { type: 'kills', n: 50 },      diff: 2.8, pool: { dart: 4, mine: 3, tank: 1, sniper: 2 }, ast: 2.0, meteorShowers: true },
  { s: 3, obj: { type: 'collect', n: 60 }, sec: { type: 'nospecial' },         diff: 3.0, pool: { splitter: 3, gunner: 2, drone: 3, mine: 2 }, ast: 1.4, crystalAst: true },
  { s: 3, obj: { type: 'boss', boss: 'kraken', bossHp: 1.8, warmup: 30 }, sec: { type: 'combo', n: 35 }, diff: 3.2, pool: { gunner: 2, tank: 2, sniper: 2, dart: 3 }, ast: 0.8 },
  { s: 3, obj: { type: 'boss', boss: 'voidcore', warmup: 35 }, sec: { type: 'time', n: 180 }, diff: 3.5, pool: { drone: 2, dart: 3, gunner: 2, sniper: 2, splitter: 1, tank: 1, mine: 1 }, ast: 0.7 }
];
LEVELS.forEach((l, i) => { l.id = i + 1; l.reward = 150 + i * 70; });

/* ---------------- Missions ---------------- */
const DAILY_TEMPLATES = [
  { type: 'kills', ns: [60, 120, 200], rw: [150, 260, 400] },
  { type: 'asteroids', ns: [25, 50], rw: [150, 260] },
  { type: 'crystals', ns: [80, 160, 300], rw: [150, 260, 420] },
  { type: 'boss', ns: [1, 2], rw: [300, 500] },
  { type: 'special', ns: [3, 6], rw: [160, 280] },
  { type: 'pickups', ns: [8, 16], rw: [150, 260] },
  { type: 'combo', ns: [20, 40], rw: [200, 350], max: true },
  { type: 'clears', ns: [2, 4], rw: [220, 380] },
  { type: 'endlessTime', ns: [120, 240], rw: [220, 400], max: true }
];
const DAILY_BONUS = 600;

const ACHIEVEMENTS = [
  { id: 'kills', stat: 'kills', tiers: [100, 1000, 5000] },
  { id: 'bosses', stat: 'bosses', tiers: [1, 10, 30] },
  { id: 'crystals', stat: 'crystals', tiers: [500, 3000, 10000] },
  { id: 'stars', stat: 'stars', tiers: [15, 30, 45] },
  { id: 'specials', stat: 'specials', tiers: [10, 50, 200] },
  { id: 'endless', stat: 'endlessBest', tiers: [20000, 60000, 150000] }
];
const ACH_REWARDS = [250, 700, 1600];

const xpForLevel = (lvl) => Math.round(400 * Math.pow(lvl, 1.35));
