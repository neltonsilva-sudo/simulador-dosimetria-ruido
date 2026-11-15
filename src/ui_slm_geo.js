// Decibelímetro — geometria procedural da casca (dono: UI/DEMO). Varredura de seções em retângulo arredondado com cantos
// elípticos (lateral bem arredondada, frente/verso levemente abauladas), linha de partição frente/verso (sulco) e o
// colar grafite moldado que envolve o topo e afunila até o suporte da espuma. Tudo em metros, frame local do medidor:
// +y para o microfone, +z para a frente (visor), base em y = 0.

// ── dimensões ──
export const HD = 0.0155;          // meia-espessura do corpo (31 mm)
export const RX = 0.0075, RZ = 0.011; // raios do canto (x = largura, z = profundidade) — lateral macia
export const CROWN = 0.0006;       // abaulamento da frente/verso
export const RB = 0.009;           // raio do arredondamento da base
export const BODY_TOP = 0.150;     // fim da casca branca (escondido no colar)
export const COLLAR_TOP = 0.207;   // topo do colar (dentro da espuma)
const NF = 10, NC = 12;            // pontos por meia-face plana / por canto
const SIDE = [-1, -0.5, -0.16, -0.07, 0, 0.07, 0.16, 0.5]; // amostras da lateral (sulco em 0)

const sstep = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
/** meia-largura do corpo (vista frontal): base, alarga até o visor, afina para o colar */
export function hw(y) {
  const k = [[0, 0.0262], [0.022, 0.0281], [0.07, 0.0291], [0.112, 0.0300], [0.132, 0.0292], [0.15, 0.0272], [0.17, 0.0245]];
  if (y <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (y <= k[i][0]) { const t = (y - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * sstep(t); }
  return k[k.length - 1][1];
}
/** z da face frontal (corpo, fora do arredondamento da base) */
export const frontZ = (x, y) => HD + CROWN * Math.max(0, 1 - (x / hw(y)) ** 2);

/** anel da seção: retângulo arredondado de cantos elípticos; começa no centro do verso e gira por +x → frente → −x */
export function ring(a, b, rx, rz, { crown = CROWN, groove = 0 } = {}) {
  rx = Math.min(rx, a); rz = Math.min(rz, b);
  const P = []; const h = b - rz, fx = a - rx;
  const push = (x, z, side) => P.push([x, z, side]);
  const corner = (cx, cz, f0) => { for (let i = 0; i < NC; i++) { const f = f0 + (Math.PI / 2) * (i / NC); push(cx + rx * Math.cos(f), cz + rz * Math.sin(f), 0); } };
  for (let i = 0; i < NF; i++) push(fx * i / NF, -b, 0);
  corner(fx, -h, -Math.PI / 2);
  for (const s of SIDE) push(a, s * h, s);
  corner(fx, h, 0);
  for (let i = 0; i < 2 * NF; i++) push(fx - 2 * fx * i / (2 * NF), b, 0);
  corner(-fx, h, Math.PI / 2);
  for (const s of SIDE) push(-a, -s * h, -s);
  corner(-fx, -h, Math.PI);
  for (let i = 0; i < NF; i++) push(-fx + fx * i / NF, -b, 0);
  P.push(P[0].slice());
  // abaulamento e sulco da partição
  return P.map(([x, z, s], i) => {
    const w = (Math.abs(z) / b) ** 3, cz = Math.sign(z) * crown * Math.max(0, 1 - (x / a) ** 2) * w;
    const onSide = (i > NF + NC - 1 && i < NF + NC + SIDE.length) || (i > 3 * NF + 3 * NC + SIDE.length - 1 && i < 3 * NF + 3 * NC + 2 * SIDE.length);
    let gx = 0, seam = 0;
    if (groove && onSide) { const as = Math.abs(s); seam = as === 0 ? 1 : as < 0.1 ? 0.6 : as < 0.2 ? 0.18 : 0; gx = groove * (as === 0 ? 1 : as < 0.1 ? 0.4 : 0); }
    return [x - Math.sign(x) * gx, z + cz, seam];
  });
}
export const RING_N = 4 * NF + 4 * NC + 2 * SIDE.length + 1;

/** malha a partir de linhas de anéis: rows[k] = { pts:[[x,y,z,seam]...], pole?:'down'|'up' } */
export function sweepGeometry(THREE, rows, { uvScale = 0.18, color } = {}) {
  const M = rows[0].pts.length, R = rows.length;
  const pos = new Float32Array(R * M * 3), uv = new Float32Array(R * M * 2), col = new Float32Array(R * M * 3);
  for (let k = 0; k < R; k++) {
    let per = 0; const pts = rows[k].pts;
    for (let j = 0; j < M; j++) {
      const [x, y, z] = pts[j], o = k * M + j;
      if (j) { const q = pts[j - 1]; per += Math.hypot(x - q[0], z - q[2]); }
      pos.set([x, y, z], o * 3); uv.set([per / uvScale, y / uvScale], o * 2);
      const c = color ? color(pts[j], k, j) : 1; col.set([c, c, c], o * 3);
    }
  }
  const idx = [];
  for (let k = 0; k < R - 1; k++) for (let j = 0; j < M - 1; j++) {
    const a = k * M + j, b = a + 1, c = a + M, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  // descobre a orientação (as faces devem apontar para fora) e corrige costura e polos
  const n = g.attributes.normal;
  for (let k = 0; k < R; k++) {
    const a = k * M, b = k * M + M - 1;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
    if (rows[k].pole) for (let j = 0; j < M; j++) n.setXYZ(k * M + j, 0, rows[k].pole === 'down' ? -1 : 1, 0);
  }
  return g;
}

/** seção do corpo na altura y com recuo e (arredondamento da base) */
function bodyRing(y, e = 0) {
  const a = hw(y) - e, b = HD - e;
  return ring(a, b, Math.max(0.0008, RX - e * 0.85), Math.max(0.0008, RZ - e), { groove: 0.00032 * (1 - e / RB) });
}

/** casca branca do corpo */
export function bodyGeometry(THREE) {
  const rows = [];
  const add = (y, e, pole) => rows.push({ pts: (pole ? bodyRing(y, RB).map(() => [0, 0, 0]) : bodyRing(y, e)).map(([x, z, s]) => [x, y, z, s]), pole });
  add(0, 0, 'down');
  for (let i = 0; i <= 8; i++) { const th = (Math.PI / 2) * (i / 8); add(RB * (1 - Math.cos(th)), RB * (1 - Math.sin(th))); }
  const NY = 40;
  for (let i = 1; i <= NY; i++) add(RB + (BODY_TOP - RB) * (i / NY), 0);
  rows.push({ pts: rows[rows.length - 1].pts.map(() => [0, BODY_TOP, 0, 0]), pole: 'up' });
  rows[rows.length - 1].pts.forEach((p) => (p[1] = BODY_TOP));
  return sweepGeometry(THREE, rows, {
    color: ([x, y, z, s], k) => {
      let c = 1 - 0.5 * s;                                        // sulco da partição
      c *= 1 - 0.1 * clamp01(1 - y / 0.012);                      // base levemente mais escura (sujeira/oclusão)
      c *= 1 - 0.16 * clamp01((y - 0.128) / 0.014);               // oclusão sob o colar
      const side = clamp01((Math.abs(x) - (hw(y) - RX * 0.6)) / (RX * 0.6)); c *= 1 - 0.045 * side; // bordas
      return c;
    },
  });
}

/** perfil do colar grafite: seção do corpo + folga, fundindo para círculo e pescoço do microfone */
function collarParams(y) {
  const off = 0.0009, yy = Math.min(y, BODY_TOP);
  const A = hw(yy) + off, B = HD + off;
  let R;
  if (y < 0.192) R = 0.0149;
  else if (y < 0.1985) R = 0.0149 + (0.0127 - 0.0149) * sstep((y - 0.192) / 0.0065);
  else if (y < 0.2025) R = 0.0127 + (0.0137 - 0.0127) * sstep((y - 0.1985) / 0.004);
  else R = 0.0137 + (0.0124 - 0.0137) * sstep(clamp01((y - 0.2025) / 0.0045));
  const t = sstep(clamp01((y - 0.147) / 0.045));
  const a = A + (R - A) * t, b = B + (R * 0.97 - B) * t;
  return { a, b, rx: (RX + off) + (a - RX - off) * t, rz: (RZ + off) + (b - RZ - off) * t, t };
}
export const collarEdge = (x) => 0.1462 - 0.0072 * Math.max(0, 1 - (x / (hw(0.143) + 0.0009)) ** 2) ** 1.3;
export function collarGeometry(THREE) {
  const base = (() => { const p = collarParams(0.143); return ring(p.a, p.b, p.rx, p.rz); })();
  const ye = base.map(([x]) => collarEdge(x));
  const rows = [];
  const add = (sOf, inset, pole) => {
    const pts = base.map((_, j) => {
      const y = sOf(j), p = collarParams(y);
      const r = ring(p.a - inset, p.b - inset, p.rx - inset, p.rz - inset, { crown: CROWN * (1 - p.t) })[j];
      return pole ? [0, y, 0, 0] : [r[0], y, r[1], 0];
    });
    rows.push({ pts, pole });
  };
  // lábio inferior arredondado (fica 0,2 mm acima da casca branca → linha de junção visível)
  const lip = [[-0.0002, 0.0007], [0.00005, 0.00045], [0.0004, 0.0002], [0.0009, 0.0]];
  for (const [dy, ins] of lip) add((j) => ye[j] + dy + 0.0002, ins);
  const NS = 30;
  for (let i = 1; i <= NS; i++) { const s = (i / NS) ** 1.25; add((j) => ye[j] + 0.0011 + (COLLAR_TOP - ye[j] - 0.0011) * s, 0); }
  add(() => COLLAR_TOP, 0, 'up');
  // fecha por baixo (escondido dentro do corpo)
  rows.unshift({ pts: rows[0].pts.map(([x, y, z]) => [x * 0.9, y, z * 0.9, 0]) });
  return sweepGeometry(THREE, rows, { color: ([x, y], k) => (k <= 1 ? 0.7 : 1) });
}
