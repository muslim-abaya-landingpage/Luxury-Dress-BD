/* ==========================================================================
   Media Library for the product manager — works like the WordPress / WooCommerce media window:
   - two tabs: "Upload files" (drag & drop or Select Files, uploads go straight to Cloudflare R2) and
     "Media Library" (every photo, newest first)
   - click to select; several at once when adding gallery images (Ctrl/Shift not needed: click toggles)
   - "Attachment details" panel on the right: name, date, size, dimensions, which products use it, copy URL,
     "Delete permanently" (only for panel uploads, and never while a product uses the photo)
   Sources: /media-manifest.json (photos in the website folder, built at deploy) and
            /api/media-library (photos uploaded from the panel to R2, with date and size).
   API: MaMediaLibrary.open({title, button, multiple, max, fileBase, usedBy(value) → [names], onSelect(items)})
        items: [{value, card, url}] — value is what goes into the product (relative path or R2 URL).
   ========================================================================== */
(function (global) {
  "use strict";

  var IMG_MAX_W = 1600, IMG_CARD_MAX_W = 800, IMG_QUALITY = 0.82;
  var state = { items: null, loading: false, error: "", filter: "all", search: "", selected: [], focus: null, opts: null, tab: "library", uploads: [] };
  var modal = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function token() {
    var s = global.MaAdmin && global.MaAdmin.getSession && global.MaAdmin.getSession();
    return s && s.token ? s.token : "";
  }
  function fileName(v) { return decodeURIComponent(String(v).split("/").pop()); }
  function previewUrl(it) { return it.local || it.url; }
  function fmtDate(t) {
    if (!t) return "—";
    try { return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return "—"; }
  }
  function fmtSize(b) {
    if (!b) return "—";
    return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
  }
  function api(body) {
    body.Token = token();
    return fetch("/api/media-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP_" + r.status }; }); });
  }

  // ---- data ------------------------------------------------------------------------------------------
  function load(force) {
    if (state.items && !force) return Promise.resolve();
    state.loading = true; state.error = ""; render();
    var site = fetch("/media-manifest.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { items: [] }; })
      .catch(function () { return { items: [] }; });
    var r2 = token() ? api({ action: "list" }).catch(function (e) { return { ok: false, error: e.message }; }) : Promise.resolve({ ok: false, error: "NOT_LOGGED_IN" });
    return Promise.all([site, r2]).then(function (res) {
      var list = [];
      ((res[1] && res[1].ok && res[1].items) || []).forEach(function (o) {
        list.push({ id: "r2:" + o.key, value: o.url, url: o.url, card: o.card || "", key: o.key, date: o.uploaded || 0, size: o.size || 0, source: "upload", name: fileName(o.sourcePath || o.key) });
      });
      ((res[0] && res[0].items) || []).forEach(function (o) {
        list.push({ id: "site:" + o.path, value: o.path, url: "/" + o.path.split("/").map(encodeURIComponent).join("/"), card: "", date: o.date || 0, size: 0, source: "site", name: fileName(o.path) });
      });
      list.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
      // Photos uploaded in this window stay on top even if the list is reloaded.
      state.items = state.uploads.concat(list.filter(function (it) { return !state.uploads.some(function (u) { return u.value === it.value; }); }));
      if (res[1] && !res[1].ok && res[1].error !== "NOT_LOGGED_IN") state.error = "Uploaded photos could not be listed (" + (res[1].message || res[1].error) + "). Photos in the website folder are shown.";
    }).then(function () { state.loading = false; render(); }, function (e) { state.loading = false; state.error = String(e && e.message || e); render(); });
  }

  function visible() {
    var q = state.search.trim().toLowerCase();
    return (state.items || []).filter(function (it) {
      if (state.filter === "upload" && it.source !== "upload") return false;
      if (state.filter === "site" && it.source !== "site") return false;
      return !q || it.name.toLowerCase().indexOf(q) !== -1 || String(it.value).toLowerCase().indexOf(q) !== -1;
    });
  }
  function byId(id) { return (state.items || []).filter(function (it) { return it.id === id; })[0]; }
  function usedBy(it) {
    var fn = state.opts && state.opts.usedBy;
    if (typeof fn !== "function") return [];
    var names = fn(it.value) || [];
    if (it.card) names = names.concat(fn(it.card) || []);
    return names.filter(function (n, i) { return names.indexOf(n) === i; });
  }

  // ---- upload --------------------------------------------------------------------------------------
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(",")[1] || ""); };
      fr.onerror = function () { reject(fr.error || Error("READ_FAILED")); };
      fr.readAsDataURL(blob);
    });
  }
  function putR2(path, blob) {
    return blobToBase64(blob).then(function (content) {
      return fetch("/api/image-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ Token: token(), path: path, content: content }) });
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP_" + r.status }; }); })
      .then(function (res) { if (!res || !res.ok || !res.url) throw Error((res && (res.message || res.error)) || "Upload failed"); return res; });
  }
  function slug(s) { return String(s || "photo").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "photo"; }

  function uploadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) { return f && /^image\//.test(f.type); });
    if (!files.length) { note("Only image files (JPG, PNG, WebP) can be uploaded.", true); return; }
    if (!token()) { note("Admin login required to upload.", true); return; }
    if (!global.MaImageTools || !global.MaImageTools.resizeToWebp) { note("Image tools did not load. Reload the page.", true); return; }
    var base = slug(state.opts && state.opts.fileBase);
    var rows = files.map(function (f, i) { return { file: f, name: f.name, status: "Waiting…", n: i }; });
    state.progress = rows; state.tab = "upload"; render();
    var chain = Promise.resolve(), added = [];
    rows.forEach(function (row) {
      chain = chain.then(function () {
        row.status = "Optimizing…"; render();
        var stamp = Date.now() + "-" + row.n;
        var name = base + "-" + stamp;
        return Promise.all([global.MaImageTools.resizeToWebp(row.file, IMG_MAX_W, IMG_QUALITY), global.MaImageTools.resizeToWebp(row.file, IMG_CARD_MAX_W, IMG_QUALITY)])
          .then(function (blobs) {
            row.status = "Uploading…"; render();
            return Promise.all([putR2("images/uploads/" + name + ".webp", blobs[0]), putR2("images/uploads/" + name + "-card.webp", blobs[1])]).then(function (up) {
              var it = { id: "r2:" + up[0].key, value: up[0].url, url: up[0].url, card: up[1].url, key: up[0].key, date: Date.now(), size: up[0].bytes || blobs[0].size, source: "upload", name: name + ".webp", local: URL.createObjectURL(blobs[1]) };
              state.uploads.unshift(it);
              state.items = [it].concat((state.items || []).filter(function (x) { return x.value !== it.value; }));
              added.push(it);
              row.status = "Done";
            });
          })
          .catch(function (e) { row.status = "Failed: " + (e && e.message || e); row.failed = true; })
          .then(render);
      });
    });
    chain.then(function () {
      if (!added.length) return;
      // Like WordPress: after uploading, the new photos are selected in the Media Library.
      var max = maxSelect();
      state.selected = added.slice(0, max).map(function (it) { return it.id; });
      state.focus = state.selected[0] || null;
      state.tab = "library"; state.filter = "all"; state.search = "";
      render();
    });
  }

  // ---- selection -----------------------------------------------------------------------------------
  function maxSelect() { var o = state.opts || {}; return o.multiple ? Math.max(1, o.max || 99) : 1; }
  function toggle(id) {
    var i = state.selected.indexOf(id);
    if (i !== -1) { state.selected.splice(i, 1); state.focus = state.selected[state.selected.length - 1] || null; render(); return; }
    if (maxSelect() === 1) state.selected = [id];
    else if (state.selected.length >= maxSelect()) { note("You can choose at most " + maxSelect() + " here.", true); return; }
    else state.selected.push(id);
    state.focus = id; render();
  }
  function confirmSelection() {
    var items = state.selected.map(byId).filter(Boolean);
    if (!items.length) return;
    var cb = state.opts && state.opts.onSelect;
    close();
    if (typeof cb === "function") cb(items.map(function (it) { return { value: it.value, card: it.card || "", url: it.url }; }));
  }

  function removeItem(it) {
    var users = usedBy(it);
    if (users.length) { note("This photo is used by: " + users.join(", ") + ". Remove it from the product first.", true); return; }
    if (!global.confirm("Delete this photo permanently?\n" + it.name + "\n\nThis cannot be undone.")) return;
    var job;
    if (it.source === "upload") job = api({ action: "delete", key: it.key });
    else if (global.MaAdmin && global.MaAdmin.deleteImage) job = global.MaAdmin.deleteImage(it.value);
    else { note("Deleting is not available here.", true); return; }
    note("Deleting…");
    job.then(function (res) {
      if (!res || !res.ok) { note((res && (res.message || res.error)) || "Could not delete the photo.", true); return; }
      state.items = state.items.filter(function (x) { return x.id !== it.id; });
      state.uploads = state.uploads.filter(function (x) { return x.id !== it.id; });
      state.selected = state.selected.filter(function (id) { return id !== it.id; });
      if (state.focus === it.id) state.focus = state.selected[0] || null;
      note("Photo deleted.");
      render();
    }, function (e) { note("Could not delete the photo: " + (e && e.message || e), true); });
  }

  // ---- view ----------------------------------------------------------------------------------------
  var CSS =
    "#maMediaModal{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:30px;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d2327}" +
    "#maMediaModal[hidden]{display:none}" +
    ".mam-box{background:#fff;width:100%;max-width:1200px;height:100%;max-height:820px;display:flex;flex-direction:column;box-shadow:0 5px 15px rgba(0,0,0,.7);position:relative}" +
    ".mam-head{padding:0 50px 0 16px;border-bottom:1px solid #dcdcde;min-height:50px;display:flex;align-items:center}" +
    ".mam-head h1{font-size:22px;font-weight:600;margin:0;line-height:50px}" +
    ".mam-x{position:absolute;top:0;right:0;width:50px;height:50px;border:0;background:none;font-size:26px;color:#646970;cursor:pointer}" +
    ".mam-x:hover{color:#135e96}" +
    ".mam-tabs{display:flex;gap:0;padding:0 16px;border-bottom:1px solid #dcdcde}" +
    ".mam-tab{border:0;background:none;padding:12px 10px;margin-right:8px;font-size:14px;color:#2271b1;cursor:pointer;border-bottom:4px solid transparent}" +
    ".mam-tab[aria-selected=true]{color:#1d2327;font-weight:600;border-bottom-color:#2271b1}" +
    ".mam-main{flex:1;display:flex;min-height:0}" +
    ".mam-content{flex:1;display:flex;flex-direction:column;min-width:0}" +
    ".mam-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:12px 16px}" +
    ".mam-bar select,.mam-bar input{height:32px;border:1px solid #8c8f94;border-radius:4px;padding:0 8px;font-size:13px;background:#fff}" +
    ".mam-bar input{min-width:200px}" +
    ".mam-note{margin:0 16px 8px;padding:8px 12px;border-left:4px solid #72aee6;background:#f0f6fc}" +
    ".mam-note.is-err{border-left-color:#d63638;background:#fcf0f1}" +
    ".mam-grid{flex:1;overflow:auto;padding:0 16px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;align-content:start}" +
    // Square tiles via padding-bottom (aspect-ratio on grid buttons collapses the rows in Chrome with many photos).
    ".mam-item{position:relative;display:block;width:100%;height:0!important;min-height:0!important;padding:0 0 100%!important;margin:0;border:0;background:#f0f0f1;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1);overflow:hidden}" +
    ".mam-item img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}" +
    ".mam-item:focus{outline:2px solid #2271b1;outline-offset:2px}" +
    ".mam-item.is-sel{box-shadow:inset 0 0 0 3px #fff,0 0 0 4px #2271b1;z-index:1}" +
    ".mam-check{display:none;position:absolute;z-index:2;top:0;right:0;width:24px;height:24px;background:#2271b1;color:#fff;font-size:15px;line-height:24px;text-align:center}" +
    ".mam-item.is-sel .mam-check{display:block}" +
    ".mam-badge{position:absolute;z-index:2;left:4px;bottom:4px;background:rgba(0,0,0,.6);color:#fff;font-size:10px;padding:1px 5px;border-radius:2px}" +
    ".mam-empty{grid-column:1/-1;text-align:center;color:#646970;padding:40px 10px;font-size:14px}" +
    ".mam-side{width:280px;flex:0 0 280px;border-left:1px solid #dcdcde;background:#f6f7f7;overflow:auto;padding:16px}" +
    ".mam-side h2{font-size:12px;text-transform:uppercase;color:#646970;margin:0 0 10px;font-weight:600}" +
    ".mam-side img{max-width:120px;max-height:120px;float:left;margin:0 10px 10px 0;border:1px solid #dcdcde;background:#fff}" +
    ".mam-meta{font-size:12px;color:#3c434a;line-height:1.6;overflow:hidden}" +
    ".mam-meta b{word-break:break-all}" +
    ".mam-used{clear:both;padding-top:8px;font-size:12px}" +
    ".mam-url{clear:both;width:100%;margin-top:8px;box-sizing:border-box;font-size:11px;border:1px solid #dcdcde;padding:4px}" +
    ".mam-link{background:none;border:0;padding:0;color:#2271b1;text-decoration:underline;cursor:pointer;font-size:12px;margin-top:6px;display:inline-block}" +
    ".mam-del{color:#b32d2e}.mam-del[disabled]{color:#a7aaad;cursor:not-allowed;text-decoration:none}" +
    ".mam-foot{border-top:1px solid #dcdcde;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}" +
    ".mam-count{color:#646970}" +
    ".mam-go{background:#2271b1;border:1px solid #2271b1;color:#fff;border-radius:3px;padding:0 14px;min-height:36px;font-size:13px;cursor:pointer}" +
    ".mam-go[disabled]{background:#f6f7f7;border-color:#dcdcde;color:#a7aaad;cursor:default}" +
    ".mam-drop{flex:1;margin:16px;border:4px dashed #c3c4c7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px}" +
    ".mam-drop.is-drag{border-color:#2271b1;background:#f0f6fc}" +
    ".mam-drop h2{font-size:20px;font-weight:400;margin:0}" +
    ".mam-pick{background:#f6f7f7;border:1px solid #2271b1;color:#2271b1;border-radius:3px;padding:0 14px;min-height:40px;font-size:14px;cursor:pointer}" +
    ".mam-prog{list-style:none;margin:0;padding:0;font-size:12px;text-align:left;max-width:520px;width:100%}" +
    ".mam-prog li{padding:3px 0;border-bottom:1px solid #f0f0f1}.mam-prog .bad{color:#b32d2e}" +
    "@media (max-width:780px){#maMediaModal{padding:0}.mam-box{max-height:none}.mam-main{flex-direction:column}.mam-side{width:auto;flex:0 0 auto;max-height:38%;border-left:0;border-top:1px solid #dcdcde}.mam-grid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}.mam-bar input{min-width:0;flex:1}}";

  var noteText = "", noteErr = false;
  function note(msg, isErr) { noteText = msg || ""; noteErr = !!isErr; render(); }

  function ensureDom() {
    if (modal) return;
    var st = document.createElement("style"); st.id = "maMediaCss"; st.textContent = CSS; document.head.appendChild(st);
    modal = document.createElement("div");
    modal.id = "maMediaModal"; modal.hidden = true;
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    modal.addEventListener("click", onClick);
    modal.addEventListener("input", function (e) {
      if (e.target.id === "mamSearch") { state.search = e.target.value; renderGrid(); }
    });
    modal.addEventListener("change", function (e) {
      if (e.target.id === "mamFilter") { state.filter = e.target.value; renderGrid(); }
      if (e.target.id === "mamFiles") { uploadFiles(e.target.files); e.target.value = ""; }
    });
    modal.addEventListener("dragover", function (e) { e.preventDefault(); var d = modal.querySelector(".mam-drop"); if (d) d.classList.add("is-drag"); else if (state.tab === "library") { state.tab = "upload"; render(); } });
    modal.addEventListener("dragleave", function (e) { var d = modal.querySelector(".mam-drop"); if (d && e.target === d) d.classList.remove("is-drag"); });
    modal.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal && !modal.hidden) close(); });
  }

  function onClick(e) {
    var t = e.target.closest ? e.target.closest("[data-mam]") : null;
    if (e.target === modal) { close(); return; }
    if (!t) return;
    var a = t.getAttribute("data-mam");
    if (a === "close") close();
    else if (a === "tab") { state.tab = t.getAttribute("data-tab"); noteText = ""; render(); }
    else if (a === "pick") { var f = modal.querySelector("#mamFiles"); if (f) f.click(); }
    else if (a === "item") toggle(t.getAttribute("data-id"));
    else if (a === "go") confirmSelection();
    else if (a === "delete") { var it = byId(state.focus); if (it) removeItem(it); }
    else if (a === "copy") {
      var inp = modal.querySelector(".mam-url");
      if (inp) { inp.select(); try { document.execCommand("copy"); note("URL copied."); } catch (err) {} }
    } else if (a === "deselect") { state.selected = []; state.focus = null; render(); }
  }

  function render() {
    if (!modal || modal.hidden) return;
    var o = state.opts || {};
    var html = '<div class="mam-box">' +
      '<div class="mam-head"><h1>' + esc(o.title || "Media Library") + '</h1></div>' +
      '<button type="button" class="mam-x" data-mam="close" aria-label="Close dialog">×</button>' +
      '<div class="mam-tabs" role="tablist">' +
      '<button type="button" class="mam-tab" role="tab" data-mam="tab" data-tab="upload" aria-selected="' + (state.tab === "upload") + '">Upload files</button>' +
      '<button type="button" class="mam-tab" role="tab" data-mam="tab" data-tab="library" aria-selected="' + (state.tab === "library") + '">Media Library</button>' +
      "</div>" +
      '<div class="mam-main">' + (state.tab === "upload" ? uploadHtml() : libraryHtml()) + "</div>" +
      '<div class="mam-foot"><span class="mam-count">' + footText() + '</span>' +
      '<button type="button" class="mam-go" data-mam="go"' + (state.selected.length ? "" : " disabled") + ">" + esc(o.button || "Select") + "</button></div>" +
      "</div>";
    var keepSearchFocus = document.activeElement && document.activeElement.id === "mamSearch";
    modal.innerHTML = html;
    if (keepSearchFocus) { var s = modal.querySelector("#mamSearch"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  }
  function footText() {
    var n = state.selected.length;
    if (!n) return (state.opts && state.opts.multiple) ? "Click photos to select (up to " + maxSelect() + ")" : "Click a photo to select it";
    return n + " selected" + ' · <button type="button" class="mam-link" data-mam="deselect">Clear</button>';
  }
  function noteHtml() {
    var msg = noteText || state.error;
    return msg ? '<div class="mam-note' + (noteErr || (!noteText && state.error) ? " is-err" : "") + '" role="status">' + esc(msg) + "</div>" : "";
  }
  function uploadHtml() {
    var prog = (state.progress || []).map(function (r) { return '<li class="' + (r.failed ? "bad" : "") + '">' + esc(r.name) + " — " + esc(r.status) + "</li>"; }).join("");
    return '<div class="mam-content">' + noteHtml() +
      '<div class="mam-drop"><h2>Drop files to upload</h2><p>or</p>' +
      '<button type="button" class="mam-pick" data-mam="pick">Select Files</button>' +
      '<input type="file" id="mamFiles" accept="image/*" multiple hidden>' +
      '<p style="color:#646970;margin:0">JPG, PNG or WebP. Photos are resized and saved as WebP automatically.</p>' +
      (prog ? '<ul class="mam-prog">' + prog + "</ul>" : "") +
      "</div></div>";
  }
  function libraryHtml() {
    return '<div class="mam-content">' +
      '<div class="mam-bar"><select id="mamFilter" aria-label="Filter media">' +
      '<option value="all"' + (state.filter === "all" ? " selected" : "") + ">All media items</option>" +
      '<option value="upload"' + (state.filter === "upload" ? " selected" : "") + ">Uploaded from the panel</option>" +
      '<option value="site"' + (state.filter === "site" ? " selected" : "") + ">Website folder</option></select>" +
      '<input type="search" id="mamSearch" placeholder="Search media" aria-label="Search media" value="' + esc(state.search) + '"></div>' +
      noteHtml() +
      '<div class="mam-grid" id="mamGrid">' + gridHtml() + "</div></div>" +
      sideHtml();
  }
  function gridHtml() {
    if (state.loading) return '<p class="mam-empty">Loading…</p>';
    var list = visible();
    if (!list.length) return '<p class="mam-empty">' + ((state.items || []).length ? "No photos match." : "No photos yet. Use “Upload files”.") + "</p>";
    return list.map(function (it) {
      var sel = state.selected.indexOf(it.id) !== -1;
      return '<button type="button" class="mam-item' + (sel ? " is-sel" : "") + '" data-mam="item" data-id="' + esc(it.id) + '" aria-pressed="' + sel + '" title="' + esc(it.name) + '">' +
        '<img src="' + esc(previewUrl(it.card ? { url: it.card, local: it.local } : it)) + '" alt="' + esc(it.name) + '" loading="lazy">' +
        '<span class="mam-check" aria-hidden="true">✓</span>' +
        (it.source === "upload" && it.date > Date.now() - 86400000 ? '<span class="mam-badge">New</span>' : "") +
        "</button>";
    }).join("");
  }
  function renderGrid() { var g = modal && modal.querySelector("#mamGrid"); if (g) g.innerHTML = gridHtml(); }
  function sideHtml() {
    var it = byId(state.focus);
    if (!it) return '<div class="mam-side"><h2>Attachment details</h2><p style="color:#646970">Select a photo to see its details.</p></div>';
    var users = usedBy(it);
    var deletable = !users.length;
    return '<div class="mam-side"><h2>Attachment details</h2>' +
      '<img src="' + esc(previewUrl(it)) + '" alt="" onload="var d=document.getElementById(\'mamDim\');if(d)d.textContent=this.naturalWidth+\' × \'+this.naturalHeight+\' px\'">' +
      '<div class="mam-meta"><b>' + esc(it.name) + "</b><br>" + esc(fmtDate(it.date)) + "<br>" + esc(fmtSize(it.size)) + '<br><span id="mamDim"></span><br>' +
      (it.source === "upload" ? "Uploaded from the panel" : "Website folder") + "</div>" +
      '<div class="mam-used">' + (users.length ? "<b>Used by:</b> " + esc(users.join(", ")) : "Not used by any product") + "</div>" +
      '<input class="mam-url" readonly aria-label="File URL" value="' + esc(/^https?:/.test(it.url) ? it.url : location.origin + it.url) + '">' +
      '<button type="button" class="mam-link" data-mam="copy">Copy URL to clipboard</button><br>' +
      '<button type="button" class="mam-link mam-del" data-mam="delete"' + (deletable ? "" : ' disabled title="Used by a product — remove it there first"') + ">Delete permanently</button>" +
      "</div>";
  }

  function open(opts) {
    ensureDom();
    state.opts = opts || {};
    state.selected = []; state.focus = null; state.search = ""; state.filter = "all"; state.progress = null; noteText = "";
    state.tab = state.opts.tab || "library";
    modal.hidden = false;
    document.documentElement.style.overflow = "hidden";
    render();
    load(!!state.opts.reload);
  }
  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.documentElement.style.overflow = "";
  }

  global.MaMediaLibrary = { open: open, close: close, reload: function () { return load(true); }, _state: state };
})(window);
