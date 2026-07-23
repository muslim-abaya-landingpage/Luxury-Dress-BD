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
          '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="' + title + ' video" loading="lazy" onerror="this.onerror=null;this.src=\'images/Baby-Pink-Floral-Print.jpeg\';">' +
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderVideoGrid);
  } else {
    renderVideoGrid();
  }
})();
