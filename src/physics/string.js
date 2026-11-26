/**
 * Visual string: analytic, time-based vibration with fixed endpoints.
 * The elastic shape follows the original Fingmusic instrument instead of
 * numerically stepping a wave grid every animation frame.
 */
export class StringModel {
  constructor(n = 36) {
    this.n = n; this.y = new Float32Array(n + 1); this.v = new Float32Array(n + 1);
    this.a = new Float32Array(n + 1); this.b = new Float32Array(n + 1);
    for (let i=0;i<=n;i++) { this.a[i]=Math.sin(Math.PI*i/n); this.b[i]=Math.sin(2*Math.PI*i/n); }
    this.a[0]=this.a[n]=this.b[0]=this.b[n]=0;
    this.grab = null; this.amp = 0; this.kick = 0; this.age = 0; this.snapAge = 0; this.speed = .038; this.sign = 1;
    this._energy = 0; this.damping = 1100;
  }
  setPitch(midi) { this.speed = Math.max(.018, Math.min(.085, .03 + .05 * (midi-48)/36)); }
  pluck(t, amp) {
    this.amp = Math.min(28, Math.abs(amp) * .7 + this.amp * Math.exp(-this.age/this.damping) * .18);
    this.sign = Math.sign(amp) || 1; this.age = 0; this.damping = 1100;
    this.step(0);
  }
  hold(t, offset) {
    this.grab = { t: Math.max(.03,Math.min(.97,t)), offset };
    this.amp = 0; this.kick = 0; this.step(0);
  }
  release() {
    if (!this.grab) return 0;
    const {offset}=this.grab; this.grab=null; this.kick=offset; this.snapAge=0; this.step(0); return offset;
  }
  damp() { this.amp *= Math.exp(-this.age/this.damping); this.age=0; this.damping=65; this.kick=0; }
  step(dtMs) {
    const dt = Math.max(0,dtMs);
    this.age += dt; this.snapAge += dt;
    const g = this.grab, env = this.amp * Math.exp(-this.age/this.damping);
    const snap = this.kick * Math.exp(-this.snapAge/220) * Math.cos(this.snapAge*.045);
    if (!g && env < .025 && Math.abs(this.kick)*Math.exp(-this.snapAge/220) < .025) {
      if (this._energy) this.y.fill(0); this._energy=0; this.amp=0; this.kick=0; return;
    }
    const phase = this.age*this.speed;
    const a = snap + this.sign*env*Math.sin(phase);
    const b = this.sign*env*.35*Math.sin(phase*2.1);
    let e=0;
    for(let i=1;i<this.n;i++) {
      const x=i/this.n;
      const stretch=g ? g.offset*(x<g.t?x/g.t:(1-x)/(1-g.t)) : 0;
      const y=stretch+a*this.a[i]+b*this.b[i]; this.y[i]=y; e+=Math.abs(y);
    }
    this.y[0]=this.y[this.n]=0; this._energy=e/this.n;
  }
  energy() { return this._energy; }
  reset() { this.y.fill(0); this.v.fill(0); this.grab=null; this.amp=0; this.kick=0; this._energy=0; }
}
