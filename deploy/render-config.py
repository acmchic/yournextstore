"""Render a small, validated deployment template without shell evaluation."""
import re
from pathlib import Path
import sys


if len(sys.argv) < 3 or any("=" not in item for item in sys.argv[3:]):
    raise SystemExit("usage: render-config.py SOURCE TARGET KEY=VALUE [...]")

source = Path(sys.argv[1])
target = Path(sys.argv[2])
replacements = dict(item.split("=", 1) for item in sys.argv[3:])
text = source.read_text()

for key, value in replacements.items():
    text = text.replace(f"__{key}__", value)

remaining = re.findall(r"__[A-Z0-9_]+__", text)
if remaining:
    raise SystemExit(f"Unresolved deployment placeholders: {', '.join(sorted(set(remaining)))}")

target.write_text(text)
