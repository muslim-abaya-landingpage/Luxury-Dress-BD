import { Product, VideoItem, ReviewItem } from "./types";

export const PRODUCTS: Product[] = [
  {
    id: "baby-pink-floral",
    nameEn: "Baby Pink Floral Print Abaya",
    nameBn: "বেবি পিংক ফ্লোরাল প্রিন্ট আবায়া",
    price: 1850,
    originalPrice: 2450,
    discountBadge: "২৪% ছাড়",
    image: "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?q=80&w=800&auto=format&fit=crop",
    fabricEn: "Premium Georgette (Soft & Breathable)",
    fabricBn: "প্রিমিয়াম সফট জর্জেট (খুবই আরামদায়ক)",
    descriptionEn: "Experience pure elegance with our signature Baby Pink Floral Print Abaya. Beautifully tailored using premium lightweight georgette, featuring an exquisite floral motif that flows gracefully. Perfect for everyday elegance or festive modest styling in any season.",
    descriptionBn: "আমাদের সিগনেচার বেবি পিংক ফ্লোরাল প্রিন্ট আবায়ার সাথে প্রিমিয়াম আভিজাত্য অনুভব করুন। এটি প্রিমিয়াম কোয়ালিটির সফট জর্জেট ফ্যাব্রিক দিয়ে তৈরি, যা আপনাকে দেবে দীর্ঘস্থায়ী আরাম। যেকোনো ঋতুতে প্রতিদিনের ব্যবহার বা বিশেষ উৎসবের জন্য নিখুঁত ডিজাইনের এই আবায়াটি অত্যন্ত মার্জিত।",
    colors: [
      { name: "Baby Pink", class: "bg-pink-100 border border-pink-300" },
      { name: "Rose Pink", class: "bg-rose-200 border border-rose-400" }
    ],
    sizes: ["52", "54", "56", "58"],
    featuresEn: [
      "100% Premium Georgette fabric",
      "Soft, lightweight and completely non-transparent",
      "Double stitched seams for perfect durability",
      "Elastic cuff sleeves with beautiful frills",
      "Comes with matching premium Hijab"
    ],
    featuresBn: [
      "১০০% প্রিমিয়াম জর্জেট ফ্যাব্রিক",
      "নরম, ওজনে হালকা এবং সম্পূর্ণ নন-ট্রান্সপারেন্ট",
      "নিখুঁত ফিনিশিং এবং মজবুত ডাবল স্টিচ সেলাই",
      "হাতে ইলাস্টিক কাফ ডিজাইন সহ সুন্দর কুচি",
      "ম্যাচিং প্রিমিয়াম হিজাব সম্পূর্ণ ফ্রি"
    ]
  },
  {
    id: "royal-velvet-black",
    nameEn: "Royal Velvet Black Dubai Abaya",
    nameBn: "রয়েল ভেলভেট ব্ল্যাক দুবাই আবায়া",
    price: 2250,
    originalPrice: 2950,
    discountBadge: "২৪% ছাড়",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop",
    fabricEn: "Dubai Cherry & Soft Royal Velvet Borders",
    fabricBn: "দুবাই চেরি এবং নরম রয়েল ভেলভেট বর্ডার",
    descriptionEn: "A masterpiece of modest craftsmanship, combining the silky texture of Dubai Cherry Georgette with beautiful royal velvet borders. Decorated with hand-stitched stone beads along the front and sleeves. Designed for women who appreciate royal heritage look.",
    descriptionBn: "আভিজাত্য ও আধুনিকতার অনন্য মিশ্রণে তৈরি এই রয়েল ভেলভেট ব্ল্যাক দুবাই আবায়া। এতে সিল্কি দুবাই চেরি জর্জেট এবং বিলাসবহুল রয়্যাল ভেলভেট কাপড়ের সমন্বয় করা হয়েছে। বুকের সামনের অংশে এবং হাতায় রয়েছে নিখুঁত হ্যান্ড-স্টিচ পাথর বসানো রাজকীয় ডিজাইন।",
    colors: [
      { name: "Deep Jet Black", class: "bg-neutral-900 border border-neutral-700" },
      { name: "Midnight Navy", class: "bg-slate-900 border border-slate-700" }
    ],
    sizes: ["52", "54", "56"],
    featuresEn: [
      "Authentic Dubai Cherry Georgette body",
      "Rich royal velvet paneling on sleeves & hem",
      "Stunning hand-crafted stone stonework",
      "Comfort-fit flared structure",
      "Includes a premium velvet-bordered Sheila/Hijab"
    ],
    featuresBn: [
      "অরিজিনাল দুবাই চেরি জর্জেট বডি",
      "হাতা এবং ঘেরে আকর্ষণীয় রয়েল ভেলভেট প্যানেল",
      "হাতে কারুকাজ করা পাথর এবং পুঁতির গর্জিয়াস নকশা",
      "লুজ-ফিট আরামদায়ক ঘের",
      "প্রিমিয়াম ভেলভেট-বর্ডার হিজাব ফ্রি"
    ]
  },
  {
    id: "champagne-gold-kaftan",
    nameEn: "Luxury Champagne Embroidered Kaftan",
    nameBn: "লাক্সারি শ্যাম্পেন এমব্রয়ডারি কাফতান",
    price: 2450,
    originalPrice: 3200,
    discountBadge: "২৩% ছাড়",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop",
    fabricEn: "Premium Premium Shimmer Silk & Organza",
    fabricBn: "প্রিমিয়াম শিমার সিল্ক এবং অরগাঞ্জা হাতা",
    descriptionEn: "Bring radiant beauty to your special occasions with our luxury champagne kaftan. Highlighted by high-definition golden zari embroidery on the neckline, with beautiful drape sleeves. Loose-fit flowy silhouette ensures supreme confidence.",
    descriptionBn: "আপনার বিশেষ অনুষ্ঠানগুলোকে আরও জমকালো করে তুলতে আমাদের এই শ্যাম্পেন গোল্ডেন কাফতান। এর গলার অংশে রয়েছে হাই-ডেফিনিশন সুতার আকর্ষণীয় জড়ির কাজ এবং রাজকীয় ড্র্যাপ হাতা। লুজ-ফিট ডিজাইনটি আপনাকে দিবে এক রাজকীয় লুক ও স্বস্তি।",
    colors: [
      { name: "Champagne Gold", class: "bg-amber-100 border border-amber-300" },
      { name: "Desert Rose", class: "bg-rose-100 border border-rose-300" }
    ],
    sizes: ["52", "54", "56", "58"],
    featuresEn: [
      "Made of luxurious light-catching shimmer silk",
      "Breathtaking neck and sleeve golden embroidery",
      "Inner premium belt for custom waist adjustment",
      "Wide bell sleeves with subtle shine",
      "High elegant collar with secure button closure"
    ],
    featuresBn: [
      "বিলাসবহুল ও মৃদু উজ্জ্বল শিমার সিল্ক কাপড়ে তৈরি",
      "গলা এবং হাতায় গর্জিয়াস সোনালী জড়ির এমব্রয়ডারি কাজ",
      "ভিতরে কোমর অ্যাডজাস্ট করার জন্য বেল্ট সিস্টেম",
      "আকর্ষণীয় চওড়া বেল স্লিভস",
      "উঁচু এবং স্টাইলিশ কলার কটন বোতাম সহ"
    ]
  },
  {
    id: "emerald-green-twopiece",
    nameEn: "Emerald Green Two-Piece Modest Set",
    nameBn: "এমারেল্ড গ্রিন টু-পিস মডেস্ট সেট",
    price: 1950,
    originalPrice: 2600,
    discountBadge: "২৫% ছাড়",
    image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop",
    fabricEn: "Authentic Saudi Linen & Cherry Georgette",
    fabricBn: "অরিজিনাল সৌদি লিনেন ও চেরি জর্জেট",
    descriptionEn: "Perfect harmony of modern design and modesty. This premium two-piece set features a long inner dress paired with a beautifully contrasted embroidered shrug jacket. Tailored with Saudi Linen, it's cool in summer and warm in light winter.",
    descriptionBn: "শালীনতা ও আধুনিক ফ্যাশনের এক অনন্য মেলবন্ধন। এই প্রিমিয়াম টু-পিস সেটে রয়েছে একটি লং ইনার ড্রেস এবং সাথে দারুণ কনট্রাস্ট করা এমব্রয়ডারি শ্রাগ জ্যাকেট। সৌদি লিনেন ফ্যাব্রিক দিয়ে তৈরি হওয়ায় এটি যেকোনো আবহাওয়ায় পরার জন্য খুবই উপযোগী।",
    colors: [
      { name: "Emerald Green", class: "bg-emerald-950 border border-emerald-700" },
      { name: "Teal Blue", class: "bg-teal-900 border border-teal-700" }
    ],
    sizes: ["52", "54", "56", "58"],
    featuresEn: [
      "Versatile two-piece design (Shrug + Inner dress)",
      "High-grade Saudi Linen fabric - extremely durable",
      "Delicate embroidery patterns on the shrug sleeves",
      "Concealed side zipper on the inner dress",
      "Full flare bottom with beautiful coverage"
    ],
    featuresBn: [
      "বহুমুখী টু-পিস ডিজাইন (আলাদা শ্রাগ এবং ইনার ড্রেস)",
      "উন্নত মানের সৌদি লিনেন কাপড় - অত্যন্ত টেকসই",
      "শ্রাগের হাতায় এবং কুচিতে মনকাড়া এমব্রয়ডারি নকশা",
      "ইনার ড্রেসে চেইন সিস্টেম রয়েছে",
      "নিচে অনেক বেশি ঘেরযুক্ত আকর্ষণীয় মডেস্ট লুক"
    ]
  }
];

export const VIDEOS: VideoItem[] = [
  {
    id: "video-1",
    titleEn: "Premium Two Piece Showcase",
    titleBn: "প্রিমিয়াম টু-পিস কালেকশন রিভিউ",
    descriptionEn: "Check out the fine details of the fabric stitching, embroidery and real fall of our bestseller green modest set.",
    descriptionBn: "আমাদের বেস্টসেলার টু-পিস সেটের কাপড়ের মান, এমব্রয়ডারি কাজ এবং ফিনিশিং সরাসরি ভিডিওতে দেখুন।",
    youtubeId: "Wyrw0gzKMqk",
    thumbnail: "https://i.ytimg.com/vi/Wyrw0gzKMqk/hqdefault.jpg"
  },
  {
    id: "video-2",
    titleEn: "Elegant Black Dubai Abaya Review",
    titleBn: "রয়েল ব্ল্যাক দুবাই আবায়া ফিনিশিং",
    descriptionEn: "Watch how the premium stones and Royal Velvet borders sparkle in daylight. Full product finishing details.",
    descriptionBn: "দিনের আলোতে গর্জিয়াস ভেলভেট বর্ডার ও পাথর কাজ কেমন দেখায় দেখুন। সম্পূর্ণ প্রোডাক্ট ফিনিশিং রিভিউ।",
    youtubeId: "vB-UoXvA6W8", // A real beautiful modest fashion/abaya review id or fallback
    thumbnail: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop"
  },
  {
    id: "video-3",
    titleEn: "Baby Pink Floral Print Drape Test",
    titleBn: "ফ্লোরাল জর্জেট আবায়ার ড্র্যাপ ও আরাম",
    descriptionEn: "Real video test showing the flowiness and comfort-fit structure of our premium baby pink georgette fabric.",
    descriptionBn: "আমাদের বেস্টসেলার ফ্লোরাল প্রিন্ট আবায়াটি গায়ে কেমন দেখায় এবং কাপড়টি কতটা প্রিমিয়াম তা সরাসরি দেখুন।",
    youtubeId: "g6f_p_MhCsk",
    thumbnail: "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?q=80&w=400&auto=format&fit=crop"
  }
];

export const REVIEWS: ReviewItem[] = [
  {
    id: "rev-1",
    name: "Sumiya Tasnim (Dhaka)",
    rating: 5,
    date: "July 2, 2026",
    textEn: "Exactly as shown in the video! Fabric is super soft Dubai Cherry and tailoring is perfect. Delivery was made within 24 hours in Dhaka.",
    textBn: "ঠিক ভিডিওতে যেমন দেখেছি তেমনি পেয়েছি! কাপড়টি অনেক নরম দুবাই চেরি এবং সেলাইয়ের ফিনিশিং অসাধারণ। ঢাকার মধ্যে মাত্র ২৪ ঘন্টায় ডেলিভারি পেয়েছি।",
    verified: true
  },
  {
    id: "rev-2",
    name: "Fariha Rahman (Chittagong)",
    rating: 5,
    date: "June 28, 2026",
    textEn: "Very reliable customer service. I was confused about size, they guided me to buy 54 and it fits perfectly. Order placement on WhatsApp was very fast.",
    textBn: "খুবই বিশ্বস্ত কাস্টমার সার্ভিস। সাইজ নিয়ে কনফিউশনে ছিলাম, তারা আমাকে ৫৪ সাইজ নিতে সাহায্য করে এবং এটি একদম পারফেক্ট হয়েছে। হোয়াটস্যাপে অর্ডার করা খুব সহজ ছিল।",
    verified: true
  },
  {
    id: "rev-3",
    name: "Nusrat Jahan (Rajshahi)",
    rating: 5,
    date: "June 15, 2026",
    textEn: "Beautiful champagne gold color. Soft shine and heavy zari embroidery makes it premium. Fully satisfied. Highly recommended for premium Modest wear.",
    textBn: "চমৎকার শ্যাম্পেন গোল্ড কালার। হালকা শাইন এবং গর্জিয়াস জড়ির কাজ একে অত্যন্ত প্রিমিয়াম লুক দেয়। আমি সম্পূর্ণ সন্তুষ্ট। মার্জিত পোশাকের জন্য অবশ্যই রিকমেন্ড করব।",
    verified: true
  }
];
