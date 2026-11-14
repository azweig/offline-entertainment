#!/usr/bin/env sh
# Arranque para Mac y Linux:  ./start.sh            (solo este equipo)
#                             ./start.sh --host 0.0.0.0   (tu red de casa)
set -e
cd "$(dirname "$0")"
PY=$(command -v python3 || command -v python || true)
[ -n "$PY" ] || { echo "Falta Python 3.11 o mas nuevo: https://www.python.org/downloads/"; exit 1; }
"$PY" -c 'import sys; sys.exit(sys.version_info < (3, 11))' || { echo "Necesitas Python 3.11 o mas nuevo."; exit 1; }
if [ ! -d .venv ]; then
  echo "Preparando el entorno (solo la primera vez)..."
  "$PY" -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r requirements.txt
fi
command -v ffmpeg >/dev/null 2>&1 || echo "Aviso: no encontre ffmpeg. Instalalo para audio mp3 y video en mp4 (Mac: brew install ffmpeg; Debian/Ubuntu: sudo apt install ffmpeg)."
command -v deno >/dev/null 2>&1 || echo "Aviso: no encontre Deno; YouTube puede fallar sin el. Instalalo: https://deno.com"
exec .venv/bin/python server.py "$@"
