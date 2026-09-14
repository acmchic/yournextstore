"""Generate secrets once. Python 3.8 compatible. Never print secret values."""
import base64
from pathlib import Path
import secrets
import sys

target = Path(sys.argv[1])
examples = Path(__file__).parent / 'env'
backend = ['db', 'api', 'admin']
existing = [(target / (name + '.env')).exists() for name in backend]
if any(existing) and not all(existing):
    raise SystemExit('Partial backend env set: restore/check db.env, api.env and admin.env together.')
password = secrets.token_hex(32)
values = {
    'REPLACE_WITH_DATABASE_PASSWORD': password,
    'REPLACE_WITH_ROOT_PASSWORD': secrets.token_hex(32),
    'REPLACE_WITH_RANDOM_SECRET': secrets.token_hex(32),
    'REPLACE_WITH_BASE64_KEY': base64.b64encode(secrets.token_bytes(32)).decode(),
}
for name in backend + ['storefront']:
    path = target / (name + '.env')
    if path.exists():
        continue
    text = (examples / (name + '.env.example')).read_text()
    for old, new in values.items():
        text = text.replace(old, new)
    if name == 'admin':
        text = text.replace('APP_KEY=\n', 'APP_KEY=base64:' + base64.b64encode(secrets.token_bytes(32)).decode() + '\n')
    with path.open('x') as handle:
        handle.write(text)
    path.chmod(0o600)
    print('Created ' + path.name)
