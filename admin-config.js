/**
 * Muslim Abaya — Admin API Config
 */
(function (g) {
  var apiUrl = typeof g.getSiteApiUrl === "function" ? g.getSiteApiUrl() : "";
  if (!apiUrl && g.MA_SITE_API && g.MA_SITE_API.url) apiUrl = g.MA_SITE_API.url;

  // যদি API URL না থাকে, কনসোলে একটি সতর্কবার্তা দিন
  if (!apiUrl) {
    console.warn("MA_ADMIN_CONFIG: API URL পাওয়া যায়নি। এটি চেক করুন।");
  }

  var scriptProjectId = "1LFd_vDAiSJMdWrHJf2s_7fEVVxTt6g6q8cEVWfhVJhYJN-xpNcTFExCD";

  g.MA_ADMIN_CONFIG = {
    apiUrl: apiUrl,
    sessionKey: "ma_admin_session",
    sessionDays: 7,
    debugMode: false, // টিপস: টেস্টের সময় এটিকে 'true' করে নিতে পারেন
    scriptProjectUrl: "https://script.google.com/home/projects/" + scriptProjectId + "/edit",
    siteUrl: "https://muslimabaya.com/",
    checkoutUrl: "https://muslimabaya.com/checkout",
    
    // নতুন সুবিধা: সহজ ডাইনামিক লিঙ্ক তৈরি করার ফাংশন
    getScriptEditUrl: function() {
      return this.scriptProjectUrl;
    }
  };
})(window);
