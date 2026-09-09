#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

./bootstrap-db.sh

python_bin="${PYTHON_BIN:-python3.12}"

if ! command -v "$python_bin" >/dev/null 2>&1; then
  echo "Python 3.12 was not found. Install it with: brew install python@3.12"
  exit 1
fi

if [[ ! -x .venv/bin/python ]]; then
  "$python_bin" -m venv .venv
fi

if ! .venv/bin/python -c 'import fastapi, uvicorn' >/dev/null 2>&1; then
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -e .
fi

exec .venv/bin/python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${API_PORT:-8000}" \
  --reload
