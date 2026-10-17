# Social sign-in setup

The sign-in and account-creation pages show Google and Facebook controls. A provider stays disabled until its required client configuration is present. Email/password sign-in remains available at all times.

## Google

1. Create a **Web application** OAuth client in Google Cloud Console and add `https://muslimabaya.com` (and `https://www.muslimabaya.com` if used) as an authorized JavaScript origin.
2. Set `window.MA_GOOGLE_CLIENT_ID` in `site-api-config.js` to the client ID.
3. Set the same value as the `GOOGLE_CLIENT_ID` Script Property in Apps Script, then deploy a new web-app version.
4. The browser uses the official Google Identity Services button. The backend verifies the ID token, audience, issuer, expiry, and verified email before issuing a site session.

## Facebook

1. In Meta for Developers, create an app and add the **Facebook Login** product. Configure the site's app domain and JavaScript SDK allowed domain as `muslimabaya.com` (include `www.muslimabaya.com` only if that hostname is used).
2. Request only `public_profile` and `email`. The flow requires Facebook to return an email address so an existing account can be matched safely; users who do not share an email can use email/password sign-in.
3. Put the public App ID in `window.MA_FACEBOOK_APP_ID` in `site-api-config.js`.
4. In Apps Script → Project Settings → Script Properties, set:
   - `AUTH_SECRET` — existing customer-session signing secret.
   - `FACEBOOK_LOGIN_APP_ID` — the same App ID used on the website.
   - `FACEBOOK_LOGIN_APP_SECRET` — the Meta App Secret.
5. Deploy a new Apps Script web-app version after updating `apps-script/Code.gs` and its Script Properties.

The App Secret must never be placed in browser JavaScript, HTML, a URL, or a repository file. The browser sends its short-lived access token by POST; Apps Script asks Meta's `debug_token` endpoint to verify token validity, app ID, Facebook user ID, and expiry, then confirms that the `/me` profile matches that Facebook user ID. The server matches or creates the customer by normalized email and rejects blocked accounts. It never stores the provider access token in the customer sheet or site session.

## Local verification

- Without provider IDs, both buttons remain visibly disabled and neither provider SDK is downloaded.
- With the Google client ID configured, the official Google button appears inside the neumorphic control surface.
- With the Facebook App ID configured, Facebook Login initializes; successful tokens still require the matching Apps Script Script Properties and deployed `AuthFacebook` handler.
- Check invalid fields on both pages: field-level messages appear, the first invalid field receives focus, and the form is not submitted.
