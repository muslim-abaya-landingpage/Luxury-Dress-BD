/**
 * Admin প্যানেল — লিংক ও সেটিং (গোপন key এখানে নয়)
 */
(function (g) {
  var apiUrl = typeof g.getSiteApiUrl === "function" ? g.getSiteApiUrl() : "";
  if (!apiUrl && g.MA_SITE_API && g.MA_SITE_API.url) apiUrl = g.MA_SITE_API.url;

  var scriptProjectId = "1LFd_vDAiSJMdWrHJf2s_7fEVVxTt6g6q8cEVWfhVJhYJN-xpNcTFExCD";

  g.MA_ADMIN_CONFIG = {
    apiUrl: apiUrl,
    sessionKey: "ma_admin_session",
    sessionDays: 7,
    scriptProjectUrl:
      "https://script.google.com/home/projects/" + scriptProjectId + "/edit",
    apiTestUrl: apiUrl,
    userSettingsUrl: "https://script.google.com/home/usersettings",
    siteUrl: "https://muslimabaya.com/",
    checkoutUrl: "https://muslimabaya.com/checkout"
  };
})(window);
