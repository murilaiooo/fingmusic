/**
 * Biblioteca embutida. Conteúdo: melodias de domínio público (arranjos
 * originais do Fingmusic), composições originais, grooves, exercícios de
 * técnica e de percepção. Nenhum serviço externo é necessário.
 */
import { makeSong, seq, repeat } from './song.js';
import { GROOVES } from './grooves.js';
import { generateDrums } from '../studio/patterns.js';
import { progressionChords, chordNotes } from '../theory/music.js';
import { generateChordTrack } from '../theory/assist.js';

const drums = (style, bars, seed = 5) => ({ id: 'drums', name: 'Bateria', role: 'drums', instrument: style === 'samba' || style === 'bossa' ? 'drumsBrazil' : 'drumsAcoustic', volume: 0.6, notes: generateDrums(style, bars, { seed, fill: false }) });
const PD = 'public-domain', OR = 'original';

const songs = [];
const add = (o) => songs.push(makeSong(o));

// ───────────── Músicas (domínio público, arranjos originais)
add({
  id: 'ode', title: 'Ode à Alegria', composer: 'L. van Beethoven (1824)', license: PD, kind: 'song', genre: 'clássico', difficulty: 1,
  key: { root: 0, scale: 'major' }, tempo: [{ b: 0, bpm: 96 }], techniques: ['finger'],
  tracks: [
    { id: 'mel', name: 'Melodia', role: 'melody', instrument: 'harp', notes: seq(`E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:0.5 D4:2 |
      E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2 |
      D4 D4 E4 C4 | D4 E4:0.5 F4:0.5 E4 C4 | D4 E4:0.5 F4:0.5 E4 D4 | C4 D4 G3:2 |
      E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:0.5 C4:2`) },
    { id: 'bass', name: 'Baixo', role: 'bass', instrument: 'bassFinger', volume: 0.7, notes: seq(`C2:2 G2:2 | C2:2 G2:2 | C2:2 F2:2 | G2:2 G2:2 | C2:2 G2:2 | C2:2 G2:2 | C2:2 F2:2 | G2:2 C2:2 |
      G2:2 C2:2 | G2:2 C2:2 | G2:2 C2:2 | G2:2 G2:2 | C2:2 G2:2 | C2:2 G2:2 | C2:2 F2:2 | G2:2 C2:2`) },
    { id: 'keys', name: 'Piano', role: 'chords', instrument: 'piano', volume: 0.45, notes: seq(`[C3 E3 G3]:4 [B2 D3 G3]:4 [C3 E3 G3]:2 [C3 F3 A3]:2 [B2 D3 G3]:4 [C3 E3 G3]:4 [B2 D3 G3]:4 [C3 F3 A3]:4 [B2 D3 G3]:2 [C3 E3 G3]:2
      [B2 D3 G3]:2 [C3 E3 G3]:2 [B2 D3 G3]:2 [C3 E3 G3]:2 [B2 D3 G3]:2 [C3 E3 G3]:2 [B2 D3 G3]:4 [C3 E3 G3]:4 [B2 D3 G3]:4 [C3 F3 A3]:4 [B2 D3 G3]:2 [C3 E3 G3]:2`, 0, { v: 0.5 }) },
    drums('rock', 16),
  ],
});
add({
  id: 'twinkle', title: 'Brilha, Brilha, Estrelinha', composer: 'Tradicional (séc. XVIII)', license: PD, kind: 'melody', genre: 'infantil', difficulty: 1,
  key: { root: 0, scale: 'major' }, tempo: [{ b: 0, bpm: 90 }], techniques: ['finger'],
  tracks: [
    { id: 'mel', name: 'Melodia', role: 'melody', instrument: 'harp', notes: seq('C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2') },
    { id: 'bells', name: 'Sinos', role: 'chords', instrument: 'kalimba', volume: 0.4, notes: seq('C3:4 [F3]:2 [C3]:2 [F3]:2 [C3]:2 [G3]:2 [C3]:2 [C3]:2 [F3]:2 [C3]:2 [G3]:2 [C3]:2 [F3]:2 [C3]:2 [G3]:2 C3:4 [F3]:2 [C3]:2 [F3]:2 [C3]:2 [G3]:2 [C3]:2') },
  ],
});
add({
  id: 'jacques', title: 'Irmão Jacó (Frère Jacques)', composer: 'Tradicional francês', license: PD, kind: 'melody', genre: 'infantil', difficulty: 1,
  key: { root: 0, scale: 'major' }, tempo: [{ b: 0, bpm: 100 }], techniques: ['finger'],
  tracks: [
    { id: 'mel', name: 'Melodia', role: 'melody', instrument: 'marimba', notes: seq('C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 C4 G3 C4:2 C4 G3 C4:2') },
    { id: 'canon', name: 'Cânone', role: 'melody', instrument: 'vibraphone', volume: 0.5, notes: seq('C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4', 8, { v: 0.5 }) },
  ],
});
add({
  id: 'greensleeves', title: 'Greensleeves', composer: 'Tradicional inglês (séc. XVI)', license: PD, kind: 'song', genre: 'folk', difficulty: 2,
  key: { root: 9, scale: 'minor' }, timeSig: [3, 4], tempo: [{ b: 0, bpm: 108 }], techniques: ['finger'],
  tracks: [
    { id: 'mel', name: 'Melodia', role: 'melody', instrument: 'nylon', notes: seq('r:2 A3 C4:2 D4 E4:1.5 F4:0.5 E4 D4:2 B3 G3:1.5 A3:0.5 B3 C4:2 A3 A3:1.5 G#3:0.5 A3 B3:2 G#3 E3:2 A3 C4:2 D4 E4:1.5 F4:0.5 E4 D4:2 B3 G3:1.5 A3:0.5 B3 C4:1.5 B3:0.5 A3 G#3:1.5 F#3:0.5 G#3 A3:3') },
    { id: 'bass', name: 'Baixo', role: 'bass', instrument: 'harp', volume: 0.55, notes: seq('r:3 A2:3 G2:3 E2:3 A2:3 F2:3 E2:3 E2:3 A2:3 G2:3 E2:3 A2:3 E2:3 A2:3', 0, { v: 0.55 }) },
  ],
});
add({
  id: 'sakura', title: 'Sakura Sakura', composer: 'Tradicional japonês', license: PD, kind: 'melody', genre: 'mundo', difficulty: 2,
  key: { root: 9, scale: 'japanese' }, tempo: [{ b: 0, bpm: 72 }], techniques: ['finger', 'vibrato'],
  tracks: [
    { id: 'mel', name: 'Koto', role: 'melody', instrument: 'koto', notes: seq('A4 A4 B4:2 A4 A4 B4:2 A4 B4 C5 B4 A4 B4:0.5 A4:0.5 F4:2 E4 C4 E4 F4 E4 E4:0.5 C4:0.5 B3:2 A4 B4 C5 B4 A4 B4:0.5 A4:0.5 F4:2 E4 C4 E4 F4 E4 E4:0.5 C4:0.5 B3:2 A4 A4 B4:2 A4 A4 B4:2 E4 F4 B4:0.5 A4:0.5 F4 E4:4') },
  ],
});
add({
  id: 'grace', title: 'Amazing Grace', composer: 'Tradicional (1779)', license: PD, kind: 'song', genre: 'gospel', difficulty: 2,
  key: { root: 7, scale: 'major' }, timeSig: [3, 4], tempo: [{ b: 0, bpm: 84 }], techniques: ['sustain'],
  tracks: [
    { id: 'mel', name: 'Melodia', role: 'melody', instrument: 'epiano', notes: seq('r:2 D4 G4:2 B4:0.5 G4:0.5 B4:2 A4 G4:2 E4 D4:2 D4 G4:2 B4:0.5 G4:0.5 B4:2 A4 D5:3 D5:2 B4 D5:1.5 B4:0.5 G4 B4:2 A4 G4:2 E4 D4:2 D4 G4:2 B4:0.5 G4:0.5 B4:2 A4 G4:3') },
    { id: 'pad', name: 'Órgão', role: 'chords', instrument: 'organ', volume: 0.35, notes: seq('r:3 [G3 B3 D4]:3 [G3 B3 D4]:3 [C4 E4 G3]:3 [G3 B3 D4]:3 [G3 B3 D4]:3 [D4 F#3 A3]:3 [D4 F#3 A3]:3 [G3 B3 D4]:3 [G3 B3 D4]:3 [C4 E4 G3]:3 [G3 B3 D4]:3 [G3 B3 D4]:3 [D4 F#3 A3]:3 [G3 B3 D4]:3', 0, { v: 0.45 }) },
  ],
});
add({
  id: 'saints', title: 'When the Saints Go Marching In', composer: 'Tradicional', license: PD, kind: 'song', genre: 'jazz', difficulty: 2,
  key: { root: 0, scale: 'major' }, tempo: [{ b: 0, bpm: 120 }], techniques: ['finger'],
  tracks: [
    { id: 'mel', name: 'Melodia', role: 'melody', instrument: 'piano', notes: seq('r C4 E4 F4 G4:4 r:1 C4 E4 F4 G4:4 r:1 C4 E4 F4 G4:2 E4:2 C4:2 E4:2 D4:4 r:1 E4 E4 D4 C4:3 C4 E4 G4:2 G4 F4:3 r:1 E4 F4 G4:2 E4:2 C4:2 D4:2 C4:4') },
    { id: 'bass', name: 'Walking bass', role: 'bass', instrument: 'bassFinger', volume: 0.7, notes: seq('r:4 C2 E2 G2 A2 C2 E2 G2 A2 C2 E2 G2 A2 C2 E2 G2 Bb2 C2 E2 G2 A2 C2 E2 G2 A2 G2 B2 D3 B2 G2 B2 D3 B2 C2 E2 G2 A2 C2 E2 G2 Bb2 F2 A2 C3 A2 F2 Ab2 C3 Ab2 C2 E2 G2 E2 G2 B2 D3 B2 C2 G2 C2 r') },
    drums('jazz', 9),
  ],
});
add({
  id: 'elise', title: 'Para Elisa (início)', composer: 'L. van Beethoven (1810)', license: PD, kind: 'song', genre: 'clássico', difficulty: 3,
  key: { root: 9, scale: 'harmonicMinor' }, timeSig: [3, 8], tempo: [{ b: 0, bpm: 140 }], techniques: ['finger'],
  tracks: [
    { id: 'mel', name: 'Mão direita', role: 'melody', instrument: 'piano', notes: seq('E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1 r:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1 r:0.5 E4:0.5 G#4:0.5 B4:0.5 C5:1 r:0.5 E4:0.5 E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1 r:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1 r:0.5 E4:0.5 C5:0.5 B4:0.5 A4:2') },
    { id: 'lh', name: 'Mão esquerda', role: 'chords', instrument: 'piano', volume: 0.5, notes: seq('r:4 A2:0.5 E3:0.5 A3:0.5 r:1.5 E2:0.5 E3:0.5 G#3:0.5 r:1.5 A2:0.5 E3:0.5 A3:0.5 r:4.5 A2:0.5 E3:0.5 A3:0.5 r:1.5 E2:0.5 E3:0.5 G#3:0.5 r:1.5 A2:0.5 E3:0.5 A3:0.5', 0, { v: 0.45 }) },
  ],
});
add({
  id: 'canon', title: 'Cânone em Ré', composer: 'J. Pachelbel (c. 1680)', license: PD, kind: 'progression', genre: 'clássico', difficulty: 2,
  key: { root: 2, scale: 'major' }, tempo: [{ b: 0, bpm: 72 }], techniques: ['chord', 'sustain'],
  tracks: [
    { id: 'mel', name: 'Violino (harpa)', role: 'melody', instrument: 'harpAmbient', notes: seq('F#5:2 E5:2 D5:2 C#5:2 B4:2 A4:2 B4:2 C#5:2 D5:2 C#5:2 B4:2 A4:2 G4:2 F#4:2 G4:2 E4:2') },
    { id: 'bass', name: 'Baixo contínuo', role: 'bass', instrument: 'bassFinger', volume: 0.7, notes: repeat(seq('D2:2 A1:2 B1:2 F#1:2 G1:2 D1:2 G1:2 A1:2'), 2, 16) },
    { id: 'pad', name: 'Cordas', role: 'chords', instrument: 'pad', volume: 0.35, notes: repeat(seq('[D3 F#3 A3]:2 [C#3 E3 A3]:2 [D3 F#3 B3]:2 [C#3 F#3 A3]:2 [B2 D3 G3]:2 [A2 D3 F#3]:2 [B2 D3 G3]:2 [C#3 E3 A3]:2', 0, { v: 0.4 }), 2, 16) },
  ],
});

// ───────────── Composições originais
add({
  id: 'neon-funk', title: 'Neon Funk', composer: 'Fingmusic (original)', license: OR, kind: 'song', genre: 'funk', difficulty: 3,
  key: { root: 4, scale: 'dorian' }, tempo: [{ b: 0, bpm: 96 }], techniques: ['slap', 'pop', 'ghost'],
  tracks: [
    { id: 'bass', name: 'Baixo slap', role: 'bass', instrument: 'bassSlap', notes: repeat([...seq('E1:0.5!slap E2:0.25!pop r:0.25 E1:0.25@0.3!ghost E1:0.5!slap D2:0.25!pop r:0.75 G1:0.5!slap A1:0.5!slap B1:0.25!pop D2:0.25!pop'), ...seq('A1:0.5!slap A2:0.25!pop r:0.25 A1:0.25@0.3!ghost A1:0.5!slap G2:0.25!pop r:0.75 C2:0.5!slap B1:0.5!slap A1:0.25!pop G1:0.25!pop', 4)], 4, 8) },
    { id: 'keys', name: 'Teclas', role: 'chords', instrument: 'epiano', volume: 0.5, notes: repeat([...seq('r:0.5 [G3 B3 D4 F#4]:0.25 r:1.25 [G3 B3 D4 F#4]:0.25 r:1.75', 0, { v: 0.55 }), ...seq('r:0.5 [G3 C#4 E4]:0.25 r:1.25 [G3 C#4 E4]:0.25 r:1.75', 4, { v: 0.55 })], 4, 8) },
    drums('funk', 8, 9),
  ],
});
add({
  id: 'luz-norte', title: 'Luz do Norte', composer: 'Fingmusic (original)', license: OR, kind: 'song', genre: 'ambiente', difficulty: 1,
  key: { root: 2, scale: 'pentMajor' }, tempo: [{ b: 0, bpm: 76 }], techniques: ['finger', 'pull'],
  tracks: [
    { id: 'mel', name: 'Harpa', role: 'melody', instrument: 'harpAmbient', notes: seq('D4 F#4 A4 B4:2 A4 F#4:2 E4 D4 E4 F#4:3 r A4 B4 D5:2 B4 A4:2 F#4 E4 F#4 D4:4!pull') },
    { id: 'pad', name: 'Pad', role: 'chords', instrument: 'pad', volume: 0.35, notes: seq('[D3 A3 F#4]:8 [B2 F#3 D4]:8 [G2 D3 B3]:8 [A2 E3 C#4]:4 [D3 A3 F#4]:4', 0, { v: 0.4 }) },
  ],
});
add({
  id: 'mare', title: 'Maré Lenta', composer: 'Fingmusic (original)', license: OR, kind: 'progression', genre: 'lo-fi', difficulty: 2,
  key: { root: 5, scale: 'major' }, tempo: [{ b: 0, bpm: 78 }], techniques: ['chord', 'sustain'],
  tracks: [
    { id: 'keys', name: 'Piano elétrico', role: 'chords', instrument: 'epiano', notes: generateChordTrack(progressionChords('lofi', 5), { base: 53, rhythm: 'sustain' }).map((n) => ({ ...n, chord: true })) },
    { id: 'bass', name: 'Baixo', role: 'bass', instrument: 'subBass', volume: 0.7, notes: progressionChords('lofi', 5).map((c, i) => ({ b: i * 4, d: 3.6, m: 29 + ((c.root - 5 + 12) % 12), v: 0.8 })) },
    drums('lofi', 4, 2),
  ],
});
add({
  id: 'samba-cava', title: 'Roda de Cavaco', composer: 'Fingmusic (original)', license: OR, kind: 'riff', genre: 'samba', difficulty: 3,
  key: { root: 2, scale: 'major' }, tempo: [{ b: 0, bpm: 100 }], techniques: ['chord'],
  tracks: [
    { id: 'cav', name: 'Cavaquinho', role: 'chords', instrument: 'cavaquinho', notes: repeat(seq('[D4 F#4 A4]:0.5 r:0.25 [D4 F#4 A4]:0.25 r:0.5 [D4 F#4 A4]:0.5 r:0.25 [D4 F#4 A4]:0.5 [D4 F#4 A4]:0.25 r:0.5 [D4 F#4 A4]:0.5 [C#4 E4 A4]:0.5 r:0.25 [C#4 E4 A4]:0.25 r:0.5 [C#4 E4 A4]:0.5 r:0.25 [C#4 E4 A4]:0.5 [C#4 E4 A4]:0.25 r:0.5 [C#4 E4 A4]:0.5', 0, { v: 0.7 }), 2, 8) },
    { id: 'bass', name: 'Baixo', role: 'bass', instrument: 'bassFinger', volume: 0.7, notes: repeat(seq('D2:0.75 A1:0.25 r:1 D2:0.75 A1:0.25 r:1 A1:0.75 E2:0.25 r:1 A1:0.75 E2:0.25 r:1'), 2, 8) },
    drums('samba', 4, 4),
  ],
});

// ───────────── Grooves de baixo (com bateria de acompanhamento)
const grooveStyle = { rock: 'rock', disco: 'disco', funk: 'funk', jazz: 'jazz', reggae: 'reggae', blues: 'jazz', hiphop: 'hiphop', samba: 'samba' };
for (const g of GROOVES) {
  const root = 28 + 5; // Lá1
  const bars = Math.max(4, g.bars * 2);
  const notes = repeat(g.notes.map((n) => ({ b: n.b, d: n.d, m: root + n.i, v: n.v, ...(n.tech !== 'finger' ? { tech: n.tech } : {}) })), bars / g.bars, g.bars * 4);
  const inst = g.techniques.includes('slap') || g.techniques.includes('pop') ? 'bassSlap' : g.techniques.includes('mute') ? 'bassPick' : g.genre === 'jazz' ? 'bassFinger' : g.genre === 'funk' ? 'funkBass' : 'bassFinger';
  add({
    id: 'groove-' + g.id, title: g.name, composer: 'Fingmusic (original)', license: OR, kind: 'groove', genre: g.genre, difficulty: g.level,
    key: { root: 9, scale: 'minor' }, tempo: [{ b: 0, bpm: g.bpm }], techniques: g.techniques,
    tracks: [{ id: 'bass', name: 'Baixo', role: 'bass', instrument: inst, notes }, drums(grooveStyle[g.genre] ?? 'rock', bars, 11)],
  });
}

// ───────────── Exercícios de técnica (demonstrações interativas)
const TECH_LESSONS = [
  ['soft', 'Toque suave', 'harp', 'Deslize devagar ou toque de leve: a luz pequena pede delicadeza.', 'C4:1@0.3!soft E4:1@0.3!soft G4:1@0.3!soft C5:1@0.3!soft'],
  ['hard', 'Ataque forte', 'harp', 'Passe o dedo rápido pela corda. O pulso intenso pede força.', 'C4:1@1!hard G4:1@1!hard E4:1@1!hard C5:1@1!hard'],
  ['pull', 'Puxar e soltar', 'harp', 'Segure a corda, puxe para o lado e solte. Quanto mais puxar, mais forte.', 'C4:2!pull G4:2!pull E4:2!pull C5:2!pull'],
  ['slap', 'Slap', 'bassSlap', 'Toque rápido na zona de toque (direita/baixo): o polegar bate na corda.', 'A1:1!slap A1:1!slap D2:1!slap E2:1!slap'],
  ['pop', 'Pop', 'bassSlap', 'Puxe a corda na zona de toque e solte rápido: o estalo do pop.', 'A2:1!pop A2:1!pop G2:1!pop A2:1!pop'],
  ['mute', 'Palm mute', 'bassPick', 'Segure o botão "Abafar" e toque: notas curtas e secas.', 'A1:0.5!mute A1:0.5!mute A1:0.5!mute A1:0.5!mute C2:0.5!mute C2:0.5!mute D2:1!mute'],
  ['harmonic', 'Harmônico', 'electricClean', 'Segure "Harm." e toque a corda solta: soa uma oitava acima, como um sino.', 'E3:2!harmonic A3:2!harmonic D4:2!harmonic G4:2!harmonic'],
  ['slide', 'Slide', 'fretless', 'Toque uma nota e, sem soltar, deslize ao longo da corda até a luz.', 'A1:1 C2:1!slide D2:1 E2:1!slide'],
  ['hammer', 'Hammer-on', 'bassFinger', 'Com a corda soando, bata outro dedo numa casa mais aguda, sem tocar de novo.', 'A1:1 B1:1!hammer A1:1 C2:1!hammer'],
  ['vibrato', 'Vibrato', 'steel', 'Segure a nota no braço e balance o dedo de um lado para o outro.', 'E4:3!vibrato G4:3!vibrato'],
  ['bend', 'Pitch bend', 'overdrive', 'Segure a nota no braço e empurre a corda para o lado: a altura sobe.', 'G3:2!bend A3:2!bend'],
  ['sustain', 'Sustain', 'organ', 'Mantenha a tecla pressionada enquanto a luz durar.', 'C4:3!sustain E4:3!sustain G4:4!sustain'],
  ['chord', 'Acorde', 'harp', 'Várias cordas acesas ao mesmo tempo: passe o dedo por todas de uma vez.', '[C4 E4 G4]:2!chord [F4 A4 C5]:2!chord [G4 B4 D5]:2!chord [C4 E4 G4]:2!chord'],
];
for (const [tech, title, inst, desc, text] of TECH_LESSONS) {
  add({ id: 'tech-' + tech, title, composer: 'Fingmusic', license: OR, kind: 'technique', genre: 'técnica', difficulty: 1, description: desc, techniques: [tech],
    key: { root: 0, scale: 'major' }, tempo: [{ b: 0, bpm: 70 }], tracks: [{ id: 'main', name: title, role: 'melody', instrument: inst, notes: seq(text) }] });
}

// ───────────── Exercícios
add({ id: 'ex-penta', title: 'Escala pentatônica', composer: 'Fingmusic', license: OR, kind: 'exercise', genre: 'exercício', difficulty: 1, key: { root: 9, scale: 'pentMinor' }, tempo: [{ b: 0, bpm: 80 }], techniques: ['finger'],
  description: 'Suba e desça a escala mais usada do rock e do blues.',
  tracks: [{ id: 'main', name: 'Escala', role: 'melody', instrument: 'harp', notes: seq('A3 C4 D4 E4 G4 A4:2 r G4 E4 D4 C4 A3:2') }] });
add({ id: 'ex-arp', title: 'Arpejos maiores', composer: 'Fingmusic', license: OR, kind: 'exercise', genre: 'exercício', difficulty: 2, key: { root: 0, scale: 'major' }, tempo: [{ b: 0, bpm: 90 }], techniques: ['finger'],
  tracks: [{ id: 'main', name: 'Arpejos', role: 'melody', instrument: 'pluckSynth', notes: seq('C4:0.5 E4:0.5 G4:0.5 C5:0.5 G4:0.5 E4:0.5 C4 F4:0.5 A4:0.5 C5:0.5 F5:0.5 C5:0.5 A4:0.5 F4 G4:0.5 B4:0.5 D5:0.5 G5:0.5 D5:0.5 B4:0.5 G4 C4:0.5 E4:0.5 G4:0.5 C5:0.5 C5:2') }] });
add({ id: 'ex-pop-prog', title: 'Progressão I–V–vi–IV', composer: 'Fingmusic', license: OR, kind: 'progression', genre: 'pop', difficulty: 2, key: { root: 0, scale: 'major' }, tempo: [{ b: 0, bpm: 92 }], techniques: ['chord'],
  description: 'A progressão de milhares de músicas pop. Toque cada acorde de uma vez.',
  tracks: [{ id: 'main', name: 'Acordes', role: 'chords', instrument: 'harp', notes: progressionChords('pop', 0).flatMap((c, i) => [0, 2].flatMap((o) => chordNotes(c, 55).map((m) => ({ b: i * 4 + o, d: 1.8, m, v: 0.7, chord: true, tech: 'chord' })))) }, drums('rock', 4, 1)] });
add({ id: 'ear-intervals', title: 'Ouvido: terças e quintas', composer: 'Fingmusic', license: OR, kind: 'ear', genre: 'percepção', difficulty: 2, key: { root: 0, scale: 'major' }, tempo: [{ b: 0, bpm: 70 }], techniques: ['finger'],
  description: 'Pratique no modo Memória: ouça o par de notas e reproduza sem ver as luzes.',
  tracks: [{ id: 'main', name: 'Intervalos', role: 'melody', instrument: 'piano', notes: seq('C4 E4:2 r C4 G4:2 r D4 F4:2 r D4 A4:2 r E4 G4:2 r E4 B4:2 r') }] });
add({ id: 'ear-echo', title: 'Ouvido: frases curtas', composer: 'Fingmusic', license: OR, kind: 'ear', genre: 'percepção', difficulty: 3, key: { root: 7, scale: 'pentMajor' }, tempo: [{ b: 0, bpm: 84 }], techniques: ['finger'],
  tracks: [{ id: 'main', name: 'Frases', role: 'melody', instrument: 'marimba', notes: seq('G4 A4 B4:2 r:2 D5 B4 A4:2 r:2 G4:0.5 A4:0.5 B4 D5 E5:2 r:2 D5 B4 A4 G4:2') }] });

export const LIBRARY = songs;
export const songById = (id) => LIBRARY.find((s) => s.id === id);
export const GENRES = [...new Set(LIBRARY.map((s) => s.genre))];
