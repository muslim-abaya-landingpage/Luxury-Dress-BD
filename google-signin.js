/**
 * "Continue with Google" for signin.html / signup.html (Google Identity Services).
 * Does nothing unless window.MA_GOOGLE_CLIENT_ID is set (site-api-config.js), so nothing is
 * downloaded from Google and no button is shown until the owner has configured it.
 */
(function (g) {
  "use strict";
  var clientId = String(g.MA_GOOGLE_CLIENT_ID || "").trim();
  if (!clientId || !g.MaAuth || typeof g.MaAuth.loginWithGoogle !== "function") return;

  var doc = g.document;
  var form = doc.getElementById("signinForm") || doc.getElementById("signupForm");
  if (!form) return;

  var params = new URLSearchParams(g.location.search);
  var next = params.get("next") || "checkout.html";

  var box = doc.createElement("div");
  box.id = "maGoogleBox";
  box.style.cssText = "text-align:center";
  var btnHost = doc.createElement("div");
  btnHost.style.cssText = "display:flex;justify-content:center;min-height:44px";
  var msg = doc.createElement("p");
  msg.className = "form-msg";
  msg.setAttribute("role", "status");
  var or = doc.createElement("div");
  or.className = "am-or";
  or.textContent = "or continue with email";
  box.appendChild(btnHost);
  box.appendChild(msg);
  box.appendChild(or);
  form.parentNode.insertBefore(box, form);

  function onCredential(resp) {
    if (!resp || !resp.credential) return;
    msg.className = "form-msg";
    msg.textContent = "Signing in…";
    g.MaAuth.loginWithGoogle(resp.credential)
      .then(function () {
        msg.className = "form-msg is-ok";
        msg.textContent = "Signed in — redirecting...";
        g.location.href = next;
      })
      .catch(function (err) {
        msg.className = "form-msg is-error";
        msg.textContent = (err && err.message) || "Google sign-in failed. Please try again.";
      });
  }

  function init() {
    if (!g.google || !g.google.accounts || !g.google.accounts.id) return;
    g.google.accounts.id.initialize({
      client_id: clientId,
      callback: onCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    g.google.accounts.id.renderButton(btnHost, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: Math.min(300, Math.max(200, (form.clientWidth || 280)))
    });
  }

  var s = doc.createElement("script");
  s.src = "https://accounts.google.com/gsi/client";
  s.async = true;
  s.defer = true;
  s.onload = init;
  s.onerror = function () { box.style.display = "none"; };
  doc.head.appendChild(s);
})(window);
