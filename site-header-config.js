/**
 * হেডারের সব hardcoded টেক্সট/লিংক এক জায়গায় — এখানে বদলালে পুরো সাইটের হেডারে লাগবে।
 * site-header.js এই ফাইলের window.SITE_HEADER_CONFIG থেকে ডেটা পড়ে।
 * (নিরাপত্তার জন্য site-header.js এ ফলব্যাক ভ্যালুও আছে — এই ফাইল মিসিং থাকলেও সাইট ভাঙবে না)
 */
window.SITE_HEADER_CONFIG = {
  /** টপ বার — Facebook লিংক (SITE_SEO.social.facebook না থাকলে এটা ব্যবহার হবে) + বাকি লিংকগুলো */
  topBar: {
    facebookUrl: "https://www.facebook.com/muslimabayaofficial",
    links: [
      { label: "Help", href: "/help" },
      { label: "Sign Up", href: "/signup" },
      { label: "Sign In", href: "/signin" }
    ]
  },

  brand: {
    name: "Muslim Abaya",
    logoSrc: "assets/logo-muslim-abaya.svg?v=20260603",
    logoAlt: "Muslim Abaya",
    /** লোগো ছবি লোড না হলে এই টেক্সট দেখাবে */
    fallbackText: "MUSLIM ABAYA"
  },

  /** হেডারের চ্যাট আইকন */
  whatsapp: "https://wa.me/8801970831783",

  search: {
    placeholder: "Search"
  },

  /** উপরের ঘুরতে থাকা অ্যানাউন্সমেন্ট বার — যত খুশি স্লাইড যোগ/বাদ দিতে পারবেন */
  announcements: [
    "💎 PREMIUM MODEST WEAR | TIMELESS ELEGANCE & EVERYDAY COMFORT",
    "💎 Premium Modest Fashion | Elegant Abayas & Two-Piece Collections",
    "🚚 Buy 3 Dresses & Enjoy FREE Nationwide Delivery"
  ]
};
