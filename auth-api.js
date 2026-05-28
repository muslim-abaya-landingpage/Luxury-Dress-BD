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
    if (!API_URL) return Promise.reject(new Error("AUTH_API_MISSING"));
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
    if (!name || name.length < 2) return Promise.reject(new Error("INVALID_NAME"));
    if (!phone) return Promise.reject(new Error("INVALID_PHONE"));
    if (!email) return Promise.reject(new Error("INVALID_EMAIL"));
    if (!passCheck.ok) return Promise.reject(new Error(passCheck.message || "WEAK_PASSWORD"));
    if (!S.guardSubmit || !S.guardSubmit("register", 2500)) {
      return Promise.reject(new Error("অল্পক্ষণ অপেক্ষা করুন।"));
    }
    return apiPost({
      RecordType: "AuthRegister",
      Name: name,
      Phone: phone,
      Email: email,
      Password: data.password,
      Source: "signup.html"
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "REGISTER_FAILED");
      saveSession(res);
      return res;
    });
  }

  function login(data) {
    var S = sec();
    var loginId = S.sanitizeText ? S.sanitizeText(data.login, 120) : String(data.login || "").trim();
    var password = String(data.password || "");
    if (!loginId || !password) return Promise.reject(new Error("MISSING_FIELDS"));
    if (!S.guardSubmit || !S.guardSubmit("login", 2000)) {
      return Promise.reject(new Error("অল্পক্ষণ অপেক্ষা করুন।"));
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
    if (!fields.Email && !fields.Phone) return Promise.reject(new Error("INVALID_LOGIN"));
    return apiPost(fields).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "LOGIN_FAILED");
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
    logout: logout,
    getSession: getSession,
    verifySession: verifySession,
    isLoggedIn: isLoggedIn
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
