/* wishlist.js — "পছন্দের তালিকা" (♥). Saved in this browser only (localStorage, up to 100 products); no login needed.
   Adds a heart to product cards (shop + home) and to the product page; the list is on /wishlist.
   Loaded by mobile-bottom-nav.js, so every storefront page gets it. API: window.maWishlist. */
(function () {
  "use strict";
  if (window.maWishlist) return;
  var KEY = "ma_wishlist_v1", MAX = 100;
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string" && x; }) : []; }
    catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("ma-wishlist-change", { detail: { count: list.length } })); } catch (e2) {}
  }
  var api = {
    list: read,
    has: function (id) { return read().indexOf(String(id)) !== -1; },
    count: function () { return read().length; },
    toggle: function (id) {
      id = String(id || ""); if (!id) return false;
      var list = read(), i = list.indexOf(id), on = i === -1;
      if (on) list.unshift(id); else list.splice(i, 1);
      write(list);
      return on;
    },
    remove: function (id) { var list = read(), i = list.indexOf(String(id)); if (i !== -1) { list.splice(i, 1); write(list); } }
  };
  window.maWishlist = api;
  // other tabs
  window.addEventListener("storage", function (e) { if (e.key === KEY) { paintAll(); try { window.dispatchEvent(new CustomEvent("ma-wishlist-change", { detail: { count: api.count() } })); } catch (x) {} } });

  var HEART = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z"/></svg>';
  function css() {
    if (document.getElementById("ma-wish-style")) return;
    var st = document.createElement("style");
    st.id = "ma-wish-style";
    st.textContent =
      /* Card heart — Anzaar style: small white circle in the image's top-right corner, thin outline heart,
         "Wishlist" tooltip on hover. Filled black when saved. */
      ".ma-wish{position:absolute;top:10px;right:10px;bottom:auto;left:auto;z-index:4;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.14);cursor:pointer;padding:0;transition:transform .15s ease,box-shadow .15s ease}" +
      ".ma-wish svg{width:15px;height:15px;fill:none;stroke:#111;stroke-width:1.6;transition:fill .15s ease}" +
      ".ma-wish:hover{transform:scale(1.08);box-shadow:0 2px 8px rgba(0,0,0,.2)}" +
      ".ma-wish.is-on svg{fill:#111;stroke:#111}" +
      ".ma-wish:focus-visible{outline:2px solid #111;outline-offset:2px}" +
      ".ma-wish:not(.ma-wish-inline)::after{content:'Wishlist';position:absolute;top:50%;right:calc(100% + 6px);transform:translateY(-50%);background:#fff;color:#111;border:1px solid #111;font:500 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:5px 7px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s ease}" +
      "@media (hover:hover){.ma-wish:not(.ma-wish-inline):hover::after{opacity:1}}" +
      ".ma-wish-inline{position:static;top:auto;right:auto;bottom:auto;transform:none;border-radius:0;box-shadow:none;border:1px solid #d6d3d1;width:auto;height:38px;padding:0 12px;gap:6px;font-size:13px;font-weight:600;color:#111;margin:6px 0}" +
      ".ma-wish-inline:hover{transform:none;box-shadow:none}" +
      ".ma-wish-inline svg{width:18px;height:18px;stroke-width:1.8}" +
      ".ma-wish-inline.is-on svg{fill:#c0262d;stroke:#c0262d}" +
      ".ma-wish-host{position:relative}";
    document.head.appendChild(st);
  }
  function idFromCard(card) {
    var pid = card.getAttribute("data-pid");
    if (pid) return pid;
    var a = card.querySelector('a[href*="/product/"]');
    if (!a) return "";
    var m = /\/product\/([^/?#]+)/.exec(a.getAttribute("href") || "");
    return m ? decodeURIComponent(m[1]) : "";
  }
  function paint(btn) {
    var on = api.has(btn.getAttribute("data-wish-id"));
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "পছন্দের তালিকা থেকে সরান" : "পছন্দের তালিকায় রাখুন");
    var t = btn.querySelector(".ma-wish-text");
    if (t) t.textContent = on ? "পছন্দের তালিকায় আছে" : "পছন্দের তালিকায় রাখুন";
  }
  function paintAll() { Array.prototype.forEach.call(document.querySelectorAll(".ma-wish[data-wish-id]"), paint); }
  function makeBtn(id, inline) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ma-wish" + (inline ? " ma-wish-inline" : "");
    b.setAttribute("data-wish-id", id);
    b.innerHTML = HEART + (inline ? '<span class="ma-wish-text"></span>' : "");
    paint(b);
    return b;
  }
  var CARD_SEL = "article.ah-card, article.premium-card";
  function decorate(root) {
    if (!root || !root.querySelectorAll) return;
    var cards = [];
    if (root.matches && root.matches(CARD_SEL)) cards.push(root);
    cards = cards.concat(Array.prototype.slice.call(root.querySelectorAll(CARD_SEL)));
    cards.forEach(function (card) {
      if (card.querySelector(".ma-wish")) return;
      var id = idFromCard(card);
      if (!id) return;
      var host = card.querySelector(".ah-card-media, .detail-media, .img-wrap, .card-img-link") || card;
      host.classList.add("ma-wish-host");
      host.appendChild(makeBtn(id, false));
    });
    var m = /^\/product\/([^/?#]+)/.exec(location.pathname);
    var title = document.getElementById("pqvTitle");
    if (m && title && !document.querySelector(".ma-wish-inline")) title.insertAdjacentElement("afterend", makeBtn(decodeURIComponent(m[1]), true));
  }
  var noteTimer = null;
  function note(text) {
    var n = document.getElementById("maWishNote");
    if (!n) {
      n = document.createElement("div");
      n.id = "maWishNote";
      n.setAttribute("role", "status");
      n.style.cssText = "position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:99999;background:#111;color:#fff;padding:10px 16px;font-size:13px;max-width:90vw;pointer-events:none;transition:opacity .2s";
      document.body.appendChild(n);
    }
    n.textContent = text;
    n.style.opacity = "1";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { n.style.opacity = "0"; }, 1800);
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest(".ma-wish[data-wish-id]") : null;
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    var on = api.toggle(b.getAttribute("data-wish-id"));
    paintAll();
    note(on ? "পছন্দের তালিকায় রাখা হয়েছে ♥" : "পছন্দের তালিকা থেকে সরানো হয়েছে");
  }, true);
  function start() {
    css();
    decorate(document.body);
    if (window.MutationObserver) new MutationObserver(function (recs) { recs.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) decorate(n); }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
