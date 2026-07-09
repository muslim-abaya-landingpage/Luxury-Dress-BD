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
  Maximize2,
  Lock,
  Settings,
  Database,
  RefreshCw,
  Edit,
  PlusCircle,
  LogOut,
  CheckCircle,
  TrendingUp,
  Box,
  Eye
} from "lucide-react";
import { CATEGORIES, PRODUCTS, Product, Category } from "./data/products";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
      subtitle: "Exclusive abaya collections made of premium Dubai Cherry & Nida Silk fabrics",
      bg: "bg-stone-100",
      accent: "Starting from BDT 1,100"
    },
    {
      title: "Authentic Dubai Quality",
      subtitle: "Guaranteed deep colors, royal finish, and flawless long-lasting stitching",
      bg: "bg-amber-50",
      accent: "Hand Embroidery Special"
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

  // Firestore Products and Orders
  const [dbProducts, setDbProducts] = useState<Product[]>(PRODUCTS);
  const [orders, setOrders] = useState<any[]>([]);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminTab, setAdminTab] = useState<"orders" | "products">("orders");

  // Product form state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<Partial<Product>>({
    id: "",
    name: "",
    price: 0,
    category: "abaya",
    fabric: "Dubai Cherry",
    images: [""],
    sizes: ["50", "52", "54", "56"],
    color: "black",
    colorLabel: "কালো",
    description: ""
  });

  // Load products from Firestore on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const productsList: Product[] = [];
        querySnapshot.forEach((doc) => {
          productsList.push({ id: doc.id, ...doc.data() } as Product);
        });
        if (productsList.length > 0) {
          setDbProducts(productsList);
        } else {
          setDbProducts(PRODUCTS);
        }
      } catch (err) {
        console.error("Firestore Error fetching products:", err);
        setDbProducts(PRODUCTS);
      }
    };
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "orders"));
      const ordersList: any[] = [];
      querySnapshot.forEach((doc) => {
        ordersList.push({ id: doc.id, ...doc.data() });
      });
      ordersList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setOrders(ordersList);
    } catch (err) {
      console.error("Firestore Error fetching orders:", err);
    }
  };

  // Save/Add product in Firestore
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.id || !productForm.name || !productForm.price) {
      alert("অনুগ্রহ করে সব প্রয়োজনীয় তথ্য দিন।");
      return;
    }
    try {
      const cleanProduct: Product = {
        id: productForm.id,
        name: productForm.name,
        price: Number(productForm.price),
        category: productForm.category || "abaya",
        fabric: productForm.fabric || "Dubai Cherry",
        images: Array.isArray(productForm.images) ? productForm.images : [""],
        sizes: productForm.sizes || ["50", "52", "54", "56"],
        color: productForm.color || "black",
        colorLabel: productForm.colorLabel || "কালো",
        description: productForm.description || ""
      };
      await setDoc(doc(db, "products", cleanProduct.id), cleanProduct);
      showToast("✅ প্রোডাক্ট সফলভাবে সেভ করা হয়েছে!");
      setEditingProduct(null);
      setIsAddingProduct(false);
      setProductForm({
        id: "",
        name: "",
        price: 0,
        category: "abaya",
        fabric: "Dubai Cherry",
        images: [""],
        sizes: ["50", "52", "54", "56"],
        color: "black",
        colorLabel: "কালো",
        description: ""
      });
      
      // Refresh products list
      const querySnapshot = await getDocs(collection(db, "products"));
      const list: Product[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Product);
      });
      setDbProducts(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "products");
    }
  };

  // Delete product from Firestore
  const handleDeleteProduct = async (prodId: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই প্রোডাক্টটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, "products", prodId));
      showToast("🗑️ প্রোডাক্ট ডিলিট করা হয়েছে!");
      
      const querySnapshot = await getDocs(collection(db, "products"));
      const list: Product[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Product);
      });
      if (list.length > 0) {
        setDbProducts(list);
      } else {
        setDbProducts(PRODUCTS);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${prodId}`);
    }
  };

  // Import Default Products to Firestore
  const handleImportDefaultProducts = async () => {
    if (!window.confirm("আপনি কি ডেটাবেজে ডিফল্ট প্রোডাক্টগুলো ইম্পোর্ট করতে চান?")) return;
    try {
      for (const p of PRODUCTS) {
        await setDoc(doc(db, "products", p.id), p);
      }
      showToast("🎉 সকল ডিফল্ট প্রোডাক্ট সফলভাবে ইম্পোর্ট করা হয়েছে!");
      
      const querySnapshot = await getDocs(collection(db, "products"));
      const list: Product[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Product);
      });
      setDbProducts(list);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "products");
    }
  };

  // Update order status in Firestore
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
      showToast(`📦 অর্ডার স্ট্যাটাস আপডেট করা হয়েছে: ${newStatus}`);
      fetchOrders();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // Delete order from Firestore
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই অর্ডারটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, "orders", orderId));
      showToast("🗑️ অর্ডার ডিলিট করা হয়েছে!");
      fetchOrders();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  // WhatsApp WhatsApp Order Link
  const waBaseLink = "https://wa.me/8801970831783";

  // Compute color options dynamically based on products
  const colorOptions = useMemo(() => {
    const map: Record<string, string> = {};
    dbProducts.forEach((p) => {
      if (p.color && p.colorLabel) {
        map[p.color] = p.colorLabel;
      }
    });
    return Object.entries(map).map(([key, label]) => ({ key, label }));
  }, [dbProducts]);

  // Filter & Sort logic
  const filteredProducts = useMemo(() => {
    let result = [...dbProducts];

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
  }, [selectedCategory, searchQuery, priceRange, selectedColors, sortMode, dbProducts]);

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

    showToast(`🛒 "${product.name}" (${finalSize}${finalType ? ` - ${finalType}` : ""}) has been added to your cart!`);
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
      alert("Please set quantity for at least one size.");
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
    showToast(`🛒 A total of ${totalPiecesAdded} pieces have been added to your cart for wholesale!`);
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
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("Your cart is currently empty.");
      return;
    }
    if (!checkoutName.trim()) {
      alert("Please enter your name.");
      return;
    }
    if (!checkoutPhone.trim()) {
      alert("Please enter your mobile phone number.");
      return;
    }
    if (!checkoutAddress.trim()) {
      alert("Please enter your complete delivery address.");
      return;
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      orderId,
      name: checkoutName,
      phone: checkoutPhone,
      address: checkoutAddress,
      area: deliveryArea === "inside" ? "Inside Dhaka" : "Outside Dhaka",
      items: [...cart],
      subtotal: cartSubtotal,
      delivery: deliveryCharge,
      total: cartTotal,
      date: new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' }),
      status: "Pending",
      timestamp: Date.now()
    };

    setOrderSuccess(newOrder);

    // Save order data to Firestore asynchronously
    try {
      await setDoc(doc(db, "orders", orderId), newOrder);
      console.log("Order saved to Firestore successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
    }

    // Build perfect WhatsApp checkout message
    let messageText = `*New Abaya Order Request (ID: ${orderId})*\n\n`;
    messageText += `👤 *Customer Name:* ${checkoutName}\n`;
    messageText += `📞 *Mobile Phone:* ${checkoutPhone}\n`;
    messageText += `📍 *Address:* ${checkoutAddress}\n`;
    messageText += `🚚 *Delivery Area:* ${deliveryArea === "inside" ? "Inside Dhaka" : "Outside Dhaka"}\n\n`;
    messageText += `🛍️ *Product List:*\n`;

    cart.forEach((item, index) => {
      messageText += `${index + 1}. ${item.name} [Size: ${item.size}${item.type ? `, Type: ${item.type}` : ""}] x ${item.quantity} pcs - BDT ${item.price * item.quantity}\n`;
    });

    messageText += `\n💵 *Subtotal:* BDT ${cartSubtotal}\n`;
    messageText += `🚚 *Delivery Charge:* BDT ${deliveryCharge}\n`;
    messageText += `💰 *Total Amount:* BDT ${cartTotal}\n\n`;
    messageText += `Thank you! Please confirm the order.`;

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
        <span>✨ Cash on Delivery Available Nationwide ✨</span>
        <span className="hidden sm:inline">|</span>
        <span className="hidden sm:inline">Call or WhatsApp to Order: +8801970831783</span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}>
            <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center text-[#c5a880] font-bold text-lg shadow-sm">
              M
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900 font-display">
                MUSLIM ABAYA <span className="text-[#c5a880] font-normal font-sans text-sm tracking-widest uppercase ml-1 block sm:inline">Modest Wear</span>
              </h1>
              <p className="text-[10px] text-stone-400 font-medium tracking-wide uppercase">Premium Hijab & Abaya Collection</p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4.5 w-4.5 text-stone-400" />
            </span>
            <input
              type="text"
              placeholder="Search for abaya, kurti or colors..."
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
            All Products
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
            <h2 className="text-2xl font-bold text-stone-900">Your order has been successfully submitted!</h2>
            <p className="text-emerald-700 text-sm mt-1 font-semibold">Order ID: #{orderSuccess.orderId}</p>
            <p className="text-stone-600 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              We have received your information. Please make sure that you sent the order details on WhatsApp. We will contact you very soon.
            </p>

            <div className="mt-6 bg-white rounded-xl p-4 border border-stone-100 text-left text-sm max-w-md mx-auto space-y-2">
              <p>👤 <strong>Customer:</strong> {orderSuccess.name}</p>
              <p>📞 <strong>Phone:</strong> {orderSuccess.phone}</p>
              <p>📍 <strong>Address:</strong> {orderSuccess.address}</p>
              <p>💰 <strong>Total Bill:</strong> <span className="font-bold text-stone-900">BDT {orderSuccess.total}</span> (Cash on Delivery)</p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`${waBaseLink}?text=${encodeURIComponent(
                  `Hello, I would like to confirm my order. ID: #${orderSuccess.orderId}`
                )}`}
                target="_blank"
                rel="noopener"
                className="w-full sm:w-auto bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm px-6 py-3 rounded-full shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Confirm on WhatsApp</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={() => setOrderSuccess(null)}
                className="w-full sm:w-auto bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-sm px-6 py-3 rounded-full transition-all"
              >
                Continue Shopping
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
                  Shop Now
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
              <span>Filter Products</span>
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
                    {dbProducts.length}
                  </span>
                </button>
                {CATEGORIES.map((cat) => {
                  const count = dbProducts.filter((p) => p.category === cat.key).length;
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
                  <span>BDT {priceRange[0]}</span>
                  <span>Max: BDT {priceRange[1]}</span>
                </div>
              </div>
            </div>

            {/* Color Filters */}
            <div className="mb-6">
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
                Clear All Filters
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
                  <option value="default">Default Sort</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name-asc">Name: A-Z</option>
                </select>
              </div>
            </div>

            {/* Empty Products Message */}
            {filteredProducts.length === 0 && (
              <div className="text-center py-16 bg-white border border-stone-150 rounded-3xl p-6">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="w-6 h-6 text-stone-400" />
                </div>
                <h4 className="text-lg font-bold text-stone-800">No Products Found!</h4>
                <p className="text-sm text-stone-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  There are currently no products matching your selected filters or search keyword. Please try with different keywords.
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
                  View All Products
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
                            BDT {p.price}
                          </span>
                          {p.types && p.types.length > 1 && (
                            <span className="text-[10px] text-stone-400">
                              (Varies by type)
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
                              {currentCartQty} pcs in cart
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
                            <span>Add to Cart</span>
                          </button>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleOpenQuickView(p)}
                            className="bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 font-semibold text-xs py-2 rounded-xl transition-colors text-center"
                          >
                            View Details
                          </button>
                          <a
                             href={`${waBaseLink}?text=${encodeURIComponent(
                               `Hello, I am interested in ordering this product: ${p.name} (ID: ${p.id})`
                             )}`}
                            target="_blank"
                            rel="noopener"
                            className="bg-[#25D366] hover:bg-[#20ba56] text-white font-bold text-xs py-2 rounded-xl transition-colors text-center flex items-center justify-center gap-1"
                          >
                            WhatsApp Message
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
                          BDT {getProductPrice(selectedProduct, quickViewType)}
                        </span>
                        {selectedProduct.priceByType && (
                          <span className="text-xs text-stone-500 font-medium">
                            (Price varies by type)
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
                          Select Variant Type
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
                              {type} - BDT {getProductPrice(selectedProduct, type)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Size Selector options */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                          Select Size
                        </span>
                        <button
                          onClick={() => setShowSizeChartModal(true)}
                          className="text-[11px] font-bold text-amber-700 hover:underline"
                        >
                          Size Chart
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
                              Wholesale Order
                            </span>
                            <p className="text-[10px] text-stone-500">Order multiple sizes of the same color together</p>
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
                              Specify the quantity for each size. All items will be added to the cart together.
                            </p>
                            <div className="space-y-2">
                              {selectedProduct.sizes.map((size) => {
                                const val = wholesaleQuantities[size] || 0;
                                return (
                                  <div key={size} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-100">
                                    <span className="font-semibold text-stone-700">Size {size} inches</span>
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
                              <span className="text-xs font-semibold text-stone-600">Total Qty:</span>
                              <span className="font-bold text-stone-950 text-sm font-mono">
                                {Object.values(wholesaleQuantities).reduce((sum: number, v: any) => sum + (v || 0), 0)} pcs
                              </span>
                            </div>
                            <button
                              onClick={() => handleAddWholesaleToCart(selectedProduct, quickViewType)}
                              disabled={Object.values(wholesaleQuantities).reduce((sum: number, v: any) => sum + (v || 0), 0) === 0}
                              className="w-full py-2 bg-stone-900 text-stone-50 hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-400 font-bold text-xs rounded-xl transition-all uppercase tracking-wider"
                            >
                              Add Wholesale Items to Cart
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Standard Add Quantity Stepper */}
                    {!isWholesaleOpen && (
                      <div className="mt-5 flex items-center gap-4">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                          Quantity
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
                            alert("To buy wholesale items, please add them to the cart.");
                          } else {
                            handleBuyNow(selectedProduct, quickViewSize, quickViewType, quickViewQty);
                          }
                        }}
                        className="bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold text-xs py-3 rounded-xl transition-colors uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
                      >
                        <ShoppingBag className="w-4 h-4 text-white" />
                        <span>Buy Now</span>
                      </button>
                    </div>

                    <a
                      href={`${waBaseLink}?text=${encodeURIComponent(
                        `Hello, I would like to order this product: ${selectedProduct.name} [Size: ${quickViewSize}${quickViewType ? `, Type: ${quickViewType}` : ""}] (Quantity: ${quickViewQty} pcs)`
                      )}`}
                      target="_blank"
                      rel="noopener"
                      className="w-full bg-[#25D366] hover:bg-[#20ba56] text-white font-bold text-xs py-3.5 rounded-xl transition-colors text-center flex items-center justify-center gap-2"
                    >
                      <span>Order Directly on WhatsApp</span>
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
                    Product Description
                  </button>
                  <button
                    onClick={() => setQuickViewTab("spec")}
                    className={`pb-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all px-4 ${
                      quickViewTab === "spec"
                        ? "border-[#c5a880] text-stone-900"
                        : "border-transparent text-stone-400 hover:text-stone-600"
                    }`}
                  >
                    Specifications
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
                        <span className="text-stone-400 font-medium">Fabric</span>
                        <strong className="text-stone-800">{selectedProduct.fabric}</strong>
                      </li>
                      <li className="py-2.5 flex justify-between">
                        <span className="text-stone-400 font-medium">Color</span>
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
                      <h4 className="text-sm font-bold text-stone-700">Your cart is currently empty!</h4>
                      <p className="text-xs text-stone-400 max-w-xs mx-auto mt-1">
                        Please shop for your favorite abayas and add them to the cart.
                      </p>
                      <button
                        onClick={() => {
                          setIsCartOpen(false);
                          setSelectedCategory("all");
                        }}
                        className="mt-5 bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs px-4 py-2 rounded-full font-semibold transition-colors"
                      >
                        Go Back to Shop
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
                                Size: <span className="font-bold text-stone-700">{item.size}</span>
                                {item.type && (
                                  <>
                                    {" • "}Type: <span className="font-bold text-stone-700">{item.type}</span>
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
                                    BDT {item.price * item.quantity}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveFromCart(item.id)}
                                    className="text-stone-300 hover:text-[#800000] p-1 transition-colors"
                                    title="Remove"
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
                          <span>Delivery Address (Cash on Delivery)</span>
                        </h4>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">Your Name *</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                                <User className="w-3.5 h-3.5" />
                              </span>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Faria Rahman"
                                value={checkoutName}
                                onChange={(e) => setCheckoutName(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">Mobile Number *</label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                                <Phone className="w-3.5 h-3.5" />
                              </span>
                              <input
                                type="tel"
                                required
                                placeholder="e.g. 017xxxxxxxx"
                                value={checkoutPhone}
                                onChange={(e) => setCheckoutPhone(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-stone-600 mb-1">Delivery Address *</label>
                            <textarea
                              required
                              rows={2}
                              placeholder="e.g. House 24, Road 5, Uttara Sector 10, Dhaka."
                              value={checkoutAddress}
                              onChange={(e) => setCheckoutAddress(e.target.value)}
                              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden resize-none"
                            ></textarea>
                          </div>

                          <div>
                            <span className="block text-[11px] font-bold text-stone-600 mb-1.5">Delivery Area</span>
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
                                Inside Dhaka (BDT 80)
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
                                Outside Dhaka (BDT 150)
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Order calculation overview */}
                        <div className="bg-stone-50 rounded-xl p-3 space-y-1.5 text-xs text-stone-600 border border-stone-100 font-medium">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-bold text-stone-950 font-mono">BDT {cartSubtotal}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Delivery Charge:</span>
                            <span className="font-bold text-stone-950 font-mono">BDT {deliveryCharge}</span>
                          </div>
                          <div className="flex justify-between text-stone-950 pt-1.5 border-t border-stone-200 font-extrabold text-sm">
                            <span>Total Bill:</span>
                            <span className="font-mono">BDT {cartTotal}</span>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[#1c1917] hover:bg-[#2e2a27] text-[#c5a880] py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          <ShoppingBag className="w-4 h-4 text-[#c5a880]" />
                          <span>Confirm Order (Cash on Delivery)</span>
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
                    <span>Filter Products</span>
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
                        <span>BDT 0</span>
                        <span>Max: BDT {priceRange[1]}</span>
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
                    Clear All Filters
                  </button>
                  <button
                    onClick={() => setIsMobileFiltersOpen(false)}
                    className="w-full py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Apply Filters
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
                <span>Size Chart & Measurement Guide</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-stone-200">
                  <thead className="bg-stone-50 font-bold text-stone-600">
                    <tr>
                      <th className="py-2 px-3">Length</th>
                      <th className="py-2 px-3">Body Size</th>
                      <th className="py-2 px-3">Sleeve</th>
                      <th className="py-2 px-3">Shoulder</th>
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
                <p>💡 <strong>Note:</strong> All our abayas are standard free size covering body size 44 to 46 inches. It can be easily adjusted with the included belt.</p>
                <p>Please choose the length according to your height.</p>
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
              MUSLIM ABAYA PREMIUM MODEST WEAR
            </h4>
            <p className="leading-relaxed text-stone-400 max-w-xs">
              Each of our garments is made with premium fabrics and unique handcrafting, combining elegance and modesty.
            </p>
          </div>
          <div>
            <h4 className="text-stone-200 font-bold text-sm mb-3 font-display tracking-wide uppercase">
              Customer Support
            </h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#c5a880]" />
                <span>Helpline: +8801970831783 (10 AM - 10 PM)</span>
              </li>
              <li>• 24/7 WhatsApp Support is active</li>
              <li>• 3 Days Easy Exchange & Return Policy</li>
            </ul>
          </div>
          <div>
            <h4 className="text-stone-200 font-bold text-sm mb-3 font-display tracking-wide uppercase">
              Delivery Info
            </h4>
            <ul className="space-y-2">
              <li>📍 Delivery inside Dhaka: 24-48 Hours</li>
              <li>📍 Delivery outside Dhaka: 2-3 Days</li>
              <li>💵 Cash on Delivery available all over Bangladesh</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 mt-8 pt-6 border-t border-stone-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-500">
          <p>© {new Date().getFullYear()} Muslim Abaya Premium Modest Wear. All Rights Reserved.</p>
          <button
            onClick={() => {
              setShowAdminPanel(true);
              setAdminPassword("");
              setAdminError("");
            }}
            className="text-stone-600 hover:text-[#c5a880] transition-colors font-medium flex items-center gap-1 cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            <span>🔐 Admin Panel</span>
          </button>
        </div>
      </footer>

      {/* Stunning Interactive Dynamic Admin Panel Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/95 backdrop-blur-md flex flex-col font-sans text-stone-100">
          
          {/* Header Bar */}
          <header className="bg-stone-900 border-b border-stone-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#c5a880] flex items-center justify-center text-stone-950 font-bold">
                M
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-[#c5a880] font-display flex items-center gap-2">
                  <span>MUSLIM ABAYA ADMIN SYSTEM</span>
                  <span className="text-[9px] bg-stone-800 border border-stone-700 text-stone-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono">Dynamic Mode</span>
                </h2>
                <p className="text-[10px] text-stone-400">Real-time Product & Order Control Panel</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdminLoggedIn && (
                <button
                  onClick={() => {
                    setIsAdminLoggedIn(false);
                    setOrders([]);
                  }}
                  className="flex items-center gap-1 bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-700 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowAdminPanel(false);
                  setIsAddingProduct(false);
                  setEditingProduct(null);
                }}
                className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-full border border-stone-700 cursor-pointer transition-colors"
                title="Close Control Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Login Screen if not logged in */}
          {!isAdminLoggedIn ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-stone-900 border border-stone-800 max-w-sm w-full rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-[#c5a880]/10 text-[#c5a880] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#c5a880]/20">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold tracking-tight text-white font-display">Admin Security Login</h3>
                  <p className="text-xs text-stone-400">Enter the password to access the dynamic database.</p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (adminPassword === "abaya" || adminPassword === "muslimabaya" || adminPassword === "muslimabaya2026" || adminPassword === "admin123") {
                      setIsAdminLoggedIn(true);
                      setAdminError("");
                      fetchOrders();
                    } else {
                      setAdminError("Incorrect password! Please try again.");
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[11px] text-stone-400 mb-1.5 font-bold">Secret Password (Passcode)</label>
                    <input
                      required
                      type="password"
                      placeholder="Enter password..."
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-none focus:ring-1 focus:ring-[#c5a880] focus:border-[#c5a880] font-mono text-center tracking-widest"
                    />
                  </div>

                  {adminError && (
                    <div className="text-red-400 text-[11px] font-medium bg-red-950/20 border border-red-900/30 rounded-lg p-2 text-center">
                      ⚠️ {adminError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-[#c5a880] hover:bg-[#b2956c] text-stone-950 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
                  >
                    Login
                  </button>
                </form>

                <div className="text-center text-[10px] text-stone-500">
                  <p>💡 Tip: You can type <strong>muslimabaya2026</strong> as the password.</p>
                </div>
              </div>
            </div>
          ) : (
            // Logged in Control Panel Dashboard
            <div className="flex-1 flex flex-col overflow-hidden bg-stone-950">
              
              {/* Quick Navigation & Stats Bar */}
              <div className="bg-stone-900 border-b border-stone-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                
                {/* Tabs */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAdminTab("orders");
                      fetchOrders();
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      adminTab === "orders"
                        ? "bg-[#c5a880] text-stone-950 border-[#c5a880] shadow-md"
                        : "bg-stone-850 text-stone-300 border-stone-700 hover:bg-stone-800"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Order Management ({orders.length})</span>
                  </button>
                  <button
                    onClick={() => setAdminTab("products")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      adminTab === "products"
                        ? "bg-[#c5a880] text-stone-950 border-[#c5a880] shadow-md"
                        : "bg-stone-850 text-stone-300 border-stone-700 hover:bg-stone-800"
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>Product Management ({dbProducts.length})</span>
                  </button>
                </div>

                {/* Live Stats */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-stone-300 bg-stone-950 px-4 py-2 rounded-xl border border-stone-800">
                  <div className="flex items-center gap-1.5 border-r border-stone-800 pr-4">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Firebase Status: <strong className="text-emerald-400">Live</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>Total Sales: <strong className="text-[#c5a880]">BDT {orders.filter(o => o.status !== "Cancelled").reduce((sum, o) => sum + (o.total || 0), 0)}</strong></span>
                  </div>
                </div>

              </div>

              {/* Main Content Area (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. ORDERS TAB */}
                {adminTab === "orders" && (
                  <div className="space-y-4">
                    
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-stone-200 uppercase tracking-widest flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-[#c5a880]" />
                        <span>Order Request List (Firestore)</span>
                      </h3>
                      <button
                        onClick={fetchOrders}
                        className="flex items-center gap-1.5 bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Reload Orders</span>
                      </button>
                    </div>

                    {orders.length === 0 ? (
                      <div className="bg-stone-900 border border-stone-850 text-center py-12 rounded-2xl text-stone-400 text-xs space-y-2">
                        <ShoppingBag className="w-8 h-8 text-stone-600 mx-auto" />
                        <p>There are currently no orders in the database!</p>
                        <p className="text-[11px] text-stone-500">When customers place new orders, they will be saved here automatically.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {orders.map((order) => (
                          <div
                            key={order.orderId}
                            className={`bg-stone-900 border rounded-2xl p-5 space-y-4 transition-all hover:border-[#c5a880]/30 shadow-md ${
                              order.status === "Pending" ? "border-amber-500/20" :
                              order.status === "Confirmed" ? "border-blue-500/20" :
                              order.status === "Shipped" ? "border-purple-500/20" : "border-stone-800"
                            }`}
                          >
                            
                            {/* Order Card Header */}
                            <div className="flex justify-between items-start border-b border-stone-800/80 pb-3">
                              <div className="space-y-1">
                                <span className="text-[10px] bg-stone-800 text-stone-300 border border-stone-750 px-2 py-0.5 rounded-md font-mono font-bold tracking-wider">
                                  {order.orderId}
                                </span>
                                <p className="text-[11px] text-stone-400">{order.date} • {order.area}</p>
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md border font-mono uppercase ${
                                order.status === "Pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                                order.status === "Confirmed" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                                order.status === "Shipped" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                                "bg-red-500/10 text-red-400 border-red-500/30"
                              }`}>
                                {order.status}
                              </span>
                            </div>

                            {/* Customer details */}
                            <div className="space-y-1 text-xs text-stone-300">
                              <p>👤 <strong>Name:</strong> {order.name}</p>
                              <p>📞 <strong>Mobile:</strong> <a href={`tel:${order.phone}`} className="text-[#c5a880] hover:underline font-mono font-bold">{order.phone}</a></p>
                              <p>📍 <strong>Address:</strong> {order.address}</p>
                            </div>

                            {/* Ordered Items */}
                            <div className="bg-stone-950/80 rounded-xl p-3 border border-stone-850 space-y-2">
                              <h4 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-850 pb-1.5">Ordered Products:</h4>
                              <div className="space-y-2 divide-y divide-stone-850/50">
                                {order.items?.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center text-xs pt-1.5 first:pt-0">
                                    <div className="space-y-0.5">
                                      <p className="font-semibold text-stone-200">{item.name}</p>
                                      <p className="text-[10px] text-stone-500">Size: {item.size} {item.type ? `| Type: ${item.type}` : ""}</p>
                                    </div>
                                    <span className="text-stone-300 font-mono text-[11px]">
                                      {item.quantity} pcs x BDT {item.price} = BDT {item.quantity * item.price}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-2 border-t border-stone-850 flex justify-between items-center text-xs font-bold text-white">
                                <span>Total Bill:</span>
                                <span className="text-[#c5a880] font-mono font-extrabold text-sm">BDT {order.total} (incl. delivery)</span>
                              </div>
                            </div>

                            {/* Order Status Action and deletion */}
                            <div className="flex items-center gap-2 pt-2 border-t border-stone-800/60">
                              <div className="flex-1">
                                <select
                                  value={order.status}
                                  onChange={(e) => handleUpdateOrderStatus(order.orderId, e.target.value)}
                                  className="w-full bg-stone-850 border border-stone-750 rounded-lg px-2 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-[#c5a880]"
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Confirmed">Confirmed</option>
                                  <option value="Shipped">Shipped</option>
                                  <option value="Cancelled">Cancelled</option>
                                </select>
                              </div>
                              <button
                                onClick={() => handleDeleteOrder(order.orderId)}
                                className="p-2 bg-red-950/20 text-red-400 hover:bg-red-900 hover:text-white rounded-lg border border-red-900/30 transition-all cursor-pointer"
                                title="Delete Order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. PRODUCTS TAB */}
                {adminTab === "products" && (
                  <div className="space-y-6">
                    
                    {/* Header operations */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h3 className="text-sm font-bold text-stone-200 uppercase tracking-widest flex items-center gap-2">
                        <Box className="w-4 h-4 text-[#c5a880]" />
                        <span>Product Inventory Control</span>
                      </h3>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleImportDefaultProducts}
                          className="flex items-center gap-1.5 bg-stone-900 border border-stone-800 hover:bg-stone-800 text-[#c5a880] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                          title="Import first run demo data to Firestore"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>Default Import</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(null);
                            setProductForm({
                              id: `MBA-${100 + dbProducts.length + 1}`,
                              name: "",
                              price: 1550,
                              category: "abaya",
                              fabric: "Premium Dubai Cherry",
                              images: [""],
                              sizes: ["50", "52", "54", "56"],
                              color: "black",
                              colorLabel: "Black",
                              description: "Elegant and stylish premium quality abaya dress."
                            });
                            setIsAddingProduct(true);
                          }}
                          className="flex items-center gap-1.5 bg-[#c5a880] hover:bg-[#b2956c] text-stone-950 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md cursor-pointer transition-all"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add New Product</span>
                        </button>
                      </div>
                    </div>

                    {/* Add/Edit Product Form overlay box */}
                    {(isAddingProduct || editingProduct) && (
                      <form onSubmit={handleSaveProduct} className="bg-stone-900 border border-[#c5a880]/30 rounded-2xl p-6 space-y-4 max-w-2xl mx-auto shadow-2xl relative animate-fade-in">
                        <h3 className="text-sm font-bold text-[#c5a880] border-b border-stone-800 pb-3 flex items-center gap-2">
                          <Settings className="w-4 h-4 text-[#c5a880]" />
                          <span>{editingProduct ? "Edit Product Details" : "Add New Product"}</span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Product Code (Unique ID) *</label>
                            <input
                              required
                              disabled={!!editingProduct}
                              type="text"
                              placeholder="e.g. MBA-106"
                              value={productForm.id || ""}
                              onChange={(e) => setProductForm({ ...productForm, id: e.target.value })}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880] font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Product Name *</label>
                            <input
                              required
                              type="text"
                              placeholder="e.g. Luxury Dubai Cherry Abaya"
                              value={productForm.name || ""}
                              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Price (BDT) *</label>
                            <input
                              required
                              type="number"
                              placeholder="e.g. 1550"
                              value={productForm.price || ""}
                              onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880] font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Category *</label>
                            <select
                              value={productForm.category || "abaya"}
                              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880]"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat.key} value={cat.key}>{cat.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Fabric *</label>
                            <input
                              required
                              type="text"
                              placeholder="e.g. Premium Dubai Cherry"
                              value={productForm.fabric || ""}
                              onChange={(e) => setProductForm({ ...productForm, fabric: e.target.value })}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Color Code (Tailwind Color Key) *</label>
                            <input
                              required
                              type="text"
                              placeholder="e.g. black, maroon, emerald, pink"
                              value={productForm.color || ""}
                              onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880] font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Color Label *</label>
                            <input
                              required
                              type="text"
                              placeholder="e.g. Black, Maroon, Bottle Green, Pink"
                              value={productForm.colorLabel || ""}
                              onChange={(e) => setProductForm({ ...productForm, colorLabel: e.target.value })}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Image URL (Comma separated for multiple images) *</label>
                            <input
                              required
                              type="text"
                              placeholder="https://images.unsplash.com/..."
                              value={productForm.images ? productForm.images.join(", ") : ""}
                              onChange={(e) => setProductForm({ ...productForm, images: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })}
                              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880] font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Product Sizes (Comma separated) *</label>
                          <input
                            required
                            type="text"
                            placeholder="e.g. 50, 52, 54, 56"
                            value={productForm.sizes ? productForm.sizes.join(", ") : "50, 52, 54, 56"}
                            onChange={(e) => setProductForm({ ...productForm, sizes: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })}
                            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880] font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Product Description *</label>
                          <textarea
                            required
                            rows={3}
                            placeholder="Write product details description..."
                            value={productForm.description || ""}
                            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-[#c5a880]"
                          ></textarea>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-stone-800/60">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingProduct(false);
                              setEditingProduct(null);
                            }}
                            className="px-4 py-2 bg-stone-800 text-stone-300 text-xs font-semibold rounded-lg hover:bg-stone-700 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2 bg-[#c5a880] text-stone-950 text-xs font-bold rounded-lg hover:bg-[#b2956c] transition-colors cursor-pointer"
                          >
                            Save Product
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Products Grid Inventory List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {dbProducts.map((prod) => (
                        <div key={prod.id} className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden p-4 flex flex-col justify-between space-y-4">
                          <div className="flex gap-3">
                            <div className="w-16 h-20 rounded-lg bg-stone-800 overflow-hidden shrink-0 relative">
                              <img src={prod.images[0]} alt={prod.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <span className="absolute bottom-1 right-1 bg-stone-950/80 text-[8px] px-1.5 py-0.5 rounded-sm font-mono text-stone-300 border border-stone-800">
                                {prod.id}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-bold text-stone-100 line-clamp-2">{prod.name}</h4>
                              <p className="text-[10px] text-[#c5a880] font-bold font-mono">BDT {prod.price}</p>
                              <p className="text-[9px] text-stone-400 capitalize">Category: {prod.category} | {prod.fabric}</p>
                              <div className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: prod.color === "black" ? "#000" : prod.color === "maroon" ? "#800000" : "#777" }}></span>
                                <span className="text-[9px] text-stone-500">{prod.colorLabel}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-stone-850/60">
                            <button
                              onClick={() => {
                                  setEditingProduct(prod);
                                  setProductForm(prod);
                                  setIsAddingProduct(false);
                              }}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-300 text-[11px] font-semibold rounded-lg border border-stone-700 transition-colors cursor-pointer"
                            >
                              <Edit className="w-3 h-3 text-[#c5a880]" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="py-1.5 px-3 bg-red-950/25 hover:bg-red-900 hover:text-white text-red-400 text-[11px] font-semibold rounded-lg border border-red-900/30 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
