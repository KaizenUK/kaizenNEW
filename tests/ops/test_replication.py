"""Actual independent restic repositories, using synthetic source files only."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import subprocess
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ops'))
import backup
from replicate import Replica
import replicate


class ReplicationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='kaizen-replica-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        source, state, replica_state = [self.root / name for name in ['source', 'state', 'replica-state']]
        for path in [source, state, replica_state]:
            path.mkdir(mode=0o700)
        (source / 'pending.txt').write_text('Original unpublished synthetic source')
        for name in ['password', 'replica-password']:
            (self.root / name).write_text(os.urandom(32).hex())
            (self.root / name).chmod(0o600)
        binary = os.environ.get('KAIZEN_RESTIC_BINARY', '/usr/bin/restic')
        config = {'version': 1, 'stateDirectory': str(state), 'repository': str(self.root / 'repository'),
            'passwordFile': str(self.root / 'password'), 'restic': binary,
            'sources': [{'label': 'website', 'kind': 'files', 'path': str(source)}]}
        self.backup = backup.Backups(config)
        self.backup.initialise()
        self.receipt = self.backup.capture()
        self.config = {'version': 1, 'stateDirectory': str(replica_state), 'repository': str(self.root / 'replica'),
            'passwordFile': str(self.root / 'replica-password'), 'sourcePasswordFile': str(self.root / 'password'),
            'restic': binary, 'source': {'repository': config['repository'], 'receiptFile': str(state / 'last-backup.json')}}
        self.replica = Replica(self.config)
        self.replica.initialise()

    def test_copy_is_independently_encrypted_and_restores_when_source_is_unavailable(self):
        receipt = self.replica.capture()
        self.assertEqual(receipt['sourceSnapshot'], self.receipt['snapshot'])
        self.assertNotEqual(receipt['snapshot'], self.receipt['snapshot'])
        self.backup.repo.rename(self.root / 'original-repository-unavailable')
        (self.root / 'source').rename(self.root / 'original-source-unavailable')
        (self.root / 'password').rename(self.root / 'original-password-unavailable')
        target = self.root / 'restored'
        recovery_config = {key: self.config[key] for key in
                           ['version', 'stateDirectory', 'repository', 'passwordFile', 'restic']}
        config_file = self.root / 'recovery.json'
        backup.atomic_json(config_file, recovery_config)
        # Exercise the actual recovery CLI with no original folders, repository,
        # source password or source configuration available.
        completed = subprocess.run([sys.executable, backup.__file__, str(config_file),
                                    'restore', receipt['snapshot'], str(target)], capture_output=True)
        self.assertEqual(completed.returncode, 0, completed.stderr.decode())
        result = json.loads(completed.stdout)
        restored = Path(result['root']) / 'data/website/pending.txt'
        self.assertEqual(restored.read_text(), 'Original unpublished synthetic source')
        original_password = (self.root / 'original-password-unavailable').read_text()
        (self.root / 'replica-password').write_text(original_password)
        with self.assertRaises(backup.BackupError):
            self.replica.rest('check', '--read-data')

    def test_repeat_copy_is_idempotent_and_failed_source_does_not_replace_verified_receipt(self):
        first = self.replica.capture()
        second = self.replica.capture()
        self.assertEqual(first['snapshot'], second['snapshot'])
        self.assertEqual(len(json.loads(self.replica.rest('snapshots'))), 1)
        authoritative = (self.replica.state / 'last-replica.json').read_bytes()
        (self.backup.state / 'last-backup.json').write_text('{"status":"failed","snapshot":"latest"}')
        with self.assertRaisesRegex(backup.BackupError, 'no verified snapshot'):
            self.replica.capture()
        self.assertEqual((self.replica.state / 'last-replica.json').read_bytes(), authoritative)

    def test_overlapping_storage_and_existing_repository_are_rejected(self):
        with self.assertRaisesRegex(backup.BackupError, 'already exists'):
            self.replica.initialise()
        with self.assertRaises(backup.BackupError):
            Replica({**self.config, 'repository': str(self.backup.repo / 'nested')})
        with self.replica.locked():
            with self.assertRaises(backup.Busy):
                self.replica.capture()

    def test_source_acknowledgement_must_match_both_verified_snapshot_identities(self):
        self.replica.alias = 'synthetic-source'
        self.replica.report_to_source = True
        actual_run = subprocess.run
        accepted = [False]
        def transport(args, **kwargs):
            if args[0] != '/usr/bin/ssh':
                return actual_run(args, **kwargs)
            self.assertIn('-oStrictHostKeyChecking=yes', args)
            value = json.loads(kwargs['input'])
            result = {'stored': True, 'snapshot': value['snapshot'] if accepted[0] else '0' * 64,
                      'sourceSnapshot': value['sourceSnapshot']}
            return subprocess.CompletedProcess(args, 0, json.dumps(result).encode(), b'')
        with patch.object(self.replica, 'source_receipt', return_value=self.receipt), \
             patch.object(replicate.subprocess, 'run', transport):
            with self.assertRaisesRegex(backup.BackupError, 'acknowledgement failed'):
                self.replica.capture()
            retained = json.loads((self.replica.state / 'last-replica.json').read_text())
            self.assertEqual(retained['status'], 'verified')
            accepted[0] = True
            completed = self.replica.capture()
            self.assertEqual(completed['snapshot'], retained['snapshot'])


if __name__ == '__main__':
    unittest.main()
