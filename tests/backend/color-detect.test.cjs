// Smart Product Upload stage 2: colour suggestion from photo pixels (pure part of product-color-detect.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../product-color-detect.js'), 'utf8'), ctx);
const C = ctx.window.MaColorDetect;

/** w×h picture: fill(x, y) → [r, g, b]. */
function picture(w, h, fill) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fill(x, y), i = (y * w + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; }
  return data;
}
const solid = (c) => picture(64, 80, () => c);

test('names the colours the shop sells', () => {
  const cases = [[[12, 12, 12], 'Black'], [[22, 30, 78], 'Navy'], [[112, 18, 38], 'Maroon'], [[84, 46, 31], 'Chocolate'],
    [[230, 150, 175], 'Pink'], [[84, 96, 42], 'Olive'], [[240, 240, 240], 'White']];
  for (const [rgb, name] of cases) assert.equal(C.dominant(solid(rgb), 64, 80).name, name, name);
});

test('a plain white studio background is ignored; the garment in the middle decides', () => {
  const data = picture(64, 80, (x, y) => (x > 18 && x < 46 && y > 8 && y < 72 ? [24, 34, 84] : [250, 250, 250]));
  const r = C.dominant(data, 64, 80);
  assert.equal(r.name, 'Navy');
  assert.ok(r.share > 0.9);
});

test('a white garment on a white background is still white (nothing else to pick)', () => {
  assert.equal(C.dominant(picture(64, 80, () => [248, 248, 246]), 64, 80).name, 'White');
});

test('a busy picture reports a low share so the page can warn', () => {
  const colours = [[200, 30, 40], [40, 140, 60], [40, 100, 200], [225, 173, 1], [110, 50, 140], [20, 20, 20], [245, 150, 180], [135, 206, 235]];
  const r = C.dominant(picture(64, 80, (x, y) => colours[(x * 7 + y * 3) % colours.length]), 64, 80);
  assert.ok(r.share < 0.25, 'share ' + r.share);
});

test('transparent or empty pictures give no suggestion', () => {
  const data = new Uint8ClampedArray(64 * 80 * 4); // alpha 0
  assert.equal(C.dominant(data, 64, 80), null);
});

test('palette names are unique and the nearest-colour lookup returns only palette names', () => {
  assert.equal(new Set(C.palette).size, C.palette.length);
  for (let i = 0; i < 200; i++) assert.ok(C.palette.includes(C.nameFromRgb((i * 53) % 256, (i * 97) % 256, (i * 193) % 256)));
});
