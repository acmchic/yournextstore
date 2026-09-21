#!/usr/bin/env bash

# Import TeeBravo policy content into checkout_settings and legal_pages.
# Run from any directory. The first run is always a DB-backed validation.
# Pass --apply only after its output is correct.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
api_dir="$(cd "${script_dir}/.." && pwd)"
config_file="${POLICY_CONFIG_FILE:-${api_dir}/policies.teebravo.json}"

if [[ -n "${PYTHON_BIN:-}" ]]; then
  python_bin="$PYTHON_BIN"
elif [[ -x "${api_dir}/.venv/bin/python" ]]; then
  python_bin="${api_dir}/.venv/bin/python"
else
  python_bin="python3"
fi

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--apply" ) ]]; then
  printf 'Usage: %s [--apply]\n' "$0" >&2
  printf 'Set PYTHON_BIN to the API virtualenv Python when needed.\n' >&2
  printf 'Set POLICY_CONFIG_FILE to import a reviewed JSON file.\n' >&2
  exit 64
fi

if [[ ! -f "$config_file" ]]; then
  printf 'Policy file not found: %s\n' "$config_file" >&2
  exit 66
fi

cd "$api_dir"

printf 'Validating policy content against the configured database...\n'
"$python_bin" -m app.policy_config import "$config_file" --overwrite --dry-run

if [[ $# -eq 0 ]]; then
  printf '\nValidation passed. Re-run with --apply to write checkout_settings and legal_pages.\n'
  exit 0
fi

printf '\nWriting policy content to checkout_settings and legal_pages...\n'
"$python_bin" -m app.policy_config import "$config_file" --overwrite
printf 'Import complete. All policy pages in this JSON remain drafts.\n'
