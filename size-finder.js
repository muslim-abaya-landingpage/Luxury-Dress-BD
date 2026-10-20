/**
 * Muslim Abaya — "আমার সাইজ কোনটা?" (product page).
 * The customer gives a measurement in inches; we pick from THIS product's own size buttons.
 *  - body/chest mode: smallest option that is ≥ the measurement (the dress must not be tighter than the body)
 *  - length mode: the option closest to the measurement (a tie picks the longer one)
 * If the measurement is beyond every option, we say so and point to Custom Size / WhatsApp instead of guessing.
 */
(function (root) {
  "use strict";

  function firstNumber(v) {
    var m = /(\d+(?:\.\d+)?)/.exec(String(v == null ? "" : v));
    return m ? parseFloat(m[1]) : NaN;
  }

  /** @returns {{value:string|null, outOfRange:'above'|'below'|null}} */
  function pick(options, measurement, mode) {
    var m = Number(measurement);
    var list = (options || []).map(function (o) { return { value: String(o), n: firstNumber(o) }; })
      .filter(function (o) { return isFinite(o.n); })
      .sort(function (a, b) { return a.n - b.n; });
    if (!list.length || !isFinite(m) || m <= 0) return { value: null, outOfRange: null };
    var min = list[0].n, max = list[list.length - 1].n;
    if (mode === "body") {
      for (var i = 0; i < list.length; i++) if (list[i].n >= m) return { value: list[i].value, outOfRange: null };
      return { value: null, outOfRange: "above" };
    }
    if (m > max + 1) return { value: null, outOfRange: "above" };
    if (m < min - 2) return { value: list[0].value, outOfRange: "below" };
    var best = list[0];
    list.forEach(function (o) {
      var d = Math.abs(o.n - m), bd = Math.abs(best.n - m);
      if (d < bd || (d === bd && o.n > best.n)) best = o;
    });
    return { value: best.value, outOfRange: null };
  }

  var api = { pick: pick, firstNumber: firstNumber };
  root.MaSizeFinder = api;
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  if (typeof document === "undefined") return;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var CSS =
    ".sf-btn{font-size:12.5px;font-weight:600;color:var(--ink,#1b1a1f);text-decoration:underline;margin-left:8px;background:none;border:0;padding:0;cursor:pointer;font-family:inherit}" +
    ".sf-box{margin:10px 0 4px;padding:12px;border:1px solid rgba(0,0,0,.12);border-radius:12px;background:rgba(212,167,44,.06);font-size:14px}" +
    ".sf-box[hidden]{display:none}.sf-box label{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;font-weight:600}" +
    ".sf-box input{padding:9px 10px;border:1px solid rgba(0,0,0,.2);border-radius:8px;font:inherit;max-width:160px}" +
    ".sf-box small{font-weight:400;opacity:.75}.sf-out{margin-top:8px;line-height:1.55}.sf-out b{font-size:15px}" +
    ".sf-go{margin-top:8px;padding:9px 14px;border-radius:999px;border:0;background:#14121a;color:#fff;font:inherit;font-weight:600;cursor:pointer}";

  function addStyle() {
    if (document.getElementById("sfStyle")) return;
    var st = document.createElement("style"); st.id = "sfStyle"; st.textContent = CSS; document.head.appendChild(st);
  }

  function attrOf(g) { return g.attr || "data-val"; }
  function optionValues(scope, g) {
    return Array.prototype.map.call(scope.querySelectorAll(g.selector), function (b) { return b.getAttribute(attrOf(g)); });
  }
  function clickOption(scope, g, value) {
    var btns = scope.querySelectorAll(g.selector);
    for (var i = 0; i < btns.length; i++) if (btns[i].getAttribute(attrOf(g)) === value) { if (!btns[i].disabled) btns[i].click(); return true; }
    return false;
  }

  /**
   * spec: { scope, labelHost, boxAfter, groups: [{ selector, attr?, mode: 'body'|'length', label }], hasCustom }
   * product-page.js re-renders its buttons on every pick, so values are re-read at click time.
   */
  var memory = {};
  function attach(spec) {
    var scope = spec && (spec.scope || document);
    var labelHost = spec && spec.labelHost;
    if (!labelHost || labelHost.querySelector(".sf-btn")) return false;
    var groups = (spec.groups || []).filter(function (g) {
      var vals = optionValues(scope, g).filter(function (v) { return isFinite(firstNumber(v)); });
      return vals.length > 1 || (vals.length === 1 && g.mode === "body");
    });
    if (!groups.length) return false;
    addStyle();
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "sf-btn"; btn.textContent = "📏 আমার সাইজ কোনটা?";
    labelHost.appendChild(btn);
    var box = document.createElement("div");
    box.className = "sf-box"; box.hidden = !memory.open;
    var needs = {};
    groups.forEach(function (g) { needs[g.mode] = true; });
    box.innerHTML =
      (needs.body ? '<label>বুকের মাপ (ইঞ্চি)<small>ফিতা দিয়ে বুকের সবচেয়ে চওড়া জায়গায় ঘুরিয়ে মাপুন</small><input type="number" inputmode="decimal" min="20" max="70" step="0.5" data-sf="body" value="' + esc(memory.body || "") + '"></label>' : "") +
      (needs.length ? '<label>লম্বা মাপ (ইঞ্চি)<small>কাঁধের উপর থেকে যেখান পর্যন্ত পোশাক চান (সাধারণত পায়ের গোড়ালি)</small><input type="number" inputmode="decimal" min="20" max="75" step="0.5" data-sf="length" value="' + esc(memory.length || "") + '"></label>' : "") +
      '<div class="sf-out" aria-live="polite"></div>';
    var after = spec.boxAfter || labelHost;
    after.parentNode.insertBefore(box, after.nextSibling);
    var out = box.querySelector(".sf-out");

    function compute() {
      var picks = [], notes = [];
      groups.forEach(function (g) {
        var input = box.querySelector('[data-sf="' + g.mode + '"]');
        var m = input && input.value ? parseFloat(input.value) : NaN;
        if (!isFinite(m)) return;
        var r = pick(optionValues(scope, g), m, g.mode);
        if (r.value) picks.push({ g: g, value: r.value });
        if (r.outOfRange === "above") notes.push(g.label + ": আপনার মাপ আমাদের সবচেয়ে বড় সাইজের চেয়েও বেশি।" + (spec.hasCustom ? " \"Custom Size\" বেছে নিন।" : " WhatsApp-এ মাপ জানিয়ে অর্ডার করুন।"));
        if (r.outOfRange === "below") notes.push(g.label + ": আপনার মাপ সবচেয়ে ছোট সাইজের চেয়েও কম, তাই সবচেয়ে ছোটটি দেখানো হলো। নিশ্চিত হতে WhatsApp করুন।");
      });
      if (!picks.length && !notes.length) { out.innerHTML = ""; return; }
      out.innerHTML = (picks.length ? "আপনার জন্য: " + picks.map(function (p) { return esc(p.g.label) + " <b>" + esc(p.value) + "</b>"; }).join(" · ") : "") +
        (notes.length ? "<div>" + notes.map(esc).join("<br>") + "</div>" : "") +
        (picks.length ? '<div><button type="button" class="sf-go">এই সাইজ বেছে নিন</button></div><small>এটা আপনার মাপ থেকে হিসাব করা পরামর্শ। দ্বিধা থাকলে WhatsApp-এ জিজ্ঞেস করুন।</small>' : "");
      var go = out.querySelector(".sf-go");
      if (go) go.addEventListener("click", function () {
        memory.open = true;
        picks.forEach(function (p) { clickOption(scope, p.g, p.value); });
      });
    }
    box.addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-sf"); if (k) memory[k] = e.target.value;
      compute();
    });
    btn.addEventListener("click", function () { box.hidden = !box.hidden; memory.open = !box.hidden; if (!box.hidden) { var f = box.querySelector("input"); if (f) f.focus(); } });
    compute();
    return true;
  }

  api.attach = attach;
})(typeof window !== "undefined" ? window : globalThis);
