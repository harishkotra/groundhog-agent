#!/usr/bin/env bash
# Install Groundhog Agent as a macOS LaunchAgent so it survives logout/reboot.
#
#   ./scripts/install-service.sh                  # 127.0.0.1:8787
#   ./scripts/install-service.sh --host 0.0.0.0    # reachable from your tailnet
#   ./scripts/install-service.sh --port 9000
#
# This writes and validates the plist. Loading it is a one-line command it
# prints at the end, because `launchctl bootstrap` cannot run from inside an
# agent sandbox.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.harish.groundhog-agent"
PORT="${PORT:-8787}"
HOST="${HOST:-127.0.0.1}"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift ;;
    --host) HOST="$2"; shift ;;
    --label) LABEL="$2"; shift ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo "node not found on PATH" >&2
  exit 1
fi
OPENCODE_BIN="$(command -v opencode || echo "$HOME/.opencode/bin/opencode")"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGDIR="$HOME/Library/Logs/groundhog-agent"

mkdir -p "$(dirname "$PLIST")" "$LOGDIR"

if [ ! -f "$ROOT/web/dist/index.html" ]; then
  echo "web/dist is missing. run ./scripts/install-mac.sh first" >&2
  exit 1
fi

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$ROOT/server.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOST</key><string>$HOST</string>
    <key>PORT</key><string>$PORT</string>
    <key>OPENCODE_BIN</key><string>$OPENCODE_BIN</string>
    <key>PATH</key><string>$(dirname "$NODE_BIN"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOGDIR/out.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/err.log</string>
</dict>
</plist>
PLIST_EOF

plutil -lint "$PLIST"

echo
echo "plist written: $PLIST"
echo "logs:          $LOGDIR"
echo
echo "This machine cannot load it from inside the agent sandbox."
echo "If your Mac does not auto-login, prefer a LaunchDaemon over a LaunchAgent"
echo "(see the launchd skill notes) or the service will not start after a reboot."
echo
echo "Load it now from a terminal:"
echo "  launchctl bootstrap gui/\$(id -u) \"$PLIST\""
echo
echo "Verify:"
echo "  launchctl print gui/\$(id -u)/$LABEL | head -20"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:$PORT/api/dataset"
echo
echo "Unload:"
echo "  launchctl bootout gui/\$(id -u)/$LABEL"
