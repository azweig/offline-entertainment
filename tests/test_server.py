"""Pruebas minimas: autenticacion, clave automatica y bloqueo de direcciones privadas.
No se conectan a internet."""
import json, os, socket, stat, sys, tempfile, threading, unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

KEY = "clave-de-prueba-123456"  # gitleaks:allow (clave falsa solo para pruebas)


class Auth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.KEY = KEY
        server.TMP_ROOT.mkdir(parents=True, exist_ok=True)
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), server.H)
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def call(self, path, key=None, body=None):
        h = {"X-Key": key} if key is not None else {}
        data = None
        if body is not None:
            data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
        try:
            with urlopen(Request(self.base + path, data=data, headers=h), timeout=5) as r:
                return r.status, json.loads(r.read() or b"null")
        except HTTPError as e:
            with e:
                return e.code, json.loads(e.read() or b"null")

    def test_ping_sin_clave_401(self):
        self.assertEqual(self.call("/api/ping")[0], 401)

    def test_ping_clave_mala_401(self):
        self.assertEqual(self.call("/api/ping", "otra-clave-cualquiera")[0], 401)

    def test_ping_con_clave_200(self):
        self.assertEqual(self.call("/api/ping", KEY), (200, {"ok": True}))

    def test_todas_las_api_piden_clave(self):
        for p in ("/api/search?q=x", "/api/info?id=dQw4w9WgXcQ", "/api/jobs/0123456789abcdef"):
            self.assertEqual(self.call(p)[0], 401, p)
        self.assertEqual(self.call("/api/jobs", body={"id": "dQw4w9WgXcQ"})[0], 401)

    def test_pagina_publica(self):
        with urlopen(self.base + "/", timeout=5) as r:
            self.assertEqual(r.status, 200)

    def test_solo_sitios_de_la_lista(self):
        for url in ("http://127.0.0.1:22/", "http://169.254.169.254/latest/meta-data/",
                    "https://example.com/watch?v=dQw4w9WgXcQ", "file:///etc/passwd",
                    "https://facebook.com.ejemplo.com/v", "https://www.facebook.com:8443/v"):
            self.assertEqual(self.call("/api/jobs", KEY, {"url": url})[0], 400, url)
            self.assertEqual(self.call("/api/link?url=" + quote(url), KEY)[0], 400, url)

    def test_sin_clave_definida_nadie_entra(self):
        with mock.patch.object(server, "KEY", ""):
            self.assertEqual(self.call("/api/ping", "")[0], 401)


class Sites(unittest.TestCase):
    def test_aceptados_y_limpios(self):
        ok = {"https://www.facebook.com/watch/?v=274175099429670#x": "https://www.facebook.com/watch/?v=274175099429670",
              "http://m.facebook.com/reel/1195289147628387": "https://m.facebook.com/reel/1195289147628387",
              "https://www.tiktok.com/@user/video/7059698374567611694": None,
              "https://x.com/user/status/719944021058060289": None,
              "https://soundcloud.com/artista/cancion": None,
              "https://artista.bandcamp.com/track/cancion": None}
        for raw, want in ok.items():
            s = server.site_link(raw)
            self.assertIsNotNone(s, raw)
            self.assertTrue(s[2].startswith("https://"), raw)
            if want:
                self.assertEqual(s[2], want)

    def test_rechazados(self):
        for raw in ("https://facebook.com.ejemplo.com/video", "https://notfacebook.com/v",
                    "https://user:pass@www.facebook.com/v", "https://www.facebook.com:8443/v",
                    "ftp://www.facebook.com/v", "https://ejemplo.com/video.mp4", "javascript:alert(1)",
                    "https://192.168.1.1/", "https://www.reddit.com/r/x/comments/1/"):
            self.assertIsNone(server.site_link(raw), raw)

    def test_titulo_facebook_limpio(self):
        self.assertEqual(server.clean_title("119 reactions · 1.4K shares | Asif Nawab"), "Asif Nawab")
        self.assertEqual(server.clean_title("9.9K views · 340 reactions | When your mom"), "When your mom")
        self.assertEqual(server.clean_title("Canción | Artista"), "Canción | Artista")

    def test_solo_extractores_del_sitio(self):
        _, ies, _ = server.site_link("https://www.instagram.com/reel/abc/")
        self.assertEqual(server.options("x", "audio", "480", ies)["allowed_extractors"], ies)
        self.assertNotIn("generic", " ".join(ies).lower())
        self.assertEqual(server.options("x", "audio", "480")["allowed_extractors"], ["youtube"])


class Key(unittest.TestCase):
    def test_genera_y_reusa_clave_600(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ, {"OFFLINE_CONFIG_DIR": d}, clear=False):
            os.environ.pop("OFFLINE_KEY", None)
            k1, f = server.load_key()
            self.assertGreaterEqual(len(k1), 24)
            if os.name != "nt":
                self.assertEqual(stat.S_IMODE(f.stat().st_mode), 0o600)
            k2, _ = server.load_key()
            self.assertEqual(k1, k2)

    def test_variable_tiene_prioridad(self):
        with mock.patch.dict(os.environ, {"OFFLINE_KEY": KEY}):
            self.assertEqual(server.load_key(), (KEY, None))

    def test_clave_corta_rechazada(self):
        with mock.patch.dict(os.environ, {"OFFLINE_KEY": "corta"}):
            with self.assertRaises(SystemExit):
                server.load_key()


def fake_dns(ip):
    fam = socket.AF_INET6 if ":" in ip else socket.AF_INET
    return lambda *a, **k: [(fam, socket.SOCK_STREAM, 6, "", (ip, 443))]


class PrivateAddresses(unittest.TestCase):
    BLOCKED = ["127.0.0.1", "127.8.8.8", "10.0.0.5", "172.16.0.1", "172.31.255.255",
               "192.168.1.10", "169.254.169.254", "100.64.0.1", "100.127.255.254", "0.0.0.0",
               "::1", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:192.168.1.1", "::ffff:127.0.0.1"]
    ALLOWED = ["142.250.79.14", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2607:f8b0:4002::64"]

    def test_bloqueadas(self):
        for ip in self.BLOCKED:
            self.assertTrue(server.blocked_ip(ip), ip)

    def test_publicas(self):
        for ip in self.ALLOWED:
            self.assertFalse(server.blocked_ip(ip), ip)

    def test_resuelve_antes_de_conectar(self):
        # un nombre "inocente" que resuelve a una IP interna se rechaza
        for ip in ("192.168.0.1", "::1", "100.100.100.100"):
            with mock.patch("socket.getaddrinfo", fake_dns(ip)):
                with self.assertRaises(ValueError):
                    server.check_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        with mock.patch("socket.getaddrinfo", fake_dns("142.250.79.14")):
            self.assertTrue(server.check_url("https://www.youtube.com/"))

    def test_descarga_no_arranca_si_dns_apunta_adentro(self):
        jid = "abcdef0123456789"
        server.TMP_ROOT.mkdir(parents=True, exist_ok=True)
        server.JOBS[jid] = {"id": jid, "status": "en cola", "created": 0}
        with mock.patch("socket.getaddrinfo", fake_dns("10.1.2.3")), \
             mock.patch.object(server.yt_dlp.YoutubeDL, "extract_info") as ex:
            server.run(jid, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "audio", "480")
            ex.assert_not_called()
        self.assertEqual(server.JOBS[jid]["status"], "error")
        self.assertIn("privada", server.JOBS[jid]["error"])
        server.JOBS.pop(jid, None)


if __name__ == "__main__":
    unittest.main()
