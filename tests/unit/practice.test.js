import { describe, it, expect } from 'vitest';
import { Practice } from '../../src/learn/practice.js';
import { Lighting } from '../../src/light/lighting.js';

function fixture() {
  const clock = { now: 0 };
  const lighting = new Lighting(() => clock.now);
  const app = { lighting, engine: { get now() { return clock.now; }, outputLatency: 0 }, surface: { keyFor: m => 'note'+m }, transport: { addPart() {}, playing: true, bpmAt: () => 120, loop: null }, transportOwner: 'learn' };
  const p = new Practice(app);
  p.active = true; p.mode = 'listen'; p.anticipation = 1.2; p.guideVolume = 0;
  p.track = { id: 't', notes: [{ m:60,b:0,d:1 },{ m:62,b:1,d:1 }] };
  p.song = { tracks: [p.track], length:2 }; p.notes = p.track.notes;
  return { app, p, lighting };
}
describe('practice lighting', () => {
  it('lights the first note in listen mode', () => {
    const {p,lighting}=fixture(); p.schedule(0,.2,b=>b/2,{});
    expect(lighting.cues.map(c=>c.midi)).toEqual([60]);
  });
  it('does not evaluate notes while paused', () => {
    const {app,p}=fixture(); app.transport.playing=false;
    p.evaluator.expect([{midi:60,t:0,state:'pending'}]); p.sweep();
    expect(p.evaluator.pending.length).toBe(1);
  });
  it('cancels scheduled backing voices when silenced', () => {
    const {p}=fixture(); let killed=false;
    p.scheduledVoices.add({kill(){killed=true}}); p.silence();
    expect(killed).toBe(true); expect(p.scheduledVoices.size).toBe(0);
  });
});
