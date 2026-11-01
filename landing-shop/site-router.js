/* Load each dependency only after the site override is ready. */
(async () => {
  'use strict';
  const runtimeFiles = {"landing":"runtime-landing.fa404732b156.js","thanks":"runtime-thanks.c6cb6f41898d.js"};
  const host = location.hostname.toLowerCase().replace(/^www\./, '');
  const rootDomains = ['muslimabaya.com', 'muslimabaya.co'];
  const params = new URLSearchParams(location.search);
  let slug = 'main';
  for (const root of rootDomains) if (host.endsWith('.' + root)) slug = host.slice(0, -(root.length + 1)).split('.')[0];
  if (params.has('site')) slug = params.get('site');
  if (!/^[a-z0-9-]{1,63}$/.test(slug)) slug = 'main';
  window.WEBZO_SITE = { slug, host, rootDomains };
  document.documentElement.dataset.site = slug;
  const load = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src; script.onload = resolve; script.onerror = () => reject(new Error('Cannot load ' + src));
    document.head.appendChild(script);
  });
  try {
    if (params.get('builderPreview') !== '1') {
      try { await load('sites/' + slug + '.js'); }
      catch (error) { console.warn(error.message + '; using default config'); }
    }
    await load(/\/thank-you(?:\.html)?$/.test(location.pathname) ? runtimeFiles.thanks : runtimeFiles.landing);
  } catch (error) {
    console.error(error);
    const notice = document.createElement('p'); notice.setAttribute('role', 'alert');
    notice.textContent = 'পেজ সম্পূর্ণ লোড হয়নি। রিফ্রেশ করুন অথবা ফোনে যোগাযোগ করুন।';
    document.body.prepend(notice);
  }
})();
