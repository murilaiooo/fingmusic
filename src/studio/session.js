/**
 * Jam Studio: sessão com várias pistas em loop, gravação com contagem
 * regressiva, overdub, quantização, mute/solo, volume/pan, desfazer/refazer,
 * edição básica e exportação (WAV e MIDI).
 */
import { Emitter } from '../core/emitter.js';
import { uid, deepClone } from '../core/util.js';
import { quantize, swingBeat } from '../core/timeline.js';
import { getInstrument } from '../instruments/catalog.js';
import { writeMidi } from '../core/midi.js';
import { renderOffline, encodeWav } from '../export/wav.js';

const COLORS = [262, 152, 32, 330, 196, 92, 12, 286];
const GM_PROGRAM = { harp: 46, harpAmbient: 46, nylon: 24, steel: 25, electricClean: 27, overdrive: 29, distortion: 30, ambientGuitar: 27, ukulele: 24, cavaquinho: 25, koto: 107, sitar: 104,
  bassFinger: 33, bassSlap: 36, bassPop: 37, bassPick: 34, fretless: 35, funkBass: 33, synthBass: 38, subBass: 38, bass808: 38, distBass: 34,
  piano: 0, epiano: 4, organ: 16, marimba: 12, vibraphone: 11, kalimba: 108, bells: 14, synthLead: 81, pad: 89, spaceSynth: 90, pluckSynth: 84, theremin: 79 };

export function newSession(o = {}) {
  return { id: uid('ses'), name: o.name ?? 'Nova sessão', bpm: o.bpm ?? 100, bars: o.bars ?? 4, swing: 0, quantize: 0.25, key: o.key ?? { root: 0, scale: 'pentMajor' }, tracks: [], createdAt: Date.now() };
}
export function newTrack(instrument, o = {}) {
  const inst = getInstrument(instrument);
  return { id: uid('trk'), name: o.name ?? inst.name, instrument, notes: [], volume: 0.8, pan: 0, mute: false, solo: false, fx: o.fx ?? {}, hue: o.hue ?? inst.hue };
}

export class Studio extends Emitter {
  constructor(app) {
    super();
    this.app = app;
    this.session = newSession();
    this.channels = new Map();
    this.armed = null;
    this.recording = false;
    this.pending = [];
    this.undoStack = []; this.redoStack = [];
    this.countIn = true;
    this.quantizeOnRecord = true;
    this.offPerf = [];
    app.transport.addPart(this);
    app.transport.on('wrap', () => this.mergePending());
    app.transport.on('stop', () => { this.mergePending(); if (this.recording) this.stopRecording(); });
  }
  get loopBeats() { return this.session.bars * 4; }

  // ───────────── pistas e canais
  channelFor(track) {
    let ch = this.channels.get(track.id);
    if (!ch && this.app.engine.ready) {
      ch = this.app.engine.createChannel({ instrument: getInstrument(track.instrument), volume: track.volume, pan: track.pan });
      ch.setFxState(track.fx); ch.syncTempo(this.session.bpm); ch.tune(this.session.key.root);
      this.channels.set(track.id, ch);
    }
    return ch;
  }
  syncChannels() {
    const anySolo = this.session.tracks.some((t) => t.solo);
    for (const t of this.session.tracks) {
      const ch = this.channelFor(t); if (!ch) continue;
      ch.setInstrument(getInstrument(t.instrument)); ch.setVolume(t.volume); ch.setPan(t.pan); ch.setMute(t.mute || (anySolo && !t.solo));
    }
    for (const [id, ch] of this.channels) if (!this.session.tracks.some((t) => t.id === id)) { ch.dispose(); this.channels.delete(id); }
  }
  addTrack(instrument, o) {
    this.snapshot();
    const t = newTrack(instrument, { hue: COLORS[this.session.tracks.length % COLORS.length], ...o });
    this.session.tracks.push(t); this.syncChannels(); this.arm(t.id); this.changed();
    return t;
  }
  removeTrack(id) { this.snapshot(); this.session.tracks = this.session.tracks.filter((t) => t.id !== id); if (this.armed === id) this.armed = this.session.tracks[0]?.id ?? null; this.syncChannels(); this.changed(); }
  duplicateTrack(id) { const t = this.track(id); if (!t) return; this.snapshot(); const c = { ...deepClone(t), id: uid('trk'), name: t.name + ' (cópia)' }; this.session.tracks.splice(this.session.tracks.indexOf(t) + 1, 0, c); this.syncChannels(); this.changed(); }
  track(id) { return this.session.tracks.find((t) => t.id === id); }
  update(id, patch, undoable = false) { const t = this.track(id); if (!t) return; if (undoable) this.snapshot(); Object.assign(t, patch); this.syncChannels(); if (patch.fx) this.channelFor(t)?.setFxState(t.fx); this.changed(); }
  arm(id) { this.armed = id; this.emit('arm', id); }
  setBpm(b) { this.session.bpm = b; this.app.transport.setBpm(b); for (const ch of this.channels.values()) ch.syncTempo(b); this.changed(); }
  setBars(n) { this.snapshot(); this.session.bars = n; this.app.transport.setLoop(0, this.loopBeats); for (const t of this.session.tracks) t.notes = t.notes.filter((x) => x.b < this.loopBeats); this.changed(); }

  // ───────────── reprodução (parte do transporte)
  schedule(from, to, toTime) {
    if (this.app.transportOwner !== 'studio') return;
    const anySolo = this.session.tracks.some((t) => t.solo);
    for (const t of this.session.tracks) {
      if (t.mute || (anySolo && !t.solo)) continue;
      const ch = this.channelFor(t); if (!ch) continue;
      for (const n of t.notes) {
        const b = swingBeat(n.b, this.session.swing, 0.25);
        if (b >= from && b < to) {
          const when = toTime(b), end = toTime(b + (n.d ?? 0.5));
          const tech = n.tech === 'ghost' ? 'mute' : ['soft', 'hard', 'pull', 'chord', 'sustain', 'slide', 'vibrato', 'bend'].includes(n.tech) ? null : n.tech;
          ch.play({ midi: n.m, vel: n.v ?? 0.8, when, dur: Math.max(0.05, end - when), pos: n.pos, tech });
          this.emit('note', { track: t.id, note: n, when });
        }
      }
    }
  }
  silence() {}

  play() { const tr = this.app.transport; this.syncChannels(); tr.setBpm(this.session.bpm); tr.setLoop(0, this.loopBeats); tr.start(); this.emit('transport', 'play'); }
  stop() { this.app.transport.stop(); this.emit('transport', 'stop'); }

  // ───────────── gravação
  startRecording() {
    if (!this.armed) { const inst = this.app.currentInstrument?.id ?? 'harp'; this.addTrack(inst); }
    this.snapshot();
    const tr = this.app.transport;
    this.syncChannels();
    this.recording = true;
    this.app.performer.setChannel(this.channelFor(this.track(this.armed)));
    if (!tr.playing) { tr.setBpm(this.session.bpm); tr.setLoop(0, this.loopBeats); tr.start({ countIn: this.countIn ? 4 : 0 }); }
    this.offPerf.forEach((f) => f());
    this.offPerf = [
      this.app.performer.on('noteon', (ev) => this.capture(ev)),
      this.app.performer.on('noteoff', (ev) => this.captureOff(ev)),
    ];
    this.emit('record', true);
  }
  stopRecording() {
    this.recording = false; this.offPerf.forEach((f) => f()); this.offPerf = [];
    this.mergePending(); this.emit('record', false); this.changed();
  }
  capture(ev) {
    if (!this.recording || ev.source === 'toy' && false) return;
    const tr = this.app.transport;
    if (!tr.playing) return;
    let b = tr.beatAt(ev.time);
    if (tr.countInEnd != null && b < 0) return; // ainda na contagem
    if (this.quantizeOnRecord && this.session.quantize) b = quantize(b, this.session.quantize);
    b = ((b % this.loopBeats) + this.loopBeats) % this.loopBeats;
    if (ev.silent) return;
    const t = this.track(this.armed); if (!t) return;
    if (ev.inst !== t.instrument) return;
    const n = { b, m: ev.midi, v: Math.round(ev.vel * 100) / 100, d: 0.5, ...(ev.tech && ev.tech !== 'finger' ? { tech: ev.tech } : {}), ...(ev.pos != null ? { pos: ev.pos } : {}) };
    n._id = ev.id;
    this.pending.push(n);
    this.emit('captured', n);
  }
  captureOff(ev) {
    const n = this.pending.find((x) => x._id === ev.id) ?? this.track(this.armed)?.notes.find((x) => x._id === ev.id);
    if (n) n.d = Math.max(0.1, Math.min(this.loopBeats, ev.dur * this.session.bpm / 60));
  }
  mergePending() {
    if (!this.pending.length) return;
    const t = this.track(this.armed);
    if (t) { t.notes.push(...this.pending); t.notes.sort((a, b) => a.b - b.b); if (t.notes.length > 4000) t.notes.splice(0, t.notes.length - 4000); }
    this.pending = []; this.changed();
  }

  // ───────────── edição
  quantizeTrack(id, grid = this.session.quantize || 0.25) { const t = this.track(id); if (!t) return; this.snapshot(); t.notes.forEach((n) => { n.b = ((quantize(n.b, grid) % this.loopBeats) + this.loopBeats) % this.loopBeats; }); this.changed(); }
  clearTrack(id) { const t = this.track(id); if (!t) return; this.snapshot(); t.notes = []; this.changed(); }
  transposeTrack(id, semis) { const t = this.track(id); if (!t || getInstrument(t.instrument).engine === 'drum') return; this.snapshot(); t.notes.forEach((n) => { n.m = Math.max(0, Math.min(127, n.m + semis)); }); this.changed(); }
  toggleNote(id, b, m, d = 0.25) {
    const t = this.track(id); if (!t) return;
    this.snapshot();
    const i = t.notes.findIndex((n) => n.m === m && Math.abs(n.b - b) < 0.01);
    if (i >= 0) t.notes.splice(i, 1); else { t.notes.push({ b, m, v: 0.85, d }); t.notes.sort((a, c) => a.b - c.b); }
    this.changed();
  }
  deleteNote(id, note) { const t = this.track(id); if (!t) return; this.snapshot(); t.notes = t.notes.filter((n) => n !== note); this.changed(); }
  setNotes(id, notes, undoable = true) { const t = this.track(id); if (!t) return; if (undoable) this.snapshot(); t.notes = notes; this.changed(); }

  // ───────────── desfazer / refazer
  snapshot() { this.undoStack.push(JSON.stringify(this.session)); if (this.undoStack.length > 50) this.undoStack.shift(); this.redoStack = []; this.emit('history'); }
  undo() { if (!this.undoStack.length) return; this.redoStack.push(JSON.stringify(this.session)); this.restore(JSON.parse(this.undoStack.pop())); }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(JSON.stringify(this.session)); this.restore(JSON.parse(this.redoStack.pop())); }
  restore(s) { this.session = s; if (!this.track(this.armed)) this.armed = s.tracks[0]?.id ?? null; this.syncChannels(); this.app.transport.setLoop(0, this.loopBeats); this.changed(); this.emit('history'); }
  load(s) { this.undoStack = []; this.redoStack = []; this.restore(s); }
  changed() { this.emit('change', this.session); }

  // ───────────── exportação
  async exportWav(loops = 2, onProgress) {
    const s = this.session;
    const buf = await renderOffline({ tracks: s.tracks, tempo: [{ b: 0, bpm: s.bpm }], lengthBeats: this.loopBeats, loops, swing: s.swing, onProgress });
    return encodeWav(buf);
  }
  exportMidi() {
    const s = this.session; let ch = 0;
    const tracks = s.tracks.map((t) => {
      const drum = getInstrument(t.instrument).engine === 'drum';
      const c = drum ? 9 : ch++ % 16 === 9 ? ch++ : (ch - 1);
      return { name: t.name, channel: drum ? 9 : c, program: GM_PROGRAM[t.instrument] ?? 0, notes: t.notes.map((n) => ({ ...n, b: swingBeat(n.b, s.swing, 0.25) })) };
    });
    return new Blob([writeMidi({ title: s.name, tempo: [{ b: 0, bpm: s.bpm }], tracks })], { type: 'audio/midi' });
  }
}
