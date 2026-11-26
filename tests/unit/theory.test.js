import { describe, it, expect } from 'vitest';
import { degreeToMidi, inScale, snapToScale, diatonicChord, chordLabel, progressionChords, noteName, detectChord } from '../../src/theory/music.js';
import { generateBassline, arpSequence } from '../../src/theory/assist.js';

describe('teoria musical', () => {
  it('converte graus da escala em MIDI', () => {
    expect(degreeToMidi(0, 0, 'major', 48)).toBe(48);
    expect(degreeToMidi(7, 0, 'major', 48)).toBe(60);
    expect(degreeToMidi(2, 2, 'pentMinor', 48)).toBe(48 + 2 + 5);
    expect(degreeToMidi(-1, 0, 'major', 60)).toBe(59);
  });
  it('verifica e ajusta notas à escala', () => {
    expect(inScale(61, 0, 'major')).toBe(false);
    expect(snapToScale(61, 0, 'major')).toBe(62);
    expect(snapToScale(66, 0, 'pentMajor')).toBe(67);
    expect(inScale(61, 0, 'chromatic')).toBe(true);
  });
  it('monta acordes diatônicos', () => {
    expect(chordLabel(diatonicChord(0, 0, 'major'))).toBe('Dó');
    expect(chordLabel(diatonicChord(1, 0, 'major'))).toBe('Rém');
    expect(chordLabel(diatonicChord(6, 0, 'major'))).toBe('Si°');
    expect(chordLabel(diatonicChord(4, 0, 'major', true))).toBe('Sol7');
    expect(progressionChords('pop', 9).map((c) => chordLabel(c))).toEqual(['Lá', 'Mi', 'Fá♯m', 'Ré']);
  });
  it('nomeia notas e detecta acordes', () => {
    expect(noteName(60)).toBe('Dó4');
    expect(noteName(69, true)).toBe('A4');
    const c = detectChord([57, 60, 64]);
    expect(c.root).toBe(9); expect(c.type).toBe('m');
  });
  it('gera linhas de baixo dentro do compasso', () => {
    const chords = progressionChords('pop', 0);
    for (const st of ['root', 'rootFifth', 'octave', 'walking', 'syncopated', 'slide808']) {
      const n = generateBassline(chords, st);
      expect(n.length).toBeGreaterThan(3);
      expect(n.every((x) => x.b >= 0 && x.b < 16 && x.m >= 24 && x.m < 60)).toBe(true);
    }
  });
  it('arpeja notas seguradas', () => {
    expect(arpSequence([64, 60, 67], 'up')).toEqual([60, 64, 67]);
    expect(arpSequence([60, 64, 67], 'updown')).toEqual([60, 64, 67, 64]);
    expect(arpSequence([60, 64], 'up', 2)).toEqual([60, 64, 72, 76]);
  });
});
