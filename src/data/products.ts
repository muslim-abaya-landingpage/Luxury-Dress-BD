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
    label: "Abaya Collection",
    href: "/abaya",
    description: "Premium quality Dubai Cherry and Nida Silk fabric elegant and modest abaya collection."
  },
  {
    key: "premium-two-piece",
    label: "Premium Two-Piece",
    href: "/premium-two-piece",
    description: "Exclusive collection of stylish and comfortable premium two-piece dresses."
  },
  {
    key: "cover-up",
    label: "Cover Up",
    href: "/cover-up",
    description: "Our stylish cover up collection to get a fashionable look while maintaining modesty."
  },
  {
    key: "tops-kurti",
    label: "Tops & Kurti",
    href: "/tops-kurti",
    description: "High-quality and casual tops and kurti collection for everyday wear."
  },
  {
    key: "embroidery",
    label: "Embroidery Abaya",
    href: "/embroidery",
    description: "Exclusive hand and machine embroidered abaya sets with beautiful craftsmanship."
  },
  {
    key: "karchupi",
    label: "Karchupi Design",
    href: "/karchupi",
    description: "Luxury abaya sets with beautiful karchupi design for a gorgeous party look."
  },
  {
    key: "kaftan",
    label: "Luxury Kaftan",
    href: "/kaftan",
    description: "Beautiful and modern design kaftan collection made with loose-fitting comfortable fabrics."
  },
  {
    key: "hijab",
    label: "Premium Hijab",
    href: "/hijab",
    description: "Beautiful hijab sets made with premium chiffon, georgette, and crepe fabrics."
  }
];

export const PRODUCTS: Product[] = [
  {
    id: "AB-101",
    name: "Royal Maroon Premium Abaya Set",
    price: 1850,
    category: "abaya",
    fabric: "Premium Dubai Cherry",
    images: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["50", "52", "54", "56"],
    color: "maroon",
    colorLabel: "Royal Maroon",
    description: "This elegant double part abaya set made of premium Dubai Cherry fabric is extremely comfortable and modest. It is suitable for wearing on casual and gorgeous occasions. Beautiful pleats/gathers are designed on sleeves and body.",
    detailNote: "Length: 50, 52, 54, 56 inches (Body Size: 46 inches Free Size)",
    shortNote: "* Color may vary slightly due to photographic lighting sources.",
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
    fabric: "Premium Nida Silk",
    images: [
      "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80"
    ],
    sizes: ["52", "54", "56"],
    color: "black",
    colorLabel: "Jet Black",
    description: "This jet black royal Nida silk abaya features a glossy texture and smooth finish. Perfect stitching and elegant cutting are its key features. The complete set including hijab gives you a touch of class and sophistication.",
    detailNote: "Length: 52, 54, 56 inches (Body Size: 46 inches Free Size)",
    shortNote: "* Original Dubai Nida Silk fabric with color guarantee.",
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
    description: "This designer print premium two-piece set is highly suitable for daily wear and light social gatherings. Features elastic sleeve design on the body, comes with matching trousers or dupatta.",
    detailNote: "Tops Length: 42 inches, Pants Length: 38 inches (Free Size)",
    shortNote: "* Extremely soft fabric, highly comfortable in any weather."
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
    description: "This cover-up shrug is excellent to wear over your casual attire to get a modest and gorgeous look. The golden print border and beautiful drape will give you an elegant outlook.",
    detailNote: "Length: 46 inches (Free Size Body)",
    shortNote: "* Easy to wear over any regular kameez, dress, or gown."
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
    description: "This kurti made of linen cotton is simply the best for summer wear. Simple embroidered design collar and sleeves will give you a casual yet elegant look. Comes with matching comfortable palazzo.",
    detailNote: "Kurti Length: 44 inches, Palazzo Length: 39 inches",
    shortNote: "* Woven with 100% cotton and linen mixed yarn."
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
    description: "This finely hand-embroidered abaya set is highly suitable for parties and any gorgeous occasions. Beautiful pink-golden thread embroidery is the main attraction. The fabric is extremely soft and comfortable.",
    detailNote: "Length: 52, 54, 56 inches (Body Size: 46 inches Free Size)",
    shortNote: "* Hand wash recommended to keep the work looking new for a long time."
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
    description: "One of the best abaya sets featuring exquisite karchupi and stonework for a gorgeous party collection. Neck design decorated with premium needles, thread, and stonework, with a premium drape to give a royal feel.",
    detailNote: "Length: 52, 54, 56 inches. Adjustable belt included for body fitting.",
    shortNote: "* Gorgeous and attractive stonework embellishment."
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
    description: "This wonderful loose-fit designed kaftan will give you a highly elegant look when worn. It has print all around and an adjustable waist belt in the middle to fit any size.",
    detailNote: "Length: 54 inches (Fits body sizes 32 to 48 inches)",
    shortNote: "* Complete double part set including inner."
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
    description: "This premium georgette crepe hijab with non-slip and gorgeous texture is the best for daily use. It does not wrinkle easily and maintains a perfect pin-up fit. The hijab fabric is lightweight and breathable.",
    detailNote: "Size: 75 x 180 cm (Standard large size)",
    shortNote: "* No change in color or texture even after washing."
  }
];
