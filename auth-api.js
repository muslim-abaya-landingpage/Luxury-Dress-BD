(function (g) {
  var cfg = g.MA_AUTH_CONFIG || {};
  var API_URL = cfg.apiUrl || "";
  var SESSION_KEY = cfg.sessionKey || "ma_auth_session";
  var CUSTOMER_KEY = cfg.customerKey || "ma_customer";
  var SESSION_MS = (cfg.sessionDays || 30) * 24 * 60 * 60 * 1000;

  function sec() {
    return g.MaSecurity || {};
  }

  function apiPost(fields) {
    if (!API_URL) return Promise.reject(codeError("AUTH_API_MISSING"));
    var body = new URLSearchParams();
    Object.keys(fields).forEach(function (k) {
      if (fields[k] != null && fields[k] !== "") body.append(k, String(fields[k]));
    });
    return fetch(API_URL, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      body: body
    })
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        try {
          return JSON.parse(text);
        } catch (e) {
          if (text === "Success") return { ok: true, legacy: true };
          return { ok: false, error: text || "UNKNOWN" };
        }
      });
  }

  function codeError(code, message) {
    var e = new Error(message || code);
    e.code = code;
    return e;
  }

  function apiError(res, fallback) {
    return codeError((res && res.error) || fallback, (res && (res.message || res.error)) || fallback);
  }

  // Customer-facing wording for server and network errors (codes never reach the screen).
  var ERROR_TEXT = {
    INVALID_PASSWORD: "That password is not right. Try again, or use Forgot password.",
    NOT_FOUND: "No account uses this email or mobile number. Check it, or create an account.",
    BLOCKED: "This account cannot sign in. Please contact us on WhatsApp.",
    MISSING_FIELDS: "Enter your email or mobile number and your password.",
    INVALID_LOGIN: "Enter a valid email or 11-digit mobile number (01XXXXXXXXX).",
    INVALID_NAME: "Enter your full name.",
    INVALID_PHONE: "Enter a valid 11-digit mobile number (01XXXXXXXXX).",
    INVALID_EMAIL: "Enter a valid email address.",
    TOO_FAST: "Please wait a moment and try again.",
    RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
    NETWORK: "Could not connect. Check your internet and try again.",
    UNAVAILABLE: "Sign-in is not available right now. Please try again in a minute."
  };

  function errorText(err, fallback) {
    var code = (err && err.code) || "";
    if (!code && err && err.name === "TypeError") code = "NETWORK";
    if (/^(AUTH_NOT_CONFIGURED|AUTH_API_MISSING|GOOGLE_NOT_CONFIGURED|FACEBOOK_NOT_CONFIGURED|.*_VERIFY_FAILED|UNKNOWN)$/.test(code)) code = "UNAVAILABLE";
    if (/^INVALID_(GOOGLE|FACEBOOK)_TOKEN$/.test(code)) return fallback || "Sign-in did not finish. Please try again.";
    if (ERROR_TEXT[code]) return ERROR_TEXT[code];
    if (code === "LIMIT" || /RATE/.test(code)) return ERROR_TEXT.RATE_LIMITED;
    return fallback || "Sign-in failed. Please try again.";
  }

  // Only same-site paths may be used as the page to return to after signing in.
  function safeNext(raw, fallback) {
    fallback = fallback || "/";
    if (!raw) return fallback;
    try {
      var u = new URL(String(raw), g.location.origin);
      if (u.origin !== g.location.origin || !/^https?:$/.test(u.protocol)) return fallback;
      if (/^\/(signin|signup|forgot-password)(\.html)?$/.test(u.pathname)) return fallback;
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return fallback;
    }
  }

  function saveSession(data) {
    var session = {
      token: data.token,
      email: data.email || "",
      phone: data.phone || "",
      name: data.name || "",
      expires: data.expires || Date.now() + SESSION_MS
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(
        CUSTOMER_KEY,
        JSON.stringify({
          name: session.name,
          phone: session.phone,
          email: session.email
        })
      );
    } catch (err) {}
    return session;
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.token) return null;
      if (s.expires && Date.now() > s.expires) {
        logout();
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function logout() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function register(data) {
    var S = sec();
    var name = S.sanitizeText ? S.sanitizeText(data.name, 80) : String(data.name || "").trim();
    var phone = S.normalizePhoneBd ? S.normalizePhoneBd(data.phone) : data.phone;
    var email = S.validateEmail ? S.validateEmail(data.email) : data.email;
    var passCheck = S.checkPasswordStrength
      ? S.checkPasswordStrength(data.password)
      : { ok: String(data.password || "").length >= 8 };
    if (!name || name.length < 2) return Promise.reject(codeError("INVALID_NAME"));
    if (!phone) return Promise.reject(codeError("INVALID_PHONE"));
    if (!email) return Promise.reject(codeError("INVALID_EMAIL"));
    if (!passCheck.ok) return Promise.reject(new Error(passCheck.message || "WEAK_PASSWORD"));
    if (!S.guardSubmit || !S.guardSubmit("register", 2500)) {
      return Promise.reject(codeError("TOO_FAST"));
    }
    return apiPost({
      RecordType: "AuthRegister",
      Name: name,
      Phone: phone,
      Email: email,
      Password: data.password,
      Source: "signup.html"
    }).then(function (res) {
      if (!res.ok) throw apiError(res, "REGISTER_FAILED");
      saveSession(res);
      return res;
    });
  }

  function login(data) {
    var S = sec();
    var loginId = S.sanitizeText ? S.sanitizeText(data.login, 120) : String(data.login || "").trim();
    var password = String(data.password || "");
    if (!loginId || !password) return Promise.reject(codeError("MISSING_FIELDS"));
    if (!S.guardSubmit || !S.guardSubmit("login", 2000)) {
      return Promise.reject(codeError("TOO_FAST"));
    }
    var fields = {
      RecordType: "AuthLogin",
      Password: password,
      Source: "signin.html"
    };
    if (loginId.indexOf("@") !== -1) {
      fields.Email = (S.validateEmail ? S.validateEmail(loginId) : loginId.toLowerCase()) || loginId;
    } else {
      fields.Phone = S.normalizePhoneBd ? S.normalizePhoneBd(loginId) : loginId;
    }
    if (!fields.Email && !fields.Phone) return Promise.reject(codeError("INVALID_LOGIN"));
    return apiPost(fields).then(function (res) {
      if (!res.ok) throw apiError(res, "LOGIN_FAILED");
      saveSession(res);
      return res;
    });
  }

  function loginWithGoogle(idToken) {
    if (!idToken) return Promise.reject(codeError("MISSING_FIELDS"));
    return apiPost({
      RecordType: "AuthGoogle",
      IdToken: idToken,
      Source: "google"
    }).then(function (res) {
      if (!res.ok) throw apiError(res, "GOOGLE_LOGIN_FAILED");
      saveSession(res);
      return res;
    });
  }

  function loginWithFacebook(accessToken) {
    if (!accessToken) return Promise.reject(codeError("MISSING_FIELDS"));
    return apiPost({
      RecordType: "AuthFacebook",
      AccessToken: accessToken,
      Source: "facebook"
    }).then(function (res) {
      if (!res.ok) throw apiError(res, "FACEBOOK_LOGIN_FAILED");
      saveSession(res);
      return res;
    });
  }

  function verifySession() {
    var s = getSession();
    if (!s || !s.token) return Promise.resolve(null);
    return apiPost({
      RecordType: "AuthVerify",
      Token: s.token
    }).then(function (res) {
      if (!res.ok) {
        logout();
        return null;
      }
      saveSession(res);
      return getSession();
    });
  }

  function isLoggedIn() {
    return !!getSession();
  }

  g.MaAuth = {
    register: register,
    login: login,
    loginWithGoogle: loginWithGoogle,
    loginWithFacebook: loginWithFacebook,
    logout: logout,
    getSession: getSession,
    verifySession: verifySession,
    isLoggedIn: isLoggedIn,
    safeNext: safeNext,
    errorText: errorText
  };

  g.AuthSheets = {
    submitRegister: function (data) {
      return register(data);
    },
    submitLogin: function (data) {
      return login({ login: data.login, password: data.password });
    }
  };
})(window);
