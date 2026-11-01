# Webzo BD Agency Builder v8

## নতুন কী
- Visual Section Controls: Features, Countdown, Reviews, Products, Order Form Show/Hide.
- Product Variant Engine: product-এর `variants` দিয়ে color/name/swatch/image/price/size-stock সেট করা যায়।
- Smart Checkout: free-shipping threshold এবং fixed/percent coupon rules.
- Variant নির্বাচন করলে product image, price এবং size stock state update হয়।
- Order payload-এ variant, variant price এবং line total যায়।

## Variant JSON উদাহরণ
```json
[
  {"id":"black","name":"Black","swatch":"#111111","image":"images/black.webp","price":2400,"stockBySize":{"50":true,"52":true,"54":false}},
  {"id":"maroon","name":"Maroon","swatch":"#5b1727","image":"images/maroon.webp","price":2500,"stockBySize":{"50":true,"52":true,"54":true}}
]
```

## Coupon JSON উদাহরণ
```json
[
  {"code":"SAVE100","type":"fixed","value":100},
  {"code":"EID10","type":"percent","value":10}
]
```

## Hosting workflow
GitHub-কে source-of-truth রাখুন। Static frontend-এর জন্য GitHub-connected deployment provider ব্যবহার করুন। Secret keys কখনো frontend/config.js-এ রাখবেন না। Cloud database/auth/order API যোগ করলে environment variables ও server-side functions ব্যবহার করুন।
