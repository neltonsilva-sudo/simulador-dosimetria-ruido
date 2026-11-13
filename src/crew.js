// COLEGAS — dono: COLEGAS. Trabalhadores ao fundo (como os desfocados da FOTO 2): capacete verde-limão, uniforme de brim
// azul/cinza com faixa refletiva, protetor auricular tipo concha, óculos, luvas, botina. Base: assets/Michelle.glb clonado
// (SkeletonUtils), corpo masculinizado (cintura/quadril/peito remodelados no bind, ombros alargados pelos ossos, cabeça
// menor, 1,72–1,80 m), cores por vértice (uma geometria por variante, atributos compartilhados) × atlas passa-alta comum.
// Animação procedural por ossos (sem a SambaDance): esmerilhador curvado no esmeril1, operador alimentando a prensa3
// (mãos fora da matriz antes do golpe do pedal), o colega da FOTO 2 (posicionado pela projeção de CAMS.ref entre o braço
// dela e o painel) rebarbando peças na bancada com esmerilhadeira angular + faíscas, e um ajudante com caixa junto ao esmeril.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { MACHINES } from './layout_machines.js';
import { CAMS } from './layout_cams.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);

// componentes conexos (mesma técnica da TRABALHADORA) para tirar cabelo/fones/óculos cartunescos
function components(geo) {
  const P = geo.attributes.position.array, I = geo.index.array, nv = P.length / 3;
  const par = new Int32Array(nv).map((_, i) => i);
  const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { const a = f(I[t]); par[f(I[t + 1])] = a; par[f(I[t + 2])] = a; }
  const key = new Map();
  for (let i = 0; i < nv; i++) { const k = Math.round(P[i * 3] * 1e5) + ',' + Math.round(P[i * 3 + 1] * 1e5) + ',' + Math.round(P[i * 3 + 2] * 1e5);
    if (key.has(k)) par[f(i)] = f(key.get(k)); else key.set(k, i); }
  const count = new Map(); for (let i = 0; i < nv; i++) { const r = f(i); count.set(r, (count.get(r) || 0) + 1); }
  return { rootOf: (i) => f(i), count };
}

// atlas → luminância passa-alta (dobras, costuras, rosto) + trama de brim e sujeira; a cor vem dos vértices
function detailTex(img) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, S, S);
  const b = document.createElement('canvas'); b.width = b.height = S;
  const gb = b.getContext('2d'); gb.filter = 'blur(14px)'; gb.drawImage(img, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S), bl = gb.getImageData(0, 0, S, S).data, p = d.data;
  let rnd = 11; const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  for (let i = 0, k = 0; i < p.length; i += 4, k++) {
    const L = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2], B = 0.3 * bl[i] + 0.59 * bl[i + 1] + 0.11 * bl[i + 2] + 6;
    const x = k % S, y = (k / S) | 0;
    const weave = 1 + 0.035 * Math.sin(x * 2.1 + y * 2.1) * Math.sin(x * 2.1 - y * 2.1) + (R() - 0.5) * 0.06;
    const v = Math.max(0, Math.min(255, 205 * Math.pow(L / B, 1.15) * weave));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  // manchas de graxa/pó (baixa frequência)
  for (let n = 0; n < 140; n++) { const x = R() * S, y = R() * S, r = 6 + R() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(30,26,20,${0.05 + R() * 0.1})`); gr.addColorStop(1, 'rgba(30,26,20,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
}

const VARIANTS = [
  { shirt: 0x3f5a78, pants: 0x2b3442, skin: 0x7a4a30, G: 1.13, sh: 1.34 }, // esmerilhador
  { shirt: 0x5a6672, pants: 0x2a3038, skin: 0xc49070, G: 1.10, sh: 1.30 }, // prensista
  { shirt: 0x35557a, pants: 0x313946, skin: 0x9a6446, G: 1.15, sh: 1.36 }, // andando com caixa
  { shirt: 0x4b5d70, pants: 0x262c34, skin: 0x5e3a26, G: 1.11, sh: 1.30 }, // encarregado
  { shirt: 0x2f5f9e, pants: 0x2a3a52, skin: 0x6b3f28, G: 1.12, sh: 1.33 }, // bancada (o da foto, atrás do braço dela)
  { shirt: 0x3a5f8a, pants: 0x2c3646, skin: 0xa8704c, G: 1.10, sh: 1.30 }, // ajudante do esmeril
];
// ponto no piso que, na vista cam=ref (foto 2), cai na coordenada de tela ndcX a uma profundidade dada
function refFloor(ndcX, depth) {
  const v = CAMS.ref, cam = new THREE.PerspectiveCamera(v.fov, 1264 / 843, 0.1, 200);
  cam.position.set(...v.pos); cam.lookAt(...v.target); cam.updateMatrixWorld(true);
  const f = V3(); cam.getWorldDirection(f);
  const r = V3(ndcX, 0, 0.5).unproject(cam).sub(cam.position).normalize();
  const p = cam.position.clone().addScaledVector(r, depth / r.dot(f)); p.y = 0; return p;
}

// prepara a geometria-base (uma vez): remove cabelo, masculiniza o tronco no bind, infla roupa (folga do brim)
function prepBase(mesh) {
  const geo = mesh.geometry;
  const { rootOf, count } = components(geo);
  const drop = new Set([3209, 2160, 322, 29, 19]);
  const I = geo.index.array, keep = [];
  for (let t = 0; t < I.length; t += 3) if (!drop.has(count.get(rootOf(I[t])))) keep.push(I[t], I[t + 1], I[t + 2]);
  geo.setIndex(keep);
  const names = mesh.skeleton.bones.map((b) => b.name.replace(/^mixamorig:?/, ''));
  const cat = names.map((n) => /Hand/.test(n) ? 'glove' : /Foot|Toe/.test(n) ? 'boot' : /Head|Eye/.test(n) ? 'skin' : n === 'Neck' ? 'neck'
    : /UpLeg|Leg/.test(n) || n === 'Hips' ? 'pants' : 'shirt');
  const P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, nv = P.count;
  const wcat = new Array(nv);
  const infl = { shirt: 0.02, pants: 0.007, glove: 0.005, boot: 0.012, skin: 0, neck: 0.004 };
  for (let v = 0; v < nv; v++) {
    const w = {}; for (let k = 0; k < 4; k++) { const c = cat[SI.getComponent(v, k)]; w[c] = (w[c] || 0) + SW.getComponent(v, k); }
    wcat[v] = w;
    let x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const torso = (w.shirt || 0) + (w.pants || 0) > 0.5 && Math.abs(x) < 0.2 && y > 0.75 && y < 1.34;
    if (torso) {
      if (y > 1.08 && y < 1.3 && z > 0.07) z = 0.07 + (z - 0.07) * 0.22;                        // peito plano
      const waist = Math.exp(-(((y - 1.05) / 0.08) ** 2)); x *= 1 + 0.32 * waist + (y > 1.05 && (w.shirt || 0) > 0.5 ? 0.1 : 0);                  // cintura mais reta
      const hip = Math.exp(-(((y - 0.88) / 0.07) ** 2)); x *= 1 - 0.1 * hip;                       // quadril estreito
      if (z < 0 && y < 1.0 && y > 0.78) z *= 0.82;                                                  // glúteos
    }
    let off = 0; for (const c in w) off += (infl[c] || 0) * w[c];
    P.setXYZ(v, x + N.getX(v) * off, y + N.getY(v) * off, z + N.getZ(v) * off);
  }
  P.needsUpdate = true;
  return { geo, wcat };
}

function variantGeo(base, wcat, V) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) g.setAttribute(k, base.attributes[k]);
  g.setIndex(base.index);
  const P = base.attributes.position, n = P.count, col = new Float32Array(n * 3);
  const C = { shirt: new THREE.Color(V.shirt), pants: new THREE.Color(V.pants), skin: new THREE.Color(V.skin), glove: new THREE.Color(0x1d1e20),
    boot: new THREE.Color(0x17130f) };
  C.neck = C.skin.clone().lerp(C.shirt, 0.35);
  const refl = new THREE.Color(0xd8dcdc), tmp = new THREE.Color();
  for (let v = 0; v < n; v++) {
    const w = wcat[v], y = P.getY(v); tmp.setRGB(0, 0, 0);
    for (const c in w) tmp.r += C[c].r * w[c], tmp.g += C[c].g * w[c], tmp.b += C[c].b * w[c];
    // faixas refletivas: canela e tórax
    const legBand = (w.pants || 0) > 0.6 && y > 0.3 && y < 0.345, chestBand = (w.shirt || 0) > 0.7 && y > 1.14 && y < 1.175 && Math.abs(P.getX(v)) < 0.2;
    if (legBand || chestBand) tmp.copy(refl);
    col[v * 3] = tmp.r * 1.2; col[v * 3 + 1] = tmp.g * 1.2; col[v * 3 + 2] = tmp.b * 1.2;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.boundingSphere = new THREE.Sphere(V3(0, 0.9, 0), 1.2);
  return g;
}

// ── EPI compartilhado (geometrias e materiais únicos) ──
function gearKit() {
  const lime = new THREE.MeshPhysicalMaterial({ color: 0xd2ff1c, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3, emissive: 0x5a7400, emissiveIntensity: 0.32 }); // verde-limão fluorescente (lê através do desfoque, como na foto)
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb3221f, roughness: 0.55 });
  const clear = new THREE.MeshPhysicalMaterial({ color: 0xe8f4f0, transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const shieldM = new THREE.MeshPhysicalMaterial({ color: 0xbfe6d2, transparent: true, opacity: 0.28, roughness: 0.08, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const G = {
    shell: new THREE.SphereGeometry(0.128, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    peak: new THREE.CylinderGeometry(0.135, 0.14, 0.006, 28, 1, false, -0.85, 1.7),
    rim: new THREE.TorusGeometry(0.124, 0.006, 5, 32),
    ridge: new THREE.TorusGeometry(0.128, 0.007, 5, 28, Math.PI),
    cup: new THREE.CylinderGeometry(0.036, 0.034, 0.03, 18),
    cupArm: new THREE.BoxGeometry(0.008, 0.07, 0.012),
    lens: new THREE.CylinderGeometry(0.1, 0.1, 0.04, 20, 1, true, -1.1, 2.2),
    shield: new THREE.CylinderGeometry(0.15, 0.16, 0.22, 20, 1, true, -1.15, 2.3),
    cuff: new THREE.TorusGeometry(0.03, 0.008, 5, 14),
  };
  return { lime, dark, red, clear, shieldM, G };
}

function holder(bone, k = 100) { const h = new THREE.Object3D(); h.scale.setScalar(k); bone.add(h); return h; } // unidades = metros do modelo original

function dressHead(head, K, faceShield) {
  const { G } = K;
  const shell = new THREE.Mesh(G.shell, K.lime); shell.scale.set(0.93, 0.8, 1.08); shell.position.set(0, 0.163, -0.012); head.add(shell);
  const rim = new THREE.Mesh(G.rim, K.lime); rim.rotation.x = Math.PI / 2; rim.scale.set(0.93, 1.08, 1); rim.position.set(0, 0.165, -0.012); head.add(rim);
  const peak = new THREE.Mesh(G.peak, K.lime); peak.scale.set(0.95, 1, 1.3); peak.position.set(0, 0.162, 0.018); peak.rotation.x = -0.14; head.add(peak);
  const ridge = new THREE.Mesh(G.ridge, K.lime); ridge.rotation.y = Math.PI / 2; ridge.scale.set(1.08, 0.8, 0.93); ridge.position.copy(shell.position); head.add(ridge);
  for (const sx of [-1, 1]) { // abafador tipo concha acoplado ao capacete
    const cup = new THREE.Mesh(G.cup, K.red); cup.rotation.z = Math.PI / 2; cup.position.set(sx * 0.088, 0.07, -0.012); head.add(cup);
    const pad = new THREE.Mesh(G.cup, K.dark); pad.rotation.z = Math.PI / 2; pad.scale.set(0.95, 0.4, 0.95); pad.position.set(sx * 0.072, 0.07, -0.012); head.add(pad);
    const arm = new THREE.Mesh(G.cupArm, K.dark); arm.position.set(sx * 0.1, 0.125, -0.012); arm.rotation.z = sx * 0.12; head.add(arm);
  }
  const lens = new THREE.Mesh(G.lens, K.clear); lens.position.set(0, 0.088, 0.0); head.add(lens);
  if (faceShield) { const s = new THREE.Mesh(G.shield, K.shieldM); s.position.set(0, 0.06, 0.01); s.rotation.x = -0.08; head.add(s); }
  head.traverse((o) => { if (o.isMesh) o.castShadow = o.material !== K.clear && o.material !== K.shieldM; });
}

// ── um colega ──
function makeMan(src, base, wcat, mat, K, V, opt) {
  const root = SkeletonUtils.clone(src);
  const group = new THREE.Group(); group.add(root); group.scale.setScalar(V.G);
  let mesh; root.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  mesh.geometry = variantGeo(base, wcat, V); mesh.material = mat; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const B = {}; for (const b of mesh.skeleton.bones) B[b.name.replace(/^mixamorig:?/, '')] = b;
  // proporções masculinas: ombros largos, tronco/pescoço um pouco mais longos, cabeça menor
  for (const s of ['Left', 'Right']) B[s + 'Arm'].position.multiplyScalar(V.sh);
  B.Spine2.position.multiplyScalar(1.06); B.Neck.position.multiplyScalar(1.03); B.Head.scale.setScalar(0.86);
  for (const s of ['Left', 'Right']) { B[s + 'ForeArm'].position.multiplyScalar(1.04); B[s + 'Hand'].position.multiplyScalar(1.03); }
  const bones = mesh.skeleton.bones, rest = bones.map((b) => b.quaternion.clone());
  group.updateMatrixWorld(true);
  dressHead(holder(B.Head), K, opt.shield);
  for (const s of ['Left', 'Right']) { const h = holder(B[s + 'Hand']); const c = new THREE.Mesh(K.G.cuff, K.dark); c.rotation.x = Math.PI / 2; c.position.y = -0.01; h.add(c); }
  return { group, B, bones, rest, mesh };
}

// ── utilitários de pose (em espaço de mundo; independem dos eixos locais do rig) ──
const _c2 = V3(), _c3 = V3(), _c4 = V3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _a = V3(), _b = V3(), _c = V3();
function rotW(bone, axis, ang) {
  if (!ang) return;
  bone.getWorldQuaternion(_q2); _q.setFromAxisAngle(axis, ang); _q2.premultiply(_q);
  bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q2)); bone.updateMatrixWorld(true);
}
function aim(bone, child, target) {
  const bp = bone.getWorldPosition(_a), cur = child.getWorldPosition(_b).sub(bp).normalize(), des = _c.copy(target).sub(bp).normalize();
  _q.setFromUnitVectors(cur, des); bone.getWorldQuaternion(_q2); _q2.premultiply(_q);
  bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_q2)); bone.updateMatrixWorld(true);
}
const _A = V3(), _E = V3(), _H = V3(), _n = V3(), _p = V3(), _el = V3();
function ik(B, side, target, pole) {
  const up = B[side + 'Arm'], lo = B[side + 'ForeArm'], hd = B[side + 'Hand'];
  up.getWorldPosition(_A); lo.getWorldPosition(_E); hd.getWorldPosition(_H);
  const l1 = _A.distanceTo(_E), l2 = _E.distanceTo(_H);
  _n.copy(target).sub(_A); const d = Math.min(Math.max(_n.length(), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3); _n.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _p.copy(pole).sub(_A); _p.addScaledVector(_n, -_p.dot(_n)).normalize();
  _el.copy(_A).addScaledVector(_n, a).addScaledVector(_p, h);
  aim(up, lo, _el); aim(lo, hd, target);
}

export async function buildCrew(stage, app) {
  const gltf = await new GLTFLoader().loadAsync('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Michelle.glb');
  const src = gltf.scene; let m0; src.traverse((o) => { if (o.isSkinnedMesh) m0 = o; });
  const { geo: base, wcat } = prepBase(m0);
  const mat = new THREE.MeshStandardMaterial({ map: detailTex(m0.material.map.image), normalMap: m0.material.normalMap, vertexColors: true, roughness: 0.82, metalness: 0 });
  const K = gearKit();
  const group = new THREE.Group(); group.name = 'colegas'; stage.scene.add(group);
  const byId = Object.fromEntries(MACHINES.map((m) => [m.id, m]));
  const crew = [];

  // (a) esmerilhador no esmeril1: em frente ao rebolo, segura a peça contra o disco (faíscas descem à frente dele)
  const g1 = byId.esmeril1; const steel = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.35, metalness: 0.9 });
  if (g1) {
    const ry = g1.rotY, o = V3(...g1.pos), toW = (x, y, z) => V3(x, y, z).applyAxisAngle(UP, ry).add(o);
    const man = makeMan(src, base, wcat, mat, K, VARIANTS[0], { shield: true });
    man.group.position.copy(toW(0.3, 0, 0.66)); man.group.rotation.y = ry + Math.PI; group.add(man.group);
    const piece = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.05), steel); piece.castShadow = true; group.add(piece);
    const contact = toW(0.27, 0.97, 0.115), outward = toW(0.27, 0.97, 1).sub(contact).normalize(), side = V3(1, 0, 0).applyAxisAngle(UP, ry);
    crew.push({ man, kind: 'grind', contact, outward, side, piece, ph: 0.3 });
  }
  // (b) prensista na prensa3: alimenta a matriz e só aciona o pedal com as mãos fora
  const p3 = byId.prensa3 || byId.prensa2; if (p3) {
    const ry = p3.rotY, o = V3(...p3.pos), toW = (x, y, z) => V3(x, y, z).applyAxisAngle(UP, ry).add(o);
    const man = makeMan(src, base, wcat, mat, K, VARIANTS[1], {});
    man.group.position.copy(toW(0.05, 0, 0.86)); man.group.rotation.y = ry + Math.PI; group.add(man.group);
    const blank = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.12), steel); blank.castShadow = true; group.add(blank);
    crew.push({ man, kind: 'press', die: toW(0, 1.0, 0.3), rest: toW(0.05, 1.0, 0.6), side: V3(1, 0, 0).applyAxisAngle(UP, ry), blank, period: 60 / (p3.spm || 30) });
  }
  // (c) o colega da FOTO 2: na bancada atrás do braço dela, entre o braço e o painel (enquadramento cam=ref), de 3/4
  //     para a câmera, cabeça baixa conferindo peças estampadas; de tempos em tempos levanta o olhar.
  {
    const V = VARIANTS[4], man = makeMan(src, base, wcat, mat, K, V, {});
    const p = refFloor(0.40, 6.6), cp = V3(...CAMS.ref.pos);
    const yaw = Math.atan2(cp.x - p.x, cp.z - p.z) + 0.55;          // 3/4: rosto e peito voltados para a câmera
    man.group.position.copy(p); man.group.rotation.y = yaw; group.add(man.group);
    const f = V3(Math.sin(yaw), 0, Math.cos(yaw)), sd = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    const bench = new THREE.Group(); bench.position.copy(p).addScaledVector(f, 0.6); bench.rotation.y = yaw; group.add(bench);
    const bm = new THREE.MeshStandardMaterial({ color: 0x55605a, roughness: 0.6, metalness: 0.55 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.6), new THREE.MeshStandardMaterial({ color: 0x6d6a62, roughness: 0.45, metalness: 0.7 }));
    top.position.y = 0.9; bench.add(top);
    const legG = new THREE.BoxGeometry(0.05, 0.88, 0.05);
    for (const x of [-0.51, 0.51]) for (const z of [-0.26, 0.26]) { const l = new THREE.Mesh(legG, bm); l.position.set(x, 0.44, z); bench.add(l); }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.03, 0.54), bm); shelf.position.y = 0.22; bench.add(shelf);
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.2), new THREE.MeshStandardMaterial({ color: 0x2c5fa8, roughness: 0.7 }));
    bin.position.set(0.36, 0.98, 0.08); bench.add(bin);
    for (let i = 0; i < 7; i++) { const q = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.1), steel); q.position.set(-0.38 + (i % 3) * 0.05, 0.93 + i * 0.012, -0.05 + (i % 2) * 0.03); q.rotation.y = i * 0.4; bench.add(q); }
    bench.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const piece = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.1), steel); piece.castShadow = true; group.add(piece);
    const at = (x, y, z) => V3(x, y, z).applyAxisAngle(UP, yaw).add(bench.position);
    // esmerilhadeira angular (faíscas no centro-direita da foto, junto dele)
    const tool = new THREE.Group(); group.add(tool);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.24, 12), new THREE.MeshStandardMaterial({ color: 0x1f5fa0, roughness: 0.5 }));
    body.rotation.z = Math.PI / 2; body.position.x = -0.12; tool.add(body);
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 18, 1, false, 0, Math.PI * 1.1), K.dark); tool.add(guard);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.006, 18), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 })); disc.position.y = -0.014; tool.add(disc);
    tool.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const NS = 140, sp = new Float32Array(NS * 6), sc = new Float32Array(NS * 6), sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sgeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const sparks = new THREE.LineSegments(sgeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sparks.frustumCulled = false; group.add(sparks);
    const P = []; for (let i = 0; i < NS; i++) P.push({ p: V3(), v: V3(), life: 0, max: 1 });
    crew.push({ man, kind: 'bench', piece, tool, sparks, P, f: f.clone(), work: at(-0.05, 0.935, -0.1), pick: at(-0.45, 0.97, -0.05), look: at(0, 1.18, -0.12), drop: at(0.45, 1.02, 0), side: sd, ph: 1.7 });
  }
  // (d) ajudante do esmeril: segura a caixa de peças rebarbadas e acompanha o colega no rebolo (fica à esquerda dela na foto)
  if (g1) {
    const ry = g1.rotY, o = V3(...g1.pos), toW = (x, y, z) => V3(x, y, z).applyAxisAngle(UP, ry).add(o);
    const V = VARIANTS[5], man = makeMan(src, base, wcat, mat, K, V, {});
    const p = toW(-0.6, 0, -1.25), tgt = toW(0.3, 0, 0.3);
    man.group.position.copy(p); man.group.rotation.y = Math.atan2(tgt.x - p.x, tgt.z - p.z) - 0.35; group.add(man.group);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xc8a12a, roughness: 0.75 })); box.castShadow = true; man.group.add(box);
    box.position.set(0, 0.98 / V.G, 0.3 / V.G); box.scale.setScalar(1 / V.G);
    crew.push({ man, kind: 'hold', box, ph: 0.9 });
  }

  const fwd = V3(), lat = V3(), tA = V3(), tB = V3(), pole = V3(), mid = V3(), down = V3(0, -1, 0);
  function basis(c) { fwd.set(0, 0, 1).applyQuaternion(c.man.group.quaternion); lat.crossVectors(UP, fwd).normalize(); } // lat = eixo "curvar p/ frente" = esquerda dele (+x do rig)
  function begin(c) { const { bones, rest } = c.man; for (let i = 0; i < bones.length; i++) bones[i].quaternion.copy(rest[i]); c.man.group.updateMatrixWorld(true); basis(c); }
  function breathe(c, t, k = 1) { rotW(c.man.B.Spine2, lat, 0.012 * k * Math.sin(t * 1.7 + (c.ph || 0))); }
  const left = V3();
  function poleFor(c, s, out = 0.5) { left.copy(lat); const sh = c.man.B[s + 'Arm'].getWorldPosition(V3());
    return pole.copy(sh).addScaledVector(down, 1).addScaledVector(left, (s === 'Left' ? 1 : -1) * out).addScaledVector(fwd, -0.25); }

  function update(dt, t) {
    for (const c of crew) {
      const B = c.man.B;
      if (c.kind === 'grind') {
        begin(c);
        const cyc = (t + 1.3) % 9, back = cyc > 7.4 ? Math.sin((cyc - 7.4) / 1.6 * Math.PI) : 0; // a cada ~9 s afasta a peça e confere
        rotW(B.Spine, lat, 0.2 - 0.08 * back); rotW(B.Spine1, lat, 0.16 - 0.06 * back); breathe(c, t);
        for (const s of ['Left', 'Right']) { rotW(B[s + 'UpLeg'], lat, -0.12); rotW(B[s + 'Leg'], lat, 0.2); }
        rotW(B.Neck, lat, 0.12); rotW(B.Head, lat, 0.18 - 0.15 * back);
        const vib = 0.0025 * (1 - back), jx = Math.sin(t * 241) * vib, jy = Math.cos(t * 197) * vib;
        mid.copy(c.contact).addScaledVector(c.outward, 0.13 + 0.16 * back).add(V3(jx, jy + 0.06 * back, 0));
        c.piece.position.copy(mid).addScaledVector(c.outward, -0.02); c.piece.quaternion.setFromUnitVectors(V3(1, 0, 0), c.outward);
        tA.copy(mid).addScaledVector(c.outward, 0.06).addScaledVector(c.side, 0.06); tB.copy(mid).addScaledVector(c.outward, 0.1).addScaledVector(c.side, -0.07);
        ik(B, 'Left', tA, poleFor(c, 'Left', 0.6)); ik(B, 'Right', tB, poleFor(c, 'Right', 0.6));
      } else if (c.kind === 'press') {
        begin(c);
        const u = (t % c.period) / c.period; // 0–0,35 coloca a peça; 0,35–0,55 recolhe; 0,6 pedal (golpe)
        const reach = u < 0.35 ? Math.sin(u / 0.35 * Math.PI * 0.5) : u < 0.55 ? Math.cos((u - 0.35) / 0.2 * Math.PI * 0.5) : 0;
        const pedal = u > 0.58 && u < 0.78 ? Math.sin((u - 0.58) / 0.2 * Math.PI) : 0;
        rotW(B.Spine, lat, 0.06 + 0.1 * reach); rotW(B.Spine1, lat, 0.05 + 0.06 * reach); breathe(c, t, 0.7);
        rotW(B.Neck, lat, 0.12); rotW(B.Head, lat, 0.22);
        rotW(B.RightUpLeg, lat, -0.1 * pedal - 0.05); rotW(B.RightLeg, lat, 0.12 * pedal + 0.05); rotW(B.RightFoot, lat, 0.25 * pedal);
        mid.lerpVectors(c.rest, c.die, reach); mid.y += 0.04 * Math.sin(reach * Math.PI);
        c.blank.position.copy(reach > 0.02 || u < 0.35 ? mid : c.die); c.blank.position.y -= reach > 0.02 ? 0.01 : 0.02; c.blank.quaternion.copy(c.man.group.quaternion);
        tA.copy(mid).addScaledVector(c.side, 0.085); tB.copy(mid).addScaledVector(c.side, -0.085);
        ik(B, 'Left', tA, poleFor(c, 'Left', 0.7)); ik(B, 'Right', tB, poleFor(c, 'Right', 0.7));
      } else if (c.kind === 'bench') {
        begin(c);
        const T = (t + c.ph) % 8, sm = (x) => Math.min(1, Math.max(0, x)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, x)));
        // 0–5,2 s esmerilha a rebarba na bancada; 5,2–8 s levanta a peça e confere a aresta
        const insp = T < 5.2 ? 0 : sm((T - 5.2) / 0.7) * (1 - sm((T - 7.3) / 0.7)), grinding = T > 0.4 && T < 5.0;
        rotW(B.Spine, lat, 0.2 - 0.08 * insp); rotW(B.Spine1, lat, 0.12 - 0.05 * insp); breathe(c, t);
        rotW(B.Neck, lat, 0.16 - 0.06 * insp); rotW(B.Head, lat, 0.32 - 0.22 * insp); rotW(B.Head, UP, -0.15 * insp);
        rotW(B.LeftUpLeg, lat, 0.03); rotW(B.Hips, UP, 0.04 * Math.sin(t * 0.17));
        const vib = grinding ? 0.002 : 0, jx = Math.sin(t * 233) * vib, jz = Math.cos(t * 191) * vib;
        // peça
        mid.lerpVectors(c.work, c.look, insp); c.piece.position.copy(mid);
        c.piece.quaternion.copy(c.man.group.quaternion); c.piece.rotateX(-0.9 * insp); c.piece.rotateZ(0.3 * insp * Math.sin(t * 1.3));
        // esmerilhadeira: disco na aresta direita da peça; na conferência fica apoiada na bancada
        const contact = _c2.copy(c.work).addScaledVector(c.side, -0.075).add(V3(jx, 0.012, jz));
        const restT = _c3.copy(c.work).addScaledVector(c.side, -0.32).addScaledVector(c.f, 0.08); restT.y = c.work.y + 0.03;
        c.tool.position.lerpVectors(contact, restT, insp); c.tool.position.y += 0.025 * (1 - insp);
        c.tool.quaternion.setFromUnitVectors(V3(1, 0, 0), _c4.copy(c.side).negate()); c.tool.rotateX(0.35 * (1 - insp)); c.tool.rotateZ(-0.25 * (1 - insp));
        tB.copy(c.tool.position).addScaledVector(c.side, -0.17).y += 0.03;
        tA.copy(mid).addScaledVector(c.side, 0.06 + 0.02 * insp).y += 0.02;
        ik(B, 'Left', tA, poleFor(c, 'Left', 0.6)); ik(B, 'Right', tB, poleFor(c, 'Right', 0.7));
        // faíscas (segmentos aditivos, gravidade)
        const sp = c.sparks.geometry.attributes.position.array, sc = c.sparks.geometry.attributes.color.array;
        let emit = grinding ? Math.min(40, Math.round(dt * 900)) : 0;
        for (let i = 0; i < c.P.length; i++) {
          const q = c.P[i];
          if (q.life <= 0 && emit > 0) { emit--; q.life = q.max = 0.25 + Math.random() * 0.45; q.p.copy(contact);
            q.v.copy(c.side).multiplyScalar(-(1.6 + Math.random() * 3.2)).addScaledVector(c.f, (Math.random() - 0.3) * 2.2); q.v.y = 0.4 + Math.random() * 1.6; }
          const o = i * 6;
          if (q.life > 0) { q.life -= dt; q.v.y -= 9.8 * dt; q.p.addScaledVector(q.v, dt);
            if (q.p.y < 0.01) { q.p.y = 0.01; q.v.y *= -0.3; q.v.multiplyScalar(0.5); }
            const k = Math.max(0, q.life / q.max), L = 0.018 + 0.012 * k;
            sp[o] = q.p.x; sp[o + 1] = q.p.y; sp[o + 2] = q.p.z; sp[o + 3] = q.p.x - q.v.x * L; sp[o + 4] = q.p.y - q.v.y * L; sp[o + 5] = q.p.z - q.v.z * L;
            const I = 2.2 * k + 0.2; sc[o] = sc[o + 3] = 1.0 * I; sc[o + 1] = sc[o + 4] = (0.45 + 0.35 * k) * I; sc[o + 2] = sc[o + 5] = 0.12 * k * I;
          } else { sp[o] = sp[o + 3] = 0; sp[o + 1] = sp[o + 4] = -50; sp[o + 2] = sp[o + 5] = 0; }
        }
        c.sparks.geometry.attributes.position.needsUpdate = true; c.sparks.geometry.attributes.color.needsUpdate = true;
      } else {
        begin(c); breathe(c, t, 1.2);
        const sh = Math.sin(t * 0.23 + c.ph);
        rotW(B.Spine, lat, 0.05); rotW(B.Hips, UP, 0.05 * sh); rotW(B.LeftUpLeg, lat, 0.05 + 0.03 * sh);
        rotW(B.Head, lat, 0.22 + 0.04 * Math.sin(t * 0.31)); rotW(B.Head, UP, 0.18 * Math.sin(t * 0.17 + 1));
        c.box.getWorldPosition(mid);
        tA.copy(mid).addScaledVector(lat, 0.2).addScaledVector(fwd, -0.02).y -= 0.05; tB.copy(mid).addScaledVector(lat, -0.2).addScaledVector(fwd, -0.02).y -= 0.05;
        ik(B, 'Left', tA, poleFor(c, 'Left', 0.8)); ik(B, 'Right', tB, poleFor(c, 'Right', 0.8));
      }
    }
  }
  update(0.016, 0);
  return { group, update, crew };
}
