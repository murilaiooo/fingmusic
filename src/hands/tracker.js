/**
 * Rastreamento das mãos (Air Mode) com MediaPipe Hand Landmarker, 100% local
 * no navegador: nenhuma imagem sai do aparelho. O modelo é baixado da CDN na
 * primeira vez e fica em cache (service worker) para uso offline.
 *
 * Melhorias sobre a versão anterior:
 *  - filtro One Euro por ponto (menos tremor e menos atraso);
 *  - histerese e calibração da pinça;
 *  - período de presença antes de tocar (evita notas acidentais quando a mão entra);
 *  - tolerância a perdas momentâneas (a mão "continua" por ~200 ms);
 *  - mãos com papéis diferentes (tocar / controlar efeito);
 *  - inferência limitada pela qualidade gráfica (economia de bateria).
 */
import { OneEuro } from './filters.js';
import { Emitter } from '../core/emitter.js';
import { dist } from '../core/util.js';

const MP_VERSION = '0.10.14';
const MP = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
export const TIPS = [4, 8, 12, 16, 20];

export class HandTracker extends Emitter {
  constructor() {
    super();
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', ''); this.video.muted = true; this.video.autoplay = true;
    this.video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(this.video);
    this.facing = 'user'; this.stream = null; this.landmarker = null; this.running = false;
    this.hands = new Map();
    this.lastVideoTime = -1; this.lastInfer = 0;
    this.pinchOn = 0.32; this.pinchOff = 0.48; // proporções calibráveis (dist. polegar-indicador / tamanho da mão)
    this.sensitivity = 1;
    this.fingers = [8, 12]; // pontas que dedilham
    this.roles = { Left: 'play', Right: 'play' };
    this.maxFps = 30;
    this.latencyMs = 0;
  }
  get active() { return !!this.stream; }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('A câmera exige HTTPS e um navegador compatível.');
    await this.openCamera();
    this.running = true;
    if (!this.landmarker) {
      this.emit('status', 'loading');
      this.landmarker = await loadLandmarker();
    }
    this.emit('status', 'ready');
  }
  async openCamera() {
    this.stopCamera();
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } }, audio: false });
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
  }
  async flip() { this.facing = this.facing === 'user' ? 'environment' : 'user'; try { await this.openCamera(); } catch (e) { this.facing = this.facing === 'user' ? 'environment' : 'user'; await this.openCamera(); } }
  stopCamera() { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; this.video.srcObject = null; }
  stop() { this.running = false; this.stopCamera(); for (const k of [...this.hands.keys()]) this.lose(k); this.emit('status', 'off'); }

  /** Converte coordenadas normalizadas do vídeo para a tela (com espelho na frontal). */
  toScreen(lm, W, H) {
    const vw = this.video.videoWidth || 640, vh = this.video.videoHeight || 480, s = Math.max(W / vw, H / vh);
    let x = (W - vw * s) / 2 + lm.x * vw * s;
    if (this.facing === 'user') x = W - x;
    return { x, y: (H - vh * s) / 2 + lm.y * vh * s };
  }

  /** Chamado a cada quadro; devolve true se processou um novo frame de vídeo. */
  update(nowMs, W, H) {
    if (!this.running || !this.landmarker || this.video.readyState < 2) return false;
    if (this.video.currentTime === this.lastVideoTime) return false;
    if (nowMs - this.lastInfer < 1000 / this.maxFps - 2) return false;
    this.lastVideoTime = this.video.currentTime; this.lastInfer = nowMs;
    let res = null;
    const t0 = performance.now();
    try { res = this.landmarker.detectForVideo(this.video, nowMs); } catch { return false; }
    this.latencyMs += (performance.now() - t0 - this.latencyMs) * 0.1;
    const seen = new Set();
    (res?.landmarks ?? []).forEach((lm, i) => {
      let key = res.handedness?.[i]?.[0]?.categoryName ?? 'h' + i;
      // com a câmera frontal espelhada, a "Left" do modelo é a mão direita do usuário
      if (this.facing === 'user') key = key === 'Left' ? 'Right' : key === 'Right' ? 'Left' : key;
      if (seen.has(key)) key += '2';
      seen.add(key);
      this.ingest(key, lm, nowMs, W, H);
    });
    for (const k of [...this.hands.keys()]) if (!seen.has(k)) { const h = this.hands.get(k); if (nowMs - h.lastSeen > 220) this.lose(k); }
    return true;
  }

  ingest(key, lm, t, W, H) {
    let h = this.hands.get(key);
    if (!h) { h = { key, firstSeen: t, lastSeen: t, pts: lm.map(() => ({ x: 0, y: 0 })), f: lm.map(() => [new OneEuro(1.4, 0.025), new OneEuro(1.4, 0.025)]), pinch: false, prevTips: {}, pinchId: null }; this.hands.set(key, h); this.emit('hand', { key, present: true }); }
    if (t - h.lastSeen > 150) { h.prevTips = {}; }
    h.lastSeen = t;
    lm.forEach((p, j) => { const s = this.toScreen(p, W, H); h.pts[j].x = h.f[j][0].filter(s.x, t); h.pts[j].y = h.f[j][1].filter(s.y, t); });
    const P = h.pts, size = dist(P[0], P[9]) || 1;
    h.size = size;
    const ratio = dist(P[4], P[8]) / size; h.ratio = ratio;
    const wasPinch = h.pinch;
    if (!h.pinch && ratio < this.pinchOn) h.pinch = true; else if (h.pinch && ratio > this.pinchOff) h.pinch = false;
    h.pp = { x: (P[4].x + P[8].x) / 2, y: (P[4].y + P[8].y) / 2 };
    const ready = t - h.firstSeen > 140; // presença mínima antes de tocar
    const role = this.roles[key.replace('2', '')] ?? 'play';
    h.role = role;
    if (role === 'fx') { this.emit('fx', { key, x: P[9].x / W, y: P[9].y / H, pinch: h.pinch }); return; }
    if (!ready) return;
    // pinça = "pressionar" (segurar/puxar/teclas); mão aberta = pontas dedilham
    const pid = 'hand-' + key;
    if (h.pinch && !wasPinch) { h.pinchId = pid; this.emit('pointer', { type: 'down', id: pid, x: h.pp.x, y: h.pp.y, t, source: 'hand' }); h.cool = t + 0; }
    else if (h.pinch) this.emit('pointer', { type: 'move', id: pid, x: h.pp.x, y: h.pp.y, t, source: 'hand' });
    else if (!h.pinch && wasPinch) { this.emit('pointer', { type: 'up', id: pid, x: h.pp.x, y: h.pp.y, t, source: 'hand' }); h.cool = t + 220; h.prevTips = {}; }
    if (!h.pinch && t > (h.cool ?? 0)) {
      for (const ti of this.fingers) {
        const id = pid + '-' + ti, p = P[ti];
        this.emit('pointer', { type: 'hover', id, x: p.x, y: p.y, t, source: 'hand' });
      }
    }
  }
  lose(key) {
    const h = this.hands.get(key); if (!h) return;
    if (h.pinch) this.emit('pointer', { type: 'up', id: 'hand-' + key, x: h.pp.x, y: h.pp.y, t: performance.now(), source: 'hand', cancel: false });
    for (const ti of this.fingers) this.emit('pointer', { type: 'hoverEnd', id: 'hand-' + key + '-' + ti });
    this.hands.delete(key); this.emit('hand', { key, present: false });
  }

  /** Calibração: mede a pinça fechada e a mão aberta do usuário. */
  calibrateSample(kind) {
    const h = [...this.hands.values()][0]; if (!h) return null;
    if (kind === 'closed') this._closed = h.ratio; else this._open = h.ratio;
    if (this._closed != null && this._open != null && this._open > this._closed + 0.1) {
      this.pinchOn = this._closed + (this._open - this._closed) * 0.3;
      this.pinchOff = this._closed + (this._open - this._closed) * 0.5;
      return { pinchOn: this.pinchOn, pinchOff: this.pinchOff };
    }
    return { pending: true };
  }
}

async function loadLandmarker() {
  const { FilesetResolver, HandLandmarker } = await import(/* @vite-ignore */ MP + '/vision_bundle.mjs');
  const fs = await FilesetResolver.forVisionTasks(MP + '/wasm');
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  try { return await HandLandmarker.createFromOptions(fs, opts('GPU')); } catch { return HandLandmarker.createFromOptions(fs, opts('CPU')); }
}

export const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
