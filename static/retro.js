// "Escucha como en los 90": el reproductor de musica con la disposicion clasica de los reproductores
// de escritorio de esa epoca (ventana de 275x116: tiempo grande, espectro, titulo que corre, kbps/kHz,
// mono/estereo, volumen y balance, barra de posicion, botones y aleatorio/repetir).
// - 20 temas de color propios.
// - Ademas lee skins clasicos .wsz (el formato de Winamp 2) que TU cargas: el archivo se lee en el
//   navegador y se guarda solo en este dispositivo. La app no trae ni redistribuye skins de terceros.
// Usa el MISMO <audio> de la app: sigue sonando con la pantalla bloqueada; los botones llaman a los de
// siempre (anterior/siguiente/aleatorio/repetir). Recuerda si esta activo y que tema/skin usas.
(() => {
  // [clave, nombre, marco1, marco2, luz, sombra, lcd, texto lcd, texto 2, acento, boton, texto boton, fondo lista, texto lista, seleccion]
  const SKINS = [
    ['clasico', 'Clásico gris', '#3a3a48', '#1d1d26', '#6d6d80', '#0c0c12', '#000', '#00e000', '#d6c94a', '#ff9e1b', '#4a4a5a', '#d8d8e0', '#000', '#00e000', '#0000c6'],
    ['cromo', 'Cromo', '#d9dde3', '#8a919c', '#ffffff', '#4b5059', '#0b1a12', '#7dffb0', '#c9f7dc', '#2a6df4', '#c3c8d0', '#1c2026', '#0b1a12', '#7dffb0', '#2a6df4'],
    ['miami', 'Neón Miami', '#2b0f3a', '#120621', '#ff4fd8', '#06020c', '#05010a', '#2ff3ff', '#ff7ae6', '#ff4fd8', '#3a1450', '#ffd6f6', '#0b0214', '#2ff3ff', '#ff4fd8'],
    ['matrix', 'Código verde', '#0b1a0b', '#020802', '#2f6b2f', '#000', '#000', '#39ff14', '#1fae0c', '#39ff14', '#0f2a0f', '#9dff8a', '#000', '#39ff14', '#145214'],
    ['vapor', 'Vaporwave', '#ff9ecf', '#7a5cff', '#ffe1f1', '#3a1d7a', '#1a1033', '#7ff9ff', '#ffb3e0', '#ff71ce', '#b39dff', '#1a1033', '#1a1033', '#ffb3e0', '#7a5cff'],
    ['ambar', 'Terminal ámbar', '#2a1a05', '#120b02', '#5c3c10', '#050300', '#0a0600', '#ffb000', '#ffd27a', '#ffb000', '#3a2508', '#ffcc66', '#0a0600', '#ffb000', '#5c3c10'],
    ['hielo', 'Hielo', '#cfe9ff', '#6aa8d8', '#ffffff', '#2c5f88', '#04182a', '#9be7ff', '#e6f7ff', '#00b3ff', '#a8d4f5', '#0b2a44', '#04182a', '#9be7ff', '#00b3ff'],
    ['lava', 'Lava', '#3b0a00', '#140300', '#ff5a1f', '#000', '#0d0200', '#ff7b00', '#ffd000', '#ff3d00', '#5a1300', '#ffc7a8', '#0d0200', '#ff7b00', '#7a1b00'],
    ['bosque', 'Bosque', '#2f4a2a', '#16241a', '#6f9a5f', '#0a120c', '#0e1a0f', '#b9f27c', '#e8d38a', '#d9a441', '#3d5c37', '#e5f2d8', '#0e1a0f', '#b9f27c', '#4f7a3a'],
    ['oceano', 'Océano', '#0b3a5c', '#04182a', '#2f7fb8', '#020a12', '#021019', '#3ff0d0', '#a8ecff', '#00c2ff', '#0f4c75', '#d6f4ff', '#021019', '#3ff0d0', '#0f6ea8'],
    ['chicle', 'Chicle', '#ffc2e2', '#ff7ab8', '#fff0f8', '#b03a78', '#3a0a26', '#ffe14f', '#fff', '#ff2e93', '#ffa3cf', '#5a0f3a', '#3a0a26', '#ffe14f', '#ff2e93'],
    ['arcade', 'Arcade', '#1a1a1a', '#000', '#ff2b2b', '#000', '#000', '#ffee00', '#ff2b2b', '#00a2ff', '#262626', '#ffee00', '#000', '#ffee00', '#ff2b2b'],
    ['noche', 'Noche azul', '#1b2440', '#0b1020', '#3d4f8a', '#05070f', '#05081a', '#7aa2ff', '#c9d6ff', '#4d7cff', '#26325a', '#d6e0ff', '#05081a', '#7aa2ff', '#26325a'],
    ['cobre', 'Cobre', '#7a4a26', '#3a2010', '#c98a5a', '#1a0d05', '#140a04', '#ffb36b', '#ffe0c0', '#e07b39', '#8a5530', '#ffe8d6', '#140a04', '#ffb36b', '#7a4a26'],
    ['papel', 'Papel', '#efe8d8', '#b9ad92', '#ffffff', '#6d6450', '#d9d2bd', '#2a2a2a', '#6b5a3a', '#b03030', '#e2dac6', '#2a2a2a', '#f7f2e6', '#2a2a2a', '#d9c9a0'],
    ['portatil', 'Verde portátil', '#c4cfa1', '#8b956d', '#e8efce', '#4d5536', '#9bbc0f', '#0f380f', '#306230', '#0f380f', '#b4bf8f', '#0f380f', '#8bac0f', '#0f380f', '#306230'],
    ['grunge', 'Grunge', '#3b3530', '#1c1916', '#6b6157', '#0a0807', '#11100e', '#d8c7a0', '#9e8f70', '#a33b20', '#4a423b', '#e0d3b8', '#11100e', '#d8c7a0', '#4a3a2a'],
    ['disco', 'Disco', '#5a2a82', '#24103a', '#e0b0ff', '#0d0518', '#0d0518', '#ffd700', '#ff9df0', '#ffd700', '#6e3a9a', '#fff4c2', '#0d0518', '#ffd700', '#8a3fd1'],
    ['medianoche', 'Medianoche', '#101010', '#000', '#3a3a3a', '#000', '#000', '#e6e6e6', '#8a8a8a', '#e6e6e6', '#1c1c1c', '#e6e6e6', '#000', '#cfcfcf', '#333'],
    ['sakura', 'Sakura', '#f7d9e3', '#d48aa6', '#fff5f8', '#8a3d5a', '#2a0f1a', '#ffc2d9', '#fff', '#e0457b', '#f0bfd0', '#5a1a33', '#2a0f1a', '#ffc2d9', '#a8325e'],
  ];
  const LS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const LSset = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const LSj = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  let on = LS('vretro', '0') === '1', sel = LS('vskin', 'clasico');
  let theme = SKINS.find(s => s[0] === sel) || SKINS[0], wsz = null;   // wsz: skin cargado {img, el, vis, pl}
  const fine = matchMedia('(pointer:fine)').matches;   // compu: espectro real; celular: animado (no toca el audio)
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const T = s => (window.t || String)(s);

  // ---------- posiciones de la ventana clasica (275x116) y de cada pieza en las hojas del skin
  const POS = {
    tb: [0, 0, 275, 14], opt: [6, 3, 9, 9], min: [244, 3, 9, 9], shade: [254, 3, 9, 9], close: [264, 3, 9, 9],
    ps: [26, 28, 9, 9], d0: [48, 26, 9, 13], d1: [60, 26, 9, 13], d2: [78, 26, 9, 13], d3: [90, 26, 9, 13],
    vis: [24, 43, 76, 16], marq: [111, 24, 154, 6], kbps: [111, 43, 15, 6], khz: [156, 43, 10, 6],
    mono: [212, 41, 27, 12], st: [239, 41, 29, 12], vol: [107, 57, 68, 13], bal: [177, 57, 38, 13],
    eq: [219, 58, 23, 12], pl: [242, 58, 23, 12], pos: [16, 72, 248, 10],
    prev: [16, 88, 23, 18], play: [39, 88, 23, 18], pause: [62, 88, 23, 18], stop: [85, 88, 23, 18], next: [108, 88, 22, 18],
    eject: [136, 89, 22, 16], shuf: [164, 89, 47, 15], rep: [210, 89, 28, 15],
  };
  const CB = {prev: 0, play: 23, pause: 46, stop: 69, next: 92};   // CBUTTONS.BMP: x (fila 0 normal, 18 apretado)
  // TEXT.BMP: letras de 5x6. Fila 0: a-z " @ (espacio en 150); fila 1: 0-9 … . : ( ) - ' ! _ + \ / [ ] ^ & % , = $ #; fila 2: Å Ö Ä ? *
  const FONT = {};
  'abcdefghijklmnopqrstuvwxyz"@'.split('').forEach((c, i) => { FONT[c] = [i * 5, 0]; });
  FONT[' '] = [150, 0];
  '0123456789….:()-\'!_+\\/[]^&%,=$#'.split('').forEach((c, i) => { FONT[c] = [i * 5, 6]; });
  'åöä?*'.split('').forEach((c, i) => { FONT[c] = [i * 5, 12]; });
  const fold = c => { c = c.toLowerCase(); if (FONT[c]) return c; const n = c.normalize('NFD').replace(/[̀-ͯ]/g, ''); return FONT[n] ? n : ' '; };

  // ---------- leer un .wsz (zip) en el navegador, sin librerias
  const NEED = ['main.bmp', 'titlebar.bmp', 'cbuttons.bmp', 'numbers.bmp', 'nums_ex.bmp', 'playpaus.bmp', 'monoster.bmp', 'posbar.bmp',
    'volume.bmp', 'balance.bmp', 'shufrep.bmp', 'text.bmp', 'viscolor.txt', 'pledit.txt'];
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
    for (const k of ['text', 'main']) if (img[k]) try { el[k] = await loadImg(img[k]); } catch {}
    if (!el.main) throw new Error('Ese archivo no parece un skin clásico (.wsz).');
    const txt = k => f[k] ? new TextDecoder('latin1').decode(f[k]) : '';
    const vis = [...txt('viscolor.txt').matchAll(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)].slice(0, 24).map(m => `rgb(${m[1]},${m[2]},${m[3]})`);
    const pl = {}; for (const m of txt('pledit.txt').matchAll(/^\s*(Normal|Current|NormalBG|SelectedBG)\s*=\s*#?([0-9a-f]{6})/gim)) pl[m[1].toLowerCase()] = '#' + m[2];
    return {img, el, vis: vis.length >= 18 ? vis : null, pl};
  }
  // los skins cargados se guardan en el almacenamiento de la app (archivo oculto), la lista en localStorage
  const mySkins = () => LSj('vskins', []);
  const skinFile = id => `.skin-${id}.wsz`;
  async function addSkin(file){
    if (!/\.(wsz|zip)$/i.test(file.name) || file.size > 3e6) throw new Error('Elige un archivo .wsz de menos de 3 MB.');
    const buf = await file.arrayBuffer(); await parseSkin(buf);   // valida antes de guardar
    const id = Date.now().toString(36), name = file.name.replace(/\.(wsz|zip)$/i, '').slice(0, 60);
    await store.putBlob(skinFile(id), new Blob([buf]));
    LSset('vskins', JSON.stringify([...mySkins(), {id, name}])); return id;
  }
  async function removeSkin(id){
    await store.remove(skinFile(id)); LSset('vskins', JSON.stringify(mySkins().filter(s => s.id !== id)));
    if (sel === 'wsz:' + id) await choose('clasico');
  }
  async function choose(key){
    sel = key; LSset('vskin', key); wsz = null;
    if (key.startsWith('wsz:')){
      try { wsz = await parseSkin(await (await store.blob(skinFile(key.slice(4)))).arrayBuffer()); }
      catch { sel = 'clasico'; LSset('vskin', sel); }
    }
    theme = SKINS.find(s => s[0] === sel) || theme; paint(); drawMarquee();
  }

  // ---------- estilos
  const css = `
  .rwrap{display:none;margin:0 auto;position:relative}
  body.retro #player.raud .rwrap{display:block}
  body.retro #player.raud .now, body.retro #player.raud #pctl, body.retro #player.raud audio{display:none!important}
  body.retro #player.raud{background:transparent;border:none;padding:4px 8px calc(6px + env(safe-area-inset-bottom))}
  .rdeck{position:absolute;left:0;top:0;width:275px;height:116px;transform-origin:0 0;image-rendering:pixelated;user-select:none;-webkit-user-select:none;
    font:8px/1 ui-monospace,"Courier New",monospace;color:var(--rtx);box-shadow:0 6px 24px #000a;touch-action:none;background-repeat:no-repeat}
  .rdeck>*{position:absolute;background-repeat:no-repeat;box-sizing:border-box}
  .rdeck .rht{cursor:pointer}
  .rdeck i{position:absolute;display:block}
  .rdeck.t{background:linear-gradient(170deg,var(--rf1),var(--rf2));outline:1px solid var(--rlo);box-shadow:inset 1px 1px 0 var(--rhi),0 6px 24px #000a}
  .rdeck.t .tb{background:repeating-linear-gradient(0deg,var(--rhi) 0 1px,transparent 1px 3px),var(--rf2);display:flex;align-items:center;justify-content:center}
  .rdeck.t .tb b{background:var(--rf2);padding:0 5px;color:var(--racc);font-size:8px;letter-spacing:2px}
  .rdeck.t .tbtn{background:var(--rbtn);border:1px solid;border-color:var(--rhi) var(--rlo) var(--rlo) var(--rhi);color:var(--rbt);font-size:7px;line-height:7px;text-align:center}
  .rdeck.t .rlc{background:var(--rlcd);border:1px solid;border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo)}
  .rdeck.t .dg{font:700 13px/13px ui-monospace,"Courier New",monospace;text-align:center;color:var(--rtx);text-shadow:0 0 4px var(--rtx)}
  .rdeck.t .ps{color:var(--rtx);font-size:8px;line-height:9px;text-align:center}
  .rdeck.t .lbl{color:var(--rtx2);font-size:6px;line-height:6px}
  .rdeck.t .ms{font-size:7px;line-height:12px;text-align:center;color:var(--rtx2);opacity:.45}
  .rdeck.t .ms.on{color:var(--rtx);opacity:1;text-shadow:0 0 3px var(--rtx)}
  .rdeck.t .rgv{background:var(--rlcd);border:1px solid;border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo)}
  .rdeck.t .rfl{left:1px;top:1px;bottom:1px;background:linear-gradient(90deg,var(--rtx2),var(--racc))}
  .rdeck.t .rth{top:0;height:100%;background:var(--rbtn);border:1px solid;border-color:var(--rhi) var(--rlo) var(--rlo) var(--rhi)}
  .rdeck.t .rbn{background:var(--rbtn);border:1px solid;border-color:var(--rhi) var(--rlo) var(--rlo) var(--rhi);color:var(--rbt);font-size:10px;line-height:16px;text-align:center}
  .rdeck.t .rbn.dn{border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo)}
  .rdeck.t .tg2{font-size:6px;line-height:13px;letter-spacing:1px}
  .rdeck.t .tg2.on{color:var(--racc);text-shadow:0 0 3px var(--racc)}
  .rdeck.s .rlc,.rdeck.s .lbl,.rdeck.s .colon{display:none}
  .rdeck.s .dg,.rdeck.s .ps,.rdeck.s .ms,.rdeck.s .rbn,.rdeck.s .tbtn,.rdeck.s .tb b{color:transparent;text-shadow:none;background-color:transparent;border:0}
  .rdeck.s .tb b{background:none}
  .rdeck .marq,.rdeck .kb,.rdeck .kh{overflow:hidden}
  body.retro .mlist{background:var(--rpl);border:2px solid;border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo);padding:2px 0;font:13px/1.3 ui-monospace,"Courier New",monospace}
  body.retro .mlist .mrow{border:none;padding:3px 8px;gap:8px;border-radius:0}
  body.retro .mlist .mrow img, body.retro .mlist .mrow .ph{display:none}
  body.retro .mlist .mrow .ti, body.retro .mlist .mrow .mn{color:var(--rpltx)}
  body.retro .mlist .mrow .ch{color:var(--rpltx);opacity:.6}
  body.retro .mlist .mrow.now{background:var(--rsel)}
  body.retro .mlist .mrow.now .ti{color:var(--rcur,#fff)}
  .rskins{position:fixed;inset:0;z-index:60;background:#000c;display:grid;place-items:center;padding:16px}
  .rskins>div{background:#14181f;border:1px solid #333;border-radius:10px;padding:14px;max-width:600px;width:100%;max-height:88vh;overflow:auto;color:#ddd;font:14px system-ui,sans-serif}
  .rskins h3{margin:0 0 4px;font-size:16px}
  .rskins h4{margin:14px 0 6px;font-size:13px;color:#aaa;font-weight:600}
  .rskins p{margin:0 0 10px;color:#999;font-size:13px;line-height:1.4}
  .rskins a{color:#f2a33a}
  .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
  .rgrid .card{position:relative;cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid transparent;background:#0b0e13;color:#ddd}
  .rgrid .card.on{border-color:#f2a33a}
  .rgrid i{display:block;height:44px;position:relative;background-size:cover;background-position:0 0;image-rendering:pixelated}
  .rgrid i b{position:absolute;left:8px;top:10px;right:8px;height:22px;border:2px solid;font:700 13px/18px ui-monospace,monospace;padding-left:4px}
  .rgrid span{display:block;padding:6px 8px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rgrid .del{position:absolute;right:4px;top:4px;background:#000b;border:none;color:#fff;border-radius:6px;font-size:12px;padding:2px 6px;cursor:pointer}
  .rskins .radd{display:block;margin-top:8px;padding:12px;border-radius:8px;border:1px dashed #666;background:#1b2028;color:#eee;cursor:pointer;text-align:center}
  .rskins .rerr{color:#ff8a80;font-size:13px;margin-top:6px}
  .rskins .rclose{margin-top:14px;width:100%;padding:10px;border-radius:8px;border:none;background:#f2a33a;color:#111;font:700 14px system-ui,sans-serif;cursor:pointer}
  .rconf{position:fixed;inset:0;z-index:80;background:#000c;display:grid;place-items:center;padding:16px}
  .rconf>div{background:#14181f;border:1px solid #333;border-radius:10px;padding:16px;max-width:340px;color:#ddd;font:14px system-ui,sans-serif}
  .rconf .row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
  .rconf button{padding:9px 14px;border-radius:8px;border:1px solid #555;background:transparent;color:#ddd;font:inherit;cursor:pointer}
  .rconf .danger{background:#d32f2f;border-color:#d32f2f;color:#fff;font-weight:700}
  `;

  // ---------- la ventana
  let wrap, deck, audio, an = null, ctx = null, bars = new Array(19).fill(0), peaks = new Array(19).fill(0), raf = 0;
  let marqCv, marqX = 0, marqTxt = '', marqT = 0, visCv, down = '', lastSec = -1;
  const $d = k => deck.querySelector(`[data-k="${k}"]`);
  function build(){
    const player = document.getElementById('player'); if (!player || wrap) return;
    wrap = document.createElement('div'); wrap.className = 'rwrap';
    deck = document.createElement('div'); deck.className = 'rdeck t';
    const part = (k, cls = '', inner = '', label = '') => { const [x, y, w, h] = POS[k];
      return `<div data-k="${k}" class="${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"${label ? ` role="button" tabindex="0" aria-label="${esc(label)}"` : ''}>${inner}</div>`; };
    deck.innerHTML = [
      part('tb', 'tb', '<b>OFFLINE·90</b>'), part('opt', 'tbtn rht', '≡', 'Cambiar tema'), part('min', 'tbtn rht', '▾', 'Cambiar tema'),
      part('shade', 'tbtn rht', '▴', 'Cambiar tema'), part('close', 'tbtn rht', '×', 'Volver al reproductor normal'),
      '<div class="rlc" style="left:10px;top:22px;width:93px;height:40px"></div>',
      '<div class="rlc" style="left:108px;top:21px;width:160px;height:12px"></div>',
      '<div class="rlc" style="left:108px;top:40px;width:20px;height:11px"></div><div class="rlc" style="left:153px;top:40px;width:16px;height:11px"></div>',
      '<div class="lbl" style="left:130px;top:43px;width:20px;height:6px">kbps</div><div class="lbl" style="left:171px;top:43px;width:20px;height:6px">kHz</div>',
      part('ps', 'ps', '■'), part('d0', 'dg', '0'), part('d1', 'dg', '0'),
      '<div class="dg colon" style="left:70px;top:26px;width:6px;height:13px">:</div>', part('d2', 'dg', '0'), part('d3', 'dg', '0'),
      part('vis', '', '<canvas width="76" height="16" style="width:76px;height:16px;display:block"></canvas>'),
      part('marq', 'marq', '<canvas width="154" height="6" style="width:154px;height:6px;display:block"></canvas>'),
      part('kbps', 'kb', '<canvas width="15" height="6" style="width:15px;height:6px;display:block"></canvas>'),
      part('khz', 'kh', '<canvas width="10" height="6" style="width:10px;height:6px;display:block"></canvas>'),
      part('mono', 'ms', 'MONO'), part('st', 'ms on', 'STEREO'),
      part('vol', 'rgv rht', '<i class="rfl"></i><i class="rth" style="width:14px"></i>', 'Volumen'),
      part('bal', 'rgv', '<i class="rth" style="width:14px;left:12px"></i>'),
      part('eq', 'rbn tg2 rht', 'EQ', 'Cambiar tema'), part('pl', 'rbn tg2 rht', 'PL', 'Ver lista de canciones'),
      part('pos', 'rgv rht', '<i class="rth" style="width:29px;left:0"></i>', 'Posición en la canción'),
      part('prev', 'rbn rht', '⏮', 'Anterior'), part('play', 'rbn rht', '▶', 'Reproducir'), part('pause', 'rbn rht', '⏸', 'Pausa'),
      part('stop', 'rbn rht', '■', 'Detener'), part('next', 'rbn rht', '⏭', 'Siguiente'), part('eject', 'rbn rht', '⏏', 'Cambiar tema'),
      part('shuf', 'rbn tg2 rht', 'SHUFFLE', 'Aleatorio'), part('rep', 'rbn tg2 rht', 'REP', 'Repetir'),
    ].join('');
    wrap.append(deck); player.querySelector('.in').prepend(wrap);
    visCv = $d('vis').querySelector('canvas'); marqCv = $d('marq').querySelector('canvas');
    const act = k => {
      const a = audio;
      if (['opt', 'min', 'shade', 'eject', 'eq'].includes(k)) return picker();
      if (k === 'close') return set(false);
      if (k === 'pl'){ try { libFilter = 'audio'; go('descargas'); } catch {} return; }
      const ids = {prev: 'pprev', next: 'pnext', shuf: 'pshuf', rep: 'prep'};
      if (ids[k]){ document.getElementById(ids[k])?.click(); return sync(); }
      if (!a) return;
      if (k === 'play'){ wire(); a.play().catch(() => {}); }
      if (k === 'pause') a.paused ? a.play().catch(() => {}) : a.pause();
      if (k === 'stop'){ a.pause(); a.currentTime = 0; }
      sync();
    };
    const slide = (k, e) => { const r = $d(k).getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), a = audio; if (!a) return;
      if (k === 'vol') a.volume = f; else if (a.duration) a.currentTime = f * a.duration; paint(); };
    deck.addEventListener('pointerdown', e => { const p = e.target.closest('[data-k]'); if (!p || !p.classList.contains('rht')) return; down = p.dataset.k;
      if (down === 'vol' || down === 'pos'){ try { deck.setPointerCapture(e.pointerId); } catch {} slide(down, e); } paint(); });
    deck.addEventListener('pointermove', e => { if (down === 'vol' || down === 'pos') slide(down, e); });
    deck.addEventListener('pointerup', e => { const k = down; down = ''; const p = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-k]');
      if (k && p && p.dataset.k === k && k !== 'vol' && k !== 'pos') act(k); paint(); });
    deck.addEventListener('pointercancel', () => { down = ''; paint(); });
    deck.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.k){ e.preventDefault(); act(e.target.dataset.k); } });
    addEventListener('resize', fit); fit(); paint();
  }
  function fit(){
    if (!wrap) return;
    const w = Math.min(document.documentElement.clientWidth - 16, 830), s = Math.max(1, Math.min(3, Math.floor(w / 275 * 4) / 4));
    deck.style.transform = `scale(${s})`; wrap.style.width = 275 * s + 'px'; wrap.style.height = 116 * s + 'px';
  }
  const spr = (k, sheet, x, y) => { const e = $d(k); if (!e || !wsz.img[sheet]) return; e.style.backgroundImage = `url("${wsz.img[sheet]}")`; e.style.backgroundPosition = `${-x}px ${-y}px`; };
  function paint(){
    if (!deck) return;
    const a = audio, playing = !!a && !a.paused, s = !!wsz;
    deck.classList.toggle('t', !s); deck.classList.toggle('s', s);
    deck.style.backgroundImage = s ? `url("${wsz.img.main}")` : '';
    deck.querySelectorAll('[data-k]').forEach(e => { e.style.backgroundImage = ''; e.style.backgroundPosition = ''; });
    const shuf = !!document.getElementById('pshuf')?.classList.contains('on'), rep = !!document.getElementById('prep')?.classList.contains('on');
    const t = Math.floor(a?.currentTime || 0), dg = [Math.floor(t / 600) % 10, Math.floor(t / 60) % 10, Math.floor(t % 60 / 10), t % 10];
    const vol = a ? a.volume : 1, pos = a && a.duration ? a.currentTime / a.duration : 0;
    const vt = $d('vol').querySelector('.rth'), bt = $d('bal').querySelector('.rth'), pt = $d('pos').querySelector('.rth'), fill = deck.querySelector('.rfl');
    if (s){
      const I = wsz.img;
      spr('tb', 'titlebar', 27, 0); spr('close', 'titlebar', 18, down === 'close' ? 9 : 0); spr('opt', 'titlebar', 0, down === 'opt' ? 9 : 0);
      spr('min', 'titlebar', 9, down === 'min' ? 9 : 0); spr('shade', 'titlebar', down === 'shade' ? 9 : 0, 18);
      for (const k of Object.keys(CB)) spr(k, 'cbuttons', CB[k], down === k ? 18 : 0);
      spr('eject', 'cbuttons', 114, down === 'eject' ? 16 : 0);
      const num = I.nums_ex ? 'nums_ex' : 'numbers';
      ['d0', 'd1', 'd2', 'd3'].forEach((k, i) => spr(k, num, dg[i] * 9, 0));
      spr('ps', 'playpaus', playing ? 0 : a && a.currentTime > 0 ? 9 : 18, 0);
      spr('st', 'monoster', 0, a ? 0 : 12); spr('mono', 'monoster', 29, 12);
      spr('shuf', 'shufrep', 28, (shuf ? 30 : 0) + (down === 'shuf' ? 15 : 0)); spr('rep', 'shufrep', 0, (rep ? 30 : 0) + (down === 'rep' ? 15 : 0));
      spr('eq', 'shufrep', down === 'eq' ? 46 : 0, 61); spr('pl', 'shufrep', down === 'pl' ? 69 : 23, 73);
      spr('vol', 'volume', 0, Math.round(vol * 27) * 15); spr('bal', 'balance', 9, 0); spr('pos', 'posbar', 0, 0);
      fill.style.display = 'none';
      vt.style.cssText = I.volume ? `left:${Math.round(vol * 54)}px;top:1px;width:14px;height:11px;background:url("${I.volume}") ${down === 'vol' ? 0 : -15}px -422px no-repeat` : 'display:none';
      bt.style.cssText = I.balance ? `left:12px;top:1px;width:14px;height:11px;background:url("${I.balance}") -15px -422px no-repeat` : 'display:none';
      pt.style.cssText = I.posbar && a && a.duration ? `left:${Math.round(pos * 219)}px;top:0;width:29px;height:10px;background:url("${I.posbar}") ${down === 'pos' ? -278 : -248}px 0 no-repeat` : 'display:none';
      const r = document.documentElement.style, pl = wsz.pl;
      r.setProperty('--rpl', pl.normalbg || '#000'); r.setProperty('--rpltx', pl.normal || '#0f0');
      r.setProperty('--rsel', pl.selectedbg || '#0000c6'); r.setProperty('--rcur', pl.current || '#fff');
      r.setProperty('--rhi', '#888'); r.setProperty('--rlo', '#222');
    } else {
      ['d0', 'd1', 'd2', 'd3'].forEach((k, i) => { $d(k).textContent = dg[i]; });
      $d('ps').textContent = playing ? '▶' : a && a.currentTime > 0 ? '❚❚' : '■';
      $d('st').classList.toggle('on', !!a); $d('shuf').classList.toggle('on', shuf); $d('rep').classList.toggle('on', rep);
      ['prev', 'play', 'pause', 'stop', 'next', 'eject', 'shuf', 'rep', 'eq', 'pl'].forEach(k => $d(k).classList.toggle('dn', down === k));
      fill.style.display = ''; fill.style.width = Math.round(vol * 64) + 'px';
      vt.style.cssText = `left:${Math.round(vol * 52)}px;width:14px`; bt.style.cssText = 'left:12px;width:14px';
      pt.style.cssText = a && a.duration ? `left:${Math.round(pos * 217)}px;width:29px` : 'display:none';
      const [, , f1, f2, hi, lo, lcd, tx, tx2, acc, btn, bt2, plb, pltx, selc] = theme, r = document.documentElement.style;
      Object.entries({rf1: f1, rf2: f2, rhi: hi, rlo: lo, rlcd: lcd, rtx: tx, rtx2: tx2, racc: acc, rbtn: btn, rbt: bt2, rpl: plb, rpltx: pltx, rsel: selc, rcur: '#fff'})
        .forEach(([k, v]) => r.setProperty('--' + k, v));
    }
    drawText('kbps', a && a.duration ? kbps() : '', 3); drawText('khz', a ? '44' : '', 2);
  }
  function kbps(){ try { const it = library.find(i => i.name === current); return it && audio.duration ? String(Math.min(999, Math.round(it.size * 8 / audio.duration / 1000))) : ''; } catch { return ''; } }
  const lcdColor = () => getComputedStyle(document.documentElement).getPropertyValue('--rtx').trim() || '#0f0';
  // texto chico: con la fuente del skin (TEXT.BMP) o, en los temas, con la letra del sistema
  function drawText(k, s, n){
    const cv = $d(k)?.querySelector('canvas'); if (!cv) return;
    const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    s = String(s).padStart(n, ' ').slice(-n);
    if (wsz?.el.text) [...s].forEach((ch, i) => { const [x, y] = FONT[fold(ch)]; c.drawImage(wsz.el.text, x, y, 5, 6, i * 5, 0, 5, 6); });
    else { c.fillStyle = lcdColor(); c.font = '7px ui-monospace,monospace'; c.textBaseline = 'top'; c.fillText(s.trim(), 0, -1); }
  }
  function drawMarquee(){
    if (!marqCv) return;
    const c = marqCv.getContext('2d'), W = 154; c.clearRect(0, 0, W, 6);
    const txt = marqTxt + '  ***  ', full = txt.length * 5;
    if (wsz?.el.text){
      for (let r = 0; r < 2; r++) [...txt].forEach((ch, i) => { const x0 = i * 5 - marqX + r * full; if (x0 > -5 && x0 < W){ const [x, y] = FONT[fold(ch)]; c.drawImage(wsz.el.text, x, y, 5, 6, x0, 0, 5, 6); } });
    } else { c.fillStyle = lcdColor(); c.font = '7px ui-monospace,monospace'; c.textBaseline = 'top'; c.fillText(txt + txt, -marqX * 0.95, -1); }
  }
  // espectro real (solo en compu): el audio pasa por un analizador. En el celular no se toca el audio.
  function wire(){
    if (!fine || an || !audio || !window.AudioContext) return;
    try {
      ctx = ctx || new AudioContext();
      // si el navegador no dejo arrancar el audio todavia (sin un toque), no se conecta: si no, quedaria mudo
      if (ctx.state !== 'running'){ ctx.resume().then(() => { if (ctx.state === 'running') wire(); }).catch(() => {}); return; }
      const src = ctx.createMediaElementSource(audio); an = ctx.createAnalyser(); an.fftSize = 64; an.smoothingTimeConstant = 0.7;
      src.connect(an); an.connect(ctx.destination);
    } catch { an = null; }
  }
  let lastTitle = '';
  function sync(){
    if (!deck) return;
    const a = audio, P = document.getElementById('player');
    P?.classList.toggle('raud', !!a && !!P.querySelector('#slot audio'));
    const title = (document.getElementById('now')?.textContent || '').trim(), tkey = title + '|' + Math.round(a?.duration || 0);
    if (tkey !== lastTitle){
      lastTitle = tkey;
      const n = typeof qi !== 'undefined' && qi >= 0 ? qi + 1 + '. ' : '';
      const d = a?.duration ? ` (${Math.floor(a.duration / 60)}:${String(Math.floor(a.duration % 60)).padStart(2, '0')})` : '';
      marqTxt = `${n}${title}${d}`; marqX = 0; drawMarquee();
    }
    paint();
  }
  function draw(ts){
    raf = 0;
    if (!on || !deck || document.hidden || !audio) return;
    if (ts - marqT > 160){ marqT = ts; marqX = (marqX + 5) % Math.max(5, (marqTxt.length + 7) * 5); drawMarquee(); }
    const c = visCv.getContext('2d'), W = 76, H = 16, n = bars.length, playing = !audio.paused;
    let data = null; if (an){ data = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(data); }
    for (let i = 0; i < n; i++){
      let v;
      if (data) v = data[Math.min(data.length - 1, Math.floor(i * data.length / n))] / 255;
      else v = playing ? Math.min(1, bars[i] * 0.72 + Math.random() * (0.55 - i * 0.012) + (i < 4 ? 0.15 : 0)) : bars[i] * 0.85;
      bars[i] = v; peaks[i] = Math.max(v, peaks[i] - 0.03);
    }
    const vis = wsz?.vis, tx = lcdColor(), acc = getComputedStyle(document.documentElement).getPropertyValue('--racc').trim() || '#f90';
    c.clearRect(0, 0, W, H);
    if (vis){ c.fillStyle = vis[0]; c.fillRect(0, 0, W, H); c.fillStyle = vis[1]; for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) c.fillRect(x, y, 1, 1); }
    for (let i = 0; i < n; i++){
      const h = Math.round(bars[i] * H), x = i * 4;
      for (let y = 0; y < h; y++){ c.fillStyle = vis ? vis[17 - Math.min(15, Math.round(y * 15 / (H - 1)))] : (y > H * 0.6 ? acc : tx); c.fillRect(x, H - 1 - y, 3, 1); }
      c.fillStyle = vis ? (vis[23] || vis[2]) : acc; c.fillRect(x, H - 1 - Math.round(peaks[i] * (H - 1)), 3, 1);
    }
    const sec = Math.floor(audio.currentTime); if (sec !== lastSec){ lastSec = sec; paint(); }
    raf = requestAnimationFrame(draw);
  }
  const loop = () => { if (!raf && on && !document.hidden) raf = requestAnimationFrame(draw); };
  function hook(){
    const a = document.querySelector('#slot audio');
    if (a && a !== audio){ audio = a; an = null;
      ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ended', 'volumechange', 'seeked'].forEach(ev => a.addEventListener(ev, () => { sync(); if (ev === 'play'){ wire(); loop(); } })); }
    if (!a) audio = null;
    sync(); loop();
  }
  // ---------- elegir tema o skin
  function confirmDel(name, ok){
    const o = document.createElement('div'); o.className = 'rconf';
    o.innerHTML = `<div role="alertdialog"><b>${esc(T('¿Eliminar el skin «{0}»?').replace('{0}', name))}</b><p style="color:#999;font-size:13px">${esc(T('Se borra de este dispositivo.'))}</p><div class="row"><button data-x="no">${esc(T('Cancelar'))}</button><button class="danger" data-x="si">${esc(T('Eliminar'))}</button></div></div>`;
    o.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b?.dataset.x === 'si') ok(); if (b || e.target === o) o.remove(); });
    document.body.append(o);
  }
  async function picker(){
    document.querySelector('.rskins')?.remove();
    const o = document.createElement('div'); o.className = 'rskins';
    const mine = mySkins(), prev = {};
    for (const s of mine) try { const sk = await parseSkin(await (await store.blob(skinFile(s.id))).arrayBuffer()); prev[s.id] = sk.img.main; } catch {}
    o.innerHTML = `<div role="dialog" aria-label="Elige tu tema"><h3>Elige tu tema</h3><p>Se queda guardado en este dispositivo.</p>
      <h4>Tus skins clásicos (.wsz)</h4>
      <p><span>Descarga skins clásicos de Winamp 2 (archivos .wsz) en el Winamp Skin Museum y cárgalos aquí. Se guardan solo en este dispositivo.</span> <a href="https://skins.webamp.org/" target="_blank" rel="noopener">skins.webamp.org ↗</a></p>
      ${mine.length ? `<div class="rgrid">${mine.map(s => `<div class="card ${sel === 'wsz:' + s.id ? 'on' : ''}" data-k="wsz:${esc(s.id)}" role="button" tabindex="0"><i style="background-image:url('${prev[s.id] || ''}')"></i><span data-noi18n>${esc(s.name)}</span><button class="del" data-del="${esc(s.id)}" data-name="${esc(s.name)}" aria-label="Eliminar">✕</button></div>`).join('')}</div>` : ''}
      <label class="radd">➕ <span>Cargar skin (.wsz)</span><input type="file" accept=".wsz,.zip" hidden></label><div class="rerr" hidden></div>
      <h4>Temas incluidos</h4>
      <div class="rgrid">${SKINS.map(s => `<div class="card ${s[0] === sel ? 'on' : ''}" data-k="${s[0]}" role="button" tabindex="0"><i style="background:linear-gradient(160deg,${s[2]},${s[3]})"><b style="background:${s[6]};color:${s[7]};border-color:${s[5]} ${s[4]} ${s[4]} ${s[5]}">01:23</b></i><span>${s[1]}</span></div>`).join('')}</div>
      <button class="rclose">Listo</button></div>`;
    const err = o.querySelector('.rerr');
    o.querySelector('input[type=file]').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return; err.hidden = true;
      try { const id = await addSkin(f); await choose('wsz:' + id); picker(); }
      catch (x) { err.textContent = x.message === 'zip' ? 'Ese archivo no parece un skin clásico (.wsz).' : x.message; err.hidden = false; }
    });
    o.addEventListener('click', async e => {
      const d = e.target.closest('[data-del]');
      if (d){ e.stopPropagation(); confirmDel(d.dataset.name, async () => { await removeSkin(d.dataset.del); picker(); }); return; }
      const b = e.target.closest('.card[data-k]');
      if (b){ await choose(b.dataset.k); o.querySelectorAll('.card').forEach(x => x.classList.toggle('on', x === b)); return; }
      if (e.target === o || e.target.closest('.rclose')) o.remove();
    });
    document.body.append(o);
  }
  function set(v){ on = v; LSset('vretro', v ? '1' : '0'); document.body.classList.toggle('retro', on);
    document.querySelectorAll('[data-retro]').forEach(b => b.classList.toggle('on', on)); if (v){ build(); hook(); paint(); } }
  window.Retro = {set, toggle: () => set(!on), picker, choose, get on(){ return on; }, get sel(){ return sel; }, SKINS};
  document.addEventListener('click', e => { const b = e.target.closest('[data-retro]'); if (b){ e.preventDefault(); set(!on); if (on) picker(); } });
  document.addEventListener('visibilitychange', loop);
  document.addEventListener('pointerdown', () => { if (on && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }, true);
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    document.body.classList.toggle('retro', on);
    build();
    const slot = document.getElementById('slot');
    if (slot) new MutationObserver(hook).observe(slot, {childList: true});
    const now = document.getElementById('now');
    if (now) new MutationObserver(() => sync()).observe(now, {childList: true, characterData: true, subtree: true});
    hook();
    // el skin cargado se lee cuando el almacenamiento de la app ya esta listo
    if (sel.startsWith('wsz:')){ const k = sel, tryLoad = (n = 0) => { if (typeof store !== 'undefined' && (store.root || store.db)) choose(k); else if (n < 50) setTimeout(() => tryLoad(n + 1), 200); }; tryLoad(); }
  });
})();
