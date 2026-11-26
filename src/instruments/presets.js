/** Presets de timbre: instrumento + pedais, prontos para tocar. */
export const FX_PRESETS = [
  { id: 'funk-bass', name: 'Funk Bass', inst: 'funkBass', fx: { compressor: { on: true, params: { threshold: -26, ratio: 6 } }, wah: { on: true, params: { mode: 1, range: 0.8, q: 8 } } } },
  { id: 'ambient-gtr', name: 'Ambient Guitar', inst: 'electricClean', fx: { chorus: { on: true, params: { mix: 0.45 } }, delay: { on: true, params: { div: 2, feedback: 0.55, mix: 0.35 } }, reverb: { on: true, params: { size: 5.5, mix: 0.45 } } } },
  { id: 'dream-harp', name: 'Dream Harp', inst: 'harp', fx: { chorus: { on: true, params: { rate: 0.3, depth: 0.7, mix: 0.4 } }, delay: { on: true, params: { div: 4, feedback: 0.5, mix: 0.3 } }, reverb: { on: true, params: { size: 6, mix: 0.55 } } } },
  { id: 'deep-house', name: 'Deep House Bass', inst: 'synthBass', fx: { compressor: { on: true, params: { threshold: -28, ratio: 8 } }, filter: { on: true, params: { cutoff: 900, res: 6 } } } },
  { id: 'lofi-keys', name: 'Lo-fi Keys', inst: 'epiano', fx: { bitcrusher: { on: true, params: { bits: 9, down: 3, mix: 0.45 } }, filter: { on: true, params: { cutoff: 3200, res: 1 } }, tremolo: { on: true, params: { rate: 3, depth: 0.25 } }, reverb: { on: true, params: { size: 2.5, mix: 0.3 } } } },
  { id: 'space-synth', name: 'Space Synth', inst: 'spaceSynth', fx: { phaser: { on: true, params: { rate: 0.2, mix: 0.5 } }, delay: { on: true, params: { div: 2, feedback: 0.6, mix: 0.35 } }, reverb: { on: true, params: { size: 6, mix: 0.5 } } } },
  { id: 'slap-machine', name: 'Slap Machine', inst: 'bassSlap', fx: { compressor: { on: true, params: { threshold: -30, ratio: 10, makeup: 1.8 } }, eq: { on: true, params: { low: 4, mid: -4, high: 5 } } } },
  { id: 'trap-808', name: 'Trap 808', inst: 'bass808', fx: { distortion: { on: true, params: { drive: 8, tone: 2500, level: 0.6 } }, compressor: { on: true, params: { threshold: -20 } } } },
  { id: 'octave-fuzz', name: 'Octave Fuzz', inst: 'distortion', fx: { octaver: { on: true, params: { sub: 0.4, up: 0.9, dry: 0.8 } }, delay: { on: true, params: { div: 1, mix: 0.18 } } } },
  { id: 'desert-sitar', name: 'Desert Sitar', inst: 'sitar', fx: { delay: { on: true, params: { div: 3, feedback: 0.4, mix: 0.25 } }, reverb: { on: true, params: { size: 4, mix: 0.35 } } } },
  { id: 'sub-octave-bass', name: 'Sub Octave Bass', inst: 'bassPick', fx: { octaver: { on: true, params: { sub: 0.9, up: 0, dry: 0.8 } }, compressor: { on: true, params: {} } } },
  { id: 'koto-garden', name: 'Koto Garden', inst: 'koto', fx: { delay: { on: true, params: { div: 2, feedback: 0.35, mix: 0.25 } }, reverb: { on: true, params: { size: 4.5, mix: 0.4 } } } },
];
