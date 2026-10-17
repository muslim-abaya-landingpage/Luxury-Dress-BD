# Alertmanager-এ Slack ও Email notification: practical setup

Ready-to-adapt config: [`monitoring/alertmanager/alertmanager.yml.example`](../monitoring/alertmanager/alertmanager.yml.example)। এতে `severity="critical"` হলে P1 Slack alert এবং একই alert-এর email copy, আর warning/P2-তে email notification পাঠানোর routing template আছে। Slack webhook URL ও SMTP password config-এর file reference-এ রাখা হয়েছে, Git-এ নয়। Alertmanager-এর official config-এ Slack `api_url_file` এবং SMTP `smtp_auth_password_file` fields নথিভুক্ত আছে [1]; Slack annotation/template ব্যবহার official examples-এর pattern অনুসরণ করে [2]।

## 1. Slack Incoming Webhook

1. Workspace owner/admin-এর অনুমোদনে একটি dedicated Slack app বা Incoming Webhook তৈরি করুন; শুধু monitoring-এর private `#ecommerce-alerts` channel বেছে দিন। Customer support/general public channel ব্যবহার করবেন না।
2. Webhook URL-টি team secret manager, container secret বা protected file mount-এ রাখুন। File path-টি config-এর `/run/secrets/alertmanager_slack_webhook_url`-এর সঙ্গে মেলান; file permission ন্যূনতম রাখুন (যেমন owner-only read), backup/log-এ secret ছড়াবেন না।
3. Slack app-এর webhook destination channel আগে থেকেই নির্ধারিত থাকতে পারে; সেই ক্ষেত্রে workspace app configuration-এই channel বেছে নিন। `channel` field-এর আচরণ webhook/app type অনুযায়ী যাচাই করুন।
4. `slack-p1` receiver-এ `send_resolved: true` থাকায় alert recover হলে resolved update-ও পাঠানো হবে। Template-এ শুধু severity, service, target ও annotations আছে—customer payload/PII দেবেন না।

## 2. Email / SMTP

1. Dedicated sender mailbox বা অনুমোদিত SMTP relay তৈরি করুন (যেমন `ecommerce-alerts@yourdomain.tld`)। ব্যক্তিগত mailbox password ব্যবহার করবেন না।
2. SMTP host ও TLS port provider/admin-এর কাছ থেকে নিন। সাধারণত port 587 STARTTLS ব্যবহৃত হয়; provider-এর requirements মেনে `smtp_smarthost`, sender, username ও `smtp_require_tls` বসান।
3. SMTP app password/credential `smtp_auth_password_file`-এ reference করা protected file বা orchestrator secret হিসেবে mount করুন। Config-এর `.invalid` placeholder recipient ও domain বদলে monitored on-call/distribution list দিন।
4. P1 email-এও কপি হয়; P2 warning email-এ যায়। Email distribution list যেন অন্তত একজন দায়িত্বপ্রাপ্ত owner-এর কাছে পৌঁছায় এবং on-call/business-hour fallback নথিভুক্ত থাকে।

## 3. Deploy ও routing test

1. Example-টি deployment-এর বাইরে copy করে `alertmanager.yml` বানান। উদাহরণ ফাইলটি নিজে সরাসরি চালাবেন না—প্রথমে `.invalid` recipient, SMTP hostname এবং secret file path ঠিক করুন।
2. Secret files container/host-এ read-only mount করুন; access শুধু Alertmanager process/service account-কে দিন। Secret content command line, shell history, workflow log বা GitHub artifact-এ লিখবেন না।
3. `amtool check-config /path/to/alertmanager.yml` চালান। Prometheus config-এ Alertmanager endpoint `alertmanager:9093`-এর service/DNS name আপনার বাস্তব network name-এর সঙ্গে মেলে কি না যাচাই করুন।
4. Non-production monitoring stack ও private test channel/recipient-এ `critical` এবং `warning` test alert পাঠান। Slack এবং email—দুই receiver-ই আসছে, duplicate grouping কাজ করছে, এবং resolve notification আসছে যাচাই করুন। এরপর test alert resolve/remove করুন।
5. Production secret rotate বা channel বদলালে config reload/restart-এর পর আবার test notification পাঠান। AlertManager-এর logs ও delivery status monitor করুন; retry failure থাকলে notification provider-ও incident হিসেবে দেখুন।

## 4. Safe notification rules

- `summary`/`description` annotation-এ customer name, phone, address, email, payment reference, session token, order payload বা raw order ID রাখবেন না।
- URL/query parameters-এ secrets রাখবেন না; alert label-এ customer/order identifier রাখবেন না। Labels high-cardinality ও privacy exposure দুটোই বাড়ায়।
- Alert payload-এ runbook link, service, route/target, deployment identifier (secret নয়), time window ও error class দিন।
- Critical alert-এর 15-minute repeat এবং resolved notification-এর আচরণ চালু করার পর test করুন; business-hour escalation owner লিখে রাখুন।
- Incoming Webhook URL ফাঁস হলে revoke/rotate করুন। SMTP credential প্রকাশ পেলে account/relay credential rotate করুন; পুরোনো secret invalidate না হওয়া পর্যন্ত incident বন্ধ করবেন না।

## References

[1]: https://prometheus.io/docs/alerting/latest/configuration/ "Prometheus Alertmanager configuration"
[2]: https://prometheus.io/docs/alerting/latest/notification_examples/ "Prometheus Alertmanager notification template examples"
