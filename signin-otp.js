/* Sign in with a one-time code sent to the account's email ("Login With OTP Instead"). */
(function (g) {
  "use strict";
  var doc = g.document;
  var pwForm = doc.getElementById("signinForm");
  var form = doc.getElementById("otpForm");
  var auth = g.MaAuth;
  if (!pwForm || !form || !auth || typeof auth.requestCode !== "function") return;

  var next = auth.safeNext(new URLSearchParams(g.location.search).get("next"), "/");
  var loginInput = doc.getElementById("otp-login");
  var codeField = doc.getElementById("otpCodeField");
  var codeInput = doc.getElementById("otp-code");
  var msg = doc.getElementById("otpMsg");
  var btn = doc.getElementById("otpBtn");
  var resend = doc.getElementById("otpResend");
  var sentTo = "";
  var cooldownTimer = null;

  function show(text, kind) {
    msg.className = "form-msg" + (kind ? " is-" + kind : "");
    msg.textContent = text || "";
  }
  function busy(on, text) {
    btn.disabled = on;
    btn.setAttribute("aria-busy", on ? "true" : "false");
    if (on) btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + text + "</span>";
    else btn.textContent = sentTo ? "Verify & sign in" : "Send code";
  }
  function setMode(mode) {
    var otp = mode === "otp";
    pwForm.hidden = otp;
    form.hidden = !otp;
    var src = otp ? doc.getElementById("si-login") : loginInput;
    var dst = otp ? loginInput : doc.getElementById("si-login");
    if (src && dst && src.value && !dst.value) dst.value = src.value;
    (otp ? loginInput : dst).focus({ preventScroll: true });
    g.dispatchEvent(new Event("resize")); // let the sliding panel refit its height
    keepTop();
  }
  // The panels sit in a clipped box; focusing a field lower down must not scroll its top out of view.
  var viewport = form.closest(".si-viewport");
  function keepTop() { if (viewport) viewport.scrollTop = 0; }
  if (viewport) viewport.addEventListener("scroll", keepTop, { passive: true });

  function cooldown() {
    var left = 60;
    resend.disabled = true;
    clearInterval(cooldownTimer);
    resend.textContent = "Send a new code (" + left + "s)";
    cooldownTimer = setInterval(function () {
      left -= 1;
      if (left <= 0) { clearInterval(cooldownTimer); resend.disabled = false; resend.textContent = "Send a new code"; return; }
      resend.textContent = "Send a new code (" + left + "s)";
    }, 1000);
  }
  function sendCode() {
    var login = loginInput.value.trim();
    if (!login) { show("Enter your email or mobile number.", "error"); loginInput.focus({ preventScroll: true }); return; }
    show("");
    busy(true, "Sending…");
    auth.requestCode(login, "login")
      .then(function (res) {
        sentTo = login;
        codeField.hidden = false;
        busy(false);
        show((res && res.message) || "If an account exists, a 6-digit code has been sent to its email.", "ok");
        cooldown();
        codeInput.focus({ preventScroll: true });
        g.dispatchEvent(new Event("resize"));
      })
      .catch(function (err) { busy(false); show(auth.errorText(err), "error"); });
  }

  doc.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-si-mode]");
    if (!t) return;
    e.preventDefault();
    setMode(t.getAttribute("data-si-mode"));
  });
  loginInput.addEventListener("input", function () {
    if (sentTo && loginInput.value.trim() !== sentTo) { sentTo = ""; codeField.hidden = true; codeInput.value = ""; busy(false); }
  });
  codeInput.addEventListener("input", function () { codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6); });
  resend.addEventListener("click", function () { if (!resend.disabled) sendCode(); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!sentTo) { sendCode(); return; }
    var code = codeInput.value.replace(/\D/g, "");
    if (code.length !== 6) { show("Enter the 6-digit code from your email.", "error"); codeInput.focus({ preventScroll: true }); return; }
    show("");
    busy(true, "Signing in…");
    auth.loginWithCode(sentTo, code)
      .then(function () { show("Signed in. Taking you back…", "ok"); g.location.replace(next); })
      .catch(function (err) { busy(false); show(auth.errorText(err), "error"); codeInput.select(); codeInput.focus({ preventScroll: true }); });
  });
})(window);
