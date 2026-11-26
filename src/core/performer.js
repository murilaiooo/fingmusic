/**
 * Performer: ponto único por onde passa toda nota tocada ao vivo, venha ela
 * do toque, mouse, teclado ou das mãos na câmera. Produz o som no canal ativo
 * e publica um evento de entrada padronizado:
 *
 *   { id, midi, vel, tech, time, source, target, inst, dur? }
 *
 * - time: tempo de áudio (AudioContext) do ataque; dur preenchido no noteoff.
 * - tech: técnica reconhecida (finger, pick, slap, pop, mute, harmonic,
 *   hammer, pull, snap, soft, hard...). Técnicas aplicadas depois do ataque
 *   (slide, bend, vibrato) chegam como evento 'technique'.
 *
 * O mesmo evento alimenta o gravador do estúdio, o Follow the Lights e o Genius.
 */
import { Emitter } from './emitter.js';

let seq = 0;
export class Performer extends Emitter {
  constructor(engine) {
    super();
    this.engine = engine;
    this.channel = null;
    this.locked = false; // ex.: Genius durante a demonstração
    this.monitor = true; // false = só avalia, não soa (modo sem áudio)
    this.held = new Map();
    this.recent = [];
  }
  setChannel(ch) { this.channel = ch; }

  noteOn({ midi, vel = 0.7, pos = null, tech = null, pan = 0, source = 'touch', target = null, dur = null, silent = false, inst = null }) {
    if (!this.engine.ready || !this.channel) return null;
    if (this.locked) { this.emit('blocked', { midi, source }); return null; }
    const time = this.engine.now;
    const voice = this.monitor && !silent ? this.channel.play({ midi, vel, pos, tech: tech === 'soft' || tech === 'hard' || tech === 'pull' || tech === 'slide' ? (this.channel.inst.tech ?? null) : tech, pan, dur, inst }) : null;
    const ev = { id: ++seq, midi, vel, tech: tech ?? this.channel.inst.tech ?? 'finger', time, source, target, inst: this.channel.inst.id, pos };
    this.held.set(ev.id, ev);
    this.recent.push(midi); if (this.recent.length > 8) this.recent.shift();
    this.emit('noteon', ev);
    return { voice, ev };
  }
  noteOff(ev) {
    if (!ev || !this.held.has(ev.id)) return;
    this.held.delete(ev.id);
    const out = { ...ev, dur: this.engine.now - ev.time };
    this.emit('noteoff', out);
  }
  technique(ev, tech, amount = 1) { if (ev) this.emit('technique', { ...ev, tech, amount, at: this.engine.now }); }
}
