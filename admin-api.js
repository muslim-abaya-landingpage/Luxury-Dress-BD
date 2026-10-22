/**
 * Muslim Abaya — Admin API (Apps Script)
 */
(function (g) {
  var cfg = g.MA_ADMIN_CONFIG || {};
  var API_URL = cfg.apiUrl || "";
  var SESSION_KEY = cfg.sessionKey || "ma_admin_session";
  var SESSION_MS = (cfg.sessionDays || 7) * 24 * 60 * 60 * 1000;

  var READ_TYPES = ['AdminCatalogState', 'AdminCatalogStatus', 'AdminOrders', 'AdminOrderList', 'AdminOrderGet', 'AdminOrderStaff',
    'AdminStockGet', 'AdminAnalytics', 'AdminStockVariantsList', 'AdminStockLedgerList',
    'AdminAnalyticsV2', 'AdminGrowthData', 'AdminStaffList', 'InboxList', 'InboxThread', 'InboxProfile'];
  var CACHE_PREFIX = "ma_admin_read_v2:";
  var SNAPSHOT_MS = 5 * 60 * 1000;
  var inFlight = Object.create(null);
  var cacheGeneration = 0;
  var HARD_FAILURES = ["INVALID_TOKEN", "EXPIRED", "NOT_ADMIN", "NO_TOKEN"];

  function clearReadCache() {
    cacheGeneration++;
    inFlight = Object.create(null);
    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var key = sessionStorage.key(i);
        if (key.indexOf(CACHE_PREFIX) === 0 || key === "ma_admin_orders_v1") sessionStorage.removeItem(key);
      }
    } catch (e) {}
  }

  function readKey(fields) {
    return CACHE_PREFIX + JSON.stringify(Object.keys(fields).filter(function (k) { return k !== "Token"; })
      .sort().map(function (k) { return [k, String(fields[k] == null ? "" : fields[k])]; }));
  }

  // Session-scoped snapshots: navigation may reuse a result for 15 seconds; Refresh is always live.
  function cached(recordType, fields, maxAgeMs) {
    var s = getSession();
    if (!s || READ_TYPES.indexOf(recordType) === -1) return null;
    var params = Object.assign({}, fields || {}, { RecordType: recordType });
    try {
      var entry = JSON.parse(sessionStorage.getItem(readKey(params)) || "null");
      if (entry && entry.token === s.token && Date.now() - entry.at < (maxAgeMs || SNAPSHOT_MS)) return entry.result;
    } catch (e) {}
    return null;
  }

  function timeoutPromise(ms, promise) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("REQUEST_TIMEOUT")); }, ms);
      promise.then(function (value) { clearTimeout(timer); resolve(value); },
        function (err) { clearTimeout(timer); reject(err); });
    });
  }

  // Fast read path: the site's own Cloudflare function answers order list/detail reads from the
  // sheet directly (read-only). Anything other than ok:true falls back to Apps Script, which stays
  // the source of truth and the only writer. If the edge is not set up, it is skipped for 10 minutes.
  var EDGE_TYPES = ["AdminVerify", "AdminOrderList", "AdminOrderGet", "AdminOrders", "AdminFraudCheck", "AdminOrderStaff", "AdminCustomerLookup", "AdminStockVariantsList", "AdminAnalyticsV2", "AdminStockLedgerList", "AdminGrowthData", "InboxThread"];
  var EDGE_URL = cfg.edgeReadUrl === undefined ? "/api/admin-read" : cfg.edgeReadUrl;
  var EDGE_OFF_KEY = "ma_admin_edge_off";
  function edgeRead(fields, body, options) {
    try {
      var edgeOk = EDGE_TYPES.indexOf(fields.RecordType) !== -1 || (fields.RecordType === "InboxList" && options && options.edgeSummary);
      if (!EDGE_URL || !edgeOk || !fields.Token) return Promise.resolve(null);
      if (!/^https?:$/.test(g.location && g.location.protocol)) return Promise.resolve(null);
      var off = Number(sessionStorage.getItem(EDGE_OFF_KEY) || 0);
      if (off && Date.now() < off) return Promise.resolve(null);
    } catch (e) { return Promise.resolve(null); }
    return timeoutPromise(6000, fetch(EDGE_URL, { method: "POST", credentials: "same-origin", body: body }))
      .then(function (res) {
        var edge = res.headers.get("X-MA-Source") === "edge";
        return res.text().then(function (text) {
          var data = null;
          try { data = JSON.parse(text); } catch (e) {}
          if (edge && res.ok && data && data.ok === true) return text;
          // Not deployed / not configured: skip for 10 min. A passing Google error: skip for 1 min.
          var pause = !edge || (data && data.error === "NOT_CONFIGURED") ? 10 : (res.status === 503 ? 1 : 0);
          if (pause) { try { sessionStorage.setItem(EDGE_OFF_KEY, String(Date.now() + pause * 60 * 1000)); } catch (e) {} }
          return null;
        });
      })
      .catch(function () { return null; });
  }

  function request(fields, timeout, options) {
    if (!API_URL) return Promise.reject(new Error("API_MISSING"));
    var read = READ_TYPES.indexOf(fields.RecordType) !== -1;
    // Only page navigation opts in; Refresh and every write still reach the server.
    // Orders page-এ আগের snapshot আগে দেখানো হবে; Refresh button live request বাধ্য করবে।
    // এতে navigation-এর সময় blank/loading state থাকে না, কিন্তু data শেষ পর্যন্ত revalidate হয়।
    var maxAge = Math.min(5 * 60 * 1000, Math.max(0, Number(options && options.maxAgeMs) || 0));
    var recent = read && maxAge ? cached(fields.RecordType, fields, maxAge) : null;
    if (recent) return Promise.resolve(recent);
    var key = read ? readKey(fields) : "";
    var flightKey = fields.Token + ":" + key;
    if (read && inFlight[flightKey]) return inFlight[flightKey];
    if (!read && fields.Token && fields.RecordType !== "AdminVerify") clearReadCache();
    var generation = cacheGeneration;
    var body = new URLSearchParams();
    Object.keys(fields).forEach(function (k) {
      if (fields[k] != null) body.append(k, String(fields[k]));
    });
    var task = edgeRead(fields, body, options).then(function (edgeText) {
      if (edgeText != null) return edgeText;
      // Writes use keepalive so a save still reaches the server if the admin moves to another page.
      var init = { method: "POST", mode: "cors", credentials: "omit", body: body };
      if (!read && body.toString().length < 60000) init.keepalive = true;
      return timeoutPromise(timeout || 30000, fetch(API_URL, init).then(function (res) { return res.text(); }));
    }).then(function (text) {
      var raw = String(text || "").trim();
      var res;
      try { res = JSON.parse(raw); } catch (e) {
        res = { ok: false, error: raw === "Success" ? "DEPLOY_OLD" : "INVALID_RESPONSE",
          message: "API পুরনো ভার্সন বা ভুল উত্তর। Apps Script → Deploy → New version করুন।" };
      }
      if (!res || typeof res !== "object") res = { ok: false, error: "INVALID_RESPONSE" };
      var current = getSession();
      var sameSession = current && current.token === fields.Token;
      if (fields.Token && sameSession && HARD_FAILURES.indexOf(res.error) !== -1) logout();
      if (read && res.ok && sameSession && generation === cacheGeneration) {
        try { sessionStorage.setItem(key, JSON.stringify({ token: fields.Token, at: Date.now(), result: res })); } catch (e) {}
      }
      if (!read && fields.Token && fields.RecordType !== "AdminVerify") clearReadCache();
      return res;
    });
    if (read) {
      inFlight[flightKey] = task;
      var release = function () { if (inFlight[flightKey] === task) delete inFlight[flightKey]; };
      task.then(release, release);
    }
    return task;
  }

  function apiPost(fields, options) {
    return request(fields, 30000, options).catch(function (err) {
      return { ok: false, error: "NETWORK_FAILURE", message: err.message };
    });
  }

  function saveSession(data) {
    var previous = getSession();
    if (!previous || previous.token !== data.token) clearReadCache();
    var session = {
      token: data.token,
      email: data.email || "",
      phone: data.phone || "",
      name: data.name || "",
      role: data.role || "admin",
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
      if (!s || !s.token || ["admin", "staff"].indexOf(s.role) === -1) return null;
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
    clearReadCache();
    try { sessionStorage.removeItem("ma_admin_verified_at"); } catch (e) {}
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  // Public password recovery calls; these intentionally do not require a session.
  function requestPasswordReset(email) {
    return apiPost({
      RecordType: "AdminPasswordResetRequest",
      Email: String(email || "").trim().toLowerCase()
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "RECOVERY_UNAVAILABLE");
      return res;
    });
  }
  function confirmPasswordReset(data) {
    return apiPost({
      RecordType: "AdminPasswordResetConfirm",
      Email: String(data.email || "").trim().toLowerCase(),
      Token: String(data.token || ""),
      NewPassword: String(data.newPassword || "")
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "INVALID_RECOVERY_LINK");
      // A successfully reset password invalidates old admin/staff sessions.
      logout();
      return res;
    });
  }

  function login(data) {
    var loginId = String(data.login || "").trim();
    var password = String(data.password || "");
    if (!loginId || !password) return Promise.reject(new Error("MISSING_FIELDS"));

    var fields = {
      RecordType: "AdminLogin",
      Password: password
    };

    // উন্নতি: ফোন নাম্বার ফরম্যাটিং আরও আধুনিক করা হয়েছে
    if (loginId.indexOf("@") !== -1) fields.Email = loginId.toLowerCase();
    else fields.Phone = loginId.replace(/\D/g, "").replace(/^(?:880|88|0)/, "0");

    if (!fields.Email && !fields.Phone) return Promise.reject(new Error("INVALID_LOGIN"));

    return apiPost(fields).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "LOGIN_FAILED");
      saveSession(res);
      try { sessionStorage.setItem("ma_admin_verified_at", JSON.stringify({ token: res.token, at: Date.now() })); } catch (e) {}
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
      // সর্বার-সাইডে সেশন সত্যিই বাতিল হলে/বাতিল না থাকলেই শেষ লগআউট করা হবে (INVALID_TOKEN/EXPIRED/NOT_ADMIN/NO_TOKEN)।
      // রেট-লিমিট/নেটওয়ার্ক এররের মতো সাময়িক ব্যর্থতায় সেশন মুছে লগআউট করা ঠিক নয়।
      var current = getSession();
      if (!current || current.token !== s.token) return current;
      var hardFailures = ["INVALID_TOKEN", "EXPIRED", "NOT_ADMIN", "NO_TOKEN"];
      if (!res.ok) {
        if (hardFailures.indexOf(res.error) !== -1) {
          logout();
          return null;
        }
        return s;
      }
      if (["admin", "staff"].indexOf(res.role) === -1) {
        logout();
        return null;
      }
      saveSession(res);
      return getSession();
    });
  }

  function fetchOrders(limit, options) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({
      RecordType: "AdminOrders",
      Token: s.token,
      Limit: limit || 80
    }, options).then(function (res) {
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

  // নতুন: Admin Panel থেকে সরাসরি GitHub-এ ফাইল পাবলিশ (Netlify অটো-ডিপ্লয় ট্রিগার করে)
  // path: category-products.js / product-links-data.js / product-catalog-sections.js / product-config.js
  function publishFile(path, content, message) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return timeoutPromise(
      30000,
      fetch(API_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        body: (function () {
          var body = new URLSearchParams();
          body.append("RecordType", "AdminPublishFile");
          body.append("Token", s.token);
          body.append("Path", path);
          body.append("Content", content);
          body.append("Message", message || ("Update " + path + " — Admin Panel থেকে"));
          return body;
        })()
      })
    )
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        try {
          return JSON.parse(String(text || "").trim());
        } catch (e) {
          return { ok: false, error: "PARSE_FAILED", message: text };
        }
      })
      .catch(function (err) {
        return { ok: false, error: "NETWORK_FAILURE", message: err.message };
      });
  }

  // নতুন: প্রোডাক্ট ছবি সরাসরি আপলোড (Base64) — GitHub-এর images/ ফোল্ডারে কমিট হয়
  function uploadImage(fileName, base64Content, mimeType) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return timeoutPromise(
      45000,
      fetch(API_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        body: (function () {
          var body = new URLSearchParams();
          body.append("RecordType", "AdminUploadImage");
          body.append("Token", s.token);
          body.append("FileName", fileName);
          body.append("ContentBase64", base64Content);
          body.append("MimeType", mimeType || "image/webp");
          return body;
        })()
      })
    )
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        try {
          return JSON.parse(String(text || "").trim());
        } catch (e) {
          return { ok: false, error: "PARSE_FAILED", message: text };
        }
      })
      .catch(function (err) {
        return { ok: false, error: "NETWORK_FAILURE", message: err.message };
      });
  }

  // নতুন: Media Library — images/ ফোল্ডারের সব ছবির তালিকা (main/gallery/cards সব সাবফোল্ডার সহ)
  function listImages() {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return timeoutPromise(
      20000,
      fetch(API_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        body: (function () {
          var body = new URLSearchParams();
          body.append("RecordType", "AdminListImages");
          body.append("Token", s.token);
          return body;
        })()
      })
    )
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        try {
          return JSON.parse(String(text || "").trim());
        } catch (e) {
          return { ok: false, error: "PARSE_FAILED", message: text };
        }
      })
      .catch(function (err) {
        return { ok: false, error: "NETWORK_FAILURE", message: err.message };
      });
  }

  // নতুন: Media Library থেকে একটা ছবি স্থায়ীভাবে মুছে ফেলা
  function deleteImage(path) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return timeoutPromise(
      20000,
      fetch(API_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        body: (function () {
          var body = new URLSearchParams();
          body.append("RecordType", "AdminDeleteImage");
          body.append("Token", s.token);
          body.append("Path", path);
          return body;
        })()
      })
    )
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        try {
          return JSON.parse(String(text || "").trim());
        } catch (e) {
          return { ok: false, error: "PARSE_FAILED", message: text };
        }
      })
      .catch(function (err) {
        return { ok: false, error: "NETWORK_FAILURE", message: err.message };
      });
  }

    // নতুন: Stock ( ইনভেন্টরি) এবং Analytics
  function getStock() {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({ RecordType: "AdminStockGet", Token: s.token }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STOCK_FETCH_FAILED");
      return res;
    });
  }

  function setStock(productId, productName, qty) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({
      RecordType: "AdminStockSet",
      Token: s.token,
      ProductId: productId,
      ProductName: productName || "",
      Qty: qty
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STOCK_SET_FAILED");
      return res;
    });
  }

  function getAnalytics(days) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({ RecordType: "AdminAnalytics", Token: s.token, Days: days || 30 }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "ANALYTICS_FAILED");
      return res;
    });
  }

  // নতুন: গ্রোথ ড্যাশবোর্ড — Abandoned Cart, Back-in-stock Waitlist, Reorder Offers
  function getStaffList() {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({ RecordType: "AdminStaffList", Token: s.token }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STAFF_LIST_FAILED");
      return res;
    });
  }

  function saveStaff(fields) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({
      RecordType: "AdminStaffSave",
      Token: s.token,
      Email: fields.email || "",
      Phone: fields.phone || "",
      Name: fields.name || "",
      Password: fields.password || ""
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STAFF_SAVE_FAILED");
      return res;
    });
  }

  function deleteStaff(fields) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({
      RecordType: "AdminStaffDelete",
      Token: s.token,
      Email: fields.email || "",
      Phone: fields.phone || ""
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STAFF_DELETE_FAILED");
      return res;
    });
  }

    function getGrowthData() {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({ RecordType: "AdminGrowthData", Token: s.token }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "GROWTH_FETCH_FAILED");
      return res;
    });
  }

  function dismissGrowthItem(kind, key) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({
      RecordType: "AdminGrowthDismiss",
      Token: s.token,
      Kind: kind,
      Key: key
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "GROWTH_DISMISS_FAILED");
      return res;
    });
  }

  // Messenger inbox (RecordType Inbox*). Unlike apiPost, empty values are sent,
  // so a field can be cleared (e.g. un-assigning a conversation).
  function inboxCall(type, fields, options) { return call(type, fields, options); }

  function call(recordType, fields, options) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    var params = Object.assign({}, fields || {}, { RecordType: recordType, Token: s.token });
    return request(params, recordType === "AdminCatalogPublish" ? 120000 : 30000, options).then(function (res) {
      if (!res.ok) {
        var err = new Error(res.message || res.error || "REQUEST_FAILED");
        err.code = res.error || "";
        throw err;
      }
      return res;
    });
  }

  // ===== নতুন: ভ্যারিয়েন্ট-ভিত্তিক স্টক, লেজার, CSV, Analytics v2 (stock-analytics-v2) =====
  function getStockVariants(opts) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    opts = opts || {};
    return apiPost({
      RecordType: "AdminStockVariantsList",
      Token: s.token,
      Search: opts.search || "",
      StockStatus: opts.stockStatus || "all",
      Category: opts.category || "",
      CategoryMap: opts.categoryMap ? JSON.stringify(opts.categoryMap) : ""
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STOCK_VARIANTS_FETCH_FAILED");
      return res;
    });
  }

  function saveStockVariant(opts) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    opts = opts || {};
    return apiPost({
      RecordType: "AdminStockVariantSave",
      Token: s.token,
      ProductId: opts.productId,
      ProductName: opts.productName || "",
      Category: opts.category || "",
      Variant: opts.variant || "",
      Available: (typeof opts.available === "undefined" || opts.available === null) ? "" : opts.available,
      Threshold: (typeof opts.threshold === "undefined" || opts.threshold === null) ? "" : opts.threshold,
      Tracked: opts.tracked ? "true" : "",
      Reason: opts.reason || ""
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STOCK_VARIANT_SAVE_FAILED");
      return res;
    });
  }

  function getStockLedger(productId, limit) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({ RecordType: "AdminStockLedgerList", Token: s.token, ProductId: productId || "", Limit: limit || 200 }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STOCK_LEDGER_FETCH_FAILED");
      return res;
    });
  }

  function commitStockCsv(rows, previewOnly) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({
      RecordType: "AdminStockCsvCommit",
      Token: s.token,
      RowsJSON: JSON.stringify(rows || []),
      PreviewOnly: previewOnly ? "true" : "false"
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STOCK_CSV_FAILED");
      return res;
    });
  }

  function getAnalyticsV2(opts) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    opts = opts || {};
    return apiPost({
      RecordType: "AdminAnalyticsV2",
      Token: s.token,
      Range: opts.range || "today",
      From: opts.from || "",
      To: opts.to || "",
      CategoryMap: opts.categoryMap ? JSON.stringify(opts.categoryMap) : ""
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "ANALYTICS_V2_FAILED");
      return res;
    });
  }

  function migrateStockVariants() {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    return apiPost({ RecordType: "AdminStockMigrate", Token: s.token }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STOCK_MIGRATE_FAILED");
      return res;
    });
  }

  function quickAdjustStock(opts) {
    var s = getSession();
    if (!s) return Promise.reject(new Error("NOT_LOGGED_IN"));
    opts = opts || {};
    return apiPost({
      RecordType: "AdminStockQuickAdjust",
      Token: s.token,
      ProductId: opts.productId,
      ProductName: opts.productName || "",
      Category: opts.category || "",
      Variant: opts.variant || "",
      Delta: opts.delta,
      Reason: opts.reason || ""
    }).then(function (res) {
      if (!res.ok) throw new Error(res.message || res.error || "STOCK_QUICK_ADJUST_FAILED");
      return res;
    });
  }

  // ===== Saves that finish after the admin has left the page =====
  // The order page lets the admin move on while a save is still running. The intended values are kept
  // here until the server answers; if that answer never reached a page, the next admin page re-reads the
  // order (fast read path) and warns when the save did not land.
  var PENDING_KEY = "ma_admin_pending_saves";
  function readPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function writePending(map) { try { if (Object.keys(map).length) localStorage.setItem(PENDING_KEY, JSON.stringify(map)); else localStorage.removeItem(PENDING_KEY); } catch (e) {} }
  function markPendingSave(orderId, expect) { var map = readPending(); map[orderId] = { expect: expect, at: Date.now() }; writePending(map); }
  function clearPendingSave(orderId) { var map = readPending(); delete map[orderId]; writePending(map); }
  function savedValue(key, order) {
    var v = order[key.charAt(0).toLowerCase() + key.slice(1)];
    if (key === "AdminNote") return String(v == null ? "" : v).replace(/^'/, "").trim();
    if (key === "Charge" || key === "Advance" || key === "Discount") return Number(v) || 0;
    return String(v == null ? "" : v).trim();
  }
  function saveLanded(expect, order) {
    return Object.keys(expect).every(function (k) {
      var want = expect[k];
      return typeof want === "number" ? savedValue(k, order) === want : savedValue(k, order) === String(want).trim();
    });
  }
  function warn(message) {
    if (g.MaPanel && g.MaPanel.toast) g.MaPanel.toast(message, true);
    else try { console.warn(message); } catch (e) {}
  }
  function checkPendingSaves() {
    var map = readPending();
    Object.keys(map).forEach(function (orderId) {
      var item = map[orderId];
      if (!item || Date.now() - item.at > 24 * 3600 * 1000) { clearPendingSave(orderId); return; }
      if (Date.now() - item.at < 5000) return; // the page that started it may still be waiting for the answer
      call("AdminOrderGet", { OrderId: orderId }).then(function (res) {
        var current = readPending()[orderId];
        if (!current || current.at !== item.at) return;
        clearPendingSave(orderId);
        if (!saveLanded(item.expect, res.order || {})) warn("অর্ডার #" + orderId + "-এর শেষ পরিবর্তন সেভ হয়নি। অর্ডারটি খুলে আবার সেভ করুন।");
      }).catch(function () {});
    });
  }
  setTimeout(function () { if (getSession()) checkPendingSaves(); }, 2500);

  g.MaAdmin = {
    markPendingSave: markPendingSave,
    clearPendingSave: clearPendingSave,
    checkPendingSaves: checkPendingSaves,
    cached: cached,
    clearReadCache: clearReadCache,
    call: call,
    inboxCall: inboxCall,
    login: login,
    requestPasswordReset: requestPasswordReset,
    confirmPasswordReset: confirmPasswordReset,
    logout: logout,
    getSession: getSession,
    verifySession: verifySession,
    fetchOrders: fetchOrders,
    publishFile: publishFile,
    uploadImage: uploadImage,
    listImages: listImages,
    deleteImage: deleteImage,
    getStock: getStock,
    setStock: setStock,
    getAnalytics: getAnalytics,
    getStockVariants: getStockVariants,
    saveStockVariant: saveStockVariant,
    getStockLedger: getStockLedger,
    commitStockCsv: commitStockCsv,
    getAnalyticsV2: getAnalyticsV2,
    migrateStockVariants: migrateStockVariants,
    quickAdjustStock: quickAdjustStock,
    getGrowthData: getGrowthData,
    dismissGrowthItem: dismissGrowthItem,
    getStaffList: getStaffList,
    saveStaff: saveStaff,
    deleteStaff: deleteStaff,
    isLoggedIn: function () {
      return !!getSession();
    }
  };
})(window);
