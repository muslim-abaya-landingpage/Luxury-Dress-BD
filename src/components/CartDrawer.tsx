import React, { useState } from "react";
import { CartItem, OrderDetails } from "../types";
import { X, Trash2, ShoppingBag, Plus, Minus, CheckCircle, Truck, ShieldCheck, HeartHandshake } from "lucide-react";
import { motion } from "motion/react";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  language: "en" | "bn";
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  language,
}: CartDrawerProps) {
  // Order Form states
  const [formData, setFormData] = useState<OrderDetails>({
    name: "",
    phone: "",
    address: "",
    city: "Dhaka", // Default inside Dhaka
    notes: "",
  });

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OrderDetails, string>>>({});
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");

  const deliveryCharge = formData.city === "Dhaka" ? 80 : 150;
  const subtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const total = subtotal + deliveryCharge;

  const validateForm = () => {
    const errors: Partial<Record<keyof OrderDetails, string>> = {};
    if (!formData.name.trim()) {
      errors.name = language === "en" ? "Name is required" : "আপনার নাম লিখুন";
    }
    const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;
    if (!formData.phone.trim()) {
      errors.phone = language === "en" ? "Phone number is required" : "মোবাইল নাম্বার লিখুন";
    } else if (!phoneRegex.test(formData.phone.replace(/\s+/g, ""))) {
      errors.phone = language === "en" ? "Provide a valid Bangladeshi number" : "সঠিক মোবাইল নাম্বার দিন (যেমন: 01712345678)";
    }
    if (!formData.address.trim()) {
      errors.address = language === "en" ? "Full address is required for home delivery" : "ডেলিভারির জন্য সম্পূর্ণ ঠিকানা লিখুন";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsOrdering(true);
    // Simulate API database write
    setTimeout(() => {
      setIsOrdering(false);
      setOrderSuccess(true);
      const generatedId = "MA-" + Math.floor(100000 + Math.random() * 900000);
      setOrderId(generatedId);
      onClearCart();
      // Reset form
      setFormData({ name: "", phone: "", address: "", city: "Dhaka", notes: "" });
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex justify-end" id="cart-drawer-container">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="relative w-full max-w-lg bg-white h-full flex flex-col shadow-2xl z-10 overflow-hidden">
        {/* Header */}
        <div className="bg-[#111111] text-[#F3E5AB] px-6 py-5 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#D4AF37]" />
            <span className="font-serif font-extrabold text-lg tracking-wide uppercase">
              {language === "en" ? "Your Shopping Bag" : "আপনার শপিং ব্যাগ"}
            </span>
            <span className="bg-[#D4AF37] text-black text-xs font-bold px-2 py-0.5 rounded-full">
              {cartItems.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors"
            id="close-cart-drawer"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Content (Success, Empty, or Items List) */}
        <div className="flex-1 overflow-y-auto p-6">
          {orderSuccess ? (
            /* Successful simulated checkout message screen */
            <div className="flex flex-col items-center justify-center text-center h-full py-8 px-4" id="order-success-screen">
              <div className="w-16 h-16 bg-emerald-50 rounded-full border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="font-serif font-extrabold text-xl text-neutral-900 leading-tight">
                {language === "en" ? "Alhamdulillah! Order Placed" : "আলহামদুলিল্লাহ! অর্ডার সফল হয়েছে"}
              </h3>
              <p className="text-sm text-[#B8860B] font-mono font-bold mt-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 inline-block">
                Order ID: {orderId}
              </p>
              <div className="bg-neutral-50 rounded-2xl border border-gray-100 p-5 mt-6 w-full text-left space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {language === "en" ? "WHAT'S NEXT?" : "এরপর কি হবে?"}
                </h4>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-[#B8860B] flex items-center justify-center text-xs font-bold flex-shrink-0">১</div>
                  <p className="text-xs text-gray-600">
                    {language === "en" 
                      ? "Our representative will call you within 1-2 hours to confirm details." 
                      : "আমাদের একজন প্রতিনিধি ১-২ ঘণ্টার মধ্যে ফোন করে আপনার সাইজ ও ঠিকানা কনফার্ম করবেন।"}
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-[#B8860B] flex items-center justify-center text-xs font-bold flex-shrink-0">২</div>
                  <p className="text-xs text-gray-600">
                    {language === "en" 
                      ? "We will pack with free premium matching hijab and hand it over to delivery." 
                      : "ফ্রি ম্যাচিং হিজাবসহ যত্ন সহকারে প্যাক করে ডেলিভারি পার্টনারের কাছে প্রোডাক্ট বুঝিয়ে দেয়া হবে।"}
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-[#B8860B] flex items-center justify-center text-xs font-bold flex-shrink-0">৩</div>
                  <p className="text-xs text-gray-600">
                    {language === "en" 
                      ? "Get home delivery in 24-48 hours. Pay cash only after checking product quality!" 
                      : "২৪ থেকে ৪৮ ঘন্টার মধ্যে হোম ডেলিভারি পাবেন। প্রোডাক্ট হাতে পেয়ে কোয়ালিটি দেখে তারপর পেমেন্ট করবেন!"}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-3 w-full">
                <a
                  href={`https://wa.me/8801970831783?text=${encodeURIComponent(`Salam. My order ID is ${orderId}. Please confirm it.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block bg-[#25D366] hover:bg-[#20ba56] text-white font-extrabold py-3 rounded-xl text-center text-xs tracking-wider transition-all"
                >
                  💬 Speed Up Order on WhatsApp
                </a>
                <button
                  onClick={() => {
                    setOrderSuccess(false);
                    onClose();
                  }}
                  className="w-full bg-neutral-900 hover:bg-black text-white font-bold py-3 rounded-xl text-xs tracking-wider transition-all"
                >
                  {language === "en" ? "Continue Shopping" : "শপিং চালিয়ে যান"}
                </button>
              </div>
            </div>
          ) : cartItems.length === 0 ? (
            /* Empty Cart Screen */
            <div className="flex flex-col items-center justify-center text-center h-full py-8 px-4" id="empty-cart-screen">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <h3 className="font-serif font-extrabold text-lg text-neutral-800">
                {language === "en" ? "Your bag is empty" : "আপনার শপিং ব্যাগটি খালি"}
              </h3>
              <p className="text-xs text-gray-500 mt-2 max-w-xs">
                {language === "en"
                  ? "Explore our collections, add beautiful abayas to your cart, and check out instantly!"
                  : "আমাদের গর্জিয়াস কালেকশনগুলো দেখুন, পছন্দের আবায়া ব্যাগে যুক্ত করুন এবং ক্যাশ অন ডেলিভারিতে অর্ডার করুন!"}
              </p>
              <button
                onClick={onClose}
                className="mt-6 bg-[#B8860B] hover:bg-[#9B700A] text-black font-extrabold px-6 py-2.5 rounded-xl text-xs tracking-wider transition-colors uppercase"
              >
                {language === "en" ? "Explore Abayas" : "আবামা কালেকশন দেখুন"}
              </button>
            </div>
          ) : (
            /* Cart Items List & Delivery Form */
            <div className="space-y-8">
              {/* Product list */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {language === "en" ? "ITEMS IN BAG" : "ব্যাগে থাকা প্রোডাক্টসমূহ"}
                </h3>
                <div className="space-y-3.5 divide-y divide-gray-100">
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex gap-4 pt-3.5 first:pt-0">
                      <img
                        src={item.product.image}
                        alt={item.product.nameEn}
                        className="w-16 h-20 object-cover rounded-xl border border-gray-100 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between gap-1">
                            <h4 className="text-sm font-bold text-gray-900 leading-tight">
                              {language === "en" ? item.product.nameEn : item.product.nameBn}
                            </h4>
                            <button
                              onClick={() => onRemoveItem(index)}
                              className="text-gray-400 hover:text-red-600 p-0.5 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium mt-1">
                            {language === "en" ? "Size" : "সাইজ"}: <span className="text-gray-800 font-bold">{item.selectedSize}</span> | {language === "en" ? "Color" : "কালার"}: <span className="text-gray-800 font-bold">{item.selectedColor}</span>
                          </p>
                        </div>
                        {/* Stepper counter */}
                        <div className="flex items-center justify-between mt-2.5">
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <button
                              onClick={() => onUpdateQuantity(index, -1)}
                              className="p-1 hover:bg-gray-50 text-gray-500 transition-colors"
                              title="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="px-3 py-0.5 text-xs font-extrabold text-neutral-950 font-mono">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(index, 1)}
                              className="p-1 hover:bg-gray-50 text-gray-500 transition-colors"
                              title="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-extrabold text-gray-900">
                            BDT {item.product.price * item.quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Order Placement Form */}
              <div className="border-t border-gray-100 pt-6">
                <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-4 mb-4 flex gap-3">
                  <Truck className="h-5 w-5 text-[#B8860B] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">
                      {language === "en" ? "Cash on Delivery Available!" : "সারাদেশে ক্যাশ অন ডেলিভারি!"}
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {language === "en" 
                        ? "Check fabric and stitching and pay when you receive it at your doorstep." 
                        : "ডেলিভারি ম্যানের সামনে প্রোডাক্ট দেখে তারপর সম্পূর্ণ টাকা পরিশোধ করবেন।"}
                    </p>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  {language === "en" ? "DELIVERY INFORMATION" : "ডেলিভারি শিপিং ফর্ম"}
                </h3>
                <form onSubmit={handleOrderSubmit} className="space-y-4">
                  {/* Name field */}
                  <div>
                    <label htmlFor="customer-name" className="block text-xs font-semibold text-gray-700 mb-1">
                      {language === "en" ? "Full Name *" : "আপনার নাম লিখুন *"}
                    </label>
                    <input
                      type="text"
                      id="customer-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Nusrat Tasnim"
                      className={`block w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                        formErrors.name 
                          ? "border-red-500 focus:ring-red-500 focus:border-red-500" 
                          : "border-gray-200 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-red-500 text-[11px] mt-1">{formErrors.name}</p>
                    )}
                  </div>

                  {/* Phone field */}
                  <div>
                    <label htmlFor="customer-phone" className="block text-xs font-semibold text-gray-700 mb-1">
                      {language === "en" ? "Active Mobile Number *" : "সচল মোবাইল নাম্বার *"}
                    </label>
                    <input
                      type="tel"
                      id="customer-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 017XXXXXXXX"
                      className={`block w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                        formErrors.phone 
                          ? "border-red-500 focus:ring-red-500 focus:border-red-500" 
                          : "border-gray-200 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                      }`}
                    />
                    {formErrors.phone && (
                      <p className="text-red-500 text-[11px] mt-1">{formErrors.phone}</p>
                    )}
                  </div>

                  {/* City Select System */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      {language === "en" ? "Delivery Region *" : "ডেলিভারি এলাকা *"}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, city: "Dhaka" })}
                        className={`py-2 px-3 text-xs font-bold border rounded-xl flex items-center justify-between transition-all ${
                          formData.city === "Dhaka"
                            ? "border-[#D4AF37] bg-amber-50/20 text-[#B8860B]"
                            : "border-gray-200 text-gray-700 bg-white"
                        }`}
                      >
                        <span>{language === "en" ? "Inside Dhaka" : "ঢাকার ভিতরে"}</span>
                        <span className="font-mono bg-neutral-100 text-neutral-800 text-[10px] px-1.5 py-0.5 rounded">
                          BDT 80
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, city: "Outside" })}
                        className={`py-2 px-3 text-xs font-bold border rounded-xl flex items-center justify-between transition-all ${
                          formData.city === "Outside"
                            ? "border-[#D4AF37] bg-amber-50/20 text-[#B8860B]"
                            : "border-gray-200 text-gray-700 bg-white"
                        }`}
                      >
                        <span>{language === "en" ? "Outside Dhaka" : "ঢাকার বাইরে"}</span>
                        <span className="font-mono bg-neutral-100 text-neutral-800 text-[10px] px-1.5 py-0.5 rounded">
                          BDT 150
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Full Address */}
                  <div>
                    <label htmlFor="customer-address" className="block text-xs font-semibold text-gray-700 mb-1">
                      {language === "en" ? "Full Delivery Address *" : "সম্পূর্ণ ঠিকানা লিখুন *"}
                    </label>
                    <textarea
                      id="customer-address"
                      rows={2}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder={language === "en" ? "e.g. House 14, Road 5, Sector 3, Uttara, Dhaka" : "যেমন: হাউজ ১৪, রোড ৫, সেক্টর ৩, উত্তরা, ঢাকা"}
                      className={`block w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                        formErrors.address 
                          ? "border-red-500 focus:ring-red-500 focus:border-red-500" 
                          : "border-gray-200 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                      }`}
                    />
                    {formErrors.address && (
                      <p className="text-red-500 text-[11px] mt-1">{formErrors.address}</p>
                    )}
                  </div>

                  {/* Order Notes */}
                  <div>
                    <label htmlFor="customer-notes" className="block text-xs font-semibold text-gray-700 mb-1">
                      {language === "en" ? "Order Notes (Optional)" : "বিশেষ অনুরোধ/নোট (ঐচ্ছিক)"}
                    </label>
                    <input
                      type="text"
                      id="customer-notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder={language === "en" ? "e.g. Call before delivery, urgent" : "যেমন: সাইজ ৫৪ দিবেন অবশ্যই, ডেলিভারির আগে কল করবেন"}
                      className="block w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                    />
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer Pricing Summary */}
        {!orderSuccess && cartItems.length > 0 && (
          <div className="bg-neutral-50 px-6 py-5 border-t border-gray-200">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{language === "en" ? "Subtotal" : "উপমোট"}</span>
                <span className="font-mono">BDT {subtotal}.00</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{language === "en" ? "Delivery Charge" : "ডেলিভারি চার্জ"}</span>
                <span className="font-mono">BDT {deliveryCharge}.00</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-neutral-900 border-t border-gray-200/60 pt-2">
                <span>{language === "en" ? "Total Payable" : "সর্বমোট মূল্য"}</span>
                <span className="font-mono text-base text-[#B8860B]">BDT {total}.00</span>
              </div>
            </div>

            {/* Simulated order processing indicator */}
            <button
              onClick={handleOrderSubmit}
              disabled={isOrdering}
              className={`w-full bg-gradient-to-r from-[#AA7C11] to-[#B8860B] hover:opacity-95 text-black font-extrabold py-3.5 px-6 rounded-xl text-center shadow-md active:scale-[0.99] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${
                isOrdering ? "cursor-wait opacity-80" : ""
              }`}
            >
              {isOrdering ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></span>
                  <span>{language === "en" ? "PROCESSING ORDER..." : "অর্ডার প্রসেস হচ্ছে..."}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4.5 w-4.5" />
                  <span>
                    {language === "en" 
                      ? "PLACE ORDER (CASH ON DELIVERY)" 
                      : "অর্ডার কনফার্ম করুন (ক্যাশ অন ডেলিভারি)"}
                  </span>
                </>
              )}
            </button>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 mt-3">
              <HeartHandshake className="h-3.5 w-3.5 text-[#B8860B]" />
              <span>{language === "en" ? "100% Secure Checkout. Cancel anytime." : "১০০% নিরাপদ শপিং। যেকোনো সময় বাতিল করতে পারবেন।"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
