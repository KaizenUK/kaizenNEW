"""The sudo entry accepts publication metadata, never caller-selected commands."""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    'native_deploy_launcher', ROOT / 'scripts/ops/run_public_deployment.py')
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)


class DeploymentLauncherTest(unittest.TestCase):
    def setUp(self):
        self.config = json.loads(
            (ROOT / 'deploy/systemd/native-deploy.json.example').read_text())
        self.args = ['--branch', 'stage', '--sha', 'a' * 40,
                     '--release', 'gh-123-1', '--build-number', '123']

    def test_fixed_destination_command_keeps_whole_worker_under_lock_and_controller(self):
        config = launcher.configuration(self.config)
        args = launcher.command(config, launcher.request(self.args), 'kaizen-deploy')
        self.assertEqual(args[0], '/usr/bin/systemd-run')
        for option in ['--unit=kaizen-native-deploy-stage.service',
                       '--property=User=kaizen-deploy',
                       '--property=KillMode=control-group',
                       '--property=SendSIGKILL=yes',
                       '--property=DelegateSubgroup=supervisor',
                       '--setenv=KAIZEN_APP_DIR=/srv/kaizen/staging',
                       '--setenv=KAIZEN_PUBLIC_DOMAIN=stage.kaizenweb.co.uk',
                       '--setenv=VITE_BUILDER_CLOUD=0',
                       '--setenv=BUILDER_RELEASE_ENV_FILE=/etc/kaizen/staging.env']:
            self.assertIn(option, args)
        self.assertEqual(args[-7:], [
            '/usr/bin/flock', '--nonblock', '--no-fork',
            '/var/lib/kaizen/staging/build.lock', config['node'],
            config['worker'], '--deploy'])
        prod = launcher.command(config, launcher.request([
            '--branch', 'main', '--sha', 'b' * 40, '--release', 'gh-456-1']), 'kaizen-deploy')
        self.assertIn('--setenv=VITE_BUILDER_CLOUD=1', prod)
        self.assertIn('--unit=kaizen-native-deploy-main.service', prod)
        # Public deployments keep their existing HTTPS remote. A private
        # operator target can instead use a preconfigured SSH identity.
        config['targets']['main']['repository'] = 'git@github.com:KaizenUK/kaizenNEW.git'
        launcher.configuration(config)

    def test_request_rejects_command_injection_and_arbitrary_destinations(self):
        for flag, value in [('--sha', 'a' * 40 + '\ncommand'),
                            ('--release', 'bad;command'),
                            ('--release', '../other'),
                            ('--request', '$(command)'),
                            ('--build-number', '--property=User=root')]:
            with self.subTest(flag=flag, value=value), self.assertRaises((ValueError, SystemExit)), contextlib.redirect_stderr(io.StringIO()):
                launcher.request(self.args + [flag, value])
        for extra in [['--branch', 'other'], ['--worker', '/tmp/worker'],
                      ['--app-dir', '/srv/other'], ['--mode', 'arbitrary']]:
            with self.subTest(extra=extra), self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
                launcher.request(self.args + extra)

    def test_only_explicit_reconciliation_can_restore_an_existing_release(self):
        with self.assertRaises(ValueError):
            launcher.request(self.args + ['--restore', 'previous'])
        item = launcher.request(self.args + ['--mode', 'reconcile', '--restore', 'previous'])
        args = launcher.command(self.config, item, 'kaizen-deploy')
        self.assertEqual(args[-1], '--reconcile')
        self.assertIn('--setenv=KAIZEN_RESTORE_RELEASE_ID=previous', args)

    def test_idle_maintenance_uses_same_controller_and_lock_without_publication_metadata(self):
        for branch in ['main', 'stage']:
            item = launcher.request(['--branch', branch, '--mode', 'maintain'])
            args = launcher.command(self.config, item, 'kaizen-deploy')
            self.assertEqual(args[-1], '--maintain')
            self.assertIn('--unit=kaizen-native-deploy-' + branch + '.service', args)
            self.assertIn(self.config['targets'][branch]['releaseStore'] + '/build.lock', args)
            self.assertIn('--setenv=KAIZEN_DEPLOY_SHA=', args)
            self.assertIn('--setenv=KAIZEN_RELEASE_ID=', args)
        for extra in [['--sha', 'a' * 40], ['--release', 'new'], ['--restore', 'old'],
                      ['--request', '123'], ['--build-number', '1']]:
            with self.subTest(extra=extra), self.assertRaises(ValueError):
                launcher.request(['--branch', 'main', '--mode', 'maintain'] + extra)
        for args in [['--branch', 'main'], ['--branch', 'stage', '--sha', 'a' * 40]]:
            with self.subTest(args=args), self.assertRaises(ValueError):
                launcher.request(args)

    def test_installed_configuration_rejects_cross_destination_overlap_or_queue_mixups(self):
        changes = [
            ('appDirectory', '/srv/kaizen/production'),
            ('releaseStore', '/srv/kaizen/production/retained'),
            ('stateDirectory', '/var/lib/kaizen/staging/cache'),
            ('domain', 'www.kaizenweb.co.uk'),
            ('cloud', True), ('projectId', 'another-project'),
            ('workerId', 'kaizen-production-release'),
            ('repository', '/tmp/unreviewed'),
            ('repository', 'https://user:password@example.test/repo.git'),
            ('environmentFile', '/etc/kaizen/../other.env'),
        ]
        for key, value in changes:
            config = copy.deepcopy(self.config)
            config['targets']['stage'][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                launcher.configuration(config)
        for key, value in [('user', 'root'), ('schemaVersion', True),
                           ('worker', './worker'), ('preflight', '/opt/./script')]:
            config = copy.deepcopy(self.config)
            config[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                launcher.configuration(config)

    def test_one_unprivileged_shared_group_joins_deployments_to_common_admission(self):
        config = launcher.configuration(self.config)
        args = launcher.command(config, launcher.request(self.args), 'kaizen-deploy')
        self.assertIn('--property=SupplementaryGroups=kaizen-storage', args)
        # Without the optional group, deployments keep per-service monitoring.
        without = copy.deepcopy(self.config)
        del without['storageGroup']
        plain = launcher.command(launcher.configuration(without), launcher.request(self.args), 'kaizen-deploy')
        self.assertNotIn('SupplementaryGroups', ' '.join(plain))
        for value in ['root', 'sudo', 'kaizen-deploy', 'Kaizen Storage', '', 'kaizen storage',
                      'kaizen-storage\nUser=root', True, ['kaizen-storage']]:
            config = copy.deepcopy(self.config)
            config['storageGroup'] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                launcher.configuration(config)
        config = copy.deepcopy(self.config)
        config['unexpected'] = 'value'
        with self.assertRaises(ValueError):
            launcher.configuration(config)

    def test_runtime_files_cannot_be_links_or_live_in_caller_writable_directories(self):
        with tempfile.TemporaryDirectory(prefix='kaizen-launcher-test-') as directory:
            root = Path(directory)
            worker = root / 'worker'
            worker.write_text('fixture runtime')
            link = root / 'linked-worker'
            link.symlink_to(worker)
            with self.assertRaises(ValueError):
                launcher.installed_file(link)
            # Even when run by root, /tmp is an untrusted parent.
            with self.assertRaises(ValueError):
                launcher.installed_file(worker)
            with self.assertRaises(ValueError):
                launcher.absolute(str(link))


if __name__ == '__main__':
    unittest.main()
