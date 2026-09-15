"""Host preparation edits preserve existing routes and reject ambiguous layouts."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('prepare_domain_host', Path(__file__).resolve().parents[2] / 'deploy/prepare-domain-host.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class DomainHostInstallTests(unittest.TestCase):
    def test_adds_exactly_one_include_without_changing_the_existing_sites(self):
        text = 'user apache;\nevents {}\nhttp {\n  server { listen 127.0.0.1:8091; }\n  server { listen 127.0.0.1:8092; }\n}\n'
        result = installer.with_domain_include(text)
        self.assertEqual(result.replace(installer.INCLUDE, ''), text)
        self.assertEqual(installer.with_domain_include(result), result)

    def test_rejects_ambiguous_or_differently_managed_configuration(self):
        for value in ['events {}\n', 'http {\n}\nhttp {\n}\n',
                      'http {\n include kaizen-domains.conf;\n}\n',
                      'http {\n' + installer.INCLUDE * 2 + '}\n']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                installer.with_domain_include(value)

    def test_runtime_service_uses_only_a_canonical_node_executable(self):
        root = Path(__file__).resolve().parents[2]
        template = (root / 'deploy/systemd/kaizen-domain-worker.service').read_text()
        runtime = '/opt/kaizen-runtime/fixture-node/bin/node'
        prepared = installer.worker_service(template, runtime)
        self.assertEqual(prepared.replace(runtime, '/usr/bin/node'), template)
        self.assertIn('EnvironmentFile=/etc/kaizen/client-worker.env', prepared)
        self.assertIn('UnsetEnvironment=NODE_OPTIONS NODE_PATH LD_PRELOAD LD_LIBRARY_PATH', prepared)
        self.assertNotIn('node_modules', prepared)
        self.assertNotIn('/opt/kaizen-builder', prepared)
        for value in ['/tmp/node\nExecStart=/tmp/other', '/tmp/node;other', '/tmp/../node']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                installer.worker_service(template, value)


if __name__ == '__main__':
    unittest.main()
