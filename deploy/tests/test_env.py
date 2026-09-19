"""Check one-time generated credentials without printing secret values."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'init-env.py'


class EnvTests(unittest.TestCase):
    def test_matching_credentials_and_no_rotation(self):
        with tempfile.TemporaryDirectory() as directory:
            run = lambda: subprocess.run([sys.executable, str(SCRIPT), directory], capture_output=True, text=True)
            self.assertEqual(run().returncode, 0)
            root = Path(directory)
            snapshot = {p.name: p.read_bytes() for p in root.iterdir()}
            def values(name):
                return dict(line.split('=', 1) for line in (root / name).read_text().splitlines() if '=' in line and not line.startswith('#'))
            self.assertEqual(values('db.env')['MYSQL_PASSWORD'], values('api.env')['DB_PASSWORD'])
            self.assertEqual(values('db.env')['MYSQL_PASSWORD'], values('admin.env')['DB_PASSWORD'])
            self.assertTrue(values('admin.env')['APP_KEY'].startswith('base64:'))
            self.assertEqual(values('deploy.env')['TEEBRAVO_PUBLIC_DOMAIN'], 'teebravo.com')
            self.assertEqual(values('admin.env')['APP_URL'], 'https://admin.teebravo.com')
            self.assertEqual(values('api.env')['STOREFRONT_PUBLIC_URL'], 'https://teebravo.com')
            self.assertEqual(values('storefront.env')['STORE_API_URL'], 'http://127.0.0.1:1991')
            self.assertFalse(any(b'REPLACE_' in value for value in snapshot.values()))
            self.assertEqual(run().returncode, 0)
            self.assertEqual(snapshot, {p.name: p.read_bytes() for p in root.iterdir()})

    def test_partial_backend_env_fails_without_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'db.env').write_text('KEEP=original\n')
            result = subprocess.run([sys.executable, str(SCRIPT), directory], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((root / 'db.env').read_text(), 'KEEP=original\n')
            self.assertFalse((root / 'api.env').exists())


if __name__ == '__main__':
    unittest.main()
