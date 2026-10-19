# Apps Script অটো-ডিপ্লয়

`apps-script/` ফোল্ডারে পরিবর্তন `main`-এ গেলে GitHub Actions (`.github/workflows/apps-script-deploy.yml`) নিজে থেকেই:

1. লাইভ Apps Script প্রজেক্টের ব্যাকআপ নেয় (Actions রান-এর Artifacts-এ ৯০ দিন থাকে)।
2. লাইভ প্রজেক্টে repo-তে নেই এমন ফাইল থাকলে থেমে যায় (ভুল করে মুছে যাওয়া ঠেকাতে)।
3. `clasp push --force` দিয়ে কোড আপলোড করে।
4. বিদ্যমান Web App deployment-টাই নতুন ভার্সনে আপডেট করে, তাই `/exec` URL বদলায় না।
5. Web App URL-এ একটা টেস্ট রিকোয়েস্ট পাঠায়।

## এককালীন সেটআপ

Windows-এ `APPS-SCRIPT-অটো-ডিপ্লয়-সেটআপ.bat` চালান, অথবা নিজে করুন:

1. https://script.google.com/home/usersettings → **Google Apps Script API** ON।
2. `npm i -g @google/clasp` তারপর `clasp login` (luxurydressbd@gmail.com)।
3. `%USERPROFILE%\.clasprc.json` ফাইলের পুরো লেখা GitHub → Settings → Secrets and variables → Actions → **New repository secret**, নাম `CLASPRC_JSON`।

Secret না থাকলে workflow কিছু না করে শুধু একটা warning দেখায়।

হাতে চালাতে: GitHub → Actions → **Apps Script Deploy** → **Run workflow**।
