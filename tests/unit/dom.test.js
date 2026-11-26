import { describe, it, expect, vi, afterEach } from 'vitest';
import { h } from '../../src/ui/dom.js';

afterEach(() => vi.unstubAllGlobals());

function stubDocument() {
  const createElement = vi.fn((tag) => {
    if (!/^[a-z][a-z0-9-]*$/i.test(tag)) throw new Error('Invalid HTML tag: ' + tag);
    const classes = [];
    return { tag, id: '', classes, classList: { add: (v) => classes.push(v) } };
  });
  vi.stubGlobal('document', { createElement });
  return createElement;
}

describe('UI element factory', () => {
  it('creates the home and all shell landmarks from tag#id shorthand', () => {
    const create = stubDocument();
    for (const [tag,id] of [['main','home'], ['div','hud'], ['div','dock'], ['header','topbar'], ['div','coach']]) {
      const el = h(tag+'#'+id);
      expect(el.tag).toBe(tag);
      expect(el.id).toBe(id);
    }
    expect(create).toHaveBeenCalledTimes(5);
  });
  it('keeps classes and ID independent', () => {
    stubDocument();
    const el = h('div#coach.hidden.active');
    expect(el.tag).toBe('div');
    expect(el.id).toBe('coach');
    expect(el.classes).toEqual(['hidden','active']);
  });
  it('defaults to div when only a selector is specified', () => {
    stubDocument();
    expect(h('.panel').tag).toBe('div');
    expect(h('#stage').id).toBe('stage');
  });
});