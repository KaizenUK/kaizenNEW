"""Real encrypted snapshots and restores, using only temporary source data."""
import importlib.util
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('kaizen_backup', Path(__file__).resolve().parents[2] / 'scripts/ops/backup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='kaizen-backup-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.state, self.helper, self.release, self.configs = [self.root / x for x in ['state', 'helper', 'release', 'configs']]
        for path in [self.state, self.helper, self.release, self.configs]:
            path.mkdir(mode=0o700)
        (self.helper / 'locks').mkdir(mode=0o700)
        self.project = self.helper / 'projects/fixture'
        self.project.mkdir(parents=True)
        self.checkout = self.project / 'checkout'
        self.checkout.mkdir()
        (self.checkout / 'index.html').write_text('Unpublished fixture source')
        (self.project / 'draft.json').write_text('{"text":"Private unsaved fixture draft"}')
        (self.checkout / 'node_modules').mkdir()
        (self.checkout / 'node_modules/cache').write_text('Disposable dependency')
        (self.checkout / '.git').mkdir()
        (self.checkout / '.git/HEAD').write_text('ref: refs/heads/fixture')
        (self.checkout / 'run.sh').write_text('#!/bin/sh\nexit 0\n')
        (self.checkout / 'run.sh').chmod(0o750)
        (self.checkout / 'relative-link').symlink_to('index.html')
        (self.checkout / 'external-link').symlink_to('/outside-fixture/missing')
        (self.release / 'releases/fixture/site').mkdir(parents=True)
        (self.release / 'releases/fixture/site/index.html').write_text('Verified fixture release')
        (self.release / 'active.conf').write_text('Fixture selected release')
        self.projects_file = self.configs / 'projects.json'
        self.projects_file.write_text(json.dumps({'version': 1, 'projects': [{'projectId': 'fixture'}, {'projectId': 'not-cloned'}]}))
        self.secret = 'Private-never-issued-fixture-credential-' + os.urandom(12).hex()
        (self.configs / 'private.env').write_text('FIXTURE=' + self.secret)
        (self.configs / 'private.env').chmod(0o600)
        self.password = self.root / 'password'
        self.password.write_text(os.urandom(32).hex())
        self.password.chmod(0o600)
        self.config = {'version': 1, 'stateDirectory': str(self.state), 'repository': str(self.root / 'encrypted'),
                       'passwordFile': str(self.password), 'restic': os.environ.get('KAIZEN_RESTIC_BINARY', '/usr/bin/restic'),
                       'sources': [{'label': 'website', 'path': str(self.helper), 'kind': 'helper', 'projectsFile': str(self.projects_file)},
                                   {'label': 'production', 'path': str(self.release), 'kind': 'release'},
                                   {'label': 'settings', 'path': str(self.configs), 'kind': 'files'}]}
        self.backups = backup.Backups(self.config)

    def test_real_encrypted_backup_restores_source_drafts_git_releases_keys_and_permissions(self):
        self.backups.initialise()
        receipt = self.backups.capture()
        self.assertEqual(receipt['status'], 'verified')
        restored = self.backups.restore(receipt['snapshot'], self.root / 'restored')
        data = Path(restored['root']) / 'data'
        self.assertEqual((data / 'website/projects/fixture/checkout/index.html').read_text(), 'Unpublished fixture source')
        self.assertEqual((data / 'website/projects/fixture/draft.json').read_text(), (self.project / 'draft.json').read_text())
        self.assertEqual((data / 'settings/private.env').read_text(), 'FIXTURE=' + self.secret)
        self.assertTrue((data / 'website/projects/fixture/checkout/.git/HEAD').exists())
        self.assertEqual((data / 'production/release-missing').exists(), False)
        self.assertEqual((data / 'production/releases/fixture/site/index.html').read_text(), 'Verified fixture release')
        self.assertEqual((data / 'website/projects/fixture/checkout/run.sh').stat().st_mode & 0o777, 0o750)
        self.assertEqual(os.readlink(data / 'website/projects/fixture/checkout/external-link'), '/outside-fixture/missing')
        self.assertFalse((data / 'website/projects/fixture/checkout/node_modules').exists())
        self.assertFalse((data / 'website/locks').exists())
        self.assertEqual(list((self.helper / 'locks').iterdir()), [])
        self.assertFalse((self.release / '.activation-lock').exists())
        # Verify actual encrypted repository files, rather than trusting a label.
        for file in self.backups.repo.rglob('*'):
            if file.is_file():
                self.assertNotIn(self.secret.encode(), file.read_bytes())
        self.assertEqual((self.checkout / 'index.html').read_text(), 'Unpublished fixture source')
        self.assertEqual(json.loads((self.state / 'last-backup.json').read_text())['snapshot'], receipt['snapshot'])

    def test_locks_include_uncloned_projects_and_never_steal_existing_locks(self):
        with self.backups.source_locks():
            self.assertTrue((self.helper / 'locks/not-cloned.lock').exists())
            with self.assertRaises(backup.Busy):
                with self.backups.source_locks():
                    pass
        lock = self.helper / 'locks/fixture.lock'
        lock.write_text('Unresolved operation')
        with self.assertRaises(backup.Busy):
            with self.backups.source_locks():
                pass
        self.assertEqual(lock.read_text(), 'Unresolved operation')

    def test_active_build_defers_capture_and_releases_only_own_locks(self):
        lock = self.helper / 'locks/fixture.build.lock'
        lock.write_text('Active fixture build')
        with self.assertRaises(backup.Busy):
            self.backups.capture()
        self.assertEqual(lock.read_text(), 'Active fixture build')
        self.assertFalse((self.helper / 'locks/fixture.lock').exists())
        self.assertFalse((self.state / 'last-backup.json').exists())

    def test_release_flock_and_activation_lock_are_respected(self):
        with backup.release_claim(self.release):
            with self.assertRaises(backup.Busy):
                with backup.release_claim(self.release):
                    pass
        lock = self.release / '.activation-lock'
        lock.mkdir()
        with self.assertRaises(backup.Busy):
            with backup.release_claim(self.release):
                pass
        self.assertTrue(lock.exists())

    def test_uncoordinated_source_change_never_records_verified_success(self):
        actual = backup.command
        def changing(args, **kwargs):
            result = actual(args, **kwargs)
            if args[0] == '/usr/bin/rsync' and args[1] == '-a':
                (self.release / 'active.conf').write_text(os.urandom(10).hex())
            return result
        with patch.object(backup, 'command', changing):
            with self.assertRaisesRegex(backup.BackupError, 'source changed'):
                self.backups.capture()
        self.assertFalse((self.state / 'last-backup.json').exists())
        self.assertEqual(list((self.helper / 'locks').iterdir()), [])

    def test_source_cannot_capture_the_repository_or_credentials(self):
        for name in ['repository', 'stateDirectory', 'passwordFile']:
            nested = self.helper / ('nested-' + name)
            if name == 'stateDirectory':
                nested.mkdir(mode=0o700)
            elif name == 'passwordFile':
                nested.write_text('Fixture password')
                nested.chmod(0o600)
            altered = {**self.config, name: str(nested)}
            with self.assertRaises(backup.BackupError):
                backup.Backups(altered)

    def test_failed_database_capture_cleans_private_stage_and_preserves_verified_backup(self):
        self.backups.initialise()
        self.backups.capture()
        previous = (self.state / 'last-backup.json').read_bytes()
        def partial_capture(data):
            (data / 'partial-private-dump').write_text('Synthetic incomplete database data')
            raise backup.BackupError('Synthetic database failure')
        with self.assertRaisesRegex(backup.BackupError, 'Synthetic database failure'):
            self.backups.capture(partial_capture)
        self.assertEqual((self.state / 'last-backup.json').read_bytes(), previous)
        self.assertEqual(list(self.state.glob('capture-*')), [])
        self.assertEqual(list((self.helper / 'locks').iterdir()), [])

    def test_selected_configuration_file_restores_without_neighbouring_private_files(self):
        selected = self.root / 'selected-service.conf'
        selected.write_text('Synthetic server routing configuration')
        selected.chmod(0o640)
        neighbour = self.root / 'unrelated-private-key'
        neighbour.write_text('Unrelated fixture must not be captured')
        config = {**self.config, 'sources': [{'label': 'server-config', 'kind': 'file', 'path': str(selected)}]}
        backups = backup.Backups(config)
        backups.initialise()
        receipt = backups.capture()
        restored = Path(backups.restore(receipt['snapshot'], self.root / 'restored')['root'])
        self.assertEqual((restored / 'data/server-config').read_bytes(), selected.read_bytes())
        self.assertEqual((restored / 'data/server-config').stat().st_mode & 0o777, 0o640)
        self.assertEqual(list((restored / 'data').iterdir()), [restored / 'data/server-config'])
        self.assertEqual(neighbour.read_text(), 'Unrelated fixture must not be captured')

    def test_schedule_retries_missing_old_future_or_failed_receipts_and_skips_only_current_backup(self):
        self.backups.initialise()
        self.assertTrue(self.backups.due())
        current = {'status': 'verified', 'snapshot': 'a' * 64, 'completedAt': datetime.now(timezone.utc).isoformat()}
        backup.atomic_json(self.state / 'last-backup.json', current)
        self.assertFalse(self.backups.due())
        for changes in [{'status': 'failed'}, {'snapshot': 'latest'},
                        {'completedAt': (datetime.now(timezone.utc) - timedelta(hours=21)).isoformat()},
                        {'completedAt': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}]:
            backup.atomic_json(self.state / 'last-backup.json', {**current, **changes})
            self.assertTrue(self.backups.due())
        backup.atomic_json(self.state / 'last-backup.json', current)
        (self.backups.repo / 'config').rename(self.backups.repo / 'unavailable-config')
        self.assertTrue(self.backups.due())

    def test_symlinked_sources_and_broad_password_permissions_are_rejected(self):
        link = self.root / 'linked'
        link.symlink_to(self.helper)
        altered = {**self.config, 'sources': [{**self.config['sources'][0], 'path': str(link)}]}
        with self.assertRaises(backup.BackupError):
            backup.Backups(altered)
        self.password.chmod(0o644)
        with self.assertRaises(backup.BackupError):
            backup.Backups(self.config)

    def test_restore_requires_exact_snapshot_and_new_separate_target(self):
        for snapshot, target in [('latest', self.root / 'new'), ('a' * 64, self.checkout),
                                 ('a' * 64, self.checkout / 'new'), ('a' * 64, self.backups.repo / 'new')]:
            with self.assertRaises(backup.BackupError):
                self.backups.restore(snapshot, target)
        self.assertEqual((self.checkout / 'index.html').read_text(), 'Unpublished fixture source')

    def test_recovery_without_source_configuration_still_refuses_recorded_live_paths_and_capture(self):
        self.backups.initialise()
        receipt = self.backups.capture()
        config = {key: value for key, value in self.config.items() if key != 'sources'}
        recovery = backup.Backups(config, restore_only=True)
        self.helper.rename(self.root / 'unavailable-original-helper')
        for target in [self.helper, self.helper / 'new']:
            with self.assertRaisesRegex(backup.BackupError, 'recorded source'):
                recovery.restore(receipt['snapshot'], target)
            self.assertFalse(target.exists())
        for action in [recovery.capture, recovery.initialise]:
            with self.assertRaisesRegex(backup.BackupError, 'Recovery configuration'):
                action()
        with self.assertRaises(backup.BackupError):
            backup.Backups(config)

    def test_special_files_are_rejected_without_reading_them(self):
        os.mkfifo(self.checkout / 'pipe')
        with self.assertRaisesRegex(backup.BackupError, 'special file'):
            backup.inventory(self.helper)

    def test_bad_password_and_corrupted_encrypted_data_fail(self):
        self.backups.initialise()
        receipt = self.backups.capture()
        original = self.password.read_text()
        self.password.write_text('Wrong fixture password')
        with self.assertRaises(backup.BackupError):
            self.backups.restore(receipt['snapshot'], self.root / 'bad-password')
        self.password.write_text(original)
        pack = next(x for x in (self.backups.repo / 'data').rglob('*') if x.is_file())
        contents = bytearray(pack.read_bytes())
        contents[-1] ^= 1
        pack.chmod(0o600)  # Deliberately damage only this fixture's read-only pack.
        pack.write_bytes(contents)
        with self.assertRaises(backup.BackupError):
            self.backups.rest('check', '--read-data')


if __name__ == '__main__':
    unittest.main()
