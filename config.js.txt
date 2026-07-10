const SITE_CONFIG = {
    // ব্র্যান্ড ইনফরমেশন
    businessName: "Muslim Abaya (মুসলিম আবায়া)",
    phone: "01970831783",
    currency: "BDT",
    
    // ডেলিভারি সেটিংস
    deliveryCharge: {
        insideDhaka: 60,
        outsideDhaka: 120
    },
    
    // ট্যাক্স বা বাড়তি চার্জ
    taxRate: 0,
    
    // সোশ্যাল মিডিয়া ও সাপোর্ট
    supportWhatsApp: "https://wa.me/8801970831783",
    facebookPage: "https://facebook.com/muslimabaya",
    
    // এপিআই বা ডাটাবেজ পাথ
    apiEndpoint: "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE"
};

// ব্যবহারের নিয়ম (এটি নিচে রাখলে পেজ লোড হওয়ার পর কাজ করবে)
document.addEventListener("DOMContentLoaded", function() {
    const businessNameElement = document.getElementById('business-name');
    if (businessNameElement) {
        businessNameElement.innerText = SITE_CONFIG.businessName;
    }
    console.log("কল করুন এই নম্বরে: " + SITE_CONFIG.phone);
});
