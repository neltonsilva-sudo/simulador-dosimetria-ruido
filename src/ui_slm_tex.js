// Decibelímetro — texturas procedurais (CanvasTexture): microtextura do plástico, poros da espuma, impressão da frente,
// atlas dos rótulos das teclas, verso (tampa da bateria) e o LCD reflexivo vivo com 7 segmentos. Sem marcas/logos.
const FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function tex(THREE, c, { srgb = true, repeat, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** microtextura do plástico (rugosidade + relevo): granulado fino de molde, levemente anisotrópico */
export function microTexture(THREE) {
  const N = 512; const [c, x] = cv(N, N);
  const im = x.createImageData(N, N), d = im.data;
  // ruído de valor em 2 oitavas (periódico) + grão fino
  const lat = (n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
  const L1 = lat(32), L2 = lat(128);
  const smp = (L, n, u, v) => { const X = u * n, Y = v * n, i = Math.floor(X), j = Math.floor(Y), fx = X - i, fy = Y - j;
    const g = (a, b) => L[((b % n + n) % n) * n + ((a % n + n) % n)]; const s = (t) => t * t * (3 - 2 * t);
    const a0 = g(i, j) + (g(i + 1, j) - g(i, j)) * s(fx), a1 = g(i, j + 1) + (g(i + 1, j + 1) - g(i, j + 1)) * s(fx); return a0 + (a1 - a0) * s(fy); };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N;
    const n = 0.55 * smp(L1, 32, u, v) + 0.3 * smp(L2, 128, u, v) + 0.15 * rnd();
    const val = Math.round(200 + (n - 0.5) * 70); const o = (j * N + i) * 4;
    d[o] = d[o + 1] = d[o + 2] = val; d[o + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  // riscos/manchas leves de uso
  x.globalAlpha = 0.12; x.strokeStyle = '#fff'; x.lineWidth = 0.8;
  for (let k = 0; k < 40; k++) { const a = rnd() * N, b = rnd() * N, l = 6 + rnd() * 30, an = rnd() * Math.PI; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); x.stroke(); }
  x.globalAlpha = 1;
  return tex(THREE, c, { srgb: false, repeat: [3, 3] });
}

/** espuma de células abertas: poros escuros com bordas claras (relevo) + máscara para a "penugem" da silhueta */
export function foamTextures(THREE) {
  const W = 512, H = 256; const [c, x] = cv(W, H);
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, W, H);
  const dot = (cx, cy, r, col) => { for (const ox of [-W, 0, W]) { x.fillStyle = col; x.beginPath(); x.arc(cx + ox, cy, r, 0, 7); x.fill(); } };
  for (let i = 0; i < 2600; i++) { const cx = rnd() * W, cy = rnd() * H, r = 1.2 + rnd() * 2.8; dot(cx + 0.7, cy + 0.7, r + 0.9, '#d4d4d4'); dot(cx, cy, r, `rgb(${20 + rnd() * 40 | 0},${20 + rnd() * 40 | 0},${20 + rnd() * 40 | 0})`); }
  for (let i = 0; i < 5000; i++) { const v = 90 + rnd() * 140 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd() * W, rnd() * H, 1, 1); }
  const bump = tex(THREE, c, { srgb: false, repeat: [3, 2] });
  const [f, y] = cv(256, 128); y.fillStyle = '#000'; y.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 2200; i++) { const v = 120 + rnd() * 135 | 0; y.fillStyle = `rgb(${v},${v},${v})`; const r = 0.6 + rnd() * 1.3; y.beginPath(); y.arc(rnd() * 256, rnd() * 128, r, 0, 7); y.fill(); }
  const fuzz = tex(THREE, f, { srgb: false, repeat: [4, 3], aniso: 4 });
  return { bump, fuzz };
}

/** impressão da frente (área entre visor e base): textos e sulcos escuros em volta das teclas */
export function facePrint(THREE, { x0, x1, y0, y1, keys, power }) {
  const W = Math.round(Math.min(736, 1020 * (x1 - x0) / (y1 - y0))), H = Math.round(W * (y1 - y0) / (x1 - x0)); const [c, x] = cv(W, H);
  const k = W / (x1 - x0), X = (v) => (v - x0) * k, Y = (v) => (y1 - v) * k;
  x.clearRect(0, 0, W, H);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillStyle = 'rgba(62,68,76,0.92)'; x.font = `700 ${0.0034 * k | 0}px ${FONT}`; x.fillText('DECIBELÍMETRO', W / 2, Y(0.0795));
  x.fillStyle = 'rgba(80,86,94,0.85)'; x.font = `500 ${0.0019 * k | 0}px ${FONT}`; x.fillText('Medidor de nível de pressão sonora', W / 2, Y(0.0763));
  x.fillStyle = 'rgba(80,86,94,0.75)'; x.font = `600 ${0.0015 * k | 0}px ${FONT}`; x.fillText('30 – 130 dB', W / 2, Y(0.0735));
  // sulcos (folga do teclado de borracha) com leve sombra
  x.filter = 'blur(2.5px)'; x.fillStyle = 'rgba(30,26,22,0.35)';
  const rr = (cx, cy, w, h, g) => { x.beginPath(); x.roundRect(X(cx - w / 2 - g), Y(cy + h / 2 + g), (w + 2 * g) * k, (h + 2 * g) * k, (h / 2 + g) * k * 0.9); };
  for (const q of keys) { rr(q.x, q.y - 0.0004, q.w, q.h, 0.0011); x.fill(); }
  x.beginPath(); x.arc(X(power.x), Y(power.y - 0.0004), (power.r + 0.0013) * k, 0, 7); x.fill();
  x.filter = 'none'; x.fillStyle = 'rgba(28,26,24,0.85)';
  for (const q of keys) { rr(q.x, q.y, q.w, q.h, 0.00055); x.fill(); }
  // anel cinza do botão de liga/desliga
  x.fillStyle = '#9ea3a8'; x.beginPath(); x.arc(X(power.x), Y(power.y), (power.r + 0.0011) * k, 0, 7); x.fill();
  x.fillStyle = 'rgba(28,26,24,0.9)'; x.beginPath(); x.arc(X(power.x), Y(power.y), (power.r + 0.0004) * k, 0, 7); x.fill();
  return tex(THREE, c);
}

/** atlas dos rótulos das teclas (branco sobre transparente); devolve a textura e as caixas UV de cada rótulo */
export function keyAtlas(THREE) {
  const W = 1024, H = 512; const [c, x] = cv(W, H);
  const cells = {}; const names = ['F/S', 'A/C', 'MAX/MIN', 'LEVEL'];
  x.fillStyle = '#f4f4f2'; x.textAlign = 'center'; x.textBaseline = 'middle';
  names.forEach((n, i) => {
    const cx = (i % 2) * 512, cy = Math.floor(i / 2) * 160;
    x.font = `700 ${n.length > 5 ? 92 : 104}px ${FONT}`; x.fillText(n, cx + 256, cy + 84, 470);
    cells[n] = { u0: cx / W, u1: (cx + 512) / W, v0: 1 - (cy + 160) / H, v1: 1 - cy / H, aspect: 512 / 160 };
  });
  // ícone de liga/desliga (célula quadrada)
  const px = 0, py = 336, S = 176, m = px + S / 2, n = py + S / 2;
  x.strokeStyle = '#f6f8ff'; x.lineCap = 'round'; x.lineWidth = 15;
  x.beginPath(); x.arc(m, n + 6, 50, -Math.PI * 0.3, Math.PI * 1.3); x.stroke();
  x.beginPath(); x.moveTo(m, n - 58); x.lineTo(m, n + 2); x.stroke();
  cells.power = { u0: px / W, u1: (px + S) / W, v0: 1 - (py + S) / H, v1: 1 - py / H, aspect: 1 };
  return { tex: tex(THREE, c, { aniso: 16 }), cells };
}

/** verso: tampa da bateria (sulco), ranhuras de pega e texto em relevo */
export function backPrint(THREE, { x0, x1, y0, y1 }) {
  const W = 384, H = Math.round(W * (y1 - y0) / (x1 - x0)); const [c, x] = cv(W, H);
  const k = W / (x1 - x0), X = (v) => (v - x0) * k, Y = (v) => (y1 - v) * k;
  const rr = (ax, ay, bx, by, r) => { x.beginPath(); x.roundRect(X(ax), Y(by), (bx - ax) * k, (by - ay) * k, r * k); };
  x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.55)'; rr(-0.0192, 0.0262 - 0.0003, 0.0192, 0.1048 - 0.0003, 0.004); x.stroke();
  x.lineWidth = 2.6; x.strokeStyle = 'rgba(40,36,30,0.6)'; rr(-0.0192, 0.0262, 0.0192, 0.1048, 0.004); x.stroke();
  for (let i = 0; i < 5; i++) { const yy = 0.034 + i * 0.0024;
    x.lineWidth = 2.4; x.strokeStyle = 'rgba(40,36,30,0.45)'; x.beginPath(); x.moveTo(X(-0.006), Y(yy)); x.lineTo(X(0.006), Y(yy)); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.moveTo(X(-0.006), Y(yy) + 2.4); x.lineTo(X(0.006), Y(yy) + 2.4); x.stroke(); }
  x.textAlign = 'center'; x.font = `600 ${0.0022 * k | 0}px ${FONT}`;
  x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillText('BATERIA 9 V', W / 2 + 1, Y(0.06) + 1);
  x.fillStyle = 'rgba(60,56,50,0.55)'; x.fillText('BATERIA 9 V', W / 2, Y(0.06));
  x.font = `500 ${0.0016 * k | 0}px ${FONT}`; x.fillStyle = 'rgba(70,66,60,0.5)'; x.fillText('▲ ABRIR', W / 2, Y(0.0985));
  return tex(THREE, c);
}

// ── LCD reflexivo (7 segmentos) ──
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
export function makeLCD(THREE) {
  const LW = 512, LH = 480, S = 1.6; const [c, lx] = cv(LW, LH);
  const t = tex(THREE, c, { aniso: 16 });
  // fundo pré-renderizado (gradiente, brilho difuso, sombra das paredes internas, borda escura do vidro)
  const [bc, bx] = cv(LW, LH);
  { const g = bx.createLinearGradient(0, 0, LW * 0.3, LH); g.addColorStop(0, '#bcc6b0'); g.addColorStop(0.55, '#adb8a2'); g.addColorStop(1, '#9eaa94');
    bx.fillStyle = g; bx.fillRect(0, 0, LW, LH);
    const r = bx.createRadialGradient(LW * 0.35, LH * 0.25, 10, LW * 0.4, LH * 0.35, LW * 0.8); r.addColorStop(0, 'rgba(255,255,245,0.10)'); r.addColorStop(1, 'rgba(255,255,245,0)');
    bx.fillStyle = r; bx.fillRect(0, 0, LW, LH);
    for (let i = 0; i < 9000; i++) { bx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '40,50,40'},0.025)`; bx.fillRect(rnd() * LW, rnd() * LH, 2, 2); }
    // sombra interna (parede do visor) mais forte no topo/esquerda
    const sh = (x0, y0, x1, y1, a) => { const g2 = bx.createLinearGradient(x0, y0, x1, y1); g2.addColorStop(0, `rgba(30,36,28,${a})`); g2.addColorStop(1, 'rgba(30,36,28,0)'); bx.fillStyle = g2; bx.fillRect(0, 0, LW, LH); };
    sh(0, 0, 0, 34, 0.38); sh(0, 0, 26, 0, 0.26); sh(LW, 0, LW - 18, 0, 0.16); sh(0, LH, 0, LH - 16, 0.14);
    bx.strokeStyle = 'rgba(24,28,24,0.55)'; bx.lineWidth = 7; bx.strokeRect(3.5, 3.5, LW - 7, LH - 7); }
  function digit(x, y, w, h, ch, on, off) {
    const tt = w * 0.235, hh = h / 2, gp = tt * 0.1;
    const p = (pts) => { lx.beginPath(); pts.forEach(([a, b], i) => (i ? lx.lineTo(x + a, y + b) : lx.moveTo(x + a, y + b))); lx.closePath(); lx.fill(); };
    const H = (yy) => [[tt * 0.55 + gp, yy], [tt + gp, yy - tt / 2], [w - tt - gp, yy - tt / 2], [w - tt * 0.55 - gp, yy], [w - tt - gp, yy + tt / 2], [tt + gp, yy + tt / 2]];
    const V = (xx, y0, y1) => [[xx, y0 + tt * 0.55 + gp], [xx + tt / 2, y0 + tt + gp], [xx + tt / 2, y1 - tt - gp], [xx, y1 - tt * 0.55 - gp], [xx - tt / 2, y1 - tt - gp], [xx - tt / 2, y0 + tt + gp]];
    const Sg = { a: H(tt / 2), g: H(hh), d: H(h - tt / 2), f: V(tt / 2, 0, hh), b: V(w - tt / 2, 0, hh), e: V(tt / 2, hh, h), c: V(w - tt / 2, hh, h) };
    const lit = SEG[ch] || '';
    for (const k of 'abcdefg') { const L = lit.includes(k); if (!L && !off) continue; lx.fillStyle = L ? on : off; p(Sg[k]); }
  }
  // desenha todo o conteúdo; mode 'shadow' (só o aceso, cor única) ou 'main' (aceso + segmentos fantasma)
  function content(val, mode) {
    const sh = mode === 'shadow', on = sh ? 'rgba(25,35,25,0.30)' : '#121516', off = sh ? null : 'rgba(40,52,40,0.055)';
    const txt = (s, x, y, lit) => { if (!lit && sh) return; lx.fillStyle = lit ? on : off; lx.fillText(s, x, y); };
    lx.font = `700 26px ${FONT}`; lx.textAlign = 'left';
    txt('SLOW', 18, 40, true); txt('FAST', 82, 40, false); txt('MAX', 144, 40, false); txt('MIN', 196, 40, false);
    txt('A', 262, 40, true); txt('C', 286, 40, false);
    lx.save(); lx.transform(1, 0, -0.1, 1, 14, 0);
    const ds = val.toFixed(1).replace('.', ''); // "90.0" → "900" (3 ou 4 dígitos, ponto antes do último)
    const n = ds.length, W = n > 3 ? 48 : 64, Hh = 114, Y0 = 72, GAP = 10, DP = 16;
    const X0 = 252 - (n * W + (n - 1) * GAP + DP), dx = (i) => X0 + i * (W + GAP) + (i === n - 1 ? DP : 0);
    if (!sh) for (let i = 0; i < n; i++) digit(dx(i), Y0, W, Hh, '', on, off);   // segmentos apagados (fantasma)
    for (let i = 0; i < n; i++) digit(dx(i), Y0, W, Hh, ds[i], on, null);
    lx.fillStyle = on; lx.beginPath(); lx.arc(dx(n - 1) - (GAP + DP) / 2 + 1, Y0 + Hh - 6, 7.5, 0, 7); lx.fill();
    lx.restore();
    lx.fillStyle = on; lx.font = `700 30px ${FONT}`; lx.fillText('dB', 258, 160); lx.font = `700 22px ${FONT}`; lx.fillText('A', 270, 188);
    // barra analógica 30–130 dB
    const bx2 = 22, by = 222, bw = 276, nb = Math.round(Math.max(0, Math.min(1, (val - 30) / 100)) * 46);
    for (let i = 0; i < 46; i++) { if (i >= nb && sh) continue; lx.fillStyle = i < nb ? on : off; lx.fillRect(bx2 + i * 6, by, 4, 16); }
    lx.fillStyle = on; lx.fillRect(bx2, by + 20, bw - 2, 2);
    lx.font = `600 16px ${FONT}`; lx.textAlign = 'center';
    [30, 50, 70, 90, 110, 130].forEach((v, i) => { lx.fillRect(bx2 + i * (bw / 5) - 1, by + 20, 2, 6); lx.fillText(String(v), bx2 + i * (bw / 5), by + 43); });
    lx.textAlign = 'left'; lx.font = `700 15px ${FONT}`; txt('BAT', 22, 290, false); txt('OVER', 62, 290, false); txt('UNDER', 110, 290, false);
  }
  function draw(val) {
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.filter = 'none'; lx.drawImage(bc, 0, 0);
    // sombra dos segmentos no refletor (deslocada para baixo/direita, desfocada)
    lx.setTransform(S, 0, 0, S, 3.2, 4.2); lx.filter = 'blur(2.2px)'; content(val, 'shadow');
    lx.filter = 'none'; lx.setTransform(S, 0, 0, S, 0, 0); content(val, 'main');
    lx.setTransform(1, 0, 0, 1, 0, 0);
    t.needsUpdate = true;
  }
  return { tex: t, draw };
}
