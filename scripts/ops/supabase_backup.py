"""Read-only PostgreSQL and Storage capture for the encrypted operations backup.

Provider login passwords are short-lived and passed only in a child environment.
Object paths are metadata, never local paths. This module does not restore or
write to a hosted database, upload objects, or change the provider's paid plan.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

from backup import BackupError, atomic_json, now, private_file, real_path


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward a management or service credential to a redirect target.
        return None


def request(req):
    try:
        return urllib.request.build_opener(NoRedirect()).open(req, timeout=60)
    except urllib.error.HTTPError as error:
        error.close()
        raise BackupError('A Supabase backup request failed; response contents are private.') from None
    except (OSError, urllib.error.URLError):
        raise BackupError('A Supabase backup request failed; response contents are private.') from None


def read_json(response, maximum=32 * 1024**2):
    with response:
        data = response.read(maximum + 1)
    if len(data) > maximum:
        raise BackupError('Supabase backup metadata exceeds its limit.')
    return json.loads(data)


def service_key(env_file):
    # Read the existing systemd environment file without executing shell code.
    entries = {}
    for line in private_file(env_file).read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if not separator:
            raise BackupError('Invalid worker credential configuration.')
        if key == 'BUILDER_RELEASE_SERVICE_ROLE_KEY':
            parsed = shlex.split(value)
            if len(parsed) != 1 or key in entries:
                raise BackupError('Invalid worker credential configuration.')
            entries[key] = parsed[0]
    value = entries.get('BUILDER_RELEASE_SERVICE_ROLE_KEY', '')
    if not value or '\n' in value or '\r' in value:
        raise BackupError('The configured Storage backup credential is unavailable.')
    return value


def pg_error(stderr):
    # SQL can contain user content; never echo stderr, even on export failure.
    if b'password authentication failed' in stderr:
        return 'Database backup authentication is not ready.'
    denied = re.search(rb'permission denied for (?:table|schema) ([A-Za-z0-9_]+)', stderr)
    if denied:
        return 'Database backup lacks access to ' + denied[1].decode() + '.'
    return 'A PostgreSQL backup command failed or reported a warning.'


def native(binary, args, env, timeout=900):
    try:
        result = subprocess.run([str(binary), *args], env=env, stdin=subprocess.DEVNULL,
                                capture_output=True, timeout=timeout, umask=0o077)
    except (OSError, subprocess.TimeoutExpired):
        raise BackupError('A PostgreSQL backup command could not complete.') from None
    if result.returncode or result.stderr.strip():
        raise BackupError(pg_error(result.stderr))
    return result.stdout


def sql_json(binary, env, query):
    sql = 'begin read only; set local role supabase_read_only_user; ' + query + '; rollback;'
    return json.loads(native(binary / 'psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], env, 60))


CATALOG = """select json_build_object(
 'version',current_setting('server_version_num'),
 'readOnly',current_setting('transaction_read_only'),
 'bypassRls',(select rolbypassrls from pg_roles where rolname=current_user),
 'bootstrapRole',(select rolname from pg_roles where oid=10),
 'schemas',(select coalesce(json_agg(nspname order by nspname),'[]') from pg_namespace
   where nspname not like 'pg_%' and nspname <> 'information_schema'),
 'extensions',(select coalesce(json_agg(json_build_object('name',extname,'version',extversion)
   order by extname),'[]') from pg_extension))"""

STORAGE = """select json_build_object(
 'buckets',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from storage.buckets b),
 'objects',(select coalesce(jsonb_agg(to_jsonb(o)-'last_accessed_at' order by o.bucket_id,o.name),'[]')
   from (select * from storage.objects order by bucket_id,name limit 100001) o))"""


class SupabaseBackup:
    def __init__(self, config):
        self.ref = config['projectRef']
        if not re.fullmatch(r'[a-z]{20}', self.ref):
            raise BackupError('Invalid Supabase project reference.')
        self.token = private_file(config['managementTokenFile']).read_text().strip()
        if not self.token or '\n' in self.token or '\r' in self.token:
            raise BackupError('Invalid management token file.')
        self.key = service_key(config['workerEnvironmentFile'])
        self.bin = real_path(config.get('postgresBin', '/usr/lib/postgresql/17/bin'))
        self.ca = real_path(config['certificateFile'], False)
        if not self.ca.is_file():
            raise BackupError('The Supabase database certificate is unavailable.')
        self.max_bytes = config.get('maxStorageBytes', 10 * 1024**3)
        if not isinstance(self.max_bytes, int) or not 0 < self.max_bytes <= 20 * 1024**3:
            raise BackupError('Invalid Storage backup byte limit.')
        self.expires_at = float('inf')

    def management(self, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request('https://api.supabase.com/v1/projects/' + self.ref + path,
            data=data, headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        return read_json(request(req))

    def connection(self):
        poolers = self.management('/config/database/pooler')
        pooler = next((p for p in poolers if p.get('db_name') == 'postgres'
                       and re.fullmatch(r'aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com', p.get('db_host', ''))), None)
        if pooler is None:
            raise BackupError('A supported Supabase session pooler is unavailable.')
        login = self.management('/cli/login-role', {'read_only': True})
        if login.get('role') != 'cli_login_supabase_read_only_user' or not login.get('password') or not isinstance(login.get('ttl_seconds'), int) or login['ttl_seconds'] < 60:
            raise BackupError('Supabase did not issue the expected read-only backup login.')
        self.expires_at = time.monotonic() + login['ttl_seconds'] - 30
        env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'PGHOST': pooler['db_host'],
               'PGPORT': '5432', 'PGDATABASE': 'postgres', 'PGUSER': login['role'] + '.' + self.ref,
               'PGPASSWORD': login['password'], 'PGSSLMODE': 'verify-full', 'PGSSLROOTCERT': str(self.ca),
               'PGCONNECT_TIMEOUT': '15', 'PGAPPNAME': 'kaizen-backup'}
        # The provider's pooler may briefly retain the old password. Retry only
        # authentication readiness, using this same login; never rotate in a loop.
        for attempt in range(4):
            try:
                catalog = sql_json(self.bin, env, CATALOG)
                break
            except BackupError as error:
                if str(error) != 'Database backup authentication is not ready.' or attempt == 3:
                    raise
                time.sleep(3)
        if catalog.get('readOnly') != 'on' or catalog.get('bypassRls') is not True:
            raise BackupError('The backup connection cannot read all rows in a read-only transaction.')
        return env, catalog

    def refresh(self, env):
        # Existing PostgreSQL sessions can finish after login expiry. Renew only
        # before another connection if a long object copy/export used the TTL.
        return self.connection()[0] if time.monotonic() >= self.expires_at else env

    def download(self, entry, target, remaining):
        bucket, name = entry.get('bucket_id'), entry.get('name')
        if not isinstance(bucket, str) or not bucket or not isinstance(name, str) or not name:
            raise BackupError('Invalid Storage object metadata.')
        # Percent-encode complete path segments, including dot-only segments.
        def segment(value):
            return urllib.parse.quote(value, safe='').replace('.', '%2E') if value in ('.', '..') else urllib.parse.quote(value, safe='')
        path = '/'.join(segment(x) for x in [bucket, *name.split('/')])
        url = 'https://' + self.ref + '.supabase.co/storage/v1/object/' + path
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + self.key,
                                                  'apikey': self.key, 'Accept-Encoding': 'identity'})
        digest, md5, size = hashlib.sha256(), hashlib.md5(usedforsecurity=False), 0
        with request(req) as response, os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb') as output:
            if response.status != 200 or response.headers.get('Content-Encoding', 'identity') != 'identity':
                raise BackupError('Storage did not return the original object bytes.')
            expected_etag = str((entry.get('metadata') or {}).get('eTag', '')).strip('"')
            received_etag = response.headers.get('ETag', '').strip('"')
            if expected_etag and received_etag and expected_etag != received_etag:
                raise BackupError('Storage returned a different object version.')
            for chunk in iter(lambda: response.read(1024 * 1024), b''):
                size += len(chunk)
                if size > remaining:
                    raise BackupError('Storage objects exceed the configured backup byte limit.')
                digest.update(chunk)
                md5.update(chunk)
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
        metadata = entry.get('metadata') or {}
        if metadata.get('size') is not None and str(metadata['size']) != str(size):
            raise BackupError('A Storage object does not match its recorded size.')
        etag = str(metadata.get('eTag', '')).strip('"')
        if re.fullmatch(r'[0-9a-fA-F]{32}', etag) and md5.hexdigest() != etag.lower():
            raise BackupError('A Storage object does not match its recorded content hash.')
        return {'bytes': size, 'sha256': digest.hexdigest()}

    def capture(self, data):
        target = real_path(data) / 'supabase'
        target.mkdir(mode=0o700)
        objects = target / 'objects'
        objects.mkdir(mode=0o700)
        env, catalog = self.connection()
        before = sql_json(self.bin, env, STORAGE)
        if not isinstance(before.get('objects'), list) or len(before['objects']) > 100000:
            raise BackupError('Storage object inventory exceeds its backup limit.')
        captured, total, identities = [], 0, set()
        for entry in before['objects']:
            identity = json.dumps([entry.get('bucket_id'), entry.get('name')], ensure_ascii=True).encode()
            file = hashlib.sha256(identity).hexdigest()
            if file in identities:
                raise BackupError('Duplicate Storage object identity.')
            identities.add(file)
            record = self.download(entry, objects / file, self.max_bytes - total)
            total += record['bytes']
            captured.append({'source': entry, 'file': file, **record})
        # A full custom archive retains schema, data, RLS, grants, functions,
        # triggers and extension declarations. Never enable row-security filtering
        # to make an incomplete export appear successful.
        archive = target / 'database.dump'
        env = self.refresh(env)
        native(self.bin / 'pg_dump', ['--no-password', '--format=custom', '--role=supabase_read_only_user',
            '--lock-wait-timeout=5s', '--file=' + str(archive)], env)
        env = self.refresh(env)
        native(self.bin / 'pg_dumpall', ['--no-password', '--roles-only', '--no-role-passwords',
            '--role=supabase_read_only_user', '--file=' + str(target / 'roles.sql')], env)
        if sql_json(self.bin, self.refresh(env), STORAGE) != before:
            raise BackupError('Storage changed during database capture; no verified backup was recorded.')
        native(self.bin / 'pg_restore', ['--list', str(archive)], env)
        # Fully decode the archive as SQL, without connecting to any database.
        native(self.bin / 'pg_restore', ['--file=/dev/null', str(archive)], env)
        atomic_json(target / 'capture.json', {'version': 1, 'projectRef': self.ref, 'completedAt': now(),
            'catalog': catalog, 'buckets': before.get('buckets'), 'objects': captured, 'storageBytes': total,
            'providerBackups': self.management('/database/backups')})
