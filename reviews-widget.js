/* ============================================================================
   reviews-widget.js — প্রোডাক্ট রিভিউ/রেটিং উইজেট (Quick View প্যানেলে বসে)

   কী করে:
   - window.MAReviews.mount(root, product) কল করলে root-এর ভেতরে
     [data-ma-reviews] কন্টেইনারে রেটিং সামারি + অনুমোদিত রিভিউ লিস্ট +
     রিভিউ লেখার ফর্ম বসিয়ে দেয়।
   - GetReviews (GET) থেকে ডেটা আনে, SubmitReview (POST) দিয়ে নতুন রিভিউ
     পাঠায় (Pending অবস্থায় জমা হয়, অ্যাডমিন Approve করলে পাবলিক দেখাবে)।
   - এন্ডপয়েন্ট window.getSiteApiUrl() থেকে নেয় (site-api-config.js)।
   ============================================================================ */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function starsHtml(rating, size) {
    size = size || 16;
    var full = Math.round(Number(rating) || 0);
    var out = "";
    for (var i = 1; i <= 5; i++) {
      out +=
        '<span style="color:' +
        (i <= full ? "#111" : "#ddd") +
        ";font-size:" +
        size +
        'px;line-height:1">★</span>';
    }
    return out;
  }

  function apiUrl() {
    return (window.getSiteApiUrl && window.getSiteApiUrl()) || "";
  }

  function fetchReviews(productId, cb) {
    var url = apiUrl();
    if (!url || !productId) {
      cb({ ok: false, reviews: [], average: 0, count: 0 });
      return;
    }
    fetch(url + "?RecordType=GetReviews&ProductID=" + encodeURIComponent(productId))
      .then(function (r) {
        return r.json();
      })
      .then(cb)
      .catch(function () {
        cb({ ok: false, reviews: [], average: 0, count: 0 });
      });
  }

  function submitReview(payload, cb) {
    var url = apiUrl();
    if (!url) {
      cb({ ok: false, message: "সার্ভিস এখন পাওয়া যাচ্ছে না।" });
      return;
    }
    var body = new URLSearchParams({
      RecordType: "SubmitReview",
      ProductID: payload.productId || "",
      ProductName: payload.productName || "",
      Name: payload.name || "",
      Rating: String(payload.rating || ""),
      Comment: payload.comment || ""
      ,OrderID: payload.orderId || "", Phone: payload.phone || ""
      ,Photos: JSON.stringify(payload.photos || [])
    });
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    })
      .then(function (r) {
        return r.json();
      })
      .then(cb)
      .catch(function () {
        cb({ ok: false, message: "নেটওয়ার্কে সমস্যা হয়েছে, আবার চেষ্টা করুন।" });
      });
  }

  /* ---- Review photos: shrink in the browser (WebP, ≤1280px), upload to /api/review-photo ---- */
  var MAX_PHOTOS = 3;
  function shrinkToWebp(file, cb) {
    if (!file || !/^image\//.test(file.type || "")) { cb(null, "ছবির ফাইল দিন।"); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var tries = [0.82, 0.7, 0.55];
      (function attempt(i) {
        var data = c.toDataURL("image/webp", tries[i]);
        if (data.indexOf("data:image/webp") !== 0) { cb(null, "এই ব্রাউজার ছবি তৈরি করতে পারছে না।"); return; }
        var b64 = data.split(",")[1];
        if (b64.length * 0.75 > 690000 && i < tries.length - 1) { attempt(i + 1); return; }
        if (b64.length * 0.75 > 690000) { cb(null, "ছবিটা খুব বড়।"); return; }
        cb({ b64: b64, preview: data });
      })(0);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null, "ছবিটা খোলা যায়নি।"); };
    img.src = url;
  }
  function uploadPhoto(b64) {
    return fetch("/api/review-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: b64 }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || !j.ok) throw new Error(j && j.error === "TOO_MANY" ? "অনেক ছবি পাঠানো হয়েছে, এক ঘণ্টা পর চেষ্টা করুন।" : "ছবি আপলোড হয়নি।"); return j.url; });
  }
  function openPhoto(src) {
    var box = document.createElement("div");
    box.className = "pqv-photo-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "রিভিউয়ের ছবি");
    box.innerHTML = '<img alt="" src="' + esc(src) + '"><button type="button" aria-label="বন্ধ করুন">×</button>';
    function close() { box.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    box.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(box);
  }
  window.MAReviewPhoto = { open: openPhoto };

  function photosHtml(photos) {
    if (!photos || !photos.length) return "";
    return '<div class="pqv-review-photos">' + photos.slice(0, 3).map(function (u) {
      return '<button type="button" class="pqv-review-photo" data-ma-photo="' + esc(u) + '"><img src="' + esc(u) + '" alt="ক্রেতার তোলা ছবি" loading="lazy" width="84" height="84"></button>';
    }).join("") + "</div>";
  }

  function renderList(reviews) {
    if (!reviews.length) {
      return ""; // the summary line already says "এখনো কোনো রিভিউ নেই"
    }
    return reviews
      .map(function (r) {
        return (
          '<div class="pqv-review-item">' +
          '<div class="pqv-review-head">' +
          '<span class="pqv-review-stars">' +
          starsHtml(r.rating, 13) +
          "</span>" +
          '<span class="pqv-review-name">' +
          esc(r.name) +
          (r.verifiedPurchase === true ? ' <span class="pqv-review-verified">✓ যাচাইকৃত ক্রেতা</span>' : '') +
          "</span>" +
          '<span class="pqv-review-date">' +
          esc(r.date) +
          "</span>" +
          "</div>" +
          (r.comment ? '<p class="pqv-review-comment">' + esc(r.comment) + "</p>" : "") +
          photosHtml(r.photos) +
          "</div>"
        );
      })
      .join("");
  }

  function ensureReviewStyles() {
    if (document.getElementById("ma-reviews-style")) return;
    var css = document.createElement("style");
    css.id = "ma-reviews-style";
    css.textContent =
      ".pqv-reviews-section{margin-top:28px;padding-top:20px;border-top:1px solid #ececec}" +
      ".pqv-reviews-title{font-family:Georgia,'Times New Roman','Noto Serif Bengali',serif;font-size:19px;font-weight:700;margin:0 0 12px;color:#111}" +
      ".pqv-reviews-summary{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}" +
      ".pqv-reviews-count{font-size:13px;color:#555}" +
      ".pqv-reviews-loading,.pqv-reviews-empty{font-size:13px;color:#777;margin:0 0 12px}" +
      ".pqv-review-list{display:flex;flex-direction:column;gap:14px;margin-bottom:14px}" +
      ".pqv-review-item{border:1px solid #ececec;border-radius:8px;padding:12px 14px}" +
      ".pqv-review-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}" +
      ".pqv-review-name{font-size:13px;font-weight:700;color:#111}" +
      ".pqv-review-date{font-size:12px;color:#999;margin-left:auto}" +
      ".pqv-review-comment{margin:4px 0 0;font-size:13.5px;line-height:1.55;color:#333}" +
      ".pqv-review-write-btn{background:#fff;border:1px solid #111;color:#111;font-size:13px;font-weight:700;padding:10px 16px;border-radius:6px;cursor:pointer}" +
      ".pqv-review-write-btn:hover{background:#111;color:#fff}" +
      ".pqv-review-form{display:flex;flex-direction:column;gap:10px;margin-top:14px;max-width:420px}" +
      ".pqv-review-form-stars{font-size:24px;letter-spacing:4px;cursor:pointer;color:#ddd}" +
      ".pqv-rate-star{cursor:pointer;transition:color .12s ease}" +
      ".pqv-review-input{border:1px solid #d8d8d8;border-radius:6px;padding:10px 12px;font-size:13.5px;font-family:inherit;width:100%;box-sizing:border-box}" +
      ".pqv-review-submit-btn{background:#111;color:#fff;border:none;border-radius:6px;padding:11px 18px;font-size:13.5px;font-weight:700;cursor:pointer;align-self:flex-start}" +
      ".pqv-review-submit-btn:disabled{background:#999;cursor:not-allowed}" +
      ".pqv-review-form-msg{font-size:12.5px;color:#555;margin:0}" +
      ".pqv-review-form[hidden]{display:none}" +
      ".pqv-review-photos{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}" +
      ".pqv-review-photo{padding:0;border:1px solid #e5e5e5;background:#fafafa;cursor:zoom-in;width:84px;height:84px}" +
      ".pqv-review-photo img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".pqv-photo-pick{display:flex;flex-direction:column;gap:6px}" +
      ".pqv-photo-pick label{font-size:13px;font-weight:700;color:#111}" +
      ".pqv-photo-previews{display:flex;gap:8px;flex-wrap:wrap}" +
      ".pqv-photo-previews span{position:relative;width:64px;height:64px;border:1px solid #e5e5e5}" +
      ".pqv-photo-previews img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".pqv-photo-previews button{position:absolute;top:-8px;right:-8px;width:22px;height:22px;border:0;background:#111;color:#fff;font-size:13px;line-height:22px;cursor:pointer}" +
      ".pqv-photo-lightbox{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".pqv-photo-lightbox img{max-width:100%;max-height:100%;object-fit:contain}" +
      ".pqv-photo-lightbox button{position:absolute;top:12px;right:12px;width:40px;height:40px;border:0;background:#fff;color:#111;font-size:24px;cursor:pointer}";
    document.head.appendChild(css);
  }

  function mount(root, product) {
    if (!root || !product) return;
    var el = root.querySelector("[data-ma-reviews]");
    if (!el) return;
    ensureReviewStyles();

    var productId = String(product.id || "");
    var productName = String(product.name || "");
    el.setAttribute("data-product-id", productId);
    el.innerHTML = '<p class="pqv-reviews-loading">রিভিউ লোড হচ্ছে…</p>';

    fetchReviews(productId, function (res) {
      var reviews = (res && res.reviews) || [];
      var avg = (res && res.average) || 0;
      var count = (res && res.count) || 0;

      el.innerHTML =
        '<div class="pqv-reviews-summary">' +
        '<span class="pqv-reviews-avg">' +
        starsHtml(avg, 18) +
        "</span>" +
        '<span class="pqv-reviews-count">' +
        (count ? avg.toFixed(1) + " / 5 (" + count + " রিভিউ)" : "এখনো কোনো রিভিউ নেই") +
        "</span>" +
        "</div>" +
        '<div class="pqv-review-list">' +
        renderList(reviews) +
        "</div>" +
        '<button type="button" class="pqv-review-write-btn" data-ma-review-toggle="1">রিভিউ লিখুন</button>' +
        '<form class="pqv-review-form" data-ma-review-form="1" hidden>' +
        '<div class="pqv-review-form-stars" data-ma-rating-picker="1">' +
        [1, 2, 3, 4, 5]
          .map(function (n) {
            return '<span class="pqv-rate-star" data-rate="' + n + '">★</span>';
          })
          .join("") +
        "</div>" +
        '<input type="hidden" name="rating" value="0">' +
        '<input type="text" class="pqv-review-input" name="name" maxlength="60" placeholder="আপনার নাম" required>' +
        '<input type="text" class="pqv-review-input" name="orderId" maxlength="100" autocomplete="off" placeholder="অর্ডার নম্বর (ঐচ্ছিক)" aria-label="অর্ডার নম্বর (ঐচ্ছিক)">' +
        '<input type="tel" class="pqv-review-input" name="phone" maxlength="16" autocomplete="tel" placeholder="অর্ডারের মোবাইল নম্বর (ঐচ্ছিক)" aria-label="অর্ডারের মোবাইল নম্বর (ঐচ্ছিক)">' +
        '<p class="pqv-review-form-msg">অর্ডার নম্বর ও মোবাইল দিলে রিভিউতে “✓ যাচাইকৃত ক্রেতা” দেখাবে। এগুলো প্রকাশ করা হবে না।</p>' +
        '<textarea class="pqv-review-input" name="comment" maxlength="600" rows="3" placeholder="আপনার মতামত লিখুন (ঐচ্ছিক)" aria-label="আপনার মতামত"></textarea>' +
        '<div class="pqv-photo-pick"><label>ছবি দিন (ঐচ্ছিক, সর্বোচ্চ ৩টি)<input type="file" accept="image/*" multiple data-ma-photo-input="1" style="display:block;margin-top:6px;font-weight:400"></label>' +
        '<div class="pqv-photo-previews" data-ma-photo-previews="1"></div>' +
        '<p class="pqv-review-form-msg">ছবি দিতে উপরে অর্ডার নম্বর ও মোবাইল দিন — অনুমোদনের পর প্রকাশ হবে।</p></div>' +
        '<button type="submit" class="pqv-review-submit-btn">জমা দিন</button>' +
        '<p class="pqv-review-form-msg" data-ma-review-msg="1"></p>' +
        "</form>";

      var toggleBtn = el.querySelector("[data-ma-review-toggle]");
      var form = el.querySelector("[data-ma-review-form]");
      if (toggleBtn && form) {
        toggleBtn.addEventListener("click", function () {
          form.hidden = !form.hidden;
          toggleBtn.style.display = form.hidden ? "" : "none";
        });
      }

      var starPicker = el.querySelector("[data-ma-rating-picker]");
      var ratingInput = form ? form.querySelector('input[name="rating"]') : null;
      var starEls = starPicker ? starPicker.querySelectorAll(".pqv-rate-star") : [];
      function paint(n) {
        for (var i = 0; i < starEls.length; i++) {
          starEls[i].style.color = i < n ? "#111" : "#ddd";
        }
      }
      if (starPicker && ratingInput) {
        for (var si = 0; si < starEls.length; si++) {
          (function (starEl) {
            starEl.addEventListener("click", function () {
              var n = parseInt(starEl.getAttribute("data-rate"), 10);
              ratingInput.value = String(n);
              paint(n);
            });
          })(starEls[si]);
        }
      }

      el.addEventListener("click", function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest("[data-ma-photo]") : null;
        if (t) openPhoto(t.getAttribute("data-ma-photo"));
      });

      var picked = [];
      var photoInput = form ? form.querySelector("[data-ma-photo-input]") : null;
      var previews = form ? form.querySelector("[data-ma-photo-previews]") : null;
      function drawPreviews() {
        if (!previews) return;
        previews.innerHTML = picked.map(function (p, i) {
          return '<span><img src="' + p.preview + '" alt=""><button type="button" data-ma-unpick="' + i + '" aria-label="ছবি সরান">×</button></span>';
        }).join("");
      }
      if (previews) previews.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-ma-unpick]") : null;
        if (!b) return;
        picked.splice(parseInt(b.getAttribute("data-ma-unpick"), 10), 1);
        drawPreviews();
      });
      if (photoInput) photoInput.addEventListener("change", function () {
        var msgEl = form.querySelector("[data-ma-review-msg]");
        var files = Array.prototype.slice.call(photoInput.files || [], 0, MAX_PHOTOS - picked.length);
        photoInput.value = "";
        files.forEach(function (f) {
          shrinkToWebp(f, function (res, err) {
            if (!res) { if (msgEl) msgEl.textContent = err; return; }
            if (picked.length < MAX_PHOTOS) { picked.push(res); drawPreviews(); }
          });
        });
      });

      if (form) {
        form.addEventListener("submit", function (ev) {
          ev.preventDefault();
          var msgEl = form.querySelector("[data-ma-review-msg]");
          var fd = new FormData(form);
          var rating = parseInt(fd.get("rating"), 10);
          var name = String(fd.get("name") || "").trim();
          var comment = String(fd.get("comment") || "").trim();
          if (!name) {
            if (msgEl) msgEl.textContent = "আপনার নাম দিন।";
            return;
          }
          if (!rating) {
            if (msgEl) msgEl.textContent = "রেটিং দিন (তারায় চাপুন)।";
            return;
          }
          var orderId = String(fd.get("orderId") || "").trim(), phone = String(fd.get("phone") || "").trim();
          if (picked.length && (!orderId || !phone)) {
            if (msgEl) msgEl.textContent = "ছবি দিতে অর্ডার নম্বর ও অর্ডারের মোবাইল নম্বর দিন।";
            return;
          }
          var submitBtn = form.querySelector(".pqv-review-submit-btn");
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = picked.length ? "ছবি আপলোড হচ্ছে…" : "জমা হচ্ছে…";
          }
          Promise.all(picked.map(function (p) { return uploadPhoto(p.b64); })).then(function (urls) {
            if (submitBtn) submitBtn.textContent = "জমা হচ্ছে…";
            submitReview(
            { productId: productId, productName: productName, name: name, rating: rating, comment: comment, orderId: orderId, phone: phone, photos: urls },
            function (res2) {
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "জমা দিন";
              }
              if (msgEl) {
                msgEl.textContent =
                  (res2 && res2.message) || (res2 && res2.ok ? "ধন্যবাদ!" : "সমস্যা হয়েছে, আবার চেষ্টা করুন।");
              }
              if (res2 && res2.ok) {
                form.reset();
                picked = [];
                drawPreviews();
                if (ratingInput) ratingInput.value = "0";
                paint(0);
                setTimeout(function () {
                  form.hidden = true;
                  if (toggleBtn) toggleBtn.style.display = "";
                }, 2500);
              }
            }
          );
          }).catch(function (upErr) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "জমা দিন"; }
            if (msgEl) msgEl.textContent = String(upErr && upErr.message || "ছবি আপলোড হয়নি।");
          });
        });
      }
    });
  }

  window.MAReviews = { mount: mount };
})();

