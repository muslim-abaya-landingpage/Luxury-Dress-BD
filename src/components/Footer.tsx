import React from "react";
import { Phone, MapPin, Mail, ShieldCheck } from "lucide-react";

interface FooterProps {
  language: "en" | "bn";
}

export default function Footer({ language }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="app-footer" className="bg-[#111111] text-gray-400 py-12 border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo Brand column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border border-[#D4AF37] flex items-center justify-center bg-neutral-900">
                <span className="font-serif font-bold text-sm text-[#D4AF37]">M</span>
              </div>
              <h4 className="font-serif font-extrabold text-base text-white tracking-wide uppercase">
                Muslim <span className="text-[#D4AF37]">Abaya</span>
              </h4>
            </div>
            <p className="text-xs leading-relaxed text-gray-400">
              {language === "en"
                ? "The most trusted premium online Modest Fashion retailer in Bangladesh. Delivering soft hand-tailored premium Abayas, Hijabs and Two-pieces."
                : "বাংলাদেশের অন্যতম বিশ্বস্ত প্রিমিয়াম অনলাইন মডেস্ট ফ্যাশন শপ। আমরা সরবরাহ করছি আমদানিকৃত নরম কাপড়ে তৈরি গর্জিয়াস আবায়া, হিজাব এবং টু-পিস।"}
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              {language === "en" ? "SHOPPING LINKS" : "গুরুত্বপূর্ণ লিংক সমূহ"}
            </h5>
            <ul className="text-xs space-y-2">
              <li>
                <a href="#product-showcase-container" className="hover:text-white transition-colors">
                  {language === "en" ? "Premium Collection" : "প্রিমিয়াম আবায়া কালেকশন"}
                </a>
              </li>
              <li>
                <a href="#main-video-section" className="hover:text-white transition-colors">
                  {language === "en" ? "Real Product Videos" : "ভিডিও গ্যালারি"}
                </a>
              </li>
              <li>
                <a href="#reviews-section" className="hover:text-white transition-colors">
                  {language === "en" ? "Customer Reviews" : "কাস্টমার ফিডব্যাক"}
                </a>
              </li>
            </ul>
          </div>

          {/* Policies info */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              {language === "en" ? "POLICIES" : "শর্তাবলী ও পলিসি"}
            </h5>
            <ul className="text-xs space-y-2">
              <li>
                <span>{language === "en" ? "🛡️ 100% Secure Checkout" : "🛡️ ১০০% নিরাপদ শপিং"}</span>
              </li>
              <li>
                <span>{language === "en" ? "📦 Return/Exchange Policy" : "📦 প্রোডাক্ট রিটার্ন/রিপ্লেসমেন্ট"}</span>
              </li>
              <li>
                <span>{language === "en" ? "🚚 Nationwide Cash on Delivery" : "🚚 সারাদেশে ক্যাশ অন ডেলিভারি"}</span>
              </li>
            </ul>
          </div>

          {/* Contacts information */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              {language === "en" ? "GET IN TOUCH" : "যোগাযোগ করুন"}
            </h5>
            <ul className="text-xs space-y-2.5">
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-[#D4AF37]" />
                <a href="tel:01970831783" className="hover:text-white transition-colors font-mono">
                  +8801970831783
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-[#D4AF37]" />
                <a href="mailto:muslimabeya@gmail.com" className="hover:text-white transition-colors">
                  muslimabeya@gmail.com
                </a>
              </li>
              <li className="flex gap-2">
                <MapPin className="h-3.5 w-3.5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                <span>Mirpur, Dhaka, Bangladesh</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright notice block */}
        <div className="border-t border-neutral-800/80 pt-8 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>© {currentYear} Muslim Abaya (muslimabaya.com). All Rights Reserved.</p>
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-[#B8860B]" />
            <span>Premium Secured Store</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
