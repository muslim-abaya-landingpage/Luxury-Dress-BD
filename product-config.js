/**
 * সাইটের সব লিংক এক জায়গা — এখানে বদলালে পুরো সাইটে লাগবে।
 * (ছবি CDN, WhatsApp, প্রোডাক্ট পেজ — ভবিষ্যতে)
 */
window.SITE_LINKS = {
  /** overlay = product-links-data.js এর লাইন অনুযায়ী ছবি বদলায় (এক পেজ থেকে সব ক্যাটাগরি) */
  catalog: {
    mode: "overlay"
  },
  images: {
    /** শুধু ফাইলনাম দিলে: "dress.jpeg" → images/dress.jpeg */
    localBase: "images/",
    /** GitHub raw — {file} = ফাইলনাম */
    githubTemplate:
      "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/{file}?raw=1",
    /** পুরনো লিংক একসাথে বদলাতে (উদাহরণ):
     *  { from: "https://old-cdn.com/", to: "https://new-cdn.com/" }
     */
    replace: []
  },
  productPage: {
    /** এখনো প্রোডাক্ট ডিটেইল পেজ নেই — false রাখুন */
    enabled: false,
    default: "/",
    /** ভবিষ্যতে: "/product/{id}" */
    pattern: "/product/{id}"
  },
  order: {
    whatsapp: "https://wa.me/8801970831783"
  },
  /** Size Chart — এখন আর বাইরের কোনো ছবির (GitHub) উপর নির্ভর করে না।
   *  আগে এখানে GitHub-এ হোস্ট করা ছবির লিংক ছিল, যেটা প্রায়ই লোড হতে
   *  ব্যর্থ হচ্ছিল (ফাইল না থাকলে, GitHub রেট-লিমিট করলে, ইত্যাদি)।
   *  তার বদলে এখন সরাসরি সংখ্যা/টেবিল ডেটা — কখনো ভাঙবে না, কোনো
   *  নেটওয়ার্ক নির্ভরতা নেই। এখানে বদলালেই Size Chart মডালে বদলাবে। */
  sizeChart: {
    default: {
      regularFit: [
        { size: "Small", length: 52, width: 42, sleeve: 21 },
        { size: "Medium", length: 54, width: 44, sleeve: 22 },
        { size: "Large", length: 56, width: 46, sleeve: 23 }
      ],
      customSize: [
        { length: 57, lengthExtra: 0, width: 47, widthExtra: 0 },
        { length: 58, lengthExtra: 0, width: 48, widthExtra: 0 },
        { length: 59, lengthExtra: 250, width: 49, widthExtra: 250 },
        { length: 60, lengthExtra: 250, width: 50, widthExtra: 250 },
        { length: 61, lengthExtra: 250, width: 51, widthExtra: 250 },
        { length: 62, lengthExtra: 450, width: 52, widthExtra: 250 },
        { length: 63, lengthExtra: 450, width: 53, widthExtra: 250 },
        { length: 64, lengthExtra: 450, width: 54, widthExtra: 250 },
        { length: 65, lengthExtra: 450, width: 55, widthExtra: 250 },
        { length: 66, lengthExtra: 450, width: 56, widthExtra: 250 },
        { length: 67, lengthExtra: 450, width: 57, widthExtra: 250 },
        { length: 68, lengthExtra: 450, width: 58, widthExtra: 250 }
      ]
    },
    byCategory: {
      abaya: {
        regularFit: [
          { size: "Small", length: 50, width: 42, sleeve: 21 },
          { size: "Medium", length: 52, width: 44, sleeve: 22 },
          { size: "Large", length: 54, width: 46, sleeve: 23 },
          { size: "Extra Large", length: 56, width: 48, sleeve: 24 }
        ],
        customSize: [
          { length: 57, lengthExtra: 0, width: 47, widthExtra: 0 },
          { length: 58, lengthExtra: 0, width: 48, widthExtra: 0 },
          { length: 59, lengthExtra: 250, width: 49, widthExtra: 250 },
          { length: 60, lengthExtra: 250, width: 50, widthExtra: 250 },
          { length: 61, lengthExtra: 250, width: 51, widthExtra: 250 },
          { length: 62, lengthExtra: 450, width: 52, widthExtra: 250 },
          { length: 63, lengthExtra: 450, width: 53, widthExtra: 250 },
          { length: 64, lengthExtra: 450, width: 54, widthExtra: 250 },
          { length: 65, lengthExtra: 450, width: 55, widthExtra: 250 },
          { length: 66, lengthExtra: 450, width: 56, widthExtra: 250 }
        ]
      }
    }
  },
  defaults: {
    price: 550,
    fabric: "Alex soft Georgette",
    sizes: ["Body 42 (Free size)"],
    byCategory: {
      abaya: {
        price: 999,
        fabric: "Dubai Cherry",
        bodySize: "46",
        bodySizeLabel: "46 [Free size]",
        bodySizes: ["42", "44", "46"],
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
        bodySizes: ["42", "44", "46"],
        lengthSizeLabel: "37-38 inch",
        lengthSizes: ["37-38 inch"],
        sizes: ["42 (Free size)"]
      },
      "cover-up": {
        types: ["Full Set", "Cover Up Only"]
      },
      kaftan: { price: 1650 }
    }
  },
  /** প্রোডাক্ট ডিটেইলে দামের নিচে ছোট নোট (Anzaar-style) */
  productShortNotes: {
    default:
      "* Colors may vary slightly in photos. Lighting can make the actual shade look a little different.",
    abaya:
      "* Hijab is not included (unless specified). Colors may vary slightly in photos.",
    "cover-up":
      "* Inner abaya/hijab is not included unless specified.",
    "premium-two-piece": ""
  },
 productNotes: {
  default:
    "<div class='pqv-desc-rich'>" +
    "<p><strong>Important Notice:</strong></p>" +
    "<ol>" +
    "<li>Actual product color may vary slightly due to lighting conditions and your screen settings.</li>" +
    "<li>Fabric texture and color may appear slightly different in person than in photographs.</li>" +
    "<li>Once an order is confirmed, modifications or cancellations may be subject to our order policy.</li>" +
    "</ol>" +
    "<p><strong>Delivery:</strong> Nationwide home delivery across Bangladesh. Cash on Delivery (COD) is available.</p>" +
    "<p><strong>Returns:</strong> If you receive a defective product, please contact us within 24 hours of delivery for assistance.</p>" +
    "</div>"
}
};
