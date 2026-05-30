(function () {
  var SEO = window.SITE_SEO || {};
  var SOCIAL = SEO.social || {
    facebook: "https://www.facebook.com/luxurydressofficial",
    instagram: "https://www.instagram.com/luxurydressbd/",
    youtube: "https://www.youtube.com/@luxurydressbd",
    tiktok: "https://www.tiktok.com/@muslimabayabd"
  };

  var CONTACT = {
    email: "muslimabaya@gmail.com",
    phone: "+880 1971-642683",
    phoneTel: "+8801971642683",
    whatsapp: "https://wa.me/8801971642683",
    address: "832, West Rasulpur, Dhaka-1211, Bangladesh"
  };

  var SVG_ATTR = ' width="18" height="18" focusable="false" aria-hidden="true"';
  var ICON_MAIL =
    "<svg" + SVG_ATTR + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>';
  var ICON_PHONE =
    "<svg" + SVG_ATTR + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h4l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
  var ICON_PIN =
    "<svg" + SVG_ATTR + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  var ICON_WA =
    '<span class="anz-wa-icon" aria-hidden="true">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">' +
    '<path fill="#25D366" d="M12.004 2a9.99 9.99 0 0 0-8.595 15.07L2.5 21.5l4.55-1.19A9.99 9.99 0 1 0 12.004 2zm5.35 14.01c-.24.67-1.4 1.31-2.02 1.39-.51.07-1.17.12-1.87-.06-.43-.1-.99-.36-1.72-.7-3.02-1.31-4.98-4.46-5.12-4.7-.14-.24-1.19-1.99-1.19-3.68 0-1.69.88-2.52 1.19-2.89.31-.37.68-.46.93-.46.25 0 .5.01.72.03.22.02.57-.04.88.44.31.48 1.05 1.67 1.15 1.8.1.13.17.3.04.48-.13.18-.21.3-.42.48-.21.18-.43.39-.62.56-.21.19-.43.4-.19.78.24.38 1.1 1.72 2.36 2.97 1.54 1.37 2.84 1.8 3.28 2.13.44.33.85.28 1.17.17.32-.11 2.02-.77 2.3-.9.28-.13.47-.2.54-.31.07-.11.07-.64-.17-1.28z"/></svg>' +
    "</span>";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function footerHref(routeOrFile) {
    if (typeof window.siteHref === "function") return window.siteHref(routeOrFile);
    return routeOrFile;
  }

  function categoryHasProducts(key) {
    if (window.maCatalog && typeof window.maCatalog.categoryHasProducts === "function") {
      return window.maCatalog.categoryHasProducts(key);
    }
    var list = (window.CATEGORY_PRODUCTS || {})[key];
    return (
      Array.isArray(list) &&
      list.some(function (p) {
        return p && (p.image || p.name);
      })
    );
  }

  function sectionShowsInFooter(sec) {
    if (sec.enabled !== false) return true;
    return categoryHasProducts(sec.key);
  }

  function buildShopLinksHtml() {
    var sections = window.CATALOG_SECTIONS || [];
    if (!sections.length) {
      return (
        '<li><a href="' +
        esc(footerHref("/abaya")) +
        '">Abaya</a></li>' +
        '<li><a href="' +
        esc(footerHref("/premium-two-piece")) +
        '">Premium Two-piece</a></li>' +
        '<li><a href="' +
        esc(footerHref("/embroidery")) +
        '">Embroidery</a></li>' +
        '<li><a href="' +
        esc(footerHref("/kaftan")) +
        '">Kaftan</a></li>'
      );
    }
    return sections
      .filter(sectionShowsInFooter)
      .map(function (sec) {
        var label = sec.menu || sec.menuBn || sec.key;
        var href = footerHref(sec.path || "/" + sec.key);
        return '<li><a href="' + esc(href) + '">' + esc(label) + "</a></li>";
      })
      .join("");
  }

  function footerPanel(title, innerHtml, colClass) {
    return (
      '<div class="' +
      colClass +
      '">' +
      '<details class="anz-foot-details">' +
      '<summary class="anz-title">' +
      esc(title) +
      '<span class="anz-foot-chevron" aria-hidden="true"></span></summary>' +
      '<div class="anz-foot-panel-body">' +
      innerHtml +
      "</div></details></div>"
    );
  }

  function buildFooterHtml() {
    return (
      '<footer class="anz-footer">' +
      '<div class="anz-footer-trust">' +
      '<div class="anz-trust-inner">' +
      '<div class="anz-trust-item"><span class="anz-trust-dot" aria-hidden="true"></span><span>Cash on Delivery</span></div>' +
      '<div class="anz-trust-item"><span class="anz-trust-dot" aria-hidden="true"></span><span>Nationwide Delivery</span></div>' +
      '<div class="anz-trust-item"><span class="anz-trust-dot" aria-hidden="true"></span><span>Easy Return Policy</span></div>' +
      "</div></div>" +
      '<div class="anz-footer-main">' +
      '<div class="anz-col-brand">' +
      '<h2 class="anz-logo">Muslim Abaya</h2>' +
      '<p class="anz-text">Premium modest fashion in Bangladesh — abayas, two-piece sets &amp; embroidery. Comfortable fabrics, video-verified products, cash on delivery.</p>' +
      '<a class="anz-wa-cta" href="' +
      esc(CONTACT.whatsapp) +
      '" target="_blank" rel="noopener">' +
      ICON_WA +
      "<span>WhatsApp Order</span></a>" +
      "</div>" +
      footerPanel(
        "Shop",
        '<ul class="anz-link-list" id="anz-footer-shop">' + buildShopLinksHtml() + "</ul>",
        "anz-col-shop"
      ) +
      footerPanel(
        "About Us",
        '<ul class="anz-link-list">' +
          '<li><a href="' + esc(footerHref("/about")) + '">About Us</a></li>' +
          '<li><a href="' + esc(footerHref("/help")) + '#order-status">Order Help</a></li>' +
          '<li><a href="' + esc(footerHref("/privacy")) + '">Privacy Policy</a></li>' +
          '<li><a href="' + esc(footerHref("/refund")) + '">Refund Policy</a></li>' +
          '<li><a href="' + esc(footerHref("/terms")) + '">Terms &amp; Conditions</a></li>' +
          "</ul>",
        "anz-col-links"
      ) +
      footerPanel(
        "Contact Us",
        '<a class="anz-contact-link" href="mailto:' +
          esc(CONTACT.email) +
          '"><span class="anz-contact-icon">' +
          ICON_MAIL +
          "</span><span>" +
          esc(CONTACT.email) +
          "</span></a>" +
          '<a class="anz-contact-link" href="tel:' +
          esc(CONTACT.phoneTel) +
          '"><span class="anz-contact-icon">' +
          ICON_PHONE +
          "</span><span>" +
          esc(CONTACT.phone) +
          "</span></a>" +
          '<div class="anz-contact-link anz-contact-static"><span class="anz-contact-icon">' +
          ICON_PIN +
          "</span><span>" +
          esc(CONTACT.address) +
          "</span></div>",
        "anz-col-contact"
      ) +
      '<div class="anz-col-newsletter">' +
      '<form id="newsletter-form" aria-labelledby="newsletter-heading" novalidate>' +
      '<h3 class="anz-title" id="newsletter-heading">Newsletter</h3>' +
      '<p class="anz-newsletter-note" id="newsletter-note">New collections &amp; offers — email or mobile</p>' +
      '<div class="newsletter-form">' +
      '<label for="subscriber-contact" class="anz-visually-hidden">Email or mobile number</label>' +
      '<input type="text" name="contact" id="subscriber-contact" placeholder="Email or mobile" required autocomplete="email" inputmode="email" aria-describedby="newsletter-note" aria-required="true">' +
      '<button type="submit" id="sub-btn" aria-label="Subscribe to newsletter">Subscribe</button>' +
      "</div>" +
      '<div id="success-msg" class="subscribe-success" role="status" aria-live="polite" aria-atomic="true">' +
      '<div class="subscribe-success-icon" aria-hidden="true">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></div>' +
      '<p class="subscribe-success-title">Subscription complete</p>' +
      '<p class="subscribe-success-text">Your details are saved. We will notify you about new collections soon.</p>' +
      "</div>" +
      "</form>" +
      '<div class="anz-socials">' +
      '<a href="' +
      esc(SOCIAL.facebook) +
      '" target="_blank" rel="noopener" class="anz-social-link" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 16.9913 5.65684 21.1283 10.4375 21.8785V14.8906H7.89844V12H10.4375V9.79688C10.4375 7.29063 11.9305 5.90625 14.2146 5.90625C15.3082 5.90625 16.4531 6.10156 16.4531 6.10156V8.5625H15.1922C13.95 8.5625 13.5625 9.33333 13.5625 10.1242V12H16.3359L15.8926 14.8906H13.5625V21.8785C18.3432 21.1283 22 16.9913 22 12Z"/></svg></a>' +
      '<a href="' +
      esc(SOCIAL.youtube) +
      '" target="_blank" rel="noopener" class="anz-social-link" aria-label="YouTube"><svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>' +
      '<a href="' +
      esc(SOCIAL.instagram) +
      '" target="_blank" rel="noopener" class="anz-social-link" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>' +
      '<a href="' +
      esc(SOCIAL.tiktok) +
      '" target="_blank" rel="noopener" class="anz-social-link" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.28-2.26.74-4.63 2.58-5.91 1.05-.72 2.3-1.13 3.55-1.14 1.25-.01 2.5.3 3.59 1.01.01-1.24-.01-2.48.01-3.72-1.02-.69-2.22-1.03-3.45-1.01-1.41.02-2.81.48-3.92 1.36-1.62 1.25-2.58 3.24-2.54 5.27.02 2.21 1.23 4.31 3.12 5.47 1.22.76 2.66 1.15 4.1 1.05 2.15-.08 4.17-1.33 5.18-3.23.51-.95.77-2.03.78-3.11.02-4.99-.01-9.98.02-14.97z"/></svg></a>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="anz-bottom anz-footer-strip"><p>Copyright &copy; 2026 Muslim Abaya. All Rights Reserved.</p></div>' +
      "</footer>"
    );
  }

  var SUBSCRIBE_TIMEOUT_MS = 28000;

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function normalizeContactValue(value) {
    var v = String(value || "").trim();
    if (isEmail(v)) return v;
    var digits = v.replace(/[^\d]/g, "");
    if (digits.indexOf("880") === 0 && digits.length >= 12) digits = "0" + digits.substring(3);
    if (digits.length === 10 && digits.charAt(0) === "1") digits = "0" + digits;
    return digits;
  }

  function isEmailOrPhone(value) {
    var v = String(value || "").trim();
    if (isEmail(v)) return true;
    var digits = normalizeContactValue(v);
    return digits.length >= 11 && digits.length <= 14 && digits.charAt(0) === "0";
  }

  var nlSubmitAt = 0;

  function isLocalFilePage() {
    return window.location.protocol === "file:" || window.location.protocol === "blob:";
  }

  function getScriptUrl() {
    return (
      (typeof window.getSiteApiUrl === "function" && window.getSiteApiUrl()) ||
      (window.MA_SITE_API && window.MA_SITE_API.url) ||
      (window.MA_AUTH_CONFIG && window.MA_AUTH_CONFIG.apiUrl) ||
      ""
    );
  }

  function ensureScriptUrl(cb) {
    var url = getScriptUrl();
    if (url) {
      cb(url);
      return;
    }
    if (document.querySelector('script[src*="site-api-config"]')) {
      setTimeout(function () {
        cb(getScriptUrl());
      }, 50);
      return;
    }
    var s = document.createElement("script");
    s.src = "site-api-config.js?v=20260529";
    s.onload = function () {
      cb(getScriptUrl());
    };
    s.onerror = function () {
      cb("");
    };
    document.head.appendChild(s);
  }

  function subscribeOk(text) {
    var t = String(text || "").trim();
    if (t === "Success") return true;
    try {
      var j = JSON.parse(t);
      return !!(j && (j.ok === true || j.success === true));
    } catch (e) {
      return false;
    }
  }

  function buildSubscribeParams(contactValue) {
    var params = new URLSearchParams();
    params.append("RecordType", "Subscribe");
    params.append("contact", contactValue);
    params.append("email", contactValue);
    return params;
  }

  function postSubscribeViaIframe(apiUrl, contactValue) {
    return new Promise(function (resolve, reject) {
      var params = buildSubscribeParams(contactValue);
      var frameName = "maSubscribeFrame";
      var iframe = document.getElementById(frameName);
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.name = frameName;
        iframe.id = frameName;
        iframe.title = "Newsletter subscribe";
        iframe.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;border:0";
        iframe.setAttribute("aria-hidden", "true");
        document.body.appendChild(iframe);
      }
      var form = document.createElement("form");
      form.method = "POST";
      form.action = apiUrl;
      form.target = frameName;
      form.acceptCharset = "UTF-8";
      form.style.display = "none";
      params.forEach(function (value, key) {
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      var settled = false;
      function finish(ok) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        try {
          form.remove();
        } catch (e) {}
        if (ok) resolve({ text: "Success", cors: false, viaIframe: true });
        else reject(new Error("IFRAME_FAIL"));
      }
      iframe.onload = function () {
        finish(true);
      };
      var timer = window.setTimeout(function () {
        finish(true);
      }, 5000);
      document.body.appendChild(form);
      form.submit();
    });
  }

  function sendSubscribe(apiUrl, contactValue) {
    var params = buildSubscribeParams(contactValue);
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          try {
            controller.abort();
          } catch (e) {}
        }, SUBSCRIBE_TIMEOUT_MS)
      : null;

    function clearTimer() {
      if (timer) clearTimeout(timer);
    }

    return fetch(apiUrl, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString(),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        clearTimer();
        return res.text().then(function (text) {
          return { text: text, cors: true };
        });
      })
      .catch(function (err) {
        clearTimer();
        if (err && err.name === "AbortError") {
          return Promise.reject(new Error("TIMEOUT"));
        }
        return postSubscribeViaIframe(apiUrl, contactValue);
      });
  }

  function initNewsletter() {
    var form = document.getElementById("newsletter-form");
    if (!form || form.getAttribute("data-bound") === "1") return;
    form.setAttribute("data-bound", "1");

    var msg = document.getElementById("success-msg");
    var btn = document.getElementById("sub-btn");
    var contactInput = document.getElementById("subscriber-contact");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!contactInput || !isEmailOrPhone(contactInput.value)) {
        alert("Please enter a valid email or mobile number (e.g. 01712345678).");
        return;
      }
      if (window.MaSecurity && MaSecurity.guardSubmit && !MaSecurity.guardSubmit("newsletter", 5000)) {
        return;
      }
      if (Date.now() - nlSubmitAt < 5000) return;
      nlSubmitAt = Date.now();

      if (isLocalFilePage()) {
        alert(
          "Subscribe cannot save from a local file.\n\n" +
            "Run your local server and open http://localhost:5500, or subscribe from muslimabaya.com."
        );
        return;
      }

      btn.disabled = true;
      btn.innerText = "Subscribing...";

      ensureScriptUrl(function (apiUrl) {
        if (!apiUrl) {
          btn.disabled = false;
          btn.innerText = "Subscribe";
          alert("Site API URL is missing. Upload site-api-config.js with your Apps Script Web App URL.");
          return;
        }

        var contactValue = normalizeContactValue(contactInput.value);

        sendSubscribe(apiUrl, contactValue)
          .then(function (result) {
            if (result.cors && subscribeOk(result.text)) {
              if (msg) {
                msg.classList.add("show");
                setTimeout(function () {
                  msg.classList.remove("show");
                }, 6000);
              }
              form.reset();
              return;
            }
            if (result.viaIframe || (!result.cors && subscribeOk(result.text))) {
              if (msg) {
                msg.classList.add("show");
                setTimeout(function () {
                  msg.classList.remove("show");
                }, 6000);
              }
              form.reset();
              return;
            }
            if (!result.cors) {
              alert(
                "Request sent. Check the Subscribe tab in your Sheet in 1–2 minutes.\n\n" +
                  "If nothing appears, redeploy Apps Script as Anyone with a new version."
              );
              form.reset();
              return;
            }
            var apiHint = String(result.text || "").trim();
            if (apiHint === "Muslim Abaya API OK") {
              alert(
                "Subscribe API is running an old version.\n\n" +
                  "Paste Code.gs in Apps Script, deploy a new version, then upload site-footer.js."
              );
              return;
            }
            alert(
              "Subscribe did not save to the sheet.\n\n" +
                (result.text ? result.text.slice(0, 160) : "API error") +
                "\n\nRedeploy Apps Script with Who has access: Anyone and a new version."
            );
          })
          .catch(function (err) {
            var hint =
              err && err.message === "TIMEOUT"
                ? "Server slow or API URL incorrect."
                : "Network or API unavailable.";
            alert(
              "Could not send subscribe request. " +
                hint +
                "\n\nCheck Apps Script deploy (Anyone) and site-api-config.js URL."
            );
          })
          .finally(function () {
            btn.disabled = false;
            btn.innerText = "Subscribe";
          });
      });
    });
  }

  function refreshFooterShopLinks() {
    var ul = document.getElementById("anz-footer-shop");
    if (!ul) return;
    var html = buildShopLinksHtml();
    if (ul.innerHTML !== html) ul.innerHTML = html;
  }

  function waitForCatalogAndRefresh(tries) {
    if (window.CATALOG_SECTIONS && window.CATALOG_SECTIONS.length) {
      refreshFooterShopLinks();
      return;
    }
    if ((tries || 0) > 200) return;
    setTimeout(function () {
      waitForCatalogAndRefresh((tries || 0) + 1);
    }, 25);
  }

  function syncFooterPanels() {
    var panels = document.querySelectorAll(".anz-foot-details");
    var expand = window.innerWidth > 768;
    panels.forEach(function (panel) {
      panel.open = expand;
    });
  }

  function mountFooter() {
    var mount = document.getElementById("site-footer-mount");
    if (!mount) return;
    mount.innerHTML = buildFooterHtml();
    initNewsletter();
    syncFooterPanels();
    if (!window.__maFooterPanelBound) {
      window.__maFooterPanelBound = true;
      window.addEventListener("resize", syncFooterPanels);
    }
    waitForCatalogAndRefresh(0);
  }

  window.refreshFooterShopLinks = refreshFooterShopLinks;
  window.addEventListener("ma:catalog-ready", refreshFooterShopLinks);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountFooter);
  } else {
    mountFooter();
  }
})();
