import React, { useState } from "react";
import { Product } from "../types";
import { ChevronLeft, ChevronRight, Check, Heart, Shield, RefreshCw, Feather } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ProductViewerProps {
  products: Product[];
  currentProduct: Product;
  setCurrentProduct: (product: Product) => void;
  language: "en" | "bn";
  onAddToCart: (product: Product, size: string, color: string) => void;
  onInstantBuy: (product: Product, size: string, color: string) => void;
}

export default function ProductViewer({
  products,
  currentProduct,
  setCurrentProduct,
  language,
  onAddToCart,
  onInstantBuy,
}: ProductViewerProps) {
  const currentIndex = products.findIndex((p) => p.id === currentProduct.id);
  const [selectedSize, setSelectedSize] = useState<string>(currentProduct.sizes[0]);
  const [selectedColor, setSelectedColor] = useState<string>(currentProduct.colors[0].name);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });

  // Update states when product changes
  React.useEffect(() => {
    setSelectedSize(currentProduct.sizes[0]);
    setSelectedColor(currentProduct.colors[0].name);
  }, [currentProduct]);

  const changeProduct = (direction: number) => {
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = products.length - 1;
    if (nextIndex >= products.length) nextIndex = 0;
    setCurrentProduct(products[nextIndex]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  return (
    <div id="product-showcase-container" className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        
        {/* LEFT COLUMN: Collection Sidebar (3 cols on lg) */}
        <div className="lg:col-span-3 bg-neutral-50 p-4 border-r border-gray-100 lg:order-1 order-3 max-h-[600px] lg:max-h-none overflow-y-auto">
          <h3 className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-4 px-2">
            {language === "en" ? "PREMIUM COLLECTION" : "প্রিমিয়াম কালেকশন"}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3" id="sidebarList">
            {products.map((prod) => {
              const isSelected = prod.id === currentProduct.id;
              return (
                <button
                  key={prod.id}
                  onClick={() => setCurrentProduct(prod)}
                  className={`flex flex-col lg:flex-row gap-3 p-2.5 rounded-xl text-left border transition-all duration-300 ${
                    isSelected
                      ? "border-[#D4AF37] bg-amber-50/50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  id={`sidebar-item-${prod.id}`}
                >
                  <img
                    src={prod.image}
                    alt={prod.nameEn}
                    className="w-16 h-20 object-cover rounded-lg shadow-inner flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-col justify-between overflow-hidden">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 truncate">
                        {language === "en" ? prod.nameEn : prod.nameBn}
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
                        {language === "en" ? prod.fabricEn : prod.fabricBn}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-xs font-extrabold text-neutral-900">
                        BDT {prod.price}
                      </span>
                      {prod.discountBadge && (
                        <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded">
                          {prod.discountBadge}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN: Master Interactive Image Viewer (5 cols on lg) */}
        <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-neutral-950 flex flex-col justify-between relative min-h-[450px] sm:min-h-[550px] lg:order-2 order-1">
          {/* Discount and Floating badges */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            {currentProduct.discountBadge && (
              <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wider">
                {currentProduct.discountBadge}
              </span>
            )}
            <span className="bg-neutral-900/80 backdrop-blur-sm text-[#D4AF37] text-[10px] font-bold px-3 py-1 rounded-full border border-[#D4AF37]/30 tracking-widest uppercase">
              {language === "en" ? "AUTHENTIC DUBAI" : "১০০% দুবাই ইম্পোর্ট"}
            </span>
          </div>

          {/* Interactive Zoom Image Stage */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden rounded-xl bg-neutral-900">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentProduct.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="relative w-full h-full max-h-[500px] overflow-hidden group cursor-zoom-in"
                onMouseEnter={() => setIsZoomed(true)}
                onMouseLeave={() => setIsZoomed(false)}
                onMouseMove={handleMouseMove}
              >
                <img
                  id="view"
                  src={currentProduct.image}
                  alt={currentProduct.nameEn}
                  className={`w-full h-full object-contain select-none transition-transform duration-100 ${
                    isZoomed ? "scale-200" : "scale-100"
                  }`}
                  style={
                    isZoomed
                      ? {
                          transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                        }
                      : undefined
                  }
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </AnimatePresence>

            {/* Slider Navigation arrows */}
            <button
              onClick={() => changeProduct(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 active:scale-90 transition-all z-10"
              aria-label="Previous product"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => changeProduct(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 active:scale-90 transition-all z-10"
              aria-label="Next product"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Float BDT price tag in the photo corner */}
            <div
              id="homePriceTag"
              className="absolute bottom-4 right-4 bg-[#B8860B] text-black font-extrabold text-sm sm:text-base px-4 py-1.5 rounded-lg shadow-xl border border-yellow-200"
            >
              BDT {currentProduct.price}.00
            </div>
          </div>

          <p className="text-[11px] text-center text-gray-400 mt-3 font-mono">
            {language === "en" ? "💡 Tip: Hover over image to zoom details" : "💡 টিপ: নিখুঁত ফিনিশিং দেখতে ছবির উপর মাউস রাখুন"}
          </p>
        </div>

        {/* RIGHT COLUMN: Buying configurations and description (4 cols on lg) */}
        <div className="lg:col-span-4 p-6 sm:p-8 flex flex-col justify-between lg:order-3 order-2">
          <div>
            {/* Title & Reviews summary */}
            <h2 className="font-serif font-extrabold text-2xl sm:text-3xl text-gray-900 tracking-tight leading-tight">
              {language === "en" ? currentProduct.nameEn : currentProduct.nameBn}
            </h2>
            
            <div className="flex items-center gap-2 mt-2">
              <div className="flex text-amber-400 text-sm">★★★★★</div>
              <span className="text-xs text-gray-500 font-medium">(৩টি কাস্টমার রিভিউ)</span>
            </div>

            {/* Price Tags */}
            <div className="flex items-baseline gap-3 mt-4 border-b border-gray-100 pb-4">
              <span className="text-2xl sm:text-3xl font-black text-gray-900">
                BDT {currentProduct.price}
              </span>
              <span className="text-sm text-gray-400 line-through">
                BDT {currentProduct.originalPrice}
              </span>
            </div>

            {/* Fabric Details */}
            <div className="mt-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#B8860B]">
                <Feather className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs text-gray-400 block font-medium leading-none">
                  {language === "en" ? "Premium Fabric" : "কাপড়ের কোয়ালিটি"}
                </span>
                <span className="text-sm font-semibold text-gray-800">
                  {language === "en" ? currentProduct.fabricEn : currentProduct.fabricBn}
                </span>
              </div>
            </div>

            {/* Description Text */}
            <p className="text-sm text-gray-600 leading-relaxed mt-4">
              {language === "en" ? currentProduct.descriptionEn : currentProduct.descriptionBn}
            </p>

            {/* Color selection swatches */}
            <div className="mt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                {language === "en" ? "Select Color" : "রঙ সিলেক্ট করুন"}: <span className="text-gray-900 normal-case font-semibold">{selectedColor}</span>
              </span>
              <div className="flex items-center gap-3">
                {currentProduct.colors.map((col) => (
                  <button
                    key={col.name}
                    onClick={() => setSelectedColor(col.name)}
                    className={`w-7 h-7 rounded-full ${col.class} relative flex items-center justify-center focus:outline-none transition-transform active:scale-90`}
                    title={col.name}
                  >
                    {selectedColor === col.name && (
                      <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Size selection */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {language === "en" ? "Select Height Size" : "লম্বার সাইজ সিলেক্ট করুন"}:
                </span>
                <span className="text-xs font-bold text-[#B8860B]">
                  {selectedSize} Inch
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentProduct.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
                      selectedSize === size
                        ? "bg-[#111111] text-white border-black"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
<p className="text-[11px] text-gray-400 mt-1.5">
  📏 Recommended sizes by height: 52 (5'1"–5'3"), 54 (5'3"–5'5"), 56 (5'5"–5'7"), 58 (5'7" and above)
</p>
</div>
</div>

{/* Action CTAs: Add to Cart and Quick Booking */}
<div className="mt-8 pt-4 border-t border-gray-100 flex flex-col gap-3">
  <button
    onClick={() => onInstantBuy(currentProduct, selectedSize, selectedColor)}
    className="w-full bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold py-3.5 px-6 rounded-xl text-center shadow-lg hover:shadow-xl active:scale-[0.99] transition-all text-sm uppercase tracking-wider"
    id="instant-buy-btn"
  >
    ⚡ Order Now (Cash on Delivery)
  </button>

           <button
  onClick={async () => {
    if (!selectedSize || !selectedColor) return;
    // optionally: setAdding(true);
    await onAddToCart(currentProduct, selectedSize, selectedColor);
    // optionally: setAdding(false);
  }}
  className="w-full inline-flex justify-center items-center bg-white hover:bg-neutral-50 text-gray-900 border border-gray-300 font-bold py-3 px-6 rounded-xl active:scale-[0.99] transition-all text-xs uppercase tracking-wider"
  id={`add-to-cart-btn-${currentProduct.id}`}
  disabled={adding}
>
  {adding
    ? "Adding..."
    : "🛒 Add to Shopping Bag"}
</button>
            
      {/* Bullet features section */}
      <div className="bg-neutral-50 px-6 py-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500">
        {(language === "en" ? currentProduct.featuresEn : currentProduct.featuresBn).map((feat, i) => (
          <div key={i} className="flex items-center gap-2">
            <Check className="h-4 w-4 text-[#B8860B] flex-shrink-0" />
            <span>{feat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
