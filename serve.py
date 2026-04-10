#!/usr/bin/env python3
"""Dev server with no-cache headers to prevent stale content."""
import http.server
import functools

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    print('Serving at http://localhost:8000 (no-cache mode)')
    http.server.HTTPServer(('', 8000), NoCacheHandler).serve_forever()
