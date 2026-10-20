/**
 * Muslim Abaya — Google Apps Script Web App URL (এক জায়গায়)
 *
 * ১. script.google.com → অর্ডার শিট প্রজেক্ট
 * ২. Deploy → Web app → Anyone → URL কপি
 * ৩. নিচের url এ পেস্ট করুন
 *
 * AUTH_SECRET কখনো এখানে লিখবেন না — শুধু Apps Script → Project Settings
 */
window.MA_SITE_API = {
  url: "https://script.google.com/macros/s/AKfycbxZv7KU0JMY90576HoRF8wtHmEgW2ggkTxAoQKjO6on1cactlDgJDhoRLndCh3kK_hz/exec"
};

window.getSiteApiUrl = function () {
  return (window.MA_SITE_API && window.MA_SITE_API.url) || "";
};

/**
 * Sign in with Google (optional). Leave "" to keep Google authentication switched off.
 * To enable: Google Cloud Console -> APIs & Services -> Credentials -> OAuth client ID
 * (Web application), add https://muslimabaya.com as an Authorized JavaScript origin, paste the
 * client ID here, and set the same value as script property GOOGLE_CLIENT_ID in Apps Script
 * (then Deploy -> New version).
 */
window.MA_GOOGLE_CLIENT_ID = window.MA_GOOGLE_CLIENT_ID || "839440319456-inanmbciqnj4h22o24fsleduv92rqpt6.apps.googleusercontent.com";

/**
 * Sign in with Facebook (optional). The App ID is public; keep the App Secret only in
 * Google Apps Script Script Properties as FACEBOOK_LOGIN_APP_SECRET.
 */
window.MA_FACEBOOK_APP_ID = window.MA_FACEBOOK_APP_ID || "3992256867596731";
