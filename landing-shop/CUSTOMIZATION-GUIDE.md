# Webzo BD Landing Page — Central Control Guide

## 1) পুরো পেজের কালার ১ লাইনে বদলান
`config.js` খুলুন এবং:

```js
theme: {
  activePreset: 'emeraldGold',
  custom: {}
}
```

`activePreset`-এ যেকোনো একটি দিন:
- `emeraldGold`
- `blackGold`
- `maroonGold`
- `navyGold`
- `mochaCream`

উদাহরণ: `activePreset: 'maroonGold'`

## 2) নিজের Custom Color
Preset রেখে শুধু নির্দিষ্ট রঙ override করা যায়:

```js
custom: {
  primary: '#4A1831',
  accent: '#D9B56C',
  background: '#FAF4F5',
  surface: '#FFFDFD',
  text: '#2C1821'
}
```

## 3) নতুন ক্লায়েন্ট বানানোর সময় যেগুলো বদলাবেন
`config.js` থেকে: brand, hero, sections, products, deliveryAreas, reviews, order, marketing এবং theme।

## 4) নতুন Product
`products` array-তে নতুন object যোগ করুন। প্রতিটি `id` unique ইংরেজি lowercase/hyphen হবে। Price number হবে। Size থাকলে sizes এবং stockBySize দিন।

## 5) Image
নতুন product/gallery image `images/` folder-এ রাখুন এবং config.js-এ path বদলান। WebP ব্যবহার করুন।

## 6) Client Delivery Checklist
- ফোন ও WhatsApp নম্বর
- Logo/brand name
- Domain
- Product name/price/old price (যদি দেখান)
- Sizes/colors/stock
- Delivery charges
- Real product photos
- Real reviews only
- Return/refund policy
- Facebook Pixel / GA4 / TikTok Pixel IDs
- Test order (mobile + desktop)
- Netlify form submission test
- Thank-you page test

## গুরুত্বপূর্ণ
এই template static Netlify landing page। Payment, authoritative stock, order status, abandoned checkout বা admin login দরকার হলে backend/database প্রয়োজন।
