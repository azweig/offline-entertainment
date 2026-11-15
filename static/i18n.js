// Idiomas de la app: espanol (fuente), ingles, portugues, chino, ruso y japones.
// El texto de la app y del servidor se escribe en espanol; aqui se traduce lo que aparece en pantalla
// (nodos de texto y placeholder/aria-label/title), los alert/confirm y el titulo de la pagina.
// Las claves son el texto en espanol; {0}, {1}... marcan partes que cambian (numeros, nombres).
// Lo que no esta en el diccionario se queda en espanol: scripts/i18n-check lo detecta.
(() => {
  const LANGS = {es: 'Español', en: 'English', pt: 'Português', zh: '中文', ru: 'Русский', ja: '日本語'};
  const D = window.I18N_DICT || {};
  const pick = () => {
    try { const s = localStorage.getItem('vlang'); if (LANGS[s]) return s; } catch {}
    for (const l of navigator.languages || [navigator.language || 'es']) { const k = String(l).slice(0, 2).toLowerCase(); if (LANGS[k]) return k; }
    return 'es';
  };
  const lang = pick(), dict = D[lang] || {};
  document.documentElement.lang = lang;
  // claves con {n}: se vuelven expresiones regulares (los {n} aceptan cualquier texto)
  const pats = [];
  for (const k of Object.keys(dict)) if (/\{\d\}/.test(k)) {
    const re = new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, '(?<g$1>[\\s\\S]+?)') + '$');
    pats.push([re, dict[k]]);
  }
  pats.sort((a, b) => b[0].source.length - a[0].source.length);   // la mas especifica primero
  const one = s => {
    if (Object.prototype.hasOwnProperty.call(dict, s)) return dict[s];
    for (const [re, out] of pats) { const m = s.match(re); if (m && !Object.values(m.groups).some(v => / · | — /.test(v))) return out.replace(/\{(\d)\}/g, (_, n) => { const v = m.groups['g' + n] ?? ''; return dict[v] ?? v; }); }
    return null;
  };
  // "Spotify · Pitbull · 18 canciones": se traduce cada parte que se conozca
  const tr = s => {
    if (lang === 'es' || !s) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
    if (!core) return s;
    let r = one(core);
    if (r == null){ const m = core.match(/^([·•]\s+)([\s\S]+)$/); if (m){ const x = tr(m[2]); if (x !== m[2]) r = m[1] + x.trim(); } }   // "· hace 2 días"
    if (r == null) for (const sep of [' · ', ' — ', ' | ']) if (core.includes(sep)) {
      const parts = core.split(sep), out = parts.map(p => one(p.trim()) ?? p);
      if (out.some((p, i) => p !== parts[i])) { r = out.join(sep); break; }
    }
    return r == null ? s : lead + r + trail;
  };
  window.t = tr;
  window.I18N = {lang, LANGS, set(l){ try { localStorage.setItem('vlang', l); } catch {} location.reload(); }};
  // selector de idioma: cualquier boton con data-lang-pick lo abre
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-lang-pick]')) return;
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:70;background:#000c;display:grid;place-items:center;padding:16px';
    o.innerHTML = `<div role="dialog" aria-label="Idioma" style="background:#14181f;border:1px solid #333;border-radius:12px;padding:10px;min-width:220px;font:16px system-ui,sans-serif">${
      Object.entries(LANGS).map(([k, v]) => `<button data-l="${k}" style="display:block;width:100%;text-align:left;padding:12px 14px;margin:2px 0;border:none;border-radius:8px;font:inherit;cursor:pointer;background:${k === lang ? '#f2a33a' : 'transparent'};color:${k === lang ? '#111' : '#ddd'}">${v}</button>`).join('')}</div>`;
    o.addEventListener('click', ev => { const b = ev.target.closest('[data-l]'); if (b){ if (b.dataset.l !== lang) window.I18N.set(b.dataset.l); else o.remove(); } else if (ev.target === o) o.remove(); });
    document.body.append(o);
  });
  if (lang === 'es') return;
  const SKIP = 'script,style,textarea,[data-noi18n],.ti';   // titulos de videos y canciones: no se traducen
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  const fixText = n => { const p = n.parentElement; if (!p || p.closest(SKIP)) return; const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; };
  const fixAttrs = el => { if (el.closest(SKIP)) return; for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const x = tr(v); if (x !== v) el.setAttribute(a, x); } }
    if (el.tagName === 'INPUT' && /^(button|submit)$/i.test(el.type) && el.value) el.value = tr(el.value); };
  const walk = root => {
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1) return;
    fixAttrs(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = it.nextNode(); n; n = it.nextNode()) n.nodeType === 3 ? fixText(n) : fixAttrs(n);
  };
  new MutationObserver(ms => { for (const m of ms) {
    if (m.type === 'childList') m.addedNodes.forEach(walk);
    else if (m.type === 'characterData') fixText(m.target);
    else if (m.type === 'attributes' && m.target.nodeType === 1) fixAttrs(m.target);
  } }).observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});
  const A = window.alert.bind(window), C = window.confirm.bind(window), P = window.prompt.bind(window);
  window.alert = m => A(tr(String(m)));
  window.confirm = m => C(tr(String(m)));
  window.prompt = (m, d) => P(tr(String(m)), d);
  document.addEventListener('DOMContentLoaded', () => { walk(document.body); document.title = tr(document.title); });
})();
