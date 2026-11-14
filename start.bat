@echo off
rem Arranque para Windows: doble clic, o "start.bat --host 0.0.0.0" para tu red de casa
cd /d "%~dp0"
where py >nul 2>nul && (set PY=py -3) || (set PY=python)
%PY% -c "import sys; sys.exit(sys.version_info < (3, 10))" 2>nul || (
  echo Necesitas Python 3.10 o mas nuevo: https://www.python.org/downloads/
  pause & exit /b 1
)
if not exist .venv (
  echo Preparando el entorno, solo la primera vez...
  %PY% -m venv .venv || (pause & exit /b 1)
  .venv\Scripts\python -m pip install -q --upgrade pip
  .venv\Scripts\python -m pip install -q -r requirements.txt || (pause & exit /b 1)
)
where ffmpeg >nul 2>nul || echo Aviso: no encontre ffmpeg. Instalalo con: winget install Gyan.FFmpeg
where deno >nul 2>nul || echo Aviso: no encontre Deno; YouTube puede fallar sin el. Instalalo con: winget install DenoLand.Deno
.venv\Scripts\python server.py %*
pause
