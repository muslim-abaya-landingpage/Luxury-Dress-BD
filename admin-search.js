/* Admin quick search (Ctrl+K or "/"): one box for order IDs, phone numbers, products and admin pages. */
(function () {
  "use strict";
  if (window.__maAdminSearch) return;
  window.__maAdminSearch = true;
  var box, input, list, items = [], active = 0, lastFocus = null;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function digits(s) { return String(s || "").replace(/[০-৯]/g, function (c) { return "০১২৩৪৫৬৭৮৯".indexOf(c); }).replace(/\D/g, ""); }
  function pages() {
    var seen = {};
    return Array.prototype.map.call(document.querySelectorAll(".adm-sidebar-nav a[href]"), function (a) {
      return { label: (a.textContent || "").trim(), href: a.getAttribute("href") };
    }).filter(function (p) { if (!p.label || seen[p.href]) return false; seen[p.href] = true; return true; });
  }
  function build(q) {
    var out = [], t = q.trim(), d = digits(t), low = t.toLowerCase();
    if (!t) return pages().slice(0, 8).map(function (p) { return { icon: "↗", label: p.label, hint: "পেজ", href: p.href }; });
    var phone = d.indexOf("880") === 0 ? d.slice(2) : d;
    if (/^01\d{9}$/.test(phone)) out.push({ icon: "👤", label: "কাস্টমার প্রোফাইল: " + phone, hint: "অর্ডার হিসাব ও ঝুঁকি", href: "admin-customers.html?phone=" + phone });
    if (/^[a-z]{2,4}-?\d{4,}$/i.test(t)) out.push({ icon: "🧾", label: "অর্ডার খুলুন: " + t.toUpperCase(), hint: "সরাসরি অর্ডার পেজ", href: "admin-order.html?id=" + encodeURIComponent(t.toUpperCase()) });
    out.push({ icon: "🔎", label: "অর্ডারে খুঁজুন: “" + t + "”", hint: "নাম, ফোন বা অর্ডার নম্বর", href: "admin-orders.html?q=" + encodeURIComponent(t.slice(0, 40)) });
    out.push({ icon: "👗", label: "পণ্যে খুঁজুন: “" + t + "”", hint: "প্রোডাক্ট ম্যানেজার", href: "product-manager.html?q=" + encodeURIComponent(t.slice(0, 80)) });
    pages().forEach(function (p) { if (p.label.toLowerCase().indexOf(low) !== -1 || p.href.toLowerCase().indexOf(low) !== -1) out.push({ icon: "↗", label: p.label, hint: "পেজ", href: p.href }); });
    return out.slice(0, 9);
  }
  function paint() {
    list.innerHTML = items.map(function (it, i) {
      return '<li role="option" id="maqs-' + i + '" aria-selected="' + (i === active) + '" data-i="' + i + '"><span class="maqs-ico" aria-hidden="true">' + it.icon +
        '</span><span class="maqs-txt"><b>' + esc(it.label) + "</b><small>" + esc(it.hint) + "</small></span></li>";
    }).join("");
    input.setAttribute("aria-activedescendant", items.length ? "maqs-" + active : "");
  }
  function refresh() { items = build(input.value); active = 0; paint(); }
  function go(i) { var it = items[i]; if (it) location.href = it.href; }
  function open() {
    if (!box) create();
    lastFocus = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add("maqs-open");
    input.value = "";
    refresh();
    input.focus();
  }
  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    document.documentElement.classList.remove("maqs-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function create() {
    box = document.createElement("div");
    box.className = "maqs";
    box.hidden = true;
    box.innerHTML = '<div class="maqs-panel" role="dialog" aria-modal="true" aria-label="দ্রুত খুঁজুন">' +
      '<div class="maqs-field"><span aria-hidden="true">⌕</span><input type="search" role="combobox" aria-expanded="true" aria-controls="maqsList" aria-autocomplete="list" placeholder="অর্ডার নম্বর, ফোন নম্বর, পণ্য বা পেজের নাম…" autocomplete="off"><kbd>Esc</kbd></div>' +
      '<ul class="maqs-list" id="maqsList" role="listbox"></ul><p class="maqs-foot">↑↓ বাছুন · Enter খুলুন · কিবোর্ডে Ctrl + K</p></div>';
    document.body.appendChild(box);
    input = box.querySelector("input");
    list = box.querySelector("ul");
    input.addEventListener("input", refresh);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paint(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
      else if (e.key === "Enter") { e.preventDefault(); go(active); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    list.addEventListener("click", function (e) { var li = e.target.closest("[data-i]"); if (li) go(Number(li.getAttribute("data-i"))); });
    box.addEventListener("mousedown", function (e) { if (e.target === box) close(); });
  }
  function addButton() {
    var host = document.querySelector(".adm-topbar-actions, .pl-admin-header .pl-toolbar, .top-actions, .pn-head");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "maqs-btn" + (host ? "" : " maqs-btn-float");
    btn.setAttribute("aria-label", "দ্রুত খুঁজুন (Ctrl + K)");
    btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>খুঁজুন</span><kbd>Ctrl K</kbd>';
    btn.addEventListener("click", open);
    if (host) host.insertBefore(btn, host.firstChild); else document.body.appendChild(btn);
  }
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); if (box && !box.hidden) close(); else open(); }
    else if (e.key === "/" && !typing && !(box && !box.hidden)) { e.preventDefault(); open(); }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton); else addButton();
  window.MaAdminSearch = { open: open, close: close };
})();
