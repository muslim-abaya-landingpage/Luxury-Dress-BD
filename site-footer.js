(function () {
  var CONTACT = {
    email: "muslimabeya@gmail.com",
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

  function buildShopLinksHtml() {
    var sections = window.CATALOG_SECTIONS || [];
    if (!sections.length) {
      return (
        '<li><a href="' +
        esc(footerHref("/abaya")) +
        '">Abaya</a></li>' +
        '<li><a href="' +
        esc(footerHref("/premium-two-piece")) +
        '">Two-piece</a></li>'
      );
    }
    return sections
      .filter(function (sec) {
        return sec.enabled !== false;
      })
      .map(function (sec) {
        var label = sec.menuBn || sec.menu || sec.key;
        var href = footerHref(sec.path || "/" + sec.key);
        return '<li><a href="' + esc(href) + '">' + esc(label) + "</a></li>";
      })
      .join("");
  }

  function buildFooterHtml() {
    return (
      '<footer class="anz-footer">' +
      '<div class="anz-footer-trust">' +
      '<div class="anz-trust-inner">' +
      '<div class="anz-trust-item"><span class="anz-trust-dot" aria-hidden="true"></span><span>ক্যাশ অন ডেলিভারি</span></div>' +
      '<div class="anz-trust-item"><span class="anz-trust-dot" aria-hidden="true"></span><span>সারাদেশে ডেলিভারি</span></div>' +
      '<div class="anz-trust-item"><span class="anz-trust-dot" aria-hidden="true"></span><span>সহজ রিটার্ন নীতি</span></div>' +
      "</div></div>" +
      '<div class="anz-footer-main">' +
      '<div class="anz-col-brand">' +
      '<h2 class="anz-logo">Muslim Abaya</h2>' +
      '<p class="anz-text">বাংলাদেশের প্রিমিয়াম মডেস্ট ফ্যাশন — আবায়া, টু-পিস, এম্ব্রয়ডারি ও আরও। আরামদায়ক ফেব্রিক, ভিডিওতে আসল প্রোডাক্ট, ক্যাশ অন ডেলিভারি।</p>' +
      '<a class="anz-wa-cta" href="' +
      esc(CONTACT.whatsapp) +
      '" target="_blank" rel="noopener">' +
      ICON_WA +
      "<span>WhatsApp অর্ডার</span></a>" +
      "</div>" +
      '<div class="anz-col-shop">' +
      '<h3 class="anz-title">Shop</h3>' +
      '<ul class="anz-link-list" id="anz-footer-shop">' +
      buildShopLinksHtml() +
      "</ul>" +
      "</div>" +
      '<div class="anz-col-links">' +
      '<h3 class="anz-title">About Us</h3>' +
      '<ul class="anz-link-list">' +
      '<li><a href="' +
      esc(footerHref("/about")) +
      '">About Us</a></li>' +
      '<li><a href="' +
      esc(footerHref("/help")) +
      '#order-status">Order Help</a></li>' +
      '<li><a href="' +
      esc(footerHref("/privacy")) +
      '">Privacy Policy</a></li>' +
      '<li><a href="' +
      esc(footerHref("/refund")) +
      '">Refund Policy</a></li>' +
      '<li><a href="' +
      esc(footerHref("/terms")) +
      '">Terms &amp; Conditions</a></li>' +
      "</ul>" +
      "</div>" +
      '<div class="anz-col-contact">' +
      '<h3 class="anz-title">Contact Us</h3>' +
      '<a class="anz-contact-link" href="mailto:' +
      esc(CONTACT.email) +
      '">' +
      '<span class="anz-contact-icon">' +
      ICON_MAIL +
      "</span>" +
      "<span>" +
      esc(CONTACT.email) +
      "</span></a>" +
      '<a class="anz-contact-link" href="tel:' +
      esc(CONTACT.phoneTel) +
      '">' +
      '<span class="anz-contact-icon">' +
      ICON_PHONE +
      "</span>" +
      "<span>" +
      esc(CONTACT.phone) +
      "</span></a>" +
      '<div class="anz-contact-link anz-contact-static">' +
      '<span class="anz-contact-icon">' +
      ICON_PIN +
      "</span>" +
      "<span>" +
      esc(CONTACT.address) +
      "</span></div>" +
      "</div>" +
      '<div class="anz-col-newsletter">' +
      '<form id="newsletter-form">' +
      '<h3 class="anz-title">Newsletter</h3>' +
      '<p class="anz-newsletter-note">নতুন কালেকশন ও অফার — ইমেইল বা মোবাইল</p>' +
      '<div class="newsletter-form">' +
      '<input type="text" name="contact" id="subscriber-contact" placeholder="Email or mobile" required autocomplete="email">' +
      '<button type="submit" id="sub-btn">Subscribe</button>' +
      "</div>" +
      '<div id="success-msg" class="subscribe-success" role="status">' +
      '<div class="subscribe-success-icon" aria-hidden="true">✓</div>' +
      '<p class="subscribe-success-title">সাবস্ক্রিপশন সম্পন্ন</p>' +
      '<p class="subscribe-success-text">আপনার তথ্য সংরক্ষিত হয়েছে। শীঘ্রই নতুন কালেকশন জানানো হবে।</p>' +
      "</div>" +
      "</form>" +
      '<div class="anz-socials">' +
      '<a href="https://www.facebook.com/luxurydressofficial" target="_blank" rel="noopener" class="anz-social-link" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 16.9913 5.65684 21.1283 10.4375 21.8785V14.8906H7.89844V12H10.4375V9.79688C10.4375 7.29063 11.9305 5.90625 14.2146 5.90625C15.3082 5.90625 16.4531 6.10156 16.4531 6.10156V8.5625H15.1922C13.95 8.5625 13.5625 9.33333 13.5625 10.1242V12H16.3359L15.8926 14.8906H13.5625V21.8785C18.3432 21.1283 22 16.9913 22 12Z"/></svg></a>' +
      '<a href="https://www.youtube.com/@luxurydressbd" target="_blank" rel="noopener" class="anz-social-link" aria-label="YouTube"><svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>' +
      '<a href="https://www.instagram.com/luxurydressbd/" target="_blank" rel="noopener" class="anz-social-link" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>' +
      '<a href="https://www.tiktok.com/@muslimabayabd" target="_blank" rel="noopener" class="anz-social-link" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.28-2.26.74-4.63 2.58-5.91 1.05-.72 2.3-1.13 3.55-1.14 1.25-.01 2.5.3 3.59 1.01.01-1.24-.01-2.48.01-3.72-1.02-.69-2.22-1.03-3.45-1.01-1.41.02-2.81.48-3.92 1.36-1.62 1.25-2.58 3.24-2.54 5.27.02 2.21 1.23 4.31 3.12 5.47 1.22.76 2.66 1.15 4.1 1.05 2.15-.08 4.17-1.33 5.18-3.23.51-.95.77-2.03.78-3.11.02-4.99-.01-9.98.02-14.97z"/></svg></a>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="anz-bottom"><p>Copyright &copy; 2026 Muslim Abaya. All Rights Reserved.</p></div>' +
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

  function sendSubscribe(apiUrl, contactValue) {
    var params = buildSubscribeParams(contactValue);
    var getUrl = apiUrl + (apiUrl.indexOf("?") >= 0 ? "&" : "?") + params.toString();
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

    return fetch(getUrl, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
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
        return fetch(apiUrl, {
          method: "POST",
          mode: "no-cors",
          credentials: "omit",
          body: params
        }).then(function () {
          return { text: "", cors: false };
        });
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
        alert("অনুগ্রহ করে সঠিক ইমেইল অথবা মোবাইল নাম্বার দিন (উদাহরণ: 01712345678)।");
        return;
      }
      if (window.MaSecurity && MaSecurity.guardSubmit && !MaSecurity.guardSubmit("newsletter", 5000)) {
        return;
      }
      if (Date.now() - nlSubmitAt < 5000) return;
      nlSubmitAt = Date.now();

      if (isLocalFilePage()) {
        alert(
          "সাবস্ক্রাইব শিটে জমা হতে file:// কাজ করে না।\n\n" +
            "① ADMIN-লোকাল-টেস্ট.bat চালিয়ে http://localhost:5500 থেকে সাবস্ক্রাইব করুন\n" +
            "অথবা ② লাইভ সাইট muslimabaya.com থেকে করুন"
        );
        return;
      }

      btn.disabled = true;
      btn.innerText = "Processing...";

      ensureScriptUrl(function (apiUrl) {
        if (!apiUrl) {
          btn.disabled = false;
          btn.innerText = "Subscribe";
          alert("সাইট API URL নেই। site-api-config.js আপলোড করুন এবং Apps Script Web App URL দিন।");
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
            if (!result.cors) {
              alert(
                "অনুরোধ পাঠানো হয়েছে। ১–২ মিনিট পর Sheet-এর **Subscribe** ট্যাব দেখুন।\n\n" +
                  "না থাকলে Apps Script → Deploy → Anyone → New version।"
              );
              form.reset();
              return;
            }
            alert(
              "সাবস্ক্রাইব শিটে জমা হয়নি।\n\n" +
                (result.text ? result.text.slice(0, 160) : "API ত্রুটি") +
                "\n\nApps Script → Deploy → Who has access: Anyone + New version চালু করুন।"
            );
          })
          .catch(function (err) {
            var hint =
              err && err.message === "TIMEOUT"
                ? "সার্ভার ধীর বা API URL ভুল।"
                : "নেটওয়ার্ক বা API বন্ধ।";
            alert(
              "সাবস্ক্রাইব পাঠানো যায়নি। " +
                hint +
                "\n\nApps Script Deploy (Anyone) ও site-api-config.js URL চেক করুন।"
            );
          })
          .finally(function () {
            btn.disabled = false;
            btn.innerText = "Subscribe";
          });
      });
    });
  }

  function mountFooter() {
    var mount = document.getElementById("site-footer-mount");
    if (!mount) return;
    mount.innerHTML = buildFooterHtml();
    initNewsletter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountFooter);
  } else {
    mountFooter();
  }
})();
