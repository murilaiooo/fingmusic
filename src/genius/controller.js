/**
 * Liga o GeniusGame (lógica pura) ao Fingmusic: o próprio instrumento
 * demonstra a sequência (luz + som + vibração da corda), bloqueia entradas
 * durante a demonstração, valida as notas tocadas e guarda recordes.
 */
import { Emitter } from '../core/emitter.js';
import { GeniusGame, DIFFICULTIES, MODES } from './game.js';
import { elementsFor, dailySeed, hashSeed } from './generator.js';
import { db } from '../persist/db.js';
import { uid } from '../core/util.js';

export const ACHIEVEMENTS = [
  { id: 'first', name: 'Primeira sequência', test: (r) => r.maxLength >= 3 },
  { id: 'ten', name: 'Dez seguidas', test: (r) => r.maxLength >= 10 },
  { id: 'twenty', name: 'Memória de elefante', test: (r) => r.maxLength >= 20 },
  { id: 'ear', name: 'Ouvido afiado', test: (r) => r.mode === 'blind' && r.maxLength >= 6 },
  { id: 'groove', name: 'No bolso', test: (r) => r.mode === 'bass' && r.maxLength >= 6 && (r.rhythm ?? 0) > 0.75 },
  { id: 'backwards', name: 'De trás pra frente', test: (r) => r.mode === 'reverse' && r.maxLength >= 8 },
  { id: 'clean', name: 'Sem erros', test: (r) => r.mistakes === 0 && r.maxLength >= 8 },
  { id: 'daily', name: 'Desafio do dia', test: (r) => r.daily && r.maxLength >= 5 },
];

export class GeniusController extends Emitter {
  constructor(app) {
    super();
    this.app = app;
    this.game = null;
    this.demoVoices = new Set(); this.demoTimers = new Set();
    this.options = { mode: 'classic', difficulty: 'beginner', sound: true, lights: true, players: 1, multi: null, twoHands: false };
  }

  /** Configura o instrumento com o número de elementos da dificuldade. */
  prepareSurface(diffId, mode) {
    const d = DIFFICULTIES[diffId], app = this.app;
    const surf = app.surface;
    if (mode === 'bass' || surf.constructor.name === 'FretboardSurface') return surf.elements().map((e) => e.midi).filter((m, i, a) => a.indexOf(m) === i).sort((a, b) => a - b).slice(0, 24);
    if (surf.constructor.name === 'PadsSurface') { const all = surf.kit.lanes.map((l) => l.m); const pick = all.slice(0, Math.min(all.length, d.elements)); surf.setNotes(pick); return pick; }
    const base = surf.constructor.name === 'KeysSurface' ? 60 : (app.currentInstrument.layout?.base ?? 55) + 7;
    const scale = mode === 'blind' && diffId === 'beginner' ? 'pentMajor' : app.music.scale === 'chromatic' ? 'pentMajor' : app.music.scale;
    const els = elementsFor(d.elements, app.music.root, scale, Math.max(36, Math.min(72, base)));
    surf.setNotes(els);
    return els;
  }

  start(opts = {}) {
    Object.assign(this.options, opts);
    this.stop();
    const o = this.options, app = this.app;
    const elements = o.elements ?? this.prepareSurface(o.difficulty, o.mode);
    let seed = o.seed ?? Math.floor(Math.random() * 1e9);
    if (o.daily) seed = dailySeed(new Date(), o.difficulty, o.mode).seed;
    let custom = o.customSequence ?? null;
    if (o.twoHands && !custom) {
      // duas mãos: alterna entre metade grave e aguda do instrumento
      const half = Math.ceil(elements.length / 2), low = elements.slice(0, half), high = elements.slice(half);
      const r = hashSeed('2h' + seed);
      custom = Array.from({ length: 48 }, (_, i) => { const set = i % 2 ? high : low; return { m: set[(r * (i + 3) + i * 7) % set.length], d: 1, rest: 0, v: 0.7, tech: 'finger' }; });
    }
    this.seed = seed;
    const timers = new Set();
    this.game = new GeniusGame({
      mode: o.mode, difficulty: o.difficulty, seed, elements, root: app.music.root, scale: app.music.scale,
      now: () => app.engine.now,
      after: (sec, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, sec * 1000); timers.add(id); return () => { clearTimeout(id); timers.delete(id); }; },
      players: o.players, multi: o.multi, customSequence: custom, startLength: o.startLength, genre: o.genre,
      techniques: app.surface.capabilities().filter((t) => ['soft', 'hard', 'pull', 'slap', 'pop', 'mute', 'harmonic'].includes(t)),
    });
    this.timers = timers;
    const g = this.game;
    g.on('state', (s) => this.onState(s));
    g.on('hit', (h) => { app.lighting.flash({ midi: h.ev.midi, key: h.ev.target }, 'hit'); this.emit('hit', h); });
    g.on('miss', (m) => { app.lighting.flash({ midi: m.ev.midi, key: m.ev.target }, 'miss'); app.haptics.pulse(0.9); this.emit('miss', m); });
    g.on('hint', (h) => this.showHint(h.expected));
    this.offInput = app.performer.on('noteon', (ev) => { if (g.state === 'composing') g.compose(ev); else g.input(ev); });
    this.offBlocked = app.performer.on('blocked', () => this.emit('blocked'));
    g.start();
    this.emit('start', { game: g, seed, elements });
  }

  onState(s) {
    const app = this.app;
    app.performer.locked = !['awaiting', 'composing', 'idle', 'gameOver'].includes(s.to);
    if (s.to !== 'demonstrating') this.stopDemo();
    if (s.to === 'demonstrating') this.demonstrate(s.timeline);
    if (s.to === 'gameOver') this.saveResult(s.result);
    this.emit('state', s);
  }

  demonstrate(tl) {
    this.stopDemo();
    const app = this.app, g = this.game, ch = app.performer.channel;
    const t0 = app.engine.now + 0.15;
    app.lighting.clear();
    const lightsOn = g.showLights && this.options.lights !== false;
    tl.items.forEach((it, i) => {
      const notes = Array.isArray(it.step.m) ? it.step.m : [it.step.m];
      for (const m of notes) {
        if (this.options.sound !== false) {
          const v = ch.play({ midi: m, vel: it.step.v ?? 0.75, when: t0 + it.at, dur: it.dur, tech: ['slap', 'pop', 'mute', 'harmonic'].includes(it.step.tech) ? it.step.tech : it.step.tech === 'ghost' ? 'mute' : null });
          if (v?.kill) this.demoVoices.add(v);
        }
        if (lightsOn) app.lighting.add({ midi: m, key: app.surface.keyFor?.(m) ?? null, t: t0 + it.at, dur: it.dur, vel: it.step.v ?? 0.75, tech: it.step.tech ?? 'finger', demo: true });
      }
      // a corda vibra junto com o som
      if (lightsOn) { const id = setTimeout(() => { this.demoTimers.delete(id); this.emit('demo-note', { notes, index: i }); }, (it.at + 0.15) * 1000); this.demoTimers.add(id); }
    });
    app.lighting.anticipation = 0; // uma nota de cada vez, sem revelar a seguinte
  }
  stopDemo() {
    for (const v of this.demoVoices) v.kill?.(); this.demoVoices.clear();
    for (const id of this.demoTimers) clearTimeout(id); this.demoTimers.clear();
    this.app.lighting.clear();
  }
  showHint(step) {
    const notes = Array.isArray(step.m) ? step.m : [step.m];
    for (const m of notes) this.app.lighting.add({ midi: m, key: this.app.surface.keyFor?.(m) ?? null, t: this.app.engine.now + 0.05, dur: 0.6, vel: step.v ?? 0.7, tech: step.tech ?? 'finger' });
  }

  pause() { this.game?.pause(); }
  resume() { this.game?.resume(); }
  replay() { return this.game?.replay(); }
  stop() {
    if (this.game) this.game.stop();
    for (const id of this.timers ?? []) clearTimeout(id);
    this.offInput?.(); this.offBlocked?.();
    this.app.performer.locked = false;
    this.stopDemo();
    this.app.lighting.anticipation = this.app.settings.anticipation;
    this.game = null;
  }

  recordKey(mode = this.options.mode, diff = this.options.difficulty) { return `${mode}|${diff}`; }
  async saveResult(result) {
    const r = { ...result, id: uid('gm'), at: Date.now(), daily: !!this.options.daily, instrument: this.app.currentInstrument.id, players: this.options.players };
    if (this.options.daily) r.dailyDate = dailySeed(new Date(), r.difficulty, r.mode).date;
    let records = {};
    try {
      await db.put('genius', r);
      const rec = (await db.get('kv', 'genius-records'))?.value ?? {};
      const key = this.recordKey(r.mode, r.difficulty), prev = rec[key];
      const isRecord = !prev || r.maxLength > prev.maxLength || (r.maxLength === prev.maxLength && r.score > prev.score);
      if (isRecord) rec[key] = { maxLength: r.maxLength, score: r.score, at: r.at };
      const ach = (await db.get('kv', 'genius-achievements'))?.value ?? {};
      const unlocked = ACHIEVEMENTS.filter((a) => !ach[a.id] && a.test(r));
      for (const a of unlocked) ach[a.id] = r.at;
      await db.put('kv', { id: 'genius-records', value: rec });
      await db.put('kv', { id: 'genius-achievements', value: ach });
      records = rec;
      this.emit('saved', { result: r, isRecord, unlocked, records });
    } catch (e) { this.emit('saved', { result: r, isRecord: false, unlocked: [], records, error: e.message }); }
  }
  async records() { try { return (await db.get('kv', 'genius-records'))?.value ?? {}; } catch { return {}; } }
  async history() { try { return (await db.all('genius')).sort((a, b) => b.at - a.at).slice(0, 50); } catch { return []; } }
  async achievements() { try { return (await db.get('kv', 'genius-achievements'))?.value ?? {}; } catch { return {}; } }

  /** Resumo compartilhável (sem servidor, sem ranking). */
  shareText(r) {
    const d = DIFFICULTIES[r.difficulty]?.name ?? r.difficulty, m = MODES[r.mode]?.name ?? r.mode;
    const dots = '●'.repeat(Math.min(20, r.maxLength)) + (r.maxLength > 20 ? '+' : '');
    return `Fingmusic Genius${r.daily ? ' · desafio de ' + (r.dailyDate ?? '') : ''}\n${m} · ${d}\nSequência: ${r.maxLength} ${dots}\nPontos: ${r.score}\nCódigo: FM-${r.mode}-${r.difficulty}-${this.seed}`;
  }
}
