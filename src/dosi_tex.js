// Texturas procedurais do DOSÍMETRO 3D (sem assets binários): ruídos periódicos (tileáveis), mapas normais,
// rótulos serigrafados em canvas. Tudo em cache (compartilhado entre dosímetro, calibrador e maleta).
import * as THREE from 'three';

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

// hash inteiro → [0,1)
export function h2(x, y, s = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const mod = (a, n) => ((a % n) + n) % n;
const sm = (t) => t * t * (3 - 2 * t);
/** ruído de valor periódico (período P células) */
function vnoise(x, y, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
  const a = h2(mod(xi, P), mod(yi, P), s), b = h2(mod(xi + 1, P), mod(yi, P), s);
  const c = h2(mod(xi, P), mod(yi + 1, P), s), d = h2(mod(xi + 1, P), mod(yi + 1, P), s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** fbm periódico em u,v ∈ [0,1) */
export function fbm(u, v, P0 = 8, oct = 4, s = 1) {
  let sum = 0, amp = 0.5, norm = 0, P = P0;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(u * P, v * P, P, s + o * 17); norm += amp; amp *= 0.5; P *= 2; }
  return sum / norm;
}
/** Worley periódico (N células): {f1,f2} em unidades de célula */
export function worley(u, v, N, s = 3, jitter = 0.9) {
  const x = u * N, y = v * N, xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = mod(cx, N), wy = mod(cy, N);
    const px = cx + 0.5 + (h2(wx, wy, s) - 0.5) * jitter, py = cy + 0.5 + (h2(wx, wy, s + 9) - 0.5) * jitter;
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return { f1, f2 };
}

function dataTex(data, size, srgb = false) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
/** altura (Float32Array size²) → mapa normal tileável */
export function heightToNormal(H, size, strength = 2) {
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = H[y * size + mod(x - 1, size)], r = H[y * size + mod(x + 1, size)];
    const u = H[mod(y - 1, size) * size + x], b = H[mod(y + 1, size) * size + x];
    let nx = (l - r) * strength, ny = (u - b) * strength, nz = 1; const k = 1 / Math.hypot(nx, ny, nz);
    const o = (y * size + x) * 4; d[o] = (nx * k * 0.5 + 0.5) * 255; d[o + 1] = (ny * k * 0.5 + 0.5) * 255; d[o + 2] = (nz * k * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  return dataTex(d, size);
}
function field(size, f) { const H = new Float32Array(size * size); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = f(x / size, y / size); return H; }
function grayTex(H, size, lo, hi, srgb = false) {
  const d = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { const v = (lo + (hi - lo) * H[i]) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  return dataTex(d, size, srgb);
}

/** TPE emborrachado: micro-textura fosca (grão de molde) — normal + rugosidade */
export const rubberMaps = () => once('rubber', () => {
  const S = 256;
  const H = field(S, (u, v) => 0.65 * fbm(u, v, 32, 3, 11) + 0.35 * worley(u, v, 48, 5).f1);
  const R = field(S, (u, v) => fbm(u, v, 4, 4, 23));
  return { normal: heightToNormal(H, S, 1.6), rough: grayTex(R, S, 0.86, 1.0) };
});
/** espuma reticulada do windscreen: filamentos (bordas de Voronoi) e poros profundos */
export const foamMaps = () => once('foam', () => {
  const S = 512;
  const H = field(S, (u, v) => {
    const a = worley(u, v, 44, 7), b = worley(u, v, 88, 13);
    const e1 = 1 - Math.min(1, (a.f2 - a.f1) / 0.22), e2 = 1 - Math.min(1, (b.f2 - b.f1) / 0.3);
    const pore = Math.min(1, a.f1 / 0.55);
    return Math.max(0, 0.55 * e1 + 0.3 * e2 + 0.35 * pore - 0.2 * (1 - pore));
  });
  return { normal: heightToNormal(H, S, 5.5), color: grayTex(H, S, 0.05, 0.42, true), H };
});
/** plástico PP da maleta (granulado "pebble") */
export const caseMaps = () => once('case', () => {
  const S = 256;
  const H = field(S, (u, v) => { const w = worley(u, v, 40, 31); return Math.sqrt(Math.min(1, w.f1)) * 0.8 + 0.2 * fbm(u, v, 16, 2, 4); });
  return { normal: heightToNormal(H, S, 2.4) };
});
/** espuma de PE/PU da maleta (células finas + micro poros) */
export const packFoamMaps = () => once('pack', () => {
  const S = 256;
  const H = field(S, (u, v) => { const w = worley(u, v, 36, 41); return 0.55 * Math.min(1, w.f1 * 1.4) + 0.45 * fbm(u, v, 16, 3, 8); });
  return { normal: heightToNormal(H, S, 3.2), color: grayTex(H, S, 0.78, 1.0, true) };
});
/** grade da cápsula do microfone (furos hexagonais) — cor/alpha */
export const grilleTex = () => once('grille', () => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#b9bdc2'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#0b0b0c'; const r = 128;
  for (let y = -6; y <= 6; y++) for (let x = -7; x <= 7; x++) {
    const px = r + (x + (y & 1) * 0.5) * 18, py = r + y * 15.6;
    if (Math.hypot(px - r, py - r) < 104) { g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
});

export function canvasTex(w, h, draw, { srgb = true, aniso = 8 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
}
export const FONT = '"Helvetica Neue", "Arial", system-ui, sans-serif';

/** fallback de ambiente (só se a cena não tiver environment) */
let envFallback = null;
export async function getEnvFallback(renderer) {
  if (envFallback) return envFallback;
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const pm = new THREE.PMREMGenerator(renderer);
  envFallback = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  return envFallback;
}
