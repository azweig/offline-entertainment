// "Escucha como en los 90": el reproductor de musica con aspecto de los reproductores de escritorio
// de fines de los 90 (pantalla LCD, titulo que corre, barras de espectro, botones en relieve).
// Diseno propio con 20 temas originales. Usa el MISMO <audio> de la app, asi que sigue sonando con la
// pantalla bloqueada; los botones llaman a los de siempre (anterior/siguiente/aleatorio/repetir).
// Recuerda en este dispositivo si esta activo y que tema usas (localStorage: vretro, vskin).
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
  let on = LS('vretro', '0') === '1', skin = SKINS.find(s => s[0] === LS('vskin', 'clasico')) || SKINS[0];
  const fine = matchMedia('(pointer:fine)').matches;   // compu: espectro real; celular: animado (no toca el audio)

  const css = `
  .rdeck{display:none}
  body.retro #player.raud .rdeck{display:block}
  body.retro #player.raud .now, body.retro #player.raud #pctl, body.retro #player.raud audio{display:none!important}
  body.retro #player.raud{background:transparent;border:none;padding:6px 8px calc(8px + env(safe-area-inset-bottom))}
  .rdeck{max-width:460px;margin:0 auto;background:linear-gradient(160deg,var(--rf1),var(--rf2));border:2px solid;border-color:var(--rhi) var(--rlo) var(--rlo) var(--rhi);
    border-radius:4px;padding:6px 8px 8px;font:12px/1.2 ui-monospace,"Courier New",monospace;color:var(--rbt);box-shadow:0 8px 30px #000a;user-select:none}
  .rbar{display:flex;justify-content:space-between;align-items:center;height:16px;margin:-2px -2px 6px;padding:0 4px;
    background:repeating-linear-gradient(0deg,var(--rhi) 0 1px,transparent 1px 3px);border-radius:2px}
  .rlogo{background:var(--rf2);padding:0 6px;font-weight:700;letter-spacing:2px;font-size:10px;color:var(--racc)}
  .rbar button{all:unset;background:var(--rf2);color:var(--rbt);font-size:10px;padding:0 5px;cursor:pointer;border:1px solid var(--rlo)}
  .rmain{display:flex;gap:8px}
  .rlcd{flex:none;width:118px;background:var(--rlcd);border:2px solid;border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo);padding:4px 5px}
  .rtime{font:700 26px/1 ui-monospace,"Courier New",monospace;color:var(--rtx);text-shadow:0 0 6px var(--rtx);letter-spacing:1px;text-align:right}
  .rtime.blink{animation:rblink 1s steps(2) infinite}
  @keyframes rblink{50%{opacity:0}}
  .rvis{display:block;width:100%;height:30px;margin-top:4px}
  .rinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
  .rmarq{background:var(--rlcd);border:2px solid;border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo);overflow:hidden;white-space:nowrap;height:20px;display:flex;align-items:center}
  .rmarq span{display:inline-block;padding-left:100%;color:var(--rtx);animation:rmarq 14s linear infinite;margin:0;font:inherit}
  @keyframes rmarq{to{transform:translateX(-100%)}}
  .rmeta{display:flex;gap:6px;align-items:center;font-size:10px;color:var(--rtx2)}
  .rmeta b{color:var(--rtx);font-weight:400;background:var(--rlcd);padding:0 3px}
  .rst{margin-left:auto;color:var(--rtx);text-shadow:0 0 4px var(--rtx)}
  .rdeck input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:8px;background:var(--rlcd);border:1px solid;border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo);margin:0}
  .rdeck input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:12px;background:var(--rbtn);border:1px solid;border-color:var(--rhi) var(--rlo) var(--rlo) var(--rhi)}
  .rdeck input[type=range]::-moz-range-thumb{width:22px;height:12px;background:var(--rbtn);border:1px solid var(--rhi);border-radius:0}
  .rseek{margin:8px 0 6px!important}
  .rctl{display:flex;gap:3px;flex-wrap:wrap}
  .rctl button{all:unset;cursor:pointer;min-width:34px;height:26px;text-align:center;font-size:14px;line-height:26px;color:var(--rbt);background:var(--rbtn);
    border:2px solid;border-color:var(--rhi) var(--rlo) var(--rlo) var(--rhi)}
  .rctl button:active{border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo)}
  .rctl button.on{color:var(--racc);text-shadow:0 0 5px var(--racc)}
  .rctl .sp{flex:1}
  /* la lista de canciones, como la ventana de lista de esos reproductores */
  body.retro .mlist{background:var(--rpl);border:2px solid;border-color:var(--rlo) var(--rhi) var(--rhi) var(--rlo);padding:2px 0;font:13px/1.3 ui-monospace,"Courier New",monospace}
  body.retro .mlist .mrow{border:none;padding:3px 8px;gap:8px;border-radius:0}
  body.retro .mlist .mrow img, body.retro .mlist .mrow .ph{display:none}
  body.retro .mlist .mrow .ti, body.retro .mlist .mrow .mn{color:var(--rpltx)}
  body.retro .mlist .mrow .ch{color:var(--rpltx);opacity:.6}
  body.retro .mlist .mrow.now{background:var(--rsel)}
  body.retro .mlist .mrow.now .ti{color:#fff}
  .rskins{position:fixed;inset:0;z-index:60;background:#000c;display:grid;place-items:center;padding:16px}
  .rskins>div{background:#14181f;border:1px solid #333;border-radius:10px;padding:14px;max-width:560px;width:100%;max-height:86vh;overflow:auto;color:#ddd;font:14px system-ui,sans-serif}
  .rskins h3{margin:0 0 4px;font-size:16px}
  .rskins p{margin:0 0 12px;color:#999;font-size:13px}
  .rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
  .rgrid button{all:unset;cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid transparent;background:#0b0e13}
  .rgrid button.on{border-color:#f2a33a}
  .rgrid i{display:block;height:44px;position:relative}
  .rgrid i b{position:absolute;left:8px;top:10px;right:8px;height:22px;border:2px solid;font:700 13px/18px ui-monospace,monospace;padding-left:4px}
  .rgrid span{display:block;padding:6px 8px;font-size:12px}
  .rskins .rclose{margin-top:12px;width:100%;padding:10px;border-radius:8px;border:none;background:#f2a33a;color:#111;font-weight:700}
  `;
  const apply = () => {
    const r = document.documentElement.style, [, , f1, f2, hi, lo, lcd, tx, tx2, acc, btn, bt, pl, pltx, sel] = skin;
    Object.entries({rf1: f1, rf2: f2, rhi: hi, rlo: lo, rlcd: lcd, rtx: tx, rtx2: tx2, racc: acc, rbtn: btn, rbt: bt, rpl: pl, rpltx: pltx, rsel: sel})
      .forEach(([k, v]) => r.setProperty('--' + k, v));
    document.body.classList.toggle('retro', on);
    document.querySelectorAll('[data-retro]').forEach(b => { b.classList.toggle('on', on); });
  };
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  let deck, audio, cv, cx, raf = 0, an = null, ctx = null, bars = new Array(19).fill(0), peaks = new Array(19).fill(0), lastTitle = '';

  function build(){
    const player = document.getElementById('player'); if (!player || deck) return;
    deck = document.createElement('div'); deck.className = 'rdeck';
    deck.innerHTML = `<div class="rbar"><span class="rlogo">OFFLINE·90</span><span><button data-r="skin" aria-label="Cambiar tema">SKIN</button> <button data-r="off" aria-label="Volver al reproductor normal">✕</button></span></div>
      <div class="rmain"><div class="rlcd"><div class="rtime">00:00</div><canvas class="rvis" width="152" height="40"></canvas></div>
      <div class="rinfo"><div class="rmarq" data-noi18n><span></span></div>
      <div class="rmeta"><b class="rk">160</b>kbps <b>44</b>kHz <span class="rst">STEREO</span></div>
      <input type="range" class="rvol" min="0" max="1" step="0.01" value="1" aria-label="Volumen"></div></div>
      <input type="range" class="rseek" min="0" max="1000" value="0" aria-label="Posición en la canción">
      <div class="rctl"><button data-r="prev" aria-label="Anterior">⏮</button><button data-r="play" aria-label="Reproducir">▶</button><button data-r="pause" aria-label="Pausa">⏸</button><button data-r="stop" aria-label="Detener">⏹</button><button data-r="next" aria-label="Siguiente">⏭</button><span class="sp"></span><button data-r="shuf" aria-label="Aleatorio">🔀</button><button data-r="rep" aria-label="Repetir">🔁</button></div>`;
    player.querySelector('.in').prepend(deck);
    cv = deck.querySelector('.rvis'); cx = cv.getContext('2d');
    deck.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b) return; const a = audio, k = b.dataset.r;
      if (k === 'skin') return picker();
      if (k === 'off') return set(false);
      if (k === 'prev') document.getElementById('pprev')?.click();
      if (k === 'next') document.getElementById('pnext')?.click();
      if (k === 'shuf') document.getElementById('pshuf')?.click();
      if (k === 'rep') document.getElementById('prep')?.click();
      if (!a) return;
      if (k === 'play'){ wire(); a.play().catch(() => {}); }
      if (k === 'pause') a.paused ? a.play().catch(() => {}) : a.pause();
      if (k === 'stop'){ a.pause(); a.currentTime = 0; }
      sync();
    });
    const seek = deck.querySelector('.rseek'); let dragging = false;
    seek.addEventListener('input', () => { dragging = true; });
    seek.addEventListener('change', () => { if (audio && audio.duration) audio.currentTime = seek.value / 1000 * audio.duration; dragging = false; });
    deck.querySelector('.rvol').addEventListener('input', e => { if (audio) audio.volume = +e.target.value; });
    deck._seekBusy = () => dragging;
  }
  // espectro real (solo en compu): el audio pasa por un analizador. En el celular no se toca el audio,
  // para que siga sonando con la pantalla bloqueada; las barras se animan.
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
  function sync(){
    if (!deck) return;
    const a = audio, P = document.getElementById('player');
    P?.classList.toggle('raud', !!a && !!P.querySelector('#slot audio'));
    const title = (document.getElementById('now')?.textContent || '').trim();
    const tkey = title + '|' + Math.round(a?.duration || 0);
    if (tkey !== lastTitle){
      lastTitle = tkey; const span = deck.querySelector('.rmarq span');
      const n = typeof queue !== 'undefined' && typeof qi !== 'undefined' && qi >= 0 ? qi + 1 + '. ' : '';
      span.textContent = `${n}${title} (${fmt(a?.duration)})  ***  `;
      try { const it = library.find(i => i.name === current); if (it && a?.duration) deck.querySelector('.rk').textContent = Math.round(it.size * 8 / a.duration / 1000); } catch {}
    }
    deck.querySelector('.rtime').textContent = fmt(a?.currentTime);
    deck.querySelector('.rtime').classList.toggle('blink', !!a && a.paused && a.currentTime > 0);
    if (a && a.duration && !deck._seekBusy()) deck.querySelector('.rseek').value = Math.round(a.currentTime / a.duration * 1000);
    deck.querySelector('[data-r=shuf]').classList.toggle('on', !!document.getElementById('pshuf')?.classList.contains('on'));
    deck.querySelector('[data-r=rep]').classList.toggle('on', !!document.getElementById('prep')?.classList.contains('on'));
    deck.querySelector('[data-r=play]').classList.toggle('on', !!a && !a.paused);
  }
  function draw(){
    raf = 0;
    if (!on || !deck || document.hidden || !audio) return;
    const W = cv.width, H = cv.height, n = bars.length, w = Math.floor(W / n) - 1, playing = !audio.paused;
    let data = null; if (an){ data = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(data); }
    for (let i = 0; i < n; i++){
      let v;
      if (data) v = data[Math.min(data.length - 1, Math.floor(i * data.length / n))] / 255;
      else v = playing ? Math.min(1, bars[i] * 0.72 + Math.random() * (0.55 - i * 0.012) + (i < 4 ? 0.15 : 0)) : bars[i] * 0.85;
      bars[i] = v; peaks[i] = Math.max(v, peaks[i] - 0.025);
    }
    const st = getComputedStyle(document.documentElement), tx = st.getPropertyValue('--rtx').trim() || '#0f0', acc = st.getPropertyValue('--racc').trim() || '#f90';
    cx.clearRect(0, 0, W, H);
    for (let i = 0; i < n; i++){
      const h = Math.round(bars[i] * (H - 3)), x = i * (w + 1);
      const g = cx.createLinearGradient(0, H, 0, 0); g.addColorStop(0, tx); g.addColorStop(1, acc);
      cx.fillStyle = g; cx.fillRect(x, H - h, w, h);
      cx.fillStyle = acc; cx.fillRect(x, H - 2 - Math.round(peaks[i] * (H - 3)), w, 1);
    }
    raf = requestAnimationFrame(draw);
  }
  const loop = () => { if (!raf && on && !document.hidden) raf = requestAnimationFrame(draw); };
  function hook(){
    const a = document.querySelector('#slot audio');
    if (a && a !== audio){ audio = a; an = null;
      ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ended', 'volumechange'].forEach(ev => a.addEventListener(ev, () => { sync(); if (ev === 'play'){ wire(); loop(); } }));
      if (deck) deck.querySelector('.rvol').value = a.volume; }
    if (!a) audio = null;
    sync(); loop();
  }
  function picker(){
    const o = document.createElement('div'); o.className = 'rskins';
    o.innerHTML = `<div role="dialog" aria-label="Elige tu tema"><h3>Elige tu tema</h3><p>Se queda guardado en este dispositivo.</p><div class="rgrid">${SKINS.map(s =>
      `<button data-k="${s[0]}" class="${s[0] === skin[0] ? 'on' : ''}"><i style="background:linear-gradient(160deg,${s[2]},${s[3]})"><b style="background:${s[6]};color:${s[7]};border-color:${s[5]} ${s[4]} ${s[4]} ${s[5]}">01:23</b></i><span>${s[1]}</span></button>`).join('')}</div>
      <button class="rclose">Listo</button></div>`;
    o.addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (b){ skin = SKINS.find(s => s[0] === b.dataset.k) || SKINS[0]; LSset('vskin', skin[0]); apply(); o.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); return; }
      if (e.target === o || e.target.closest('.rclose')) o.remove();
    });
    document.body.append(o);
  }
  function set(v){ on = v; LSset('vretro', v ? '1' : '0'); apply(); if (v){ build(); hook(); } }
  window.Retro = {set, toggle: () => set(!on), picker, get on(){ return on; }, SKINS};
  document.addEventListener('click', e => { const b = e.target.closest('[data-retro]'); if (b){ e.preventDefault(); set(!on); if (on) picker(); } });
  document.addEventListener('visibilitychange', loop);
  document.addEventListener('pointerdown', () => { if (on && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }, true);
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    apply(); build();
    const slot = document.getElementById('slot');
    if (slot) new MutationObserver(hook).observe(slot, {childList: true});
    const now = document.getElementById('now');
    if (now) new MutationObserver(() => sync()).observe(now, {childList: true, characterData: true, subtree: true});
    hook();
  });
})();
