"""Generate static, accessible admin menus from admin-navigation.json; --check verifies drift.

The menu follows the WordPress admin pattern: each group's top link opens its first page, the
current group shows its submenu inline, other groups show theirs as a flyout (admin-wp.css).
Every page also gets the shared WordPress-style shell: admin-wp.css and admin-wp.js."""
from pathlib import Path
import html
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['admin-dashboard', 'admin-orders', 'admin-order', 'admin-operations',
         'admin-inbox', 'product-manager', 'product-links', 'admin-links',
         'stock-analytics', 'admin-staff', 'admin-growth', 'admin-sizes',
         'admin-support-inbox', 'admin-setup', 'admin-profit',
         'admin-customers', 'admin-activity', 'admin-order-new']
GROUPS = json.loads((ROOT / 'admin-navigation.json').read_text())

def navigation(active):
    out = ['<nav class="adm-sidebar-nav" aria-label="Admin menu">']
    for group in GROUPS:
        label = html.escape(group['label'])
        if 'links' not in group:
            current = group['href'] == active
            out.append('<a class="adm-sidebar-item' + (' is-current' if current else '') +
                       '" href="' + group['href'] + '"' + (' aria-current="page"' if current else '') +
                       '>' + group['icon'] + '<span>' + label + '</span></a>')
        else:
            current = any(link['href'] == active for link in group['links'])
            first = html.escape(group['links'][0]['href'])
            out.append('<div class="adm-nav-group' + (' has-current' if current else '') + '">'
                       '<a class="adm-sidebar-item adm-nav-top' + (' is-current' if current else '') +
                       '" href="' + first + '" aria-haspopup="true">' + group['icon'] + '<span>' + label +
                       '</span></a><div class="adm-nav-children" role="group" aria-label="' + label + '">')
            for link in group['links']:
                selected = link['href'] == active
                out.append('<a class="adm-sidebar-item adm-nav-child' + (' is-current' if selected else '') +
                           '" href="' + html.escape(link['href']) + '"' + (' aria-current="page"' if selected else '') +
                           '><span>' + html.escape(link['label']) + '</span></a>')
            out.append('</div></div>')
    return '\n'.join(out + ['</nav>'])

SHELL_CSS = '<link rel="stylesheet" href="admin-wp.css?v=1">'
SHELL_JS = '<script src="admin-wp.js?v=1" defer></script>'

def with_shell(source):
    """Load the WordPress-style shell last so it wins over older page styles."""
    # Class on <html> from the start, so the page never flashes the old layout before admin-wp.js runs.
    # Only the document's own <html> tag (right after the doctype); page scripts may hold other HTML templates.
    source = re.sub(r'\A(\s*<!DOCTYPE html>\s*)<html(?![^>]*\bclass=)([^>]*)>', r'\1<html class="wp-admin-shell"\2>', source, count=1, flags=re.I)
    if 'admin-wp.css' not in source:
        source = source.replace('</head>', SHELL_CSS + '\n</head>', 1)
    if 'admin-wp.js' not in source:
        # The last </body> is the page's own; earlier ones can sit inside JS strings.
        head, sep, tail = source.rpartition('</body>')
        source = head + SHELL_JS + '\n' + sep + tail
    return source

def main():
    drift = []
    for page in PAGES:
        path = ROOT / (page + '.html')
        source = path.read_text()
        active = ('admin-orders' if page == 'admin-order' else page) + '.html'
        updated, count = re.subn(r'<nav class="adm-sidebar-nav".*?</nav>', lambda _m: navigation(active), source, count=1, flags=re.S)
        if count != 1:
            raise ValueError('Missing admin navigation: ' + page)
        updated = with_shell(updated)
        if updated != source:
            drift.append(page)
            if '--check' not in sys.argv:
                path.write_text(updated)
    if '--check' in sys.argv and drift:
        raise SystemExit('Navigation needs regeneration: ' + ', '.join(drift))
    print('Admin navigation verified across ' + str(len(PAGES)) + ' pages.')

if __name__ == '__main__':
    main()
