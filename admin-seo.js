/* Admin → SEO Manager: results of the automatic SEO checks (every deploy + daily live audit), the products
   that use automatic SEO text, page/category SEO with approve, redirects, robots.txt and Google data.
   Server: /api/seo-report, /api/seo-settings, /api/seo-google (owner only). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function token() { var s = window.MaAdmin && window.MaAdmin.getSession && window.MaAdmin.getSession(); return s && s.token; }
  function api(path, body) {
    var t = token();
    if (!t) return Promise.reject(new Error("Please log in again."));
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ Token: t }, body || {})) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP_" + r.status }; }); })
      .then(function (res) { if (!res.ok) { var e = new Error(res.message || (res.errors && res.errors.join(" ")) || res.error || "Failed"); e.res = res; throw e; } return res; });
  }
  var LEVEL_NAME = { error: "Error", warning: "Warning", info: "Tip" };
  var state = { report: null, settings: null, sha: "", dirty: false };

  function showError(msg) { var el = $("seoError"); el.hidden = !msg; el.textContent = msg || ""; }
  function setDirty(v) {
    state.dirty = v;
    $("seoSave").disabled = !v || !state.settings;
    if (v) { var m = $("seoSaveMsg"); m.className = ""; m.textContent = "Unsaved changes. Changes go live with the next deploy, about 2 minutes after saving."; }
  }
  window.addEventListener("beforeunload", function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- Tabs ----------
  document.querySelectorAll(".seo-tabs [data-tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".seo-tabs [data-tab]").forEach(function (x) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      document.querySelectorAll(".seo-panel").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== b.getAttribute("data-tab"); });
      if (b.getAttribute("data-tab") === "google" && !state.googleLoaded) loadGoogle();
    });
  });

  // ---------- Overview + issues ----------
  function allIssues() {
    var r = state.report || {}, src = $("seoSource").value, out = [];
    if (r.build && src !== "live") r.build.issues.forEach(function (i) { out.push(Object.assign({ src: "Deploy check" }, i)); });
    var live = r.live && r.live[0];
    if (live && live.issues && src !== "build") live.issues.forEach(function (i) { out.push(Object.assign({ src: "Live check" }, i)); });
    return out;
  }
  function renderCards() {
    var r = state.report || {}, b = r.build && r.build.summary, live = r.live && r.live[0];
    var errors = (b ? b.errors : 0) + (live && live.summary ? live.summary.errors : 0);
    var warnings = (b ? b.warnings : 0) + (live && live.summary ? live.summary.warnings : 0);
    var card = function (cls, n, label) { return '<div class="seo-card ' + cls + '"><b>' + esc(n) + '</b><small>' + esc(label) + '</small></div>'; };
    $("seoCards").innerHTML =
      card(errors ? "is-err" : "is-ok", errors, "Errors") +
      card(warnings ? "is-warn" : "is-ok", warnings, "Warnings") +
      card("", b ? b.info : "—", "Recommendations") +
      card("", b ? b.pages : "—", "Pages checked") +
      card("", b ? b.sitemapUrls : "—", "Sitemap URLs") +
      card(live ? "" : "is-warn", live ? new Date(live.storedAt || live.generatedAt).toLocaleDateString() : "Not yet", "Last daily live check");
    var info = [];
    if (r.build) info.push("Deploy check: " + new Date(r.build.generatedAt).toLocaleString() + ".");
    else info.push("The deploy check report appears after the next deploy.");
    if (live) info.push("Daily live check: " + new Date(live.storedAt || live.generatedAt).toLocaleString() + " (" + (live.summary.urls || 0) + " URLs, average " + (live.summary.msAverage || 0) + " ms).");
    else info.push(r.scheduled ? "The daily live check has not reported yet (it runs every night)." : "The daily live check is not connected yet (secret SEO_AUDIT_KEY).");
    if (r.live && r.live.length > 1) info.push("Trend (newest first): " + r.live.map(function (x) { return (x.summary ? x.summary.errors : "?") + " err"; }).join(" · "));
    $("seoAuditInfo").textContent = info.join(" ");
    var sc = $("seoSitemapCount"); if (sc && b) sc.textContent = "Now: " + b.sitemapUrls + " URLs.";
  }
  function renderIssues() {
    var lvl = $("seoLevel").value, q = $("seoSearch").value.trim().toLowerCase();
    var rows = allIssues().filter(function (i) { return (!lvl || i.level === lvl) && (!q || (i.url + " " + i.message + " " + i.type).toLowerCase().indexOf(q) >= 0); });
    var order = { error: 0, warning: 1, info: 2 };
    rows.sort(function (a, b) { return order[a.level] - order[b.level]; });
    $("seoIssues").innerHTML = rows.length ? rows.slice(0, 400).map(function (i) {
      return '<li class="seo-issue"><span class="seo-lvl ' + esc(i.level) + '">' + esc(LEVEL_NAME[i.level] || i.level) + '</span><div>' +
        '<a href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.url.replace("https://muslimabaya.com", "") || "/") + '</a>' +
        '<p>' + esc(i.message) + '</p>' + (i.fix ? '<small>Fix: ' + esc(i.fix) + '</small> ' : "") + '<small>· ' + esc(i.src) + '</small></div></li>';
    }).join("") : '<li class="seo-issue"><span class="seo-lvl info">OK</span><div><p>Nothing to show' + (lvl || q ? " for this filter" : " — no problems found") + '.</p></div></li>';
  }
  ["seoLevel", "seoSource"].forEach(function (id) { $(id).addEventListener("change", renderIssues); });
  $("seoSearch").addEventListener("input", renderIssues);

  function renderProducts() {
    var list = (state.report && state.report.build && state.report.build.suggestions) || [];
    $("seoProducts").innerHTML = list.length ? list.map(function (p) {
      return '<tr><td><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a><br><small>' + esc(p.category) + '</small></td>' +
        '<td>' + esc(p.title) + ' <span class="seo-tag' + (p.titleIsManual ? " is-manual" : "") + '">' + (p.titleIsManual ? "approved" : "automatic") + '</span></td>' +
        '<td>' + esc(p.description) + ' <span class="seo-tag' + (p.descriptionIsManual ? " is-manual" : "") + '">' + (p.descriptionIsManual ? "approved" : "automatic") + '</span></td>' +
        '<td><a class="adm-btn adm-btn-secondary" href="product-manager.html?edit=' + encodeURIComponent(p.id) + '#seo">Edit</a></td></tr>';
    }).join("") : '<tr><td colspan="4">Every published product has approved SEO text.</td></tr>';
  }

  // ---------- Pages ----------
  function counter(input, max) {
    var c = input.parentNode.querySelector(".seo-count[data-for='" + input.id + "']");
    if (!c) return;
    var len = (input.value || input.placeholder || "").length;
    c.textContent = len + " / " + max + (input.value ? "" : " (automatic)");
    c.classList.toggle("is-err", len > max);
  }
  function renderPages() {
    var pages = (state.report && state.report.pages && state.report.pages.pages) || [];
    var q = ($("seoPageSearch").value || "").trim().toLowerCase();
    var set = state.settings ? state.settings.pages : {};
    $("seoPages").innerHTML = pages.filter(function (p) { return !q || p.path.indexOf(q) >= 0 || (p.auto.title || "").toLowerCase().indexOf(q) >= 0; }).map(function (p, i) {
      var m = set[p.path] || {}, id = "pg" + i, manual = !!(m.title || m.description || m.robots || m.image);
      var robots = m.robots || "";
      return '<div class="seo-page" data-path="' + esc(p.path) + '"><h3><a href="' + esc(p.path) + '" target="_blank" rel="noopener">' + esc(p.path) + '</a>' +
        '<span class="seo-tag' + (manual ? " is-manual" : "") + '">' + (manual ? "manual / approved" : "automatic") + '</span>' +
        (/noindex/.test(p.auto.robots || "") && !m.robots ? '<span class="seo-tag">noindex</span>' : "") + '</h3>' +
        '<label for="' + id + 't">Title</label><input id="' + id + 't" data-k="title" maxlength="120" value="' + esc(m.title || "") + '" placeholder="' + esc(p.auto.title) + '"><span class="seo-count" data-for="' + id + 't"></span>' +
        '<label for="' + id + 'd">Meta description</label><textarea id="' + id + 'd" data-k="description" maxlength="320" placeholder="' + esc(p.auto.description) + '">' + esc(m.description || "") + '</textarea><span class="seo-count" data-for="' + id + 'd"></span>' +
        '<label for="' + id + 'r">Search engines</label><select id="' + id + 'r" data-k="robots"><option value="">Automatic (' + esc(p.auto.robots || "index, follow") + ')</option>' +
        ["index, follow", "noindex, follow", "noindex, nofollow"].map(function (v) { return '<option' + (robots === v ? " selected" : "") + '>' + v + '</option>'; }).join("") + '</select>' +
        '<label for="' + id + 'i">Share image (optional)</label><input id="' + id + 'i" data-k="image" value="' + esc(m.image || "") + '" placeholder="' + esc(p.auto.image || "automatic") + '">' +
        '<p style="margin:8px 0 0"><button type="button" class="adm-btn adm-btn-secondary" data-approve>Approve automatic text</button> <button type="button" class="adm-btn adm-btn-secondary" data-reset>Back to automatic</button></p></div>';
    }).join("") || '<p class="seo-help">The page list appears after the next deploy.</p>';
    $("seoPages").querySelectorAll("input[data-k='title']").forEach(function (x) { counter(x, 60); });
    $("seoPages").querySelectorAll("textarea[data-k='description']").forEach(function (x) { counter(x, 160); });
  }
  function readPage(box) {
    var row = {};
    box.querySelectorAll("[data-k]").forEach(function (el) { var v = el.value.replace(/\s+/g, " ").trim(); if (v) row[el.getAttribute("data-k")] = v; });
    var path = box.getAttribute("data-path");
    if (Object.keys(row).length) state.settings.pages[path] = row; else delete state.settings.pages[path];
    setDirty(true);
  }
  $("seoPages").addEventListener("input", function (e) {
    var box = e.target.closest(".seo-page"); if (!box || !state.settings) return;
    if (e.target.getAttribute("data-k") === "title") counter(e.target, 60);
    if (e.target.getAttribute("data-k") === "description") counter(e.target, 160);
    readPage(box);
  });
  $("seoPages").addEventListener("change", function (e) { var box = e.target.closest(".seo-page"); if (box && state.settings) readPage(box); });
  $("seoPages").addEventListener("click", function (e) {
    var box = e.target.closest(".seo-page"); if (!box || !state.settings) return;
    if (e.target.hasAttribute("data-approve")) {
      box.querySelectorAll("input[data-k='title'],textarea[data-k='description']").forEach(function (el) { if (!el.value.trim()) el.value = el.placeholder; });
      readPage(box); renderPagesKeepSearch();
    } else if (e.target.hasAttribute("data-reset")) {
      box.querySelectorAll("[data-k]").forEach(function (el) { el.value = ""; });
      readPage(box); renderPagesKeepSearch();
    }
  });
  function renderPagesKeepSearch() { renderPages(); }
  $("seoPageSearch").addEventListener("input", renderPages);

  // ---------- Redirects ----------
  function renderRedirects() {
    var list = (state.settings && state.settings.redirects) || [];
    $("seoRedirects").innerHTML = list.map(function (r, i) {
      return '<div class="seo-row" data-i="' + i + '"><input data-r="from" value="' + esc(r.from) + '" placeholder="/old-page" aria-label="From"><input data-r="to" value="' + esc(r.to) + '" placeholder="/new-page" aria-label="To">' +
        '<select data-r="code" aria-label="Type"><option value="301"' + (r.code !== 302 ? " selected" : "") + '>301</option><option value="302"' + (r.code === 302 ? " selected" : "") + '>302</option></select>' +
        '<button type="button" class="adm-btn adm-btn-secondary" data-del aria-label="Remove">×</button></div>';
    }).join("") || '<p class="seo-help">No redirects added here yet (the built-in ones, like old .html links, keep working).</p>';
  }
  $("seoAddRedirect").addEventListener("click", function () { if (!state.settings) return; state.settings.redirects.push({ from: "", to: "", code: 301 }); renderRedirects(); setDirty(true); });
  $("seoRedirects").addEventListener("input", syncRedirects);
  $("seoRedirects").addEventListener("change", syncRedirects);
  $("seoRedirects").addEventListener("click", function (e) {
    if (!e.target.hasAttribute("data-del")) return;
    state.settings.redirects.splice(Number(e.target.closest(".seo-row").getAttribute("data-i")), 1); renderRedirects(); setDirty(true);
  });
  function syncRedirects(e) {
    var row = e.target.closest(".seo-row"); if (!row || !state.settings) return;
    var r = state.settings.redirects[Number(row.getAttribute("data-i"))];
    r.from = row.querySelector("[data-r='from']").value.trim(); r.to = row.querySelector("[data-r='to']").value.trim(); r.code = Number(row.querySelector("[data-r='code']").value);
    setDirty(true);
  }

  // ---------- Robots + global ----------
  function renderSettingsForm() {
    var s = state.settings, g = s.global || {};
    $("seoDisallow").value = (s.robots.disallow || []).join("\n");
    $("seoGa4Id").value = g.ga4PropertyId || ""; $("seoGscProp").value = g.gscProperty || "";
    $("seoGoogleVer").value = g.googleVerification || ""; $("seoBingVer").value = g.bingVerification || ""; $("seoDefaultImg").value = g.defaultImage || "";
  }
  $("seoDisallow").addEventListener("input", function () { if (!state.settings) return; state.settings.robots.disallow = this.value.split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean); setDirty(true); });
  [["seoGa4Id", "ga4PropertyId"], ["seoGscProp", "gscProperty"], ["seoGoogleVer", "googleVerification"], ["seoBingVer", "bingVerification"], ["seoDefaultImg", "defaultImage"]].forEach(function (pair) {
    var el = $(pair[0]);
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", function () { if (!state.settings) return; var v = el.value.trim(); if (v) state.settings.global[pair[1]] = v; else delete state.settings.global[pair[1]]; setDirty(true); });
  });

  // ---------- Save ----------
  $("seoSave").addEventListener("click", function () {
    var btn = this, msg = $("seoSaveMsg");
    btn.disabled = true; msg.className = ""; msg.textContent = "Saving…";
    state.settings.redirects = state.settings.redirects.filter(function (r) { return r.from || r.to; });
    api("/api/seo-settings", { action: "save", settings: state.settings, sha: state.sha }).then(function (res) {
      state.settings = res.settings; state.sha = res.sha || state.sha; state.dirty = false;
      msg.className = "is-ok"; msg.textContent = "✅ Saved. The website updates with the deploy that starts now (about 2 minutes); this page shows the new check after that.";
      renderRedirects(); renderSettingsForm();
    }).catch(function (err) {
      msg.className = "is-err";
      msg.textContent = "Not saved: " + err.message + (err.res && err.res.error === "SEO_CONFLICT" ? " (reload the page)" : "") + " — your changes are still here.";
      btn.disabled = false;
    });
  });

  // ---------- Google ----------
  function num(n) { return Number(n || 0).toLocaleString(); }
  function loadGoogle() {
    state.googleLoaded = true;
    api("/api/seo-google", { action: "summary" }).then(function (res) {
      var how = function (what, where) { return '<p>Not connected yet. To connect it for free: in ' + where + ' add this e-mail as a user with <b>' + what + '</b> access:</p><p><code>' + esc(res.serviceAccount) + '</code></p><p>Then reload this page. No password or key is shared.</p>'; };
      var g = res.gsc;
      $("seoGsc").innerHTML = g.connected
        ? '<p><b>' + num(g.totals.clicks) + '</b> clicks · <b>' + num(g.totals.impressions) + '</b> impressions · CTR ' + (g.totals.ctr * 100).toFixed(1) + '% · avg. position ' + g.totals.position.toFixed(1) + ' <small>(' + esc(g.startDate) + ' – ' + esc(g.endDate) + ', ' + esc(g.property) + ')</small></p>' +
          '<div class="seo-scroll"><table class="seo-table"><thead><tr><th>Top searches</th><th>Clicks</th><th>Impr.</th><th>Pos.</th></tr></thead><tbody>' + g.queries.slice(0, 15).map(function (q) { return '<tr><td>' + esc(q.key) + '</td><td>' + num(q.clicks) + '</td><td>' + num(q.impressions) + '</td><td>' + q.position.toFixed(1) + '</td></tr>'; }).join("") + '</tbody></table></div>' +
          '<p>Sitemaps: ' + (g.sitemaps.length ? g.sitemaps.map(function (s) { return esc(s.path) + (s.errors ? " — " + s.errors + " errors" : " — OK") + (s.lastDownloaded ? " (read " + esc(s.lastDownloaded.slice(0, 10)) + ")" : ""); }).join("; ") : "none submitted — in Search Console → Sitemaps add sitemap.xml") + '</p>'
        : how("Restricted", "Search Console → Settings → Users and permissions → Add user,");
      var a = res.ga4;
      $("seoGa4").innerHTML = a.connected
        ? '<p>Last 28 days: <b>' + num(a.totals.sessions) + '</b> sessions · <b>' + num(a.totals.users) + '</b> users · ' + num(a.totals.pageViews) + ' page views</p>' +
          '<p>' + a.channels.map(function (c) { return esc(c.key) + ": " + num(c.sessions); }).join(" · ") + '</p>' +
          (a.organicLandingPages.length ? '<p><b>Google (organic) landing pages:</b> ' + a.organicLandingPages.slice(0, 8).map(function (c) { return esc(c.key) + " (" + num(c.sessions) + ")"; }).join(", ") + '</p>' : "")
        : (a.error === "NO_PROPERTY_ID" ? '<p>Enter the GA4 property ID below and save.</p>' + how("Viewer", "GA4 → Admin → Property access management → +,") : how("Viewer", "GA4 → Admin → Property access management → +,"));
    }).catch(function (err) { $("seoGsc").textContent = "Could not load: " + err.message; $("seoGa4").textContent = ""; state.googleLoaded = false; });
  }

  // ---------- Load ----------
  function load() {
    showError("");
    Promise.all([
      api("/api/seo-report", { action: "get" }).catch(function (e) { showError("Report: " + e.message); return null; }),
      api("/api/seo-settings", { action: "get" }).catch(function (e) { showError("Settings: " + e.message); return null; }),
    ]).then(function (out) {
      state.report = out[0] || {};
      if (out[1]) { state.settings = out[1].settings; state.sha = out[1].sha || ""; renderSettingsForm(); }
      renderCards(); renderIssues(); renderProducts(); renderPages(); renderRedirects();
      setDirty(false);
    });
  }
  var tries = 0;
  (function start() { if (token()) load(); else if (++tries < 40) setTimeout(start, 250); else showError("Please log in again."); })();
  var refresh = $("admRefresh"); if (refresh) refresh.addEventListener("click", load);
})();
