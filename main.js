/* NEBULA 3.0 — boot */
'use strict';
let G = null;

window.addEventListener('load', () => {
  Save.load();
  document.documentElement.lang = LANG;
  audio.sfxOn = Save.d.settings.sound;
  audio.musicOn = Save.d.settings.music;
  G = new Game();
  const bar = document.querySelector('#load-fill');
  let fake = 0; const tick = setInterval(() => { fake = Math.min(90, fake + 7); if (bar) bar.style.width = fake + '%'; }, 80);
  loadImages(() => {
    clearInterval(tick); clearTimeout(IMG._fallback);
    if (bar) bar.style.width = '100%';
    buildSprites();
    UI.init();
    setTimeout(() => {
      G.state = 'menu';
      UI.showMenu();
    }, 250);
  });
  // first interaction unlocks audio (mobile autoplay rules)
  const unlock = () => { audio.init(); audio.setMusic(G.state === 'play' ? 'game' : G.state === 'menu' ? 'menu' : 'off'); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
});
