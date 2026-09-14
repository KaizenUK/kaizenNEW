"""Synthetic provider responses and native command boundaries; no live accounts."""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ops'))
import supabase_backup as sb


class Response(io.BytesIO):
    status = 200
    headers = {}


class SupabaseBackupTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='kaizen-supabase-backup-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        for name, value in [('token', 'fixture-never-issued-management'), ('worker.env',
                            'BUILDER_RELEASE_SERVICE_ROLE_KEY="fixture-never-issued-service"\n'), ('ca', 'fixture-ca')]:
            path = self.root / name
            path.write_text(value)
            path.chmod(0o600)
        self.config = {'projectRef': 'a' * 20, 'managementTokenFile': str(self.root / 'token'),
            'workerEnvironmentFile': str(self.root / 'worker.env'), 'postgresBin': str(self.root),
            'certificateFile': str(self.root / 'ca'), 'maxStorageBytes': 64}
        self.backup = sb.SupabaseBackup(self.config)
        self.body = b'Fixture Storage contents'
        self.entry = {'id': 'fixture-id', 'bucket_id': 'private', 'name': '../../folder/image?x#y.png',
                      'metadata': {'size': len(self.body), 'eTag': hashlib.md5(self.body).hexdigest()}}
        self.catalog = {'version': '170006', 'readOnly': 'on', 'bypassRls': True, 'schemas': ['public']}

    def test_download_uses_encoded_remote_path_and_private_hashed_local_name(self):
        requests = []
        def get(req):
            requests.append(req)
            return Response(self.body)
        target = self.root / 'hashed-name'
        with patch.object(sb, 'request', get):
            record = self.backup.download(self.entry, target, 64)
        self.assertEqual(target.read_bytes(), self.body)
        self.assertEqual(record['sha256'], hashlib.sha256(self.body).hexdigest())
        self.assertEqual(target.stat().st_mode & 0o777, 0o600)
        self.assertEqual(requests[0].full_url, 'https://' + 'a' * 20 +
                         '.supabase.co/storage/v1/object/private/%2E%2E/%2E%2E/folder/image%3Fx%23y.png')
        self.assertEqual(requests[0].get_header('Authorization'), 'Bearer fixture-never-issued-service')

    def test_wrong_size_hash_limits_and_existing_files_fail(self):
        wrong_size = copy.deepcopy(self.entry)
        wrong_size['metadata']['size'] += 1
        wrong_hash = copy.deepcopy(self.entry)
        wrong_hash['metadata']['eTag'] = 'a' * 32
        with patch.object(sb, 'request', lambda _: Response(self.body)):
            for index, (entry, limit) in enumerate([(wrong_size, 64), (wrong_hash, 64), (self.entry, 3)]):
                with self.assertRaises(sb.BackupError):
                    self.backup.download(entry, self.root / str(index), limit)
            original = self.root / 'existing'
            original.write_text('Existing fixture data')
            with self.assertRaises(FileExistsError):
                self.backup.download(self.entry, original, 64)
            self.assertEqual(original.read_text(), 'Existing fixture data')

    def test_compressed_or_partial_responses_do_not_count_as_original_objects(self):
        for index, (status, headers) in enumerate([(206, {}), (200, {'Content-Encoding': 'gzip'}), (200, {'ETag': 'changed-version'})]):
            response = Response(self.body)
            response.status, response.headers = status, headers
            with patch.object(sb, 'request', lambda _: response), self.assertRaises(sb.BackupError):
                self.backup.download(self.entry, self.root / str(index), 64)

    def test_redirect_is_not_followed_and_metadata_is_bounded(self):
        self.assertIsNone(sb.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://unrelated.invalid'))
        with self.assertRaisesRegex(sb.BackupError, 'metadata exceeds'):
            sb.read_json(Response(b'012345'), maximum=5)

    def test_login_readiness_reuses_one_password_with_full_tls_and_read_only_assertions(self):
        calls = []
        def management(path, body=None):
            calls.append((path, body))
            if path == '/config/database/pooler':
                return [{'db_host': 'aws-1-eu-west-2.pooler.supabase.com', 'db_name': 'postgres', 'db_port': 6543}]
            return {'role': 'cli_login_supabase_read_only_user', 'password': 'fixture-one-password', 'ttl_seconds': 300}
        observed = []
        def query(binary, env, sql):
            observed.append(env.copy())
            if len(observed) == 1:
                raise sb.BackupError('Database backup authentication is not ready.')
            return self.catalog
        with patch.object(self.backup, 'management', management), patch.object(sb, 'sql_json', query), patch.object(sb.time, 'sleep'):
            env, _ = self.backup.connection()
        self.assertEqual(sum(path == '/cli/login-role' for path, _ in calls), 1)
        self.assertEqual(calls[-1][1], {'read_only': True})
        self.assertEqual(observed[0], observed[1])
        self.assertEqual(env['PGSSLMODE'], 'verify-full')
        self.assertEqual(env['PGPORT'], '5432')
        self.assertNotIn('PGOPTIONS', env)

    def test_expired_login_refreshes_before_new_connection_without_changing_capture_data(self):
        original = {'PGPASSWORD': 'expired-fixture-password'}
        refreshed = {'PGPASSWORD': 'new-fixture-password'}
        self.backup.expires_at = 100
        with patch.object(sb.time, 'monotonic', return_value=99), patch.object(self.backup, 'connection') as connection:
            self.assertIs(self.backup.refresh(original), original)
            connection.assert_not_called()
        with patch.object(sb.time, 'monotonic', return_value=100), patch.object(self.backup, 'connection', return_value=(refreshed, self.catalog)) as connection:
            self.assertIs(self.backup.refresh(original), refreshed)
            connection.assert_called_once_with()

    def test_capture_refuses_changed_storage_without_a_capture_receipt(self):
        before = {'buckets': [], 'objects': []}
        after = {'buckets': [], 'objects': [self.entry]}
        with patch.object(self.backup, 'connection', return_value=({}, self.catalog)), \
             patch.object(sb, 'sql_json', side_effect=[before, after]), patch.object(sb, 'native'):
            with self.assertRaisesRegex(sb.BackupError, 'Storage changed'):
                self.backup.capture(self.root)
        self.assertFalse((self.root / 'supabase/capture.json').exists())

    def test_full_archive_and_roles_commands_keep_rls_permissions_and_decode_all_data(self):
        before = {'buckets': [{'id': 'private'}], 'objects': [self.entry]}
        with patch.object(self.backup, 'connection', return_value=({}, self.catalog)), \
             patch.object(sb, 'sql_json', return_value=before), patch.object(sb, 'native') as native, \
             patch.object(sb, 'request', lambda _: Response(self.body)), \
             patch.object(self.backup, 'management', return_value={'pitr_enabled': False}):
            self.backup.capture(self.root)
        commands = [[Path(call.args[0]).name, *call.args[1]] for call in native.call_args_list]
        dump = commands[0]
        self.assertEqual(dump[0], 'pg_dump')
        self.assertIn('--format=custom', dump)
        self.assertIn('--role=supabase_read_only_user', dump)
        self.assertFalse(any(x.startswith(('--exclude', '--schema', '--no-acl', '--enable-row-security')) for x in dump))
        self.assertIn('--no-role-passwords', commands[1])
        self.assertEqual(commands[-1][0:2], ['pg_restore', '--file=/dev/null'])
        receipt = json.loads((self.root / 'supabase/capture.json').read_text())
        self.assertEqual(receipt['objects'][0]['source']['name'], self.entry['name'])
        self.assertEqual((self.root / 'supabase/objects' / receipt['objects'][0]['file']).read_bytes(), self.body)
        self.assertNotIn('fixture-never-issued', json.dumps(receipt))

    def test_native_warnings_and_failures_never_echo_private_output(self):
        for code, message in [(1, b'private-row fixture-never-issued'), (0, b'WARNING: private-row')]:
            with patch.object(sb.subprocess, 'run', return_value=subprocess.CompletedProcess([], code, b'private-row', message)):
                with self.assertRaises(sb.BackupError) as error:
                    sb.native(self.root / 'pg_dump', [], {})
                self.assertNotIn('private-row', str(error.exception))
        self.assertEqual(sb.pg_error(b'permission denied for table fixture_table\nprivate-row'),
                         'Database backup lacks access to fixture_table.')

    def test_credential_reader_does_not_execute_expansions_and_refuses_broad_permissions(self):
        marker = self.root / 'never-created'
        worker = self.root / 'worker.env'
        worker.write_text('BUILDER_RELEASE_SERVICE_ROLE_KEY="$(touch ' + str(marker) + ')"\n')
        self.assertEqual(sb.service_key(worker), '$(touch ' + str(marker) + ')')
        self.assertFalse(marker.exists())
        worker.chmod(0o644)
        with self.assertRaises(sb.BackupError):
            sb.service_key(worker)


if __name__ == '__main__':
    unittest.main()
