/**
 * Muslim Abaya — Premium Pro client reviews (real Messenger / WhatsApp screenshots).
 */
(function (global) {
  var VERSION = "20261003tt";
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
    var canAnimate = typeof Element !== "undefined" && typeof Element.prototype.animate === "function";
    // Continuous, seamless auto-running marquee (slow right-to-left drift) driven by a
    // compositor-run CSS transform animation (Web Animations API): sub-pixel smooth, no
    // per-frame JavaScript. Reduced-motion visitors (or very old browsers) keep the calm
    // "one card every few seconds" scroll behaviour.
    var marquee = n >= 2 && !reduceMotion && canAnimate;

    var STEP_MS = 3200;      // step autoplay interval (fallback mode)
    var SPEED = 38;          // marquee drift, px per second
    var RESUME_MS = 2200;    // resume this long after the visitor stops interacting
    var GLIDE_MS = 450;      // arrow / dot glide duration

    var autoplayTimer = null;
    var allCards = Array.prototype.slice.call(cards);
    var rail = null;         // wrapper that gets transformed
    var anim = null;         // the looping animation
    var setW = 0;            // width of one full set of reviews (cards + gaps)
    var duration = 0;        // ms for one loop
    var glideRaf = 0;
    var dragging = false;
    var dotTimer = 0;

    function isPausedNow() {
      return isHoverPaused || isOffscreen || isHidden || dragging || !!glideRaf;
    }

    function wrap(i) {
      return ((i % n) + n) % n;
    }

    /* ---------- marquee ---------- */

    function measureSet() {
      // sub-pixel accurate so the loop seam is invisible
      var first = allCards[0].getBoundingClientRect();
      var last = allCards[n - 1].getBoundingClientRect();
      var gap = n > 1 ? allCards[1].getBoundingClientRect().left - first.right : 0;
      setW = last.right - first.left + gap;
    }

    function removeClones() {
      Array.prototype.forEach.call(track.querySelectorAll('[data-ma-clone="1"]'), function (el) {
        el.parentNode.removeChild(el);
      });
    }

    function buildRail() {
      if (!rail) {
        var cs = global.getComputedStyle(track);
        rail = document.createElement("div");
        rail.className = "ma-reviews-rail";
        rail.style.cssText =
          "display:flex;flex:0 0 auto;gap:" + (cs.columnGap && cs.columnGap !== "normal" ? cs.columnGap : "20px") +
          ";will-change:transform;user-select:none;-webkit-user-select:none";
        allCards.forEach(function (c) { rail.appendChild(c); });
        track.appendChild(rail);
        // the track becomes a clipping window; vertical page scroll still works (touch-action)
        track.style.overflow = "hidden";
        track.style.scrollSnapType = "none";
        track.style.touchAction = "pan-y";
        track.style.cursor = "grab";
      }
      removeClones();
      measureSet();
      if (!(setW > 0)) return false;
      var sets = Math.ceil(track.clientWidth / setW) + 1; // enough copies to fill the window while looping
      for (var s = 1; s <= sets; s++) {
        for (var c = 0; c < n; c++) {
          var clone = allCards[c].cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          clone.setAttribute("data-ma-clone", "1");
          clone.setAttribute("inert", "");
          rail.appendChild(clone);
        }
      }
      return true;
    }

    function startAnimation(fromFraction) {
      if (anim) anim.cancel();
      duration = (setW / SPEED) * 1000;
      anim = rail.animate(
        [{ transform: "translate3d(0,0,0)" }, { transform: "translate3d(" + -setW + "px,0,0)" }],
        { duration: duration, iterations: Infinity, easing: "linear" }
      );
      anim.currentTime = (fromFraction || 0) * duration + duration; // keep it positive after any rewind
      syncPlayState();
    }

    function fraction() {
      var t = Number(anim.currentTime) || 0;
      return (((t % duration) + duration) % duration) / duration;
    }

    function syncPlayState() {
      if (!anim) return;
      if (isPausedNow()) {
        if (anim.playState === "running") anim.pause();
      } else if (anim.playState !== "running") {
        anim.play();
      }
    }

    // shift the loop position by dx pixels (positive = content moves left)
    function shiftBy(dx) {
      var t = Number(anim.currentTime) || 0;
      var next = t + (dx / SPEED) * 1000;
      while (next < duration) next += duration; // stay in a positive iteration
      anim.currentTime = next;
    }

    function glide(deltaPx) {
      cancelAnimationFrame(glideRaf);
      var start = null;
      var done = 0;
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / GLIDE_MS);
        var eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        shiftBy((deltaPx * eased) - done);
        done = deltaPx * eased;
        if (p < 1) {
          glideRaf = requestAnimationFrame(tick);
        } else {
          glideRaf = 0;
          syncPlayState();
        }
      }
      if (anim && anim.playState === "running") anim.pause();
      glideRaf = requestAnimationFrame(tick);
    }

    function cardCenterOffset(card) {
      var r = card.getBoundingClientRect();
      var t = track.getBoundingClientRect();
      return r.left + r.width / 2 - (t.left + t.width / 2);
    }

    function nearestIndex() {
      var all = track.querySelectorAll(".ma-review-shot-card");
      var best = 0;
      var bestDist = Infinity;
      for (var c = 0; c < all.length; c++) {
        var dist = Math.abs(cardCenterOffset(all[c]));
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      return wrap(best);
    }

    function cardStep() {
      var a = allCards[0].getBoundingClientRect();
      var gap = n > 1 ? allCards[1].getBoundingClientRect().left - a.right : 0;
      return a.width + gap;
    }

    /* ---------- shared UI ---------- */

    // IMPORTANT: only moves the carousel itself (never scrolls the page).
    function scrollTo(i) {
      i = wrap(i);
      index = i;
      if (marquee && anim) {
        // glide to the copy of card i that is closest to the middle of the window
        var all = track.querySelectorAll(".ma-review-shot-card");
        var bestDelta = Infinity;
        for (var c = i; c < all.length; c += n) {
          var d = cardCenterOffset(all[c]);
          if (Math.abs(d) < Math.abs(bestDelta)) bestDelta = d;
        }
        if (isFinite(bestDelta)) glide(bestDelta);
      } else {
        var card = allCards[i];
        if (card) {
          var left = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
          track.scrollTo({ left: left, behavior: "smooth" });
        }
      }
      updateDots();
    }

    function stepBy(dir) {
      if (marquee && anim) {
        glide(dir * cardStep());
        return;
      }
      scrollTo(index + dir);
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
      syncPlayState();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        isHoverPaused = false;
        syncPlayState();
      }, marquee ? RESUME_MS : STEP_MS);
    }

    function hold() {
      clearTimeout(resumeTimer);
      isHoverPaused = true;
      syncPlayState();
    }
    function release() {
      isHoverPaused = false;
      syncPlayState();
    }

    track.addEventListener("mouseenter", hold);
    track.addEventListener("mouseleave", function () { if (!dragging) release(); });
    track.addEventListener("focusin", hold);
    track.addEventListener("focusout", release);
    track.addEventListener("touchstart", hold, { passive: true });
    track.addEventListener("touchend", pauseThenResume, { passive: true });
    track.addEventListener("touchcancel", pauseThenResume, { passive: true });
    document.addEventListener("visibilitychange", function () {
      isHidden = !!document.hidden;
      syncPlayState();
    });

    // Only run while the carousel is actually visible on screen (also stops the old
    // "page jumps down while browsing products" problem).
    if ("IntersectionObserver" in global) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            isOffscreen = !entry.isIntersecting;
          });
          syncPlayState();
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

    // fallback mode: after native scrolling stops, refresh the active dot
    var scrollTimer;
    track.addEventListener(
      "scroll",
      function () {
        if (marquee) return;
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
          index = nearestIndex();
          updateDots();
        }, 120);
      },
      { passive: true }
    );

    updateDots();

    function enableDrag() {
      var startX = 0;
      var startT = 0;
      track.addEventListener("pointerdown", function (ev) {
        if (!anim || (ev.pointerType === "mouse" && ev.button !== 0)) return;
        cancelAnimationFrame(glideRaf);
        glideRaf = 0;
        dragging = true;
        startX = ev.clientX;
        startT = Number(anim.currentTime) || 0;
        clearTimeout(resumeTimer);
        syncPlayState();
        track.style.cursor = "grabbing";
        try { track.setPointerCapture(ev.pointerId); } catch (e) {}
      });
      track.addEventListener("pointermove", function (ev) {
        if (!dragging || !anim) return;
        var next = startT - ((ev.clientX - startX) / SPEED) * 1000;
        while (next < duration) next += duration;
        anim.currentTime = next;
      });
      function endDrag() {
        if (!dragging) return;
        dragging = false;
        track.style.cursor = "grab";
        index = nearestIndex();
        updateDots();
        pauseThenResume();
      }
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);
      // keyboard: the track is focusable (tabindex=0)
      track.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowRight") { ev.preventDefault(); stepBy(1); pauseThenResume(); }
        else if (ev.key === "ArrowLeft") { ev.preventDefault(); stepBy(-1); pauseThenResume(); }
      });
    }

    // Autoplay is switched on by the caller once the stylesheet has loaded: before that the
    // cards are unstyled, so their widths (needed to build the seamless loop) are meaningless.
    var activated = false;
    function activate(tries) {
      if (activated) return;
      tries = tries || 0;
      if (marquee) {
        measureSet();
        if (!(setW > 0) && tries < 8) {
          setTimeout(function () { activate(tries + 1); }, 400);
          return;
        }
      }
      activated = true;
      if (marquee && buildRail()) {
        startAnimation(0);
        enableDrag();
        dotTimer = setInterval(function () {
          if (isPausedNow() && !dragging) return;
          var i = nearestIndex();
          if (i !== index) {
            index = i;
            updateDots();
          }
        }, 300);
        var resizeTimer;
        global.addEventListener("resize", function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            var f = anim ? fraction() : 0;
            if (buildRail()) startAnimation(f);
          }, 200);
        });
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
    link.href = "/customer-reviews.css?v=" + VERSION;
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
