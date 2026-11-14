// Texturas procedurais do calibrador CalPro (dono: DOSÍMETRO 3D / calibrador). Tudo em canvas/DataTexture, sem binários.
import * as THREE from 'three';

export const CFONT = '"Helvetica Neue", "Arial", system-ui, sans-serif';

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, { srgb = true, aniso = 8, wrap = false } = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ── ruído determinístico ──
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
/** ruído de valor periódico (tileável) n×n com oitavas */
function tileNoise(n, octaves, seed, base = 8) {
  const r = rng(seed), out = new Float32Array(n * n);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) {
    const g = base << o, grid = new Float32Array(g * g).map(() => r());
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = (x / n) * g, fy = (y / n) * g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = grid[(y0 % g) * g + (x0 % g)], b = grid[(y0 % g) * g + ((x0 + 1) % g)], c = grid[((y0 + 1) % g) * g + (x0 % g)], d = grid[((y0 + 1) % g) * g + ((x0 + 1) % g)];
      out[y * n + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
    }
    tot += amp; amp *= 0.55;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
/** altura (Float32 n×m, canvas-orientada) → normal map RGBA (tangente: +u direita, +v para cima) */
export function heightToNormal(H, w, h, strength = 1, wrap = false) {
  const d = new Uint8Array(w * h * 4);
  const at = (x, y) => { if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); } return H[y * w + x]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = -(at(x + 1, y) - at(x - 1, y)) * 0.5 * strength, ny = (at(x, y + 1) - at(x, y - 1)) * 0.5 * strength;
    const l = Math.hypot(nx, ny, 1), i = ((h - 1 - y) * w + x) * 4; // DataTexture: linha 0 = v 0 (embaixo)
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat); t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** lê um canvas de altura (canal R, 0..255) → Float32 em mm (escala) */
export function canvasHeights(c, scale) {
  const g = c.getContext('2d'), { data } = g.getImageData(0, 0, c.width, c.height), H = new Float32Array(c.width * c.height);
  for (let i = 0; i < H.length; i++) H[i] = (data[i * 4] / 255) * scale; return H;
}

// ── TPE: micro-granulado (normal) + variação de rugosidade/sujeira (tileáveis) ──
let _rub = null;
export function rubberMaps() {
  if (_rub) return _rub;
  const n = 256, fine = tileNoise(n, 4, 7, 32), H = new Float32Array(n * n);
  const r = rng(99);
  for (let i = 0; i < H.length; i++) H[i] = fine[i] * 1.0 + (r() - 0.5) * 0.18; // granulado de molde
  const normal = heightToNormal(H, n, n, 2.2, true);
  const m = 128, big = tileNoise(m, 4, 21, 4), d = new Uint8Array(m * m * 4);
  for (let i = 0; i < m * m; i++) { const v = 150 + (big[i] - 0.5) * 120; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.max(0, Math.min(255, v)); d[i * 4 + 3] = 255; }
  const rough = new THREE.DataTexture(d, m, m, THREE.RGBAFormat); rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.generateMipmaps = true; rough.minFilter = THREE.LinearMipmapLinearFilter; rough.magFilter = THREE.LinearFilter; rough.needsUpdate = true;
  return (_rub = { normal, rough, fineH: H, n });
}

// ── decal com relevo: desenha alturas (branco = alto) num canvas e gera normal map + mapa de AO/cor (linear) ──
export function reliefDecal(wmm, hmm, pxmm, drawHeight, { strength = 1, ao = 0.55, micro = 0.35, drawAO } = {}) {
  const w = Math.round(wmm * pxmm), h = Math.round(hmm * pxmm), c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, w, h);
  g.save(); g.scale(pxmm, pxmm); g.translate(wmm / 2, hmm / 2); drawHeight(g); g.restore();
  const H = canvasHeights(c, 1);
  // micro-granulado igual ao do corpo
  const R = rubberMaps(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = (H[y * w + x] - 0.5) * strength * pxmm * 0.6 + R.fineH[(y % R.n) * R.n + (x % R.n)] * micro * 2.2;
  const normal = heightToNormal(H, w, h, 1);
  // AO: cavidades (altura abaixo da média local) escurecem
  const ac = canvas(w, h), ag = ac.getContext('2d'); ag.fillStyle = '#fff'; ag.fillRect(0, 0, w, h);
  const id = ag.getImageData(0, 0, w, h), base = canvasHeights(c, 1);
  for (let i = 0; i < base.length; i++) { const v = Math.max(0, 0.5 - base[i]) * 2; const k = 1 - v * ao; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = k * 255; }
  ag.putImageData(id, 0, 0);
  if (drawAO) { ag.save(); ag.scale(pxmm, pxmm); ag.translate(wmm / 2, hmm / 2); drawAO(ag); ag.restore(); }
  return { normal, ao: tex(ac, { srgb: false }) };
}

// ── janela preta brilhante (serigrafia) ──
// janela: x −18.3..18.3, y −2.6..39.4 (mm)
export const WIN = { x0: -18.3, x1: 18.3, y0: -2.6, y1: 39.4 };
export function panelTextures() {
  const P = 24, W = WIN.x1 - WIN.x0, H = WIN.y1 - WIN.y0, w = Math.round(W * P), h = Math.round(H * P);
  const X = (x) => (x - WIN.x0) * P, Y = (y) => (WIN.y1 - y) * P;
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#16171a'; g.fillRect(0, 0, w, h);
  // moldura do módulo OLED (preto profundo, levemente maior que a área ativa)
  g.fillStyle = '#030304'; g.fillRect(X(1.3 - 11.6), Y(24.3 + 6.6), 23.2 * P, 13.2 * P);
  g.textBaseline = 'alphabetic';
  // CalPro (branco, bold)
  g.font = `700 ${4.5 * P}px ${CFONT}`; g.textAlign = 'left'; { const wc = g.measureText('Cal').width, wp = g.measureText('Pro').width, x0 = X(-1.0) - (wc + wp) / 2;
    g.fillStyle = '#e4e7ea'; g.fillText('Cal', x0, Y(10.5)); g.fillStyle = '#1f8cf0'; g.fillText('Pro', x0 + wc, Y(10.5)); }
  // 1kHz (canto superior direito)
  g.font = `700 ${1.55 * P}px ${CFONT}`; g.textAlign = 'center'; g.fillStyle = '#d9dde2'; g.fillText('1kHz', X(12.6), Y(34.0));
  // IEC60942 – Classe 1 (vertical, lendo de baixo para cima)
  g.save(); g.translate(X(-15.6), Y(21)); g.rotate(-Math.PI / 2); g.font = `700 ${1.35 * P}px ${CFONT}`; g.textAlign = 'center'; g.fillStyle = '#d9dde2';
  g.fillText('IEC60942 – Classe 1', 0, 0); g.restore();
  const map = tex(c);
  // rugosidade: vidro liso com leves marcas de dedo/limpeza
  const rc = canvas(256, 290), rg = rc.getContext('2d'); rg.fillStyle = 'rgb(18,18,18)'; rg.fillRect(0, 0, 256, 290);
  const r = rng(5); rg.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) { const x = r() * 256, y = r() * 290, rad = 10 + r() * 22; const gr = rg.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(70,70,70,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); rg.fillStyle = gr; rg.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  rg.strokeStyle = 'rgba(60,60,60,0.25)'; rg.lineWidth = 1; for (let i = 0; i < 14; i++) { rg.beginPath(); const x = r() * 256, y = r() * 290; rg.moveTo(x, y); rg.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 20); rg.stroke(); }
  const rough = tex(rc, { srgb: false });
  return { map, rough };
}

// ── ícone ⏻ ──
export function powerIconTex(px = 128, col = '#f4f6f8') {
  const c = canvas(px, px), g = c.getContext('2d'), s = px / 10;
  g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = 1.35 * s;
  g.beginPath(); g.arc(5 * s, 5.4 * s, 3.1 * s, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(5 * s, 1.4 * s); g.lineTo(5 * s, 5.0 * s); g.stroke();
  return tex(c);
}

// ── etiqueta de série/calibração (genérica) ──
export function labelTex(wmm, hmm) {
  const P = 26, w = Math.round(wmm * P), h = Math.round(hmm * P), c = canvas(w, h), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e9ecef'); gr.addColorStop(0.5, '#f6f7f8'); gr.addColorStop(1, '#dfe3e6');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b5fa8'; g.fillRect(0, 0, w, 3.2 * P);
  g.fillStyle = '#fff'; g.font = `700 ${1.55 * P}px ${CFONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText('CALIBRADOR ACÚSTICO', 1.0 * P, 1.65 * P);
  g.fillStyle = '#16191c'; g.textAlign = 'left';
  const L = [['Modelo', 'CalPro'], ['Norma', 'IEC 60942:2017 – Classe 1'], ['Frequência', '1000 Hz ± 1 %'], ['Nível', '94,0 / 114,0 dB ± 0,3'], ['Acoplador', '½" (12,7 mm)'], ['Nº série', 'CP2104738']];
  L.forEach(([k, v], i) => { const y = (4.7 + i * 1.62) * P; g.font = `600 ${1.0 * P}px ${CFONT}`; g.fillStyle = '#50565c'; g.fillText(k, 1.0 * P, y); g.font = `700 ${1.08 * P}px ${CFONT}`; g.fillStyle = '#16191c'; g.fillText(v, 6.6 * P, y); });
  // código de barras
  const r = rng(11); let x = 1.0 * P; const by = (4.7 + 6 * 1.62 - 0.4) * P;
  g.fillStyle = '#111'; while (x < w * 0.62) { const bw = (r() < 0.5 ? 0.18 : 0.38) * P; if (r() < 0.62) g.fillRect(x, by, bw, 2.3 * P); x += bw + 0.17 * P; }
  // selo de calibração
  const cx = w - 3.6 * P, cy = by + 0.6 * P;
  g.strokeStyle = '#2e8b3a'; g.lineWidth = 0.28 * P; g.beginPath(); g.arc(cx, cy, 2.4 * P, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#2e8b3a'; g.textAlign = 'center'; g.font = `800 ${0.72 * P}px ${CFONT}`; g.fillText('CALIBRADO', cx, cy - 0.7 * P);
  g.font = `700 ${0.8 * P}px ${CFONT}`; g.fillText('03/2026', cx, cy + 0.5 * P); g.font = `600 ${0.6 * P}px ${CFONT}`; g.fillText('val. 03/2027', cx, cy + 1.45 * P);
  // desgaste leve nas bordas
  const ed = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.62); ed.addColorStop(0, 'rgba(0,0,0,0)'); ed.addColorStop(1, 'rgba(80,70,50,0.18)');
  g.fillStyle = ed; g.fillRect(0, 0, w, h);
  return tex(c);
}

// ── fenda Phillips do parafuso ──
export function screwTex() {
  const n = 96, c = canvas(n, n), g = c.getContext('2d');
  const gr = g.createRadialGradient(n * 0.4, n * 0.38, 2, n / 2, n / 2, n / 2); gr.addColorStop(0, '#c9cdd1'); gr.addColorStop(0.7, '#8c9298'); gr.addColorStop(1, '#4d5257');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  g.fillStyle = '#1a1c1e'; g.fillRect(n * 0.44, n * 0.16, n * 0.12, n * 0.68); g.fillRect(n * 0.16, n * 0.44, n * 0.68, n * 0.12);
  return tex(c);
}
