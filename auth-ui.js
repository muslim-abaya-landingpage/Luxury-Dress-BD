/* Sign in / Sign up UI helpers: show-hide password buttons and the password strength meter. */
(function () {
  "use strict";
  var doc = document;

  Array.prototype.forEach.call(doc.querySelectorAll("[data-am-eye]"), function (btn) {
    var input = doc.getElementById(btn.getAttribute("data-am-eye"));
    if (!input) return;
    btn.addEventListener("click", function () {
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      input.focus();
    });
  });

  function score(pw) {
    var s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
    return pw ? Math.max(1, s) : 0;
  }

  Array.prototype.forEach.call(doc.querySelectorAll("[data-am-meter]"), function (meter) {
    var input = doc.getElementById(meter.getAttribute("data-am-meter"));
    if (!input) return;
    var label = doc.getElementById(meter.getAttribute("data-am-meter-label") || "");
    var words = ["", "Weak", "Fair", "Good", "Strong"];
    function update() {
      var lvl = score(input.value);
      meter.setAttribute("data-level", String(lvl));
      if (label) label.textContent = lvl ? "Password strength: " + words[lvl] : "At least 8 characters.";
    }
    input.addEventListener("input", update);
    update();
  });
})();
