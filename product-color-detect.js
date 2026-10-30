/**
 * Suggests a colour name for a product photo (Product Manager → Upload new product).
 * It looks at the middle of the picture, ignores a plain white/light studio background, takes the most common
 * colour and names it from a fixed palette. This is a suggestion only: the person confirms or changes it.
 * Models, skin, lighting and prints can fool it, so nothing is saved from it without a tap.
 */
(function (g) {
  'use strict';

  var PALETTE = [
    ['Black', 20, 20, 20], ['Charcoal', 54, 69, 79], ['Grey', 128, 128, 128], ['Silver', 192, 192, 192],
    ['White', 245, 245, 245], ['Cream', 255, 250, 215], ['Beige', 222, 196, 160], ['Camel', 193, 154, 107],
    ['Brown', 110, 72, 40], ['Chocolate', 82, 45, 30], ['Coffee', 120, 85, 60],
    ['Maroon', 110, 15, 35], ['Red', 200, 30, 40], ['Rust', 183, 65, 14], ['Orange', 240, 130, 40],
    ['Mustard', 225, 173, 1], ['Yellow', 250, 220, 60],
    ['Olive', 85, 95, 40], ['Green', 40, 140, 60], ['Emerald', 20, 120, 90], ['Mint', 170, 225, 200], ['Teal', 0, 128, 128],
    ['Sky Blue', 135, 206, 235], ['Blue', 40, 100, 200], ['Royal Blue', 40, 60, 170], ['Navy', 20, 30, 80],
    ['Purple', 110, 50, 140], ['Lavender', 190, 170, 225], ['Mauve', 150, 110, 130],
    ['Pink', 245, 150, 180], ['Baby Pink', 248, 200, 215], ['Rose', 190, 90, 110], ['Peach', 255, 210, 180]
  ];

  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lab(r, gg, b) {
    var R = lin(r), G = lin(gg), B = lin(b);
    var x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  var PALETTE_LAB = PALETTE.map(function (p) { return lab(p[1], p[2], p[3]); });

  /** Nearest palette colour (CIE Lab distance) for an RGB value. */
  function nameFromRgb(r, gg, b) {
    var c = lab(r, gg, b), best = 0, bestD = Infinity;
    PALETTE_LAB.forEach(function (p, i) {
      var d = (p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]) + (p[2] - c[2]) * (p[2] - c[2]);
      if (d < bestD) { bestD = d; best = i; }
    });
    return PALETTE[best][0];
  }

  function hex(r, gg, b) { return '#' + [r, gg, b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }

  /**
   * data = RGBA bytes of width × height. Returns {name, hex, share} or null when nothing usable is in the picture.
   * share = how much of the looked-at area has this colour (0–1); a low share means a busy print, so be careful.
   */
  function dominant(data, width, height) {
    var x0 = Math.floor(width * 0.2), x1 = Math.ceil(width * 0.8), y0 = Math.floor(height * 0.08), y1 = Math.ceil(height * 0.92);
    function scan(skipBackground) {
      var buckets = {}, total = 0, key, i, x, y, r, gg, b, max, min;
      for (y = y0; y < y1; y++) {
        for (x = x0; x < x1; x++) {
          i = (y * width + x) * 4;
          if (data[i + 3] < 200) continue;
          r = data[i]; gg = data[i + 1]; b = data[i + 2];
          max = Math.max(r, gg, b); min = Math.min(r, gg, b);
          if (skipBackground && min > 215 && max - min < 22) continue; // white / light grey studio background
          total++;
          key = (r >> 4) * 256 + (gg >> 4) * 16 + (b >> 4);
          var o = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
          o.n++; o.r += r; o.g += gg; o.b += b;
        }
      }
      return { buckets: buckets, total: total };
    }
    var all = scan(false), s = scan(true);
    // A white garment on a white background leaves almost nothing once the background is skipped.
    var use = s.total >= all.total * 0.08 ? s : all;
    if (!use.total) return null;
    var top = null;
    Object.keys(use.buckets).forEach(function (k) { var o = use.buckets[k]; if (!top || o.n > top.n) top = o; });
    var r2 = top.r / top.n, g2 = top.g / top.n, b2 = top.b / top.n;
    return { name: nameFromRgb(r2, g2, b2), hex: hex(r2, g2, b2), share: top.n / use.total };
  }

  /** Reads an image File in the browser and returns {name, hex, share}, or null if it cannot be read. */
  function detect(file) {
    return new Promise(function (resolve) {
      var url = null, image = new Image();
      image.onload = function () {
        try {
          var w = 64, h = Math.max(1, Math.round(64 * image.naturalHeight / Math.max(1, image.naturalWidth)));
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, w, h);
          resolve(dominant(ctx.getImageData(0, 0, w, h).data, w, h));
        } catch (e) { resolve(null); }
        URL.revokeObjectURL(url);
      };
      image.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      try { url = URL.createObjectURL(file); image.src = url; } catch (e) { resolve(null); }
    });
  }

  g.MaColorDetect = { palette: PALETTE.map(function (p) { return p[0]; }), nameFromRgb: nameFromRgb, dominant: dominant, detect: detect };
})(typeof window !== 'undefined' ? window : this);
