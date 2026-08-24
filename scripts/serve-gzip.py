#!/usr/bin/env python3
"""Local static server with gzip and cache headers (closer to production)."""
import gzip
import io
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "43147"))
HOST = os.environ.get("HOST", "127.0.0.1")

TEXT_EXTS = {".html", ".js", ".css", ".svg", ".json", ".xml", ".txt", ".map", ".md"}
MIME = {
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys_stderr = os.environ.get("SERVE_VERBOSE")
        if sys_stderr:
            super().log_message(fmt, *args)

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            index = os.path.join(path, "index.html")
            if os.path.isfile(index):
                path = index
            else:
                return super().send_head()
        if not os.path.isfile(path):
            self.send_error(404, "File not found")
            return None
        ext = os.path.splitext(path)[1].lower()
        ctype = MIME.get(ext) or self.guess_type(path)
        try:
            with open(path, "rb") as handle:
                data = handle.read()
        except OSError:
            self.send_error(404, "File not found")
            return None
        accept = self.headers.get("Accept-Encoding", "")
        encoded = data
        encoding = None
        if ext in TEXT_EXTS and "gzip" in accept:
            encoded = gzip.compress(data, compresslevel=6)
            encoding = "gzip"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(encoded)))
        if encoding:
            self.send_header("Content-Encoding", encoding)
            self.send_header("Vary", "Accept-Encoding")
        if ext == ".html":
            self.send_header("Cache-Control", "public, max-age=300, must-revalidate")
        else:
            self.send_header("Cache-Control", "public, max-age=31536000")
        self.end_headers()
        return io.BytesIO(encoded)


if __name__ == "__main__":
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Serving {ROOT} on http://{HOST}:{PORT}/", flush=True)
    httpd.serve_forever()
