// TRABALHADORA — UNIFORME INDUSTRIAL: camisa de brim/sarja azul-marinho de manga longa + calça do mesmo tecido.
// Malhas do Rocketbox Female_Adult_01 (MIT, assets/rocketbox/F01): camisa de trabalho (gola, 2 bolsos com lapela e prega,
// carcela) com as mangas estendidas até o punho (a pele do antebraço da F01 vira manga) e a calça (cós, passantes, bolsos,
// costuras duplas da F01) — recoloridas para sarja marinho preservando dobras/costuras, presas ao esqueleto Bip01 da F11
// (boneInverses da F01 → acompanham os ossos da F11). Sarja diagonal, poeira/desgaste e bordado genérico "SST" no shader.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const DIR = new URL('../assets/rocketbox/F01/', import.meta.url).href;
const img = (n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = DIR + n; });
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const sat = (x) => Math.max(0, Math.min(255, x));
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const isShirt = (r, g, b) => r > 55 && r - g > 28 && b > g - 10;
const NAVY = [33, 48, 76];                                     // #21304c — marinho industrial
// regiões do atlas da F01 (u, v com v para baixo)
const isPants = (u, v) => (u < 0.335 || u > 0.665) && v > 0.555;
const isForearm = (u, v) => (u < 0.222 || u > 0.778) && v > 0.27 && v < 0.5; // pele do antebraço → manga
const isRoll = (u, v) => ((u >= 0.218 && u < 0.276) || (u > 0.724 && u <= 0.782) || u < 0.056 || u > 0.944) && v > 0.25 && v < 0.54;  // manga dobrada → alisada

function canvasOf(im, S) { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0, S, S); return [c, g]; }
function navyAtlas(im) {
  const S = 2048, [c, g] = canvasOf(im, S), d = g.getImageData(0, 0, S, S), p = d.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, u = x / S, v = y / S, r = p[i], gg = p[i + 1], b = p[i + 2], L = lum(r, gg, b);
    let k = -1;
    if (isPants(u, v)) {
      if (r > b + 6 && r > 70) k = 1.75;                                           // linha de costura (pesponto duplo) → fio claro
      else k = Math.max(0.5, Math.min(1.08, 0.84 + (L - 105) / 420));             // dobras do brim (desbotado do jeans atenuado)
    } else if (isShirt(r, gg, b)) k = Math.max(0.35, Math.min(1.18, 0.95 + (L - 150) / 230));
    else if (isForearm(u, v) && r > gg && gg > b) k = 0.93 + (L - 190) / 600;    // inclusive a borda do punho (sem fresta de pele)                          // manga nova: tecido liso
    if (k < 0) continue;
    if (k > 1.6) { p[i] = 118; p[i + 1] = 128; p[i + 2] = 146; continue; }
    p[i] = sat(NAVY[0] * k); p[i + 1] = sat(NAVY[1] * k); p[i + 2] = sat(NAVY[2] * k);
  }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function rough(im) {
  const S = 1024, [c, g] = canvasOf(im, S), d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const s = lum(p[i], p[i + 1], p[i + 2]) / 255; p[i] = p[i + 1] = p[i + 2] = sat(255 * (0.97 - s * 0.25)); }
  g.putImageData(d, 0, 0); return new THREE.CanvasTexture(c);
}
// bordado genérico (escudo + engrenagem + "SST"), sem marca real
function logoTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.lineJoin = 'round';
  const shield = () => { g.beginPath(); g.moveTo(128, 18); g.lineTo(222, 48); g.lineTo(214, 140); g.quadraticCurveTo(196, 206, 128, 240); g.quadraticCurveTo(60, 206, 42, 140); g.lineTo(34, 48); g.closePath(); };
  shield(); g.fillStyle = 'rgba(250,196,20,1)'; g.fill();                       // fundo amarelo (canal R = amarelo)
  g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,1)'; shield(); g.stroke();
  // engrenagem
  g.save(); g.translate(128, 104); g.fillStyle = '#1b2a44';
  for (let k = 0; k < 10; k++) { g.rotate(Math.PI / 5); g.fillRect(-9, -50, 18, 16); }
  g.beginPath(); g.arc(0, 0, 38, 0, 7); g.fill(); g.fillStyle = 'rgba(250,196,20,1)'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill(); g.restore();
  g.fillStyle = '#ffffff'; g.font = 'bold 64px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SST', 128, 186);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export async function buildUniform({ fbx, bones, mgr, inject, NOISE }) {
  const [f01, colI, nrmI, spcI] = await Promise.all([new FBXLoader(mgr).loadAsync(DIR + 'Female_Adult_01.fbx'),
    img('f001_body_color.jpg'), img('f001_body_normal.jpg'), img('f001_body_specular.jpg')]);
  f01.updateMatrixWorld(true);
  let m01 = null; f01.traverse((o) => { if (o.isSkinnedMesh && (!m01 || o.geometry.attributes.position.count > m01.geometry.attributes.position.count)) m01 = o; });
  const mats = Array.isArray(m01.material) ? m01.material : [m01.material];
  let bodyIdx = mats.findIndex((m) => /body/i.test(m.name || '')); if (bodyIdx < 0) bodyIdx = 0;
  let src = m01.geometry; if (src.index) src = src.toNonIndexed();
  const grp = new Int8Array(src.attributes.position.count); if (src.groups.length) for (const gr of src.groups) grp.fill(gr.materialIndex, gr.start, gr.start + gr.count);
  const [, sg] = canvasOf(colI, 512), sd = sg.getImageData(0, 0, 512, 512).data;
  const UV = src.attributes.uv, keep = [], kind = [];
  for (let t = 0; t < UV.count; t += 3) {
    if (src.groups.length && grp[t] !== bodyIdx) continue;
    const u = (UV.getX(t) + UV.getX(t + 1) + UV.getX(t + 2)) / 3, v = 1 - (UV.getY(t) + UV.getY(t + 1) + UV.getY(t + 2)) / 3;
    const j = ((Math.min(511, Math.max(0, v * 512 | 0))) * 512 + Math.min(511, Math.max(0, u * 512 | 0))) * 4;
    if (isPants(u, v)) { keep.push(t); kind.push(2); }
    else if (isForearm(u, v) && !isShirt(sd[j], sd[j + 1], sd[j + 2])) { keep.push(t); kind.push(1); }
    else if (isShirt(sd[j], sd[j + 1], sd[j + 2])) { keep.push(t); kind.push(isRoll(u, v) ? 3 : 0); }
  }
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
    const a = src.attributes[name]; if (!a) continue; const n = a.itemSize, out = new a.array.constructor(keep.length * 3 * n);
    keep.forEach((t, k) => { for (let q = 0; q < 3 * n; q++) out[k * 3 * n + q] = a.array[t * n + q]; });
    geo.setAttribute(name, new THREE.BufferAttribute(out, n, a.normalized));
  }
  // manga longa: antebraço da F01 ganha volume de tecido; a manga dobrada (rolo) é alisada contra o braço
  { const P = geo.attributes.position, N = geo.attributes.normal;
    // vértices soldados por posição → mesmo deslocamento (sem rasgar a costura rolo/manga)
    const kOf = (i) => Math.round(P.getX(i) * 20) + ',' + Math.round(P.getY(i) * 20) + ',' + Math.round(P.getZ(i) * 20);
    const want = new Map(), nAvg = new Map();
    for (let i = 0; i < P.count; i++) { const key = kOf(i), n = nAvg.get(key) || [0, 0, 0]; n[0] += N.getX(i); n[1] += N.getY(i); n[2] += N.getZ(i); nAvg.set(key, n); }
    for (const n of nAvg.values()) { const l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l; }
    kind.forEach((kd, k) => { const d = kd === 1 ? 0.7 : kd === 3 ? -0.35 : null; if (d == null) return;
      for (let q = 0; q < 3; q++) { const key = kOf(k * 3 + q), w = want.get(key); want.set(key, w == null ? d : Math.max(w, d)); } });
    const p0 = new Float32Array(P.array);
    for (let i = 0; i < P.count; i++) { const key = kOf(i), d = want.get(key); if (d == null) continue; const n = nAvg.get(key);
      P.setXYZ(i, p0[i * 3] + n[0] * d, p0[i * 3 + 1] + n[1] * d, p0[i * 3 + 2] + n[2] * d); }
    // calça mais reta (brim de trabalho, não jeans justo): volume nas coxas/canelas
    kind.forEach((kd, k) => { if (kd !== 2) return; for (let q = 0; q < 3; q++) { const i = k * 3 + q; if (want.has('p' + i)) continue; want.set('p' + i, 1);
      const y = P.getZ(i), d = 0.65 * sstep(86, 74, y); if (d <= 0) continue; const n = nAvg.get(kOf(i));
      P.setXYZ(i, P.getX(i) + n[0] * d, P.getY(i) + n[1] * d, P.getZ(i) + n[2] * d); } });
    // barra da calça: sobe até o cano da botina (≈12 cm) e abre um pouco por cima dele (calça por fora da botina)
    const cen = { 1: [0, 0, 0], [-1]: [0, 0, 0] };
    kind.forEach((kd, k) => { if (kd !== 2) return; for (let q = 0; q < 3; q++) { const i = k * 3 + q, y = P.getZ(i); if (y > 22) continue;
      const c = cen[Math.sign(P.getX(i)) || 1]; c[0] += P.getX(i); c[1] += -P.getY(i); c[2]++; } });
    const done = new Set();
    kind.forEach((kd, k) => { if (kd !== 2) return; for (let q = 0; q < 3; q++) { const i = k * 3 + q; if (done.has(i)) continue; done.add(i);
      const x = P.getX(i), y = P.getZ(i), z = -P.getY(i); if (y > 30) continue;
      const c = cen[Math.sign(x) || 1], cx = c[0] / Math.max(1, c[2]), cz = c[1] / Math.max(1, c[2]);
      const f = 1 + 0.2 * sstep(26, 12, y), yy = y < 22 ? 22 - (22 - y) * 0.5 : y;
      P.setXYZ(i, cx + (x - cx) * f, -(cz + (z - cz) * f), yy); } });
    P.needsUpdate = true; }
  // bolso do peito esquerdo dela (+x): centro em repouso (vRest = x, z, −y), para o bordado
  const pk = new THREE.Vector3(), pr = new THREE.Vector3(); let pn = 0, prn = 0;
  { const P = geo.attributes.position, U = geo.attributes.uv;
    for (let i = 0; i < P.count; i++) { const u = U.getX(i), v = 1 - U.getY(i);
      if (v > 0.525 && v < 0.58 && ((u > 0.4 && u < 0.452) || (u > 0.549 && u < 0.6))) {
        const x = P.getX(i), y = P.getZ(i), z = -P.getY(i); if (x > 0) { pk.add(new THREE.Vector3(x, y, z)); pn++; } else { pr.add(new THREE.Vector3(x, y, z)); prn++; } } } }
  // bordado no bolso direito dela (−x): é o que fica à mostra entre as bordas do colete na vista da câmera de referência
  if (prn) pk.copy(pr).multiplyScalar(1 / prn); else pk.set(-10.5, 130.6, 6.5);
  // esqueleto: ossos da F11 com os mesmos nomes, inversas de bind da F01 relativas ao nó da F11
  fbx.updateMatrixWorld(true);
  const G = fbx.matrixWorld.clone(), Gi = G.clone().invert();
  const sk01 = m01.skeleton, mapped = sk01.bones.map((b) => { let o = b; while (o && !bones[o.name]) o = o.parent; return o ? bones[o.name] : bones.Bip01_Pelvis || Object.values(bones)[0]; });
  const inv = sk01.boneInverses.map((m) => m.clone().multiply(Gi));
  // ombro/cotovelo da F01 em repouso (para o emblema da manga)
  const restOf = (name) => { const i = sk01.bones.findIndex((b) => b.name === name); if (i < 0) return null;
    const m = sk01.boneInverses[i].clone().invert(); return new THREE.Vector3().setFromMatrixPosition(m); }; // espaço de bind já é y-cima (= vRest)
  const sh = restOf('Bip01_L_UpperArm') || new THREE.Vector3(17, 138, -6), el = restOf('Bip01_L_Forearm') || new THREE.Vector3(36, 121, -6);
  const U = { uLogo: { value: logoTex() }, uPk: { value: pk }, uSh: { value: sh }, uEl: { value: el } };
  const mat = inject(new THREE.MeshPhysicalMaterial({ map: navyAtlas(colI), normalMap: new THREE.CanvasTexture(nrmI), normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: rough(spcI), roughness: 1, metalness: 0, sheen: 0.5, sheenColor: new THREE.Color(0x8a9ab8), sheenRoughness: 0.6, specularIntensity: 0.3, side: THREE.DoubleSide }), {
    decl: NOISE + `\nuniform sampler2D uLogo; uniform vec3 uPk, uSh, uEl;
      float twill(vec3 p) { return p.x * 0.7 + p.y + p.z * 0.7; }`,
    color: `{ vec3 q = vRest;
      // sarja: listras diagonais finas (some com a distância → sem moiré)
      float ph = twill(q) * 9.0; float aa = 1.0 - smoothstep(0.25, 0.6, fwidth(ph));
      diffuseColor.rgb *= 1.0 + 0.07 * aa * sin(ph * 6.2832);
      diffuseColor.rgb *= 0.93 + 0.1 * vn(q * vec3(1.6, 0.6, 1.6));
      // poeira/desgaste: barra e joelhos da calça, punhos, lado de baixo das mangas
      float dust = smoothstep(40.0, 10.0, q.y) * (0.55 + 0.45 * vn(q * 0.9)) * 0.4;
      dust += smoothstep(5.0, 0.0, length(vec2(abs(q.x) - 9.5, q.y - 48.0) * vec2(0.9, 0.55))) * step(0.0, q.z) * 0.35 * vn(q * 1.7);
      dust = clamp(dust * (0.6 + 0.8 * vn(q * 4.0)), 0.0, 0.6);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.2, 0.18), dust * 0.35);
      // bordado no bolso do peito esquerdo (projeção frontal)
      vec2 lp = vec2(q.x - uPk.x, q.y - (uPk.y - 0.4)) / vec2(5.2, 5.2) + 0.5;
      if (q.z > uPk.z - 4.0 && lp.x > 0.0 && lp.x < 1.0 && lp.y > 0.0 && lp.y < 1.0) {
        vec4 L = texture2D(uLogo, vec2(lp.x, 1.0 - lp.y)); float th = 0.92 + 0.16 * sin((lp.x + lp.y) * 140.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, L.rgb * th, L.a); wMask = L.a; }
      // emblema na manga (face externa do braço, 1/3 abaixo do ombro), nos dois braços
      vec3 pa = vec3(abs(q.x), q.y, q.z); vec3 ax = uEl - uSh; float s = dot(pa - uSh, ax) / dot(ax, ax);
      vec3 lat = normalize(vec3(-ax.y, ax.x, 0.0)); if (lat.y < 0.0) lat = -lat;
      vec3 c0 = uSh + ax * 0.33; vec3 dv = pa - c0; vec3 an = normalize(ax);
      vec2 ep = vec2(dot(dv, vec3(0.0, 0.0, 1.0)) * sign(q.x), -dot(dv, an)) / 6.4 + 0.5;
      if (dot(dv, lat) > 0.5 && s > 0.1 && s < 0.6 && ep.x > 0.0 && ep.x < 1.0 && ep.y > 0.0 && ep.y < 1.0) {
        vec4 L = texture2D(uLogo, vec2(ep.x, 1.0 - ep.y)); float th = 0.92 + 0.16 * sin((ep.x - ep.y) * 160.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, L.rgb * th, L.a); wMask = max(wMask, L.a); } }`,
    rough: 'roughnessFactor = mix(clamp(roughnessFactor, 0.78, 1.0), 0.6, wMask * 0.6);',
    normal: `{ vec3 q = vRest; float ph = twill(q) * 9.0; float aa = 1.0 - smoothstep(0.25, 0.6, fwidth(ph));
      vec3 tw = normalize(vec3(0.7, 1.0, 0.7)) * cos(ph * 6.2832) * 0.18 * aa;
      vec3 cq = vec3(q.x * 3.0, q.y * 0.9, q.z * 3.0); float e = 0.15;
      vec3 gr = vec3(vn(cq + vec3(e, 0, 0)) - vn(cq - vec3(e, 0, 0)), vn(cq + vec3(0, e, 0)) - vn(cq - vec3(0, e, 0)), vn(cq + vec3(0, 0, e)) - vn(cq - vec3(0, 0, e)));
      normal = normalize(normal - mat3(viewMatrix) * (gr * 0.55 + tw)); }` }, U);
  mat.normalMap.needsUpdate = true;
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.name = 'uniforme_F01'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  m01.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
  fbx.add(mesh); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(mapped, inv), G.clone().multiply(m01.bindMatrix));
  return { mesh, pants: true, sleeves: true };
}
