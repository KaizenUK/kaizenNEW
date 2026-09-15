"""Eight real PostgreSQL connections contend for one synthetic first sign-in.

Uses an isolated Unix-socket cluster and the production migrations. The parent
holds the initialization lock until all eight calls are observed waiting for it.
No provider API, real identity, website directory or email is used.
"""
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import time
import unittest


@unittest.skipUnless(os.environ.get('KAIZEN_PG_BIN'), 'Set KAIZEN_PG_BIN for native signup concurrency.')
class SignupConcurrencyTests(unittest.TestCase):
    def test_simultaneous_first_signins_create_exactly_one_project_and_deletion_does_not_recreate_it(self):
        self.assertNotEqual(os.getuid(), 0)
        pg = Path(os.environ['KAIZEN_PG_BIN'])
        repo = Path(__file__).resolve().parents[2]
        actor = '22222222-2222-4222-8222-222222222222'
        with tempfile.TemporaryDirectory(prefix='kaizen-signup-pg-') as temporary:
            root = Path(temporary)
            data, socket = root / 'data', root / 'socket'
            socket.mkdir(mode=0o700)
            environment = {'PATH': '/usr/bin:/bin', 'PGHOST': str(socket), 'PGUSER': 'fixture_admin',
                           'PGDATABASE': 'postgres', 'PGCONNECT_TIMEOUT': '3'}
            def run(name, args, input=None):
                return subprocess.run([str(pg / name), *args], input=input, env=environment,
                                      check=True, text=True, capture_output=True, timeout=30).stdout.strip()
            def sql(value):
                return run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], value)
            run('initdb', ['--pgdata=' + str(data), '--username=fixture_admin', '--auth=trust', '--encoding=UTF8', '--no-locale'])
            options = '-k ' + shlex.quote(str(socket)) + " -c listen_addresses='' -c unix_socket_permissions=0700 -c shared_buffers=16MB -c max_connections=15 -c jit=off"
            run('pg_ctl', ['-D', str(data), '-l', str(root / 'server.log'), '-o', options, '-w', 'start'])
            children = []
            try:
                sql("""create role anon; create role authenticated; create role service_role bypassrls;
                    create schema auth;
                    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
                    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
                    create schema storage;
                    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
                    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id));
                    alter table storage.objects enable row level security;
                    grant usage on schema public,auth,storage to anon,authenticated,service_role;""")
                for name in ['202609100001_visual_builder.sql', '202609100002_builder_site_design.sql',
                             '202609100008_builder_releases.sql', '202609110001_builder_projects.sql',
                             '202609120001_builder_project_capabilities.sql', '202609130001_builder_invitations.sql',
                             '202609130002_builder_accounts.sql', '202609140004_builder_legal_privacy.sql',
                             '202609150001_builder_signup.sql']:
                    sql((repo / 'supabase/migrations' / name).read_text())
                sql(f"insert into auth.users(id,email,email_confirmed_at) values('{actor}','concurrent@example.test',now());"
                    f"insert into builder_legal_acceptances(user_id,version) values('{actor}','2026-09-14');")
                barrier = subprocess.Popen([str(pg / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                                           env={**environment, 'PGAPPNAME': 'fixture-signup-barrier'},
                                           stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                children.append(barrier)
                barrier.stdin.write(f"begin; select pg_advisory_xact_lock(hashtextextended('builder-first-project:{actor}',0));\n")
                barrier.stdin.flush()
                deadline = time.monotonic() + 10
                while sql("select count(*) from pg_stat_activity where application_name='fixture-signup-barrier' and state='idle in transaction'") != '1':
                    self.assertIsNone(barrier.poll())
                    self.assertLess(time.monotonic(), deadline, 'The fixture barrier did not acquire its lock.')
                    time.sleep(0.02)
                workers = []
                for index in range(8):
                    process = subprocess.Popen([str(pg / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c',
                        f"set role service_role; select builder_bootstrap_account('{actor}');"],
                        env={**environment, 'PGAPPNAME': f'fixture-signup-call-{index}'},
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    workers.append(process)
                    children.append(process)
                deadline = time.monotonic() + 10
                while sql("select count(*) from pg_stat_activity where application_name like 'fixture-signup-call-%' and wait_event='advisory'") != '8':
                    self.assertTrue(all(process.poll() is None for process in workers), 'A call ended before the concurrency barrier.')
                    self.assertLess(time.monotonic(), deadline, 'All eight callers must reach the actual lock before release.')
                    time.sleep(0.02)
                barrier.communicate('commit;\n', timeout=10)
                self.assertEqual(barrier.returncode, 0)
                results = []
                for process in workers:
                    stdout, stderr = process.communicate(timeout=15)
                    self.assertEqual(process.returncode, 0, stderr)
                    results.append(json.loads(stdout))
                self.assertEqual(sum(item['created'] for item in results), 1)
                self.assertEqual(len({item['projectId'] for item in results}), 1)
                project = results[0]['projectId']
                self.assertNotEqual(project, 'kaizen')
                self.assertEqual(sql(f"select count(*) from builder_project_members where user_id='{actor}'"), '1')
                self.assertEqual(sql(f"select count(*) from builder_project_workspaces where project_id='{project}'"), '1')
                self.assertEqual(sql(f"select count(*) from builder_account_initializations where user_id='{actor}'"), '1')
                sql(f"delete from builder_projects where id='{project}';")
                self.assertEqual(json.loads(sql(f"set role service_role; select builder_bootstrap_account('{actor}');")), {'created': False, 'projectId': None})
            finally:
                for process in children:
                    if process.poll() is None:
                        process.terminate()
                        process.communicate(timeout=10)
                run('pg_ctl', ['-D', str(data), '-m', 'immediate', '-w', 'stop'])


if __name__ == '__main__':
    unittest.main()
