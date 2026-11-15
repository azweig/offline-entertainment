#!/usr/bin/env sh
# Real start-up check: the server creates its key (mode 600), answers 401 without the key,
# 401 with a wrong key, 200 with the right key, and 404 for anything outside the app.
set -eu
PY=${1:-python3}
DIR=$(mktemp -d)
PORT=${SMOKE_PORT:-18765}
OFFLINE_CONFIG_DIR="$DIR" "$PY" server.py --port "$PORT" >/dev/null 2>&1 &
PID=$!
cleanup() { { kill "$PID"; wait "$PID"; } 2>/dev/null || true; rm -f "$DIR/key"; rmdir "$DIR" 2>/dev/null || true; }
trap cleanup EXIT

i=0
until curl -s -o /dev/null "http://127.0.0.1:$PORT/"; do
  i=$((i + 1)); [ "$i" -gt 40 ] && { echo "server did not start"; exit 1; }; sleep 0.25
done

KEY=$(cat "$DIR/key")
MODE=$(stat -c %a "$DIR/key" 2>/dev/null || stat -f %Lp "$DIR/key")
[ "$MODE" = "600" ] || { echo "key file mode is $MODE, expected 600"; exit 1; }

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
[ "$(code "http://127.0.0.1:$PORT/api/ping")" = "401" ] || { echo "expected 401 without key"; exit 1; }
[ "$(code -H "X-Key: wrong-key-123" "http://127.0.0.1:$PORT/api/ping")" = "401" ] || { echo "expected 401 with a wrong key"; exit 1; }  # gitleaks:allow (fake key)
[ "$(code -H "X-Key: $KEY" "http://127.0.0.1:$PORT/api/ping")" = "200" ] || { echo "expected 200 with the key"; exit 1; }  # gitleaks:allow (key from the temp dir)
[ "$(code --path-as-is "http://127.0.0.1:$PORT/../../etc/passwd")" = "404" ] || { echo "expected 404 for path traversal"; exit 1; }
echo "smoke ok: key file 600 · 401 without key · 401 wrong key · 200 with key · 404 on traversal"
