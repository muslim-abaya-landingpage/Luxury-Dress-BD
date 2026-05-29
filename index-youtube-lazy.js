(function () {
  function activate(wrap) {
    if (!wrap || wrap.getAttribute("data-loaded") === "1") return;
    var id = wrap.getAttribute("data-video-id");
    if (!id) return;
    wrap.setAttribute("data-loaded", "1");
    var iframe = document.createElement("iframe");
    iframe.src =
      "https://www.youtube-nocookie.com/embed/" +
      id +
      "?autoplay=1&rel=0&modestbranding=1";
    iframe.title = "Luxury Dress Video Preview";
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    );
    iframe.allowFullscreen = true;
    wrap.innerHTML = "";
    wrap.appendChild(iframe);
  }

  document.addEventListener(
    "click",
    function (e) {
      var btn = e.target && e.target.closest && e.target.closest(".lux-video-facade");
      if (!btn) return;
      var wrap = btn.closest("[data-video-id]");
      if (wrap) activate(wrap);
    },
    true
  );
})();
