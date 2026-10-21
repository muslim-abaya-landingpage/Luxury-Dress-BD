# তিনটি GitHub নিরাপত্তা সতর্কতা পরীক্ষা

## কীভাবে চালাবেন

রিপোজিটরির মূল ডিরেক্টরি থেকে চালান:

```bash
npm run security:dependabot
```

`scripts/check-dependabot-alerts.mjs` GitHub-এর **public Security Advisory API**-তে তিনটি GHSA আলাদাভাবে দেখে এবং `package-lock.json`-এ থাকা resolved package version-এর সঙ্গে vulnerable range তুলনা করে। এটি রিপোজিটরির private `/dependabot/alerts` endpoint ব্যবহার করে না—সেই endpoint বর্তমান GitHub integration token-এ `403 Resource not accessible by integration` ফেরত দিচ্ছে। তাই `security_events` permission থাকলেও private alert-list access না এলে এই স্বতন্ত্র version check চলতে পারে।

এই script lockfile-এর ঝুঁকি যাচাই করে; GitHub-এ alert এখনো `OPEN` নাকি `CLOSED`, তা জানতে বা alert বন্ধ করতে পারে না। কোনো alert dismiss/close-ও করে না।

## যাচাইকৃত তিনটি advisory

| GitHub alert | Severity | Advisory | Vulnerable range | patched version |
|---|---|---|---|---|
| #15 | High | [GHSA-587h-7wmj-h5pm / CVE-2026-112942](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | Vite `<= 6.4.3`; `launch-editor <= 2.14.1` | Vite `6.4.4`; `launch-editor 2.14.2` |
| #16 | Moderate | [GHSA-r825-w8mm-5pxw / CVE-2026-112944](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | Vite `<= 6.4.3`; `launch-editor <= 2.14.1` | Vite `6.4.4`; `launch-editor 2.14.2` |
| #14 | Moderate | [GHSA-698v-4r3x-3vcv / CVE-2026-112943](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | Vite `<= 6.4.3`; `launch-editor <= 2.14.1` | Vite `6.4.4`; `launch-editor 2.14.2` |

## বর্তমান রিপোজিটরির ফল

পরীক্ষার সময় `package.json`-এ Vite requirement ছিল `^6.4.4`, আর `package-lock.json`-এ resolved version ছিল `6.4.4`। তিনটি advisory-তেই Vite `6.4.4` patch floor; তাই বর্তমান lockfile-এ ওই তিনটির জন্য vulnerable Vite version নেই। `launch-editor` আলাদা package হিসেবেও lockfile-এ নেই। এই কারণেই version checker-এ তিনটিই patched/no affected locked version হওয়ার কথা।

তবে GitHub-এর Security UI তখনও তিনটি alert `OPEN` দেখাচ্ছিল এবং dependency file-এর শেষ check প্রায় ১১ ঘণ্টা আগের ছিল। তাই UI-র alert-state এবং বর্তমান lockfile-এর অবস্থার মধ্যে refresh delay থাকতে পারে। GitHub-এ Security → Dependabot পাতা পরে আবার দেখে নিন; scan refresh হওয়ার পরও alert থাকলে `package-lock.json` ও সংশ্লিষ্ট branch-এর dependency graph পুনরায় পরীক্ষা করুন। Script-এর `NO AFFECTED LOCKED VERSIONS`-কে alert বন্ধ হওয়ার প্রমাণ হিসেবে ধরবেন না।

## Script-এর সীমা

এই তালিকাটি বর্তমানে দেখা তিনটি alert-এর GHSA ID ধরে পরীক্ষা করে। নতুন alert এলে script-এর `ALERTS` তালিকায় তার GHSA ID যোগ করতে হবে। GitHub API-র কোনো semver range script বুঝতে না পারলে সেটিকে safe না ধরে `INDETERMINATE` দেখাবে।