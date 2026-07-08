/**
 * Central configuration for all site-wide links and resources.
 * Update values here to apply changes across the entire website.
 * (Images, CDN, WhatsApp, Product Pages, Size Charts, etc.)
 */
window.SITE_LINKS = {
  /**
   * Catalog image handling mode.
   * overlay = Replaces product images according to the matching order
   * in product-links-data.js while preserving product information.
   */
  catalog: {
    mode: "overlay"
  },

  images: {
    /** Local image directory (filename → images/filename) */
    localBase: "images/",

    /** GitHub Raw image URL ({file} will be replaced with the filename) */
    githubTemplate:
      "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/{file}?raw=1",

    /**
     * Global URL replacement rules.
     * Useful when migrating images to a new CDN or storage provider.
     *
     * Example:
     * { from: "https://old-cdn.com/", to: "https://new-cdn.com/" }
     */
    replace: []
  },

  productPage: {
    /** Product detail pages are currently disabled. */
    enabled: false,

    /** Fallback destination */
    default: "/",

    /** Future URL pattern */
    pattern: "/product/{id}"
  },

  order: {
    whatsapp: "https://wa.me/8801971642683"
  },

  /**
   * Size chart images.
   * Supports both a default image and category-specific charts.
   */
  sizeChart: {
    default:
      "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/size-chart.jpg?raw=1",

    byCategory: {
      abaya:
        "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/abaya-size-chart.jpg?raw=1",

      "premium-two-piece":
        "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/two-piece-size-chart.jpg?raw=1"
    }
  },

  /**
   defaults: {
  price: 550,
  fabric: "Alex Soft Georgette",
  sizes: ["Body 42 (Free size)"],

  byCategory: {
    abaya: {
      price: 999,
      fabric: "Dubai Cherry",
      bodySize: "46",
      bodySizeLabel: "46 [Free size]",
      lengthSizes: ["50", "52", "54", "56"],
      sizes: ["50", "52", "54", "56"],
      types: ["Full Set", "Abaya Only"],
      priceByType: {
        "Full Set": 999,
        "Abaya Only": 799
      },
      typePriceGap: 200
    },

    "premium-two-piece": {
      price: 550,
      bodySizeLabel: "42 (Free size)",
      lengthSizeLabel: "37–38 inch",
      lengthSizes: ["37–38 inch"],
      sizes: ["42 (Free size)"]
    },

    punjabi: {
      price: 1800,
      fabric: "Premium Cotton Garments Fabric",
      embroidery: "Flat Thread Embroidery",
      button: "Premium China Snap Button",

      sizes: ["M", "L", "XL"],

      sizeChart: {
        M: {
          long: "40",
          body: "42"
        },
        L: {
          long: "42",
          body: "44"
        },
        XL: {
          long: "44",
          body: "46"
        }
      }
    }
  }
}

      "cover-up": {
        types: ["Full Set", "Cover Up Only"]
      },

      kaftan: {
        price: 1650
      }

      // panjabi: {
      //   price: 1800
      // }
    }
  },

  /**
   * Short product notes displayed beneath the product price.
   */
productShortNotes: {
  default:
    "* Actual colors may vary slightly due to lighting conditions and individual screen settings.",

  abaya:
    "* Hijab is not included unless otherwise specified. Actual colors may vary slightly from the images.",

  "cover-up":
    "* Inner abaya and hijab are not included unless explicitly stated.",

  "premium-two-piece":
    "* Actual colors may vary slightly due to lighting conditions and individual screen settings.",

  punjabi:
    "* Premium cotton garments fabric with fine embroidery. Actual colors may vary slightly due to lighting conditions and individual screen settings."
},
  productNotes: {
    default:
      "<div class='pqv-desc-rich'>" +
      "<p><strong>Important Information</strong></p>" +
      "<ol>" +
      "<li>We strive to present product colors and fabric textures as accurately as possible. However, slight variations may occur due to photography lighting and individual display settings.</li>" +
      "<li>Please review your selected size carefully before confirming your order.</li>" +
      "<li>Order modifications or cancellations may not be possible once the order has been confirmed.</li>" +
      "</ol>" +
      "<p><strong>Delivery:</strong> Nationwide home delivery across Bangladesh. Cash on Delivery (COD) is available.</p>" +
      "<p><strong>Returns & Exchanges:</strong> If you receive a defective or incorrect product, please contact us within 24 hours of delivery for assistance.</p>" +
      "</div>"
  }
};
