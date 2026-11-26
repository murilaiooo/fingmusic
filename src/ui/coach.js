/**
 * Tutorial curto e pulável: cada passo espera o gesto real do usuário
 * (deslizar, puxar e soltar, trocar de instrumento) antes de avançar.
 */
import { h, btn } from './dom.js';

const STEPS = [
  { text: 'Deslize o dedo pelas cordas, como numa harpa.', until: (app, done) => { let n = 0; return app.performer.on('noteon', () => { if (++n >= 4) done(); }); } },
  { text: 'Agora segure uma corda, puxe para o lado e solte. Quanto mais puxar, mais forte.', until: (app, done) => app.performer.on('noteon', (e) => { if (e.tech === 'pull' || e.tech === 'snap' || e.vel > 0.95) done(); }) },
  { text: 'Toque no nome do instrumento lá em cima e experimente um baixo ou um teclado.', until: (app, done) => app.on('instrument', () => setTimeout(done, 600)) },
  { text: 'Use os acordes embaixo, ligue a Jam e grave uma ideia com ●. Pronto: o palco é seu!', until: null },
];

export class Coach {
  constructor(app) { this.app = app; this.el = null; this.i = 0; this.off = null; }
  maybeStart() { if (!this.app.settings.tutorialDone && !this.el) this.start(); }
  start() { this.i = 0; this.show(); }
  show() {
    this.off?.(); this.el?.remove();
    const st = STEPS[this.i]; if (!st) return this.finish();
    const last = this.i === STEPS.length - 1;
    this.el = h('div#coach', { role: 'status' },
      h('span.step', {}, `Passo ${this.i + 1} de ${STEPS.length}`), h('p', {}, st.text),
      h('div.row', {}, btn('Pular tutorial', () => this.finish(), { cls: 'small' }), last ? btn('Começar', () => this.finish(), { cls: 'small primary' }) : btn('Próximo', () => this.next(), { cls: 'small' })));
    document.body.append(this.el);
    this.off = st.until ? st.until(this.app, () => this.next()) : null;
  }
  next() { this.i++; this.show(); }
  finish() { this.off?.(); this.off = null; this.el?.remove(); this.el = null; this.app.update({ tutorialDone: true }); }
}
