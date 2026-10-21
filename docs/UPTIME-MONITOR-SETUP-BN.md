# ঘণ্টাভিত্তিক uptime check ও Telegram সতর্কবার্তা চালু করা

`apps-script/Monitor.gs`-এর `siteUptimeCheck()` সাইটের homepage, checkout এবং `/api/admin-read?health=1` দ্রুত-পথ health endpoint পরীক্ষা করে। দ্রুত-পথ পরপর দুই ঘণ্টার check-এ ব্যর্থ হলে DOWN alert পাঠায়; check আবার সফল হলে RECOVERED alert পাঠায়। Alert helper Telegram ও email-এ পাঠায়—Telegram ব্যবহারের জন্য bot token এবং chat ID Script Properties-এ থাকতে হবে।

## ১. Telegram bot একবার সেটআপ করুন

1. Google Apps Script editor-এ production Apps Script project খুলুন। **Project Settings → Script Properties**-এ `TELEGRAM_BOT_TOKEN` নামে bot token যোগ করুন। Token source code, GitHub বা chat-এ রাখবেন না।
2. Telegram-এ সেই bot খুলে `/start` বা `hi`-এর মতো একটি message পাঠান, যাতে Telegram chat-টি bot-এর কাছে দৃশ্যমান হয়।
3. Apps Script editor-এর function dropdown থেকে `telegramSetupChatId` নির্বাচন করে **Run** চাপুন এবং প্রয়োজনীয় Google permission অনুমোদন করুন। ফাংশনটি সর্বশেষ incoming message থেকে chat ID Script Properties-এ রাখে এবং একটি test message পাঠায়।
4. Telegram-এ `Muslim Abaya: Telegram নোটিফিকেশন চালু হয়েছে` test message এসেছে কি না দেখুন। কোনো message না এলে bot-কে আগে message পাঠিয়ে `telegramSetupChatId` আবার চালান; token ভুল হলে `TELEGRAM_BOT_TOKEN` ঠিক করুন।

`telegramSetupChatId()` নিজে token log করে না। `TELEGRAM_CHAT_ID` হাতে বসানোর দরকার নেই—ফাংশনটি সেটি সংরক্ষণ করে।

## ২. ঘণ্টায় trigger চালু করুন

1. একই production Apps Script project-এর editor-এ function dropdown থেকে `setupUptimeMonitorTrigger` নির্বাচন করুন।
2. **Run** চাপুন; প্রথমবার হলে Google-এর authorization prompt অনুমোদন করুন।
3. Apps Script বাম মেনুর **Triggers** (ঘড়ির icon) খুলে `siteUptimeCheck` function-টির time-driven trigger, hourly schedule আছে কি না নিশ্চিত করুন।

`setupUptimeMonitorTrigger()` `siteUptimeCheck`-এর আগের trigger-গুলো সরিয়ে hourly trigger-টি পুনঃতৈরি করে; অন্য handler-গুলোর trigger মুছে দেয় না। আবার চালালে `siteUptimeCheck`-এর duplicate trigger হয় না। Google trigger-টি প্রতি ঘণ্টার নির্দিষ্ট minute-এ না চালিয়ে ঘণ্টার মধ্যে যেকোনো সময় চালাতে পারে।

## ৩. পরীক্ষা ও troubleshooting

- Apps Script editor-এর **Executions**-এ `siteUptimeCheck` execution এবং `UPTIME` log দেখুন। `edge` মান `OK`, `FAIL n` বা recovery-এর সময় `RECOVERED` হওয়া উচিত।
- Alert কেবল দ্বিতীয় ধারাবাহিক hourly failure-এ যায়, তাই একটি মাত্র failed check দিয়ে production alert পরীক্ষা করবেন না। Recover হওয়া পর্যন্ত monitor DOWN অবস্থায় থাকে এবং পুনরুদ্ধারে একটি notification পাঠায়।
- `TELEGRAM_BOT_TOKEN` বা `TELEGRAM_CHAT_ID` অনুপস্থিত/ভুল হলে `OrderSync.gs`-এর `sendTelegramText_()` ফলাফল `AutomationLogs`-এ দেখা যেতে পারে। Email alert-এর জন্য `NOTIFICATION_ALERT_EMAIL` বা `getAdminNotifyEmails_()` configuration-ও পরীক্ষা করুন।
- `setupUptimeMonitorTrigger()` শুধু schedule ইনস্টল করে; এটি Telegram credentials তৈরি করে না। Token এবং chat ID না থাকলে Telegram সতর্কবার্তা যাবে না।

সম্পর্কিত source: [`apps-script/Monitor.gs`](../apps-script/Monitor.gs) এবং [`apps-script/OrderSync.gs`](../apps-script/OrderSync.gs)।
