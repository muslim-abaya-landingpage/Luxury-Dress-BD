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
        cb({ ok: false, message: "নেটওয়ার মাস্যা হয়েছে, আবার চেষ্টা করুন।" });
      });
  }

  function renderList(reviews) {
    if (!reviews.length) {
      return '<p class="pqv-reviews-empty">এখনো কোনো রিভিউ নেই — প্রথম রিভিউ আপনিই দিন!</p>';
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
          "</span>" +
          '<span class="pqv-review-date">' +
          esc(r.date) +
          "</span>" +
          "</div>" +
          (r.comment ? '<p class="pqv-review-comment">' + esc(r.comment) + "</p>" : "") +
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
      ".pqv-review-form-msg{font-size:12.5px;color:#555;margin:0}";
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
        '<button type="button" class="pqv-review-write-btn" data-ma-review-toggle="1">+ একটি রিভিউ লিখুন</button>' +
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
        '<textarea class="pqv-review-input" name="comment" maxlength="600" rows="3" placeholder="আপনার অভিজ্ঞতা লিখুন (ঐচ্ছিক)"></textarea>' +
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
            if (msgEl) msgEl.textContent = "রেটিং দিন (স্টারে ক্লিক করুন)।";
            return;
          }
          var submitBtn = form.querySelector(".pqv-review-submit-btn");
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "জমা হচ্ছে…";
          }
          submitReview(
            { productId: productId, productName: productName, name: name, rating: rating, comment: comment },
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
                if (ratingInput) ratingInput.value = "0";
                paint(0);
                setTimeout(function () {
                  form.hidden = true;
                  if (toggleBtn) toggleBtn.style.display = "";
                }, 2500);
              }
            }
          );
        });
      }
    });
  }

  window.MAReviews = { mount: mount };
})();
