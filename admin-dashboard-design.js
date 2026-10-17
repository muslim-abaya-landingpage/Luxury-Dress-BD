(function () {
  'use strict';
  var root = document.documentElement;
  function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function applyTheme(dark) { root.dataset.adminTheme = dark ? 'dark' : 'light'; }
  applyTheme(read('ma-admin-theme') === 'dark');
  document.addEventListener('DOMContentLoaded', function () {
    var sidebar = document.getElementById('admSidebar');
    var collapse = document.getElementById('admCollapse');
    var theme = document.getElementById('admThemeToggle');
    var mobile = window.matchMedia('(max-width: 980px)');
    function setCollapsed(value) {
      sidebar.classList.toggle('is-collapsed', value);
      collapse.setAttribute('aria-expanded', String(!value));
      collapse.setAttribute('aria-label', value ? 'সাইডবার বড় করুন' : 'সাইডবার ছোট করুন');
    }
    setCollapsed(read('ma-admin-sidebar-collapsed') === 'true');
    collapse.addEventListener('click', function () {
      var value = !sidebar.classList.contains('is-collapsed');
      setCollapsed(value); save('ma-admin-sidebar-collapsed', String(value));
    });
    theme.setAttribute('aria-checked', String(root.dataset.adminTheme === 'dark'));
    theme.addEventListener('click', function () {
      var dark = root.dataset.adminTheme !== 'dark';
      applyTheme(dark); theme.setAttribute('aria-checked', String(dark)); save('ma-admin-theme', dark ? 'dark' : 'light');
    });
    sidebar.querySelectorAll('.adm-sidebar-item').forEach(function (link) {
      link.title = link.textContent.trim();
      if (link.classList.contains('is-current')) link.setAttribute('aria-current', 'page');
    });
    var menu = document.getElementById('admMenuBtn');
    var close = document.getElementById('admSbClose');
    var backdrop = document.getElementById('admSbBackdrop');
    menu.setAttribute('aria-controls', 'admSidebar');
    function syncDrawer() {
      var open = sidebar.classList.contains('is-open');
      menu.setAttribute('aria-expanded', String(open));
      sidebar.inert = mobile.matches && !open;
    }
    new MutationObserver(syncDrawer).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    mobile.addEventListener('change', syncDrawer); syncDrawer();
    menu.addEventListener('click', function () { if (mobile.matches) { syncDrawer(); close.focus(); } });
    document.addEventListener('keydown', function (event) {
      if (!mobile.matches || !sidebar.classList.contains('is-open')) return;
      if (event.key === 'Escape') { close.click(); menu.focus(); }
      if (event.key === 'Tab') {
        var items = Array.from(sidebar.querySelectorAll('a[href], button')).filter(function (item) { return item.getClientRects().length; });
        var first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    close.addEventListener('click', function () { menu.focus(); });
    backdrop.addEventListener('click', function () { menu.focus(); });
  });
})();
