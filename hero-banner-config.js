/**
 * ═══════════════════════════════════════════════════════════════════
 *  হোমপেজের উপরের বড় স্লাইডারের (Hero Banner) কনফিগ — শুধু এই ফাইল এডিট করুন
 * ═══════════════════════════════════════════════════════════════════
 *
 *  নিচের `slides` অ্যারেতে যা আছে সেটাই হিরো ব্যানারে দেখাবে — এখন থেকে
 *  ক্যাটালগ থেকে র‍্যান্ডম/অটো প্রোডাক্ট আর টেনে আনবে না।
 *
 *  প্রতিটা slide-এ যা যা দেওয়া যায়:
 *     image        (আবশ্যক)  — ছবির path/URL, হিরো ব্যানারের রেশিওতে
 *                    (ডেস্কটপে 16:7, মোবাইলে 4:5) আগে থেকে ক্রপ করা থাকা ভালো
 *     link         (ঐচ্ছিক) — বাটনে ক্লিক করলে কোথায় যাবে (না দিলে "/")
 *     alt          (ঐচ্ছিক) — ছবির alt text (accessibility/SEO)
 *     eyebrow, heading, subtitle, buttonText (সব ঐচ্ছিক)
 *        — না দিলে নিচের গ্লোবাল eyebrow/heading/subtitle/buttonText
 *          ব্যবহার হবে (একেকটা স্লাইডে চাইলে আলাদা টেক্সটও দেওয়া যায়)
 *
 *  slides খালি ([]) রাখলে আবার আগের অটো-পিক আচরণে ফিরে যাবে।
 * ═══════════════════════════════════════════════════════════════════
 */
window.SITE_HERO_CONFIG = {
  eyebrow: "Eid Collection 2026",
  heading: "Experience<br>the Elegance",
  subtitle: "Premium modest wear crafted with comfort & purity.",
  buttonText: "Shop Now",

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
      // TODO: এটা এখনো "3-part abaya set" ছবি — আসল two-piece hero ছবি
      // রেডি হলে বদলে দিন
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
  ]
};
