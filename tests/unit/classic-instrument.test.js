import { describe,it,expect } from 'vitest';
import { StringModel } from '../../src/physics/string.js';
import { classicHarpSample } from '../../src/audio/voices.js';
import { Lighting } from '../../src/light/lighting.js';

describe('classic instrument response',()=>{
  it('holds a triangular string exactly under the finger',()=>{
    const m=new StringModel(28);m.hold(.5,80);expect(m.y[14]).toBe(80);
    expect(m.y[0]).toBe(0);expect(m.y[28]).toBe(0);
    expect(m.release()).toBe(80);
  });
  it('vibrates identically at 30 and 60 fps',()=>{
    const a=new StringModel(),b=new StringModel();
    a.pluck(.5,20);b.pluck(.5,20);
    for(let i=0;i<30;i++)a.step(1000/30);
    for(let i=0;i<60;i++)b.step(1000/60);
    expect(Math.abs(a.y[12]-b.y[12])).toBeLessThan(.0001);
  });
  it('decays and resets without numerical instability',()=>{
    const m=new StringModel();m.hold(.5,100);m.release();m.pluck(.5,30);
    for(let i=0;i<1000;i++)m.step(16);
    expect(m.energy()).toBeLessThan(.01);expect(m.y.every(Number.isFinite)).toBe(true);
  });
  it('generates a finite decaying classic harp sample',()=>{
    const d=classicHarpSample(60,32000);
    expect(d.length).toBe(96000);expect(d.every(Number.isFinite)).toBe(true);
    expect(Math.max(...d.slice(0,4000))).toBeGreaterThan(.05);
    expect(Math.abs(d.at(-1))).toBe(0);
  });
  it('keeps waiting step-by-step cues visible after long pauses',()=>{
    const L=new Lighting(()=>60);L.add({midi:60,t:0,waiting:true});L.prune();
    expect(L.cues.length).toBe(1);expect(L.stateFor(60)?.phase).toBe('wait');
  });
});
