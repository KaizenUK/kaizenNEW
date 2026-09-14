"""Health and alert transitions with temporary state and a fake mail queue."""
from datetime import datetime, timedelta, timezone
from email import message_from_bytes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ops'))
import monitor as ops
import receive_replica


class MonitorTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='kaizen-monitor-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.config = {'version': 1, 'stateDirectory': str(self.root),
            'email': {'to': 'operator@fixture.invalid', 'from': 'alerts@fixture.invalid'},
            'checks': [{'id': 'helper', 'kind': 'helper', 'url': 'http://127.0.0.1:1/health'}]}
        self.monitor = ops.Monitor(self.config)

    def test_two_failures_queue_one_alert_then_one_recovery_without_repeat_mail(self):
        healthy = [False]
        sent = []
        def fake_mail(args, **kwargs):
            sent.append((args, message_from_bytes(kwargs['input'])))
            return subprocess.CompletedProcess(args, 0, b'', b'')
        with patch.object(ops, 'observe', lambda _: (healthy[0], 'Synthetic health observation')), \
             patch.object(ops.subprocess, 'run', fake_mail):
            self.assertFalse(self.monitor.run()['alertQueued'])
            self.assertTrue(self.monitor.run()['alertQueued'])
            self.assertFalse(self.monitor.run()['alertQueued'])
            healthy[0] = True
            self.assertTrue(self.monitor.run()['alertQueued'])
            self.assertFalse(self.monitor.run()['alertQueued'])
        self.assertEqual(len(sent), 2)
        self.assertIn('-odq', sent[0][0])
        self.assertEqual(sent[0][1]['To'], 'operator@fixture.invalid')
        self.assertEqual(sent[0][1]['Subject'], '[Kaizen] Needs attention')
        self.assertEqual(sent[1][1]['Subject'], '[Kaizen] Service recovered')
        self.assertEqual(json.loads((self.root / 'monitor-state.json').read_text())['notified'], [])

    def test_failed_mail_queue_does_not_mark_an_incident_notified_or_expose_stderr(self):
        with patch.object(ops, 'observe', return_value=(False, 'A fixture failure')):
            self.monitor.run()
            before = (self.root / 'monitor-state.json').read_bytes()
            with patch.object(ops.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, b'', b'private fixture credential')):
                with self.assertRaises(ops.BackupError) as error:
                    self.monitor.run()
            self.assertNotIn('credential', str(error.exception))
            self.assertEqual((self.root / 'monitor-state.json').read_bytes(), before)

    def test_unknown_observation_is_unhealthy_without_private_exception_details(self):
        with patch.object(ops, 'http', side_effect=RuntimeError('private fixture account token')):
            result = self.monitor.check()
        self.assertFalse(result['healthy'])
        self.assertNotIn('private fixture account token', json.dumps(result))
        self.assertFalse((self.root / 'monitor-state.json').exists())

    def test_oneshot_success_is_healthy_but_missing_failed_and_stopped_services_are_not(self):
        for raw, oneshot, expected in [
            ('LoadState=loaded\nActiveState=inactive\nResult=success\nExecMainStatus=0', True, True),
            ('LoadState=not-found\nActiveState=inactive\nResult=success\nExecMainStatus=0', True, False),
            ('LoadState=loaded\nActiveState=failed\nResult=exit-code\nExecMainStatus=1', True, False),
            ('LoadState=loaded\nActiveState=inactive\nResult=success\nExecMainStatus=0', False, False)]:
            with patch.object(ops, 'command', return_value=raw.encode()):
                self.assertEqual(ops.unit({'unit': 'fixture.service', 'oneshot': oneshot})[0], expected)

    def test_replica_freshness_uses_source_age_and_requires_real_snapshot_identity(self):
        receipt = self.root / 'receipt.json'
        item = {'status': 'verified', 'snapshot': 'a' * 64, 'sourceSnapshot': 'b' * 64,
                'completedAt': datetime.now(timezone.utc).isoformat(),
                'sourceCompletedAt': (datetime.now(timezone.utc) - timedelta(hours=40)).isoformat()}
        ops.atomic_json(receipt, item)
        check = {'kind': 'receipt', 'path': str(receipt), 'dateField': 'sourceCompletedAt', 'maxAgeSeconds': 36 * 3600}
        self.assertFalse(ops.receipt(check)[0])
        item['sourceCompletedAt'] = item['completedAt']
        ops.atomic_json(receipt, item)
        self.assertTrue(ops.receipt(check)[0])
        item['snapshot'] = 'latest'
        ops.atomic_json(receipt, item)
        self.assertFalse(ops.receipt(check)[0])
        item['snapshot'] = 'a' * 64
        item['sourceCompletedAt'] = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        ops.atomic_json(receipt, item)
        self.assertFalse(ops.observe(check)[0])

    def test_release_observation_compares_exact_selected_marker_and_rejects_wrong_bytes(self):
        store = self.root / 'store'
        marker = store / 'releases/fixture/site/.well-known/kaizen-release.json'
        marker.parent.mkdir(parents=True)
        marker.write_text('{"releaseId":"fixture"}')
        (store / 'active.conf').write_text('# Kaizen managed release: fixture\n')
        check = {'kind': 'release', 'store': str(store), 'origin': 'http://127.0.0.1:1'}
        with patch.object(ops, 'http', return_value=marker.read_bytes()):
            self.assertTrue(ops.release(check)[0])
        with patch.object(ops, 'http', return_value=b'{"releaseId":"wrong"}'):
            self.assertFalse(ops.release(check)[0])

    def test_database_observation_is_read_only_and_only_records_aggregate_counts(self):
        token = self.root / 'token'
        token.write_text('never-issued-fixture-token')
        token.chmod(0o600)
        responses = [{'health': {'clientErrors': 1, 'failedPublications': 0, 'recoveryRequired': 0, 'stalledPublications': 0}}]
        with patch.object(ops, 'http', return_value=json.dumps(responses).encode()) as request:
            result = ops.database({'projectRef': 'a' * 20, 'managementTokenFile': str(token)})
        self.assertFalse(result[0])
        payload = json.loads(request.call_args.args[1])
        self.assertTrue(payload['read_only'])
        self.assertNotIn('user_id', payload['query'])
        self.assertNotIn('never-issued', str(result))
        self.assertEqual(request.call_args.kwargs['accepted_statuses'], (200, 201))

    def test_management_created_response_is_accepted_only_when_explicitly_expected(self):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_POST(self):
                self.send_response(201)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'[{"health":{"clientErrors":0}}]')
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = 'http://127.0.0.1:' + str(server.server_port)
        self.assertEqual(json.loads(ops.http(url, b'{}', accepted_statuses=(200, 201))),
                         [{'health': {'clientErrors': 0}}])
        with self.assertRaises(ops.BackupError):
            ops.http(url, b'{}')

    def test_replica_receiver_rejects_old_bad_or_future_receipts(self):
        stamp = datetime.now(timezone.utc) - timedelta(minutes=1)
        item = {'version': 1, 'status': 'verified', 'snapshot': 'a' * 64, 'sourceSnapshot': 'b' * 64,
                'sourceCompletedAt': (stamp - timedelta(minutes=10)).isoformat(), 'completedAt': stamp.isoformat()}
        self.assertTrue(receive_replica.receive(self.root, item)['stored'])
        before = (self.root / 'last-replica.json').read_bytes()
        for changes in [{'snapshot': 'latest'}, {'sourceCompletedAt': (stamp - timedelta(days=3)).isoformat()},
                        {'completedAt': (stamp + timedelta(days=3)).isoformat()}]:
            with self.assertRaises(ops.BackupError):
                receive_replica.receive(self.root, {**item, **changes})
            self.assertEqual((self.root / 'last-replica.json').read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
