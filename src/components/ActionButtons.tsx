import React from "react";
import { Product } from "../types";
import { MessageSquare, Phone, MessageCircle } from "lucide-react";

interface ActionButtonsProps {
  currentProduct: Product;
  language: "en" | "en";
}

export default function ActionButtons({ currentProduct, language }: ActionButtonsProps) {
  // Pre-fill texts with chosen details
  const phoneNumber = "8801970831783";
  const rawNumber = "01970831783";
  
  const getEncodedText = () => {
  const text = `Assalamu Alaikum.

I would like to place an order for the following product:

✨ Product: ${currentProduct.nameEn}
🧵 Fabric: ${currentProduct.fabricEn}
💰 Price: BDT ${currentProduct.price}

🔗 Product Link:
${window.location.href}

Kindly confirm the availability of this product and guide me through the ordering process.

Thank you!
Best regards.`;

  return encodeURIComponent(text);
};

 return (
  <div className="mb-12">
    <div className="text-center mb-4">
      <h3 className="text-sm font-extrabold tracking-wider text-neutral-500 uppercase">
        🚀 QUICK & EASY ORDERING
      </h3>

      <p className="text-xs text-neutral-400 mt-1">
        Choose your preferred contact method below to place your order. We typically respond within a few minutes.
      </p>
    </div>
  </div>
);

     <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="action-buttons-wrapper">
  {/* WhatsApp Order Button */}
  <a
    href={`https://wa.me/${phoneNumber}?text=${getEncodedText()}`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20ba56] text-white font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all text-sm uppercase tracking-wide"
    id="whatsapp-order-btn"
  >
    <MessageCircle className="h-5 w-5 fill-current" />
    <span>Order via WhatsApp</span>
  </a>
</div>

  {/* IMO Button */}
<a
  href={`im://im?s=${rawNumber}`}
  className="flex items-center justify-center gap-3 bg-[#1D9BF0] hover:bg-[#188bd8] text-white font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all text-sm uppercase tracking-wide"
  id="imo-order-btn"
>
  <MessageSquare className="h-5 w-5 fill-current" />
  <span>Order via IMO</span>
</a>

{/* Call Now Button */}
<a
  href={`tel:${rawNumber}`}
  className="flex items-center justify-center gap-3 bg-neutral-900 hover:bg-black border border-neutral-800 text-[#D4AF37] font-extrabold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all text-sm uppercase tracking-wide"
  id="phone-order-btn"
>
  <Phone className="h-5 w-5" />
  <span>Call to Order</span>
</a>
