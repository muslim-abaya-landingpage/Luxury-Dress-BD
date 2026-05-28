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
