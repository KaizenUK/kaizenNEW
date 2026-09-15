"""Encrypted release/source recovery verified with the actual release engine."""
import json
import os
import subprocess
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/ops'))
import backup


@unittest.skipUnless(os.environ.get('KAIZEN_NGINX_BINARY'), 'Set KAIZEN_NGINX_BINARY for the served-website restore drill.')
class WebsiteRestoreTests(unittest.TestCase):
    def test_restored_store_serves_original_bytes_activates_rolls_back_and_preserves_unpublished_source(self):
        with tempfile.TemporaryDirectory(prefix='kaizen-website-restore-') as temporary:
            root = Path(temporary)
            state, working = root / 'state', root / 'working'
            state.mkdir(mode=0o700)
            working.mkdir(mode=0o700)
            (working / 'pending.txt').write_text('Unpublished private synthetic website edit')
            password = root / 'password'
            password.write_text(os.urandom(32).hex())
            password.chmod(0o600)
            source_store = root / 'original-store'
            script = Path(__file__).with_name('restore-site.mjs')
            node = os.environ.get('KAIZEN_NODE_BINARY', 'node')
            def fixture(*args):
                result = subprocess.run([node, str(script), *args], capture_output=True, timeout=120)
                self.assertEqual(result.returncode, 0, result.stderr.decode())
                return result.stdout
            fixture('create', str(source_store))
            config = {'version': 1, 'stateDirectory': str(state), 'repository': str(root / 'encrypted'),
                'passwordFile': str(password), 'restic': os.environ.get('KAIZEN_RESTIC_BINARY', '/usr/bin/restic'),
                'sources': [{'label': 'release-store', 'kind': 'release', 'path': str(source_store)},
                            {'label': 'working-copy', 'kind': 'files', 'path': str(working)}]}
            capture = backup.Backups(config)
            capture.initialise()
            receipt = capture.capture()
            source_store.rename(root / 'unavailable-original-store')
            working.rename(root / 'unavailable-original-working-copy')
            recovery = backup.Backups({key: value for key, value in config.items() if key != 'sources'},
                                      restore_only=True)
            restored = recovery.restore(receipt['snapshot'], root / 'restored')
            data = Path(restored['root']) / 'data'
            self.assertEqual((data / 'working-copy/pending.txt').read_text(), 'Unpublished private synthetic website edit')
            result = json.loads(fixture('verify', str(data / 'release-store'), str(source_store)))
            self.assertTrue(result['restored'])
            self.assertTrue(result['sourceUnavailable'])
            self.assertTrue(result['privatePathsDenied'])
            self.assertGreater(result['checked'], 3)
            self.assertEqual(result['activation'], 'live')
            self.assertEqual(result['rollback'], 'live')
            self.assertEqual((data / 'working-copy/pending.txt').read_text(), 'Unpublished private synthetic website edit')


if __name__ == '__main__':
    unittest.main()
