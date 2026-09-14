"""Actual loopback HTTP responses for the independent uptime checker."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ops'))
import check_public


class PublicUptimeTests(unittest.TestCase):
    def setUp(self):
        self.mode = 'healthy'
        self.agents = []
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_GET(self):
                owner.agents.append(self.headers.get('User-Agent'))
                if owner.mode == 'redirect':
                    self.send_response(302)
                    self.send_header('Location', '/unexpected')
                    self.end_headers()
                    return
                marker = self.path.startswith('/.well-known/')
                self.send_response(503 if owner.mode == 'unavailable' else 200)
                self.send_header('Content-Type', 'application/json' if marker else 'text/html')
                self.send_header('X-Kaizen-Release', 'wrong' if owner.mode == 'wrong-page' and not marker else 'fixture')
                self.end_headers()
                if marker:
                    data = {'schemaVersion': 2, 'releaseId': 'fixture', 'client': {'origin': owner.origin}}
                    if owner.mode == 'wrong-destination':
                        data['client']['origin'] = 'https://unrelated.fixture.invalid'
                    self.wfile.write(json.dumps(data).encode())
                else:
                    self.wfile.write(b'<!doctype html><html><h1>Synthetic uptime fixture</h1></html>')
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.origin = 'http://127.0.0.1:' + str(self.server.server_port)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def test_actual_marker_and_home_page_match_and_use_named_monitor_agent(self):
        self.assertTrue(check_public.check(self.origin)['healthy'])
        self.assertEqual(self.agents, ['Kaizen-Uptime/1.0', 'Kaizen-Uptime/1.0'])

    def test_http_failures_redirects_wrong_pages_and_destinations_are_rejected(self):
        for mode in ['unavailable', 'redirect', 'wrong-page', 'wrong-destination']:
            self.mode = mode
            with self.assertRaises(Exception):
                check_public.check(self.origin)


if __name__ == '__main__':
    unittest.main()
