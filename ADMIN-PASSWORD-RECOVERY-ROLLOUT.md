# Muslim Abaya — Admin password recovery rollout

**Scope:** \`muslimabaya.com/admin-login.html\` and the *existing* **অর্ডার শীট** Google Apps Script Web App. No Cloudflare D1, order, stock, or customer-password change.

## What is included

- \`admin-login.html\`: Bengali **পাসওয়ার্ড ভুলে গেছেন?** link.
- \`admin-forgot-password.html\`: email-based recovery request, always returns a generic account-existence-safe message.
- \`admin-reset-password.html\`: single-use, 20-minute recovery link form. Reset secret is placed after a URL fragment (\`#\`) and promptly removed from history; no third-party page resources.
- \`admin-api.js\`: public \`requestPasswordReset()\` and \`confirmPasswordReset()\` transport calls.
- \`apps-script/AdminPasswordRecovery.gs\`: backend challenge issuance, hashed token verification, five-minute per-email cooldown, global rate cap, owner/staff credential rotation, old admin/staff session revocation.
- \`apps-script/Code.gs\`: routing into the recovery handler.

## Mandatory Apps Script install BEFORE merging this PR

1. Back up the current Apps Script project and **Admins** / **Sessions** sheets. Make sure **AUTH_SECRET** already exists in Script Properties; do not copy it into the repository.
2. Open the Apps Script project that powers the live \`MA_SITE_API.url\` from \`site-api-config.js\` (the existing Web App URL; do not create a new Web App).
3. **Files → + → Script** and name the new file **AdminPasswordRecovery**. Copy the entire contents of \`apps-script/AdminPasswordRecovery.gs\` into it.
4. In the currently deployed \`Code.gs\` file, inside \`doPost(e)\`, immediately after \`var type = param_(e, 'RecordType');\`, add the following block, **once**:
   \`\`\`js
   if (type === 'AdminPasswordResetRequest' || type === 'AdminPasswordResetConfirm') {
     return jsonOut_(adminPasswordRecoveryHandle_(type, e));
   }
   \`\`\`
   If the live \`Code.gs\` differs from GitHub, **do not overwrite the whole file**; merge only this block.
5. Save and authorize **MailApp** send permission if requested; mail is sent only to an active account's registered \`Admins\` sheet email. The recovery endpoint does not create any new admin account.
6. **Deploy → Manage deployments → select the currently used Web App → Edit → New version → Deploy**. Retain exactly the same Web App URL.

## QA and safe rollout

1. With a safe admin or staff test mailbox in \`Admins\`, request one reset link. Check that a real email arrives, and the link points to \`https://muslimabaya.com/admin-reset-password.html#...\`.
2. **Before** merging the frontend, the landing page URL won't exist yet. Optionally inspect the link/token in a controlled backend test, or deploy frontend as a preview first. Never send this secret to anyone.
3. Verify an unknown/blocked address gets the same generic reply but receives no email.
4. Verify that a wrong/expired/used link cannot change a password; verify a new password shorter than 12 characters is rejected.
5. After updating the password, confirm that an old admin/staff token is rejected and the new password works. Only use a controlled test account and have a recovery plan.
6. Once backend QA and review succeed, merge this PR to Cloudflare Pages production and verify the login → forgot password → email → reset → login flow.
7. Monitor Apps Script execution logs for mail quota or authorization failures. The success response does not prove mail delivery.
8. If the mail service is unavailable or the owner mailbox is lost, the existing **Google Sheets → Muslim Abaya → Admin password reset** menu can be used by the authorized spreadsheet owner as an emergency fallback.

**Safety:** Do not deploy the frontend before the backend is installed. Do not delete existing accounts or sessions manually. No production passwords or reset tokens should be put in issues, screenshots, build logs or chats.
