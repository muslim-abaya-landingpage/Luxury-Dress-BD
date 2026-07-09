export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  fabric: string;
  images: string[];
  sizes: string[];
  color: string;
  colorLabel: string;
  description: string;
  detailNote?: string;
  shortNote?: string;
  types?: string[];
  priceByType?: Record<string, number>;
}

export interface Category {
  key: string;
  label: string;
  href: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  {
    key: "abaya",
    label: "Abaya (আবায়া)",
    href: "/abaya",
    description: "প্রিমিয়াম কোয়ালিটি দুবাই চেরি এবং নিদা সিল্ক কাপড়ের তৈরি অভিজাত ও মার্জিত আবায়া কালেকশন।"
  },
  {
    key: "premium-two-piece",
    label: "Premium Two-Piece",
    href: "/premium-two-piece",
    description: "স্টাইলিশ এবং আরামদায়ক প্রিমিয়াম টু-পিস পোশাকের এক্সক্লুসিভ কালেকশন।"
  },
  {
    key: "cover-up",
    label: "Cover Up",
    href: "/cover-up",
    description: "শালীনতা বজায় রেখে ফ্যাশনেবল লুক পেতে আমাদের স্টাইলিশ কভার আপ কালেকশন।"
  },
  {
    key: "tops-kurti",
    label: "Tops & Kurti",
    href: "/tops-kurti",
    description: "প্রতিদিনের ব্যবহারের জন্য মানসম্পন্ন এবং ক্যাজুয়াল টপস ও কুর্তি কালেকশন।"
  },
  {
    key: "embroidery",
    label: "Embroidery Abaya",
    href: "/embroidery",
    description: "হাতে ও মেশিনে এমব্রয়ডারি করা চমৎকার কারুকাজের এক্সক্লুসিভ আবায়া সেট।"
  },
  {
    key: "karchupi",
    label: "Karchupi Design",
    href: "/karchupi",
    description: "গর্জিয়াস পার্টি লুকের জন্য আকর্ষণীয় কারচুপি ডিজাইনের লাক্সারি আবায়া সেট।"
  },
  {
    key: "kaftan",
    label: "Luxury Kaftan",
    href: "/kaftan",
    description: "লুজ ফিটিং আরামদায়ক ফেব্রিক্সে তৈরি চমৎকার ও আধুনিক ডিজাইনের কাফতান কালেকশন।"
  },
  {
    key: "hijab",
    label: "Premium Hijab",
    href: "/hijab",
    description: "প্রিমিয়াম শিফন, জর্জেট এবং ক্রিপ ফেব্রিক্সে তৈরি চমৎকার হিজাব সেট।"
  }
];

export const PRODUCTS: Product[] = [
  {
    id: "AB-101",
    name: "Royal Maroon Premium Abaya Set",
    price: 1850,
    category: "abaya",
    fabric: "Dubai Cherry (দুবাই চেরি)",
    images: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["50", "52", "54", "56"],
    color: "maroon",
    colorLabel: "Royal Maroon",
    description: "প্রিমিয়াম দুবাই চেরি ফেব্রিক্সে তৈরি চমৎকার এই ডাবল পার্ট আবায়া সেটটি অত্যন্ত আরামদায়ক এবং মার্জিত। এটি ক্যাজুয়াল ও গর্জিয়াস যেকোনো অনুষ্ঠানে পরিধানের যোগ্য। স্লিভ ও বডিতে চমৎকার কুঁচি ডিজাইন করা রয়েছে।",
    detailNote: "লং: ৫০, ৫২, ৫৪, ৫৬ ইঞ্চি (বডি সাইজ: ৪৬ ইঞ্চি ফ্রি সাইজ)",
    shortNote: "* ছবিতে লাইটিংয়ের কারণে রঙের সামান্য তারতম্য হতে পারে।",
    types: ["Full Set", "Abaya Only", "Hijab Only"],
    priceByType: {
      "Full Set": 1850,
      "Abaya Only": 1450,
      "Hijab Only": 450
    }
  },
  {
    id: "AB-102",
    name: "Classic Jet Black Luxury Abaya",
    price: 1950,
    category: "abaya",
    fabric: "Premium Nida Silk (নিদা সিল্ক)",
    images: [
      "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["52", "54", "56"],
    color: "black",
    colorLabel: "Jet Black",
    description: "কুচকুচে কালো রাজকীয় নিদা সিল্ক ফেব্রিক্সের এই আবায়াতে রয়েছে গ্লসি টেক্সচার এবং মসৃণ ফিনিশ। নিখুঁত সেলাই ও রুচিশীল কাটিং এর অন্যতম বৈশিষ্ট্য। হিজাব সহ সম্পূর্ণ সেটটি আপনাকে দেবে আভিজাত্যের স্পর্শ।",
    detailNote: "লং: ৫২, ৫৪, ৫৬ ইঞ্চি (বডি সাইজ: ৪৬ ইঞ্চি ফ্রি সাইজ)",
    shortNote: "* অরিজিনাল দুবাই নিদা সিল্ক ফেব্রিক্স, কালার গ্যারান্টি থাকবে।",
    types: ["Full Set", "Abaya Only"],
    priceByType: {
      "Full Set": 1950,
      "Abaya Only": 1550
    }
  },
  {
    id: "TP-201",
    name: "Emerald Floral Premium Two-Piece",
    price: 1250,
    category: "premium-two-piece",
    fabric: "Premium Silk Georgette",
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["Free Size"],
    color: "emerald",
    colorLabel: "Emerald Green",
    description: "ডিজাইনার প্রিন্টের এই প্রিমিয়াম টু-পিস সেটটি দৈনন্দিন পরিধান এবং হালকা অনুষ্ঠানে যাওয়ার জন্য অত্যন্ত উপযোগী। বডিতে ইলাস্টিক স্লিভ ডিজাইন এবং ম্যাচিং ট্রাউজার বা ওড়না সেট সহ পাওয়া যাচ্ছে।",
    detailNote: "টপস লং: ৪২ ইঞ্চি, প্যান্ট লং: ৩৮ ইঞ্চি (ফ্রি সাইজ)",
    shortNote: "* ফেব্রিক্স অত্যন্ত সফট এবং যেকোনো আবহাওয়ায় আরামদায়ক।"
  },
  {
    id: "CV-301",
    name: "Royal Blue Golden Print Cover Up",
    price: 1100,
    category: "cover-up",
    fabric: "Premium Soft Crepe",
    images: [
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["Free Size"],
    color: "blue",
    colorLabel: "Royal Blue",
    description: "আপনার সাধারণ পোশাকের উপর পরিধান করে একটি মডেস্ট ও গর্জিয়াস লুক পেতে এই কভার আপ শ্রাগটি অত্যন্ত চমৎকার। সোনালী প্রিন্টের বর্ডার এবং চমৎকার ঝুল আপনাকে দেবে রুচিশীল আউটলুক।",
    detailNote: "ঝুল: ৪৬ ইঞ্চি (ফ্রি সাইজ বডি)",
    shortNote: "* যেকোনো সাধারণ কামিজ বা গাউনের উপর সহজে পরা যায়।"
  },
  {
    id: "TK-401",
    name: "Pastel Mint Kurti & Palazzo Set",
    price: 1350,
    category: "tops-kurti",
    fabric: "Organic Linen Blend",
    images: [
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["38", "40", "42", "44"],
    color: "mint",
    colorLabel: "Mint Green",
    description: "লিলেন কটনে তৈরি এই কুর্তিটি গরমে পরিধানের জন্য অত্যন্ত সেরা। সিম্পল এমব্রয়ডারি ডিজাইন করা কলার ও স্লিভ আপনাকে দেবে ক্যাজুয়াল অথচ এলিগেন্ট লুক। সাথে রয়েছে ম্যাচিং কমফোর্টেবল পালাজ্জো।",
    detailNote: "কুর্তি লং: ৪৪ ইঞ্চি, পালাজ্জো লং: ৩৯ ইঞ্চি",
    shortNote: "* শতভাগ কটন ও লিলেন মিক্সড সুতা দিয়ে বোনা।"
  },
  {
    id: "EB-501",
    name: "Rose Gold Hand Embroidery Abaya Set",
    price: 2450,
    category: "embroidery",
    fabric: "Dubai Cherry Premium",
    images: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["52", "54", "56"],
    color: "rose-gold",
    colorLabel: "Rose Gold",
    description: "নিখুঁত হাতের কাজের এমব্রয়ডারি সমৃদ্ধ এই আবায়া সেটটি পার্টি ও যেকোনো গর্জিয়াস অনুষ্ঠানের জন্য মানানসই। আকর্ষণীয় গোলাপী গোল্ডেন সুতার সূক্ষ্ম কাজ এর মূল আকর্ষণ। কাপড়টি অত্যন্ত সফট ও আরামদায়ক।",
    detailNote: "লং: ৫২, ৫৪, ৫৬ ইঞ্চি (বডি ৪৬ ইঞ্চি ফ্রি সাইজ)",
    shortNote: "* হ্যান্ড ওয়াশ রিকমেন্ডেড, কারুকাজ দীর্ঘদিন নতুনের মতো থাকবে।"
  },
  {
    id: "KB-601",
    name: "Midnight Luxury Karchupi Abaya",
    price: 2850,
    category: "karchupi",
    fabric: "Ultra-Soft Georgette",
    images: [
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["52", "54", "56"],
    color: "black",
    colorLabel: "Midnight Black",
    description: "গর্জিয়াস পার্টি কালেকশনের জন্য সেরা একটি কারচুপি ও স্টোনের কাজের আবায়া সেট। উন্নত মানের সুই ও সুতার সাথে স্টোনের নকশা করা গলার ডিজাইন এবং জমকালো ঝুল আপনাকে দেবে রাজকীয় অনুভূতি।",
    detailNote: "লং: ৫২, ৫৪, ৫৬ ইঞ্চি, বেল্ট সহ বডি ফিটিং করার সুযোগ রয়েছে।",
    shortNote: "* আকর্ষণীয় পাথরের গর্জিয়াস কাজ করা।"
  },
  {
    id: "KF-701",
    name: "Dusty Pink Elegant Floral Kaftan",
    price: 1650,
    category: "kaftan",
    fabric: "Premium Weight Chiffon",
    images: [
      "https://images.unsplash.com/photo-1561414927-6d86591d0c4f?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["Free Size"],
    color: "pink",
    colorLabel: "Dusty Pink",
    description: "চমৎকার লুজ-ফিট ডিজাইনের এই কাফতানটি পরিধান করলে আপনাকে দেবে এক দারুণ এলিগেন্ট লুক। এর চারদিকের প্রিন্ট ও মাঝখানে কোমরে অ্যাডজাস্টেবল ফিতা রয়েছে, যা যেকোনো সাইজে ফিট হয়ে যাবে।",
    detailNote: "লং: ৫৪ ইঞ্চি (বডি সাইজ: ৩২ থেকে ৪৮ ইঞ্চি পর্যন্ত ফিট হবে)",
    shortNote: "* ইনার সহ সম্পূর্ণ ডাবল পার্ট সেট।"
  },
  {
    id: "HJ-801",
    name: "Classic Pastel Silk Hijab Set",
    price: 450,
    category: "hijab",
    fabric: "Premium Georgette Crepe",
    images: [
      "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["75 x 180 cm"],
    color: "pastel",
    colorLabel: "Pastel Peach",
    description: "নন-স্লিপ ও গর্জিয়াস টেক্সচারের এই প্রিমিয়াম জর্জেট ক্রিপ হিজাবটি প্রতিদিন ব্যবহারের জন্য বেস্ট। এটি সহজে কুঁচকে যায় না এবং চমৎকার পিনআপ ফিটিং ধরে রাখে। হিজাবের কাপড়টি হালকা ও শ্বাসপ্রশ্বাসযোগ্য।",
    detailNote: "সাইজ: ৭৫ x ১৮০ সেন্টিমিটার (স্ট্যান্ডার্ড বড় সাইজ)",
    shortNote: "* ধোয়ার পরও কালার বা টেক্সচারের কোনো পরিবর্তন হবে না।"
  }
];
