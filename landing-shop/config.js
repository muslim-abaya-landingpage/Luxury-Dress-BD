/* নতুন ক্লায়েন্টের জন্য এই ফাইলের মান বদলান। গাইড: README.md */
window.LANDING_CONFIG = {
  // CENTRAL THEME CONTROL: শুধু activePreset বদলালেই পুরো পেজের রঙ বদলাবে।
  // অপশন: emeraldGold | blackGold | maroonGold | navyGold | mochaCream
  theme: {
    activePreset: 'emeraldGold',
    // কোনো নির্দিষ্ট রঙ নিজের মতো করতে চাইলে নিচে লিখুন; না চাইলে {} রাখুন।
    custom: {
      // primary: '#173B2D',
      // accent: '#E7C981',
      // background: '#F7F4EA',
      // surface: '#FFFDF8',
      // text: '#17251D'
    }
  },
  brand: {
    name: 'Muslim Abaya',
    pageTitle: 'হাফেজা সেট বোরকা | Muslim Abaya',
    description: 'অরিজিনাল দুবাই চেরি বোরকা, চায়না সফট জর্জেট হুডি হিজাব ও নিকাব। অগ্রিম ছাড়াই ক্যাশ অন ডেলিভারি।',
    siteUrl: 'https://shop.muslimabaya.com/', // চূড়ান্ত প্রকাশিত ডোমেইন; নতুন ক্লায়েন্টের জন্য বদলান
    agencyName: 'Webzo BD',
    agencyUrl: 'https://www.facebook.com/webzobd/',
    facebookUrl: 'https://www.facebook.com/luxurydress.shop/',
    tiktokUrl: 'https://www.tiktok.com/@muslimabaya.shop',
    phone: '01971642683' // কল করার নম্বর
  },
  hero: {
    galleryStyle: 'glass3d', // classic | glass | glass3d
    galleryAutoPlay: true,
    galleryInterval: 3000, // ছবি বদলের সময় (মিলিসেকেন্ড); সর্বনিম্ন 2500
    galleryLightbox: true,
    galleryZoom: true,
    gallerySidePreview: true,
    announcement: 'এক টাকাও অগ্রিম নয় • ক্যাশ অন ডেলিভারি', // হেডারের ঘোষণা
    images: ['images/black.webp','images/black-1.webp','images/black2.webp','images/black3.webp','images/black4.webp','images/black5.webp','images/black6.webp','images/black7.webp'],
    imageAlt: 'কালো হাফেজা সেট বোরকা',
    badge: 'অফার চলছে!', // অফার না থাকলে '' লিখুন
    caption: 'হাফেজা সেট বোরকা, হুডি হিজাব ও নিকাব',
    offerNote: '🔥 এক টাকাও অগ্রিম নয় — ক্যাশ অন ডেলিভারি',
    buttonText: 'অর্ডার করুন',
    offerEndsAt: '', // প্রকৃত শেষ সময় থাকলে ISO তারিখ, যেমন '2026-12-31T23:59:00+06:00'
    sessionMinutes: 0 // কৃত্রিম urgency এড়াতে বন্ধ; প্রকৃত অফার শেষ সময় থাকলে offerEndsAt ব্যবহার করুন
  },
  sectionVisibility: { features: true, countdown: true, reviews: true, products: true, order: true },
  sections: {
    featuresTitle: 'আমাদের বোরকার বৈশিষ্ট্য',
    features: [
      'বোরকার ফেব্রিক: অরিজিনাল দুবাই চেরি কাপড়',
      'হালকা, সফট ও আরামদায়ক কাপড়',
      'ফুল সেটে বোরকা, হুডি হিজাব ও নিকাব',
      'সাইজ: ৫০″ / ৫২″ / ৫৪″ / ৫৬″ / ৫৮″',
      'বোরকার ঘের: ১৮০″+',
      'হিজাব ও নিকাবের ফেব্রিক: অরিজিনাল চায়না সফট জর্জেট',
      'হুডি হিজাব: পেছনে ৩ পার্ট, সামনে ২ পার্ট',
      '২ পার্ট নোজ নিকাব',
      'প্রিমিয়াম ফিনিশিং ও আরামদায়ক ফিটিং',
      'অগ্রিম ছাড়াই ক্যাশ অন ডেলিভারি'
    ],
    contactTitle: 'যেকোনো প্রয়োজনে যোগাযোগ করুন',
    contactCaption: 'অর্ডার সংক্রান্ত সহায়তায় কল করুন',
    contactButton: 'কল করুন',
    productsTitle: 'পছন্দের পণ্যটি সিলেক্ট করুন',
    orderTitle: 'অর্ডার ফর্ম'
  },
  products: [
    { id: 'hafeza-set', name: 'ফুল হাফেজা সেট', details: '(বোরকা + হিজাব + নিকাব)', price: 2385, image: 'images/black-1.webp', sizes: ['50','52','54','56','58'], inStock: true, maxQty: 5, stockBySize: { '50': true, '52': true, '54': true, '56': true, '58': true }, variants: [{ id:'black', name:'Black', swatch:'#111111', image:'images/black-1.webp', price:2385, stockBySize:{'50':true,'52':true,'54':true,'56':true,'58':true} }] },
    { id: 'hijab-niqab', name: 'শুধু হিজাব ও নিকাব', details: '', price: 1200, image: 'images/black3.webp', sizes: [], inStock: true, maxQty: 5 }
  ],
  deliveryAreas: [
    { id: 'outside', label: 'ঢাকা সিটির বাইরে', charge: 150 },
    { id: 'inside', label: 'ঢাকা সিটির ভিতরে', charge: 80 }
  ],
  reviews: [
    { image: 'reviews/review-01.webp', alt: 'গ্রাহকের সন্তুষ্টির মেসেজের স্ক্রিনশট' },
    { image: 'reviews/review-02.webp', alt: 'দ্রুত ডেলিভারি নিয়ে গ্রাহকের মেসেজ' },
    { image: 'reviews/review-03.webp', alt: 'পণ্য পাওয়ার পর গ্রাহকের মেসেজ ও ছবি' },
    { image: 'reviews/review-04.webp', alt: 'বোরকার মান নিয়ে গ্রাহকের মেসেজ ও ছবি' },
    { image: 'reviews/review-05.webp', alt: 'পণ্য পাওয়ার পর গ্রাহকের মেসেজ ও ছবি' },
    { image: 'reviews/review-06.webp', alt: 'পণ্যের মান নিয়ে গ্রাহকের মেসেজ' },
    { image: 'reviews/review-07.webp', alt: 'বোরকা পাওয়ার পর গ্রাহকের মেসেজ' }
  ],
  // ===== ডিসকাউন্ট (অটো) =====
  // চালু করতে enabled: true। দাম, কার্ট, অর্ডারের মোট টাকা আর সার্ভারের দাম-যাচাই সব নিজে থেকে বদলায়।
  // পুরোনো দাম কেটে (~~৳2385~~) পাশে দেখায়। endsAt দিলে ওই সময়ে নিজে থেকেই আগের দামে ফিরে যায়।
  discount: {
    enabled: false,          // true = চালু, false = বন্ধ
    type: 'percent',         // 'percent' = শতাংশ (%) ছাড়, 'fixed' = নির্দিষ্ট টাকা কম
    value: 10,               // percent হলে 10 = ১০%; fixed হলে 200 = ৳200 কম (সর্বোচ্চ ৯০% পর্যন্ত)
    products: [],            // [] = সব পণ্যে; শুধু কিছু পণ্যে চাইলে id দিন, যেমন ['hafeza-set']
    startsAt: '',            // '' = এখনই শুরু; বা '2026-11-05T00:00:00+06:00'
    endsAt: '',              // '' = বন্ধ না করা পর্যন্ত; বা '2026-11-10T23:59:00+06:00' (বাংলাদেশ সময়)
    label: 'ডিসকাউন্ট চলছে!' // ছবির ওপরের ব্যাজে দেখাবে ('' দিলে আগের ব্যাজই থাকবে)
  },
  order: {
    freeShippingThreshold: 0, // 0 = বন্ধ; যেমন 3000 দিলে ৳3000+ অর্ডারে ফ্রি ডেলিভারি
    coupons: [], // উদাহরণ: [{code:'SAVE100', type:'fixed', value:100}] বা type:'percent'
    mode: 'apps-script', // 'apps-script', 'netlify', 'whatsapp' অথবা 'copy'
    apiUrl: '/api/order', // Cloudflare Pages _worker.js → Muslim Abaya Apps Script
    whatsappNumber: '8801971642683', // 01971642683-এর আন্তর্জাতিক ফরম্যাট; + বা স্পেস নয়
    paymentText: 'ক্যাশ অন ডেলিভারি — অগ্রিম প্রয়োজন নেই'
  },
  marketing: {
    gtmId: 'GTM-ML7RL6BR', // শুধু trackingMode: 'gtm' হলে লোড হবে; direct mode-এ duplicate ঠেকাতে বন্ধ
    ga4MeasurementId: 'G-L2BNEXE0XG', // GA4 web data stream-এ ID মিলিয়ে নিন
    ga4LeadViaServer: false, // Netlify function-এ GA4_MP সক্রিয় করলে true; browser+server-এ একই Lead পাঠাবেন না
    metaPixelId: '1465090315322833', // ব্যবহারকারীর দেওয়া ID; Meta Pixel ID হিসেবে ধরে নেওয়া হয়েছে
    tiktokPixelId: 'D6FK9GBC77UC649NNCP0', // TikTok Ads Manager-এর Pixel ID
    trackingMode: 'direct', // direct: GA4/Meta/TikTok এখানে; gtm: সব ট্যাগ GTM-এ কনফিগ করতে হবে

    // Google Ads → Tools → Conversions → নতুন conversion action বানালে এই দুটো মান দেখাবে।
    // ফাঁকা রাখলে (বা ভুল ফরম্যাট হলে) কিছুই লোড হবে না — অন্য কোনো ট্র্যাকিং ভাঙবে না।
    googleAdsConversionId: '', // ফরম্যাট: 'AW-XXXXXXXXX'
    googleAdsConversionLabel: '', // ফরম্যাট: 'AbCdEfGhIjKlMnOp' (Conversions পেজে "Tag setup"-এ পাবেন)

    // Microsoft Clarity → clarity.microsoft.com → Settings → Setup → Project ID।
    clarityId: '', // ফরম্যাট: 10 অক্ষরের কোড, যেমন 'a1b2c3d4e5'

    // ⚠️ false-ই রাখুন। এই অর্ডার একই Apps Script/Google Sheet-এ যায় যেখানে অর্ডার
    // "Confirmed" করা হলে sendToFacebookCAPI + sendToTikTokCAPI ইতিমধ্যে সঠিক Purchase
    // event পাঠায় (একই Pixel ID — TikTok-এর 'D6FK9GBC77UC649NNCP0' Code.gs-এও হুবহু
    // একই)। true করলে প্রতিটা অর্ডার জমা দেওয়ার সাথে সাথেই (নিশ্চিত হওয়ার আগেই) আরেকটা
    // Purchase পাঠানো হবে — Confirmed হলে দুইবার গোনা হবে, বাতিল হলে ভুয়া Purchase থেকে
    // যাবে। শুধু তখনই true করুন যদি Apps Script-এর ওই confirmed-order পাইপলাইন এই সাইটের
    // জন্য বন্ধ/ভিন্ন থাকে।
    firePurchaseOnOrderSubmit: false
  }
};

// Builder preview override (only when index.html?builderPreview=1 is opened on the same origin).
try {
  if (new URLSearchParams(location.search).get('builderPreview') === '1') {
    const draft = localStorage.getItem('webzo_builder_preview');
    if (draft) window.LANDING_CONFIG = JSON.parse(draft);
  }
} catch (_) {}
