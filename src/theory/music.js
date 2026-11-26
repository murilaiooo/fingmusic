/**
 * Teoria musical: nomes de notas, escalas, acordes e progressões.
 * Todas as funções são puras (testáveis sem navegador).
 */
export const NOTE_NAMES = ['Dó', 'Dó♯', 'Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si'];
export const NOTE_LETTERS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const SCALES = {
  major: { name: 'Maior', steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Menor natural', steps: [0, 2, 3, 5, 7, 8, 10] },
  pentMajor: { name: 'Pentatônica maior', steps: [0, 2, 4, 7, 9] },
  pentMinor: { name: 'Pentatônica menor', steps: [0, 3, 5, 7, 10] },
  blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  dorian: { name: 'Dórico', steps: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { name: 'Mixolídio', steps: [0, 2, 4, 5, 7, 9, 10] },
  harmonicMinor: { name: 'Menor harmônica', steps: [0, 2, 3, 5, 7, 8, 11] },
  phrygianDom: { name: 'Frígio dominante', steps: [0, 1, 4, 5, 7, 8, 10] },
  japanese: { name: 'Japonesa (In)', steps: [0, 1, 5, 7, 8] },
  wholeTone: { name: 'Tons inteiros', steps: [0, 2, 4, 6, 8, 10] },
  chromatic: { name: 'Cromática (livre)', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

export function noteName(midi, letters = false) {
  const n = ((midi % 12) + 12) % 12;
  return (letters ? NOTE_LETTERS : NOTE_NAMES)[n] + (Math.floor(midi / 12) - 1);
}
export const pitchClass = (midi) => ((midi % 12) + 12) % 12;

/** MIDI do grau `degree` (pode passar de uma oitava) a partir de `base`. */
export function degreeToMidi(degree, root, scaleId, base) {
  const steps = SCALES[scaleId]?.steps ?? SCALES.major.steps;
  const n = steps.length;
  const oct = Math.floor(degree / n), idx = ((degree % n) + n) % n;
  return base + root + oct * 12 + steps[idx];
}

export function inScale(midi, root, scaleId) {
  const steps = SCALES[scaleId]?.steps ?? SCALES.chromatic.steps;
  return steps.includes(((midi - root) % 12 + 12) % 12);
}
export const isRoot = (midi, root) => pitchClass(midi) === ((root % 12) + 12) % 12;

/** Nota mais próxima dentro da escala (desempate para cima). */
export function snapToScale(midi, root, scaleId) {
  if (inScale(midi, root, scaleId)) return midi;
  for (let d = 1; d < 12; d++) {
    if (inScale(midi + d, root, scaleId)) return midi + d;
    if (inScale(midi - d, root, scaleId)) return midi - d;
  }
  return midi;
}

/** Lista de notas da escala entre lo e hi (inclusive). */
export function scaleNotes(root, scaleId, lo, hi) {
  const out = [];
  for (let m = lo; m <= hi; m++) if (inScale(m, root, scaleId)) out.push(m);
  return out;
}

export const CHORD_TYPES = {
  '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7],
  '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14],
};

/** Acorde diatônico no grau (0-based) de uma escala de 7 notas, empilhando terças. */
export function diatonicChord(degree, root, scaleId, sevenths = false) {
  let sid = scaleId;
  if (SCALES[sid].steps.length !== 7) sid = ['pentMinor', 'blues', 'japanese', 'dorian'].includes(scaleId) ? 'minor' : 'major';
  const steps = SCALES[sid].steps;
  const pick = (k) => { const i = degree + k; return steps[i % 7] + 12 * Math.floor(i / 7); };
  const notes = [pick(0), pick(2), pick(4)]; if (sevenths) notes.push(pick(6));
  const rel = notes.map((n) => n - notes[0]);
  const type = Object.entries(CHORD_TYPES).find(([, v]) => v.length === rel.length && v.every((x, i) => x === rel[i]))?.[0] ?? '';
  return { root: (root + notes[0]) % 12, type, intervals: rel, degree };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export function chordLabel(ch, letters = false) {
  const n = (letters ? NOTE_LETTERS : NOTE_NAMES)[ch.root];
  const t = { '': '', m: 'm', dim: '°', aug: '+', '7': '7', maj7: '7M', m7: 'm7', m7b5: 'ø', sus2: 'sus2', sus4: 'sus4', '9': '9', m9: 'm9', add9: 'add9' }[ch.type] ?? ch.type;
  return n + t;
}
export const romanFor = (deg, type) => (/^m|dim|ø/.test(type) ? ROMAN[deg].toLowerCase() : ROMAN[deg]) + (type === 'dim' ? '°' : '');

/** Notas MIDI de um acorde em uma região (voicing fechado a partir de `base`). */
export function chordNotes(ch, base = 48) {
  let r = base + ((ch.root - base) % 12 + 12) % 12;
  return ch.intervals.map((i) => r + i);
}

/** Progressões por gênero (graus 0-based em escala maior/menor). Escritas para este projeto. */
export const PROGRESSIONS = {
  pop: { name: 'Pop', scale: 'major', degrees: [0, 4, 5, 3] },
  ballad: { name: 'Balada', scale: 'major', degrees: [0, 5, 3, 4] },
  jazz: { name: 'Jazz ii–V–I', scale: 'major', degrees: [1, 4, 0, 0], sevenths: true },
  minorPop: { name: 'Menor épica', scale: 'minor', degrees: [0, 5, 2, 6] },
  funk: { name: 'Funk vamp', scale: 'dorian', degrees: [0, 0, 3, 0], sevenths: true },
  blues: { name: 'Blues', scale: 'mixolydian', degrees: [0, 3, 0, 4], sevenths: true },
  bossa: { name: 'Bossa', scale: 'major', degrees: [1, 4, 0, 5], sevenths: true },
  lofi: { name: 'Lo-fi', scale: 'major', degrees: [3, 2, 1, 0], sevenths: true },
  trap: { name: 'Trap sombrio', scale: 'harmonicMinor', degrees: [0, 5, 0, 4] },
};

export function progressionChords(progId, root) {
  const p = PROGRESSIONS[progId] ?? PROGRESSIONS.pop;
  const sid = p.scale === 'dorian' || p.scale === 'mixolydian' || p.scale === 'harmonicMinor' ? p.scale : p.scale;
  return p.degrees.map((d) => {
    const c = diatonicChord(d, root, sid, !!p.sevenths);
    if (p.scale === 'harmonicMinor' && d === 4) return { ...c, type: '', intervals: [0, 4, 7] };
    return c;
  });
}

/** Detecta o acorde mais provável para um conjunto de notas (usado em sugestões). */
export function detectChord(midis) {
  if (!midis.length) return null;
  const pcs = [...new Set(midis.map(pitchClass))];
  let best = null;
  for (const r of pcs) for (const [type, iv] of Object.entries(CHORD_TYPES)) {
    const set = iv.map((i) => (r + i) % 12);
    const hit = pcs.filter((p) => set.includes(p)).length, miss = set.length - hit, extra = pcs.length - hit;
    const score = hit * 2 - miss * 1.5 - extra * 2;
    if (!best || score > best.score) best = { root: r, type, intervals: iv, score };
  }
  return best;
}
