import React, { useState } from "react";
import { CartItem, OrderDetails } from "../types";
import {
  X,
  Trash2,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle,
  Truck,
  ShieldCheck,
  HeartHandshake,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion"; // যদি motion/react এ সমস্যা করে তবে framer-motion ব্যবহার করুন

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  language?: string;
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
  const [formData, setFormData] = useState<OrderDetails>({
    name: "",
    phone: "",
    address: "",
    city: "Dhaka",
    notes: "",
  });

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OrderDetails, string>>>( {});
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");

  const deliveryCharge = formData.city === "Dhaka" ? 80 : 150;
  const subtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const total = subtotal + deliveryCharge;

  const validateForm = () => {
    const errors: Partial<Record<keyof OrderDetails, string>> = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    const phoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;

    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!phoneRegex.test(formData.phone.replace(/\s+/g, ""))) {
      errors.phone = "Please enter a valid Bangladeshi phone number (e.g. 01712345678)";
    }

    if (!formData.address.trim()) {
      errors.address = "Full address is required for home delivery";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsOrdering(true);
    setTimeout(() => {
      setIsOrdering(false);
      setOrderSuccess(true);
      const generatedId = "MA-" + Math.floor(100000 + Math.random() * 900000);
      setOrderId(generatedId);
      onClearCart();
      setFormData({ name: "", phone: "", address: "", city: "Dhaka", notes: "" });
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" id="cart-drawer-container">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer Body */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="relative w-full max-w-lg bg-white h-full flex flex-col shadow-2xl z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#111111] text-[#F3E5AB] px-6 py-5 flex items-center justify-between border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#D4AF37]" />
                <span className="font-serif font-extrabold text-lg tracking-wide uppercase">
                  Your Shopping Bag
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

            {/* Form Wrap - লজিক্যাল ফিক্স: সফল স্ক্রিন না হলে পুরো কন্টেন্ট ফর্মের ভেতরে থাকবে */}
            {!orderSuccess && cartItems.length > 0 ? (
              <form onSubmit={handleOrderSubmit} className="flex-1 flex flex-col overflow-hidden">
                {/* Dynamic Content (Scrollable Area) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Product List */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Items in Your Bag
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
                                  {item.product.nameEn}
                                </h4>

                                <button
                                  type="button" // type="button" দেওয়া জরুরি যাতে এটি ফর্ম সাবমিট না করে দেয়
                                  onClick={() => onRemoveItem(index)}
                                  className="text-gray-400 hover:text-red-600 p-0.5 transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>

                              <p className="text-[11px] text-gray-500 font-medium mt-1">
                                Size: <span className="text-gray-800 font-bold">{item.selectedSize}</span> | Color: <span className="text-gray-800 font-bold">{item.selectedColor}</span>
                              </p>
                            </div>

                            {/* Quantity Stepper */}
                            <div className="flex items-center justify-between mt-2.5">
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                <button
                                  type="button"
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
                                  type="button"
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

                  {/* Delivery Info */}
                  <div className="border-t border-gray-100 pt-6 space-y-4">
                    <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-4 flex gap-3">
                      <Truck className="h-5 w-5 text-[#B8860B] flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-gray-800">
                          Cash on Delivery Available!
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Inspect your order upon delivery and pay only after you're satisfied with the product.
                        </p>
                      </div>
                    </div>

                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Delivery Information
                    </h3>

                    {/* Input Fields */}
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="customer-name" className="block text-xs font-semibold text-gray-700 mb-1">
                          Full Name *
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
                        {formErrors.name && <p className="text-red-500 text-[11px] mt-1">{formErrors.name}</p>}
                      </div>

                      <div>
                        <label htmlFor="customer-phone" className="block text-xs font-semibold text-gray-700 mb-1">
                          Mobile Number *
                        </label>
                        <input
                          type="tel"
                          id="customer-phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="e.g. 01712345678"
                          className={`block w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                            formErrors.phone
                              ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                              : "border-gray-200 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                          }`}
                        />
                        {formErrors.phone && <p className="text-red-500 text-[11px] mt-1">{formErrors.phone}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          Delivery Area *
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
                            <span>Inside Dhaka</span>
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
                            <span>Outside Dhaka</span>
                            <span className="font-mono bg-neutral-100 text-neutral-800 text-[10px] px-1.5 py-0.5 rounded">
                              BDT 150
                            </span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="customer-address" className="block text-xs font-semibold text-gray-700 mb-1">
                          Full Delivery Address *
                        </label>
                        <textarea
                          id="customer-address"
                          rows={2}
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="e.g. House 14, Road 5, Sector 3, Uttara, Dhaka"
                          className={`block w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                            formErrors.address
                              ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                              : "border-gray-200 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                          }`}
                        />
                        {formErrors.address && <p className="text-red-500 text-[11px] mt-1">{formErrors.address}</p>}
                      </div>

                      <div>
                        <label htmlFor="customer-notes" className="block text-xs font-semibold text-gray-700 mb-1">
                          Order Notes (Optional)
                        </label>
                        <input
                          type="text"
                          id="customer-notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="e.g. Please call before delivery"
                          className="block w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Pricing Summary (Inside Form) */}
                <div className="bg-neutral-50 px-6 py-5 border-t border-gray-200">
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Subtotal</span>
                      <span className="font-mono">BDT {subtotal}.00</span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Delivery Fee</span>
                      <span className="font-mono">BDT {deliveryCharge}.00</span>
                    </div>

                    <div className="flex justify-between text-sm font-extrabold text-neutral-900 border-t border-gray-200/60 pt-2">
                      <span>Total Amount</span>
                      <span className="font-mono text-base text-[#B8860B]">
                        BDT {total}.00
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isOrdering}
                    className={`w-full bg-gradient-to-r from-[#AA7C11] to-[#B8860B] hover:opacity-95 text-black font-extrabold py-3.5 px-6 rounded-xl text-center shadow-md active:scale-[0.99] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${
                      isOrdering ? "cursor-wait opacity-80" : ""
                    }`}
                  >
                    {isOrdering ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></span>
                        <span>PROCESSING ORDER...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4.5 w-4.5" />
                        <span>PLACE ORDER (CASH ON DELIVERY)</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 mt-3">
                    <HeartHandshake className="h-3.5 w-3.5 text-[#B8860B]" />
                    <span>100% Secure Checkout. Cancel anytime.</span>
                  </div>
                </div>
              </form>
            ) : orderSuccess ? (
              /* Successful Checkout Screen */
              <div className="flex-1 overflow-y-auto p-6">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center text-center h-full py-8 px-4" 
                  id="order-success-screen"
                >
                  <div className="w-16 h-16 bg-emerald-50 rounded-full border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4">
                    <CheckCircle className="h-10 w-10 animate-bounce" />
                  </div>

                  <h3 className="font-serif font-extrabold text-xl text-neutral-900 leading-tight">
                    Alhamdulillah! Order Placed
                  </h3>

                  <p className="text-sm text-[#B8860B] font-mono font-bold mt-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 inline-block">
                    Order ID: {orderId}
                  </p>

                  <div className="bg-neutral-50 rounded-2xl border border-gray-100 p-5 mt-6 w-full text-left space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      What's Next?
                    </h4>
                    {/* Steps descriptions... */}
                    <div className="flex gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-[#B8860B] flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                      <p className="text-xs text-gray-600">
                        Our representative will call you within 1–2 hours to confirm details.
                      </p>
                    </div>
                    <div className="flex gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-[#B8860B] flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                      <p className="text-xs text-gray-600">
                        We will pack your order securely with your premium matching hijab.
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-3 w-full">
                    <a
                      href={`https://wa.me/8801970831783?text=${encodeURIComponent(
                        `Salam. My order ID is ${orderId}. Please confirm it.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba56] text-white font-extrabold py-3 rounded-xl text-center text-sm tracking-wider transition-all"
                    >
                      <FaWhatsapp className="h-5 w-5" />
                      <span>Speed Up Order on WhatsApp</span>
                    </a>

                    <button
                      onClick={() => {
                        onClose();
                        setTimeout(() => {
                          setOrderSuccess(false);
                        }, 300);
                      }}
                      className="w-full bg-neutral-900 hover:bg-black text-white font-bold py-3 rounded-xl text-sm tracking-wider transition-all"
                    >
                      Continue Shopping
                    </button>
                  </div>
                </motion.div>
              </div>
            ) : (
              /* Empty Cart Screen */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6" id="empty-cart-screen">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <h3 className="font-serif font-extrabold text-lg text-neutral-800">
                  Your Shopping Bag is Empty
                </h3>
                <button
                  onClick={onClose}
                  className="mt-6 bg-[#B8860B] hover:bg-[#9B700A] text-black font-extrabold px-6 py-2.5 rounded-xl text-xs tracking-wider transition-colors uppercase"
                >
                  Explore Our Collection
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
