import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.env.MA_SCROLL_BASELINE;
function source(name) {
  return baseline ? execFileSync('git', ['show', `${baseline}:${name}`], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, name), 'utf8');
}

// Exercise the real handlers with controllable viewport, clocks and observers.
// This is a behavior regression suite, not a device FPS benchmark.
function environment({ width = 390, coarse = true, reduced = false, resizeObserver = true } = {}) {
  let nextId = 1;
  const ids = new Map(), events = new Map(), documentEvents = new Map();
  const intervals = new Map(), timeouts = new Map(), frames = new Map(), idle = new Map();
  const observers = [], sizeObservers = [];
  const count = { layoutReads: 0, styleWrites: 0, scrolls: 0, clones: 0, animations: 0 };
  const state = { width, coarse, reduced };
  class El {
    constructor(className = '') {
      this.className = className; this.children = []; this.parentNode = null;
      this.listeners = new Map(); this.attrs = new Map(); this.isConnected = true;
      this.width = 200; this.scrollLeft = 0; this._offsetHeight = 148;
      this.style = new Proxy({}, { set(obj, key, value) { count.styleWrites++; obj[key] = value; return true; } });
      this.classList = { toggle() {}, add() {}, remove() {}, contains() { return false; } };
    }
    addEventListener(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); }
    emit(name, event = {}) { (this.listeners.get(name) || []).forEach(fn => fn(event)); }
    get clientWidth() { count.layoutReads++; return this.width; }
    get offsetHeight() { count.layoutReads++; return this._offsetHeight; }
    get scrollWidth() { count.layoutReads++; return 1200; }
    getBoundingClientRect() { const i = this.parentNode ? this.parentNode.children.indexOf(this) : 0; return { left: i * 220, right: i * 220 + this.width, width: this.width, height: 300 }; }
    scrollBy({ left }) { this.scrollLeft += left; count.scrolls++; }
    scrollTo({ left }) { this.scrollLeft = left; count.scrolls++; }
    appendChild(el) { if (el.parentNode) el.parentNode.removeChild(el); el.parentNode = this; this.children.push(el); return el; }
    removeChild(el) { this.children.splice(this.children.indexOf(el), 1); el.parentNode = null; }
    cloneNode() { count.clones++; return new El(this.className); }
    setAttribute(key, value) { this.attrs.set(key, String(value)); }
    getAttribute(key) { return this.attrs.has(key) ? this.attrs.get(key) : null; }
    hasAttribute(key) { return this.attrs.has(key); }
    removeAttribute(key) { this.attrs.delete(key); }
    setPointerCapture() {}
    querySelectorAll(selector) {
      const all = []; const walk = node => node.children.forEach(child => { all.push(child); walk(child); }); walk(this);
      if (selector === '.ma-review-shot-card') return all.filter(el => el.className === 'ma-review-shot-card');
      if (selector === '[data-ma-clone="1"]') return all.filter(el => el.getAttribute('data-ma-clone') === '1');
      if (selector === 'img[data-src]') return all.filter(el => el.getAttribute('data-src'));
      return [];
    }
    querySelector() { return null; }
    animate() { count.animations++; return { currentTime: 0, playState: 'running', cancel() {}, pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; } }; }
  }
  const timer = map => (fn, ms) => { const id = nextId++; map.set(id, { fn, ms }); return id; };
  const add = map => (name, fn) => { const list = map.get(name) || []; list.push(fn); map.set(name, list); };
  const mqls = [];
  function matches(query) {
    return query.split(',').some(part => {
      const min = /min-width:\s*(\d+)/.exec(part), max = /max-width:\s*(\d+)/.exec(part);
      if (min && state.width < +min[1]) return false;
      if (max && state.width > +max[1]) return false;
      if (part.includes('prefers-reduced-motion') && !state.reduced) return false;
      if (part.includes('pointer: coarse') && !state.coarse) return false;
      if ((part.includes('pointer: fine') || part.includes('hover: hover')) && state.coarse) return false;
      return true;
    });
  }
  const panels = [{ open: false }];
  const document = {
    readyState: 'loading', hidden: false, fonts: null,
    head: new El(), body: new El(),
    documentElement: { get clientWidth() { return state.width; }, style: { setProperty() { count.styleWrites++; } }, getAttribute() { return null; } },
    getElementById: id => ids.get(id) || null,
    addEventListener: add(documentEvents),
    createElement: () => new El(),
    querySelector: () => null,
    querySelectorAll: selector => selector === '.anz-foot-details' ? panels : [],
  };
  ids.set('ma-home-btn-row', new El());
  const ctx = {
    document, Element: El, navigator: {}, console, URL, URLSearchParams,
    location: { pathname: '/', origin: 'https://muslimabaya.com', protocol: 'https:', href: 'https://muslimabaya.com/' },
    setInterval: timer(intervals), clearInterval: id => intervals.delete(id),
    setTimeout: timer(timeouts), clearTimeout: id => timeouts.delete(id),
    requestAnimationFrame: timer(frames), cancelAnimationFrame: id => frames.delete(id),
    requestIdleCallback: timer(idle), getComputedStyle: () => ({ columnGap: '20px' }),
    addEventListener: add(events),
    matchMedia(query) { const listeners = []; const m = { get matches() { return matches(query); }, addEventListener(_, fn) { listeners.push(fn); }, addListener(fn) { listeners.push(fn); }, emit() { listeners.forEach(fn => fn({ matches: m.matches })); } }; mqls.push(m); return m; },
    IntersectionObserver: class { constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); } observe(target) { this.targets.push(target); } disconnect() { this.targets = []; } },
  };
  if (resizeObserver) ctx.ResizeObserver = class { constructor(callback) { this.callback = callback; this.targets = []; sizeObservers.push(this); } observe(target) { this.targets.push(target); } disconnect() { this.targets = []; } };
  Object.defineProperty(ctx, 'innerWidth', { get: () => state.width });
  ctx.window = ctx; ctx.globalThis = ctx;
  function flush(map) { const list = [...map.values()]; map.clear(); list.forEach(item => item.fn()); }
  const api = {
    ctx, ids, count, state, panels, El, intervals, timeouts, frames, idle, observers, sizeObservers,
    flushFrames: () => flush(frames), flushTimeouts: () => flush(timeouts), flushIdle: () => flush(idle),
    dispatch: (name, event = {}) => (events.get(name) || []).forEach(fn => fn(event)),
    dispatchDocument: (name, event = {}) => (documentEvents.get(name) || []).forEach(fn => fn(event)),
    notifySize() { sizeObservers.forEach(o => o.callback(o.targets.map(target => ({ target })))); this.dispatch('resize'); },
    notifyMedia() { mqls.forEach(m => m.emit()); },
    expose(file, expression) { let text = source(file); const end = file === 'customer-reviews.js' ? text.lastIndexOf('\n})(') + 1 : text.lastIndexOf('})();'); assert.ok(end > 0, file); text = text.slice(0, end) + `window.__scrollTest = ${expression};\n` + text.slice(end); vm.runInNewContext(text, ctx, { filename: file }); return ctx.__scrollTest; },
  };
  return api;
}

function row(env) {
  const body = new env.El(), track = new env.El(), prev = new env.El(), next = new env.El(); track.width = 360;
  body.querySelector = selector => selector === '.home-row' ? track : selector.endsWith('.prev') ? prev : next;
  return { body, track, prev, next };
}

test('mobile row keeps native arrows without background timers or layout reads', () => {
  const env = environment(); const api = env.expose('index-home-muslim-abaya.js', '{ bindRowSlider }'); const r = row(env);
  api.bindRowSlider(r.body); env.flushFrames(); assert.equal(env.intervals.size, 0); assert.equal(env.count.layoutReads, 0);
  r.next.emit('click'); assert.equal(env.count.scrolls, 1); assert.equal(env.intervals.size, 0);
});

test('desktop rows autoplay only while visible', () => {
  const env = environment({ width: 1200, coarse: false }); const api = env.expose('index-home-muslim-abaya.js', '{ bindRowSlider }'); const r = row(env);
  api.bindRowSlider(r.body); env.flushFrames(); assert.equal(env.intervals.size, 0); assert.equal(env.count.layoutReads, 0);
  const observer = env.observers[0]; assert.ok(observer); observer.callback([{ target: r.body, isIntersecting: true }]); assert.equal(env.intervals.size, 1);
  [...env.intervals.values()][0].fn(); assert.equal(env.count.scrolls, 1);
  observer.callback([{ target: r.body, isIntersecting: false }]); assert.equal(env.intervals.size, 0);
});

test('coarse-pointer tablets avoid row autoplay even at desktop width', () => {
  const env = environment({ width: 1200, coarse: true }); const api = env.expose('index-home-muslim-abaya.js', '{ startRowAuto }'); const r = row(env);
  r.body.__ahRowVisible = true; api.startRowAuto(r.body, r.track); assert.equal(env.intervals.size, 0);
});

test('autoplay follows width and motion preference changes after the page is running', () => {
  const env = environment({ width: 1200, coarse: false });
  const api = env.expose('index-home-muslim-abaya.js', '{ bindRowSlider, startHero, ready(n) { rendered = true; heroTotalRef = n; } }');
  const r = row(env), root = new env.El(), hero = new env.El();
  root.querySelectorAll = () => [r.body]; hero.__ahHeroVisible = true;
  env.ids.set('homeSections', root); env.ids.set('homeHero', hero);
  api.bindRowSlider(r.body); api.ready(3);
  env.observers[0].callback([{ target: r.body, isIntersecting: true }]); api.startHero(hero, 3);
  assert.equal(env.intervals.size, 2);
  env.state.width = 390; env.notifyMedia(); env.flushFrames(); assert.equal(env.intervals.size, 1);
  env.state.reduced = true; env.notifyMedia(); env.flushFrames(); assert.equal(env.intervals.size, 0);
  env.state.width = 1200; env.state.reduced = false; env.notifyMedia(); env.flushFrames(); assert.equal(env.intervals.size, 2);
});

test('touch hover events keep hero controls and autoplay working; desktop hover pauses', () => {
  for (const coarse of [true, false]) {
    const env = environment({ width: coarse ? 390 : 1200, coarse });
    const api = env.expose('index-home-muslim-abaya.js', '{ bindHero, getIndex() { return heroIdx; } }');
    const hero = new env.El(), prev = new env.El(), next = new env.El();
    const slides = [new env.El(), new env.El(), new env.El()];
    hero.querySelector = selector => selector.endsWith('.prev') ? prev : next;
    hero.querySelectorAll = selector => selector === '.home-hero-slide' ? slides : [];
    env.ids.set('homeHero', hero); api.bindHero(hero, 3);
    env.observers[0].callback([{ target: hero, isIntersecting: true }]); assert.equal(env.intervals.size, 1);
    hero.emit('mouseenter'); assert.equal(env.intervals.size, coarse ? 1 : 0);
    next.emit('click'); assert.equal(api.getIndex(), 1); assert.equal(env.intervals.size, coarse ? 1 : 0);
    hero.emit('mouseleave'); assert.equal(env.intervals.size, 1);
  }
});

test('hero autoplay pauses offscreen and in hidden tabs', () => {
  const env = environment(); const api = env.expose('index-home-muslim-abaya.js', '{ startHero }'); const hero = new env.El();
  hero.__ahHeroVisible = false; api.startHero(hero, 3); assert.equal(env.intervals.size, 0);
  hero.__ahHeroVisible = true; api.startHero(hero, 3); assert.equal(env.intervals.size, 1);
  env.ctx.document.hidden = true; api.startHero(hero, 3); assert.equal(env.intervals.size, 0);
});

test('reduced motion avoids automatic hero changes', () => {
  const env = environment({ reduced: true }); const api = env.expose('index-home-muslim-abaya.js', '{ startHero }'); api.startHero(new env.El(), 3); assert.equal(env.intervals.size, 0);
});

test('first swipe does not load all deferred hero images; idle warming loads one', () => {
  const env = environment(); const hero = new env.El(), images = [new env.El(), new env.El(), new env.El()];
  images.forEach((im, i) => im.setAttribute('data-src', `banner-${i}.webp`));
  const slides = images.map(im => { const s = new env.El(); s.appendChild(im); return s; }); hero.querySelectorAll = () => slides; hero.__ahHeroVisible = true;
  env.ids.set('homeHero', hero); const originalQuery = env.ctx.document.querySelectorAll;
  env.ctx.document.querySelectorAll = selector => selector === '#homeHero img[data-src]' ? images : originalQuery(selector);
  const api = env.expose('index-home-muslim-abaya.js', '{ scheduleHeroSlideImages, setTotal(n) { heroTotalRef = n; } }');
  api.setTotal(3); api.scheduleHeroSlideImages(); env.dispatch('touchstart'); env.dispatch('scroll');
  assert.equal(images.filter(im => im.getAttribute('data-src')).length, 3);
  env.dispatch('load'); env.flushTimeouts(); env.flushIdle(); assert.equal(images.filter(im => im.getAttribute('data-src')).length, 2);
});

test('unchanged header height does not repeatedly mutate page spacing', () => {
  const env = environment(); const mount = new env.El(), header = new env.El(); mount.querySelector = () => header; env.ids.set('site-header-mount', mount);
  const api = env.expose('site-header.js', '{ syncSiteHeaderOffset }'); api.syncSiteHeaderOffset(); const writes = env.count.styleWrites;
  api.syncSiteHeaderOffset(); api.syncSiteHeaderOffset(); assert.equal(env.count.styleWrites, writes);
  header._offsetHeight = 172; api.syncSiteHeaderOffset(); assert.equal(mount.style.minHeight, '172px'); assert.equal(env.count.styleWrites, writes + 2);
});

test('header observer batches layout work and responds to actual height changes', () => {
  const env = environment(); const mount = new env.El(), header = new env.El(); mount.querySelector = () => header; env.ids.set('site-header-mount', mount);
  const api = env.expose('site-header.js', '{ syncSiteHeaderOffset, observeSiteHeaderSize: typeof observeSiteHeaderSize === "function" ? observeSiteHeaderSize : null }');
  api.syncSiteHeaderOffset(); api.observeSiteHeaderSize(mount); env.count.layoutReads = 0; env.notifySize(); env.notifySize(); env.notifySize();
  assert.equal(env.frames.size, 1); env.flushFrames(); assert.equal(env.count.layoutReads, 1);
  header._offsetHeight = 210; env.notifySize(); env.flushFrames(); assert.equal(mount.style.minHeight, '210px');
});

test('touch scrolling does not trigger speculative page fetch listeners', () => {
  const env = environment(); const api = env.expose('site-header.js', '{ initFastNavigation }'); api.initFastNavigation();
  env.ctx.document.createElement = () => { throw new Error('Touch should not prefetch a page'); };
  const anchor = { getAttribute: () => '/abaya' }; env.dispatchDocument('touchstart', { target: { closest: () => anchor } }); env.flushTimeouts();
});

test('open mobile footer panel survives height-only resize; width breakpoint still updates', () => {
  const env = environment(); const api = env.expose('site-footer.js', '{ syncFooterPanels }'); api.syncFooterPanels(true);
  env.panels[0].open = true; api.syncFooterPanels(); assert.equal(env.panels[0].open, true);
  env.state.width = 1200; api.syncFooterPanels(); assert.equal(env.panels[0].open, true);
  env.state.width = 390; api.syncFooterPanels(); assert.equal(env.panels[0].open, false);
});

for (const resizeObserver of [true, false]) test(`review carousel ignores height-only resize (${resizeObserver ? 'observer' : 'fallback'})`, () => {
  const env = environment({ resizeObserver }); const track = new env.El(); track.width = 390;
  track.appendChild(new env.El('ma-review-shot-card')); track.appendChild(new env.El('ma-review-shot-card'));
  const api = env.expose('customer-reviews.js', '{ initCarousel }'); api.initCarousel(track)();
  const clones = env.count.clones, animations = env.count.animations;
  env.notifySize(); env.flushTimeouts(); assert.equal(env.count.clones, clones); assert.equal(env.count.animations, animations);
  track.width = 600; env.notifySize(); env.flushTimeouts(); assert.ok(env.count.clones > clones); assert.equal(env.count.animations, animations + 1);
});

test('all changed JavaScript still parses', () => {
  for (const file of ['site-header.js', 'site-footer.js', 'customer-reviews.js', 'index-home-muslim-abaya.js']) new vm.Script(source(file), { filename: file });
});
