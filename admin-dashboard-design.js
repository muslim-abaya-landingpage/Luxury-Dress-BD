/* Shared admin presentation controls; no data or authentication mutations. */
(function () {
  'use strict';
  var root = document.documentElement;
  function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function applyTheme(dark) { root.dataset.adminTheme = dark ? 'dark' : 'light'; }
  applyTheme(read('ma-admin-theme') === 'dark');
  document.addEventListener('DOMContentLoaded', function () {
    var sidebar = document.getElementById('admSidebar') || document.getElementById('pnSide');
    if (!sidebar) return;
    var collapse = document.getElementById('admCollapse');
    var theme = document.getElementById('admThemeToggle');
    var menu = document.getElementById('admMenuBtn') || document.getElementById('pnMenuBtn');
    var close = document.getElementById('admSbClose');
    var backdrop = document.getElementById('admSbBackdrop');
    var mobile = window.matchMedia('(max-width: 980px)');
    var crest = sidebar.querySelector('.adm-sidebar-crest');
    crest.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="7" width="16" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M9 11a3 3 0 0 0 6 0"/></svg>';
    function setCollapsed(value) {
      sidebar.classList.toggle('is-collapsed', value);
      collapse.setAttribute('aria-expanded', String(!value));
      collapse.setAttribute('aria-controls', sidebar.id);
      collapse.setAttribute('aria-label', value ? 'সাইডবার বড় করুন' : 'সাইডবার ছোট করুন');
    }
    setCollapsed(read('ma-admin-sidebar-collapsed') === 'true');
    collapse.addEventListener('click', function () {
      var value = !sidebar.classList.contains('is-collapsed');
      setCollapsed(value); save('ma-admin-sidebar-collapsed', String(value));
    });
    function syncTheme() { theme.setAttribute('aria-checked', String(root.dataset.adminTheme === 'dark')); }
    syncTheme();
    theme.addEventListener('click', function () {
      var dark = root.dataset.adminTheme !== 'dark';
      applyTheme(dark); syncTheme(); save('ma-admin-theme', dark ? 'dark' : 'light');
    });
    window.addEventListener('storage', function (event) {
      if (event.key === 'ma-admin-theme') { applyTheme(event.newValue === 'dark'); syncTheme(); }
      if (event.key === 'ma-admin-sidebar-collapsed') setCollapsed(event.newValue === 'true');
    });
    sidebar.querySelectorAll('.adm-sidebar-item').forEach(function (link) { link.title = link.textContent.trim(); });
    if (!menu || !close || !backdrop) return;
    menu.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    menu.setAttribute('aria-controls', sidebar.id);
    menu.setAttribute('aria-label', 'মেনু খুলুন');
    function syncDrawer() {
      var open = sidebar.classList.contains('is-open');
      menu.setAttribute('aria-expanded', String(open));
      sidebar.inert = mobile.matches && !open;
    }
    function drawer(open, restoreFocus) {
      sidebar.classList.toggle('is-open', open);
      backdrop.classList.toggle('is-open', open);
      syncDrawer();
      if (open) close.focus();
      else if (restoreFocus) menu.focus();
    }
    // Capture ownership prevents older page-specific drawer listeners from toggling twice.
    menu.addEventListener('click', function (event) { event.stopImmediatePropagation(); drawer(!sidebar.classList.contains('is-open'), true); }, true);
    close.addEventListener('click', function (event) { event.stopImmediatePropagation(); drawer(false, true); }, true);
    backdrop.addEventListener('click', function (event) { event.stopImmediatePropagation(); drawer(false, true); }, true);
    mobile.addEventListener('change', function () { drawer(false, false); });
    syncDrawer();
    document.addEventListener('keydown', function (event) {
      if (!mobile.matches || !sidebar.classList.contains('is-open')) return;
      if (event.key === 'Escape') drawer(false, true);
      if (event.key === 'Tab') {
        var items = Array.from(sidebar.querySelectorAll('a[href], button')).filter(function (item) { return item.getClientRects().length; });
        var first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  });
})();
