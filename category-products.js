/**
 * ═══════════════════════════════════════════════════════════════════
 *  প্রোডাক্ট যোগ/বাদ — শুধু এই ফাইল এডিট করুন (PRODUCT-GUIDE.md দেখুন)
 *  • বাল্ক ছবি লিংক: product-links.html → product-links-data.js
 *  • পুরো তথ্য: নিচের অ্যারেতে { id, name, image, price, ... }
 *  • লিংক সার্ভার বদল: product-config.js → SITE_LINKS.images
 *  • Abaya → abaya:[] | Two-piece → "premium-two-piece":[] | খালি ক্যাটাগরি → []
 *  • product-links-data শুধু ছবি আপডেট করে; নতুন প্রোডাক্ট শুধু এখানে + ম্যানেজার থেকে
 * ═══════════════════════════════════════════════════════════════════
 */
window.CATEGORY_PRODUCTS = {

  /* ═══ ① আবায়া সারি · ABAYA · abaya.html · /abaya ═══ */
  abaya: [
    {
      id: "ABY-MAROON-1",
      name: "Maroon Abaya Set",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Maroon%20Abaya%20Set...jpeg?raw=1",
      link: "/",
      price: 999,
      color: "maroon",
      colorLabel: "Maroon",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 999, "Abaya Only": 799 }
    },
    {
      id: "ABY-MAROON-2",
      name: "Maroon Abaya Set - Back",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Maroon%20Abaya%20Set..jpeg?raw=1",
      link: "/",
      price: 999,
      color: "maroon",
      colorLabel: "Maroon",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"]
    },
    {
      id: "ABY-MAROON-3",
      name: "Maroon Abaya Set - Side",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Maroon%20Abaya%20Set.jpeg?raw=1",
      link: "/",
      price: 999,
      color: "maroon",
      colorLabel: "Maroon",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 999, "Abaya Only": 799 }
    },
    {
      id: "ABY-BLACK-1",
      name: "Black Abaya Set",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Black...jpeg?raw=1",
      link: "/",
      price: 999,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 999, "Abaya Only": 799 }
    },
    {
      id: "ABY-BLACK-2",
      name: "Black Abaya Set - Back",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Black..jpeg?raw=1",
      link: "/",
      price: 999,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 999, "Abaya Only": 799 }
    },
    {
      id: "ABY-BLACK-3",
      name: "Black Abaya Set - Side",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Black.jpeg?raw=1",
      link: "/",
      price: 999,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 999, "Abaya Only": 799 }
    },
    {
      id: "ABY-VERSACE-1",
      name: "Versace Border Premium Abaya Set",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Versace%20Border%20Premium%20Abaya%20Set...jpg?raw=1",
      link: "/",
      price: 1550,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1750, "Abaya Only": 1550 }
    },
    {
      id: "ABY-VERSACE-2",
      name: "Versace Border Premium Abaya Set - Back",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Versace%20Border%20Premium%20Abaya%20Set..jpg?raw=1",
      link: "/",
      price: 1550,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1750, "Abaya Only": 1550 }
    },
    {
      id: "ABY-VERSACE-3",
      name: "Versace Border Premium Abaya Set - Side",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Versace%20Border%20Premium%20Abaya%20Set.jpg?raw=1",
      link: "/",
      price: 1550,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1750, "Abaya Only": 1550 }
    },
    {
      id: "ABY-FLORAL-1",
      name: "Premium Floral Motif Abaya Set",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Premium-Floral-Motif-Abaya-Set...jpeg?raw=1",
      link: "/",
      price: 1650,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1850, "Abaya Only": 1650 }
    },
    {
      id: "ABY-FLORAL-2",
      name: "Premium Floral Motif Abaya Set - Back",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Premium-Floral-Motif-Abaya-Set..jpeg?raw=1",
      link: "/",
      price: 1650,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1850, "Abaya Only": 1650 }
    },
    {
      id: "ABY-FLORAL-3",
      name: "Premium Floral Motif Abaya Set - Side",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Premium-Floral-Motif-Abaya-Set.jpeg?raw=1",
      link: "/",
      price: 1650,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1850, "Abaya Only": 1650 }
    },
    {
      id: "ABY-BUTTERFLY-1",
      name: "Butterfly Abaya Set",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Butterfly-Ababa....jpg?raw=1",
      link: "/",
      price: 799,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1350, "Abaya Only": 799 }
    },
    {
      id: "ABY-BUTTERFLY-2",
      name: "Butterfly Abaya Set - Back",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Butterfly-Ababa...jpg?raw=1",
      link: "/",
      price: 799,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1350, "Abaya Only": 799 }
    },
    {
      id: "ABY-BUTTERFLY-3",
      name: "Butterfly Abaya Set - Side",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Butterfly-Ababa..jpg?raw=1",
      link: "/",
      price: 799,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1350, "Abaya Only": 799 }
    },
    {
      id: "ABY-BUTTERFLY-4",
      name: "Butterfly Abaya Set - Detail",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Butterfly-Ababa.jpg?raw=1",
      link: "/",
      price: 799,
      color: "black",
      colorLabel: "Classic Black",
      fabric: "Dubai Cherry",
      sizes: ["44", "46", "48", "50", "52", "54", "56"],
      priceByType: { "Full Set": 1350, "Abaya Only": 799 }
    }
  ],

  /* ═══ ② কভার আপ — খালি (প্রোডাক্ট-এডিট.bat থেকে যোগ করুন) ═══ */
  "cover-up": [],

  /* ═══ TOPS / KURTI LIST ═══ */

"tops-kurti": [
{
  id: "KURTI-01",
  name: "Classic Purple Lace-Work Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Classic%20Purple%20Lace-Work%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "purple",
  colorLabel: "Purple",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Comfortable lace-work kurti made with premium cotton fabric. Length: 34 inches."
},
{
  id: "KURTI-02",
  name: "Elegant Grey Leaf Print Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Elegant%20Grey%20Leaf%20Print%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "grey",
  colorLabel: "Grey",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Stylish leaf print design for daily wear."
},
{
  id: "KURTI-03",
  name: "Elegant Purple Floral Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Elegant%20Purple%20Floral%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "purple",
  colorLabel: "Purple",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Floral printed kurti suitable for office and casual wear."
},
{
  id: "KURTI-04",
  name: "Elegant White Leaf Print Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Elegant%20White%20Leaf%20Print%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "white",
  colorLabel: "White",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Light and breathable cotton fabric perfect for summer."
},
{
  id: "KURTI-05",
  name: "Light Pink Floral Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Light%20Pink%20Soft%20Floral%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "pink",
  colorLabel: "Light Pink",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Soft pink floral design for everyday comfort."
},

{
  id: "KURTI-06",
  name: "Magenta Leaf Print Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Magenta%20Leaf%20Print%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "magenta",
  colorLabel: "Magenta",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Soft cotton kurti with vibrant magenta color."
},

{
  id: "KURTI-07",
  name: "Magenta Tassel Detail Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Magenta%20Tassel%20Detail%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "magenta",
  colorLabel: "Magenta",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Stylish tassel design kurti for modern look."
},

{
  id: "KURTI-08",
  name: "Pink Floral Lace Work Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Premium%20Pink%20Floral%20Lace-Work%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "pink",
  colorLabel: "Pink",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Elegant lace work floral kurti design."
},

{
  id: "KURTI-09",
  name: "Vibrant Magenta Floral Kurti",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Vibrant%20Magenta%20Floral%20Kurti%20MUSLIM%20ABAYA.WebP?raw=true",
  link: "/",
  price: 250,
  color: "magenta",
  colorLabel: "Magenta",
  fabric: "TC Cotton",
  sizes: ["38", "40"],
  detailNote: "Bright floral kurti for stylish daily wear."
},

/* ═══ FIXED DRESS ITEMS (YOU PROVIDED LINKS) ═══ */

{
  id: "KURTI-10",
  name: "Premium Yellow Tie-Dye Cotton Maxi Dress",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/premium-yellow-tie-dye-cotton-maxi-dress-for-women.webp?raw=true",
  link: "/",
  price: 350,
  color: "yellow",
  colorLabel: "Yellow",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Attractive tie-dye design maxi dress. Length: 43–44 inches, Flare: 80 inches."
},

{
  id: "KURTI-11",
  name: "Stylish Green Floral Cotton Midi Dress",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/stylish-green-floral-cotton-midi-dress-womens-fashion.webp?raw=true",
  link: "/",
  price: 350,
  color: "green",
  colorLabel: "Green",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Floral printed midi dress in soft cotton fabric."
},

{
  id: "KURTI-12",
  name: "White Cherry Print Cotton One Piece",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/white-cherry-print-cotton-one-piece-dress-for-women.webp?raw=true",
  link: "/",
  price: 350,
  color: "white",
  colorLabel: "White",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Beautiful cherry print one-piece dress."
},

{
  id: "KURTI-13",
  name: "White Lavender Floral Cotton Dress",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/white-lavender-floral-cotton-one-piece-dress-for-women-muslimabaya.webp?raw=true",
  link: "/",
  price: 350,
  color: "white",
  colorLabel: "White / Lavender",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Soft lavender floral cotton dress."
},

{
  id: "KURTI-14",
  name: "White Maroon Block Print Cotton Dress",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/white-maroon-block-print-cotton-one-piece-dress-for-women.webp?raw=true",
  link: "/",
  price: 350,
  color: "white",
  colorLabel: "White / Maroon",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Traditional block print cotton dress."
},

{
  id: "KURTI-15",
  name: "White Red Heart Print Cotton Dress",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/white-red-heart-print-cotton-one-piece-dress-for-women.webp?raw=true",
  link: "/",
  price: 350,
  color: "white",
  colorLabel: "White / Red",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Cute heart print cotton dress."
},

{
  id: "KURTI-16",
  name: "Yellow Cotton Flared One Piece",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/yellow-cotton-flared-one-piece-dress-for-women.webp?raw=true",
  link: "/",
  price: 350,
  color: "yellow",
  colorLabel: "Yellow",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Comfortable flared cotton dress."
},

{
  id: "KURTI-17",
  name: "Yellow Striped Cotton One Piece",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/yellow-striped-cotton-one-piece-dress-for-women.webp?raw=true",
  link: "/",
  price: 350,
  color: "yellow",
  colorLabel: "Yellow",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Casual striped cotton dress."
},
  {
  id: "KURTI-18",
  name: "Premium Sky Blue Botanical Print Cotton One Piece Dress",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/premium-sky-blue-botanical-print-cotton-one-piece-dress-for-women.webp?raw=true",
  link: "/",
  price: 350,
  color: "blue",
  colorLabel: "Sky Blue",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Premium sky blue botanical print cotton dress. Length: 43–44 Inches, Flare: 80 Inches"
},
  {
  id: "KURTI-19",
  name: "White Lilac Botanical Print Cotton One Piece Dress",
  image: "https://raw.githubusercontent.com/muslim-abaya-landingpage/Luxury-Dress-BD/main/images/white-lilac-botanical-print-cotton-one-piece-dress-for-women.webp",
  link: "/",
  price: 350,
  color: "white",
  colorLabel: "White / Lilac",
  fabric: "Premium Cotton Fabric",
  sizes: ["34", "36", "38", "40", "42", "44", "46"],
  detailNote: "Elegant white and lilac botanical print cotton one piece dress. Length: 43–44 Inches, Flare: 80 Inches"
}
],
/* ═══ ④ টু-পিস সারি · PREMIUM TWO-PIECE · premium-two-piece.html ═══ */
  "premium-two-piece": [
    {
      id: "DR-29",
      name: "Baby Pink Light Pink",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Baby%20PinkLight%20Pink.jpeg?raw=1",
      link: "/",
      price: 550,
      color: "pink",
      colorLabel: "Baby Pink Light Pink",
      fabric: "Alex soft Georgette",
      sizes: ["বডি ৪২ (ফ্রি সাইজ)"],
      detailNote: "লং: ৩৭-৩৮ ইঞ্চি"
    },
    {
      id: "DR-01",
      name: "Baby Pink Floral",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Baby-Pink-Floral-Print.jpeg?raw=1",
      link: "/",
      price: 550,
      color: "pink",
      colorLabel: "Baby Pink Floral",
      fabric: "Alex soft Georgette",
      sizes: ["বডি ৪২ (ফ্রি সাইজ)"],
      detailNote: "লং: ৩৭-৩৮ ইঞ্চি"
    },
    {
      id: "DR-08",
      name: "Black Base Rose Floral",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Black-Base-Rose-Floral.jpeg?raw=1",
      link: "/",
      price: 550,
      color: "black",
      colorLabel: "Black Base Rose Floral",
      fabric: "Alex soft Georgette",
      sizes: ["বডি ৪২ (ফ্রি সাইজ)"],
      detailNote: "লং: ৩৭-৩৮ ইঞ্চি"
    },
    {
      id: "DR-16",
      name: "Black White Polka",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Black-White-Polka-Dots.jpeg?raw=1",
      link: "/",
      price: 550,
      color: "black",
      colorLabel: "Black White Polka",
      fabric: "Alex soft Georgette",
      sizes: ["বডি ৪২ (ফ্রি সাইজ)"],
      detailNote: "লং: ৩৭-৩৮ ইঞ্চি"
    },
    {
      id: "DR-23",
      name: "Royal Blue Golden Floral",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Royal-Blue-Golden-Floral-Print.jpeg?raw=1",
      link: "/",
      price: 550,
      color: "blue",
      colorLabel: "Royal Blue Golden Floral",
      fabric: "Alex soft Georgette",
      sizes: ["বডি ৪২ (ফ্রি সাইজ)"],
      detailNote: "লং: ৩৭-৩৮ ইঞ্চি"
    },
    {
      id: "DR-30",
      name: "Sage Green Mint Green",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Sage%20GreenMint%20Green.jpeg?raw=1",
      link: "/",
      price: 550,
      color: "green",
      colorLabel: "Sage Green Mint Green",
      fabric: "Alex soft Georgette",
      sizes: ["বডি ৪২ (ফ্রি সাইজ)"],
      detailNote: "লং: ৩৭-৩৮ ইঞ্চি"
    },
  {
  id: "DR-32",
  name: "Premium White Pink Floral Print Women's Co-ord Set",
  image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/white-pink-floral-print-womens-co-ord-set-premium.webp?raw=1",
  link: "/",
  price: 650,
  color: "pink",
  colorLabel: "White & Pink",
  fabric: "Alex Soft Georgette",
  sizes: ["Body 42 (Free Size)"],
  detailNote: "Length: 37–38 Inches"
},
  {
      id: "DR-31",
      name: "Black Floral Georgette Set",
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/black-floral-georgette-two-piece-set-bangladesh.jpg?raw=1",
      link: "/",
      price: 650,
      color: "black",
      colorLabel: "Black Floral",
      fabric: "Premium Soft Georgette",
      sizes: ["বডি ৪২ (ফ্রি সাইজ)"],
      detailNote: "লং: ৩৭-৩৮ ইঞ্চি"
    }
  ],

  /* ═══ ⑤ এম্ব্রয়ডারি — খালি ═══ */
  embroidery: [],

  /* ═══ ⑥ কারচুপি — খালি ═══ */
  karchupi: [],

  /* ═══ ⑦ কাফতান — খালি ═══ */
  kaftan: [],

  /* ═══ ⑧ হিজাব — খালি ═══ */
  hijab: []
};

window.SITE_MEDIA = {
  whatsappOrderLink:
    (window.SITE_LINKS && window.SITE_LINKS.order && window.SITE_LINKS.order.whatsapp) ||
    "https://wa.me/8801971642683",
  /**
   * VIDEO পেজ — নতুন ভিডিও: videos[] তে এক লাইন যোগ করুন।
   * url = YouTube লিংক অথবা videoId = শুধু ID। পেজে ৩টি করে সারি (লেয়ার) বানাবে।
   */
  featuredVideo: {
    title: "ভিডিও কালেকশন",
    helpText: "রিয়েল ভিডিও দেখে প্রোডাক্টের কোয়ালিটি যাচাই করুন, তারপর অর্ডার করুন।",
    videos: [
      { title: "কালেকশন ভিডিও ১", url: "https://www.youtube.com/watch?v=Wyrw0gzKMqk" }
      // { title: "কালেকশন ভিডিও ২", url: "https://youtu.be/XXXXXXXXXXX" },
      // { title: "কালেকশন ভিডিও ৩", videoId: "XXXXXXXXXXX" },
    ]
  }
};

window.CATEGORY_META = {
  abaya: { title: "ABAYA" },
  "cover-up": { title: "COVER UP" },
  "tops-kurti": { title: "TOPS/KURTI" },
  "premium-two-piece": { title: "PREMIUM TWO-PIECE" },
  embroidery: { title: "EMBROIDERY" },
  karchupi: { title: "KARCHUPI" },
  kaftan: { title: "KAFTAN" },
  hijab: { title: "HIJAB" }
};

/** Shared nav + hub tiles (anzaar-style All Categories page) */
window.CATEGORY_NAV = [
  { key: "abaya", href: "/abaya", label: "ABAYA", image: "images/Baby-Pink-Floral-Print.jpeg" },
  { key: "cover-up", href: "/cover-up", label: "COVER UP", image: "images/Royal-Blue-Golden-Floral-Print.jpeg" },
  { key: "kaftan", href: "/kaftan", label: "KAFTAN", image: "images/Baby-Pink-Floral-Print.jpeg" },
  { key: "tops-kurti", href: "/tops-kurti", label: "TOPS/ KURTI", image: "images/Black-White-Polka-Dots.jpeg" },
  { key: "hijab", href: "/hijab", label: "HIJAB", image: "images/Black-White-Polka-Dots.jpeg" },
  { key: "premium-two-piece", href: "/premium-two-piece", label: "PREMIUM TWO-PIECE", image: "images/pink-floral-printed-co-ord-set.jpeg" },
  { key: "embroidery", href: "/embroidery", label: "EMBROIDERY", image: "images/Black-Base-Rose-Floral.jpeg" },
  { key: "karchupi", href: "/karchupi", label: "KARCHUPI", image: "images/Black-Base-Rose-Floral.jpeg" },
  { key: "video", href: "/video", label: "VIDEO", image: "images/Royal-Blue-Golden-Floral-Print.jpeg" }
];

/** Display names for product `color` keys — new colors auto-appear in filters when added to products. */
window.FILTER_COLOR_MAP = {
  all: { label: "All Colors", hex: "transparent" },
  maroon: { label: "Maroon", hex: "#7a2348" },
  black: { label: "Classic Black", hex: "#111111" },
  white: { label: "Soft White", hex: "#f5f5f5" },
  pink: { label: "Rose Pink", hex: "#f4b4c4" },
  blue: { label: "Royal Blue", hex: "#4a6fa5" },
  green: { label: "Olive Green", hex: "#6b8f71" },
  yellow: { label: "Yellow", hex: "#FFD54F" },
  red: { label: "Red", hex: "#E53935" },
  lavender: { label: "Lavender", hex: "#B39DDB" },
  beige: { label: "Copper Beige", hex: "#d4c4a8" }
};

/** Shared product search — used by header search + category pages */
(function (g) {
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTerms(q) {
    return normalize(q).split(" ").filter(Boolean);
  }

  function matchesAll(haystack, terms) {
    if (!terms.length) return true;
    var h = normalize(haystack);
    return terms.every(function (term) {
      return h.indexOf(term) !== -1;
    });
  }

  function categoryHaystack(key, meta) {
    var m = (meta && meta[key]) || {};
    var nav = g.CATEGORY_NAV || [];
    var navItem = nav.find(function (n) {
      return n.key === key;
    });
    return [key, m.title || "", m.label || "", navItem && navItem.label ? navItem.label : ""].join(" ");
  }

  function productHaystack(p, key, meta) {
    return [
      p.name,
      p.colorLabel,
      p.color,
      p.fabric,
      p.description,
      p.id,
      p.detailNote,
      categoryHaystack(key, meta)
    ].join(" ");
  }

  function collectProducts(allProducts, query, meta) {
    var terms = getTerms(query);
    if (!terms.length) return [];
    var list = [];
    Object.keys(allProducts || {}).forEach(function (key) {
      var catProducts = allProducts[key] || [];
      var categoryHit = matchesAll(categoryHaystack(key, meta), terms);
      catProducts.forEach(function (p) {
        if (!p) return;
        if (categoryHit || matchesAll(productHaystack(p, key, meta), terms)) {
          list.push(p);
        }
      });
    });
    return list;
  }

  /** Search within one category only (abaya page → abaya products only). */
  function collectProductsInCategory(allProducts, categoryKey, query, meta) {
    var terms = getTerms(query);
    var list = (allProducts && allProducts[categoryKey]) ? allProducts[categoryKey].slice() : [];
    if (!terms.length) return list;
    if (matchesAll(categoryHaystack(categoryKey, meta), terms)) return list;
    return list.filter(function (p) {
      return p && matchesAll(productHaystack(p, categoryKey, meta), terms);
    });
  }

  function pickRedirectHref(query, nav, meta, allProducts) {
    var terms = getTerms(query);
    if (!terms.length) return "/category";
    var hrefByKey = {};
    (nav || []).forEach(function (n) {
      if (n.key) hrefByKey[n.key] = n.href || "/abaya";
    });
    var bestKey = null;
    var bestScore = -1;
    Object.keys(allProducts || {}).forEach(function (key) {
      var score = 0;
      if (matchesAll(categoryHaystack(key, meta), terms)) score += 100;
      (allProducts[key] || []).forEach(function (p) {
        if (matchesAll(productHaystack(p, key, meta), terms)) score += 1;
      });
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    });
    if (bestKey && hrefByKey[bestKey]) return hrefByKey[bestKey];
    return "/category";
  }

  g.maSearch = {
    getTerms: getTerms,
    matchesAll: matchesAll,
    collectProducts: collectProducts,
    collectProductsInCategory: collectProductsInCategory,
    pickRedirectHref: pickRedirectHref,
    categoryMatches: function (key, meta, query) {
      return matchesAll(categoryHaystack(key, meta), getTerms(query));
    },
    productMatches: function (p, key, meta, query) {
      return matchesAll(productHaystack(p, key, meta), getTerms(query));
    }
  };
})(window);
