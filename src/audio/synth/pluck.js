/**
 * Síntese de cordas por guia de onda (Karplus-Strong estendido), renderizada
 * em JavaScript puro para um Float32Array — reaproveitável em AudioContext,
 * OfflineAudioContext (exportação WAV) e em testes unitários.
 *
 * Extensões em relação ao Karplus-Strong clássico (a versão anterior do app):
 *  - afinação precisa com atraso fracionário (all-pass de 1ª ordem);
 *  - excitação com forma triangular deslocada no ponto de toque (posição do
 *    dedo muda o timbre: perto da ponta = fino/brilhante, meio = redondo);
 *  - filtro de laço com perda calibrada por T60 (decaimento em segundos);
 *  - brilho dependente da força (toques fortes são mais brilhantes);
 *  - não-linearidade de ponte (jawari) para sitar e "buzz" de trastes;
 *  - técnicas: palm mute (abafado), harmônico e slap/pop (transiente de traste).
 */
import { clamp, rng } from '../../core/util.js';

export function renderPluck(o) {
  const sr = o.sr ?? 48000;
  const freq = o.freq;
  const dur = o.dur ?? 3;
  const vel = clamp(o.vel ?? 0.7, 0.02, 1.5);
  const pos = clamp(o.pos ?? 0.25, 0.03, 0.5);
  const len = Math.max(64, Math.floor(sr * dur));
  const out = new Float32Array(len);
  const random = rng(o.seed ?? Math.round(freq * 100 + vel * 1000));

  // Comprimento do laço: atraso do filtro de média (0.5 amostra) + all-pass.
  const L = sr / freq - 0.5;
  let N = Math.floor(L), frac = L - N;
  if (frac < 0.1) { N -= 1; frac += 1; } // mantém o all-pass estável e bem-comportado
  N = Math.max(2, N);
  const C = (1 - frac) / (1 + frac);

  // Excitação: mistura de forma triangular (dedo) e ruído (palheta/unha).
  const ring = new Float32Array(N);
  const p = Math.max(1, Math.round(pos * N));
  const noiseMix = clamp(o.noise ?? 0.3, 0, 1);
  for (let i = 0; i < N; i++) {
    const tri = i < p ? i / p : (N - i) / (N - p);
    ring[i] = tri * (1 - noiseMix) + (random() * 2 - 1) * noiseMix;
  }
  // Filtro de pente na posição de toque (remove harmônicos com nó no ponto).
  if (noiseMix > 0) { const c = ring.slice(); for (let i = 0; i < N; i++) ring[i] = c[i] - 0.6 * noiseMix * c[(i + p) % N]; }
  // Brilho: passa-baixas de um polo na excitação; força aumenta o brilho.
  const bright = clamp((o.bright ?? 0.5) * (0.55 + 0.6 * vel), 0.02, 1);
  const a = 1 - bright;
  for (let pass = 0; pass < 2; pass++) { let z = ring[N - 1]; for (let i = 0; i < N; i++) { z = ring[i] = ring[i] * (1 - a) + z * a; } }
  // Remove componente DC e normaliza a energia.
  let mean = 0; for (let i = 0; i < N; i++) mean += ring[i]; mean /= N;
  let peak = 1e-9; for (let i = 0; i < N; i++) { ring[i] -= mean; peak = Math.max(peak, Math.abs(ring[i])); }
  for (let i = 0; i < N; i++) ring[i] /= peak;

  // Perda por período calibrada pelo T60 na fundamental.
  let t60 = o.decay ?? 3;
  if (o.mute) t60 = Math.min(t60, o.muteDecay ?? 0.22);
  const g = Math.pow(10, -3 / (freq * t60));
  // Amortecimento das altas: s=0.5 é a média clássica; menor = mais brilho sustentado.
  const s = clamp(o.damp ?? 0.5, 0.05, 0.5);
  const muteDark = o.mute ? 0.35 : 0;
  const buzz = o.buzz ?? 0;

  let ptr = 0, prev = 0, apX = 0, apY = 0, lp = 0;
  for (let n = 0; n < len; n++) {
    const x = ring[ptr];
    // filtro de laço (média ponderada) + perda
    let y = g * ((1 - s) * x + s * prev);
    prev = x;
    if (muteDark) { lp += (y - lp) * (1 - muteDark); y = lp; }
    if (buzz) { const th = 0.12; if (y > th) y = th + (y - th) * (1 - buzz * 0.7); }
    // all-pass de afinação fracionária
    const ap = C * y + apX - C * apY; apX = y; apY = ap;
    ring[ptr] = ap;
    out[n] = x;
    ptr = ptr + 1 === N ? 0 : ptr + 1;
  }

  // Transientes de técnica.
  const tr = o.transient;
  if (tr) {
    const tl = Math.min(len, Math.floor(sr * (tr.len ?? 0.012)));
    let lpz = 0;
    for (let i = 0; i < tl; i++) {
      const env = Math.exp(-i / (tl * 0.18));
      const nz = random() * 2 - 1;
      lpz += (nz - lpz) * (tr.tone ?? 0.6);
      out[i] += (tr.amount ?? 0.4) * env * lpz;
    }
  }
  // Fade-out final para evitar estalo.
  const fade = Math.min(len, Math.floor(sr * 0.04));
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  return out;
}
