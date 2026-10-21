/* Sign-up page: create an account with name, mobile, email and password. */
(function (g) {
  "use strict";
  var doc = g.document;
  var form = doc.getElementById("signupForm");
  var auth = g.MaAuth;
  if (!form || !auth) return;

  var params = new URLSearchParams(g.location.search);
  var next = auth.safeNext(params.get("next"), "/");

  // Already signed in: no need to create another account.
  if (auth.isLoggedIn()) {
    g.location.replace(next);
    return;
  }

  var signinLink = doc.getElementById("signinLink");
  if (signinLink && params.get("next")) signinLink.href = "/signin?next=" + encodeURIComponent(next);

  var msg = doc.getElementById("signupMsg");
  var btn = doc.getElementById("signupBtn");
  var label = btn.textContent;
  var FIELD_FOR = { EMAIL_EXISTS: "su-email", INVALID_EMAIL: "su-email", PHONE_EXISTS: "su-mobile", INVALID_PHONE: "su-mobile", INVALID_NAME: "su-name", WEAK_PASSWORD: "su-pass" };

  function value(id) { return doc.getElementById(id).value; }

  function show(text, kind) {
    msg.className = "form-msg" + (kind ? " is-" + kind : "");
    msg.textContent = text || "";
  }

  function busy(on) {
    btn.disabled = on;
    btn.setAttribute("aria-busy", on ? "true" : "false");
    if (on) btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Creating account…</span>';
    else btn.textContent = label;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    // auth-validation.js has already flagged and focused any invalid field.
    if (form.querySelector(".am-field.is-invalid")) return;
    show("");
    busy(true);
    auth.register({
      name: value("su-name").trim(),
      phone: value("su-mobile"),
      email: value("su-email").trim().toLowerCase(),
      password: value("su-pass")
    })
      .then(function () {
        show("Account created. Taking you on…", "ok");
        g.location.replace(next);
      })
      .catch(function (err) {
        busy(false);
        show(auth.errorText(err, "Could not create the account. Please try again."), "error");
        var field = err && FIELD_FOR[err.code] && doc.getElementById(FIELD_FOR[err.code]);
        if (field) field.focus();
      });
  });
})(window);
