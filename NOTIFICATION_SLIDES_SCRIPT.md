# Google Sheets Apps Script Notifications

## Presentation purpose

এই presentation-এ Google Sheets-এ নতুন order এলে Email ও Telegram-এ notification পাঠানো, credentials নিরাপদে সংরক্ষণ করা, OrderSync trigger চালু করা এবং AutomationLogs থেকে performance report তৈরি করার সম্পূর্ণ workflow দেখানো হবে।

---

## Slide 1 — Google Sheets Apps Script Notifications

### On-slide content

**Google Sheets Apps Script Notifications**

Telegram, Email ও Google Sheets automation setup guide

### Narration

এই presentation-এ দেখানো হবে কীভাবে Google Sheet-এর নতুন order Apps Script দিয়ে শনাক্ত করে admin email এবং Telegram bot-এ একই notification পাঠানো যায়। Google Sheet data source হিসেবে কাজ করবে, Apps Script automation layer হিসেবে কাজ করবে এবং Email ও Telegram delivery channel হিসেবে কাজ করবে।

### Key highlight

```text
Google Sheets = data source
Apps Script = automation layer
Email + Telegram = notification channels
```

---

## Slide 2 — Telegram Bot Token ও Chat ID

### On-slide content

```text
1. @BotFather → /newbot
2. Bot-এ /start পাঠান
3. getUpdates থেকে chat.id নিন
```

```text
https://api.telegram.org/bot<TOKEN>/getUpdates
```

### Narration

প্রথমে Telegram-এর `@BotFather` দিয়ে একটি bot তৈরি করতে হবে। BotFather একটি HTTP API token দেবে। এরপর তৈরি bot-এর chat খুলে `/start` পাঠাতে হবে। সবশেষে `getUpdates` endpoint খুলে JSON response-এর `message.chat.id` value নিতে হবে। এই value-টিই Apps Script-এর `TELEGRAM_CHAT_ID`।

### Key highlight

শুধু phone number যথেষ্ট নয়। Telegram notification-এর জন্য bot token এবং chat ID দুটিই প্রয়োজন।

---

## Slide 3 — Apps Script Script Properties

### On-slide content

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
NOTIFICATION_ALERT_EMAIL
```

```javascript
function configureNotificationProperties(
  telegramToken,
  telegramChatId,
  alertEmail
) {
  var props =
    PropertiesService.getScriptProperties();

  if (telegramToken) {
    props.setProperty(
      'TELEGRAM_BOT_TOKEN',
      telegramToken
    );
  }

  if (telegramChatId) {
    props.setProperty(
      'TELEGRAM_CHAT_ID',
      telegramChatId
    );
  }

  if (alertEmail) {
    props.setProperty(
      'NOTIFICATION_ALERT_EMAIL',
      alertEmail
    );
  }

  return { ok: true };
}
```

### Narration

Token এবং Chat ID source code-এ hardcode করা উচিত নয়। Apps Script-এর Project Settings → Script Properties-এ credentials রাখতে হবে। Email property optional; এটি না থাকলে `Admins` sheet-এর active admin emails ব্যবহার করা যাবে।

### Key highlight

```text
Credentials code বা GitHub-এ নয়।
Script Properties-এ রাখুন।
```

---

## Slide 4 — Email + Telegram Dual Alert

### On-slide content

```javascript
function sendDualNotification(message) {
  var props =
    PropertiesService.getScriptProperties();

  // Email
  var emails =
    typeof getAdminNotifyEmails_ === 'function'
      ? getAdminNotifyEmails_()
      : [];

  if (emails.length) {
    MailApp.sendEmail({
      to: emails.join(','),
      subject: 'নতুন অর্ডার অ্যালার্ট',
      body: message
    });
  }

  // Telegram
  var token =
    props.getProperty('TELEGRAM_BOT_TOKEN');

  var chatId =
    props.getProperty('TELEGRAM_CHAT_ID');

  if (token && chatId) {
    UrlFetchApp.fetch(
      'https://api.telegram.org/bot' +
      token +
      '/sendMessage',
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: chatId,
          text: message
        })
      }
    );
  }
}
```

### Narration

নতুন order row append হওয়ার পর একই message body তৈরি করে প্রথমে `MailApp.sendEmail()` দিয়ে admin emails-এ পাঠানো হয়। এরপর Telegram Bot API-এর `sendMessage` endpoint-এ message পাঠানো হয়। প্রতিটি channel-এর error আলাদাভাবে log করা উচিত।

### Key highlight

Email ব্যর্থ হলেও Telegram চেষ্টা করা যায়। Telegram ব্যর্থ হলেও Email alert রাখা যায়।

---

## Slide 5 — Complete Test Function

### On-slide content

```javascript
function testNewOrderNotifications() {
  var testOrderId =
    'TEST-NOTIFICATION-' +
    Utilities.formatDate(
      new Date(),
      'Asia/Dhaka',
      'yyyyMMdd-HHmmss'
    );

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

### Narration

Production order test না করে প্রথমে এই dedicated test function চালানো উচিত। এটি কোনো real order row তৈরি করে না। শুধু Email, Telegram এবং AutomationLogs-এর notification path যাচাই করে।

### Expected result

```json
{
  "email": true,
  "telegram": true
}
```

### Key highlight

```text
TEST ONLY — DO NOT SHIP
```

---

## Slide 6 — OrderSync New-order Automation

### On-slide content

```javascript
function setupOrderSyncNewOrderAutomation() {
  setupOrderSyncTrigger();

  return {
    ok: true,
    trigger: 'orderSyncTriggerHandler',
    interval: 'every 15 minutes'
  };
}
```

```javascript
function setupOrderSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (
      trigger.getHandlerFunction() ===
      'orderSyncTriggerHandler'
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('orderSyncTriggerHandler')
    .timeBased()
    .everyMinutes(15)
    .create();
}
```

### Narration

Website বা API থেকে order এলে সবসময় onEdit trigger নির্ভরযোগ্য নয়, কারণ programmatic write সবসময় user edit হিসেবে ধরা হয় না। তাই OrderSync-এর জন্য প্রতি ১৫ মিনিটের polling trigger ব্যবহার করা হয়েছে। এটি source order sheet দেখে নতুন order mirror sheet-এ যোগ করে এবং duplicate suppression-এর পর alert পাঠায়।

### Key highlight

```text
Website/API write → 15-minute OrderSync polling
Manual edit → sheet-open/self-healing setup
```

---

## Slide 7 — AutomationLogs থেকে 7-day Summary

### On-slide content

```javascript
function automationSummaryTriggerHandler() {
  try {
    var summary =
      generateSevenDayAutomationSummary();

    sendSevenDayAutomationSummary_(summary);
  } catch (err) {
    recordAutomationLog_(
      'REPORT',
      false,
      0,
      0,
      String(err.message || err)
    );
  }
}
```

Summary message-এ থাকবে:

```text
Sync OK
Sync Errors
Backup OK
Backup Errors
Alerts
Verification Errors
```

### Narration

প্রতিদিন summary trigger গত ৭ দিনের `AutomationLogs` পড়বে। Summary `AutomationReports` tab-এ লিখবে, chart refresh করবে এবং একই summary admin Email ও Telegram-এ পাঠাবে।

### Key highlight

```text
AutomationReports tab = detailed report + chart
Email/Telegram = daily summary delivery
```

---

## Slide 8 — Automation Schedule

### On-slide content

```text
OrderSync                  প্রতি ১৫ মিনিট
Safety backup              প্রতিদিন রাত ২টা
Log verification           প্রতিদিন রাত ৩টা
7-day report + chart       প্রতিদিন রাত ৩:১৫
WhatsApp quota monitor     প্রতিদিন ভোর ৪টা
```

### Narration

একবার authorization এবং trigger setup সম্পন্ন হলে এই schedule স্বয়ংক্রিয়ভাবে চলবে। `AutomationLogs` tab operational audit trail হিসেবে কাজ করবে। কোনো failure হলে পরবর্তী verification report-এ তা দেখা যাবে।

### Key highlight

```text
Sync → Backup → Verify → Report → Notify
```

---

## Slide 9 — Launch Checklist

### On-slide content

```text
[ ] TELEGRAM_BOT_TOKEN সেট করা হয়েছে
[ ] TELEGRAM_CHAT_ID সেট করা হয়েছে
[ ] Bot-এ /start পাঠানো হয়েছে
[ ] Admin email যাচাই করা হয়েছে
[ ] testNewOrderNotifications চালানো হয়েছে
[ ] Email message পাওয়া গেছে
[ ] Telegram message পাওয়া গেছে
[ ] AutomationLogs-এ ALERT: OK দেখা গেছে
[ ] Apps Script triggers active
[ ] Token GitHub/source code-এ নেই
```

### Narration

Live order notification চালু করার আগে checklist সম্পূর্ণ করতে হবে। বিশেষভাবে Email inbox, Telegram chat এবং AutomationLogs—তিন জায়গায় একই test notification সফল হয়েছে কি না যাচাই করতে হবে।

### Key highlight

Test সফল হওয়ার আগে live notification চালু করবেন না।

---

## Closing message

Google Sheets order data এক জায়গায় রাখে। Apps Script business automation চালায়। Telegram ও Email দ্রুত notification দেয়। AutomationLogs এবং 7-day report পুরো workflow-এর health visibility দেয়।
