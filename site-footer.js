(function () {
  var FOOTER_HTML =
    '<footer class="anz-footer">' +
    '<div class="anz-container">' +
    '<div class="anz-col-brand">' +
    '<h2 class="anz-logo">Muslim Abaya</h2>' +
    '<p class="anz-text">Muslim Abaya — বাংলাদেশের প্রিমিয়াম মডেস্ট ফ্যাশন ব্র্যান্ড। আবায়া, কাফতান, হিজাব ও টু-পিস কালেকশনে আধুনিক ডিজাইন, আরামদায়ক ফেব্রিক ও ক্যাশ অন ডেলিভারি সুবিধা।</p>' +
    '</div>' +
    '<div class="anz-col-links">' +
    '<h3 class="anz-title">About Us</h3>' +
    '<ul>' +
    '<li><a href="about.html">About Us</a></li>' +
    '<li><a href="checkout.html">Order Tracking</a></li>' +
    '<li><a href="refund.html">Refund Policy</a></li>' +
    '<li><a href="terms.html">Terms &amp; Conditions</a></li>' +
    '</ul>' +
    '</div>' +
    '<div class="anz-col-contact">' +
    '<h3 class="anz-title">Contact Us</h3>' +
    '<div class="contact-row"><img src="https://cdn-icons-png.flaticon.com/512/732/732200.png" alt=""><span>muslimabaya@gmail.com</span></div>' +
    '<div class="contact-row"><img src="https://cdn-icons-png.flaticon.com/512/724/724664.png" alt=""><span>+880 1971-642683</span></div>' +
    '<div class="contact-row"><img src="https://cdn-icons-png.flaticon.com/512/484/484167.png" alt=""><span>832, West Rasulpur, Dhaka-1211, Bangladesh</span></div>' +
    '</div>' +
    '<div class="anz-col-newsletter">' +
    '<form id="newsletter-form">' +
    '<h3 class="anz-title">Newsletter</h3>' +
    '<p class="anz-newsletter-note">Sign up for latest news and updates</p>' +
    '<div class="newsletter-form">' +
    '<input type="text" name="contact" id="subscriber-contact" placeholder="Email or mobile" required>' +
    '<button type="submit" id="sub-btn">Subscribe</button>' +
    '</div>' +
    '<div id="success-msg" class="subscribe-success" role="status">' +
    '<div class="subscribe-success-icon" aria-hidden="true">✓</div>' +
    '<p class="subscribe-success-title">সাবস্ক্রিপশন সম্পন্ন হয়েছে</p>' +
    '<p class="subscribe-success-text">আপনার তথ্য সুরক্ষিতভাবে সংরক্ষণ করা হয়েছে। শীঘ্রই নতুন কালেকশন ও বিশেষ অফার জানানো হবে।</p>' +
    '</div>' +
    '</form>' +
    '<div class="anz-socials">' +
    '<a href="https://www.facebook.com/luxurydressofficial" target="_blank" rel="noopener" class="anz-social-link" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 16.9913 5.65684 21.1283 10.4375 21.8785V14.8906H7.89844V12H10.4375V9.79688C10.4375 7.29063 11.9305 5.90625 14.2146 5.90625C15.3082 5.90625 16.4531 6.10156 16.4531 6.10156V8.5625H15.1922C13.95 8.5625 13.5625 9.33333 13.5625 10.1242V12H16.3359L15.8926 14.8906H13.5625V21.8785C18.3432 21.1283 22 16.9913 22 12Z"/></svg></a>' +
    '<a href="https://www.youtube.com/@luxurydressbd" target="_blank" rel="noopener" class="anz-social-link" aria-label="YouTube"><svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>' +
    '<a href="https://www.instagram.com/luxurydressbd/" target="_blank" rel="noopener" class="anz-social-link" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>' +
    '<a href="https://www.tiktok.com/@muslimabayabd" target="_blank" rel="noopener" class="anz-social-link" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.28-2.26.74-4.63 2.58-5.91 1.05-.72 2.3-1.13 3.55-1.14 1.25-.01 2.5.3 3.59 1.01.01-1.24-.01-2.48.01-3.72-1.02-.69-2.22-1.03-3.45-1.01-1.41.02-2.81.48-3.92 1.36-1.62 1.25-2.58 3.24-2.54 5.27.02 2.21 1.23 4.31 3.12 5.47 1.22.76 2.66 1.15 4.1 1.05 2.15-.08 4.17-1.33 5.18-3.23.51-.95.77-2.03.78-3.11.02-4.99-.01-9.98.02-14.97z"/></svg></a>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="anz-bottom"><p>Copyright &copy; 2026 Muslim Abaya. All Rights Reserved.</p></div>' +
    '</footer>';

  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxQwF-LrnmuDBc_jURG3k3S1tKycGiT3LoB9tPuepqeVm3WCwxIyIVcb55hX1kW4Hyx/exec';

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function normalizeContactValue(value) {
    var v = String(value || '').trim();
    if (isEmail(v)) return v;
    var digits = v.replace(/[^\d]/g, '');
    if (digits.indexOf('880') === 0 && digits.length >= 12) digits = '0' + digits.substring(3);
    if (digits.length === 10 && digits.charAt(0) === '1') digits = '0' + digits;
    return digits;
  }

  function isEmailOrPhone(value) {
    var v = String(value || '').trim();
    if (isEmail(v)) return true;
    var digits = normalizeContactValue(v);
    return digits.length >= 11 && digits.length <= 14 && digits.charAt(0) === '0';
  }

  function initNewsletter() {
    var form = document.getElementById('newsletter-form');
    if (!form || form.getAttribute('data-bound') === '1') return;
    form.setAttribute('data-bound', '1');

    var msg = document.getElementById('success-msg');
    var btn = document.getElementById('sub-btn');
    var contactInput = document.getElementById('subscriber-contact');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!contactInput || !isEmailOrPhone(contactInput.value)) {
        alert('অনুগ্রহ করে সঠিক ইমেইল অথবা মোবাইল নাম্বার দিন (উদাহরণ: 01712345678)।');
        return;
      }
      btn.disabled = true;
      btn.innerText = 'Processing...';
      var payload = new URLSearchParams();
      var contactValue = normalizeContactValue(contactInput.value);
      payload.append('contact', contactValue);
      payload.append('email', contactValue);
      fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: payload })
        .then(function () {
          if (msg) {
            msg.classList.add('show');
            setTimeout(function () { msg.classList.remove('show'); }, 6000);
          }
          form.reset();
          btn.disabled = false;
          btn.innerText = 'Subscribe';
        })
        .catch(function () {
          btn.disabled = false;
          btn.innerText = 'Subscribe';
        });
    });
  }

  function mountFooter() {
    var mount = document.getElementById('site-footer-mount');
    if (!mount) return;
    mount.innerHTML = FOOTER_HTML;
    initNewsletter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountFooter);
  } else {
    mountFooter();
  }
})();
