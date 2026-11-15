// DETALHES — objetos soltos de estamparia em operação: peças estampadas e retalhos junto às prensas, caixas metálicas e KLT,
// tambores, mangueiras/cabos no piso, poças de óleo com serragem, carrinho e armário de ferramentas, estante, coleta seletiva,
// vassoura/pá, luvas/trapos na mesa da prensa e placas NR-26. Tudo procedural; geometria estática fundida por material
// (poucas draw calls) + instancing para peças pequenas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MACHINES } from './layout_machines.js';
import { HALL } from './layout_cams.js';
import * as T from './props_tex.js';
export const CLEAN = (() => { try { return new URLSearchParams(location.search).get('sujo') !== '1'; } catch { return true; } })(); // galpão limpo e organizado (5S); ?sujo=1 volta ao aspecto antigo

const R = T.rng(20261112);
const rr = (a, b) => a + R() * (b - a);

function std(o) { const m = new THREE.MeshStandardMaterial(o); return m; }
let MAT;
function mats() {
  if (MAT) return MAT;
  const rough = T.roughTex();
  const paint = (hex, o = {}) => std({ map: T.paintTex(hex, o), roughnessMap: rough, roughness: o.r ?? 0.8, metalness: o.m ?? 0.35 });
  MAT = {
    yellow: paint(0xd29a18, { seed: 2 }), blue: paint(0x2c5a8c, { seed: 3 }), grey: paint(0x7b8084, { seed: 4 }), green: paint(0x4f6a4c, { seed: 5 }),
    red: paint(0xa91c18, { seed: 6, rust: 0.5, r: 0.6 }), dark: paint(0x2a2b2c, { seed: 7, m: 0.5 }),
    galv: std({ map: T.paintTex(0x9a9d9c, { seed: 8, rust: 0.4 }), roughnessMap: rough, roughness: 0.55, metalness: 0.9 }),
    wood: std({ map: T.paintTex(0x8a6b45, { seed: 9, rust: 0, oil: 2 }), roughness: 0.92, metalness: 0 }),
    card: std({ map: T.paintTex(0x9c7b52, { seed: 10, rust: 0, oil: 0.5 }), roughness: 0.95, metalness: 0 }),
    part: std({ color: 0xc9ccce, roughnessMap: rough, roughness: 0.42, metalness: 1, side: THREE.DoubleSide }),
    partOil: std({ color: 0x8d8f8e, roughnessMap: rough, roughness: 0.22, metalness: 1, side: THREE.DoubleSide }),
    scrap: std({ color: 0xa9adb0, roughnessMap: rough, roughness: 0.35, metalness: 1, side: THREE.DoubleSide }),
    klBlue: std({ map: T.crateTex(0x2459a8), roughness: 0.55, metalness: 0 }),
    klGrey: std({ map: T.crateTex(0x666b70), roughness: 0.6, metalness: 0 }),
    klYel: std({ map: T.crateTex(0xd8a514), roughness: 0.55, metalness: 0 }),
    klRed: std({ map: T.crateTex(0xa82a22), roughness: 0.55, metalness: 0 }),
    drumBlue: std({ map: T.paintTex(0x1d4f9c, { seed: 11, rust: 0, oil: 1.5 }), roughness: 0.5, metalness: 0 }),
    drumRed: paint(0x8e1d16, { seed: 12, r: 0.55, m: 0.5 }), drumBlack: paint(0x232425, { seed: 13, r: 0.4, m: 0.6 }),
    hose: std({ color: 0x1b5fc4, roughness: 0.38, metalness: 0 }), hoseY: std({ color: 0xd8a212, roughness: 0.4, metalness: 0 }),
    cable: std({ color: 0x141414, roughness: 0.5, metalness: 0 }), cableO: std({ color: 0xc9561a, roughness: 0.5, metalness: 0 }),
    brass: std({ color: 0xb59a52, roughness: 0.35, metalness: 1 }), chrome: std({ color: 0xd8d8d8, roughness: 0.25, metalness: 1 }),
    rubber: std({ color: 0x151515, roughness: 0.85, metalness: 0 }),
    oil: std({ color: 0x070605, roughness: 0.05, metalness: 0, alphaMap: T.oilTex(), transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    saw: std({ map: T.sawdustTex(), roughness: 1, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    knit: std({ map: T.knitTex(), roughness: 0.95, metalness: 0 }),
    ragR: std({ map: T.ragTex(0x9a3a2c), roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    ragW: std({ map: T.ragTex(0xb9b2a2), roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    straw: std({ color: 0xb08a4a, roughness: 0.95, metalness: 0 }), stick: std({ color: 0x8a6a3a, roughness: 0.7, metalness: 0 }),
  };
  for (const k of ['auricular', 'oculos', 'luvas', 'prensa', 'ruido']) MAT['sign_' + k] = std({ map: T.signTex(k), roughness: 0.45, metalness: 0 });
  MAT.cart = std({ map: T.drawerTex(0xa91c18, 5, 6), roughness: 0.55, metalness: 0.35 });
  MAT.cab = std({ map: T.drawerTex(0x5d6a72, 9, 4), roughness: 0.7, metalness: 0.35 });
  return MAT;
}

// ── primitivas ──
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, s = 20) => new THREE.CylinderGeometry(r0, r1, h, s);
function mesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, opt = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.userData.cast = opt.cast ?? true; parent.add(m); return m;
}
let STAT = null; // grupo estático do buildProps (objetos de piso) → ângulo alinhado à malha do galpão no modo limpo
function grp(parent, x = 0, y = 0, z = 0, ry = 0) { if (CLEAN && parent === STAT) ry = Math.round(ry / (Math.PI / 2)) * (Math.PI / 2); const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; }

// ── peças estampadas (instanciadas) ──
function partGeos() {
  const s = new THREE.Shape(); const w = 0.14, h = 0.09, r = 0.015;
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  for (const hx of [-0.042, 0.042]) { const hp = new THREE.Path(); hp.absarc(hx, 0, 0.012, 0, Math.PI * 2, true); s.holes.push(hp); }
  const plate = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false, curveSegments: 6 }); plate.rotateX(-Math.PI / 2);
  // cantoneira dobrada (L)
  const a = new THREE.BoxGeometry(0.12, 0.003, 0.05), b = new THREE.BoxGeometry(0.12, 0.04, 0.003); a.translate(0, 0, 0); b.translate(0, 0.02, -0.025);
  const L = mergeGeometries([a.toNonIndexed(), b.toNonIndexed()]);
  // disco (blank / tampa estampada) com aba
  const disk = new THREE.CylinderGeometry(0.06, 0.065, 0.012, 20, 1, true); const cap = new THREE.CircleGeometry(0.06, 20); cap.rotateX(-Math.PI / 2); cap.translate(0, 0.006, 0);
  const D = mergeGeometries([disk.toNonIndexed(), cap.toNonIndexed()]);
  // retalhos irregulares de chapa
  const scraps = [0, 1, 2].map((k) => { const p = new THREE.Shape(); const n = 5 + k; for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2, rad = 0.05 + R() * 0.09; i ? p.lineTo(Math.cos(an) * rad * 1.6, Math.sin(an) * rad) : p.moveTo(Math.cos(an) * rad * 1.6, Math.sin(an) * rad); }
    const g = new THREE.ExtrudeGeometry(p, { depth: 0.002, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; });
  return { plate, L, D, scraps };
}

export function buildProps(stage, app) {
  const M = mats();
  const root = new THREE.Group(); root.name = 'props';
  const stat = new THREE.Group(); STAT = stat; // estático → fundido por material
  // faixa amarela de demarcação no piso (área de armazenagem, NR-26 / 5S)
  const zoneMat = std({ color: 0xe2b21c, roughness: 0.55, metalness: 0 });
  function zone(x, z, ry, w, d, ox = 0, oz = 0) { if (!CLEAN) return; const g = grp(stat, x, 0, z, ry), t = 0.05;
    for (const s of [-1, 1]) { mesh(g, box(w + t, 0.004, t), zoneMat, ox, 0.002, oz + s * d / 2, 0, 0, 0, { cast: false }); mesh(g, box(t, 0.004, d + t), zoneMat, ox + s * w / 2, 0.002, oz, 0, 0, 0, { cast: false }); } }
  const inst = { plate: [], L: [], D: [], s0: [], s1: [], s2: [] }; const instMat = { plate: M.part, L: M.partOil, D: M.part, s0: M.scrap, s1: M.scrap, s2: M.partOil };
  const tmpO = new THREE.Object3D();
  const pushI = (k, parentMatrix, x, y, z, rx, ry, rz, s = 1) => { tmpO.position.set(x, y, z); tmpO.rotation.set(rx, ry, rz); tmpO.scale.setScalar(s); tmpO.updateMatrix(); inst[k].push(parentMatrix ? tmpO.matrix.clone().premultiply(parentMatrix) : tmpO.matrix.clone()); };
  const G = partGeos();

  // monte de peças dentro de um volume (local de `g`)
  function heap(g, kinds, cx, cy, cz, w, d, hMax, n) {
    g.updateWorldMatrix(true, false); const pm = g.matrixWorld;
    for (let i = 0; i < n; i++) {
      const u = R() - 0.5, v = R() - 0.5; const hh = hMax * (1 - Math.min(1, (u * u + v * v) * 3.2)) * (0.6 + R() * 0.4);
      pushI(kinds[Math.floor(R() * kinds.length)], pm, cx + u * w, cy + hh, cz + v * d, rr(-0.9, 0.9), R() * 6.3, rr(-0.9, 0.9));
    }
  }
  // pilha ordenada de peças planas (empilhadas)
  function stack(g, kind, cx, cy, cz, n, ry = 0) { g.updateWorldMatrix(true, false); for (let i = 0; i < n; i++) pushI(kind, g.matrixWorld, cx + rr(-0.004, 0.004), cy + i * 0.0045, cz + rr(-0.004, 0.004), 0, ry + rr(-0.05, 0.05), 0); }
  // retalhos espalhados no piso (mundo)
  function floorScrap(cx, cz, rad, n) { if (CLEAN) return; for (let i = 0; i < n; i++) { const a = R() * 6.3, r = Math.sqrt(R()) * rad; pushI(['s0', 's1', 's2', 'plate', 'D'][Math.floor(R() * 5)], null, cx + Math.cos(a) * r, 0.003, cz + Math.sin(a) * r, rr(-0.06, 0.06), R() * 6.3, rr(-0.06, 0.06), rr(0.7, 1.2)); } }

  // ── caixa metálica de peças (aberta, pés para garfo) ──
  function steelBin(x, z, ry, mat, w = 0.9, h = 0.55, d = 0.7, fill = 1, kinds = ['plate', 'L', 'D']) {
    const g = grp(stat, x, 0, z, ry); const t = 0.022, y0 = 0.1; zone(x, z, g.rotation.y, w + 0.3, d + 0.3);
    mesh(g, box(w, t, d), mat, 0, y0 + t / 2, 0);
    mesh(g, box(w, h, t), mat, 0, y0 + h / 2, d / 2 - t / 2); mesh(g, box(w, h, t), mat, 0, y0 + h / 2, -d / 2 + t / 2);
    mesh(g, box(t, h, d), mat, w / 2 - t / 2, y0 + h / 2, 0); mesh(g, box(t, h, d), mat, -w / 2 + t / 2, y0 + h / 2, 0);
    // frente rebaixada (boca de acesso) + reforços
    for (const sx of [-1, 1]) { mesh(g, box(0.05, y0, d), M.dark, sx * (w / 2 - 0.08), y0 / 2, 0); mesh(g, box(0.04, h + 0.02, 0.04), mat, sx * (w / 2 - 0.02), y0 + h / 2, d / 2 - 0.02); }
    mesh(g, box(w + 0.02, 0.03, 0.03), mat, 0, y0 + h, d / 2 - 0.01);
    if (fill > 0) heap(g, kinds, 0, y0 + h * 0.35 * fill, 0, w - 0.1, d - 0.1, h * 0.65 * fill, Math.round(140 * fill * w * d / 0.63));
    return g;
  }
  // ── caixa plástica KLT (aberta) ──
  const kltGeo = (() => { const w = 0.6, h = 0.28, d = 0.4, t = 0.012; const parts = [box(w, t, d).translate(0, t / 2, 0), box(w, h, t).translate(0, h / 2, d / 2 - t / 2), box(w, h, t).translate(0, h / 2, -d / 2 + t / 2), box(t, h, d).translate(w / 2 - t / 2, h / 2, 0), box(t, h, d).translate(-w / 2 + t / 2, h / 2, 0), box(w + 0.012, 0.02, d + 0.012).translate(0, h - 0.01, 0)];
    return mergeGeometries(parts.map((p) => p.toNonIndexed())); })();
  function klt(parent, x, y, z, ry, mat, fill = 0) { const m = mesh(parent, kltGeo, mat, x, y, z, 0, ry); if (fill) { const g = grp(parent, x, y, z, ry); heap(g, ['plate', 'L', 'D'], 0, 0.18 * fill, 0, 0.5, 0.3, 0.1 * fill, 26); } return m; }
  function kltStack(x, z, ry, mats_, cols = 1, rows = 4, fillTop = true) {
    const g = grp(stat, x, 0, z, ry); zone(x, z, g.rotation.y, cols * 0.62 + 0.25, 0.65, (cols - 1) * 0.31, 0); const J = CLEAN ? 0 : 1;
    for (let c = 0; c < cols; c++) { const n = Math.max(1, rows - Math.floor(R() * 2)); for (let k = 0; k < n; k++) klt(g, c * 0.62 + rr(-0.01, 0.01) * J, k * 0.27, rr(-0.012, 0.012) * J, rr(-0.03, 0.03) * J, mats_[Math.floor(R() * mats_.length)], fillTop && k === n - 1 ? 1 : 0); }
    return g;
  }
  // ── palete de madeira ──
  function pallet(parent, x, y, z, ry) {
    const g = grp(parent, x, y, z, ry); if (parent === stat) zone(x, z, g.rotation.y, 1.5, 1.3);
    for (let i = 0; i < 7; i++) mesh(g, box(1.2, 0.022, 0.1), M.wood, 0, 0.133, -0.45 + i * 0.15);
    for (const zz of [-0.45, 0, 0.45]) { mesh(g, box(1.2, 0.022, 0.1), M.wood, 0, 0.011, zz); for (const xx of [-0.55, 0, 0.55]) mesh(g, box(0.1, 0.078, 0.1), M.wood, xx, 0.061, zz); }
    for (const xx of [-0.55, 0, 0.55]) mesh(g, box(0.1, 0.022, 1.0), M.wood, xx, 0.111, 0);
    return g;
  }
  // ── tambor de 200 L ──
  const drumGeo = (() => { const pts = []; const r = 0.29, H = 0.88; pts.push(new THREE.Vector2(0, 0), new THREE.Vector2(r - 0.01, 0), new THREE.Vector2(r, 0.02));
    for (const hy of [0.29, 0.59]) pts.push(new THREE.Vector2(r, hy - 0.025), new THREE.Vector2(r + 0.012, hy), new THREE.Vector2(r, hy + 0.025));
    pts.push(new THREE.Vector2(r, H - 0.02), new THREE.Vector2(r + 0.006, H), new THREE.Vector2(r - 0.02, H + 0.008), new THREE.Vector2(r - 0.025, H - 0.01), new THREE.Vector2(0, H - 0.01));
    return new THREE.LatheGeometry(pts, 28); })();
  function drum(x, z, mat, ry = 0, top = null) {
    const g = grp(stat, x, 0, z, ry); mesh(g, drumGeo, mat); zone(x, z, 0, 0.8, 0.8);
    mesh(g, cyl(0.03, 0.03, 0.02, 10), M.dark, 0.16, 0.88, 0.05);
    if (top === 'funnel') { mesh(g, cyl(0.12, 0.02, 0.14, 16), M.drumRed, -0.08, 0.95, -0.04); }
    if (top === 'rag' && !CLEAN) mesh(g, rag(0.35, 3), M.ragR, -0.03, 0.885, 0.02, 0, R() * 3);
    return g;
  }
  // trapo: plano amassado
  function rag(sz, seed) { const g = new THREE.PlaneGeometry(sz, sz * 0.8, 10, 8); g.rotateX(-Math.PI / 2); const p = g.attributes.position; const r2 = T.rng(seed);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const e = 1 - Math.max(Math.abs(x), Math.abs(z)) / (sz * 0.5); p.setY(i, Math.max(0, (r2() * 0.02 + Math.sin(x * 40 + seed) * 0.008) * (0.4 + e))); p.setX(i, x * (0.75 + 0.25 * r2())); p.setZ(i, z * (0.75 + 0.25 * r2())); }
    g.computeVertexNormals(); return g; }
  // luva de tricô (palma + dedos)
  function glove(parent, x, y, z, ry, curl = 0.2) {
    const g = grp(parent, x, y, z, ry);
    const palm = new THREE.SphereGeometry(0.05, 12, 8); palm.scale(1, 0.28, 1.25); mesh(g, palm, M.knit, 0, 0.014, 0, 0, 0, 0, { cast: false });
    mesh(g, cyl(0.045, 0.05, 0.08, 12).rotateX(Math.PI / 2).scale(1, 0.4, 1), M.knit, 0, 0.012, 0.09, 0, 0, 0, { cast: false });
    for (let k = 0; k < 4; k++) { const f = new THREE.CapsuleGeometry(0.0095, 0.05 - Math.abs(k - 1.5) * 0.008, 3, 6); f.rotateX(Math.PI / 2); mesh(g, f, M.knit, -0.033 + k * 0.022, 0.012 + curl * 0.01, -0.09, curl * (k % 2 ? 0.4 : 0.2), (k - 1.5) * 0.08, 0, { cast: false }); }
    const th = new THREE.CapsuleGeometry(0.011, 0.04, 3, 6); th.rotateX(Math.PI / 2); mesh(g, th, M.knit, 0.058, 0.01, -0.02, 0, -0.7, 0, { cast: false });
    return g;
  }
  // mangueira/cabo no piso por pontos (x,z) — tubo com leve ondulação
  function floorTube(pts, rad, mat, segs = 120) {
    if (CLEAN) return; // cabos e mangueiras pela eletrocalha/linha aérea, nada solto no piso
    const v = pts.map(([x, z, y = 0]) => new THREE.Vector3(x, rad + y, z)); const c = new THREE.CatmullRomCurve3(v, false, 'catmullrom', 0.4);
    mesh(stat, new THREE.TubeGeometry(c, segs, rad, 7), mat, 0, 0, 0, 0, 0, 0, { cast: false });
  }
  // rolo de mangueira/cabo largado (espiras empilhadas)
  function coil(x, z, rad, R0, turns, mat) {
    if (CLEAN) return;
    const pts = []; for (let i = 0; i <= turns * 24; i++) { const a = (i / 24) * Math.PI * 2; const rrr = R0 * (1 + 0.12 * Math.sin(a * 0.5 + i * 0.01)) + (i / (turns * 24)) * 0.04; pts.push(new THREE.Vector3(x + Math.cos(a) * rrr, rad + Math.min(0.6, i / (turns * 24)) * rad * 3 * (0.5 + 0.5 * Math.sin(a)), z + Math.sin(a) * rrr * 0.85)); }
    mesh(stat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 30, rad, 7), mat, 0, 0, 0, 0, 0, 0, { cast: false });
  }
  // poça de óleo + serragem absorvente
  function puddle(x, z, s, sawdust = true, ry = R() * 6) {
    if (CLEAN) return; // piso limpo: sem óleo nem serragem
    const o = mesh(stat, new THREE.PlaneGeometry(s, s * 0.75).rotateX(-Math.PI / 2), M.oil, x, 0.004, z, 0, ry, 0, { cast: false }); o.renderOrder = 2;
    if (sawdust) { const d = mesh(stat, new THREE.PlaneGeometry(s * 0.8, s * 0.7).rotateX(-Math.PI / 2), M.saw, x + s * 0.18, 0.006, z - s * 0.08, 0, ry + 0.7, 0, { cast: false }); d.renderOrder = 3; }
  }
  // placa NR-26 com chapa de fundo
  function sign(parent, kind, x, y, z, ry, w = 0.36) {
    const g = grp(parent, x, y, z, ry); const h = w * 1.406;
    mesh(g, box(w + 0.02, h + 0.02, 0.008), M.galv, 0, 0, -0.004, 0, 0, 0, { cast: false });
    mesh(g, new THREE.PlaneGeometry(w, h), M['sign_' + kind], 0, 0, 0.0015, 0, 0, rr(-0.012, 0.012), { cast: false });
    return g;
  }
  // placa em poste (pedestal)
  function signPost(x, z, ry, kinds) {
    const g = grp(stat, x, 0, z, ry);
    mesh(g, cyl(0.2, 0.22, 0.04, 20), M.dark, 0, 0.02, 0); mesh(g, cyl(0.025, 0.025, 2.2, 10), M.yellow, 0, 1.1, 0);
    kinds.forEach((k, i) => sign(g, k, 0, 1.95 - i * 0.56, 0.03, 0, 0.36));
  }
  // carrinho de ferramentas vermelho
  function toolCart(x, z, ry) {
    const g = grp(stat, x, 0, z, ry); const W = 0.72, D = 0.46, H = 0.82;
    mesh(g, box(W, H - 0.12, D), M.red, 0, 0.12 + (H - 0.12) / 2, 0);
    mesh(g, new THREE.PlaneGeometry(W - 0.04, H - 0.2), M.cart, 0, 0.12 + (H - 0.12) / 2 - 0.02, D / 2 + 0.002, 0, 0, 0, { cast: false });
    mesh(g, box(W + 0.02, 0.04, D + 0.02), M.dark, 0, H + 0.02, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { mesh(g, cyl(0.045, 0.045, 0.03, 14).rotateX(Math.PI / 2), M.rubber, sx * (W / 2 - 0.06), 0.05, sz * (D / 2 - 0.06), 0, Math.PI / 2); mesh(g, box(0.05, 0.05, 0.05), M.dark, sx * (W / 2 - 0.06), 0.1, sz * (D / 2 - 0.06)); }
    mesh(g, cyl(0.012, 0.012, D, 8).rotateX(Math.PI / 2), M.chrome, W / 2 + 0.06, H - 0.05, 0); for (const sz of [-1, 1]) mesh(g, box(0.07, 0.02, 0.02), M.chrome, W / 2 + 0.03, H - 0.05, sz * (D / 2 - 0.03));
    // ferramentas sobre o tampo: chaves, martelo, alicate, lata de spray, paquímetro
    for (let i = 0; i < 4; i++) mesh(g, box(0.22 - i * 0.03, 0.008, 0.022), M.chrome, -0.15 + rr(-0.02, 0.02), H + 0.045, -0.12 + i * 0.05, 0, rr(-0.2, 0.2), 0, { cast: false });
    mesh(g, cyl(0.014, 0.014, 0.3, 8).rotateZ(Math.PI / 2), M.stick, 0.14, H + 0.055, 0.08, 0, 0.5, 0); mesh(g, box(0.1, 0.035, 0.035), M.dark, 0.02, H + 0.06, 0.15, 0, 0.5, 0);
    mesh(g, cyl(0.032, 0.032, 0.19, 14), M.blue, 0.22, H + 0.135, -0.1); mesh(g, cyl(0.012, 0.012, 0.03, 8), M.dark, 0.22, H + 0.245, -0.1);
    if (!CLEAN) mesh(g, rag(0.3, 7), M.ragW, -0.1, H + 0.04, 0.12, 0, 1.0, 0, { cast: false });
    return g;
  }
  // armário de gavetas + estante aberta com caixas, latas e papelão
  function cabinet(x, z, ry) {
    const g = grp(stat, x, 0, z, ry);
    mesh(g, box(0.9, 1.85, 0.55), M.grey, 0, 0.925, 0); mesh(g, new THREE.PlaneGeometry(0.86, 1.7), M.cab, 0, 0.95, 0.277, 0, 0, 0, { cast: false });
    // coisas em cima: caixa de papelão, lata, KLT
    mesh(g, box(0.4, 0.25, 0.3), M.card, -0.18, 1.975, 0, 0, 0.2); klt(g, 0.12, 1.85, 0, 0.1, M.klRed, 0);
    return g;
  }
  function shelf(x, z, ry) {
    const g = grp(stat, x, 0, z, ry); const W = 1.8, D = 0.5, H = 2.1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, box(0.04, H, 0.04), M.blue, sx * (W / 2 - 0.02), H / 2, sz * (D / 2 - 0.02));
    const lv = [0.12, 0.62, 1.12, 1.62, 2.06];
    for (const y of lv) { mesh(g, box(W, 0.025, D), M.galv, 0, y, 0); mesh(g, box(W, 0.06, 0.02), M.yellow, 0, y - 0.02, D / 2); }
    for (let i = 0; i < lv.length - 1; i++) { let xx = -W / 2 + 0.05; while (xx < W / 2 - 0.35) {
      const pick = R(); const y = lv[i] + 0.013;
      if (pick < 0.45) { const m = [M.klBlue, M.klGrey, M.klYel][Math.floor(R() * 3)]; klt(g, xx + 0.3, y, 0, Math.PI / 2 * 0 + rr(-0.05, 0.05), m, R() < 0.5 ? 1 : 0); xx += 0.62; }
      else if (pick < 0.7) { const w = rr(0.25, 0.45), h = rr(0.15, 0.4); mesh(g, box(w, h, rr(0.25, 0.42)), M.card, xx + w / 2, y + h / 2, 0, 0, rr(-0.1, 0.1)); xx += w + 0.04; }
      else if (pick < 0.85) { for (let k = 0; k < 3; k++) mesh(g, cyl(0.06, 0.06, 0.18, 14), [M.drumRed, M.yellow, M.blue][k], xx + 0.07 + k * 0.13, y + 0.09, rr(-0.1, 0.1)); xx += 0.42; }
      else { const gg = grp(g, xx + 0.2, y, 0); heap(gg, ['plate', 'D'], 0, 0.02, 0, 0.3, 0.3, 0.05, 30); xx += 0.42; }
    } }
    // vassoura e pá encostadas na lateral
    const b = grp(g, W / 2 + 0.08, 0, 0.12, 0); const bt = grp(b, 0, 0, 0, 0); bt.rotation.z = -0.22;
    mesh(bt, cyl(0.012, 0.012, 1.35, 8), M.stick, 0, 0.72, 0); mesh(bt, box(0.06, 0.05, 0.36), M.drumRed, 0, 0.06, 0); mesh(bt, box(0.05, 0.06, 0.34), M.straw, 0, 0.012, 0);
    const p = grp(g, W / 2 + 0.1, 0, -0.14, 0); const pt = grp(p, 0, 0, 0, 0); pt.rotation.z = -0.3;
    mesh(pt, cyl(0.013, 0.013, 1.1, 8), M.stick, 0, 0.66, 0); mesh(pt, box(0.02, 0.26, 0.24), M.dark, 0.01, 0.12, 0);
    return g;
  }
  // lixeiras de coleta seletiva (CONAMA 275: azul papel, vermelho plástico, verde vidro, amarelo metal, cinza não-reciclável)
  function recycle(x, z, ry) {
    const g = grp(stat, x, 0, z, ry); const cols = [0x1f57b0, 0xb3201b, 0x2f7d3a, 0xd9a614, 0x6b6e70];
    cols.forEach((c, i) => { const m = std({ map: T.paintTex(c, { seed: 30 + i, rust: 0, oil: 0.4 }), roughness: 0.5, metalness: 0 });
      const b = cyl(0.21, 0.18, 0.72, 16); b.scale(1, 1, 0.85); mesh(g, b, m, i * 0.46, 0.36, 0); const l = cyl(0.225, 0.225, 0.05, 16); l.scale(1, 1, 0.85); mesh(g, l, m, i * 0.46, 0.745, 0); });
    return g;
  }

  // ══════════════ POVOAMENTO ══════════════
  // 1) junto de cada prensa (frame local da máquina: frente +z, mesa a y≈0,88)
  const pressFrame = (m) => grp(root, m.pos[0], 0, m.pos[2], m.rotY);
  for (const m of MACHINES) {
    if (m.kind !== 'press' && m.kind !== 'grinder') continue;
    const f = pressFrame(m); f.updateWorldMatrix(true, true);
    const w = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyMatrix4(f.matrixWorld);
    if (m.kind === 'press') {
      // retalhos/estampados pelo chão na frente
      const a = w(0.25, 0.85); floorScrap(a.x, a.z, 0.55, 26);
      if (m.id !== 'prensa1') {
        const p = w(0.98, 0.75); steelBin(p.x, p.z, m.rotY + rr(-0.12, 0.12), R() < 0.5 ? M.yellow : M.blue, 0.8, 0.5, 0.6, 1);
        const q = w(-1.0, 0.65); const pl = pallet(stat, q.x, 0, q.z, m.rotY + 0.05); stack(pl, 'D', -0.3, 0.15, -0.2, 40); stack(pl, 'D', -0.3, 0.15, 0.2, 34); stack(pl, 'plate', 0.25, 0.15, 0, 55, 0.4);
        const o = w(0.35, 1.25); puddle(o.x, o.z, 0.9, true);
        const kl = w(1.0, -0.2); kltStack(kl.x, kl.z, m.rotY, [M.klBlue, M.klGrey], 1, 3);
      } else {
        // prensa do posto: luvas + trapo + caixinha de peças sobre a mesa; KLT com peças no chão ao lado
        glove(f, 0.36, 0.882, 0.3, 0.6); glove(f, 0.42, 0.886, 0.22, 2.3, 0.6);
        if (!CLEAN) mesh(f, rag(0.3, 4), M.ragR, -0.36, 0.882, 0.3, 0, 0.4, 0, { cast: false });
        const tb = grp(f, -0.2, 0.882, 0.36); heap(tb, ['plate', 'L'], 0, 0.004, 0, 0.12, 0.06, 0.01, 6);
        const kq = w(-0.95, -0.2); klt(stat, kq.x, 0, kq.z, m.rotY + 0.1, M.klBlue, 1);
        const kq2 = w(-1.05, 0.35); klt(stat, kq2.x, 0, kq2.z, m.rotY - 0.08, M.klGrey, 1);
        const o = w(0.6, 1.2); puddle(o.x, o.z, 0.7, true);
      }
    } else {
      const b = w(0.9, 0.9); steelBin(b.x, b.z, m.rotY + 0.3, M.blue, 0.9, 0.5, 0.7, 1, ['s0', 's1', 's2']);
      const c = w(-1.0, 1.0); drum(c.x, c.z, M.drumBlue, 0, 'rag');
    }
  }
  // prensa hidráulica: caixas e tambor de óleo
  { const m = MACHINES.find((k) => k.id === 'prensa4'); if (m) { const [x, , z] = m.pos; steelBin(x + 1.3, z + 0.9, 0.2, M.yellow, 0.9, 0.55, 0.7, 1); drum(x - 1.2, z + 0.8, M.drumBlack, 0, 'funnel'); puddle(x - 0.9, z + 1.2, 1.1, true); floorScrap(x, z + 1.1, 0.6, 18); kltStack(x + 1.4, z - 0.6, 0.1, [M.klGrey, M.klBlue], 2, 4); } }
  // 2) corredor do posto (fundo da foto, entre as prensas e a faixa x=1,55)
  drum(0.95, -10.9, M.drumBlue, 0.3); drum(1.18, -11.45, M.drumBlue, 1.1, 'rag'); drum(0.68, -11.55, M.drumBlue, 2.0);
  kltStack(0.55, -7.9, 0.06, [M.klBlue, M.klGrey, M.klBlue], 2, 5);
  { const p = pallet(stat, 0.6, 0, -14.2, 0.1); stack(p, 'D', -0.3, 0.15, -0.25, 60); stack(p, 'D', -0.3, 0.15, 0.22, 48); stack(p, 'plate', 0.25, 0.15, -0.2, 70, 0.2); stack(p, 'plate', 0.25, 0.15, 0.25, 64, -0.1); }
  toolCart(0.82, -4.95, -0.5);
  signPost(1.0, -8.8, -0.12, ['auricular', 'oculos']);
  signPost(-1.35, -5.1, 0.3, ['prensa', 'luvas']);
  cabinet(-0.4, -17.6, 0.1); shelf(1.0, -17.9, -0.05);
  recycle(-1.0, -19.0, 0.0);
  steelBin(-0.2, -12.6, 0.4, M.yellow, 0.9, 0.55, 0.7, 1);
  // 3) piso da borda inferior: mangueira pneumática azul vindo do painel/prensa, cabo espiralado e poça com serragem
  floorTube([[-1.0, -1.6], [-0.5, -2.2], [0.1, -2.5], [0.45, -3.3], [0.2, -4.4], [-0.3, -5.0], [-0.9, -5.4], [-1.2, -6.2], [-0.8, -6.9], [-1.2, -7.6]], 0.009, M.hose);
  coil(-1.0, -5.75, 0.009, 0.22, 3, M.hose); coil(0.42, -6.3, 0.011, 0.18, 4, M.cableO);
  floorTube([[0.42, -6.12], [0.3, -5.6], [0.45, -5.0], [0.3, -4.2], [0.62, -3.0], [0.66, -0.9]], 0.011, M.cableO, 60);
  floorTube([[0.62, -0.6], [0.9, -1.4], [0.7, -2.0], [1.1, -2.9], [1.2, -3.8], [1.3, -5.5], [1.45, -7.5], [1.4, -10]], 0.011, M.cable);
  coil(1.15, -2.6, 0.01, 0.17, 4, M.cableO);
  floorTube([[1.15, -2.45], [0.95, -2.2], [0.75, -1.6], [0.66, -0.9]], 0.01, M.cableO, 40);
  puddle(0.3, -5.45, 0.8, true); puddle(-0.55, -4.4, 0.5, false); floorScrap(-0.6, -5.2, 0.6, 14); puddle(-0.4, -6.8, 0.6, false); puddle(0.9, -9.0, 0.9, true); floorScrap(0.2, -2.8, 0.5, 10);
  // mangueiras saindo das prensas para a linha de ar (azuis, pelo chão)
  for (const id of ['prensa2', 'prensa3']) { const m = MACHINES.find((k) => k.id === id); if (!m) continue; const [x, , z] = m.pos; floorTube([[x + 0.3, z - 0.55], [x + 0.9, z - 0.8], [x + 1.4, z - 0.4], [x + 1.9, z - 0.9], [x + 1.6, z - 1.6]], 0.008, M.hose, 60); coil(x + 1.75, z - 1.25, 0.008, 0.16, 2, M.hoseY); }
  // 4) placas NR-26 nos pilares (faces voltadas para o vão B) + parede do fundo
  for (const z of HALL.frames) {
    if (z > 6 || z < -30) continue;
    sign(stat, z % 12 === 1 ? 'oculos' : 'auricular', -12 + 0.16, 1.85, z + 0.12, Math.PI / 2, 0.4);
    sign(stat, 'ruido', HALL.x1 - 0.2 - 0.16, 1.85, z - 0.12, -Math.PI / 2, 0.4);
    if (z < 0) sign(stat, 'prensa', -12 + 0.16, 1.2, z + 0.12, Math.PI / 2, 0.3);
  }
  for (const [x, k] of [[-3.0, 'auricular'], [-2.4, 'oculos'], [-1.8, 'luvas'], [2.6, 'ruido']]) sign(stat, k, x, 2.3, HALL.z0 + 0.06, 0, 0.5);
  // 5) área do compressor e vão A: tambores de óleo, KLTs, caixas
  { const m = MACHINES.find((k) => k.id === 'compressor'); const [x, , z] = m ? m.pos : [-9.5, 0, -16];
    drum(x + 1.6, z + 1.2, M.drumBlack, 0.4, 'funnel'); drum(x + 2.2, z + 1.0, M.drumRed, 1.2); drum(x + 1.9, z + 1.7, M.drumRed, 2.1); puddle(x + 1.9, z + 2.1, 1.0, true);
    kltStack(x - 1.0, z + 2.3, 0.2, [M.klGrey, M.klYel], 2, 3); }
  steelBin(-10.6, -2.0, 1.4, M.yellow, 0.9, 0.55, 0.7, 1); steelBin(-10.5, -8.5, 1.5, M.blue, 0.9, 0.55, 0.7, 0.8);
  kltStack(-11.0, -10.6, Math.PI / 2, [M.klBlue, M.klGrey], 2, 4); toolCart(-6.2, -6.9, 0.6); shelf(-11.5, -13.4, Math.PI / 2); cabinet(-11.5, -7.0, Math.PI / 2);
  puddle(-5.2, -9.0, 0.8, true); floorScrap(-4.6, -11.5, 0.7, 20);

  // ══════════════ 6) FUNDO "CHEIO" (rodada 5): bancadas, carrinhos, paleteira, estantes, caixas — fundo da vista ref ══════════════
  // bancada de ajustagem: tampo de madeira gasta, estrutura verde-cinza, morsa, gaveteiro, KLTs e peças em cima
  function workbench(x, z, ry, L = 2.0) {
    const g = grp(stat, x, 0, z, ry); const H = 0.88, D = 0.72;
    mesh(g, box(L, 0.05, D), M.wood, 0, H, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, box(0.06, H - 0.03, 0.06), M.green, sx * (L / 2 - 0.05), (H - 0.03) / 2, sz * (D / 2 - 0.05));
    mesh(g, box(L - 0.1, 0.03, D - 0.1), M.green, 0, 0.18, 0); mesh(g, box(L, 0.5, 0.02), M.green, 0, H + 0.27, -D / 2 + 0.01);
    mesh(g, box(0.5, 0.6, D - 0.08), M.cab, L / 2 - 0.32, 0.55, 0);
    const v = grp(g, -L / 2 + 0.25, H + 0.025, D / 2 - 0.12); mesh(v, box(0.16, 0.12, 0.2), M.blue, 0, 0.06, 0); mesh(v, box(0.18, 0.08, 0.04), M.dark, 0, 0.15, 0.06); mesh(v, cyl(0.01, 0.01, 0.3, 6).rotateZ(Math.PI / 2), M.chrome, 0, 0.1, 0.16);
    klt(g, 0.1, H + 0.025, -0.08, 0.05, [M.klBlue, M.klGrey, M.klYel][Math.floor(R() * 3)], 1);
    const hp = grp(g, -0.45, H + 0.03, 0.05); heap(hp, ['plate', 'L', 'D'], 0, 0, 0, 0.4, 0.3, 0.03, 16);
    if (!CLEAN) mesh(g, rag(0.3, 11), M.ragW, 0.55, H + 0.03, 0.15, 0, R() * 3, 0, { cast: false });
    for (let i = 0; i < 4; i++) mesh(g, box(0.02, 0.22, 0.02), M.chrome, -0.6 + i * 0.12, H + 0.32, -D / 2 + 0.04);
    mesh(g, box(0.4, 0.14, 0.12), M.red, 0.6, H + 0.35, -D / 2 + 0.08);
    return g;
  }
  // carrinho plataforma com caixas/peças
  function platCart(x, z, ry) {
    const g = grp(stat, x, 0, z, ry); const L = 1.1, W = 0.65; zone(x, z, g.rotation.y, 1.4, 0.95);
    mesh(g, box(L, 0.04, W), M.grey, 0, 0.22, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, cyl(0.07, 0.07, 0.04, 14).rotateX(Math.PI / 2), M.rubber, sx * (L / 2 - 0.1), 0.07, sz * (W / 2 - 0.08));
    mesh(g, box(0.03, 0.85, 0.03), M.grey, -L / 2, 0.64, -W / 2 + 0.03); mesh(g, box(0.03, 0.85, 0.03), M.grey, -L / 2, 0.64, W / 2 - 0.03); mesh(g, cyl(0.016, 0.016, W, 8).rotateX(Math.PI / 2), M.dark, -L / 2, 1.05, 0);
    if (R() < 0.5) { klt(g, 0.15, 0.24, -0.12, 0, M.klBlue, 1); klt(g, 0.15, 0.24, 0.17, 0.04, M.klGrey, 1); klt(g, 0.15, 0.51, 0, 0.1, M.klBlue, 0); }
    else { mesh(g, box(0.5, 0.4, 0.4), M.card, 0.1, 0.44, -0.1, 0, 0.1); mesh(g, box(0.4, 0.3, 0.35), M.card, 0.2, 0.39, 0.15, 0, -0.2); mesh(g, box(0.35, 0.25, 0.3), M.card, 0.1, 0.765, 0, 0, 0.3); }
    return g;
  }
  // paleteira manual amarela
  function palletJack(x, z, ry) {
    const g = grp(stat, x, 0, z, ry);
    for (const sz of [-0.2, 0.2]) mesh(g, box(1.15, 0.06, 0.16), M.yellow, 0.1, 0.05, sz);
    mesh(g, box(0.3, 0.3, 0.55), M.yellow, -0.6, 0.2, 0); mesh(g, cyl(0.04, 0.04, 0.25, 12), M.chrome, -0.62, 0.45, 0);
    const hd = grp(g, -0.65, 0.5, 0); hd.rotation.z = 0.45; mesh(hd, cyl(0.016, 0.016, 1.0, 8), M.dark, 0, 0.5, 0); mesh(hd, box(0.04, 0.04, 0.32), M.dark, 0, 1.0, 0);
    return g;
  }
  // estante de peças alta (2,4 m) com KLTs e caixas
  function tallRack(x, z, ry, W = 2.4) {
    const g = grp(stat, x, 0, z, ry); const D = 0.6, H = 2.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, box(0.06, H, 0.06), M.green, sx * (W / 2 - 0.03), H / 2, sz * (D / 2 - 0.03));
    for (const y of [0.1, 0.75, 1.4, 2.05]) { mesh(g, box(W, 0.03, D), M.galv, 0, y, 0); mesh(g, box(W, 0.08, 0.03), M.yellow, 0, y - 0.03, D / 2); 
      let xx = -W / 2 + 0.06; while (xx < W / 2 - 0.4) { if (R() < 0.6) { klt(g, xx + 0.3, y + 0.015, rr(-0.03, 0.03), Math.PI / 2 * 0, [M.klBlue, M.klBlue, M.klGrey, M.klYel, M.klRed][Math.floor(R() * 5)], R() < 0.4 ? 1 : 0); xx += 0.63; } else { const w = rr(0.3, 0.55), h = rr(0.2, 0.45); mesh(g, box(w, h, rr(0.3, 0.5)), M.card, xx + w / 2, y + 0.015 + h / 2, 0, 0, rr(-0.08, 0.08)); xx += w + 0.05; } } }
    return g;
  }
  // fundo à direita do corredor (atrás da trabalhadora, visto entre ela e o painel)
  workbench(2.7, -6.2, -Math.PI / 2, 2.2); workbench(2.7, -9.0, -Math.PI / 2, 2.2); workbench(2.6, -13.5, -Math.PI / 2 + 0.05, 2.0);
  tallRack(3.1, -17.0, -Math.PI / 2, 2.6); tallRack(3.1, -20.2, -Math.PI / 2, 2.6); tallRack(-0.9, -22.5, 0.02, 2.4);
  platCart(1.9, -7.4, 0.3); platCart(2.0, -11.6, -0.2); platCart(-0.6, -15.4, 1.2); platCart(5.2, -8.6, 0.6);
  palletJack(2.2, -3.6, 0.9); palletJack(-0.4, -20.5, 2.2);
  kltStack(2.4, -15.0, 0.3, [M.klBlue, M.klGrey], 2, 5); kltStack(4.6, -11.0, -0.2, [M.klYel, M.klGrey], 1, 4); kltStack(-1.0, -12.3, 0.4, [M.klBlue], 1, 4);
  steelBin(4.1, -5.0, 0.15, M.blue, 0.9, 0.55, 0.7, 1); steelBin(1.9, -18.8, -0.3, M.yellow, 0.9, 0.55, 0.7, 1); steelBin(4.4, -14.5, 0.5, M.grey, 0.9, 0.55, 0.7, 0.9);
  drum(4.3, -7.0, M.drumBlue, 0.2); drum(4.85, -7.25, M.drumBlue, 1.4, 'rag'); drum(3.0, -22.6, M.drumBlack, 0.6, 'funnel'); drum(3.6, -22.8, M.drumRed, 1.0);
  { const p = pallet(stat, 5.4, 0, -12.8, 0.15); mesh(p, box(1.0, 0.7, 0.8), M.card, 0, 0.5, 0); mesh(p, box(0.8, 0.45, 0.7), M.card, 0.05, 1.075, 0, 0, 0.1); }
  { const p = pallet(stat, 1.0, 0, -24.5, -0.1); stack(p, 'D', -0.3, 0.15, 0, 70); stack(p, 'plate', 0.25, 0.15, 0, 80, 0.3); }
  cabinet(4.6, -17.6, -Math.PI / 2); cabinet(4.6, -18.6, -Math.PI / 2); toolCart(1.95, -21.0, 0.4);
  // fundo à esquerda (entre a prensa do posto e a trabalhadora)
  platCart(-0.9, -8.6, 1.4); kltStack(-1.0, -3.4, 0.2, [M.klBlue, M.klGrey], 1, 3); workbench(-1.2, -26.5, 0, 2.4); tallRack(1.8, -26.8, 0, 2.4);
  // fundo do vão B à esquerda (linha de visada da câmera ref, atrás das prensas 2/3/4 e do esmeril)
  workbench(-6.4, -9.6, 0.05, 2.2); workbench(-6.0, -12.6, Math.PI / 2, 2.0); workbench(-9.6, -21.5, Math.PI / 2, 2.4); workbench(-4.6, -27.5, 0, 2.2);
  tallRack(-8.2, -18.2, 0, 2.6); tallRack(-5.2, -18.2, 0, 2.6); tallRack(-11.2, -25.5, Math.PI / 2, 2.6); tallRack(-7.5, -30.5, 0, 2.6); tallRack(-4.6, -30.5, 0, 2.6);
  platCart(-4.9, -8.1, 0.7); platCart(-7.6, -14.6, -0.4); platCart(-5.6, -22.0, 1.9); platCart(-9.0, -11.3, 0.2);
  palletJack(-7.8, -7.6, 2.6); palletJack(-6.7, -25.6, 0.3);
  kltStack(-8.6, -9.4, 0.15, [M.klBlue, M.klGrey], 2, 5); kltStack(-4.4, -16.0, -0.2, [M.klYel, M.klBlue], 2, 4); kltStack(-10.4, -17.6, 1.2, [M.klBlue], 1, 5); kltStack(-2.6, -21.2, 0.1, [M.klGrey, M.klBlue], 2, 4);
  steelBin(-5.0, -15.2, 0.3, M.yellow, 0.9, 0.55, 0.7, 1); steelBin(-7.4, -23.6, -0.2, M.blue, 0.9, 0.55, 0.7, 1); steelBin(-3.0, -24.8, 0.6, M.grey, 0.9, 0.55, 0.7, 1);
  drum(-8.2, -12.4, M.drumBlue, 0.1); drum(-8.7, -12.7, M.drumBlue, 0.9, 'rag'); drum(-10.9, -28.5, M.drumRed, 0.2); drum(-10.3, -28.8, M.drumBlack, 1.4, 'funnel');
  for (const [x, z, r] of [[-9.6, -4.6, 0.2], [-10.8, -14.4, 1.1], [-6.2, -20.0, 0.4], [-2.4, -28.6, -0.3]]) { const p = pallet(stat, x, 0, z, r); mesh(p, box(1.0, 0.65, 0.8), M.card, 0, 0.47, 0, 0, rr(-0.1, 0.1)); if (R() < 0.6) mesh(p, box(0.7, 0.4, 0.6), M.card, rr(-0.1, 0.1), 0.995, 0, 0, rr(-0.2, 0.2)); }
  puddle(-6.6, -11.0, 1.0, true); puddle(-8.0, -16.4, 0.8, false); puddle(-5.5, -19.8, 1.1, true); floorScrap(-6.8, -8.6, 0.6, 14); floorScrap(-7.4, -21.0, 0.6, 12);
  // óleo e serragem pelo corredor do fundo
  puddle(2.0, -6.8, 0.8, false); puddle(2.2, -10.4, 1.0, true); puddle(1.2, -16.0, 0.9, false); puddle(2.6, -19.5, 1.2, true); floorScrap(2.2, -8.2, 0.5, 14); floorScrap(1.6, -13.0, 0.6, 16);
  floorTube([[2.3, -5.4], [1.9, -6.6], [2.25, -8.0], [1.85, -9.6], [2.3, -11.0], [2.9, -12.4]], 0.01, M.hose);

  // ══════════════ FUSÃO POR MATERIAL ══════════════
  stat.updateMatrixWorld(true); root.updateMatrixWorld(true);
  const buckets = new Map();
  const collect = (o) => { o.traverse((m) => { if (!m.isMesh) return; const key = m.material.uuid + (m.userData.cast ? 'c' : 'n'); if (!buckets.has(key)) buckets.set(key, { mat: m.material, cast: m.userData.cast, ro: m.renderOrder, geos: [] });
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m.matrixWorld); buckets.get(key).geos.push(g); }); };
  collect(stat); collect(root);
  const out = new THREE.Group(); out.name = 'props';
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos); const mm = new THREE.Mesh(geo, b.mat); mm.castShadow = b.cast; mm.receiveShadow = true; mm.renderOrder = b.ro; mm.matrixAutoUpdate = false;
    if (b.mat.transparent) mm.userData.noAO = true; out.add(mm);
  }
  for (const k of Object.keys(inst)) { if (!inst[k].length) continue; const geo = k[0] === 's' ? G.scraps[+k[1]] : G[k];
    const im = new THREE.InstancedMesh(geo, instMat[k], inst[k].length); inst[k].forEach((m4, i) => im.setMatrixAt(i, m4)); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.castShadow = false; im.receiveShadow = true; out.add(im); }
  stage.scene.add(out);
  return { group: out, update() {} };
}
