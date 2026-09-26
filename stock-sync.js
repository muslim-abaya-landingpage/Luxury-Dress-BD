/**
 * Muslim Abaya — Live Stock Sync
 * category-products.js লোড হওয়ার পর কিন্তু product-catalog-loader.js (normalize) চলার আগে
 * এই স্ক্রিপ্টটা রান করতে হবে — Google Sheet-এর Stock শীট থেকে সরাসরি বর্তমান স্টক সংখ্যা
 * প্রতিটা প্রোডাক্টের raw .stock ফিল্ডে বসিয়ে দেয়। এরপর normalizeProductEntry() এবং
 * product-utils.js/category-renderer.js এর আগে থেকেই থাকা "In Stock / Sold Out" ব্যাজ,
 * বাটন ডিজেবল ইত্যাদি লজিক স্বয়ংক্রিয়ভাবে কাজ করা শুরু করে — ওইসব ফাইলে কোনো পরিবর্তন লাগে না।
 *
 * সিঙ্ক্রোনাস XHR ইচ্ছাকৃতভাবে ব্যবহার করা হয়েছে যাতে normalize/render শুরুর আগেই ডেটা রেডি থাকে
 * (এই সাইটের অন্য সব ডেটা ফাইলও sync <script> ট্যাগ দিয়ে লোড হয়, তাই এটা একই প্যাটার্ন)।
 * Stock না পাওয়া গেলে বা এরর হলে চুপচাপ থেমে যায় — কোনো প্রোডাক্ট ডিফল্টভাবে "In Stock" থেকে যায়।
 */
(function () {
  try {
    var apiUrl = (window.MA_SITE_API && window.MA_SITE_API.url) || (typeof window.getSiteApiUrl === "function" ? window.getSiteApiUrl() : "");
    if (!apiUrl || !window.CATEGORY_PRODUCTS) return;

    var xhr = new XMLHttpRequest();
    xhr.open("GET", apiUrl + "?RecordType=StockStatus", false);
    xhr.timeout = 4000;
    xhr.send(null);
    if (xhr.status !== 200) return;

    var res = JSON.parse(xhr.responseText || "{}");
    if (!res || !res.ok || !res.items) return;

    var map = res.items;
    var cats = window.CATEGORY_PRODUCTS;
    Object.keys(cats).forEach(function (key) {
      var list = cats[key];
      if (!Array.isArray(list)) return;
      list.forEach(function (p) {
        if (!p || !p.id) return;
        var entry = map[p.id];
        if (entry) {
          p.stock = entry.qty;
          p.inStock = entry.inStock;
        }
      });
    });
  } catch (err) {
    // স্টক সিঙ্ক ব্যর্থ হলে কাস্টমারদের জন্য পেজ ব্লক হবে না, সব প্রোডাক্ট সাধারণভাবে In Stock থেকে যায়।
  }
})();
