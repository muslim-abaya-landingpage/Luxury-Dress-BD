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
    whatsapp: "https://wa.me/8801971642683"
  },
  /** Size Chart ছবি — ক্যাটাগরি অনুযায়ী বা default */
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
  defaults: {
    price: 550,
    fabric: "এলেক্স সফট জর্জেট",
    sizes: ["বডি ৪২ (ফ্রি সাইজ)"],
    byCategory: {
      abaya: {
        price: 999,
        fabric: "দুবাই চেরি",
        sizes: ["50", "52", "54", "56"],
        types: ["Full Set", "Abaya Only"],
        priceByType: {
          "Full Set": 999,
          "Abaya Only": 799
        },
        typePriceGap: 200
      },
      "premium-two-piece": {
        types: ["Full Set", "Top Only", "Bottom Only"]
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
      "* ছবিতে রং সামান্য পার্থক্য হতে পারে। লাইটিংয়ের কারণে প্রকৃত রং একটু আলাদা দেখাতে পারে।",
    abaya:
      "* হিজাব অন্তর্ভুক্ত নয় (যদি না উল্লেখ করা থাকে)। ছবিতে রং সামান্য পার্থক্য হতে পারে।",
    "cover-up":
      "* ইনার আবায়া/হিজাব অন্তর্ভুক্ত নয় যদি না উল্লেখ করা থাকে।",
    "premium-two-piece":
      "* সেটে উল্লেখ না থাকলে হিজাব অন্তর্ভুক্ত নয়।"
  },
  productNotes: {
    default:
      "<div class='pqv-desc-rich'><p><strong>দ্রষ্টব্য:</strong></p><ol>" +
      "<li>প্রকৃত রং ও কাপড়ের গুণমান নিশ্চিত করতে সরাসরি দেখে নেওয়ার চেষ্টা করুন।</li>" +
      "<li>লাইটিং ও স্ক্রিনের কারণে রং সামান্য পার্থক্য হতে পারে।</li>" +
      "<li>অর্ডার কনফার্ম হলে পরিবর্তন/বাতিল সীমিত — বিস্তারিত নীতিমালা নিচে।</li>" +
      "</ol><p><strong>ডেলিভারি:</strong> বাংলাদেশ জুড়ে হোম ডেলিভারি। ক্যাশ অন ডেলিভারি উপলব্ধ।</p>" +
      "<p><strong>রিটার্ন:</strong> ত্রুটিপূর্ণ পণ্য ২৪ ঘণ্টার মধ্যে জানালে সমাধান করা হবে।</p></div>"
  }
};
