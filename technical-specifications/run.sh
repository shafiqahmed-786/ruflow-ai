#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PYTHON="$PROJECT_DIR/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
    echo "Python aplinka nerasta. Pirmiausia paleiskite ./install.sh." >&2
    exit 1
fi

exec "$PYTHON" "$PROJECT_DIR/main.py" "$@"
