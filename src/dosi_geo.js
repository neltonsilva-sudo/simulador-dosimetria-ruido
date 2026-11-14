// Geometria auxiliar do DOSÍMETRO 3D (unidades em mm; o grupo pai escala 0,001).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function roundedRect(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape(); const x0 = cx - w / 2, y0 = cy - h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
/** retângulo com cantos em arco verdadeiro (r por canto: [bl, br, tr, tl]) — para Path de furos também */
export function roundRectArc(w, h, rs, cx = 0, cy = 0, P = THREE.Shape) {
  const s = new P(); const x0 = cx - w / 2, y0 = cy - h / 2; const [bl, br, tr, tl] = Array.isArray(rs) ? rs : [rs, rs, rs, rs];
  s.moveTo(x0 + bl, y0); s.lineTo(x0 + w - br, y0); if (br) s.absarc(x0 + w - br, y0 + br, br, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + h - tr); if (tr) s.absarc(x0 + w - tr, y0 + h - tr, tr, 0, Math.PI / 2, false);
  s.lineTo(x0 + tl, y0 + h); if (tl) s.absarc(x0 + tl, y0 + h - tl, tl, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + bl); if (bl) s.absarc(x0 + bl, y0 + bl, bl, Math.PI, Math.PI * 1.5, false);
  return s;
}
/** contorno simétrico a partir da metade direita (lista de pontos/curvas via função que desenha na metade x≥0) */
export function mirroredShape(halfPts, P = THREE.Shape) {
  // halfPts: pontos [x,y] de baixo (x=0) até o topo (x=0), lado direito, já amostrados
  const s = new P(); const n = halfPts.length;
  s.moveTo(halfPts[0][0], halfPts[0][1]);
  for (let i = 1; i < n; i++) s.lineTo(halfPts[i][0], halfPts[i][1]);
  for (let i = n - 2; i >= 1; i--) s.lineTo(-halfPts[i][0], halfPts[i][1]);
  s.closePath(); return s;
}
/** amostra curvas cúbicas encadeadas: segs = [[p0,c1,c2,p1],...] ou [p0,p1] (reta) */
export function samplePath(segs, per = 14) {
  const out = []; const v = (a) => new THREE.Vector2(a[0], a[1]);
  segs.forEach((s, k) => {
    const c = s.length === 4 ? new THREE.CubicBezierCurve(v(s[0]), v(s[1]), v(s[2]), v(s[3])) : new THREE.LineCurve(v(s[0]), v(s[1]));
    const N = s.length === 4 ? per : 1;
    for (let i = k === 0 ? 0 : 1; i <= N; i++) { const p = c.getPoint(i / N); out.push([p.x, p.y]); }
  });
  return out;
}

/**
 * Extrusão com bisel de quarto de círculo e normais suaves (mergeVertices), centrada em z.
 * uv: 'box' (projeção por eixo dominante em mm × uvScale) | 'planar' (xy normalizado no bbox → decalques/serigrafia)
 */
export function extrudeSmooth(shape, T, { bt = 1, bs = 1, seg = 6, curve = 24, uv = 'box', uvScale = 1, crease = false } = {}) {
  const depth = Math.max(0.0001, T - 2 * bt);
  let g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelOffset: -bs, bevelSegments: seg, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4); g.computeVertexNormals();
  g.computeBoundingBox(); const bb = g.boundingBox;
  const P = g.attributes.position, N = g.attributes.normal, uvA = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (uv === 'planar') { uvA[i * 2] = (x - bb.min.x) / (bb.max.x - bb.min.x); uvA[i * 2 + 1] = (y - bb.min.y) / (bb.max.y - bb.min.y); continue; }
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    let a, b; if (az >= ax && az >= ay) { a = x; b = y; } else if (ax >= ay) { a = z; b = y; } else { a = x; b = z; }
    uvA[i * 2] = a * uvScale; uvA[i * 2 + 1] = b * uvScale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
  return g;
}

/** varredura de seção 2D (pontos [u,v]) ao longo de uma polilinha no plano YZ (x = largura) */
export function sweepYZ(path, section, closedSection = true) {
  const pos = [], idx = []; const S = section.length;
  for (let i = 0; i < path.length; i++) {
    const p = path[i], a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let ty = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(ty, tz) || 1; ty /= l; tz /= l;
    const ny = -tz, nz = ty; // normal no plano
    for (const [u, v] of section) pos.push(u, p[0] + ny * v, p[1] + nz * v);
  }
  const E = closedSection ? S : S - 1;
  for (let i = 0; i < path.length - 1; i++) for (let j = 0; j < E; j++) {
    const a = i * S + j, b = i * S + ((j + 1) % S), c = (i + 1) * S + j, d = (i + 1) * S + ((j + 1) % S);
    idx.push(a, c, b, b, c, d);
  }
  // tampas
  const cap = (base, flip) => { for (let j = 1; j < S - 1; j++) flip ? idx.push(base, base + j + 1, base + j) : idx.push(base, base + j, base + j + 1); };
  cap(0, false); cap((path.length - 1) * S, true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
/** seção retangular arredondada (largura w, espessura t) como lista [u,v] */
export function roundedSection(w, t, r = t / 2, n = 4) {
  const pts = []; const hw = w / 2 - r, ht = t / 2 - r;
  const corners = [[hw, ht, 0], [-hw, ht, Math.PI / 2], [-hw, -ht, Math.PI], [hw, -ht, Math.PI * 1.5]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}

// ─── ícones das teclas (mm, centrados) ───
export function iconShapes(kind, s = 1) {
  const out = [];
  const bar = (x, y, w, h, r = Math.min(w, h) * 0.45) => out.push(roundRectArc(w * s, h * s, r * s, x * s, y * s));
  if (kind === 'power') {
    const R = 1.85 * s, r = 1.32 * s, g = 0.62; // anel com abertura no topo
    const a0 = Math.PI / 2 + g, a1 = Math.PI / 2 - g + Math.PI * 2;
    const sh = new THREE.Shape(); sh.absarc(0, 0, R, a0, a1, false);
    const ex = (R + r) / 2, ep = (R - r) / 2; // ponta arredondada
    sh.absarc(ex * Math.cos(a1), ex * Math.sin(a1), ep, a1, a1 + Math.PI, false);
    sh.absarc(0, 0, r, a1, a0, true);
    sh.absarc(ex * Math.cos(a0), ex * Math.sin(a0), ep, a0 + Math.PI, a0, false);
    out.push(sh); bar(0, 1.1, 0.52, 2.15, 0.26);
  } else if (kind === 'play') {
    const t = new THREE.Shape(); t.moveTo(-2.05 * s, -1.6 * s); t.lineTo(0.35 * s, 0); t.lineTo(-2.05 * s, 1.6 * s); t.closePath(); out.push(t);
    bar(1.0, 0, 0.55, 3.2, 0.12); bar(1.95, 0, 0.55, 3.2, 0.12);
  } else if (kind === 'stop') {
    out.push(roundRectArc(3.0 * s, 3.0 * s, 0.45 * s));
  } else if (kind === 'menu') {
    bar(0, 1.15, 3.5, 0.6); bar(0, 0, 3.5, 0.6); bar(0, -1.15, 3.5, 0.6);
  }
  return out;
}

/** pinta cores de vértice: fn(x,y,z,nx,ny,nz) → [r,g,b] multiplicadores (1 = sem mudança) */
export function paintVerts(geo, fn) {
  const P = geo.attributes.position, N = geo.attributes.normal, c = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const v = fn(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i)); c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
/** desloca uma meia-silhueta (x≥0, de baixo x=0 ao topo x=0) para fora por d mm (normal da polilinha) */
export function offsetHalf(half, d) {
  return half.map(([x, y], i) => {
    const a = half[Math.max(0, i - 1)], b = half[Math.min(half.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = ty, ny = -tx; // percorre no sentido anti-horário (direita sobe) → normal externa = (ty, −tx)
    return [i === 0 || i === half.length - 1 ? 0 : x + nx * d, y + ny * d];
  });
}
