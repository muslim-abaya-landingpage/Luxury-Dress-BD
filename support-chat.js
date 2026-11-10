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
  var activeProductContext = null;
  var productContextSent = false;
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
    ".ma-chat-fab{position:fixed;right:16px;bottom:calc(80px + env(safe-area-inset-bottom,0px));z-index:100000;display:flex;align-items:center;gap:10px;border:0;cursor:pointer;background:#111;color:#fff;border-radius:999px;padding:0;height:54px;min-width:54px;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.28);font:600 14px/1 'Hind Siliguri',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;transition:transform .15s ease,box-shadow .15s ease}" +
    ".ma-chat-fab:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.32)}" +
    ".ma-chat-fab:focus-visible{outline:3px solid #c9a24d;outline-offset:3px}.ma-chat-fab svg{color:#d9b866}" +
    ".ma-chat-fab svg{width:24px;height:24px;flex:none}" +
    ".ma-chat-fab .ma-chat-fab-label{display:none}" +
    ".ma-chat-dot{position:absolute;top:6px;right:6px;width:11px;height:11px;border-radius:50%;background:#25d366;border:2px solid #111}" +
    ".ma-chat-panel{position:fixed;right:16px;bottom:calc(144px + env(safe-area-inset-bottom,0px));z-index:100001;width:min(390px,calc(100vw - 28px));max-height:min(620px,calc(100vh - 130px));display:flex;flex-direction:column;background:#fff;color:#111;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);overflow:hidden;font:14px/1.5 'Hind Siliguri',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;visibility:hidden;opacity:0;pointer-events:none;transform:translate3d(110%,0,0);transition:transform .32s cubic-bezier(.22,1,.36,1),opacity .22s ease,visibility 0s linear .32s}" +
    ".ma-chat-panel.is-open{z-index:10050;visibility:visible;opacity:1;pointer-events:auto;transform:translate3d(0,0,0);transition-delay:0s}" +
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
    ".ma-chat-delete-image{display:inline-flex;align-items:center;margin-top:6px;padding:4px 8px;border:1px solid rgba(255,255,255,.35);border-radius:8px;background:transparent;color:inherit;font:600 11px system-ui;cursor:pointer;opacity:.88}.ma-chat-delete-image:hover{opacity:1;background:rgba(255,255,255,.1)}.ma-chat-delete-image:disabled{opacity:.5;cursor:wait}" +
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
    "@media (max-width:560px){.ma-chat-fab{right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));min-height:50px;min-width:50px}.ma-chat-panel{inset:0 0 0 auto;width:min(420px,92vw);height:100dvh;max-height:100dvh;border-radius:18px 0 0 18px}.ma-chat-head{padding:10px 12px}.ma-chat-body{padding:14px 12px;min-height:0}.ma-chat-welcome{padding:14px 10px 16px}.ma-chat-chip{min-height:40px;padding:8px 10px}.ma-chat-foot{padding:9px 10px calc(10px + env(safe-area-inset-bottom,0px))}.ma-chat-send{padding:0 11px}.ma-chat-panel.is-expanded{inset:0;width:100vw;max-height:none;height:100dvh;border-radius:0}.ma-chat-panel.is-expanded .ma-chat-body{max-height:none}.ma-chat-fab:has(+ .ma-chat-panel.is-expanded){display:none}body:has(#stickyOrderBar) .ma-chat-fab{bottom:calc(184px + env(safe-area-inset-bottom,0px))}body:has(#mobile-bottom-nav):not(:has(#stickyOrderBar)) .ma-chat-fab{bottom:calc(76px + env(safe-area-inset-bottom,0px))}}@media(prefers-reduced-motion:reduce){.ma-chat-panel{transition:none}}" +
    ".ma-chat-contact{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 10px;padding:10px;border:1px solid #eee8db;border-radius:12px;background:#fffdf8}" +
    ".ma-chat-contact[hidden]{display:none!important}.ma-chat-contact p{grid-column:1/-1;margin:0;font-size:12px;color:#5d5546}" +
    ".ma-chat-contact input{min-width:0;min-height:38px;border:1px solid #dedbd4;border-radius:9px;padding:7px 9px;font:inherit;font-size:13px}" +
    ".ma-chat-contact .ma-contact-actions{grid-column:1/-1;display:flex;gap:6px;justify-content:flex-end}" +
    ".ma-chat-contact button{min-height:34px;border:1px solid #dedbd4;border-radius:9px;padding:0 12px;background:#fff;font:600 12px system-ui;cursor:pointer}.ma-chat-contact button[type=submit]{background:#0a7d3b;border-color:#0a7d3b;color:#fff}" +
    ".ma-chat-attach{flex:none;display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid #d9d9d9;border-radius:12px;background:#fff;cursor:pointer;font-size:17px}.ma-chat-attach[hidden]{display:none}.ma-chat-record{flex:none;width:42px;height:42px;border:1px solid #d9d9d9;border-radius:12px;background:#fff;cursor:pointer;font-size:17px}.ma-chat-record[hidden]{display:none}.ma-chat-record.is-recording{color:#b42318;border-color:#b42318;background:#fff5f4}" +
    ".ma-chat-image-draft{display:flex;align-items:center;gap:10px;margin:0 10px 8px;padding:8px;border:1px solid #e8e2d6;border-radius:12px;background:#fffdf8}.ma-chat-image-draft[hidden]{display:none!important}.ma-chat-image-draft img{width:48px;height:48px;object-fit:cover;border-radius:8px;background:#eee}.ma-chat-image-draft audio{width:180px;height:34px}.ma-chat-image-draft-copy{min-width:0;flex:1}.ma-chat-image-draft-copy strong{display:block;font-size:12px}.ma-chat-image-draft-copy small{display:block;color:#777;font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ma-chat-image-remove{flex:none;width:34px;height:34px;border:1px solid #e4d8d5;border-radius:9px;background:#fff;color:#9c332c;font-size:18px;line-height:1}.ma-chat-image-remove:focus-visible{outline:2px solid #b59657;outline-offset:2}" +
    ".ma-chat-message img{display:block;max-width:100%;max-height:240px;border-radius:9px;margin-top:6px;background:#eee}.ma-chat-message audio{display:block;max-width:100%;width:260px;margin-top:7px}.ma-chat-file-link{display:inline-block;margin-top:7px;color:inherit;text-decoration:underline;overflow-wrap:anywhere}" +
    ".ma-chat-typing{min-height:16px;font-size:11px;color:#8a8170;font-style:italic;padding:2px 2px 0}" +
    /* Compact layout: shorter panel on desktop and mobile */
    ".ma-chat-panel{width:min(410px,calc(100vw - 28px));max-height:min(600px,calc(100vh - 120px))}" +
    ".ma-chat-head{padding:9px 12px;gap:9px}.ma-chat-avatar{width:34px;height:34px}.ma-chat-icon-btn{width:32px;height:32px;border-radius:9px}.ma-chat-icon-btn svg{width:16px;height:16px}" +
    ".ma-chat-title strong{font-size:14px}.ma-chat-title span{font-size:11.5px}" +
    ".ma-chat-body{padding:12px 12px 8px}" +
    ".ma-chat-welcome{margin:0 0 12px}.ma-chat-welcome img{width:28px;height:28px}.ma-chat-greet{padding:9px 12px}.ma-chat-greet strong{font-size:15px}.ma-chat-greet p{font-size:13px;margin-top:2px}" +
    ".ma-chat-section-title{margin:0 0 7px;font-size:12.5px}" +
    ".ma-chat-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0 0 10px;padding:0}" +
    ".ma-chat-chip{display:flex;align-items:center;justify-content:flex-start;text-align:left;white-space:normal;min-width:0;min-height:46px;padding:8px 11px;border-radius:13px;font-size:13px;line-height:1.35}.ma-chat-chip:last-child{grid-column:1/-1}" +
    ".ma-chat-foot{padding:8px 10px 9px}" +
    ".ma-chat-input{min-height:40px;padding:9px 11px}.ma-chat-send,.ma-chat-attach{height:40px}.ma-chat-attach{width:40px}" +
    ".ma-chat-alt{margin-top:7px;gap:6px}.ma-chat-alt a{height:32px;font-size:12.5px;border-radius:9px}.ma-chat-alt svg{width:16px;height:16px}" +
    ".ma-chat-note{margin-top:5px;font-size:10.5px}" +
    ".ma-chat-panel.is-expanded{max-height:min(720px,calc(100vh - 100px))}" +
    "@media (max-width:560px){.ma-chat-panel{max-height:min(72dvh,560px)}.ma-chat-chip{min-height:44px}.ma-chat-head{padding:10px 11px}.ma-chat-body{padding:12px 11px 8px}.ma-chat-foot{padding:9px 9px calc(9px + env(safe-area-inset-bottom,0px))}.ma-chat-panel.is-expanded{max-height:none}}" +
    ".ma-chat-chip:last-child{grid-column:1/-1}" +
    ".ma-chat-contact-prompt{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:42px;margin:0 0 10px;padding:9px 12px;border:1px dashed #d5c293;border-radius:12px;background:#fffdf7;color:#50442d;font-family:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer}" +
    ".ma-chat-contact-prompt:hover{border-color:#b69655;background:#fff9e9}.ma-chat-contact-prompt:focus-visible{outline:2px solid #b69655;outline-offset:2px}.ma-chat-contact-prompt[hidden]{display:none!important}" +
    ".ma-chat-contact{grid-template-columns:1fr;gap:7px;padding:12px;background:#fffdf7}.ma-chat-contact label{display:block;margin:0 0 -4px;color:#5d5546;font-size:12px;font-weight:650}.ma-chat-contact input{box-sizing:border-box;width:100%;min-height:42px;padding:9px 11px;font-size:14px}.ma-chat-contact .ma-contact-actions{justify-content:space-between}.ma-chat-contact button{min-height:40px;padding:0 14px;font-size:13px}" +
    ".ma-chat-contact button[type=submit]{background:#117a3f;border-color:#117a3f}" +
    ".ma-chat-clear-local{display:inline-flex;align-items:center;justify-content:center;gap:6px;margin:0 0 7px auto;padding:6px 10px;border:1px solid #e6dfd2;border-radius:999px;background:#fff;color:#765d30;font:600 11px system-ui;cursor:pointer}.ma-chat-clear-local:hover{border-color:#b69655;background:#fffaf0}.ma-chat-clear-local:focus-visible{outline:2px solid #b69655;outline-offset:2px}.ma-chat-clear-local[hidden]{display:none!important}" +
    ".ma-chat-message-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:5px}.ma-chat-message time{display:block;margin:0;font-size:10px;opacity:.68}.ma-chat-receipt{margin-left:auto;font-size:10px;color:#777;white-space:nowrap}.ma-chat-receipt.is-seen{color:#147b48;font-weight:700}.ma-chat-message-remove{border:0;border-radius:6px;padding:2px 5px;background:transparent;color:inherit;font:600 10px system-ui;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;opacity:.76}.ma-chat-message-remove:hover,.ma-chat-message-remove:focus-visible{opacity:1;background:rgba(0,0,0,.07);outline:2px solid #b69655;outline-offset:1px}.ma-chat-message.is-customer .ma-chat-message-remove:hover{background:rgba(255,255,255,.13)}" +
    ".ma-chat-local-dialog{box-sizing:border-box;width:min(340px,calc(100vw - 36px));max-width:340px;margin:auto;padding:18px;border:1px solid #e6dcc8;border-radius:18px;background:#fffdf8;color:#211f1a;box-shadow:0 18px 50px rgba(0,0,0,.25);font:14px/1.55 'Hind Siliguri',system-ui,sans-serif}.ma-chat-local-dialog::backdrop{background:rgba(17,17,17,.42)}.ma-chat-local-dialog h3{margin:0;color:#201e19;font-size:16px;line-height:1.35}.ma-chat-local-dialog p{margin:8px 0 16px;color:#665d4d;font-size:13px}.ma-chat-local-dialog-actions{display:flex;justify-content:flex-end;gap:8px}.ma-chat-local-dialog button{min-height:38px;padding:0 12px;border:1px solid #ded8cb;border-radius:10px;background:#fff;color:#3d3931;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}.ma-chat-local-dialog button:focus-visible{outline:2px solid #b69655;outline-offset:2px}.ma-chat-local-dialog .ma-chat-local-dialog-confirm{border-color:#171717;background:#171717;color:#fff}" +
    "@media (prefers-reduced-motion:reduce){.ma-chat-fab,.ma-chat-chip{transition:none}}" +
    /* ---- Clean layout (white header, quiet start screen, round input) ---- */
    "#maChatPanel{border-radius:20px;border:1px solid #ececec;box-shadow:0 24px 60px rgba(20,20,20,.18);overflow:hidden;background:#fff}" +
    "#maChatPanel .ma-chat-head{background:#fff;color:#111;border-bottom:1px solid #f0f0f0;padding:14px 16px;gap:12px}" +
    "#maChatPanel .ma-chat-avatar{width:42px;height:42px;background:#fff;border:1px solid #e8e8e8;box-shadow:0 0 0 3px #fff}" +
    "#maChatPanel .ma-chat-head .ma-chat-title strong{display:flex;align-items:center;gap:6px;font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:#111}" +
    "#maChatPanel .ma-chat-verified{font-size:13px;letter-spacing:0;color:#c9a24d}" +
    "#maChatPanel .ma-chat-head .ma-chat-title span{color:#1f8a4c;font-size:11.5px}#maChatPanel .ma-chat-head .ma-chat-title span.ma-chat-verified{color:#c9a24d}" +
    "#maChatPanel .ma-chat-status-dot{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.15)}" +
    "#maChatPanel .ma-chat-head .ma-chat-icon-btn{background:transparent;color:#9a9a9a;width:34px;height:34px;border-radius:10px}" +
    "#maChatPanel .ma-chat-head .ma-chat-icon-btn:hover{background:#f4f4f4;color:#111}" +
    "#maChatPanel .ma-chat-head a.ma-chat-icon-btn{color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0}" +
    "#maChatPanel .ma-chat-body{background:#fff;display:flex;flex-direction:column;min-height:300px}" +
    "#maChatPanel .ma-chat-empty{margin:auto;padding:24px 12px;text-align:center;max-width:100%}" +
    "#maChatPanel .ma-chat-brand{display:block;margin:0 0 7px;color:#171717;font:800 16px/1.25 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.12em;text-transform:uppercase}" +
    "#maChatPanel .ma-chat-empty strong{display:block;font-size:17px;color:#111}" +
    "#maChatPanel .ma-chat-empty p{margin:6px 0 14px;font-size:13.5px;color:#6b6b6b}" +
    "#maChatPanel .ma-chat-online{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border:1px solid #ececec;border-radius:999px;background:#fafafa;font-size:12px;color:#555}" +
    "#maChatPanel .ma-chat-online i{width:7px;height:7px;border-radius:50%;background:#22c55e}" +
    "#maChatPanel .ma-chat-body.has-messages .ma-chat-empty{display:none}" +
    "#maChatPanel.ma-chat-live .ma-chat-welcome,#maChatPanel.ma-chat-live .ma-chat-section-title,#maChatPanel.ma-chat-live .ma-chat-chips,#maChatPanel.ma-chat-live .ma-chat-contact-prompt,#maChatPanel .ma-chat-record{display:none!important}" +
    "#maChatPanel:not(.ma-chat-live) .ma-chat-empty,#maChatPanel.ma-chat-live:not(.ma-chat-fallback) .ma-chat-alt{display:none}" +
    "#maChatPanel .ma-chat-foot{border-top:1px solid #f0f0f0;padding:12px 14px}" +
    "#maChatPanel .ma-chat-row{display:flex;align-items:center;gap:10px}" +
    "#maChatPanel .ma-chat-attach{width:38px;height:38px;border:0;background:transparent;color:#6b6b6b;border-radius:10px}" +
    "#maChatPanel .ma-chat-attach:hover{background:#f4f4f4;color:#111}#maChatPanel .ma-chat-attach svg{width:22px;height:22px}" +
    "#maChatPanel .ma-chat-input{flex:1;min-height:44px;padding:11px 16px;border:1px solid #e3e3e3;border-radius:999px;background:#fff;font-size:14px;resize:none}" +
    "#maChatPanel .ma-chat-input:focus{border-color:#c9a24d;box-shadow:0 0 0 3px rgba(201,162,77,.15);outline:0}" +
    "#maChatPanel .ma-chat-send{width:42px;height:42px;padding:0;border-radius:50%;background:#f1f1f1;color:#a3a3a3;justify-content:center}" +
    "#maChatPanel .ma-chat-send svg{color:currentColor;width:18px;height:18px}" +
    "#maChatPanel .ma-chat-send:hover{background:#111;color:#d9b866}" +
    "#maChatPanel .ma-chat-foot:focus-within .ma-chat-send{background:#111;color:#d9b866}" +
    "#maChatPanel .ma-chat-note{margin:8px 2px 0;font-size:11.5px;color:#8a8a8a;text-align:center}" +
    "#maChatPanel .ma-chat-message.is-customer{background:#111;border-color:#111}" +
    "@media (max-width:560px){#maChatPanel{border-radius:18px}#maChatPanel .ma-chat-body{min-height:240px}}" +
    /* Phone: the open chat is a full-screen sheet sized to the part of the screen the keyboard leaves free,
       so the header, messages and the message box always fit (no half page peeking out below). */
    "@media (max-width:560px){body.ma-chat-mobile-open{overflow:hidden}" +
    "body.ma-chat-mobile-open #maChatPanel.is-open{inset:auto 0 auto 0;top:var(--ma-chat-top,0px);height:var(--ma-chat-h,100dvh);max-height:none;width:100%;border-radius:0;border:0;box-shadow:none;z-index:1000200}" +
    "body.ma-chat-mobile-open #maChatPanel .ma-chat-head{padding-top:calc(10px + env(safe-area-inset-top,0px))}" +
    "body.ma-chat-mobile-open #maChatPanel .ma-chat-body{min-height:0;flex:1 1 auto;overscroll-behavior:contain}" +
    "body.ma-chat-mobile-open #maChatPanel .ma-chat-foot{flex-shrink:0;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))}" +
    "body.ma-chat-mobile-open.ma-chat-kb #maChatPanel .ma-chat-foot{padding-bottom:8px}" +
    "body.ma-chat-mobile-open.ma-chat-kb #maChatPanel .ma-chat-note{display:none}" +
    "body.ma-chat-mobile-open #maChatPanel .ma-chat-expand,body.ma-chat-mobile-open .ma-chat-fab,body.ma-chat-mobile-open #mobile-bottom-nav,body.ma-chat-mobile-open #stickyOrderBar{display:none!important}" +
    "body.ma-chat-mobile-open #maChatPanel .ma-chat-input{font-size:16px}}" +
    /* Keep the floating support button above the stacked mobile purchase bar and bottom navigation. */
    "@media (max-width:768px){body:has(.ma-sales-sticky) .ma-chat-fab,body:has(#stickyOrderBar) .ma-chat-fab{bottom:calc(164px + env(safe-area-inset-bottom,0px))!important}" +
    "body:has(.ma-sales-sticky) .ma-chat-panel,body:has(#stickyOrderBar) .ma-chat-panel{bottom:calc(226px + env(safe-area-inset-bottom,0px))!important}}" +
    /* Final visual polish to match the requested live-chat reference. */
    "#maChatPanel .ma-chat-empty strong{font-size:20px;line-height:1.4}" +
    "#maChatPanel .ma-chat-empty p{font-size:15px}" +
    "#maChatPanel .ma-chat-online{font-size:13px;padding:7px 14px}" +
    "#maChatPanel .ma-chat-send{background:#111;color:#d9b866;border:0;box-shadow:none}" +
    "#maChatPanel .ma-chat-send svg{color:#d9b866}" +
    "#maChatPanel .ma-chat-send:hover{background:#242424;color:#f0d28a}" +
    "#maChatPanel .ma-chat-foot:focus-within .ma-chat-send{background:#111;color:#d9b866}" +
    /* Branded composer: balanced attachment, soft input surface and a clear disabled send state. */
    "#maChatPanel .ma-chat-title .ma-chat-status-dot{background:#22c55e}" +
    "#maChatPanel .ma-chat-foot{padding:12px 14px 8px;border-top:1px solid #eee9df;background:#fff}" +
    "#maChatPanel .ma-chat-row{display:flex;align-items:center;gap:9px}" +
    "#maChatPanel .ma-chat-attach{width:38px;height:42px;flex:0 0 38px;display:inline-flex;align-items:center;justify-content:center;margin:0;border:0;border-radius:11px;background:transparent;color:#777}" +
    "#maChatPanel .ma-chat-input{box-sizing:border-box;flex:1 1 auto;width:0;min-width:0;min-height:44px;height:44px;margin:0;padding:11px 15px;border:1px solid #ececec;border-radius:14px;background:#f5f5f4;color:#171717;line-height:20px;box-shadow:none}" +
    "#maChatPanel .ma-chat-input:focus{background:#f7f6f3;border-color:#c9a24d;box-shadow:0 0 0 3px rgba(201,162,77,.12);outline:0}" +
    "#maChatPanel .ma-chat-send{width:42px;height:42px;flex:0 0 42px;display:inline-flex;align-items:center;justify-content:center;margin:0;padding:0;border:0;border-radius:13px;background:#111;color:#d9b866;box-shadow:none;transition:background .16s ease,color .16s ease,opacity .16s ease}" +
    "#maChatPanel .ma-chat-send svg{width:19px;height:19px;stroke:currentColor;fill:none}" +
    "#maChatPanel .ma-chat-send[aria-disabled=true],#maChatPanel .ma-chat-send.is-disabled{background:#efefed;color:#aaa;opacity:1;pointer-events:none;cursor:not-allowed}" +
    "#maChatPanel .ma-chat-foot:focus-within .ma-chat-send[aria-disabled=true]{background:#efefed;color:#aaa}" +
    "#maChatPanel .ma-chat-note{display:block;width:max-content;max-width:100%;margin:7px auto 0;padding:3px 9px;border:1px solid #f0eee9;border-radius:999px;background:#faf9f6;color:#89857c;font-size:10px;line-height:1.4;text-align:center}" +
    /* Muslim Abaya brand presentation with its own logo and gold identity. */
    ".ma-chat-fab{height:54px;min-width:0;padding:0 5px 0 18px;gap:13px;overflow:visible;border:1px solid #e9e6df;background:#fff;color:#171717;box-shadow:0 8px 26px rgba(25,22,16,.13);font:800 10.5px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase}" +
    ".ma-chat-fab:hover{background:#fff;box-shadow:0 12px 30px rgba(25,22,16,.18);transform:translateY(-2px)}" +
    ".ma-chat-fab:focus-visible{outline:3px solid rgba(201,162,77,.45);outline-offset:3px}" +
    ".ma-chat-fab .ma-chat-fab-label{display:inline;white-space:nowrap;color:#171717}" +
    ".ma-chat-fab-badge{position:relative;display:grid;place-items:center;width:44px;height:44px;flex:0 0 44px;border:2px solid #c9a24d;border-radius:50%;background:#fff;box-shadow:0 0 0 3px #fff}" +
    ".ma-chat-fab-badge img{display:block;width:30px;height:30px;object-fit:contain}" +
    ".ma-chat-fab .ma-chat-dot{top:1px;right:1px;width:9px;height:9px;border:2px solid #fff;background:#22c55e}" +
    "#maChatPanel .ma-chat-panel{background:#fff}" +
    "#maChatPanel .ma-chat-head{background:#fff;color:#171717;border-bottom:1px solid #eeeae3;padding:12px 15px;gap:11px}" +
    "#maChatPanel .ma-chat-head .ma-chat-title strong{font-family:Inter,system-ui,sans-serif;font-size:14px;font-weight:800;letter-spacing:.12em;color:#171717}" +
    "#maChatPanel .ma-chat-head .ma-chat-title span{color:#16864b;font-size:11px}" +
    "#maChatPanel .ma-chat-head .ma-chat-icon-btn{background:#fff;color:#777;border:1px solid transparent}" +
    "#maChatPanel .ma-chat-head a.ma-chat-icon-btn{background:#f0fbf4;color:#16864b;border-color:#d7efdf}" +
    "#maChatPanel .ma-chat-body{background:#faf9f6;min-height:340px;padding:20px 16px;justify-content:center}" +
    "#maChatPanel .ma-chat-empty{width:100%;max-width:100%;margin:auto;padding:24px 10px;text-align:center}" +
    "#maChatPanel .ma-chat-brand{display:block;margin:0 auto 15px;color:#171717;font-size:0;line-height:0}" +
    "#maChatPanel .ma-chat-brand img{display:block;width:min(180px,68vw);height:auto;max-height:58px;object-fit:contain;margin:0 auto}" +
    "#maChatPanel .ma-chat-brand-text{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}" +
    "#maChatPanel .ma-chat-empty strong{display:block;margin:0;color:#111;font-family:'Hind Siliguri',system-ui,sans-serif;font-size:20px;font-weight:700;line-height:1.5}" +
    "#maChatPanel .ma-chat-empty p{margin:5px 0 14px;color:#777;font-size:13.5px;line-height:1.6}" +
    "#maChatPanel .ma-chat-online{padding:7px 13px;border:1px solid #e9e7e2;border-radius:999px;background:#fafafa;color:#626262;font-size:11.5px}" +
    "#maChatPanel .ma-chat-foot{background:#fff;border-top:1px solid #eeeae3}" +
    "@media (min-width:769px){.ma-chat-fab{right:22px;bottom:22px}.ma-chat-panel{width:min(420px,calc(100vw - 28px));height:min(620px,calc(100vh - 110px));max-height:min(620px,calc(100vh - 110px))}}" +
    "@media (max-width:560px){.ma-chat-fab{right:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));height:52px;padding-left:14px;gap:10px;font-size:9.5px;letter-spacing:.11em}.ma-chat-fab-badge{width:42px;height:42px;flex-basis:42px}.ma-chat-fab-badge img{width:28px;height:28px}#maChatPanel .ma-chat-body{min-height:0;padding:18px 12px}#maChatPanel .ma-chat-brand{margin-bottom:13px}#maChatPanel .ma-chat-brand img{width:min(164px,62vw)}#maChatPanel .ma-chat-empty strong{font-size:19px}}" +
    /* Final restraint: one brand wordmark only, followed by the support title. */
    "#maChatPanel .ma-chat-brand{margin:0 auto 14px;max-width:100%}" +
    "#maChatPanel .ma-chat-brand img{width:min(176px,64vw);height:auto;max-height:52px;object-fit:contain}" +
    "#maChatPanel .ma-chat-brand-text{display:none!important}" +
    "#maChatPanel .ma-chat-empty{padding:22px 12px}" +
    "#maChatPanel .ma-chat-empty strong{margin:0;font-size:20px;line-height:1.45}" +
    "#maChatPanel .ma-chat-empty p{margin:5px 0 14px;font-size:14px;line-height:1.55}" +
    "#maChatPanel .ma-chat-online{font-size:12px;padding:7px 13px}" +
    ".ma-chat-product-context{display:flex;gap:11px;align-items:flex-start;margin:0 0 14px;padding:10px;border:1px solid #e8e1d4;border-radius:12px;background:#fff}.ma-chat-product-context[hidden]{display:none!important}.ma-chat-product-context img{width:68px;height:82px;flex:0 0 68px;object-fit:cover;border-radius:8px;background:#f3f1ed}.ma-chat-product-copy{min-width:0;flex:1}.ma-chat-product-copy strong{display:block;color:#171717;font-size:13px;line-height:1.4}.ma-chat-product-copy small{display:block;margin-top:4px;color:#777;font-size:11px}.ma-chat-product-copy b{display:block;margin-top:4px;color:#111;font-size:14px}.ma-chat-product-link{display:inline-flex;margin-top:7px;padding:5px 9px;border-radius:7px;background:#111;color:#fff;text-decoration:none;font-size:11px;font-weight:700}" +
    "@media (min-width:561px){#maChatPanel.ma-chat-panel{width:min(410px,calc(100vw - 28px));height:min(600px,calc(100dvh - 110px));max-height:min(600px,calc(100dvh - 110px))}}" +
    "@media (max-width:560px){#maChatPanel .ma-chat-brand{margin-bottom:12px}#maChatPanel .ma-chat-brand img{width:min(160px,60vw)}#maChatPanel .ma-chat-empty strong{font-size:19px}}";

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/></svg>';
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>';
  var ICON_EXPAND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><path d="m3 3 6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></svg>';
  var ICON_PHONE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2.1z"/></svg>';
  var ICON_IMAGE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 9"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/></svg>';
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
    var fabLabel = el("span", "ma-chat-fab-label", "CUSTOMER SUPPORT");
    var fabBadge = el("span", "ma-chat-fab-badge");
    var fabLogo = doc.createElement("img");
    fabLogo.src = logo;
    fabLogo.alt = brand;
    fabLogo.width = 34;
    fabLogo.height = 34;
    fabBadge.appendChild(fabLogo);
    fabBadge.appendChild(el("span", "ma-chat-dot"));
    fab.appendChild(fabLabel);
    fab.appendChild(fabBadge);

    var panel = el("div", "ma-chat-panel");
    panel.id = "maChatPanel";
    if (liveEnabled) panel.classList.add("ma-chat-live");
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
    title.querySelector("strong").appendChild(el("span", "ma-chat-verified", "✓"));
    title.querySelector("#maChatSub").appendChild(doc.createTextNode(replyTime || (liveEnabled ? "Online · Replies in 2m" : "WhatsApp-এ সহায়তা • বাংলায় লিখুন")));
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
    var productContextCard = el("section", "ma-chat-product-context");
    productContextCard.hidden = true;
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
    greet.appendChild(el("p", "", liveEnabled ? "অর্ডার, সাইজ বা ডেলিভারি—যে কোনো প্রশ্ন করুন, আমরা সাহায্য করতে আছি।" : "অর্ডার, সাইজ বা ডেলিভারি—যে কোনো প্রশ্ন লিখুন; পাঠালে WhatsApp খুলবে।"));
    welcome.appendChild(greet);
    var sectionTitle = el("p", "ma-chat-section-title", "কী বিষয়ে সাহায্য চান?");
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
    var contactPrompt = el("button", "ma-chat-contact-prompt", "নাম ও ফোন শেয়ার করুন (ঐচ্ছিক)");
    contactPrompt.type = "button";
    contactPrompt.setAttribute("aria-controls", "maChatContact");
    contactPrompt.setAttribute("aria-expanded", "false");
    contactPrompt.hidden = !liveEnabled;
    var contactForm = el("form", "ma-chat-contact");
    contactForm.id = "maChatContact";
    contactForm.hidden = true;
    contactForm.appendChild(el("p", "", "প্রয়োজনে যোগাযোগের জন্য তথ্য দিন। এটি সম্পূর্ণ ঐচ্ছিক।"));
    var contactName = doc.createElement("input");
    contactName.id = "maChatContactName";
    contactName.type = "text"; contactName.maxLength = 80; contactName.autocomplete = "name";
    contactName.placeholder = "যেমন: আয়েশা"; contactName.setAttribute("aria-label", "আপনার নাম (ঐচ্ছিক)");
    var contactNameLabel = el("label", "", "আপনার নাম (ঐচ্ছিক)");
    contactNameLabel.htmlFor = contactName.id;
    var contactPhone = doc.createElement("input");
    contactPhone.id = "maChatContactPhone";
    contactPhone.type = "tel"; contactPhone.maxLength = 24; contactPhone.autocomplete = "tel";
    contactPhone.placeholder = "যে নম্বরে যোগাযোগ করা যাবে"; contactPhone.setAttribute("aria-label", "ফোন নম্বর (ঐচ্ছিক)");
    var contactPhoneLabel = el("label", "", "ফোন নম্বর (ঐচ্ছিক)");
    contactPhoneLabel.htmlFor = contactPhone.id;
    var contactActions = el("div", "ma-contact-actions");
    var contactSkip = el("button", "", "পরে");
    contactSkip.type = "button";
    var contactSave = el("button", "", "সেভ করুন");
    contactSave.type = "submit";
    contactActions.appendChild(contactSkip);
    contactActions.appendChild(contactSave);
    contactForm.appendChild(contactNameLabel);
    contactForm.appendChild(contactName);
    contactForm.appendChild(contactPhoneLabel);
    contactForm.appendChild(contactPhone);
    contactForm.appendChild(contactActions);
    var typingLine = el("div", "ma-chat-typing");
    typingLine.setAttribute("aria-live", "polite");
    var transcript = el("div", "ma-chat-transcript");
    transcript.setAttribute("aria-live", "polite");
    transcript.setAttribute("aria-relevant", "additions");
    var clearLocalButton = el("button", "ma-chat-clear-local", "এই ডিভাইসে চ্যাট পরিষ্কার");
    clearLocalButton.type = "button";
    clearLocalButton.hidden = true;
    clearLocalButton.title = "শুধু এই ব্রাউজারে মেসেজ সরবে; সাপোর্ট টিমের কপি থাকবে";
    clearLocalButton.setAttribute("aria-label", "এই ডিভাইসের চ্যাট পরিষ্কার করুন");
    var localDeleteDialog = doc.createElement("dialog");
    localDeleteDialog.className = "ma-chat-local-dialog";
    localDeleteDialog.setAttribute("role", "alertdialog");
    localDeleteDialog.setAttribute("aria-labelledby", "maChatLocalDeleteTitle");
    localDeleteDialog.setAttribute("aria-describedby", "maChatLocalDeleteCopy");
    var localDialogTitle = el("h3");
    localDialogTitle.id = "maChatLocalDeleteTitle";
    var localDialogCopy = el("p");
    localDialogCopy.id = "maChatLocalDeleteCopy";
    var localDialogActions = el("div", "ma-chat-local-dialog-actions");
    var localDialogCancel = el("button", "", "বাতিল");
    localDialogCancel.type = "button";
    var localDialogConfirm = el("button", "ma-chat-local-dialog-confirm", "সরান");
    localDialogConfirm.type = "button";
    localDialogActions.append(localDialogCancel, localDialogConfirm);
    localDeleteDialog.append(localDialogTitle, localDialogCopy, localDialogActions);
    var pendingLocalAction = null;
    localDialogCancel.addEventListener("click", function () {
      pendingLocalAction = null;
      localDeleteDialog.close();
    });
    localDialogConfirm.addEventListener("click", function () {
      var action = pendingLocalAction;
      pendingLocalAction = null;
      localDeleteDialog.close();
      if (action) action();
    });
    localDeleteDialog.addEventListener("cancel", function () { pendingLocalAction = null; });
    // Clean start screen (same idea as other Bangladeshi shop chats): just a heading and one line.
    var emptyState = el("div", "ma-chat-empty");
    var brandMark = el("div", "ma-chat-brand");
    var brandMarkImage = doc.createElement("img");
    brandMarkImage.src = "/assets/logo-muslim-abaya.svg";
    brandMarkImage.alt = "Muslim Abaya";
    brandMarkImage.width = 180;
    brandMarkImage.height = 34;
    brandMark.appendChild(brandMarkImage);
    emptyState.appendChild(brandMark);
    emptyState.appendChild(el("strong", "", "কাস্টমার সাপোর্ট"));
    emptyState.appendChild(el("p", "", "কীভাবে সাহায্য করতে পারি?"));
    emptyState.appendChild(el("span", "ma-chat-online", '<i aria-hidden="true"></i>' + (liveEnabled ? "লাইভ সাপোর্ট • নিচে মেসেজ লিখুন" : "নিচে লিখুন • WhatsApp-এ পাঠানো হবে")));
    body.appendChild(emptyState);
    body.appendChild(welcome);
    body.appendChild(productContextCard);
    body.appendChild(sectionTitle);
    body.appendChild(chips);
    body.appendChild(contactPrompt);
    body.appendChild(orderForm);
    body.appendChild(captchaBox);
    body.appendChild(contactForm);
    body.appendChild(clearLocalButton);
    body.appendChild(transcript);
    body.appendChild(typingLine);
    var foot = el("div", "ma-chat-foot");
    var row = el("div", "ma-chat-row");
    var pendingImage = null, pendingImageUrl = "", mediaRecorder = null, recordingStream = null, recordingChunks = [];
    var input = el("textarea", "ma-chat-input");
    input.rows = 1;
    input.maxLength = 500;
    input.placeholder = "Write your message / এখানে লিখুন…";
    input.setAttribute("aria-label", "Your message / আপনার মেসেজ");
    var send = el("a", "ma-chat-send", ICON_SEND);
    send.target = "_blank";
    send.rel = "noopener";
    send.setAttribute("aria-label", "মেসেজ পাঠান");
    var fileInput = doc.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp,image/gif,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";
    fileInput.hidden = true;
    var attach = el("button", "ma-chat-attach", ICON_IMAGE);
    attach.type = "button";
    attach.title = "ছবি, অডিও বা ডকুমেন্ট পাঠান (সর্বোচ্চ ১০MB)";
    attach.setAttribute("aria-label", "ফাইল পাঠান");
    attach.hidden = !liveEnabled;
    var recordButton = el("button", "ma-chat-record", "🎙️");
    recordButton.type = "button";
    recordButton.title = "ভয়েস রেকর্ড শুরু করুন";
    recordButton.setAttribute("aria-label", "ভয়েস রেকর্ড করুন");
    recordButton.hidden = !liveEnabled || !global.MediaRecorder || !global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia;
    var imageDraft = el("div", "ma-chat-image-draft");
    imageDraft.hidden = true;
    imageDraft.setAttribute("aria-live", "polite");
    var imagePreview = el("img");
    imagePreview.alt = "পাঠানোর জন্য নির্বাচিত ছবির প্রিভিউ";
    var audioPreview = doc.createElement("audio"); audioPreview.controls = true; audioPreview.hidden = true;
    var imageCopy = el("div", "ma-chat-image-draft-copy");
    imageCopy.appendChild(el("strong", "", "সংযুক্তি পাঠানোর জন্য প্রস্তুত"));
    var imageName = el("small");
    imageCopy.appendChild(imageName);
    var removeImage = el("button", "ma-chat-image-remove", "×");
    removeImage.type = "button";
    removeImage.setAttribute("aria-label", "ছবি সরান");
    imageDraft.append(imagePreview, audioPreview, imageCopy, removeImage);
    foot.appendChild(imageDraft);
    row.appendChild(fileInput);
    row.appendChild(attach);
    row.appendChild(recordButton);
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
    var note = el("p", "ma-chat-note", liveEnabled ? "নিরাপদ চ্যাট · কার্ডের তথ্য বা পাসওয়ার্ড শেয়ার করবেন না" : "মেসেজ WhatsApp-এ যাবে · কার্ডের তথ্য বা পাসওয়ার্ড শেয়ার করবেন না");
    foot.appendChild(note);

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    panel.appendChild(localDeleteDialog);
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
      var hasPayload = !!text || !!pendingImage;
      var disabled = !hasPayload || isSendingMessage;
      var productText = activeProductContext && !productContextSent ? [
        "পণ্য: " + activeProductContext.name,
        "পণ্য ID: " + activeProductContext.id,
        "দাম: ৳" + activeProductContext.price,
        activeProductContext.size ? "সাইজ: " + activeProductContext.size : "",
        activeProductContext.color ? "রং: " + activeProductContext.color : "",
        activeProductContext.image ? "ছবি: " + activeProductContext.image : "",
        activeProductContext.url ? "লিংক: " + activeProductContext.url : ""
      ].filter(Boolean).join("\\n") : "";
      var full = (text || "Hello! I have a question.") + (productText ? "\\n\\n" + productText : "") + pageContext();
      var url = waBase + "?text=" + encodeURIComponent(full);
      if (disabled) {
        send.setAttribute("aria-disabled", "true");
        send.setAttribute("tabindex", "-1");
        send.classList.add("is-disabled");
      } else {
        send.setAttribute("aria-disabled", "false");
        send.removeAttribute("tabindex");
        send.classList.remove("is-disabled");
      }
      if (!liveEnabled && !disabled) send.href = url;
      else send.removeAttribute("href");
      wa.href = waBase + "?text=" + encodeURIComponent("Hello! I have a question." + pageContext());
    }
    function hiddenMessageKey() { return "maSupportHiddenMessages:" + conversationId; }
    function readHiddenMessageIds() {
      try {
        var ids = JSON.parse(global.localStorage.getItem(hiddenMessageKey()) || "[]");
        return Array.isArray(ids) ? ids.filter(function (id) { return typeof id === "string"; }) : [];
      } catch (_) { return []; }
    }
    function writeHiddenMessageIds(ids) {
      try { global.localStorage.setItem(hiddenMessageKey(), JSON.stringify(ids)); return true; }
      catch (_) { return false; }
    }
    function refreshTranscriptState() {
      var hasVisibleMessages = Boolean(transcript.querySelector(".ma-chat-message"));
      body.classList.toggle("has-messages", hasVisibleMessages);
      clearLocalButton.hidden = !hasVisibleMessages;
    }
    function requestLocalAction(title, copy, confirmLabel, action) {
      localDialogTitle.textContent = title;
      localDialogCopy.textContent = copy;
      localDialogConfirm.textContent = confirmLabel;
      pendingLocalAction = action;
      if (typeof localDeleteDialog.showModal === "function") {
        localDeleteDialog.showModal();
        localDialogCancel.focus();
      } else {
        pendingLocalAction = null;
        if (global.confirm(copy)) action();
      }
    }
    function hideMessageLocally(row, bubble) {
      if (!bubble.isConnected) return;
      var id = String(row.id);
      var ids = readHiddenMessageIds();
      if (ids.indexOf(id) < 0) ids.push(id);
      if (!writeHiddenMessageIds(ids)) {
        note.textContent = "ব্রাউজারের স্টোরেজে সেভ করা যায়নি। কিছু storage space খালি করে আবার চেষ্টা করুন।";
        return;
      }
      bubble.remove();
      refreshTranscriptState();
      note.textContent = "মেসেজটি শুধু এই ডিভাইস থেকে সরানো হয়েছে; সাপোর্ট টিমের কপি থাকবে।";
    }
    function clearVisibleMessagesLocally() {
      var bubbles = Array.prototype.slice.call(transcript.querySelectorAll(".ma-chat-message[data-message-id]"));
      var newIds = bubbles.map(function (bubble) { return bubble.getAttribute("data-message-id"); }).filter(Boolean);
      if (!newIds.length) return;
      var ids = readHiddenMessageIds();
      newIds.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
      if (!writeHiddenMessageIds(ids)) {
        note.textContent = "চ্যাট পরিষ্কার করা যায়নি। ব্রাউজারের storage space যাচাই করে আবার চেষ্টা করুন।";
        return;
      }
      transcript.replaceChildren();
      refreshTranscriptState();
      note.textContent = "এই ডিভাইসের চ্যাট পরিষ্কার হয়েছে। সাপোর্ট টিমের কপি অক্ষত আছে।";
    }
    function appendMessage(row) {
      if (!row || !row.id || seenMessageIds[row.id]) return;
      seenMessageIds[row.id] = true;
      var messageId = String(row.id);
      if (readHiddenMessageIds().indexOf(messageId) >= 0) return;
      var bubble = el("div", "ma-chat-message " + (row.sender_role === "customer" ? "is-customer" : "is-agent"));
      bubble.setAttribute("data-message-id", messageId);
      var messageBody = el("div", "ma-chat-message-body");
      messageBody.textContent = String(row.body || "");
      bubble.appendChild(messageBody);
      if (row.attachment_path && !row.deleted_at && supabaseClient) {
        var mime = String(row.attachment_mime || "");
        var attachmentName = String(row.attachment_name || "সংযুক্ত ফাইল");
        var media;
        if (mime.indexOf("image/") === 0) {
          media = el("img"); media.alt = attachmentName; media.loading = "lazy";
        } else if (mime.indexOf("audio/") === 0) {
          media = doc.createElement("audio"); media.controls = true; media.preload = "metadata";
        } else {
          media = el("a", "ma-chat-file-link", "📄 " + attachmentName);
          media.target = "_blank"; media.rel = "noopener"; media.download = attachmentName;
        }
        bubble.appendChild(media);
        supabaseClient.storage.from("support-attachments").createSignedUrl(row.attachment_path, 3600).then(function (res) {
          if (res && res.data && res.data.signedUrl) { media.src = res.data.signedUrl; if (media.tagName === "A") media.href = res.data.signedUrl; }
          else media.remove();
        }, function () { media.remove(); });
      }
      var messageFooter = el("div", "ma-chat-message-footer");
      var time = el("time");
      time.dateTime = row.created_at || "";
      time.textContent = row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      var removeMessage = el("button", "ma-chat-message-remove", "মুছুন");
      removeMessage.type = "button";
      removeMessage.title = "শুধু এই ডিভাইস থেকে সরবে; সাপোর্ট টিমের কপি থাকবে";
      removeMessage.setAttribute("aria-label", "এই ডিভাইসের চ্যাট থেকে মেসেজটি মুছুন");
      removeMessage.addEventListener("click", function () {
        requestLocalAction("মেসেজটি সরাবেন?", "এটি শুধু এই ব্রাউজারের চ্যাট থেকে সরবে। সাপোর্ট টিমের কাছে আসল মেসেজ ও সংযুক্তির কপি থাকবে।", "এই ডিভাইস থেকে সরান", function () { hideMessageLocally(row, bubble); });
      });
      messageFooter.append(time);
      if (row.sender_role === "customer") {
        var receipt = el("span", "ma-chat-receipt" + (row.read_at ? " is-seen" : ""), row.read_at ? "✓✓ সাপোর্ট টিম দেখেছেন" : "✓ পাঠানো হয়েছে");
        receipt.setAttribute("data-message-receipt", "true");
        if (row.read_at) receipt.title = "সাপোর্ট টিম " + new Date(row.read_at).toLocaleString("bn-BD") + " সময়ে মেসেজটি দেখেছেন";
        messageFooter.appendChild(receipt);
      }
      messageFooter.appendChild(removeMessage);
      bubble.appendChild(messageFooter);
      transcript.appendChild(bubble);
      body.classList.add("has-conversation");
      refreshTranscriptState();
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
    function messageColumns() { return "id,conversation_id,sender_id,sender_role,body,created_at,read_at,deleted_at" + (hasAttachmentColumn ? ",attachment_path,attachment_name,attachment_mime" : ""); }
    function contactKey() { return "maSupportContact:" + conversationId; }
    function maybeShowContact() {
      var done = "";
      try { done = global.localStorage.getItem(contactKey()) || ""; } catch (_) {}
      contactForm.hidden = true;
      contactPrompt.hidden = !liveEnabled || Boolean(done);
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
      refreshTranscriptState();
      await client.from("support_messages").update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId).eq("sender_role", "agent").is("read_at", null);
    }
    function subscribeThread(client) {
      if (conversationChannel || !conversationId) return;
      conversationChannel = client.channel("support-chat-" + conversationId)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "support_messages",
          filter: "conversation_id=eq." + conversationId
        }, function (payload) {
          var row = payload && payload.new;
          if (!row) return;
          appendMessage(row);
          if (row.sender_role === "agent" && row.read_at == null) {
            client.from("support_messages").update({ read_at: new Date().toISOString() })
              .eq("id", row.id).eq("sender_role", "agent").is("read_at", null)
              .then(function (result) { if (result && result.error) note.textContent = "মেসেজ দেখা হয়েছে, তবে Seen Status আপডেট হয়নি।"; });
          }
        })
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "support_messages",
          filter: "conversation_id=eq." + conversationId
        }, function (payload) {
          var row = payload && payload.new; if (!row || !row.id) return;
          var bubble = Array.prototype.slice.call(transcript.querySelectorAll(".ma-chat-message[data-message-id]")).find(function (node) { return node.getAttribute("data-message-id") === String(row.id); });
          if (!bubble) return;
          var text = bubble.querySelector(".ma-chat-message-body"); if (text) text.textContent = String(row.deleted_at ? row.body : row.body || "");
          var receipt = bubble.querySelector("[data-message-receipt]");
          if (receipt && row.sender_role === "customer") {
            receipt.classList.toggle("is-seen", Boolean(row.read_at));
            receipt.textContent = row.read_at ? "✓✓ সাপোর্ট টিম দেখেছেন" : "✓ পাঠানো হয়েছে";
            receipt.title = row.read_at ? "সাপোর্ট টিম " + new Date(row.read_at).toLocaleString("bn-BD") + " সময়ে মেসেজটি দেখেছেন" : "মেসেজটি সাপোর্ট টিমের কাছে পাঠানো হয়েছে";
          }
          if (row.deleted_at) bubble.querySelectorAll("img,audio,.ma-chat-file-link").forEach(function (node) { node.remove(); });
        })
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
    function clearPendingImage() {
      if (pendingImageUrl && global.URL && global.URL.revokeObjectURL) global.URL.revokeObjectURL(pendingImageUrl);
      pendingImage = null; pendingImageUrl = "";
      imagePreview.removeAttribute("src"); audioPreview.removeAttribute("src"); audioPreview.hidden = true;
      imagePreview.hidden = false; imageName.textContent = "";
      imageDraft.hidden = true; fileInput.value = "";
      if (typeof updateLinks === "function") updateLinks();
    }
    function showPendingImage(file) {
      clearPendingImage();
      pendingImage = file;
      imageName.textContent = file.name || "সংযুক্ত ফাইল";
      pendingImageUrl = global.URL.createObjectURL(file);
      if (file.type.indexOf("image/") === 0) imagePreview.src = pendingImageUrl;
      else if (file.type.indexOf("audio/") === 0) { imagePreview.hidden = true; audioPreview.hidden = false; audioPreview.src = pendingImageUrl; }
      else imagePreview.hidden = true;
      imageDraft.hidden = false;
      if (typeof updateLinks === "function") updateLinks();
    }
    var attachmentTypes = {
      "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif",
      "audio/webm":"webm", "audio/ogg":"ogg", "audio/mp4":"m4a", "audio/mpeg":"mp3",
      "audio/wav":"wav", "audio/aac":"aac", "audio/3gpp":"3gp",
      "application/pdf":"pdf", "application/msword":"doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
      "application/vnd.ms-excel":"xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx",
      "text/csv":"csv", "text/plain":"txt"
    };
    function extFor(file) {
      var mime = String(file.type || "").toLowerCase();
      if (mime === "audio/x-m4a" || mime === "audio/m4a") mime = "audio/mp4";
      return attachmentTypes[mime] ? { mime: mime, ext: attachmentTypes[mime] } : null;
    }
    function stopRecordingStream() {
      if (recordingStream) recordingStream.getTracks().forEach(function (track) { track.stop(); });
      recordingStream = null;
    }
    var recordingTimer = 0;
    async function toggleVoiceRecording() {
      if (mediaRecorder && mediaRecorder.state === "recording") { mediaRecorder.stop(); return; }
      if (!global.MediaRecorder || !global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
        note.textContent = "এই ব্রাউজারে ভয়েস রেকর্ডিং সমর্থিত নয়। অডিও ফাইল বেছে নিতে পারেন।"; return;
      }
      try {
        recordingStream = await global.navigator.mediaDevices.getUserMedia({ audio: true });
        var mimeType = "";
        ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].some(function (type) {
          if (global.MediaRecorder.isTypeSupported(type)) { mimeType = type; return true; }
          return false;
        });
        mediaRecorder = new global.MediaRecorder(recordingStream, mimeType ? { mimeType: mimeType } : undefined);
        recordingChunks = [];
        mediaRecorder.ondataavailable = function (event) { if (event.data && event.data.size) recordingChunks.push(event.data); };
        mediaRecorder.onerror = function () { stopRecordingStream(); recordButton.classList.remove("is-recording"); recordButton.textContent = "🎙️"; note.textContent = "রেকর্ডিং ব্যর্থ হয়েছে। আবার চেষ্টা করুন।"; };
        mediaRecorder.onstop = function () {
          global.clearTimeout(recordingTimer); stopRecordingStream();
          recordButton.classList.remove("is-recording"); recordButton.textContent = "🎙️"; recordButton.title = "ভয়েস রেকর্ড শুরু করুন";
          if (!recordingChunks.length) return;
          var blob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || "audio/webm" });
          var normalized = blob.type.indexOf("audio/") === 0 ? blob.type.split(";")[0] : "audio/webm";
          if (normalized === "audio/x-m4a") normalized = "audio/mp4";
          var ext = attachmentTypes[normalized];
          if (!ext || blob.size > 10 * 1024 * 1024) { note.textContent = "রেকর্ডটি অনুমোদিত নয় বা ১০MB-এর বেশি।"; return; }
          var voiceFile = new File([blob], "voice-message." + ext, { type: normalized });
          showPendingImage(voiceFile);
          note.textContent = "ভয়েস রেকর্ড প্রস্তুত। শুনে নিয়ে পাঠান।";
        };
        mediaRecorder.start();
        recordButton.classList.add("is-recording"); recordButton.textContent = "■"; recordButton.title = "রেকর্ডিং বন্ধ করুন";
        note.textContent = "রেকর্ড হচ্ছে… শেষ হলে ■ চাপুন। সর্বোচ্চ ২ মিনিট।";
        recordingTimer = global.setTimeout(function () { if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); }, 120000);
      } catch (_) {
        stopRecordingStream();
        note.textContent = "মাইক্রোফোন ব্যবহারের অনুমতি দিন, অথবা অডিও ফাইল বেছে নিন।";
      }
    }
    removeImage.addEventListener("click", function () {
      clearPendingImage();
      note.textContent = "সংযুক্তিটি মেসেজ থেকে সরানো হয়েছে।";
      attach.focus();
    });
    function renderProductContext(product) {
      productContextCard.replaceChildren();
      productContextCard.hidden = !product;
      if (!product) return;
      if (product.image) {
        var image = doc.createElement("img"); image.src = product.image; image.alt = product.name; image.loading = "lazy";
        image.onerror = function () { image.style.display = "none"; };
        productContextCard.appendChild(image);
      }
      var copy = el("div", "ma-chat-product-copy");
      copy.appendChild(el("strong", "", product.name));
      var attrs = [product.variant, product.color, product.size, product.quantity ? "পরিমাণ: " + product.quantity : ""].filter(Boolean).join(" · ");
      if (attrs) copy.appendChild(el("small", "", attrs));
      copy.appendChild(el("b", "", "৳" + Number(product.price || 0).toLocaleString("en-US")));
      if (product.url) { var link = el("a", "ma-chat-product-link", "পণ্য দেখুন / অর্ডার করুন"); link.href = product.url; copy.appendChild(link); }
      productContextCard.appendChild(copy);
    }
    async function sendLiveMessage() {
      var messageText = String(input.value || "").trim();
      if (activeProductContext && !productContextSent) {
        var pc = activeProductContext;
        var details = ["পণ্য সম্পর্কে জানতে চাই:", "পণ্যের নাম: " + pc.name, "পণ্য ID: " + pc.id, "দাম: ৳" + pc.price,
          pc.quantity ? "পরিমাণ: " + pc.quantity : "", pc.size ? "সাইজ: " + pc.size : "", pc.color ? "রং: " + pc.color : "",
          pc.variant ? "ভ্যারিয়েন্ট: " + pc.variant : "", pc.image ? "পণ্যের ছবি: " + pc.image : "", pc.url ? "পণ্যের লিংক: " + pc.url : ""].filter(Boolean).join("\n");
        messageText = [messageText || "আসসালামু আলাইকুম! এই পণ্যটি সম্পর্কে জানতে চাই।", details].join("\n\n");
      }
      if (!messageText && !pendingImage) { input.focus(); return; }
      if (isSendingMessage) return;
      isSendingMessage = true;
      send.setAttribute("aria-disabled", "true");
      send.style.opacity = ".65";
      try {
        var state = await ensureLiveConversation();
        if (pendingImage) {
          if (!hasAttachmentColumn) throw new Error("Attachments unavailable");
          var file = pendingImage, fileInfo = extFor(file);
          if (!fileInfo) throw new Error("এই ফাইলের ধরন সমর্থিত নয়।");
          var rand = global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
          var path = state.id + "/" + rand + "." + fileInfo.ext;
          var upload = await state.client.storage.from("support-attachments").upload(path, file, { contentType: fileInfo.mime, upsert: false });
          if (upload.error) throw upload.error;
          var isImage = fileInfo.mime.indexOf("image/") === 0;
          var isAudio = fileInfo.mime.indexOf("audio/") === 0;
          var defaultText = isImage ? "📷 ছবি" : isAudio ? "🎙️ ভয়েস মেসেজ" : "📎 " + (file.name || "ফাইল");
          var withAttachment = await state.client.from("support_messages").insert({
            conversation_id: state.id, sender_id: currentUser.id, sender_role: "customer",
            body: messageText || defaultText, attachment_path: path, attachment_name: String(file.name || (isAudio ? "voice-message." + fileInfo.ext : "file." + fileInfo.ext)).slice(0,255), attachment_mime: fileInfo.mime
          }).select(messageColumns()).single();
          if (withAttachment.error) throw withAttachment.error;
          appendMessage(withAttachment.data);
          notifyTeam(state.client, withAttachment.data.id);
          clearPendingImage();
          input.value = ""; updateLinks();
          note.textContent = (isImage ? "ছবি" : isAudio ? "ভয়েস মেসেজ" : "ফাইল") + " পাঠানো হয়েছে ✓";
          return;
        }
        var inserted = await state.client.from("support_messages").insert({
          conversation_id: state.id,
          sender_id: currentUser.id,
          sender_role: "customer",
          body: messageText
        }).select("id,conversation_id,sender_id,sender_role,body,created_at,read_at").single();
        if (inserted.error) throw inserted.error;
        appendMessage(inserted.data);
        notifyTeam(state.client, inserted.data.id);
        if (activeProductContext) productContextSent = true;
        input.value = "";
        updateLinks();
        note.textContent = "মেসেজ পৌঁছেছে ✓ আমাদের টিম উত্তর দিলে এখানেই দেখবেন।";
      } catch (error) {
        note.textContent = "মেসেজ যায়নি। আবার চেষ্টা করুন, অথবা WhatsApp-এ লিখুন।";
      } finally {
        isSendingMessage = false;
        updateLinks();
        send.style.opacity = "";
      }
    }
    send.addEventListener("click", function (event) {
      if (send.getAttribute("aria-disabled") === "true" || isSendingMessage) {
        event.preventDefault();
        return;
      }
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
    clearLocalButton.addEventListener("click", function () {
      if (!transcript.querySelector(".ma-chat-message[data-message-id]")) return;
      requestLocalAction("এই ডিভাইসের চ্যাট পরিষ্কার করবেন?", "এই ব্রাউজারে দেখা মেসেজগুলো সরবে; সাপোর্ট টিমের কাছে সব কপি থাকবে।", "চ্যাট পরিষ্কার করুন", clearVisibleMessagesLocally);
    });
    contactPrompt.addEventListener("click", function () {
      contactPrompt.hidden = true;
      contactPrompt.setAttribute("aria-expanded", "true");
      contactForm.hidden = false;
      contactName.focus();
    });
    contactSkip.addEventListener("click", function () {
      try { global.localStorage.setItem(contactKey(), "skipped"); } catch (_) {}
      contactForm.hidden = true;
      contactPrompt.hidden = true;
      contactPrompt.setAttribute("aria-expanded", "false");
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
        contactPrompt.hidden = true;
        contactPrompt.setAttribute("aria-expanded", "false");
        note.textContent = "ধন্যবাদ! আপনার তথ্য সাপোর্ট টিম দেখতে পাবে।";
      } catch (_) {
        note.textContent = "তথ্য সেভ করা যায়নি। মেসেজে লিখে দিলেও চলবে।";
      } finally {
        contactSave.disabled = false;
      }
    });
    attach.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file || !liveEnabled) return;
      if (!extFor(file)) { fileInput.value = ""; note.textContent = "JPG/PNG/WEBP/GIF, PDF/Word/Excel/CSV/TXT বা MP3/WAV/OGG/WEBM অডিও দিন।"; return; }
      if (file.size > 10 * 1024 * 1024) { fileInput.value = ""; note.textContent = "ফাইলটি ১০MB-এর বেশি। ছোট ফাইল দিন।"; return; }
      showPendingImage(file);
      note.textContent = "ফাইলটি প্রিভিউ/শুনে নিন; × চাপলে সরবে। পাঠাতে পাঠান চাপুন।";
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        updateLinks();
        send.click();
      }
    });
    updateLinks();
    // Phone: keep the open chat exactly inside the visible area (the keyboard shrinks it).
    var phoneQuery = global.matchMedia ? global.matchMedia("(max-width:560px)") : null;
    var vv = global.visualViewport || null;
    function fitToScreen() {
      if (!doc.body.classList.contains("ma-chat-mobile-open")) return;
      var h = vv ? vv.height : global.innerHeight, top = vv ? vv.offsetTop : 0;
      panel.style.setProperty("--ma-chat-h", Math.round(h) + "px");
      panel.style.setProperty("--ma-chat-top", Math.round(top) + "px");
      doc.body.classList.toggle("ma-chat-kb", global.innerHeight - h > 120);
      body.scrollTop = body.scrollHeight;
    }
    if (vv) { vv.addEventListener("resize", fitToScreen, { passive: true }); vv.addEventListener("scroll", fitToScreen, { passive: true }); }
    global.addEventListener("resize", fitToScreen, { passive: true });
    if (phoneQuery && phoneQuery.addEventListener) phoneQuery.addEventListener("change", function () { setPhoneMode(panel.classList.contains("is-open")); });
    function setPhoneMode(open) {
      var on = !!(open && phoneQuery && phoneQuery.matches);
      doc.body.classList.toggle("ma-chat-mobile-open", on);
      if (on) fitToScreen();
      else { doc.body.classList.remove("ma-chat-kb"); panel.style.removeProperty("--ma-chat-h"); panel.style.removeProperty("--ma-chat-top"); }
    }

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      setPhoneMode(open);
      fab.setAttribute("aria-expanded", open ? "true" : "false");
      fab.setAttribute("aria-label", open ? "চ্যাট বন্ধ করুন" : "সাহায্যের জন্য চ্যাট খুলুন");
      var dot = fab.querySelector(".ma-chat-dot");
      if (dot) dot.style.display = open ? "none" : "";
      if (open) {
        updateLinks();
        if (liveEnabled) ensureLiveConversation().catch(function () {
          panel.classList.add("ma-chat-fallback"); note.textContent = "লাইভ চ্যাট সাময়িকভাবে বন্ধ। WhatsApp বা Messenger-এ লিখুন।";
        });
        if (!(phoneQuery && phoneQuery.matches)) global.setTimeout(function () { input.focus(); }, 60);
      } else {
        fab.focus();
      }
    }

    global.maOpenProductChat = function (product) {
      if (!product || !product.id || !product.name) return false;
      activeProductContext = {
        id: String(product.id).slice(0, 120), name: String(product.name).slice(0, 240),
        price: Math.max(0, Number(product.price) || 0), quantity: Math.max(1, Math.min(99, Number(product.quantity) || 1)),
        image: String(product.image || "").slice(0, 2000), size: String(product.size || "").slice(0, 120),
        color: String(product.color || "").slice(0, 120), variant: String(product.variant || "").slice(0, 160),
        url: String(product.url || "").slice(0, 2000)
      };
      productContextSent = false;
      renderProductContext(activeProductContext);
      input.value = "আসসালামু আলাইকুম! এই পণ্যটি সম্পর্কে জানতে চাই।";
      updateLinks(); setOpen(true);
      if (liveEnabled) ensureLiveConversation().catch(function () {
        panel.classList.add("ma-chat-fallback"); note.textContent = "লাইভ চ্যাট সাময়িকভাবে বন্ধ। WhatsApp বা Messenger-এ লিখুন।";
      });
      return true;
    };
    fab.addEventListener("click", function () { setOpen(!panel.classList.contains("is-open")); });
    close.addEventListener("click", function () { setOpen(false); });
    expand.addEventListener("click", function () {
      var expanded = panel.classList.toggle("is-expanded");
      expand.setAttribute("aria-label", expanded ? "চ্যাট ছোট করুন" : "চ্যাট বড় করুন");
    });
    doc.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && panel.classList.contains("is-open")) {
        if (localDeleteDialog.open) return;
        setOpen(false);
      }
    });
  }

  if (doc.body) build();
  else doc.addEventListener("DOMContentLoaded", build, { once: true });
})(window);
