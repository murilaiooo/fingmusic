/** Utilitários DSP para a Web Audio API (curvas, respostas ao impulso, ruído). */
import { rng } from '../core/util.js';

const curveCache = new Map();
/** Curva de saturação. kind: soft (tanh), asym (válvula), hard (diodo), fold. */
export function driveCurve(amount = 2, kind = 'soft', n = 2048) {
  const key = kind + ':' + amount.toFixed(2);
  if (curveCache.has(key)) return curveCache.get(key);
  const c = new Float32Array(n);
  const norm = kind === 'hard' ? 1 : Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    let y;
    if (kind === 'asym') y = x >= 0 ? Math.tanh(amount * x) : Math.tanh(amount * 0.6 * x) * 0.85;
    else if (kind === 'hard') y = Math.max(-1, Math.min(1, x * amount)) * 0.9 + Math.tanh(x * amount) * 0.1;
    else if (kind === 'fold') y = Math.sin(x * amount * 1.4);
    else y = Math.tanh(amount * x);
    c[i] = kind === 'asym' || kind === 'soft' ? y / norm : y;
  }
  curveCache.set(key, c);
  return c;
}

/** Quantização de amplitude (fallback do bitcrusher quando não há AudioWorklet). */
export function crushCurve(bits = 6, n = 4096) {
  const c = new Float32Array(n), steps = 2 ** bits;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * steps / 2) / (steps / 2); }
  return c;
}

const irCache = new WeakMap();
/** Resposta ao impulso estéreo sintética: reflexões iniciais + cauda difusa. */
export function reverbIR(ctx, seconds = 2.4, decay = 3, bright = 0.6) {
  let m = irCache.get(ctx); if (!m) irCache.set(ctx, (m = new Map()));
  const key = seconds.toFixed(1) + ':' + decay + ':' + bright.toFixed(1);
  if (m.has(key)) return m.get(key);
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds), buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c), r = rng(17 + c * 101);
    let lp = 0; const a = 1 - bright * 0.85;
    for (let i = 0; i < len; i++) {
      const t = i / len, n = r() * 2 - 1;
      lp = lp * a + n * (1 - a);
      d[i] = lp * Math.pow(1 - t, decay) * (i < sr * 0.004 ? i / (sr * 0.004) : 1);
    }
    // reflexões iniciais
    for (let k = 0; k < 7; k++) { const at = Math.floor(sr * (0.007 + k * 0.011 + r() * 0.006)); if (at < len) d[at] += (r() < 0.5 ? -1 : 1) * 0.5 * (1 - k / 8); }
  }
  m.set(key, buf);
  return buf;
}

const noiseCache = new WeakMap();
export function noiseBuffer(ctx, seconds = 1) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const len = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), r = rng(99);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  noiseCache.set(ctx, b);
  return b;
}

/** Desconecta com segurança uma lista de nós. */
export function disconnectAll(...nodes) { for (const n of nodes) { try { n?.disconnect(); } catch { /* já desconectado */ } } }

/** Código dos AudioWorklets (bitcrusher e octaver analógico), carregado via Blob. */
export const WORKLET_SOURCE = `
class Crusher extends AudioWorkletProcessor {
  static get parameterDescriptors(){return [{name:'bits',defaultValue:8,minValue:1,maxValue:16},{name:'down',defaultValue:4,minValue:1,maxValue:40}]}
  constructor(){super();this.h=[0,0];this.c=0}
  process(i,o,p){const inp=i[0],out=o[0];if(!inp||!inp.length)return true;const bits=p.bits[0],down=Math.max(1,Math.round(p.down[0])),st=Math.pow(2,bits)/2;
    for(let ch=0;ch<out.length;ch++){const x=inp[ch]||inp[0],y=out[ch];let c=this.c;for(let n=0;n<y.length;n++){if(c%down===0)this.h[ch&1]=Math.round(x[n]*st)/st;y[n]=this.h[ch&1];c++}if(ch===out.length-1)this.c=c%down}return true}}
registerProcessor('fm-crusher',Crusher);
class Octaver extends AudioWorkletProcessor {
  static get parameterDescriptors(){return [{name:'sub',defaultValue:.8,minValue:0,maxValue:1.5},{name:'up',defaultValue:0,minValue:0,maxValue:1.5},{name:'dry',defaultValue:.7,minValue:0,maxValue:1.5}]}
  constructor(){super();this.lp=0;this.lp2=0;this.env=0;this.sign=0;this.ff=1;this.sm=0;this.hp=0;this.px=0}
  process(i,o,p){const inp=i[0],out=o[0];if(!inp||!inp.length)return true;const x=inp[0],sub=p.sub[0],up=p.up[0],dry=p.dry[0];
    for(let n=0;n<x.length;n++){const v=x[n];this.lp+=(v-this.lp)*.06;this.lp2+=(this.lp-this.lp2)*.06;const s=this.lp2>=0?1:-1;
      if(s>0&&this.sign<=0)this.ff=-this.ff;this.sign=s;this.env+=(Math.abs(v)-this.env)*.004;
      const sq=this.ff*this.env*2.2;this.sm+=(sq-this.sm)*.03;const rect=Math.abs(v);this.hp=rect-this.px+.995*this.hp;this.px=rect;
      const y=v*dry+this.sm*sub+this.hp*up*1.2;for(let ch=0;ch<out.length;ch++)out[ch][n]=y}return true}}
registerProcessor('fm-octaver',Octaver);
`;

const workletState = new WeakMap();
const loaded = new WeakSet();
/** Carrega os worklets uma vez por contexto. Devolve true se disponíveis. */
export async function ensureWorklets(ctx) {
  if (!ctx.audioWorklet) return false;
  if (workletState.has(ctx)) return workletState.get(ctx);
  const p = (async () => {
    try {
      const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      loaded.add(ctx);
      return true;
    } catch (e) { console.warn('AudioWorklet indisponível', e); return false; }
  })();
  workletState.set(ctx, p);
  return p;
}
export const hasWorklets = (ctx) => loaded.has(ctx);
