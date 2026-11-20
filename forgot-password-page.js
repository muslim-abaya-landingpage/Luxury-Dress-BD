/* Forgot password: email a 6-digit code to the account, then set a new password with it. */
(function (g) {
  "use strict";
  var doc = g.document;
  var form = doc.getElementById("forgotForm");
  var auth = g.MaAuth;
  if (!form || !auth || typeof auth.requestCode !== "function") return;

  var loginInput = doc.getElementById("fp-login");
  var step2 = doc.getElementById("fpStep2");
  var codeInput = doc.getElementById("fp-code");
  var pass = doc.getElementById("fp-pass");
  var confirm = doc.getElementById("fp-confirm");
  var msg = doc.getElementById("forgotMsg");
  var btn = doc.getElementById("forgotBtn");
  var resend = doc.getElementById("fpResend");
  var stepText = doc.getElementById("fpStepText");
  var sentTo = "";
  var timer = null;

  var pre = new URLSearchParams(g.location.search).get("login");
  if (pre) loginInput.value = pre.slice(0, 120);

  function show(text, kind) {
    msg.className = "form-msg" + (kind ? " is-" + kind : "");
    msg.textContent = text || "";
  }
  function busy(on, text) {
    btn.disabled = on;
    btn.setAttribute("aria-busy", on ? "true" : "false");
    if (on) btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + text + "</span>";
    else btn.textContent = sentTo ? "Set new password" : "Send code";
  }
  function cooldown() {
    var left = 60;
    resend.disabled = true;
    clearInterval(timer);
    resend.textContent = "Send a new code (" + left + "s)";
    timer = setInterval(function () {
      left -= 1;
      if (left <= 0) { clearInterval(timer); resend.disabled = false; resend.textContent = "Send a new code"; return; }
      resend.textContent = "Send a new code (" + left + "s)";
    }, 1000);
  }
  function sendCode() {
    var login = loginInput.value.trim();
    if (!login) { show("Enter your email or mobile number.", "error"); loginInput.focus(); return; }
    show("");
    busy(true, "Sending…");
    auth.requestCode(login, "reset")
      .then(function (res) {
        sentTo = login;
        step2.hidden = false;
        stepText.textContent = "Enter the code from your email and choose a new password.";
        busy(false);
        show((res && res.message) || "If an account exists, a 6-digit code has been sent to its email.", "ok");
        cooldown();
        codeInput.focus();
      })
      .catch(function (err) { busy(false); show(auth.errorText(err), "error"); });
  }

  loginInput.addEventListener("input", function () {
    if (sentTo && loginInput.value.trim() !== sentTo) { sentTo = ""; step2.hidden = true; busy(false); }
  });
  codeInput.addEventListener("input", function () { codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6); });
  resend.addEventListener("click", function () { if (!resend.disabled) sendCode(); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!sentTo) { sendCode(); return; }
    var code = codeInput.value.replace(/\D/g, "");
    if (code.length !== 6) { show("Enter the 6-digit code from your email.", "error"); codeInput.focus(); return; }
    if (pass.value.length < 8 || !/[A-Za-z]/.test(pass.value) || !/\d/.test(pass.value)) { show("Use at least 8 characters, with a letter and a number.", "error"); pass.focus(); return; }
    if (pass.value !== confirm.value) { show("The two passwords do not match.", "error"); confirm.focus(); return; }
    show("");
    busy(true, "Saving…");
    auth.resetPassword(sentTo, code, pass.value)
      .then(function () {
        show("Your password has been changed. You are signed in.", "ok");
        g.setTimeout(function () { g.location.replace("/"); }, 900);
      })
      .catch(function (err) { busy(false); show(auth.errorText(err), "error"); });
  });
})(window);
