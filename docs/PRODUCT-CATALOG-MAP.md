# ক্যাটাগরি সারি ম্যাপ

## লিংক এডিট পেজ (`product-links.html`)

**খুলুন:** `product-links.html` (লাইভ: `/product-links`)

**গুরুত্বপূর্ণ:** প্রতিটি সারি **আলাদা পেজ** — একটিতে বদলালে অন্যটিতে যায় না।

| আপনি যা বদলান | শুধু যে পেজে দেখাবে |
|----------------|---------------------|
| ① আবায়া বক্স | `abaya.html` |
| ④ টু-পিস বক্স | `premium-two-piece.html` |
| ⑤ এম্ব্রয়ডারি বক্স | `embroidery.html` |

ডেটা: `product-links-data.js` — প্রতিটি কী (`abaya`, `premium-two-piece`…) শুধু নিজ পেজে লাগে।

---

## মেনু ক্রম ①→⑧

| # | সারি | পেজ | ডেটা ফাইলে কী |
|---|------|-----|----------------|
| ① | আবায়া | abaya.html | `abaya: [ ]` |
| ② | কভার আপ | cover-up.html | `"cover-up": [ ]` |
| ③ | টপস/কুর্তি | tops-kurti.html | `"tops-kurti": [ ]` |
| ④ | টু-পিস | premium-two-piece.html | `"premium-two-piece": [ ]` |
| ⑤ | এম্ব্রয়ডারি | embroidery.html | `embroidery: [ ]` |
| ⑥ | কারচুপি | karchupi.html | `karchupi: [ ]` |
| ⑦ | কাফতান | kaftan.html | `kaftan: [ ]` |
| ⑧ | হিজাব | hijab.html | `hijab: [ ]` |

**লাইন ১** = সেই ক্যাটাগরির **প্রথম** প্রোডাক্টের ছবি

| কাজ | ফাইল |
|-----|------|
| ছবির লিংক (এক পেজ UI) | `product-links.html` |
| ছবির লিংক (ডেটা) | `product-links-data.js` |
| নাম, দাম, রঙ | `category-products.js` |
| CDN / WhatsApp | `product-config.js` |
