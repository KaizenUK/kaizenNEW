"""Native, simultaneous domain transactions in a disposable Unix-only PG.

Every contention group is held at an actual database lock until all callers are
observed waiting. No Auth provider, customer, payment or website is contacted.
"""
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import time
import unittest
import uuid
from datetime import datetime, timedelta, timezone


@unittest.skipUnless(os.environ.get('KAIZEN_PG_BIN'), 'Set KAIZEN_PG_BIN for native domain concurrency.')
class DomainConcurrencyTests(unittest.TestCase):
    def test_domain_claims_hostname_ownership_and_publication_exclusion(self):
        self.assertNotEqual(os.getuid(), 0)
        pg = Path(os.environ['KAIZEN_PG_BIN'])
        repo = Path(__file__).resolve().parents[2]
        actor = '22222222-2222-4222-8222-222222222222'
        with tempfile.TemporaryDirectory(prefix='kaizen-domain-pg-') as temporary:
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
                    grant usage on schema public,auth,storage to anon,authenticated,service_role;
                    create table public.contact_form_submissions(name text,last_name text,email text,phone text,website text,message text,marketing_consent boolean,consent_to_gdpr boolean,source_page text,user_agent text);
                    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
                    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;""")
                skipped = {'202609120003_builder_error_retention.sql', '202609140002_builder_function_limit_retention.sql', '202609140005_builder_privacy_retention.sql', '202609150008_builder_billing_retention.sql'}
                for path in sorted((repo / 'supabase/migrations').glob('*.sql')):
                    if path.name in skipped or not ('_builder_' in path.name or '_visual_builder.' in path.name):
                        continue
                    sql(path.read_text())
                sql(f"insert into auth.users(id,email,email_confirmed_at) values('{actor}','concurrent@example.test',now());"
                    f"insert into builder_legal_acceptances(user_id,version) values('{actor}','2026-09-14');")

                def contend(label, barrier_sql, statements):
                    barrier = subprocess.Popen([str(pg / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                        env={**environment, 'PGAPPNAME': 'fixture-domain-barrier'}, stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    children.append(barrier)
                    barrier.stdin.write('begin; ' + barrier_sql + ';\n')
                    barrier.stdin.flush()
                    deadline = time.monotonic() + 10
                    while sql("select count(*) from pg_stat_activity where application_name='fixture-domain-barrier' and state='idle in transaction'") != '1':
                        self.assertIsNone(barrier.poll())
                        self.assertLess(time.monotonic(), deadline, 'Barrier did not acquire the actual database lock.')
                        time.sleep(0.02)
                    workers = []
                    for index, statement in enumerate(statements):
                        process = subprocess.Popen([str(pg / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', statement],
                            env={**environment, 'PGAPPNAME': f'fixture-{label}-{index}'}, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                        children.append(process)
                        workers.append(process)
                    deadline = time.monotonic() + 10
                    while sql(f"select count(*) from pg_stat_activity where application_name like 'fixture-{label}-%' and wait_event_type='Lock'") != str(len(workers)):
                        self.assertTrue(all(worker.poll() is None for worker in workers), f'{label}: a caller ended before reaching its lock.')
                        self.assertLess(time.monotonic(), deadline, f'{label}: every caller must be observed at a real lock.')
                        time.sleep(0.02)
                    barrier.communicate('commit;\n', timeout=10)
                    self.assertEqual(barrier.returncode, 0)
                    results = []
                    for worker in workers:
                        output, error = worker.communicate(timeout=15)
                        results.append((worker.returncode, output.strip(), error.strip()))
                    return results

                worker = 'fixture-domain-worker'
                sql("update builder_plans set projects=100 where id='free';")
                create = f"set request.jwt.claim.sub='{actor}'; set role authenticated; select builder_create_project('Concurrent domain fixture');"
                projects = [sql(create) for _ in range(10)]
                def project_lock(project):
                    return f"select 1 from builder_projects where id='{project}' for update"
                def add(project, domain, hostname):
                    return f"set role service_role; select builder_domain_request('{project}','{actor}','{domain}','add',null,'{hostname}','{'a'*64}','{worker}');"
                def claim(domain, token, previous=None):
                    prior = 'null' if previous is None else f"'{previous}'"
                    return f"set role service_role; select builder_domain_claim('{domain}','{worker}','{token}',{prior});"
                def get(domain):
                    return json.loads(sql(f"set role service_role; select builder_domain_worker_get('{domain}','{worker}');"))
                def finish(domain, token):
                    item = get(domain)
                    now = datetime.now(timezone.utc)
                    receipt = {'domainId': domain, 'attemptId': token, 'projectId': item['project_id'],
                        'hostname': item['hostname'], 'origin': 'https://' + item['hostname'],
                        'bindingKind': item['binding_kind'], 'destinationId': item['candidate_destination_id'],
                        'artifactId': 'domain-' + domain, 'manifestSha256': 'b'*64, 'certificateSha256': 'c'*64,
                        'certificateNames': [item['hostname']], 'certificateAutoRenew': True,
                        'certificateSelfSigned': False, 'certificateExpiresAt': (now+timedelta(days=30)).isoformat(),
                        'verifiedAt': now.isoformat(), 'providerOwned': True}
                    return f"set role service_role; select builder_domain_connect_finish('{domain}','{token}','{json.dumps(receipt)}');"
                def one_winner(results, phrase):
                    self.assertEqual(sum(code == 0 for code, _, _ in results), 1, results)
                    self.assertTrue(all(code == 0 or phrase in error for code, _, error in results), results)

                # Eight different add requests for one project cannot leave
                # multiple current claims or replace the first challenge.
                ids = [str(uuid.uuid4()) for _ in range(8)]
                results = contend('domain-add', project_lock(projects[0]),
                    [add(projects[0], domain, f'{domain}.fixture.co.uk') for domain in ids])
                one_winner(results, 'Remove the current domain')
                domain = json.loads(next(output for code, output, _ in results if code == 0))['domain']['id']
                self.assertEqual(sql(f"select count(*) from builder_domains where project_id='{projects[0]}'"), '1')

                tokens = [str(uuid.uuid4()) for _ in range(8)]
                results = contend('domain-claim', project_lock(projects[0]), [claim(domain, token) for token in tokens])
                one_winner(results, 'already claimed')
                previous = get(domain)['owner_token']
                recovery = [str(uuid.uuid4()) for _ in range(8)]
                results = contend('domain-recovery', project_lock(projects[0]), [claim(domain, token, previous) for token in recovery])
                one_winner(results, 'already claimed')
                current = get(domain)['owner_token']
                self.assertNotEqual(previous, current)
                # All callbacks from the replaced worker lose, even after waiting
                # behind a fresh worker on the actual project lock.
                results = contend('domain-late', project_lock(projects[0]),
                    [f"set role service_role; select builder_domain_dns_result('{domain}','{previous}','verified');"] * 8)
                self.assertTrue(all(code != 0 and 'no longer owns' in error for code, _, error in results), results)
                self.assertEqual(get(domain)['owner_token'], current)

                # Distinct project locks release together; the real unique-index
                # conflict elects one verified hostname owner across eight projects.
                competing = []
                for project in projects[1:9]:
                    request, token = str(uuid.uuid4()), str(uuid.uuid4())
                    sql(add(project, request, 'shared.fixture.co.uk'))
                    sql(claim(request, token))
                    competing.append((project, request, token))
                barrier = "select 1 from builder_projects where id in (" + ','.join(f"'{p}'" for p, _, _ in competing) + ") order by id for update"
                results = contend('domain-hostname', barrier,
                    [f"set role service_role; select builder_domain_dns_result('{request}','{token}','verified');" for _, request, token in competing])
                self.assertTrue(all(code == 0 for code, _, _ in results), results)
                observed = [json.loads(output) for _, output, _ in results]
                self.assertEqual(sum(item['claimed_at'] is not None for item in observed), 1)
                self.assertEqual(sum(item['reason'] == 'domain_in_use' and item['owner_token'] is None for item in observed), 7)
                selected = next(item for item in observed if item['claimed_at'] is not None)
                connected_sql = finish(selected['id'], selected['owner_token'])
                results = contend('domain-finish', project_lock(selected['project_id']), [connected_sql] * 8)
                self.assertTrue(all(code == 0 for code, _, _ in results), results)
                self.assertEqual(len({output for _, output, _ in results}), 1)
                destination = get(selected['id'])['destination_id']
                self.assertEqual(sql(f"select count(*) from builder_client_destinations where id='{destination}'"), '1')

                # A publication and a domain maintenance claim must never both
                # leave the common lock as active operations, in either order.
                sql(f"update builder_domains set next_check_at=now()-interval '1 second' where id='{selected['id']}';")
                token, job = str(uuid.uuid4()), str(uuid.uuid4())
                publish = (f"insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,previous_artifact_id,artifact_id) "
                    f"select '{job}',project_id,id,builder_client_destination_public(d),version,worker_id,'{actor}','unpublish',active_artifact_id,'fixture-next' "
                    f"from builder_client_destinations d where id='{destination}';")
                results = contend('domain-publication', project_lock(selected['project_id']), [claim(selected['id'], token), publish])
                self.assertEqual(sum(code == 0 for code, _, _ in results), 1, results)
                self.assertTrue(all(code == 0 or 'Domain setup is running' in error or 'publication or recovery' in error for code, _, error in results), results)
                state = get(selected['id'])
                self.assertEqual(int(state['owner_token'] is not None) + int(sql(f"select count(*) from builder_client_jobs where id='{job}'")), 1)
                # Whichever side won, explicitly test the inverse exclusion with
                # every contender observed waiting, rather than depending on luck.
                if state['owner_token'] is None:
                    sql(f"delete from builder_client_jobs where id='{job}';")
                    sql(claim(selected['id'], token))
                results = contend('domain-won', project_lock(selected['project_id']), [publish.replace(job, str(uuid.uuid4())) for _ in range(8)])
                self.assertTrue(all(code != 0 and 'Domain setup is running' in error for code, _, error in results), results)
                sql(finish(selected['id'], token))
                sql(publish)
                results = contend('publication-won', project_lock(selected['project_id']), [claim(selected['id'], str(uuid.uuid4())) for _ in range(8)])
                self.assertTrue(all(code != 0 and 'publication or recovery' in error for code, _, error in results), results)
                sql(f"delete from builder_client_jobs where id='{job}';")
                sql(f"update builder_domains set next_check_at=now()-interval '1 second' where id='{selected['id']}';")
                token = str(uuid.uuid4())
                sql(claim(selected['id'], token))

                # Concurrent physical-withdrawal failure callbacks cannot free a
                # hosting claim unless its exact current token supplies evidence.
                results = contend('domain-withdrawal-missing', project_lock(selected['project_id']),
                    [f"set role service_role; select builder_domain_dns_result('{selected['id']}','{token}','routing_mismatch');"] * 8)
                self.assertTrue(all(code != 0 and 'withdrawal required' in error for code, _, error in results), results)
                self.assertEqual(get(selected['id'])['owner_token'], token)
                receipt = {'domainId': selected['id'], 'attemptId': token, 'projectId': selected['project_id'],
                    'hostname': selected['hostname'], 'providerWithdrawn': True, 'routingRemoved': True,
                    'verifiedAt': datetime.now(timezone.utc).isoformat()}
                statement = f"set role service_role; select builder_domain_dns_result('{selected['id']}','{token}','routing_mismatch','{json.dumps(receipt)}');"
                results = contend('domain-withdrawal', project_lock(selected['project_id']), [statement] * 8)
                one_winner(results, 'no longer owns')
                self.assertEqual(sql(f"select enabled::text||','||domain_ready::text from builder_client_destinations where id='{destination}'"), 'true,false')
                results = contend('domain-suspended-publication', project_lock(selected['project_id']), [publish.replace(job, str(uuid.uuid4())) for _ in range(8)])
                self.assertTrue(all(code != 0 and 'domain is unavailable' in error for code, _, error in results), results)
                print('All 12 native domain contention groups passed: add, claim, recovery, late callbacks, hostname exclusivity, idempotent finish, publication exclusion in both orders and verified withdrawal.')
            finally:
                for process in children:
                    if process.poll() is None:
                        process.terminate()
                        process.communicate(timeout=10)
                run('pg_ctl', ['-D', str(data), '-m', 'immediate', '-w', 'stop'])


if __name__ == '__main__':
    unittest.main()
