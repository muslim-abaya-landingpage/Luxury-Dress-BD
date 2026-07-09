import React from "react";
import { Truck, HandCoins, Sparkles, RefreshCw } from "lucide-react";

interface FeaturesSectionProps {
  language: "en" | "bn";
}

export default function FeaturesSection({ language }: FeaturesSectionProps) {
  const features = [
    {
      icon: <Truck className="h-6 w-6 text-[#B8860B]" />,
      titleEn: "Nationwide Home Delivery",
      titleBn: "সারাদেশে হোম ডেলিভারি",
      descEn: "Fast delivery within 24-48 hours inside Dhaka, and 2-3 days outside Dhaka.",
      descBn: "ঢাকার ভিতরে ২৪-৪৮ ঘণ্টায় এবং ঢাকার বাইরে ২-৩ দিনের মধ্যে হোম ডেলিভারি।"
    },
    {
      icon: <HandCoins className="h-6 w-6 text-[#B8860B]" />,
      titleEn: "Cash on Delivery (COD)",
      titleBn: "ক্যাশ অন ডেলিভারি সুবিধা",
      descEn: "Check quality and fitting at your home doorstep first, then pay the delivery rider.",
      descBn: "ডেলিভারি ম্যানের থেকে আগে প্রোডাক্ট বুঝে নিয়ে দেখে তারপর নিশ্চিন্তে বিল পে করুন।"
    },
    {
      icon: <Sparkles className="h-6 w-6 text-[#B8860B]" />,
      titleEn: "100% Premium Fabric",
      titleBn: "১০০% প্রিমিয়াম কাপড়ের নিশ্চয়তা",
      descEn: "Stitched with luxurious imported Cherry Georgette, Nida and Riyadh Linen.",
      descBn: "দুবাই চেরি জর্জেট, নিদা এবং রিয়াদ লিনেনের মতো প্রিমিয়াম আমদানিকৃত ফেব্রিক।"
    },
    {
      icon: <RefreshCw className="h-6 w-6 text-[#B8860B]" />,
      titleEn: "Easy Returns within 3 Days",
      titleBn: "৩ দিনের সহজ রিটার্ন পলিসি",
      descEn: "Not satisfied with color or fit? Return or exchange with easy doorstep pick-up.",
      descBn: "কালার বা সাইজ নিয়ে সমস্যা থাকলে খুব সহজে এক্সচেঞ্জ বা রিটার্ন করতে পারবেন।"
    }
  ];

  return (
    <div className="py-10 border-t border-b border-gray-100 bg-neutral-50 rounded-2xl p-6 sm:p-8 mb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {features.map((feat, index) => (
          <div
            key={index}
            className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-3"
            id={`feature-card-${index}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shadow-sm">
              {feat.icon}
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-neutral-900">
                {language === "en" ? feat.titleEn : feat.titleBn}
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {language === "en" ? feat.descEn : feat.descBn}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
