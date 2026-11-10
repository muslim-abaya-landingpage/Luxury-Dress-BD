/* Live support inbox (website + Telegram). Supabase Auth + RLS; no secret keys in this file. */
(function () {
  "use strict";
  var config = (window.SITE_FOOTER_CONFIG || {}).supportChat || {};
  var BUCKET = "support-attachments";
  var PAGE = 100;
  var MAX_IMAGE = 10 * 1024 * 1024;
  var DEFAULT_CANNED = [
    "আসসালামু আলাইকুম! Muslim Abaya-তে যোগাযোগ করার জন্য ধন্যবাদ। কীভাবে সাহায্য করতে পারি?",
    "ঢাকার ভেতরে ডেলিভারি সাধারণত ১-২ দিন, ঢাকার বাইরে ২-৪ দিন লাগে।",
    "আপনার সাইজ জানাতে বডি লেংথ (কাঁধ থেকে পা পর্যন্ত) ও বুকের মাপ দিন, আমরা সঠিক সাইজ বলে দেব।",
    "অর্ডার নিশ্চিত করতে আপনার নাম, পূর্ণ ঠিকানা ও ফোন নম্বর দিন।",
    "আপনার অর্ডারের আইডি বা অর্ডারে ব্যবহৃত ফোন নম্বরটি দিন, স্ট্যাটাস দেখে জানাচ্ছি।",
    "পণ্যটি বর্তমানে স্টকে আছে।",
    "দুঃখিত, এই সাইজ/কালার এখন স্টকে নেই। বিকল্প দেখাতে পারি?",
    "ধন্যবাদ! আর কোনো প্রশ্ন থাকলে জানাবেন।"
  ];
  var PRODUCT_UNAVAILABLE_REPLY = "দুঃখিত, ছবির এই পণ্যটি বর্তমানে আমাদের কাছে নেই। এটি সংগ্রহ করে দেওয়ার ব্যবস্থাও আপাতত নেই।";
  var STATUS_BN = { open: "খোলা", pending: "অপেক্ষমাণ", closed: "বন্ধ" };
  var CHANNEL_BN = { website: "ওয়েবসাইট", telegram: "টেলিগ্রাম" };

  var client = null, agent = null, agentUserId = "", conversations = [], selectedId = "";
  var inboxChannel = null, typingChannel = null, typingTimer = null, lastTypingSent = 0;
  var soundEnabled = false, notificationAudio = null, notifiedMessageIds = Object.create(null);
  var previewCache = Object.create(null), threadRows = [], threadHasOlder = false, signedUrlCache = Object.create(null);
  var hasContactColumns = true, hasAttachmentColumn = true, refreshQueued = false, refreshRunning = false;
  var replyTarget = null, forwardSource = null, activeActionRow = null, actionMenuEl = null, actionTriggerEl = null;
  var actionReactionRows = [], starredMessageIds = Object.create(null), conversationPin = null, actionNoticeTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  var loginWrap = $("loginWrap"), inboxWrap = $("inboxWrap"), loginNotice = $("loginNotice");

  /* ---------- small helpers ---------- */
  function setNotice(text, success) { loginNotice.textContent = text || ""; loginNotice.className = "notice" + (success ? " success" : ""); }
  function setConnected(yes, text) { $("connectionDot").classList.toggle("on", !!yes); $("connectionText").textContent = text || (yes ? "সংযুক্ত" : "সংযুক্ত নয়"); }
  function formatTime(value) {
    if (!value) return "";
    var d = new Date(value);
    if (isNaN(d.getTime())) return "";
    var today = new Date();
    var sameDay = d.toDateString() === today.toDateString();
    return sameDay ? d.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleString("bn-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function make(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function setBtn(id, icon, label) { var b = $(id); b.querySelector(".ico").textContent = icon; b.querySelector(".lbl").textContent = label; b.title = label; }
  function pill(text, cls) { return make("span", "pill " + (cls || ""), text); }
  function isMissingColumn(error) { return !!error && (error.code === "42703" || error.code === "PGRST204" || /column .* does not exist/i.test(error.message || "")); }
  function requireClient() {
    if (!config.supabaseUrl || !config.supabaseKey) throw new Error("Supabase কনফিগারেশন পাওয়া যায়নি।");
    if (!window.supabase || !window.supabase.createClient) throw new Error("Supabase লাইব্রেরি লোড হয়নি।");
    if (!client) client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    return client;
  }
  function selectedRow() { return conversations.find(function (c) { return c.id === selectedId; }) || null; }
  function insertReplyDraft(text) {
    var input = $("replyInput");
    if (!input || input.disabled || !selectedId) return;
    input.value = input.value ? input.value.replace(/\s*$/, "\n") + text : text;
    autoGrow();
    input.focus();
  }
  function displayName(c) {
    if (!c) return "কথোপকথন";
    if (c.customer_name) return c.customer_name;
    if (c.channel === "telegram") return "টেলিগ্রাম কাস্টমার · " + String(c.telegram_chat_id || c.id).slice(-6);
    return "ভিজিটর · " + c.id.slice(0, 6);
  }

  function actionNotice(text) {
    var node = $("actionStatus");
    if (!node) return;
    node.textContent = text || "";
    clearTimeout(actionNoticeTimer);
    if (text) actionNoticeTimer = setTimeout(function () { node.textContent = ""; }, 5000);
  }
  function messageSummary(row) {
    if (!row) return "বার্তাটি আর পাওয়া যাচ্ছে না";
    if (row.deleted_at) return "এই মেসেজটি মুছে ফেলা হয়েছে।";
    var text = String(row.body || "").trim();
    if (!text && row.attachment_name) text = "📎 " + row.attachment_name;
    return text || "সংযুক্তি";
  }
  function closeActionMenu(restoreFocus) {
    if (actionMenuEl) actionMenuEl.remove();
    actionMenuEl = null; activeActionRow = null;
    var trigger = actionTriggerEl; actionTriggerEl = null;
    if (restoreFocus && trigger && document.contains(trigger)) trigger.focus();
  }
  var messageMenuIcons = {
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path>',
    reply: '<path d="m9 17-5-5 5-5"></path><path d="M4 12h9a7 7 0 0 1 7 7"></path>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path>',
    react: '<circle cx="12" cy="12" r="9"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><path d="M9 9h.01M15 9h.01"></path>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path><path d="M12 15V3"></path>',
    forward: '<path d="m15 17 5-5-5-5"></path><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path>',
    pin: '<path d="m16 3 5 5-4 1-4 4-1 5-2-2-2 2"></path><path d="m8 8 8 8"></path><path d="m5 21 6-6"></path>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3z"></path>',
    delete: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path>',
    back: '<path d="m9 17-5-5 5-5"></path><path d="M4 12h9a7 7 0 0 1 7 7"></path>'
  };
  function appendMenuButton(menu, label, action, disabled, icon) {
    var button = make("button", "message-menu-item", "");
    button.type = "button"; button.dataset.action = action;
    button.disabled = !!disabled;
    button.setAttribute("aria-label", label);
    var iconWrap = make("span", "message-menu-icon", "");
    iconWrap.setAttribute("aria-hidden", "true");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8"); svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = messageMenuIcons[icon] || messageMenuIcons.info;
    iconWrap.appendChild(svg);
    button.append(iconWrap, make("span", "message-menu-label", label));
    menu.appendChild(button);
    return button;
  }
  function appendMenuDivider(menu) {
    menu.appendChild(make("div", "message-menu-divider"));
  }
  function openActionMenu(row, x, y, trigger, view) {
    closeActionMenu(false);
    if (!row) return;
    activeActionRow = row; actionTriggerEl = trigger || null;
    var menu = make("div", "message-action-menu");
    menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "মেসেজ অপশন");
    if (view === "react") {
      var back = appendMenuButton(menu, "ফিরে যান", "back", false, "←");
      var title = make("div", "message-menu-heading", "রিঅ্যাকশন বেছে নিন");
      menu.insertBefore(title, back);
      ["👍", "❤️", "😂", "😮", "😢", "🙏"].forEach(function (emoji) {
        var b = make("button", "message-emoji-option", emoji); b.type = "button"; b.dataset.emoji = emoji;
        b.setAttribute("aria-label", emoji + " রিঅ্যাকশন"); menu.appendChild(b);
      });
    } else {
      appendMenuButton(menu, "Message info", "info", false, "info");
      if (row.deleted_at) {
        if (row.attachment_path) appendMenuButton(menu, "Retry attachment cleanup", "cleanup", false, "back");
      } else {
        appendMenuButton(menu, "Reply", "reply", !selectedId || (selectedRow() && selectedRow().status === "closed"), "reply");
        appendMenuButton(menu, "Copy", "copy", !String(row.body || "").trim(), "copy");
        appendMenuButton(menu, "React", "react", false, "react");
        if (row.attachment_path) appendMenuButton(menu, "Download", "download", false, "download");
        appendMenuButton(menu, "Forward", "forward", false, "forward");
        appendMenuButton(menu, conversationPin && conversationPin.message_id === row.id ? "Unpin" : "Pin", "pin", false, "pin");
        appendMenuButton(menu, starredMessageIds[row.id] ? "Unstar" : "Star", "star", false, "star");
        appendMenuDivider(menu);
        appendMenuButton(menu, "Delete", "delete", false, "delete");
      }
    }
    document.body.appendChild(menu); actionMenuEl = menu;
    menu.addEventListener("click", function (event) {
      var button = event.target.closest("button"); if (!button || button.disabled) return;
      if (button.dataset.emoji) { var current = activeActionRow; var emoji = button.dataset.emoji; closeActionMenu(false); toggleMessageReaction(current, emoji).catch(function (e) { actionNotice(e.message || "রিঅ্যাকশন সেভ করা যায়নি।"); }); return; }
      var action = button.dataset.action;
      if (action === "back") { openActionMenu(activeActionRow, x, y, trigger, "main"); return; }
      if (action === "react") { openActionMenu(activeActionRow, x, y, trigger, "react"); return; }
      var current = activeActionRow; closeActionMenu(false);
      handleMessageAction(current, action).catch(function (e) { actionNotice(e.message || "কাজটি সম্পন্ন করা যায়নি।"); });
    });
    var bounds = trigger ? trigger.getBoundingClientRect() : { left: x || 0, top: y || 0, bottom: y || 0, right: x || 0 };
    var left = Number.isFinite(x) && x > 0 ? x : bounds.right;
    var top = Number.isFinite(y) && y > 0 ? y : bounds.bottom;
    requestAnimationFrame(function () {
      var r = menu.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8)) + "px";
      menu.style.top = Math.max(8, Math.min(top, window.innerHeight - r.height - 8)) + "px";
      var first = menu.querySelector("button:not(:disabled)"); if (first) first.focus();
    });
  }
  document.addEventListener("pointerdown", function (event) {
    if (actionMenuEl && !actionMenuEl.contains(event.target) && !event.target.closest(".message-actions-trigger")) closeActionMenu(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && actionMenuEl) closeActionMenu(true);
  });
  $("messages").addEventListener("contextmenu", function (event) {
    var bubble = event.target.closest(".message[data-message-id]"); if (!bubble) return;
    var row = threadRows.find(function (m) { return m.id === bubble.dataset.messageId; });
    if (!row) return;
    event.preventDefault(); openActionMenu(row, event.clientX, event.clientY, null);
  });
  function clearReplyContext() {
    replyTarget = null;
    $("replyPreview").classList.add("hidden");
    $("replyPreviewText").textContent = "";
  }
  function beginReply(row) {
    if (!row || !selectedId || (selectedRow() && selectedRow().status === "closed")) return;
    replyTarget = row;
    $("replyPreviewText").textContent = messageSummary(row).slice(0, 220);
    $("replyPreview").classList.remove("hidden");
    $("replyInput").focus();
  }
  $("replyCancel").addEventListener("click", clearReplyContext);
  $("messageInfoClose").addEventListener("click", function () { $("messageInfoDialog").close(); });
  $("messageInfoDialog").addEventListener("click", function (event) { if (event.target === this) this.close(); });
  function showMessageInfo(row) {
    $("messageInfoTitle").textContent = "মেসেজের তথ্য";
    var content = $("messageInfoContent"); content.textContent = "";
    var sender = row.sender_role === "agent" ? (row.sender_external_id === "telegram-bot" ? "টেলিগ্রাম বট" : "সাপোর্ট এজেন্ট") : "কাস্টমার";
    var fields = [
      ["প্রেরক", sender], ["চ্যানেল", (selectedRow() && selectedRow().channel === "telegram") ? "টেলিগ্রাম" : "ওয়েবসাইট"],
      ["সময়", row.created_at ? new Date(row.created_at).toLocaleString("bn-BD") : "—"],
      ["ইনবক্সে পড়া", row.read_at ? "হ্যাঁ · " + new Date(row.read_at).toLocaleString("bn-BD") : "এখনো পড়া/চিহ্নিত হয়নি"],
      ["বার্তা ID", row.id], ["সংযুক্তি", row.attachment_name || "নেই"], ["অবস্থা", row.deleted_at ? "মুছে ফেলা হয়েছে" : "সক্রিয়"]
    ];
    fields.forEach(function (pair) { var line = make("div", "message-info-row"); line.append(make("strong", "", pair[0]), make("span", "", String(pair[1] || "—"))); content.appendChild(line); });
    $("messageInfoDialog").showModal();
  }
  async function loadMessageActions(id) {
    var ids = threadRows.map(function (row) { return row.id; });
    actionReactionRows = []; starredMessageIds = Object.create(null); conversationPin = null;
    if (!id || !ids.length || !agentUserId) { renderMessages(false); return; }
    var c = requireClient();
    var results = await Promise.all([
      c.from("support_message_reactions").select("message_id,actor_id,emoji").in("message_id", ids),
      c.from("support_message_stars").select("message_id").in("message_id", ids).eq("agent_id", agentUserId),
      c.from("support_conversation_pins").select("conversation_id,message_id,pinned_by,pinned_at").eq("conversation_id", id).maybeSingle()
    ]);
    if (id !== selectedId) return;
    if (results[0].error || results[1].error || results[2].error) throw (results.find(function (r) { return r.error; }) || {}).error || new Error("মেসেজ অ্যাকশন লোড হয়নি");
    actionReactionRows = results[0].data || [];
    (results[1].data || []).forEach(function (r) { starredMessageIds[r.message_id] = true; });
    conversationPin = results[2].data || null;
    renderMessages(false);
  }
  async function toggleMessageReaction(row, emoji) {
    if (!row || row.deleted_at) return;
    var c = requireClient();
    var existing = actionReactionRows.find(function (r) { return r.message_id === row.id && r.actor_id === agentUserId; });
    var result = existing && existing.emoji === emoji
      ? await c.from("support_message_reactions").delete().eq("message_id", row.id).eq("actor_id", agentUserId)
      : await c.from("support_message_reactions").upsert({ message_id: row.id, actor_id: agentUserId, emoji: emoji }, { onConflict: "message_id,actor_id" });
    if (result.error) throw result.error;
    await loadMessageActions(selectedId);
  }
  async function toggleStar(row) {
    if (starredMessageIds[row.id]) {
      var removed = await requireClient().from("support_message_stars").delete().eq("message_id", row.id).eq("agent_id", agentUserId);
      if (removed.error) throw removed.error;
    } else {
      var added = await requireClient().from("support_message_stars").insert({ message_id: row.id, agent_id: agentUserId });
      if (added.error) throw added.error;
    }
    await loadMessageActions(selectedId);
  }
  async function togglePin(row) {
    var c = requireClient();
    var result = conversationPin && conversationPin.message_id === row.id
      ? await c.from("support_conversation_pins").delete().eq("conversation_id", selectedId)
      : await c.from("support_conversation_pins").upsert({ conversation_id: selectedId, message_id: row.id, pinned_by: agentUserId, pinned_at: new Date().toISOString() }, { onConflict: "conversation_id" });
    if (result.error) throw result.error;
    await loadMessageActions(selectedId);
  }
  async function copyMessage(row) {
    var text = String(row.body || row.attachment_name || "");
    if (!text) throw new Error("কপি করার মতো লেখা নেই।");
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      var input = make("textarea"); input.value = text; input.style.position = "fixed"; input.style.opacity = "0"; document.body.appendChild(input); input.select();
      var ok = document.execCommand("copy"); input.remove(); if (!ok) throw new Error("কপি করা যায়নি; browser clipboard permission পরীক্ষা করুন।");
    }
    actionNotice("মেসেজের লেখা কপি হয়েছে।");
  }
  function safeFilename(value) { return String(value || "support-attachment").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 180) || "support-attachment"; }
  async function downloadAttachment(row) {
    if (!row.attachment_path) throw new Error("এই মেসেজে কোনো ফাইল নেই।");
    var url = await signedUrl(row.attachment_path); if (!url) throw new Error("ফাইলের নিরাপদ লিংক তৈরি হয়নি।");
    try {
      var response = await fetch(url); if (!response.ok) throw new Error("ফাইল ডাউনলোড হয়নি");
      var blobUrl = URL.createObjectURL(await response.blob());
      var a = make("a"); a.href = blobUrl; a.download = safeFilename(row.attachment_name); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 30000);
    } catch (_) {
      var fallback = make("a"); fallback.href = url; fallback.target = "_blank"; fallback.rel = "noopener"; fallback.download = safeFilename(row.attachment_name); document.body.appendChild(fallback); fallback.click(); fallback.remove();
    }
    actionNotice("ফাইল ডাউনলোড/খোলার জন্য পাঠানো হয়েছে।");
  }
  function openForwardDialog(row) {
    forwardSource = row;
    var select = $("forwardTarget"); select.textContent = "";
    var targets = conversations.filter(function (c) { return c.id !== row.conversation_id && c.status !== "closed"; });
    if (!targets.length) { forwardSource = null; actionNotice("ফরোয়ার্ড করার জন্য অন্য কোনো খোলা কথোপকথন নেই।"); return; }
    var placeholder = make("option", "", "কথোপকথন নির্বাচন করুন"); placeholder.value = ""; placeholder.disabled = true; placeholder.selected = true; select.appendChild(placeholder);
    targets.forEach(function (c) {
      var option = make("option", "", displayName(c) + " · " + (CHANNEL_BN[c.channel || "website"] || c.channel)); option.value = c.id;
      if (row.attachment_path && c.channel === "telegram") { option.disabled = true; option.textContent += " · ফাইল unsupported"; }
      select.appendChild(option);
    });
    $("forwardPreview").textContent = messageSummary(row).slice(0, 500);
    $("forwardNotice").textContent = row.attachment_path ? "ওয়েবসাইট চ্যাটে ফাইল কপি হবে; Telegram-এ ফাইল পাঠানো সমর্থিত নয়।" : "ফরোয়ার্ড করলে নির্বাচিত কথোপকথনে নতুন মেসেজ যাবে।";
    var submit = $("forwardConfirm"); submit.disabled = true;
    select.onchange = function () { var choice = select.options[select.selectedIndex]; submit.disabled = !select.value || !choice || choice.disabled; };
    $("forwardDialog").showModal();
  }
  async function forwardMessage(source, target) {
    var c = requireClient();
    var body = String(source.body || "").trim();
    if (!body) body = "📎 " + String(source.attachment_name || "সংযুক্ত ফাইল");
    if (target.channel === "telegram") {
      if (source.attachment_path) throw new Error("Telegram-এ ছবি/ফাইল forward করা এখনো সমর্থিত নয়; অন্য website chat বেছে নিন।");
      var forwardedText = ("↗ ফরওয়ার্ড করা মেসেজ:\n" + body).slice(0, 2000);
      var response = await c.functions.invoke("telegram-support/admin/reply", { body: { conversation_id: target.id, message: forwardedText } });
      if (response.error) throw new Error("Telegram-এ forward করা যায়নি।");
      return;
    }
    var newPath = "";
    if (source.attachment_path) {
      var downloaded = await c.storage.from(BUCKET).download(source.attachment_path);
      if (downloaded.error || !downloaded.data) throw downloaded.error || new Error("সংযুক্ত ফাইল পড়া যায়নি।");
      var extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "application/pdf": "pdf" })[source.attachment_mime] || "bin";
      var uid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
      newPath = target.id + "/" + uid + "." + extension;
      var uploaded = await c.storage.from(BUCKET).upload(newPath, downloaded.data, { contentType: source.attachment_mime || "application/octet-stream", upsert: false });
      if (uploaded.error) throw uploaded.error;
    }
    var insert = { conversation_id: target.id, sender_id: agentUserId, sender_role: "agent", body: body.slice(0, 2000), forwarded_from_message_id: source.id };
    if (newPath) { insert.attachment_path = newPath; insert.attachment_name = source.attachment_name; insert.attachment_mime = source.attachment_mime; }
    var saved = await c.from("support_messages").insert(insert).select(messageColumns()).single();
    if (saved.error) {
      if (newPath) await c.storage.from(BUCKET).remove([newPath]);
      throw saved.error;
    }
    refreshConversations();
  }
  async function cleanupDeletedAttachment(row) {
    if (!row || !row.deleted_at || !row.attachment_path) return;
    var result = await requireClient().storage.from(BUCKET).remove([row.attachment_path]);
    if (result.error) throw result.error;
    var finalized = await requireClient().rpc("support_agent_finalize_message_delete", { p_message_id: row.id });
    if (finalized.error) throw finalized.error;
    row.attachment_path = null; row.attachment_name = null; row.attachment_mime = null;
    renderMessages(false); actionNotice("মেসেজটি মুছে ফেলা হয়েছে এবং সংযুক্তি পরিষ্কার হয়েছে।");
  }
  async function deleteMessage(row) {
    if (!row || row.deleted_at) return;
    var confirmText = "এই মেসেজটি সাপোর্ট ইনবক্সে ‘মুছে ফেলা হয়েছে’ হিসেবে দেখানো হবে। গ্রাহকও এই অবস্থাটি দেখবেন।";
    if (row.attachment_path) confirmText += " সংযুক্তি ফাইলটিও পরিষ্কার করা হবে।";
    if (selectedRow() && selectedRow().channel === "telegram") confirmText += " Telegram অ্যাপের আসল মেসেজ অক্ষত থাকবে।";
    if (!window.confirm(confirmText + " চালিয়ে যাবেন?")) return;
    var result = await requireClient().rpc("support_agent_mark_message_deleted", { p_message_id: row.id });
    if (result.error) throw result.error;
    row.deleted_at = new Date().toISOString(); row.body = "এই মেসেজটি মুছে ফেলা হয়েছে।";
    await loadMessageActions(selectedId);
    if (row.attachment_path) {
      try { await cleanupDeletedAttachment(row); }
      catch (_) { actionNotice("মেসেজটি মুছে গেছে, কিন্তু সংযুক্তি পরিষ্কার হয়নি। মেনু থেকে আবার চেষ্টা করুন।"); }
    } else { renderMessages(false); actionNotice("মেসেজটি মুছে ফেলা হয়েছে।"); }
  }
  async function handleMessageAction(row, action) {
    if (!row) return;
    if (action === "info") { showMessageInfo(row); return; }
    if (action === "reply") { beginReply(row); return; }
    if (action === "copy") { await copyMessage(row); return; }
    if (action === "download") { await downloadAttachment(row); return; }
    if (action === "forward") { openForwardDialog(row); return; }
    if (action === "pin") { await togglePin(row); actionNotice(conversationPin && conversationPin.message_id === row.id ? "মেসেজটি pin হয়েছে।" : "মেসেজটি unpin হয়েছে।"); return; }
    if (action === "star") { await toggleStar(row); actionNotice(starredMessageIds[row.id] ? "মেসেজটি star করা হয়েছে।" : "Star সরানো হয়েছে।"); return; }
    if (action === "delete") { await deleteMessage(row); return; }
    if (action === "cleanup") { await cleanupDeletedAttachment(row); return; }
  }
  $("forwardCancel").addEventListener("click", function () { $("forwardDialog").close(); forwardSource = null; });
  $("forwardCancelBottom").addEventListener("click", function () { $("forwardDialog").close(); forwardSource = null; });
  $("forwardDialog").addEventListener("click", function (event) { if (event.target === this) { this.close(); forwardSource = null; } });
  $("forwardDialog").addEventListener("close", function () { forwardSource = null; });
  $("forwardConfirm").addEventListener("click", async function () {
    if (!forwardSource) return;
    var target = conversations.find(function (c) { return c.id === $("forwardTarget").value; });
    if (!target || target.status === "closed" || (forwardSource.attachment_path && target.channel === "telegram")) { actionNotice("সমর্থিত খোলা কথোপকথন বেছে নিন।"); return; }
    this.disabled = true;
    try { await forwardMessage(forwardSource, target); $("forwardDialog").close(); forwardSource = null; actionNotice("মেসেজটি " + displayName(target) + " কথোপকথনে forward হয়েছে।"); }
    catch (e) { actionNotice(e.message || "ফরোয়ার্ড করা যায়নি।"); }
    finally { this.disabled = false; }
  });

  /* ---------- admin menu (mobile) ---------- */
  function setMenu(open) { document.body.classList.toggle("menu-open", open); $("menuBtn").setAttribute("aria-expanded", open ? "true" : "false"); }
  $("menuBtn").addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
  $("sideBackdrop").addEventListener("click", function () { setMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  /* ---------- views ---------- */
  function displayLogin() {
    loginWrap.classList.remove("hidden"); inboxWrap.classList.add("hidden");
    ["logoutBtn", "browserAlertBtn", "soundAlertBtn"].forEach(function (id) { $(id).classList.add("hidden"); });
  }
  function displayInbox() {
    loginWrap.classList.add("hidden"); inboxWrap.classList.remove("hidden");
    ["logoutBtn", "browserAlertBtn", "soundAlertBtn"].forEach(function (id) { $(id).classList.remove("hidden"); });
    $("agentLabel").textContent = agent ? agent.display_name + " · " + agent.email : "";
    if ("Notification" in window && Notification.permission === "granted") setBtn("browserAlertBtn", "🔔", "অ্যালার্ট চালু আছে");
  }
  function showThreadOnMobile(show) { $("workspace").classList.toggle("show-thread", !!show); }
  $("backBtn").addEventListener("click", function () { showThreadOnMobile(false); });

  async function checkAgent(user) {
    var c = requireClient();
    if (!user || !user.email) return null;
    var result = await c.from("support_agents").select("email,display_name,active").eq("email", user.email.toLowerCase()).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || !result.data.active) return null;
    return result.data;
  }

  /* ---------- alerts ---------- */
  function playIncomingTone() {
    if (!soundEnabled) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      if (!notificationAudio) notificationAudio = new Ctx();
      var ctx = notificationAudio;
      var beep = function () { var osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = "sine"; osc.frequency.value = 880; gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + .025); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .32); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .34); };
      if (ctx.state === "suspended") ctx.resume().then(beep).catch(function () {}); else beep();
    } catch (_) {}
  }
  function notifyIncomingMessage(row) {
    if (!row || row.sender_role !== "customer" || !row.id || notifiedMessageIds[row.id]) return;
    notifiedMessageIds[row.id] = true;
    playIncomingTone();
    var conv = conversations.find(function (c) { return c.id === row.conversation_id; });
    document.title = "(নতুন মেসেজ) লাইভ সাপোর্ট ইনবক্স";
    if (document.visibilityState === "visible" || !("Notification" in window) || Notification.permission !== "granted") return;
    var notice = new Notification("নতুন কাস্টমার মেসেজ · Muslim Abaya", { body: (conv ? displayName(conv) + ": " : "") + String(row.body || "").slice(0, 120), tag: "support-" + row.conversation_id });
    notice.onclick = function () { window.focus(); notice.close(); selectConversation(row.conversation_id); };
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") document.title = "লাইভ সাপোর্ট ইনবক্স | Muslim Abaya Admin"; });

  /* ---------- conversation list ---------- */
  function renderConversations() {
    var list = $("conversationList"); list.textContent = "";
    var query = $("searchInput").value.trim().toLowerCase();
    var status = $("statusFilter").value, channel = $("channelFilter").value, owner = $("ownerFilter").value;
    var showEmpty = $("showEmptyToggle").checked;
    var emptyTotal = conversations.filter(function (c) { return c.is_empty; }).length;
    $("emptyCount").textContent = emptyTotal ? "(" + emptyTotal.toLocaleString("bn-BD") + ")" : "";
    var rows = conversations.filter(function (c) {
      if (!showEmpty && c.is_empty && c.id !== selectedId) return false;
      if (status === "active" ? c.status === "closed" : (status !== "all" && c.status !== status)) return false;
      if (channel !== "all" && (c.channel || "website") !== channel) return false;
      if (owner === "mine" && c.assigned_agent_email !== (agent && agent.email)) return false;
      if (owner === "unassigned" && c.assigned_agent_email) return false;
      if (owner === "unread" && !c.unread_count) return false;
      if (query) {
        var hay = [c.id, c.page_path, c.last_body, c.customer_name, c.customer_phone, c.telegram_chat_id].join(" ").toLowerCase();
        if (hay.indexOf(query) < 0) return false;
      }
      return true;
    });
    $("conversationCount").textContent = rows.length.toLocaleString("bn-BD");
    if (!rows.length) {
      list.appendChild(make("div", "empty-list", conversations.length ? "এই ফিল্টারে কোনো চ্যাট নেই।" : "এখনো কোনো কথোপকথন নেই। নতুন চ্যাট এলে এখানে দেখাবে।"));
      return;
    }
    rows.forEach(function (c) {
      var button = make("button", "conversation" + (c.id === selectedId ? " selected" : "") + (c.unread_count ? " has-unread" : ""));
      button.type = "button";
      var avatar = make("span", "conv-avatar", (displayName(c).trim().charAt(0) || "M").toLocaleUpperCase("bn-BD"));
      avatar.setAttribute("aria-hidden", "true");
      var content = make("span", "conversation-content");
      var top = make("span", "conv-top");
      var name = make("span", "conv-name", displayName(c));
      if (c.unread_count) { var badge = make("span", "unread-badge", c.unread_count.toLocaleString("bn-BD")); badge.setAttribute("aria-label", c.unread_count + " টি না-পড়া"); name.appendChild(badge); }
      top.append(name, make("span", "conv-time", formatTime(c.last_message_at)));
      var preview = make("span", "conv-preview", c.last_body || (c.is_empty ? "এখনো কোনো মেসেজ নেই" : (c.customer_phone || c.page_path)) || "নতুন কথোপকথন");
      var foot = make("span", "conv-foot");
      var left = make("span", "foot-left");
      left.append(pill(CHANNEL_BN[c.channel || "website"] || c.channel, "ch-" + (c.channel || "website")), pill(STATUS_BN[c.status] || c.status, "status-" + c.status));
      var who = make("span", "assignee", c.assigned_agent_email ? (agent && c.assigned_agent_email === agent.email ? "আমার" : c.assigned_agent_email.split("@")[0]) : "");
      foot.append(left, who);
      content.append(top, preview, foot);
      button.append(avatar, content);
      button.addEventListener("click", function () { selectConversation(c.id); });
      list.appendChild(button);
    });
  }

  async function fetchConversations(c) {
    var base = "id,status,channel,telegram_chat_id,page_path,assigned_agent_email,created_at,updated_at,last_message_at";
    var result = hasContactColumns
      ? await c.from("support_conversations").select(base + ",customer_name,customer_phone").order("last_message_at", { ascending: false }).limit(PAGE)
      : null;
    if (!result || isMissingColumn(result.error)) {
      hasContactColumns = false;
      result = await c.from("support_conversations").select(base).order("last_message_at", { ascending: false }).limit(PAGE);
    }
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function refreshConversationsNow() {
    if (!agent) return;
    var c = requireClient();
    var rows = await fetchConversations(c);
    var ids = rows.map(function (r) { return r.id; });
    if (ids.length) {
      // Previews: reuse a cached latest message while last_message_at is unchanged; fetch only stale ones.
      var stale = rows.filter(function (r) { var hit = previewCache[r.id]; return !hit || hit.at !== r.last_message_at; });
      if (stale.length) {
        var staleIds = stale.map(function (r) { return r.id; });
        var batch = await c.from("support_messages").select("conversation_id,body,sender_role,sender_external_id,created_at")
          .in("conversation_id", staleIds).order("created_at", { ascending: false }).limit(Math.min(1000, staleIds.length * 25));
        var found = {};
        if (!batch.error) (batch.data || []).forEach(function (m) { if (!found[m.conversation_id]) found[m.conversation_id] = m; });
        var missing = batch.error ? [] : stale.filter(function (r) { return !found[r.id]; });
        await Promise.all(missing.map(async function (r) {
          var one = await c.from("support_messages").select("conversation_id,body,sender_role,sender_external_id,created_at").eq("conversation_id", r.id).order("created_at", { ascending: false }).limit(1);
          if (!one.error) found[r.id] = (one.data && one.data[0]) || null;
        }));
        stale.forEach(function (r) { if (Object.prototype.hasOwnProperty.call(found, r.id)) previewCache[r.id] = { at: r.last_message_at, msg: found[r.id] }; });
      }
      var unread = await c.from("support_messages").select("conversation_id").in("conversation_id", ids).eq("sender_role", "customer").is("read_at", null).limit(1000);
      var unreadCounts = {};
      if (!unread.error) (unread.data || []).forEach(function (m) { unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1; });
      rows.forEach(function (r) {
        var hit = previewCache[r.id], m = hit && hit.msg;
        r.is_empty = !!hit && !m;
        r.unread_count = r.id === selectedId && document.visibilityState === "visible" ? 0 : (unreadCounts[r.id] || 0);
        if (m) { r.last_body = (m.sender_role === "agent" ? (m.sender_external_id === "telegram-bot" ? "বট: " : "আপনি: ") : "") + m.body; r.last_message_at = m.created_at; }
      });
    }
    conversations = rows;
    renderConversations();
    if (selectedId) updateThreadHeader();
  }
  // Realtime can fire many events at once; coalesce them into one refresh at a time.
  function refreshConversations() {
    if (refreshRunning) { refreshQueued = true; return Promise.resolve(); }
    refreshRunning = true;
    return refreshConversationsNow().catch(function () {}).finally(function () {
      refreshRunning = false;
      if (refreshQueued) { refreshQueued = false; refreshConversations(); }
    });
  }

  /* ---------- thread ---------- */
  function updateThreadHeader() {
    var row = selectedRow();
    var title = $("threadTitle"); title.textContent = "";
    if (!row) { title.textContent = "একটি কথোপকথন বেছে নিন"; return; }
    title.append(document.createTextNode(displayName(row) + " "), pill(CHANNEL_BN[row.channel || "website"] || row.channel, "ch-" + (row.channel || "website")));
    var assigned = row.assigned_agent_email;
    var parts = [];
    if (row.customer_phone) parts.push("📞 " + row.customer_phone);
    parts.push("শুরু " + formatTime(row.created_at));
    if (row.channel !== "telegram") parts.push("পেজ " + (row.page_path || "/"));
    else if (row.telegram_chat_id) parts.push("টেলিগ্রাম আইডি " + row.telegram_chat_id);
    parts.push(assigned ? "দায়িত্বে: " + (agent && assigned === agent.email ? "আপনি" : assigned) : "কারো দায়িত্বে নেই");
    $("threadMeta").textContent = parts.join(" · ");
    $("threadStatus").value = row.status;
    var mine = !!(agent && assigned === agent.email);
    $("assignBtn").textContent = mine ? "আমার দায়িত্বে" : "আমাকে দিন";
    $("assignBtn").disabled = mine;
    $("contactBtn").disabled = !hasContactColumns;
    $("contactBtn").title = hasContactColumns ? "কাস্টমারের নাম/ফোন সংশোধন করুন" : "ডাটাবেস আপডেট (মাইগ্রেশন) এখনো প্রয়োগ হয়নি";
    var orderBtn = $("orderBtn");
    var q = row.customer_phone || "";
    orderBtn.href = "/admin-orders.html" + (q ? "?q=" + encodeURIComponent(q.replace(/[^\d+]/g, "")) : "");
    orderBtn.classList.remove("hidden");
    var telegram = row.channel === "telegram";
    $("attachBtn").disabled = telegram || !hasAttachmentColumn || row.status === "closed";
    $("attachBtn").title = telegram ? "টেলিগ্রামে ছবি পাঠানো এখনো সমর্থিত নয়" : "ছবি পাঠান (সর্বোচ্চ ৫MB)";
    var closed = row.status === "closed";
    $("replyInput").disabled = closed; $("sendBtn").disabled = closed;
    $("replyInput").placeholder = closed ? "কথোপকথনটি বন্ধ। উত্তর দিতে স্ট্যাটাস খোলা করুন।" : "উত্তর লিখুন…";
  }

  async function signedUrl(path) {
    if (signedUrlCache[path] && signedUrlCache[path].exp > Date.now()) return signedUrlCache[path].url;
    var res = await requireClient().storage.from(BUCKET).createSignedUrl(path, 3600);
    if (res.error || !res.data) return "";
    signedUrlCache[path] = { url: res.data.signedUrl, exp: Date.now() + 50 * 60 * 1000 };
    return res.data.signedUrl;
  }

  function renderMessages(stickToBottom) {
    if (actionMenuEl) closeActionMenu(false);
    var box = $("messages");
    var prevHeight = box.scrollHeight, prevTop = box.scrollTop;
    box.textContent = "";
    if (threadHasOlder) {
      var older = make("button", "older-btn", "পুরোনো মেসেজ দেখুন");
      older.type = "button"; older.addEventListener("click", loadOlder); box.appendChild(older);
    }
    if (!threadRows.length) {
      var welcome = make("div", "welcome-thread"); welcome.append(make("strong", "", "কথোপকথন শুরু হয়েছে"), document.createTextNode("এখনো কোনো মেসেজ নেই। উত্তর লিখে শুরু করুন."));
      box.appendChild(welcome); return;
    }
    threadRows.forEach(function (row) {
      var bot = row.sender_role === "agent" && row.sender_external_id === "telegram-bot";
      var bubble = make("div", "message " + (row.sender_role === "agent" ? "agent" : "customer") + (bot ? " bot" : "") + (row.deleted_at ? " deleted-message" : ""));
      bubble.dataset.messageId = row.id;
      var trigger = make("button", "message-actions-trigger", "⋮"); trigger.type = "button"; trigger.setAttribute("aria-label", "মেসেজ অপশন"); trigger.setAttribute("aria-haspopup", "dialog");
      trigger.addEventListener("click", function (event) { event.stopPropagation(); var r = trigger.getBoundingClientRect(); openActionMenu(row, r.right, r.bottom, trigger); });
      bubble.appendChild(trigger);
      var label = bot ? "টেলিগ্রাম বট" : row.sender_role === "agent" ? "সাপোর্ট এজেন্ট" : "কাস্টমার";
      bubble.appendChild(make("div", "message-label", label));
      if (row.forwarded_from_message_id || String(row.body || "").indexOf("↗ ফরওয়ার্ড করা মেসেজ:") === 0) bubble.appendChild(make("div", "forwarded-label", "↗ ফরোয়ার্ড করা"));
      if (row.reply_to_message_id) {
        var quoted = threadRows.find(function (m) { return m.id === row.reply_to_message_id; });
        var quote = make("div", "message-reply-quote"); quote.append(make("strong", "", "↩ উত্তর"), make("span", "", messageSummary(quoted).slice(0, 180))); bubble.appendChild(quote);
      }
      bubble.appendChild(make("div", "message-body", row.deleted_at ? "এই মেসেজটি মুছে ফেলা হয়েছে।" : row.body));
      if (row.attachment_path && !row.deleted_at) {
        var mime = String(row.attachment_mime || ""); var fileName = String(row.attachment_name || "সংযুক্ত ফাইল");
        var isCustomerImage = row.sender_role === "customer" && (mime.indexOf("image/") === 0 || !mime); var media;
        if (mime.indexOf("image/") === 0 || !mime) { media = make("img"); media.alt = fileName; media.loading = "lazy"; }
        else if (mime.indexOf("audio/") === 0) { media = document.createElement("audio"); media.controls = true; media.preload = "metadata"; }
        else { media = make("a", "file-attachment", "📄 " + fileName); media.target = "_blank"; media.rel = "noopener"; media.download = safeFilename(fileName); }
        if (isCustomerImage) {
          media.classList.add("image-reply-target"); media.title = "ছবিতে ক্লিক করে ‘এই পণ্যটি নেই’ উত্তরটি তৈরি করুন";
          media.addEventListener("click", function (event) { event.preventDefault(); if (selectedId === row.conversation_id) insertReplyDraft(PRODUCT_UNAVAILABLE_REPLY); });
        }
        signedUrl(row.attachment_path).then(function (url) {
          if (!url) { media.replaceWith(make("div", "message-label", "ফাইল লোড করা যায়নি")); return; }
          var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
          media.onload = function () { if (nearBottom) box.scrollTop = box.scrollHeight; };
          if (media.tagName === "A") media.href = url;
          else media.src = url;
          if (media.tagName === "IMG") { var link = make("a"); link.href = url; link.target = "_blank"; link.rel = "noopener"; media.replaceWith(link); link.appendChild(media); }
        });
        bubble.appendChild(media);
        if (isCustomerImage) {
          var unavailableButton = make("button", "image-reply-shortcut", "এই পণ্যটি নেই"); unavailableButton.type = "button";
          unavailableButton.title = "উত্তরটি লেখার ঘরে বসবে; পাঠানোর আগে দেখে নিন";
          unavailableButton.disabled = row.conversation_id !== selectedId || (selectedRow() && selectedRow().status === "closed");
          unavailableButton.addEventListener("click", function () { if (selectedId === row.conversation_id) insertReplyDraft(PRODUCT_UNAVAILABLE_REPLY); });
          bubble.appendChild(unavailableButton);
        }
      }
      var rowReactions = actionReactionRows.filter(function (r) { return r.message_id === row.id; });
      var grouped = Object.create(null); rowReactions.forEach(function (r) { if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false }; grouped[r.emoji].count++; if (r.actor_id === agentUserId) grouped[r.emoji].mine = true; });
      var reactionBar = make("div", "message-reactions");
      Object.keys(grouped).forEach(function (emoji) { var chip = make("button", "message-reaction" + (grouped[emoji].mine ? " mine" : ""), emoji + " " + grouped[emoji].count); chip.type = "button"; chip.title = "রিঅ্যাকশন পরিবর্তন করতে ক্লিক করুন"; chip.addEventListener("click", function () { toggleMessageReaction(row, emoji).catch(function (e) { actionNotice(e.message || "রিঅ্যাকশন সেভ করা যায়নি।"); }); }); reactionBar.appendChild(chip); });
      if (grouped && Object.keys(grouped).length) bubble.appendChild(reactionBar);
      if (starredMessageIds[row.id]) bubble.appendChild(make("span", "message-starred", "★ Star"));
      if (conversationPin && conversationPin.message_id === row.id) bubble.appendChild(make("span", "message-pinned", "⌖ Pinned"));
      var time = make("time", "", formatTime(row.created_at)); time.dateTime = row.created_at || ""; bubble.appendChild(time);
      // read_at is written by the recipient: customer reads agent messages, agent reads customer messages.
      if (row.sender_role === "agent" && row.sender_external_id !== "telegram-bot") {
        var receipt = make("div", "message-receipt" + (row.read_at ? " is-seen" : ""), "");
        receipt.append(make("span", "receipt-check", row.read_at ? "✓✓" : "✓"), document.createTextNode(row.read_at ? " Seen" : " Sent"));
        if (row.read_at) receipt.title = "কাস্টমার " + new Date(row.read_at).toLocaleString("bn-BD") + " সময়ে মেসেজটি দেখেছেন";
        bubble.appendChild(receipt);
      }
      box.appendChild(bubble);
    });
    if (stickToBottom) box.scrollTop = box.scrollHeight;
    else box.scrollTop = box.scrollHeight - prevHeight + prevTop;
  }

  function messageColumns() { return "id,conversation_id,sender_id,sender_role,sender_external_id,body,created_at,read_at,reply_to_message_id,forwarded_from_message_id,deleted_at" + (hasAttachmentColumn ? ",attachment_path,attachment_name,attachment_mime" : ""); }
  async function queryMessages(id, before) {
    var c = requireClient();
    var build = function () {
      var q = c.from("support_messages").select(messageColumns()).eq("conversation_id", id).order("created_at", { ascending: false }).limit(PAGE + 1);
      if (before) q = q.lt("created_at", before);
      return q;
    };
    var result = await build();
    if (isMissingColumn(result.error) && hasAttachmentColumn) { hasAttachmentColumn = false; result = await build(); }
    if (result.error) throw result.error;
    var rows = result.data || [];
    var more = rows.length > PAGE;
    return { rows: rows.slice(0, PAGE).reverse(), more: more };
  }
  async function loadThread(id) {
    var page = await queryMessages(id);
    if (id !== selectedId) return;
    threadRows = page.rows; threadHasOlder = page.more;
    actionReactionRows = []; starredMessageIds = Object.create(null); conversationPin = null;
    renderMessages(true);
    loadMessageActions(id).catch(function () { actionNotice("মেসেজ অ্যাকশন লোড করা যায়নি।"); });
    if (document.visibilityState === "visible") {
      await requireClient().from("support_messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", id).eq("sender_role", "customer").is("read_at", null);
    }
    await loadEvents(id);
  }
  async function loadOlder() {
    if (!selectedId || !threadRows.length) return;
    var id = selectedId;
    var page = await queryMessages(id, threadRows[0].created_at);
    if (id !== selectedId) return;
    threadRows = page.rows.concat(threadRows); threadHasOlder = page.more;
    renderMessages(false);
  }
  async function loadEvents(id) {
    var result = await requireClient().from("support_events").select("event_type,action_key,created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(12);
    var container = $("events"); container.textContent = "";
    if (result.error || !result.data || !result.data.length) { container.appendChild(make("span", "", "কোনো কুইক-অ্যাকশন নেই।")); return; }
    container.appendChild(make("span", "", "কুইক-অ্যাকশন:"));
    result.data.forEach(function (e) { container.appendChild(make("span", "event-chip", String(e.action_key || e.event_type).replace(/_/g, " ") + " · " + formatTime(e.created_at))); });
  }

  /* ---------- typing indicator (Realtime broadcast, website chats only) ---------- */
  function subscribeTyping(id) {
    var c = requireClient();
    if (typingChannel) { c.removeChannel(typingChannel); typingChannel = null; }
    $("typingLine").textContent = "";
    var row = selectedRow();
    if (!row || row.channel === "telegram") return;
    typingChannel = c.channel("support-typing-" + id, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, function (msg) {
        if (!msg || !msg.payload || msg.payload.role !== "customer" || id !== selectedId) return;
        $("typingLine").textContent = "কাস্টমার লিখছেন…";
        clearTimeout(typingTimer);
        typingTimer = setTimeout(function () { $("typingLine").textContent = ""; }, 4000);
      })
      .subscribe();
  }
  function sendTyping() {
    if (!typingChannel || Date.now() - lastTypingSent < 2500) return;
    lastTypingSent = Date.now();
    typingChannel.send({ type: "broadcast", event: "typing", payload: { role: "agent" } }).catch(function () {});
  }

  async function selectConversation(id) {
    closeActionMenu(false); clearReplyContext();
    selectedId = id;
    var row = selectedRow();
    if (row) row.unread_count = 0;
    $("threadStatus").disabled = false;
    $("assignBtn").disabled = false;
    updateThreadHeader();
    renderConversations();
    showThreadOnMobile(true);
    subscribeTyping(id);
    threadRows = []; threadHasOlder = false;
    $("messages").textContent = "লোড হচ্ছে…";
    try { await loadThread(id); }
    catch (_) { $("messages").textContent = "এই কথোপকথন লোড করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।"; }
    if (!$("replyInput").disabled && window.matchMedia("(min-width: 761px)").matches) $("replyInput").focus();
  }

  /* ---------- realtime ---------- */
  async function openInbox(user) {
    agentUserId = user && user.id || "";
    agent = await checkAgent(user);
    if (!agent) { await requireClient().auth.signOut(); displayLogin(); setNotice("এই ইমেইলটি সাপোর্ট-এজেন্ট তালিকায় নেই। মালিককে অনুমোদন দিতে বলুন।"); return; }
    displayInbox();
    setConnected(true, "সংযুক্ত");
    await refreshConversations();
    var c = requireClient();
    if (inboxChannel) await c.removeChannel(inboxChannel);
    inboxChannel = c.channel("support-agent-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, function () { refreshConversations(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, function (payload) {
        var row = payload.new || payload.old;
        if (payload.eventType === "INSERT" && row) {
          notifyIncomingMessage(row);
          if (row.conversation_id === selectedId && !threadRows.some(function (m) { return m.id === row.id; })) {
            threadRows.push(row); renderMessages(true); loadMessageActions(selectedId).catch(function () {});
            if (row.sender_role === "customer") { $("typingLine").textContent = ""; if (document.visibilityState === "visible") requireClient().from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", row.id).then(function () {}, function () {}); }
          }
        } else if (payload.eventType === "UPDATE" && row && row.conversation_id === selectedId) {
          var i = threadRows.findIndex(function (m) { return m.id === row.id; }); if (i >= 0) threadRows[i] = row;
          if (row.deleted_at) delete previewCache[row.conversation_id];
          renderMessages(false);
          if (row.deleted_at && i >= 0) loadMessageActions(selectedId).catch(function () {});
        } else if (payload.eventType === "DELETE" && row && row.conversation_id === selectedId) {
          threadRows = threadRows.filter(function (m) { return m.id !== row.id; }); renderMessages(false); loadMessageActions(selectedId).catch(function () {});
        }
        refreshConversations();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_message_reactions" }, function () { if (selectedId) loadMessageActions(selectedId).catch(function () {}); })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_message_stars" }, function () { if (selectedId) loadMessageActions(selectedId).catch(function () {}); })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversation_pins" }, function () { if (selectedId) loadMessageActions(selectedId).catch(function () {}); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_events" }, function (payload) { if (payload.new && payload.new.conversation_id === selectedId) loadEvents(selectedId).catch(function () {}); })
      .subscribe(function (status) { setConnected(status === "SUBSCRIBED", status === "SUBSCRIBED" ? "লাইভ" : "সংযোগ হচ্ছে…"); });
  }

  /* ---------- sending ---------- */
  async function sendReply(body, attachmentPath, replyingTo) {
    var row = selectedRow(); if (!row) return;
    var c = requireClient(); var output = body;
    if (row.channel === "telegram") {
      if (replyingTo) { var prefix = "↪ " + messageSummary(replyingTo).slice(0, 350) + "\n\n"; output = (prefix + body).slice(0, 2000); }
      var res = await c.functions.invoke("telegram-support/admin/reply", { body: { conversation_id: row.id, message: output } });
      if (res.error) { var detail = ""; try { detail = (await res.error.context.json()).error || ""; } catch (_) {} throw new Error(detail || "টেলিগ্রামে পাঠানো যায়নি"); }
      return;
    }
    var insert = { conversation_id: row.id, sender_id: agentUserId, sender_role: "agent", body: body };
    if (attachmentPath) insert.attachment_path = attachmentPath;
    if (replyingTo && replyingTo.conversation_id === row.id) insert.reply_to_message_id = replyingTo.id;
    var result = await c.from("support_messages").insert(insert).select(messageColumns()).single();
    if (result.error) throw result.error;
    if (result.data && !threadRows.some(function (m) { return m.id === result.data.id; })) { threadRows.push(result.data); renderMessages(true); loadMessageActions(selectedId).catch(function () {}); }
  }
  $("replyForm").addEventListener("submit", async function (event) {
    event.preventDefault(); var body = $("replyInput").value.trim(); if (!body || !selectedId) return;
    var button = $("sendBtn"); button.disabled = true; var target = replyTarget;
    try {
      await sendReply(body, null, target); $("replyInput").value = ""; autoGrow(); clearReplyContext();
      if (selectedRow() && selectedRow().channel === "telegram") await loadThread(selectedId);
      refreshConversations();
    } catch (error) { alert("উত্তর পাঠানো যায়নি: " + (error && error.message ? error.message : "আবার চেষ্টা করুন।")); }
    finally { button.disabled = false; $("replyInput").focus(); }
  });
  function autoGrow() { var t = $("replyInput"); t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight) + "px"; }
  $("replyInput").addEventListener("input", function () { autoGrow(); sendTyping(); });
  $("replyInput").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("replyForm").requestSubmit(); } });

  $("attachBtn").addEventListener("click", function () { $("fileInput").click(); });
  $("fileInput").addEventListener("change", async function () {
    var file = this.files && this.files[0]; this.value = "";
    var row = selectedRow();
    if (!file || !row) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { alert("শুধু JPG, PNG, WEBP বা GIF ছবি পাঠানো যাবে।"); return; }
    if (file.size > MAX_IMAGE) { alert("ছবিটি ৫MB-এর বেশি। ছোট ছবি দিন।"); return; }
    var btn = $("attachBtn"); btn.disabled = true; btn.textContent = "⏳";
    try {
      var ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[file.type];
      var path = row.id + "/" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)) + "." + ext;
      var up = await requireClient().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      var caption = $("replyInput").value.trim() || "📷 ছবি";
      await sendReply(caption, path, replyTarget);
      $("replyInput").value = ""; autoGrow(); clearReplyContext();
      refreshConversations();
    } catch (error) {
      alert("ছবি পাঠানো যায়নি: " + (error && error.message ? error.message : "আবার চেষ্টা করুন।"));
    } finally { btn.textContent = "📎"; updateThreadHeader(); }
  });

  /* ---------- canned replies (saved per browser) ---------- */
  function loadCanned() { try { var v = JSON.parse(localStorage.getItem("maSupportCanned") || "null"); if (Array.isArray(v) && v.length) return v; } catch (_) {} return DEFAULT_CANNED.slice(); }
  function saveCanned(list) { try { localStorage.setItem("maSupportCanned", JSON.stringify(list)); } catch (_) {} }
  function renderCanned() {
    var bar = $("cannedBar"); bar.textContent = "";
    var list = loadCanned();
    list.forEach(function (text, index) {
      var b = make("button", "", text.length > 28 ? text.slice(0, 28) + "…" : text);
      b.type = "button"; b.title = text + "\n\n(মুছতে Shift চেপে ক্লিক করুন)";
      b.addEventListener("click", function (e) {
        if (e.shiftKey) { if (confirm("এই রেডিমেড রিপ্লাইটি মুছবেন?\n\n" + text)) { list.splice(index, 1); saveCanned(list); renderCanned(); } return; }
        var input = $("replyInput"); if (input.disabled) return;
        input.value = input.value ? input.value.replace(/\s*$/, " ") + text : text; autoGrow(); input.focus();
      });
      bar.appendChild(b);
    });
    var add = make("button", "add", "+ নতুন রিপ্লাই"); add.type = "button";
    add.addEventListener("click", function () {
      var text = prompt("নতুন রেডিমেড রিপ্লাই লিখুন (এই ব্রাউজারে সংরক্ষিত থাকবে):", $("replyInput").value.trim());
      if (!text || !text.trim()) return;
      list.push(text.trim().slice(0, 1000)); saveCanned(list); renderCanned();
    });
    bar.appendChild(add);
  }
  renderCanned();

  /* ---------- controls ---------- */
  $("threadStatus").addEventListener("change", async function () {
    if (!selectedId) return;
    var result = await requireClient().from("support_conversations").update({ status: this.value }).eq("id", selectedId);
    if (result.error) { alert("স্ট্যাটাস বদলানো যায়নি।"); return; }
    var row = selectedRow(); if (row) row.status = this.value;
    updateThreadHeader(); refreshConversations();
  });
  $("assignBtn").addEventListener("click", async function () {
    if (!selectedId || !agent) return;
    var result = await requireClient().from("support_conversations").update({ assigned_agent_email: agent.email }).eq("id", selectedId);
    if (result.error) { alert("দায়িত্ব নেওয়া যায়নি।"); return; }
    var row = selectedRow(); if (row) row.assigned_agent_email = agent.email;
    updateThreadHeader(); refreshConversations();
  });
  $("contactBtn").addEventListener("click", async function () {
    var row = selectedRow(); if (!row || !hasContactColumns) return;
    var name = prompt("কাস্টমারের নাম:", row.customer_name || ""); if (name === null) return;
    var phone = prompt("কাস্টমারের ফোন নম্বর:", row.customer_phone || ""); if (phone === null) return;
    phone = phone.replace(/[^0-9+ -]/g, "").trim();
    if (phone && !/^[0-9+ -]{6,24}$/.test(phone)) { alert("ফোন নম্বরটি ঠিক নয়।"); return; }
    var result = await requireClient().from("support_conversations").update({ customer_name: name.trim().slice(0, 80) || null, customer_phone: phone || null }).eq("id", row.id);
    if (result.error) { alert("নাম/ফোন সংরক্ষণ করা যায়নি।"); return; }
    row.customer_name = name.trim().slice(0, 80) || null; row.customer_phone = phone || null;
    updateThreadHeader(); renderConversations();
  });
  ["searchInput"].forEach(function (id) { $(id).addEventListener("input", renderConversations); });
  ["statusFilter", "channelFilter", "ownerFilter", "showEmptyToggle"].forEach(function (id) { $(id).addEventListener("change", renderConversations); });

  /* ---------- auth ---------- */
  $("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault(); setNotice("সাইন ইন হচ্ছে…");
    try {
      var captchaToken = await window.maSupportCaptcha.getToken($("loginCaptcha"), "agent_login");
      var result = await requireClient().auth.signInWithPassword({ email: $("email").value.trim().toLowerCase(), password: $("password").value, options: { captchaToken: captchaToken } });
      if (result.error) throw result.error;
      setNotice(""); await openInbox(result.data.user);
    } catch (error) { setConnected(false); setNotice(error.message || "সাইন ইন ব্যর্থ হয়েছে।"); }
  });
  $("signupBtn").addEventListener("click", async function () {
    var email = $("email").value.trim().toLowerCase(), password = $("password").value;
    if (!email || password.length < 8) { setNotice("ইমেইল ও কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।"); return; }
    setNotice("অ্যাকাউন্ট খোলা হচ্ছে…");
    try {
      var captchaToken = await window.maSupportCaptcha.getToken($("loginCaptcha"), "agent_signup");
      var result = await requireClient().auth.signUp({ email: email, password: password, options: { captchaToken: captchaToken } });
      if (result.error) throw result.error;
      if (result.data.session) { setNotice("অ্যাকাউন্ট খোলা হয়েছে। মালিক অনুমোদন দিলে সাইন ইন করুন।", true); await requireClient().auth.signOut(); }
      else setNotice("অ্যাকাউন্ট খোলা হয়েছে। ইমেইল যাচাই করে মালিককে অনুমোদন দিতে বলুন।", true);
    } catch (error) { setNotice(error.message || "অ্যাকাউন্ট খোলা যায়নি।"); }
  });
  $("browserAlertBtn").addEventListener("click", async function () {
    if (!("Notification" in window)) { alert("এই ব্রাউজারে নোটিফিকেশন সমর্থিত নয়।"); return; }
    try {
      var permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission === "granted") setBtn("browserAlertBtn", "🔔", "অ্যালার্ট চালু আছে");
      else { setBtn("browserAlertBtn", "🔕", "অ্যালার্ট ব্লক"); alert("ব্রাউজার নোটিফিকেশন ব্লক করা। সাইট সেটিংস থেকে অনুমতি দিন।"); }
    } catch (_) { alert("নোটিফিকেশন চালু করা যায়নি।"); }
  });
  $("soundAlertBtn").addEventListener("click", function () {
    soundEnabled = !soundEnabled;
    setBtn("soundAlertBtn", soundEnabled ? "🔊" : "🔈", soundEnabled ? "শব্দ: চালু" : "শব্দ: বন্ধ");
    this.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    try { localStorage.setItem("maSupportSound", soundEnabled ? "1" : "0"); } catch (_) {}
    if (soundEnabled) playIncomingTone();
  });
  try { if (localStorage.getItem("maSupportSound") === "1") { soundEnabled = true; setBtn("soundAlertBtn", "🔊", "শব্দ: চালু"); $("soundAlertBtn").setAttribute("aria-pressed", "true"); } } catch (_) {}
  $("logoutBtn").addEventListener("click", async function () {
    var c = requireClient();
    if (inboxChannel) await c.removeChannel(inboxChannel);
    if (typingChannel) await c.removeChannel(typingChannel);
    inboxChannel = null; typingChannel = null;
    await c.auth.signOut();
    agent = null; selectedId = ""; previewCache = Object.create(null); conversations = []; threadRows = [];
    displayLogin(); setConnected(false);
  });

  (async function init() {
    try {
      var c = requireClient();
      var result = await c.auth.getSession();
      var session = result.data && result.data.session;
      if (session && session.user) await openInbox(session.user); else displayLogin();
      c.auth.onAuthStateChange(function (_event, s) { if (s && s.user) agentUserId = s.user.id; });
    } catch (error) { displayLogin(); setNotice(error.message || "সাপোর্ট সার্ভিসে সংযোগ করা যায়নি।"); }
  })();
})();
