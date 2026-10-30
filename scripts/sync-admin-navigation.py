"""Generate static, accessible admin menus from admin-navigation.json; --check verifies drift."""
from pathlib import Path
import html
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['admin-dashboard', 'admin-orders', 'admin-order', 'admin-operations',
         'admin-inbox', 'admin-order-new', 'product-manager', 'product-links', 'admin-links',
         'stock-analytics', 'admin-staff', 'admin-growth']
GROUPS = json.loads((ROOT / 'admin-navigation.json').read_text())

def navigation(active):
    out = ['<nav class="adm-sidebar-nav" aria-label="অ্যাডমিন মেনু">']
    for group in GROUPS:
        label = html.escape(group['label'])
        if 'links' not in group:
            current = group['href'] == active
            out.append('<a class="adm-sidebar-item' + (' is-current' if current else '') +
                       '" href="' + group['href'] + '"' + (' aria-current="page"' if current else '') +
                       '>' + group['icon'] + '<span>' + label + '</span></a>')
        else:
            current = any(link['href'] == active for link in group['links'])
            out.append('<details class="adm-nav-group' + (' has-current' if current else '') +
                       '" name="adm-navigation"' + (' open' if current else '') + '><summary class="adm-sidebar-item" title="' +
                       label + '">' + group['icon'] + '<span>' + label +
                       '</span><svg class="adm-nav-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></summary><div class="adm-nav-children">')
            for link in group['links']:
                selected = link['href'] == active
                out.append('<a class="adm-sidebar-item adm-nav-child' + (' is-current' if selected else '') +
                           '" href="' + link['href'] + '"' + (' aria-current="page"' if selected else '') +
                           '><span>' + html.escape(link['label']) + '</span></a>')
            out.append('</div></details>')
    return '\n'.join(out + ['</nav>'])

def main():
    drift = []
    for page in PAGES:
        path = ROOT / (page + '.html')
        source = path.read_text()
        active = ('admin-orders' if page == 'admin-order' else page) + '.html'
        updated, count = re.subn(r'<nav class="adm-sidebar-nav".*?</nav>', navigation(active), source, count=1, flags=re.S)
        if count != 1:
            raise ValueError('Missing admin navigation: ' + page)
        if updated != source:
            drift.append(page)
            if '--check' not in sys.argv:
                path.write_text(updated)
    if '--check' in sys.argv and drift:
        raise SystemExit('Navigation needs regeneration: ' + ', '.join(drift))
    print('Admin navigation verified across ' + str(len(PAGES)) + ' pages.')

if __name__ == '__main__':
    main()
