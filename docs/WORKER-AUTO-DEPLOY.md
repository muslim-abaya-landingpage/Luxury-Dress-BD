# Cloudflare Worker অটো-ডিপ্লয় (একবারের সেটআপ)

`cloudflare-worker/worker.js` (অর্ডার সেফটি-নেট, IP ব্লক, Meta/TikTok সার্ভার ইভেন্ট, GTM লোডার) GitHub-এর `main`-এ
বদলালে `.github/workflows/worker-deploy.yml` নিজে থেকে Cloudflare Worker `white-lab-3589`-এ ডিপ্লয় করে।
শুধু কোড বদলায় — D1 সংযোগ, secret, ২ মিনিটের cron আর route যেমন আছে তেমন থাকে।
ডিপ্লয়ের আগে টেস্ট চলে, লাইভ কোডের ব্যাকআপ রাখা হয় (Actions → run → Artifacts, ৩০ দিন), আর পরে লাইভ কোড রিপোর
সাথে হুবহু মিলছে কিনা ও route ঠিকমতো উত্তর দিচ্ছে কিনা যাচাই হয়।

## একবার যা করতে হবে (প্রায় ৫ মিনিট)

1. Cloudflare ড্যাশবোর্ড → ডান-উপরে প্রোফাইল → **My Profile → API Tokens → Create Token**
2. **Create Custom Token** → নাম দিন `github-worker-deploy`
3. Permissions: **Account → Workers Scripts → Edit**
4. Account Resources: **Include → আপনার অ্যাকাউন্ট** (শুধু এটাই)
5. **Continue to summary → Create Token** → টোকেনটা কপি করুন (এটা আর দেখাবে না)
6. GitHub → রিপো **Luxury-Dress-BD → Settings → Secrets and variables → Actions → New repository secret**
   - Name: `CLOUDFLARE_API_TOKEN`
   - Secret: কপি করা টোকেন → **Add secret**
7. যাচাই: GitHub → **Actions → Worker Deploy → Run workflow**। সবুজ টিক এলে সেটআপ শেষ।

টোকেনটা কাউকে (Claude-সহ) চ্যাটে পাঠাবেন না; শুধু GitHub secret-এ রাখুন।

## নিয়ম

- Worker-এর কোড Cloudflare ড্যাশবোর্ডে সরাসরি এডিট করবেন না। ড্যাশবোর্ডে বদলালে পরের ডিপ্লয়ে সেটা মুছে যাবে।
  সব পরিবর্তন `cloudflare-worker/worker.js`-এ করে GitHub-এ দিন।
- ফেরত যেতে চাইলে: GitHub-এ আগের কমিট revert করুন (ওয়ার্কফ্লো নিজে আগের কোড ডিপ্লয় করবে), অথবা
  Actions-এর ব্যাকআপ artifact থেকে কোড নিন।
