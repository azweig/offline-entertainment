FROM denoland/deno:bin-2.5.6 AS deno

FROM python:3.12-slim
# ffmpeg: une audio+video y convierte a mp3. Deno: yt-dlp lo usa para resolver YouTube.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deno /deno /usr/local/bin/deno

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
COPY static ./static

RUN useradd --create-home --uid 10001 app && mkdir -p /config && chown app /config
USER app
# Dentro del contenedor escucha en todas las interfaces; docker-compose.yml solo lo
# publica en 127.0.0.1 de tu equipo.
ENV OFFLINE_HOST=0.0.0.0 OFFLINE_PORT=8765 OFFLINE_CONFIG_DIR=/config PYTHONUNBUFFERED=1
EXPOSE 8765
CMD ["python", "server.py"]
