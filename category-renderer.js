function ensureCategoryStyles() {
  if (document.getElementById("category-sidebar-css")) return;
  if (document.querySelector('link[href*="category-sidebar.css"]')) return;
  var link = document.createElement("link");
  link.id = "category-sidebar-css";
  link.rel = "stylesheet";
  link.href = "category-sidebar.css?v=20260529a";
  document.head.appendChild(link);
}

function markCategoryReady() {
  document.documentElement.classList.add("category-ready");
}



function getCategoryNavList() {
  if (window.CATEGORY_NAV && window.CATEGORY_NAV.length) {
    return window.CATEGORY_NAV;
  }
  return [];
}



function escapeHtml(str) {

  return String(str || "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;");

}



/** Unique color keys from products → one checkbox each (auto when `color` is set in category-products.js). */
function formatColorKeyLabel(key) {
  return String(key)
    .replace(/-/g, " ")
    .replace(/\b\w/g, function (ch) {
      return ch.toUpperCase();
    });
}

function getProductColorFilterKey(p) {
  if (p.colorLabel) return String(p.colorLabel).trim();
  if (p.color) return String(p.color).trim();
  return "";
}

function getProductColorFilterLabel(p, colorMap) {
  if (p.colorLabel) return String(p.colorLabel).trim();
  if (p.color && colorMap[p.color] && colorMap[p.color].label) return colorMap[p.color].label;
  if (p.color) return formatColorKeyLabel(p.color);
  return "";
}

function getProductColorOptions(products) {
  var colorMap = window.FILTER_COLOR_MAP || {};
  var seen = {};
  var options = [];

  products.forEach(function (p) {
    var key = getProductColorFilterKey(p);
    if (!key || seen[key]) return;
    seen[key] = true;
    options.push({
      key: key,
      label: getProductColorFilterLabel(p, colorMap)
    });
  });

  options.sort(function (a, b) {
    return a.label.localeCompare(b.label);
  });

  return options;
}



function getPriceBounds(products) {

  var min = 0;

  var max = 5000;

  if (products.length) {

    var prices = products.map(function (p) { return parseInt(p.price, 10) || 550; });

    min = Math.min.apply(null, prices);

    max = Math.max.apply(null, prices);

    if (min === max) max = min + 500;

  }

  return { min: min, max: max };

}



function buildShopSidebar(categoryKey, products) {
  var catLinks = getCategoryNavList()
    .map(function (c) {
      var active = c.key === categoryKey ? " active" : "";
      return (
        "<a href='" +
        escapeHtml(c.href || "#") +
        "' class='sidebar-cat-link" +
        active +
        "'>" +
        escapeHtml(c.label || c.key) +
        "</a>"
      );
    })
    .join("");

  var bounds = getPriceBounds(products);

  var colorOptions = getProductColorOptions(products);

  var colorChecks = colorOptions.length
    ? colorOptions
        .map(function (opt) {
          return (
            "<label class='color-filter-option'>" +
            "<input type='checkbox' class='color-filter-check' value='" +
            escapeHtml(opt.key) +
            "'>" +
            "<span class='color-filter-name'>" +
            escapeHtml(opt.label) +
            "</span>" +
            "</label>"
          );
        })
        .join("")
    : "<p class='color-filter-empty'>No colors listed for this category.</p>";



  return (

    "<aside class='shop-sidebar'>" +

    "<div class='shop-filter-head'>" +
    "<strong>Filter</strong>" +
    "<button type='button' class='shop-filter-close' id='shopFilterClose' aria-label='Close filters'>&times;</button>" +
    "</div>" +

    "<a class='sidebar-home' href='/'>&lsaquo; Home</a>" +

    "<div class='sidebar-filter sidebar-filter-cats'>" +

    "<h4>Categories</h4>" +

    "<nav class='shop-cats' id='shopCategoryNav'>" +

    catLinks +

    "</nav>" +

    "</div>" +

    "<div class='sidebar-filter sidebar-filter-colors'>" +

    "<h4>Color</h4>" +

    "<div class='color-filter-list' id='colorFilters'>" +

    colorChecks +

    "</div>" +

    "</div>" +

    "<div class='sidebar-filter'>" +

    "<h4>Price Range</h4>" +

    "<div class='price-slider-wrap'>" +

    "<div class='price-track'><div class='price-track-fill' id='priceTrackFill'></div></div>" +

    "<input type='range' id='priceMin' min='" +

    bounds.min +

    "' max='" +

    bounds.max +

    "' value='" +

    bounds.min +

    "' aria-label='Minimum price'>" +

    "<input type='range' id='priceMax' min='" +

    bounds.min +

    "' max='" +

    bounds.max +

    "' value='" +

    bounds.max +

    "' aria-label='Maximum price'>" +

    "</div>" +

    "<div class='price-labels'>" +

    "<span>Min &#2547; <span id='priceMinLabel'>" +

    bounds.min +

    "</span></span>" +

    "<span>Max &#2547; <span id='priceMaxLabel'>" +

    bounds.max +

    "</span></span>" +

    "</div>" +

    "</div>" +

    "</aside>"

  );

}



function buildProductCard(p, idx, waLink, detailMode) {

  var productPrice = parseInt(p.price, 10) || 550;

  var priceText = "\u09F3" + productPrice;
  var fabricText = escapeHtml(p.fabric || (detailMode ? "দুবাই চেরি" : "Premium Georgette"));
  var sizes = Array.isArray(p.sizes) && p.sizes.length
    ? p.sizes
    : detailMode
      ? ["50", "52", "54", "56"]
      : ["Free Size"];
  var sizeOptions = sizes
    .map(function (s, i) {
      return "<option value='" + escapeHtml(s) + "'" + (i === 0 ? " selected" : "") + ">" + escapeHtml(s) + "</option>";
    })
    .join("");

  var colorAttr = p.color ? " data-color='" + escapeHtml(p.color) + "'" : "";

  if (detailMode) {
    return (
      '<article class="premium-card premium-card-detail" data-product-idx="' +
      idx +
      '" data-price="' +
      productPrice +
      '"' +
      colorAttr +
      ">" +
      '<div class="detail-media">' +
      '<span class="product-sale-badge">Sale!</span>' +
      '<img src="' +
      escapeHtml(p.image) +
      '" alt="' +
      escapeHtml(p.name) +
      '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'images/Baby-Pink-Floral-Print.jpeg\'">' +
      "</div>" +
      '<div class="detail-content">' +
      "<h3>" +
      escapeHtml(p.name) +
      "</h3>" +
      '<p class="detail-price">' +
      priceText +
      "</p>" +
      "<p class='detail-note'>ফেব্রিক্স: " +
      fabricText +
      (p.detailNote ? " | " + escapeHtml(p.detailNote) : " | শুধু বোরকা") +
      "</p>" +
      "<label class='card-size-label detail-size-label'>সাইজ: <select class='card-size-select' data-size-idx='" +
      idx +
      "'>" +
      sizeOptions +
      "</select></label>" +
      '<div class="detail-actions">' +
      '<button type="button" class="msg-btn btn-add-cart" data-product-idx="' +
      idx +
      '" data-action="add">কার্টে যোগ</button>' +
      '<button type="button" class="msg-btn btn-buy-now" data-product-idx="' +
      idx +
      '" data-action="buy-now">অর্ডার করুন</button>' +
      "<a href='" +
      waLink +
      "?text=" +
      encodeURIComponent(p.name + " অর্ডার করতে চাই") +
      "' target='_blank' rel='noopener' class='msg-btn btn-msg'>মেসেজ করুন</a>" +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  return (

    '<article class="card premium-card" data-product-idx="' +

    idx +

    '" data-price="' +

    productPrice +

    '"' +

    colorAttr +

    ">" +

    '<div class="img-wrap">' +
    '<span class="product-sale-badge">Sale!</span>' +
    '<img src="' +

    escapeHtml(p.image) +

    '" alt="' +

    escapeHtml(p.name) +

    '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'images/Baby-Pink-Floral-Print.jpeg\'">' +

    "</div>" +

    '<div class="card-foot">' +

    '<div class="card-meta">' +

    "<h3>" +

    escapeHtml(p.name) +

    "</h3>" +

    '<span class="card-price">' +

    priceText +

    "</span>" +

    "</div>" +

    '<div class="card-extra card-extra-desktop">' +
    "<p class='card-fabric'>ফেব্রিক্স: " + fabricText + "</p>" +
    (p.detailNote ? "<p class='card-length'>" + escapeHtml(p.detailNote) + "</p>" : "") +
    "<label class='card-size-label'>সাইজ: <select class='card-size-select' data-size-idx='" + idx + "'>" + sizeOptions + "</select></label>" +
    "</div>" +
    "<select class='card-size-select card-size-mobile' data-size-idx='" + idx + "' aria-hidden='true' tabindex='-1'>" + sizeOptions + "</select>" +

    '<div class="card-actions-anzaar">' +
    '<div class="card-actions-row">' +
    '<button type="button" class="anzaar-btn anzaar-btn-cart" data-product-idx="' + idx + '" data-action="add">Add to Cart</button>' +
    '<button type="button" class="anzaar-btn anzaar-btn-buy" data-product-idx="' + idx + '" data-action="buy-now">Buy Now</button>' +
    "</div>" +
    "<a href='" + waLink + "?text=" + encodeURIComponent(p.name + " অর্ডার করতে চাই") +
    "' target='_blank' rel='noopener' class='anzaar-btn anzaar-btn-msg'>Send Message</a>" +
    "</div>" +

    "</div>" +

    "</article>"

  );

}



function renderAllCategories() {

  var root = document.getElementById("list");

  if (!root) return;

  root.className = "cat-hub-page";

  var nav = window.CATEGORY_NAV || [];

  var tiles = nav.map(function (c) {

    var img = c.image || "images/Baby-Pink-Floral-Print.jpeg";

    return (

      "<a class='cat-hub-item' href='" +

      c.href +

      "'>" +

      "<div class='cat-hub-circle'><img src='" +

      img +

      "' alt='" +

      escapeHtml(c.label) +

      "' loading='lazy' decoding='async' onerror=\"this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg'\"></div>" +

      "<span class='cat-hub-label'>" +

      escapeHtml(c.label) +

      "</span></a>"

    );

  }).join("");

  root.innerHTML =

    "<nav class='cat-hub-breadcrumb' aria-label='Breadcrumb'>" +

    "<a href='index.html'>Home</a><span>&rsaquo;</span><strong>All Categories</strong></nav>" +

    "<h1 class='cat-hub-title'>All Categories</h1>" +

    "<div class='cat-hub-grid'>" +

    tiles +

    "</div>";

  markCategoryReady();
}



function renderCategory(categoryKey) {

  ensureCategoryStyles();



  var root = document.getElementById("list");

  if (!root) {
    markCategoryReady();
    return;
  }

  root.className = "";



  var allProducts = window.CATEGORY_PRODUCTS || {};

  var products = (allProducts[categoryKey] || []).slice();

  var searchQ = "";
  try {
    searchQ = (new URLSearchParams(window.location.search).get("q") || "").trim().toLowerCase();
  } catch (searchErr) {
    searchQ = "";
  }
  if (searchQ) {
    products = products.filter(function (p) {
      return (p.name || "").toLowerCase().indexOf(searchQ) !== -1;
    });
  }

  var categoryMeta = window.CATEGORY_META || {};

  var title = (categoryMeta[categoryKey] && categoryMeta[categoryKey].title) || categoryKey.toUpperCase();

  var waLink = (window.SITE_MEDIA && window.SITE_MEDIA.whatsappOrderLink) || "https://wa.me/8801971642683";



  var breadcrumb =

    "<nav class='shop-breadcrumb' aria-label='Breadcrumb'>" +

    "<a href='index.html'>Home</a><span>&rsaquo;</span><a href='category.html'>Category</a><span>&rsaquo;</span><strong>" +

    escapeHtml(title) +

    "</strong></nav>";



  var sidebar = buildShopSidebar(categoryKey, products);

  var detailMode = false;
  var cards = products.map(function (p, idx) {

    return buildProductCard(p, idx, waLink, detailMode);

  }).join("");



  root.innerHTML =

    breadcrumb +

    "<div class='shop-mobile-toolbar'>" +
    "<button type='button' class='shop-filter-open' id='shopFilterOpen' aria-expanded='false' aria-controls='shopFilterPanel'>" +
    "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'><path d='M4 6h16M7 12h10M10 18h4'/></svg>" +
    "Filter</button>" +
    "<label class='shop-sort-wrap'>Sort By" +
    "<select id='shopSort' class='shop-sort-select' aria-label='Sort products'>" +
    "<option value='default'>Default</option>" +
    "<option value='price-asc'>Price: Low to High</option>" +
    "<option value='price-desc'>Price: High to Low</option>" +
    "<option value='name-asc'>Name: A-Z</option>" +
    "</select></label></div>" +

    "<div class='shop-filter-backdrop' id='shopFilterBackdrop' hidden></div>" +

    "<div class='shop-layout'>" +

    sidebar.replace("class='shop-sidebar'", "class='shop-sidebar' id='shopFilterPanel'") +

    "<section class='shop-main'>" +

    "<div class='shop-top'><h2 class='shop-title'>" +

    escapeHtml(title) +

    "</h2><span class='shop-count' id='shopCount'>" +

    products.length +

    " items</span></div>" +

    "<div class='product-grid" + (detailMode ? " product-grid-detail" : "") + "' id='productGrid'>" +

    (cards || "<p class='filter-empty'>এই ক্যাটাগরিতে এখনো কোনো প্রোডাক্ট যোগ করা হয়নি।</p>") +

    "</div></section></div>" +

    "<div id='cartMiniMsg' class='cart-mini-msg'>কার্টে যুক্ত হয়েছে</div>";



  if (!products.length) {
    markCategoryReady();
    return;
  }



  var selectedQty = {};

  products.forEach(function (_, i) {

    selectedQty[i] = 1;

  });



  var filterState = { colors: [], priceMin: null, priceMax: null };



  function addProductToCart(item, qtyToAdd, sizeValue) {

    var cat = typeof findCatalogByName === "function" ? findCatalogByName(item.name) : null;
    var pickedSize = sizeValue || "50";
    var cartName = item.name + " (Size " + pickedSize + ")";

    var line = {

      id: item.id || (cat ? cat.id : ""),

      name: cartName,

      price: parseInt(item.price, 10) || 550,

      quantity: parseInt(qtyToAdd, 10) || 1,

      image: item.image || (cat && cat.image) || ""

    };

    var updated = [];
    if (typeof addOrMergeStoreCartItem === "function") {
      updated = addOrMergeStoreCartItem(typeof loadStoreCart === "function" ? loadStoreCart() : [], line);
    }
    if (typeof afterCartMutation === "function") afterCartMutation(updated);

    if (typeof pushTrackingEvent === "function") {
      pushTrackingEvent("AddToCart", {
        content_ids: [line.id || item.name],
        content_name: item.name,
        value: line.price,
        currency: "BDT",
        quantity: line.quantity
      });
    }

    var msg = document.getElementById("cartMiniMsg");

    if (msg) {

      msg.classList.add("show");

      setTimeout(function () {

        msg.classList.remove("show");

      }, 1400);

    }

  }



  function applyFilters() {

    var grid = document.getElementById("productGrid");

    var countEl = document.getElementById("shopCount");

    if (!grid) return;

    var cardsEls = grid.querySelectorAll(".premium-card");

    var visible = 0;

    cardsEls.forEach(function (card) {

      var idx = parseInt(card.getAttribute("data-product-idx"), 10);

      var p = products[idx];

      if (!p) return;

      var price = parseInt(p.price, 10) || 550;

      var show = true;

      if (filterState.colors.length) {
        var productColorKey = getProductColorFilterKey(p);
        if (!productColorKey || filterState.colors.indexOf(productColorKey) === -1) {
          show = false;
        }
      }

      if (filterState.priceMin !== null && price < filterState.priceMin) show = false;

      if (filterState.priceMax !== null && price > filterState.priceMax) show = false;

      card.classList.toggle("is-hidden", !show);

      if (show) visible++;

    });

    if (countEl) countEl.textContent = visible + " items";

    var empty = grid.querySelector(".filter-empty-dynamic");

    if (empty) empty.remove();

    if (visible === 0) {

      var el = document.createElement("p");

      el.className = "filter-empty filter-empty-dynamic";

      el.textContent = "এই ফিল্টারে কোনো প্রোডাক্ট পাওয়া যায়নি।";

      grid.appendChild(el);

    }

  }



  function updatePriceTrack() {

    var minInput = document.getElementById("priceMin");

    var maxInput = document.getElementById("priceMax");

    var fill = document.getElementById("priceTrackFill");

    if (!minInput || !maxInput || !fill) return;

    var min = parseInt(minInput.min, 10);

    var max = parseInt(minInput.max, 10);

    var lo = parseInt(minInput.value, 10);

    var hi = parseInt(maxInput.value, 10);

    if (lo > hi) {

      var t = lo;

      lo = hi;

      hi = t;

      minInput.value = lo;

      maxInput.value = hi;

    }

    filterState.priceMin = lo;

    filterState.priceMax = hi;

    var minLbl = document.getElementById("priceMinLabel");

    var maxLbl = document.getElementById("priceMaxLabel");

    if (minLbl) minLbl.textContent = String(lo);

    if (maxLbl) maxLbl.textContent = String(hi);

    var range = max - min || 1;

    var left = ((lo - min) / range) * 100;

    var width = ((hi - lo) / range) * 100;

    fill.style.left = left + "%";

    fill.style.width = width + "%";

    applyFilters();

  }



  var priceMin = document.getElementById("priceMin");

  var priceMax = document.getElementById("priceMax");

  if (priceMin) priceMin.addEventListener("input", updatePriceTrack);

  if (priceMax) priceMax.addEventListener("input", updatePriceTrack);

  updatePriceTrack();



  var colorFilterWrap = document.getElementById("colorFilters");

  if (colorFilterWrap) {
    colorFilterWrap.addEventListener("change", function (ev) {
      if (!ev.target.classList.contains("color-filter-check")) return;
      filterState.colors = [];
      colorFilterWrap.querySelectorAll(".color-filter-check:checked").forEach(function (cb) {
        filterState.colors.push(cb.value);
      });
      applyFilters();
    });
  }



  root.addEventListener("click", function (ev) {

    var actionEl = ev.target.closest("[data-action]");

    if (!actionEl) return;

    var idx = parseInt(actionEl.getAttribute("data-product-idx"), 10);

    if (isNaN(idx) || !products[idx]) return;
    var sizeEl =
      root.querySelector(".card-extra-desktop [data-size-idx='" + idx + "']") ||
      root.querySelector(".card-size-mobile[data-size-idx='" + idx + "']") ||
      root.querySelector("[data-size-idx='" + idx + "']");
    var selectedSize = sizeEl ? sizeEl.value : "50";

    if (actionEl.getAttribute("data-action") === "add") {
      ev.preventDefault();
      addProductToCart(products[idx], 1, selectedSize);
      return;
    }
    if (actionEl.getAttribute("data-action") === "buy-now") {
      ev.preventDefault();
      addProductToCart(products[idx], 1, selectedSize);
      window.location.href = "checkout.html";
    }
  });

  if (typeof afterCartMutation === "function") {
    afterCartMutation(typeof loadStoreCart === "function" ? loadStoreCart() : []);
  }

  var filterOpen = document.getElementById("shopFilterOpen");
  var filterPanel = document.getElementById("shopFilterPanel");
  var filterBackdrop = document.getElementById("shopFilterBackdrop");

  function setFilterDrawer(open) {
    if (!filterPanel) return;
    document.body.classList.toggle("shop-filter-open", open);
    filterPanel.classList.toggle("is-open", open);
    if (filterBackdrop) {
      filterBackdrop.hidden = !open;
      filterBackdrop.classList.toggle("is-visible", open);
    }
    if (filterOpen) filterOpen.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (filterOpen) {
    filterOpen.addEventListener("click", function () {
      setFilterDrawer(!document.body.classList.contains("shop-filter-open"));
    });
  }
  var filterClose = document.getElementById("shopFilterClose");
  if (filterClose) {
    filterClose.addEventListener("click", function () {
      setFilterDrawer(false);
    });
  }
  if (filterBackdrop) {
    filterBackdrop.addEventListener("click", function () {
      setFilterDrawer(false);
    });
  }
  if (filterPanel) {
    filterPanel.addEventListener("click", function (ev) {
      if (ev.target.closest(".color-filter-option, .sidebar-cat-link")) {
        if (window.matchMedia("(max-width: 960px)").matches) {
          setFilterDrawer(false);
        }
      }
    });
  }

  var sortSelect = document.getElementById("shopSort");
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      var grid = document.getElementById("productGrid");
      if (!grid) return;
      var cards = Array.prototype.slice.call(grid.querySelectorAll(".premium-card:not(.premium-card-detail)"));
      var mode = sortSelect.value;
      cards.sort(function (a, b) {
        var ia = parseInt(a.getAttribute("data-product-idx"), 10);
        var ib = parseInt(b.getAttribute("data-product-idx"), 10);
        var pa = products[ia];
        var pb = products[ib];
        if (!pa || !pb) return 0;
        if (mode === "price-asc") {
          return (parseInt(pa.price, 10) || 0) - (parseInt(pb.price, 10) || 0);
        }
        if (mode === "price-desc") {
          return (parseInt(pb.price, 10) || 0) - (parseInt(pa.price, 10) || 0);
        }
        if (mode === "name-asc") {
          return String(pa.name || "").localeCompare(String(pb.name || ""));
        }
        return ia - ib;
      });
      cards.forEach(function (card) {
        grid.appendChild(card);
      });
    });
  }

  markCategoryReady();
}


