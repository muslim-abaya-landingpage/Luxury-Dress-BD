/* Live support inbox (website + Telegram). Supabase Auth + RLS; no secret keys in this file. */
(function () {
  "use strict";
  var config = (window.SITE_FOOTER_CONFIG || {}).supportChat || {};
  var BUCKET = "support-attachments";
  var PAGE = 100;
  var MAX_IMAGE = 5 * 1024 * 1024;
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
  var STATUS_BN = { open: "খোলা", pending: "অপেক্ষমাণ", closed: "বন্ধ" };
  var CHANNEL_BN = { website: "ওয়েবসাইট", telegram: "টেলিগ্রাম" };

  var client = null, agent = null, agentUserId = "", conversations = [], selectedId = "";
  var inboxChannel = null, typingChannel = null, typingTimer = null, lastTypingSent = 0;
  var soundEnabled = false, notificationAudio = null, notifiedMessageIds = Object.create(null);
  var previewCache = Object.create(null), threadRows = [], threadHasOlder = false, signedUrlCache = Object.create(null);
  var hasContactColumns = true, hasAttachmentColumn = true, refreshQueued = false, refreshRunning = false;

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
  function displayName(c) {
    if (!c) return "কথোপকথন";
    if (c.customer_name) return c.customer_name;
    if (c.channel === "telegram") return "টেলিগ্রাম কাস্টমার · " + String(c.telegram_chat_id || c.id).slice(-6);
    return "ভিজিটর · " + c.id.slice(0, 6);
  }

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
      button.append(top, preview, foot);
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
    var box = $("messages");
    var prevHeight = box.scrollHeight, prevTop = box.scrollTop;
    box.textContent = "";
    if (threadHasOlder) {
      var older = make("button", "older-btn", "পুরোনো মেসেজ দেখুন");
      older.type = "button";
      older.addEventListener("click", loadOlder);
      box.appendChild(older);
    }
    if (!threadRows.length) {
      var welcome = make("div", "welcome-thread"); welcome.append(make("strong", "", "কথোপকথন শুরু হয়েছে"), document.createTextNode("এখনো কোনো মেসেজ নেই। উত্তর লিখে শুরু করুন।"));
      box.appendChild(welcome); return;
    }
    threadRows.forEach(function (row) {
      var bot = row.sender_role === "agent" && row.sender_external_id === "telegram-bot";
      var bubble = make("div", "message " + (row.sender_role === "agent" ? "agent" : "customer") + (bot ? " bot" : ""));
      var label = bot ? "টেলিগ্রাম বট" : row.sender_role === "agent" ? "সাপোর্ট এজেন্ট" : "কাস্টমার";
      bubble.appendChild(make("div", "message-label", label));
      bubble.appendChild(make("div", "message-body", row.body));
      if (row.attachment_path) {
        var img = make("img"); img.alt = "কাস্টমারের পাঠানো ছবি"; img.loading = "lazy";
        signedUrl(row.attachment_path).then(function (url) {
          if (!url) { img.replaceWith(make("div", "message-label", "ছবি লোড করা যায়নি")); return; }
          var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
          img.onload = function () { if (nearBottom) box.scrollTop = box.scrollHeight; };
          img.src = url;
          var link = make("a"); link.href = url; link.target = "_blank"; link.rel = "noopener"; img.replaceWith(link); link.appendChild(img);
        });
        bubble.appendChild(img);
      }
      var time = make("time", "", formatTime(row.created_at)); time.dateTime = row.created_at || "";
      bubble.appendChild(time);
      box.appendChild(bubble);
    });
    if (stickToBottom) box.scrollTop = box.scrollHeight;
    else box.scrollTop = box.scrollHeight - prevHeight + prevTop;
  }

  function messageColumns() { return "id,conversation_id,sender_id,sender_role,sender_external_id,body,created_at,read_at" + (hasAttachmentColumn ? ",attachment_path" : ""); }
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
    renderMessages(true);
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, function (payload) {
        var row = payload.new;
        if (row) {
          notifyIncomingMessage(row);
          if (row.conversation_id === selectedId && !threadRows.some(function (m) { return m.id === row.id; })) {
            threadRows.push(row); renderMessages(true);
            if (row.sender_role === "customer") { $("typingLine").textContent = ""; if (document.visibilityState === "visible") requireClient().from("support_messages").update({ read_at: new Date().toISOString() }).eq("id", row.id).then(function () {}, function () {}); }
          }
        }
        refreshConversations();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_events" }, function (payload) { if (payload.new && payload.new.conversation_id === selectedId) loadEvents(selectedId).catch(function () {}); })
      .subscribe(function (status) { setConnected(status === "SUBSCRIBED", status === "SUBSCRIBED" ? "লাইভ" : "সংযোগ হচ্ছে…"); });
  }

  /* ---------- sending ---------- */
  async function sendReply(body, attachmentPath) {
    var row = selectedRow();
    if (!row) return;
    var c = requireClient();
    if (row.channel === "telegram") {
      // Telegram replies go through the Edge Function, which saves the message and delivers it to the bot chat.
      var res = await c.functions.invoke("telegram-support/admin/reply", { body: { conversation_id: row.id, message: body } });
      if (res.error) {
        var detail = "";
        try { detail = (await res.error.context.json()).error || ""; } catch (_) {}
        throw new Error(detail || "টেলিগ্রামে পাঠানো যায়নি");
      }
      return;
    }
    var insert = { conversation_id: row.id, sender_id: agentUserId, sender_role: "agent", body: body };
    if (attachmentPath) insert.attachment_path = attachmentPath;
    var result = await c.from("support_messages").insert(insert).select(messageColumns()).single();
    if (result.error) throw result.error;
    if (result.data && !threadRows.some(function (m) { return m.id === result.data.id; })) { threadRows.push(result.data); renderMessages(true); }
  }
  $("replyForm").addEventListener("submit", async function (event) {
    event.preventDefault();
    var body = $("replyInput").value.trim();
    if (!body || !selectedId) return;
    var button = $("sendBtn"); button.disabled = true;
    try {
      await sendReply(body);
      $("replyInput").value = ""; autoGrow();
      if (selectedRow() && selectedRow().channel === "telegram") await loadThread(selectedId);
      refreshConversations();
    } catch (error) {
      alert("উত্তর পাঠানো যায়নি: " + (error && error.message ? error.message : "আবার চেষ্টা করুন।"));
    } finally { button.disabled = false; $("replyInput").focus(); }
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
      await sendReply(caption, path);
      $("replyInput").value = ""; autoGrow();
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
      var result = await requireClient().auth.signInWithPassword({ email: $("email").value.trim().toLowerCase(), password: $("password").value });
      if (result.error) throw result.error;
      setNotice(""); await openInbox(result.data.user);
    } catch (error) { setConnected(false); setNotice(error.message || "সাইন ইন ব্যর্থ হয়েছে।"); }
  });
  $("signupBtn").addEventListener("click", async function () {
    var email = $("email").value.trim().toLowerCase(), password = $("password").value;
    if (!email || password.length < 8) { setNotice("ইমেইল ও কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।"); return; }
    setNotice("অ্যাকাউন্ট খোলা হচ্ছে…");
    try {
      var result = await requireClient().auth.signUp({ email: email, password: password });
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
