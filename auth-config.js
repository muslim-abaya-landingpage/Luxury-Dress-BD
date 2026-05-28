/**
 * Auth সেটিংস — API URL শুধু site-api-config.js এ বদলান
 */
(function () {
  var apiUrl = typeof window.getSiteApiUrl === "function" ? window.getSiteApiUrl() : "";
  if (!apiUrl && window.MA_SITE_API && window.MA_SITE_API.url) {
    apiUrl = window.MA_SITE_API.url;
  }

  window.MA_AUTH_CONFIG = {
    apiUrl: apiUrl,
    sessionKey: "ma_auth_session",
    customerKey: "ma_customer",
    sessionDays: 30
  };
})();
