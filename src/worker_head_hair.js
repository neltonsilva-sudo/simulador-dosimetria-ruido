// CABELO longo cacheado solto (módulo ROSTO). Cachos espirais = fitas helicoidais com alfa de muitos fios finos (instâncias),
// guias que caem da nuca (sob o capacete) até abaixo das escápulas apoiadas nas costas, mechas laterais puxadas para trás,
// fios soltos na nuca/orelha. AO por vértice (raiz/miolo do cacho) + por instância (profundidade na massa), anisotropia ao
// longo do fio, balanço com a cabeça e gravidade, ondulação leve por instância no vertex shader.
// Coordenadas do frame da cabeça: origem = meio dos olhos, m, y cima, z frente, x = esquerda dela.

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// textura de mecha: u (x do canvas) ao longo do fio; v através da mecha. RGBA (alfa = cobertura dos fios)
export function mkStrandTex(THREE, rnd) {
  const W = 1024, H = 128, [c, g] = cv(W, H);
  g.clearRect(0, 0, W, H);
  const band = g.createLinearGradient(0, 0, 0, H); // miolo semiopaco (mantém cobertura no mipmap)
  band.addColorStop(0.12, 'rgba(120,110,100,0)'); band.addColorStop(0.32, 'rgba(120,110,100,0.62)');
  band.addColorStop(0.68, 'rgba(120,110,100,0.62)'); band.addColorStop(0.88, 'rgba(120,110,100,0)');
  g.fillStyle = band; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 150; i++) {
    const t = rnd(), v = H * (0.5 + (t - 0.5) * (0.55 + 0.45 * rnd())), l = 0.72 + rnd() * 0.4, f = 0.004 + rnd() * 0.01, ph = rnd() * 6.28, amp = 1 + rnd() * 3.5;
    const edge = Math.abs(v / H - 0.5) * 2;
    g.strokeStyle = `rgba(${200 * l | 0},${188 * l | 0},${172 * l | 0},${(0.95 - edge * 0.45) * (0.6 + rnd() * 0.4)})`;
    g.lineWidth = 1.1 + rnd() * 1.6 * (1 - edge * 0.6);
    const x0 = -40 + rnd() * 80, x1 = W - rnd() * (edge > 0.6 ? 500 : 60) + 40;
    g.beginPath(); for (let x = x0; x <= x1; x += 8) { const y = v + Math.sin(x * f + ph) * amp; x === x0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8;
  return t;
}

// cacho espiral: duas fitas helicoidais (externa clara + interna escura) ao longo de −y; atributos color (AO/gradiente) e uv
export function ringletGeo(THREE, { L = 0.1, cr = 0.011, turns = 3.2, w = 0.013, seg = 44, texLen = 0.07 } = {}) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const V = THREE.Vector3, c = new V(), n = new V(), t = new V(), b = new V(), p = new V();
  const root = [0.62, 0.52, 0.45], tip = [1.12, 1.02, 0.86];
  const wob = Math.random() * 6.28;
  for (const [ph, rk, ao] of [[0, 1, 1], [Math.PI, 0.62, 0.5]]) for (const cross of [0, 1]) { // fita na superfície + fita radial (seção em cruz)
    const base = pos.length / 3; let arc = 0, prev = null;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, th = ph + u * turns * Math.PI * 2 + 0.6 * Math.sin(u * 5 + wob), r = cr * rk * (0.45 + 0.55 * Math.min(1, u * 3.5)) * (1 - 0.2 * u) * (0.85 + 0.3 * Math.sin(u * 9 + wob));
      const ax = 0.006 * Math.sin(u * Math.PI * 1.4 + wob), az = 0.005 * Math.cos(u * Math.PI * 1.1 + wob * 1.7);
      c.set(Math.cos(th) * r + ax, -u * L, Math.sin(th) * r + az); n.set(Math.cos(th), 0, Math.sin(th));
      const dth = turns * Math.PI * 2; t.set(-Math.sin(th) * r * dth, -L, Math.cos(th) * r * dth).normalize();
      b.crossVectors(n, t).normalize(); const acr = cross ? n : b;
      if (prev) arc += c.distanceTo(prev); prev = c.clone();
      const ww = w * (cross ? 0.8 : 1) * (0.55 + 0.45 * Math.min(1, u * 4)) * (1 - 0.5 * u * u * u);
      const sh = (0.5 + 0.5 * Math.min(1, u * 5)) * ao, tint = root.map((r0, k) => r0 + (tip[k] - r0) * Math.pow(u, 1.2));
      for (let k = 0; k < 3; k++) {
        const s = k - 1; p.copy(c).addScaledVector(acr, s * ww / 2);
        pos.push(p.x, p.y, p.z); const nn = n.clone().addScaledVector(b, cross ? 0 : s * 0.3).normalize(); nor.push(nn.x, nn.y, nn.z);
        uv.push(arc / texLen + cross * 0.31, 0.5 + s * 0.5); const e = k === 1 ? 1 : 0.85; col.push(tint[0] * sh * e, tint[1] * sh * e, tint[2] * sh * e);
      }
    }
    for (let i = 0; i < seg; i++) for (let k = 0; k < 2; k++) { const a = base + i * 3 + k, d = a + 3; idx.push(a, d, a + 1, a + 1, d, d + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeBoundingSphere(); return g;
}

export function buildHair({ THREE, add, recs, skin, hw, zB, zF, T, ear, rimY, R, body }) {
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const zc = (zF + zB) / 2;
  const group = new THREE.Group(); group.name = 'cabelo';
  add(group);
  // ── mapa radial do crânio (bins ângulo × altura), raio horizontal máximo em torno de (0, zc) ──
  const NA = 48, Y0 = -0.14, NY = 30, DY = 0.01, rad = new Float32Array(NA * NY);
  for (const r of skin) { const q = r.q, j = Math.floor((q.y - Y0) / DY); if (j < 0 || j >= NY) continue;
    const a = Math.atan2(q.x, q.z - zc), i = ((Math.round(a / (Math.PI * 2) * NA) % NA) + NA) % NA, d = Math.hypot(q.x, q.z - zc);
    if (d > rad[j * NA + i]) rad[j * NA + i] = d; }
  for (let pass = 0; pass < 4; pass++) for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) if (!rad[j * NA + i]) {
    const nb = [rad[j * NA + (i + 1) % NA], rad[j * NA + (i + NA - 1) % NA], j > 0 ? rad[(j - 1) * NA + i] : 0, j < NY - 1 ? rad[(j + 1) * NA + i] : 0].filter((v) => v);
    if (nb.length) rad[j * NA + i] = nb.reduce((a, b) => a + b) / nb.length; }
  const skullR = (a, y) => { const fi = (a / (Math.PI * 2)) * NA, fj = Math.min(NY - 1.001, Math.max(0, (y - Y0) / DY - 0.5));
    const i0 = Math.floor(fi), j0 = Math.floor(fj), ti = fi - i0, tj = fj - j0, I = (i) => ((i % NA) + NA) % NA;
    const g = (i, j) => rad[j * NA + I(i)] || 0.08;
    return (g(i0, j0) * (1 - ti) + g(i0 + 1, j0) * ti) * (1 - tj) + (g(i0, j0 + 1) * (1 - ti) + g(i0 + 1, j0 + 1) * ti) * tj; };
  const onSkull = (a, y, off) => { const r = skullR(a, y) + off; return V3(Math.sin(a) * r, y, zc + Math.cos(a) * r); };

  // ── materiais ──
  const tex = mkStrandTex(THREE, R);
  const uT = { value: 0 };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: tex, vertexColors: true, alphaTest: 0.34, side: THREE.DoubleSide,
    roughness: 0.55, specularIntensity: 0.22, specularColor: new THREE.Color(0xd09a68), envMapIntensity: 0.35,
    sheen: 0.3, sheenColor: new THREE.Color(0x6a3c1c), sheenRoughness: 0.5 });
  mat.onBeforeCompile = (sh) => { sh.uniforms.uT = uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { float k = clamp(-position.y / 0.11, 0.0, 1.6); float ph = float(gl_InstanceID) * 1.731;
        transformed.x += k * k * 0.0035 * sin(uT * 1.3 + ph); transformed.z += k * k * 0.0035 * cos(uT * 1.07 + ph * 1.37); }
      #endif`); };
  mat.customProgramCacheKey = () => 'hairR5';
  const depthMat = new THREE.MeshDepthMaterial({ map: tex, alphaTest: 0.34, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });

  // ── variantes de cacho ──
  const variants = [
    ringletGeo(THREE, { L: 0.10, cr: 0.0125, turns: 2.6, w: 0.0095, seg: 40 }),
    ringletGeo(THREE, { L: 0.12, cr: 0.015, turns: 2.9, w: 0.0105, seg: 44 }),
    ringletGeo(THREE, { L: 0.085, cr: 0.0105, turns: 2.3, w: 0.0085, seg: 32 }),
  ];
  const MAX = 1100, per = Math.ceil(MAX / 3) + 4;
  const ims = variants.map((g) => { const im = new THREE.InstancedMesh(g, mat, per); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
    im.customDepthMaterial = depthMat; im.userData.noBloom = true; return im; });
  const cascade = new THREE.Group(); cascade.name = 'cascata'; group.add(cascade);
  const pivot = V3(0, rimY - 0.03, zB + 0.01); cascade.position.copy(pivot); // pivô do balanço (nuca sob o capacete)
  ims.forEach((im) => cascade.add(im));
  const placed = []; // {v, m(pos), q, s, light}
  const down = V3(0, -1, 0), qq = new THREE.Quaternion(), qa = new THREE.Quaternion();
  const put = (pos, dir, s, light, vi = Math.floor(R() * 3)) => {
    qq.setFromUnitVectors(down, dir.clone().normalize()); qa.setFromAxisAngle(down, R() * 6.283); qq.multiply(qa);
    placed.push({ vi, p: pos.clone().sub(pivot), q: qq.clone(), s, light });
  };

  // costas (pose de ligação): z mínimo do corpo por (x, y) — o cabelo pousa sobre as costas/colete, não atravessa
  const backZ = (x, y) => { if (!body) return -1; const i = Math.round((x + 0.24) / 0.02), j = Math.round((-y - 0.06) / 0.02);
    if (i < 0 || i >= body.nx || j < 0 || j >= body.ny) return -1; const v = body.z[j * body.nx + i]; return v === 1e9 ? -1 : v; };

  // ── guias da cascata ──
  const HAIR_K = +(new URLSearchParams(location.search).get('hlen') || 0.45); // comprimento (1 = abaixo das escápulas; 0,6 = ombros; 0,45 = acima dos ombros)
  const NG = 190;
  const JUNTO = +(new URLSearchParams(location.search).get('hjunto') ?? 1); // 1 = cabelo mais junto (mechas convergem para a nuca); 0 = volume solto antigo
  for (let gI = 0; gI < NG; gI++) {
    const side = R() < 0.5 ? -1 : 1, spread = Math.pow(R(), 0.8);
    const a = side * (Math.PI - spread * (Math.PI - 1.8)); // 103°..180° (atrás da orelha até a nuca)
    const yTop = rimY - 0.02 - (1 - spread) * 0.035, yBot = -0.075 + spread * 0.04;
    const y = yBot + (yTop - yBot) * Math.pow(R(), 0.7);
    let p = onSkull(a, y, 0.006);
    const out = V3(Math.sin(a), 0, Math.cos(a));
    let d = out.clone().multiplyScalar(JUNTO ? 0.18 + R() * 0.12 : 0.55 + R() * 0.3).add(V3(0, -0.85, 0)).normalize();
    const Lg = (0.12 + R() * 0.13 + (1 - spread) * 0.05) * HAIR_K, step = 0.012, pts = [p.clone()];
    for (let s = 0; s * step < Lg; s++) {
      if (JUNTO) d.add(V3(0, -0.11, 0)).add(out.clone().multiplyScalar(p.y > -0.1 ? 0.03 : -0.05)).add(V3(-p.x * 0.9, 0, (zc - 0.07 - p.z) * 0.5)).add(V3((R() - 0.5) * 0.03, 0, (R() - 0.5) * 0.03)).normalize(); // converge para a nuca
      else d.add(V3(0, -0.11, 0)).add(out.clone().multiplyScalar(p.y > -0.12 ? 0.1 : -0.01)).add(V3(side < 0 && p.y > -0.2 ? -0.05 : 0, 0, 0)).add(V3((R() - 0.5) * 0.06, 0, (R() - 0.5) * 0.06)).normalize();
      p = p.clone().addScaledVector(d, step);
      const hr = Math.hypot(p.x, p.z - zc), sk = skullR(Math.atan2(p.x, p.z - zc), p.y);
      if (p.y > -0.11 && hr < sk + 0.008) { const k = (sk + 0.008) / hr; p.x *= k; p.z = zc + (p.z - zc) * k; }
      const bz = backZ(p.x, p.y); if (bz > -1 && p.z > bz - 0.018) p.z = bz - 0.018;
      pts.push(p.clone());
    }
    // cachos ao longo da guia
    let acc = 0, i = 0; const light = Math.pow(R(), 1.6);
    while (i < pts.length - 1) {
      const sc = (0.75 + R() * 0.45) * (JUNTO ? 0.88 : 1), segL = 0.075 * sc; const a0 = pts[i];
      let j = i; while (j < pts.length - 1 && pts[j].distanceTo(a0) < segL) j++;
      const dir = pts[j].clone().sub(a0); if (dir.lengthSq() < 1e-8) break; const J = JUNTO ? 0.38 : 0.7; dir.normalize().add(V3((R() - 0.5) * J, (R() - 0.5) * 0.3, (R() - 0.5) * J));
      const jit = V3((R() - 0.5) * 0.01, 0, (R() - 0.5) * 0.01).multiplyScalar(JUNTO ? 0.5 : 1);
      put(a0.clone().add(jit), dir, sc * (acc === 0 ? 0.8 : 1), light * (0.6 + 0.4 * acc / Lg) + (acc / Lg) * 0.25);
      acc += segL; i = j === i ? i + 1 : j;
    }
  }
  // camada de cobertura logo abaixo da aba (cabelo sai de baixo do capacete, sem couro cabeludo à mostra)
  for (let k = 0; k < 90; k++) {
    const s = R() < 0.5 ? -1 : 1, a = s * (1.75 + R() * (Math.PI - 1.75)), y = rimY - 0.035 + R() * 0.04;
    const p = onSkull(a, y, 0.005), o = V3(Math.sin(a), 0, Math.cos(a));
    put(p, o.multiplyScalar(0.25 + R() * 0.2).add(V3((R() - 0.5) * 0.2, -1, (R() - 0.5) * 0.2)), 0.5 + R() * 0.3, 0.15 + R() * 0.3);
  }
  // cachos curtos soltos: atrás da orelha e na nuca (fios que escapam do capacete)
  for (let k = 0; k < 36; k++) {
    const s = R() < 0.5 ? -1 : 1, nape = R() < 0.45;
    const a = s * (nape ? Math.PI - R() * 0.7 : 1.75 + R() * 0.35), y = nape ? -0.06 - R() * 0.04 : ear[s].c.y + 0.02 + R() * 0.02;
    const p = onSkull(a, y, 0.004), o = V3(Math.sin(a), 0, Math.cos(a));
    put(p, o.multiplyScalar(0.35).add(V3((R() - 0.5) * 0.3, -1, (R() - 0.5) * 0.3)), 0.38 + R() * 0.25, R() * 0.6, 2);
  }
  // AO por instância: distância ao eixo da massa (miolo escuro, superfície clara)
  const cen = new Map(); for (const it of placed) { const k = Math.round(it.p.y / 0.03); const e = cen.get(k) || [0, 0, 0, 0]; e[0] += it.p.x; e[1] += it.p.z; e[2]++; cen.set(k, e); }
  const col = new THREE.Color(), m4 = new THREE.Matrix4();
  const tones = [[0.26, 0.155, 0.09], [0.4, 0.24, 0.13], [0.56, 0.36, 0.19], [0.7, 0.49, 0.27]]; // castanho → caramelo → mel (sRGB)
  let maxD = 0; for (const it of placed) { const e = cen.get(Math.round(it.p.y / 0.03)); it.d = Math.hypot(it.p.x - e[0] / e[2], it.p.z - e[1] / e[2]); maxD = Math.max(maxD, it.d); }
  for (const it of placed) {
    const im = ims[it.vi]; if (im.count >= per) continue;
    m4.compose(it.p, it.q, V3(it.s, it.s * (0.9 + R() * 0.25), it.s)); im.setMatrixAt(im.count, m4);
    const outer = Math.min(1, it.d / (maxD * 0.55 + 1e-3)), ao = 0.42 + 0.58 * Math.pow(outer, 0.8);
    const L = Math.min(0.999, it.light * 0.85 + R() * 0.25), f = L * 3, i0 = Math.floor(f), t = f - i0, A = tones[i0], B = tones[Math.min(3, i0 + 1)];
    col.setRGB((A[0] + (B[0] - A[0]) * t) * ao, (A[1] + (B[1] - A[1]) * t) * ao, (A[2] + (B[2] - A[2]) * t) * ao, THREE.SRGBColorSpace);
    im.setColorAt(im.count, col); im.count++;
  }
  ims.forEach((im) => { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; });

  // ── miolo escuro (evita ver através da massa) ──
  {
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x1e130c, roughness: 0.95 }); const coreGeo = new THREE.SphereGeometry(1, 18, 12);
    const byY = [...cen.entries()].sort((a, b) => b[0] - a[0]);
    const CORE = new URLSearchParams(location.search).get('hcore') || 'off'; // padrão: sem miolo (os discos escuros apareciam sob os cachos); 'top' ou 'full' para testar
    for (const [k, e] of byY) { const y = k * 0.03; if (y > -0.01 || y < (CORE === 'full' ? -0.3 : -0.1) || CORE === 'off') continue;
      const pts = placed.filter((it) => Math.round(it.p.y / 0.03) === k);
      const cx = e[0] / e[2], cz = e[1] / e[2];
      const sx = Math.max(0.015, Math.sqrt(pts.reduce((a, it) => a + (it.p.x - cx) ** 2, 0) / pts.length)), sz = Math.max(0.012, Math.sqrt(pts.reduce((a, it) => a + (it.p.z - cz) ** 2, 0) / pts.length));
      const m = new THREE.Mesh(coreGeo, coreMat); m.scale.set(sx * 0.6, 0.05, sz * 0.55); m.position.set(cx, y - 0.04, cz); m.castShadow = true; cascade.add(m); } // menor que a massa de cachos e sobreposto (sem bordas à vista)
  }

  // ── mechas laterais puxadas para trás, sob a aba (têmpora → acima da orelha → nuca) ──
  {
    const pos = [], nor = [], uv = [], colA = [], idx = [];
    for (const s of [-1, 1]) {
      const yLo = ear[s].c.y + 0.026, yHi = rimY + 0.012;
      for (let row = 0, y = yLo; y <= yHi; y += 0.0075, row++) {
        const a0 = 1.2 + 0.3 * (yHi - y) / (yHi - yLo) + R() * 0.08, a1 = 2.5 + R() * 0.3, n = 40, base = pos.length / 3, w = 0.013;
        let arc = 0, prev = null;
        for (let i = 0; i <= n; i++) {
          const u = i / n, a = a0 + (a1 - a0) * u, yy = y - 0.012 * u * u + 0.0015 * Math.sin(u * 17 + row);
          const c = onSkull(s * a, yy, 0.0028 + 0.0012 * (row % 3)), o = V3(Math.sin(s * a), 0, Math.cos(s * a));
          if (prev) arc += c.distanceTo(prev); prev = c;
          const ww = w * Math.min(1, u * 6 + 0.25);
          for (const k of [-1, 1]) { pos.push(c.x, c.y + k * ww / 2, c.z); nor.push(o.x, o.y + 0.2, o.z); uv.push(arc / 0.09 + row * 0.37, 0.5 + k * 0.5);
            const l = (0.7 + 0.4 * R()) * (0.55 + 0.45 * Math.min(1, u * 3)); colA.push(0.3 * l, 0.19 * l, 0.115 * l); }
        }
        for (let i = 0; i < n; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3)); g.setIndex(idx);
    const sideM = new THREE.Mesh(g, mat); sideM.name = 'mechas_laterais'; sideM.receiveShadow = true; sideM.visible = false; // (cartões planos pareciam tábuas)
  }

  // ── fios soltos (frizz) na nuca, perto da orelha e na superfície da cascata ──
  {
    const fp = [], fc = [];
    const wisp = (p, d, L) => { let c = p.clone(); const k0 = R() * 6; const l = 0.5 + R() * 0.6;
      for (let j = 0; j < 7; j++) { const n = c.clone().addScaledVector(d, L / 7).add(V3(Math.sin(k0 + j * 2.1), Math.cos(k0 + j * 1.7), Math.sin(k0 + j * 2.7)).multiplyScalar(0.0022));
        fp.push(c.x, c.y, c.z, n.x, n.y, n.z); for (let q = 0; q < 2; q++) fc.push(0.4 * l, 0.25 * l, 0.14 * l); c = n; } };
    const JW = +(new URLSearchParams(location.search).get('hjunto') ?? 1);
    for (let i = 0; i < (JW ? 30 : 70); i++) { const s = R() < 0.5 ? -1 : 1, a = s * (1.9 + R() * 1.2), y = ear[s].c.y + 0.04 - R() * 0.12;
      wisp(onSkull(a, y, 0.006), V3(Math.sin(a) * 0.5 + (R() - 0.5), -0.6 - R(), Math.cos(a) * 0.5 + (R() - 0.5)).normalize(), 0.015 + R() * 0.035); }
    for (let i = 0; i < (JW ? 260 : 700); i++) { const it = placed[Math.floor(R() * placed.length)]; const p = it.p.clone().add(pivot);
      wisp(p, V3((R() - 0.5), -0.4 - R(), (R() - 0.5)).normalize(), (0.012 + R() * 0.03) * (JW ? 0.6 : 1)); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
    const frizz = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false }));
    frizz.frustumCulled = false; frizz.userData.noBloom = true; group.add(frizz);
  }

  // ── balanço: gravidade (a cascata tende a ficar a prumo) + mola com o giro da cabeça ──
  const qW = new THREE.Quaternion(), dL = V3(), e3 = new THREE.Euler(), qS = new THREE.Quaternion(), qG = new THREE.Quaternion();
  let sway = 0, swayV = 0, lastY = null;
  function update(dt, t) {
    uT.value = t;
    if (!dt) return;
    cascade.parent.getWorldQuaternion(qW);
    dL.set(0, -1, 0).applyQuaternion(qW.clone().invert());           // "baixo" do mundo no frame da cabeça
    qG.setFromUnitVectors(down, down.clone().lerp(dL, 0.75).normalize());
    e3.setFromQuaternion(qW, 'YXZ');
    if (lastY != null) { let dy = e3.y - lastY; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI; swayV += -dy * 25; }
    lastY = e3.y; swayV += (-sway * 38 - swayV * 5.5) * dt; sway += swayV * dt;
    qS.setFromEuler(e3.set(0.025 * Math.sin(t * 1.1), 0, sway * 0.4 + 0.015 * Math.sin(t * 0.8)));
    cascade.quaternion.copy(qG).multiply(qS);
  }
  return { group, cascade, update, count: placed.length };
}
