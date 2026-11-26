/**
 * Catálogo de instrumentos. Cada instrumento define:
 *  - family/surface: família e a superfície de interação mais natural;
 *  - engine + params: como o som é gerado (ver audio/voices.js);
 *  - insert: o "corpo" do instrumento (amp, caixa acústica, ressonâncias);
 *  - layout: notas/cordas padrão (base MIDI, quantidade, afinação do braço).
 * Todos os timbres são sintetizados: nenhum sample de terceiros é usado.
 */

export const FAMILIES = {
  strings: { name: 'Cordas', icon: 'harp' },
  bass: { name: 'Baixos', icon: 'bass' },
  keys: { name: 'Teclas', icon: 'keys' },
  mallets: { name: 'Percussão melódica', icon: 'mallet' },
  synth: { name: 'Sintetizadores', icon: 'wave' },
  drums: { name: 'Bateria', icon: 'drum' },
};

const BASS_TUNING = [28, 33, 38, 43]; // Mi1 Lá1 Ré2 Sol2
const GUITAR_TUNING = [40, 45, 50, 55, 59, 64];

export const INSTRUMENTS = [
  // ───────────── Cordas
  { id: 'harp', name: 'Harpa clássica', family: 'strings', surface: 'strings', hue: 262, desc: 'Cordas longas, ataque macio, sustain amplo.',
    engine: 'pluck', params: { noise: 0.05, pos: 0.42, bright: 0.38, decay: 5.5, damp: 0.5, dur: 5 }, gain: 0.9,
    insert: [{ type: 'body', bands: [['lowshelf', 180, 2], ['peaking', 2400, 2, 1]] }], layout: { base: 48, count: 11, orient: 'vertical' } },
  { id: 'harpAmbient', name: 'Harpa ambiente', family: 'strings', surface: 'strings', hue: 228, desc: 'Harpa com eco estéreo e cauda etérea.',
    engine: 'pluck', params: { noise: 0.04, pos: 0.48, bright: 0.33, decay: 6, damp: 0.5, dur: 5 }, gain: 0.85,
    insert: [{ type: 'fx', id: 'chorus', params: { rate: 0.4, depth: 0.5, mix: 0.35 } }, { type: 'fx', id: 'delay', params: { div: 2, feedback: 0.45, mix: 0.28, tone: 2600 } }, { type: 'fx', id: 'reverb', params: { size: 5, mix: 0.42, tone: 0.5 } }],
    layout: { base: 48, count: 11, orient: 'vertical' } },
  { id: 'nylon', name: 'Violão de nylon', family: 'strings', surface: 'fretboard', hue: 32, desc: 'Quente e redondo, caixa acústica de madeira.',
    engine: 'pluck', params: { noise: 0.12, pos: 0.2, bright: 0.36, decay: 2.8, damp: 0.5, dur: 3.2 }, gain: 0.95,
    insert: [{ type: 'body', bands: [['peaking', 190, 4, 1.2], ['peaking', 2600, 2, 1], ['highshelf', 7000, -3]] }], layout: { tuning: GUITAR_TUNING, frets: 12, base: 40, count: 9 } },
  { id: 'steel', name: 'Violão de aço', family: 'strings', surface: 'fretboard', hue: 42, desc: 'Brilhante, com ataque de palheta e sustain longo.',
    engine: 'pluck', params: { noise: 0.3, pos: 0.13, bright: 0.66, decay: 4.2, damp: 0.42, dur: 4 }, gain: 0.85, tech: 'pick',
    insert: [{ type: 'body', bands: [['peaking', 140, 3, 1], ['peaking', 900, -2, 1], ['highshelf', 5000, 3]] }], layout: { tuning: GUITAR_TUNING, frets: 12, base: 40, count: 9 } },
  { id: 'electricClean', name: 'Guitarra clean', family: 'strings', surface: 'fretboard', hue: 196, desc: 'Captador single-coil, amplificador limpo.',
    engine: 'pluck', params: { noise: 0.22, pos: 0.11, bright: 0.55, decay: 3.6, damp: 0.45, dur: 3.6 }, gain: 0.85, tech: 'pick',
    insert: [{ type: 'amp', drive: 1.3, kind: 'soft', lp: 6200, mid: 2, midFreq: 1100, level: 0.9 }], layout: { tuning: GUITAR_TUNING, frets: 12, base: 40, count: 9 } },
  { id: 'overdrive', name: 'Guitarra overdrive', family: 'strings', surface: 'fretboard', hue: 18, desc: 'Válvula saturada, responde à força do toque.',
    engine: 'pluck', params: { noise: 0.3, pos: 0.1, bright: 0.55, decay: 4.5, damp: 0.42, dur: 4 }, gain: 0.7, tech: 'pick',
    insert: [{ type: 'amp', drive: 6, kind: 'asym', lp: 4600, mid: 5, midFreq: 800, level: 0.55 }], layout: { tuning: GUITAR_TUNING, frets: 12, base: 40, count: 9 } },
  { id: 'distortion', name: 'Guitarra distorcida', family: 'strings', surface: 'fretboard', hue: 2, desc: 'Alto ganho, médios cavados, sustain infinito.',
    engine: 'pluck', params: { noise: 0.35, pos: 0.09, bright: 0.6, decay: 6, damp: 0.38, dur: 4.5 }, gain: 0.55, tech: 'pick',
    insert: [{ type: 'amp', drive: 28, kind: 'hard', hp: 180, lp: 3700, mid: -5, midFreq: 700, level: 0.4 }], layout: { tuning: GUITAR_TUNING, frets: 12, base: 40, count: 9 } },
  { id: 'ambientGuitar', name: 'Guitarra ambiente', family: 'strings', surface: 'fretboard', hue: 176, desc: 'Clean com chorus, delay pontuado e reverb enorme.',
    engine: 'pluck', params: { noise: 0.18, pos: 0.12, bright: 0.5, decay: 4, damp: 0.45, dur: 4 }, gain: 0.8, tech: 'pick',
    insert: [{ type: 'amp', drive: 1.2, kind: 'soft', lp: 5800, level: 0.9 }, { type: 'fx', id: 'chorus', params: { rate: 0.7, depth: 0.6, mix: 0.4 } }, { type: 'fx', id: 'delay', params: { div: 2, feedback: 0.5, mix: 0.32 } }, { type: 'fx', id: 'reverb', params: { size: 5.5, mix: 0.45 } }],
    layout: { tuning: GUITAR_TUNING, frets: 12, base: 40, count: 9 } },
  { id: 'ukulele', name: 'Ukulele', family: 'strings', surface: 'fretboard', hue: 50, desc: 'Afinação reentrante, curto e alegre.',
    engine: 'pluck', params: { noise: 0.12, pos: 0.18, bright: 0.5, decay: 1.7, damp: 0.5, dur: 2 }, gain: 0.9,
    insert: [{ type: 'body', bands: [['peaking', 320, 4, 1.3], ['highshelf', 6000, -2]] }], layout: { tuning: [67, 60, 64, 69], frets: 12, base: 60, count: 9 } },
  { id: 'cavaquinho', name: 'Cavaquinho', family: 'strings', surface: 'fretboard', hue: 58, desc: 'Cordas de aço agudas, ataque estalado do samba.',
    engine: 'pluck', params: { noise: 0.32, pos: 0.12, bright: 0.72, decay: 1.9, damp: 0.42, dur: 2.2 }, gain: 0.8, tech: 'pick',
    insert: [{ type: 'body', bands: [['peaking', 450, 3, 1.2], ['highshelf', 4500, 2]] }], layout: { tuning: [62, 67, 71, 74], frets: 12, base: 62, count: 9 } },
  { id: 'koto', name: 'Koto', family: 'strings', surface: 'strings', hue: 340, desc: 'Cordas de seda, ataque com unha, ressonância longa.',
    engine: 'pluck', params: { noise: 0.28, pos: 0.07, bright: 0.78, decay: 3.4, damp: 0.38, dur: 3.5 }, gain: 0.85, tech: 'pick',
    insert: [{ type: 'body', bands: [['peaking', 300, 3, 1], ['peaking', 3200, 3, 1.2]] }], layout: { base: 50, count: 13, orient: 'diagonal', scale: 'japanese' } },
  { id: 'sitar', name: 'Sitar', family: 'strings', surface: 'strings', hue: 24, desc: 'Ponte jawari com zumbido e cordas simpáticas.',
    engine: 'pluck', params: { noise: 0.2, pos: 0.09, bright: 0.72, decay: 5, damp: 0.3, buzz: 0.85, dur: 4.5 }, gain: 0.8, tech: 'pick',
    insert: [{ type: 'sympathetic', amount: 0.25 }, { type: 'body', bands: [['peaking', 600, 3, 1], ['highshelf', 3500, 3]] }], layout: { base: 50, count: 10, orient: 'diagonal', scale: 'phrygianDom' } },

  // ───────────── Baixos
  { id: 'bassFinger', name: 'Baixo fingerstyle', family: 'bass', surface: 'fretboard', hue: 152, desc: 'Dedos sobre os captadores: grave redondo e presente.',
    engine: 'pluck', params: { noise: 0.1, pos: 0.22, bright: 0.3, decay: 3.4, damp: 0.5, dur: 3.5, transient: { amount: 0.18, tone: 0.15, len: 0.02 } }, gain: 1.15,
    insert: [{ type: 'body', bands: [['lowshelf', 90, 3], ['peaking', 700, 1.5, 1], ['lowpass', 4200, null, 0.7]] }, { type: 'fx', id: 'compressor', params: { threshold: -22, ratio: 4, makeup: 1.4 } }],
    layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'bassSlap', name: 'Baixo slap', family: 'bass', surface: 'fretboard', hue: 168, tech: 'slap', desc: 'Polegar percussivo e pop estalado. Puxe a corda para o pop.',
    engine: 'pluck', params: { noise: 0.32, pos: 0.13, bright: 0.85, decay: 2.4, damp: 0.33, dur: 2.6 }, gain: 1,
    insert: [{ type: 'body', bands: [['lowshelf', 80, 4], ['peaking', 600, -6, 0.8], ['highshelf', 3000, 5]] }, { type: 'fx', id: 'compressor', params: { threshold: -26, ratio: 6, attack: 0.003, makeup: 1.6 } }],
    layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'bassPop', name: 'Pop bass', family: 'bass', surface: 'fretboard', hue: 186, tech: 'pop', desc: 'Notas estaladas e curtas, médios à frente.',
    engine: 'pluck', params: { noise: 0.38, pos: 0.07, bright: 0.95, decay: 1.6, damp: 0.3, dur: 2 }, gain: 0.95,
    insert: [{ type: 'body', bands: [['lowshelf', 100, 2], ['peaking', 1500, 4, 1.1], ['highshelf', 4500, 3]] }, { type: 'fx', id: 'compressor', params: { threshold: -28, ratio: 8, attack: 0.002, makeup: 1.7 } }],
    layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'bassPick', name: 'Baixo com palheta', family: 'bass', surface: 'fretboard', hue: 204, tech: 'pick', desc: 'Ataque definido e rosnado nos médios.',
    engine: 'pluck', params: { noise: 0.5, pos: 0.1, bright: 0.6, decay: 2.4, damp: 0.42, dur: 2.6 }, gain: 1,
    insert: [{ type: 'body', bands: [['lowshelf', 100, 2], ['peaking', 1200, 5, 1.2], ['lowpass', 5000, null, 0.7]] }, { type: 'fx', id: 'compressor', params: { threshold: -24, ratio: 5, makeup: 1.4 } }],
    layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'fretless', name: 'Fretless', family: 'bass', surface: 'fretboard', hue: 270, fretless: true, desc: 'Sem trastes: deslize entre as notas, "mwah" vocal.',
    engine: 'pluck', params: { noise: 0.05, pos: 0.28, bright: 0.42, decay: 4.2, damp: 0.24, dur: 4, filterEnv: { type: 'lowpass', q: 3.5, from: 500, peak: 1900, to: 900, attack: 0.09, decay: 0.6 } }, gain: 1.1,
    insert: [{ type: 'body', bands: [['lowshelf', 90, 2], ['peaking', 900, 2, 1.4]] }, { type: 'fx', id: 'chorus', params: { rate: 0.5, depth: 0.25, mix: 0.18 } }],
    layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'funkBass', name: 'Funk bass', family: 'bass', surface: 'fretboard', hue: 300, desc: 'Filtro de envelope: cada nota "fala" com a força do toque.',
    engine: 'pluck', params: { noise: 0.2, pos: 0.14, bright: 0.72, decay: 1.9, damp: 0.38, dur: 2.2, filterEnv: { type: 'lowpass', q: 9, from: 260, peak: 2800, to: 380, attack: 0.012, decay: 0.24, velAmt: 1 } }, gain: 1.05,
    insert: [{ type: 'fx', id: 'compressor', params: { threshold: -24, ratio: 6, makeup: 1.5 } }],
    layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'synthBass', name: 'Synth bass', family: 'bass', surface: 'fretboard', hue: 318, desc: 'Dente-de-serra filtrado com envelope ressonante.',
    engine: 'osc', params: { oscs: [['sawtooth', 1, 0, 0.6], ['square', 0.5, 0, 0.45], ['sawtooth', 1, 7, 0.3]], filter: { type: 'lowpass', cutoff: 170, env: 2600, q: 7, decay: 0.2, keytrack: 0.5 }, amp: { a: 0.003, d: 0.3, s: 0.55, r: 0.09 }, glide: 0.04 }, gain: 0.55,
    insert: [{ type: 'sat', drive: 1.6 }], layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'subBass', name: 'Sub bass', family: 'bass', surface: 'fretboard', hue: 238, desc: 'Senoide pura e profunda, saturação suave.',
    engine: 'osc', params: { oscs: [['sine', 1, 0, 1], ['triangle', 1, 0, 0.12]], filter: { type: 'lowpass', cutoff: 320, env: 0, q: 0.5 }, amp: { a: 0.006, d: 0.4, s: 0.85, r: 0.18 }, glide: 0.05 }, gain: 0.95,
    insert: [{ type: 'sat', drive: 1.8, level: 0.95 }], layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'bass808', name: '808', family: 'bass', surface: 'fretboard', hue: 346, desc: 'Bumbo afinado com queda de pitch e slides.',
    engine: 'osc', params: { oscs: [['sine', 1, 0, 1]], pitchEnv: { semis: 14, time: 0.045 }, filter: { type: 'lowpass', cutoff: 900, env: 0, q: 0.5 }, amp: { a: 0.002, d: 1.6, s: 0.0001, r: 0.25, hold: true }, glide: 0.09 }, gain: 0.9,
    insert: [{ type: 'sat', drive: 3.2, level: 0.75 }], layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },
  { id: 'distBass', name: 'Baixo distorcido', family: 'bass', surface: 'fretboard', hue: 8, tech: 'pick', desc: 'Grave limpo em paralelo com fuzz nos médios.',
    engine: 'pluck', params: { noise: 0.45, pos: 0.1, bright: 0.62, decay: 3, damp: 0.4, dur: 3 }, gain: 1,
    insert: [{ type: 'bassdrive', drive: 14, lp: 2800, dist: 0.5 }, { type: 'fx', id: 'compressor', params: { threshold: -20, ratio: 4, makeup: 1.2 } }],
    layout: { tuning: BASS_TUNING, frets: 12, base: 28, count: 8 } },

  // ───────────── Teclas
  { id: 'piano', name: 'Piano', family: 'keys', surface: 'keys', hue: 40, sustain: true, desc: 'Piano de cauda modal: martelos, inarmonicidade e batimento.',
    engine: 'modal', params: { kind: 'piano' }, gain: 0.8, release: 0.25, insert: [{ type: 'fx', id: 'reverb', params: { size: 2.2, mix: 0.18 } }], layout: { base: 48 } },
  { id: 'epiano', name: 'Piano elétrico', family: 'keys', surface: 'keys', hue: 24, sustain: true, desc: 'Tine em FM: doce no toque leve, "late" no forte.',
    engine: 'fm', params: { ratio: 1, index: 2.4, indexDecay: 0.4, decay: 3.2, tine: 0.28 }, gain: 0.75, release: 0.18,
    insert: [{ type: 'amp', drive: 1.5, kind: 'soft', lp: 7000, mid: 1, level: 0.95 }, { type: 'fx', id: 'tremolo', params: { rate: 4.2, depth: 0.25 } }], layout: { base: 48 } },
  { id: 'organ', name: 'Órgão', family: 'keys', surface: 'keys', hue: 14, sustain: true, desc: 'Drawbars, clique de percussão e rotativo.',
    engine: 'osc', params: { oscs: [['sine', 0.5, 0, 0.5], ['sine', 1, 0, 0.8], ['sine', 2, 0, 0.6], ['sine', 3, 0, 0.35], ['sine', 4, 0, 0.3]], filter: { type: 'lowpass', cutoff: 7000, env: 0, q: 0.5 }, amp: { a: 0.006, d: 0.05, s: 1, r: 0.06 }, click: 0.25 }, gain: 0.33,
    insert: [{ type: 'sat', drive: 1.4 }, { type: 'fx', id: 'chorus', params: { rate: 6.2, depth: 0.35, mix: 0.45 } }, { type: 'fx', id: 'tremolo', params: { rate: 6.2, depth: 0.18 } }], layout: { base: 48 } },

  // ───────────── Percussão melódica
  { id: 'marimba', name: 'Marimba', family: 'mallets', surface: 'mallets', hue: 28, desc: 'Lâminas de madeira com ressonadores.',
    engine: 'modal', params: { kind: 'marimba' }, gain: 0.95, layout: { base: 55, count: 15 } },
  { id: 'vibraphone', name: 'Vibrafone', family: 'mallets', surface: 'mallets', hue: 205, desc: 'Lâminas de metal com motor de tremolo.',
    engine: 'modal', params: { kind: 'vibraphone' }, gain: 0.8, insert: [{ type: 'fx', id: 'tremolo', params: { rate: 5.2, depth: 0.35 } }, { type: 'fx', id: 'reverb', params: { size: 2.5, mix: 0.2 } }], layout: { base: 55, count: 15 } },
  { id: 'kalimba', name: 'Kalimba', family: 'mallets', surface: 'mallets', hue: 92, desc: 'Lâminas metálicas dedilhadas, centro grave.',
    engine: 'modal', params: { kind: 'kalimba' }, gain: 0.9, insert: [{ type: 'body', bands: [['peaking', 500, 3, 1.5]] }, { type: 'fx', id: 'reverb', params: { size: 1.6, mix: 0.16 } }], layout: { base: 60, count: 13, arrange: 'kalimba' } },
  { id: 'bells', name: 'Sinos', family: 'mallets', surface: 'mallets', hue: 190, desc: 'Sinos tubulares com parciais inarmônicos.',
    engine: 'modal', params: { kind: 'bells' }, gain: 0.6, insert: [{ type: 'fx', id: 'reverb', params: { size: 4, mix: 0.3 } }], layout: { base: 60, count: 12, arrange: 'bells' } },

  // ───────────── Sintetizadores
  { id: 'synthLead', name: 'Synth lead', family: 'synth', surface: 'keys', hue: 286, sustain: true, desc: 'Duas serras desafinadas, glide e vibrato.',
    engine: 'osc', params: { oscs: [['sawtooth', 1, -7, 0.5], ['sawtooth', 1, 7, 0.5], ['square', 0.5, 0, 0.2]], filter: { type: 'lowpass', cutoff: 1400, env: 3000, q: 5, decay: 0.35, keytrack: 0.6 }, amp: { a: 0.01, d: 0.3, s: 0.75, r: 0.2 }, glide: 0.06, vibrato: { rate: 5.5, depth: 18, delay: 0.35 } }, gain: 0.3,
    insert: [{ type: 'fx', id: 'delay', params: { div: 2, feedback: 0.3, mix: 0.2 } }], layout: { base: 60 } },
  { id: 'pad', name: 'Pad atmosférico', family: 'synth', surface: 'keys', hue: 252, sustain: true, desc: 'Camadas lentas e largas, cauda longa.',
    engine: 'osc', params: { oscs: [['sawtooth', 1, -11, 0.35], ['sawtooth', 1, 11, 0.35], ['triangle', 0.5, 0, 0.45], ['sawtooth', 2, 4, 0.12]], filter: { type: 'lowpass', cutoff: 900, env: 900, q: 1.5, decay: 1.6, attack: 0.8 }, amp: { a: 0.7, d: 1, s: 0.8, r: 1.8 } }, gain: 0.26,
    insert: [{ type: 'fx', id: 'chorus', params: { rate: 0.3, depth: 0.7, mix: 0.5 } }, { type: 'fx', id: 'reverb', params: { size: 5.5, mix: 0.45 } }], layout: { base: 48 } },
  { id: 'spaceSynth', name: 'Space synth', family: 'synth', surface: 'keys', hue: 200, sustain: true, desc: 'Pulso quadrado com filtro varrendo.',
    engine: 'osc', params: { oscs: [['square', 1, -5, 0.4], ['sawtooth', 1, 5, 0.35]], filter: { type: 'lowpass', cutoff: 600, env: 4200, q: 9, decay: 0.6, keytrack: 0.3 }, amp: { a: 0.02, d: 0.5, s: 0.55, r: 0.7 }, glide: 0.02 }, gain: 0.26,
    insert: [{ type: 'fx', id: 'phaser', params: { rate: 0.3, mix: 0.4 } }, { type: 'fx', id: 'delay', params: { div: 1, feedback: 0.45, mix: 0.3 } }, { type: 'fx', id: 'reverb', params: { size: 4.5, mix: 0.35 } }], layout: { base: 60 } },
  { id: 'pluckSynth', name: 'Synth pluck', family: 'synth', surface: 'strings', hue: 160, desc: 'Pluck eletrônico curto, ótimo para arpejos.',
    engine: 'osc', params: { oscs: [['sawtooth', 1, -4, 0.5], ['square', 1, 4, 0.3]], filter: { type: 'lowpass', cutoff: 300, env: 5200, q: 4, decay: 0.16, keytrack: 0.5 }, amp: { a: 0.002, d: 0.4, s: 0.0001, r: 0.15, hold: true } }, gain: 0.32,
    insert: [{ type: 'fx', id: 'delay', params: { div: 1, feedback: 0.35, mix: 0.22 } }, { type: 'fx', id: 'reverb', params: { size: 2.5, mix: 0.22 } }], layout: { base: 55, count: 11, orient: 'vertical' } },
  { id: 'theremin', name: 'Theremin', family: 'synth', surface: 'theremin', hue: 300, sustain: true, desc: 'Altura contínua no eixo X, volume no eixo Y.',
    engine: 'osc', params: { oscs: [['sine', 1, 0, 0.8], ['triangle', 1, 0, 0.25], ['sine', 2, 0, 0.08]], filter: { type: 'lowpass', cutoff: 3500, env: 0, q: 0.7 }, amp: { a: 0.05, d: 0.1, s: 1, r: 0.25 }, glide: 0.03, vibrato: { rate: 5.6, depth: 12, delay: 0.3 } }, gain: 0.45,
    insert: [{ type: 'fx', id: 'reverb', params: { size: 3.2, mix: 0.3 } }], layout: { base: 48 } },

  // ───────────── Bateria (ver audio/drums.js)
  { id: 'drumsElectro', name: 'Bateria eletrônica', family: 'drums', surface: 'pads', hue: 330, engine: 'drum', kit: 'electro', desc: 'Kit sintético inspirado em drum machines clássicas.', gain: 1 },
  { id: 'drumsAcoustic', name: 'Bateria acústica', family: 'drums', surface: 'pads', hue: 20, engine: 'drum', kit: 'acoustic', desc: 'Kit acústico modelado (síntese, sem samples).', gain: 1,
    insert: [{ type: 'fx', id: 'reverb', params: { size: 1.4, mix: 0.14 } }] },
  { id: 'drumsBrazil', name: 'Percussão brasileira', family: 'drums', surface: 'pads', hue: 120, engine: 'drum', kit: 'brazil', desc: 'Surdo, caixa, tamborim, agogô, pandeiro e cuíca.', gain: 1,
    insert: [{ type: 'fx', id: 'reverb', params: { size: 1.8, mix: 0.12 } }] },
];

export const byId = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i]));
export const getInstrument = (id) => byId[id] ?? byId.harp;
export const instrumentsOf = (family) => INSTRUMENTS.filter((i) => i.family === family);
