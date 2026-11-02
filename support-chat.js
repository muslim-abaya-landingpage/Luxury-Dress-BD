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
  var logo = pick(userCfg.logo, "/assets/brand/muslim-abaya-logo-icon.svg");

  // Messenger: https://m.me/<page username> derived from the Facebook page URL
  var messenger = userCfg.messenger || "";
  if (!messenger && social.facebook) {
    var m = /facebook\.com\/(?:pg\/)?([^/?#]+)/i.exec(String(social.facebook));
    if (m && !/^(profile\.php|pages|people)$/i.test(m[1])) messenger = "https://m.me/" + m[1];
  }
  var backendCfg = (global.SITE_FOOTER_CONFIG && global.SITE_FOOTER_CONFIG.supportChat) || {};
  var supabaseUrl = pick(userCfg.supabaseUrl, backendCfg.supabaseUrl);
  var supabaseKey = pick(userCfg.supabaseKey, backendCfg.supabaseKey);
  var liveEnabled = Boolean(supabaseUrl && supabaseKey);
  var supabaseClient = null;
  var supabaseLoadPromise = null;
  var currentUser = null;
  var conversationId = "";
  var conversationChannel = null;
  var conversationPromise = null;
  var seenMessageIds = Object.create(null);
  var isSendingMessage = false;
  var hasAttachmentColumn = true;
  var typingChannel = null;
  var lastTypingSent = 0;
  var typingTimer = null;

  var QUICK = userCfg.quickQuestions || [
    { key: "order_status", icon: "📦", label: "আমার অর্ডার কোথায়?", text: "আসসালামু আলাইকুম! আমার অর্ডারের খবর জানতে চাই। অর্ডার আইডি: " },
    { key: "size_help", icon: "📏", label: "সাইজ বুঝতে সাহায্য", text: "আসসালামু আলাইকুম! আমার জন্য কোন সাইজ ঠিক হবে, একটু সাহায্য করবেন? আমার উচ্চতা: " },
    { key: "delivery_cod", icon: "🚚", label: "ডেলিভারি ও ক্যাশ অন ডেলিভারি", text: "আসসালামু আলাইকুম! ডেলিভারি কতদিনে হয় আর ক্যাশ অন ডেলিভারি আছে কি?" },
    { key: "product_question", icon: "👗", label: "পণ্য নিয়ে প্রশ্ন", text: "আসসালামু আলাইকুম! এই পণ্যটি সম্পর্কে জানতে চাই।" },
    { key: "return_exchange", icon: "🔄", label: "রিটার্ন / এক্সচেঞ্জ", text: "আসসালামু আলাইকুম! রিটার্ন বা এক্সচেঞ্জ নিয়ে সাহায্য দরকার।" }
  ];

  var CSS =
    ".ma-chat-fab{position:fixed;right:16px;bottom:calc(80px + env(safe-area-inset-bottom,0px));z-index:510;display:flex;align-items:center;gap:10px;border:0;cursor:pointer;background:#111;color:#fff;border-radius:999px;padding:0;height:54px;min-width:54px;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.28);font:600 14px/1 'Hind Siliguri',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;transition:transform .15s ease,box-shadow .15s ease}" +
    ".ma-chat-fab:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.32)}" +
    ".ma-chat-fab:focus-visible{outline:3px solid #c9a24d;outline-offset:3px}.ma-chat-fab svg{color:#d9b866}" +
    ".ma-chat-fab svg{width:24px;height:24px;flex:none}" +
    ".ma-chat-fab .ma-chat-fab-label{display:none}" +
    ".ma-chat-dot{position:absolute;top:6px;right:6px;width:11px;height:11px;border-radius:50%;background:#25d366;border:2px solid #111}" +
    ".ma-chat-panel{position:fixed;right:16px;bottom:calc(144px + env(safe-area-inset-bottom,0px));z-index:511;width:min(390px,calc(100vw - 28px));max-height:min(620px,calc(100vh - 130px));display:none;flex-direction:column;background:#fff;color:#111;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);overflow:hidden;font:14px/1.5 'Hind Siliguri',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".ma-chat-panel.is-open{display:flex;z-index:10050}" +
    ".ma-chat-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #2a2a2a;background:#111;color:#fff}.ma-chat-head .ma-chat-title span{color:#d9cfb8}.ma-chat-head .ma-chat-icon-btn{background:rgba(255,255,255,.12);color:#fff}.ma-chat-head .ma-chat-icon-btn:hover{background:rgba(255,255,255,.22)}.ma-chat-head .ma-chat-avatar{background:#fff;border-color:#c9a24d}" +
    ".ma-chat-avatar{width:40px;height:40px;border-radius:50%;object-fit:contain;background:#f3f3f3;border:1px solid #eee;flex:none}" +
    ".ma-chat-title{flex:1;min-width:0}" +
    ".ma-chat-title strong{display:block;font-size:15px;letter-spacing:.02em}" +
    ".ma-chat-title span{display:flex;align-items:center;gap:6px;font-size:12px;color:#5b5b5b}" +
    ".ma-chat-status-dot{width:8px;height:8px;border-radius:50%;background:#b69655;display:inline-block;flex:none}" +
    ".ma-chat-expand{font-size:18px;line-height:1}" +
    ".ma-chat-icon-btn{width:36px;height:36px;border:0;border-radius:10px;background:#f4f4f4;color:#111;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}" +
    ".ma-chat-icon-btn:hover{background:#e9e9e9}" +
    ".ma-chat-icon-btn svg{width:18px;height:18px}" +
    ".ma-chat-body{padding:18px 16px;overflow:auto;background:linear-gradient(180deg,#fff 0%,#fbfaf7 100%);flex:1}" +
    ".ma-chat-welcome{display:flex;align-items:flex-end;gap:8px;margin:0 0 16px}" +
    ".ma-chat-welcome img{width:32px;height:32px;flex:none;object-fit:contain;border-radius:50%;background:#fff;border:1px solid #e3d6b5}.ma-chat-greet{max-width:86%;padding:11px 13px;background:#fff;border:1px solid #ece4d2;border-radius:16px 16px 16px 4px;box-shadow:0 2px 8px rgba(60,45,10,.05)}.ma-chat-greet small{display:block;font-size:11px;color:#9a7b3c;font-weight:600;margin-bottom:2px}.ma-chat-greet strong{display:block;font-size:16px;color:#171717}.ma-chat-greet p{margin:4px 0 0;font-size:13.5px;color:#444}" +
    ".ma-chat-section-title{margin:0 0 9px;font-size:13px;font-weight:700;color:#555}" +
    ".ma-chat-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 6px}" +
    ".ma-chat-chip{border:1px solid #e3d6b5;background:#fffdf8;border-radius:999px;padding:9px 13px;font:inherit;font-size:13px;cursor:pointer;color:#222;box-shadow:0 1px 2px rgba(0,0,0,.025);transition:border-color .15s ease,background .15s ease,transform .15s ease}" +
    ".ma-chat-chip:hover{border-color:#b69655;background:#fffdf8;transform:translateY(-1px)}" +
    ".ma-chat-chip:focus-visible{outline:2px solid #b69655;outline-offset:2px}" +
    ".ma-chat-transcript{display:none;flex-direction:column;gap:9px;padding:4px 0 10px}" +
    ".ma-chat-body.has-messages .ma-chat-transcript{display:flex}" +
    ".ma-chat-body.has-messages .ma-chat-welcome,.ma-chat-body.has-messages .ma-chat-section-title,.ma-chat-body.has-messages .ma-chat-chips{display:none}" +
    ".ma-chat-message{max-width:88%;padding:10px 12px;border-radius:14px;background:#fff;border:1px solid #e9e7e2;box-shadow:0 1px 2px rgba(0,0,0,.03);overflow-wrap:anywhere}" +
    ".ma-chat-message.is-customer{align-self:flex-end;background:#171717;color:#fff;border-color:#171717;border-radius:14px 14px 4px 14px}" +
    ".ma-chat-message.is-agent{align-self:flex-start;border-radius:14px 14px 14px 4px}" +
    ".ma-chat-message-body{white-space:pre-wrap}" +
    ".ma-chat-message time{display:block;margin-top:5px;font-size:10px;opacity:.68}" +
    ".ma-chat-foot{padding:10px 12px 12px;border-top:1px solid #eee;background:#fff}" +
    ".ma-chat-row{display:flex;gap:8px;align-items:flex-end}" +
    ".ma-chat-input{flex:1;min-width:0;resize:none;border:1px solid #d9d9d9;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;max-height:96px;min-height:42px}" +
    ".ma-chat-input:focus{outline:2px solid #c9a24d;outline-offset:0;border-color:#c9a24d}" +
    ".ma-chat-send{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:42px;padding:0 14px;border-radius:12px;background:#111;color:#fff;font-weight:700;font-size:13px;text-decoration:none;border:0;cursor:pointer}" +
    ".ma-chat-send:hover{background:#000}.ma-chat-send svg{color:#d9b866}" +
    ".ma-chat-send svg{width:18px;height:18px}" +
    ".ma-chat-alt{display:flex;gap:8px;margin-top:10px}" +
    ".ma-chat-alt a{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:38px;border-radius:10px;border:1px solid #e1e1e1;background:#fff;color:#111;font-size:13px;font-weight:600;text-decoration:none}" +
    ".ma-chat-alt a:hover{border-color:#111}.ma-chat-alt a.ma-chat-alt-wa{color:#0a7d3b;border-color:#bfe3cb}" +
    ".ma-chat-alt svg{width:18px;height:18px;flex:none}" +
    ".ma-chat-note{margin:8px 2px 0;font-size:11.5px;color:#666;text-align:center}" +
    "body:has(#stickyOrderBar) .ma-chat-fab{bottom:calc(144px + env(safe-area-inset-bottom,0px))}" +
    "body:has(#stickyOrderBar) .ma-chat-panel{bottom:calc(208px + env(safe-area-inset-bottom,0px))}" +
    ".ma-chat-panel.is-expanded{width:min(460px,calc(100vw - 28px));max-height:min(760px,calc(100vh - 100px))}" +
    ".ma-chat-order-form{display:grid;gap:8px;margin:10px 0 12px;padding:12px;border:1px solid #eee8db;border-radius:14px;background:#fff}" +
    ".ma-chat-order-form[hidden],.ma-chat-turnstile[hidden]{display:none!important}" +
    ".ma-chat-order-form input{box-sizing:border-box;width:100%;min-height:42px;border:1px solid #dedbd4;border-radius:10px;padding:9px 11px;font:inherit;font-size:14px}" +
    ".ma-chat-order-form input:focus{outline:2px solid #b69655;outline-offset:1px}" +
    ".ma-chat-order-form button{min-height:42px;border:0;border-radius:10px;padding:0 14px;background:#0a7d3b;color:#fff;font:600 14px system-ui;cursor:pointer}" +
    ".ma-chat-order-form button:disabled{opacity:.6;cursor:wait}" +
    ".ma-chat-order-result{margin:0;color:#4d4638;font-size:12px;line-height:1.55;overflow-wrap:anywhere}" +
    ".ma-order-card{display:grid;gap:10px;padding:13px;border:1px solid #e8e2d4;border-radius:14px;background:linear-gradient(145deg,#fffdf8,#fff);box-shadow:0 5px 16px rgba(31,25,13,.06)}" +
    ".ma-order-card-head{display:flex;align-items:center;gap:9px;min-width:0}" +
    ".ma-order-card-mark{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;border-radius:50%;background:#edf7ef;color:#16733d;font-size:17px;font-weight:800}" +
    ".ma-order-card-title{flex:1;min-width:0;color:#25231e;font-size:13px;font-weight:750}" +
    ".ma-order-card-status{max-width:55%;padding:5px 9px;border:1px solid #dcebdc;border-radius:999px;background:#f1f8f1;color:#23633c;font-size:11px;font-weight:700;text-align:center;overflow-wrap:anywhere}" +
    ".ma-order-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}" +
    ".ma-order-card-item{min-width:0;padding:8px 9px;border-radius:10px;background:#f7f6f2}" +
    ".ma-order-card-item small{display:block;margin-bottom:3px;color:#777;font-size:10px}" +
    ".ma-order-card-item strong{display:block;color:#2d2a24;font-size:12px;font-weight:650;overflow-wrap:anywhere}" +
    ".ma-order-card-note{margin:0;color:#777;font-size:10px}" +
    ".ma-order-error{padding:10px 11px;border:1px solid #f0dfc7;border-radius:11px;background:#fffaf1;color:#704c18;font-size:12px;line-height:1.5}" +
    ".ma-chat-turnstile{display:flex;justify-content:center;max-width:100%;overflow:hidden;margin:8px 0}" +
    "@media (min-width:769px){.ma-chat-fab{right:22px;bottom:22px;padding:0 20px 0 16px}.ma-chat-fab .ma-chat-fab-label{display:inline}.ma-chat-panel{right:22px;bottom:90px}body:has(#stickyOrderBar) .ma-chat-fab{bottom:22px}body:has(#stickyOrderBar) .ma-chat-panel{bottom:90px}}" +
    "@media (max-width:560px){.ma-chat-fab{right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));min-height:50px;min-width:50px}.ma-chat-panel{inset:auto 8px calc(76px + env(safe-area-inset-bottom,0px)) 8px;width:auto;max-height:min(72dvh,620px);border-radius:18px}.ma-chat-head{padding:10px 12px}.ma-chat-body{padding:14px 12px}.ma-chat-welcome{padding:14px 10px 16px}.ma-chat-chip{min-height:40px;padding:8px 10px}.ma-chat-foot{padding:9px 10px calc(10px + env(safe-area-inset-bottom,0px))}.ma-chat-send{padding:0 11px}.ma-chat-panel.is-expanded{inset:0;width:auto;max-height:none;height:100dvh;border-radius:0}.ma-chat-panel.is-expanded .ma-chat-body{max-height:none}.ma-chat-fab:has(+ .ma-chat-panel.is-expanded){display:none}body:has(#stickyOrderBar) .ma-chat-fab{bottom:calc(82px + env(safe-area-inset-bottom,0px))}body:has(#stickyOrderBar) .ma-chat-panel{bottom:calc(140px + env(safe-area-inset-bottom,0px))}body:has(#mobile-bottom-nav):not(:has(#stickyOrderBar)) .ma-chat-fab{bottom:calc(76px + env(safe-area-inset-bottom,0px))}body:has(#mobile-bottom-nav):not(:has(#stickyOrderBar)) .ma-chat-panel{bottom:calc(136px + env(safe-area-inset-bottom,0px))}}" +
    ".ma-chat-contact{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 10px;padding:10px;border:1px solid #eee8db;border-radius:12px;background:#fffdf8}" +
    ".ma-chat-contact[hidden]{display:none!important}.ma-chat-contact p{grid-column:1/-1;margin:0;font-size:12px;color:#5d5546}" +
    ".ma-chat-contact input{min-width:0;min-height:38px;border:1px solid #dedbd4;border-radius:9px;padding:7px 9px;font:inherit;font-size:13px}" +
    ".ma-chat-contact .ma-contact-actions{grid-column:1/-1;display:flex;gap:6px;justify-content:flex-end}" +
    ".ma-chat-contact button{min-height:34px;border:1px solid #dedbd4;border-radius:9px;padding:0 12px;background:#fff;font:600 12px system-ui;cursor:pointer}.ma-chat-contact button[type=submit]{background:#0a7d3b;border-color:#0a7d3b;color:#fff}" +
    ".ma-chat-attach{flex:none;display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid #d9d9d9;border-radius:12px;background:#fff;cursor:pointer;font-size:17px}.ma-chat-attach[hidden]{display:none}" +
    ".ma-chat-message img{display:block;max-width:100%;max-height:240px;border-radius:9px;margin-top:6px;background:#eee}" +
    ".ma-chat-typing{min-height:16px;font-size:11px;color:#8a8170;font-style:italic;padding:2px 2px 0}" +
    /* Compact layout: shorter panel on desktop and mobile */
    ".ma-chat-panel{width:min(370px,calc(100vw - 28px));max-height:min(500px,calc(100vh - 120px))}" +
    ".ma-chat-head{padding:9px 12px;gap:9px}.ma-chat-avatar{width:34px;height:34px}.ma-chat-icon-btn{width:32px;height:32px;border-radius:9px}.ma-chat-icon-btn svg{width:16px;height:16px}" +
    ".ma-chat-title strong{font-size:14px}.ma-chat-title span{font-size:11.5px}" +
    ".ma-chat-body{padding:12px 12px 8px}" +
    ".ma-chat-welcome{margin:0 0 12px}.ma-chat-welcome img{width:28px;height:28px}.ma-chat-greet{padding:9px 12px}.ma-chat-greet strong{font-size:15px}.ma-chat-greet p{font-size:13px;margin-top:2px}" +
    ".ma-chat-section-title{margin:0 0 7px;font-size:12.5px}" +
    ".ma-chat-chips{flex-wrap:nowrap;overflow-x:auto;gap:6px;margin:0 -12px 4px;padding:0 12px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.ma-chat-chips::-webkit-scrollbar{display:none}" +
    ".ma-chat-chip{flex:none;white-space:nowrap;padding:7px 11px;font-size:12.5px;min-height:0}" +
    ".ma-chat-foot{padding:8px 10px 9px}" +
    ".ma-chat-input{min-height:40px;padding:9px 11px}.ma-chat-send,.ma-chat-attach{height:40px}.ma-chat-attach{width:40px}" +
    ".ma-chat-alt{margin-top:7px;gap:6px}.ma-chat-alt a{height:32px;font-size:12.5px;border-radius:9px}.ma-chat-alt svg{width:16px;height:16px}" +
    ".ma-chat-note{margin-top:5px;font-size:10.5px}" +
    ".ma-chat-panel.is-expanded{max-height:min(720px,calc(100vh - 100px))}" +
    "@media (max-width:560px){.ma-chat-panel{max-height:min(66dvh,500px)}.ma-chat-chip{min-height:36px}.ma-chat-head{padding:9px 10px}.ma-chat-body{padding:10px 10px 6px}.ma-chat-chips{margin:0 -10px 4px;padding:0 10px 6px}.ma-chat-foot{padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px))}.ma-chat-panel.is-expanded{max-height:none}}" +
    "@media (prefers-reduced-motion:reduce){.ma-chat-fab,.ma-chat-chip{transition:none}}";

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/></svg>';
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_EXPAND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><path d="m3 3 6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></svg>';
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

  function loadSupabase() {
    if (supabaseClient) return Promise.resolve(supabaseClient);
    if (supabaseLoadPromise) return supabaseLoadPromise;
    supabaseLoadPromise = new Promise(function (resolve, reject) {
      function create() {
        if (!global.supabase || typeof global.supabase.createClient !== "function") {
          reject(new Error("Supabase client did not load."));
          return;
        }
        supabaseClient = global.supabase.createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
        resolve(supabaseClient);
      }
      if (global.supabase && typeof global.supabase.createClient === "function") { create(); return; }
      var script = doc.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      script.async = true;
      script.onload = create;
      script.onerror = function () { reject(new Error("Unable to load chat client.")); };
      (doc.head || doc.documentElement).appendChild(script);
    });
    return supabaseLoadPromise;
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
    fab.setAttribute("aria-label", "সাহায্যের জন্য চ্যাট খুলুন");
    fab.innerHTML = ICON_CHAT + '<span class="ma-chat-fab-label">সাহায্য লাগবে? চ্যাট করুন</span><span class="ma-chat-dot" aria-hidden="true"></span>';

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
      '<strong id="maChatTitle"></strong><span id="maChatSub"><i class="ma-chat-status-dot" aria-hidden="true"></i></span>';
    title.querySelector("strong").textContent = brand;
    title.querySelector("#maChatSub").appendChild(doc.createTextNode(replyTime || "কাস্টমার সাপোর্ট · বাংলায় লিখুন"));
    var call = el("a", "ma-chat-icon-btn", ICON_PHONE);
    call.href = "tel:" + String(phoneTel).replace(/[^\d+]/g, "");
    call.setAttribute("aria-label", "আমাদের ফোন করুন");
    var expand = el("button", "ma-chat-icon-btn ma-chat-expand", ICON_EXPAND);
    expand.type = "button";
    expand.setAttribute("aria-label", "চ্যাট বড় করুন");
    var close = el("button", "ma-chat-icon-btn", ICON_CLOSE);
    close.type = "button";
    close.setAttribute("aria-label", "চ্যাট বন্ধ করুন");
    head.appendChild(avatar);
    head.appendChild(title);
    head.appendChild(call);
    head.appendChild(expand);
    head.appendChild(close);
    var body = el("div", "ma-chat-body");
    var welcome = el("div", "ma-chat-welcome");
    var welcomeLogo = el("img");
    welcomeLogo.src = logo;
    welcomeLogo.alt = "";
    welcomeLogo.onerror = function () { welcomeLogo.style.display = "none"; };
    welcome.appendChild(welcomeLogo);
    var greet = el("div", "ma-chat-greet");
    var greetName = el("small");
    greetName.textContent = brand + " টিম";
    greet.appendChild(greetName);
    greet.appendChild(el("strong", "", "আসসালামু আলাইকুম 👋"));
    greet.appendChild(el("p", "", "অর্ডার, সাইজ বা ডেলিভারি, যেকোনো প্রশ্ন লিখুন। আমরা এখানেই উত্তর দেবো।"));
    welcome.appendChild(greet);
    var sectionTitle = el("p", "ma-chat-section-title", "কী নিয়ে সাহায্য লাগবে?");
    var chips = el("div", "ma-chat-chips");
    var orderForm = el("form", "ma-chat-order-form");
    orderForm.hidden = true;
    var orderIdInput = doc.createElement("input");
    orderIdInput.type = "text";
    orderIdInput.maxLength = 80;
    orderIdInput.required = true;
    orderIdInput.autocomplete = "off";
    orderIdInput.placeholder = "অর্ডার আইডি (যেমন MA-20261102-1234)";
    orderIdInput.setAttribute("aria-label", "অর্ডার আইডি");
    var orderPhoneInput = doc.createElement("input");
    orderPhoneInput.type = "tel";
    orderPhoneInput.maxLength = 24;
    orderPhoneInput.required = true;
    orderPhoneInput.autocomplete = "tel";
    orderPhoneInput.placeholder = "অর্ডারে ব্যবহৃত ফোন নম্বর";
    orderPhoneInput.setAttribute("aria-label", "অর্ডারে ব্যবহৃত ফোন নম্বর");
    var lookupButton = doc.createElement("button");
    lookupButton.type = "submit";
    lookupButton.textContent = "অর্ডার খুঁজুন";
    var orderResult = el("div", "ma-chat-order-result");
    orderResult.setAttribute("aria-live", "polite");
    orderForm.appendChild(orderIdInput);
    orderForm.appendChild(orderPhoneInput);
    orderForm.appendChild(lookupButton);
    orderForm.appendChild(orderResult);
    function showOrderError(message) {
      orderResult.replaceChildren();
      var errorCard = el("div", "ma-order-error");
      errorCard.setAttribute("role", "status");
      errorCard.textContent = message;
      orderResult.appendChild(errorCard);
    }
    function renderOrderCard(order) {
      orderResult.replaceChildren();
      var card = el("section", "ma-order-card");
      card.setAttribute("aria-label", "অর্ডার স্ট্যাটাস");
      var heading = el("div", "ma-order-card-head");
      heading.appendChild(el("span", "ma-order-card-mark", "✓"));
      heading.appendChild(el("strong", "ma-order-card-title", "অর্ডারের আপডেট"));
      var status = el("span", "ma-order-card-status");
      status.textContent = String(order.status || "স্ট্যাটাস পাওয়া যায়নি");
      heading.appendChild(status);
      card.appendChild(heading);
      var grid = el("div", "ma-order-card-grid");
      function addItem(label, value) {
        if (!value) return;
        var item = el("div", "ma-order-card-item");
        item.appendChild(el("small", "", label));
        item.appendChild(el("strong", "", String(value)));
        grid.appendChild(item);
      }
      addItem("অর্ডার আইডি", order.orderId);
      if (order.date) {
        var parsedDate = new Date(order.date);
        addItem("অর্ডারের তারিখ", Number.isNaN(parsedDate.getTime()) ? order.date : parsedDate.toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" }));
      }
      addItem("কুরিয়ার আপডেট", order.courierStatus);
      addItem("ট্র্যাকিং নম্বর", order.tracking);
      card.appendChild(grid);
      card.appendChild(el("p", "ma-order-card-note", "অর্ডারের তথ্য মিলছে না? অর্ডারে ব্যবহৃত ফোন নম্বর ও Order ID আবার যাচাই করুন।"));
      orderResult.appendChild(card);
    }
    var captchaBox = el("div", "ma-chat-turnstile");
    captchaBox.id = "ma-support-chat-turnstile";
    captchaBox.hidden = true;
    var contactForm = el("form", "ma-chat-contact");
    contactForm.hidden = true;
    contactForm.appendChild(el("p", "", "দ্রুত সাহায্যের জন্য নাম ও ফোন দিন (ঐচ্ছিক)"));
    var contactName = doc.createElement("input");
    contactName.type = "text"; contactName.maxLength = 80; contactName.autocomplete = "name";
    contactName.placeholder = "আপনার নাম"; contactName.setAttribute("aria-label", "আপনার নাম");
    var contactPhone = doc.createElement("input");
    contactPhone.type = "tel"; contactPhone.maxLength = 24; contactPhone.autocomplete = "tel";
    contactPhone.placeholder = "ফোন নম্বর"; contactPhone.setAttribute("aria-label", "ফোন নম্বর");
    var contactActions = el("div", "ma-contact-actions");
    var contactSkip = el("button", "", "পরে");
    contactSkip.type = "button";
    var contactSave = el("button", "", "সেভ করুন");
    contactSave.type = "submit";
    contactActions.appendChild(contactSkip);
    contactActions.appendChild(contactSave);
    contactForm.appendChild(contactName);
    contactForm.appendChild(contactPhone);
    contactForm.appendChild(contactActions);
    var typingLine = el("div", "ma-chat-typing");
    typingLine.setAttribute("aria-live", "polite");
    var transcript = el("div", "ma-chat-transcript");
    transcript.setAttribute("aria-live", "polite");
    transcript.setAttribute("aria-relevant", "additions");
    body.appendChild(welcome);
    body.appendChild(sectionTitle);
    body.appendChild(chips);
    body.appendChild(orderForm);
    body.appendChild(captchaBox);
    body.appendChild(contactForm);
    body.appendChild(transcript);
    body.appendChild(typingLine);
    var foot = el("div", "ma-chat-foot");
    var row = el("div", "ma-chat-row");
    var input = el("textarea", "ma-chat-input");
    input.rows = 1;
    input.maxLength = 500;
    input.placeholder = "এখানে আপনার প্রশ্ন লিখুন…";
    input.setAttribute("aria-label", "আপনার মেসেজ");
    var send = el("a", "ma-chat-send", ICON_SEND + "<span>পাঠান</span>");
    send.target = "_blank";
    send.rel = "noopener";
    send.setAttribute("aria-label", "মেসেজ পাঠান");
    var fileInput = doc.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp,image/gif";
    fileInput.hidden = true;
    var attach = el("button", "ma-chat-attach", "📎");
    attach.type = "button";
    attach.title = "ছবি পাঠান (সর্বোচ্চ ৫MB)";
    attach.setAttribute("aria-label", "ছবি পাঠান");
    attach.hidden = !liveEnabled;
    row.appendChild(fileInput);
    row.appendChild(attach);
    row.appendChild(input);
    row.appendChild(send);
    foot.appendChild(row);

    var alt = el("div", "ma-chat-alt");
    var wa = el("a", "ma-chat-alt-wa", "WhatsApp-এ কথা বলুন");
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
    var note = el("p", "ma-chat-note", liveEnabled ? "🔒 নিরাপদ চ্যাট। কার্ড নম্বর বা পাসওয়ার্ড কখনো পাঠাবেন না।" : "মেসেজটি WhatsApp-এ খুলবে। কার্ড নম্বর বা পাসওয়ার্ড পাঠাবেন না।");
    foot.appendChild(note);

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    doc.body.appendChild(fab);
    doc.body.appendChild(panel);

    var turnstileScriptPromise = null;
    var turnstileWidgetId = null;
    function loadTurnstileScript() {
      if (global.turnstile) return Promise.resolve();
      if (turnstileScriptPromise) return turnstileScriptPromise;
      turnstileScriptPromise = new Promise(function (resolve, reject) {
        var script = doc.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = function () { reject(new Error("CAPTCHA could not load.")); };
        doc.head.appendChild(script);
      });
      return turnstileScriptPromise;
    }
    async function getTurnstileToken(action) {
      var config = (global.SITE_FOOTER_CONFIG || {}).supportChat || {};
      if (!config.turnstileSiteKey) throw new Error("CAPTCHA is not configured.");
      await loadTurnstileScript();
      captchaBox.hidden = false;
      if (turnstileWidgetId !== null) {
        global.turnstile.remove(turnstileWidgetId);
        turnstileWidgetId = null;
      }
      return new Promise(function (resolve, reject) {
        turnstileWidgetId = global.turnstile.render(captchaBox, {
          sitekey: config.turnstileSiteKey,
          action: action,
          callback: function (token) { captchaBox.hidden = true; resolve(token); },
          "error-callback": function () { reject(new Error("CAPTCHA failed. Please try again.")); },
          "expired-callback": function () { reject(new Error("CAPTCHA expired. Please try again.")); }
        });
      });
    }
    function updateLinks() {
      var text = String(input.value || "").trim();
      var full = (text || "Hello! I have a question.") + pageContext();
      var url = waBase + "?text=" + encodeURIComponent(full);
      send.href = url;
      wa.href = waBase + "?text=" + encodeURIComponent("Hello! I have a question." + pageContext());
    }
    function appendMessage(row) {
      if (!row || !row.id || seenMessageIds[row.id]) return;
      seenMessageIds[row.id] = true;
      var bubble = el("div", "ma-chat-message " + (row.sender_role === "customer" ? "is-customer" : "is-agent"));
      var messageBody = el("div", "ma-chat-message-body");
      messageBody.textContent = String(row.body || "");
      bubble.appendChild(messageBody);
      if (row.attachment_path && supabaseClient) {
        var img = el("img");
        img.alt = "ছবি";
        img.loading = "lazy";
        bubble.appendChild(img);
        supabaseClient.storage.from("support-attachments").createSignedUrl(row.attachment_path, 3600).then(function (res) {
          if (res && res.data && res.data.signedUrl) img.src = res.data.signedUrl; else img.remove();
        }, function () { img.remove(); });
      }
      var time = el("time");
      time.dateTime = row.created_at || "";
      time.textContent = row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      bubble.appendChild(time);
      transcript.appendChild(bubble);
      body.classList.add("has-conversation", "has-messages");
      body.scrollTop = body.scrollHeight;
    }
    async function ensureLiveConversationImpl() {
      var client = await loadSupabase();
      if (!currentUser) {
        var sessionResult = await client.auth.getSession();
        var session = sessionResult && sessionResult.data && sessionResult.data.session;
        if (session && session.user) currentUser = session.user;
        else {
          var captchaToken = await getTurnstileToken("support_chat_auth");
          var signed = await client.auth.signInAnonymously({ options: { captchaToken: captchaToken } });
          if (signed.error) throw signed.error;
          currentUser = signed.data.user;
        }
      }
      if (conversationId) {
        var active = await client.from("support_conversations").select("id,status").eq("id", conversationId).maybeSingle();
        if (active.error) throw active.error;
        if (active.data && active.data.status !== "closed") return { client: client, id: conversationId };
        conversationId = "";
        if (conversationChannel) {
          await client.removeChannel(conversationChannel);
          conversationChannel = null;
        }
        if (typingChannel) {
          await client.removeChannel(typingChannel);
          typingChannel = null;
        }
      }
      var storedId = "";
      try { storedId = global.localStorage.getItem("maSupportConversation:" + currentUser.id) || ""; } catch (_) {}
      if (storedId) {
        var cached = await client.from("support_conversations").select("id,status").eq("id", storedId).maybeSingle();
        if (!cached.error && cached.data && cached.data.status !== "closed") conversationId = cached.data.id;
      }
      if (!conversationId) {
        var recent = await client.from("support_conversations").select("id,status")
          .eq("visitor_id", currentUser.id).neq("status", "closed")
          .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (recent.error) throw recent.error;
        if (recent.data) conversationId = recent.data.id;
      }
      if (!conversationId) {
        var created = await client.from("support_conversations").insert({
          visitor_id: currentUser.id,
          status: "open",
          page_path: String(global.location && global.location.pathname || "/").slice(0, 512)
        }).select("id").single();
        if (created.error) throw created.error;
        conversationId = created.data.id;
        await client.from("support_events").insert({
          conversation_id: conversationId,
          visitor_id: currentUser.id,
          event_type: "conversation_started",
          action_key: "website_chat",
          page_path: String(global.location && global.location.pathname || "/").slice(0, 512)
        });
        try { global.localStorage.setItem("maSupportConversation:" + currentUser.id, conversationId); } catch (_) {}
      }
      await loadThread(client);
      subscribeThread(client);
      subscribeTyping(client);
      maybeShowContact();
      return { client: client, id: conversationId };
    }
    function ensureLiveConversation() {
      if (conversationPromise) return conversationPromise;
      conversationPromise = ensureLiveConversationImpl().finally(function () { conversationPromise = null; });
      return conversationPromise;
    }
    function missingColumn(error) { return !!error && (error.code === "42703" || error.code === "PGRST204" || /column .* does not exist/i.test(error.message || "")); }
    function messageColumns() { return "id,conversation_id,sender_id,sender_role,body,created_at,read_at" + (hasAttachmentColumn ? ",attachment_path" : ""); }
    function contactKey() { return "maSupportContact:" + conversationId; }
    function maybeShowContact() {
      var done = "";
      try { done = global.localStorage.getItem(contactKey()) || ""; } catch (_) {}
      contactForm.hidden = Boolean(done);
    }
    function subscribeTyping(client) {
      if (typingChannel || !conversationId) return;
      typingChannel = client.channel("support-typing-" + conversationId, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "typing" }, function (msg) {
          if (!msg || !msg.payload || msg.payload.role !== "agent") return;
          typingLine.textContent = "সাপোর্ট টিম লিখছেন…";
          global.clearTimeout(typingTimer);
          typingTimer = global.setTimeout(function () { typingLine.textContent = ""; }, 4000);
        })
        .subscribe();
    }
    function sendTyping() {
      if (!typingChannel || Date.now() - lastTypingSent < 2500) return;
      lastTypingSent = Date.now();
      typingChannel.send({ type: "broadcast", event: "typing", payload: { role: "customer" } }).catch(function () {});
    }
    function notifyTeam(client, messageId) {
      // Best effort: asks the server to alert the team on Telegram. Failure never affects the chat.
      try {
        client.functions.invoke("telegram-support/notify", { body: { message_id: messageId } }).catch(function () {});
      } catch (_) {}
    }
    async function loadThread(client) {
      var result = await client.from("support_messages").select(messageColumns())
        .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(150);
      if (missingColumn(result.error) && hasAttachmentColumn) {
        hasAttachmentColumn = false;
        result = await client.from("support_messages").select(messageColumns())
          .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(150);
      }
      if (result.error) throw result.error;
      transcript.textContent = "";
      seenMessageIds = Object.create(null);
      (result.data || []).forEach(appendMessage);
      body.classList.add("has-conversation");
      body.classList.toggle("has-messages", Boolean((result.data || []).length));
      await client.from("support_messages").update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId).eq("sender_role", "agent").is("read_at", null);
    }
    function subscribeThread(client) {
      if (conversationChannel || !conversationId) return;
      conversationChannel = client.channel("support-chat-" + conversationId)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "support_messages",
          filter: "conversation_id=eq." + conversationId
        }, function (payload) { appendMessage(payload.new); })
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") note.textContent = "✅ সংযুক্ত। মেসেজ লিখুন, আমরা এখানেই উত্তর দেবো।";
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") note.textContent = "সংযোগ একটু বিঘ্নিত হয়েছে। সমস্যা থাকলে WhatsApp-এ লিখুন।";
        });
    }
    async function recordQuickAction(actionKey) {
      if (!liveEnabled) return;
      try {
        var state = await ensureLiveConversation();
        var eventType = actionKey === "order_status" ? "order_status_request" : "quick_action";
        var result = await state.client.from("support_events").insert({
          conversation_id: state.id,
          visitor_id: currentUser.id,
          event_type: eventType,
          action_key: actionKey,
          page_path: String(global.location && global.location.pathname || "/").slice(0, 512)
        });
        if (result.error) throw result.error;
      } catch (error) {
        note.textContent = "এই মুহূর্তে লাইভ চ্যাটে সংযোগ হচ্ছে না। WhatsApp বা Messenger-এ লিখতে পারেন।";
      }
    }
    async function sendLiveMessage() {
      var messageText = String(input.value || "").trim();
      if (!messageText) { input.focus(); return; }
      if (isSendingMessage) return;
      isSendingMessage = true;
      send.setAttribute("aria-disabled", "true");
      send.style.opacity = ".65";
      try {
        var state = await ensureLiveConversation();
        var inserted = await state.client.from("support_messages").insert({
          conversation_id: state.id,
          sender_id: currentUser.id,
          sender_role: "customer",
          body: messageText
        }).select("id,conversation_id,sender_id,sender_role,body,created_at,read_at").single();
        if (inserted.error) throw inserted.error;
        appendMessage(inserted.data);
        notifyTeam(state.client, inserted.data.id);
        input.value = "";
        updateLinks();
        note.textContent = "মেসেজ পৌঁছেছে ✓ আমাদের টিম উত্তর দিলে এখানেই দেখবেন।";
      } catch (error) {
        note.textContent = "মেসেজ যায়নি। আবার চেষ্টা করুন, অথবা WhatsApp-এ লিখুন।";
      } finally {
        isSendingMessage = false;
        send.removeAttribute("aria-disabled");
        send.style.opacity = "";
      }
    }
    send.addEventListener("click", function (event) {
      if (!liveEnabled) return;
      event.preventDefault();
      sendLiveMessage();
    });
    orderForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!liveEnabled) {
        showOrderError("অর্ডার যাচাই সাময়িকভাবে অনুপলব্ধ। WhatsApp-এ যোগাযোগ করুন।");
        return;
      }
      var phone = orderPhoneInput.value.trim();
      var orderId = orderIdInput.value.trim();
      if (!phone || !orderId) return;
      lookupButton.disabled = true;
      lookupButton.textContent = "খোঁজা হচ্ছে…";
      orderResult.replaceChildren();
      var loading = el("div", "ma-order-error");
      loading.setAttribute("role", "status");
      loading.textContent = "আপনার অর্ডারের তথ্য খোঁজা হচ্ছে…";
      orderResult.appendChild(loading);
      try {
        var state = await ensureLiveConversation();
        var turnstileToken = await getTurnstileToken("order_status");
        var result = await state.client.functions.invoke("order-status", {
          body: { phone: phone, orderId: orderId, turnstileToken: turnstileToken }
        });
        if (result.error || !result.data || result.data.ok !== true) throw new Error("Lookup failed");
        var order = result.data.order;
        if (!order) {
          showOrderError("এই Order ID ও ফোন নম্বরে অর্ডার পাওয়া যায়নি। অর্ডারে ব্যবহৃত নম্বর ও Order ID মিলিয়ে আবার চেষ্টা করুন।");
        } else {
          renderOrderCard(order);
        }
      } catch (_) {
        showOrderError("এখন অর্ডার যাচাই করা যাচ্ছে না। CAPTCHA সম্পন্ন করে আবার চেষ্টা করুন, অথবা WhatsApp-এ যোগাযোগ করুন।");
      } finally {
        lookupButton.disabled = false;
        lookupButton.textContent = "অর্ডার খুঁজুন";
      }
    });
    QUICK.forEach(function (q) {
      var b = el("button", "ma-chat-chip");
      b.type = "button";
      b.textContent = q.icon ? q.icon + " " + q.label : q.label + (q.labelBn ? " · " + q.labelBn : "");
      b.addEventListener("click", function () {
        if (q.key === "order_status") {
          orderForm.hidden = false;
          orderResult.replaceChildren();
          if (q.key) recordQuickAction(q.key);
          orderIdInput.focus();
          return;
        }
        orderForm.hidden = true;
        input.value = q.text;
        updateLinks();
        if (q.key) recordQuickAction(q.key);
        input.focus();
      });
      chips.appendChild(b);
    });
    input.addEventListener("input", function () { updateLinks(); if (liveEnabled) sendTyping(); });
    contactSkip.addEventListener("click", function () {
      try { global.localStorage.setItem(contactKey(), "skipped"); } catch (_) {}
      contactForm.hidden = true;
    });
    contactForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var name = contactName.value.trim();
      var phone = contactPhone.value.replace(/[^0-9+ -]/g, "").trim();
      if (!name && !phone) { contactName.focus(); return; }
      if (phone && !/^[0-9+ -]{6,24}$/.test(phone)) { contactPhone.focus(); note.textContent = "ফোন নম্বরটি ঠিকভাবে লিখুন।"; return; }
      contactSave.disabled = true;
      try {
        var state = await ensureLiveConversation();
        var res = await state.client.rpc("set_support_contact", { p_conversation_id: state.id, p_name: name, p_phone: phone });
        if (res.error) throw res.error;
        try { global.localStorage.setItem(contactKey(), "saved"); } catch (_) {}
        contactForm.hidden = true;
        note.textContent = "ধন্যবাদ! আপনার তথ্য সাপোর্ট টিম দেখতে পাবে।";
      } catch (_) {
        note.textContent = "তথ্য সেভ করা যায়নি। মেসেজে লিখে দিলেও চলবে।";
      } finally {
        contactSave.disabled = false;
      }
    });
    attach.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", async function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file || !liveEnabled) return;
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { note.textContent = "শুধু JPG, PNG, WEBP বা GIF ছবি পাঠানো যাবে।"; return; }
      if (file.size > 5 * 1024 * 1024) { note.textContent = "ছবিটি ৫MB-এর বেশি। ছোট ছবি দিন।"; return; }
      attach.disabled = true;
      attach.textContent = "⏳";
      try {
        var state = await ensureLiveConversation();
        if (!hasAttachmentColumn) throw new Error("Attachments unavailable");
        var ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type];
        var rand = global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
        var path = state.id + "/" + rand + "." + ext;
        var up = await state.client.storage.from("support-attachments").upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        var caption = String(input.value || "").trim().slice(0, 500) || "📷 ছবি";
        var inserted = await state.client.from("support_messages").insert({
          conversation_id: state.id, sender_id: currentUser.id, sender_role: "customer", body: caption, attachment_path: path
        }).select(messageColumns()).single();
        if (inserted.error) throw inserted.error;
        appendMessage(inserted.data);
        notifyTeam(state.client, inserted.data.id);
        input.value = "";
        updateLinks();
        note.textContent = "ছবি পাঠানো হয়েছে।";
      } catch (_) {
        note.textContent = "ছবি পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন বা WhatsApp-এ পাঠান।";
      } finally {
        attach.disabled = false;
        attach.textContent = "📎";
      }
    });
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
      fab.setAttribute("aria-label", open ? "চ্যাট বন্ধ করুন" : "সাহায্যের জন্য চ্যাট খুলুন");
      var dot = fab.querySelector(".ma-chat-dot");
      if (dot) dot.style.display = open ? "none" : "";
      if (open) {
        updateLinks();
        if (liveEnabled) ensureLiveConversation().catch(function () {
          note.textContent = "লাইভ চ্যাট সাময়িকভাবে বন্ধ। WhatsApp বা Messenger-এ লিখুন।";
        });
        global.setTimeout(function () { input.focus(); }, 60);
      } else {
        fab.focus();
      }
    }

    fab.addEventListener("click", function () { setOpen(!panel.classList.contains("is-open")); });
    close.addEventListener("click", function () { setOpen(false); });
    expand.addEventListener("click", function () {
      var expanded = panel.classList.toggle("is-expanded");
      expand.setAttribute("aria-label", expanded ? "চ্যাট ছোট করুন" : "চ্যাট বড় করুন");
    });
    doc.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && panel.classList.contains("is-open")) setOpen(false);
    });
  }

  if (doc.body) build();
  else doc.addEventListener("DOMContentLoaded", build, { once: true });
})(window);
