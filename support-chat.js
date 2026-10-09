/**
 * Muslim Abaya — floating "Customer Support" chat bubble.
 *
 * No backend, no third-party script: the visitor types a message (or taps a quick question)
 * and it opens a WhatsApp chat with that text pre-filled. Messenger and Call shortcuts are
 * included. The WhatsApp link is a normal <a href="https://wa.me/..."> so the site's existing
 * lead tracking (generate_lead on wa.me clicks) keeps working.
 *
 * Contact details come from the same config the footer uses (site-footer-config.js /
 * site-seo-config.js). Override anything with window.SITE_CHAT before this script loads:
 *   window.SITE_CHAT = { whatsapp: "https://wa.me/8801XXXXXXXXX", messenger: "https://m.me/yourpage",
 *                        phoneTel: "+8801XXXXXXXXX", replyTime: "Usually replies within 10 minutes", disabled: false };
 * `replyTime` is empty by default on purpose: only set it if it is true.
 */
(function (global) {
  "use strict";
  if (global.__maSupportChat) return;
  global.__maSupportChat = true;

  var doc = global.document;
  var userCfg = global.SITE_CHAT || {};
  if (userCfg.disabled) return;

  var footerCfg = (global.SITE_FOOTER_CONFIG && global.SITE_FOOTER_CONFIG.contact) || {};
  var seo = global.SITE_SEO || {};
  var social = (global.SITE_FOOTER_CONFIG && global.SITE_FOOTER_CONFIG.social) || seo.social || {};

  function pick() {
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) return arguments[i];
    return "";
  }

  var waBase = String(pick(userCfg.whatsapp, footerCfg.whatsapp, "https://wa.me/8801971642683")).split("?")[0];
  var phoneTel = pick(userCfg.phoneTel, footerCfg.phoneTel, seo.phone, "+8801971642683");
  var brand = pick(userCfg.brand, seo.brand, "Muslim Abaya");
  var replyTime = userCfg.replyTime || "";
  var logo = pick(userCfg.logo, "/assets/brand/muslim-abaya-logo-icon-512.png");

  // Messenger: https://m.me/<page username> derived from the Facebook page URL
  var messenger = userCfg.messenger || "";
  if (!messenger && social.facebook) {
    var m = /facebook\.com\/(?:pg\/)?([^/?#]+)/i.exec(String(social.facebook));
    if (m && !/^(profile\.php|pages|people)$/i.test(m[1])) messenger = "https://m.me/" + m[1];
  }

  var QUICK = userCfg.quickQuestions || [
    { label: "Order status", labelBn: "অর্ডার স্ট্যাটাস", text: "Hello! I would like to know the status of my order." },
    { label: "Size help", labelBn: "সাইজ", text: "Hello! I need help choosing the right size." },
    { label: "Delivery & COD", labelBn: "ডেলিভারি", text: "Hello! Could you tell me about delivery time and cash on delivery?" },
    { label: "Product price", labelBn: "দাম", text: "Hello! I would like to know the price of a product." }
  ];

  var CSS =
    ".ma-chat-fab{position:fixed;right:16px;bottom:calc(80px + env(safe-area-inset-bottom,0px));z-index:510;display:flex;align-items:center;gap:10px;border:0;cursor:pointer;background:#111;color:#fff;border-radius:999px;padding:0;height:54px;min-width:54px;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.28);font:600 12px/1 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:.12em;text-transform:uppercase;transition:transform .15s ease,box-shadow .15s ease}" +
    ".ma-chat-fab:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.32)}" +
    ".ma-chat-fab:focus-visible{outline:3px solid #c9a24d;outline-offset:3px}" +
    ".ma-chat-fab svg{width:24px;height:24px;flex:none}" +
    ".ma-chat-fab .ma-chat-fab-label{display:none}" +
    ".ma-chat-dot{position:absolute;top:6px;right:6px;width:11px;height:11px;border-radius:50%;background:#25d366;border:2px solid #111}" +
    ".ma-chat-panel{position:fixed;right:16px;bottom:calc(144px + env(safe-area-inset-bottom,0px));z-index:511;width:min(360px,calc(100vw - 32px));max-height:min(540px,calc(100vh - 170px));display:none;flex-direction:column;background:#fff;color:#111;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);overflow:hidden;font:14px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".ma-chat-panel.is-open{display:flex}" +
    ".ma-chat-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #eee;background:#fff}" +
    ".ma-chat-avatar{width:40px;height:40px;border-radius:50%;object-fit:contain;background:#f3f3f3;border:1px solid #eee;flex:none}" +
    ".ma-chat-title{flex:1;min-width:0}" +
    ".ma-chat-title strong{display:block;font-size:14px;letter-spacing:.06em;text-transform:uppercase}" +
    ".ma-chat-title span{display:block;font-size:12px;color:#5b5b5b}" +
    ".ma-chat-icon-btn{width:36px;height:36px;border:0;border-radius:10px;background:#f4f4f4;color:#111;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}" +
    ".ma-chat-icon-btn:hover{background:#e9e9e9}" +
    ".ma-chat-icon-btn svg{width:18px;height:18px}" +
    ".ma-chat-body{padding:16px 14px;overflow:auto;background:#fafafa;flex:1}" +
    ".ma-chat-hello{background:#fff;border:1px solid #eee;border-radius:14px 14px 14px 4px;padding:12px 14px;margin:0 0 12px;max-width:92%}" +
    ".ma-chat-hello b{display:block;margin-bottom:2px}" +
    ".ma-chat-hello small{color:#595959}" +
    ".ma-chat-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 6px}" +
    ".ma-chat-chip{border:1px solid #d9d9d9;background:#fff;border-radius:999px;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer;color:#111}" +
    ".ma-chat-chip:hover{border-color:#111}" +
    ".ma-chat-foot{padding:10px 12px 12px;border-top:1px solid #eee;background:#fff}" +
    ".ma-chat-row{display:flex;gap:8px;align-items:flex-end}" +
    ".ma-chat-input{flex:1;min-width:0;resize:none;border:1px solid #d9d9d9;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;max-height:96px;min-height:42px}" +
    ".ma-chat-input:focus{outline:2px solid #111;outline-offset:0;border-color:#111}" +
    ".ma-chat-send{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:42px;padding:0 14px;border-radius:12px;background:#0a7d3b;color:#fff;font-weight:700;font-size:13px;text-decoration:none;border:0;cursor:pointer}" +
    ".ma-chat-send:hover{background:#08662f}" +
    ".ma-chat-send svg{width:18px;height:18px}" +
    ".ma-chat-alt{display:flex;gap:8px;margin-top:10px}" +
    ".ma-chat-alt a{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:38px;border-radius:10px;border:1px solid #e1e1e1;background:#fff;color:#111;font-size:13px;font-weight:600;text-decoration:none}" +
    ".ma-chat-alt a:hover{border-color:#111}" +
    ".ma-chat-alt svg{width:18px;height:18px;flex:none}" +
    ".ma-chat-note{margin:8px 2px 0;font-size:11px;color:#666}" +
    "body:has(#stickyOrderBar) .ma-chat-fab{bottom:calc(144px + env(safe-area-inset-bottom,0px))}" +
    "body:has(#stickyOrderBar) .ma-chat-panel{bottom:calc(208px + env(safe-area-inset-bottom,0px))}" +
    "@media (min-width:769px){.ma-chat-fab{right:22px;bottom:22px;padding:0 20px 0 16px}.ma-chat-fab .ma-chat-fab-label{display:inline}.ma-chat-panel{right:22px;bottom:90px}body:has(#stickyOrderBar) .ma-chat-fab{bottom:22px}body:has(#stickyOrderBar) .ma-chat-panel{bottom:90px}}" +
    "@media (prefers-reduced-motion:reduce){.ma-chat-fab{transition:none}}";

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/></svg>';
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_PHONE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2.1z"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z"/></svg>';
  var ICON_MSGR =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.2 1.9.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm1 12.4-2.6-2.7-5 2.7L10.9 8.6l2.6 2.7 5-2.7z"/></svg>';

  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function pageContext() {
    var t = String(doc.title || "").replace(/\s*[|—-]\s*Muslim Abaya.*$/i, "").trim();
    var path = String(global.location && global.location.pathname || "");
    if (/product/i.test(path) && t) {
      return "\n\n(Product: " + t + " — " + String(global.location.href).split("#")[0] + ")";
    }
    return "";
  }

  function build() {
    var style = doc.createElement("style");
    style.id = "ma-support-chat-css";
    style.textContent = CSS;
    doc.head.appendChild(style);

    var fab = el("button", "ma-chat-fab");
    fab.type = "button";
    fab.id = "maChatFab";
    fab.setAttribute("aria-haspopup", "dialog");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-controls", "maChatPanel");
    fab.setAttribute("aria-label", "Open customer support chat");
    fab.innerHTML = ICON_CHAT + '<span class="ma-chat-fab-label">Customer Support</span><span class="ma-chat-dot" aria-hidden="true"></span>';

    var panel = el("div", "ma-chat-panel");
    panel.id = "maChatPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "maChatTitle");

    var head = el("div", "ma-chat-head");
    var avatar = el("img", "ma-chat-avatar");
    avatar.src = logo;
    avatar.alt = "";
    avatar.width = 40;
    avatar.height = 40;
    avatar.onerror = function () { avatar.style.visibility = "hidden"; };
    var title = el("div", "ma-chat-title");
    title.innerHTML =
      '<strong id="maChatTitle"></strong><span id="maChatSub"></span>';
    title.querySelector("strong").textContent = brand;
    title.querySelector("#maChatSub").textContent = replyTime || "Chat with us on WhatsApp or Messenger";
    var call = el("a", "ma-chat-icon-btn", ICON_PHONE);
    call.href = "tel:" + String(phoneTel).replace(/[^\d+]/g, "");
    call.setAttribute("aria-label", "Call us");
    var close = el("button", "ma-chat-icon-btn", ICON_CLOSE);
    close.type = "button";
    close.setAttribute("aria-label", "Close chat");
    head.appendChild(avatar);
    head.appendChild(title);
    head.appendChild(call);
    head.appendChild(close);

    var body = el("div", "ma-chat-body");
    var hello = el("div", "ma-chat-hello", "<b>Customer Support</b>How can we help you today?<br><small>আমরা কীভাবে সাহায্য করতে পারি?</small>");
    var chips = el("div", "ma-chat-chips");
    body.appendChild(hello);
    body.appendChild(chips);

    var foot = el("div", "ma-chat-foot");
    var row = el("div", "ma-chat-row");
    var input = el("textarea", "ma-chat-input");
    input.rows = 1;
    input.maxLength = 500;
    input.placeholder = "Type your message…";
    input.setAttribute("aria-label", "Your message");
    var send = el("a", "ma-chat-send", ICON_SEND + "<span>Send</span>");
    send.target = "_blank";
    send.rel = "noopener";
    send.setAttribute("aria-label", "Send this message on WhatsApp");
    row.appendChild(input);
    row.appendChild(send);
    foot.appendChild(row);

    var alt = el("div", "ma-chat-alt");
    var wa = el("a", "", "WhatsApp");
    wa.target = "_blank";
    wa.rel = "noopener";
    alt.appendChild(wa);
    if (messenger) {
      var ms = el("a", "", ICON_MSGR + "<span>Messenger</span>");
      ms.href = messenger;
      ms.target = "_blank";
      ms.rel = "noopener";
      alt.appendChild(ms);
    }
    foot.appendChild(alt);
    foot.appendChild(el("p", "ma-chat-note", "Sending opens WhatsApp with your message ready."));

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    doc.body.appendChild(fab);
    doc.body.appendChild(panel);

    function updateLinks() {
      var text = String(input.value || "").trim();
      var full = (text || "Hello! I have a question.") + pageContext();
      var url = waBase + "?text=" + encodeURIComponent(full);
      send.href = url;
      wa.href = waBase + "?text=" + encodeURIComponent("Hello! I have a question." + pageContext());
    }

    QUICK.forEach(function (q) {
      var b = el("button", "ma-chat-chip");
      b.type = "button";
      b.textContent = q.label + (q.labelBn ? " · " + q.labelBn : "");
      b.addEventListener("click", function () {
        input.value = q.text;
        updateLinks();
        input.focus();
      });
      chips.appendChild(b);
    });

    input.addEventListener("input", updateLinks);
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        updateLinks();
        send.click();
      }
    });
    updateLinks();

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      fab.setAttribute("aria-expanded", open ? "true" : "false");
      fab.setAttribute("aria-label", open ? "Close customer support chat" : "Open customer support chat");
      var dot = fab.querySelector(".ma-chat-dot");
      if (dot) dot.style.display = open ? "none" : "";
      if (open) {
        updateLinks();
        global.setTimeout(function () { input.focus(); }, 60);
      } else {
        fab.focus();
      }
    }

    fab.addEventListener("click", function () { setOpen(!panel.classList.contains("is-open")); });
    close.addEventListener("click", function () { setOpen(false); });
    doc.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && panel.classList.contains("is-open")) setOpen(false);
    });
  }

  if (doc.body) build();
  else doc.addEventListener("DOMContentLoaded", build, { once: true });
})(window);
