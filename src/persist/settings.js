/** Configurações e preferências (localStorage, leitura tolerante a falhas). */
const KEY = 'fingmusic.settings.v1';
export const DEFAULTS = {
  volume: 0.8, ambience: 0.16, haptics: true, quality: 'auto', reduceMotion: false, highContrast: false, showShapes: true,
  showNames: true, noteLetters: false, sensitivity: 1, tutorialDone: false, lastInstrument: 'harp', lastMode: 'play',
  root: 0, scale: 'pentMajor', octave: 0, assist: true, highlightRoots: true, showScale: true,
  cameraOpacity: 0.35, handFingers: 2, handRoleLeft: 'play', handRoleRight: 'play', pinchOn: 0.32, pinchOff: 0.48, showSkeleton: false, maxHandFps: 30,
  latencyTouch: 0, latencyHand: 70, anticipation: 1.2, lightsMode: 'full', gravity: 1, metronomeVolume: 0.5,
  fx: {}, // pedaleira do modo livre por instrumento: {instId: fxState}
};
export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* modo privado ou cota cheia */ } }
