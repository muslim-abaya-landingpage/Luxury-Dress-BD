/**
 * Muslim Abaya — Admin API (Apps Script)
 */
(function (g) {
  var cfg = g.MA_ADMIN_CONFIG || {};
  var API_URL = cfg.apiUrl || "";
  var SESSION_KEY = cfg.sessionKey || "ma_admin_session";
  var SESSION_MS = (cfg.sessionDays || 7) * 24 * 60 * 60 * 1000;

  // নতুন উন্নতি: টাইমআউট ফাংশন (১০ সেকেন্ডের বেশি সময় নিলে রিজেক্ট হবে)
  function timeoutPromise(ms, promise) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () { reject(new Error("REQUEST_TIMEOUT")); }, ms);
      promise.then(resolve, reject);
    });
  }

  function apiPost(fields) {
    if (!API_URL) return Promise.reject(new Error("API_MISSING"));
    
    var body = new URLSearchParams();
    Object.keys(fields).forEach(function (k) {
      if (fields[k] != null && fields[k] !== "") body.append(k, String(fields[k]));
    });

    // timeoutPromise এর মাধ্যমে ফেচ কল করা
    return timeoutPromise(10000, fetch(API_URL, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      body: body
    })).then(function (res) {
      return res.text();
    }).then(function (text) {
      var raw = String(text || "").trim();
      try {
        return JSON.parse(raw);
      } catch (e) {
        if (raw === "Success") {
          return {
            ok: false,
            error: "DEPLOY_OLD",
            message: "API পুরনো ভার্সন। Apps Script → Deploy → New version করুন।"
          };
        }
        return { ok: false, error: raw || "UNKNOWN", message: raw };
      }
    }).catch(function(err) {
      return { ok: false, error: "NETWORK_FAILURE", message: err.message };
    });
  }

  function saveSession(data) {
    var session = {
      token: data.token,
      email: data.email || "",
      phone: data.phone || "",
      name: data.name || "",
      role: "admin",
      expires: data.expires || Date.now() + SESSION_MS,
      sheetUrl: data.sheetUrl || "",
      scriptUrl: data.scriptUrl || cfg.scriptProjectUrl || ""
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {}
    return session;
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.token || s.role !== "admin") return null;
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

  function login(data) {
    var loginId = String(data.login || "").trim();
    var password = String(data.password || "");
    if (!loginId || !password) return Promise.reject(new Error("MISSING_FIELDS"));
    
    var fields = {
      RecordType: "AdminLogin",
      Password: password
    };
    
    // উন্নতি: ফোন নাম্বার ফরম্যাটিং আরও আধুনিক করা হয়েছে
    if (loginId.indexOf("@") !== -1) fields.Email = loginId.toLowerCase();
    else fields.Phone = loginId.replace(/\D/g, "").replace(/^(?:880|88|0)/, "0");
    
    if (!fields.Email && !fields.Phone) return Promise.reject(new Error("INVALID_LOGIN"));
    
    return apiPost(fields).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "LOGIN_FAILED");
      saveSession(res);
      return getSession();
    });
  }

  function verifySession() {
    var s = getSession();
    if (!s || !s.token) return Promise.resolve(null);
    return apiPost({
      RecordType: "AdminVerify",
      Token: s.token
    }).then(function (res) {
      if (!res.ok || res.role !== "admin") {
        logout();
        return null;
      }
      saveSession(res);
      return getSession();
    });
  }

  function fetchOrders(limit) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({
      RecordType: "AdminOrders",
      Token: s.token,
      Limit: limit || 80
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "ORDERS_FAILED");
      if (res.sheetUrl) {
        s.sheetUrl = res.sheetUrl;
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        } catch (e) {}
      }
      return res;
    });
  }

  g.MaAdmin = {
    login: login,
    logout: logout,
    getSession: getSession,
    verifySession: verifySession,
    fetchOrders: fetchOrders,
    isLoggedIn: function () {
      return !!getSession();
    }
  };
})(window);
