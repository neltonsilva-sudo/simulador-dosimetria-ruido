// TRABALHADORA — BOTINA DE SEGURANÇA (substitui a bota de salto da F11): couro preto, bico de composite largo e
// arredondado, solado de borracha grosso tratorado (cravos), salto baixo integrado, cano médio com colarinho acolchoado,
// lingueta e cadarço com ilhoses, costura do biqueiro, desgaste/poeira. Malha rígida presa ao osso do pé (Bip01_?_Foot),
// sola apoiada no piso (y = 0 do grupo) com sombra de contato. Tudo procedural (sem assets).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ── forma (metros, frame da bota: x = lado, y = cima, z = frente; origem no piso sob o tornozelo) ──
const ZH = -0.072, ZT = 0.198;                   // calcanhar / ponta
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function halfW(z) {                              // meia-largura da planta
  const zcH = ZH + 0.037, rH = 0.037, zcT = 0.142, rT = ZT - 0.142;
  if (z <= zcH) return 0.037 * Math.sqrt(Math.max(0, 1 - ((z - zcH) / rH) ** 2));
  if (z >= zcT) return 0.054 * Math.pow(Math.max(0, 1 - ((z - zcT) / rT) ** 2), 0.5);
  return 0.037 + (0.054 - 0.037) * sstep(-0.01, 0.13, z) - 0.002 * Math.exp(-(((z - 0.03) / 0.03) ** 2));
}
const soleTop = (z) => 0.03 + 0.011 * sstep(0.05, -0.03, z);        // salto baixo (≈1 cm de queda)
const soleBot = (z) => 0.0 + 0.009 * sstep(0.15, ZT, z) ** 1.5;      // ponta levemente levantada
function upperH(z) {                             // altura do cabedal acima da sola
  if (z < 0.0) return 0.085;
  if (z < 0.115) return 0.085 + (0.05 - 0.085) * sstep(0.0, 0.115, z);
  return Math.max(0.012, 0.05 * Math.sqrt(Math.max(0, 1 - ((z - 0.115) / 0.088) ** 2)));
}
const NE = 2.6;                                  // superelipse (seção mais "quadrada" de bota)
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
function zSamples(n) { const a = []; for (let i = 0; i <= n; i++) a.push(ZH + (ZT - ZH) * (0.5 - 0.5 * Math.cos(Math.PI * i / n))); return a; }

function outlineRing(zs, grow) {                 // contorno fechado (lado direito ida, esquerdo volta)
  const pts = [];
  for (const z of zs) pts.push([-(halfW(z) + grow * (halfW(z) > 0.002 ? 1 : 0.4)), z]);
  for (let i = zs.length - 2; i >= 1; i--) { const z = zs[i]; pts.push([halfW(z) + grow, z]); }
  return pts;
}
function soleGeo() {
  const zs = zSamples(36), rows = [  // [crescimento lateral, y(z) ]
    [-0.006, (z) => soleBot(z)], [0.0, (z) => soleBot(z) + 0.003], [0.004, (z) => soleBot(z) + 0.009], [0.004, (z) => soleTop(z) - 0.007],
    [0.0045, (z) => soleTop(z) - 0.0045], [0.004, (z) => soleTop(z) - 0.0035], [0.0025, (z) => soleTop(z) - 0.001], [-0.004, (z) => soleTop(z)]];
  const rings = rows.map(([gw, fy]) => outlineRing(zs, gw).map(([x, z]) => [x, fy(z), z]));
  const n = rings[0].length, pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(...p);
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  const cb = pos.length / 3; pos.push(0, soleBot(0.05), 0.05); for (let i = 0; i < n; i++) idx.push(cb, i, (i + 1) % n);     // fundo
  const ct = pos.length / 3, last = (rings.length - 1) * n; pos.push(0, soleTop(0.05), 0.05); for (let i = 0; i < n; i++) idx.push(ct, last + (i + 1) % n, last + i);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const parts = [g.toNonIndexed()];
  // cravos do solado tratorado: blocos ao longo da borda + barras transversais
  const ring = outlineRing(zSamples(160), 0.0); let acc = 0, on = true;
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length], L = Math.hypot(x1 - x0, z1 - z0); acc += L;
    if (acc < (on ? 0.011 : 0.006)) continue; acc = 0; on = !on; if (!on) continue;
    const ang = Math.atan2(x1 - x0, z1 - z0), zc = (z0 + z1) / 2, b0 = soleBot(zc);
    const lug = new THREE.BoxGeometry(0.0105, 0.0085, 0.015); lug.translate(0, 0.0042, 0);
    lug.rotateY(ang); lug.translate((x0 + x1) / 2 * 0.93, b0 - 0.003, zc + (z0 > 0.17 ? -0.004 : 0));
    parts.push(lug.toNonIndexed());
  }
  for (let z = ZH + 0.02; z < ZT - 0.02; z += 0.019) { const w = halfW(z) * 1.4; const bar = new THREE.BoxGeometry(w, 0.006, 0.008); bar.rotateY(0.35 * Math.sin(z * 90)); bar.translate(0, soleBot(z) - 0.002, z); parts.push(bar.toNonIndexed()); }
  for (const p of parts) { p.deleteAttribute('uv'); p.deleteAttribute('normal'); }
  const m = mergeGeometries(parts); m.computeVertexNormals(); return m;
}
function upperGeo() {
  const zs = zSamples(44), NP = 28, pos = [];
  for (const z of zs) {
    const w = Math.max(0.0005, halfW(z) - 0.0015), h = upperH(z), b = soleTop(z) - 0.004;
    for (let j = 0; j <= NP; j++) { const ph = Math.PI * j / NP, c = Math.cos(ph), s = Math.sin(ph);
      const flare = 1 + 0.06 * (1 - s);                         // base um pouco mais larga (vira na sola)
      pos.push(spow(c, 2 / NE) * w * flare, b + Math.pow(s, 2 / NE) * h, z); }
  }
  const idx = [], W = NP + 1;
  for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < NP; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// cano: elipses do tornozelo até ~17 cm, leve inclinação para frente
const SH0 = 0.055, SH1 = 0.172;
const shaftC = (y) => { const t = (y - SH0) / (SH1 - SH0); return { cz: -0.024 + 0.012 * t, rx: 0.043 + 0.003 * t, rz: 0.054 - 0.004 * t }; };
function shaftGeo() {
  const NY = 10, NA = 40, pos = [], idx = [];
  for (let i = 0; i <= NY; i++) { const y = SH0 + (SH1 - SH0) * i / NY, { cz, rx, rz } = shaftC(y);
    for (let j = 0; j <= NA; j++) { const a = 2 * Math.PI * j / NA; pos.push(Math.sin(a) * rx, y, cz + Math.cos(a) * rz); } }
  for (let i = 0; i < NY; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const { cz, rx, rz } = shaftC(SH1);                        // colarinho acolchoado
  const col = new THREE.TorusGeometry(1, 0.0085, 8, 40); col.rotateX(Math.PI / 2); col.scale(rx + 0.002, 1, rz + 0.002); col.translate(0, SH1, cz);
  const tab = new THREE.BoxGeometry(0.016, 0.03, 0.004); tab.translate(0, SH1 + 0.006, cz - rz - 0.004);  // alça de calçar
  for (const p of [col, tab]) p.deleteAttribute('uv');
  g.deleteAttribute('uv');
  return mergeGeometries([g.toNonIndexed(), col.toNonIndexed(), tab.toNonIndexed()]);
}
// ponto da superfície na linha do cadarço (x lateral), sobre o peito do pé ou na frente do cano
function lacePoint(x, k) {
  if (k.z != null) { const z = k.z, w = halfW(z) - 0.0015, h = upperH(z), b = soleTop(z) - 0.004;
    const c = Math.min(0.999, Math.abs(x) / w), s = Math.pow(1 - Math.pow(c, NE), 1 / NE); return new THREE.Vector3(x, b + s * h + 0.0025, z); }
  const { cz, rx, rz } = shaftC(k.y); return new THREE.Vector3(x, k.y, cz + rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + 0.003);
}
function laceGeo() {
  const rows = [{ z: 0.088 }, { z: 0.064 }, { z: 0.04 }, { z: 0.018 }, { y: 0.112 }, { y: 0.134 }, { y: 0.156 }];
  const parts = [], eyes = [], X = 0.0165;
  rows.forEach((r) => { for (const sx of [-1, 1]) eyes.push(lacePoint(sx * X, r)); });
  for (let i = 0; i < rows.length - 1; i++) for (const sx of [-1, 1]) {
    const a = lacePoint(sx * X, rows[i]), b = lacePoint(-sx * X, rows[i + 1]), m = a.clone().lerp(b, 0.5); m.add(lacePoint(0, rows[i]).sub(lacePoint(0.0001, rows[i])).multiplyScalar(0));
    const lift = lacePoint(0, rows[i]).lerp(lacePoint(0, rows[i + 1]), 0.5); m.y = Math.max(m.y, lift.y + 0.001); if (rows[i].y) m.z = Math.max(m.z, lift.z + 0.001);
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, m, b]), 8, 0.0017, 5));
  }
  { const a = lacePoint(-X, rows[0]), b = lacePoint(X, rows[0]); parts.push(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 2, 0.0017, 5)); }
  // laço no topo + pontas penduradas
  const top = lacePoint(0, { y: 0.163 }); top.z += 0.004;
  for (const sx of [-1, 1]) {
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top, top.clone().add(new THREE.Vector3(sx * 0.016, 0.01, 0.006)), top.clone().add(new THREE.Vector3(sx * 0.024, -0.002, 0.008)), top.clone().add(new THREE.Vector3(sx * 0.006, -0.004, 0.004))]), 12, 0.0016, 5));
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top, top.clone().add(new THREE.Vector3(sx * 0.008, -0.02, 0.008)), top.clone().add(new THREE.Vector3(sx * 0.012, -0.045, 0.012))]), 10, 0.0016, 5));
  }
  for (const p of parts) { p.deleteAttribute('uv'); }
  const lace = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  const ep = eyes.map((e) => { const t = new THREE.TorusGeometry(0.0032, 0.0011, 6, 12); t.deleteAttribute('uv');
    const n = e.y > 0.1 && Math.abs(e.z) < 0.05 ? new THREE.Vector3(Math.sign(e.x) * 0.3, 0, 1) : new THREE.Vector3(Math.sign(e.x) * 0.3, 1, 0.25);
    t.lookAt(n); t.translate(e.x, e.y - 0.0008, e.z); return t.toNonIndexed(); });
  return { lace, eyelets: mergeGeometries(ep) };
}

function leatherMat() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.45, specularIntensity: 0.6 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vB;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvB = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vB;
      float h31(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float bScuff; float bSeam;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 p = vB; vec3 col = vec3(0.011, 0.010, 0.0095) * (0.85 + 0.3 * vn(p * 900.0));
        // biqueiro: costura em arco atravessando o bico (pesponto duplo)
        float cap = p.z - (0.118 + 0.035 * pow(abs(p.x) / 0.055, 2.0));
        float st = smoothstep(0.0011, 0.0003, abs(cap)) + smoothstep(0.0011, 0.0003, abs(cap - 0.0045));
        float dots = step(0.45, fract((p.x + p.y * 0.3) * 520.0));
        bSeam = clamp(st, 0.0, 1.0) * step(p.y, 0.09);
        col = mix(col, vec3(0.07, 0.065, 0.06), bSeam * dots);
        col *= mix(1.0, 0.78, smoothstep(0.003, 0.0, abs(cap - 0.0022)) * step(p.y, 0.09));
        // lingueta (camurça um tom acima) entre as linhas de ilhós
        float tg = step(abs(p.x), 0.012) * step(0.035, p.y + p.z * 0.6) * step(p.z, 0.098);
        col = mix(col, vec3(0.035, 0.032, 0.03) * (0.8 + 0.4 * vn(p * 1400.0)), tg * 0.9);
        // desgaste: bico e calcanhar esfolados, poeira perto da sola
        float sc = smoothstep(0.15, 0.19, p.z) * smoothstep(0.075, 0.035, p.y) + smoothstep(-0.05, -0.068, p.z) * smoothstep(0.08, 0.04, p.y) * 0.7;
        sc *= smoothstep(0.35, 0.75, vn(p * 160.0) * 0.7 + vn(p * 700.0) * 0.3);
        bScuff = sc; col = mix(col, vec3(0.05, 0.046, 0.042), sc * 0.8);
        float du = smoothstep(0.065, 0.03, p.y) * (0.4 + 0.6 * vn(p * 220.0));
        col = mix(col, vec3(0.12, 0.11, 0.095), du * 0.22);
        // vinco de flexão no peito do pé
        diffuseColor.rgb = col; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(0.42 + 0.16 * vn(vB * 300.0) + 0.3 * bScuff + 0.15 * smoothstep(0.065, 0.03, vB.y), 0.0, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 p = vB * 1100.0; float e = 0.35; float a = 1.0 - smoothstep(0.4, 1.2, length(fwidth(p)));
        vec3 gr = vec3(vn(p + vec3(e,0,0)) - vn(p - vec3(e,0,0)), vn(p + vec3(0,e,0)) - vn(p - vec3(0,e,0)), vn(p + vec3(0,0,e)) - vn(p - vec3(0,0,e)));
        float fl = smoothstep(0.08, 0.095, vB.z) * smoothstep(0.112, 0.1, vB.z) * sin(vB.z * 600.0 + 4.0 * vn(vB * 90.0)) * smoothstep(0.02, 0.0, abs(vB.x) - 0.02);
        normal = normalize(normal - mat3(viewMatrix) * (gr * 0.09 * a + vec3(0.0, 0.0, fl * 0.2))); }`);
  };
  m.customProgramCacheKey = () => 'botinaCouro';
  return m;
}
function rubberMat() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0x0d0d0d, roughness: 0.88, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vB;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvB = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vB;\nfloat hh(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float rib = smoothstep(0.0012, 0.0004, abs(vB.y - 0.017)) ;          // friso do entressola
          float du = smoothstep(0.012, 0.0, vB.y) * (0.5 + 0.5 * hh(floor(vB * 2500.0)));
          diffuseColor.rgb = mix(vec3(0.016), vec3(0.03), rib) ; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.14, 0.13, 0.115), du * 0.5); }`);
  };
  m.customProgramCacheKey = () => 'botinaBorracha';
  return m;
}
function contactTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 64, 4, 32, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = gr; g.save(); g.translate(32, 64); g.scale(0.55, 1); g.translate(-32, -64); g.fillRect(-40, 0, 160, 128); g.restore();
  return new THREE.CanvasTexture(c);
}

export function buildBoots({ bones, group, floorY = 0 }) {
  const leather = leatherMat(), rubber = rubberMat();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.35, metalness: 0.85 });
  const laceM = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.9 });
  const shadowM = new THREE.MeshBasicMaterial({ map: contactTex(), transparent: true, depthWrite: false, color: 0x000000, opacity: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  shadowM.alphaMap = shadowM.map; shadowM.map = null;
  const sole = soleGeo(), upper = mergeGeometries([upperGeo().toNonIndexed(), shaftGeo()]); upper.computeVertexNormals();
  const { lace, eyelets } = laceGeo();
  const boots = [];
  group.updateMatrixWorld(true);
  for (const sd of ['L', 'R']) {
    const foot = bones[`Bip01_${sd}_Foot`], toe = bones[`Bip01_${sd}_Toe0`]; if (!foot || !toe) continue;
    const A = foot.getWorldPosition(new THREE.Vector3()), T = toe.getWorldPosition(new THREE.Vector3());
    const d = T.clone().sub(A); d.y = 0; d.normalize();
    const b = new THREE.Group(); b.name = 'botina_' + sd;
    const up = new THREE.Vector3(0, 1, 0), x = up.clone().cross(d).normalize();
    b.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, d));
    b.position.set(A.x, floorY, A.z).addScaledVector(d, 0.004);
    const add = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; b.add(o); return o; };
    add(upper, leather); add(sole, rubber); add(lace, laceM); add(eyelets, metal, false);
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.36), shadowM); cs.rotation.x = -Math.PI / 2; cs.position.set(0, 0.0012, 0.064); cs.renderOrder = -1; b.add(cs);
    b.parent?.remove(b); group.parent.add(b); b.updateMatrixWorld(true); foot.attach(b);
    boots.push(b);
  }
  return boots;
}
