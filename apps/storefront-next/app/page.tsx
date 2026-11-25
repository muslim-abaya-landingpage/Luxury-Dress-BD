import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Muslim Abaya home">
          <span className="brand-mark">MA</span>
          <span>
            <strong>MUSLIM ABAYA</strong>
            <small>MODEST FASHION</small>
          </span>
        </Link>
        <span className="environment">MIGRATION PREVIEW</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">NEXT.JS STOREFRONT FOUNDATION</p>
        <h1 id="hero-title">নতুন অভিজ্ঞতা, পরিচিত Muslim Abaya</h1>
        <p className="intro">
          নতুন storefront-এর ভিত্তি তৈরি হচ্ছে। বর্তমান ওয়েবসাইট, অর্ডার ও পণ্যের
          তথ্য অক্ষত রেখে ধাপে ধাপে নতুন সিস্টেমে স্থানান্তর করা হবে।
        </p>
        <div className="status-row">
          <span className="status-dot" />
          <span>Migration preview — production থেকে আলাদা</span>
        </div>
      </section>

      <section className="principles" aria-label="Migration principles">
        <article>
          <span className="number">01</span>
          <h2>দ্রুত ও Responsive</h2>
          <p>Mobile-first layout, server rendering এবং lightweight UI foundation.</p>
        </article>
        <article>
          <span className="number">02</span>
          <h2>নিরাপদ API</h2>
          <p>Laravel API, role-based access এবং server-side validation.</p>
        </article>
        <article>
          <span className="number">03</span>
          <h2>ডাটা অক্ষত</h2>
          <p>Exact SKU matching, order history ও product identity সংরক্ষণ।</p>
        </article>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Muslim Abaya</span>
        <span>Staged development only</span>
      </footer>
    </main>
  );
}
