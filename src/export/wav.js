/** Codificação WAV PCM 16 bits e renderização offline de sessões/músicas. */
import { buildMaster } from '../audio/engine.js';
import { Channel } from '../audio/channel.js';
import { ensureWorklets } from '../audio/dsp.js';
import { getInstrument } from '../instruments/catalog.js';
import { beatToSec, normalizeTempoMap, swingBeat } from '../core/timeline.js';

export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length;
  const out = new ArrayBuffer(44 + len * ch * 2), v = new DataView(out);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, len * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([out], { type: 'audio/wav' });
}

/**
 * Renderiza pistas offline usando o mesmo código das vozes e efeitos.
 * tracks: [{instrument, notes, volume, pan, mute, fx}], tempo: [{b,bpm}]
 */
export async function renderOffline({ tracks, tempo, lengthBeats, loops = 1, swing = 0, volume = 0.85, tail = 2.5, sampleRate = 44100, onProgress }) {
  const map = normalizeTempoMap(tempo);
  const totalBeats = lengthBeats * loops;
  const seconds = beatToSec(totalBeats, map) + tail;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
  await ensureWorklets(ctx);
  const master = buildMaster(ctx, ctx.destination, volume, 0.12);
  const anySolo = tracks.some((t) => t.solo);
  for (const t of tracks) {
    if (t.mute || (anySolo && !t.solo)) continue;
    const ch = new Channel(ctx, master.input, { instrument: getInstrument(t.instrument), volume: t.volume ?? 0.8, pan: t.pan ?? 0 });
    ch.setFxState(t.fx ?? {});
    ch.syncTempo(map[0].bpm);
    for (let k = 0; k < loops; k++) for (const n of t.notes) {
      const b = swingBeat(n.b, swing, 0.25) + k * lengthBeats;
      if (b >= totalBeats) continue;
      const when = beatToSec(b, map) + 0.05, end = beatToSec(b + (n.d ?? 0.5), map) + 0.05;
      ch.play({ midi: n.m, vel: n.v ?? 0.8, when, dur: end - when, pos: n.pos, tech: n.tech && !['soft', 'hard', 'pull', 'chord', 'sustain', 'ghost', 'slide', 'vibrato', 'bend'].includes(n.tech) ? n.tech : n.tech === 'ghost' ? 'mute' : null });
    }
  }
  onProgress?.(0.3);
  const buf = await ctx.startRendering();
  onProgress?.(1);
  return buf;
}
