// Perfiles locales: varias personas en el mismo celular (tú, tus hijos...), sin cuentas ni servidor.
// Cada perfil tiene sus preferencias (idioma, skin y ventanas del reproductor, ecualizador, playlists,
// orden, aleatorio/repetir...). Se abre siempre el ultimo perfil usado.
// Como funciona: este archivo se carga antes que todo y hace que localStorage guarde las claves de cada
// perfil con el prefijo "p.<id>." (el primer perfil usa las claves de siempre, asi nada se pierde).
// Lo del dispositivo se comparte: las descargas, la clave del servidor y las descargas en curso.
(() => {
  const LSP = Storage.prototype, G = LSP.getItem, S = LSP.setItem, R = LSP.removeItem;
  let ls; try { ls = window.localStorage; } catch { return; }
  if (!ls) return;
  const SHARED = new Set(['vk', 'vprofs', 'vprof', 'vbatch', 'vspmap', 'vdur']);
  const raw = {get: k => { try { return G.call(ls, k); } catch { return null; } }, set: (k, v) => { try { S.call(ls, k, v); } catch {} }, del: k => { try { R.call(ls, k); } catch {} }};
  let list; try { list = JSON.parse(raw.get('vprofs')); } catch {}
  if (!Array.isArray(list) || !list.length) list = [{id: '1', name: '', emoji: '🙂'}];
  let cur = raw.get('vprof'); if (!list.some(p => p.id === cur)) cur = list[0].id;
  const pre = id => id === '1' ? '' : `p.${id}.`;
  const mapKey = k => (SHARED.has(k) || k.startsWith('p.')) ? k : pre(cur) + k;
  LSP.getItem = function (k){ return G.call(this, this === ls ? mapKey(String(k)) : k); };
  LSP.setItem = function (k, v){ return S.call(this, this === ls ? mapKey(String(k)) : k, v); };
  LSP.removeItem = function (k){ return R.call(this, this === ls ? mapKey(String(k)) : k); };
  const save = () => raw.set('vprofs', JSON.stringify(list));
  const tr = s => (window.t || String)(s);
  const nameOf = p => p.name || tr('Yo');
  const go = id => { raw.set('vprof', id); location.reload(); };
  const keysOf = id => { const p = pre(id), out = [];
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i);
      if (p ? k.startsWith(p) : !(SHARED.has(k) || k.startsWith('p.'))) out.push(k); }
    return out; };
  const EMOJI = ['🙂', '😎', '👩', '👨', '👧', '👦', '👶', '👵', '🐱', '🐶', '🦊', '🐼', '🦄', '🦖', '🚀', '⚽', '🎸', '🌈', '👑', '🌸'];
  const ST = 'position:fixed;inset:0;z-index:70;background:#000c;display:grid;place-items:center;padding:16px';
  const BOX = 'background:#14181f;border:1px solid #333;border-radius:12px;padding:14px;width:min(340px,100%);box-sizing:border-box;font:16px system-ui,sans-serif;color:#ddd';
  const BTN = 'border:none;border-radius:8px;font:inherit;cursor:pointer;padding:10px 14px';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const layer = html => { const o = document.createElement('div'); o.style.cssText = ST; o.innerHTML = `<div role="dialog" style="${BOX}">${html}</div>`;
    o.addEventListener('click', e => { if (e.target === o) o.remove(); }); document.body.append(o); return o; };

  function picker(){
    const o = layer(`<div style="font-weight:700;margin:2px 4px 10px">¿Quién está usando?</div>${
      list.map(p => `<div style="display:flex;gap:6px;margin:4px 0"><button data-go="${p.id}" style="${BTN};flex:1;text-align:left;background:${p.id === cur ? '#f2a33a' : '#1f2530'};color:${p.id === cur ? '#111' : '#ddd'}"><span style="font-size:22px;vertical-align:middle;margin-right:8px">${p.emoji}</span><span data-noi18n>${esc(nameOf(p))}</span></button><button data-ed="${p.id}" aria-label="Editar perfil" style="${BTN};background:#1f2530;color:#ddd">✏️</button></div>`).join('')
    }<button data-add style="${BTN};width:100%;margin-top:8px;background:transparent;color:#f2a33a;border:1px dashed #555">＋ Agregar perfil</button>
    <div style="font-size:12px;color:#888;margin:10px 4px 0">Cada perfil guarda sus preferencias en este dispositivo. Las descargas se comparten.</div>`);
    o.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.go){ if (b.dataset.go !== cur) go(b.dataset.go); else o.remove(); }
      else if (b.dataset.ed){ o.remove(); edit(list.find(p => p.id === b.dataset.ed)); }
      else if ('add' in b.dataset){ o.remove(); edit(null); }
    });
  }

  function edit(p){
    let emoji = p ? p.emoji : EMOJI[(list.length + 3) % EMOJI.length];
    const o = layer(`<div style="font-weight:700;margin:2px 4px 10px">${p ? 'Editar perfil' : 'Nuevo perfil'}</div>
      <label style="display:block;font-size:13px;color:#999;margin:0 4px 4px">Nombre</label>
      <input data-n maxlength="24" placeholder="Por ejemplo: Sofía" value="${p ? esc(p.name) : ''}" style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #444;background:#0d1015;color:#eee;font:inherit">
      <div data-em style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:10px 0">${EMOJI.map(x => `<button data-e="${x}" style="${BTN};padding:8px 0;font-size:22px;background:${x === emoji ? '#f2a33a' : '#1f2530'}">${x}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">${p && list.length > 1 ? `<button data-del style="${BTN};background:transparent;color:#ff6b6b;margin-right:auto">Eliminar perfil</button>` : ''}
      <button data-x style="${BTN};background:#1f2530;color:#ddd">Cancelar</button><button data-ok style="${BTN};background:#f2a33a;color:#111;font-weight:700">${p ? 'Guardar' : 'Crear y usar'}</button></div>`);
    const inp = o.querySelector('[data-n]'); setTimeout(() => inp.focus(), 50);
    o.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.e){ emoji = b.dataset.e; o.querySelectorAll('[data-e]').forEach(x => x.style.background = x.dataset.e === emoji ? '#f2a33a' : '#1f2530'); }
      else if ('x' in b.dataset){ o.remove(); picker(); }
      else if ('del' in b.dataset) confirmDel(p, o);
      else if ('ok' in b.dataset){
        const name = inp.value.trim().slice(0, 24);
        if (p){ p.name = name; p.emoji = emoji; save(); o.remove(); paint(); picker(); }
        else { const id = Date.now().toString(36); list.push({id, name, emoji}); save(); go(id); }
      }
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') o.querySelector('[data-ok]').click(); });
  }

  function confirmDel(p, under){
    const o = layer(`<div style="font-weight:700;margin:2px 4px 4px">¿Eliminar este perfil?</div><div data-noi18n style="font-size:18px;margin:0 4px 8px">${p.emoji} ${esc(nameOf(p))}</div>
      <div style="font-size:14px;color:#aaa;margin:0 4px 14px">Se borran sus preferencias y sus playlists. Las descargas se quedan en el dispositivo.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button data-x style="${BTN};background:#1f2530;color:#ddd">Cancelar</button><button data-y style="${BTN};background:#d93025;color:#fff;font-weight:700">Eliminar</button></div>`);
    o.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if ('x' in b.dataset) return o.remove();
      if (!('y' in b.dataset)) return;
      for (const k of keysOf(p.id)) raw.del(k);
      list = list.filter(x => x.id !== p.id); save();
      if (p.id === cur) return go(list[0].id);
      o.remove(); under.remove(); paint(); picker();
    });
  }

  // boton del perfil: cualquier elemento con data-prof lo abre y muestra el perfil actual
  const paint = () => { const p = list.find(x => x.id === cur);
    document.querySelectorAll('[data-prof]').forEach(b => { b.innerHTML = `${p.emoji}<span data-noi18n>${list.length > 1 || p.name ? ' ' + esc(nameOf(p)) : ''}</span>`; b.setAttribute('aria-label', tr('Perfil') + ': ' + nameOf(p)); }); };
  document.addEventListener('click', e => { if (e.target.closest('[data-prof]')) picker(); });
  document.addEventListener('DOMContentLoaded', paint);
  window.Profiles = {get current(){ return list.find(p => p.id === cur); }, get list(){ return list.slice(); }, picker, use: go};
})();
