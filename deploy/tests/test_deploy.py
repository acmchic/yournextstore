"""Exercise storefront deployment with fake host commands; never touch host services."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'deploy.sh'
SHIM = r'''
import os, pathlib, shutil, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
root = pathlib.Path(os.environ['TEST_ROOT'])
with (root / 'commands').open('a') as f:
    f.write(name + ' ' + ' '.join(args) + '\n')
if name == 'runuser':
    command = args[args.index('--') + 1:]
    os.execvp(command[0], command)
elif name in ('flock', 'curl'):
    pass
elif name == 'realpath':
    print(pathlib.Path(args[0]).resolve())
elif name == 'systemctl':
    if args[:2] == ['restart', 'teebravo-storefront'] and os.getenv('FAIL_RESTART') and not (root / 'failed-once').exists():
        (root / 'failed-once').touch()
        sys.exit(1)
elif name == 'docker':
    if args[0] == 'info':
        print(root)
    elif 'ps' in args:
        print('fixture-container')
elif name == 'bun':
    pathlib.Path('node_modules').mkdir(exist_ok=True)
elif name == 'node':
    if args[0] != '-e':
        with (root / 'builds').open('a') as f: f.write('build\n')
        if os.getenv('FAIL_BUILD'): sys.exit(1)
        out = pathlib.Path('.next/standalone')
        out.mkdir(parents=True, exist_ok=True)
        (out / 'server.js').write_text('server')
        static = pathlib.Path('.next/static')
        static.mkdir(parents=True, exist_ok=True)
        (static / 'chunk.js').write_text('chunk')
elif name == 'install':
    # Test executes directory creation only, discarding the production owner/group.
    pathlib.Path(args[-1]).mkdir(parents=True, exist_ok=True)
elif name == 'mv':
    os.replace(args[-2], args[-1])
elif name == 'rsync':
    source, target = map(pathlib.Path, args[-2:])
    exclude = {'.git', '.next', 'node_modules', 'admin', 'api', 'deploy', 'docs', 'plans', '.agents', '.codex', '.claude', '.cache'} if any(a.startswith('--exclude') for a in args) else set()
    def ignore(directory, names):
        return [n for n in names if n in exclude or (exclude and (n.startswith('.env') or n == 'deploy.sh'))]
    shutil.copytree(source, target, dirs_exist_ok=True, ignore=ignore)
else:
    raise SystemExit('Unexpected host command: ' + name)
'''


class DeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='teebravo-deploy-test-')
        self.root = Path(self.temp.name).resolve()
        self.repo = self.root / 'repository'
        for part in ['repository/public', 'repository/api/app', 'repository/api/mysql/init', 'repository/deploy/docker', 'build', 'releases', 'shared/next-static', 'state', 'etc', 'bin']:
            (self.root / part).mkdir(parents=True)
        for name in ['package.json', 'bun.lock', 'public/sample.txt']:
            (self.repo / name).write_text('fixture')
        (self.root / 'etc/storefront.env').write_text('BUILD_HEAP_MB=256\n')
        for name in ['db', 'api', 'admin']:
            (self.root / ('etc/' + name + '.env')).write_text('FIXTURE=1\n')
        for name in ['api/pyproject.toml', 'api/bootstrap-db.sh', 'deploy/compose.production.yaml']:
            (self.repo / name).write_text('fixture')
        content = SCRIPT.read_text().replace('BASE=/srv/teebravo', f'BASE={self.root}')
        content = content.replace('[[ $EUID == 0 ]] || fail \'Run with sudo.\'', ':')
        content = content.replace('/etc/teebravo', str(self.root / 'etc'))
        content = content.replace('/run/lock/teebravo-deploy.lock', str(self.root / 'deploy.lock'))
        content = content.replace('export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"', f'export PATH="{self.root}/bin:/usr/bin:/bin"')
        (self.repo / 'deploy.sh').write_text(content)
        for name in ['runuser', 'flock', 'curl', 'realpath', 'systemctl', 'bun', 'node', 'install', 'mv', 'rsync', 'docker']:
            shim = self.root / 'bin' / name
            shim.write_text(f'#!{sys.executable}\n' + SHIM)
            shim.chmod(0o755)
        (self.root / 'bin/python3').symlink_to(sys.executable)
        self.env = {**os.environ, 'TEST_ROOT': str(self.root)}

    def tearDown(self):
        self.temp.cleanup()

    def deploy(self, *args, **env):
        return subprocess.run(['bash', 'deploy.sh', *args], cwd=self.repo, env={**self.env, **env}, capture_output=True, text=True)

    def initial(self):
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return (self.root / 'current').resolve()

    def test_default_and_unchanged_skip(self):
        old = self.initial()
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('unchanged; skipped', result.stdout)
        self.assertEqual((self.root / 'builds').read_text(), 'build\n')
        self.assertEqual((self.root / 'current').resolve(), old)
        self.assertNotIn('teebravo-api\n', (self.root / 'commands').read_text())
        self.assertFalse((self.root / 'state/admin').exists())
        self.assertFalse((self.root / 'state/api').exists())
        self.assertNotIn('docker ', (self.root / 'commands').read_text())

    def test_only_api_does_not_recreate_database_or_build_frontend(self):
        result = self.deploy('--only-api')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        commands = (self.root / 'commands').read_text()
        self.assertIn('build api', commands)
        self.assertNotIn('build admin', commands)
        self.assertNotIn('--wait-timeout 180 db', commands)
        self.assertFalse((self.root / 'builds').exists())

    def test_disk_guard_stops_before_build(self):
        result = self.deploy(MIN_FREE_GB='1000000000')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Not enough free disk', result.stderr)
        self.assertFalse((self.root / 'builds').exists())

    def test_build_failure_preserves_release(self):
        old = self.initial()
        result = self.deploy('--force', FAIL_BUILD='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.root / 'current').resolve(), old)

    def test_restart_failure_rolls_back(self):
        old = self.initial()
        result = self.deploy('--force', FAIL_RESTART='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('previous release restored', result.stderr)
        self.assertEqual((self.root / 'current').resolve(), old)

    def test_invalid_option_has_no_effect(self):
        result = self.deploy('--invalid')
        self.assertEqual(result.returncode, 2)
        self.assertFalse((self.root / 'commands').exists())


if __name__ == '__main__':
    unittest.main()
