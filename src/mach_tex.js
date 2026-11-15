// MÁQUINAS — texturas PBR procedurais (canvas, tileáveis) + camada de desgaste em shader.
// Pintura industrial sobre ferro fundido: lascas mostrando metal, ferrugem com escorrimento, óleo, graxa, riscos,
// poeira em superfícies horizontais (shader, pela normal do mundo), sujeira junto ao piso, bordas gastas (atributo aEdge).
import * as THREE from 'three';
export const MODERN = (() => { try { return new URLSearchParams(location.search).get('antigo') !== '1'; } catch { return true; } })(); // máquinas modernas (NR-12); ?antigo=1 volta às antigas
export const CLEAN = (() => { try { return new URLSearchParams(location.search).get('sujo') !== '1'; } catch { return true; } })(); // galpão limpo e organizado (5S); ?sujo=1 volta ao aspecto antigo

// ───────────────────────── ruído tileável ─────────────────────────
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
/** ruído de valor tileável (cx×cy células) em grade N×N, valores 0..1 */
function vnoise(N, cx, cy, seed, out, amp = 1) {
  const r = rng(seed), lat = new Float32Array(cx * cy);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const sx = new Float32Array(N), ix0 = new Int32Array(N), ix1 = new Int32Array(N);
  for (let x = 0; x < N; x++) { const f = (x * cx) / N, i = Math.floor(f), t = f - i; sx[x] = t * t * (3 - 2 * t); ix0[x] = i % cx; ix1[x] = (i + 1) % cx; }
  for (let y = 0; y < N; y++) {
    const f = (y * cy) / N, j = Math.floor(f); let t = f - j; t = t * t * (3 - 2 * t);
    const r0 = (j % cy) * cx, r1 = ((j + 1) % cy) * cx, o = y * N;
    for (let x = 0; x < N; x++) {
      const a = lat[r0 + ix0[x]], b = lat[r0 + ix1[x]], c = lat[r1 + ix0[x]], d = lat[r1 + ix1[x]], u = sx[x];
      const top = a + (b - a) * u, bot = c + (d - c) * u;
      out[o + x] += (top + (bot - top) * t) * amp;
    }
  }
}
function fbm(N, cx, cy, oct, seed, gain = 0.5) {
  const out = new Float32Array(N * N); let amp = 1, tot = 0;
  for (let i = 0; i < oct; i++) { vnoise(N, cx << i, cy << i, seed + i * 977, out, amp); tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function canvas(N, M = N) { const c = document.createElement('canvas'); c.width = N; c.height = M; return c; }
function tex(c, srgb, rep = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
/** mapa de normal (tangente) a partir de altura tileável */
function normalFromHeight(h, N, strength) {
  const c = canvas(N), ctx = c.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const xm = (x - 1 + N) % N, xp = (x + 1) % N, ym = (y - 1 + N) % N, yp = (y + 1) % N;
    const dx = (h[y * N + xp] - h[y * N + xm]) * strength, dy = (h[yp * N + x] - h[ym * N + x]) * strength;
    // canvas y para baixo → v para cima (flipY): inverte dy
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return tex(c, false);
}
/** desenha riscos finos num canvas e devolve a máscara 0..1 */
function scratchMask(N, count, seed, { len = [0.01, 0.08], w = [0.6, 1.6], curve = 0.3, alpha = [0.3, 0.9], vertical = 0 } = {}) {
  const c = canvas(N), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N); ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * N, y = r() * N, L = (len[0] + r() * (len[1] - len[0])) * N;
    let a = r() * Math.PI * 2; if (r() < vertical) a = Math.PI / 2 + (r() - 0.5) * 0.25;
    ctx.strokeStyle = `rgba(255,255,255,${alpha[0] + r() * (alpha[1] - alpha[0])})`; ctx.lineWidth = w[0] + r() * (w[1] - w[0]);
    ctx.beginPath();
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { // tileável
      ctx.moveTo(x + ox, y + oy);
      ctx.quadraticCurveTo(x + ox + Math.cos(a + curve) * L * 0.5, y + oy + Math.sin(a + curve) * L * 0.5, x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
    }
    ctx.stroke();
  }
  const d = ctx.getImageData(0, 0, N, N).data, m = new Float32Array(N * N);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4] / 255;
  return m;
}

// ───────────────────────── pintura sobre ferro fundido ─────────────────────────
const PAINT_N = 1024;
let paintMasks = null;
function buildPaintMasks() {
  const N = PAINT_N, t0 = performance.now();
  const mott = fbm(N, 3, 3, 6, 11);              // manchas de tinta / desbotamento
  const chipBig = fbm(N, 6, 6, 6, 23, 0.55);     // lascas grandes
  const chipSm = fbm(N, 40, 40, 3, 37, 0.5);     // lascas pequenas / pontos
  const rustN = fbm(N, 12, 12, 4, 41);
  const streak = fbm(N, 40, 2, 4, 53, 0.55);     // escorrimento vertical (óleo/sujeira)
  const grime = fbm(N, 5, 5, 5, 67);
  const pits = fbm(N, 160, 160, 2, 71);          // porosidade do fundido
  const scr = scratchMask(N, 520, 83, { len: [0.004, 0.05], w: [0.5, 1.4] });
  const scrV = scratchMask(N, 70, 89, { len: [0.05, 0.25], w: [0.7, 1.8], vertical: 0.85, alpha: [0.15, 0.5] });
  const chip = new Float32Array(N * N), rust = new Float32Array(N * N), halo = new Float32Array(N * N);
  for (let i = 0; i < chip.length; i++) {
    const c1 = sst(0.655, 0.675, chipBig[i] + (chipSm[i] - 0.5) * 0.08);
    const c2 = sst(0.80, 0.83, chipSm[i]);
    chip[i] = Math.max(c1, c2 * 0.9);
    rust[i] = chip[i] * sst(0.42, 0.62, rustN[i]);
    halo[i] = sst(0.60, 0.665, chipBig[i]) * (1 - chip[i]) * sst(0.5, 0.7, rustN[i]);
  }
  // escorrimento de ferrugem para baixo (canvas y para baixo = mundo para baixo)
  const bleed = new Float32Array(N * N);
  for (let x = 0; x < N; x++) {
    let b = 0;
    for (let k = 0; k < N * 1.3; k++) { const y = k % N, i = y * N + x; b = Math.max(b * 0.988, rust[i] * 0.8); bleed[i] = Math.max(bleed[i], b * (0.55 + 0.45 * streak[i])); }
  }
  const height = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) height[i] = (1 - chip[i]) * 0.9 + pits[i] * 0.25 + mott[i] * 0.15 - scr[i] * 0.35 + rust[i] * (rustN[i] - 0.5) * 0.6;
  paintMasks = { N, mott, chip, rust, halo, bleed, streak, grime, pits, scr, scrV, rustN, height };
  // ORM compartilhado (R = ruído p/ shader, G = rugosidade, B = metalicidade)
  const c = canvas(N), ctx = c.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
  for (let i = 0; i < N * N; i++) {
    const oil = sst(0.55, 0.75, streak[i]) * 0.7;
    let rough = 0.58 + (mott[i] - 0.5) * 0.25 + grime[i] * 0.12;
    rough = rough * (1 - oil) + 0.22 * oil;
    rough = rough * (1 - chip[i]) + (0.42 + pits[i] * 0.2) * chip[i];
    rough = rough * (1 - rust[i]) + 0.88 * rust[i];
    rough = rough * (1 - scr[i] * 0.6) + 0.35 * scr[i] * 0.6;
    const metal = clamp01(chip[i] * (1 - rust[i]) * 0.9 + scr[i] * 0.5);
    d[i * 4] = grime[i] * 255; d[i * 4 + 1] = clamp01(rough) * 255; d[i * 4 + 2] = metal * 255; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  paintMasks.orm = tex(c, false);
  paintMasks.normal = normalFromHeight(height, N, 2.2);
  console.debug(`[maquinas] máscaras de pintura ${(performance.now() - t0) | 0} ms`);
  return paintMasks;
}
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
/** albedo da pintura num esquema de cor (sRGB) */
function paintAlbedo(scheme) {
  const M = paintMasks || buildPaintMasks(), N = M.N;
  const P = hex(scheme.paint), G = hex(scheme.grime ?? 0x2a2a22), metal = [0.33, 0.33, 0.34], rustC = [0.42, 0.22, 0.10], rustD = [0.22, 0.11, 0.05];
  const CK = CLEAN ? 0.18 : 1; // manutenção em dia: pintura conservada
  const primer = hex(scheme.primer ?? 0x8a5a44), wear = (scheme.wear ?? 1) * CK, oilK = (scheme.oil ?? 1) * CK;
  const c = canvas(N), ctx = c.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
  for (let i = 0; i < N * N; i++) {
    const mv = 0.84 + (M.mott[i] - 0.5) * 0.42;
    let r = P[0] * mv, g = P[1] * mv, b = P[2] * mv;
    // sujeira/graxa em manchas
    const gk = sst(0.5, 0.8, M.grime[i]) * 0.55 * (scheme.dirt ?? 1) * CK;
    r += (G[0] - r) * gk; g += (G[1] - g) * gk; b += (G[2] - b) * gk;
    // escorrimento de óleo (escurece, leve tom âmbar)
    const ok = sst(0.52, 0.78, M.streak[i]) * 0.45 * oilK;
    r *= 1 - ok * 0.8; g *= 1 - ok * 0.85; b *= 1 - ok * 0.95;
    // halo de ferrugem e escorrimento
    const hk = Math.min(1, M.halo[i] * 0.6 + M.bleed[i] * 0.55) * wear;
    r += (rustC[0] * 0.9 - r) * hk * 0.6; g += (rustC[1] - g) * hk * 0.6; b += (rustC[2] - b) * hk * 0.6;
    // riscos: primer/metal
    const sk = Math.min(1, M.scr[i] * wear + M.scrV[i] * 0.6);
    const sm = M.scr[i] > 0.5 ? metal : primer;
    r += (sm[0] * 1.3 - r) * sk * 0.65; g += (sm[1] * 1.3 - g) * sk * 0.65; b += (sm[2] * 1.3 - b) * sk * 0.65;
    // lascas: metal fundido escuro ou ferrugem
    const ck = Math.min(1, M.chip[i] * wear);
    const rk = M.rust[i] / Math.max(1e-3, M.chip[i]);
    const mn = 0.7 + M.pits[i] * 0.6;
    const cr = metal[0] * mn * (1 - rk) + (rustC[0] * (1 - M.rustN[i]) + rustD[0] * M.rustN[i]) * rk;
    const cg = metal[1] * mn * (1 - rk) + (rustC[1] * (1 - M.rustN[i]) + rustD[1] * M.rustN[i]) * rk;
    const cb = metal[2] * mn * (1 - rk) + (rustC[2] * (1 - M.rustN[i]) + rustD[2] * M.rustN[i]) * rk;
    r += (cr - r) * ck; g += (cg - g) * ck; b += (cb - b) * ck;
    d[i * 4] = clamp01(r) * 255; d[i * 4 + 1] = clamp01(g) * 255; d[i * 4 + 2] = clamp01(b) * 255; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, true);
}

// ───────────────────────── aço usinado / escovado ─────────────────────────
let steelTex = null;
function buildSteel() {
  const N = 512, brush = fbm(N, 2, 160, 3, 101), blot = fbm(N, 4, 4, 5, 103), spots = fbm(N, 24, 24, 3, 107), oil = fbm(N, 6, 6, 4, 109);
  const scr = scratchMask(N, 260, 113, { len: [0.01, 0.12], w: [0.4, 1.0], curve: 0.05, alpha: [0.2, 0.7] });
  const ca = canvas(N), co = canvas(N), A = ca.getContext('2d').createImageData(N, N), O = co.getContext('2d').createImageData(N, N);
  const h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const rs = sst(0.72, 0.82, spots[i]) * sst(0.45, 0.7, blot[i]);
    const ok = sst(0.5, 0.8, oil[i]);
    let v = 0.62 + (brush[i] - 0.5) * 0.22 + (blot[i] - 0.5) * 0.18 + scr[i] * 0.12;
    v *= 1 - ok * 0.35;
    let r = v, g = v, b = v * 1.02;
    r += (0.36 - r) * rs; g += (0.2 - g) * rs; b += (0.1 - b) * rs;
    A.data[i * 4] = clamp01(r) * 255; A.data[i * 4 + 1] = clamp01(g) * 255; A.data[i * 4 + 2] = clamp01(b) * 255; A.data[i * 4 + 3] = 255;
    const rough = clamp01(0.28 + (brush[i] - 0.5) * 0.18 + blot[i] * 0.12 + rs * 0.5 - ok * 0.12 + scr[i] * 0.08);
    O.data[i * 4] = blot[i] * 255; O.data[i * 4 + 1] = rough * 255; O.data[i * 4 + 2] = (1 - rs * 0.7) * 255; O.data[i * 4 + 3] = 255;
    h[i] = brush[i] * 0.4 - scr[i] * 0.5 + rs * spots[i] * 0.8;
  }
  ca.getContext('2d').putImageData(A, 0, 0); co.getContext('2d').putImageData(O, 0, 0);
  steelTex = { map: tex(ca, true), orm: tex(co, false), normal: normalFromHeight(h, N, 1.4) };
  return steelTex;
}

// ───────────────────────── tela metálica expandida (alpha) ─────────────────────────
function meshTex() {
  const N = 256, c = canvas(N), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N); x.strokeStyle = '#fff'; x.lineWidth = 9;
  const s = N / 4;
  for (let j = -1; j <= 4; j++) for (let i = -1; i <= 4; i++) {
    const cx = i * s + (j % 2 ? s / 2 : 0), cy = j * s * 0.5;
    x.beginPath(); x.moveTo(cx - s / 2, cy); x.lineTo(cx, cy - s * 0.25); x.lineTo(cx + s / 2, cy); x.lineTo(cx, cy + s * 0.25); x.closePath(); x.stroke();
  }
  return tex(c, false);
}

// ───────────────────────── camada de desgaste (shader) ─────────────────────────
/** injeta poeira em superfícies horizontais, sujeira junto ao piso e borda gasta (aEdge) num MeshStandardMaterial */
export function addWear(mat, { dust = 0.55, edge = 0.9, grime = 0.8, dustCol = 0x8d8576, edgeCol = 0x3a3b3d } = {}) {
  if (CLEAN) { dust *= 0.25; grime *= 0.25; edge *= 0.5; }
  const dc = new THREE.Color(dustCol), ec = new THREE.Color(edgeCol);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uDust: { value: dust }, uEdge: { value: edge }, uGrime: { value: grime }, uDustCol: { value: dc }, uEdgeCol: { value: ec } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEdge;\nvarying float vEdge;\nvarying vec3 vWN;\nvarying vec3 vWP;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vEdge = aEdge;
        vec4 wwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wwp = instanceMatrix * wwp;
        #endif
        wwp = modelMatrix * wwp; vWP = wwp.xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDust, uEdge, uGrime;\nuniform vec3 uDustCol, uEdgeCol;\nvarying float vEdge;\nvarying vec3 vWN;\nvarying vec3 vWP;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wNz = texture2D(roughnessMap, vRoughnessMapUv * 2.37 + 0.13).r;
        float wNz2 = texture2D(roughnessMap, vRoughnessMapUv * 0.53 + 0.41).r;
        float wDust = smoothstep(0.5, 0.92, normalize(vWN).y) * smoothstep(0.25, 0.7, wNz2 * 0.7 + wNz * 0.45) * uDust;
        float wFloor = (1.0 - smoothstep(0.0, 0.6, vWP.y)) * uGrime;
        float wEdge = smoothstep(0.35, 0.8, vEdge * (0.55 + wNz * 0.9)) * uEdge;
        diffuseColor.rgb = mix(diffuseColor.rgb, uEdgeCol * (0.75 + wNz * 0.6), wEdge);
        diffuseColor.rgb *= 1.0 - 0.55 * wFloor * (0.45 + wNz);
        diffuseColor.rgb = mix(diffuseColor.rgb, uDustCol, wDust * 0.8);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.32, wEdge); roughnessFactor = mix(roughnessFactor, 0.97, wDust);
        roughnessFactor = mix(roughnessFactor, 0.85, wFloor * 0.5);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.9, wEdge * (1.0 - wDust)); metalnessFactor *= 1.0 - wDust;`);
  };
  mat.customProgramCacheKey = () => `wear${dust.toFixed(2)}_${edge.toFixed(2)}_${grime.toFixed(2)}`;
  return mat;
}

// ───────────────────────── biblioteca de materiais ─────────────────────────
export const SCHEMES = {
  press1: { paint: 0xc4b9a0, grime: 0x3b352a, primer: 0x7a5a44, wear: 1.35, dirt: 1.05, oil: 1.25 },   // cinza-claro/bege quente, muito gasto (foto)
  press2: { paint: 0xb1ad98, grime: 0x3a372c, primer: 0x7a6a54, wear: 1.0, dirt: 0.9, oil: 1.0 },              // bege claro
  press3: { paint: 0xa3b09a, grime: 0x353a2e, primer: 0x7a7a64, wear: 1.0, dirt: 0.9, oil: 1.0 },              // verde-claro dessaturado
  hyd: { paint: 0x5d7480, grime: 0x262b2e, wear: 0.7, oil: 1.4 },
  sage: { paint: 0xb0c69c, grime: 0x3d4535, primer: 0x8c8a78, wear: 0.9, dirt: 1.1, oil: 0.9 },     // verde-menta acinzentado gasto
  pendant: { paint: 0x9aad8e, grime: 0x34392d, primer: 0x8a8a7a, wear: 0.7, dirt: 1.1, oil: 0.7 },   // moldura do comando
  olive: { paint: 0x93a985, grime: 0x262b20, primer: 0x7a7060, wear: 1.3, oil: 1.4, dirt: 1.45 },   // base volumosa, mais suja
  yellow: { paint: 0xe0a51c, grime: 0x4a3a1c, primer: 0x6a5a4a, wear: 0.9, dirt: 0.8 },  // proteções
  orange: { paint: 0xd8641c, grime: 0x4a2a1a, wear: 0.8 },
  grey: { paint: 0x8a8d8f, grime: 0x2a2b2c, wear: 0.6 },
  blue: { paint: 0x3f6e9a, grime: 0x1f2a33, wear: 0.8 },
  dkgreen: { paint: 0x3f5a45, grime: 0x1e241e, wear: 1.0 },
};
// máquinas modernas: cinza-claro industrial (RAL 7035) com detalhes azuis (RAL 5015), base grafite, pintura nova
if (MODERN) Object.assign(SCHEMES, {
  press1: { paint: 0xd9dcdb, grime: 0x3a3d40, primer: 0xa0a4a6, wear: 0.2, dirt: 0.4, oil: 0.2 },
  press2: { paint: 0xd4d8d8, grime: 0x3a3d40, primer: 0xa0a4a6, wear: 0.2, dirt: 0.4, oil: 0.2 },
  press3: { paint: 0xcfd5d7, grime: 0x3a3d40, primer: 0xa0a4a6, wear: 0.2, dirt: 0.4, oil: 0.2 },
  hyd: { paint: 0x2364ad, grime: 0x1a2430, wear: 0.15, dirt: 0.3, oil: 0.2 },
  sage: { paint: 0xd9dcdb, grime: 0x3a3d40, primer: 0xa0a4a6, wear: 0.15, dirt: 0.3, oil: 0.1 },
  pendant: { paint: 0x353a40, grime: 0x15171a, wear: 0.1, dirt: 0.2, oil: 0.1 },
  olive: { paint: 0x3a4047, grime: 0x15171a, wear: 0.15, dirt: 0.3, oil: 0.1 },
  dkgreen: { paint: 0x2364ad, grime: 0x1a2430, wear: 0.1, dirt: 0.3, oil: 0.1 },
  grey: { paint: 0xbfc3c5, grime: 0x2a2b2c, wear: 0.1, dirt: 0.3 },
  blue: { paint: 0x2364ad, grime: 0x1a2430, wear: 0.1, dirt: 0.3 },
});
SCHEMES.accent = { paint: 0x2364ad, grime: 0x1a2430, wear: 0.1, dirt: 0.3, oil: 0.1 };
SCHEMES.graphite = { paint: 0x3a4047, grime: 0x15171a, wear: 0.1, dirt: 0.3, oil: 0.1 };

const cache = new Map();
/** material compartilhado por chave */
export function mat(key) {
  if (cache.has(key)) return cache.get(key);
  let m;
  if (SCHEMES[key]) {
    const M = paintMasks || buildPaintMasks();
    if (MODERN) { // pintura eletrostática nova: lisa, acetinada, sem amassados/lascas
      m = new THREE.MeshPhysicalMaterial({ map: paintAlbedo(SCHEMES[key]), roughness: 0.4, metalness: 0.05, clearcoat: 0.25, clearcoatRoughness: 0.35 });
      // (sem a camada de desgaste: ela exige roughnessMap)
    } else {
    m = new THREE.MeshStandardMaterial({ map: paintAlbedo(SCHEMES[key]), normalMap: M.normal, roughnessMap: M.orm, metalnessMap: M.orm, roughness: 1, metalness: 1 });
    m.normalScale.set(0.5, 0.5);
    addWear(m, { dust: key === 'yellow' || key === 'orange' ? 0.4 : 0.6, edge: 1 });
    }
  } else if (key === 'steel' || key === 'dksteel' || key === 'chrome' || key === 'blacksteel') {
    const S = steelTex || buildSteel();
    const col = { steel: 0xffffff, dksteel: 0x6a6a6c, chrome: 0xffffff, blacksteel: 0x2b2c2e }[key];
    m = new THREE.MeshStandardMaterial({ map: S.map, normalMap: S.normal, roughnessMap: S.orm, metalnessMap: S.orm, color: col, roughness: key === 'chrome' ? 0.45 : 1, metalness: 1 });
    m.normalScale.set(0.5, 0.5);
    addWear(m, { dust: key === 'chrome' ? 0.15 : 0.45, edge: 0, grime: 0.5 });
  } else if (key === 'rubber') m = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.78, metalness: 0 });
  else if (key === 'hose') m = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.55, metalness: 0 });
  else if (key === 'hoseOrange') m = new THREE.MeshStandardMaterial({ color: 0xd2541a, roughness: 0.45, metalness: 0 });
  else if (key === 'conduit') m = new THREE.MeshStandardMaterial({ color: 0x5a5d60, roughness: 0.6, metalness: 0.3 });
  else if (key === 'copper') m = new THREE.MeshStandardMaterial({ color: 0xb06a40, roughness: 0.38, metalness: 1 });
  else if (key === 'brass') m = new THREE.MeshStandardMaterial({ color: 0xb59a52, roughness: 0.35, metalness: 1 });
  else if (key === 'red') m = new THREE.MeshStandardMaterial({ color: 0xb01010, roughness: 0.35, metalness: 0 });
  else if (key === 'green') m = new THREE.MeshStandardMaterial({ color: 0x1a8a2e, roughness: 0.35, metalness: 0 });
  else if (key === 'blackplastic') m = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.45, metalness: 0 });
  else if (key === 'greyplastic') m = new THREE.MeshStandardMaterial({ color: 0x7c7f80, roughness: 0.5, metalness: 0 });
  else if (key === 'ledG' || key === 'ledA' || key === 'ledR') { const c = { ledG: 0x22e36a, ledA: 0xffb21a, ledR: 0xff2a2a }[key]; m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: key === 'ledG' ? 2.2 : 0.18, roughness: 0.25, transparent: true, opacity: 0.92 }); }
  else if (key === 'curtain') m = new THREE.MeshStandardMaterial({ color: 0x3a0606, emissive: 0xff1e1e, emissiveIntensity: 0.9, roughness: 0.3 });
  else if (key === 'poly') m = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ee, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  else if (key === 'wheel') m = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.95, metalness: 0 });
  else if (key === 'glass') m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, transmission: 0, transparent: true, opacity: 0.18, depthWrite: false });
  else if (key === 'oilglass') m = new THREE.MeshStandardMaterial({ color: 0xa8761a, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85 });
  else if (key === 'mesh') {
    m = new THREE.MeshStandardMaterial({ color: 0xc28c1c, roughness: 0.6, metalness: 0.2, alphaMap: meshTex(), alphaTest: 0.5, side: THREE.DoubleSide });
    m.alphaMap.repeat.set(8, 8);
  } else if (key === 'sheet') { // chapa recém-estampada (galvanizada)
    m = new THREE.MeshStandardMaterial({ color: 0xb8bcbf, roughness: 0.3, metalness: 1, side: THREE.DoubleSide });
  } else throw new Error('material? ' + key);
  m.name = 'mach_' + key;
  cache.set(key, m);
  return m;
}
export function preparePaint() { buildPaintMasks(); buildSteel(); }

// ───────────────────────── etiquetas / plaquetas (canvas) ─────────────────────────
export function labelTex(draw, w = 512, h = 256) {
  const c = canvas(w, h), x = c.getContext('2d'); draw(x, w, h);
  // envelhecimento: sujeira nas bordas + manchas (só no aspecto antigo)
  const r = rng(w * 7 + h);
  if (MODERN || CLEAN) { const t0 = tex(c, true, false); t0.anisotropy = 4; return t0; }
  const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(40,34,20,0)'); g.addColorStop(1, 'rgba(40,34,20,0.55)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(30,25,15,${0.04 + r() * 0.08})`; x.beginPath(); x.arc(r() * w, r() * h, 3 + r() * 30, 0, 7); x.fill(); }
  for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.15})`; x.lineWidth = 0.6; x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 60, py + (r() - 0.5) * 10); x.stroke(); }
  const t = tex(c, true, false); t.anisotropy = 4; return t;
}
export function labelMat(draw, w, h, { rough = 0.45, metal = 0 } = {}) {
  return new THREE.MeshStandardMaterial({ map: labelTex(draw, w, h), roughness: rough, metalness: metal });
}
/** placa de identificação de alumínio gravada */
export function idPlate(lines) {
  return labelMat((x, w, h) => {
    x.fillStyle = '#b9b8b0'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3a3a36'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#26261f'; x.font = 'bold 34px Arial'; x.textAlign = 'center'; x.fillText(lines[0], w / 2, 58);
    x.font = '24px Arial'; x.textAlign = 'left';
    lines.slice(1).forEach((l, i) => { x.fillText(l, 32, 102 + i * 34); });
    x.fillStyle = '#555'; for (const [px, py] of [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]]) { x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); }
  }, 512, 256, { rough: 0.35, metal: 0.8 });
}
/** placa de segurança (NR-26): 'perigo' (triângulo amarelo) ou 'obrig' (círculo azul — protetor auricular) */
export function safetySign(kind, text) {
  return labelMat((x, w, h) => {
    x.fillStyle = '#f2efe6'; x.fillRect(0, 0, w, h);
    if (kind === 'perigo') {
      x.fillStyle = '#c8161d'; x.fillRect(0, 0, w, 70); x.fillStyle = '#fff'; x.font = 'bold 52px Arial'; x.textAlign = 'center'; x.fillText('PERIGO', w / 2, 54);
      x.fillStyle = '#f2c200'; x.strokeStyle = '#111'; x.lineWidth = 10; x.beginPath(); x.moveTo(110, 100); x.lineTo(190, 240); x.lineTo(30, 240); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#111'; x.font = 'bold 90px Arial'; x.fillText('!', 110, 228);
    } else {
      x.fillStyle = '#1f5fa8'; x.fillRect(0, 0, w, 70); x.fillStyle = '#fff'; x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.fillText('USO OBRIGATÓRIO', w / 2, 50);
      x.fillStyle = '#1f5fa8'; x.beginPath(); x.arc(110, 170, 72, 0, 7); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.arc(110, 165, 38, Math.PI, 0); x.stroke();
      x.fillStyle = '#fff'; x.fillRect(64, 160, 18, 40); x.fillRect(138, 160, 18, 40);
    }
    x.fillStyle = '#111'; x.font = 'bold 30px Arial'; x.textAlign = 'left';
    text.forEach((l, i) => x.fillText(l, 220, 135 + i * 38));
  }, 512, 300, { rough: 0.5 });
}
