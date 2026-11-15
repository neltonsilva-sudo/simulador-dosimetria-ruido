// Decibelímetro — texturas procedurais (CanvasTexture, geradas uma vez): microtextura do ABS (rugosidade + normal map
// de granulado de molde e marcas sutis de dedo), poros da espuma, impressão da frente (serigrafia + rebaixos do teclado),
// atlas das legendas das teclas (serigrafia levemente gasta), verso (tampa da bateria + etiqueta de especificações),
// cabeça de parafuso, grade da cápsula ½" e o LCD reflexivo vivo com 7 segmentos e ícones. Sem marcas/logos.
const FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function tex(THREE, c, { srgb = true, repeat, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// ruído de valor periódico (lattice n×n)
const lattice = (n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
const vnoise = (L, n, u, v) => { const X = u * n, Y = v * n, i = Math.floor(X), j = Math.floor(Y), fx = X - i, fy = Y - j;
  const g = (a, b) => L[((b % n + n) % n) * n + ((a % n + n) % n)]; const s = (t) => t * t * (3 - 2 * t);
  const a0 = g(i, j) + (g(i + 1, j) - g(i, j)) * s(fx), a1 = g(i, j + 1) + (g(i + 1, j + 1) - g(i, j + 1)) * s(fx); return a0 + (a1 - a0) * s(fy); };

/** microtextura do plástico (rugosidade + relevo): granulado fino de molde, levemente anisotrópico */
export function microTexture(THREE) {
  const N = 512; const [c, x] = cv(N, N);
  const im = x.createImageData(N, N), d = im.data;
  const L1 = lattice(32), L2 = lattice(128);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N;
    const n = 0.55 * vnoise(L1, 32, u, v) + 0.3 * vnoise(L2, 128, u, v) + 0.15 * rnd();
    const val = Math.round(200 + (n - 0.5) * 70); const o = (j * N + i) * 4;
    d[o] = d[o + 1] = d[o + 2] = val; d[o + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  x.globalAlpha = 0.12; x.strokeStyle = '#fff'; x.lineWidth = 0.8;
  for (let k = 0; k < 40; k++) { const a = rnd() * N, b = rnd() * N, l = 6 + rnd() * 30, an = rnd() * Math.PI; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); x.stroke(); }
  x.globalAlpha = 1;
  return tex(THREE, c, { srgb: false, repeat: [3, 3] });
}

/** ABS texturizado (acabamento de molde tipo "VDI 24"): normal map do granulado + mapa de rugosidade com variação
 *  larga e marcas de dedo bem sutis (manchas mais lisas). Mesma escala de UV da casca (uvScale 0.18, repeat 3 → 6 cm). */
export function shellMaps(THREE) {
  const N = 1024, H = new Float32Array(N * N);
  const A = lattice(160), B = lattice(320), C = lattice(24);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N;
    H[j * N + i] = 0.5 * vnoise(A, 160, u, v) + 0.35 * vnoise(B, 320, u, v) + 0.15 * rnd();
  }
  // normal map (Sobel do relevo)
  const [nc, nx] = cv(N, N); const ni = nx.createImageData(N, N), nd = ni.data; const k = 2.2;
  const h = (i, j) => H[((j + N) % N) * N + ((i + N) % N)];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = (h(i + 1, j) - h(i - 1, j)) * k, dy = (h(i, j + 1) - h(i, j - 1)) * k, l = Math.hypot(dx, dy, 1), o = (j * N + i) * 4;
    nd[o] = (-dx / l * 0.5 + 0.5) * 255; nd[o + 1] = (dy / l * 0.5 + 0.5) * 255; nd[o + 2] = (1 / l * 0.5 + 0.5) * 255; nd[o + 3] = 255;
  }
  nx.putImageData(ni, 0, 0);
  // rugosidade: base ≈ 0,56 com variação larga suave e granulado
  const R = 512; const [rc, rx] = cv(R, R); const ri = rx.createImageData(R, R), rd = ri.data;
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
    const u = i / R, v = j / R, n = vnoise(C, 24, u, v), g = H[(j * 2) * N + i * 2];
    const val = Math.round(255 * (0.53 + (n - 0.5) * 0.08 + (g - 0.5) * 0.1)); const o = (j * R + i) * 4;
    rd[o] = rd[o + 1] = rd[o + 2] = val; rd[o + 3] = 255;
  }
  rx.putImageData(ri, 0, 0);
  // digitais: elipses de cristas concêntricas um pouco mais lisas (sutil: ambiente limpo)
  for (let f = 0; f < 3; f++) {
    const cx = 60 + rnd() * (R - 120), cy = 60 + rnd() * (R - 120), a = 26 + rnd() * 12, an = rnd() * Math.PI;
    rx.save(); rx.translate(cx, cy); rx.rotate(an); rx.scale(1, 0.72);
    for (let r = 3; r < a; r += 2.4) { rx.globalAlpha = 0.07 * (1 - r / a); rx.strokeStyle = '#000'; rx.lineWidth = 1.1; rx.beginPath(); rx.arc(0, 0, r, 0, Math.PI * 2); rx.stroke(); }
    rx.restore();
  }
  rx.globalAlpha = 1;
  return { normal: tex(THREE, nc, { srgb: false, repeat: [3, 3], aniso: 8 }), rough: tex(THREE, rc, { srgb: false, repeat: [3, 3], aniso: 8 }) };
}

/** espuma de células abertas: poros escuros com bordas claras (relevo) + máscara para a "penugem" da silhueta */
export function foamTextures(THREE) {
  const W = 1024, H = 512; const [c, x] = cv(W, H);
  x.fillStyle = '#8c8c8c'; x.fillRect(0, 0, W, H);
  const dot = (cx, cy, r, col) => { for (const ox of [-W, 0, W]) { x.fillStyle = col; x.beginPath(); x.arc(cx + ox, cy, r, 0, 7); x.fill(); } };
  // células grandes (≈ 0,6–1 mm) com parede clara, depois células menores por cima
  for (let i = 0; i < 2600; i++) { const cx = rnd() * W, cy = rnd() * H, r = 3 + rnd() * 4.5; dot(cx + 1, cy + 1, r + 1.6, '#d6d6d6'); dot(cx, cy, r, `rgb(${10 + rnd() * 30 | 0},${10 + rnd() * 30 | 0},${10 + rnd() * 30 | 0})`); }
  for (let i = 0; i < 5000; i++) { const cx = rnd() * W, cy = rnd() * H, r = 1.2 + rnd() * 2; dot(cx + 0.6, cy + 0.6, r + 0.9, '#c4c4c4'); dot(cx, cy, r, '#262626'); }
  for (let i = 0; i < 9000; i++) { const v = 90 + rnd() * 140 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
  const bump = tex(THREE, c, { srgb: false, repeat: [2, 1.4] });
  const [f, y] = cv(256, 128); y.fillStyle = '#000'; y.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 2200; i++) { const v = 120 + rnd() * 135 | 0; y.fillStyle = `rgb(${v},${v},${v})`; const r = 0.6 + rnd() * 1.3; y.beginPath(); y.arc(rnd() * 256, rnd() * 128, r, 0, 7); y.fill(); }
  const fuzz = tex(THREE, f, { srgb: false, repeat: [4, 3], aniso: 4 });
  return { bump, fuzz };
}

/** impressão da frente (área entre visor e base): serigrafia e os rebaixos da casca em volta de cada tecla */
export function facePrint(THREE, { x0, x1, y0, y1, keys, power }) {
  const W = 1024, H = Math.round(W * (y1 - y0) / (x1 - x0)); const [c, x] = cv(W, H);
  const k = W / (x1 - x0), X = (v) => (v - x0) * k, Y = (v) => (y1 - v) * k;
  x.clearRect(0, 0, W, H);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillStyle = 'rgba(58,63,70,0.94)'; x.font = `700 ${0.0031 * k | 0}px ${FONT}`; x.fillText('DECIBELÍMETRO', W / 2, Y(0.0805));
  x.fillStyle = 'rgba(78,84,92,0.88)'; x.font = `500 ${0.00165 * k | 0}px ${FONT}`; x.fillText('Medidor de nível sonoro', W / 2, Y(0.0776));
  x.font = `600 ${0.0014 * k | 0}px ${FONT}`; x.fillStyle = 'rgba(78,84,92,0.8)'; x.fillText('Classe 2  ·  30 – 130 dB', W / 2, Y(0.0752));
  // filete fino de separação
  x.fillStyle = 'rgba(90,96,104,0.35)'; x.fillRect(X(-0.012), Y(0.0738), 0.024 * k, Math.max(1, 0.00012 * k));
  // rodapé
  x.font = `500 ${0.0012 * k | 0}px ${FONT}`; x.fillStyle = 'rgba(88,94,102,0.7)'; x.fillText('IEC 61672-1  ·  Ponderação A/C  ·  F/S', W / 2, Y(0.0242));
  // rebaixos (furos da casca por onde passam as teclas): halo de oclusão + parede escura + quina iluminada embaixo
  const rr = (cx, cy, w, h, g) => { x.beginPath(); x.roundRect(X(cx - w / 2 - g), Y(cy + h / 2 + g), (w + 2 * g) * k, (h + 2 * g) * k, Math.min((h / 2 + g) * k * 0.92, (w / 2 + g) * k)); };
  const hole = (fn) => {
    x.filter = `blur(${0.0005 * k}px)`; x.fillStyle = 'rgba(40,34,28,0.26)'; fn(0.0016, -0.0003); x.fill();
    x.filter = 'none';
    x.fillStyle = 'rgba(255,252,244,0.55)'; fn(0.00105, -0.00012); x.fill();          // quina inferior pega luz
    x.fillStyle = 'rgba(26,24,22,0.94)'; fn(0.00095, 0.00006); x.fill();               // folga escura
  };
  for (const q of keys) hole((g, dy) => rr(q.x, q.y + dy, q.w, q.h, g));
  hole((g, dy) => { x.beginPath(); x.arc(X(power.x), Y(power.y + dy), (power.r + g) * k, 0, 7); });
  return tex(THREE, c, { aniso: 16 });
}

/** desgaste da serigrafia: apaga pontinhos e riscos (destination-out) */
function wear(x, x0, y0, w, h, n, a) {
  x.save(); x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) { x.globalAlpha = a * (0.3 + rnd() * 0.7); x.beginPath(); x.arc(x0 + rnd() * w, y0 + rnd() * h, 0.8 + rnd() * 2.6, 0, 7); x.fill(); }
  x.lineWidth = 1.2; for (let i = 0; i < n / 30; i++) { x.globalAlpha = a * 0.6; const a0 = x0 + rnd() * w, b0 = y0 + rnd() * h; x.beginPath(); x.moveTo(a0, b0); x.lineTo(a0 + 20 + rnd() * 40, b0 + (rnd() - 0.5) * 8); x.stroke(); }
  x.restore();
}

/** atlas das legendas das teclas (serigrafia branca levemente gasta); devolve a textura e as caixas UV */
export function keyAtlas(THREE) {
  const W = 1024, H = 512; const [c, x] = cv(W, H);
  const cells = {}; const names = ['F/S', 'A/C', 'MAX/MIN', 'LEVEL'];
  x.fillStyle = '#e8e8e2'; x.textAlign = 'center'; x.textBaseline = 'middle';
  names.forEach((n, i) => {
    const cx = (i % 2) * 512, cy = Math.floor(i / 2) * 160;
    x.font = `700 ${n.length > 5 ? 88 : 98}px ${FONT}`; x.fillText(n, cx + 256, cy + 84, 470);
    cells[n] = { u0: cx / W, u1: (cx + 512) / W, v0: 1 - (cy + 160) / H, v1: 1 - cy / H, aspect: 512 / 160 };
    wear(x, cx + 40, cy + 20, 432, 128, 220, 0.75);
  });
  // ícone de liga/desliga (célula quadrada), impresso em azul claro
  const px = 0, py = 336, S = 176, m = px + S / 2, n = py + S / 2;
  x.strokeStyle = '#9fc6ee'; x.lineCap = 'round'; x.lineWidth = 15;
  x.beginPath(); x.arc(m, n + 6, 50, -Math.PI * 0.3, Math.PI * 1.3); x.stroke();
  x.beginPath(); x.moveTo(m, n - 58); x.lineTo(m, n + 2); x.stroke();
  wear(x, px + 20, py + 20, S - 40, S - 40, 90, 0.7);
  cells.power = { u0: px / W, u1: (px + S) / W, v0: 1 - (py + S) / H, v1: 1 - py / H, aspect: 1 };
  return { tex: tex(THREE, c, { aniso: 16 }), cells };
}

/** verso: sulco da tampa da bateria, ranhuras de pega, seta e etiqueta de especificações (genérica, sem marca) */
export function backPrint(THREE, { x0, x1, y0, y1 }) {
  const W = 768, H = Math.round(W * (y1 - y0) / (x1 - x0)); const [c, x] = cv(W, H);
  const k = W / (x1 - x0), X = (v) => (v - x0) * k, Y = (v) => (y1 - v) * k;
  const rr = (ax, ay, bx, by, r) => { x.beginPath(); x.roundRect(X(ax), Y(by), (bx - ax) * k, (by - ay) * k, r * k); };
  // sulco da tampa: luz na borda de baixo, fenda escura
  x.lineWidth = 0.0003 * k; x.strokeStyle = 'rgba(255,253,246,0.6)'; rr(-0.0192, 0.0262 - 0.00028, 0.0192, 0.1048 - 0.00028, 0.004); x.stroke();
  x.lineWidth = 0.00028 * k; x.strokeStyle = 'rgba(30,26,22,0.78)'; rr(-0.0192, 0.0262, 0.0192, 0.1048, 0.004); x.stroke();
  // ranhuras de pega da tampa (relevo)
  for (let i = 0; i < 6; i++) { const yy = 0.032 + i * 0.0021;
    x.lineWidth = 0.00045 * k; x.lineCap = 'round';
    x.strokeStyle = 'rgba(40,36,30,0.42)'; x.beginPath(); x.moveTo(X(-0.0065), Y(yy)); x.lineTo(X(0.0065), Y(yy)); x.stroke();
    x.strokeStyle = 'rgba(255,255,250,0.5)'; x.beginPath(); x.moveTo(X(-0.0065), Y(yy - 0.0004)); x.lineTo(X(0.0065), Y(yy - 0.0004)); x.stroke(); }
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = `600 ${0.0015 * k | 0}px ${FONT}`; x.fillStyle = 'rgba(70,66,60,0.55)'; x.fillText('▼ ABRIR', W / 2, Y(0.0475));
  // etiqueta prateada de especificações (adesivo com cantos arredondados)
  const lx0 = -0.0155, lx1 = 0.0155, ly0 = 0.056, ly1 = 0.097;
  x.fillStyle = 'rgba(30,26,22,0.25)'; rr(lx0 + 0.0002, ly0 - 0.0003, lx1 + 0.0002, ly1 - 0.0003, 0.0012); x.fill();
  const g = x.createLinearGradient(X(lx0), Y(ly1), X(lx1), Y(ly0)); g.addColorStop(0, '#d9dbdc'); g.addColorStop(0.5, '#c9cccd'); g.addColorStop(1, '#d4d6d7');
  x.fillStyle = g; rr(lx0, ly0, lx1, ly1, 0.0012); x.fill();
  x.strokeStyle = 'rgba(40,40,40,0.8)'; x.lineWidth = 0.00018 * k; rr(lx0 + 0.0008, ly0 + 0.0008, lx1 - 0.0008, ly1 - 0.0008, 0.0006); x.stroke();
  x.fillStyle = '#222'; x.textAlign = 'left';
  const L = (s, yy, sz = 0.00145, wgt = 600) => { x.font = `${wgt} ${sz * k | 0}px ${FONT}`; x.fillText(s, X(lx0 + 0.0016), Y(yy)); };
  L('MEDIDOR DE NÍVEL SONORO', 0.0925, 0.0019, 700);
  L('Classe 2  ·  IEC 61672-1', 0.0895);
  L('Faixa: 30 – 130 dB', 0.0868); L('Ponderação: A / C   Resposta: F / S', 0.0841);
  L('Microfone: eletreto ½"', 0.0814); L('Alimentação: bateria 9 V', 0.0787);
  L('Nº de série: 2311-04718', 0.0755, 0.0014, 700);
  x.fillStyle = '#333'; x.fillRect(X(0.0028), Y(0.0705), 0.0108 * k, 0.0001 * k); // assinatura do lote
  // código de barras
  let bx = X(lx0 + 0.0016); const by = Y(0.0612), bh = 0.0058 * k;
  while (bx < X(lx1 - 0.0018)) { const w = (1 + (rnd() * 3 | 0)) * 0.00011 * k; x.fillStyle = '#1b1b1b'; x.fillRect(bx, by - bh, w, bh); bx += w + (1 + (rnd() * 3 | 0)) * 0.00011 * k; }
  // aviso de descarte (símbolo simples) e ondulação leve da etiqueta (brilho)
  x.strokeStyle = '#222'; x.lineWidth = 0.00014 * k; const sx = X(0.0115), sy = Y(0.0725), sw = 0.0026 * k;
  x.strokeRect(sx, sy, sw * 0.8, sw); x.beginPath(); x.moveTo(sx - sw * 0.1, sy - sw * 0.1); x.lineTo(sx + sw * 0.9, sy + sw * 1.1); x.moveTo(sx + sw * 0.9, sy - sw * 0.1); x.lineTo(sx - sw * 0.1, sy + sw * 1.1); x.stroke();
  return tex(THREE, c, { aniso: 16 });
}

/** cabeça de parafuso Phillips (cor + relevo) */
export function screwTex(THREE) {
  const N = 128; const [c, x] = cv(N, N);
  const g = x.createRadialGradient(N * 0.42, N * 0.4, 4, N / 2, N / 2, N / 2); g.addColorStop(0, '#d2d4d6'); g.addColorStop(0.8, '#8e9195'); g.addColorStop(1, '#55585c');
  x.fillStyle = g; x.beginPath(); x.arc(N / 2, N / 2, N / 2, 0, 7); x.fill();
  x.strokeStyle = '#1a1b1c'; x.lineWidth = 14; x.lineCap = 'butt';
  x.beginPath(); x.moveTo(N * 0.24, N / 2); x.lineTo(N * 0.76, N / 2); x.moveTo(N / 2, N * 0.24); x.lineTo(N / 2, N * 0.76); x.stroke();
  return tex(THREE, c, { aniso: 8 });
}

/** grade de proteção da cápsula ½": lateral com janelas verticais (u = volta) e topo com furos radiais */
export function grilleTex(THREE) {
  const [c, x] = cv(512, 128); x.fillStyle = '#b9bcbf'; x.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 16; i++) { const cx = i * 32 + 16; x.fillStyle = '#0d0e0f'; x.beginPath(); x.roundRect(cx - 7, 30, 14, 76, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(cx - 9, 108, 18, 2); }
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 512, 6); x.fillRect(0, 122, 512, 6);
  const side = tex(THREE, c, { aniso: 8 }); side.wrapS = THREE.RepeatWrapping;
  const N = 256; const [t, y] = cv(N, N); y.fillStyle = '#b9bcbf'; y.fillRect(0, 0, N, N);
  y.fillStyle = '#0d0e0f';
  for (let i = 0; i < 12; i++) { y.save(); y.translate(N / 2, N / 2); y.rotate(i * Math.PI / 6); y.beginPath(); y.roundRect(-8, 34, 16, 70, 8); y.fill(); y.restore(); }
  y.beginPath(); y.arc(N / 2, N / 2, 18, 0, 7); y.fill();
  y.strokeStyle = 'rgba(0,0,0,0.35)'; y.lineWidth = 6; y.beginPath(); y.arc(N / 2, N / 2, N / 2 - 4, 0, 7); y.stroke();
  return { side, top: tex(THREE, t, { aniso: 8 }) };
}

// ── LCD reflexivo (7 segmentos + ícones) ──
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
/** desenho 320×300 (unidades de projeto) num canvas 768×720. draw(st): st = { val, power, boot, weight:'A'|'C', resp:'F'|'S', max, cal } */
export function makeLCD(THREE) {
  const LW = 768, LH = 720, S = LW / 320; const [c, lx] = cv(LW, LH);
  const t = tex(THREE, c, { aniso: 16 });
  // fundo pré-renderizado: refletor cinza-esverdeado, brilho difuso, granulado, sombra das paredes internas
  const [bc, bx] = cv(LW, LH);
  { const g = bx.createLinearGradient(0, 0, LW * 0.3, LH); g.addColorStop(0, '#b3bca6'); g.addColorStop(0.55, '#a5af98'); g.addColorStop(1, '#97a28b');
    bx.fillStyle = g; bx.fillRect(0, 0, LW, LH);
    const r = bx.createRadialGradient(LW * 0.35, LH * 0.25, 10, LW * 0.4, LH * 0.35, LW * 0.8); r.addColorStop(0, 'rgba(255,255,245,0.09)'); r.addColorStop(1, 'rgba(255,255,245,0)');
    bx.fillStyle = r; bx.fillRect(0, 0, LW, LH);
    for (let i = 0; i < 16000; i++) { bx.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '40,50,40'},0.025)`; bx.fillRect(rnd() * LW, rnd() * LH, 2, 2); }
    const sh = (x0, y0, x1, y1, a) => { const g2 = bx.createLinearGradient(x0, y0, x1, y1); g2.addColorStop(0, `rgba(30,36,28,${a})`); g2.addColorStop(1, 'rgba(30,36,28,0)'); bx.fillStyle = g2; bx.fillRect(0, 0, LW, LH); };
    sh(0, 0, 0, 50, 0.42); sh(0, 0, 38, 0, 0.28); sh(LW, 0, LW - 26, 0, 0.16); sh(0, LH, 0, LH - 22, 0.14);
    bx.strokeStyle = 'rgba(24,28,24,0.6)'; bx.lineWidth = 10; bx.strokeRect(5, 5, LW - 10, LH - 10); }

  function digit(x, y, w, h, lit, on, off) {
    const tt = w * 0.22, hh = h / 2, gp = tt * 0.1;
    const p = (pts) => { lx.beginPath(); pts.forEach(([a, b], i) => (i ? lx.lineTo(x + a, y + b) : lx.moveTo(x + a, y + b))); lx.closePath(); lx.fill(); };
    const H = (yy) => [[tt * 0.55 + gp, yy], [tt + gp, yy - tt / 2], [w - tt - gp, yy - tt / 2], [w - tt * 0.55 - gp, yy], [w - tt - gp, yy + tt / 2], [tt + gp, yy + tt / 2]];
    const V = (xx, y0, y1) => [[xx, y0 + tt * 0.55 + gp], [xx + tt / 2, y0 + tt + gp], [xx + tt / 2, y1 - tt - gp], [xx, y1 - tt * 0.55 - gp], [xx - tt / 2, y1 - tt - gp], [xx - tt / 2, y0 + tt + gp]];
    const Sg = { a: H(tt / 2), g: H(hh), d: H(h - tt / 2), f: V(tt / 2, 0, hh), b: V(w - tt / 2, 0, hh), e: V(tt / 2, hh, h), c: V(w - tt / 2, hh, h) };
    for (const k of 'abcdefg') { const L = lit.includes(k); if (!L && !off) continue; lx.fillStyle = L ? on : off; p(Sg[k]); }
  }
  // desenha todo o conteúdo; mode 'shadow' (só o aceso, cor única) ou 'main' (aceso + fantasmas)
  function content(st, mode) {
    const sh = mode === 'shadow', all = !!st.boot;
    const on = sh ? 'rgba(25,35,25,0.32)' : '#131617', off = sh ? null : 'rgba(38,50,38,0.07)';
    const ic = (lit, fn) => { lit = lit || all; if (!lit && sh) return; lx.fillStyle = lx.strokeStyle = lit ? on : off; fn(); };
    const txt = (s, x, y, lit, font) => ic(lit, () => { if (font) lx.font = font; lx.fillText(s, x, y); });
    lx.textAlign = 'left'; lx.textBaseline = 'alphabetic';
    const F1 = `700 21px ${FONT}`;
    txt('FAST', 16, 36, st.resp === 'F', F1); txt('SLOW', 66, 36, st.resp === 'S', F1);
    txt('MAX', 124, 36, st.max, F1); txt('MIN', 168, 36, false, F1);
    // CAL em caixa (fica bem visível no modo de calibração)
    ic(st.cal, () => { lx.lineWidth = 2.2; lx.strokeRect(208, 17, 44, 24); lx.font = `700 19px ${FONT}`; lx.fillText('CAL', 214, 36); });
    // bateria (3 barras)
    ic(true, () => { lx.lineWidth = 2.2; lx.strokeRect(264, 19, 34, 17); lx.fillRect(298, 24, 4, 7); for (let i = 0; i < 3; i++) lx.fillRect(268 + i * 10, 23, 7, 9); });
    // dígitos: 4 posições, ponto antes do último
    lx.save(); lx.transform(1, 0, -0.09, 1, 12, 0);
    const v = Math.max(0, Math.min(199.9, st.val));
    let ds = all ? '8888' : v.toFixed(1).replace('.', ''); ds = ds.padStart(4, ' ');
    const W = 50, Hh = 112, Y0 = 58, GAP = 9, DP = 13, X0 = 246 - (4 * W + 3 * GAP + DP), dx = (i) => X0 + i * (W + GAP) + (i === 3 ? DP : 0);
    for (let i = 0; i < 4; i++) {
      const lit = SEG[ds[i]] || '';
      if (!sh) digit(dx(i), Y0, W, Hh, lit, on, off); else if (lit) digit(dx(i), Y0, W, Hh, lit, on, null);
    }
    ic(true, () => { lx.beginPath(); lx.arc(dx(3) - (GAP + DP) / 2 + 1, Y0 + Hh - 6, 7, 0, 7); lx.fill(); });
    lx.restore();
    txt('dB', 256, 132, true, `700 30px ${FONT}`);
    txt('A', 258, 166, st.weight !== 'C', `700 26px ${FONT}`); txt('C', 282, 166, st.weight === 'C', `700 26px ${FONT}`);
    // barra analógica 30–130 dB
    const bx2 = 20, by = 196, bw = 280, NB = 50, nb = all ? NB : Math.round(Math.max(0, Math.min(1, (v - 30) / 100)) * NB);
    for (let i = 0; i < NB; i++) { const L = i < nb; if (!L && sh) continue; lx.fillStyle = L ? on : off; lx.fillRect(bx2 + i * 5.6, by, 3.6, 17); }
    ic(true, () => {
      lx.fillRect(bx2, by + 21, bw - 2, 2);
      lx.font = `600 16px ${FONT}`; lx.textAlign = 'center';
      [30, 50, 70, 90, 110, 130].forEach((s, i) => { lx.fillRect(bx2 + i * (bw / 5) - 1, by + 21, 2, 7); lx.fillText(String(s), bx2 + i * (bw / 5), by + 44); });
      for (let i = 0; i < 10; i++) lx.fillRect(bx2 + (i + 0.5) * (bw / 10) - 0.6, by + 21, 1.2, 4);
      lx.textAlign = 'left';
    });
    const F2 = `700 15px ${FONT}`;
    txt('OVER', 18, 284, v > 130, F2); txt('UNDER', 64, 284, v < 30 && v > 0, F2); txt('HOLD', 122, 284, false, F2); txt('AUTO', 168, 284, false, F2);
    txt('30–130', 238, 284, true, F2);
  }
  function draw(st) {
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.filter = 'none'; lx.drawImage(bc, 0, 0);
    if (st.power !== false) {
      // sombra dos segmentos no refletor (deslocada para baixo/direita, desfocada) → paralaxe do vidro
      lx.setTransform(S, 0, 0, S, 4.6, 6.0); lx.filter = 'blur(3px)'; content(st, 'shadow');
      lx.filter = 'none'; lx.setTransform(S, 0, 0, S, 0, 0); content(st, 'main');
      lx.setTransform(1, 0, 0, 1, 0, 0);
    }
    t.needsUpdate = true;
  }
  return { tex: t, draw };
}
