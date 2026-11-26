/**
 * Grooves de contrabaixo originais (escritos para o Fingmusic). Notas em
 * intervalos (semitons) a partir da tônica; b = batida, d = duração.
 * tech: finger | slap | pop | ghost | slide | hammer | mute.
 * Usados no Genius Bass, nos exercícios do Follow the Lights e no estúdio.
 */
const N = (b, i, d = 0.5, v = 0.8, tech = 'finger') => ({ b, i, d, v, tech });

export const GROOVES = [
  { id: 'g-finger-1', name: 'Primeiros passos', genre: 'rock', level: 1, bpm: 84, bars: 1, techniques: ['finger'],
    notes: [N(0, 0, 1), N(1, 0, 1), N(2, 7, 1), N(3, 5, 1)] },
  { id: 'g-rock-8', name: 'Colcheias de estrada', genre: 'rock', level: 1, bpm: 112, bars: 1, techniques: ['finger'],
    notes: [N(0, 0), N(0.5, 0, 0.5, 0.6), N(1, 0), N(1.5, 0, 0.5, 0.6), N(2, 5), N(2.5, 5, 0.5, 0.6), N(3, 7), N(3.5, 7, 0.5, 0.6)] },
  { id: 'g-disco', name: 'Oitavas de discoteca', genre: 'disco', level: 2, bpm: 118, bars: 1, techniques: ['finger'],
    notes: [N(0, 0, 0.4), N(0.5, 12, 0.3, 0.7), N(1, 0, 0.4), N(1.5, 12, 0.3, 0.7), N(2, 5, 0.4), N(2.5, 17, 0.3, 0.7), N(3, 7, 0.4), N(3.5, 19, 0.3, 0.7)] },
  { id: 'g-funk-ghost', name: 'Funk com ghost notes', genre: 'funk', level: 3, bpm: 98, bars: 1, techniques: ['finger', 'ghost'],
    notes: [N(0, 0, 0.4, 0.95), N(0.75, 0, 0.2, 0.3, 'ghost'), N(1, 12, 0.3, 0.8), N(1.5, 10, 0.3, 0.7), N(2.25, 0, 0.2, 0.3, 'ghost'), N(2.5, 7, 0.4, 0.85), N(3.5, 10, 0.4, 0.8)] },
  { id: 'g-slap-1', name: 'Polegar e estalo', genre: 'funk', level: 2, bpm: 92, bars: 1, techniques: ['slap', 'pop'],
    notes: [N(0, 0, 0.4, 0.95, 'slap'), N(0.5, 12, 0.3, 0.85, 'pop'), N(1.5, 0, 0.4, 0.9, 'slap'), N(2, 12, 0.3, 0.85, 'pop'), N(2.5, 0, 0.3, 0.9, 'slap'), N(3, 10, 0.3, 0.85, 'pop'), N(3.5, 7, 0.4, 0.8, 'slap')] },
  { id: 'g-slap-2', name: 'Slap sincopado', genre: 'funk', level: 4, bpm: 100, bars: 1, techniques: ['slap', 'pop', 'ghost'],
    notes: [N(0, 0, 0.3, 1, 'slap'), N(0.25, 0, 0.2, 0.3, 'ghost'), N(0.5, 12, 0.3, 0.9, 'pop'), N(1.25, 0, 0.3, 0.9, 'slap'), N(1.75, 10, 0.3, 0.85, 'pop'), N(2, 3, 0.3, 0.85, 'slap'), N(2.5, 5, 0.3, 0.85, 'slap'), N(2.75, 12, 0.3, 0.9, 'pop'), N(3.5, 7, 0.4, 0.85, 'slap')] },
  { id: 'g-walk', name: 'Walking em Dó', genre: 'jazz', level: 3, bpm: 120, bars: 2, techniques: ['finger'],
    notes: [N(0, 0, 0.9), N(1, 4, 0.9, 0.7), N(2, 7, 0.9, 0.75), N(3, 8, 0.9, 0.7), N(4, 9, 0.9), N(5, 7, 0.9, 0.7), N(6, 5, 0.9, 0.75), N(7, 2, 0.9, 0.7)] },
  { id: 'g-reggae', name: 'Reggae de um drop', genre: 'reggae', level: 2, bpm: 76, bars: 1, techniques: ['finger', 'slide'],
    notes: [N(0.5, 0, 0.9, 0.85), N(1.5, 7, 0.4, 0.7), N(2, 10, 0.4, 0.7, 'slide'), N(2.5, 12, 1, 0.85), N(3.75, 7, 0.25, 0.6)] },
  { id: 'g-blues', name: 'Shuffle de blues', genre: 'blues', level: 2, bpm: 96, bars: 1, techniques: ['finger'],
    notes: [N(0, 0, 0.6), N(0.66, 0, 0.3, 0.6), N(1, 4, 0.6), N(1.66, 4, 0.3, 0.6), N(2, 7, 0.6), N(2.66, 7, 0.3, 0.6), N(3, 9, 0.6), N(3.66, 7, 0.3, 0.6)] },
  { id: 'g-hiphop', name: 'Boom bap pesado', genre: 'hiphop', level: 2, bpm: 88, bars: 1, techniques: ['finger', 'slide'],
    notes: [N(0, 0, 1.2, 1), N(1.75, 0, 0.25, 0.6), N(2.5, 3, 0.5, 0.85, 'slide'), N(3, 5, 0.9, 0.9)] },
  { id: 'g-hammer', name: 'Hammer-on e pull-off', genre: 'rock', level: 3, bpm: 90, bars: 1, techniques: ['finger', 'hammer'],
    notes: [N(0, 0, 0.5), N(0.5, 2, 0.5, 0.6, 'hammer'), N(1, 0, 0.5, 0.6, 'hammer'), N(1.5, 7, 0.5), N(2, 5, 0.5), N(2.5, 7, 0.5, 0.6, 'hammer'), N(3, 10, 1)] },
  { id: 'g-sync', name: 'Síncope brasileira', genre: 'samba', level: 3, bpm: 104, bars: 1, techniques: ['finger'],
    notes: [N(0, 0, 0.5, 0.95), N(0.75, 7, 0.25, 0.7), N(1, 7, 0.5, 0.8), N(1.75, 0, 0.25, 0.7), N(2, 0, 0.5, 0.9), N(2.75, 7, 0.25, 0.7), N(3.5, 5, 0.5, 0.8)] },
  { id: 'g-pop', name: 'Pops na corda alta', genre: 'funk', level: 3, bpm: 96, bars: 1, techniques: ['pop', 'slap'],
    notes: [N(0, 0, 0.4, 0.9, 'slap'), N(0.75, 15, 0.25, 0.9, 'pop'), N(1, 12, 0.4, 0.9, 'pop'), N(2, 0, 0.4, 0.9, 'slap'), N(2.5, 10, 0.4, 0.9, 'pop'), N(3, 12, 0.4, 0.9, 'pop')] },
  { id: 'g-mute', name: 'Palm mute motor', genre: 'rock', level: 2, bpm: 124, bars: 1, techniques: ['mute'],
    notes: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b, k) => N(b, k < 6 ? 0 : k === 6 ? 3 : 5, 0.3, 0.75, k < 6 ? 'mute' : 'finger')) },
];

export const grooveById = (id) => GROOVES.find((g) => g.id === id);
