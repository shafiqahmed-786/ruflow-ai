#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PLIST_TEMPLATE="$PROJECT_DIR/com.ruflow.ts-monitor.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.ruflow.ts-monitor.plist"
LABEL="com.ruflow.ts-monitor"
DOMAIN="gui/$(id -u)"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Šis diegiklis skirtas macOS; aptikta: $(uname -s)." >&2
    exit 1
fi

command -v python3 >/dev/null || { echo "Reikalingas python3 (įdiekite Xcode Command Line Tools)." >&2; exit 1; }
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || {
    echo "Reikalingas Python 3.9 arba naujesnis." >&2
    exit 1
}
python3 -m venv "$PROJECT_DIR/.venv"
"$PROJECT_DIR/.venv/bin/python" -m pip install --upgrade pip
"$PROJECT_DIR/.venv/bin/python" -m pip install -r "$PROJECT_DIR/requirements.txt"
"$PROJECT_DIR/.venv/bin/python" -m playwright install chromium
mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT_DIR/data/logs"

PROJECT_DIR="$PROJECT_DIR" PLIST_TEMPLATE="$PLIST_TEMPLATE" PLIST_DEST="$PLIST_DEST" \
python3 - <<'PY'
import os
import plistlib
from pathlib import Path

with Path(os.environ["PLIST_TEMPLATE"]).open("rb") as stream:
    config = plistlib.load(stream)
root = os.environ["PROJECT_DIR"]
config["ProgramArguments"][0] = str(Path(root) / "run.sh")
config["WorkingDirectory"] = root
config["StandardOutPath"] = str(Path(root) / "data/logs/launchd.log")
config["StandardErrorPath"] = str(Path(root) / "data/logs/launchd-error.log")
with Path(os.environ["PLIST_DEST"]).open("wb") as stream:
    plistlib.dump(config, stream)
PY

/usr/bin/plutil -lint "$PLIST_DEST"
if /bin/launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    /bin/launchctl bootout "$DOMAIN" "$PLIST_DEST"
fi
/bin/launchctl bootstrap "$DOMAIN" "$PLIST_DEST"
echo "Įdiegta: $PLIST_DEST"
echo "Patikrinkite būseną: launchctl print $DOMAIN/$LABEL"
