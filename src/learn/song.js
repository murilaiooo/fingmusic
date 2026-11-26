/**
 * Formato de dados de músicas e lições do Fingmusic — versão 1.
 * Documentado em docs/SONG_FORMAT.md. Uma mesma estrutura serve para
 * música, exercício, groove, desafio do Genius e composição do estúdio.
 */
import { getInstrument } from '../instruments/catalog.js';
import { noteName } from '../theory/music.js';

export const SONG_FORMAT = 'fingmusic-song';
export const SONG_VERSION = 1;
export const KINDS = { song: 'Música', exercise: 'Exercício', groove: 'Groove', riff: 'Riff', melody: 'Melodia', progression: 'Progressão', ear: 'Percepção', technique: 'Técnica' };

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "C#4" -> 61, "Bb2" -> 46 */
export function parseNote(s) {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(s.trim());
  if (!m) throw new Error('Nota inválida: ' + s);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/**
 * Notação compacta usada no conteúdo embutido:
 *   "E4 E4:0.5 [C4 E4 G4]:2 r:1 A3:1@0.4!slap |"
 *   nota[:duração][@força][!técnica] — duração em batidas (padrão 1);
 *   r = pausa; [...] = acorde; "|" é só separador visual.
 */
export function seq(text, start = 0, defaults = {}) {
  const out = []; let b = start;
  const tokens = text.replace(/\|/g, ' ').match(/\[[^\]]+\][^\s]*|\S+/g) ?? [];
  for (const tok of tokens) {
    const mm = /^(\[[^\]]+\]|[^:@!]+)(?::([\d.]+))?(?:@([\d.]+))?(?:!(\w+))?$/.exec(tok);
    if (!mm) throw new Error('Token inválido: ' + tok);
    const d = mm[2] ? Number(mm[2]) : defaults.d ?? 1, v = mm[3] ? Number(mm[3]) : defaults.v ?? 0.75, tech = mm[4] ?? defaults.tech;
    if (mm[1] !== 'r') {
      const notes = mm[1].startsWith('[') ? mm[1].slice(1, -1).trim().split(/\s+/) : [mm[1]];
      for (const n of notes) out.push({ b, d: d * (defaults.legato ?? 0.95), m: parseNote(n) + (defaults.transpose ?? 0), v, ...(tech ? { tech } : {}), ...(notes.length > 1 ? { chord: true } : {}) });
    }
    b += d;
  }
  return out;
}

/** Repete uma lista de notas deslocando `every` batidas. */
export const repeat = (notes, times, every) => Array.from({ length: times }, (_, k) => notes.map((n) => ({ ...n, b: n.b + k * every }))).flat();

export function makeSong(o) {
  return normalizeSong({ format: SONG_FORMAT, version: SONG_VERSION, kind: 'song', difficulty: 1, timeSig: [4, 4], key: { root: 0, scale: 'major' }, techniques: [], sections: [], license: 'original', ...o });
}

/** Normaliza e valida. Lança erro com mensagem amigável se inválido. */
export function normalizeSong(s) {
  const errs = validateSong(s);
  if (errs.length) throw new Error('Música inválida: ' + errs.join('; '));
  const song = { ...s, tempo: (s.tempo ?? [{ b: 0, bpm: s.bpm ?? 100 }]).map((t) => ({ b: t.b, bpm: t.bpm })) };
  song.tracks = s.tracks.map((t, i) => ({ id: t.id ?? 't' + i, name: t.name ?? 'Pista ' + (i + 1), role: t.role ?? 'melody', instrument: t.instrument ?? 'harp', volume: t.volume ?? 0.8, notes: [...t.notes].sort((a, b) => a.b - b.b || a.m - b.m) }));
  song.length = s.length ?? Math.ceil(Math.max(...song.tracks.flatMap((t) => t.notes.map((n) => n.b + (n.d ?? 0.5))), 1) / (song.timeSig[0] || 4)) * (song.timeSig[0] || 4);
  if (!song.sections?.length) song.sections = autoSections(song);
  song.defaultTrack = song.defaultTrack ?? song.tracks.find((t) => t.role === 'melody' || t.role === 'bass')?.id ?? song.tracks[0].id;
  return song;
}

export function validateSong(s) {
  const e = [];
  if (!s || typeof s !== 'object') return ['objeto ausente'];
  if (s.format && s.format !== SONG_FORMAT) e.push('formato desconhecido');
  if (s.version && s.version > SONG_VERSION) e.push('versão mais nova que o aplicativo');
  if (!s.title) e.push('título ausente');
  if (!Array.isArray(s.tracks) || !s.tracks.length) e.push('nenhuma pista');
  else s.tracks.forEach((t, i) => {
    if (!Array.isArray(t.notes)) e.push(`pista ${i + 1} sem notas`);
    else if (t.notes.some((n) => typeof n.b !== 'number' || typeof n.m !== 'number' || n.m < 0 || n.m > 127)) e.push(`pista ${i + 1} com nota inválida`);
  });
  return e;
}

/** Divide em frases de 2 compassos (ou 4 se curtas) para prática por trechos. */
export function autoSections(song) {
  const bar = song.timeSig?.[0] ?? 4, len = song.length ?? 16, per = len > 32 ? bar * 4 : bar * 2, out = [];
  for (let b = 0, k = 1; b < len; b += per, k++) out.push({ name: 'Frase ' + k, from: b, to: Math.min(len, b + per) });
  return out;
}

export function trackRange(track) {
  const ms = track.notes.map((n) => n.m);
  return ms.length ? { lo: Math.min(...ms), hi: Math.max(...ms) } : { lo: 60, hi: 60 };
}

/**
 * Verifica se a pista cabe no instrumento. Nunca altera notas sozinho:
 * devolve as opções explícitas para o usuário escolher.
 */
export function fitCheck(track, range) {
  const r = trackRange(track);
  const out = track.notes.filter((n) => n.m < range.lo || n.m > range.hi).length;
  if (!out) return { fits: true, out: 0, options: [] };
  const options = [];
  const span = r.hi - r.lo, room = range.hi - range.lo;
  if (span <= room) {
    const shiftUp = Math.ceil((range.lo - r.lo) / 12) * 12, shiftDown = -Math.ceil((r.hi - range.hi) / 12) * 12;
    const oct = r.lo < range.lo ? shiftUp : shiftDown;
    if (r.lo + oct >= range.lo && r.hi + oct <= range.hi) options.push({ id: 'octave', label: `Transpor ${oct > 0 ? '+' : ''}${oct / 12} oitava(s)`, semis: oct });
    const exact = r.lo < range.lo ? range.lo - r.lo : range.hi - r.hi;
    if (exact % 12) options.push({ id: 'transpose', label: `Transpor ${exact > 0 ? '+' : ''}${exact} semitons (muda o tom)`, semis: exact });
  }
  options.push({ id: 'fold', label: 'Dobrar notas fora da extensão para a oitava mais próxima', semis: 0 });
  options.push({ id: 'expand', label: `Expandir o instrumento (${noteName(Math.min(r.lo, range.lo))}–${noteName(Math.max(r.hi, range.hi))})`, semis: 0 });
  return { fits: false, out, range: r, options };
}
export function applyFit(track, option, range) {
  const t = { ...track, notes: track.notes.map((n) => ({ ...n })) };
  if (option.id === 'octave' || option.id === 'transpose') t.notes.forEach((n) => { n.m += option.semis; });
  if (option.id === 'fold') t.notes.forEach((n) => { while (n.m < range.lo) n.m += 12; while (n.m > range.hi) n.m -= 12; });
  t.adapted = option.id;
  return t;
}

/** Extensão útil de cada superfície/instrumento. */
export function instrumentRange(instId, opts = {}) {
  const inst = getInstrument(instId);
  if (inst.surface === 'fretboard') { const tun = inst.layout.tuning; return { lo: Math.min(...tun), hi: Math.max(...tun) + (inst.layout.frets ?? 12) }; }
  if (inst.surface === 'keys' || inst.surface === 'theremin') return { lo: 36, hi: 96 };
  if (inst.surface === 'pads') return { lo: 0, hi: 127 };
  return { lo: opts.lo ?? 36, hi: opts.hi ?? 96 }; // cordas livres se adaptam às notas da música
}

/** Converte uma sequência do Genius em música/exercício. */
export function songFromSequence(steps, { title = 'Sequência do Genius', instrument = 'harp', bpm = 90 } = {}) {
  let b = 0; const notes = [];
  for (const s of steps) { b += s.rest ?? 0; for (const m of Array.isArray(s.m) ? s.m : [s.m]) notes.push({ b, d: (s.d ?? 1) * 0.9, m, v: s.v ?? 0.7, ...(s.tech && s.tech !== 'finger' ? { tech: s.tech } : {}) }); b += s.d ?? 1; }
  return makeSong({ id: 'seq-' + Date.now().toString(36), title, kind: 'exercise', tempo: [{ b: 0, bpm }], tracks: [{ id: 'main', name: 'Sequência', role: 'melody', instrument, notes }], license: 'user' });
}
/** Converte notas de uma pista em passos do Genius (acordes agrupados). */
export function sequenceFromNotes(notes) {
  const sorted = [...notes].sort((a, b) => a.b - b.b), steps = [];
  for (let i = 0; i < sorted.length;) {
    const group = [sorted[i]]; let j = i + 1;
    while (j < sorted.length && Math.abs(sorted[j].b - sorted[i].b) < 0.06) group.push(sorted[j++]);
    const nextB = j < sorted.length ? sorted[j].b : sorted[i].b + (sorted[i].d ?? 1);
    steps.push({ m: group.length > 1 ? group.map((n) => n.m) : group[0].m, d: Math.max(0.25, nextB - sorted[i].b), rest: 0, v: group[0].v ?? 0.7, tech: group[0].tech ?? 'finger' });
    i = j;
  }
  return steps;
}
