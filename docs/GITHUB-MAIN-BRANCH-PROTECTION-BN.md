# GitHub `main` branch protection ও required E2E check

এই নির্দেশিকা `muslim-abaya-landingpage/Luxury-Dress-BD`-এর বর্তমান workflow-কে লক্ষ্য করে লেখা। 2026-10-17-এ যাচাইয়ের সময় `main` branch-এ protection ছিল না (`Branch not protected`)। এই ফাইলে **কনফিগারেশন নির্দেশনা** দেওয়া হয়েছে; কোনো GitHub rule স্বয়ংক্রিয়ভাবে প্রয়োগ করা হয়নি।

## কোন check-টি required করবেন

`.github/workflows/e2e.yml`-এর workflow name `E2E`; job-এর check name **`Playwright E2E`**। এই একই job-এ প্রথমে Apps Script security contract tests, তারপর Playwright browser E2E suite চলে। দুটির যেকোনোটি ব্যর্থ হলে check ব্যর্থ হবে—তাই branch protection-এ E2E job-টিই required করুন।

> GitHub-এর check picker-এ নামটি `Playwright E2E` অথবা workflow/job group হিসেবে `E2E / Playwright E2E` দেখা যেতে পারে। `main`-এর সাম্প্রতিক সফল run-এর সংশ্লিষ্ট job-টি বেছে নিন; শুধু নাম দেখে অন্য কোনো workflow check নির্বাচন করবেন না।

## Ruleset দিয়ে সেটআপ (প্রস্তাবিত)

1. GitHub-এ repository খুলে **Settings → Rules → Rulesets → New ruleset → New branch ruleset** বেছে নিন।
2. Name দিন, যেমন `Protect main`; **Enforcement status: Active** রাখুন।
3. **Target branches**-এ `main` যোগ করুন (branch-name pattern `main` / `refs/heads/main`)।
4. **Require a pull request before merging** চালু করুন।
   - Review partner থাকলে 1 approval, stale review dismiss, এবং conversation resolution require করা ভালো।
   - একক maintainer হলে approval count 0 রাখুন; PR বাধ্যতামূলক রাখুন, তবে নিজের PR-এর approval বাধ্যতামূলক করলে merge আটকে যেতে পারে।
5. **Require status checks to pass** চালু করে check list-এ **`Playwright E2E`** যোগ করুন।
6. **Require branches to be up to date before merging** চালু করুন—এটি strict status-check mode। `main` বদলালে PR branch update করে checks আবার চালাতে হবে।
7. **Block force pushes** এবং **Block deletions** চালু করুন। Ruleset-এর bypass list ফাঁকা রাখুন, যদি না নির্দিষ্ট trusted automation-এর সত্যিকারের প্রয়োজন থাকে।
8. Save করার আগে target branch ও check name আবার যাচাই করুন।

### Legacy Branch protection ব্যবহার করলে

**Settings → Branches → Add branch protection rule** থেকে branch name `main` দিন। এরপর **Require a pull request before merging**, **Require status checks to pass before merging** এবং **Require branches to be up to date before merging** চালু করুন; status check হিসেবে `Playwright E2E` বাছুন; force push ও branch deletion আটকান। Save করুন। একই branch-এ ruleset ও legacy rule দুটো একসঙ্গে তৈরি না করাই সহজ।

## Check নাম যাচাই

1. একটি ছোট test branch থেকে PR খুলুন।
2. `E2E` workflow `pull_request` event-এ শুরু হয়েছে কি না দেখুন।
3. PR-এর Checks tab-এ সফল check run-এর সঠিক নাম দেখুন। বর্তমান job-এর API check-run name `Playwright E2E`।
4. Branch protection/ruleset-এ সেই একই check required আছে কি না নিশ্চিত করুন। ভুল বা পুরোনো নাম required করলে GitHub check-কে “Expected” দেখিয়ে merge আটকে দিতে পারে।
5. `main`-এ নতুন commit এলে strict mode PR branch update ও নতুন checks বাধ্য করবে।

লোকাল equivalent:

```bash
npm ci
npm run test:backend
npm run test:e2e
```

## Safety ও বর্তমান build caveat

- Playwright suite Google Apps Script call intercept/mock করে; production order বা Sheet write করে না। Apps Script contract tests source-এর GET/POST route, rate-limit fallback এবং copy/paste source synchronization যাচাই করে।
- `workflow_dispatch`-এর optional `target_url` HTTPS storefront smoke run-এও Apps Script calls mock থাকে; production order write test-এর আওতায় নেই।
- **`pages build and deployment` check-টিকে এখন required করবেন না।** 2026-10-17-এ merge commit-সহ আগের main commits-এও Jekyll build `FILTER-UX-REDESIGN-PLAN.md`-এর `{% render %}`-এ `Unknown tag 'render'` ত্রুটিতে ব্যর্থ হয়েছে। এটি E2E check থেকে আলাদা বিদ্যমান GitHub Pages build issue; active storefront deployment আলাদাভাবে যাচাই করতে হবে। Jekyll issue ঠিক হওয়ার পর চাইলে ওই check-ও required করুন।
- Ruleset enforce করার আগে admin bypass, approval count এবং জরুরি release process স্থির করুন।

## যাচাই

GitHub UI-তে ruleset-এর status `Active` এবং target `main` দেখুন। পরবর্তী PR-এ `Playwright E2E` complete না হওয়া পর্যন্ত merge button blocked থাকা উচিত। Repository admin চাইলে read-only verification করতে পারেন:

```bash
gh api repos/muslim-abaya-landingpage/Luxury-Dress-BD/branches/main/protection \
  --jq '{required_status_checks, enforce_admins, required_pull_request_reviews}'
```

`Branch not protected` response মানে legacy branch-protection rule নেই; Rulesets ব্যবহৃত হলে **Settings → Rules → Rulesets**-এও Active state যাচাই করুন।
