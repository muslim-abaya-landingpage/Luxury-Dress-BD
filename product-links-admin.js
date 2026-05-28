(function () {
  var sections = window.CATALOG_SECTIONS || [];
  var mount = document.getElementById("plSections");
  if (!mount) return;

  var state = {};

  function getData() {
    return window.PRODUCT_LINKS_DATA || window.PRODUCT_IMAGE_LISTS || {};
  }

  function linesToUrls(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(function (line) {
        return line.replace(/^\s*\/\/\s*/, "").trim();
      })
      .filter(Boolean);
  }

  function urlsToLines(urls) {
    return (urls || []).join("\n");
  }

  function updateCount(key) {
    var el = document.querySelector('[data-count-for="' + key + '"]');
    if (!el) return;
    var n = linesToUrls(state[key] || "").length;
    el.textContent = n + " টি লিংক (লাইন ১ = গ্রিডে প্রথম প্রোডাক্ট)";
  }

  function buildSections() {
    mount.innerHTML = "";
    var data = getData();

    sections.forEach(function (sec) {
      var key = sec.key;
      state[key] = urlsToLines(data[key]);

      var block = document.createElement("section");
      block.className = "pl-section";
      block.innerHTML =
        '<div class="pl-section-head">' +
        "<div><h2>" +
        sec.row +
        " " +
        sec.menuBn +
        " · " +
        sec.menu +
        "</h2>" +
        '<span class="pl-section-meta">শুধু এই পেজ: ' +
        sec.page +
        " — অন্য ক্যাটাগরিতে যাবে না</span></div>" +
        '<a class="pl-preview-page" href="' +
        sec.page +
        '" target="_blank" rel="noopener">পেজ দেখুন →</a></div>' +
        '<div class="pl-section-body">' +
        "<label>ছবির লিংক (প্রতি লাইনে একটি URL)</label>" +
        '<textarea data-key="' +
        key +
        '" spellcheck="false" autocomplete="off"></textarea>' +
        '<p class="pl-count" data-count-for="' +
        key +
        '"></p>' +
        "</div>";

      mount.appendChild(block);
      var ta = block.querySelector("textarea");
      ta.value = state[key];
      ta.addEventListener("input", function () {
        state[key] = ta.value;
        updateCount(key);
      });
      updateCount(key);
    });
  }

  function collectAll() {
    var out = {};
    sections.forEach(function (sec) {
      var urls = linesToUrls(state[sec.key]);
      if (urls.length) out[sec.key] = urls;
    });
    return out;
  }

  function generateJsFile(data) {
    var lines = [
      "/**",
      " * ═══ সব ক্যাটাগরির প্রোডাক্ট ছবির লিংক — এক জায়গা ═══",
      " * এডিট: product-links.html → সেভ → এই ফাইল প্রজেক্টে রিপ্লেস",
      " * আপডেট: " + new Date().toISOString().slice(0, 10),
      " */",
      "window.PRODUCT_LINKS_DATA = {"
    ];

    sections.forEach(function (sec, idx) {
      var key = sec.key;
      var urls = data[key] || [];
      var keyStr = /^[a-z_$][\w$]*$/i.test(key) ? key : '"' + key + '"';
      lines.push("  " + keyStr + ": [");
      urls.forEach(function (url) {
        lines.push('    "' + String(url).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '",');
      });
      lines.push("  ]" + (idx < sections.length - 1 ? "," : ""));
    });

    lines.push("};");
    lines.push("");
    return lines.join("\n");
  }

  function downloadFile(content, filename) {
    var blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toast(msg) {
    var el = document.getElementById("plToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () {
      el.classList.remove("show");
    }, 3500);
  }

  function importFromCatalog() {
    if (!window.CATEGORY_PRODUCTS) {
      toast("প্রথমে ক্যাটালগ লোড হচ্ছে… এক সেকেন্ড পর আবার চাপুন");
      return;
    }
    sections.forEach(function (sec) {
      var list = window.CATEGORY_PRODUCTS[sec.key] || [];
      state[sec.key] = urlsToLines(
        list.map(function (p) {
          return p.image || "";
        })
      );
    });
    buildSections();
    toast("বর্তমান সাইট থেকে লিংক তুলে আনা হয়েছে");
  }

  document.getElementById("plSave").addEventListener("click", function () {
    var data = collectAll();
    var js = generateJsFile(data);
    downloadFile(js, "product-links-data.js");
    toast("product-links-data.js ডাউনলোড হয়েছে — প্রজেক্ট ফোল্ডারে রিপ্লেস করুন");
  });

  document.getElementById("plImport").addEventListener("click", importFromCatalog);

  document.getElementById("plPreview").addEventListener("click", function () {
    window.PRODUCT_LINKS_DATA = collectAll();
    if (typeof window.applyProductLinks === "function") {
      window.applyProductLinks();
    }
    toast("প্রিভিউ প্রস্তুত — Abaya/Two-piece পেজ খুলে Ctrl+F5 দিন");
  });

  buildSections();
})();
