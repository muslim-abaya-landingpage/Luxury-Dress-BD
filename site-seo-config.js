/**
 * Muslim Abaya — SEO ও সোশ্যাল (এক জায়গায় পরিবর্তন করুন)
 * Facebook পেজ URL এখানে আপডেট করলে সাইট জুড়ে লাগবে।
 */
window.SITE_SEO = {
  siteUrl: "https://muslimabaya.com",
  brand: "Muslim Abaya",
  brandBn: "মুসলিম আবায়া",
  defaultImage: "https://muslimabaya.com/images/Baby-Pink-Floral-Print.jpeg",
  locale: "bn_BD",
  phone: "+8801971642683",
  social: {
    facebook: "https://www.facebook.com/muslimabayaofficial/", // মেইন ফেসবুক পেজ
    instagram: "https://www.instagram.com/muslimabaya.shop/",
    youtube: "https://www.youtube.com/@luxurydress_shop",
    tiktok: "https://www.tiktok.com/@muslimabaya.shop",
    linkedin: "https://www.linkedin.com/in/muslimabayabd",
    threads: "https://www.threads.com/@muslimabaya.shop"
  },
  pages: {
    "/about": {
      title: "About Us | Muslim Abaya — muslimabaya.com",
      description:
        "Muslim Abaya সম্পর্কে জানুন — বাংলাদেশে প্রিমিয়াম আবায়া ও মডেস্ট ফ্যাশন। ক্যাশ অন ডেলিভারি, সারাদেশে শিপিং।"
    },
    "/help": {
      title: "Order Help & FAQ | Muslim Abaya",
      description:
        "অর্ডার, ডেলিভারি, পেমেন্ট ও রিটার্ন সহায়তা — Muslim Abaya (muslimabaya.com)।"
    },
    "/video": {
      title: "Product Videos | Muslim Abaya",
      description:
        "আসল প্রোডাক্ট ভিডিও — Muslim Abaya কালেকশন দেখুন আগে অর্ডার করুন।"
    },
    "/privacy": {
      title: "Privacy Policy | Muslim Abaya",
      description: "Muslim Abaya গোপনীয়তা নীতি — muslimabaya.com।"
    },
    "/terms": {
      title: "Terms & Conditions | Muslim Abaya",
      description: "Muslim Abaya শর্তাবলী — muslimabaya.com।"
    },
    "/refund": {
      title: "Refund Policy | Muslim Abaya",
      description: "Muslim Abaya রিফান্ড ও রিটার্ন নীতি — muslimabaya.com।"
    },
    "/category": {
      title: "All Categories | Muslim Abaya",
      description:
        "সব ক্যাটাগরি — আবায়া, টু-পিস, এম্ব্রয়ডারি ও আরও। Muslim Abaya বাংলাদেশ।"
    }
  },
  categories: {
    abaya: {
      title: "Abaya Collection | Muslim Abaya — Buy Online Bangladesh",
      description:
        "Premium abaya collection Bangladesh — soft georgette, modest styles, cash on delivery nationwide. Shop Muslim Abaya at muslimabaya.com."
    },
    "premium-two-piece": {
      title: "Premium Two-Piece Dress | Muslim Abaya — COD Bangladesh",
      description:
        "Premium two-piece modest dress collection — floral prints, georgette fabric, cash on delivery all over Bangladesh. muslimabaya.com."
    },
    "cover-up": {
      title: "Cover Up Collection | Muslim Abaya Bangladesh",
      description: "Modest cover up collection — Muslim Abaya Bangladesh. Order online with cash on delivery."
    },
    "tops-kurti": {
      title: "Tops & Kurti | Muslim Abaya — Modest Fashion",
      description: "Tops and kurti collection — modest fashion, COD Bangladesh. Muslim Abaya muslimabaya.com."
    },
    embroidery: {
      title: "Embroidery Abaya & Dress | Muslim Abaya",
      description: "Embroidery abaya and dress collection — premium modest wear, cash on delivery Bangladesh."
    },
    karchupi: {
      title: "Karchupi Collection | Muslim Abaya Bangladesh",
      description: "Karchupi modest fashion collection — Muslim Abaya. Cash on delivery nationwide."
    },
    kaftan: {
      title: "Kaftan Collection | Muslim Abaya Bangladesh",
      description: "Kaftan collection — modest fashion Bangladesh. Order with COD at muslimabaya.com."
    },
    hijab: {
      title: "Hijab Collection | Muslim Abaya Bangladesh",
      description: "Hijab collection — Muslim Abaya Bangladesh. Cash on delivery."
    }
  }
};
/**
 * JSON-LD Schema Generator for Muslim Abaya (Online Store)
 * এটি স্বয়ংক্রিয়ভাবে গুগলের জন্য ই-কমার্স রিলেটেড তথ্য তৈরি করবে
 */
(function() {
    // নিশ্চিত হয়ে নেওয়া যে SEO অবজেক্টটি লোড হয়েছে
    if (!window.SITE_SEO) return;

    const schema = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "name": window.SITE_SEO.brand,
    "alternateName": window.SITE_SEO.brandBn,
    "url": window.SITE_SEO.siteUrl,
    "image": window.SITE_SEO.defaultImage, // এটি ইমেজ এরর সমাধান করবে
    "telephone": window.SITE_SEO.phone,
    "priceRange": "$$",
    "address": {
        "@type": "PostalAddress",
        "addressLocality": "Dhaka",
        "addressCountry": "BD"
    },
    "contactPoint": {
        "@type": "ContactPoint",
        "telephone": window.SITE_SEO.phone,
        "contactType": "customer service",
        "areaServed": "BD",
        "availableLanguage": ["bn", "en"]
    },
    "sameAs": [
        window.SITE_SEO.social.facebook,
        window.SITE_SEO.social.instagram,
        window.SITE_SEO.social.youtube,
        window.SITE_SEO.social.tiktok,
        window.SITE_SEO.social.linkedin,
        window.SITE_SEO.social.threads
    ]
};

    // স্ক্রিপ্ট এলিমেন্ট তৈরি করে হেডে যুক্ত করা
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
})();
