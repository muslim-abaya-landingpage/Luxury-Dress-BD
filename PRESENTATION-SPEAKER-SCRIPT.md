# Presentation Speaker Script

## 1. All Categories Filter & Sorting Fix

আজকের উপস্থাপনায় Muslim Abaya ওয়েবসাইটের All Categories পেইজের filter ও sorting সমস্যার audit, নতুন UI/UX direction এবং বাস্তবায়ন status দেখাব। লক্ষ্য ছিল এমন একটি shopping flow তৈরি করা যেখানে ক্রেতা দ্রুত সঠিক পণ্য খুঁজে পাবেন এবং একই পণ্য বারবার দেখতে হবে না।

## 2. Audit: কোথায় সমস্যা ছিল

প্রথম audit-এ দেখা যায়, All Categories মূলত একটি category tile hub ছিল। সেখানে সরাসরি product listing, price, size বা availability filter ছিল না। আলাদা category page-এ price ও color থাকলেও sorting, reset এবং size-based filtering অনুপস্থিত ছিল। Back, Side এবং Detail image আলাদা product card হিসেবে আসায় catalog-ও অগোছালো দেখাত। এই সমস্যাগুলো browse time বাড়ায় এবং conversion-এর আগে friction তৈরি করে।

## 3. Target UX: one unified shopping flow

আমাদের target experience হলো একটি unified product grid, যার পাশে desktop-এ sticky filter rail এবং mobile-এ filter drawer থাকবে। Category, price, color, size এবং availability একসঙ্গে ব্যবহার করা যাবে। Toolbar-এ sorting থাকবে, এবং কোনো result না পেলে clear action সহ একটি পরিষ্কার empty state দেখাবে। অর্থাৎ ইউজারকে বারবার page বদলাতে হবে না।

## 4. যা এখন বাস্তবে যুক্ত হয়েছে

এই redesign শুধু mockup নয়; repository code-এ বাস্তবায়িত হয়েছে। All Categories এখন সব ক্যাটাগরি থেকে primary product একত্রে দেখায়। Gallery variant বাদ দেওয়া হয়েছে। Category, size এবং availability filter যুক্ত হয়েছে; price ও color filter আরও পূর্ণ হয়েছে। Clear all filters action এবং price/name sorting চালু আছে। Mobile responsive drawer ও desktop sticky sidebar-এর styling-ও ঠিক করা হয়েছে।

## 5. Filter logic & data contract

Filter behavior predictable রাখতে একই facet-এর একাধিক value OR এবং আলাদা facetগুলো AND হিসেবে কাজ করে। উদাহরণ হিসেবে Black অথবা Maroon একটি color facet-এর ভিতরে OR; কিন্তু Black plus Size 52 plus নির্দিষ্ট price range একসঙ্গে AND। এই লজিক নির্ভুল রাখতে product data-তে structured category, sizes array, numeric price, normalized color এবং stock source থাকতে হবে।

## 6. Shopify / WooCommerce code path

যদি Shopify হয়, Search & Discovery app-এর native filters এবং Liquid collection.filters ব্যবহার করাই সবচেয়ে নির্ভরযোগ্য পথ। Size ও Color variant options হিসেবে, আর Fabric ও Collection product metafield হিসেবে configure করা যায়। WooCommerce হলে global attributes—pa_size, pa_color এবং pa_fabric—ব্যবহার করতে হবে। Stock native inventory থেকে আসবে এবং server-side tax query বা Product Filter blocks দিয়ে result তৈরি হবে। দুই platform-এই canonical slug এবং normalized vocabulary জরুরি।

## 7. QA, launch gates & rollout

Local preview-এ unified grid, filter controls, sorting, reset এবং responsive markup যাচাই করা হয়েছে। এরপর deployment propagation-এর পর production smoke test করতে হবে। Desktop, tablet এবং 390-pixel mobile viewport—এই তিনটি breakpoint-এ একই scenarios চালাতে হবে। বিশেষ করে filter combination, no-result state, back/forward navigation এবং stock consistency যাচাই করা জরুরি।

## 8. Outcome

ফলাফল হলো: All Categories এখন browse-only hub নয়; এটি একটি usable e-commerce discovery page। ক্রেতা কম steps-এ বেশি relevant product দেখতে পারবেন। Immediate next step হলো production smoke test এবং পরে filter state URL-এ serialize করা, যাতে refresh, share এবং browser back/forward-এ selected filters অক্ষুণ্ণ থাকে।
