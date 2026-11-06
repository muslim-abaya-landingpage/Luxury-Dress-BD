/* Dashboard → "এখন যা করতে হবে" strip: the four numbers that need action, each one tap away.
   The counts come from the existing sections further down (orders needing action, stock alerts,
   inbox), so there is one source of truth and no extra server request. */
(function () {
  "use strict";
  var items = Array.prototype.slice.call(document.querySelectorAll("#dzTodo [data-src]"));
  function sync(item) {
    var src = document.getElementById(item.getAttribute("data-src"));
    if (!src) return;
    var raw = String(src.textContent || "").trim();
    var n = Number(raw.replace(/[^\d]/g, ""));
    var known = raw !== "" && raw !== "—" && Number.isFinite(n);
    item.querySelector("b").textContent = known ? n.toLocaleString("en-US") : "—";
    item.classList.toggle("is-hot", known && n > 0);
    item.classList.toggle("is-clear", known && n === 0);
  }
  items.forEach(function (item) {
    var src = document.getElementById(item.getAttribute("data-src"));
    if (!src) return;
    sync(item);
    if (typeof MutationObserver === "function") new MutationObserver(function () { sync(item); }).observe(src, { childList: true, characterData: true, subtree: true });
  });
  var overdue = document.querySelector('#dzTodo a[href="#admTasksHeading"]');
  if (overdue) overdue.addEventListener("click", function (e) {
    var target = document.getElementById("admTasksHeading");
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
