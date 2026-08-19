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
    replace: [],
    /** ⚠️ SPEED FIX — এখন category-products.js-এর প্রায় সব প্রোডাক্টের
     *  image সরাসরি "https://raw.githubusercontent.com/..." — যা কোনো
     *  CDN না (স্লো, রিসাইজ নেই, GitHub প্রায়ই rate-limit করে)।
     *
     *  ধাপ ১: এই ছবিগুলোর real ফাইল আপনার নিজের সার্ভারে "images/"
     *          ফোল্ডারে আসল ফাইলনাম দিয়ে কপি করুন (URL-এর শেষ অংশটাই
     *          ফাইলনাম, যেমন "premium-black-3-part-abaya-set-...webp")
     *  ধাপ ২: সব ফাইল কপি হয়ে গেলে এটা true করে দিন — এরপর
     *          resolveImageUrl() (product-utils.js) স্বয়ংক্রিয়ভাবে
     *          raw.githubusercontent.com লিংককে "images/<file>" দিয়ে
     *          রিপ্লেস করবে, category-products.js-এর কোনো লাইন হাতে
     *          বদলাতে হবে না।
     *  false থাকা অবস্থায় সাইট এখনকার মতোই চলবে — কিছু ভাঙবে না। */
    useLocalImages: true
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
  /** এখানের byCategory.<key>.bodySize / bodySizeLabel / bodySizes /
   *  lengthSizes হলো ওই ক্যাটাগরির সব প্রোডাক্টের ডিফল্ট। কিন্তু যদি একই
   *  ক্যাটাগরির মধ্যে কোনো একটা নির্দিষ্ট প্রোডাক্টের বডি সাইজ আলাদা হয়
   *  (যেমন: বেশিরভাগ Abaya-তে বডি ৪২/৪৪/৪৬ পাওয়া যায়, কিন্তু একটা নির্দিষ্ট
   *  Abaya-তে শুধু ৪২ পাওয়া যায়) — তাহলে ক্যাটাগরির এই ডিফল্ট বদলানোর দরকার
   *  নেই। বরং category-products.js-এ ওই নির্দিষ্ট প্রোডাক্টের অবজেক্টে
   *  সরাসরি এই ফিল্ডগুলো দিন, সেটাই ক্যাটাগরি ডিফল্টের উপর প্রায়োরিটি পাবে:
   *
   *  {
   *    name: "Maroon Abaya Set",
   *    image: "maroon-abaya.jpeg",
   *    ... (বাকি স্বাভাবিক ফিল্ড) ...
   *    bodySizes: ["42"],           // শুধু এই প্রোডাক্টে ৪২ ছাড়া আর কোনো
   *                                  // বডি সাইজ সিলেক্ট করা যাবে না
   *    bodySizeLabel: "42 [Free size]"
   *  }
   *
   *  bodySizes না দিলে, বা খালি অ্যারে দিলে, ক্যাটাগরির ডিফল্টই ব্যবহার
   *  হবে — তাই যেসব প্রোডাক্টে আলাদা করার দরকার নেই, সেগুলোতে কিছু না
   *  লিখলেই চলবে। */
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
        /** আগে এখানে bodySizes: ["42","44","46"] ছিল, যেটা bodySizeLabel-এর
         *  "Free size" কথার সাথে সাংঘর্ষিক ছিল — ফলে সব premium-two-piece
         *  প্রোডাক্টেই ভুলভাবে ৩টা সিলেক্টেবল বডি-সাইজ বাটন দেখাত। এই
         *  ক্যাটাগরির ডিফল্ট এখন সত্যিকারের "Free size" (একটাই, non-
         *  selectable) আচরণ করবে। */
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
