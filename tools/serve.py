"""Serve game/ on http://localhost:8765 with caching off, so edits always show up on reload."""
import http.server, os, functools

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a):
        pass

root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "game")
http.server.ThreadingHTTPServer(("127.0.0.1", 8765), functools.partial(Handler, directory=root)).serve_forever()
