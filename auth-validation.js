/* Accessible client-side validation for the sign-in and account-creation forms. */
(function (g) {
  "use strict";

  var doc = g.document;
  var form = doc.getElementById("signinForm") || doc.getElementById("signupForm") || doc.getElementById("forgotForm");
  if (!form) return;
  var isSignup = form.id === "signupForm";
  var isForgot = form.id === "forgotForm";
  var security = g.MaSecurity || {};
  var fields = isSignup
    ? ["su-name", "su-mobile", "su-email", "su-pass", "su-confirm"]
    : isForgot ? ["fp-login"] : ["si-login", "si-pass"];

  function valueOf(id) {
    var input = doc.getElementById(id);
    return input ? String(input.value || "") : "";
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isPhone(value) {
    if (typeof security.normalizePhoneBd === "function") return !!security.normalizePhoneBd(value);
    var digits = value.replace(/\D/g, "");
    if (digits.indexOf("880") === 0) digits = "0" + digits.slice(3);
    if (digits.length === 10 && digits.charAt(0) === "1") digits = "0" + digits;
    return /^01\d{9}$/.test(digits);
  }

  function errorFor(id) {
    var value = valueOf(id).trim();
    if (id === "si-login") {
      if (!value) return "Enter your email or mobile number.";
      if (value.indexOf("@") >= 0) return isEmail(value) ? "" : "Enter a valid email address.";
      return isPhone(value) ? "" : "Enter a valid Bangladesh mobile number.";
    }
    if (id === "fp-login") {
      if (!value) return "Enter your email or mobile number.";
      if (value.indexOf("@") >= 0) return isEmail(value) ? "" : "Enter a valid email address.";
      return isPhone(value) ? "" : "Enter a valid Bangladesh mobile number.";
    }
    if (id === "si-pass") return valueOf(id) ? "" : "Enter your password.";
    if (id === "su-name") return value.length >= 2 ? "" : "Please enter your full name.";
    if (id === "su-mobile") return isPhone(value) ? "" : "Enter a valid 11-digit mobile number (01XXXXXXXXX).";
    if (id === "su-email") {
      var email = typeof security.validateEmail === "function" ? security.validateEmail(value) : (isEmail(value) ? value : "");
      return email ? "" : "Enter a valid email address.";
    }
    if (id === "su-pass") {
      var password = valueOf(id);
      if (password.length < 8) return "Use at least 8 characters.";
      if (/\s/.test(password)) return "Remove spaces from your password.";
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
      if (typeof security.checkPasswordStrength === "function") {
        var strength = security.checkPasswordStrength(password);
        if (!strength.ok) return strength.message || "Choose a stronger password.";
      }
      return "";
    }
    if (id === "su-confirm") {
      if (!valueOf(id)) return "Please confirm your password.";
      return valueOf(id) === valueOf("su-pass") ? "" : "Passwords do not match.";
    }
    return "";
  }

  function describedBy(input, errorId, includeError) {
    var ids = String(input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    ids = ids.filter(function (id) { return id !== errorId; });
    if (includeError) ids.push(errorId);
    if (ids.length) input.setAttribute("aria-describedby", ids.join(" "));
    else input.removeAttribute("aria-describedby");
  }

  function setError(id, message, animate) {
    var input = doc.getElementById(id);
    var field = input && input.closest(".am-field");
    if (!input || !field) return;
    var errorId = id + "Error";
    var error = doc.getElementById(errorId);

    if (!message) {
      field.classList.remove("is-invalid", "has-error-pulse");
      input.setAttribute("aria-invalid", "false");
      describedBy(input, errorId, false);
      if (error) error.textContent = "";
      return;
    }

    if (!error) {
      error = doc.createElement("p");
      error.className = "am-field-error";
      error.id = errorId;
      error.setAttribute("role", "status");
      error.setAttribute("aria-live", "polite");
      var inputWrap = field.querySelector(".am-input");
      if (inputWrap && inputWrap.parentNode) inputWrap.parentNode.insertBefore(error, inputWrap.nextSibling);
      else field.appendChild(error);
    }
    field.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    describedBy(input, errorId, true);
    error.textContent = message;

    if (animate) {
      field.classList.remove("has-error-pulse");
      void field.offsetWidth;
      field.classList.add("has-error-pulse");
      g.setTimeout(function () { field.classList.remove("has-error-pulse"); }, 420);
    }
  }

  function validate(id, animate) {
    var message = errorFor(id);
    setError(id, message, animate);
    return !message;
  }

  fields.forEach(function (id) {
    var input = doc.getElementById(id);
    if (!input) return;
    input.addEventListener("blur", function () { validate(id, false); });
    input.addEventListener("input", function () {
      var field = input.closest(".am-field");
      if (field && field.classList.contains("is-invalid")) validate(id, false);
      if (id === "su-pass") {
        var confirmField = doc.getElementById("su-confirm");
        if (confirmField && confirmField.closest(".am-field").classList.contains("is-invalid")) validate("su-confirm", false);
      }
    });
  });

  form.addEventListener("submit", function (event) {
    var invalid = [];
    fields.forEach(function (id) {
      if (!validate(id, false)) invalid.push(id);
    });
    if (!invalid.length) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    invalid.forEach(function (id, index) { validate(id, index === 0); });
    var first = doc.getElementById(invalid[0]);
    if (first) {
      first.focus();
      if (typeof first.scrollIntoView === "function") {
        first.scrollIntoView({ block: "center", behavior: g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }
  }, true);
})(window);
