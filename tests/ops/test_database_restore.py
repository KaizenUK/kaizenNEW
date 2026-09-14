"""Full native PostgreSQL archive restored after its source server is stopped.

KAIZEN_PG_BIN selects an installed/extracted PostgreSQL 17 bin directory. Run as
an unprivileged user. Both servers are temporary, Unix-socket-only fixtures;
there are no live account credentials, mail functions or network services.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ops'))
import supabase_backup as sb


class ObjectResponse(io.BytesIO):
    status = 200
    headers = {}


@unittest.skipUnless(os.environ.get('KAIZEN_PG_BIN'), 'Set KAIZEN_PG_BIN for the native PostgreSQL restore drill.')
class DatabaseRestoreTests(unittest.TestCase):
    def test_full_archive_restores_rows_roles_policies_triggers_and_objects_without_source_server(self):
        self.assertNotEqual(os.getuid(), 0, 'Run this fixture as an unprivileged user.')
        pg = Path(os.environ['KAIZEN_PG_BIN'])
        with tempfile.TemporaryDirectory(prefix='kaizen-pg-restore-') as temporary:
            root = Path(temporary)
            servers = []
            def cluster(name, user):
                folder = root / name
                folder.mkdir(mode=0o700)
                data, socket = folder / 'data', folder / 'socket'
                socket.mkdir(mode=0o700)
                sb.native(pg / 'initdb', ['--pgdata=' + str(data), '--username=' + user,
                    '--auth=trust', '--encoding=UTF8', '--no-locale'], {'PATH': '/usr/bin:/bin'})
                # pg_ctl emits ordinary startup information on stdout. Server
                # logs stay in the private fixture and are never row diagnostics.
                options = '-k ' + shlex.quote(str(socket)) + " -c listen_addresses='' -c unix_socket_permissions=0700 -c shared_buffers=16MB -c max_connections=10 -c jit=off"
                sb.native(pg / 'pg_ctl', ['-D', str(data), '-l', str(folder / 'server.log'),
                    '-o', options, '-w', 'start'], {'PATH': '/usr/bin:/bin'})
                servers.append(data)
                return {'PATH': '/usr/bin:/bin', 'PGHOST': str(socket), 'PGUSER': user,
                        'PGDATABASE': 'postgres', 'PGCONNECT_TIMEOUT': '3'}
            def sql(env, text):
                return sb.native(pg / 'psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', text], env)
            try:
                source = cluster('source', 'fixture_source_admin')
                content = b'Synthetic private object for the restore drill.'
                sql(source, """
                    create role authenticated;
                    create role supabase_read_only_user bypassrls;
                    grant pg_read_all_data to supabase_read_only_user;
                    create role fixture_login login password 'never-issued-fixture-password';
                    grant supabase_read_only_user to fixture_login;
                    create schema auth;
                    create table auth.users(id uuid primary key, email text, encrypted_password text);
                    create schema storage;
                    create table storage.buckets(id text primary key, public boolean);
                    create table storage.objects(id uuid primary key, bucket_id text references storage.buckets,
                        name text, metadata jsonb, version text, last_accessed_at timestamptz);
                    create table public.projects(id integer primary key, owner_id uuid references auth.users,
                        title text, draft jsonb, revision integer not null default 1);
                    alter table public.projects enable row level security;
                    alter table public.projects force row level security;
                    create policy only_own_project on public.projects for select to authenticated
                        using(owner_id::text = current_setting('fixture.user_id', true));
                    grant usage on schema public to authenticated;
                    grant select on public.projects to authenticated;
                    create function public.bump_revision() returns trigger language plpgsql as $$
                        begin new.revision := old.revision + 1; return new; end $$;
                    create trigger preserve_revisions before update on public.projects
                        for each row execute function public.bump_revision();
                    insert into auth.users values
                        ('00000000-0000-4000-8000-000000000001','first@fixture.invalid','fixture-hash-one'),
                        ('00000000-0000-4000-8000-000000000002','second@fixture.invalid','fixture-hash-two');
                    insert into public.projects(id,owner_id,title,draft) values
                        (1,'00000000-0000-4000-8000-000000000001','Unpublished café','{"text":"Not yet published"}'),
                        (2,'00000000-0000-4000-8000-000000000002','Another owner','{"nested":{"value":42}}');
                    insert into storage.buckets values ('private',false);
                """
                + "insert into storage.objects values ('00000000-0000-4000-8000-000000000003','private',"
                + "'folder/fixture.png','" + json.dumps({'size': len(content), 'eTag': hashlib.md5(content).hexdigest()})
                + "','fixture-version',null);")
                # Native export authenticates as the restricted role, not as the
                # fixture superuser; forced RLS must not filter out either owner.
                export_env = {**source, 'PGUSER': 'fixture_login'}
                catalog = sb.sql_json(pg, export_env, sb.CATALOG)
                self.assertTrue(catalog['bypassRls'])
                self.assertEqual(catalog['readOnly'], 'on')
                for name, text in [('token', 'never-issued-fixture-token'), ('ca', 'fixture-ca'),
                                   ('worker.env', 'BUILDER_RELEASE_SERVICE_ROLE_KEY=never-issued-fixture-service')]:
                    (root / name).write_text(text)
                    (root / name).chmod(0o600)
                config = {'projectRef': 'a' * 20, 'managementTokenFile': str(root / 'token'),
                    'workerEnvironmentFile': str(root / 'worker.env'), 'postgresBin': str(pg),
                    'certificateFile': str(root / 'ca')}
                capture = sb.SupabaseBackup(config)
                captured = root / 'capture'
                captured.mkdir(mode=0o700)
                with patch.object(capture, 'connection', return_value=(export_env, catalog)), \
                     patch.object(capture, 'management', return_value={'pitr_enabled': False}), \
                     patch.object(sb, 'request', lambda _: ObjectResponse(content)):
                    capture.capture(captured)
                backup = captured / 'supabase'
                roles = (backup / 'roles.sql').read_text()
                self.assertNotIn('never-issued-fixture-password', roles)
                self.assertNotIn('SCRAM-SHA-256$', roles)
                original = json.loads(sql(source, "select json_agg(to_jsonb(p) order by p.id) from public.projects p"))
                # Stop the source before starting the independent recovery host.
                source_data = servers.pop()
                sb.native(pg / 'pg_ctl', ['-D', str(source_data), '-m', 'fast', '-w', 'stop'], {'PATH': '/usr/bin:/bin'})
                # PostgreSQL records some predefined-role grants against its
                # bootstrap superuser (OID 10). Recreate that same identity;
                # only its already-created CREATE ROLE statement is omitted.
                restored = cluster('restored', 'fixture_source_admin')
                bootstrap_create = 'CREATE ROLE fixture_source_admin;\n'
                self.assertEqual(roles.count(bootstrap_create), 1)
                prepared_roles = root / 'prepared-roles.sql'
                prepared_roles.write_text(roles.replace(bootstrap_create, ''))
                role_restore = subprocess.run([str(pg / 'psql'), '-X', '-q', '-v', 'ON_ERROR_STOP=1',
                    '--file=' + str(prepared_roles)], env=restored, capture_output=True)
                self.assertEqual(role_restore.returncode, 0, role_restore.stderr.decode())
                # Keep PostgreSQL's empty built-in public schema: pg_dump omits
                # its creation when the source still uses the default schema.
                archive_restore = subprocess.run([str(pg / 'pg_restore'), '--exit-on-error', '--single-transaction',
                    '--dbname=postgres', str(backup / 'database.dump')], env=restored, capture_output=True)
                self.assertEqual(archive_restore.returncode, 0, archive_restore.stderr.decode())
                actual = json.loads(sql(restored, "select json_agg(to_jsonb(p) order by p.id) from public.projects p"))
                self.assertEqual(actual, original)
                self.assertEqual(sql(restored, 'select count(*) from auth.users').strip(), b'2')
                visible = sql(restored, "set role authenticated; set fixture.user_id='00000000-0000-4000-8000-000000000001'; select array_agg(id) from public.projects")
                self.assertEqual(visible.strip(), b'{1}')
                no_access = subprocess.run([str(pg / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c',
                    'set role authenticated; select * from auth.users'], env=restored, capture_output=True)
                self.assertNotEqual(no_access.returncode, 0)
                self.assertIn(b'permission denied', no_access.stderr)
                sql(restored, "update public.projects set title='Recovered revision' where id=1")
                self.assertEqual(sql(restored, 'select revision from public.projects where id=1').strip(), b'2')
                receipt = json.loads((backup / 'capture.json').read_text())
                self.assertEqual(len(receipt['objects']), 1)
                record = receipt['objects'][0]
                self.assertEqual((backup / 'objects' / record['file']).read_bytes(), content)
                restored_objects = sb.sql_json(pg, restored, sb.STORAGE)
                self.assertEqual(restored_objects['objects'][0], record['source'])
                self.assertFalse((source_data / 'postmaster.pid').exists())
            finally:
                for data in reversed(servers):
                    subprocess.run([str(pg / 'pg_ctl'), '-D', str(data), '-m', 'immediate', '-w', 'stop'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    unittest.main()
