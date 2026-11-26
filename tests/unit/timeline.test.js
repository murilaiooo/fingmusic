import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { beatToSec, secToBeat, normalizeTempoMap, swingBeat, quantize } from '../../src/core/timeline.js';
import { Transport } from '../../src/core/transport.js';

describe('timeline', () => {
  const map = normalizeTempoMap([{ b: 0, bpm: 120 }, { b: 8, bpm: 60 }]);
  it('converte batidas em segundos com mudança de andamento', () => {
    expect(beatToSec(4, map)).toBeCloseTo(2);
    expect(beatToSec(8, map)).toBeCloseTo(4);
    expect(beatToSec(10, map)).toBeCloseTo(6);
    expect(beatToSec(10, map, 0.5)).toBeCloseTo(12);
  });
  it('é inversível', () => {
    for (const b of [0, 1.5, 7.9, 8, 9.25, 33]) expect(secToBeat(beatToSec(b, map), map)).toBeCloseTo(b, 6);
  });
  it('swing e quantização', () => {
    expect(swingBeat(0.5, 0.5)).toBeCloseTo(0.625);
    expect(swingBeat(1, 0.5)).toBe(1);
    expect(quantize(1.13, 0.25)).toBe(1.25);
    expect(quantize(1.1, 0.5, 0.5)).toBeCloseTo(1.05);
  });
});

function fakeEngine() { return { now: 0, ctx: { get currentTime() { return this._t; }, _t: 0 } }; }

describe('transport', () => {
  let eng, tr, events;
  beforeEach(() => {
    vi.useFakeTimers();
    eng = fakeEngine();
    Object.defineProperty(eng, 'now', { get: () => eng.ctx._t });
    tr = new Transport(eng);
    events = [];
    tr.addPart({ schedule(from, to, toTime) { for (let b = Math.ceil(from - 1e-9); b < to - 1e-9; b++) events.push({ b: b + 0, t: toTime(b) }); } });
  });
  afterEach(() => vi.useRealTimers());
  const advance = (sec) => { const steps = Math.round(sec / 0.025); for (let i = 0; i < steps; i++) { eng.ctx._t += 0.025; vi.advanceTimersByTime(25); } };

  it('agenda batidas no tempo de áudio exato', () => {
    tr.setBpm(120); tr.start({ at: 1 });
    advance(3);
    const first = events.slice(0, 4);
    expect(first.map((e) => e.b)).toEqual([0, 1, 2, 3]);
    first.forEach((e, i) => expect(e.t).toBeCloseTo(1 + i * 0.5, 6));
  });
  it('faz loop sem perder nem duplicar batidas', () => {
    tr.setBpm(120); tr.setLoop(0, 4); tr.start({ at: 0.1 });
    advance(4.5);
    const bs = events.map((e) => e.b);
    expect(bs.slice(0, 9)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0]);
    const ts = events.map((e) => e.t);
    for (let i = 1; i < 9; i++) expect(ts[i] - ts[i - 1]).toBeCloseTo(0.5, 6);
  });
  it('pausa e retoma na mesma posição', () => {
    tr.setBpm(60); tr.start({ at: 0 });
    advance(2.5);
    tr.pause();
    expect(tr.beatNow()).toBeCloseTo(2.5, 1);
    advance(3);
    tr.resume();
    expect(tr.beatNow()).toBeLessThan(2.6);
    advance(1);
    expect(tr.beatNow()).toBeGreaterThan(3.3);
  });
  it('contagem regressiva antes do início', () => {
    tr.setBpm(120); tr.start({ at: 0, countIn: 4 });
    advance(1);
    expect(events[0].b).toBe(-4);
    expect(tr.beatNow()).toBeLessThan(0);
  });
  it('velocidade reduzida estica o tempo', () => {
    tr.setBpm(120); tr.setRate(0.5); tr.start({ at: 0 });
    advance(3);
    expect(events[2].t - events[1].t).toBeCloseTo(1, 6);
  });
});
