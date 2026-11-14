// Maleta do kit (aberta sobre a bancada TABLE): casco PP preto granulado, espuma cinza recortada (dosímetro, calibrador,
// carregador, cabo USB), tampa aberta com espuma "caixa de ovo". Dono: DOSÍMETRO 3D. Unidades mm (grupo ×0,001).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TABLE } from './layout_cams.js';
import { extrudeSmooth, roundRectArc, mirroredShape, samplePath } from './dosi_geo.js';
import { caseMaps, packFoamMaps } from './dosi_tex.js';

export function buildKitImpl(stage) {
  const group = new THREE.Group(); group.name = 'kitMaleta';
  group.position.set(TABLE.pos[0], TABLE.h, TABLE.pos[2]); group.rotation.y = TABLE.rotY || 0;
  const K = new THREE.Group(); K.scale.setScalar(0.001); group.add(K);
  const add = (geo, mat, p = K) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
  const flat = (g) => g.rotateX(-Math.PI / 2); // forma XY → piso XZ, extrusão ao longo de +y (forma y = −z)

  const cm = caseMaps(); const cn = cm.normal.clone(); cn.repeat.set(1 / 7, 1 / 7); cn.needsUpdate = true;
  const caseMat = new THREE.MeshPhysicalMaterial({ color: 0x17181a, roughness: 0.62, normalMap: cn, normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 0.1, clearcoatRoughness: 0.6 });
  const pm = packFoamMaps(); const pn = pm.normal.clone(); pn.repeat.set(1 / 6, 1 / 6); pn.needsUpdate = true; const pc = pm.color.clone(); pc.repeat.set(1 / 6, 1 / 6); pc.needsUpdate = true;
  const foamMat = new THREE.MeshStandardMaterial({ color: 0x5d6064, map: pc, normalMap: pn, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3c3f, map: pc, normalMap: pn, roughness: 1 });

  const W = 400, D = 300, Hb = 88, Hl = 44, wall = 5;
  // base: paredes + fundo
  const ring = roundRectArc(W, D, 26); ring.holes.push(roundRectArc(W - 2 * wall, D - 2 * wall, 22, 0, 0, THREE.Path));
  const walls = add(flat(extrudeSmooth(ring, Hb, { bt: 2, bs: 1.6, seg: 3, uvScale: 1 })), caseMat); walls.position.y = Hb / 2;
  const bottom = add(flat(extrudeSmooth(roundRectArc(W, D, 26), 6, { bt: 1.5, bs: 1.5, seg: 2 })), caseMat); bottom.position.y = 3;
  // frisos laterais do casco
  for (const s of [-1, 1]) { const rib = add(new THREE.BoxGeometry(W - 70, 3, 2.4), caseMat); rib.position.set(0, 30, s * (D / 2 + 0.6)); }
  // espuma inferior (piso dos recortes)
  const f0 = add(new THREE.BoxGeometry(W - 2 * wall - 1, 42, D - 2 * wall - 1), floorMat); f0.position.y = 6 + 21;
  // espuma superior com recortes
  const top = roundRectArc(W - 2 * wall - 1, D - 2 * wall - 1, 21);
  const P = (pts, dx, dy) => mirroredShape(pts.map(([x, y]) => [x, y]), THREE.Path);
  const dosiHalf = samplePath([[[0, -73], [17, -73]], [[17, -73], [24, -73], [31, -66], [31.5, -50]], [[31.5, -50], [33, -10], [33, 40]],
    [[33, 40], [33, 53], [29, 58.5], [19, 58.5]], [[19, 58.5], [17.5, 72], [13, 86], [0, 86]]], 10).map(([x, y]) => [x, y]);
  const off = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
  // shape y = −z da maleta; dosímetro com microfone para o fundo (−z) → +y da forma
  const dPath = new THREE.Path(); { const pts = dosiHalf, n = pts.length; const all = pts.concat(pts.slice(1, n - 1).reverse().map(([x, y]) => [-x, y]));
    off(all, -115, -5).forEach(([x, y], i) => (i ? dPath.lineTo(x, y) : dPath.moveTo(x, y))); dPath.closePath(); }
  top.holes.push(dPath);
  top.holes.push(roundRectArc(68, 101, 14, -15, 0, THREE.Path));          // calibrador
  top.holes.push(roundRectArc(52, 52, 7, 112, 52, THREE.Path));           // carregador (z = −52)
  const cab = new THREE.Path(); cab.absarc(112, -60, 42, 0, Math.PI * 2, false); top.holes.push(cab); // cabo (z = +60)
  const f1 = add(flat(extrudeSmooth(top, 32, { bt: 1.6, bs: 1.6, seg: 3, curve: 20 })), foamMat); f1.position.y = 48 + 16;

  // carregador USB (fonte de parede) deitado no recorte
  const chMat = new THREE.MeshPhysicalMaterial({ color: 0x1b1c1e, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const ch = add(new RoundedBoxGeometry(44, 26, 44, 4, 5), chMat); ch.position.set(112, 48 + 13, -52);
  const usbA = add(new THREE.BoxGeometry(12.5, 5, 1), new THREE.MeshStandardMaterial({ color: 0x050505 })); usbA.position.set(112, 48 + 13, -52 + 22.2);
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.3 });
  for (const s of [-1, 1]) { const pin = add(new THREE.BoxGeometry(1.6, 6.5, 14), metal); pin.position.set(112 + s * 6.3, 48 + 26 + 0.5, -52 - 4); pin.rotation.x = Math.PI / 2; pin.scale.set(1, 1, 1); }
  // cabo USB enrolado (tubo) + plugues
  const cablePts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * Math.PI * 2 * 2.6, r = 30 - 6 * t + 2 * Math.sin(a * 3.1);
    cablePts.push(new THREE.Vector3(112 + r * Math.cos(a), 48 + 3 + 6 * t + 1.5 * Math.sin(a * 2), 60 + r * Math.sin(a))); }
  const cabMat = new THREE.MeshPhysicalMaterial({ color: 0x121214, roughness: 0.4, clearcoat: 0.3 });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 400, 1.7, 8, false), cabMat);
  const plug = (p, ang) => { const g = new THREE.Group(); g.position.copy(p); g.rotation.y = ang; K.add(g);
    add(new RoundedBoxGeometry(11, 6.5, 16, 2, 1.5), cabMat, g); const m = add(new THREE.BoxGeometry(7.6, 3, 6), metal, g); m.position.z = 10.5; };
  plug(cablePts[0].clone().add(new THREE.Vector3(0, 2, 0)), 0.3); plug(cablePts[120].clone().add(new THREE.Vector3(0, 1.5, 0)), 2.2);

  // alça frontal + travas
  const hCurve = new THREE.CatmullRomCurve3([[-70, 40, 150], [-62, 40, 176], [-40, 40, 186], [40, 40, 186], [62, 40, 176], [70, 40, 150]].map((a) => new THREE.Vector3(...a)));
  add(new THREE.TubeGeometry(hCurve, 60, 6, 12, false), caseMat);
  for (const s of [-1, 1]) {
    const lt = add(new RoundedBoxGeometry(34, 30, 9, 2, 2.5), caseMat); lt.position.set(s * 120, Hb - 4, D / 2 + 3.5);
    const lp = add(new THREE.CylinderGeometry(1.5, 1.5, 36, 10), metal); lp.rotation.z = Math.PI / 2; lp.position.set(s * 120, Hb - 18, D / 2 + 6);
    const kn = add(new THREE.CylinderGeometry(4.5, 4.5, 44, 16), caseMat); kn.rotation.z = Math.PI / 2; kn.position.set(s * 120, Hb + 1, -D / 2 - 3);
  }

  // tampa aberta (dobradiça na borda traseira superior) com espuma caixa-de-ovo
  const lid = new THREE.Group(); lid.position.set(0, Hb + 1, -D / 2 - 3); lid.rotation.x = -1.83; K.add(lid);
  const lring = roundRectArc(W, D, 26); lring.holes.push(roundRectArc(W - 2 * wall, D - 2 * wall, 22, 0, 0, THREE.Path));
  const lw = add(flat(extrudeSmooth(lring, Hl, { bt: 2, bs: 1.6, seg: 3 })), caseMat, lid); lw.position.set(0, Hl / 2, D / 2 + 3);
  const lt = add(flat(extrudeSmooth(roundRectArc(W, D, 26), 5, { bt: 1.5, bs: 1.5, seg: 2 })), caseMat, lid); lt.position.set(0, Hl - 2.5, D / 2 + 3);
  for (let i = -2; i <= 2; i++) { const r = add(new THREE.BoxGeometry(W - 90, 3, 6), caseMat, lid); r.position.set(0, Hl + 1, D / 2 + 3 + i * 45); }
  const eg = new THREE.PlaneGeometry(W - 2 * wall - 2, D - 2 * wall - 2, 120, 90); eg.rotateX(Math.PI / 2); // normal −y (para dentro)
  { const p = eg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i);
      const e = Math.sin(x * Math.PI * 2 / 32) * Math.sin(z * Math.PI * 2 / 32); p.setY(i, -Math.sign(e) * Math.pow(Math.abs(e), 0.8) * 7.5); }
    eg.computeVertexNormals(); }
  const egg = add(eg, foamMat, lid); egg.position.set(0, 26, D / 2 + 3);
  const eggBack = add(new THREE.BoxGeometry(W - 2 * wall - 2, 10, D - 2 * wall - 2), foamMat, lid); eggBack.position.set(0, 35, D / 2 + 3);

  stage.scene.add(group);
  return { group, update() {} };
}
