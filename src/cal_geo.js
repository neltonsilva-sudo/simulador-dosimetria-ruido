// Geometria do corpo do calibrador CalPro (mm, y para cima, frente +z). Corpo de borracha "sabonete": seção retangular
// arredondada que AFINA para baixo, ombros arredondados no alto, base estreita e arredondada, bolsão frontal em U.
import * as THREE from 'three';

export const BODY = { yTop: 50, yBot: -50, hd: 19, r: 10.5, rtx: 10, rty: 9, rtz: 9.5, rb: 6, bore: 7.0, crown: 3.4 };
// meia-largura (silhueta frontal medida na foto de frente; 0,2857 mm/px)
const HW = [[-52, 19.2], [-50, 20.0], [-45, 21.9], [-40, 23.7], [-35, 25.6], [-31, 27.0], [-27, 28.0], [-22, 28.6], [-10, 29.3], [6, 30.1], [24, 31.1], [36, 31.9], [40, 32.0]];
function hwRaw(y) {
  if (y <= HW[0][0]) return HW[0][1]; if (y >= HW.at(-1)[0]) return HW.at(-1)[1];
  for (let i = 1; i < HW.length; i++) if (y <= HW[i][0]) { const [y0, a] = HW[i - 1], [y1, b] = HW[i]; return a + (b - a) * (y - y0) / (y1 - y0); }
  return 32;
}
export function hw(y) { let s = 0; for (let k = -3; k <= 3; k++) s += hwRaw(y + k * 0.6); return s / 7; }

/** bolsão frontal em U: d<0 dentro. */
export const POCKET = { a: 23.8, top: 42.6, yc: 7.5, b: 16.5, rc: 7, depth: 1.9, soft: 3.4 };
export function pocketSDF(x, y) {
  const P = POCKET, ax = Math.abs(x);
  if (y >= P.yc) { // parte reta com cantos superiores arredondados
    const qx = ax - (P.a - P.rc), qy = y - (P.top - P.rc);
    if (qx > 0 && qy > 0) return Math.hypot(qx, qy) - P.rc;
    return Math.max(ax - P.a, y - P.top);
  }
  const ex = ax / P.a, ey = (y - P.yc) / P.b, l2 = ex * ex + ey * ey + 1e-8, l = Math.sqrt(l2);
  return (l - 1) * (P.a * ex * ex + P.b * ey * ey) / l2;
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function pocketMask(x, y) { return 1 - sstep(-POCKET.soft, POCKET.soft, pocketSDF(x, y)); }

// seção (retângulo arredondado) com contagem fixa de amostras; começa no centro de trás e vai para +x
const NB = 22, NC = 16, NS = 22, NF = 48;
function section(hwv, hdv, r, out) {
  r = Math.max(0.25, Math.min(r, hwv - 0.01, hdv - 0.01)); const a = hwv - r, b = hdv - r; out.length = 0;
  const line = (x0, z0, x1, z1, n) => { for (let i = 0; i < n; i++) { const t = i / n; out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); } };
  const arc = (cx, cz, t0, t1, n) => { for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * i / n; out.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]); } };
  line(0, -hdv, a, -hdv, NB); arc(a, -b, -Math.PI / 2, 0, NC); line(hwv, -b, hwv, b, NS); arc(a, b, 0, Math.PI / 2, NC);
  line(a, hdv, -a, hdv, NF); arc(-a, b, Math.PI / 2, Math.PI, NC); line(-hwv, b, -hwv, -b, NS); arc(-a, -b, Math.PI, Math.PI * 1.5, NC);
  line(-a, -hdv, 0, -hdv, NB); out.push([0, -hdv]); return out;
}

export function bodyGeometry() {
  const B = BODY, rows = [];
  // tampa de baixo: fecha numa face plana (anel até o centro)
  const yjB = B.yBot + B.rb, hB = hw(B.yBot);
  for (let k = 0; k <= 4; k++) rows.push({ y: B.yBot, s: [hB - B.rb, B.hd - B.rb, 0.3], k: k / 4 });
  for (let i = 1; i <= 16; i++) { const f = (Math.PI / 2) * (1 - i / 16), ins = B.rb * (1 - Math.cos(f)), y = yjB - B.rb * Math.sin(f); rows.push({ y, s: [hw(y) - ins, B.hd - ins, B.r - ins] }); }
  const yjT = B.yTop - B.rty;
  for (let y = yjB + 0.5; y < yjT - 0.01; y += 0.5) rows.push({ y, s: [hw(y), B.hd, B.r] });
  const hT = hw(yjT);
  for (let i = 0; i <= 16; i++) { const f = (Math.PI / 2) * i / 16, c = 1 - Math.cos(f); rows.push({ y: yjT + B.rty * Math.sin(f), s: [hT - B.rtx * c, B.hd - B.rtz * c, B.r - B.rtz * c] }); }
  // topo: face plana até o furo do acoplador (círculo r=bore)
  for (let k = 1; k <= 4; k++) rows.push({ y: B.yTop, s: [hT - B.rtx, B.hd - B.rtz, 0.3], hole: k / 4 });

  const pos = [], uv = [], col = [], tmp = [];
  let cols = 0;
  rows.forEach((R, ri) => {
    section(R.s[0], R.s[1], R.s[2], tmp); cols = tmp.length;
    let s = 0;
    for (let i = 0; i < tmp.length; i++) {
      let [x, z] = tmp[i];
      if (R.k !== undefined) { x *= R.k; z *= R.k; }            // fundo: encolhe ao centro
      if (R.hole !== undefined) { const ang = Math.atan2(z, x), cx = Math.cos(ang) * B.bore, cz = Math.sin(ang) * B.bore; x = x + (cx - x) * R.hole; z = z + (cz - z) * R.hole; }
      if (i > 0) s += Math.hypot(x - pos[pos.length - 3], z - pos[pos.length - 1]);
      let y = R.y, ao = 1;
      // topo em arco (coroa): o centro sobe, os ombros caem
      y += B.crown * sstep(B.yTop - 38, B.yTop, R.y) * Math.max(0, 1 - (x / 33) ** 2);
      // bolsão frontal (desloca a frente para dentro em −z)
      if (z > 0) {
        const m = pocketMask(x, y) * sstep(B.hd - 7, B.hd - 0.5, z);
        if (m > 0) { z -= POCKET.depth * m; const d = pocketSDF(x, y); ao = 1 - 0.14 * Math.exp(-((d + 0.6) ** 2) / 3.2) * sstep(B.hd - 7, B.hd - 0.5, z + POCKET.depth * m); }
      }
      // sombra de contato sob o acoplador
      if (R.hole !== undefined) ao *= 0.82 + 0.18 * Math.min(1, Math.hypot(x, z) / 14);
      pos.push(x, y, z); uv.push(s, y + (R.k !== undefined ? -R.k * 6 : 0) + (R.hole !== undefined ? R.hole * 6 : 0)); col.push(ao, ao, ao);
    }
  });
  const idx = [];
  for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < cols - 1; i++) {
    const a = r * cols + i, b = a + 1, c = a + cols, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  // garante normais para fora (frente central deve apontar +z)
  const n = g.attributes.normal, mid = rows.findIndex((R) => R.y > 0) * cols + NB + NC + NS + NC + NF / 2;
  if (n.getZ(mid) < 0) { for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]; g.setIndex(idx); g.computeVertexNormals(); }
  // costura (primeiro/último vértice de cada linha): média das normais
  for (let r = 0; r < rows.length; r++) {
    const a = r * cols, b = a + cols - 1; const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  return g;
}

/** retângulo arredondado como THREE.Shape (centro cx,cy) */
export function rrect(w, h, r, cx = 0, cy = 0, P = THREE.Shape) {
  const s = new P(), x0 = cx - w / 2, y0 = cy - h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + h - r); s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y0 + h); s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false); return s;
}
/** janela preta: topo com cantos arredondados, fundo em U (semi-elipse) */
export function windowShape(W) {
  const s = new THREE.Shape(), a = (W.x1 - W.x0) / 2, cx = (W.x1 + W.x0) / 2, ys = 7.7, rc = 5.2, ry = ys - W.y0;
  s.moveTo(cx - a, ys); s.lineTo(cx - a, W.y1 - rc); s.absarc(cx - a + rc, W.y1 - rc, rc, Math.PI, Math.PI / 2, true);
  s.quadraticCurveTo(cx, W.y1 - 1.6, cx + a - rc, W.y1); s.absarc(cx + a - rc, W.y1 - rc, rc, Math.PI / 2, 0, true); s.lineTo(cx + a, ys);
  s.absellipse(cx, ys, a, ry, 0, -Math.PI, true); return s;
}
/** extrusão com bisel suave e UV planar (u,v ∈ 0..1 no retângulo dado) */
export function extrudePlanar(shape, depth, bevel, rect, curve = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: curve });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - rect[0]) / (rect[2] - rect[0]), (p.getY(i) - rect[1]) / (rect[3] - rect[1]));
  g.computeVertexNormals(); return g;
}
