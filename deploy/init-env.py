"""Generate secrets once. Python 3.8 compatible. Never print secret values."""
import base64
from pathlib import Path
import re
import secrets
import sys

target = Path(sys.argv[1])
examples = Path(__file__).parent / 'env'
backend = ['db', 'api', 'admin']
existing = [(target / (name + '.env')).exists() for name in backend]
if any(existing) and not all(existing):
    raise SystemExit('Partial backend env set: restore/check db.env, api.env and admin.env together.')


def parse_env(text):
    values = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if not separator or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key):
            raise SystemExit(f'Invalid deployment env line: {raw_line}')
        values[key] = value
    return values


deployment_template = (examples / 'deploy.env.example').read_text()
deployment_values = parse_env(deployment_template)
required_deployment_values = {
    'TEEBRAVO_PUBLIC_DOMAIN',
    'TEEBRAVO_ADMIN_DOMAIN',
    'TEEBRAVO_API_DOMAIN',
    'TEEBRAVO_CERT_NAME',
    'TEEBRAVO_STOREFRONT_PORT',
    'TEEBRAVO_API_PORT',
    'TEEBRAVO_COMPOSE_PROJECT',
}
missing = sorted(required_deployment_values - deployment_values.keys())
if missing:
    raise SystemExit('Missing deployment mapping: ' + ', '.join(missing))

template_values = {
    '__PUBLIC_DOMAIN__': deployment_values['TEEBRAVO_PUBLIC_DOMAIN'],
    '__ADMIN_DOMAIN__': deployment_values['TEEBRAVO_ADMIN_DOMAIN'],
    '__API_DOMAIN__': deployment_values['TEEBRAVO_API_DOMAIN'],
    '__CERT_NAME__': deployment_values['TEEBRAVO_CERT_NAME'],
    '__STOREFRONT_PORT__': deployment_values['TEEBRAVO_STOREFRONT_PORT'],
    '__API_PORT__': deployment_values['TEEBRAVO_API_PORT'],
}

password = secrets.token_hex(32)
values = {
    'REPLACE_WITH_DATABASE_PASSWORD': password,
    'REPLACE_WITH_ROOT_PASSWORD': secrets.token_hex(32),
    'REPLACE_WITH_RANDOM_SECRET': secrets.token_hex(32),
    'REPLACE_WITH_BASE64_KEY': base64.b64encode(secrets.token_bytes(32)).decode(),
}
for name in ['deploy'] + backend + ['storefront']:
    path = target / ('deploy.env' if name == 'deploy' else name + '.env')
    if path.exists():
        continue
    text = deployment_template if name == 'deploy' else (examples / (name + '.env.example')).read_text()
    for old, new in values.items():
        text = text.replace(old, new)
    for old, new in template_values.items():
        text = text.replace(old, new)
    unresolved = re.findall(r'__[A-Z0-9_]+__', text)
    if unresolved:
        raise SystemExit(f'Unresolved env placeholders in {name}: {", ".join(sorted(set(unresolved)))}')
    if name == 'admin':
        text = text.replace('APP_KEY=\n', 'APP_KEY=base64:' + base64.b64encode(secrets.token_bytes(32)).decode() + '\n')
    with path.open('x') as handle:
        handle.write(text)
    path.chmod(0o600)
    print('Created ' + path.name)
