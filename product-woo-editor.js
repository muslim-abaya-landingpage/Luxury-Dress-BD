/* WordPress-style "Visual | Code" editor for Product Manager → Product description / Product short description.
   Visual = formatted editing (Paragraph/Headings, Bold, Italic, lists, quote, align, link, horizontal line,
   full screen), Code = the HTML. "Add Media" inserts a product photo. Word count at the bottom.
   The result is cleaned by sanitize(): only safe tags and attributes are kept (no scripts, styles or
   event handlers), and the same sanitize() runs again on the website before showing it (product-page.js). */
(function (g) {
  "use strict";

  var ALLOWED = { P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, PRE: 1, A: 1, HR: 1, IMG: 1, SPAN: 1, DIV: 1, DEL: 1, S: 1 };
  var ALIGN = /^(left|center|right|justify)$/;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function safeUrl(u, img) {
    u = String(u || "").trim();
    if (/^(https?:)?\/\//i.test(u) || /^\/(?!\/)/.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u) || /^#/.test(u)) return u;
    if (img && /^images\//i.test(u)) return u;
    return "";
  }

  /** Cleans HTML to the allowed tags. Works in browsers (DOMParser); returns a string. */
  function sanitize(html) {
    if (!html) return "";
    if (typeof DOMParser === "undefined") return esc(String(html).replace(/<[^>]*>/g, ""));
    var doc = new DOMParser().parseFromString("<div>" + String(html) + "</div>", "text/html");
    var out = doc.createElement("div");
    function copy(from, to) {
      Array.prototype.forEach.call(from.childNodes, function (n) {
        if (n.nodeType === 3) { to.appendChild(doc.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName.toUpperCase();
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT" || tag === "TEMPLATE") return;
        if (!ALLOWED[tag]) { copy(n, to); return; }
        var el = doc.createElement(tag === "B" ? "strong" : tag === "I" ? "em" : tag.toLowerCase());
        var align = (n.getAttribute("style") || "").match(/text-align\s*:\s*([a-z]+)/i);
        if (align && ALIGN.test(align[1].toLowerCase())) el.setAttribute("style", "text-align:" + align[1].toLowerCase());
        if (tag === "A") {
          var href = safeUrl(n.getAttribute("href"));
          if (href) el.setAttribute("href", href);
          if (/^https?:/i.test(href)) { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
        }
        if (tag === "IMG") {
          var src = safeUrl(n.getAttribute("src"), true);
          if (!src) return;
          el.setAttribute("src", src);
          el.setAttribute("alt", String(n.getAttribute("alt") || "").slice(0, 200));
          el.setAttribute("loading", "lazy");
        }
        to.appendChild(el);
        if (tag !== "IMG" && tag !== "BR" && tag !== "HR") copy(n, el);
      });
    }
    copy(doc.body.firstChild || doc.body, out);
    return out.innerHTML.replace(/(<p>(\s|&nbsp;|<br>)*<\/p>)+$/g, "").trim();
  }

  /** Old plain-text descriptions → paragraphs (blank line = new paragraph, line break kept). */
  function textToHtml(text) {
    text = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!text) return "";
    return text.split(/\n{2,}/).map(function (para) { return "<p>" + esc(para).replace(/\n/g, "<br>") + "</p>"; }).join("");
  }

  /** HTML → plain text (for search, Google description, cards and the WhatsApp order text). */
  function htmlToText(html) {
    var s = String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|blockquote|pre)>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<hr[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "");
    s = s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function wordCount(text) {
    var t = String(text || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  var ICON = {
    bold: '<b>B</b>', italic: '<i>I</i>', ul: '&#8226;&#8801;', ol: '1&#8801;', quote: '&#8220;&#8221;',
    left: '&#8676;', center: '&#8596;', right: '&#8677;', link: '&#128279;', unlink: '&#10799;', hr: '&#8213;', full: '&#x26F6;'
  };

  /**
   * Builds the editor inside `box`. opts: {html, photos: [url], placeholder, onChange(html), minHeight}.
   * Returns {getHtml(), setHtml(html)}.
   */
  function mount(box, opts) {
    opts = opts || {};
    var html = sanitize(opts.html || "");
    box.classList.add("pm-woo-ed");
    box.innerHTML =
      '<div class="pm-woo-ed-top">' +
        '<button type="button" class="pm-woo-ed-media" data-ed="media"><span aria-hidden="true">&#128444;</span> Add Media</button>' +
        '<div class="pm-woo-ed-tabs" role="tablist"><button type="button" role="tab" data-ed-mode="visual" class="is-on" aria-selected="true">Visual</button><button type="button" role="tab" data-ed-mode="code" aria-selected="false">Code</button></div>' +
      '</div>' +
      '<div class="pm-woo-ed-media-pick" hidden></div>' +
      '<div class="pm-woo-ed-frame">' +
        '<div class="pm-woo-ed-toolbar" role="toolbar" aria-label="Formatting">' +
          '<select data-ed="block" aria-label="Paragraph format"><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="h4">Heading 4</option><option value="pre">Preformatted</option></select>' +
          '<button type="button" data-ed="bold" title="Bold (Ctrl+B)" aria-label="Bold">' + ICON.bold + '</button>' +
          '<button type="button" data-ed="italic" title="Italic (Ctrl+I)" aria-label="Italic">' + ICON.italic + '</button>' +
          '<button type="button" data-ed="insertUnorderedList" title="Bulleted list" aria-label="Bulleted list">' + ICON.ul + '</button>' +
          '<button type="button" data-ed="insertOrderedList" title="Numbered list" aria-label="Numbered list">' + ICON.ol + '</button>' +
          '<button type="button" data-ed="quote" title="Blockquote" aria-label="Blockquote">' + ICON.quote + '</button>' +
          '<button type="button" data-ed="justifyLeft" title="Align left" aria-label="Align left">' + ICON.left + '</button>' +
          '<button type="button" data-ed="justifyCenter" title="Align center" aria-label="Align center">' + ICON.center + '</button>' +
          '<button type="button" data-ed="justifyRight" title="Align right" aria-label="Align right">' + ICON.right + '</button>' +
          '<button type="button" data-ed="link" title="Insert/edit link" aria-label="Insert link">' + ICON.link + '</button>' +
          '<button type="button" data-ed="unlink" title="Remove link" aria-label="Remove link">' + ICON.unlink + '</button>' +
          '<button type="button" data-ed="insertHorizontalRule" title="Horizontal line" aria-label="Horizontal line">' + ICON.hr + '</button>' +
          '<button type="button" data-ed="full" title="Fullscreen" aria-label="Fullscreen" class="pm-woo-ed-full">' + ICON.full + '</button>' +
        '</div>' +
        '<div class="pm-woo-ed-visual" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="' + esc(opts.placeholder || "") + '" style="min-height:' + (opts.minHeight || 260) + 'px"></div>' +
        '<textarea class="pm-woo-ed-code" hidden spellcheck="false" style="min-height:' + (opts.minHeight || 260) + 'px" aria-label="HTML"></textarea>' +
        '<div class="pm-woo-ed-status">Word count: <span data-ed="words">0</span></div>' +
      '</div>';
    var visual = box.querySelector(".pm-woo-ed-visual"), code = box.querySelector(".pm-woo-ed-code");
    var words = box.querySelector('[data-ed="words"]'), pick = box.querySelector(".pm-woo-ed-media-pick");
    var mode = "visual";
    visual.innerHTML = html;
    function current() { return sanitize(mode === "code" ? code.value : visual.innerHTML); }
    function emit() {
      var h = current();
      words.textContent = wordCount(htmlToText(h));
      if (opts.onChange) opts.onChange(h);
    }
    words.textContent = wordCount(htmlToText(html));
    function setMode(m) {
      if (m === mode) return;
      if (m === "code") { code.value = sanitize(visual.innerHTML).replace(/(<\/(p|h\d|ul|ol|blockquote|pre)>|<hr>)/g, "$1\n"); }
      else { visual.innerHTML = sanitize(code.value); }
      mode = m;
      visual.hidden = m !== "visual"; code.hidden = m !== "code";
      box.querySelector(".pm-woo-ed-toolbar").classList.toggle("is-code", m === "code");
      box.querySelectorAll("[data-ed-mode]").forEach(function (b) { var on = b.getAttribute("data-ed-mode") === m; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    }
    function exec(cmd, val) {
      visual.focus();
      try { document.execCommand(cmd, false, val); } catch (e) { /* unsupported command: ignore */ }
      emit();
    }
    box.addEventListener("mousedown", function (e) { if (e.target.closest(".pm-woo-ed-toolbar button")) e.preventDefault(); });
    box.addEventListener("click", function (e) {
      var m = e.target.closest("[data-ed-mode]");
      if (m) { setMode(m.getAttribute("data-ed-mode")); return; }
      var b = e.target.closest("[data-ed]");
      if (!b || b.tagName === "SELECT" || b.tagName === "SPAN") return;
      var cmd = b.getAttribute("data-ed");
      if (cmd === "media") {
        var photos = (typeof opts.photos === "function" ? opts.photos() : opts.photos) || [];
        pick.innerHTML = photos.length
          ? '<p>Click a photo to insert it' + (mode === "code" ? " (switch to Visual first)" : "") + ':</p><div>' + photos.map(function (u) { return '<button type="button" data-ed-img="' + esc(u) + '"><img src="' + esc(u) + '" alt=""></button>'; }).join("") + '</div>'
          : "<p>Add photos to Product image / Product gallery first.</p>";
        pick.hidden = !pick.hidden;
        return;
      }
      if (cmd === "full") { box.classList.toggle("is-full"); return; }
      if (mode === "code") return;
      if (cmd === "quote") exec("formatBlock", "blockquote");
      else if (cmd === "link") {
        var url = g.prompt ? g.prompt("Link URL (https://…)", "https://") : "";
        if (url && safeUrl(url)) exec("createLink", url);
      } else exec(cmd);
    });
    pick.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ed-img]");
      if (!b) return;
      if (mode === "code") setMode("visual");
      exec("insertHTML", '<p><img src="' + esc(b.getAttribute("data-ed-img")) + '" alt=""></p>');
      pick.hidden = true;
    });
    box.querySelector('[data-ed="block"]').addEventListener("change", function (e) {
      if (mode === "code") return;
      exec("formatBlock", e.target.value);
    });
    visual.addEventListener("input", emit);
    visual.addEventListener("paste", function (e) {
      var data = e.clipboardData && (e.clipboardData.getData("text/html") || "");
      if (!data) return;
      e.preventDefault();
      exec("insertHTML", sanitize(data));
    });
    code.addEventListener("input", emit);
    return {
      getHtml: current,
      setHtml: function (h) { visual.innerHTML = sanitize(h); code.value = sanitize(h); emit(); }
    };
  }

  g.MaWooEditor = { mount: mount, sanitize: sanitize, textToHtml: textToHtml, htmlToText: htmlToText, wordCount: wordCount };
})(window);
