/**
 * Leitura e escrita de arquivos MIDI padrão (SMF formato 0 e 1).
 * Suporta mudanças de andamento, múltiplas pistas, canal 10 (bateria),
 * running status, program change e note-on com velocidade 0 como note-off.
 */

// ───────────── escrita
function vlq(n) { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; }
const str = (s) => [...s].map((c) => c.charCodeAt(0) & 0x7f);
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];

/**
 * song: { tempo:[{b,bpm}], timeSig:[n,d], tracks:[{name, channel, program, notes:[{b,d,m,v}]}] }
 */
export function writeMidi(song, ppq = 480) {
  const chunks = [];
  // pista de andamento
  const tempoEv = [];
  for (const t of song.tempo ?? [{ b: 0, bpm: 120 }]) {
    const us = Math.round(60000000 / t.bpm);
    tempoEv.push({ tick: Math.round(t.b * ppq), data: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] });
  }
  const [num, den] = song.timeSig ?? [4, 4];
  tempoEv.unshift({ tick: 0, data: [0xff, 0x58, 4, num, Math.log2(den), 24, 8] });
  chunks.push(track(tempoEv, song.title ?? 'Fingmusic'));
  for (const tr of song.tracks) {
    const ch = tr.channel ?? 0, ev = [];
    if (ch !== 9 && tr.program != null) ev.push({ tick: 0, data: [0xc0 | ch, tr.program & 127] });
    for (const n of tr.notes) {
      const on = Math.max(0, Math.round(n.b * ppq)), off = Math.max(on + 1, Math.round((n.b + Math.max(0.05, n.d ?? 0.25)) * ppq));
      const vel = Math.max(1, Math.min(127, Math.round((n.v ?? 0.8) * 127)));
      ev.push({ tick: on, data: [0x90 | ch, n.m & 127, vel], ord: 1 });
      ev.push({ tick: off, data: [0x80 | ch, n.m & 127, 0], ord: 0 });
    }
    chunks.push(track(ev, tr.name ?? 'Pista'));
  }
  const header = [...str('MThd'), ...u32(6), ...u16(1), ...u16(chunks.length), ...u16(ppq)];
  return new Uint8Array([...header, ...chunks.flat()]);
}
function track(events, name) {
  events.sort((a, b) => a.tick - b.tick || (a.ord ?? 0) - (b.ord ?? 0));
  const nameBytes = str(name).slice(0, 60);
  const bytes = [0, 0xff, 0x03, ...vlq(nameBytes.length), ...nameBytes];
  let last = 0;
  for (const e of events) { bytes.push(...vlq(e.tick - last), ...e.data); last = e.tick; }
  bytes.push(0, 0xff, 0x2f, 0);
  return [...str('MTrk'), ...u32(bytes.length), ...bytes];
}

// ───────────── leitura
export function parseMidi(buffer) {
  const d = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  let p = 0;
  const id = () => String.fromCharCode(d.getUint8(p), d.getUint8(p + 1), d.getUint8(p + 2), d.getUint8(p + 3));
  if (id() !== 'MThd') throw new Error('Arquivo não é MIDI (cabeçalho MThd ausente).');
  const hlen = d.getUint32(p + 4); const format = d.getUint16(p + 8), ntr = d.getUint16(p + 10), div = d.getUint16(p + 12);
  if (div & 0x8000) throw new Error('MIDI com divisão SMPTE não é suportado.');
  const ppq = div; p += 8 + hlen;
  const tempos = [], tracks = []; let timeSig = [4, 4];
  for (let t = 0; t < ntr && p < d.byteLength; t++) {
    while (p < d.byteLength && id() !== 'MTrk') { p += 8 + d.getUint32(p + 4); }
    if (p >= d.byteLength) break;
    const len = d.getUint32(p + 4); let q = p + 8; const end = q + len; p = end;
    let tick = 0, status = 0, name = '';
    const open = new Map(); const chans = new Map(); // ch -> {program, notes}
    const chan = (c) => { if (!chans.has(c)) chans.set(c, { program: null, notes: [] }); return chans.get(c); };
    const readVar = () => { let v = 0, b; do { b = d.getUint8(q++); v = (v << 7) | (b & 0x7f); } while (b & 0x80 && q < end); return v; };
    while (q < end) {
      tick += readVar();
      let b = d.getUint8(q);
      if (b & 0x80) { status = b; q++; } else if (!status) throw new Error('MIDI malformado (running status sem status).');
      const type = status & 0xf0, c = status & 0x0f;
      if (status === 0xff) {
        const mt = d.getUint8(q++); const ml = readVar(); const data = new Uint8Array(d.buffer, d.byteOffset + q, ml); q += ml;
        if (mt === 0x51 && ml === 3) tempos.push({ tick, bpm: 60000000 / ((data[0] << 16) | (data[1] << 8) | data[2]) });
        else if (mt === 0x03 || (mt === 0x04 && !name)) name = String.fromCharCode(...data).replace(/[^\x20-\x7e -ÿ]/g, '').trim();
        else if (mt === 0x58) timeSig = [data[0], 2 ** data[1]];
        else if (mt === 0x2f) break;
        status = 0;
      } else if (status === 0xf0 || status === 0xf7) { q += readVar(); status = 0; }
      else if (type === 0x90 || type === 0x80) {
        const note = d.getUint8(q++), vel = d.getUint8(q++), k = c * 128 + note;
        if (type === 0x90 && vel > 0) { if (!open.has(k)) open.set(k, []); open.get(k).push({ tick, vel }); }
        else { const st = open.get(k); const on = st?.shift(); if (on) chan(c).notes.push({ t0: on.tick, t1: tick, m: note, v: on.vel / 127 }); }
      } else if (type === 0xc0) { chan(c).program = d.getUint8(q++); }
      else if (type === 0xd0) q += 1;
      else q += 2; // 0xa0, 0xb0, 0xe0
    }
    // notas sem note-off: fecha no fim da pista
    for (const [k, arr] of open) for (const on of arr) chan(Math.floor(k / 128)).notes.push({ t0: on.tick, t1: Math.max(on.tick + ppq / 4, tick), m: k % 128, v: on.vel / 127 });
    for (const [c, info] of chans) {
      if (!info.notes.length) continue;
      info.notes.sort((a, b) => a.t0 - b.t0 || a.m - b.m);
      tracks.push({
        name: name || (c === 9 ? 'Bateria' : 'Pista ' + (tracks.length + 1)) + (chans.size > 1 && name ? ` (canal ${c + 1})` : ''),
        channel: c, program: info.program, isDrum: c === 9,
        notes: info.notes.map((n) => ({ b: n.t0 / ppq, d: Math.max(0.05, (n.t1 - n.t0) / ppq), m: n.m, v: Math.round(n.v * 100) / 100 })),
      });
    }
  }
  tempos.sort((a, b) => a.tick - b.tick);
  const tempo = tempos.length ? tempos.map((t) => ({ b: t.tick / ppq, bpm: Math.round(t.bpm * 100) / 100 })) : [{ b: 0, bpm: 120 }];
  if (tempo[0].b > 0) tempo.unshift({ b: 0, bpm: 120 });
  return { format, ppq, tempo, timeSig, tracks };
}

/** Programa General MIDI -> instrumento do Fingmusic. */
export function instrumentForProgram(program, isDrum) {
  if (isDrum) return 'drumsAcoustic';
  const p = program ?? 0;
  if (p <= 3) return 'piano'; if (p <= 5) return 'epiano'; if (p <= 7) return 'piano';
  if (p === 11) return 'vibraphone'; if (p === 12 || p === 13) return 'marimba'; if (p <= 15) return 'bells';
  if (p <= 23) return 'organ'; if (p === 24) return 'nylon'; if (p === 25) return 'steel'; if (p <= 28) return 'electricClean';
  if (p === 29) return 'overdrive'; if (p <= 31) return 'distortion';
  if (p === 32 || p === 33) return 'bassFinger'; if (p === 34) return 'bassPick'; if (p === 35) return 'fretless'; if (p <= 37) return 'bassSlap'; if (p <= 39) return 'synthBass';
  if (p === 46) return 'harp'; if (p <= 55) return 'pad'; if (p <= 87) return 'synthLead'; if (p <= 95) return 'pad';
  if (p === 104) return 'sitar'; if (p === 105) return 'steel'; if (p === 107) return 'koto'; if (p === 108) return 'kalimba'; if (p >= 112 && p <= 119) return 'bells';
  return 'synthLead';
}
