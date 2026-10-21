/* Sign-in page: email/mobile + password form. */
(function (g) {
  "use strict";
  var doc = g.document;
  var form = doc.getElementById("signinForm");
  var auth = g.MaAuth;
  if (!form || !auth) return;

  var params = new URLSearchParams(g.location.search);
  var next = auth.safeNext(params.get("next"), "/");

  // Already signed in: go straight on instead of showing the form again.
  if (auth.isLoggedIn()) {
    g.location.replace(next);
    return;
  }

  var signupLink = doc.getElementById("signupLink");
  if (signupLink && params.get("next")) signupLink.href = "/signup?next=" + encodeURIComponent(next);

  var msg = doc.getElementById("signinMsg");
  var btn = doc.getElementById("signinBtn");
  var loginInput = doc.getElementById("si-login");
  var passInput = doc.getElementById("si-pass");
  var label = btn.textContent;

  function show(text, kind) {
    msg.className = "form-msg" + (kind ? " is-" + kind : "");
    msg.textContent = text || "";
  }

  function busy(on) {
    btn.disabled = on;
    btn.setAttribute("aria-busy", on ? "true" : "false");
    if (on) btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Signing in…</span>';
    else btn.textContent = label;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    // auth-validation.js marks empty or malformed fields and focuses the first one.
    if (form.querySelector(".am-field.is-invalid")) return;
    var login = loginInput.value.trim();
    var pass = passInput.value;
    if (!login || !pass) return;
    show("");
    busy(true);
    auth.login({ login: login, password: pass })
      .then(function () {
        show("Signed in. Taking you back…", "ok");
        g.location.replace(next);
      })
      .catch(function (err) {
        busy(false);
        show(auth.errorText(err), "error");
        if (err && err.code === "INVALID_PASSWORD") {
          passInput.select();
          passInput.focus();
        } else if (err && (err.code === "NOT_FOUND" || err.code === "INVALID_LOGIN")) {
          loginInput.focus();
        }
      });
  });
})(window);
