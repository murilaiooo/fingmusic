import { describe, it, expect } from 'vitest';
import { GeniusGame } from '../../src/genius/game.js';
import { Evaluator } from '../../src/learn/evaluator.js';
import { writeMidi, parseMidi } from '../../src/core/midi.js';

const game = (opts = {}) => new GeniusGame({ elements: [60,62,64,67], seed: 1, now: () => 0, after: () => () => {}, ...opts });
describe('Genius', () => {
  it('blocks input during demo and grows after a correct round', () => {
    const g = game(); g.demonstrate();
    expect(g.input({midi:60,time:1}).accepted).toBe(false);
    g.awaitInput();
    expect(g.input({midi:g.expected[0].m,time:1}).roundComplete).toBe(true);
    g.nextRound(); expect(g.sequence.length).toBe(2);
  });
  it('supports short custom Echo sequences', () => {
    const g = game({mode:'echo',customSequence:[{m:60,d:1},{m:62,d:1}]});
    expect(g.sequence.length).toBe(2);
    g.progress(); expect(g.sequence.length).toBeGreaterThan(0);
  });
  it('never runs out of Echo notes', () => {
    const g = game({mode:'echo'});
    for(let i=0;i<30;i++){g.round++;g.progress();expect(g.sequence.length).toBeGreaterThan(0);}
  });
  it('counts only completed sequences', () => {
    const g = game({mode:'bass'}); g.gameOver(); expect(g.result.maxLength).toBe(0);
  });
  it('records a successful finite challenge', () => {
    const g = game({customSequence:[{m:60,d:1}]}); g.awaitInput(); g.inputIndex=0;g.inputs=[];g.chordBuf=[];
    g.input({midi:60,time:1}); g.nextRound();
    expect(g.state).toBe('gameOver'); expect(g.result.maxLength).toBe(1);
  });
});
describe('Learn and MIDI', () => {
  it('compensates hand latency and detects missed notes', () => {
    const e = new Evaluator();e.expect([{midi:60,t:1,state:'pending'},{midi:62,t:2,state:'pending'}]);
    expect(e.judge({midi:60,time:1.07,source:'hand',vel:.7}).grade).toBe('perfect');
    expect(e.sweep(2.3).length).toBe(1);
  });
  it('round trips multiple MIDI tracks and tempo changes', () => {
    const s={tempo:[{b:0,bpm:120},{b:4,bpm:90}],tracks:[{channel:0,program:33,notes:[{b:0,d:1,m:40,v:.8}]},{channel:9,notes:[{b:1,d:.5,m:36,v:.8}]}]};
    const x=parseMidi(writeMidi(s));expect(x.tempo).toEqual(s.tempo);expect(x.tracks.length).toBe(2);expect(x.tracks[0].notes[0].m).toBe(40);
  });
  it('skips a SysEx payload before reading notes', () => {
    const bytes=new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,0,0,0,17,0,240,2,1,247,0,144,60,100,0,128,60,0,0,255,47,0]);
    expect(parseMidi(bytes).tracks[0].notes[0].m).toBe(60);
  });
});
