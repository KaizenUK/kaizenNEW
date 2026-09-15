#!/usr/bin/env python3
"""Prepare the root domain service without starting it before the L6 migration.

Run only with a reviewed bundled worker, private host JSON and verified Node
runtime. No environment values or database contents are emitted. This prepares
an empty loopback route and systemd units; rollout enables the timer separately.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile


INCLUDE = '  include /etc/nginx/kaizen-domains.conf;\n'
EMPTY_ROUTES = ('# Kaizen domain routes v1 — managed by the domain worker\n'
                'server { listen 127.0.0.1:8094 default_server; server_name _; return 404; }\n')


def with_domain_include(text):
    """Only change a verified, standalone http opening; preserve all other bytes."""
    if INCLUDE in text:
        if text.count(INCLUDE) != 1:
            raise ValueError('Repeated domain include.')
        return text
    if 'kaizen-domains.conf' in text:
        raise ValueError('An unrecognized domain include already exists.')
    matches = list(re.finditer(r'^http[ \t]*\{[ \t]*\n', text, re.M))
    if len(matches) != 1:
        raise ValueError('Select the actual Nginx http configuration before installation.')
    end = matches[0].end()
    return text[:end] + INCLUDE + text[end:]


def owned(path, directory=False, private=False, executable=False):
    path = Path(path)
    metadata = path.lstat()
    if path != path.resolve() or metadata.st_uid != 0 or metadata.st_mode & (0o077 if private else 0o022):
        raise ValueError('Expected an ordinary root-owned host path.')
    if directory:
        if not stat.S_ISDIR(metadata.st_mode):
            raise ValueError('Expected a directory.')
    elif not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1 or (not executable and metadata.st_size > 16777216):
        raise ValueError('Expected an ordinary bounded file.')
    for parent in path.parents:
        info = parent.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError('Host path has an unsafe ancestor.')
    return path


def read(path, private=False):
    path = owned(path, private=private)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        before = path.lstat()
        if (info.st_dev, info.st_ino) != (before.st_dev, before.st_ino):
            raise ValueError('Host file changed during verification.')
        with os.fdopen(fd, 'rb', closefd=False) as stream:
            return stream.read(16777217)
    finally:
        os.close(fd)


def atomic(path, content, mode):
    path = Path(path)
    owned(path.parent, directory=True)
    if os.path.lexists(path):
        owned(path)
    descriptor, temporary = tempfile.mkstemp(prefix='.' + path.name + '-', dir=path.parent)
    try:
        os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        parent = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)
    finally:
        if os.path.lexists(temporary):
            os.unlink(temporary)


def directory(path, mode):
    path = Path(path)
    if not os.path.lexists(path):
        owned(path.parent, directory=True)
        path.mkdir(mode=mode)
    owned(path, directory=True, private=mode == 0o700)


def run(args, required=True):
    result = subprocess.run(args, text=True, capture_output=True, timeout=60,
                            env={'PATH': '/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C.UTF-8'})
    if required and result.returncode:
        raise RuntimeError('A host preparation command did not succeed.')
    return result


def worker_service(text, node):
    node = str(node)
    if not re.fullmatch(r'/[a-zA-Z0-9_./-]+', node) or node != str(Path(node).resolve()):
        raise ValueError('Choose a canonical Node executable.')
    original = 'ExecStart=/usr/bin/node /opt/kaizen-domain-worker/worker.mjs --once'
    if text.count(original) != 1:
        raise ValueError('Unexpected worker service template.')
    return text.replace(original, f'ExecStart={node} /opt/kaizen-domain-worker/worker.mjs --once')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', required=True)
    parser.add_argument('--configuration', required=True)
    parser.add_argument('--node', required=True)
    parser.add_argument('--nginx-before-sha256', required=True)
    args = parser.parse_args()
    if os.getuid() != 0 or not re.fullmatch('[a-f0-9]{64}', args.nginx_before_sha256):
        raise ValueError('Run as root with the observed Nginx configuration hash.')
    # Serialize preparation. The scheduler must be stopped before swapping a bundle.
    lock = os.open('/run/lock/kaizen-domain-install.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        for unit in ['kaizen-domain-worker.service', 'kaizen-domain-worker.timer']:
            state = run(['/usr/bin/systemctl', 'show', '-p', 'ActiveState', '--value', unit], required=False).stdout.strip()
            if state not in ('', 'inactive', 'failed'):
                raise ValueError('Stop the domain scheduler before preparation.')
        bundle = read(args.bundle)
        configuration = read(args.configuration, private=True)
        # The worker validates the full schema during --check-host. Reject broken
        # JSON now, before any target file or service definition changes.
        if not isinstance(json.loads(configuration), dict):
            raise ValueError('Expected private host JSON.')
        node = owned(Path(args.node), executable=True)
        if not os.access(node, os.X_OK):
            raise ValueError('Expected an executable Node runtime.')
        run([str(node), args.bundle, '--validate-configuration', args.configuration])
        nginx = Path('/etc/nginx/nginx.conf')
        before = read(nginx)
        if hashlib.sha256(before).hexdigest() != args.nginx_before_sha256:
            raise ValueError('Nginx configuration changed after inspection.')
        after = with_domain_include(before.decode()).encode()
        run(['/usr/local/sbin/nginx', '-t'])
        directory('/var/lib/kaizen-domains', 0o700)
        for child in ['jobs', 'provider', 'routing', 'installation']:
            directory('/var/lib/kaizen-domains/' + child, 0o700)
        owned('/etc/kaizen', directory=True)
        owned('/var/lib/kaizen-client-releases', directory=True)
        history = Path('/var/lib/kaizen-domains/installation')
        backup = history / (args.nginx_before_sha256 + '.nginx.conf')
        if backup.exists():
            if read(backup, private=True) != before:
                raise ValueError('Existing configuration backup differs.')
        else:
            atomic(backup, before, 0o600)
        digest = hashlib.sha256(bundle).hexdigest()
        directory('/opt/kaizen-domain-worker-releases', 0o755)
        release = Path('/opt/kaizen-domain-worker-releases') / digest
        directory(release, 0o755)
        target = release / 'worker.mjs'
        if target.exists():
            if read(target) != bundle:
                raise ValueError('Immutable domain bundle differs.')
        else:
            atomic(target, bundle, 0o644)
        pointer = Path('/opt/kaizen-domain-worker')
        if os.path.lexists(pointer):
            info = pointer.lstat()
            if not stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or not re.fullmatch(
                    r'/opt/kaizen-domain-worker-releases/[a-f0-9]{64}', os.readlink(pointer)):
                raise ValueError('Existing runtime is not a managed domain bundle.')
            owned(pointer.resolve(), directory=True)
        pending = Path('/opt/.kaizen-domain-worker-' + digest)
        if os.path.lexists(pending):
            raise ValueError('Inspect the prior pending runtime installation.')
        pending.symlink_to(release)
        os.replace(pending, pointer)
        host_config = Path('/etc/kaizen/domain-worker.json')
        if host_config.exists():
            if read(host_config, private=True) != configuration:
                raise ValueError('Review the existing domain host configuration before replacing it.')
        else:
            atomic(host_config, configuration, 0o600)
        routes = Path('/etc/nginx/kaizen-domains.conf')
        if os.path.lexists(routes):
            read(routes)
        else:
            atomic(routes, EMPTY_ROUTES.encode(), 0o644)
        source = Path(__file__).resolve().parent / 'systemd'
        for name in ['kaizen-domain-worker.service', 'kaizen-domain-worker.timer']:
            content = read(source / name).decode()
            if name.endswith('.service'):
                content = worker_service(content, node)
            atomic('/etc/systemd/system/' + name, content.encode(), 0o644)
        if read(nginx) != before:
            raise ValueError('Nginx changed before installation.')
        if after != before:
            atomic(nginx, after, 0o644)
        try:
            run(['/usr/local/sbin/nginx', '-t'])
            run(['/usr/bin/systemctl', 'reload', 'kaizen-nginx.service'])
            if run(['/usr/bin/systemctl', 'is-active', 'kaizen-nginx.service']).stdout.strip() != 'active':
                raise RuntimeError('Nginx is not active.')
        except Exception:
            if read(nginx) != after:
                raise RuntimeError('Nginx changed externally; preserve it for operator recovery.') from None
            atomic(nginx, before, 0o644)
            run(['/usr/local/sbin/nginx', '-t'])
            run(['/usr/bin/systemctl', 'reload', 'kaizen-nginx.service'])
            raise
        run(['/usr/bin/systemctl', 'daemon-reload'])
        atomic(history / 'prepared.json', (json.dumps({'schemaVersion': 1, 'bundleSha256': digest,
               'nginxBeforeSha256': args.nginx_before_sha256, 'nginxAfterSha256': hashlib.sha256(after).hexdigest(),
               'timerEnabled': False}) + '\n').encode(), 0o600)
        print(json.dumps({'status': 'prepared', 'bundleSha256': digest, 'timerEnabled': False}))
    finally:
        os.close(lock)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # A provider/runtime exception may carry sensitive host data; keep logs bounded.
        print('{"status":"failed","reason":"domain_host_preparation_failed"}')
        raise SystemExit(1) from None
