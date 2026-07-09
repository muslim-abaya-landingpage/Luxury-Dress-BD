import React, { useState } from "react";
import { ReviewItem } from "../types";
import { Star, CheckCircle, MessageSquarePlus } from "lucide-react";

interface ReviewSectionProps {
  reviews: ReviewItem[];
  language: "en" | "bn";
}

export default function ReviewSection({ reviews: initialReviews, language }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [showForm, setShowForm] = useState(false);
  
  // New Review Form State
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;

    const newReview: ReviewItem = {
      id: "rev-" + Date.now(),
      name: `${name} (${language === "en" ? "Verified" : "ভেরিফাইড"})`,
      rating,
      date: language === "en" ? "Just now" : "এইমাত্র",
      textEn: text,
      textBn: text,
      verified: true
    };

    setReviews([newReview, ...reviews]);
    setFormSubmitted(true);
    // Reset fields
    setName("");
    setRating(5);
    setText("");
    
    // Auto collapse form after timeout
    setTimeout(() => {
      setShowForm(false);
      setFormSubmitted(false);
    }, 2500);
  };

  return (
    <section id="reviews-section" className="bg-neutral-50 rounded-3xl p-6 sm:p-8 border border-gray-100 mb-12">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-200/60 pb-6 mb-6">
        <div>
          <h3 className="font-serif font-extrabold text-xl text-neutral-900">
            {language === "en" ? "What Our Customers Say" : "কাস্টমারদের সত্য মতামত"}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {language === "en" 
              ? "See real feedback from modest wear shoppers in Bangladesh." 
              : "আমাদের সম্মানিত কাস্টমারদের থেকে সরাসরি সংগৃহীত বিশ্বস্ত মতামত ও রিভিউ।"}
          </p>
        </div>

        {/* Toggle add review form */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span>{language === "en" ? "Write a Review" : "রিভিউ লিখুন"}</span>
        </button>
      </div>

      {/* Review Input Box with form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm max-w-xl animate-slide-down">
          {formSubmitted ? (
            <div className="text-center py-4 text-emerald-600 font-bold text-sm">
              🎉 {language === "en" ? "Thank you! Your review has been posted successfully." : "ধন্যবাদ! আপনার মূল্যবান রিভিউটি সফলভাবে প্রকাশিত হয়েছে।"}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {language === "en" ? "Your Name *" : "আপনার নাম লিখুন *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tasneem Ahmed"
                    className="block w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {language === "en" ? "Select Rating" : "রেটিং সিলেক্ট করুন"}
                  </label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="block w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37] bg-white font-bold text-amber-500"
                  >
                    <option value={5}>★★★★★ (5 Stars)</option>
                    <option value={4}>★★★★☆ (4 Stars)</option>
                    <option value={3}>★★★☆☆ (3 Stars)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {language === "en" ? "Your Feedback *" : "রিভিউ লিখুন *"}
                </label>
                <textarea
                  required
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={language === "en" ? "Review details of fabric, fit and customer service..." : "সেলাইয়ের মান, কাপড় কেমন লেগেছে এবং কত দ্রুত ডেলিভারি পেয়েছেন লিখুন..."}
                  className="block w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
              </div>
              <button
                type="submit"
                className="bg-[#B8860B] hover:bg-black hover:text-white text-black font-extrabold px-4 py-2 rounded-xl text-xs tracking-wider transition-all uppercase"
              >
                {language === "en" ? "Submit Review" : "রিভিউ সাবমিট করুন"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Reviews Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reviews.map((rev) => (
          <div
            key={rev.id}
            className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col justify-between hover:shadow-sm transition-all"
          >
            <div>
              {/* Rating stars & verified badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        i < rev.rating ? "fill-current" : "text-gray-200"
                      }`}
                    />
                  ))}
                </div>
                {rev.verified && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                    <CheckCircle className="h-3 w-3 fill-current" />
                    <span>{language === "en" ? "Verified" : "ক্রয়কৃত"}</span>
                  </div>
                )}
              </div>

              {/* Review Text content */}
              <p className="text-xs text-gray-600 leading-relaxed mt-3.5 italic">
                "{language === "en" ? rev.textEn : rev.textBn}"
              </p>
            </div>

            {/* Reviewer Meta info */}
            <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <span className="font-extrabold text-neutral-800">{rev.name}</span>
              <span className="font-mono">{rev.date}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
