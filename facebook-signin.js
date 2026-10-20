/** Facebook Login SDK integration; no third-party script loads before an App ID is configured. */
(function (g) {
  "use strict";
  var doc = g.document;
  var button = doc.getElementById("maFacebookButton");
  var form = doc.getElementById("signinForm") || doc.getElementById("signupForm");
  if (!button || !form) return;

  var appId = String(g.MA_FACEBOOK_APP_ID || "").trim();
  var social = g.MaSocialUI;
  var params = new URLSearchParams(g.location.search);
  var next = params.get("next") || "/";
  var busy = false;

  if (!appId || !g.MaAuth || typeof g.MaAuth.loginWithFacebook !== "function") {
    button.disabled = true;
    button.title = "Facebook sign-in needs provider configuration.";
    if (social) social.setProviderState("facebook", "disabled");
    return;
  }

  if (social) social.setProviderState("facebook", "loading");
  button.disabled = true;
  g.fbAsyncInit = function () {
    if (!g.FB || typeof g.FB.init !== "function") {
      if (social) social.message("Facebook sign-in could not start. Email sign-in is still available.", "error");
      if (social) social.setProviderState("facebook", "disabled");
      return;
    }
    g.FB.init({ appId: appId, cookie: true, xfbml: false, version: "v25.0" });
    button.disabled = false;
    if (social) social.setProviderState("facebook", "ready");
  };

  button.addEventListener("click", function () {
    if (busy || !g.FB || button.disabled) return;
    busy = true;
    button.disabled = true;
    if (social) social.message("Connecting to Facebook…", "pending");
    g.FB.login(function (response) {
      var accessToken = response && response.authResponse && response.authResponse.accessToken;
      if (!accessToken) {
        busy = false;
        button.disabled = false;
        if (social) social.message("Facebook sign-in was cancelled. You can try again or use email.", "error");
        return;
      }
      g.MaAuth.loginWithFacebook(accessToken)
        .then(function () {
          if (social) social.message("Signed in — redirecting…", "pending");
          g.location.href = next;
        })
        .catch(function (err) {
          busy = false;
          button.disabled = false;
          if (social) social.message((err && err.message) || "Facebook sign-in failed. Please try again.", "error");
        });
    }, { scope: "email,public_profile", return_scopes: true });
  });

  var script = doc.createElement("script");
  script.id = "facebook-jssdk";
  script.src = "https://connect.facebook.net/en_US/sdk.js";
  script.async = true;
  script.defer = true;
  script.onerror = function () {
    button.disabled = true;
    if (social) social.message("Facebook sign-in could not load. Email sign-in is still available.", "error");
    if (social) social.setProviderState("facebook", "disabled");
  };
  doc.head.appendChild(script);
})(window);
