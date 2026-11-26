/**
 * Ponto de entrada: cria o App, a casca da interface, registra os modos,
 * monta a tela inicial e o service worker (PWA offline).
 */
import { App } from './app.js';
import { Shell } from './ui/shell.js';
import { h, icon } from './ui/dom.js';
import { toast } from './ui/sheet.js';
import { Coach } from './ui/coach.js';
import { openMenuSheet, openSettingsSheet } from './ui/panels.js';
import { playMode } from './modes/play.js';
import { learnMode } from './modes/learn.js';
import { geniusMode } from './modes/genius.js';
import { studioMode } from './modes/studio.js';
import { createMode } from './modes/create.js';
import { playgroundMode } from './modes/playground.js';

const canvas = document.getElementById('stage');
const app = new App(canvas);
const ui = new Shell(app);
ui.coach = new Coach(app);
if (app.settings.highContrast) document.documentElement.dataset.contrast = 'high';

ui.register('home', { enter() { app.setSurfaceOptions({}); } });
ui.register('play', playMode(ui));
ui.register('learn', learnMode(ui));
ui.register('genius', geniusMode(ui));
ui.register('studio', studioMode(ui));
ui.register('create', createMode(ui));
ui.register('playground', playgroundMode(ui));

// ───────────── tela inicial (o instrumento continua tocável por trás)
const MODES = [
  ['play', 'harp', 'Tocar', 'Modo livre, acordes e jam', true],
  ['learn', 'book', 'Aprender', 'Siga as luzes e aprenda músicas'],
  ['genius', 'brain', 'Genius', 'Memória musical no instrumento'],
  ['studio', 'studio', 'Estúdio', 'Loops, bateria e exportação'],
  ['create', 'pen', 'Criar', 'Instrumentos, lições e desafios'],
  ['playground', 'orbit', 'Playground', 'Orbes, gravidade e surpresas'],
];
const home = h('main#home', { 'aria-label': 'Início' },
  h('div.hero-top', {}, h('div', {}, h('h1', {}, 'Fingmusic'), h('p.tagline', {}, 'Instrumentos de luz para tocar com os dedos ou com as mãos no ar.')),
    h('div.row', {}, h('button.btn.icon-only', { type: 'button', 'aria-label': 'Configurações', onclick: () => openSettingsSheet(ui) }, icon('gear')), h('button.btn.icon-only', { type: 'button', 'aria-label': 'Menu', onclick: () => openMenuSheet(ui) }, icon('menu')))),
  h('div.hint', {}, 'toque nas cordas'),
  h('div', {},
    h('nav.modes', {}, ...MODES.map(([id, ic, name, desc, main]) => h('button.mode' + (main ? '.main' : ''), { type: 'button', onclick: () => { app.engine.unlock(); ui.go(id); } }, icon(ic), h('b', {}, name), h('small', {}, desc)))),
    h('div.foot', {}, h('span', {}, 'Tudo sintetizado no aparelho · funciona offline'), h('span', { id: 'ver' }, 'v' + (import.meta.env?.VITE_VERSION ?? '4.0')))),
);
document.body.append(home);

// links profundos: #learn, #genius, #studio, #genius=CODIGO (desafio de amigo)
function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash) { ui.go('home'); return; }
  const [id, arg] = hash.split('=');
  if (id === 'genius' && arg) ui.go('genius', { challengeCode: arg });
  else if (ui.modes[id]) ui.go(id);
  else ui.go('home');
}
route();
addEventListener('hashchange', route);

// iOS: retomar áudio após interrupções (ligação, Siri, troca de app)
app.engine.on('state', (st) => { if (st === 'interrupted' || st === 'suspended') app.wasInterrupted = true; });
document.addEventListener('visibilitychange', () => { if (!document.hidden && app.wasInterrupted) { app.wasInterrupted = false; toast('Toque para reativar o som'); } });

// ───────────── PWA
if ('serviceWorker' in navigator && import.meta.env?.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nova versão disponível: feche e abra o app para atualizar', 5000); });
      });
    }).catch(() => { /* sem SW (ex.: navegação privada) */ });
  });
}
window.fingmusic = app; // depuração no console
