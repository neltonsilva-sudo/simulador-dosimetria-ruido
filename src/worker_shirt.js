// TRABALHADORA — camisa de verdade: malha da camisa do Rocketbox Female_Adult_01 (MIT, assets/rocketbox/F01) com gola e
// mangas dobradas, recolorida para BRANCO de crepe (luminância/dobras preservadas) e presa ao esqueleto Bip01 da F11
// (mesmos nomes de ossos; boneInverses da F01 → a camisa acompanha os ossos da F11 mantendo o caimento original).
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const DIR = new URL('../assets/rocketbox/F01/', import.meta.url).href;
const img = (n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = DIR + n; });
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const sat = (x) => Math.max(0, Math.min(255, x));
const isShirt = (r, g, b) => r > 55 && r - g > 28 && b > g - 10;

function canvasOf(im, S) { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0, S, S); return [c, g]; }
function whiten(im) {
  const S = 2048, [c, g] = canvasOf(im, S), d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const r = p[i], gg = p[i + 1], b = p[i + 2]; if (!isShirt(r, gg, b)) continue;
    const L = lum(r, gg, b), k = Math.max(0.28, Math.min(1.04, 0.9 + (L - 140) / 190));
    p[i] = sat(244 * k); p[i + 1] = sat(242 * k); p[i + 2] = sat(236 * k); }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function rough(im) {
  const S = 1024, [c, g] = canvasOf(im, S), d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const s = lum(p[i], p[i + 1], p[i + 2]) / 255; p[i] = p[i + 1] = p[i + 2] = sat(255 * (0.95 - s * 0.35)); }
  g.putImageData(d, 0, 0); return new THREE.CanvasTexture(c);
}

export async function buildShirt({ fbx, bones, mgr, inject, NOISE }) {
  const [f01, colI, nrmI, spcI] = await Promise.all([new FBXLoader(mgr).loadAsync(DIR + 'Female_Adult_01.fbx'),
    img('f001_body_color.jpg'), img('f001_body_normal.jpg'), img('f001_body_specular.jpg')]);
  f01.updateMatrixWorld(true);
  let m01 = null; f01.traverse((o) => { if (o.isSkinnedMesh && (!m01 || o.geometry.attributes.position.count > m01.geometry.attributes.position.count)) m01 = o; });
  const mats = Array.isArray(m01.material) ? m01.material : [m01.material];
  let bodyIdx = mats.findIndex((m) => /body/i.test(m.name || '')); if (bodyIdx < 0) bodyIdx = 0;
  let src = m01.geometry; if (src.index) src = src.toNonIndexed();
  const grp = new Int8Array(src.attributes.position.count); if (src.groups.length) for (const gr of src.groups) grp.fill(gr.materialIndex, gr.start, gr.start + gr.count);
  const [, sg] = canvasOf(colI, 512), sd = sg.getImageData(0, 0, 512, 512).data;
  const UV = src.attributes.uv, keep = [];
  for (let t = 0; t < UV.count; t += 3) {
    if (src.groups.length && grp[t] !== bodyIdx) continue;
    const u = (UV.getX(t) + UV.getX(t + 1) + UV.getX(t + 2)) / 3, v = 1 - (UV.getY(t) + UV.getY(t + 1) + UV.getY(t + 2)) / 3;
    const j = ((Math.min(511, Math.max(0, v * 512 | 0))) * 512 + Math.min(511, Math.max(0, u * 512 | 0))) * 4;
    if (isShirt(sd[j], sd[j + 1], sd[j + 2])) keep.push(t);
  }
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
    const a = src.attributes[name]; if (!a) continue; const n = a.itemSize, out = new a.array.constructor(keep.length * 3 * n);
    keep.forEach((t, k) => { for (let q = 0; q < 3 * n; q++) out[k * 3 * n + q] = a.array[t * n + q]; });
    geo.setAttribute(name, new THREE.BufferAttribute(out, n, a.normalized));
  }
  // esqueleto: ossos da F11 com os mesmos nomes, inversas de bind da F01 relativas ao nó da F11
  fbx.updateMatrixWorld(true);
  const G = fbx.matrixWorld.clone(), Gi = G.clone().invert();
  const sk01 = m01.skeleton, mapped = sk01.bones.map((b) => { let o = b; while (o && !bones[o.name]) o = o.parent; return o ? bones[o.name] : bones.Bip01_Pelvis || Object.values(bones)[0]; });
  const inv = sk01.boneInverses.map((m) => m.clone().multiply(Gi));
  const mat = inject(new THREE.MeshPhysicalMaterial({ map: whiten(colI), normalMap: new THREE.CanvasTexture(nrmI), normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: rough(spcI), roughness: 1, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.75, specularIntensity: 0.35, side: THREE.DoubleSide }), {
    decl: NOISE, color: 'diffuseColor.rgb *= 0.95 + 0.07 * vn(vec3(vRest.x * 3.2, vRest.y * 0.8, vRest.z * 3.2));',
    normal: `{ vec3 cq = vec3(vRest.x * 3.4, vRest.y * 0.9, vRest.z * 3.4); float e = 0.15;
      vec3 gr = vec3(vn(cq + vec3(e, 0, 0)) - vn(cq - vec3(e, 0, 0)), vn(cq + vec3(0, e, 0)) - vn(cq - vec3(0, e, 0)), vn(cq + vec3(0, 0, e)) - vn(cq - vec3(0, 0, e)));
      normal = normalize(normal - mat3(viewMatrix) * gr * 0.9); }` });
  mat.normalMap.needsUpdate = true;
  const shirt = new THREE.SkinnedMesh(geo, mat); shirt.name = 'camisa_F01'; shirt.castShadow = true; shirt.receiveShadow = true; shirt.frustumCulled = false;
  m01.matrixWorld.decompose(shirt.position, shirt.quaternion, shirt.scale);
  fbx.add(shirt); shirt.updateMatrixWorld(true);
  shirt.bind(new THREE.Skeleton(mapped, inv), G.clone().multiply(m01.bindMatrix));
  return shirt;
}
