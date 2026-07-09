import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Filter,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  Check,
  MapPin,
  Phone,
  User,
  Trash2,
  ArrowRight,
  Sparkles,
  Info,
  Maximize2
} from "lucide-react";
import { CATEGORIES, PRODUCTS, Product, Category } from "./data/products";

export default function App() {
  // Navigation & Category states
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 3000]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<string>("default");

  // Cart state
  const [cart, setCart] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("muslim_abaya_cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // UI state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [showSizeChartModal, setShowSizeChartModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false
  });

  // Checkout states
  const [deliveryArea, setDeliveryArea] = useState<"inside" | "outside">("inside");
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  // Quick View states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quickViewImageIdx, setQuickViewImageIdx] = useState(0);
  const [quickViewSize, setQuickViewSize] = useState("");
  const [quickViewType, setQuickViewType] = useState("");
  const [quickViewQty, setQuickViewQty] = useState(1);
  const [quickViewTab, setQuickViewTab] = useState<"desc" | "spec">("desc");

  // Wholesale multiple-sizes quantity state
  const [wholesaleQuantities, setWholesaleQuantities] = useState<Record<string, number>>({});
  const [isWholesaleOpen, setIsWholesaleOpen] = useState(false);

  // Hero Slider State (cycles through features)
  const [heroSlideIdx, setHeroSlideIdx] = useState(0);
  const heroSlides = [
    {
      title: "Elegant & Pure Modest Fashion",
      subtitle: "প্রিমিয়াম দুবাই চেরি ও নিদা সিল্ক কাপড়ের আকর্ষণীয় আবায়া সংগ্রহ",
      bg: "bg-stone-100",
      accent: "থেকে শুরু ৳১,১০০"
    },
    {
      title: "Authentic Dubai Quality",
      subtitle: "কুচকুচে কালার গ্যারান্টি, রাজকীয় ফিনিশ এবং নিখুঁত দীর্ঘস্থায়ী সেলাই",
      bg: "bg-amber-50",
      accent: "হ্যান্ড এমব্রয়ডারি স্পেশাল"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlideIdx((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem("muslim_abaya_cart", JSON.stringify(cart));
  }, [cart]);

  // Show Toast helper
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  // WhatsApp WhatsApp Order Link
  const waBaseLink = "https://wa.me/8801970831783";

  // Compute color options dynamically based on products
  const colorOptions = useMemo(() => {
    const map: Record<string, string> = {};
    PRODUCTS.forEach((p) => {
      if (p.color && p.colorLabel) {
        map[p.color] = p.colorLabel;
      }
    });
    return Object.entries(map).map(([key, label]) => ({ key, label }));
  }, []);

  // Filter & Sort logic
  const filteredProducts = useMemo(() => {
    let result = [...PRODUCTS];

    // Category Filter
    if (selectedCategory !== "all") {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Search Filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.fabric.toLowerCase().includes(q) ||
          p.colorLabel.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }

    // Price Filter
    result = result.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Color Filter
    if (selectedColors.length > 0) {
      result = result.filter((p) => selectedColors.includes(p.color));
    }

    // Sort Mode
    if (sortMode === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortMode === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortMode === "name-asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [selectedCategory, searchQuery, priceRange, selectedColors, sortMode]);

  // Pricing helper
  const getProductPrice = (product: Product, type?: string) => {
    if (product.priceByType && type && product.priceByType[type] !== undefined) {
      return product.priceByType[type];
    }
    return product.price;
  };

  // Add single item to cart
  const handleAddToCart = (product: Product, size: string, type: string, qty: number) => {
    const finalSize = size || (product.sizes.length > 0 ? product.sizes[0] : "Free Size");
    const finalType = type || (product.types && product.types.length > 0 ? product.types[0] : "");
    const price = getProductPrice(product, finalType);

    // Unique cart id by ID + Size + Type
    const cartItemId = `${product.id}-${finalSize}-${finalType}`;

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.id === cartItemId);
      if (existingIdx > -1) {
        const updated = [...prevCart];
        updated[existingIdx].quantity += qty;
        return updated;
      } else {
        return [
          ...prevCart,
          {
            id: cartItemId,
            productId: product.id,
            name: product.name,
            price: price,
            quantity: qty,
            image: product.images[0],
            size: finalSize,
            type: finalType,
            category: product.category,
            fabric: product.fabric
          }
        ];
      }
    });

    showToast(`🛒 "${product.name}" (${finalSize}${finalType ? ` - ${finalType}` : ""}) কার্টে যুক্ত করা হয়েছে!`);
  };

  // Add multiple wholesale sizes to cart
  const handleAddWholesaleToCart = (product: Product, type: string) => {
    const finalType = type || (product.types && product.types.length > 0 ? product.types[0] : "");
    const price = getProductPrice(product, finalType);

    const linesToAdd: any[] = [];
    let totalPiecesAdded = 0;

    Object.entries(wholesaleQuantities).forEach(([size, qty]) => {
      const q = qty as number;
      if (q > 0) {
        const cartItemId = `${product.id}-${size}-${finalType}`;
        linesToAdd.push({
          id: cartItemId,
          productId: product.id,
          name: product.name,
          price: price,
          quantity: q,
          image: product.images[0],
          size: size,
          type: finalType,
          category: product.category,
          fabric: product.fabric
        });
        totalPiecesAdded += q;
      }
    });

    if (linesToAdd.length === 0) {
      alert("অনুগ্রহ করে অন্তত ১টি সাইজের জন্য পরিমাণ সেট করুন।");
      return;
    }

    setCart((prevCart) => {
      let updated = [...prevCart];
      linesToAdd.forEach((line) => {
        const existingIdx = updated.findIndex((item) => item.id === line.id);
        if (existingIdx > -1) {
          updated[existingIdx].quantity += line.quantity;
        } else {
          updated.push(line);
        }
      });
      return updated;
    });

    // Reset wholesale quantities
    setWholesaleQuantities({});
    setIsWholesaleOpen(false);
    showToast(`🛒 পাইকারি অর্ডারে মোট ${totalPiecesAdded} পিস কার্টে যুক্ত হয়েছে!`);
  };

  // Cart action helpers
  const handleUpdateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Cart calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const deliveryCharge = deliveryArea === "inside" ? 80 : 150;
  const cartTotal = cartSubtotal + (cartSubtotal > 0 ? deliveryCharge : 0);

  // Set selected product and pre-fill fields
  const handleOpenQuickView = (product: Product) => {
    setSelectedProduct(product);
    setQuickViewImageIdx(0);
    setQuickViewSize(product.sizes.length > 0 ? product.sizes[0] : "Free Size");
    setQuickViewType(product.types && product.types.length > 0 ? product.types[0] : "");
    setQuickViewQty(1);
    setWholesaleQuantities({});
    setIsWholesaleOpen(false);
    setQuickViewTab("desc");
  };

  // Handle direct Buy Now inside shop/detail
  const handleBuyNow = (product: Product, size: string, type: string, qty: number) => {
    const finalSize = size || (product.sizes.length > 0 ? product.sizes[0] : "Free Size");
    const finalType = type || (product.types && product.types.length > 0 ? product.types[0] : "");
    const price = getProductPrice(product, finalType);

    const cartItemId = `${product.id}-${finalSize}-${finalType}`;

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.id === cartItemId);
      if (existingIdx > -1) {
        const updated = [...prevCart];
        updated[existingIdx].quantity = Math.max(updated[existingIdx].quantity, qty);
        return updated;
      } else {
        return [
          ...prevCart,
          {
            id: cartItemId,
            productId: product.id,
            name: product.name,
            price: price,
            quantity: qty,
            image: product.images[0],
            size: finalSize,
            type: finalType,
            category: product.category,
            fabric: product.fabric
          }
        ];
      }
    });

    setSelectedProduct(null);
    setIsCartOpen(true);
  };

  // Submit checkout order
  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("আপনার কার্ট বর্তমানে খালি আছে।");
      return;
    }
    if (!checkoutName.trim()) {
      alert("অনুগ্রহ করে আপনার নাম লিখুন।");
      return;
    }
    if (!checkoutPhone.trim()) {
      alert("অনুগ্রহ করে আপনার মোবাইল নাম্বারটি দিন।");
      return;
    }
    if (!checkoutAddress.trim()) {
      alert("অনুগ্রহ করে সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন।");
      return;
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      orderId,
      name: checkoutName,
      phone: checkoutPhone,
      address: checkoutAddress,
      area: deliveryArea === "inside" ? "Dhaka Inside" : "Dhaka Outside",
      items: [...cart],
      subtotal: cartSubtotal,
      delivery: deliveryCharge,
      total: cartTotal,
      date: new Date().toLocaleDateString("bn-BD")
    };

    setOrderSuccess(newOrder);

    // Build perfect WhatsApp checkout message
    let messageText = `*নতুন আবায়া অর্ডার রিকোয়েস্ট (ID: ${orderId})*\n\n`;
    messageText += `👤 *গ্রাহকের নাম:* ${checkoutName}\n`;
    messageText += `📞 *মোবাইল:* ${checkoutPhone}\n`;
    messageText += `📍 *ঠিকানা:* ${checkoutAddress}\n`;
    messageText += `🚚 *ডেলিভারি এরিয়া:* ${deliveryArea === "inside" ? "ঢাকার ভেতরে" : "ঢাকার বাইরে"}\n\n`;
    messageText += `🛍️ *পণ্য তালিকা:*\n`;

    cart.forEach((item, index) => {
      messageText += `${index + 1}. ${item.name} [সাইজ: ${item.size}${item.type ? `, টাইপ: ${item.type}` : ""}] x ${item.quantity} পিস - ৳${item.price * item.quantity}\n`;
    });

    messageText += `\n💵 *মোট সাবটোটাল:* ৳${cartSubtotal}\n`;
    messageText += `🚚 *ডেলিভারি চার্জ:* ৳${deliveryCharge}\n`;
    messageText += `💰 *সর্বমোট বিল:* ৳${cartTotal}\n\n`;
    messageText += `ধন্যবাদ! অনুগ্রহ করে অর্ডারটি কনফার্ম করুন।`;

    const waLink = `${waBaseLink}?text=${encodeURIComponent(messageText)}`;
    
    // Save order data
    localStorage.setItem("latest_abaya_order", JSON.stringify(newOrder));
    
    // Clear cart
    setCart([]);
    setCheckoutName("");
    setCheckoutPhone("");
    setCheckoutAddress("");

    // Auto open WhatsApp
    window.open(waLink, "_blank");
  };

  // Image zoom effect coordinates
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});
  const [isZooming, setIsZooming] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomStyle({
      transformOrigin: `${x}% ${y}%`,
      transform: "scale(2.2)"
    });
    setIsZooming(true);
  };

  const handleMouseLeave = () => {
    setZoomStyle({});
    setIsZooming(false);
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* Dynamic Toast System */}
      {toast.visible && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-fade-in bg-stone-900 text-stone-100 px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 border border-stone-800">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Banner Notice */}
      <div className="bg-[#1c1917] text-[#c5a880] text-center py-2 px-4 text-xs tracking-wider uppercase font-medium flex items-center justify-center gap-2">
        <span>✨ সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা ✨</span>
        <span className="hidden sm:inline">|</span>
        <span className="hidden sm:inline">অর্ডার করতে কল বা হোয়াটসঅ্যাপ করুন: ০১৯৭০৮৩১৭৮৩</span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}>
            <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-[#c5a880] font-bold text-lg shadow-sm">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900 font-display">
                ANZAAR <span className="text-[#c5a880] font-normal font-sans text-sm tracking-widest uppercase ml-1 block sm:inline">Premium Modest Wear</span>
              </h1>
              <p className="text-[10px] text-stone-400 font-medium tracking-wide uppercase">Elite Elegance & Grace</p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4.5 w-4.5 text-stone-400" />
            </span>
            <input
              type="text"
              placeholder="আবায়া, কুর্তি বা কালার দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-full text-sm focus:outline-hidden focus:ring-2 focus:ring-[#c5a880]/30 focus:border-[#c5a880] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Cart Trigger */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-stone-50 hover:bg-stone-100 rounded-full transition-colors flex items-center justify-center group"
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-5.5 h-5.5 text-stone-800 group-hover:scale-105 transition-transform" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Category Horizontal Quick Bar */}
      <div className="bg-white border-b border-stone-100 overflow-x-auto scrollbar-none sticky top-[73px] z-20">
        <div className="max-w-7xl mx-auto px-4 flex gap-2 py-3 shrink-0">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === "all"
                ? "bg-stone-900 text-stone-100 shadow-xs"
                : "bg-stone-50 text-stone-600 hover:bg-stone-100"
            }`}
          >
            All Products (সব পণ্য)
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.key
                  ? "bg-stone-900 text-stone-100 shadow-xs"
                  : "bg-stone-50 text-stone-600 hover:bg-stone-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Order Success Screen */}
        {orderSuccess && (
          <div className="mb-8 bg-emerald-50 border border-emerald-100 rounded-2xl p-6 sm:p-8 animate-fade-in text-center max-w-2xl mx-auto relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/30 rounded-full blur-2xl"></div>
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-200">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900">আপনার অর্ডারটি সফলভাবে সাবমিট হয়েছে!</h2>
            <p className="text-emerald-700 text-sm mt-1 font-semibold">অর্ডার আইডি: #{orderSuccess.orderId}</p>
            <p className="text-stone-600 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              আমরা আপনার তথ্য পেয়েছি। অনুগ্রহ করে নিশ্চিত করুন যে হোয়াটসঅ্যাপে অর্ডার ডিটেইলস পাঠানো হয়েছে। আমরা খুব শীঘ্রই আপনার সাথে যোগাযোগ করব।
            </p>

            <div className="mt-6 bg-white rounded-xl p-4 border border-stone-100 text-left text-sm max-w-md mx-auto space-y-2">
              <p>👤 <strong>গ্রাহক:</strong> {orderSuccess.name}</p>
              <p>📞 <strong>মোবাইল:</strong> {orderSuccess.phone}</p>
              <p>📍 <strong>ঠিকানা:</strong> {orderSuccess.address}</p>
              <p>💰 <strong>সর্বমোট বিল:</strong> <span className="font-bold text-stone-900">৳{orderSuccess.total}</span> (ক্যাশ অন ডেলিভারি)</p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`${waBaseLink}?text=${encodeURIComponent(
                  `হ্যালো, আমি অর্ডারটি কনফার্ম করতে চাই। আইডি: #${orderSuccess.orderId}`
                )}`}
                target="_blank"
                rel="noopener"
                className="w-full sm:w-auto bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm px-6 py-3 rounded-full shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>WhatsApp কনফার্ম করুন</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={() => setOrderSuccess(null)}
                className="w-full sm:w-auto bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-sm px-6 py-3 rounded-full transition-all"
              >
                নতুন করে শপিং করুন
              </button>
            </div>
          </div>
        )}

        {/* Hero Section Banner when looking at all or home */}
        {selectedCategory === "all" && !searchQuery && !orderSuccess && (
          <div className={`mb-8 ${heroSlides[heroSlideIdx].bg} rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden transition-all duration-700 shadow-xs border border-stone-200/40`}>
            {/* Visual Decorative circles */}
            <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-stone-900/5 blur-xl"></div>
            <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-amber-200/20 blur-2xl"></div>

            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-900 text-[#c5a880] text-[10px] font-bold tracking-widest uppercase rounded-full mb-4">
                <Sparkles className="w-3.5 h-3.5 fill-[#c5a880]" /> COLLECTION 2026
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight leading-tight font-display">
                {heroSlides[heroSlideIdx].title}
              </h2>
              <p className="text-stone-600 text-sm sm:text-base mt-2.5 max-w-lg leading-relaxed">
                {heroSlides[heroSlideIdx].subtitle}
              </p>
              <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    const abayaEl = document.getElementById("abaya-anchor");
                    abayaEl?.scrollIntoView({ behavior: "smooth" });
                    setSelectedCategory("abaya");
                  }}
                  className="bg-stone-900 text-stone-50 hover:bg-stone-800 text-xs font-semibold tracking-wider uppercase px-5 py-3 rounded-full shadow-md transition-all"
                >
                  Shop Now (শপ করুন)
                </button>
                <span className="text-stone-500 font-mono text-xs font-medium px-3 py-2 bg-white/60 border border-stone-200 rounded-full shadow-xs">
                  {heroSlides[heroSlideIdx].accent}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Grid and Sidebar Container */}
        <div className="lg:grid lg:grid-cols-4 lg:gap-8 items-start">
          
          {/* Left Sidebar Filter Section (Desktop) */}
          <aside className="hidden lg:block lg:col-span-1 bg-white border border-stone-150 p-6 rounded-2xl sticky top-[140px] shadow-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 mb-5 pb-2 border-b border-stone-100 flex items-center gap-2">
              <Filter className="w-4 h-4 text-stone-500" />
              <span>পণ্য ফিল্টার করুন</span>
            </h3>

            {/* Category selection */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Categories</h4>
              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    selectedCategory === "all"
                      ? "bg-stone-100 text-stone-900 font-semibold"
                      : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <span>All Products</span>
                  <span className="text-[10px] bg-stone-200/60 px-1.5 py-0.5 rounded-full font-mono">
                    {PRODUCTS.length}
                  </span>
                </button>
                {CATEGORIES.map((cat) => {
                  const count = PRODUCTS.filter((p) => p.category === cat.key).length;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        selectedCategory === cat.key
                          ? "bg-stone-100 text-stone-900 font-semibold"
                          : "text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className="text-[10px] bg-stone-200/60 px-1.5 py-0.5 rounded-full font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Price Filter range */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Price Range (বাজেট)</h4>
              <div className="space-y-4">
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="50"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full accent-stone-900 cursor-pointer h-1 bg-stone-200 rounded-lg appearance-none"
                />
                <div className="flex justify-between items-center text-xs text-stone-500 font-mono">
                  <span>৳{priceRange[0]}</span>
                  <span>Max: ৳{priceRange[1]}</span>
                </div>
              </div>
            </div>

            {/* Color Filters */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Color (রং)</h4>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => {
                  const isChecked = selectedColors.includes(color.key);
                  return (
                    <button
                      key={color.key}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedColors(selectedColors.filter((c) => c !== color.key));
                        } else {
                          setSelectedColors([...selectedColors, color.key]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border flex items-center gap-1.5 ${
                        isChecked
                          ? "bg-stone-900 text-stone-50 border-stone-900"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-stone-300"
                        style={{
                          backgroundColor:
                            color.key === "maroon"
                              ? "#800000"
                              : color.key === "black"
                              ? "#000000"
                              : color.key === "emerald"
                              ? "#046307"
                              : color.key === "blue"
                              ? "#00008b"
                              : color.key === "pink"
                              ? "#ffc0cb"
                              : color.key === "rose-gold"
                              ? "#b76e79"
                              : "#e2e8f0"
                        }}
                      ></span>
                      {color.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset Button */}
            {(priceRange[1] !== 3000 || selectedColors.length > 0 || searchQuery) && (
              <button
                onClick={() => {
                  setPriceRange([0, 3000]);
                  setSelectedColors([]);
                  setSearchQuery("");
                }}
                className="w-full py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-lg border border-stone-200 transition-colors"
              >
                Clear All Filters (ফিল্টার মুছুন)
              </button>
            )}
          </aside>

          {/* Right Product Grid Column */}
          <section className="lg:col-span-3">
            
            {/* Header / Active tags / Sort Toolbar */}
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 border border-stone-150 rounded-2xl shadow-xs">
              <div>
                <h3 className="text-base font-bold text-stone-950 flex items-center gap-2">
                  <span>
                    {selectedCategory === "all"
                      ? "All Premium Collections"
                      : CATEGORIES.find((c) => c.key === selectedCategory)?.label}
                  </span>
                  <span className="text-xs font-mono font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                    {filteredProducts.length} items
                  </span>
                </h3>
                {selectedCategory !== "all" && (
                  <p className="text-xs text-stone-500 mt-0.5">
                    {CATEGORIES.find((c) => c.key === selectedCategory)?.description}
                  </p>
                )}
              </div>

              {/* Mobile Filter Trigger & Sort dropdown */}
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="lg:hidden flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-lg transition-colors"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                </button>

                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="flex-1 sm:flex-initial bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                >
                  <option value="default">Default Sort (সাধারণ)</option>
                  <option value="price-asc">Price: Low to High (কম দাম)</option>
                  <option value="price-desc">Price: High to Low (বেশি দাম)</option>
                  <option value="name-asc">Name: A-Z (নামানুসারে)</option>
                </select>
              </div>
            </div>

            {/* Empty Products Message */}
            {filteredProducts.length === 0 && (
              <div className="text-center py-16 bg-white border border-stone-150 rounded-3xl p-6">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="w-6 h-6 text-stone-400" />
                </div>
                <h4 className="text-lg font-bold text-stone-800">কোনো পণ্য পাওয়া যায়নি!</h4>
                <p className="text-sm text-stone-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  আপনার নির্বাচিত ফিল্টার বা সার্চ কিওয়ার্ডের সাথে মেলে এমন কোনো পণ্য বর্তমানে নেই। অনুগ্রহ করে অন্য কিওয়ার্ড দিয়ে চেষ্টা করুন।
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory("all");
                    setPriceRange([0, 3000]);
                    setSelectedColors([]);
                    setSearchQuery("");
                  }}
                  className="mt-5 bg-stone-900 hover:bg-stone-800 text-stone-50 px-5 py-2 rounded-full text-xs font-semibold shadow-xs"
                >
                  সব পণ্য ফিরে দেখুন
                </button>
              </div>
            )}

            {/* Products Grid */}
            <div id="abaya-anchor" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((p) => {
                const inCart = cart.some((item) => item.productId === p.id);
                const currentCartQty = cart
                  .filter((item) => item.productId === p.id)
                  .reduce((sum, item) => sum + item.quantity, 0);

                return (
                  <article
                    key={p.id}
                    className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col group ${
                      inCart ? "border-amber-400 shadow-sm shadow-amber-50/50" : "border-stone-150 hover:shadow-lg hover:shadow-stone-100 hover:border-stone-300"
                    }`}
                  >
                    {/* Card Images Stack */}
                    <div className="relative aspect-4/5 overflow-hidden bg-stone-100 group-hover:scale-[1.01] transition-transform duration-300">
                      
                      {/* Sale Badge */}
                      <span className="absolute top-3 left-3 bg-[#800000] text-white text-[10px] font-bold px-2.5 py-1 tracking-wider uppercase rounded-full shadow-xs z-10">
                        Sale
                      </span>

                      {/* Primary and Hover Image */}
                      <div className="w-full h-full relative cursor-pointer" onClick={() => handleOpenQuickView(p)}>
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                        {p.images[1] && (
                          <img
                            src={p.images[1]}
                            alt={`${p.name} Hover`}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover object-top opacity-0 hover:opacity-100 transition-opacity duration-500"
                          />
                        )}
                      </div>

                      {/* Quick Maximize button */}
                      <button
                        onClick={() => handleOpenQuickView(p)}
                        className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs p-2.5 rounded-full shadow-md hover:bg-stone-900 hover:text-white transition-all scale-90 group-hover:scale-100 opacity-0 group-hover:opacity-100"
                        title="Quick View"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Card Body Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Fabric Badge */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider font-mono">
                            {p.fabric.split("(")[0].trim()}
                          </span>
                          {p.colorLabel && (
                            <>
                              <span className="text-stone-300 text-xs">•</span>
                              <span className="text-[10px] font-semibold text-stone-500 bg-stone-50 px-2 py-0.5 rounded-full border border-stone-100">
                                {p.colorLabel}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Title */}
                        <h4
                          onClick={() => handleOpenQuickView(p)}
                          className="font-semibold text-sm text-stone-900 group-hover:text-amber-700 tracking-tight cursor-pointer line-clamp-1 transition-colors"
                        >
                          {p.name}
                        </h4>

                        {/* Pricing */}
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-base font-bold text-stone-950 font-mono">
                            ৳{p.price}
                          </span>
                          {p.types && p.types.length > 1 && (
                            <span className="text-[10px] text-stone-400">
                              (টাইপ অনুযায়ী পরিবর্তিত)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col gap-2">
                        {inCart ? (
                          <div className="flex items-center gap-1 bg-amber-50/50 p-1 border border-amber-200 rounded-xl">
                            <button
                              onClick={() => {
                                // Find any item in cart matching product and remove/reduce
                                const matched = cart.find((item) => item.productId === p.id);
                                if (matched) handleUpdateCartQty(matched.id, -1);
                              }}
                              className="w-8 h-8 rounded-lg bg-white border border-amber-200 hover:bg-amber-100 text-amber-900 flex items-center justify-center transition-all"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="flex-1 text-center text-xs font-extrabold text-amber-950 font-mono">
                              {currentCartQty} পিস কার্টে আছে
                            </span>
                            <button
                              onClick={() => {
                                const matched = cart.find((item) => item.productId === p.id);
                                if (matched) handleUpdateCartQty(matched.id, 1);
                              }}
                              className="w-8 h-8 rounded-lg bg-white border border-amber-200 hover:bg-amber-100 text-amber-900 flex items-center justify-center transition-all"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(p, p.sizes[0] || "Free Size", p.types?.[0] || "", 1)}
                            className="w-full bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold text-xs py-2.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 text-[#c5a880]" />
                            <span>Add to Cart (কার্টে যোগ করুন)</span>
                          </button>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleOpenQuickView(p)}
                            className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-semibold text-xs py-2 rounded-xl transition-colors text-center"
                          >
                            বিস্তারিত দেখুন
                          </button>
                          <a
                            href={`${waBaseLink}?text=${encodeURIComponent(
                              `আসসালামু আলাইকুম, আমি এই প্রোডাক্টটি অর্ডার করতে আগ্রহী: ${p.name} (ID: ${p.id})`
                            )}`}
                            target="_blank"
                            rel="noopener"
                            className="bg-[#25D366] hover:bg-[#20ba56] text-white font-bold text-xs py-2 rounded-xl transition-colors text-center flex items-center justify-center gap-1"
                          >
                            WhatsApp মেসেজ
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* Product Detailed Quick View Modal overlay */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative animate-fade-in border border-stone-100">
            {/* Float Close button */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 z-10 bg-stone-900 text-white hover:bg-amber-500 p-2 rounded-full transition-all shadow-md cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8 lg:p-10">
              <div className="md:grid md:grid-cols-12 md:gap-8 items-start">
                
                {/* Left Side: Images column */}
                <div className="md:col-span-6 space-y-4">
                  {/* Main Zoom Stage */}
                  <div
                    className="zoom-stage aspect-4/5 rounded-2xl bg-stone-50 border border-stone-150 relative group"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    <img
                      src={selectedProduct.images[quickViewImageIdx]}
                      alt={selectedProduct.name}
                      style={zoomStyle}
                      className="w-full h-full object-cover object-top rounded-2xl"
                    />
                    
                    {/* Gallery Navigation arrows */}
                    {selectedProduct.images.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickViewImageIdx(
                              (prev) =>
                                (prev - 1 + selectedProduct.images.length) %
                                selectedProduct.images.length
                            );
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-xs text-stone-800 p-2 rounded-full shadow-md hover:bg-stone-900 hover:text-white transition-all cursor-pointer opacity-90"
                        >
                          <ChevronLeft className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickViewImageIdx(
                              (prev) => (prev + 1) % selectedProduct.images.length
                            );
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-xs text-stone-800 p-2 rounded-full shadow-md hover:bg-stone-900 hover:text-white transition-all cursor-pointer opacity-90"
                        >
                          <ChevronRight className="w-4.5 h-4.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Thumbnail slider */}
                  {selectedProduct.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto py-1">
                      {selectedProduct.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setQuickViewImageIdx(i)}
                          className={`w-16 h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                            quickViewImageIdx === i ? "border-amber-500 scale-95" : "border-stone-200"
                          }`}
                        >
                          <img src={img} alt="Thumb" className="w-full h-full object-cover object-top" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Side: Product properties details */}
                <div className="md:col-span-6 mt-6 md:mt-0 flex flex-col justify-between">
                  <div>
                    {/* SKU Code */}
                    <span className="font-mono text-[10px] text-stone-400 uppercase font-semibold">
                      SKU: {selectedProduct.id}
                    </span>

                    {/* Title */}
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 mt-1 font-display">
                      {selectedProduct.name}
                    </h2>

                    {/* Price and Category Tag */}
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-stone-950 font-mono">
                          ৳{getProductPrice(selectedProduct, quickViewType)}
                        </span>
                        {selectedProduct.priceByType && (
                          <span className="text-xs text-stone-500 font-medium">
                            (টাইপ অনুযায়ী মূল্য)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-[#c5a880] uppercase tracking-wider bg-stone-900 px-2.5 py-1 rounded-full">
                        {selectedProduct.category}
                      </span>
                    </div>

                    {/* Short Info note */}
                    {selectedProduct.shortNote && (
                      <p className="text-amber-800 bg-amber-50/70 text-xs px-3 py-2 rounded-lg mt-3 border border-amber-100 font-medium">
                        {selectedProduct.shortNote}
                      </p>
                    )}

                    {/* Types Pill Choices */}
                    {selectedProduct.types && selectedProduct.types.length > 1 && (
                      <div className="mt-5">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block mb-2">
                          Select Variant Type (ধরণ নির্বাচন)
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {selectedProduct.types.map((type) => (
                            <button
                              key={type}
                              onClick={() => setQuickViewType(type)}
                              className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all ${
                                quickViewType === type
                                  ? "bg-stone-900 text-stone-50 border-stone-900 shadow-sm"
                                  : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                              }`}
                            >
                              {type} - ৳{getProductPrice(selectedProduct, type)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Size Selector options */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                          Select Size (সাইজ নির্বাচন)
                        </span>
                        <button
                          onClick={() => setShowSizeChartModal(true)}
                          className="text-[11px] font-bold text-amber-700 hover:underline"
                        >
                          Size Chart (সাইজ গাইড)
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setQuickViewSize(size)}
                            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
                              quickViewSize === size
                                ? "bg-stone-900 text-stone-50 border-stone-900 shadow-sm"
                                : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                            }`}
                          >
                            {size === "50"
                              ? "Length 50 [Small]"
                              : size === "52"
                              ? "Length 52 [Medium]"
                              : size === "54"
                              ? "Length 54 [Large]"
                              : size === "56"
                              ? "Length 56 [Extra Large]"
                              : size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Wholesale Order Accordion Table */}
                    {selectedProduct.sizes.length > 1 && (
                      <div className="mt-6 border border-stone-200 rounded-2xl overflow-hidden bg-stone-50">
                        <button
                          onClick={() => setIsWholesaleOpen(!isWholesaleOpen)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-stone-100 hover:bg-stone-150 transition-colors cursor-pointer text-left"
                        >
                          <div>
                            <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                              Wholesale Order (পাইকারি অর্ডার)
                            </span>
                            <p className="text-[10px] text-stone-500">একাধিক সাইজ একসাথে একই কালার অর্ডার করুন</p>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 text-stone-500 transition-transform duration-300 ${
                              isWholesaleOpen ? "rotate-90" : ""
                            }`}
                          />
                        </button>

                        {isWholesaleOpen && (
                          <div className="p-4 bg-white border-t border-stone-200 animate-fade-in space-y-3">
                            <p className="text-[11px] text-stone-500 leading-relaxed">
                              প্রতিটি সাইজের জন্য প্রয়োজনীয় পিস বসান। কার্টে সব পিস একসাথে জমা হবে।
                            </p>
                            <div className="space-y-2">
                              {selectedProduct.sizes.map((size) => {
                                const val = wholesaleQuantities[size] || 0;
                                return (
                                  <div key={size} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-100">
                                    <span className="font-semibold text-stone-700">সাইজ {size} ইঞ্চি</span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() =>
                                          setWholesaleQuantities((prev) => ({
                                            ...prev,
                                            [size]: Math.max(0, val - 1)
                                          }))
                                        }
                                        className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold"
                                      >
                                        -
                                      </button>
                                      <span className="w-8 text-center font-bold text-stone-900 font-mono">
                                        {val}
                                      </span>
                                      <button
                                        onClick={() =>
                                          setWholesaleQuantities((prev) => ({
                                            ...prev,
                                            [size]: val + 1
                                          }))
                                        }
                                        className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="pt-2 flex items-center justify-between border-t border-stone-200">
                              <span className="text-xs font-semibold text-stone-600">মোট পিস:</span>
                              <span className="font-bold text-stone-950 text-sm font-mono">
                                {Object.values(wholesaleQuantities).reduce((sum: number, v: any) => sum + (v || 0), 0)} পিস
                              </span>
                            </div>
                            <button
                              onClick={() => handleAddWholesaleToCart(selectedProduct, quickViewType)}
                              disabled={Object.values(wholesaleQuantities).reduce((sum: number, v: any) => sum + (v || 0), 0) === 0}
                              className="w-full py-2 bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 font-bold text-xs rounded-xl transition-all uppercase tracking-wider"
                            >
                              পাইকারি সব একসাথে কার্টে যোগ করুন
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Standard Add Quantity Stepper */}
                    {!isWholesaleOpen && (
                      <div className="mt-5 flex items-center gap-4">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                          Quantity (পরিমাণ)
                        </span>
                        <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200">
                          <button
                            onClick={() => setQuickViewQty((prev) => Math.max(1, prev - 1))}
                            className="w-8 h-8 rounded-lg bg-white text-stone-800 hover:bg-stone-50 flex items-center justify-center font-bold text-sm shadow-xs cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-10 text-center font-extrabold text-stone-900 font-mono">
                            {quickViewQty}
                          </span>
                          <button
                            onClick={() => setQuickViewQty((prev) => prev + 1)}
                            className="w-8 h-8 rounded-lg bg-white text-stone-800 hover:bg-stone-50 flex items-center justify-center font-bold text-sm shadow-xs cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-xs text-stone-400 font-semibold font-mono">In Stock</span>
                      </div>
                    )}
                  </div>

                  {/* Buy Now & Add to Cart and WhatsApp CTAs */}
                  <div className="mt-6 pt-5 border-t border-stone-150 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          if (isWholesaleOpen) {
                            handleAddWholesaleToCart(selectedProduct, quickViewType);
                          } else {
                            handleAddToCart(selectedProduct, quickViewSize, quickViewType, quickViewQty);
                          }
                        }}
                        className="bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold text-xs py-3 rounded-xl transition-colors uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4 text-[#c5a880]" />
                        <span>Add to Cart</span>
                      </button>

                      <button
                        onClick={() => {
                          if (isWholesaleOpen) {
                            alert("পাইকারি অর্ডারে বাই নাও ব্যবহার করতে সব কার্টে এড করুন।");
                          } else {
                            handleBuyNow(selectedProduct, quickViewSize, quickViewType, quickViewQty);
                          }
                        }}
                        className="bg-[#800000] hover:bg-[#6c0000] text-white font-bold text-xs py-3 rounded-xl transition-colors uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
                      >
                        <ShoppingBag className="w-4 h-4 text-white" />
                        <span>Buy Now</span>
                      </button>
                    </div>

                    <a
                      href={`${waBaseLink}?text=${encodeURIComponent(
                        `আসসালামু আলাইকুম, আমি সরাসরি এই পণ্যটি অর্ডার করতে চাই: ${selectedProduct.name} [সাইজ: ${quickViewSize}${quickViewType ? `, টাইপ: ${quickViewType}` : ""}] (পরিমাণ: ${quickViewQty} পিস)`
                      )}`}
                      target="_blank"
                      rel="noopener"
                      className="w-full bg-[#25D366] hover:bg-[#20ba56] text-white font-bold text-xs py-3.5 rounded-xl transition-colors text-center flex items-center justify-center gap-2"
                    >
                      <span>অর্ডার করুন সরাসরি WhatsApp মেসেজে</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Tabs container for Description / Specs */}
              <div className="mt-8 pt-6 border-t border-stone-150">
                <div className="flex border-b border-stone-200">
                  <button
                    onClick={() => setQuickViewTab("desc")}
                    className={`pb-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all px-4 ${
                      quickViewTab === "desc"
                        ? "border-[#c5a880] text-stone-900"
                        : "border-transparent text-stone-400 hover:text-stone-600"
                    }`}
                  >
                    Product Description (বিবরণ)
                  </button>
                  <button
                    onClick={() => setQuickViewTab("spec")}
                    className={`pb-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all px-4 ${
                      quickViewTab === "spec"
                        ? "border-[#c5a880] text-stone-900"
                        : "border-transparent text-stone-400 hover:text-stone-600"
                    }`}
                  >
                    Specifications (স্পেসিফিকেশন)
                  </button>
                </div>

                <div className="py-4 text-sm text-stone-600 leading-relaxed font-sans">
                  {quickViewTab === "desc" ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-stone-800">{selectedProduct.description}</p>
                      {selectedProduct.detailNote && (
                        <p className="text-xs bg-stone-50 border border-stone-100 p-2 rounded-lg text-stone-500 font-medium">
                          {selectedProduct.detailNote}
                        </p>
                      )}
                    </div>
                  ) : (
                    <ul className="divide-y divide-stone-100 text-xs">
                      <li className="py-2.5 flex justify-between">
                        <span className="text-stone-400 font-medium">Fabric (ফেব্রিক্স)</span>
                        <strong className="text-stone-800">{selectedProduct.fabric}</strong>
                      </li>
                      <li className="py-2.5 flex justify-between">
                        <span className="text-stone-400 font-medium">Color (রং)</span>
                        <strong className="text-stone-800">{selectedProduct.colorLabel}</strong>
                      </li>
                      {selectedProduct.detailNote && (
                        <li className="py-2.5 flex justify-between">
                          <span className="text-stone-400 font-medium">Size Details</span>
                          <strong className="text-stone-800">{selectedProduct.detailNote.split("(")[0].trim()}</strong>
                        </li>
                      )}
                      <li className="py-2.5 flex justify-between">
                        <span className="text-stone-400 font-medium">SKU Code</span>
                        <strong className="text-stone-800 font-mono">{selectedProduct.id}</strong>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Slider Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-stone-900/60 backdrop-blur-xs">
          <div className="absolute inset-0 overflow-hidden">
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              
              <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-fade-in border-l border-stone-150">
                {/* Header of Drawer */}
                <div className="p-6 border-b border-stone-150 flex items-center justify-between">
                  <h3 className="text-base font-bold text-stone-950 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-amber-700" />
                    <span>Shopping Cart ({cart.length})</span>
                  </h3>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 bg-stone-50 hover:bg-stone-100 rounded-full text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body of Drawer */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="w-14 h-14 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <ShoppingBag className="w-5 h-5 text-stone-400" />
                      </div>
                      <h4 className="text-sm font-bold text-stone-700">কার্টটি বর্তমানে খালি আছে!</h4>
                      <p className="text-xs text-stone-400 max-w-xs mx-auto mt-1">
                        অনুগ্রহ করে আপনার পছন্দের আবায়া শপ করুন এবং কার্টে যোগ করুন।
                      </p>
                      <button
                        onClick={() => {
                          setIsCartOpen(false);
                          setSelectedCategory("all");
                        }}
                        className="mt-5 bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs px-4 py-2 rounded-full font-semibold transition-colors"
                      >
                        শপ করতে ফিরে যান
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Products list added */}
                      <div className="space-y-3 divide-y divide-stone-100">
                        {cart.map((item) => (
                          <div key={item.id} className="pt-3 first:pt-0 flex items-start gap-3">
                            <div className="w-16 h-20 bg-stone-50 rounded-lg overflow-hidden border border-stone-150 shrink-0">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover object-top" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-semibold text-xs text-stone-900 truncate">
                                {item.name}
                              </h5>
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                সাইজ: <span className="font-bold text-stone-700">{item.size}</span>
                                {item.type && (
                                  <>
                                    {" • "}ধরণ: <span className="font-bold text-stone-700">{item.type}</span>
                                  </>
                                )}
                              </p>

                              <div className="mt-2 flex items-center justify-between">
                                {/* Quantity Steppers */}
                                <div className="flex items-center bg-stone-50 border border-stone-200 rounded-lg p-0.5 scale-90 origin-left">
                                  <button
                                    onClick={() => handleUpdateCartQty(item.id, -1)}
                                    className="w-6 h-6 rounded-md bg-white hover:bg-stone-100 flex items-center justify-center text-stone-700 font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="w-6 text-center font-bold text-stone-900 text-xs font-mono">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => handleUpdateCartQty(item.id, 1)}
                                    className="w-6 h-6 rounded-md bg-white hover:bg-stone-100 flex items-center justify-center text-stone-700 font-bold"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-stone-950 font-mono">
                                    ৳{item.price * item.quantity}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveFromCart(item.id)}
                                    className="text-stone-300 hover:text-[#800000] p-1 transition-colors"
                                    title="মুছে ফেলুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Cash on Delivery Form Panel */}
                      <form onSubmit={handlePlaceOrder} className="pt-4 border-t border-stone-150 space-y-4">
                        <h4 className="text-xs font-extrabold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          <span>Delivery Address (ক্যাশ অন ডেলিভারি)</span>
                        </h4>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">আপনার নাম *</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                                <User className="w-3.5 h-3.5" />
                              </span>
                              <input
                                type="text"
                                required
                                placeholder="উদা: ফারিয়া রহমান"
                                value={checkoutName}
                                onChange={(e) => setCheckoutName(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">মোবাইল নাম্বার *</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                                <Phone className="w-3.5 h-3.5" />
                              </span>
                              <input
                                type="tel"
                                required
                                placeholder="উদা: ০১৭xxxxxxxx"
                                value={checkoutPhone}
                                onChange={(e) => setCheckoutPhone(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">ডেলিভারি ঠিকানা *</label>
                            <textarea
                              required
                              rows={2}
                              placeholder="উদা: বাসা নং- ২৪, রোড নং- ৫, উত্তরা সেক্টর- ১০, ঢাকা।"
                              value={checkoutAddress}
                              onChange={(e) => setCheckoutAddress(e.target.value)}
                              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden resize-none"
                            ></textarea>
                          </div>

                          <div>
                            <span className="block text-[11px] font-bold text-stone-600 mb-1.5">ডেলিভারি এরিয়া</span>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setDeliveryArea("inside")}
                                className={`py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                                  deliveryArea === "inside"
                                    ? "bg-stone-900 text-stone-50 border-stone-900 shadow-xs"
                                    : "bg-white text-stone-700 border-stone-200"
                                }`}
                              >
                                ঢাকার ভেতর (৳৮০)
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeliveryArea("outside")}
                                className={`py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                                  deliveryArea === "outside"
                                    ? "bg-stone-900 text-stone-50 border-stone-900 shadow-xs"
                                    : "bg-white text-stone-700 border-stone-200"
                                }`}
                              >
                                ঢাকার বাইরে (৳১৫০)
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Order calculation overview */}
                        <div className="bg-stone-50 rounded-xl p-3 space-y-1.5 text-xs text-stone-600 border border-stone-100 font-medium">
                          <div className="flex justify-between">
                            <span>Subtotal (সাবটোটাল):</span>
                            <span className="font-bold text-stone-950 font-mono">৳{cartSubtotal}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Delivery (ডেলিভারি চার্জ):</span>
                            <span className="font-bold text-stone-950 font-mono">৳{deliveryCharge}</span>
                          </div>
                          <div className="flex justify-between text-stone-950 pt-1.5 border-t border-stone-200 font-extrabold text-sm">
                            <span>সর্বমোট বিল:</span>
                            <span className="font-mono">৳{cartTotal}</span>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[#800000] hover:bg-[#6c0000] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          <ShoppingBag className="w-4 h-4 text-white" />
                          <span>কনফার্ম করুন (ক্যাশ অন ডেলিভারি)</span>
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Mobile Filters Drawer Modal */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-stone-900/60 backdrop-blur-xs lg:hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="fixed inset-y-0 left-0 max-w-full flex pr-10">
              
              <div className="w-screen max-w-xs bg-white shadow-2xl flex flex-col justify-between animate-fade-in">
                {/* Drawer header */}
                <div className="p-4 border-b border-stone-150 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-950 flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-stone-600" />
                    <span>পণ্য ফিল্টার করুন</span>
                  </h3>
                  <button
                    onClick={() => setIsMobileFiltersOpen(false)}
                    className="p-1.5 bg-stone-50 hover:bg-stone-100 rounded-full text-stone-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Filter body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Category choices */}
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Categories</h4>
                    <nav className="flex flex-col gap-1">
                      <button
                        onClick={() => {
                          setSelectedCategory("all");
                          setIsMobileFiltersOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          selectedCategory === "all" ? "bg-stone-100 text-stone-900 font-bold" : "text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        All Products
                      </button>
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.key}
                          onClick={() => {
                            setSelectedCategory(cat.key);
                            setIsMobileFiltersOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            selectedCategory === cat.key ? "bg-stone-100 text-stone-900 font-bold" : "text-stone-600 hover:bg-stone-50"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Price budget slider */}
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Price Range</h4>
                    <div className="space-y-4">
                      <input
                        type="range"
                        min="0"
                        max="3000"
                        step="50"
                        value={priceRange[1]}
                        onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                        className="w-full accent-stone-900 cursor-pointer h-1 bg-stone-200 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between items-center text-xs text-stone-500 font-mono">
                        <span>৳0</span>
                        <span>Max: ৳{priceRange[1]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Colors check list */}
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Colors</h4>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => {
                        const isChecked = selectedColors.includes(color.key);
                        return (
                          <button
                            key={color.key}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedColors(selectedColors.filter((c) => c !== color.key));
                              } else {
                                setSelectedColors([...selectedColors, color.key]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-all border flex items-center gap-1 ${
                              isChecked
                                ? "bg-stone-900 text-stone-50 border-stone-900"
                                : "bg-white text-stone-600 border-stone-200"
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full border border-stone-300"
                              style={{
                                backgroundColor:
                                  color.key === "maroon"
                                    ? "#800000"
                                    : color.key === "black"
                                    ? "#000000"
                                    : color.key === "emerald"
                                    ? "#046307"
                                    : color.key === "blue"
                                    ? "#00008b"
                                    : color.key === "pink"
                                    ? "#ffc0cb"
                                    : color.key === "rose-gold"
                                    ? "#b76e79"
                                    : "#e2e8f0"
                              }}
                            ></span>
                            {color.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Filter footer buttons */}
                <div className="p-4 border-t border-stone-150 space-y-2 bg-stone-50">
                  <button
                    onClick={() => {
                      setPriceRange([0, 3000]);
                      setSelectedColors([]);
                      setSearchQuery("");
                      setIsMobileFiltersOpen(false);
                    }}
                    className="w-full py-2 bg-white text-stone-700 text-xs font-semibold rounded-lg border border-stone-250 transition-colors"
                  >
                    Clear All (ফিল্টার মুছুন)
                  </button>
                  <button
                    onClick={() => setIsMobileFiltersOpen(false)}
                    className="w-full py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Apply Filters (ফিল্টার প্রয়োগ)
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Size Chart Modal popup */}
      {showSizeChartModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-fade-in border border-stone-100">
            <button
              onClick={() => setShowSizeChartModal(false)}
              className="absolute top-4 right-4 bg-stone-100 hover:bg-stone-200 text-stone-600 p-1.5 rounded-full transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="p-6">
              <h3 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2 mb-4 font-display">
                <Info className="w-5 h-5 text-amber-700" />
                <span>Size Chart & Measurement Guide (সাইজ গাইড)</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-stone-200">
                  <thead className="bg-stone-50 font-bold text-stone-600">
                    <tr>
                      <th className="py-2 px-3">Length (ঝুল)</th>
                      <th className="py-2 px-3">Body Size (বডি)</th>
                      <th className="py-2 px-3">Sleeve (হাতা)</th>
                      <th className="py-2 px-3">Shoulder (কাধ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono text-stone-700">
                    <tr>
                      <td className="py-2.5 px-3">50 Inch</td>
                      <td className="py-2.5 px-3">44-46" (Free)</td>
                      <td className="py-2.5 px-3">24 Inch</td>
                      <td className="py-2.5 px-3">15 Inch</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3">52 Inch</td>
                      <td className="py-2.5 px-3">44-46" (Free)</td>
                      <td className="py-2.5 px-3">25 Inch</td>
                      <td className="py-2.5 px-3">16 Inch</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3">54 Inch</td>
                      <td className="py-2.5 px-3">44-46" (Free)</td>
                      <td className="py-2.5 px-3">25.5 Inch</td>
                      <td className="py-2.5 px-3">16.5 Inch</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3">56 Inch</td>
                      <td className="py-2.5 px-3">44-46" (Free)</td>
                      <td className="py-2.5 px-3">26 Inch</td>
                      <td className="py-2.5 px-3">17 Inch</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-stone-500 text-[11px] space-y-1">
                <p>💡 <strong>বিঃদ্রঃ:</strong> আমাদের সকল আবায়া স্ট্যান্ডার্ড বডি সাইজ ৪৪ থেকে ৪৬ ইঞ্চি ফ্রি সাইজ হিসেবে কভার করে। বেল্ট দিয়ে বডি এডজাস্ট করা যাবে সহজে।</p>
                <p>হাতা বা ঝুল আপনার উচ্চতা অনুযায়ী নির্বাচন করুন।</p>
              </div>

              <button
                onClick={() => setShowSizeChartModal(false)}
                className="mt-5 w-full py-2.5 bg-stone-900 text-stone-50 hover:bg-stone-800 font-bold text-xs rounded-xl transition-all uppercase tracking-wider"
              >
                Close size guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elegant Footer area */}
      <footer className="bg-[#1c1917] text-stone-400 text-xs py-10 mt-16 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="text-stone-200 font-bold text-sm mb-3 font-display tracking-wide uppercase">
              ANZAAR PREMIUM MODEST WEAR
            </h4>
            <p className="leading-relaxed text-stone-400 max-w-xs">
              আভিজাত্য ও শালীনতার অপূর্ব মেলবন্ধনে তৈরি আমাদের প্রতিটি পোশাক প্রিমিয়াম ফেব্রিক্সের ও অনন্য কারুকাজের ছোঁয়ায় তৈরি।
            </p>
          </div>
          <div>
            <h4 className="text-stone-200 font-bold text-sm mb-3 font-display tracking-wide uppercase">
              Customer Support (গ্রাহক সেবা)
            </h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#c5a880]" />
                <span>হেল্পলাইন: ০১৯৭০৮৩১৭৮৩ (সকাল ১০টা - রাত ১০টা)</span>
              </li>
              <li>• ২৪/৭ হোয়াটসঅ্যাপ সাপোর্ট সচল রয়েছে</li>
              <li>• ৩ দিনের সহজ এক্সচেঞ্জ ও রিটার্ন পলিসি</li>
            </ul>
          </div>
          <div>
            <h4 className="text-stone-200 font-bold text-sm mb-3 font-display tracking-wide uppercase">
              Delivery Info (ডেলিভারি তথ্য)
            </h4>
            <ul className="space-y-2">
              <li>📍 ঢাকার ভেতরে ডেলিভারি সময়: ২৪-৪৮ ঘণ্টা</li>
              <li>📍 ঢাকার বাইরে ডেলিভারি সময়: ২-৩ দিন</li>
              <li>💵 কন্ডিশনাল ক্যাশ অন ডেলিভারি সুবিধা সারা বাংলাদেশ</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 mt-8 pt-6 border-t border-stone-800/60 text-center text-[11px] text-stone-500">
          <p>© {new Date().getFullYear()} Anzaar Premium Modest Wear. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
