// MATERIAIS do avatar Tripo (assets/operadora/modelo_mulher_operadora_rig.glb) — dono: MATERIAIS TRIPO.
// worker_tripo.js chama: const up = await (await import('./worker_tripo_mat.js')).upgradeTripo({ THREE, stage, app, root, skinned, bones, headBone })
//   → { update(dt, t), hide: ['ponytail', 'glasses'], parts, debug }
// O que faz (sem tocar esqueleto/skinning): 1 material físico com regiões por cor do atlas + categoria de osso
// (pele c/ wrap/sheen + poros; camisa crepe; colete de tela c/ furos + faixas refletivas; capacete ABS c/ clearcoat;
// luvas de malha tricotada; calça de sarja), atlas aguçado (unsharp), anisotropia máxima. Óculos colados e rabo curto
// vão para um grupo de índice com material invisível; óculos reais + cabelo cacheado longo + plugs vêm de worker_head.js
// (buildHead sobre uma malha-proxy filtrada, com eixos/unidades convertidos para o frame que ele espera).
import { buildHead } from './worker_head.js';
import { uvMask, dilate, toCanvas } from './worker_tripo_mat_atlas.js';

const CAT = { body: 0, head: 1, hand: 2, leg: 3 };

export async function upgradeTripo({ THREE, stage, app, root, skinned, bones, headBone }) {
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  if (!skinned) root.traverse((o) => { if (!skinned && o.isSkinnedMesh) skinned = o; });
  headBone = headBone || skinned.skeleton.bones.find((b) => /Head$/.test(b.name));
  root.updateMatrixWorld(true);
  const G = skinned.geometry, P = G.attributes.position, UV = G.attributes.uv, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, N = P.count;
  const mat0 = [].concat(skinned.material)[0];
  const dbg = {};

  // ── atlas de cor: máscara exata das ilhas UV + dilatação (mata o contorno escuro do fundo do atlas) + unsharp + AO de pele ──
  const img = mat0.map.image, W = img.width, H = img.height;
  const { c: cv, x: cx, id: src } = toCanvas(img); const D = src.data;
  const t0 = performance.now();
  const MALL = uvMask(UV, G.index.array, W, H, true);
  dilate(D, W, H, MALL, 28);
  { // debrum preto do colete: no atlas tem ~2× a largura real → afina 2 px do lado do colete (tela laranja/amarela avança)
    const isV = (o) => { const r = D[o], g = D[o + 1], b = D[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx > 190 && (mx - mn) / mx > 0.62 && r >= g && r > b * 1.6; };
    const V = new Uint8Array(W * H); for (let i = 0; i < V.length; i++) V[i] = isV(i * 4) ? 1 : 0;
    const ch = []; let n = 0;
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x, o = i * 4; if (Math.max(D[o], D[o + 1], D[o + 2]) >= 95 || !MALL[i]) continue;
      let best = -1, bd = 9; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = i + dy * W + dx; if (V[j]) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = j; } } }
      if (best >= 0) ch.push(i, best); }
    for (let q = 0; q < ch.length; q += 2) { const o = ch[q] * 4, s2 = ch[q + 1] * 4; D[o] = D[s2]; D[o + 1] = D[s2 + 1]; D[o + 2] = D[s2 + 2]; n++; }
    dbg.trimThin = n;
  }
  cx.putImageData(src, 0, 0);
  {
    const blur = (r) => { const bc = document.createElement('canvas'); bc.width = W; bc.height = H; const bx = bc.getContext('2d'); bx.filter = `blur(${r}px)`; bx.drawImage(cv, 0, 0); return bx.getImageData(0, 0, W, H).data; };
    const B = blur(1.4), B6 = blur(5);
    for (let i = 0; i < D.length; i += 4) {
      const r = D[i], g = D[i + 1], b = D[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
      const isSkin = mx >= 95 && sat >= 0.2 && sat < 0.66 && r >= b && r > g;
      const amt = isSkin ? 0.75 : 0.18;
      for (let c = 0; c < 3; c++) { const d = D[i + c] - B[i + c]; D[i + c] = D[i + c] + amt * (Math.abs(d) < 2 ? 0 : d); }
      if (isSkin) { // cavidades (nariz/lábios/pálpebras): onde a pele é mais escura que a vizinhança → AO suave + leve rubor
        const L = 0.3 * r + 0.59 * g + 0.11 * b, Lb = 0.3 * B6[i] + 0.59 * B6[i + 1] + 0.11 * B6[i + 2];
        const cav = Math.min(1, Math.max(0, (Lb - L) / Math.max(Lb, 1)) * 3.0);
        D[i] *= 1 - 0.22 * cav; D[i + 1] *= 1 - 0.32 * cav; D[i + 2] *= 1 - 0.34 * cav;
      }
      else if (mx >= 95) { // tecido claro (camisa/colete): sombras de dobra pintadas no atlas → reforço suave
        const L = 0.3 * r + 0.59 * g + 0.11 * b, Lb = 0.3 * B6[i] + 0.59 * B6[i + 1] + 0.11 * B6[i + 2];
        const cav = Math.min(1, Math.max(0, (Lb - L) / Math.max(Lb, 1)) * 2.5); const f = 1 - 0.2 * cav;
        D[i] *= f; D[i + 1] *= f; D[i + 2] *= f * 1.02;
      }
      D[i + 3] = 255;
    }
    cx.putImageData(src, 0, 0);
  }
  const px = (u, v) => { const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))), y = Math.min(H - 1, Math.max(0, Math.floor(v * H))); const o = (y * W + x) * 4; return [D[o], D[o + 1], D[o + 2]]; };
  const cls = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
    if (mx < 95) return 'dark'; if (s < 0.2) return mx > 214 ? 'white' : 'grey';
    if (s > 0.68 && r > 190 && g / r > 0.72) return 'yellow'; if (s > 0.66 && r > 190) return 'orange'; return 'skin'; };

  // ── categoria de osso dominante por vértice ──
  const boneCat = skinned.skeleton.bones.map((b) => /Head|Neck/.test(b.name) ? (/Neck/.test(b.name) ? CAT.body : CAT.head) : /Hand|Finger/.test(b.name) ? CAT.hand : /Thigh|Calf|Foot|Toe|Pelvis/.test(b.name) ? CAT.leg : CAT.body);
  const headIdx = skinned.skeleton.bones.indexOf(headBone);
  const domBone = new Int16Array(N), aCat = new Float32Array(N);
  for (let i = 0; i < N; i++) { let bw = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; bi = SI.getComponent(i, k); } } domBone[i] = bi; aCat[i] = boneCat[bi]; }
  G.setAttribute('aCat', new THREE.BufferAttribute(aCat, 1));

  // ── eixos do corpo em repouso (espaço local da malha): cima = +y; frente = do centro da cabeça para a pele do rosto ──
  G.computeBoundingBox(); const bb = G.boundingBox, HM = bb.max.y - bb.min.y, y0 = bb.min.y;
  const k = 1.66 / HM; // metros por unidade da malha (mulher ~1,63 m + casco)
  const hc = V3(), sc = V3(); let nh = 0, ns = 0; const t3 = V3();
  for (let i = 0; i < N; i++) if (domBone[i] === headIdx) { t3.fromBufferAttribute(P, i); hc.add(t3); nh++; if (cls(px(UV.getX(i), UV.getY(i))) === 'skin') { sc.add(t3); ns++; } }
  hc.multiplyScalar(1 / nh); sc.multiplyScalar(1 / Math.max(1, ns));
  const F = V3(sc.x - hc.x, 0, sc.z - hc.z).normalize();
  const fr = (p) => (p.x - hc.x) * F.x + (p.z - hc.z) * F.z; // coordenada "à frente" do centro da cabeça
  const yr = (p) => (p.y - y0) / HM;

  // ── classificação por triângulo (amostras nos 3 vértices + centróide) → óculos colados / rabo curto ──
  const idx = G.index.array, keep = [], hideG = [], hideP = [], tA = V3(), tB = V3(), tC = V3(), cen = V3();
  let faceFront = -1e9; for (let i = 0; i < N; i++) if (domBone[i] === headIdx) { t3.fromBufferAttribute(P, i); const y = yr(t3); if (y > 0.86 && y < 0.93) faceFront = Math.max(faceFront, fr(t3)); }
  const GT = +(new URLSearchParams(location.search).get('gt') || 0);
  const gl = []; // centróides dos óculos (para os olhos)
  const lensT = []; // triângulos mantidos na faixa dos olhos (cascas-lente com olhos pintados)
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const head = domBone[a] === headIdx || domBone[b] === headIdx || domBone[c] === headIdx;
    if (!head) { keep.push(a, b, c); continue; }
    tA.fromBufferAttribute(P, a); tB.fromBufferAttribute(P, b); tC.fromBufferAttribute(P, c); cen.copy(tA).add(tB).add(tC).multiplyScalar(1 / 3);
    const cs = [a, b, c].map((v) => cls(px(UV.getX(v), UV.getY(v))));
    cs.push(cls(px((UV.getX(a) + UV.getX(b) + UV.getX(c)) / 3, (UV.getY(a) + UV.getY(b) + UV.getY(c)) / 3)));
    const cnt = (n) => cs.filter((x) => x === n).length;
    const y = yr(cen), f = fr(cen) / HM;
    const greyish = (cnt('grey') + cnt('white') >= 3 && cnt('white') <= 2) || (cnt('grey') + cnt('white') >= 2 && y < 0.93 && y > 0.87);
    if (greyish && y > 0.87 && y < 0.937 && f > 0.015) { hideG.push(a, b, c); gl.push(cen.clone()); continue; }
    if (GT > 0 && cnt('dark') < 2 && y > 0.905 && y < 0.937 && f > GT) { hideG.push(a, b, c); continue; }
    if (cnt('dark') >= 3 && f < 0.0 && y < 0.925 && y > 0.80) { hideP.push(a, b, c); continue; }
    if (y > 0.865 && y < 0.932 && f > 0.01 && cnt('skin') + cnt('dark') >= 2) lensT.push(a, b, c);
    keep.push(a, b, c);
  }
  dbg.hidden = { glasses: hideG.length / 3, ponytail: hideP.length / 3 };
  // ── lascas brancas pintadas dentro das cascas-lente → inpainting com a pele/olho em volta (brilhos pequenos ficam) ──
  {
    const LM = uvMask(UV, lensT, W, H, false), hole = new Uint8Array(W * H);
    for (let i = 0; i < LM.length; i++) if (LM[i]) { const o = i * 4, r = D[o], g = D[o + 1], b = D[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx > 150 && (mx - mn) / mx < 0.24) hole[i] = 1; }
    // abertura: só manchas grandes (catchlights de 2–3 px do olho pintado ficam)
    const big = new Uint8Array(W * H); let nh = 0;
    for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) { const i = y * W + x; if (!hole[i]) continue; let n = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) n += hole[i + dy * W + dx];
      if (n >= 22) { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) big[i + dy * W + dx] = 1; } }
    for (let i = 0; i < big.length; i++) if (big[i] && LM[i]) nh++; else big[i] = 0;
    const valid = new Uint8Array(W * H); for (let i = 0; i < valid.length; i++) valid[i] = big[i] ? 0 : 1;
    dilate(D, W, H, valid, 60, big);
    dbg.lensInpaint = nh;
    cx.putImageData(src, 0, 0);
  }
  dbg.atlasMs = Math.round(performance.now() - t0);
  // olhos: centro dos óculos colados, um pouco atrás das lentes
  let eyeY = y0 + 0.909 * HM, eyeF = faceFront - 0.012 * HM;
  if (gl.length > 6) { const m = gl.reduce((s, p) => s.add(p), V3()).multiplyScalar(1 / gl.length); eyeY = m.y - 0.015 * HM; eyeF = Math.min(fr(m) - 0.012 * HM, faceFront - 0.008 * HM); }
  const SIDE = V3(F.z, 0, -F.x); // esquerda dela (cima × frente)
  const eyeMid = V3(hc.x + F.x * eyeF, eyeY, hc.z + F.z * eyeF);

  // ── normal map e ORM: mesma dilatação das ilhas (sem sangrar o fundo plano nas costuras) ──
  const dilTex = (tx) => { if (!tx?.image) return tx; try { const { c, x, id } = toCanvas(tx.image); dilate(id.data, c.width, c.height, c.width === W && c.height === H ? MALL : uvMask(UV, G.index.array, c.width, c.height, true), 20); x.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = tx.flipY; t.colorSpace = tx.colorSpace; t.wrapS = tx.wrapS; t.wrapT = tx.wrapT; t.channel = tx.channel; return t; } catch (e) { return tx; } };
  const nMap = dilTex(mat0.normalMap), rMap = mat0.roughnessMap === mat0.metalnessMap ? dilTex(mat0.roughnessMap) : dilTex(mat0.roughnessMap), mMap = mat0.roughnessMap === mat0.metalnessMap ? rMap : dilTex(mat0.metalnessMap);
  // ── capacete: normais suavizadas só na região do casco (soldagem por posição + 2 passes laplacianos; posições/skinning intactos) ──
  {
    const NR = G.attributes.normal, isH = new Uint8Array(N);
    for (let t = 0; t < keep.length; t += 3) { const a = keep[t], b = keep[t + 1], c = keep[t + 2]; if (domBone[a] !== headIdx && domBone[b] !== headIdx && domBone[c] !== headIdx) continue;
      const cc = cls(px((UV.getX(a) + UV.getX(b) + UV.getX(c)) / 3, (UV.getY(a) + UV.getY(b) + UV.getY(c)) / 3));
      tA.fromBufferAttribute(P, a); tB.fromBufferAttribute(P, b); tC.fromBufferAttribute(P, c); cen.copy(tA).add(tB).add(tC).multiplyScalar(1 / 3);
      if ((cc === 'white' || cc === 'grey') && yr(cen) > 0.928) { isH[a] = isH[b] = isH[c] = 1; } }
    const q = 1e-4 * HM, key = new Int32Array(N).fill(-1), km = new Map(); let nk = 0;
    for (let i = 0; i < N; i++) if (isH[i]) { const kk = `${Math.round(P.getX(i) / q)},${Math.round(P.getY(i) / q)},${Math.round(P.getZ(i) / q)}`; let v = km.get(kk); if (v === undefined) { v = nk++; km.set(kk, v); } key[i] = v; }
    const acc = new Float32Array(nk * 3), nb = Array.from({ length: nk }, () => new Set()), ab = V3(), ac = V3(), fn = V3();
    for (let t = 0; t < keep.length; t += 3) { const a = keep[t], b = keep[t + 1], c = keep[t + 2]; if (!(isH[a] && isH[b] && isH[c])) continue;
      tA.fromBufferAttribute(P, a); tB.fromBufferAttribute(P, b); tC.fromBufferAttribute(P, c); fn.crossVectors(ab.subVectors(tB, tA), ac.subVectors(tC, tA));
      for (const v of [a, b, c]) { const kk = key[v]; acc[kk * 3] += fn.x; acc[kk * 3 + 1] += fn.y; acc[kk * 3 + 2] += fn.z; }
      const ka = key[a], kb = key[b], kc = key[c]; nb[ka].add(kb).add(kc); nb[kb].add(ka).add(kc); nb[kc].add(ka).add(kb); }
    let cur = acc; const nrm = (A) => { for (let j = 0; j < nk; j++) { const l = Math.hypot(A[j * 3], A[j * 3 + 1], A[j * 3 + 2]) || 1; A[j * 3] /= l; A[j * 3 + 1] /= l; A[j * 3 + 2] /= l; } };
    nrm(cur);
    for (let pass = 0; pass < 6; pass++) { const nx = new Float32Array(nk * 3);
      for (let j = 0; j < nk; j++) { let x = cur[j * 3] * 2, y = cur[j * 3 + 1] * 2, z = cur[j * 3 + 2] * 2; for (const m of nb[j]) { x += cur[m * 3]; y += cur[m * 3 + 1]; z += cur[m * 3 + 2]; } nx[j * 3] = x; nx[j * 3 + 1] = y; nx[j * 3 + 2] = z; }
      nrm(nx); cur = nx; }
    // casco = domo: normal do elipsoide ajustado (reflexo do clearcoat limpo); pala/aba fica com a normal suavizada
    const ec = V3(), emn = V3(1e9, 1e9, 1e9), emx = V3(-1e9, -1e9, -1e9); let ne = 0;
    for (let i = 0; i < N; i++) if (isH[i]) { t3.fromBufferAttribute(P, i); if (yr(t3) > 0.945) { emn.min(t3); emx.max(t3); ne++; } }
    ec.addVectors(emn, emx).multiplyScalar(0.5); const er = V3().subVectors(emx, emn).multiplyScalar(0.5); er.y *= 2; ec.y = emn.y; // domo: centro na base
    const en = V3(), cn = V3();
    let nh = 0; for (let i = 0; i < N; i++) if (isH[i] && key[i] >= 0) { const j = key[i]; if (Math.hypot(acc[j * 3], acc[j * 3 + 1], acc[j * 3 + 2]) < 0.5) continue;
      cn.set(cur[j * 3], cur[j * 3 + 1], cur[j * 3 + 2]); t3.fromBufferAttribute(P, i);
      if (ne > 20) { en.set((t3.x - ec.x) / (er.x * er.x), (t3.y - ec.y) / (er.y * er.y), (t3.z - ec.z) / (er.z * er.z)).normalize();
        const w = THREE.MathUtils.smoothstep(yr(t3), 0.94, 0.958) * THREE.MathUtils.smoothstep(en.dot(cn), 0.2, 0.7) * 0.85; cn.lerp(en, w).normalize(); }
      NR.setXYZ(i, cn.x, cn.y, cn.z); nh++; }
    NR.needsUpdate = true; dbg.helmetSmooth = nh;
  }
  // ── material físico único com regiões ──
  const aniso = stage?.renderer?.capabilities?.getMaxAnisotropy?.() || 16;
  const map = new THREE.CanvasTexture(cv); map.flipY = false; map.colorSpace = THREE.SRGBColorSpace;
  for (const tx of [map, nMap, rMap, mMap]) if (tx) { tx.anisotropy = aniso; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.magFilter = THREE.LinearFilter; tx.needsUpdate = true; }
  const mat = new THREE.MeshPhysicalMaterial({
    name: 'tripo_regions', map, normalMap: nMap, normalScale: new THREE.Vector2(1, 1), roughnessMap: rMap, metalnessMap: mMap,
    aoMap: null, roughness: 1, metalness: 0, sheen: 1, sheenColor: new THREE.Color(1, 1, 1), sheenRoughness: 0.55,
    clearcoat: 1, clearcoatRoughness: 0.07, specularIntensity: 0.55, side: THREE.FrontSide,
  });
  const U = { uHC: { value: hc.clone().multiplyScalar(k) }, uFw: { value: F.clone() }, uSd: { value: V3(F.z, 0, -F.x) }, uFace: { value: faceFront * k }, uY0: { value: y0 * k }, uK: { value: k }, uDbg: { value: +(new URLSearchParams(location.search).get('tripodbg') || 0) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCat; varying float vCat; varying vec3 vRest; uniform float uK;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCat = aCat; vRest = position * uK;');
    const lp = THREE.ShaderChunk.lights_physical_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;',
      `float wNL = saturate( ( dot( geometryNormal, directLight.direction ) + 0.5 ) / 1.5 );
       vec3 irradiance = directLight.color * ( dotNL + gSkin * ( max( wNL - dotNL, 0.0 ) * vec3( 1.0, 0.40, 0.26 ) * 1.15 + dotNL * ( 1.0 - dotNL ) * vec3( 0.10, -0.02, -0.04 ) ) );`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vCat; varying vec3 vRest; uniform float uDbg; uniform vec3 uHC, uFw, uSd; uniform float uFace, uY0;
        float gHead = 0.0, gTz = 0.0, gBoot = 0.0, gFoldH = 0.0, gFoldV = 0.0;
        float gSkin = 0.0, gHelm = 0.0, gShirt = 0.0, gVest = 0.0, gRefl = 0.0, gGlove = 0.0, gPant = 0.0, gHair = 0.0, gTrim = 0.0;
        float h3( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float n3( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( h3( i ), h3( i + vec3( 1, 0, 0 ) ), f.x ), mix( h3( i + vec3( 0, 1, 0 ) ), h3( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( h3( i + vec3( 0, 0, 1 ) ), h3( i + vec3( 1, 0, 1 ) ), f.x ), mix( h3( i + vec3( 0, 1, 1 ) ), h3( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
        float aaF( vec3 p, float fq ) { return 1.0 - smoothstep( 0.25, 0.9, length( fwidth( p ) ) * fq ); }
        vec3 pnArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
          vec3 vSigmaX = normalize( dFdx( surf_pos ) ), vSigmaY = normalize( dFdy( surf_pos ) ), vN = surf_norm;
          vec3 R1 = cross( vSigmaY, vN ), R2 = cross( vN, vSigmaX ); float fDet = dot( vSigmaX, R1 ) * faceDirection;
          vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 ); return normalize( abs( fDet ) * surf_norm - vGrad ); }
        // dobras de tecido (espaço de repouso, metros): ridged noise anisotrópico com warp → altura (m) + vale (0..1)
        float rdg( float n ) { return 1.0 - abs( 2.0 * n - 1.0 ); }
        vec2 folds( vec3 p, vec3 fq ) {
          vec3 w = p + 0.035 * vec3( n3( p * 9.0 ), n3( p * 9.0 + 7.1 ), n3( p * 9.0 + 3.3 ) );
          float a = rdg( n3( w * fq ) ), b = rdg( n3( w * fq.zxy * 1.9 + 11.0 ) );
          float h = a * 0.65 + b * 0.35; return vec2( h, 1.0 - smoothstep( 0.15, 0.62, h ) ); }`)
      .replace('#include <lights_physical_pars_fragment>', lp)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = pow( max( diffuseColor.rgb, 0.0 ), vec3( 1.0 / 2.2 ) );
          float mx = max( c.r, max( c.g, c.b ) ), mn = min( c.r, min( c.g, c.b ) ), sat = ( mx - mn ) / max( mx, 1e-3 );
          float isHead = 1.0 - smoothstep( 0.3, 0.7, abs( vCat - 1.0 ) ), isHand = 1.0 - smoothstep( 0.3, 0.7, abs( vCat - 2.0 ) ), isLeg = 1.0 - smoothstep( 0.3, 0.7, abs( vCat - 3.0 ) );
          float isBody = clamp( 1.0 - isHead - isHand - isLeg, 0.0, 1.0 );
          float dark = 1.0 - smoothstep( 0.30, 0.42, mx );
          float white = ( 1.0 - smoothstep( 0.14, 0.24, sat ) ) * smoothstep( 0.55, 0.7, mx );
          float strong = smoothstep( 0.6, 0.72, sat ) * smoothstep( 0.65, 0.78, c.r );
          float yel = strong * smoothstep( 0.66, 0.76, c.g / max( c.r, 1e-3 ) );
          float ora = strong * ( 1.0 - yel );
          float skin = ( 1.0 - dark ) * ( 1.0 - white ) * ( 1.0 - strong ) * step( c.b, c.r ) * smoothstep( 0.12, 0.25, sat );
          gSkin = skin * ( 1.0 - isLeg );
          gHelm = white * isHead;
          gShirt = white * ( 1.0 - isHead ) + ( 1.0 - dark ) * ( 1.0 - white ) * ( 1.0 - strong ) * ( 1.0 - skin ) * ( 1.0 - isHead );
          gVest = ora * ( 1.0 - isHead ); gRefl = yel * ( 1.0 - isHead );
          gGlove = dark * isHand; gPant = dark * isLeg; gHair = dark * isHead; gTrim = dark * isBody;
          // tela do colete: furos de ~3 mm (malha 3D estável), escurecidos (sombra/camisa por trás), some à distância
          vec3 q = vRest * 1900.0; float hole = smoothstep( 0.25, 0.55, sin( q.x ) * sin( q.y ) * sin( q.z ) + 0.15 * sin( q.y * 0.5 ) );
          float holeA = aaF( vRest, 1900.0 / 6.283 );
          diffuseColor.rgb *= 1.0 - gVest * mix( 0.16, 0.55 * hole, holeA );
          diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.06, 1.08, 0.95 ), gRefl );
          // fios sob o casco: mesmo castanho do cabelo cacheado
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.075, 0.042, 0.024 ) * ( 0.6 + 0.8 * mx ), gHair * 0.85 );
          // pele: leve variação de tom (manchas/rubor) sem inventar feições
          float blot = n3( vRest * 90.0 ) * 0.6 + n3( vRest * 260.0 ) * 0.4;
          diffuseColor.rgb *= 1.0 + gSkin * ( blot - 0.5 ) * vec3( 0.07, 0.09, 0.1 );
          // tom medido na foto (bochecha 177/116/83 sRGB) × captura (164/106/73) → ganho linear
          diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 1.15, 1.13, 1.18 ), gSkin );
          // zona T (testa/dorso do nariz/maçãs): mais oleosa → mais especular, menos rugosa
          gHead = isHead;
          { vec3 lp = vRest - uHC; float fw = dot( lp.xz, uFw.xz ), sd = dot( lp, uSd ), up = lp.y;
            float front = smoothstep( uFace - 0.06, uFace - 0.012, fw );
            float tz = front * ( exp( - sd * sd / 0.00045 ) * smoothstep( -0.05, 0.0, up ) + 0.55 * exp( - pow( abs( sd ) - 0.038, 2.0 ) / 0.0002 ) * exp( - pow( up + 0.022, 2.0 ) / 0.0002 ) );
            gTz = clamp( tz, 0.0, 1.0 ) * gSkin * isHead; }
          // dobras: camisa (frouxa, grandes), colete (leves), calça (joelho/canela); AO de vale no albedo
          { float yy = vRest.y - uY0; gBoot = gPant * ( 1.0 - smoothstep( 0.11, 0.15, yy ) );
            vec2 fS = folds( vRest, vec3( 15.0, 6.0, 15.0 ) ), fP = folds( vRest, vec3( 30.0, 11.0, 30.0 ) ), fV = folds( vRest, vec3( 14.0, 7.0, 14.0 ) );
            float shirtW = gShirt, pantW = gPant - gBoot, vestW = gVest + gRefl;
            gFoldH = shirtW * fS.x * 0.0024 + pantW * fP.x * 0.0028 + vestW * fV.x * 0.0018;
            gFoldV = shirtW * fS.y + pantW * fP.y * 0.8 + vestW * fV.y * 0.6;
            diffuseColor.rgb *= 1.0 - gFoldV * ( 0.13 * shirtW + 0.22 * pantW + 0.16 * vestW );
            diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.95, 0.97, 1.02 ), shirtW * gFoldV * 0.6 ); // sombra fria nas dobras do branco
            // calça: carvão (não preto puro), desbotado nos joelhos/assento, poeira de galpão subindo da barra
            float dust = ( 1.0 - smoothstep( 0.05, 0.55, yy ) ) * ( 0.55 + 0.45 * n3( vRest * 35.0 ) ) + 0.35 * smoothstep( 0.55, 0.85, n3( vRest * 12.0 ) );
            diffuseColor.rgb = mix( diffuseColor.rgb, max( diffuseColor.rgb, vec3( 0.032, 0.031, 0.034 ) ) * ( 0.85 + 0.3 * n3( vRest * 60.0 ) ), pantW );
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.105, 0.092, 0.078 ), pantW * dust * 0.32 );
            // botas: couro com arranhões e pó claro na biqueira/sola
            float scuff = smoothstep( 0.6, 0.8, n3( vRest * vec3( 220.0, 60.0, 220.0 ) ) );
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.045, 0.036, 0.03 ), gBoot * 0.6 );
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.16, 0.14, 0.12 ), gBoot * ( 0.25 * scuff + 0.35 * ( 1.0 - smoothstep( 0.0, 0.035, yy ) ) ) );
            // colete: laranja desbotado/sujo irregular (sol, lavagem), não chapado
            float fade = n3( vRest * 7.0 ) * 0.6 + n3( vRest * 31.0 ) * 0.4;
            diffuseColor.rgb *= 1.0 + vestW * ( fade - 0.5 ) * vec3( 0.16, 0.22, 0.28 );
            diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.21, 0.16, 0.11 ) * diffuseColor.rgb / max( diffuseColor.r, 0.05 ), vestW * 0.10 * smoothstep( 0.55, 0.8, n3( vRest * 18.0 + 4.0 ) ) );
          }
          // camisa de crepe: branco ~0,85 da foto, fosca; colete: tela mais legível
          diffuseColor.rgb = mix( diffuseColor.rgb, max( diffuseColor.rgb, vec3( 0.0 ) ) * vec3( 1.2, 1.2, 1.22 ), gShirt * white );
          diffuseColor.rgb = mix( diffuseColor.rgb, max( diffuseColor.rgb, vec3( 0.022 ) ), gTrim );
          if ( uDbg > 0.5 ) diffuseColor.rgb = gSkin * vec3( 0.9, 0.6, 0.5 ) + gHelm * vec3( 0.2, 0.4, 1.0 ) + gShirt * vec3( 1.0 ) + gVest * vec3( 1.0, 0.4, 0.0 ) + gRefl * vec3( 0.8, 1.0, 0.0 ) + gGlove * vec3( 0.6, 0.0, 0.8 ) + gPant * vec3( 0.0, 0.3, 0.2 ) + gHair * vec3( 0.4, 0.2, 0.0 ) + gTrim * vec3( 0.1 );
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float rT = gSkin * ( 0.52 + 0.08 * ( 1.0 - gHead ) - 0.17 * gTz + 0.08 * ( n3( vRest * 140.0 ) - 0.5 ) ) + gHelm * 0.22 + gShirt * 0.93 + gVest * 0.74 + gRefl * 0.38 + gGlove * 0.93 + ( gPant - gBoot ) * 0.84 + gBoot * 0.5 + gHair * 0.55 + gTrim * 0.8;
        float rW = gSkin + gHelm + gShirt + gVest + gRefl + gGlove + gPant + gHair + gTrim;
        roughnessFactor = mix( roughnessFactor, rT / max( rW, 1e-3 ), 0.85 * clamp( rW, 0.0, 1.0 ) );`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = 0.0;')
      .replace('#include <normal_fragment_maps>', `vec3 nGeo = normal;
#include <normal_fragment_maps>
        normal = normalize( mix( normal, nGeo, gHelm * 0.9 ) );
        {
          vec3 p = vRest; float h = 0.0;
          // poros + micro-relevo de pele (0,4–1 mm)
          h += gSkin * ( 0.55 + 0.35 * gHead ) * ( n3( p * 1800.0 ) * 0.55 + n3( p * 700.0 ) * 0.3 + n3( p * 3600.0 ) * 0.15 ) * aaF( p, 1800.0 );
          // crepe: grão irregular + rugas finas alongadas
          h += gShirt * ( 0.7 * n3( p * vec3( 900.0, 2400.0, 900.0 ) ) * aaF( p, 2400.0 ) + 1.4 * n3( p * vec3( 70.0, 22.0, 70.0 ) ) );
          // tela do colete
          vec3 q = p * 1900.0; h += gVest * 0.9 * smoothstep( 0.25, 0.55, sin( q.x ) * sin( q.y ) * sin( q.z ) ) * aaF( p, 1900.0 / 6.283 );
          // faixa refletiva: microesferas (grão fino)
          h += gRefl * 0.25 * n3( p * 3000.0 ) * aaF( p, 3000.0 );
          // malha tricotada (laçadas em V) nas luvas
          float kn = abs( sin( p.y * 1300.0 + abs( sin( ( p.x + p.z ) * 650.0 ) ) * 2.2 ) );
          h += gGlove * 0.9 * kn * aaF( p, 1300.0 / 6.283 );
          // sarja diagonal na calça
          h += gPant * 0.28 * ( 0.5 + 0.5 * sin( ( p.y * 1.0 + p.x * 0.7 + p.z * 0.7 ) * 1500.0 ) ) * aaF( p, 1500.0 / 6.283 ) + gPant * 0.8 * n3( p * vec3( 40.0, 12.0, 40.0 ) );
          // ABS: casca de laranja muito leve
          h += gHelm * 0.12 * n3( p * 500.0 );
          h += gHair * 0.6 * abs( sin( p.y * 2500.0 + n3( p * 120.0 ) * 8.0 ) ) * aaF( p, 2500.0 / 6.283 );
          vec2 dH = vec2( dFdx( h ), dFdy( h ) ) * 0.9; dH *= min( 1.0, 0.3 / max( length( dH ), 1e-5 ) ); // sem vaga-lumes nas trocas de região
          normal = pnArb( - vViewPosition, normal, dH, faceDirection );
          { vec3 sx = dFdx( - vViewPosition ), sy = dFdy( - vViewPosition ); vec3 R1 = cross( sy, normal ), R2 = cross( normal, sx );
            float det = dot( sx, R1 ) * faceDirection; vec3 gr = sign( det ) * ( dFdx( gFoldH ) * R1 + dFdy( gFoldH ) * R2 ); gr *= min( 1.0, 0.45 * abs( det ) / max( length( gr ), 1e-12 ) );
            normal = normalize( abs( det ) * normal - gr * 1.0 ); }
        }`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.clearcoat = clamp( gHelm * 1.0 + gRefl * 0.35, 0.0, 1.0 );
        material.clearcoatRoughness = mix( 0.12, 0.035, gHelm );
        material.sheenColor = gSkin * vec3( 0.32, 0.11, 0.07 ) + ( gShirt + gGlove + gPant + gVest ) * vec3( 0.10 ) + gTrim * vec3( 0.16 );
        material.sheenRoughness = mix( 0.6, 0.35, gSkin );
        material.specularColor *= 1.0 + gSkin * ( 0.3 * gHead - 0.15 * ( 1.0 - gHead ) + 0.9 * gTz ) - gShirt * 0.35;
        material.sheenColor *= 1.0 - 0.5 * gShirt;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += gRefl * diffuseColor.rgb * 0.10;`);
  };
  mat.customProgramCacheKey = () => 'tripo_regions_v3';
  const hidden = new THREE.MeshBasicMaterial({ visible: false, name: 'tripo_hidden' });
  G.setIndex([...keep, ...hideG, ...hideP]); G.clearGroups();
  G.addGroup(0, keep.length, 0); G.addGroup(keep.length, hideG.length, 1); G.addGroup(keep.length + hideG.length, hideP.length, 2);
  const glassesMat = hidden, ponyMat = hidden.clone();
  skinned.material = [mat, glassesMat, ponyMat];
  skinned.castShadow = true; skinned.receiveShadow = true;

  // ── óculos reais + cabelo cacheado longo + plugs + brinco: worker_head.buildHead sobre proxy filtrado ──
  let head = null;
  try {
    const keepV = new Uint8Array(N);
    for (const v of keep) keepV[v] = 1;
    // fora do proxy: casco do capacete (branco acima da testa) — para o frame medir crânio/rosto, não o casco
    for (let i = 0; i < N; i++) if (domBone[i] === headIdx) { t3.fromBufferAttribute(P, i); const c = cls(px(UV.getX(i), UV.getY(i))); if ((c === 'white' || c === 'grey') && yr(t3) > 0.93) keepV[i] = 0; }
    for (const v of [...hideG, ...hideP]) keepV[v] = 0;
    const map2 = []; for (let i = 0; i < N; i++) if (keepV[i]) map2.push(i);
    const pg = new THREE.BufferGeometry();
    const pick = (attr) => { const a = new attr.array.constructor(map2.length * attr.itemSize); for (let j = 0; j < map2.length; j++) for (let c = 0; c < attr.itemSize; c++) a[j * attr.itemSize + c] = attr.array[map2[j] * attr.itemSize + c]; return new THREE.BufferAttribute(a, attr.itemSize, attr.normalized); };
    // calota craniana sintética (sob o casco Tripo não há crânio): elipsoide feminino médio, 100 % no osso Head
    const theta = Math.atan2(F.x, F.z);
    const toMesh = new THREE.Matrix4().makeRotationY(theta).multiply(new THREE.Matrix4().makeScale(1 / k, 1 / k, 1 / k));
    const fromMesh = toMesh.clone().invert(); let sideMax = 0;
    for (let i = 0; i < N; i++) if (keepV[i] && domBone[i] === headIdx) { const q = t3.fromBufferAttribute(P, i).sub(eyeMid).applyMatrix4(fromMesh); if (q.y > -0.06 && q.y < 0.015) sideMax = Math.max(sideMax, Math.abs(q.x)); }
    const SS = THREE.MathUtils.clamp(sideMax / 0.092, 0.9, 1.35); dbg.skullScale = +SS.toFixed(3);
    const sk = []; const SK = { c: [0, 0.02 * SS, -0.076 * SS], r: [0.073 * SS, 0.105 * SS, 0.094 * SS] };
    for (let a = 0; a < 48; a++) for (let e = 1; e <= 14; e++) { const th = a / 48 * Math.PI * 2, ph = e / 15 * Math.PI / 2;
      const q = V3(SK.c[0] + SK.r[0] * Math.cos(ph) * Math.sin(th), SK.c[1] + SK.r[1] * Math.sin(ph) * 0.999 + 0.0, SK.c[2] + SK.r[2] * Math.cos(ph) * Math.cos(th));
      if (q.y < 0.004) continue; q.applyMatrix4(toMesh).add(eyeMid); sk.push(q); }
    const posA = pick(P), siA = pick(SI), swA = pick(SW), n0 = map2.length, n1 = n0 + sk.length;
    const pos2 = new Float32Array(n1 * 3); pos2.set(posA.array); const si2 = new siA.array.constructor(n1 * 4); si2.set(siA.array); const sw2 = new Float32Array(n1 * 4); sw2.set(swA.array);
    sk.forEach((q, j) => { pos2.set([q.x, q.y, q.z], (n0 + j) * 3); si2[(n0 + j) * 4] = headIdx; sw2[(n0 + j) * 4] = 1; });
    pg.setAttribute('position', new THREE.BufferAttribute(pos2, 3)); pg.setAttribute('skinIndex', new THREE.BufferAttribute(si2, 4)); pg.setAttribute('skinWeight', new THREE.BufferAttribute(sw2, 4));
    for (let j = 0; j < sk.length; j++) map2.push(-1);
    const proxy = new THREE.SkinnedMesh(pg, new THREE.MeshBasicMaterial({ name: 'proxy' }));
    proxy.matrixAutoUpdate = false; proxy.matrixWorld.copy(skinned.matrixWorld); proxy.skeleton = skinned.skeleton;
    proxy.bindMatrix.copy(skinned.bindMatrix); proxy.bindMatrixInverse.copy(skinned.bindMatrixInverse); proxy.bindMode = skinned.bindMode;
    // frame que buildHead espera: y cima, z frente, x esquerda dela, metros
    const fake = new THREE.Object3D(); fake.matrixAutoUpdate = false;
    fake.matrix.copy(skinned.matrixWorld).multiply(new THREE.Matrix4().makeRotationY(theta)).multiply(new THREE.Matrix4().makeScale(1 / k, 1 / k, 1 / k));
    fake.updateMatrixWorld(true);
    // olhos temporários (filhos do osso da cabeça, fora do skeleton) → origem correta do frame
    const eyes = [];
    for (const s of [1, -1]) { const e = new THREE.Bone(); e.name = s > 0 ? 'L_Eye' : 'R_Eye';
      const wp = eyeMid.clone().addScaledVector(SIDE, s * 0.032 / k).applyMatrix4(skinned.matrixWorld);
      headBone.updateWorldMatrix(true, false); e.position.copy(headBone.worldToLocal(wp)); headBone.add(e); eyes.push(e); }
    { const inv = fake.matrixWorld.clone().invert(); const O = eyes[0].getWorldPosition(V3()).add(eyes[1].getWorldPosition(V3())).multiplyScalar(0.5).applyMatrix4(inv);
      const mn = V3(1e9, 1e9, 1e9), mx = V3(-1e9, -1e9, -1e9), tp = V3(); let nn = 0;
      for (let j = 0; j < map2.length; j++) if (map2[j] < 0 || domBone[map2[j]] === headIdx) { proxy.getVertexPosition(j, tp); tp.applyMatrix4(proxy.matrixWorld).applyMatrix4(inv).sub(O); mn.min(tp); mx.max(tp); nn++; }
      dbg.proxyHead = { nn, mn: mn.toArray().map((v) => +v.toFixed(3)), mx: mx.toArray().map((v) => +v.toFixed(3)) }; }
    head = await buildHead({ THREE, stage, app, root: fake, skinned: proxy, bones, headBone });
    for (const e of eyes) headBone.remove(e);
    if (head?.parts?.helmet) head.parts.helmet.visible = false; // casco: o da própria malha Tripo (ABS + clearcoat)
    // óculos reais à frente das cascas-lente da malha (que trazem os olhos pintados e por isso ficam)
    // núcleos de volume do cabelo (elipsoides lisos) aparecem como "capuz" no corpo Tripo em T: só os cachos ficam
    head?.parts?.hair?.traverse?.((o) => { if (o.isMesh && o.geometry?.type === 'SphereGeometry') o.visible = false; });
    const gls = head?.parts?.glasses; if (gls) { gls.position.z += 0.016 * SS; gls.position.y += 0.002; gls.scale.setScalar(1.07); }
    dbg.head = head?.debug;
  } catch (e) { console.error('[tripo_mat] buildHead:', String(e), e?.stack?.slice(0,200)); }

  function update(dt, t) { try { head?.update?.(dt, t); } catch (e) { /* cabelo */ } }
  return { update, hide: ['ponytail', 'glasses'], parts: { material: mat, head, glassesMat, ponyMat }, anchors: head?.anchors, debug: dbg };
}
