/* Sign in / Sign up drawer: two side-by-side panels that slide, without reloading the page. */
(function (g) {
  "use strict";
  var doc = g.document;
  var track = doc.getElementById("authTrack");
  if (!track) return;
  var viewport = track.parentNode;
  var TITLES = { signin: "Sign in | Muslim Abaya", signup: "Create an account | Muslim Abaya" };
  var panels = { signin: doc.getElementById("panel-signin"), signup: doc.getElementById("panel-signup") };
  var tabs = { signin: doc.getElementById("tab-signin"), signup: doc.getElementById("tab-signup") };
  var reduceMotion = g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fitHeight() {
    var panel = panels[track.getAttribute("data-active")];
    if (panel) viewport.style.height = panel.offsetHeight + "px";
  }

  function show(name, opts) {
    opts = opts || {};
    if (!panels[name]) return;
    track.setAttribute("data-active", name);
    Object.keys(panels).forEach(function (key) {
      var on = key === name;
      tabs[key].setAttribute("aria-selected", on ? "true" : "false");
      tabs[key].tabIndex = on ? 0 : -1;
      if (on) panels[key].removeAttribute("inert");
      else panels[key].setAttribute("inert", "");
    });
    fitHeight();
    if (!opts.initial) {
      doc.title = TITLES[name];
      try { g.history.replaceState(null, "", "/" + name + g.location.search); } catch (e) {}
      var first = panels[name].querySelector("input");
      if (first && opts.focus !== false) g.setTimeout(function () { first.focus({ preventScroll: true }); }, reduceMotion ? 0 : 320);
    }
  }

  doc.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("[data-auth-tab]");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    show(link.getAttribute("data-auth-tab"), { focus: !link.classList.contains("si-tab") });
  });

  // Arrow keys move between the two tabs.
  doc.querySelector(".si-tabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    var name = track.getAttribute("data-active") === "signin" ? "signup" : "signin";
    show(name, { focus: false });
    tabs[name].focus();
    e.preventDefault();
  });

  // Swipe left/right on phones.
  var startX = null, startY = 0;
  viewport.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, { passive: true });
  viewport.addEventListener("touchend", function (e) {
    if (startX == null) return;
    var dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (e.target.closest && e.target.closest("input, button")) return;
    show(dx < 0 ? "signup" : "signin", { focus: false });
  }, { passive: true });

  // Error messages and the strength hint change a panel's height.
  if (g.ResizeObserver) {
    var ro = new g.ResizeObserver(fitHeight);
    ro.observe(panels.signin); ro.observe(panels.signup);
  }
  g.addEventListener("resize", fitHeight);

  show(track.getAttribute("data-active") || "signin", { initial: true });
  g.requestAnimationFrame(function () { track.classList.add("is-ready"); });
})(window);
