"""Prove reference/removal ordering with real blocked PostgreSQL transactions.

Uses a disposable Unix-socket-only cluster and synthetic rows. No provider,
website, release, production database or user account is contacted.
"""
import os
import json
from pathlib import Path
import shlex
import subprocess
import tempfile
import time
import unittest
import uuid


@unittest.skipUnless(os.environ.get('KAIZEN_PG_BIN'), 'Set KAIZEN_PG_BIN for native asset reference concurrency.')
class AssetReferenceConcurrencyTests(unittest.TestCase):
    def test_saved_references_and_removal_exclude_each_other_in_both_orders(self):
        self.assertNotEqual(os.getuid(), 0)
        pg = Path(os.environ['KAIZEN_PG_BIN'])
        repo = Path(__file__).resolve().parents[2]
        actor = '22222222-2222-4222-8222-222222222222'
        with tempfile.TemporaryDirectory(prefix='kaizen-assets-pg-') as temporary:
            root = Path(temporary)
            data, socket = root / 'data', root / 'socket'
            socket.mkdir(mode=0o700)
            environment = {'PATH': '/usr/bin:/bin', 'PGHOST': str(socket), 'PGUSER': 'fixture_admin',
                           'PGDATABASE': 'postgres', 'PGCONNECT_TIMEOUT': '3'}
            children = []

            def run(name, args, input=None):
                return subprocess.run([str(pg / name), *args], input=input, env=environment,
                                      check=True, text=True, capture_output=True, timeout=30).stdout.strip()

            def sql(statement):
                return run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], statement)

            def ordered(holder_statement, following_statement):
                holder = subprocess.Popen([str(pg / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                    env={**environment, 'PGAPPNAME': 'fixture-reference-holder'}, stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                children.append(holder)
                # psql submits BEGIN separately. An idle-in-transaction state
                # between BEGIN and the tested statement does not prove that
                # statement has acquired its lock. Wait for a following marker.
                holder.stdin.write('begin;\n' + holder_statement + ";\nselect 'kaizen-fixture-holder-ready';\n")
                holder.stdin.flush()
                deadline = time.monotonic() + 10
                while sql("select count(*) from pg_stat_activity where application_name='fixture-reference-holder' and state='idle in transaction' and query like '%kaizen-fixture-holder-ready%'") != '1':
                    if holder.poll() is not None:
                        _, error = holder.communicate(timeout=10)
                        self.fail('Holder failed before acquiring its tested lock: ' + error)
                    self.assertLess(time.monotonic(), deadline)
                    time.sleep(0.02)
                follower = subprocess.Popen([str(pg / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', following_statement],
                    env={**environment, 'PGAPPNAME': 'fixture-reference-follower'}, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                children.append(follower)
                deadline = time.monotonic() + 10
                while sql("select count(*) from pg_stat_activity where application_name='fixture-reference-follower' and wait_event_type='Lock'") != '1':
                    if follower.poll() is not None:
                        output, error = follower.communicate(timeout=10)
                        self.fail('Follower exited before the observed lock wait: ' + output + error)
                    self.assertLess(time.monotonic(), deadline)
                    time.sleep(0.02)
                _, error = holder.communicate('commit;\n', timeout=10)
                self.assertEqual(holder.returncode, 0, error)
                output, error = follower.communicate(timeout=10)
                return follower.returncode, output, error

            run('initdb', ['--pgdata=' + str(data), '--username=fixture_admin', '--auth=trust', '--encoding=UTF8', '--no-locale'])
            options = '-k ' + shlex.quote(str(socket)) + " -c listen_addresses='' -c unix_socket_permissions=0700 -c shared_buffers=16MB -c max_connections=10 -c jit=off"
            run('pg_ctl', ['-D', str(data), '-l', str(root / 'server.log'), '-o', options, '-w', 'start'])
            try:
                sql("""create role anon; create role authenticated; create role service_role bypassrls;
                    create schema auth;
                    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz);
                    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
                    create schema storage;
                    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
                    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid references auth.users(id),metadata jsonb default '{}',version text);
                    alter table storage.objects enable row level security;
                    grant usage on schema public,auth,storage to anon,authenticated,service_role;
                    create table public.contact_form_submissions(name text,last_name text,email text,phone text,website text,message text,marketing_consent boolean,consent_to_gdpr boolean,source_page text,user_agent text);
                    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
                    alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;""")
                skipped = {'202609120003_builder_error_retention.sql', '202609140002_builder_function_limit_retention.sql', '202609140005_builder_privacy_retention.sql', '202609150008_builder_billing_retention.sql'}
                for migration in sorted((repo / 'supabase/migrations').glob('*.sql')):
                    if migration.name in skipped or not ('_builder_' in migration.name or '_visual_builder.' in migration.name):
                        continue
                    sql(migration.read_text())
                sql(f"insert into auth.users(id,email,email_confirmed_at) values('{actor}','references@example.test',now());"
                    f"insert into builder_legal_acceptances(user_id,version) values('{actor}','2026-09-14');"
                    "update builder_plans set projects=10 where id='free';")
                create = f"set request.jwt.claim.sub='{actor}'; set role authenticated; select builder_create_project('Reference fixture');"
                project = sql(create)
                asset = str(uuid.uuid4())
                address = f'/builder-project-media/{project}/{asset}'
                sql(f"insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,status) "
                    f"values('{project}','{asset}',10,repeat('a',64),'image/png','image','builder-project-files','{project}/{asset}','{address}','legacy');")
                removing = f"update builder_asset_files set status='removing' where project_id='{project}' and asset_id='{asset}'"
                save = f"set role service_role; update builder_projects set settings=jsonb_build_object('image','{address}') where id='{project}'"

                # The removal statement starts before the save commits. Its
                # trigger must use the freshly committed reference after waiting.
                code, _, error = ordered(save, removing)
                self.assertNotEqual(code, 0)
                self.assertIn('still used', error)
                self.assertEqual(sql(f"select status from builder_asset_files where project_id='{project}'"), 'legacy')
                self.assertEqual(sql(f"select reference_count from builder_asset_references('{project}','{asset}')"), '1')
                sql(f"update builder_projects set settings='{{}}' where id='{project}'")

                # A new preview must read the removal state after its row-share
                # wait, even though its statement snapshot began beforehand.
                preview = str(uuid.uuid4())
                write_preview = f"set role service_role; insert into builder_project_previews(project_id,id,payload,expires_at) values('{project}','{preview}',jsonb_build_object('image','{address}'),now()+interval '1 hour')"
                code, _, error = ordered(removing, write_preview)
                self.assertNotEqual(code, 0)
                self.assertIn('being removed', error)
                self.assertEqual(sql(f"select count(*) from builder_project_previews where id='{preview}'"), '0')

                # A project deletion begun during a reservation must re-read the
                # committed ledger before any cascades can erase it.
                other = sql(create)
                upload, other_asset = str(uuid.uuid4()), str(uuid.uuid4())
                reserve = f"set role service_role; select builder_upload_reserve('{other}','{actor}','{upload}','{other_asset}',10,repeat('b',64),'image/png','image','reference-worker')"
                code, _, error = ordered(reserve, f"set role service_role; delete from builder_projects where id='{other}'")
                self.assertNotEqual(code, 0)
                self.assertIn('verified website file cleanup', error)
                self.assertEqual(sql(f"select count(*) from builder_uploads where id='{upload}'"), '1')
                self.assertEqual(sql(f"select count(*) from builder_projects where id='{other}'"), '1')
                # Native filesystem scans run outside SQL. Observe real lock
                # waits in both directions, including a complete operation
                # between the scan and its later removal claim.
                native = sql(create)
                native_asset, native_job, native_token = (str(uuid.uuid4()) for _ in range(3))
                fingerprint = '7' * 64
                producers = json.dumps([{'workerId': 'native-helper', 'projectIds': ['kaizen', native]}])
                sql(f"insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,status) "
                    f"values('{native}','{native_asset}',10,repeat('a',64),'image/png','image','builder-project-files','{native}/{native_asset}','/native-file','legacy');")
                configure = f"set role service_role; select builder_native_asset_configure('native-cleanup','{fingerprint}',array['kaizen','{native}'],'{producers}',true)"
                code, _, error = ordered(configure, "set role service_role; select builder_asset_cleanup_queue('ordinary-upload',20)")
                self.assertEqual(code, 0, error)
                self.assertEqual(sql(f"select count(*) from builder_asset_cleanup where project_id='{native}'"), '0')
                sql(f"set role service_role; select builder_native_asset_cleanup_queue('native-cleanup','{fingerprint}',20)")
                native_job = sql(f"select id from builder_asset_cleanup where project_id='{native}' and asset_id='{native_asset}'")
                sql(f"update builder_asset_cleanup set eligible_at=now()-interval '1 day' where id='{native_job}'")

                def operation(action, request, instance):
                    return f"select builder_native_operation_{action}('{request}','native-helper','{fingerprint}','{native}',123,'fixture-host','{instance}'" + (f",'{actor}')" if action == 'begin' else ')')

                def clearance(epoch):
                    return f"select builder_native_cleanup_clearance('{native_job}','native-cleanup','{native_token}','{fingerprint}',{epoch},repeat('9',64))"

                epoch = sql(f"select builder_native_cleanup_observe('native-cleanup','{fingerprint}')->>'epoch'")
                request, instance = str(uuid.uuid4()), str(uuid.uuid4())
                code, _, error = ordered('set role service_role; ' + operation('begin', request, instance), 'set role service_role; ' + clearance(epoch))
                self.assertNotEqual(code, 0)
                self.assertIn('Finish or reconcile', error)
                sql('set role service_role; ' + operation('end', request, instance))
                epoch = sql(f"select builder_native_cleanup_observe('native-cleanup','{fingerprint}')->>'epoch'")
                sql('set role service_role; ' + clearance(epoch))
                claim = f"set role service_role; select builder_asset_cleanup_claim('{native_job}','native-cleanup','{native_token}',null)"
                request, instance = str(uuid.uuid4()), str(uuid.uuid4())
                code, _, error = ordered('set role service_role; ' + operation('begin', request, instance) + '; ' + operation('end', request, instance), claim)
                self.assertNotEqual(code, 0)
                self.assertIn('Verify repository', error)
                self.assertEqual(sql(f"select status from builder_asset_files where project_id='{native}'"), 'legacy')

                epoch = sql(f"select builder_native_cleanup_observe('native-cleanup','{fingerprint}')->>'epoch'")
                sql('set role service_role; ' + clearance(epoch))
                request, instance = str(uuid.uuid4()), str(uuid.uuid4())
                code, output, error = ordered(claim, 'set role service_role; ' + operation('begin', request, instance))
                self.assertEqual(code, 0, error)
                self.assertEqual(json.loads(output)['phase'], 'active')
                retired = json.loads(sql(f"set role service_role; select builder_native_operation_assets('{request}','native-helper','{fingerprint}','')"))
                self.assertEqual(retired['assets'], [{'assetId': native_asset, 'projectId': native, 'url': '/native-file'}])
                sql('set role service_role; ' + operation('end', request, instance))

                # A retained filesystem reference clears any earlier removal
                # clearance. Observe the actual native lock wait in both orders;
                # neither a stale scan nor a late observation can undo a claim.
                grace_asset, grace_token = str(uuid.uuid4()), str(uuid.uuid4())
                sql(f"insert into builder_asset_files(project_id,asset_id,bytes,sha256,mime,asset_kind,bucket_id,object_name,file_url,status) "
                    f"values('{native}','{grace_asset}',10,repeat('a',64),'image/png','image','builder-project-files','{native}/{grace_asset}','/retained-file','legacy');")
                sql(f"set role service_role; select builder_native_asset_cleanup_queue('native-cleanup','{fingerprint}',20)")
                grace_job = sql(f"select id from builder_asset_cleanup where project_id='{native}' and asset_id='{grace_asset}'")
                due = f"update builder_asset_cleanup set eligible_at=now()-interval '1 day' where id='{grace_job}'"
                grace_claim = f"set role service_role; select builder_asset_cleanup_claim('{grace_job}','native-cleanup','{grace_token}',null)"

                def grace_clearance(epoch):
                    return f"set role service_role; select builder_native_cleanup_clearance('{grace_job}','native-cleanup','{grace_token}','{fingerprint}',{epoch},repeat('8',64))"

                def referenced(epoch):
                    return f"set role service_role; select builder_native_cleanup_referenced('{grace_job}','native-cleanup','{fingerprint}',{epoch},repeat('8',64))"

                sql(due)
                epoch = sql(f"select builder_native_cleanup_observe('native-cleanup','{fingerprint}')->>'epoch'")
                sql(grace_clearance(epoch))
                code, _, error = ordered(referenced(epoch), grace_claim)
                self.assertNotEqual(code, 0)
                self.assertIn('Repeat the native reference check', error)
                self.assertEqual(sql(f"select phase='pending' and owner_token is null and native_clearance is null "
                    f"and eligible_at>now()+interval '6 days' from builder_asset_cleanup where id='{grace_job}'"), 't')

                sql(due)
                request, instance = str(uuid.uuid4()), str(uuid.uuid4())
                code, _, error = ordered('set role service_role; ' + operation('begin', request, instance) + '; ' + operation('end', request, instance), referenced(epoch))
                self.assertNotEqual(code, 0)
                self.assertIn('Repeat the complete reference check', error)
                self.assertEqual(sql(f"select eligible_at<now() from builder_asset_cleanup where id='{grace_job}'"), 't')

                epoch = sql(f"select builder_native_cleanup_observe('native-cleanup','{fingerprint}')->>'epoch'")
                request, instance = str(uuid.uuid4()), str(uuid.uuid4())
                code, output, error = ordered(referenced(epoch), 'set role service_role; ' + operation('begin', request, instance))
                self.assertEqual(code, 0, error)
                self.assertEqual(json.loads(output)['phase'], 'active')
                self.assertEqual(sql(f"select eligible_at>now()+interval '6 days' from builder_asset_cleanup where id='{grace_job}'"), 't')
                sql('set role service_role; ' + operation('end', request, instance))

                sql(due)
                epoch = sql(f"select builder_native_cleanup_observe('native-cleanup','{fingerprint}')->>'epoch'")
                sql(grace_clearance(epoch))
                code, _, error = ordered(grace_claim, referenced(epoch))
                self.assertNotEqual(code, 0)
                self.assertIn('Check the pending native file cleanup', error)
                self.assertEqual(sql(f"select phase='removing' and owner_token='{grace_token}' "
                    f"and eligible_at<now() from builder_asset_cleanup where id='{grace_job}'"), 't')

                request, instance = str(uuid.uuid4()), str(uuid.uuid4())
                code, output, error = ordered('set role service_role; ' + operation('end', request, instance), 'set role service_role; ' + operation('begin', request, instance))
                self.assertEqual(code, 0, error)
                self.assertEqual(json.loads(output)['phase'], 'complete')
                self.assertEqual(sql("select count(*) from builder_native_asset_operations where phase='active'"), '0')
                # Cancellation, completion and retry serialize through the real
                # project/request locks. The tombstone survives destination purge.
                def copy_begin(request):
                    return f"set role service_role; select builder_project_copy_begin('{project}','{actor}','{request}','Copy concurrency','{{\"pages\":[],\"assets\":[],\"saved\":[]}}')"

                def copy_cancel(request):
                    version = sql(f"select version from builder_projects where id='{request}'")
                    return f"set role service_role; select builder_project_copy_cancel('{request}','{actor}',{version})"

                cancelled_copy, finished_copy = str(uuid.uuid4()), str(uuid.uuid4())
                sql(copy_begin(cancelled_copy))
                code, _, error = ordered(copy_cancel(cancelled_copy), f"set role service_role; select builder_project_copy_finish('{cancelled_copy}','{actor}')")
                self.assertNotEqual(code, 0)
                self.assertIn('copy was cancelled', error)
                self.assertEqual(sql(f"select status from builder_project_copies where project_id='{cancelled_copy}'"), 'cancelling')

                sql(copy_begin(finished_copy))
                code, _, error = ordered(f"set role service_role; select builder_project_copy_finish('{finished_copy}','{actor}')", copy_cancel(finished_copy))
                self.assertNotEqual(code, 0)
                self.assertIn('Only an unfinished copy', error)
                self.assertEqual(sql(f"select status from builder_project_copies where project_id='{finished_copy}'"), 'complete')

                code, _, error = ordered(f"set role service_role; select builder_project_copy_purge('{cancelled_copy}','ordinary-upload')", copy_begin(cancelled_copy))
                self.assertNotEqual(code, 0)
                self.assertIn('copy was cancelled', error)
                self.assertEqual(sql(f"select count(*) from builder_projects where id='{cancelled_copy}'"), '0')
                self.assertEqual(sql(f"select phase from builder_project_copy_cancellations where project_id='{cancelled_copy}'"), 'complete')

                partial_copy, partial_upload, partial_asset = (str(uuid.uuid4()) for _ in range(3))
                sql(copy_begin(partial_copy))
                reserve = f"set role service_role; select builder_upload_reserve('{partial_copy}','{actor}','{partial_upload}','{partial_asset}',10,repeat('b',64),'image/png','image','ordinary-upload')"
                code, _, error = ordered(reserve, copy_cancel(partial_copy))
                self.assertEqual(code, 0, error)
                self.assertEqual(sql(f"select cancel_requested from builder_uploads where id='{partial_upload}'"), 't')
                self.assertEqual(sql(f"select registered_bytes from builder_project_billing where project_id='{partial_copy}'"), '10')
                self.assertEqual(sql(f"select builder_project_copy_purge('{partial_copy}','ordinary-upload')"), 'f')
                # Retirement must see references committed after its statement
                # began, and a queue writer must see a claim committed while it
                # waited. Exercise the real publication RPCs, not just the helper.
                release_project = sql(create)
                destination, old_job = str(uuid.uuid4()), str(uuid.uuid4())
                sql(f"insert into builder_client_destinations(id,project_id,environment,origin,label,worker_id,active_artifact_id) "
                    f"values('{destination}','{release_project}','production','https://{destination}.example','Retirement fixture','retention-worker','initial');"
                    f"insert into builder_client_jobs(id,project_id,destination_id,destination,destination_version,worker_id,requested_by,action,previous_artifact_id,artifact_id,phase) "
                    f"select '{old_job}','{release_project}',d.id,builder_client_destination_public(d),d.version,d.worker_id,'{actor}','unpublish','initial','client-old','live' "
                    f"from builder_client_destinations d where id='{destination}';")

                def observe_release(target, scope, artifact):
                    return f"set role service_role; select builder_release_retention_observe('{target}','{scope}','{artifact}','retention-worker',repeat('a',64),repeat('b',64),100)"

                def mature_release(target, scope, artifact):
                    sql(f"update builder_release_retirements set eligible_at=clock_timestamp()-interval '1 day' where project_id='{target}' and scope='{scope}' and artifact_id='{artifact}'")

                def claim_release(target, scope, artifact, token):
                    return f"set role service_role; select builder_release_retention_claim('{target}','{scope}','{artifact}','retention-worker',repeat('a',64),repeat('b',64),'{token}')"

                client_scope, review_id, retire_token = 'client:' + destination, str(uuid.uuid4()), str(uuid.uuid4())
                review = f"set request.jwt.claim.role='service_role'; set role service_role; select builder_client_review('{review_id}','{release_project}','{actor}','{destination}',0,1,'rollback',null,'{old_job}')"
                sql(observe_release(release_project, client_scope, 'client-old'))
                mature_release(release_project, client_scope, 'client-old')
                retire = claim_release(release_project, client_scope, 'client-old', retire_token)
                code, output, error = ordered(review, retire)
                self.assertEqual(code, 0, error)
                self.assertEqual(json.loads(output)['phase'], 'pending')
                self.assertEqual(sql(f"select eligible_at>clock_timestamp()+interval '6 days' from builder_release_retirements where project_id='{release_project}' and artifact_id='client-old'"), 't')
                sql(f"delete from builder_client_reviews where id='{review_id}'")
                mature_release(release_project, client_scope, 'client-old')
                code, _, error = ordered(retire, review)
                self.assertNotEqual(code, 0)
                self.assertIn('no longer retained', error)
                self.assertEqual(sql(f"select count(*) from builder_client_reviews where id='{review_id}'"), '0')

                old_native, current_native, rollback = (str(uuid.uuid4()) for _ in range(3))
                sql(f"insert into builder_editors(user_id) values('{actor}') on conflict do nothing;"
                    f"insert into builder_project_members(project_id,user_id,role,can_publish) values('kaizen','{actor}','owner',true) on conflict do nothing;"
                    f"insert into builder_releases(id,request,snapshot,baseline,artifact_id,status) values "
                    f"('{old_native}','{{}}',builder_live_snapshot(),builder_live_snapshot(),'native-old','live'),"
                    f"('{current_native}','{{}}',builder_live_snapshot(),builder_live_snapshot(),'native-current','live');"
                    f"update builder_release_head set release_id='{current_native}' where id='site';")
                sql(observe_release('kaizen', 'repository:production', 'native-old'))
                mature_release('kaizen', 'repository:production', 'native-old')
                retire = claim_release('kaizen', 'repository:production', 'native-old', str(uuid.uuid4()))
                queue = f"set request.jwt.claim.role='service_role'; set role service_role; select builder_queue_rollback('{rollback}','{actor}','{old_native}')"
                code, output, error = ordered(queue, retire)
                self.assertEqual(code, 0, error)
                self.assertEqual(json.loads(output)['phase'], 'pending')
                sql(f"set role service_role; select builder_fail_queued_release('{rollback}','Fixture cancelled before claim')")
                mature_release('kaizen', 'repository:production', 'native-old')
                rollback = str(uuid.uuid4())
                queue = f"set request.jwt.claim.role='service_role'; set role service_role; select builder_queue_rollback('{rollback}','{actor}','{old_native}')"
                code, _, error = ordered(retire, queue)
                self.assertNotEqual(code, 0)
                self.assertIn('no longer retained', error)
                self.assertEqual(sql(f"select count(*) from builder_releases where id='{rollback}'"), '0')

                # Output reservation holds a project/billing lock before the
                # retirement lock. Claiming must not take them in reverse order.
                output_id = str(uuid.uuid4())
                sample = json.dumps({'bytes': 100, 'pages': 1, 'sourceBytes': 100,
                                     'sourceRevision': 'c' * 64, 'manifestSha256': 'b' * 64})
                output_begin = f"set role service_role; select builder_repository_output_begin('{release_project}','{output_id}','staging','output-old',repeat('d',40),'{sample}',true)"
                sql(observe_release(release_project, 'repository:staging', 'output-old'))
                mature_release(release_project, 'repository:staging', 'output-old')
                retire = claim_release(release_project, 'repository:staging', 'output-old', str(uuid.uuid4()))
                code, output, error = ordered(output_begin, retire)
                self.assertEqual(code, 0, error)
                self.assertEqual(json.loads(output)['phase'], 'pending')
                sql(f"set role service_role; select builder_repository_output_settle('{release_project}','{output_id}','staging','output-old',repeat('d',40),'{sample}','failed')")
                mature_release(release_project, 'repository:staging', 'output-old')
                output_id = str(uuid.uuid4())
                output_begin = f"set role service_role; select builder_repository_output_begin('{release_project}','{output_id}','staging','output-old',repeat('d',40),'{sample}',true)"
                code, _, error = ordered(retire, output_begin)
                self.assertNotEqual(code, 0)
                self.assertIn('no longer retained', error)
                self.assertEqual(sql(f"select count(*) from builder_repository_output_jobs where id='{output_id}'"), '0')

                # Separate domain evidence can retain an artifact even when the
                # primary destination has moved. It shares the same queue fence.
                domain = str(uuid.uuid4())
                domain_reference = f"insert into builder_domains(id,project_id,hostname,verification_token,worker_id,binding_kind,candidate_destination_id,destination_id,last_evidence) " + \
                    f"values('{domain}','{release_project}','retention.example',repeat('a',64),'domain-worker','client-alias','{destination}','{destination}','{{\"artifactId\":\"domain-old\"}}')"
                sql(observe_release(release_project, client_scope, 'domain-old'))
                mature_release(release_project, client_scope, 'domain-old')
                retire = claim_release(release_project, client_scope, 'domain-old', str(uuid.uuid4()))
                code, output, error = ordered(domain_reference, retire)
                self.assertEqual(code, 0, error)
                self.assertEqual(json.loads(output)['phase'], 'pending')
                sql(f"update builder_domains set status='removed',removed_at=clock_timestamp() where id='{domain}'")
                mature_release(release_project, client_scope, 'domain-old')
                code, _, error = ordered(retire, f"update builder_domains set status='waiting_dns',removed_at=null where id='{domain}'")
                self.assertNotEqual(code, 0)
                self.assertIn('no longer retained', error)
                self.assertEqual(sql(f"select status from builder_domains where id='{domain}'"), 'removed')
                # Cancellation and delayed claims share the same lock. Either
                # cancellation invalidates the old generation, or the owner
                # gets its existing claim back and must complete that removal.
                for claim_first in (False, True):
                    artifact = 'cancel-claim-first' if claim_first else 'cancel-first'
                    token = str(uuid.uuid4())
                    sql(observe_release(release_project, client_scope, artifact))
                    mature_release(release_project, client_scope, artifact)
                    claim = claim_release(release_project, client_scope, artifact, token)
                    cancel = f"set role service_role; select builder_release_retention_cancel('{release_project}','{client_scope}','{artifact}','retention-worker',repeat('a',64),repeat('b',64),'{token}',0)"
                    if claim_first:
                        code, output, error = ordered(claim, cancel)
                        self.assertEqual(code, 0, error)
                        self.assertEqual(json.loads(output)['phase'], 'removing')
                        self.assertEqual(json.loads(output)['owner_token'], token)
                    else:
                        code, _, error = ordered(cancel, claim)
                        self.assertNotEqual(code, 0)
                        self.assertIn('attempt was cancelled', error)
                        receipt = json.loads(sql(cancel))
                        self.assertEqual(receipt['phase'], 'cancelled')
                        self.assertEqual(receipt['cancelled_token'], token)
                        self.assertEqual(receipt['attempt_generation'], 1)
                # A long-lived older snapshot must not bypass the fresh reads
                # following the advisory lock, including when no row existed
                # at the time that snapshot was established.
                for isolation in ('repeatable read', 'serializable'):
                    with self.assertRaises(subprocess.CalledProcessError) as refused:
                        sql(f"begin isolation level {isolation}; select 1; select builder_release_retention_lock()")
                    self.assertIn('fresh database snapshot', refused.exception.stderr)
                print('All twenty-six native contention groups passed: twelve reference/native-operation orders, four copy orders, eight release-retirement orders and two retirement cancellation orders.')
            finally:
                for process in children:
                    if process.poll() is None:
                        process.terminate()
                        process.communicate(timeout=10)
                run('pg_ctl', ['-D', str(data), '-m', 'immediate', '-w', 'stop'])


if __name__ == '__main__':
    unittest.main()
