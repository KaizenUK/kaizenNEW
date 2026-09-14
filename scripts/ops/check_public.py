"""External HTTPS observation of the public site and its release identity."""
import json
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Kaizen-Uptime/1.0', 'Cache-Control': 'no-cache'})
    try:
        response = urllib.request.build_opener(NoRedirect()).open(request, timeout=15)
    except urllib.error.HTTPError as error:
        error.close()
        raise ValueError('The public endpoint did not return success.') from None
    with response:
        if response.status != 200:
            raise ValueError('The public endpoint did not return success.')
        content = response.read(2 * 1024**2 + 1)
        if len(content) > 2 * 1024**2:
            raise ValueError('The public response exceeded the observation limit.')
        return response.headers, content


def check(origin):
    url = urllib.parse.urlsplit(origin)
    if (url.scheme not in ('https', 'http') or not url.hostname or url.username or url.password or
        url.query or url.fragment or url.path not in ('', '/') or
        (url.scheme == 'http' and url.hostname not in ('127.0.0.1', 'localhost'))):
        raise ValueError('Use an HTTPS origin or an isolated loopback fixture.')
    origin = origin.rstrip('/')
    headers, raw = get(origin + '/.well-known/kaizen-release.json')
    marker = json.loads(raw)
    identity = marker.get('releaseId', '')
    if marker.get('schemaVersion') not in (1, 2) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,95}', identity):
        raise ValueError('The public marker has an invalid release identity.')
    if headers.get('X-Kaizen-Release') != identity or headers.get_content_type() != 'application/json':
        raise ValueError('The marker response identity is inconsistent.')
    if marker['schemaVersion'] == 2 and marker.get('client', {}).get('origin') != origin:
        raise ValueError('The client marker belongs to a different destination.')
    page_headers, page = get(origin + '/')
    if page_headers.get('X-Kaizen-Release') != identity or page_headers.get_content_type() != 'text/html':
        raise ValueError('The home page does not match the public release.')
    if b'<html' not in page.lower() and b'<!doctype html' not in page.lower():
        raise ValueError('The public home page is not an HTML document.')
    return {'healthy': True, 'origin': origin, 'releaseId': identity}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Use check_public.py <public-https-origin>.')
    for attempt in range(2):
        try:
            print(json.dumps(check(sys.argv[1])))
            break
        except Exception:
            if attempt == 1:
                sys.exit('Public uptime verification failed twice. Inspect the site, DNS/TLS and release routing.')
            time.sleep(5)
