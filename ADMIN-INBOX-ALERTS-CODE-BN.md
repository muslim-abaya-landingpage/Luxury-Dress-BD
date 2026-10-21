# Admin Inbox: browser notification ও sound alert কোড

PR #91-এ যোগ করা alert feature live Admin Inbox (`admin-support-inbox.html`)-এ আছে। এই ফাইলটি alert implementation-এর প্রয়োজনীয় অংশগুলো আলাদা করে দেখায়; source of truth হলো `admin-support-inbox.html`।

## 1. Toolbar controls

Admin Inbox-এর top bar-এ লগইনের পর দেখানোর দুটি button:

```html
<button class="alert-btn hidden" id="browserAlertBtn" type="button" title="Enable browser notifications">Enable alerts</button>
<button class="alert-btn hidden" id="soundAlertBtn" type="button" aria-pressed="false" title="Toggle incoming-message sound">Sound: Off</button>
```

`.hidden` লগইনের আগে controls লুকিয়ে রাখে। অনুমোদিত agent inbox খুললে `displayInbox()` তাদের দেখায়।

## 2. State এবং sound

```js
var soundEnabled = false;
var notificationAudio = null;
var notifiedMessageIds = Object.create(null);

function playIncomingTone() {
  if (!soundEnabled) return;
  try {
    var Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!notificationAudio) notificationAudio = new Audio();
    var ctx = notificationAudio;
    var beep = function () {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + .34);
    };
    if (ctx.state === "suspended") ctx.resume().then(beep).catch(function () {});
    else beep();
  } catch (_) {}
}
```

## 3. Notification handler

শুধু customer role-এর message notification তৈরি করে; agent replies নিজে notification trigger করে না। Desktop notification-এ message text প্রকাশ না করে generic text দেখানো হয়, যাতে lock-screen-এ customer-এর লেখা না দেখা যায়।

```js
function notifyIncomingMessage(row) {
  if (!row || row.sender_role !== "customer" || !row.id || notifiedMessageIds[row.id]) return;
  notifiedMessageIds[row.id] = true;
  playIncomingTone();
  if (document.visibilityState === "visible" || !("Notification" in window) || Notification.permission !== "granted") return;
  var notice = new Notification("New customer message · Muslim Abaya", {
    body: "Open the inbox to read the new customer message.",
    tag: "support-" + row.conversation_id
  });
  notice.onclick = function () {
    window.focus();
    notice.close();
    selectConversation(row.conversation_id);
  };
}
```

## 4. User-gesture controls ও Realtime hook

Notification permission browser-এর user click থেকে চাইতে হবে। Sound default-এ muted; agent নিজে button চাপলে enable হয়। Realtime `INSERT` event-এ notification handler চলে, তারপর inbox/thread data refresh হয়।

```js
$("browserAlertBtn").addEventListener("click", async function () {
  if (!("Notification" in window)) {
    setNotice("This browser does not support desktop notifications.");
    return;
  }
  try {
    var permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission === "granted") {
      this.textContent = "Alerts: On";
      setNotice("Browser alerts enabled. Keep this inbox tab open to receive them.", true);
    } else {
      this.textContent = "Alerts blocked";
      setNotice("Notifications are blocked by the browser. Allow them in site settings, then try again.");
    }
  } catch (_) {
    setNotice("Could not enable browser notifications.");
  }
});

$("soundAlertBtn").addEventListener("click", function () {
  soundEnabled = !soundEnabled;
  this.textContent = soundEnabled ? "Sound: On" : "Sound: Off";
  this.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  if (soundEnabled) playIncomingTone();
});

// Inside the existing subscribed Supabase Realtime channel:
.on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, function (payload) {
  if (payload.new) {
    notifyIncomingMessage(payload.new);
    if (payload.new.conversation_id === selectedId) loadThread(selectedId).catch(function () {});
  }
  refreshConversations().catch(function () {});
})
```

## Test on live site or local

1. Open `https://muslimabaya.com/admin-support-inbox.html` (or serve locally on `http://localhost:<port>`; do not use `file://`). Sign in and wait for the connection status to show **Live**.
2. Click **Enable alerts** and allow notifications. Click **Sound: Off**; the short preview beep confirms browser audio is unlocked.
3. In a second browser or Incognito window, open the storefront, start a test support chat, and send a harmless message.
4. To test the desktop banner, leave the admin inbox open but switch to another tab/window so the inbox page is hidden. The sound should play when enabled. A notification banner should appear only if browser permission is `granted` and OS/browser notification settings allow it.
5. If no alert arrives, confirm the admin connection is **Live**, site notifications are allowed in browser settings, OS Focus Assist/Do Not Disturb is off, and the sound toggle says **Sound: On**. Test with a fresh message because previously observed IDs are de-duplicated for that page session.

This is a foreground Realtime alert, not web push: the Admin Inbox must remain open and subscribed. Closing the browser or losing connection stops alerts. Browsers require HTTPS for notifications except trusted `localhost` origins.
