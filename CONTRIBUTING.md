# Contribuir / Contributing

Gracias por ayudar. / *Thanks for helping.*

**Alcance / Scope**
- Herramienta de uso personal para guardar contenido en tu propio celular. No se aceptan cambios para
  cookies o cuentas, proxies, hacerse pasar por un navegador, saltarse bloqueos de los sitios, ni modos
  públicos o multiusuario.
- *Personal-use tool. No cookies/accounts, proxies, browser impersonation, block evasion, or
  public/multi-user modes.*

**Privacidad / Privacy**
- El servidor no guarda historial, títulos ni registros. Mantenlo así.
- *The server keeps no history, titles or logs. Keep it that way.*

**Seguridad / Security**
- Toda conexión saliente pasa por `check_url()`. Las URL se arman en el servidor.
- *Every outbound request goes through `check_url()`. URLs are built server-side.*

**Agregar un sitio / Adding a site**
1. Súmalo a `SITES` en `server.py`: dominios y nombres exactos de extractores de yt-dlp, **nunca
   `generic`**. / *Add it to `SITES` with exact extractor names, never `generic`.*
2. Pruébalo con contenido público sin iniciar sesión. / *Test it with public content, logged out.*
3. Agrégalo a la tabla de `README.md` y `README.es.md`. / *Add it to both READMEs.*

**Pruebas / Tests**

```bash
make setup   # una vez / once
make check   # lint (ruff) + pruebas + arranque real / lint + unit tests + real start-up
```

Más detalles en / *More in* [docs/development.md](docs/development.md). Antes de proponer algo grande,
lee las decisiones en / *before a big change, read the decisions in* [docs/adr/](docs/adr/).

**Conducta / Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Evita dependencias nuevas si se puede. / *Avoid new dependencies when possible.*

**Vulnerabilidades / Vulnerabilities:** no abras un issue público; sigue [SECURITY.md](SECURITY.md).
/ *Don't open a public issue; follow [SECURITY.md](SECURITY.md).*
