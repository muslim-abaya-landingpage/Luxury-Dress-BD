/**
 * Muslim Abaya — Premium Pro client reviews (real Messenger / WhatsApp screenshots).
 */
(function (global) {
  var VERSION = "20261003auto";
  var SKIP_PATH =
    /^\/(checkout|signin|signup|thank-you|success|privacy|terms|refund)(\/|$)/i;

  var REVIEWS = [
    {
      name: "Tanjima Akter Saima",
      platform: "Messenger",
      product: "Floral Two-piece",
      rating: 5,
      text: "Previous order was very beautiful — fabric is so soft. Ordering two more!",
      textBn: "আগের গুলো পেয়েছি অনেক সুন্দর হয়েছে, কাপড়ও soft ❤️",
      image: "assets/reviews/client-review-1.jpg",
      initials: "TS"
    },
    {
      name: "SaZia",
      platform: "Messenger",
      product: "Premium Dress Set",
      rating: 5,
      text: "Alhamdulillah — dresses are so beautiful. Fabric is extremely soft. Very good!",
      textBn: "Alhamdulillah — dress গুলো একদম সুন্দর, কাপড় অনেক soft... অনেক ভালো ❤️",
      image: "assets/reviews/client-review-2.jpg",
      initials: "SZ"
    },
    {
      name: "Verified Customer",
      platform: "WhatsApp",
      product: "Modest Dress",
      rating: 5,
      text: "Received it — I never imagined the fabric would be this good!",
      textBn: "হ্যাঁ পেয়েছি — কাপড় এত ভালো হবে আমি কল্পনাও করিনি ❤️",
      image: "assets/reviews/client-review-3.jpg",
      initials: "VC"
    },
    {
      name: "Shanto",
      platform: "Messenger",
      product: "Heart Print Dress",
      rating: 5,
      text: "Apu, I have received the dress — exactly as shown. Very happy!",
      textBn: "আপু, ড্রেস পেয়ে গেছি আপু ❤️",
      image: "assets/reviews/client-review-4.jpg",
      initials: "SH"
    }
  ];

  var STAR =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>';

  var CHECK =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  var ICON_MESSENGER =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.447 5.492 3.708 7.17V22l3.405-1.87c.907.25 1.867.385 2.887.385 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.043 12.414-2.564-2.736-5.012 2.736L10.9 8.586l2.628 2.736 4.957-2.736-6.442 6.828z"/></svg>';

  var ICON_WHATSAPP =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12.004 2a9.99 9.99 0 0 0-8.595 15.07L2.5 21.5l4.55-1.19A9.99 9.99 0 1 0 12.004 2zm5.35 14.01c-.24.67-1.4 1.31-2.02 1.39-.51.07-1.17.12-1.87-.06-.43-.1-.99-.36-1.72-.7-3.02-1.31-4.98-4.46-5.12-4.7-.14-.24-1.19-1.99-1.19-3.68 0-1.69.88-2.52 1.19-2.89.31-.37.68-.46.93-.46.25 0 .5.01.72.03.22.02.57-.04.88.44.31.48 1.05 1.67 1.15 1.8.1.13.17.3.04.48-.13.18-.21.3-.42.48-.21.18-.43.39-.62.56-.21.19-.43.4-.19.78.24.38 1.1 1.72 2.36 2.97 1.54 1.37 2.84 1.8 3.28 2.13.44.33.85.28 1.17.17.32-.11 2.02-.77 2.3-.9.28-.13.47-.2.54-.31.07-.11.07-.64-.17-1.28z"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizePath() {
    var p = String((global.location && global.location.pathname) || "/");
    p = p.replace(/\/index\.html$/i, "/");
    p = p.replace(/\.html$/i, "");
    if (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
    return p || "/";
  }

  function shouldShow() {
    return !SKIP_PATH.test(normalizePath());
  }

  function starsHtml(count) {
    var n = Math.max(0, Math.min(5, count | 0));
    var html = '<span class="ma-review-stars" role="img" aria-label="' + n + ' out of 5 stars">';
    for (var i = 0; i < n; i++) html += STAR;
    return html + "</span>";
  }

  function platformIcon(platform) {
    return platform === "WhatsApp" ? ICON_WHATSAPP : ICON_MESSENGER;
  }

  function platformClass(platform) {
    return platform === "WhatsApp" ? "ma-platform-wa" : "ma-platform-msg";
  }

  function reviewCard(r) {
    return (
      '<article class="ma-review-shot-card">' +
      '<div class="ma-review-shot-body">' +
      '<div class="ma-review-top">' +
      '<div class="ma-review-avatar" aria-hidden="true">' +
      esc(r.initials) +
      "</div>" +
      '<div class="ma-review-meta">' +
      '<p class="ma-review-name">' +
      esc(r.name) +
      "</p>" +
      starsHtml(r.rating) +
      "</div>" +
      '<span class="ma-review-platform ' +
      platformClass(r.platform) +
      '">' +
      platformIcon(r.platform) +
      esc(r.platform) +
      "</span></div>" +
      '<span class="ma-review-badge">' +
      CHECK +
      "Verified Purchase</span>" +
      '<span class="ma-review-product">' +
      esc(r.product) +
      "</span>" +
      '<p class="ma-review-text">“' +
      esc(r.text) +
      '”</p>' +
      (r.textBn
        ? '<p class="ma-review-text-bn">' + esc(r.textBn) + "</p>"
        : "") +
      "</div></article>"
    );
  }

  function buildHtml(fbUrl, waUrl) {
    var cards = REVIEWS.map(reviewCard).join("");
    return (
      '<div class="ma-reviews-wrap">' +
      '<div class="ma-reviews-head">' +
      '<div class="ma-reviews-eyebrow">' +
      STAR +
      " Premium Pro · Real Client Reviews</div>" +
      '<h2 class="ma-reviews-title" id="ma-reviews-title">Real Messenger &amp; WhatsApp Reviews</h2>' +
      '<p class="ma-reviews-subtitle">Actual chat screenshots from happy customers — fabric quality, delivery and repeat orders across Bangladesh.</p>' +
      "</div>" +
      '<div class="ma-reviews-summary">' +
      '<div class="ma-reviews-stat">' +
      '<div class="ma-reviews-stars-lg" aria-hidden="true">' +
      STAR +
      STAR +
      STAR +
      STAR +
      STAR +
      "</div>" +
      "<strong>4.9</strong><span>Average rating</span></div>" +
      '<div class="ma-reviews-stat"><strong>2,400+</strong><span>Happy customers</span></div>' +
      '<div class="ma-reviews-stat"><strong>Real chats</strong><span>Messenger &amp; WhatsApp</span></div>' +
      "</div>" +
      '<div class="ma-reviews-track-wrap">' +
      '<div class="ma-reviews-track" id="maReviewsTrack" tabindex="0" aria-label="Client review screenshots">' +
      cards +
      "</div>" +
      '<div class="ma-reviews-nav">' +
      '<button type="button" class="ma-reviews-nav-btn" id="maReviewsPrev" aria-label="Previous review">' +
      "&#8592;</button>" +
      '<button type="button" class="ma-reviews-nav-btn" id="maReviewsNext" aria-label="Next review">' +
      "&#8594;</button>" +
      "</div>" +
      '<div class="ma-reviews-dots" id="maReviewsDots"></div>' +
      "</div>" +
      '<div class="ma-reviews-cta">' +
      '<a href="' +
      esc(waUrl) +
      '" target="_blank" rel="noopener" class="ma-reviews-cta-btn ma-reviews-cta-primary">Order on WhatsApp</a>' +
      '<a href="' +
      esc(fbUrl) +
      '" target="_blank" rel="noopener" class="ma-reviews-cta-btn ma-reviews-cta-secondary">Message on Facebook</a>' +
      "</div></div>"
    );
  }

  function injectSchema() {
    var site = (global.SITE_SEO && global.SITE_SEO.siteUrl) || "https://muslimabaya.com";
    site = String(site).replace(/\/$/, "");
    var brand = (global.SITE_SEO && global.SITE_SEO.brand) || "Muslim Abaya";
    var reviews = REVIEWS.map(function (r) {
      return {
        "@type": "Review",
        author: { "@type": "Person", name: r.name },
        datePublished: "2026-05-01",
        reviewBody: r.text,
        name: r.product + " review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5
        }
      };
    });
    var data = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": site + "/#organization",
      name: brand,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: String(REVIEWS.length),
        bestRating: "5"
      },
      review: reviews
    };
    var el = document.getElementById("ma-reviews-schema");
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "ma-reviews-schema";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function initCarousel(track) {
    if (!track) return;
    var cards = track.querySelectorAll(".ma-review-shot-card");
    if (!cards.length) return;

    var dotsWrap = document.getElementById("maReviewsDots");
    var prevBtn = document.getElementById("maReviewsPrev");
    var nextBtn = document.getElementById("maReviewsNext");
    var n = cards.length;
    var index = 0;
    var isHoverPaused = false;
    var isOffscreen = false;
    var isHidden = !!document.hidden;
    var resumeTimer = null;

    var reduceMotion = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    // Continuous, seamless auto-running marquee (slow right-to-left drift). Reduced-motion
    // visitors keep the old calm "one card every few seconds" behaviour.
    var marquee = n >= 2 && !reduceMotion;

    var STEP_MS = 3200;      // reduced-motion step autoplay interval
    var SPEED = 38;          // marquee drift, px per second
    var RESUME_MS = 2200;    // resume this long after the visitor stops interacting

    var autoplayTimer = null;
    var allCards = Array.prototype.slice.call(cards);
    var setW = 0;            // width of one full set of reviews (cards + gaps)
    var pos = 0;             // marquee position (float)
    var lastTs = 0;
    var rafId = 0;
    var dotTick = 0;

    function isPausedNow() {
      return isHoverPaused || isOffscreen || isHidden;
    }

    function wrap(i) {
      return ((i % n) + n) % n;
    }

    /* ---------- marquee helpers ---------- */

    function measureSet() {
      // sub-pixel accurate (offsetLeft is rounded), so the loop seam stays invisible
      var first = allCards[0].getBoundingClientRect();
      var last = allCards[n - 1].getBoundingClientRect();
      var gap = n > 1 ? allCards[1].getBoundingClientRect().left - first.right : 0;
      setW = last.right - first.left + gap;
    }

    function buildClones() {
      measureSet();
      if (setW <= 0) return false;
      // Need content for [0.5 set .. 1.5 set] + one viewport, so enough sets in total.
      var sets = Math.ceil(1.5 + track.clientWidth / setW) + 1;
      for (var s = 1; s < sets; s++) {
        for (var c = 0; c < n; c++) {
          var clone = allCards[c].cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          clone.setAttribute("data-ma-clone", "1");
          clone.setAttribute("inert", "");
          track.appendChild(clone);
        }
      }
      track.style.scrollSnapType = "none"; // snapping would fight the continuous drift
      pos = setW; // start in the middle set so there is room on both sides
      track.scrollLeft = pos;
      return true;
    }

    function normalize() {
      if (!setW) return;
      var cur = track.scrollLeft;
      var fixed = cur;
      while (fixed >= setW * 1.5) fixed -= setW;
      while (fixed < setW * 0.5) fixed += setW;
      if (fixed !== cur) track.scrollLeft = fixed;
      pos = fixed;
    }

    function nearestIndex() {
      var all = track.querySelectorAll(".ma-review-shot-card");
      var center = track.scrollLeft + track.clientWidth / 2;
      var best = 0;
      var bestDist = Infinity;
      for (var c = 0; c < all.length; c++) {
        var dist = Math.abs(center - (all[c].offsetLeft + all[c].offsetWidth / 2));
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      return wrap(best);
    }

    function cardStep() {
      return allCards[0].offsetWidth + (n > 1 ? allCards[1].offsetLeft - allCards[0].offsetLeft - allCards[0].offsetWidth : 0);
    }

    function frame(ts) {
      rafId = global.requestAnimationFrame(frame);
      if (!lastTs) {
        lastTs = ts;
        return;
      }
      var dt = Math.min(ts - lastTs, 64);
      lastTs = ts;
      if (isPausedNow()) {
        pos = track.scrollLeft; // stay in sync with wherever the visitor left it
        return;
      }
      pos += (SPEED * dt) / 1000;
      if (pos >= setW * 1.5) pos -= setW;
      track.scrollLeft = pos;
      dotTick += dt;
      if (dotTick > 300) {
        dotTick = 0;
        index = nearestIndex();
        updateDots();
      }
    }

    function startMarquee() {
      if (rafId) return;
      lastTs = 0;
      rafId = global.requestAnimationFrame(frame);
    }

    /* ---------- shared UI ---------- */

    // IMPORTANT: only scroll the track horizontally (never the page).
    // Using scrollIntoView() here previously moved the whole page
    // vertically whenever the section wasn't fully in view, which
    // yanked users down to the reviews while they were browsing
    // products above. track.scrollTo() only affects this element.
    function scrollTo(i) {
      i = wrap(i);
      var target = allCards[i];
      if (marquee) {
        // pick the copy of card i that is closest to what the visitor is looking at now
        var all = track.querySelectorAll(".ma-review-shot-card");
        var center = track.scrollLeft + track.clientWidth / 2;
        var bestDist = Infinity;
        for (var c = i; c < all.length; c += n) {
          var d = Math.abs(center - (all[c].offsetLeft + all[c].offsetWidth / 2));
          if (d < bestDist) {
            bestDist = d;
            target = all[c];
          }
        }
      }
      index = i;
      if (!target) return;
      var left = target.offsetLeft - (track.clientWidth - target.offsetWidth) / 2;
      track.scrollTo({ left: left, behavior: "smooth" });
      updateDots();
    }

    function stepBy(dir) {
      if (!marquee) {
        scrollTo(index + dir);
        return;
      }
      normalize();
      track.scrollBy({ left: dir * cardStep(), behavior: "smooth" });
    }

    function updateDots() {
      if (!dotsWrap) return;
      var dots = dotsWrap.querySelectorAll(".ma-reviews-dot");
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === index);
      });
      // Infinite loop — arrows and autoplay always stay active.
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
    }

    function startStepAutoplay() {
      stopStepAutoplay();
      if (n < 2) return;
      autoplayTimer = setInterval(function () {
        if (isPausedNow()) return;
        scrollTo(index + 1); // right-to-left: next card slides in from the right
      }, STEP_MS);
    }

    function stopStepAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function pauseThenResume() {
      isHoverPaused = true;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        isHoverPaused = false;
      }, marquee ? RESUME_MS : STEP_MS);
    }

    track.addEventListener("mouseenter", function () { clearTimeout(resumeTimer); isHoverPaused = true; });
    track.addEventListener("mouseleave", function () { isHoverPaused = false; });
    track.addEventListener("touchstart", function () { clearTimeout(resumeTimer); isHoverPaused = true; }, { passive: true });
    track.addEventListener("touchend", pauseThenResume, { passive: true });
    track.addEventListener("touchcancel", pauseThenResume, { passive: true });
    track.addEventListener("focusin", function () { isHoverPaused = true; });
    track.addEventListener("focusout", function () { isHoverPaused = false; });
    document.addEventListener("visibilitychange", function () { isHidden = !!document.hidden; });

    // Only auto-advance while the carousel is actually visible on
    // screen. This is the main fix for the "forced scroll down"
    // complaint: previously autoplay kept firing (and yanking the
    // page) even while the user had scrolled up to look at products.
    if ("IntersectionObserver" in global) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            isOffscreen = !entry.isIntersecting;
          });
        },
        { threshold: 0.2 }
      );
      io.observe(track);
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      for (var d = 0; d < n; d++) {
        (function (di) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "ma-reviews-dot" + (di === 0 ? " is-active" : "");
          dot.setAttribute("aria-label", "Review " + (di + 1));
          dot.addEventListener("click", function () {
            scrollTo(di);
            pauseThenResume();
          });
          dotsWrap.appendChild(dot);
        })(d);
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        stepBy(-1);
        pauseThenResume();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        stepBy(1);
        pauseThenResume();
      });
    }

    // After the visitor (or a smooth scroll) stops moving the track: wrap into the middle set
    // (identical content, so the jump is invisible) and refresh the active dot.
    var scrollTimer;
    track.addEventListener(
      "scroll",
      function () {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
          if (marquee) normalize();
          index = nearestIndex();
          updateDots();
        }, 120);
      },
      { passive: true }
    );

    updateDots();

    // Autoplay is switched on by the caller once the stylesheet has loaded: before that the
    // cards are unstyled, so their widths (needed to build the seamless loop) are meaningless.
    var activated = false;
    function activate(tries) {
      if (activated) return;
      tries = tries || 0;
      if (marquee) {
        measureSet();
        if (setW <= 0 && tries < 8) {
          setTimeout(function () { activate(tries + 1); }, 400);
          return;
        }
      }
      activated = true;
      if (marquee && buildClones()) {
        var resizeTimer;
        global.addEventListener("resize", function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            // rebuild the clone sets for the new width
            Array.prototype.forEach.call(track.querySelectorAll('[data-ma-clone="1"]'), function (el) {
              el.parentNode.removeChild(el);
            });
            track.scrollLeft = 0;
            buildClones();
          }, 200);
        });
        startMarquee();
      } else {
        marquee = false;
        startStepAutoplay();
      }
    }
    return activate;
  }

  function ensureCss(onReady) {
    var existing = document.getElementById("ma-reviews-css");
    if (existing) {
      // Stylesheet tag already present; if it has already loaded, run
      // immediately, otherwise wait for its load event too.
      if (existing.getAttribute("data-loaded") === "1") {
        onReady();
      } else {
        existing.addEventListener("load", onReady, { once: true });
        // Safety net in case the load event was missed (e.g. cached
        // instantly) — never block the section forever.
        setTimeout(onReady, 800);
      }
      return;
    }
    var link = document.createElement("link");
    link.id = "ma-reviews-css";
    link.rel = "stylesheet";
    link.href = "customer-reviews.css?v=" + VERSION;
    link.addEventListener(
      "load",
      function () {
        link.setAttribute("data-loaded", "1");
        onReady();
      },
      { once: true }
    );
    // Safety net: never keep the section hidden forever if the
    // stylesheet fails to fire a load event for some reason.
    setTimeout(onReady, 800);
    document.head.appendChild(link);
  }

  function mount() {
    if (global.__maCustomerReviewsMounted || !shouldShow()) return;

    var footerMount = document.getElementById("site-footer-mount");
    if (!footerMount) return;

    var mountEl = document.getElementById("ma-customer-reviews-mount");
    if (!mountEl) {
      mountEl = document.createElement("section");
      mountEl.id = "ma-customer-reviews-mount";
      mountEl.setAttribute("aria-labelledby", "ma-reviews-title");
      footerMount.parentNode.insertBefore(mountEl, footerMount);
    }

    // Hidden until the stylesheet is confirmed loaded — this is what
    // prevents the "huge unstyled icon" flash some people saw on a
    // hard refresh, when the markup could paint before its CSS did.
    mountEl.style.visibility = "hidden";

    var fbUrl =
      (global.SITE_SEO && global.SITE_SEO.social && global.SITE_SEO.social.facebook) ||
      "https://www.facebook.com/luxurydressofficial";
    var waUrl =
      (global.SITE_SEO && global.SITE_SEO.social && global.SITE_SEO.social.whatsapp) ||
      "https://wa.me/8801971642683";

    mountEl.innerHTML = buildHtml(fbUrl, waUrl);
    injectSchema();
    var activateCarousel = initCarousel(document.getElementById("maReviewsTrack"));
    global.__maCustomerReviewsMounted = true;

    ensureCss(function () {
      mountEl.style.visibility = "";
      if (typeof activateCarousel === "function") activateCarousel();
    });
  }

  global.MaCustomerReviews = { mount: mount };
})(typeof window !== "undefined" ? window : this);
