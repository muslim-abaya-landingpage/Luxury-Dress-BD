/**
 * ═══════════════════════════════════════════════════════════════════
 *  হোমপেজের উপরের বড় স্লাইডারের (Hero Banner) কনফিগ — শুধু এই ফাইল এডিট করুন
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ✅ নতুন পদ্ধতি (সহজ মেইনটেন্যান্স, নিচের `slides` অ্যারে):
 *     - এখানে নিজের হাতে বাছাই করা, হিরো ব্যানারের রেশিওতে (ডেস্কটপে
 *       16:7, মোবাইলে 4:5) আগে থেকে ঠিকমতো ক্রপ করা ছবি বসান।
 *
 *       সুপারিশকৃত সাইজ:
 *         ডেস্কটপ  → 1920 × 840px  (ন্যূনতম 1600 × 700px), রেশিও 16:7
 *         মোবাইল  → 1080 × 1350px, রেশিও 4:5 (আলাদা মোবাইল ছবি না
 *                    দিলে ডেস্কটপ ছবিটাই ক্রপ হয়ে দেখাবে)
 *         ফরম্যাট  → JPG বা WebP, ফাইল সাইজ ~200–400 KB রাখার চেষ্টা করুন
 *         সাবজেক্ট → মূল মডেল/প্রোডাক্ট মাঝ বরাবর বা ডান দিকে রাখুন —
 *                    ক্যাপশন টেক্সট বাম-নিচে ওভারলে হয়ে বসে, তাই বাম
 *                    পাশে সাবজেক্ট রাখলে টেক্সটের নিচে চাপা পড়ে যাবে
 *     - এই ছবিগুলো আর category-products.js থেকে প্রোডাক্ট ছবি অটো-টেনে
 *       আনবে না — শুধু "মুখ/ক্লোজ-আপ" দেখানোর বদলে পুরো প্রোডাক্ট/মডেল
 *       ঠিকমতো ফ্রেমে দেখাবে।
 *     - `slides` খালি ([]) রাখলে সিস্টেম আগের মতোই ক্যাটাগরি প্রোডাক্ট
 *       থেকে ছবি অটোমেটিক টেনে আনবে (পুরনো আচরণ, backup হিসেবে থাকল)।
 *
 *  প্রতিটা slide-এ যা যা দেওয়া যায়:
 *     image        (আবশ্যক)  — ডেস্কটপ ছবির path/URL (রেশিও 16:7)
 *     imageMobile  (ঐচ্ছিক, নতুন) — মোবাইলের জন্য আলাদা, লম্বালম্বি ক্রপ করা
 *                    ছবি (রেশিও 3:4)। দিলে ৬৪০px-এর নিচের স্ক্রিনে এটাই
 *                    দেখাবে, যাতে মডেল/প্রোডাক্ট মোবাইলে কাটা না যায়। না
 *                    দিলে `image`-ই মোবাইলে ক্রপ হয়ে দেখাবে (আগের আচরণ)।
 *     link         (ঐচ্ছিক) — বাটনে ক্লিক করলে কোথায় যাবে (না দিলে "/")
 *     alt          (ঐচ্ছিক) — ছবির alt text (accessibility/SEO)
 *     eyebrow, heading, subtitle, buttonText (সব ঐচ্ছিক)
 *        — না দিলে নিচের গ্লোবাল eyebrow/heading/subtitle/buttonText
 *          ব্যবহার হবে (একেকটা স্লাইডে চাইলে আলাদা টেক্সটও দেওয়া যায়)
 *
 *  উদাহরণ — হিজাব মডেলের ছবি হিরোতে ঠিকমতো দেখাতে:
 *     {
 *       image: "images/hero/hijab-model-1.jpg",
 *       link: "/hijab",
 *       alt: "Premium Khimar Hijab"
 *     }
 * ═══════════════════════════════════════════════════════════════════
 */
window.SITE_HERO_CONFIG = {
  // গ্লোবাল ডিফল্ট টেক্সট — কোনো slide-এ আলাদা টেক্সট না দিলে এগুলোই দেখাবে
  eyebrow: "Eid Collection 2026",
  heading: "Experience<br>the Elegance",
  subtitle: "Premium modest wear crafted with comfort & purity.",
  buttonText: "Shop Now",

  /**
   * এখানে ছবি যোগ করুন। খালি রাখলে প্রোডাক্ট থেকে অটো-ছবি চলবে (আগের মতো)।
   *
   * নিচে প্রতিটা ক্যাটাগরির জন্য একটা করে placeholder entry বসানো আছে
   * (যেসব ক্যাটাগরিতে এখন প্রোডাক্ট আছে)। শুধু `image` পাথটা বদলে
   * আসল ছবির path/URL বসিয়ে দিন — বাকি সব already ঠিক করা আছে।
   * Cover Up / Karchupi / Kaftan-এ এখনো প্রোডাক্ট নেই, তাই সেগুলোর
   * entry বাদ রাখা হয়েছে — প্রোডাক্ট এলে নিচের প্যাটার্ন অনুসরণ করে
   * নতুন entry যোগ করে নেবেন।
   */
  slides: [
    {
      image: "images/hero-banner/premium-black-floral-embroidery-abaya-bangladesh-model-original-dubai-cherry-fabric.webp",
      link: "/abaya",
      alt: "Premium Abaya Collection"
    },
    {
      image: "images/hero-banner/muslim-abaya-homepage-hero-banner.webp",
      link: "/abaya",
      alt: "Muslim Abaya Collection"
    },
    {
      // TODO: এখনো 3-part abaya set-এর ছবি ব্যবহার হচ্ছে (আসল "two-piece"
      // ছবি না থাকায়) — real two-piece hero ছবি এলে বদলে দিন
      image: "images/hero-banner/premium-black-3-part-abaya-set-hero-banner-1920x840.webp",
      link: "/premium-two-piece",
      alt: "Premium Two-Piece Set"
    },
    {
      image: "images/hero-banner/muslim-abaya-premium-black-floral-embroidery-niqab-abaya-hero-banner-1920x840.webp",
      link: "/embroidery",
      alt: "Embroidery Collection"
    },
    {
      image: "images/hero-banner/premium-short-khimar-hijab-hero-banner-1920x840.webp",
      link: "/hijab",
      alt: "Premium Khimar Hijab"
    },
    {
      image: "images/hero-banner/premium-white-cotton-panjabi-hero-banner-1920x840.webp",
      link: "/panjabi",
      alt: "Panjabi Collection"
    }
    // TODO: "tops-kurti"-র জন্য এখনো কোনো hero ছবি পাওয়া যায়নি —
    // ছবি রেডি হলে উপরের প্যাটার্ন অনুসরণ করে নতুন entry যোগ করুন:
    // {
    //   image: "images/hero-banner/<tops-kurti-filename>.webp",
    //   link: "/tops-kurti",
    //   alt: "Tops & Kurti"
    // }
  ]
};
