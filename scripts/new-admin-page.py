"""Create a new admin page from the shared admin shell (admin-growth.html).
Usage: python3 scripts/new-admin-page.py <file-stem> "<title>" "<kicker group>" <main-html-file> <script.js>
After creating, add it to admin-navigation.json + PAGES in sync-admin-navigation.py and run that script."""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
stem, title, group, main_file, script = sys.argv[1:6]
src = (ROOT / 'admin-growth.html').read_text()
head, rest = src.split('<main class="adm-main">', 1)
_, tail = rest.split('</main>', 1)
tail = tail[:tail.index('  <script>')] + '  <script src="admin-page-shell.js?v=1"></script>\n  <script src="' + script + '?v=1"></script>\n</body>\n</html>\n'
head = head.replace('<title>গ্রোথ টুলস | Muslim Abaya Admin</title>', '<title>' + title + ' | Muslim Abaya Admin</title>')
head = head.replace('<h1>গ্রোথ টুলস</h1>', '<h1>' + title + '</h1>')
import re
head = re.sub(r'(adm-page-kicker">)[^<]*', lambda m: m.group(1) + 'মুসলিম আবায়া / ' + group, head, count=1)
main = (ROOT / main_file).read_text().strip()
(ROOT / (stem + '.html')).write_text(head + '<main class="adm-main">\n' + main + '\n      </main>' + tail)
print('wrote', stem + '.html')
