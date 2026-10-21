/* Smooth open/close for FAQ dropdowns (<details> inside [data-accordion]).
 * One answer open per group; #id links open that question; works without JS (plain <details>). */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var OPEN_MS = 280, CLOSE_MS = 220, EASE = "cubic-bezier(.2,.7,.2,1)";

  function bodyOf(d) { return d.querySelector(".hp-answer"); }

  function finish(d) {
    var body = bodyOf(d);
    d._anim = null;
    d.classList.remove("is-closing");
    if (body) body.style.overflow = "";
  }

  function setOpen(d, open, instant) {
    var body = bodyOf(d);
    if (d._anim) { d._anim.cancel(); finish(d); }
    if (!body || reduce || instant || !body.animate) { d.open = open; return; }
    body.style.overflow = "hidden";
    if (open) {
      d.open = true;
      var h = body.scrollHeight;
      d._anim = body.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: OPEN_MS, easing: EASE });
      d._anim.onfinish = function () { finish(d); };
    } else {
      d.classList.add("is-closing");
      var from = body.offsetHeight;
      d._anim = body.animate([{ height: from + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: CLOSE_MS, easing: EASE });
      d._anim.onfinish = function () { d.open = false; finish(d); };
    }
  }

  function closeOthers(d) {
    var group = d.closest("[data-accordion]");
    if (!group) return;
    group.querySelectorAll("details[open]").forEach(function (o) { if (o !== d) setOpen(o, false); });
  }

  document.querySelectorAll("[data-accordion] details").forEach(function (d) {
    var summary = d.querySelector("summary");
    if (!summary) return;
    summary.addEventListener("click", function (e) {
      e.preventDefault();
      var opening = !d.open || d.classList.contains("is-closing");
      if (opening) closeOthers(d);
      setOpen(d, opening);
    });
  });

  // A link to #id opens that question (or the first question of a topic).
  function openFromHash() {
    var id = (location.hash || "").slice(1);
    if (!/^[\w-]+$/.test(id)) return;
    var t = document.getElementById(id);
    if (!t) return;
    var d = t.tagName === "DETAILS" ? t : t.querySelector("details");
    if (!d || !d.closest("[data-accordion]")) return;
    closeOthers(d);
    setOpen(d, true, true);
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
