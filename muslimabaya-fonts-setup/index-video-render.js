/**
 * হোমপেজ ভিডিও সেকশন রেন্ডারার — এই ফাইলে কিছু বদলানোর দরকার নেই।
 * ভিডিও যোগ/বাদ/পরিবর্তনের জন্য শুধু video-config.js এডিট করুন।
 */
(function () {
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function playVideo(videoId) {
    if (!videoId || videoId.indexOf("VIDEO_ID_") === 0) return; // unset placeholder in video-config.js
    var modal = document.getElementById("videoModal");
    var iframe = document.getElementById("modalIframe");
    if (!modal || !iframe) return;
    iframe.src =
      "https://www.youtube.com/embed/" + encodeURIComponent(videoId) + "?autoplay=1&rel=0&modestbranding=1";
    modal.style.display = "flex";
  }

  function bindVideoGridClicks(grid) {
    // Delegated on the grid container so it keeps working even though
    // renderVideoGrid() rebuilds the cards' innerHTML.
    if (grid.__luxVideoClickBound) return;
    grid.__luxVideoClickBound = true;
    grid.addEventListener("click", function (e) {
      var facade = e.target.closest(".lux-video-facade");
      if (!facade) return;
      var ratio = facade.closest(".lux-video-ratio");
      var videoId = ratio && ratio.getAttribute("data-video-id");
      playVideo(videoId);
    });
  }

  function renderVideoGrid() {
    var grid = document.getElementById("luxVideoGrid");
    var videos = window.SITE_VIDEOS;
    if (!grid || !Array.isArray(videos) || !videos.length) return;

    grid.innerHTML = videos
      .map(function (v) {
        var id = escapeHtml(v.videoId || "");
        var title = escapeHtml(v.title || "");
        var desc = escapeHtml(v.description || "");
        return (
          '<div class="lux-video-card">' +
          '<div class="lux-video-ratio" data-video-id="' + id + '">' +
          '<button type="button" class="lux-video-facade">' +
          '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="' + title + ' video" width="480" height="360" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'images/Baby-Pink-Floral-Print.jpeg\';">' +
          '<span class="lux-video-play"></span>' +
          "</button>" +
          "</div>" +
          '<div class="video-content">' +
          "<h4>" + title + "</h4>" +
          "<p>" + desc + "</p>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    bindVideoGridClicks(grid);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderVideoGrid);
  } else {
    renderVideoGrid();
  }
})();
