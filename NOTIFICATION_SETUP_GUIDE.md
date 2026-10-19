# Google Sheets Apps Script Notification Setup

## উদ্দেশ্য

এই guide-এ Google Sheet-এর নতুন order এলে admin email ও Telegram bot-এ একই notification পাঠানো, Script Properties configure করা, test চালানো, এবং daily automation logs monitor করার পদ্ধতি দেওয়া হলো।

## Script Properties

Google Sheet → **Extensions → Apps Script → Project Settings → Script Properties**-এ নিচের keys যোগ করুন:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
NOTIFICATION_ALERT_EMAIL
```

`TELEGRAM_BOT_TOKEN` এবং `TELEGRAM_CHAT_ID` কখনো source code বা GitHub-এ লিখবেন না। `NOTIFICATION_ALERT_EMAIL` optional; না দিলে `Admins` sheet-এর active admin emails ব্যবহার করা হবে।

### Telegram token

1. Telegram-এ `@BotFather` খুলুন।
2. `/newbot` চালান।
3. BotFather-এর দেওয়া token কপি করুন।
4. নতুন bot-এ `/start` পাঠান।
5. Browser-এ খুলুন:

```text
https://api.telegram.org/bot<TOKEN>/getUpdates
```

6. JSON response-এর `message.chat.id` value-টি `TELEGRAM_CHAT_ID` হিসেবে রাখুন।

## Code-based configuration

Credential code-এ hardcode না করে function parameter দিয়ে set করা যায়:

```javascript
function configureNotificationProperties(telegramToken, telegramChatId, alertEmail) {
  var props = PropertiesService.getScriptProperties();
  if (telegramToken) props.setProperty('TELEGRAM_BOT_TOKEN', String(telegramToken).trim());
  if (telegramChatId) props.setProperty('TELEGRAM_CHAT_ID', String(telegramChatId).trim());
  if (alertEmail) props.setProperty('NOTIFICATION_ALERT_EMAIL', String(alertEmail).trim());
  return { ok: true };
}
```

এই function-এ token সরাসরি source code-এ লিখবেন না। Apps Script editor থেকে একবার run করলে authorization চাইতে পারে।

## Complete test function

```javascript
function testNewOrderNotifications() {
  var testOrderId = 'TEST-NOTIFICATION-' +
    Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyyMMdd-HHmmss');

  var message =
    'Muslim Abaya notification test\\n\\n' +
    'Order ID: ' + testOrderId + '\\n' +
    'Customer: QA Notification Test\\n' +
    'Phone: 01971642683\\n' +
    'Total: ৳1079\\n' +
    'Status: TEST ONLY — DO NOT SHIP';

  return sendAdminAndTelegramNotification_(
    'Order notification test — ' + testOrderId,
    message
  );
}
```

Expected result:

```json
{
  "email": true,
  "telegram": true
}
```

If Telegram is not configured, the email can still succeed while `telegram` remains `false`.

## New order notification flow

The existing `sendNewOrderAlertOnce_()` function prevents duplicate notifications using the `ORDERSYNC_ALERTED_ORDER_IDS` Script Property. Website orders notify immediately through the Apps Script order handler. Manual or other source orders are detected during the 15-minute OrderSync cycle.

## Daily log monitoring

Automation logs are written to `AutomationLogs` with these event types:

```text
SYNC
BACKUP
VERIFY
ALERT
REPORT
WHATSAPP_SEND
WHATSAPP_DELIVERY
WHATSAPP_QUOTA
```

The deployed triggers are:

```text
OrderSync: every 15 minutes
Safety backup: daily at 02:00 Asia/Dhaka
Log verification: daily at 03:00 Asia/Dhaka
7-day report/chart: daily at 03:15 Asia/Dhaka
WhatsApp quota monitor: daily at 04:00 Asia/Dhaka
```

## Slide presentation script and highlights

### Slide 1 — Google Sheets Apps Script Notifications

**Narration:** এই deck-এ Google Sheets থেকে WhatsApp, Telegram এবং Email notification architecture দেখানো হয়েছে।

**Highlight:** Sheets হলো source; Apps Script হলো automation layer; Email/Telegram/WhatsApp হলো delivery channels।

### Slide 2 — Telegram bot: token ও chat ID

**Narration:** @BotFather দিয়ে bot তৈরি করতে হবে, bot-এ `/start` পাঠাতে হবে, তারপর `getUpdates` response থেকে `chat.id` নিতে হবে।

**Highlight:** শুধু phone number যথেষ্ট নয়; Telegram bot-এর জন্য token এবং chat ID দুটিই লাগে।

### Slide 3 — WhatsApp Cloud API setup

**Narration:** Meta app, Phone Number ID, permanent access token এবং approved Utility Template দরকার।

**Highlight:** WhatsApp credentials Script Properties-এ রাখতে হবে; source code-এ নয়।

### Slide 4 — Email + Telegram একসঙ্গে alert

**Narration:** একই order message প্রথমে `MailApp.sendEmail()` দিয়ে admin emails-এ যায়, তারপর Telegram Bot API-এর `sendMessage` endpoint-এ যায়।

**Highlight:** একটি channel ব্যর্থ হলেও অন্য channel চেষ্টা করা যায়; `AutomationLogs`-এ ফলাফল লেখা উচিত।

### Slide 5 — AutomationLogs monitoring

**Narration:** Sync, backup, alert এবং verification event log হয়। Daily verification গত ২৪ ঘণ্টার error খোঁজে এবং 7-day report performance trend দেখায়।

**Highlight:** duplicate alert suppression এবং daily backup verification operational safety বাড়ায়।

### Slide 6 — Launch checklist

**Narration:** Credentials সেট করা, bot-এ `/start` পাঠানো, test function চালানো, Apps Script permissions Allow করা এবং trigger status যাচাই করা হলো launch-এর শেষ ধাপ।

**Highlight:** Test notification অবশ্যই `TEST ONLY — DO NOT SHIP` label সহ পাঠান।

## Safe operating rule

Live customer message পাঠানোর আগে test recipient ব্যবহার করুন। Bot token chat, source file বা GitHub commit-এ প্রকাশ করবেন না।

## Official references

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Bots FAQ](https://core.telegram.org/bots/faq)
- [WhatsApp Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [WhatsApp message template documentation](https://developers.facebook.com/docs/whatsapp/api/messages/message-templates/interactive-message-templates/)
