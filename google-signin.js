/** Google Identity Services integration for the shared account pages. */
(function (g) {
  "use strict";
  var doc = g.document;
  var form = doc.getElementById("signinForm") || doc.getElementById("signupForm");
  if (!form) return;

  var clientId = String(g.MA_GOOGLE_CLIENT_ID || "").trim();
  var fallback = doc.getElementById("maGoogleFallback");
  var host = doc.getElementById("maGoogleButtonHost");
  var params = new URLSearchParams(g.location.search);
  var next = params.get("next") || "checkout.html";
  var social = g.MaSocialUI;

  if (!clientId || !g.MaAuth || typeof g.MaAuth.loginWithGoogle !== "function" || !host) {
    if (fallback) {
      fallback.disabled = true;
      fallback.title = "Google sign-in needs provider configuration.";
    }
    if (social) social.setProviderState("google", "disabled");
    return;
  }

  if (social) social.setProviderState("google", "loading");
  var busy = false;

  function onCredential(response) {
    if (!response || !response.credential || busy) return;
    busy = true;
    if (social) social.message("Signing in with Google…", "pending");
    g.MaAuth.loginWithGoogle(response.credential)
      .then(function () {
        if (social) social.message("Signed in — redirecting…", "pending");
        g.location.href = next;
      })
      .catch(function (err) {
        busy = false;
        if (social) social.message((err && err.message) || "Google sign-in failed. Please try again.", "error");
      });
  }

  function render() {
    if (!g.google || !g.google.accounts || !g.google.accounts.id) {
      if (social) social.message("Google sign-in could not load. Email sign-in is still available.", "error");
      if (social) social.setProviderState("google", "disabled");
      return;
    }
    try {
      g.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      host.hidden = false;
      g.google.accounts.id.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.max(120, Math.floor(host.getBoundingClientRect().width || 180))
      });
      if (fallback) fallback.hidden = true;
      if (social) social.setProviderState("google", "ready");
    } catch (err) {
      if (host) host.hidden = true;
      if (fallback) fallback.disabled = true;
      if (social) social.message("Google sign-in could not start. Email sign-in is still available.", "error");
      if (social) social.setProviderState("google", "disabled");
    }
  }

  var script = doc.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = render;
  script.onerror = function () {
    if (social) social.message("Google sign-in could not load. Email sign-in is still available.", "error");
    if (social) social.setProviderState("google", "disabled");
  };
  doc.head.appendChild(script);
})(window);
