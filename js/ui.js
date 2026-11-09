/* NEBULA 3.0 — interface: menus, campaign map, hangar, missions, settings, HUD, results */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const fmt = (n) => Math.floor(n).toLocaleString(LANG === 'tr' ? 'tr-TR' : 'en-US');
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const UI = {
  screen: 'loading', hudCache: {}, shipImgs: {}, hangarTab: 'ships', missionTab: 'daily', resetArmed: false,

  init() {
    // ship preview images from pre-rendered sprites
    for (const s of SHIPS) { try { this.shipImgs[s.id] = SPR['ship_' + s.id].c.toDataURL(); } catch (e) { this.shipImgs[s.id] = 'assets/ship.png'; } }
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      if (el.disabled) return;
      this.act(el.dataset.act, el.dataset, el);
    });
    $('#btn-pause').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); G.pause(); });
    $('#btn-special').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); G.useSpecial(); });
    // Android hardware back / browser back
    history.replaceState({ n: 0 }, ''); history.pushState({ n: 1 }, '');
    window.addEventListener('popstate', () => {
      history.pushState({ n: 1 }, '');
      if (G.state === 'play') G.pause();
      else if (G.state === 'pause') G.resume();
      else if (this.screen !== 'menu' && G.state === 'menu') { this.showMenu(); }
    });
  },

  tap() { audio.init(); audio.sfx('ui'); },

  act(a, d) {
    this.tap();
    switch (a) {
      case 'menu': this.showMenu(); break;
      case 'map': this.showMap(); break;
      case 'endless': G.startEndless(); break;
      case 'hangar': this.showHangar(); break;
      case 'missions': this.showMissions(); break;
      case 'settings': this.showSettings(); break;
      case 'brief': this.showBrief(+d.id); break;
      case 'launch': this.closeModals(); G.startLevel(+d.id); break;
      case 'close': this.closeModals(); break;
      case 'resume': G.resume(); break;
      case 'retry': this.closeModals(); if (G.mode === 'endless') G.startEndless(); else G.startLevel(G.level.id); break;
      case 'next': this.closeModals(); G.startLevel(Math.min(LEVELS.length, G.level.id + 1)); break;
      case 'quit': this.closeModals(); G.quitToMenu(); break;
      case 'tohangar': this.closeModals(); G.quitToMenu(); this.showHangar(); break;
      case 'tab-h': this.hangarTab = d.tab; this.renderHangar(); break;
      case 'tab-m': this.missionTab = d.tab; this.renderMissions(); break;
      case 'ship': this.shipAction(d.id); break;
      case 'upg': this.buyUpgrade(d.id); break;
      case 'claim': { const r = Save.claimDaily(+d.i); if (r) this.reward(r); this.renderMissions(); break; }
      case 'claim-bonus': { const r = Save.claimDailyBonus(); if (r) this.reward(r); this.renderMissions(); break; }
      case 'claim-ach': { const r = Save.claimAch(d.id); if (r) this.reward(r); this.renderMissions(); break; }
      case 'set': this.setSetting(d.k, d.v); break;
      case 'reset':
        if (!this.resetArmed) { this.resetArmed = true; this.toast(t('resetConfirm'), '⚠'); setTimeout(() => this.resetArmed = false, 4000); }
        else { this.resetArmed = false; Save.reset(); LANG = Save.d.settings.lang; this.showMenu(); }
        break;
    }
  },

  reward(n) { audio.sfx('buy'); vibrate(30); this.toast(`+${fmt(n)} ${t('credits')}`, '💎'); this.refreshTopbar(); },

  /* ---------------- screen routing ---------------- */
  showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
    this.screen = id;
    $('#hud').classList.add('hidden'); $('#boss-bar').classList.add('hidden');
  },
  closeModals() { $$('.modal').forEach(m => m.classList.remove('active')); },

  topbar() {
    const d = Save.d, need = xpForLevel(d.plv);
    return `<div class="topbar">
      <div class="pilot"><div class="pilot-lv">${d.plv}</div><div class="pilot-info"><span>${t('pilot')} ${t('lv')} ${d.plv}</span><div class="xpbar"><i style="width:${Math.min(100, d.xp / need * 100)}%"></i></div></div></div>
      <div class="credits">💎 <b>${fmt(d.credits)}</b></div>
    </div>`;
  },
  refreshTopbar() { $$('.topbar-slot').forEach(el => el.innerHTML = this.topbar()); },
  header(title, extra = '') {
    return `<div class="scr-head"><button class="icon-btn" data-act="menu" aria-label="${t('back')}">‹</button><h2>${title}</h2>${extra}</div>`;
  },

  /* ---------------- MAIN MENU ---------------- */
  showMenu() {
    this.closeModals(); G.state = G.state === 'boot' ? 'menu' : G.state;
    if (G.state !== 'menu') G.state = 'menu';
    const d = Save.d, ship = Save.ship(), unlocked = Save.unlockedLevel(), stars = Save.totalStars();
    const badge = Save.claimableCount();
    $('#scr-menu').innerHTML = `
      <div class="topbar-slot">${this.topbar()}</div>
      <div class="menu-hero">
        <div class="logo"><span class="logo-main" data-text="NEBULA">NEBULA</span><span class="logo-sub">INFINITE DRIFT · ${VERSION.slice(0, 3)}</span></div>
        <div class="hero-ship" style="--c:${ship.color}"><div class="hero-ring"></div><img src="${this.shipImgs[ship.id]}" alt=""><div class="hero-name">${ship.name}</div></div>
      </div>
      <div class="menu-actions">
        <button class="btn btn-primary btn-xl" data-act="map">
          <span class="btn-ico">◈</span><span class="btn-txt"><b>${t('campaign')}</b><small>${t('level')} ${Math.min(unlocked, LEVELS.length)}/${LEVELS.length} · ★ ${stars}/${LEVELS.length * 3}</small></span><span class="btn-arrow">›</span>
        </button>
        <button class="btn btn-hot btn-xl" data-act="endless">
          <span class="btn-ico">∞</span><span class="btn-txt"><b>${t('endless')}</b><small>${t('best')}: ${fmt(d.endlessBest)}</small></span><span class="btn-arrow">›</span>
        </button>
        <div class="menu-grid">
          <button class="btn btn-tile" data-act="hangar"><span>🚀</span>${t('hangar')}</button>
          <button class="btn btn-tile" data-act="missions"><span>🎯</span>${t('missions')}${badge ? `<em class="badge">${badge}</em>` : ''}</button>
          <button class="btn btn-tile" data-act="settings"><span>⚙</span>${t('settings')}</button>
        </div>
      </div>
      <div class="menu-foot">v${VERSION}</div>`;
    this.showScreen('menu');
    audio.setMusic('menu');
  },

  /* ---------------- CAMPAIGN MAP ---------------- */
  showMap() {
    const unlocked = Save.unlockedLevel();
    let html = this.header(t('campaign'), `<div class="head-chip">★ ${Save.totalStars()}/${LEVELS.length * 3}</div>`);
    html += '<div class="scroll map">';
    for (const sec of SECTORS) {
      const lv = LEVELS.filter(l => l.s === sec.id);
      html += `<div class="sector" style="--h:${sec.hue}"><div class="sector-title"><span>${t('sector')} ${sec.id}</span>${t(sec.key)}</div><div class="path">`;
      lv.forEach((l, i) => {
        const rec = Save.d.levels[l.id], locked = l.id > unlocked, boss = l.obj.type === 'boss';
        const st = rec ? rec.stars : 0;
        html += `<button class="node ${locked ? 'locked' : ''} ${boss ? 'boss' : ''} ${rec && rec.done ? 'done' : ''} ${l.id === unlocked && !(rec && rec.done) ? 'current' : ''}" style="--i:${i}" data-act="${locked ? '' : 'brief'}" data-id="${l.id}" ${locked ? 'disabled' : ''}>
          <span class="node-hex">${locked ? '🔒' : boss ? '☠' : l.id}</span>
          <span class="node-stars">${[0, 1, 2].map(k => `<i class="${k < st ? 'on' : ''}">★</i>`).join('')}</span>
          <span class="node-obj">${this.objIcon(l.obj.type)}</span>
        </button>`;
      });
      html += '</div></div>';
    }
    html += '</div>';
    $('#scr-map').innerHTML = html;
    this.showScreen('map');
    const cur = $('#scr-map .node.current'); if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  },

  objIcon(type) { return { kill: '✖', collect: '◆', survive: '⏱', boss: '☠' }[type]; },
  objText(o) {
    if (o.type === 'kill') return t('obj_kill', { n: o.n });
    if (o.type === 'collect') return t('obj_collect', { n: o.n });
    if (o.type === 'survive') return t('obj_survive', { n: o.n });
    return t('obj_boss', { name: BOSSES[o.boss].name + (o.bossHp ? ' MK-II' : '') });
  },
  secText(s) { return t('sec_' + s.type, { n: s.n }); },

  showBrief(id) {
    const l = LEVELS[id - 1], rec = Save.d.levels[id] || { stars: 0, best: 0 }, sec = SECTORS[l.s - 1];
    const enemies = Object.keys(l.pool).map(k => `<i class="dot" style="--c:${ENEMY[k].color}" title="${k}"></i>`).join('');
    $('#modal-brief .modal-box').innerHTML = `
      <div class="brief-head" style="--h:${sec.hue}"><small>${t('sector')} ${l.s} · ${t(sec.key)}</small><h3>${t('level')} ${id}${l.obj.type === 'boss' ? ' <span class="tag-boss">BOSS</span>' : ''}</h3></div>
      <div class="brief-sec"><label>${t('objective')}</label><div class="obj-main"><span>${this.objIcon(l.obj.type)}</span>${this.objText(l.obj)}</div></div>
      <div class="brief-sec"><label>${t('bonus')}</label>
        <div class="star-row ${rec.stars >= 1 ? 'got' : ''}"><i>★</i>${t('complete')}</div>
        <div class="star-row ${rec.stars >= 2 ? 'got' : ''}"><i>★</i>${this.secText(l.sec)}</div>
        <div class="star-row ${rec.stars >= 3 ? 'got' : ''}"><i>★</i>${t('hull_goal', { n: 60 })}</div>
      </div>
      <div class="brief-meta"><div><label>${t('reward')}</label><b>💎 ${l.reward}${rec.done ? '' : ' ×2'}</b></div><div><label>${t('best')}</label><b>${fmt(rec.best || 0)}</b></div><div><label>⚠</label><span class="dots">${enemies}</span></div></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-act="close">${t('back')}</button><button class="btn btn-primary" data-act="launch" data-id="${id}">${t('start')} ›</button></div>`;
    $('#modal-brief').classList.add('active');
  },

  /* ---------------- HANGAR ---------------- */
  showHangar() { this.showScreen('hangar'); this.renderHangar(); },
  renderHangar() {
    const d = Save.d;
    let html = `<div class="topbar-slot">${this.topbar()}</div>` + this.header(t('hangar'));
    html += `<div class="tabs"><button class="${this.hangarTab === 'ships' ? 'on' : ''}" data-act="tab-h" data-tab="ships">${t('ships')}</button><button class="${this.hangarTab === 'upgrades' ? 'on' : ''}" data-act="tab-h" data-tab="upgrades">${t('upgrades')}</button></div>`;
    html += '<div class="scroll">';
    if (this.hangarTab === 'ships') {
      html += '<div class="ship-list">';
      const maxHp = 150, bar = (v, m) => `<div class="stat-bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div>`;
      for (const s of SHIPS) {
        const owned = d.owned[s.id], sel = d.ship === s.id;
        html += `<div class="ship-card ${sel ? 'sel' : ''}" style="--c:${s.color}">
          <div class="ship-pic"><img src="${this.shipImgs[s.id]}" alt=""></div>
          <div class="ship-body">
            <h4>${s.name}</h4>
            <div class="stats">
              <span>${t('hp')}</span>${bar(s.hp, maxHp)}<span>${t('dmg')}</span>${bar(s.dmg, 1.3)}
              <span>${t('rate')}</span>${bar(s.rate, 1.3)}<span>${t('spd')}</span>${bar(s.speed, 1.3)}
            </div>
            <div class="sp-line"><b>${SPECIAL_ICON[s.special]} ${t('sp_' + s.special)}</b><small>${t('sp_' + s.special + '_d')}</small></div>
            <button class="btn ${sel ? 'btn-ghost' : owned ? 'btn-primary' : 'btn-gold'} btn-sm" data-act="ship" data-id="${s.id}" ${sel ? 'disabled' : ''}>
              ${sel ? '✓ ' + t('selected') : owned ? t('select') : `💎 ${fmt(s.cost)}`}
            </button>
          </div></div>`;
      }
      html += '</div>';
    } else {
      html += '<div class="upg-list">';
      for (const u of UPGRADES) {
        const lv = d.upg[u.id], maxed = lv >= UPGRADE_MAX, cost = upgradeCost(u, lv);
        html += `<div class="upg">
          <div class="upg-ico">${u.icon}</div>
          <div class="upg-body"><b>${t('up_' + u.id)}</b><small>${t('up_' + u.id + '_d')}</small>
            <div class="pips">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
          <button class="btn ${maxed ? 'btn-ghost' : d.credits >= cost ? 'btn-gold' : 'btn-dim'} btn-sm" data-act="upg" data-id="${u.id}" ${maxed ? 'disabled' : ''}>${maxed ? t('max') : '💎 ' + fmt(cost)}</button>
        </div>`;
      }
      html += '</div>';
    }
    html += '</div>';
    $('#scr-hangar').innerHTML = html;
  },
  shipAction(id) {
    const s = SHIPS.find(x => x.id === id), d = Save.d;
    if (d.owned[id]) { d.ship = id; Save.persist(); }
    else if (Save.spend(s.cost)) { d.owned[id] = true; d.ship = id; Save.persist(); audio.sfx('buy'); vibrate(40); this.toast(s.name + ' ✓', '🚀'); }
    else { audio.sfx('error'); this.toast(t('notEnough'), '💎'); }
    this.renderHangar();
  },
  buyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id), lv = Save.d.upg[id];
    if (lv >= UPGRADE_MAX) return;
    if (Save.spend(upgradeCost(u, lv))) { Save.d.upg[id]++; Save.persist(); audio.sfx('buy'); vibrate(30); }
    else { audio.sfx('error'); this.toast(t('notEnough'), '💎'); }
    this.renderHangar();
  },

  /* ---------------- MISSIONS ---------------- */
  showMissions() { Save.ensureDaily(); this.showScreen('missions'); this.renderMissions(); },
  renderMissions() {
    const d = Save.d, dl = d.daily;
    let html = `<div class="topbar-slot">${this.topbar()}</div>` + this.header(t('missions'));
    html += `<div class="tabs"><button class="${this.missionTab === 'daily' ? 'on' : ''}" data-act="tab-m" data-tab="daily">${t('daily')}</button><button class="${this.missionTab === 'ach' ? 'on' : ''}" data-act="tab-m" data-tab="ach">${t('achievements')}</button></div><div class="scroll">`;
    if (this.missionTab === 'daily') {
      const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
      const left = Math.max(0, (mid - now) / 1000);
      html += `<div class="refresh">⟳ ${t('refresh')} ${Math.floor(left / 3600)}h ${Math.floor(left % 3600 / 60)}m</div>`;
      dl.list.forEach((m, i) => {
        const done = m.prog >= m.n;
        html += `<div class="mission ${m.claimed ? 'claimed' : done ? 'ready' : ''}">
          <div class="m-body"><b>${t('m_' + m.type, { n: m.n })}</b>
            <div class="m-prog"><div class="pbar"><i style="width:${m.prog / m.n * 100}%"></i></div><span>${fmt(m.prog)}/${fmt(m.n)}</span></div></div>
          <button class="btn btn-sm ${m.claimed ? 'btn-ghost' : done ? 'btn-gold' : 'btn-dim'}" data-act="claim" data-i="${i}" ${m.claimed || !done ? 'disabled' : ''}>${m.claimed ? '✓' : '💎 ' + m.reward}</button>
        </div>`;
      });
      const allDone = dl.list.every(m => m.claimed);
      html += `<div class="mission chest ${dl.bonusClaimed ? 'claimed' : allDone ? 'ready' : ''}"><div class="m-body"><b>🎁 ${t('allDaily')}</b><small>${dl.list.filter(m => m.claimed).length}/3</small></div>
        <button class="btn btn-sm ${dl.bonusClaimed ? 'btn-ghost' : allDone ? 'btn-gold' : 'btn-dim'}" data-act="claim-bonus" ${dl.bonusClaimed || !allDone ? 'disabled' : ''}>${dl.bonusClaimed ? '✓' : '💎 ' + DAILY_BONUS}</button></div>`;
    } else {
      for (const a of ACHIEVEMENTS) {
        const tier = d.ach[a.id] || 0, maxed = tier >= a.tiers.length, goal = a.tiers[Math.min(tier, a.tiers.length - 1)];
        const val = d.stats[a.stat] || 0, ready = !maxed && val >= goal;
        html += `<div class="mission ${maxed ? 'claimed' : ready ? 'ready' : ''}">
          <div class="m-body"><b>${t('a_' + a.id)} <span class="tier">${'◆'.repeat(tier)}${'◇'.repeat(a.tiers.length - tier)}</span></b><small>${t('a_' + a.id + '_d', { n: fmt(goal) })}</small>
            <div class="m-prog"><div class="pbar"><i style="width:${Math.min(100, val / goal * 100)}%"></i></div><span>${fmt(Math.min(val, goal))}/${fmt(goal)}</span></div></div>
          <button class="btn btn-sm ${maxed ? 'btn-ghost' : ready ? 'btn-gold' : 'btn-dim'}" data-act="claim-ach" data-id="${a.id}" ${!ready ? 'disabled' : ''}>${maxed ? '✓' : '💎 ' + ACH_REWARDS[tier]}</button>
        </div>`;
      }
    }
    html += '</div>';
    $('#scr-missions').innerHTML = html;
  },

  /* ---------------- SETTINGS ---------------- */
  showSettings() { this.showScreen('settings'); this.renderSettings(); },
  seg(k, opts) {
    const cur = String(Save.d.settings[k]);
    return `<div class="seg">${opts.map(([v, label]) => `<button class="${cur === String(v) ? 'on' : ''}" data-act="set" data-k="${k}" data-v="${v}">${label}</button>`).join('')}</div>`;
  },
  renderSettings() {
    const s = Save.d.settings;
    $('#scr-settings').innerHTML = this.header(t('settings')) + `<div class="scroll settings">
      <div class="set-row"><label>${t('control')}</label>${this.seg('control', [['drag', t('drag')], ['joystick', t('joystick')]])}</div>
      <div class="set-row"><label>${t('sensitivity')}</label><div class="range"><input type="range" min="0.6" max="2.2" step="0.1" value="${s.sens}" id="sens"><span id="sens-v">${s.sens.toFixed(1)}x</span></div></div>
      <div class="set-row"><label>${t('sound')}</label>${this.seg('sound', [[true, t('on')], [false, t('off')]])}</div>
      <div class="set-row"><label>${t('music')}</label>${this.seg('music', [[true, t('on')], [false, t('off')]])}</div>
      <div class="set-row"><label>${t('vibration')}</label>${this.seg('vib', [[true, t('on')], [false, t('off')]])}</div>
      <div class="set-row"><label>${t('quality')}</label>${this.seg('quality', [['high', t('high')], ['low', t('low')]])}</div>
      <div class="set-row"><label>${t('language')}</label>${this.seg('lang', [['tr', 'TÜRKÇE'], ['en', 'ENGLISH']])}</div>
      <button class="btn btn-danger btn-sm reset" data-act="reset">${t('reset')}</button>
      <div class="menu-foot">NEBULA v${VERSION}</div>
    </div>`;
    const r = $('#sens');
    r.addEventListener('input', () => { Save.d.settings.sens = parseFloat(r.value); $('#sens-v').textContent = Save.d.settings.sens.toFixed(1) + 'x'; Save.persist(); });
  },
  setSetting(k, v) {
    const s = Save.d.settings;
    if (v === 'true') v = true; else if (v === 'false') v = false;
    s[k] = v; Save.persist();
    if (k === 'sound') audio.sfxOn = v;
    if (k === 'music') { audio.musicOn = v; audio.setMusic(G.state === 'play' ? (G.boss ? 'boss' : 'game') : G.state === 'pause' ? 'off' : 'menu'); }
    if (k === 'lang') { LANG = v; document.documentElement.lang = v; }
    if (k === 'quality') G.resize();
    if (k === 'control') { G.input.drag = null; G.input.joy = null; }
    if (this.screen === 'settings') this.renderSettings();
    if ($('#modal-pause').classList.contains('active')) this.showPause(true);
  },

  /* ---------------- IN-GAME ---------------- */
  enterGame() {
    this.closeModals();
    $$('.screen').forEach(s => s.classList.remove('active'));
    this.screen = 'game';
    $('#hud').classList.remove('hidden');
    $('#boss-bar').classList.add('hidden');
    this.hudCache = {};
    $('#btn-special').innerHTML = `<svg viewBox="0 0 80 80"><circle class="sp-bg" cx="40" cy="40" r="34"/><circle class="sp-fill" id="sp-fill" cx="40" cy="40" r="34"/></svg><span>${SPECIAL_ICON[Save.ship().special]}</span>`;
    $('#btn-special').style.setProperty('--c', Save.ship().color);
  },

  updateHUD(g) {
    const p = g.player, r = g.run, c = this.hudCache;
    if (!p) return;
    const set = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
    const hpPct = Math.round(p.hp / p.maxHp * 100);
    set('hp', hpPct, v => { $('#hull-fill').style.width = v + '%'; $('#hull-fill').classList.toggle('low', v < 30); $('#hull-val').textContent = Math.ceil(p.hp); });
    set('score', Math.floor(r.score), v => $('#score-val').textContent = fmt(v));
    const mult = g.comboMult();
    set('combo', r.combo, v => {
      const el = $('#combo'); el.classList.toggle('show', v >= 3);
      el.innerHTML = `<b>x${mult.toFixed(1)}</b><span>${v} COMBO</span>`;
      if (v >= 3) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
    set('power', p.power, v => $('#power').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join(''));
    const buffs = [p.shield > 0 ? '🛡' : '', p.overdrive > 0 ? '⚡' : '', p.magnet > 0 ? '🧲' : '', g.warp > 0 ? '⧗' : ''].join('');
    set('buffs', buffs, v => $('#buffs').textContent = v);
    const ch = Math.floor(p.charge);
    set('charge', ch, v => {
      const circ = 2 * Math.PI * 34; $('#sp-fill').style.strokeDashoffset = circ * (1 - v / 100);
      $('#btn-special').classList.toggle('ready', v >= 100);
    });
    // objectives
    let obj = '';
    if (g.mode === 'endless') obj = `<div class="o-main">∞ ${fmtTime(r.t)} · ${t('wave')} ${1 + Math.floor(r.t / 30)}</div>`;
    else {
      const pr = g.objectiveProgress(), o = g.level.obj;
      let main;
      if (pr.boss) main = g.boss ? `☠ ${g.boss.name}` : (g.dir.bossPending ? `☠ ⚠⚠⚠` : `☠ BOSS · ${pr.bossIn}s`);
      else main = `${this.objIcon(o.type)} ${Math.min(pr.cur, pr.max)}/${pr.max}`;
      const sec = g.secondaryMet() ? '★✓' : '★';
      obj = `<div class="o-main">${main}</div><div class="o-sec">${sec} ${g.secondaryProgress()}</div>`;
    }
    set('obj', obj, v => $('#objective').innerHTML = v);
    if (g.boss) {
      const bp = Math.max(0, g.boss.hp / g.boss.maxHp * 100).toFixed(1);
      set('bossHp', bp, v => { $('#boss-fill').style.width = v + '%'; });
    }
  },

  bossBar(b) {
    const el = $('#boss-bar');
    if (!b) { el.classList.add('hidden'); return; }
    el.innerHTML = `<div class="boss-name">☠ ${b.name}</div><div class="boss-track"><i id="boss-fill"></i><span class="seg s1"></span><span class="seg s2"></span></div>`;
    el.style.setProperty('--c', b.color);
    el.classList.remove('hidden'); this.hudCache.bossHp = null;
  },

  specialReady() {
    if (!Save.d.tutorial) this.toast(t('specialReady') + ' — ⚡', '⚡');
  },
  specialFired(type) { this.banner(t('sp_' + type), '', 1.0, 'special'); },

  banner(title, sub, dur = 2, kind = '') {
    const el = $('#banner');
    el.className = 'banner' + (kind ? ' bn-' + kind : '');
    el.innerHTML = `<div class="b-title">${title}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
    void el.offsetWidth; el.classList.add('show');
    clearTimeout(this._bannerT); this._bannerT = setTimeout(() => el.classList.remove('show'), dur * 1000);
  },

  toast(msg, icon = '★') {
    const box = $('#toasts'), el = document.createElement('div');
    el.className = 'toast'; el.innerHTML = `<span>${icon}</span>${msg}`;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
    while (box.children.length > 3) box.firstChild.remove();
  },

  showPause(show) {
    const m = $('#modal-pause');
    if (!show) { m.classList.remove('active'); return; }
    const g = G;
    let objLine = '';
    if (g.mode === 'campaign') objLine = `<div class="pause-obj"><span>${this.objIcon(g.level.obj.type)}</span>${this.objText(g.level.obj)}<br><small>★ ${this.secText(g.level.sec)}</small></div>`;
    m.querySelector('.modal-box').innerHTML = `<h3 class="glow-title">${t('paused')}</h3>${objLine}
      <div class="quick-set"><div class="set-row"><label>${t('sound')}</label>${this.seg('sound', [[true, t('on')], [false, t('off')]])}</div>
      <div class="set-row"><label>${t('music')}</label>${this.seg('music', [[true, t('on')], [false, t('off')]])}</div>
      <div class="set-row"><label>${t('control')}</label>${this.seg('control', [['drag', t('drag')], ['joystick', t('joystick')]])}</div></div>
      <div class="modal-actions col"><button class="btn btn-primary" data-act="resume">▶ ${t('resume')}</button><button class="btn btn-ghost" data-act="retry">↻ ${t('retry')}</button><button class="btn btn-ghost" data-act="quit">⌂ ${t('quit')}</button></div>`;
    m.classList.add('active');
  },

  /* ---------------- RESULTS ---------------- */
  results(r) {
    $('#hud').classList.add('hidden'); $('#boss-bar').classList.add('hidden');
    const win = r.outcome === 'victory';
    const title = r.mode === 'endless' ? (r.newBest ? t('newBest') : t('runOver')) : (win ? t('victory') : t('defeat'));
    const stars = r.stars ? `<div class="res-stars">${r.stars.map((s, i) => `<i class="${s ? 'on' : ''}" style="--d:${0.3 + i * 0.25}s">★</i>`).join('')}</div>` : '';
    const canNext = r.mode === 'campaign' && win && r.level.id < LEVELS.length;
    const ups = r.levelUps && r.levelUps.length ? `<div class="lvup">▲ ${t('levelUp', { n: r.levelUps[r.levelUps.length - 1] })}</div>` : '';
    const need = xpForLevel(Save.d.plv);
    $('#modal-results .modal-box').innerHTML = `
      <div class="res-head ${win || r.newBest ? 'win' : 'lose'}"><small>${r.mode === 'endless' ? t('endless') : `${t('level')} ${r.level.id}`}</small><h3>${title}</h3></div>
      ${stars}
      <div class="res-score"><label>${t('score')}</label><b id="res-score">0</b>${r.mode === 'endless' ? `<small>${t('best')}: ${fmt(Math.max(r.best, r.score))}</small>` : ''}</div>
      <div class="res-grid">
        <div><label>${t('kills')}</label><b>${r.kills}</b></div><div><label>${t('crystals')}</label><b>${r.crystals}</b></div>
        <div><label>${t('time')}</label><b>${fmtTime(r.time)}</b></div><div><label>${t('maxCombo')}</label><b>${r.maxCombo}</b></div>
      </div>
      <div class="res-earn"><div>💎 <b>+${fmt(r.credits)}</b></div><div>XP <b>+${fmt(r.xp)}</b></div></div>
      <div class="res-xp"><span>${t('pilot')} ${t('lv')} ${Save.d.plv}</span><div class="xpbar"><i style="width:${Math.min(100, Save.d.xp / need * 100)}%"></i></div></div>
      ${ups}
      <div class="modal-actions col">
        ${canNext ? `<button class="btn btn-primary" data-act="next">${t('next')} ›</button>` : ''}
        <button class="btn ${canNext ? 'btn-ghost' : 'btn-primary'}" data-act="retry">↻ ${t('retry')}</button>
        <div class="row2"><button class="btn btn-ghost" data-act="tohangar">🚀 ${t('hangar')}</button><button class="btn btn-ghost" data-act="quit">⌂ ${t('menu')}</button></div>
      </div>`;
    $('#modal-results').classList.add('active');
    // count-up score
    const el = $('#res-score'), target = r.score, t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 1100); el.textContent = fmt(target * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    audio.sfx(win || r.newBest ? 'victory' : 'defeat');
    if (r.levelUps && r.levelUps.length) setTimeout(() => { audio.sfx('mission'); }, 900);
    // achievements that just became claimable
    if (Save.claimableCount() > 0) setTimeout(() => this.toast(t('missions') + ' · ' + t('claim') + '!', '🎯'), 1400);
  }
};
