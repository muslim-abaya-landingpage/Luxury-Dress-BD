import React, { useState } from "react";
import { VideoItem } from "../types";
import { Play, X, ExternalLink, Sparkles } from "lucide-react";

interface VideoSectionProps {
  videos: VideoItem[];
  language: "en" | "bn";
}

export default function VideoSection({ videos, language }: VideoSectionProps) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const openVideoModal = (youtubeId: string) => {
    setSelectedVideoId(youtubeId);
  };

  const closeVideoModal = () => {
    setSelectedVideoId(null);
  };

  return (
    <section id="main-video-section" className="bg-white py-12 px-6 sm:px-8 border border-gray-200 rounded-3xl mb-12 shadow-sm">
      <div className="max-w-3xl mx-auto text-center mb-10">
        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-[#B8860B] border border-amber-200 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest mb-3">
          <Sparkles className="h-3 w-3 fill-current" />
          <span>{language === "en" ? "Real Product Showcase" : "ভিডিও কালেকশন"}</span>
        </div>
        <h2 className="font-serif font-extrabold text-2xl sm:text-3xl text-gray-900 tracking-tight leading-tight">
          {language === "en" 
            ? "See Premium Finishing & Royal Elegance in Our Dress Videos" 
            : "ভিডিওতে সরাসরি কাপড়ের নিখুঁত ফিনিশিং ও রাজকীয় ডিজাইন দেখুন"}
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          {language === "en" 
            ? "Watch real videos, check fabric details and flowiness, then order with 100% confidence." 
            : "অর্ডার করার পূর্বে আমাদের রিয়েল ভিডিও দেখে কাপড় এবং সেলাইয়ের ফিনিশিং মিলিয়ে নিন।"}
        </p>
      </div>

      {/* Video Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {videos.map((vid) => (
          <div
            key={vid.id}
            className="group bg-neutral-50 rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300"
          >
            {/* Facade Stage with Play Trigger */}
            <div className="relative aspect-video bg-black overflow-hidden cursor-pointer" onClick={() => openVideoModal(vid.youtubeId)}>
              <img
                src={vid.thumbnail}
                alt={vid.titleEn}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/35 group-hover:bg-black/20 transition-all flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-red-600 active:scale-95 transition-all">
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                </div>
              </div>
            </div>

            {/* Video description content */}
            <div className="p-4">
              <h4 className="text-sm font-extrabold text-gray-900 leading-tight">
                {language === "en" ? vid.titleEn : vid.titleBn}
              </h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {language === "en" ? vid.descriptionEn : vid.descriptionBn}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Embedded Feature Guidelines under the video list */}
      <div className="bg-neutral-50 rounded-2xl border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex gap-3">
          <div className="w-2 h-2 rounded-full bg-[#B8860B] mt-2 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-800">
              {language === "en" ? "Premium Fabric, Stitched Lovingly" : "প্রিমিয়াম কোয়ালিটি নিশ্চিত সেলাই"}
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {language === "en" 
                ? "Every abaya is tailored by master craftsmen using selected imported textiles with long lifetime." 
                : "আমাদের প্রতিটি আবায়া দক্ষ কারিগর দ্বারা সেলাইকৃত এবং আমদানিকৃত সেরা কাপড় ব্যবহারে দীর্ঘস্থায়ী ও আরামদায়ক।"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-2 h-2 rounded-full bg-[#B8860B] mt-2 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gray-800">
              {language === "en" ? "Quick Easy Orders & Support" : "সহজ অর্ডার ও ২৪/৭ লাইভ সাপোর্ট"}
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {language === "en" 
                ? "Select your dress, add to cart or talk to our live experts for complete sizing help." 
                : "আপনার পছন্দের ড্রেসটি কার্টে যুক্ত করুন অথবা সাইজ নিয়ে যেকোনো সহযোগিতার জন্য আমাদের সাথে সরাসরি যোগাযোগ করুন।"}
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
        <a
          href="#product-showcase-container"
          className="bg-[#111111] hover:bg-black text-white font-extrabold px-6 py-3 rounded-xl text-xs tracking-wider transition-all text-center w-full sm:w-auto"
        >
          🛍️ {language === "en" ? "Shop Collection Now" : "শপিং কালেকশন দেখুন"}
        </a>
        <a
          href="https://www.youtube.com/channel/UC-luxurydressbd" // Real Youtube Channel Placeholder
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white hover:bg-neutral-50 text-gray-800 border border-gray-300 font-bold px-6 py-3 rounded-xl text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>{language === "en" ? "Watch on YouTube" : "ইউটিউবে সাবস্ক্রাইব করুন"}</span>
        </a>
      </div>

      {/* 9:16 Portrait Aspect Ratio Video Modal (Exactly matches vertical shorts player) */}
      {selectedVideoId && (
        <div
          id="videoModal"
          className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-[85vh] bg-black rounded-3xl overflow-hidden shadow-2xl border border-neutral-800">
            {/* Close Button */}
            <button
              onClick={closeVideoModal}
              className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
              aria-label="Close video"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Embedded YouTube Iframe for Vertical Videos */}
            <iframe
              id="modalIframe"
              className="w-full h-full border-0"
              src={`https://www.youtube.com/embed/${selectedVideoId}?autoplay=1&rel=0&modestbranding=1&controls=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Product Video Player"
            />
          </div>
        </div>
      )}
    </section>
  );
}
