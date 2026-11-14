// CABEÇA (EPIs + cabelo) da trabalhadora — dono: ROSTO. Base: Rocketbox Female_Adult_11 (FBX, biped "Bip01 Head").
// worker.js chama: const head = await (await import('./worker_head.js')).buildHead({ THREE, stage, app, root, skinned, bones, headBone })
// Entrega (replaces): capacete classe B branco c/ suspensão e jugular, óculos incolores envolventes (transmission),
// plugs de espuma laranja inseridos, rabo de cabelo cacheado volumoso saindo por trás do capacete (remove o coque/cards
// originais, preserva sobrancelhas e cílios). O rosto do Rocketbox NÃO é alterado.
// Tudo é montado num frame preso ao headBone: origem = ponto médio dos olhos, metros, y cima, z frente, x = esquerda dela
// (eixos do root no momento da chamada). Dimensões medidas da própria malha (funciona em cm ou m).
import { mkHelmetTex, mkFoamTex, mkCeilingEnv } from './worker_head_tex.js';
import { buildHair } from './worker_head_hair.js';

export async function buildHead({ THREE, stage, app, root, skinned, bones, headBone }) {
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const findBone = (re) => { let b = null; (headBone || root).traverse((o) => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
  headBone = headBone || bones?.['Bip01 Head'] || bones?.['Bip01_Head'] || (() => { let b; root.traverse((o) => { if (!b && o.isBone && /Head$/.test(o.name)) b = o; }); return b; })();
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const meshes = []; root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); }); if (skinned && !meshes.includes(skinned)) meshes.push(skinned);

  // ── vértices da cabeça (osso dominante = Head ou descendentes), em espaço do root ──
  const headSet = new Set(); headBone.traverse((o) => { if (o.isBone) headSet.add(o); });
  const isOpac = (m) => !!(m && (m.alphaMap || /opacity|hair/i.test(m.name || '')));
  const recs = []; // {mesh, i, p, mat}
  const tmp = V3();
  for (const m of meshes) {
    const g = m.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, n = g.attributes.position.count;
    const mats = [].concat(m.material), matOf = new Int16Array(n).fill(-1);
    const idx = g.index ? g.index.array : null, groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.length : n, materialIndex: 0 }];
    for (const gr of groups) for (let k = gr.start; k < gr.start + gr.count; k++) { const v = idx ? idx[k] : k; if (matOf[v] < 0) matOf[v] = gr.materialIndex; }
    for (let i = 0; i < n; i++) {
      let bw = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; bi = SI.getComponent(i, k); } }
      if (!headSet.has(m.skeleton.bones[bi])) continue;
      m.getVertexPosition(i, tmp); tmp.applyMatrix4(m.matrixWorld).applyMatrix4(rootInv);
      recs.push({ m, i, p: tmp.clone(), mat: mats[matOf[i]] || mats[0] });
    }
  }
  // unidade: altura da cabeça ~0,25 m → em cm vale ~25
  const ys = recs.map((r) => r.p.y); const hRaw = Math.max(...ys) - Math.min(...ys); const U = hRaw > 3 ? 100 : 1;
  // olhos (ossos do biped) ou estimativa
  const eL = findBone(/L_?Eye$/i), eR = findBone(/R_?Eye$/i);
  const pr = (b) => b.getWorldPosition(V3()).applyMatrix4(rootInv);
  let O;
  if (eL && eR) O = pr(eL).add(pr(eR)).multiplyScalar(0.5);
  else { const hb = pr(headBone); O = V3(hb.x, Math.max(...ys) - 0.115 * U, Math.max(...recs.map((r) => r.p.z)) - 0.03 * U); }
  // coordenadas locais (m) relativas aos olhos
  for (const r of recs) r.q = r.p.clone().sub(O).multiplyScalar(1 / U);
  const skin = recs.filter((r) => !isOpac(r.mat));
  const sel = (fn) => skin.filter((r) => fn(r.q));
  const maxBy = (arr, f) => arr.reduce((a, b) => (f(b) > f(a) ? b : a), arr[0]);
  const T = Math.max(...skin.map((r) => r.q.y));
  // nuca/occipital sem o coque (coque = textura cacheada na parte de baixo do atlas da cabeça)
  const bunUV = (r) => { const uv = r.m.geometry.attributes.uv; return uv && 1 - uv.getY(r.i) > 0.68; };
  const backSkull = sel((q) => q.y > -0.02 && q.y < 0.07 && Math.abs(q.x) < 0.03).filter((r) => !bunUV(r));
  let zB = backSkull.length ? Math.min(...backSkull.map((r) => r.q.z)) : -0.17; zB = Math.max(zB, -0.2);
  const zF = Math.max(...sel((q) => q.y > 0.03 && q.y < 0.06 && Math.abs(q.x) < 0.02).map((r) => r.q.z));
  const hw = Math.max(...sel((q) => q.y > 0.03 && q.y < 0.08).map((r) => Math.abs(r.q.x)));
  const bridge = sel((q) => Math.abs(q.x) < 0.008 && q.y > -0.006 && q.y < 0.012); const zBr = bridge.length ? Math.max(...bridge.map((r) => r.q.z)) : zF;
  const chinPts = sel((q) => Math.abs(q.x) < 0.015 && q.y < -0.075 && q.y > -0.15);
  const chinF = chinPts.length ? maxBy(chinPts, (r) => r.q.z).q : V3(0, -0.105, zBr - 0.015);
  const chin = V3(0, chinF.y - 0.012, chinF.z - 0.006); // ponto sob o queixo
  const ear = {};
  for (const s of [1, -1]) {
    const band = sel((q) => q.y > -0.06 && q.y < 0.015 && q.x * s > 0 && q.z < zBr - 0.04);
    const out = Math.max(...band.map((r) => r.q.x * s)); const e = band.filter((r) => r.q.x * s > out - 0.012);
    const c = e.reduce((a, r) => a.add(r.q), V3()).multiplyScalar(1 / e.length);
    ear[s] = { out, c };
  }
  const dbg = { U, T: +T.toFixed(3), zB: +zB.toFixed(3), zF: +zF.toFixed(3), hw: +hw.toFixed(3), zBr: +zBr.toFixed(3), chin: chin.toArray().map((v) => +v.toFixed(3)),
    ear: [1, -1].map((s) => [ear[s].out, ear[s].c.y, ear[s].c.z].map((v) => +v.toFixed(3))) };

  // ── frame preso ao osso: mundo = rootWorld · T(O) · S(U) · p ──
  const frame = new THREE.Group(); frame.name = 'cabeca_epi'; frame.matrixAutoUpdate = false;
  headBone.updateWorldMatrix(true, false);
  frame.matrix.copy(headBone.matrixWorld).invert().multiply(root.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(O.x, O.y, O.z)).multiply(new THREE.Matrix4().makeScale(U, U, U));
  headBone.add(frame);
  const add = (o, par = frame) => { par.add(o); return o; };

  // ── remove coque e cards de cabelo originais (mantém sobrancelhas/cílios: cards junto aos olhos) ──
  for (const m of meshes) {
    const g = m.geometry, n = g.attributes.position.count, mats = [].concat(m.material);
    const local = new Map(); for (const r of recs) if (r.m === m) local.set(r.i, r);
    const idx = g.index ? g.index.array : null, total = idx ? idx.length : n;
    const groups = g.groups.length ? g.groups.map((x) => ({ ...x })) : [{ start: 0, count: total, materialIndex: 0 }];
    const uv = g.attributes.uv, out = [], ng = []; let removed = 0;
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0], st = out.length;
      for (let k = gr.start; k < Math.min(total, gr.start + gr.count); k += 3) {
        const a = idx ? idx[k] : k, b = idx ? idx[k + 1] : k + 1, c = idx ? idx[k + 2] : k + 2;
        const ra = local.get(a), rb = local.get(b), rc = local.get(c); let drop = false;
        if (ra && rb && rc) {
          const q = ra.q.clone().add(rb.q).add(rc.q).multiplyScalar(1 / 3);
          if (isOpac(mat)) drop = !(q.z > zBr - 0.045 && Math.abs(q.y) < 0.045 && Math.abs(q.x) < 0.075); // fica: cílios/sobrancelhas
          else if (uv) { const vImg = 1 - (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3; drop = vImg > 0.68 && q.z < zBr - 0.07 && q.y > -0.06; } // coque (textura cacheada)
        }
        if (drop) removed++; else out.push(a, b, c);
      }
      ng.push({ start: st, count: out.length - st, materialIndex: gr.materialIndex });
    }
    if (removed) { g.setIndex(out); g.clearGroups(); for (const x of ng) g.addGroup(x.start, x.count, x.materialIndex); }
    dbg['removed_' + m.name] = removed;
  }

  // ── materiais compartilhados ──
  let seed = 11; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ── capacete classe B, aba frontal ──
  // casco justo (~15 % menor que a 1ª versão): folga lateral ~6 mm, testa ~1 cm, nuca ~2 cm, ~3,5 cm de suspensão sobre o topo
  const RX = hw + 0.0055, RZ = (zF - zB) / 2 + 0.0145, rimY = 0.042, HH = Math.max(0.104, T - rimY + 0.036), TILT = -0.11;
  const helmet = add(new THREE.Group()); helmet.name = 'capacete';
  helmet.position.set(0, rimY, (zF + zB) / 2 - 0.004); helmet.rotation.x = TILT;
  const hTex = mkHelmetTex(THREE);
  let envL = null; try { envL = mkCeilingEnv(THREE, stage?.renderer); } catch (e) { envL = null; }
  const white = new THREE.MeshPhysicalMaterial({ color: 0xfbfaf6, map: hTex.map, roughnessMap: hTex.rough, roughness: 0.55, bumpMap: hTex.bump, bumpScale: 0.25,
    clearcoat: 1, clearcoatRoughness: 0.06, specularIntensity: 0.8, side: THREE.DoubleSide, envMap: envL, envMapIntensity: 1.1, emissive: 0xfffcf4, emissiveIntensity: 0.06 }); // ABS branco brilhante
  const shellR = (a, e) => { // casco tipo boné: oval (frente-trás > largura), alto, nervura central + 2 nervuras longitudinais
    const c = Math.pow(Math.cos(e), 0.72);
    const x = RX * c * Math.sin(a), z = RZ * c * Math.cos(a) + 0.012 * Math.sin(e) * Math.cos(a), y = HH * Math.pow(Math.sin(e), 0.88);
    const hor = Math.hypot(x, z) + 1e-6, fade = Math.min(1, e * 2.2) * (1 - Math.pow(Math.max(0, Math.cos(a)), 12) * 0.5);
    const rib = 0.0065 * Math.exp(-Math.pow(x / 0.011, 2)) * fade;
    const ribs = 0.0032 * Math.exp(-Math.pow((Math.abs(x) - 0.042 * c) / 0.0055, 2)) * fade * Math.min(1, Math.abs(Math.cos(a)) * 3);
    const k = 1 + (rib + ribs) / hor; return V3(x * k, y + rib * 0.9 + ribs * 0.35, z * k);
  };
  {
    const NA = 72, NE = 24, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NE; j++) for (let i = 0; i <= NA; i++) { const p = shellR(i / NA * Math.PI * 2, j / NE * Math.PI / 2 * 0.999); pos.push(p.x, p.y, p.z); uv.push(i / NA, j / NE); }
    for (let j = 0; j < NE; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + NA + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const shell = add(new THREE.Mesh(g, white), helmet); shell.castShadow = shell.receiveShadow = true;
    // aba: pala frontal ~5 cm, borda lateral/traseira estreita, levemente virada para cima na frente
    // pala CURTA só na frente (~4 cm, curvada para baixo); laterais e nuca: rebordo de ~1 cm
    const BA = 120, NR = 5, bp = [], buv = [], bi = [], edge = [];
    for (let i = 0; i <= BA; i++) {
      const a = i / BA * Math.PI * 2, base = shellR(a, 0), ca = Math.cos(a), fr = Math.pow(Math.max(0, ca), 3.2);
      const off = 0.004 + 0.031 * fr, dir = V3(base.x / RX / RX, 0, base.z / RZ / RZ).normalize();
      for (let k = 0; k <= NR; k++) { const t = k / NR;
        const o = base.clone().addScaledVector(dir, off * t); o.y += 0.001 - (0.003 + 0.011 * fr) * t * t - 0.003 * Math.pow(Math.max(0, -ca), 2) * t;
        bp.push(o.x, o.y, o.z); buv.push(i / BA, 0.04 * t); if (k === NR) edge.push(o); }
    }
    for (let i = 0; i < BA; i++) for (let k = 0; k < NR; k++) { const a = i * (NR + 1) + k, b = a + NR + 1; bi.push(a, b, a + 1, a + 1, b, b + 1); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2));
    bg.setIndex(bi); bg.computeVertexNormals();
    add(new THREE.Mesh(bg, white), helmet).castShadow = true;
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 200, 0.0028, 8, true), white), helmet);
    // encaixes laterais de acessório
    const slotM = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
    for (const sx of [-1, 1]) {
      const b = shellR(sx * (Math.PI / 2 + 0.15), 0.07);
      const box = add(new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.015, 0.028), white), helmet); box.position.copy(b).add(V3(sx * 0.0025, 0, 0)); box.rotation.y = -sx * 0.15;
      const gap = add(new THREE.Mesh(new THREE.BoxGeometry(0.0075, 0.0035, 0.022), slotM), helmet); gap.position.copy(box.position).add(V3(sx * 0.0005, 0.002, 0)); gap.rotation.y = box.rotation.y;
    }
    // suspensão: carneira (faixa), tira de nuca com catraca
    const susM = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.75, side: THREE.DoubleSide });
    const band = add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.02, 48, 1, true), susM), helmet);
    band.scale.set(RX - 0.009, 1, RZ - 0.012); band.position.set(0, 0.006, -0.004);
    const nz = -(RZ - 0.006);
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-(RX - 0.01), -0.004, -0.04), V3(-(RX - 0.022), -0.026, nz * 0.8), V3(0, -0.034, nz), V3(RX - 0.022, -0.026, nz * 0.8), V3(RX - 0.01, -0.004, -0.04)]), 24, 0.0055, 5), susM), helmet);
    const ratchet = add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.011, 16), susM), helmet); ratchet.rotation.x = Math.PI / 2; ratchet.position.set(0, -0.034, nz - 0.006);
  }
  // jugular preta com estampa amarela, solta: desce atrás da orelha e passa pela nuca (como na foto, sem cruzar o queixo)
  {
    const [jc, jg] = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 32; return [c, c.getContext('2d')]; })();
    jg.fillStyle = '#121212'; jg.fillRect(0, 0, 512, 32); jg.fillStyle = '#f2c200';
    for (let x = 8; x < 512; x += 64) { jg.font = 'bold 20px sans-serif'; jg.fillText('CLASSE B', x, 23); }
    jg.fillRect(0, 2, 512, 1.5); jg.fillRect(0, 28.5, 512, 1.5);
    const jt = new THREE.CanvasTexture(jc); jt.colorSpace = THREE.SRGBColorSpace; jt.wrapS = THREE.RepeatWrapping; jt.anisotropy = 8;
    const strapM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: jt, roughness: 0.65, side: THREE.DoubleSide });
    const ez = (ear[1].c.z + ear[-1].c.z) / 2, sx = (s) => s * (Math.max(ear[1].out, ear[-1].out) + 0.005);
    const pts = []; for (const s of [-1, 1]) { const side = [V3(sx(s) * 0.97, 0.034, ez - 0.026), V3(sx(s) * 1.01, 0.0, ez - 0.034), V3(sx(s) * 0.98, -0.04, ez - 0.05), V3(s * 0.06, -0.085, zB + 0.06)]; pts.push(...(s < 0 ? side : side.reverse())); }
    pts.splice(4, 0, V3(0, -0.098, zB + 0.07));
    add(new THREE.Mesh(ribbon(THREE, new THREE.CatmullRomCurve3(pts), 0.013, 0.0016, 120), strapM)).castShadow = true;
    const buckle = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.005), new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.5 }))); buckle.position.set(-0.045, -0.088, zB + 0.062); buckle.rotation.set(0, -0.6, -0.5);
  }

  // ── óculos de segurança incolores envolventes ──
  const glasses = add(new THREE.Group()); glasses.name = 'oculos';
  {
    const ax = Math.max(hw - 0.006, 0.07), az = 0.075, cz = zBr + 0.013 - az, tmax = 1.32, NT = 64, NV = 10;
    const lensPt = (t, v) => {
      const x = ax * Math.sin(t), z = cz + az * Math.cos(t), ct = Math.abs(Math.sin(t));
      const top = 0.026 - 0.01 * Math.pow(ct, 2.5), notch = 0.021 * Math.exp(-Math.pow(x / 0.011, 2));
      const bot = -0.027 + 0.012 * Math.pow(ct, 2) + notch;
      const y = bot + (top - bot) * v, bulge = 0.003 * Math.sin(v * Math.PI) + (1 - v) * 0.005;
      const k = 1 + bulge / Math.hypot(x, z - cz); return V3(x * k, y, cz + (z - cz) * k);
    };
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NT; i++) { const p = lensPt(-tmax + 2 * tmax * i / NT, j / NV); pos.push(p.x, p.y, p.z); uv.push(i / NT, j / NV); }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NT; i++) { const a = j * (NT + 1) + i, b = a + NT + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const low = stage?.quality === 'low';
    // policarbonato: transmission real (refração/reflexo) — sem "placa cinza"; em q=low cai para camada aditiva de reflexo
    const lensMat = low
      ? new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02, envMap: envL, envMapIntensity: 1 })
      : new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, thickness: 0.0015, ior: 1.585, roughness: 0.03, metalness: 0, specularIntensity: 1,
        clearcoat: 1, clearcoatRoughness: 0.02, envMap: envL, envMapIntensity: 1.6, side: THREE.DoubleSide, attenuationColor: new THREE.Color(0xf4fbff), attenuationDistance: 0.5 });
    const lens = add(new THREE.Mesh(g, lensMat), glasses); lens.userData.noAO = true; lens.renderOrder = 5;
    const rimPts = []; for (let i = 0; i <= NT; i++) rimPts.push(lensPt(-tmax + 2 * tmax * i / NT, 1));
    for (let j = NV - 1; j >= 1; j--) rimPts.push(lensPt(tmax, j / NV));
    for (let i = NT; i >= 0; i--) rimPts.push(lensPt(-tmax + 2 * tmax * i / NT, 0));
    for (let j = 1; j < NV; j++) rimPts.push(lensPt(-tmax, j / NV));
    const edgeM = new THREE.MeshPhysicalMaterial({ color: 0xeef6fa, transparent: true, opacity: 0.55, roughness: 0.08, clearcoat: 1, envMap: envL, envMapIntensity: 1.4, depthWrite: false });
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true, 'centripetal'), 300, 0.0009, 5, true), edgeM), glasses).renderOrder = 7;
    const barPts = []; for (let i = 0; i <= 30; i++) { const p = lensPt(-tmax * 0.97 + 2 * tmax * 0.97 * i / 30, 0.97); p.y += 0.0012; barPts.push(p); }
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(barPts), 60, 0.0018, 6), edgeM), glasses).renderOrder = 7;
    const armM = new THREE.MeshPhysicalMaterial({ color: 0x9aa4aa, transparent: true, opacity: 0.85, roughness: 0.25, clearcoat: 0.8 });
    for (const s of [-1, 1]) {
      const st = lensPt(s * tmax, 0.8), ex = Math.max(ear[s].out, hw) + 0.003, ez = ear[s].c.z;
      add(new THREE.Mesh(ribbon(THREE, new THREE.CatmullRomCurve3([st, V3(s * (ax + 0.004), st.y - 0.002, st.z - 0.02), V3(s * ex, 0.006, ez + 0.01), V3(s * (ex - 0.004), -0.004, ez - 0.012)]), 0.0065, 0.002, 24, V3(s, 0, 0)), armM), glasses).castShadow = true;
    }
  }

  // ── protetores auriculares de espuma (laranja), inseridos no canal ──
  const foam = mkFoamTex(THREE);
  const plugMat = new THREE.MeshStandardMaterial({ color: 0xff8a2a, map: foam.map, bumpMap: foam.bump, bumpScale: 1.2, roughness: 0.92 });
  const plugGeo = new THREE.LatheGeometry([V3(0, -0.011), V3(0.0052, -0.0108), V3(0.006, -0.008), V3(0.0062, 0.004), V3(0.0058, 0.0075), V3(0.0045, 0.0095), V3(0.0022, 0.0104), V3(0, 0.0106)], 20);
  const anchors = {};
  for (const s of [1, -1]) {
    const e = add(new THREE.Object3D()); e.name = s > 0 ? 'canalL' : 'canalR';
    e.position.set(s * (ear[s].out - 0.016), ear[s].c.y - 0.006, ear[s].c.z + 0.008);
    const plug = add(new THREE.Mesh(plugGeo, plugMat), e); plug.rotation.z = -s * Math.PI / 2; plug.rotation.y = s * 0.3; plug.position.x = s * 0.0068; plug.scale.setScalar(0.85); plug.castShadow = true;
    anchors[s > 0 ? 'earL' : 'earR'] = e;
  }

  // ── cabelo longo cacheado solto (worker_head_hair.js) ──
  const body = (() => { // costas na pose de ligação: z mínimo por célula (x, y) no frame da cabeça
    const nx = 25, ny = 23, z = new Float32Array(nx * ny).fill(1e9), armRe = /(UpperArm|Forearm|Hand|Finger|Clavicle)/;
    for (const m of meshes) { const g = m.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, n = g.attributes.position.count;
      for (let i = 0; i < n; i += 1) { let bw = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; bi = SI.getComponent(i, k); } }
        const bn = m.skeleton.bones[bi]; if (headSet.has(bn) || armRe.test(bn.name)) continue;
        m.getVertexPosition(i, tmp); tmp.applyMatrix4(m.matrixWorld).applyMatrix4(rootInv).sub(O).multiplyScalar(1 / U);
        const ix = Math.round((tmp.x + 0.24) / 0.02), jy = Math.round((-tmp.y - 0.06) / 0.02);
        if (ix >= 0 && ix < nx && jy >= 0 && jy < ny && tmp.z < z[jy * nx + ix]) z[jy * nx + ix] = tmp.z; } }
    return { nx, ny, z };
  })();
  const hair = buildHair({ THREE, add, recs, skin, hw, zB, zF, T, ear, rimY: rimY - 0.013, R, body }); // casco justo: cabelo sai 13 mm mais baixo, sem atravessar a aba
  dbg.hair = hair.count;
  frame.userData.dbg = dbg;

  // ── brinco pequeno dourado (argola) no lóbulo ──
  { const gold = new THREE.MeshPhysicalMaterial({ color: 0xe8b860, metalness: 1, roughness: 0.18, clearcoat: 0.5 });
    for (const s of [1, -1]) { const lobe = skin.filter((r) => r.q.x * s > ear[s].out - 0.02 && r.q.y < ear[s].c.y - 0.012 && r.q.y > ear[s].c.y - 0.04 && Math.abs(r.q.z - ear[s].c.z) < 0.02);
      const lp = lobe.length ? lobe.reduce((a, r) => (r.q.y < a.y ? r.q : a), lobe[0].q) : V3(s * ear[s].out, ear[s].c.y - 0.03, ear[s].c.z);
      const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0009, 8, 28), gold)); ring.position.set(lp.x - s * 0.002, lp.y + 0.001, lp.z); ring.rotation.y = Math.PI / 2 + s * 0.2; ring.castShadow = true;
      const stud = add(new THREE.Mesh(new THREE.SphereGeometry(0.0016, 10, 8), gold)); stud.position.set(lp.x + s * 0.0005, lp.y + 0.005, lp.z); } }

  function update(dt, t) { hair.update(dt, t); }

  return { replaces: ['helmet', 'glasses', 'earplugs', 'hair'], update, anchors, frame, parts: { helmet, glasses, hair: hair.group }, debug: dbg };
}

// fita plana ao longo de uma curva (largura w, espessura h); side = direção preferida da normal da fita
function ribbon(THREE, curve, w, h, n, side) {
  const pos = [], idx = [], uvs = [], V = THREE.Vector3, Lc = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const u = i / n; for (const vv of [0, 1, 1, 0]) uvs.push(u * Lc / (w * 16), vv); const _u = u, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
    const nrm = side ? side.clone() : new V(p.x, 0, p.z + 0.03).normalize(); // ≈ para fora da cabeça
    nrm.sub(tg.clone().multiplyScalar(nrm.dot(tg))).normalize();
    const b = new V().crossVectors(tg, nrm).normalize();
    for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = p.clone().addScaledVector(b, sa * w / 2).addScaledVector(nrm, sb * h / 2); pos.push(q.x, q.y, q.z); }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = a + 4, d = b + 4; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
