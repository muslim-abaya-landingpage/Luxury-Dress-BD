import React, { useState } from "react";
import { ShoppingBag, Search, Globe, Phone, AlertCircle } from "lucide-react";

interface HeaderProps {
  language: "en" | "bn";
  setLanguage: (lang: "en" | "bn") => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cartCount: number;
  onCartClick: () => void;
}

export default function Header({
  language,
  setLanguage,
  searchQuery,
  setSearchQuery,
  cartCount,
  onCartClick,
}: HeaderProps) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header id="app-header" className="sticky top-0 z-50 bg-[#111111] text-[#F3E5AB] border-b border-[#2C2C2C] shadow-md transition-all duration-300">
      {/* Notice bar standard for Bangladesh Cash On Delivery */}
      <div className="bg-[#B8860B] text-[#111111] text-center py-2 px-4 text-xs font-medium tracking-wide">
        {language === "en" ? (
          <span>🚚 <strong>Cash on Delivery</strong> nationwide! Free matching Hijab with every Abaya.</span>
        ) : (
          <span>🚚 সারা বাংলাদেশে <strong>ক্যাশ অন ডেলিভারি</strong>! প্রতিটি আবায়ার সাথে আকর্ষণীয় হিজাব একদম ফ্রি।</span>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo Brand Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#D4AF37] flex items-center justify-center bg-gradient-to-tr from-neutral-900 to-neutral-800">
              <span className="font-serif font-extrabold text-lg text-[#D4AF37]">M</span>
            </div>
            <div>
              <h1 className="font-serif font-extrabold text-xl tracking-tight text-white leading-none">
                Muslim <span className="text-[#D4AF37]">Abaya</span>
              </h1>
              <p className="text-[9px] text-gray-400 font-mono tracking-wider">muslimabaya.com</p>
            </div>
          </div>

          {/* Search bar inside header (Desktop) */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              id="desktop-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "en" ? "Search premium collection..." : "পছন্দের কালেকশন খুঁজুন..."}
              className="block w-full pl-10 pr-4 py-2 border border-neutral-700 rounded-full bg-neutral-900 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] text-sm"
            />
          </div>

          {/* Navigation Items */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Direct Phone Tab */}
            <a
              href="tel:01970831783"
              className="hidden sm:flex items-center gap-1.5 text-xs text-gray-300 hover:text-[#D4AF37] transition-colors"
              id="header-phone-link"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="font-mono">01970831783</span>
            </a>

            {/* Language Toggle Button */}
            <button
              onClick={() => setLanguage(language === "en" ? "bn" : "en")}
              className="flex items-center gap-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2.5 sm:px-3 py-1.5 rounded-full text-xs text-[#F3E5AB] transition-all"
              id="lang-toggle-btn"
              title={language === "en" ? "বাংলা করুন" : "Switch to English"}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{language === "en" ? "বাংলা" : "English"}</span>
            </button>

            {/* Mobile Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-1.5 md:hidden hover:text-[#D4AF37] text-gray-300 transition-colors"
              id="mobile-search-toggle"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Premium Interactive Cart Bag Button */}
            <button
              onClick={onCartClick}
              className="relative p-2 bg-gradient-to-tr from-[#D4AF37] to-[#AA7C11] text-black hover:opacity-90 active:scale-95 rounded-full shadow-md transition-all duration-200"
              id="header-cart-btn"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-[#111111] animate-bounce">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar Expansion */}
        {showSearch && (
          <div className="py-3 md:hidden border-t border-neutral-800 animate-slide-down">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                id="mobile-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "en" ? "Search premium collection..." : "পছন্দের কালেকশন খুঁজুন..."}
                className="block w-full pl-10 pr-4 py-2.5 border border-neutral-700 rounded-lg bg-neutral-900 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
