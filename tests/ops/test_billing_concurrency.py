"""Native, simultaneous billing/usage transactions in a disposable Unix-only PG.

Every contention group is held at an actual database lock until all callers are
observed waiting. No Auth provider, customer, payment or website is contacted.
"""
import ast
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import time
import unittest
import uuid


@unittest.skipUnless(os.environ.get('KAIZEN_PG_BIN'), 'Set KAIZEN_PG_BIN for native billing concurrency.')
class BillingConcurrencyTests(unittest.TestCase):
    def test_concurrent_projects_provider_leases_checkouts_storage_and_publications(self):
        self.assertNotEqual(os.getuid(), 0)
        pg = Path(os.environ['KAIZEN_PG_BIN'])
        repo = Path(__file__).resolve().parents[2]
        actor = '22222222-2222-4222-8222-222222222222'
        with tempfile.TemporaryDirectory(prefix='kaizen-billing-pg-') as temporary:
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
                        env={**environment, 'PGAPPNAME': 'fixture-billing-barrier'}, stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    children.append(barrier)
                    barrier.stdin.write('begin; ' + barrier_sql + ';\n')
                    barrier.stdin.flush()
                    deadline = time.monotonic() + 10
                    while sql("select count(*) from pg_stat_activity where application_name='fixture-billing-barrier' and state='idle in transaction'") != '1':
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

                account_lock = f"select pg_advisory_xact_lock(hashtextextended('builder-account:{actor}',0))"
                row_lock = f"select 1 from builder_billing_accounts where user_id='{actor}' for update"
                create = f"set request.jwt.claim.sub='{actor}'; set role authenticated; select builder_create_project('Concurrent fixture');"
                results = contend('project', account_lock, [create] * 8)
                successful = [output for code, output, error in results if code == 0]
                self.assertEqual(len(successful), 1, results)
                self.assertTrue(all(code == 0 or 'website limit' in error for code, output, error in results), results)
                projects = [successful[0]]
                self.assertEqual(sql(f"select project_count from builder_billing_accounts where user_id='{actor}'"), '1')
                self.assertEqual(sql("select count(*) from builder_projects where id<>'kaizen'"), '1')

                sql(f"set role service_role; select builder_billing_bind_customer('{actor}','cus_concurrent');")
                results = contend('lease', row_lock, [f"set role service_role; select builder_billing_claim('cus_concurrent','evt_concurrent{i}','customer.subscription.updated');" for i in range(8)])
                self.assertTrue(all(code == 0 for code, output, error in results), results)
                claims = [json.loads(output) for code, output, error in results]
                self.assertEqual(sum(c['status'] == 'claimed' for c in claims), 1)
                self.assertEqual(sum(c['status'] == 'busy' for c in claims), 7)
                winner = next(index for index, item in enumerate(claims) if item['status'] == 'claimed')
                lease = claims[winner]['token']
                sql(f"set role service_role; select builder_billing_finish('{actor}','cus_concurrent','{lease}','evt_concurrent{winner}','[]','[]');")

                results = contend('checkout', account_lock, [f"set role service_role; select builder_billing_checkout_begin('{actor}','plus','price_plus');"] * 8)
                self.assertTrue(all(code == 0 for code, output, error in results), results)
                checkouts = [json.loads(output) for code, output, error in results]
                self.assertEqual(len({item['id'] for item in checkouts}), 1)
                self.assertEqual(sql("select count(*) from builder_billing_checkouts"), '1')
                sql(f"set role service_role; select builder_billing_checkout_record('{actor}','{checkouts[0]['id']}','cs_test_fixture','expired');")

                sql(f"insert into builder_subscriptions(id,user_id,status,plan_id,price_id,period_end,cancel_at_period_end) values('sub_fixture','{actor}','active','plus','price_plus',now()+interval '1 month',false);")
                projects.extend([sql(create), sql(create)])
                workspace = json.dumps({'pages': [{'id': 'fixture-page'}], 'assets': [{'id': str(uuid.uuid4()), 'size': 40 * 1024 * 1024} for _ in range(20)], 'saved': []})
                results = contend('storage', row_lock, [f"set role service_role; select builder_commit_project_workspace('{project}','{actor}',0,'{workspace}');" for project in projects])
                self.assertEqual(sum(code == 0 for code, output, error in results), 2, results)
                self.assertTrue(all(code == 0 or 'storage limit' in error for code, output, error in results), results)
                self.assertEqual(sql(f"select registered_bytes from builder_billing_accounts where user_id='{actor}'"), str(1600 * 1024 * 1024))
                self.assertEqual(sql(f"select sum(registered_bytes) from builder_project_billing where user_id='{actor}'"), str(1600 * 1024 * 1024))

                sql("update builder_subscriptions set plan_id='agency',price_id='price_agency' where id='sub_fixture';")
                projects.extend(sql(create) for _ in range(5))
                sql(f"insert into builder_billing_months(user_id,month,publications) values('{actor}',date_trunc('month',now() at time zone 'UTC')::date,999);")
                statements = []
                for project in projects:
                    destination, job = str(uuid.uuid4()), str(uuid.uuid4())
                    sql(f"insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) values('{destination}','{project}','production','https://{destination}.example.test','Fixture','fixture','baseline');")
                    statements.append(f"set role service_role; insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,snapshot,previous_artifact_id,artifact_id) values('{job}','{project}','{destination}','{{}}',1,'fixture','{actor}','publish','{{\"workspace\":{{\"pages\":[{{}}],\"assets\":[]}}}}','baseline','{job}') returning id;")
                results = contend('publish', row_lock, statements)
                self.assertEqual(sum(code == 0 for code, output, error in results), 1, results)
                self.assertTrue(all(code == 0 or 'monthly publishing limit' in error for code, output, error in results), results)
                self.assertEqual(sql(f"select publications from builder_billing_months where user_id='{actor}'"), '1000')
                self.assertEqual(sql("select count(*) from builder_publication_allowances"), '1')
                successful_job = next(output for code, output, error in results if code == 0)
                sql(f"set role service_role; update builder_client_jobs set phase='failed' where id='{successful_job}';")
                self.assertEqual(sql(f"select publications from builder_billing_months where user_id='{actor}'"), '999')
                sql(f"set role service_role; update builder_client_jobs set phase='failed' where id='{successful_job}';")
                self.assertEqual(sql(f"select publications from builder_billing_months where user_id='{actor}'"), '999')
                repository_id = str(uuid.uuid4())
                binding, commit, base = 'a' * 64, 'b' * 40, 'c' * 40
                sample = json.dumps({'bytes': 0, 'pages': 0, 'sourceBytes': 0, 'sourceRevision': 'a' * 64, 'manifestSha256': 'd' * 64})
                for project in projects:
                    staged = str(uuid.uuid4())
                    sql(f"set role service_role; select builder_repository_output_begin('{project}','{staged}','staging','fixture-staged','{commit}','{sample}');")
                    sql(f"set role service_role; select builder_repository_output_settle('{project}','{staged}','staging','fixture-staged','{commit}','{sample}','live');")
                reserve = f"set role service_role; select builder_repository_publish_begin('{projects[0]}','{actor}','{repository_id}','{binding}','{commit}','{base}',1,'fixture-staged');"
                results = contend('repository-same', row_lock, [reserve] * 8)
                self.assertTrue(all(code == 0 for code, output, error in results), results)
                self.assertTrue(all(json.loads(output) == {'attempt': 1, 'phase': 'reserved'} for code, output, error in results), results)
                self.assertEqual(sql("select count(*) from builder_repository_publications"), '1')
                self.assertEqual(sql(f"select publications from builder_billing_months where user_id='{actor}'"), '1000')
                sql(f"set role service_role; select builder_repository_publish_settle('{projects[0]}','{actor}','{repository_id}','{binding}','{commit}','{base}',1,'failed','fixture-staged');")
                statements = [f"set role service_role; select builder_repository_publish_begin('{project}','{actor}','{uuid.uuid4()}','{binding}','{commit}','{base}',1,'fixture-staged');" for project in projects]
                results = contend('repository-different', row_lock, statements)
                self.assertEqual(sum(code == 0 for code, output, error in results), 1, results)
                self.assertTrue(all(code == 0 or 'monthly publishing limit' in error for code, output, error in results), results)
                self.assertEqual(sql("select count(*) from builder_repository_publications where phase='reserved'"), '1')
                self.assertEqual(sql(f"select publications from builder_billing_months where user_id='{actor}'"), '1000')
                sql("update builder_plans set storage_bytes=2147483648 where id='agency';")
                measurement = json.dumps({'bytes': 200 * 1024 * 1024, 'revision': 'd' * 64})
                statements = [f"set role service_role; select builder_repository_usage_write('{project}','{actor}',2,'source','{measurement}','reserve');" for project in projects]
                results = contend('repository-storage', row_lock, statements)
                self.assertEqual(sum(code == 0 for code, output, error in results), 2, results)
                self.assertTrue(all(code == 0 or 'exceeds its current plan' in error for code, output, error in results), results)
                self.assertEqual(sql(f"select registered_bytes+repository_bytes from builder_billing_accounts where user_id='{actor}'"), str(2000 * 1024 * 1024))
                self.assertEqual(sql(f"select sum(repository_bytes) from builder_project_billing where user_id='{actor}'"), str(400 * 1024 * 1024))
                unchanged = sql(f"select project_id from builder_project_billing where user_id='{actor}' and repository_revision=2 order by project_id limit 1")
                measurement = json.dumps({'bytes': 10 * 1024 * 1024, 'revision': 'e' * 64})
                statement = f"set role service_role; select builder_repository_usage_write('{unchanged}','{actor}',2,'source','{measurement}','reserve');"
                results = contend('repository-version', row_lock, [statement] * 8)
                self.assertEqual(sum(code == 0 for code, output, error in results), 1, results)
                self.assertTrue(all(code == 0 or 'storage changed' in error for code, output, error in results), results)
                self.assertEqual(sql(f"select registered_bytes+repository_bytes from builder_billing_accounts where user_id='{actor}'"), str(2010 * 1024 * 1024))
                # Actual output reservations share the account cap with source and
                # managed assets, including reservations still awaiting a switch.
                candidates = sql(f"select project_id from builder_project_billing where user_id='{actor}' and repository_revision=2 order by project_id").splitlines()
                self.assertEqual(len(candidates), 5)
                output_sample = json.dumps({'bytes': 30 * 1024 * 1024, 'pages': 1, 'sourceBytes': 0,
                                            'sourceRevision': 'a' * 64, 'manifestSha256': 'f' * 64})
                attempts = [(project, str(uuid.uuid4())) for project in candidates]
                statements = [f"set role service_role; select builder_repository_output_begin('{project}','{attempt}','production','fixture-production','{commit}','{output_sample}');" for project, attempt in attempts]
                results = contend('repository-output', row_lock, statements)
                self.assertEqual(sum(code == 0 for code, output, error in results), 1, results)
                self.assertTrue(all(code == 0 or 'exceeds its current plan' in error for code, output, error in results), results)
                self.assertEqual(sql(f"select registered_bytes+repository_bytes from builder_billing_accounts where user_id='{actor}'"), str(2040 * 1024 * 1024))
                winner = next(index for index, (code, output, error) in enumerate(results) if code == 0)
                project, attempt = attempts[winner]
                refund = f"set role service_role; select builder_repository_output_settle('{project}','{attempt}','production','fixture-production','{commit}','{output_sample}','failed');"
                sql(refund)
                sql(refund)
                self.assertEqual(sql(f"select registered_bytes+repository_bytes from builder_billing_accounts where user_id='{actor}'"), str(2010 * 1024 * 1024))
                # Recovery fences the previous owner even when all operators
                # observed the same interrupted worker before acquiring the lock.
                legacy, old_owner = str(uuid.uuid4()), str(uuid.uuid4())
                sql(f"set role service_role; select builder_queue_deployment('{legacy}'); select builder_claim_release('{legacy}','{old_owner}','fixture-coordinator');")
                statements = [f"set role service_role; select builder_release_recovery_begin('{legacy}','{old_owner}','{uuid.uuid4()}','fixture-coordinator','fixture-coordinator','fixture-baseline');" for _ in range(8)]
                results = contend('recovery-owner', "select pg_advisory_xact_lock(hashtext('kaizen-builder-pages'))", statements)
                self.assertEqual(sum(code == 0 for code, output, error in results), 1, results)
                self.assertTrue(all(code == 0 or 'ownership changed' in error for code, output, error in results), results)
                self.assertEqual(sql(f"select status from builder_releases where id='{legacy}'"), 'recovery_required')

                # Execute the real cleanup migration and monitor query against a
                # synthetic scheduler boundary; actual cron execution is rollout proof.
                sql("""create schema cron;
                    create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,active boolean default true);
                    create table cron.job_run_details(runid bigint generated always as identity primary key,jobid bigint,status text,end_time timestamptz);
                    create function cron.schedule(job_name text,expression text,statement text) returns bigint language sql as $$
                      insert into cron.job(jobname,schedule,command) values(job_name,expression,statement) returning jobid $$;""")
                sql((repo / 'supabase/migrations/202609150008_builder_billing_retention.sql').read_text())
                module = ast.parse((repo / 'scripts/ops/monitor.py').read_text())
                monitor_query = next(ast.literal_eval(node.value) for node in module.body if isinstance(node, ast.Assign)
                                     and any(isinstance(target, ast.Name) and target.id == 'BILLING_COUNTS' for target in node.targets))
                self.assertEqual(json.loads(sql(monitor_query)), {'unprocessedEvents': 0, 'outputRecovery': 0, 'originalRecovery': 1, 'retentionFailures': 1})
                sql("insert into cron.job_run_details(jobid,status,end_time) select jobid,'succeeded',now() from cron.job;")
                self.assertEqual(json.loads(sql(monitor_query))['retentionFailures'], 0)
                sql("insert into cron.job_run_details(jobid,status,end_time) select jobid,'failed',now() from cron.job;")
                self.assertEqual(json.loads(sql(monitor_query))['retentionFailures'], 1)
                sql("insert into cron.job_run_details(jobid,status,end_time) select jobid,'succeeded',now()-interval '3 days' from cron.job;")
                self.assertEqual(json.loads(sql(monitor_query))['retentionFailures'], 1)
            finally:
                for process in children:
                    if process.poll() is None:
                        process.terminate()
                        process.communicate(timeout=10)
                run('pg_ctl', ['-D', str(data), '-m', 'immediate', '-w', 'stop'])


if __name__ == '__main__':
    unittest.main()
