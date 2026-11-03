/* Shared browser image preparation used by the Product Manager and Smart Upload. */
(function (global) {
  "use strict";

  function resizeToWebp(file, maxWidth, quality) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      var url = URL.createObjectURL(file);
      function cleanup() { URL.revokeObjectURL(url); }
      image.onload = function () {
        cleanup();
        var width = image.naturalWidth || image.width;
        var height = image.naturalHeight || image.height;
        if (!width || !height) { reject(new Error("IMAGE_LOAD_FAILED")); return; }
        var scale = width > maxWidth ? maxWidth / width : 1;
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        var context = canvas.getContext("2d");
        if (!context) { reject(new Error("CANVAS_UNAVAILABLE")); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error("ENCODE_FAILED")); return; }
          if (String(blob.type || "").toLowerCase() !== "image/webp") {
            reject(new Error("WebP conversion is not supported in this browser. Update your browser and try again."));
            return;
          }
          resolve(blob);
        }, "image/webp", quality);
      };
      image.onerror = function () { cleanup(); reject(new Error("IMAGE_LOAD_FAILED")); };
      image.src = url;
    });
  }

  global.MaImageTools = global.MaImageTools || {};
  global.MaImageTools.resizeToWebp = resizeToWebp;
}(window));
