import React from "react";
import { Product } from "../types";
import { MessageSquare, Phone, MessageCircle } from "lucide-react";

interface ActionButtonsProps {
  currentProduct: Product;
  language: "en" | "bn";
}

export default function ActionButtons({ currentProduct, language }: ActionButtonsProps) {
  // Pre-fill texts with chosen details
  const phoneNumber = "8801970831783";
  const rawNumber = "01970831783";
  
  const getEncodedText = () => {
    const text = language === "en"
      ? `Assalamu Alaikum. I want to order the "${currentProduct.nameEn}" Abaya.\n- Fabric: ${currentProduct.fabricEn}\n- Price: BDT ${currentProduct.price}\n- App URL: ${window.location.href}`
      : `আসসালামু আলাইকুম। আমি আপনার "${currentProduct.nameBn}" আবায়াটি অর্ডার করতে চাই।\n- ফেব্রিক: ${currentProduct.fabricBn}\n- মূল্য: BDT ${currentProduct.price}\n- সাইট লিংক: ${window.location.href}`;
    return encodeURIComponent(text);
  };

  return (
    <div className="mb-12">
      <div className="text-center mb-4">
        <h3 className="text-sm font-extrabold tracking-wider text-neutral-500 uppercase">
          {language === "en" ? "✨ INSTANT TWO-CLICK ORDERING ✨" : "✨ দ্রুত সরাসরি অর্ডার করার মাধ্যম ✨"}
        </h3>
        <p className="text-xs text-neutral-400 mt-0.5">
          {language === "en" 
            ? "Order directly on WhatsApp, IMO or Call. Our team is online 24/7." 
            : "হোয়াটসঅ্যাপ, ইমো অথবা সরাসরি কল করে অর্ডার কনফার্ম করুন। আমাদের টিম সবসময় প্রস্তুত।"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="action-buttons-wrapper">
        {/* WhatsApp Premium Button */}
        <a
          href={`https://wa.me/${phoneNumber}?text=${getEncodedText()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20ba56] text-white font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all text-sm uppercase tracking-wide"
          id="whatsapp-order-btn"
        >
          {/* Custom WhatsApp Icon or Lucide MessageCircle */}
          <MessageCircle className="h-5 w-5 fill-current" />
          <span>
            {language === "en" ? "Order on WhatsApp" : "হোয়াটসঅ্যাপে অর্ডার দিন"}
          </span>
        </a>

        {/* IMO Premium Button */}
        <a
          href={`im://im?s=${rawNumber}`}
          className="flex items-center justify-center gap-3 bg-[#1D9BF0] hover:bg-[#188bd8] text-white font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all text-sm uppercase tracking-wide"
          id="imo-order-btn"
        >
          <MessageSquare className="h-5 w-5 fill-current" />
          <span>
            {language === "en" ? "Order on IMO" : "ইমো (IMO) তে অর্ডার দিন"}
          </span>
        </a>

        {/* Call Now Button */}
        <a
          href={`tel:${rawNumber}`}
          className="flex items-center justify-center gap-3 bg-neutral-900 hover:bg-black border border-neutral-800 text-[#D4AF37] font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all text-sm uppercase tracking-wide"
          id="phone-order-btn"
        >
          <Phone className="h-5 w-5" />
          <span>
            {language === "en" ? "Call for order" : "সরাসরি কল করে অর্ডার দিন"}
          </span>
        </a>
      </div>
    </div>
  );
}
