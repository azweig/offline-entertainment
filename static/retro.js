// "Escucha como en los 90": un reproductor con la forma de los reproductores de escritorio clasicos
// (ventana principal, ecualizador y lista), flotando sobre la app: se arrastra, se pega a las otras
// ventanas, se achica (modo barra) o se minimiza a un icono, y la musica sigue sonando.
// Se dibuja con skins clasicos .wsz (formato Winamp 2):
//  - el catalogo del Winamp Skin Museum que arma el servidor (skins_index.py): se busca por nombre o
//    categoria y el archivo se pide al servidor recien al elegirlo (sin +18);
//  - o un .wsz que subes tu.
// Cada skin elegido queda guardado en este dispositivo (sirve sin internet). Por defecto, el clasico (base 2.91).
// Usa el MISMO <audio> de la app: sigue sonando con la pantalla bloqueada. El ecualizador cambia el sonido
// solo en la compu: en el celular se ve y se mueve, pero el audio no pasa por Web Audio (si no, iOS lo corta).
(() => {
  const DEFAULT = '5e4f10275dcb1fb211d4a8b4f1bda236';
  const LS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const LSset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const T = s => (window.t || String)(s);
  const fine = matchMedia('(pointer:fine)').matches;
  // pedidos al servidor con la clave de la app (la version open source la exige en todo /api)
  const get = p => typeof api === 'function' ? api(p) : fetch(p);
  // capturas: se piden con la clave a medida que aparecen en pantalla
  const shots = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting){ const i = e.target; shots.unobserve(i);
    get(i.dataset.src).then(r => r.ok ? r.blob() : null).then(b => { if (b) i.src = URL.createObjectURL(b); }).catch(() => {}); } }, {rootMargin: '300px'});
  let on = LS('vretro2', true), sel = LS('vskin2', 'wsz:' + DEFAULT), W = LS('vwin', null), EQ = LS('veq', {on: true, pre: 50, b: Array(10).fill(50)});
  let skin = null, audio = null, ctx = null, an = null, filters = null, pre = null, root, hidden = LS('vwinmin', false);

  // ---------- leer un .wsz (zip) en el navegador
  const NEED = ['main.bmp', 'titlebar.bmp', 'cbuttons.bmp', 'numbers.bmp', 'nums_ex.bmp', 'playpaus.bmp', 'monoster.bmp', 'posbar.bmp',
    'volume.bmp', 'balance.bmp', 'shufrep.bmp', 'text.bmp', 'eqmain.bmp', 'pledit.bmp', 'viscolor.txt', 'pledit.txt'];
  async function inflate(data){
    const r = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = []; let n = 0;
    for (;;){ const {value, done} = await r.read(); if (done) break; n += value.length; if (n > 4e6) throw new Error('grande'); parts.push(value); }
    return new Uint8Array(await new Blob(parts).arrayBuffer());
  }
  async function unzip(buf){
    const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50){ e = i; break; }
    if (e < 0) throw new Error('zip');
    const n = dv.getUint16(e + 10, true), out = {}; let p = dv.getUint32(e + 16, true);
    for (let k = 0; k < n && p + 46 <= buf.byteLength; k++){
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true),
        xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      const base = name.split(/[\\/]/).pop().toLowerCase();
      if (!NEED.includes(base) || out[base] || lo + 30 > buf.byteLength) continue;
      const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = u8.subarray(start, start + csize);
      try { out[base] = method === 0 ? data : method === 8 ? await inflate(data) : null; } catch { out[base] = null; }
    }
    return out;
  }
  const loadImg = url => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  async function parseSkin(buf){
    const f = await unzip(buf);
    if (!f['main.bmp'] || !f['cbuttons.bmp']) throw new Error('Ese archivo no parece un skin clásico (.wsz).');
    const img = {}, el = {};
    for (const [k, v] of Object.entries(f)) if (v && k.endsWith('.bmp')) img[k.slice(0, -4)] = URL.createObjectURL(new Blob([v], {type: 'image/bmp'}));
    for (const k of ['text', 'main', 'eqmain']) if (img[k]) try { el[k] = await loadImg(img[k]); } catch {}
    if (!el.main) throw new Error('Ese archivo no parece un skin clásico (.wsz).');
    const txt = k => f[k] ? new TextDecoder('latin1').decode(f[k]) : '';
    const vis = [...txt('viscolor.txt').matchAll(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)].slice(0, 24).map(m => `rgb(${m[1]},${m[2]},${m[3]})`);
    const pl = {}; for (const m of txt('pledit.txt').matchAll(/^\s*(Normal|Current|NormalBG|SelectedBG)\s*=\s*#?([0-9a-f]{6})/gim)) pl[m[1].toLowerCase()] = '#' + m[2];
    let eqc = null; if (el.eqmain) try { const c = document.createElement('canvas'); c.width = 1; c.height = 19; const x = c.getContext('2d'); x.drawImage(el.eqmain, 115, 294, 1, 19, 0, 0, 1, 19);
      const d = x.getImageData(0, 0, 1, 19).data; eqc = Array.from({length: 19}, (_, i) => `rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})`); } catch {}
    return {img, el, vis: vis.length >= 18 ? vis : null, pl, eqc};
  }
  // los skins elegidos/subidos se guardan en el almacenamiento de la app (archivo oculto); la lista, en localStorage
  const mine = () => LS('vskins2', []);
  const fileOf = id => `.skin-${id}.wsz`;
  const ready = () => typeof store !== 'undefined' && (store.root || store.db);
  async function haveLocal(id){ try { await store.blob(fileOf(id)); return true; } catch { return false; } }
  async function saveLocal(id, name, buf){ await store.putBlob(fileOf(id), new Blob([buf])); const l = mine().filter(s => s.id !== id); l.unshift({id, name}); LSset('vskins2', l.slice(0, 300)); }
  async function getSkin(id, name){
    if (await haveLocal(id)) return (await store.blob(fileOf(id))).arrayBuffer();
    if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('Ese skin ya no está en este dispositivo.');
    const r = await get(`api/skins/${id}.wsz`); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo bajar el skin.');
    const buf = await r.arrayBuffer(); await saveLocal(id, name || id, buf); return buf;
  }
  async function choose(key, name){
    const id = key.replace(/^wsz:/, '');
    skin = await parseSkin(await getSkin(id, name)); sel = 'wsz:' + id; LSset('vskin2', sel);
    paintAll(); return true;
  }

  // ---------- estilos
  const css = `
  #wa{position:fixed;inset:0;pointer-events:none;z-index:40}
  #wa .win{position:absolute;pointer-events:auto;transform-origin:0 0;image-rendering:pixelated;user-select:none;-webkit-user-select:none;
    touch-action:none;background-repeat:no-repeat;box-shadow:0 4px 18px #0009;font:8px/1 ui-monospace,monospace;overflow:hidden}
  #wa .win>*{position:absolute;background-repeat:no-repeat;box-sizing:border-box}
  #wa .win i{position:absolute;display:block;background-repeat:no-repeat}
  #wa .nosk{background:#2b2b38;outline:1px solid #555}
  #wa .nosk .rbn{background:#4a4a5a;border:1px solid;border-color:#888 #111 #111 #888;color:#ddd;font-size:9px;line-height:15px;text-align:center}
  #wa .nosk .dg{color:#0f0;font:700 12px/13px ui-monospace,monospace;text-align:center;background:#000}
  #wa .plrows{overflow:hidden;font:9px/13px Arial,Helvetica,sans-serif}
  #wa .plrows div{height:13px;white-space:nowrap;padding:0 3px;cursor:pointer;display:flex;gap:4px}
  #wa .plrows div b{font-weight:400;flex:1;overflow:hidden;text-overflow:ellipsis}
  #wa .plrows div span{flex:none}
  #wa .rht{cursor:pointer}
  #wa-min{position:fixed;z-index:41;right:14px;bottom:84px;width:46px;height:46px;border-radius:50%;border:1px solid #555;background:#1b1f27;color:#fff;font-size:22px;
    box-shadow:0 4px 14px #0009;display:none;cursor:pointer}
  body.retro.wa-hide #wa-min{display:block}
  body.retro:not(.wa-hide) #player.raud{display:none!important}
  .rskins{position:fixed;inset:0;z-index:60;background:#000c;display:grid;grid-template-columns:minmax(0,1fr);place-items:center;padding:10px}
  .rskins>div{box-sizing:border-box;min-width:0;background:#14181f;border:1px solid #333;border-radius:10px;padding:14px;max-width:900px;width:100%;height:min(92vh,900px);display:flex;flex-direction:column;color:#ddd;font:14px system-ui,sans-serif}
  .rskins h3{margin:0;font-size:16px;display:flex;justify-content:space-between;align-items:center}
  .rskins h3 button{background:none;border:none;color:#aaa;font-size:20px;cursor:pointer}
  .rskins p{margin:4px 0 8px;color:#999;font-size:12px;line-height:1.4}
  .rskins input[type=search]{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #333;background:#0b0e13;color:#eee;font:inherit;box-sizing:border-box}
  .rchips{display:flex;gap:6px;overflow-x:auto;padding:8px 0;flex:none}
  .rchips button,.rup{flex:none;padding:6px 10px;border-radius:99px;border:1px solid #333;background:#1b2028;color:#ccc;font:12px system-ui;cursor:pointer;white-space:nowrap}
  .rup{border-style:dashed;border-color:#777;color:#eee}
  .rchips button.on{background:#f2a33a;border-color:#f2a33a;color:#111;font-weight:700}
  .rlist{flex:1;overflow:auto}
  .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
  .rgrid .card{position:relative;cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid transparent;background:#0b0e13}
  .rgrid .card.on{border-color:#f2a33a}
  .rgrid img{display:block;width:100%;aspect-ratio:275/116;object-fit:cover;object-position:top;image-rendering:pixelated;background:#222}
  .rgrid span{display:block;padding:5px 7px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rgrid .del{position:absolute;right:4px;top:4px;background:#000b;border:none;color:#fff;border-radius:6px;font-size:12px;padding:2px 6px;cursor:pointer}
  .rgrid .busy{opacity:.5}
  .rmore{display:block;margin:10px auto;padding:9px 16px;border-radius:8px;border:1px solid #444;background:#1b2028;color:#ddd;font:inherit;cursor:pointer}
  .rerr{color:#ff8a80;font-size:13px;margin:4px 0}
  .rconf{position:fixed;inset:0;z-index:80;background:#000c;display:grid;place-items:center;padding:16px}
  .rconf>div{background:#14181f;border:1px solid #333;border-radius:10px;padding:16px;max-width:340px;color:#ddd;font:14px system-ui,sans-serif}
  .rconf .row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
  .rconf button{padding:9px 14px;border-radius:8px;border:1px solid #555;background:transparent;color:#ddd;font:inherit;cursor:pointer}
  .rconf .danger{background:#d32f2f;border-color:#d32f2f;color:#fff;font-weight:700}
  `;

  // ---------- ventanas: estado y posiciones (en pixeles de pantalla)
  const SC = () => W.dbl ? 2 : (fine ? 1 : Math.max(1, Math.min(1.4, Math.floor((innerWidth - 8) / 275 * 20) / 20)));
  const PLH = () => W.plh || (fine ? 232 : 145);
  const H = k => (k === 'main' && W.main.shade ? 14 : k === 'pl' ? PLH() : 116) * SC();
  const vis = k => k === 'main' || W[k].open;
  function defaults(){
    W = {dbl: false, plh: 0, main: {x: 0, y: 0, shade: false}, eq: {x: 0, y: 0, open: true}, pl: {x: 0, y: 0, open: true}};
    stack();
  }
  function stack(){   // las tres pegadas, abajo (celular: centradas; compu: a la derecha)
    const s = SC(), w = 275 * s, x = fine ? innerWidth - w - 24 : Math.round((innerWidth - w) / 2);
    const tot = H('main') + (W.eq.open ? H('eq') : 0) + (W.pl.open ? H('pl') : 0);
    let y = Math.max(64, innerHeight - tot - (fine ? 24 : 10));
    for (const k of ['main', 'eq', 'pl']) if (vis(k)){ W[k].x = x; W[k].y = y; y += H(k); }
  }
  if (!W) defaults();
  const saveW = () => LSset('vwin', W);

  // ---------- construir
  const FONT = {};
  'abcdefghijklmnopqrstuvwxyz"@'.split('').forEach((c, i) => { FONT[c] = [i * 5, 0]; });
  FONT[' '] = [150, 0];
  '0123456789….:()-\'!_+\\/[]^&%,=$#'.split('').forEach((c, i) => { FONT[c] = [i * 5, 6]; });
  'åöä?*'.split('').forEach((c, i) => { FONT[c] = [i * 5, 12]; });
  const fold = c => { c = c.toLowerCase(); if (FONT[c]) return c; const n = c.normalize('NFD').replace(/[̀-ͯ]/g, ''); return FONT[n] ? n : ' '; };
  const box = (k, x, y, w, h, cls = '', inner = '', label = '') =>
    `<div data-k="${k}" class="${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"${label ? ` role="button" tabindex="0" aria-label="${esc(label)}"` : ''}>${inner}</div>`;
  const cv = (w, h) => `<canvas width="${w}" height="${h}" style="width:${w}px;height:${h}px;display:block"></canvas>`;
  let wins = {}, minBtn;
  function build(){
    if (root) return;
    root = document.createElement('div'); root.id = 'wa'; document.body.append(root);
    const main = document.createElement('div'); main.className = 'win'; main.dataset.w = 'main';
    main.innerHTML = [
      box('tb', 0, 0, 275, 14, 'drag'), box('opt', 6, 3, 9, 9, 'rht', '', 'Cambiar skin'), box('min', 244, 3, 9, 9, 'rht', '', 'Minimizar'),
      box('shade', 254, 3, 9, 9, 'rht', '', 'Achicar'), box('close', 264, 3, 9, 9, 'rht', '', 'Volver al reproductor normal'),
      box('clut', 10, 22, 8, 43), box('cO', 10, 25, 8, 8, 'rht', '', 'Cambiar skin'), box('cD', 10, 47, 8, 8, 'rht', '', 'Tamaño doble'),
      box('ps', 26, 28, 9, 9), box('d0', 48, 26, 9, 13, 'dg'), box('d1', 60, 26, 9, 13, 'dg'), box('d2', 78, 26, 9, 13, 'dg'), box('d3', 90, 26, 9, 13, 'dg'),
      box('vis', 24, 43, 76, 16, '', cv(76, 16)), box('marq', 111, 24, 154, 6, '', cv(154, 6)),
      box('kbps', 111, 43, 15, 6, '', cv(15, 6)), box('khz', 156, 43, 10, 6, '', cv(10, 6)),
      box('mono', 212, 41, 27, 12), box('st', 239, 41, 29, 12),
      box('vol', 107, 57, 68, 13, 'rht', '<i class="th"></i>', 'Volumen'), box('bal', 177, 57, 38, 13, '', '<i class="th"></i>'),
      box('eqb', 219, 58, 23, 12, 'rht', '', 'Ecualizador'), box('plb', 242, 58, 23, 12, 'rht', '', 'Lista'),
      box('pos', 16, 72, 248, 10, 'rht', '<i class="th"></i>', 'Posición en la canción'),
      box('prev', 16, 88, 23, 18, 'rht rbn', '⏮', 'Anterior'), box('play', 39, 88, 23, 18, 'rht rbn', '▶', 'Reproducir'),
      box('pause', 62, 88, 23, 18, 'rht rbn', '⏸', 'Pausa'), box('stop', 85, 88, 23, 18, 'rht rbn', '■', 'Detener'),
      box('next', 108, 88, 22, 18, 'rht rbn', '⏭', 'Siguiente'), box('eject', 136, 89, 22, 16, 'rht rbn', '⏏', 'Cambiar skin'),
      box('shuf', 164, 89, 47, 15, 'rht rbn', 'S', 'Aleatorio'), box('rep', 210, 89, 28, 15, 'rht rbn', 'R', 'Repetir'),
      box('sh-time', 127, 4, 25, 6, '', cv(25, 6)), box('sh-prev', 169, 2, 7, 10, 'rht', '', 'Anterior'), box('sh-play', 176, 2, 10, 10, 'rht', '', 'Reproducir'),
      box('sh-pause', 186, 2, 9, 10, 'rht', '', 'Pausa'), box('sh-stop', 195, 2, 9, 10, 'rht', '', 'Detener'), box('sh-next', 204, 2, 10, 10, 'rht', '', 'Siguiente'),
    ].join('');
    const eq = document.createElement('div'); eq.className = 'win'; eq.dataset.w = 'eq';
    const bands = [78, 96, 114, 132, 150, 168, 186, 204, 222, 240], hz = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
    eq.innerHTML = [
      box('etb', 0, 0, 275, 14, 'drag'), box('eclose', 264, 3, 9, 9, 'rht', '', 'Cerrar'),
      box('eon', 14, 18, 26, 12, 'rht', '', 'Encender ecualizador'), box('eauto', 40, 18, 32, 12),
      box('egraph', 86, 17, 113, 19, '', cv(113, 19)), box('epre', 217, 18, 44, 12, 'rht', '', 'Restablecer'),
      box('s-pre', 21, 38, 14, 63, 'rht', '<i class="th"></i>', 'Preamplificador'),
      ...bands.map((x, i) => box('s-' + i, x, 38, 14, 63, 'rht', '<i class="th"></i>', hz[i] + ' Hz')),
    ].join('');
    const pl = document.createElement('div'); pl.className = 'win'; pl.dataset.w = 'pl';
    pl.innerHTML = `<div data-k="ptop" class="drag" style="left:0;top:0;width:275px;height:20px"></div>
      <div data-k="pleft" style="left:0;top:20px;width:12px"></div><div data-k="pright" style="left:255px;top:20px;width:20px"></div>
      <div data-k="prows" class="plrows" style="left:12px;top:20px;width:243px"></div>
      <div data-k="pthumb" style="left:260px;width:8px;height:18px"></div>
      <div data-k="pbl" style="left:0;width:125px;height:38px"></div><div data-k="pbr" style="left:125px;width:150px;height:38px"></div>
      ${box('pclose', 264, 3, 9, 9, 'rht', '', 'Cerrar')}
      <div data-k="padd" class="rht" role="button" aria-label="Buscar más canciones" style="left:14px;width:22px;height:18px"></div>
      <div data-k="pmisc" class="rht" role="button" aria-label="Cambiar skin" style="left:101px;width:22px;height:18px"></div>
      <div data-k="plist" class="rht" role="button" aria-label="Ver lista de canciones" style="left:231px;width:22px;height:18px"></div>
      <div data-k="pres" class="rht" style="left:255px;width:20px;height:20px;cursor:ns-resize"></div>`;
    root.append(main, eq, pl); wins = {main, eq, pl};
    minBtn = document.createElement('button'); minBtn.id = 'wa-min'; minBtn.textContent = '📼'; minBtn.setAttribute('aria-label', 'Abrir el reproductor de los 90');
    minBtn.onclick = () => { hidden = false; LSset('vwinmin', false); apply(); };
    document.body.append(minBtn);
    for (const w of Object.values(wins)) wire_(w);
    addEventListener('resize', () => { clampAll(); place(); });
  }

  // ---------- arrastrar, pegar y achicar
  const rect = k => ({x: W[k].x, y: W[k].y, w: 275 * SC(), h: H(k)});
  const near = (a, b) => Math.abs(a - b) <= 2;
  function glued(k){   // ventanas pegadas (en cadena) a una
    const out = new Set([k]); let grew = true;
    while (grew){ grew = false; for (const o of ['main', 'eq', 'pl']) if (!out.has(o) && vis(o)) for (const g of out){
      const a = rect(g), b = rect(o);
      const tv = (near(a.y + a.h, b.y) || near(b.y + b.h, a.y)) && a.x < b.x + b.w && b.x < a.x + a.w;
      const th = (near(a.x + a.w, b.x) || near(b.x + b.w, a.x)) && a.y < b.y + b.h && b.y < a.y + a.h;
      if (tv || th){ out.add(o); grew = true; break; } } }
    return out;
  }
  function snap(k){
    const a = rect(k), D = 12;
    for (const o of ['main', 'eq', 'pl']) if (o !== k && vis(o)){ const b = rect(o), ax = Math.abs(a.x - b.x) < D;
      if (Math.abs(a.y - (b.y + b.h)) < D && Math.abs(a.x - b.x) < 60){ W[k].y = b.y + b.h; if (ax) W[k].x = b.x; }
      else if (Math.abs(a.y + a.h - b.y) < D && Math.abs(a.x - b.x) < 60){ W[k].y = b.y - a.h; if (ax) W[k].x = b.x; }
      else if (Math.abs(a.x - (b.x + b.w)) < D && Math.abs(a.y - b.y) < 60){ W[k].x = b.x + b.w; if (Math.abs(a.y - b.y) < D) W[k].y = b.y; }
      else if (Math.abs(a.x + a.w - b.x) < D && Math.abs(a.y - b.y) < 60){ W[k].x = b.x - a.w; if (Math.abs(a.y - b.y) < D) W[k].y = b.y; } }
    if (Math.abs(W[k].x) < D) W[k].x = 0;
    if (Math.abs(W[k].x + a.w - innerWidth) < D) W[k].x = innerWidth - a.w;
  }
  function clampAll(){ for (const k of ['main', 'eq', 'pl']){ const r = rect(k);
    W[k].x = Math.max(60 - r.w, Math.min(innerWidth - 60, W[k].x)); W[k].y = Math.max(0, Math.min(innerHeight - 14 * SC(), W[k].y)); } }
  function resizeKeepingGlue(fn){   // cambia un tamano y reacomoda lo que estaba pegado debajo
    const g = [...glued('main')].sort((a, b) => W[a].y - W[b].y);
    fn();
    let y = W.main.y; for (const k of g){ if (k !== 'main'){ W[k].x = W.main.x; W[k].y = y; } y += H(k); }
    clampAll(); saveW(); place(); paintAll();
  }
  function wire_(w){
    const k = w.dataset.w; let drag = null, down = '', resz = null;
    const cap = e => { try { w.setPointerCapture(e.pointerId); } catch {} };
    w.addEventListener('pointerdown', e => {
      const p = e.target.closest('[data-k]'); if (!p) return;
      if (p.dataset.k === 'pres'){ cap(e); resz = {y: e.clientY, h: PLH()}; return; }
      if (p.classList.contains('drag') || (k === 'main' && W.main.shade && !p.classList.contains('rht'))){
        cap(e); const grp = k === 'main' ? [...glued('main')] : [k];
        drag = {x: e.clientX, y: e.clientY, moved: false, start: grp.map(g => ({g, x: W[g].x, y: W[g].y}))}; return; }
      if (!p.classList.contains('rht')) return;
      cap(e); down = p.dataset.k; slide(e);
    });
    w.addEventListener('pointermove', e => {
      if (resz){ W.plh = Math.max(116, Math.min(580, 58 + Math.round((resz.h - 58 + (e.clientY - resz.y) / SC()) / 29) * 29)); place(); paintPL(); return; }
      if (drag){ const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        for (const s of drag.start){ W[s.g].x = s.x + dx; W[s.g].y = s.y + dy; } place(); return; }
      if (down) slide(e);
    });
    w.addEventListener('pointerup', e => {
      if (resz){ resz = null; saveW(); return; }
      if (drag){ const d = drag; drag = null; if (!d.moved) return;
        const bx = W[k].x, by = W[k].y; snap(k); const dx = W[k].x - bx, dy = W[k].y - by;
        for (const s of d.start) if (s.g !== k){ W[s.g].x += dx; W[s.g].y += dy; }
        clampAll(); saveW(); place(); return; }
      const k2 = down; down = ''; if (!k2) return;
      if (/^s-/.test(k2)){ LSset('veq', EQ); return; }
      const p = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-k]');
      if (p && p.dataset.k === k2 && !/^(vol|pos)$/.test(k2)) act(k2);
    });
    w.addEventListener('pointercancel', () => { drag = null; down = ''; resz = null; });
    w.addEventListener('dblclick', e => { if (e.target.closest('.drag') && k === 'main') resizeKeepingGlue(() => { W.main.shade = !W.main.shade; }); });
    w.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.k){ e.preventDefault(); act(e.target.dataset.k); } });
    w.addEventListener('click', e => { const r = e.target.closest('.plrows > div'); if (r) playRow(+r.dataset.i); });
    w.addEventListener('wheel', e => { if (k === 'pl'){ e.preventDefault(); w._top = Math.max(0, (w._top || 0) + Math.sign(e.deltaY) * 2); w._manual = true; paintPL(); } }, {passive: false});
    function slide(e){
      if (!/^(vol|pos|s-)/.test(down)) return;
      const p = w.querySelector(`[data-k="${down}"]`), r = p.getBoundingClientRect(), a = audio;
      if (down === 'vol'){ if (a) a.volume = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); }
      else if (down === 'pos'){ if (a && a.duration) a.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * a.duration; }
      else { const v = Math.round(100 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 100);
        if (down === 's-pre') EQ.pre = v; else EQ.b[+down.slice(2)] = v; applyEQ(); paintEQ(); }
      paintMain();
    }
  }
  function act(k){
    const a = audio, click = id => document.getElementById(id)?.click();
    switch (k){
      case 'opt': case 'cO': case 'eject': case 'pmisc': return browser();
      case 'min': hidden = true; LSset('vwinmin', true); return apply();
      case 'shade': return resizeKeepingGlue(() => { W.main.shade = !W.main.shade; });
      case 'close': return set(false);
      case 'cD': return resizeKeepingGlue(() => { W.dbl = !W.dbl; });
      case 'eqb': case 'eclose': W.eq.open = !W.eq.open; if (W.eq.open) resizeKeepingGlue(() => {}); saveW(); return apply();
      case 'plb': case 'pclose': W.pl.open = !W.pl.open; if (W.pl.open) resizeKeepingGlue(() => {}); saveW(); return apply();
      case 'eon': EQ.on = !EQ.on; LSset('veq', EQ); applyEQ(); return paintEQ();
      case 'epre': EQ.pre = 50; EQ.b = Array(10).fill(50); LSset('veq', EQ); applyEQ(); return paintEQ();
      case 'padd': hidden = true; LSset('vwinmin', true); apply(); try { $q(); } catch {} return;
      case 'plist': try { libFilter = 'audio'; go('descargas'); } catch {} return;
      case 'prev': case 'sh-prev': return click('pprev');
      case 'next': case 'sh-next': return click('pnext');
      case 'shuf': click('pshuf'); return paintMain();
      case 'rep': click('prep'); return paintMain();
      case 'play': case 'sh-play': if (a){ wire(); a.play().catch(() => {}); } else { try { playAll(); } catch {} } return;
      case 'pause': case 'sh-pause': if (a) a.paused ? a.play().catch(() => {}) : a.pause(); return;
      case 'stop': case 'sh-stop': if (a){ a.pause(); a.currentTime = 0; } return paintMain();
    }
  }
  const $q = () => { const q = document.getElementById('q'); if (q){ q.focus(); q.scrollIntoView({block: 'center'}); } };

  // ---------- la lista
  let plItems = [], plSel = -1;
  const durs = LS('vdur', {});
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function listNow(){
    try { if (typeof queue !== 'undefined' && queue.length) return queue.map(n => library.find(i => i.name === n)).filter(Boolean); } catch {}
    try { return music('audio'); } catch { return []; }
  }
  function playRow(i){
    if (fine && plSel !== i){ plSel = i; return paintPL(); }   // compu: clic marca, doble clic toca; celular: un toque toca
    plSel = i; const it = plItems[i]; if (!it) return;
    try { buildQueue(it.name, 'audio'); playErr = 0; playAudio(queue[qi]); } catch {}
  }
  function paintPL(){
    const w = wins.pl; if (!w || !W.pl.open) return;
    const h = PLH(), mid = h - 58, pl = skin?.pl || {}, I = skin?.img.pledit;
    const $ = k => w.querySelector(`[data-k="${k}"]`);
    $('pleft').style.height = $('pright').style.height = $('prows').style.height = mid + 'px';
    for (const k of ['pbl', 'pbr']) $(k).style.top = h - 38 + 'px';
    for (const k of ['padd', 'pmisc', 'plist']) $(k).style.top = h - 30 + 'px';
    $('pres').style.top = h - 20 + 'px';
    $('prows').style.background = pl.normalbg || '#000';
    plItems = listNow();
    const cur = typeof current !== 'undefined' ? current : null, n = Math.max(1, Math.floor(mid / 13)), ci = plItems.findIndex(i => i.name === cur);
    let top = w._top || 0; if (!w._manual && ci >= 0 && (ci < top || ci >= top + n)) top = Math.max(0, ci - 1);
    top = Math.max(0, Math.min(top, plItems.length - n)); w._top = top;
    $('prows').innerHTML = plItems.slice(top, top + n).map((it, j) => { const i = top + j;
      return `<div data-i="${i}" data-noi18n style="color:${it.name === cur ? (pl.current || '#fff') : (pl.normal || '#0f0')};background:${i === plSel ? (pl.selectedbg || '#0000c6') : 'transparent'}"><b>${i + 1}. ${esc(it.title)}</b><span>${durs[it.name] ? fmt(durs[it.name]) : ''}</span></div>`; }).join('');
    const span = mid - 18 - 4;
    $('pthumb').style.top = 22 + Math.round(plItems.length > n ? top / (plItems.length - n) * span : 0) + 'px';
    if (I){
      const S = (k, x, y, rep = 'no-repeat') => { $(k).style.background = `url("${I}") ${-x}px ${-y}px ${rep}`; };
      // las piezas que se repiten se arman con copias sueltas (repetir el fondo repetiria toda la hoja)
      const piece = (l, t, w, hh, x, y) => `<i style="left:${l}px;top:${t}px;width:${w}px;height:${hh}px;background:url('${I}') ${-x}px ${-y}px"></i>`;
      $('ptop').style.background = 'none';
      $('ptop').innerHTML = piece(0, 0, 25, 20, 0, 0) + [25, 50, 75, 187, 212, 237].map(l => piece(l, 0, Math.min(25, 250 - l), 20, 127, 0)).join('')
        + piece(87, 0, 100, 20, 26, 0) + piece(250, 0, 25, 20, 153, 0);
      for (const [k, w, x] of [['pleft', 12, 0], ['pright', 20, 31]]){ const e = $(k); e.style.background = 'none';
        e.innerHTML = Array.from({length: Math.ceil(mid / 29)}, (_, i) => piece(0, i * 29, w, Math.min(29, mid - i * 29), x, 42)).join(''); }
      S('pbl', 0, 72); S('pbr', 126, 72); S('pthumb', 52, 53);
    } else {
      for (const k of ['ptop', 'pleft', 'pright']) $(k).innerHTML = ''; for (const k of ['ptop', 'pleft', 'pright', 'pbl', 'pbr']) $(k).style.background = '#2b2b38';
      $('pthumb').style.background = '#777';
    }
    const tot = plItems.reduce((a, i) => a + (durs[i.name] || 0), 0), a = audio;
    putText(w, 'ptime', 125 + 7, h - 38 + 10, `${fmt(a?.currentTime)}/${fmt(tot)}`);
    putText(w, 'pmini', 125 + 66, h - 38 + 23, a ? fmt(a.currentTime) : '');
  }
  function putText(w, k, x, y, s){
    let c = w.querySelector(`canvas[data-t="${k}"]`);
    if (!c){ c = document.createElement('canvas'); c.dataset.t = k; c.height = 6; w.append(c); }
    c.style.cssText = `position:absolute;left:${x}px;top:${y}px;height:6px;width:${Math.max(5, s.length * 5)}px`; c.width = Math.max(5, s.length * 5);
    drawStr(c, s);
  }
  function drawStr(c, s){
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    if (skin?.el.text) [...s].forEach((ch, i) => { const [x, y] = FONT[fold(ch)]; g.drawImage(skin.el.text, x, y, 5, 6, i * 5, 0, 5, 6); });
    else { g.fillStyle = '#0f0'; g.font = '7px ui-monospace,monospace'; g.textBaseline = 'top'; g.fillText(s, 0, -1); }
  }

  // ---------- pintar
  function place(){
    if (!root) return;
    const s = SC();
    for (const [k, w] of Object.entries(wins)){
      w.style.display = vis(k) ? '' : 'none';
      w.style.transform = `scale(${s})`; w.style.left = Math.round(W[k].x) + 'px'; w.style.top = Math.round(W[k].y) + 'px';
      w.style.width = '275px'; w.style.height = H(k) / s + 'px';
    }
  }
  function apply(){
    document.body.classList.toggle('retro', on);
    document.body.classList.toggle('wa-hide', on && hidden);
    if (on) build();
    if (root) root.style.display = on && !hidden ? '' : 'none';
    document.querySelectorAll('[data-retro]').forEach(b => b.classList.toggle('on', on && !hidden));
    if (on && !hidden){ place(); paintAll(); loop(); }
  }
  let lastTitle = '', marqX = 0, marqT = 0, marq = '';
  function paintAll(){ if (!root || !on || hidden) return; paintMain(); if (W.eq.open) paintEQ(); if (W.pl.open) paintPL(); }
  function paintMain(){
    const w = wins.main, a = audio, playing = !!a && !a.paused, s = skin, I = s?.img || {}, sh = W.main.shade;
    const $ = k => w.querySelector(`[data-k="${k}"]`);
    w.classList.toggle('nosk', !s);
    const full = ['clut', 'cO', 'cD', 'ps', 'd0', 'd1', 'd2', 'd3', 'vis', 'marq', 'kbps', 'khz', 'mono', 'st', 'vol', 'bal', 'eqb', 'plb', 'pos', 'prev', 'play', 'pause', 'stop', 'next', 'eject', 'shuf', 'rep'];
    const small = ['sh-time', 'sh-prev', 'sh-play', 'sh-pause', 'sh-stop', 'sh-next'];
    full.forEach(k => { $(k).style.display = sh ? 'none' : ''; }); small.forEach(k => { $(k).style.display = sh ? '' : 'none'; });
    w.style.backgroundImage = s && !sh ? `url("${I.main}")` : '';
    const spr = (k, sheet, x, y) => { const e = $(k); if (!s || !I[sheet]){ e.style.backgroundImage = ''; return; } e.style.backgroundImage = `url("${I[sheet]}")`; e.style.backgroundPosition = `${-x}px ${-y}px`; };
    spr('tb', 'titlebar', 27, sh ? 29 : 0);
    spr('opt', 'titlebar', 0, 0); spr('min', 'titlebar', 9, 0); spr('shade', 'titlebar', 0, sh ? 27 : 18); spr('close', 'titlebar', 18, 0);
    if (!s){ $('tb').style.background = 'repeating-linear-gradient(0deg,#77779a 0 1px,#22222c 1px 3px)'; for (const k of ['opt', 'min', 'shade', 'close']) $(k).style.background = '#4a4a5a'; }
    else { $('tb').style.backgroundColor = ''; }
    if (sh){ drawStr($('sh-time').querySelector('canvas'), a ? fmt(a.currentTime).padStart(5, ' ') : ''); return; }
    spr('clut', 'titlebar', 304, 0); if (W.dbl) spr('cD', 'titlebar', 328, 70); else $('cD').style.backgroundImage = '';
    const t = Math.floor(a?.currentTime || 0), dg = [Math.floor(t / 600) % 10, Math.floor(t / 60) % 10, Math.floor(t % 60 / 10), t % 10];
    const num = I.nums_ex ? 'nums_ex' : 'numbers';
    ['d0', 'd1', 'd2', 'd3'].forEach((k, i) => { spr(k, num, dg[i] * 9, 0); $(k).textContent = s ? '' : dg[i]; });
    spr('ps', 'playpaus', playing ? 0 : a && a.currentTime > 0 ? 9 : 18, 0);
    spr('st', 'monoster', 0, a ? 0 : 12); spr('mono', 'monoster', 29, 12);
    const shuf = !!document.getElementById('pshuf')?.classList.contains('on'), rep = !!document.getElementById('prep')?.classList.contains('on');
    spr('shuf', 'shufrep', 28, shuf ? 30 : 0); spr('rep', 'shufrep', 0, rep ? 30 : 0);
    spr('eqb', 'shufrep', 0, W.eq.open ? 73 : 61); spr('plb', 'shufrep', 23, W.pl.open ? 73 : 61);
    for (const [k, x] of Object.entries({prev: 0, play: 23, pause: 46, stop: 69, next: 92})) spr(k, 'cbuttons', x, 0);
    spr('eject', 'cbuttons', 114, 0);
    w.querySelectorAll('.rbn').forEach(e => { e.style.color = s ? 'transparent' : ''; e.style.border = s ? '0' : ''; e.style.backgroundColor = s ? 'transparent' : ''; });
    const vol = a ? a.volume : 1, pos = a && a.duration ? a.currentTime / a.duration : 0;
    spr('vol', 'volume', 0, Math.round(vol * 27) * 15); spr('bal', 'balance', 9, 0); spr('pos', 'posbar', 0, 0);
    if (!s){ $('vol').style.background = '#111'; $('bal').style.background = '#111'; $('pos').style.background = '#111'; }
    const th = (k, css) => { $(k).querySelector('.th').style.cssText = css; };
    th('vol', `left:${Math.round(vol * 54)}px;top:1px;width:14px;height:11px;background:${I.volume ? `url("${I.volume}") -15px -422px` : '#999'}`);
    th('bal', `left:12px;top:1px;width:14px;height:11px;background:${I.balance ? `url("${I.balance}") -15px -422px` : '#999'}`);
    th('pos', a && a.duration ? `left:${Math.round(pos * 219)}px;top:0;width:29px;height:10px;background:${I.posbar ? `url("${I.posbar}") -248px 0` : '#999'}` : 'display:none');
    const title = (document.getElementById('now')?.textContent || '').trim(), key = title + '|' + Math.round(a?.duration || 0) + '|' + !!s;
    if (key !== lastTitle){ lastTitle = key; const n = typeof qi !== 'undefined' && qi >= 0 ? qi + 1 + '. ' : '';
      marq = a && title ? `${n}${title}${a.duration ? ` (${fmt(a.duration)})` : ''}` : document.title || 'winamp'; marqX = 0; }   // la letra del skin solo tiene letras latinas
    drawStr($('marq').querySelector('canvas'), (marq + '  ***  ' + marq).slice(Math.floor(marqX / 5)));
    let kb = ''; try { const it = library.find(i => i.name === current); if (it && a?.duration) kb = String(Math.min(999, Math.round(it.size * 8 / a.duration / 1000))); } catch {}
    drawStr($('kbps').querySelector('canvas'), kb.padStart(3, ' ')); drawStr($('khz').querySelector('canvas'), a ? '44' : '  ');
  }
  function paintEQ(){
    const w = wins.eq, s = skin, I = s?.img.eqmain;
    const $ = k => w.querySelector(`[data-k="${k}"]`);
    w.classList.toggle('nosk', !I);
    w.style.backgroundImage = I ? `url("${I}")` : '';
    const spr = (k, x, y) => { const e = $(k); if (!I){ e.style.background = '#4a4a5a'; return; } e.style.background = `url("${I}") ${-x}px ${-y}px no-repeat`; };
    spr('etb', 0, 134); spr('eclose', 0, 116); spr('eon', EQ.on ? 69 : 10, 119); spr('eauto', 36, 119); spr('epre', 224, 164);
    if (!I) $('etb').style.background = 'repeating-linear-gradient(0deg,#77779a 0 1px,#22222c 1px 3px)';
    const slider = (k, v) => { const n = Math.round(v / 100 * 27), e = $(k);
      e.style.background = I ? `url("${I}") ${-(13 + (n % 14) * 15)}px ${-(164 + Math.floor(n / 14) * 65)}px no-repeat` : '#111';
      e.querySelector('.th').style.cssText = `left:1px;top:${Math.round((100 - v) / 100 * 51)}px;width:11px;height:11px;background:${I ? `url("${I}") 0 -164px` : '#aaa'}`; };
    slider('s-pre', EQ.pre); EQ.b.forEach((v, i) => slider('s-' + i, v));
    const c = $('egraph').querySelector('canvas'), g = c.getContext('2d');
    g.clearRect(0, 0, 113, 19);
    if (s?.el.eqmain) g.drawImage(s.el.eqmain, 0, 294, 113, 19, 0, 0, 113, 19);
    const ys = EQ.b.map(v => Math.round((100 - v) / 100 * 18));
    for (let x = 0; x < 113; x++){ const f = x / 112 * 9, i = Math.floor(f), t = f - i, y = Math.round(ys[i] * (1 - t) + ys[Math.min(9, i + 1)] * t);
      g.fillStyle = s?.eqc ? s.eqc[y] : '#ff0'; g.fillRect(x, y, 1, 1); }
  }

  // ---------- sonido: espectro y ecualizador reales solo en la compu
  const FREQ = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  function wire(){
    if (!fine || an || !audio || !window.AudioContext) return;
    try {
      ctx = ctx || new AudioContext();
      // si el navegador no dejo arrancar el audio todavia (sin un toque), no se conecta: si no, quedaria mudo
      if (ctx.state !== 'running'){ ctx.resume().then(() => { if (ctx.state === 'running') wire(); }).catch(() => {}); return; }
      const src = ctx.createMediaElementSource(audio);
      pre = ctx.createGain();
      filters = FREQ.map((f, i) => { const b = ctx.createBiquadFilter(); b.type = i === 0 ? 'lowshelf' : i === 9 ? 'highshelf' : 'peaking'; b.frequency.value = f; b.Q.value = 1.1; return b; });
      an = ctx.createAnalyser(); an.fftSize = 64; an.smoothingTimeConstant = 0.7;
      src.connect(pre); let n = pre; for (const b of filters){ n.connect(b); n = b; } n.connect(an); an.connect(ctx.destination);
      applyEQ();
    } catch { an = null; }
  }
  function applyEQ(){
    if (!filters) return;
    const db = v => (v - 50) / 50 * 12;
    pre.gain.value = EQ.on ? Math.pow(10, db(EQ.pre) / 20) : 1;
    filters.forEach((b, i) => { b.gain.value = EQ.on ? db(EQ.b[i]) : 0; });
  }
  let bars = new Array(19).fill(0), peaks = new Array(19).fill(0), raf = 0, lastSec = -1;
  function draw(ts){
    raf = 0;
    if (!on || hidden || !root || document.hidden) return;
    const a = audio;
    if (!W.main.shade){
      const c = wins.main.querySelector('[data-k="vis"] canvas').getContext('2d'), Wd = 76, Hh = 16, n = 19, playing = a && !a.paused;
      let data = null; if (an){ data = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(data); }
      for (let i = 0; i < n; i++){
        const v = data ? data[Math.min(data.length - 1, Math.floor(i * data.length / n))] / 255
          : playing ? Math.min(1, bars[i] * 0.72 + Math.random() * (0.55 - i * 0.012) + (i < 4 ? 0.15 : 0)) : bars[i] * 0.85;
        bars[i] = v; peaks[i] = Math.max(v, peaks[i] - 0.03);
      }
      const vs = skin?.vis; c.clearRect(0, 0, Wd, Hh);
      if (vs){ c.fillStyle = vs[0]; c.fillRect(0, 0, Wd, Hh); c.fillStyle = vs[1]; for (let y = 1; y < Hh; y += 2) for (let x = 1; x < Wd; x += 2) c.fillRect(x, y, 1, 1); }
      for (let i = 0; i < n; i++){ const h = Math.round(bars[i] * Hh), x = i * 4;
        for (let y = 0; y < h; y++){ c.fillStyle = vs ? vs[17 - Math.min(15, Math.round(y * 15 / (Hh - 1)))] : '#0f0'; c.fillRect(x, Hh - 1 - y, 3, 1); }
        c.fillStyle = vs ? (vs[23] || vs[2]) : '#ff0'; c.fillRect(x, Hh - 1 - Math.round(peaks[i] * (Hh - 1)), 3, 1); }
      if (ts - marqT > 170){ marqT = ts; marqX = (marqX + 5) % Math.max(5, (marq.length + 7) * 5); drawStr(wins.main.querySelector('[data-k="marq"] canvas'), (marq + '  ***  ' + marq).slice(Math.floor(marqX / 5))); }
    }
    const sec = Math.floor(a?.currentTime || 0); if (sec !== lastSec){ lastSec = sec; paintMain(); if (W.pl.open) paintPL(); }
    raf = requestAnimationFrame(draw);
  }
  const loop = () => { if (!raf && on && !hidden && !document.hidden) raf = requestAnimationFrame(draw); };
  function hook(){
    const a = document.querySelector('#slot audio');
    if (a && a !== audio){ audio = a; an = null; filters = null;
      ['play', 'pause', 'loadedmetadata', 'ended', 'volumechange', 'seeked'].forEach(ev => a.addEventListener(ev, () => {
        if (ev === 'loadedmetadata' && a.duration && typeof current !== 'undefined' && current){ durs[current] = a.duration; LSset('vdur', durs); }
        if (ev === 'play'){ wire(); loop(); } paintAll(); })); }
    if (!a) audio = null;
    document.getElementById('player')?.classList.toggle('raud', !!a);
    paintAll(); loop();
  }

  // ---------- buscador de skins
  function confirmDel(name, ok){
    const o = document.createElement('div'); o.className = 'rconf';
    o.innerHTML = `<div role="alertdialog"><b>${esc(T('¿Eliminar el skin «{0}»?').replace('{0}', name))}</b><p style="color:#999;font-size:13px">${esc(T('Se borra de este dispositivo.'))}</p><div class="row"><button data-x="no">${esc(T('Cancelar'))}</button><button class="danger" data-x="si">${esc(T('Eliminar'))}</button></div></div>`;
    o.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b?.dataset.x === 'si') ok(); if (b || e.target === o) o.remove(); });
    document.body.append(o);
  }
  function browser(){
    document.querySelector('.rskins')?.remove();
    const o = document.createElement('div'); o.className = 'rskins';
    o.innerHTML = `<div role="dialog" aria-label="Skins"><h3><span>Skins</span><button class="rx" aria-label="Cerrar">✕</button></h3>
      <p>Los skins clásicos del Winamp Skin Museum (sin contenido +18). El que eliges se guarda en este dispositivo y sirve sin internet. Doble clic para elegir y cerrar.</p>
      <input type="search" placeholder="Busca por nombre: Matrix, Dragon Ball, Metallica…" enterkeyhint="search">
      <div class="rchips"><label class="rup">➕ <span>Subir .wsz</span><input type="file" accept=".wsz,.zip" hidden></label><button data-c="__mine">Mis skins</button><button data-c="" class="on">Todos</button></div>
      <div class="rerr" hidden></div><div class="rlist"><div class="rgrid"></div><button class="rmore" hidden>Ver más</button></div></div>`;
    document.body.append(o);
    const grid = o.querySelector('.rgrid'), more = o.querySelector('.rmore'), err = o.querySelector('.rerr'), qbox = o.querySelector('input[type=search]'), chips = o.querySelector('.rchips');
    const state = {q: '', cat: '', off: 0}; let tok = 0;
    const showErr = m => { err.textContent = m ? T(m) : ''; err.hidden = !m; };
    get('api/skins/cats').then(r => r.ok ? r.json() : null).then(d => {
      if (!d || !d.cats) return;
      for (const c of d.cats) chips.insertAdjacentHTML('beforeend', `<button data-c="${esc(c.name)}"><span>${esc(c.name)}</span> · ${c.count.toLocaleString()}</button>`);
      chips.querySelector('[data-c=""]').innerHTML = `<span>Todos</span> · ${d.total.toLocaleString()}`;
    }).catch(() => {});
    const card = (id, name, img, del) => `<div class="card ${sel === 'wsz:' + id ? 'on' : ''}" data-id="${esc(id)}" data-name="${esc(name)}" role="button" tabindex="0">
      <img ${img ? `data-src="${img}"` : ''} alt=""><span data-noi18n>${esc(name)}</span>${del ? '<button class="del" data-del aria-label="Eliminar">✕</button>' : ''}</div>`;
    async function load(reset){
      const t = ++tok; if (reset){ state.off = 0; grid.innerHTML = ''; } showErr('');
      if (state.cat === '__mine'){
        const l = mine(); grid.innerHTML = l.length ? l.map(s => card(s.id, s.name, /^[0-9a-f]{32}$/.test(s.id) ? `api/skins/${s.id}.png` : '', true)).join('') : `<p>${esc(T('Todavía no tienes skins guardados.'))}</p>`;
        grid.querySelectorAll('img[data-src]').forEach(i => shots.observe(i));
        more.hidden = true; return; }
      try {
        const r = await get(`api/skins?q=${encodeURIComponent(state.q)}&cat=${encodeURIComponent(state.cat)}&o=${state.off}`);
        const d = await r.json(); if (t !== tok) return;
        if (!r.ok) throw new Error(d.error || 'x');
        grid.insertAdjacentHTML('beforeend', d.items.map(s => card(s.md5, s.name, `api/skins/${s.md5}.png`)).join(''));
        grid.querySelectorAll('img[data-src]:not([src])').forEach(i => shots.observe(i));
        state.off += d.items.length; more.hidden = state.off >= d.total;
        if (!d.total) grid.innerHTML = `<p>${esc(T('No encontré skins con ese nombre.'))}</p>`;
      } catch { if (t === tok){ showErr(navigator.onLine ? 'El catálogo de skins no está disponible.' : 'Sin conexión: aquí están tus skins guardados.');
        state.cat = '__mine'; chips.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === '__mine')); load(true); } }
    }
    let deb; qbox.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { state.q = qbox.value.trim(); if (state.cat === '__mine') state.cat = '';
      chips.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === state.cat)); load(true); }, 300); });
    more.onclick = () => load(false);
    o.querySelector('.rlist').addEventListener('scroll', e => { const l = e.target; if (!more.hidden && l.scrollTop + l.clientHeight > l.scrollHeight - 300) { more.hidden = true; load(false); } });
    chips.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; state.cat = b.dataset.c; chips.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); load(true); });
    o.querySelector('input[type=file]').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return; showErr('');
      try {
        if (!/\.(wsz|zip)$/i.test(f.name) || f.size > 3e6) throw new Error('Elige un archivo .wsz de menos de 3 MB.');
        const buf = await f.arrayBuffer(); await parseSkin(buf);
        const id = 'u' + Date.now().toString(36); await saveLocal(id, f.name.replace(/\.(wsz|zip)$/i, '').slice(0, 60), buf);
        await choose('wsz:' + id); state.cat = '__mine'; chips.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x.dataset.c === '__mine')); load(true);
      } catch (x) { showErr(x.message === 'zip' ? 'Ese archivo no parece un skin clásico (.wsz).' : x.message); }
    });
    // doble clic (o doble toque) en un skin: se aplica y se cierra el buscador
    o.addEventListener('dblclick', async e => {
      const c = e.target.closest('.card'); if (!c || e.target.closest('[data-del]')) return;
      try { if (sel !== 'wsz:' + c.dataset.id) await choose('wsz:' + c.dataset.id, c.dataset.name); o.remove(); } catch (x) { showErr(x.message); }
    });
    o.addEventListener('click', async e => {
      if (e.target.closest('.rx') || e.target === o) return o.remove();
      const c = e.target.closest('.card'); if (!c) return;
      if (e.target.closest('[data-del]')){ e.stopPropagation(); confirmDel(c.dataset.name, async () => {
        await store.remove(fileOf(c.dataset.id)); LSset('vskins2', mine().filter(s => s.id !== c.dataset.id));
        if (sel === 'wsz:' + c.dataset.id) await choose('wsz:' + DEFAULT).catch(() => {}); load(true); }); return; }
      c.classList.add('busy'); showErr('');
      try { await choose('wsz:' + c.dataset.id, c.dataset.name); grid.querySelectorAll('.card').forEach(x => x.classList.toggle('on', x === c)); }
      catch (x) { showErr(x.message); }
      c.classList.remove('busy');
    });
    load(true);
  }

  // ---------- encender / apagar
  async function set(v){
    on = v; LSset('vretro2', v); if (v){ hidden = false; LSset('vwinmin', false); }
    apply(); hook();
    if (v && !skin) loadSel();
  }
  async function loadSel(){
    for (let n = 0; n < 50 && !ready(); n++) await new Promise(r => setTimeout(r, 200));
    if (!ready()) return;
    try { await choose(sel); } catch { try { await choose('wsz:' + DEFAULT, 'base 2.91'); } catch {} }
  }
  window.Retro = {set, browser, choose, get on(){ return on; }, get sel(){ return sel; }, get win(){ return W; }, show(){ hidden = false; LSset('vwinmin', false); apply(); }};
  // boton 📼 (arriba y en Mis descargas): abre; si ya esta abierto y a la vista, lo minimiza
  document.addEventListener('click', e => { const b = e.target.closest('[data-retro]'); if (!b) return; e.preventDefault();
    if (!on) set(true); else { hidden = !hidden; LSset('vwinmin', hidden); apply(); } });
  document.addEventListener('visibilitychange', loop);
  document.addEventListener('pointerdown', () => { if (on && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }, true);
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    const slot = document.getElementById('slot');
    if (slot) new MutationObserver(hook).observe(slot, {childList: true});
    const now = document.getElementById('now');
    if (now) new MutationObserver(() => paintAll()).observe(now, {childList: true, characterData: true, subtree: true});
    if (on){ apply(); hook(); loadSel(); }
  });
})();
