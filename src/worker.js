// TRABALHADORA — dono: TRABALHADORA. Base realista: Microsoft Rocketbox Female_Adult_11 (MIT, assets/rocketbox/F11).
// UNIFORME INDUSTRIAL (worker_uniform.js): camisa de brim marinho manga longa + calça do mesmo tecido (malhas da F01);
// BOTINA DE SEGURANÇA (worker_boots.js) no lugar da bota de salto. Reserva sem uniforme: recoloração do atlas (camisa branca,
// mangas dobradas, fralda, calça escura, botas pretas),
// luvas pretas de malha com punho amarelo, tatuagem fina no antebraço direito interno; colete laranja refletivo (casca solta);
// pose operando o painel (IK de 2 ossos até app.machines.panelButton), olhar para a tela, respiração, piscar.
// Rosto/capacete/óculos/plugs/cabelo: módulo ROSTO (worker_head.js) via gancho buildHead; aqui só versões de reserva.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DIR = new URL('../assets/rocketbox/F11/', import.meta.url).href;
const HEIGHT = 1.65, RAW_H = 173.6, SC = HEIGHT / RAW_H; // FBX em cm → metros (altura ≈ 1,65 m)
const CM = SC; // metros por cm do FBX
const BTN_DEFAULT = V3(0.45, 1.72, 0.2);

const img = (n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = DIR + n; });
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const sat = (x) => Math.max(0, Math.min(255, x));

// ── recoloração do atlas do corpo (coordenadas de imagem normalizadas) ──
function recolorBody(im, navy = false) {
  const SHIRT = navy ? [30, 44, 70] : [242, 240, 234]; // camisa: marinho do uniforme (casca sob a malha da F01) ou branca
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, u = x / S, v = y / S, r = p[i], gg = p[i + 1], b = p[i + 2], L = lum(r, gg, b);
    const side = u < 0.335 || u > 0.665;
    const skin = r > 120 && r > gg && gg > b && r - b > 35;
    if (side && v < 0.235 && (u < 0.2 || u > 0.8)) { const k = 4 + L * 0.05; p[i] = k; p[i + 1] = k; p[i + 2] = k * 1.08; }            // mãos → luva preta de malha
    else if (side && v >= 0.11 && v < 0.29 && u > 0.13 && u < 0.87) { const k = L * 0.32; p[i] = k; p[i + 1] = k; p[i + 2] = k * 1.05; } // cano da bota
    else if (side && v >= 0.27 && v < 0.41) { const k = Math.min(1.0, 0.82 + (L - 40) / 300); p[i] = sat(SHIRT[0] * 0.97 * k); p[i + 1] = sat(SHIRT[1] * 0.97 * k); p[i + 2] = sat(SHIRT[2] * 0.97 * k); } // cinto → camisa por cima
    else if (side && v >= 0.585 && v < 0.85) { const k = 0.55 + L / 300; p[i] = sat(36 * k); p[i + 1] = sat(40 * k); p[i + 2] = sat(50 * k); } // pernas → calça escura
    else if (side && v >= 0.85) { const k = L * 0.33; p[i] = k; p[i + 1] = k; p[i + 2] = k * 1.04; }                                  // botas pretas
    else if (skin) { p[i] = sat(r * 0.6); p[i + 1] = sat(gg * 0.45); p[i + 2] = sat(b * 0.37); }                                       // pele do decote
    else { const k = Math.min(1.04, 0.8 + (L - 52) / 260); p[i] = sat(SHIRT[0] * k); p[i + 1] = sat(SHIRT[1] * k); p[i + 2] = sat(SHIRT[2] * k); }   // blusa/saia → camisa
  }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function recolorHead(im) {
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    const k = Math.max(0, Math.min(1, (r - b - 25) / 40)) * (r > 95 ? 1 : 0) * (r >= gg ? 1 : 0); // grau de "pele"
    if (k <= 0) continue;
    p[i] = r * (1 - k) + sat(r * 0.6) * k; p[i + 1] = gg * (1 - k) + sat(gg * 0.46) * k; p[i + 2] = b * (1 - k) + sat(b * 0.38) * k;
  }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function roughFromSpec(im, base) { // specular → roughness (invertido), canal G
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const s = lum(p[i], p[i + 1], p[i + 2]) / 255; const r = sat(255 * (base - s * 0.55)); p[i] = p[i + 1] = p[i + 2] = r; }
  g.putImageData(d, 0, 0); return new THREE.CanvasTexture(c);
}
function tattooTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.font = 'italic 38px "Snell Roundhand","Brush Script MT",cursive'; g.textBaseline = 'middle';
  g.fillText('resiliência', 10, 34); g.beginPath(); g.arc(240, 30, 2.5, 0, 7); g.fill();
  return new THREE.CanvasTexture(c);
}

function inject(mat, { decl = '', color = '', rough = '', normal = '', light = '' }, uniforms = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = vec3(position.x, position.z, -position.y);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\n' + decl)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat wMask = 0.0; float wSkin = 0.0;\n' + color)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + rough)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + normal)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + light);
  };
  const ck = 'wk' + (decl + color + rough + normal + light).length + ':' + (color + rough).slice(0, 60); mat.customProgramCacheKey = () => ck;
  return mat;
}
// subsurface aproximado: luz "vaza" no terminador e nas sombras com tom avermelhado (wrap + preenchimento quente)
const SSS = (mask) => `{ float m = ${mask}; vec3 dd = reflectedLight.directDiffuse; float lumD = dot(dd, vec3(0.3, 0.59, 0.11));
  reflectedLight.directDiffuse = mix(dd, dd * vec3(1.06, 0.96, 0.92) + diffuseColor.rgb * vec3(0.55, 0.16, 0.08) * (0.25 * lumD / max(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), 0.02) + 0.0), m);
  reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, reflectedLight.indirectDiffuse * vec3(1.18, 0.98, 0.9), m); }`;
const NOISE = `float h31(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}`;

// eixos do antebraço em repouso (cm, espaço do FBX: y cima, z frente, +x = esquerda dela)
const ELB = V3(35.9, 121.0, -6.3), WRI = V3(52.4, 106.3, 3.1);
function armParam(x, y, z) { // s ao longo do antebraço (0 cotovelo, 1 punho) e distância ao eixo (cm)
  const sx = Math.sign(x) || 1, p = V3(Math.abs(x), y, z), a = WRI.clone().sub(ELB), s = p.clone().sub(ELB).dot(a) / a.lengthSq();
  const dist = p.sub(ELB.clone().add(a.multiplyScalar(s))).length(); return { s, dist, sx };
}

export async function buildWorker(stage, app) {
  // ?avatar=tripo|rocketbox (padrão: rocketbox — escolhido pelo usuário; ?avatar=tripo usa o modelo gerado no Tripo)
  if ((new URLSearchParams(location.search).get('avatar') || 'rocketbox') === 'tripo') {
    try { return await (await import('./worker_tripo.js')).buildWorkerTripo(stage, app); }
    catch (e) { console.warn('[worker] avatar Tripo indisponível, usando Rocketbox:', e); }
  }
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier((u) => (/\.(tga|png|jpg)$/i.test(u) && !u.startsWith('data:') && !/\.fbx/i.test(u) ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' : u));
  const [fbx, bodyC, bodyN, bodyS, headC, headN, headS, opC] = await Promise.all([
    new FBXLoader(mgr).loadAsync(DIR + 'Female_Adult_11.fbx'),
    img('f011_body_color.jpg'), img('f011_body_normal.jpg'), img('f011_body_specular.jpg'),
    img('f011_head_color.jpg'), img('f011_head_normal.jpg'), img('f011_head_specular.jpg'), img('f011_opacity_color.png')]);
  const group = new THREE.Group(); group.name = 'trabalhadora'; group.rotation.y = Math.PI / 2 - 0.3; // olha +x, pés ~17° abertos para a câmera (peito em 3/4 como na foto)
  group.scale.setScalar(SC);
  group.add(fbx); stage.scene.add(group);
  let mesh; fbx.traverse((o) => { if (o.isSkinnedMesh) mesh = o; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const skinned = mesh, geo = mesh.geometry, skel = mesh.skeleton;
  const B = {}; for (const b of skel.bones) B[b.name.replace(/^Bip01_?/, '') || 'Root'] = b;
  const HAND_K = 0.88; // mãos (com a luva) 12 % menores — pedido do usuário; o alcance do braço compensa abaixo
  for (const sd of ['L', 'R']) B[sd + '_Hand']?.scale.setScalar(HAND_K);
  const bones = {}; for (const b of skel.bones) bones[b.name] = b;
  group.updateMatrixWorld(true);

  // ── geometria: saia → fralda curta da camisa; antebraços afinados (manga dobrada, braço nu) ──
  const P = geo.attributes.position, UV = geo.attributes.uv, N = geo.attributes.normal;
  const grpOf = new Int8Array(P.count); for (const gr of geo.groups) grpOf.fill(gr.materialIndex, gr.start, gr.start + gr.count);
  // ── camisa de verdade (malha da F01 presa ao esqueleto da F11); a casca branca da F11 recua por baixo dela ──
  // UNIFORME: camisa de brim marinho manga longa + calça (worker_uniform.js); reserva: camisa branca (worker_shirt.js)
  let shirtF01 = null, uni = null;
  try { const UM = await import('./worker_uniform.js'); uni = await UM.buildUniform({ fbx, bones, mgr, inject, NOISE }); shirtF01 = uni.mesh; }
  catch (e) { uni = null; console.warn('[worker] uniforme indisponível, usando a camisa F01:', e); }
  if (!shirtF01) try { const SM = await import('./worker_shirt.js'); shirtF01 = await SM.buildShirt({ fbx, bones, mgr, inject, NOISE }); }
  catch (e) { console.warn('[worker] camisa F01 indisponível, usando a procedural:', e); }
  const uniPants = !!uni?.pants;
  // (malha do FBX em z-cima: modelo = (x, zRaw, −yRaw))
  const P0 = new Float32Array(P.array); // posições originais: base da casca do colete (não herda o volume da camisa)
  // amostra do atlas: pele do decote fica sem volume de tecido
  const skc = document.createElement('canvas'); skc.width = skc.height = 256; const skg = skc.getContext('2d'); skg.drawImage(bodyC, 0, 0, 256, 256);
  const skd = skg.getImageData(0, 0, 256, 256).data;
  const skinUV = (u, v) => { const j = ((Math.min(255, v * 256 | 0)) * 256 + Math.min(255, u * 256 | 0)) * 4, r = skd[j], g = skd[j + 1], b = skd[j + 2]; return r > 120 && r > g && g > b && r - b > 35; };
  const SH = V3(17.2, 138, -6.1), EL = V3(35.9, 121, -6.3), AD = EL.clone().sub(SH);
  const AE1 = AD.clone().cross(V3(0, 0, 1)).normalize(), AE2 = AD.clone().normalize().cross(AE1);
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const push = (i, d) => P.setXYZ(i, P.getX(i) + N.getX(i) * d, P.getY(i) + N.getY(i) * d, P.getZ(i) + N.getZ(i) * d);
  for (let i = 0; i < P.count; i++) {
    if (grpOf[i] !== 0) continue;
    const u = UV.getX(i), v = 1 - UV.getY(i), x = P.getX(i), y = P.getZ(i), z = -P.getY(i);
    const side = u < 0.335 || u > 0.665, hand = side && v < 0.235 && (u < 0.2 || u > 0.8);
    if (uniPants && !side && y < 92) { const yy = 92 + (y - 92) * 0.12, k = 0.62;  // saia recolhida para dentro da calça
      P.setXYZ(i, x * k, -((z + 1.5) * k - 1.5), yy); continue; }
    if (uniPants && !hand && y < 92 && Math.abs(x) < 26) { push(i, y < 24 ? -1.6 : -1.2); continue; } // pernas/bota de salto sob calça e botina
    if (!side && y < 92) { const yy = 92 + (y - 92) * 0.3; const k = 0.97 + 0.05 * Math.max(0, (yy - 80) / 12); // fralda solta da camisa
      P.setXYZ(i, x * k, -((z + 1.5) * k - 1.5), yy); continue; }
    if (hand || y < 90 || y > 151) continue;
    const a = armParam(x, y, z);
    if (a.s > 0.97 && a.dist < 9) continue;                                          // mão/luva
    if (a.s > 0.3 && a.dist < 8.5) { push(i, -0.75 * Math.min(1, (a.s - 0.3) / 0.05)); continue; } // antebraço nu
    if (skinUV(u, v)) continue;                                                       // pele do decote
    // camisa larga de crepe: volume + dobras macias (cm, repouso)
    const ax = Math.abs(x), q = V3(ax, y, z).sub(SH), su = q.dot(AD) / AD.lengthSq(), rq = q.clone().sub(AD.clone().multiplyScalar(su)), du = rq.length();
    let dT = 1.0 + 0.9 * sstep(122, 100, y) + 0.45 * Math.sin(x * 0.42 + 1.3 * Math.sin(y * 0.17)) * sstep(132, 108, y)
      + 0.3 * Math.sin(y * 0.55 + x * 0.2) * sstep(120, 135, y) * sstep(4, 12, ax);
    if (ax > 11 && du < 11 && su > -0.15) {
      const phi = Math.atan2(rq.dot(AE2), rq.dot(AE1));
      const fo = Math.sin(su * 24 + phi * 1.7 + 0.8 * Math.sin(phi * 3)); const dA = 1.5 + 1.0 * Math.sign(fo) * Math.pow(Math.abs(fo), 0.6) * sstep(0.15, 0.4, su) + 0.4 * Math.sin(su * 51 - phi * 2.3) + 0.8 * sstep(0.6, 1.0, su);
      const wa = sstep(-0.15, 0.2, su); dT = dT * (1 - wa) + dA * wa;
    }
    if (a.s > 0 && a.dist < 9) dT *= 1 - sstep(0.12, 0.28, a.s);                    // some sob o rolo da manga
    const open = z > -1 && ax < 6.5 + Math.max(0, y - 121) * 0.17;                 // só a faixa visível entre as bordas do colete ganha volume
    if (!(ax > 11 && du < 11 && su > 0.05) && !open) dT = Math.min(dT, 0.6);
    push(i, shirtF01 ? (a.s > 0 && a.dist < 9 ? Math.min(dT, 0) : -0.9) : dT);
  }
  P.needsUpdate = true; geo.computeBoundingSphere();

  // ── gancho do módulo ROSTO ──
  let head = null;
  try { const H = await import('./worker_head.js'); head = await H.buildHead({ THREE, stage, app, root: fbx, skinned, bones, headBone: bones.Bip01_Head || B.Head, base: 'rocketbox' }); }
  catch (e) { head = null; if (!/Failed to fetch|Cannot find|404/.test(String(e))) console.warn('[worker] worker_head:', e); }
  const rep = new Set(head?.replaces || []);

  // ── materiais ──
  const armU = { uE: { value: ELB }, uW: { value: WRI }, uTat: { value: tattooTex() }, uUni: { value: uni?.sleeves ? 1 : 0 } };
  const bodyMat = inject(new THREE.MeshPhysicalMaterial({ map: recolorBody(bodyC, !!uni), normalMap: new THREE.CanvasTexture(bodyN), normalScale: new THREE.Vector2(0.35, 0.35), roughnessMap: roughFromSpec(bodyS, 0.95),
    roughness: 1, metalness: 0, sheen: 0.18, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.8, specularIntensity: 0.4 }), {
    decl: NOISE + '\nuniform vec3 uE, uW; uniform sampler2D uTat; uniform float uUni;',
    color: `vec3 pr = vec3(abs(vRest.x), vRest.y, vRest.z); vec3 ax = uW - uE; float s = dot(pr - uE, ax) / dot(ax, ax);
      vec3 rad = pr - (uE + ax * s); float dd = length(rad);
      float wShirt = 0.0;
      if (dd < 8.5 && s > 0.29 && s < 0.955) { wSkin = 1.0;
        vec3 sk = vec3(0.15, 0.066, 0.038) * (0.86 + 0.22 * vn(vRest * 3.0)) * (0.93 + 0.1 * vn(vRest * 40.0));
        sk *= mix(0.7, 1.0, smoothstep(0.29, 0.4, s));                       // sombra sob o rolo da manga
        if (vRest.x < 0.0 && s > 0.48 && s < 0.9) {                           // tatuagem fina (antebraço direito interno)
          vec3 an = normalize(ax), up = normalize(vec3(0.0, 0.35, 1.0) - an * dot(vec3(0.0, 0.35, 1.0), an)), sd = cross(an, up);
          float ang = atan(dot(rad, sd), dot(rad, up));
          vec2 tu = vec2((s - 0.48) / 0.42, 0.5 + ang / 0.9);
          if (tu.y > 0.0 && tu.y < 1.0) sk *= 1.0 - 0.8 * texture2D(uTat, vec2(tu.x, tu.y)).a; }
        diffuseColor.rgb = sk;
        if (uUni > 0.5) { wSkin = 0.0; diffuseColor.rgb = vec3(0.016, 0.027, 0.055) * (0.9 + 0.15 * vn(vRest * 2.0)); } } // manga longa do uniforme por cima
      else if (dd < 11.0 && s >= 0.955 && s < 1.12) { wMask = 1.0; vec3 kq = vRest * 14.0; float kn = 0.5 + 0.5 * sin(kq.x + 2.0 * sin(kq.y)) * sin(kq.z + kq.y);
        diffuseColor.rgb = mix(vec3(0.012, 0.012, 0.014) * (0.7 + 0.6 * kn), vec3(0.75, 0.6, 0.02), smoothstep(0.955, 0.958, s) * (1.0 - smoothstep(0.966, 0.969, s))); }
      if (wSkin < 0.5 && wMask < 0.5 && dot(diffuseColor.rgb, vec3(0.333)) > 0.5) {   // crepe branco: microfranzido + leve variação
        wShirt = 1.0; float cr = vn(vec3(vRest.x * 3.2, vRest.y * 0.8, vRest.z * 3.2)) * 0.6 + vn(vRest * 9.0) * 0.4;
        diffuseColor.rgb *= 0.93 + 0.09 * cr; }`,
    light: SSS('wSkin'),
    rough: 'if (wSkin > 0.5) roughnessFactor = 0.45; if (wMask > 0.5) roughnessFactor = 0.9; if (wShirt > 0.5) roughnessFactor = 0.88;',
    normal: `if (wSkin > 0.5) normal = normalize(mix(normal, nonPerturbedNormal, 0.85));
      if (wShirt > 0.5) { vec3 cq = vec3(vRest.x * 3.2, vRest.y * 0.8, vRest.z * 3.2); float e = 0.15;
        vec3 gr = vec3(vn(cq + vec3(e, 0, 0)) - vn(cq - vec3(e, 0, 0)), vn(cq + vec3(0, e, 0)) - vn(cq - vec3(0, e, 0)), vn(cq + vec3(0, 0, e)) - vn(cq - vec3(0, 0, e)));
        vec3 cq2 = vRest * 7.0; vec3 g2 = vec3(vn(cq2 + vec3(e, 0, 0)) - vn(cq2 - vec3(e, 0, 0)), vn(cq2 + vec3(0, e, 0)) - vn(cq2 - vec3(0, e, 0)), vn(cq2 + vec3(0, 0, e)) - vn(cq2 - vec3(0, 0, e)));
        normal = normalize(normal - (mat3(viewMatrix) * (gr * 1.1 + g2 * 0.5))); }`,
  }, armU);
  const headMat = inject(new THREE.MeshPhysicalMaterial({ map: recolorHead(headC), normalMap: new THREE.CanvasTexture(headN), roughnessMap: roughFromSpec(headS, 0.72), roughness: 1,
    sheen: 0.35, sheenColor: new THREE.Color(0x9a3a22), sheenRoughness: 0.45, specularIntensity: 0.6, clearcoat: 0.12, clearcoatRoughness: 0.35 }), { light: SSS('1.0') });
  const opT = new THREE.Texture(opC); opT.colorSpace = THREE.SRGBColorSpace; opT.needsUpdate = true;
  const hairMat = new THREE.MeshStandardMaterial({ map: opT, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7, color: 0x8a6a58 });
  for (const t of [bodyMat.normalMap, headMat.normalMap]) t.needsUpdate = true;
  mesh.material = [bodyMat, headMat, hairMat];

  // ── colete laranja-fluorescente (casca solta com skinning copiado do corpo) ──
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const armIdx = new Set(skel.bones.map((b, i) => (/(UpperArm|Forearm|Hand|Finger)/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const domArm = (v) => { let best = 0, bw = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(v, k); if (w > bw) { bw = w; best = SI.getComponent(v, k); } } return armIdx.has(best); };
  const X0 = (v) => P0[v * 3], Y0 = (v) => P0[v * 3 + 1], Z0 = (v) => P0[v * 3 + 2];
  const key = (v) => Math.round(X0(v) * 50) + ',' + Math.round(Y0(v) * 50) + ',' + Math.round(Z0(v) * 50);
  function makeShell(filter, offset, material) {
    const weld = new Map(), reps = [], nrm = [], tri = [];
    for (let t = 0; t < P.count; t += 3) {
      if (grpOf[t] !== 0) continue;
      const cx = (X0(t) + X0(t + 1) + X0(t + 2)) / 3, cy = (Z0(t) + Z0(t + 1) + Z0(t + 2)) / 3, cz = -(Y0(t) + Y0(t + 1) + Y0(t + 2)) / 3;
      if (!filter(cx, cy, cz, domArm(t) + domArm(t + 1) + domArm(t + 2) >= 2)) continue;
      for (const v of [t, t + 1, t + 2]) { const k = key(v); let id = weld.get(k); if (id == null) { id = reps.length; weld.set(k, id); reps.push(v); nrm.push(V3()); }
        nrm[id].x += N.getX(v); nrm[id].y += N.getY(v); nrm[id].z += N.getZ(v); tri.push(id); }
    }
    const n = reps.length, pos = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    reps.forEach((v, i) => { const nn = nrm[i].normalize(), x = X0(v), y = Y0(v), z = Z0(v), o = offset(x, z, -y);
      pos.set([x + nn.x * o, y + nn.y * o, z + nn.z * o], i * 3);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = SI.getComponent(v, k); sw[i * 4 + k] = SW.getComponent(v, k); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setIndex(tri); g.computeVertexNormals();
    const m = new THREE.SkinnedMesh(g, material); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    mesh.parent.add(m); m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale); m.bind(skel, mesh.bindMatrix);
    return m;
  }
  // contorno suave do colete (cm, espaço de repouso) — recorte por pixel => cava/decote/barra lisos
  const VEST_GLSL = `float vestD(vec3 p) {
    float ax = abs(p.x), y = p.y, z = p.z;
    float dHem = y - 94.0 - 0.6 * smoothstep(0.0, 14.0, ax);
    float vline = 5.2 + max(0.0, y - 121.0) * 0.17;                       // colete aberto na frente
    float dV = z > -1.0 ? ax - vline : 99.0;
    float dBack = (z < -1.0) ? max(ax - (6.8 + max(0.0, y - 141.0) * 0.55), 141.5 - y) : 99.0;
    float e = length(vec2((y - 133.0) / 9.0, (z + 5.0) / 5.6));
    float dArm = (e - 1.0) * 7.0 + max(0.0, 14.8 - ax) * 1.6;
    float strap = 1.0 - smoothstep(1.8, 2.2, abs(y - 101.0));
    float dSide = (16.8 - ax) + max(0.0, y - 118.0) * 2.0 + strap * 30.0;
    float dCap = (15.6 - ax) + max(0.0, 128.0 - y) * 2.0;
    return min(min(min(dHem, dV), min(dBack, dArm)), dCap);
  }`;
  const vestMat = inject(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x000000, emissiveIntensity: 0,
    sheen: 0.2, sheenColor: new THREE.Color(0xff8a30), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }), {
    decl: NOISE + VEST_GLSL,
    color: `float vd = vestD(vRest); if (vd < 0.0) discard;
      float ax = abs(vRest.x), y = vRest.y;
      vec2 dq = vec2(vRest.x + vRest.z * 0.7 + y, vRest.x + vRest.z * 0.7 - y) * 1.9;  // tela de malha em losango (~5 mm)
      vec2 cell = fract(dq) - 0.5; float holes = 1.0 - smoothstep(0.16, 0.3, max(abs(cell.x), abs(cell.y)));
      vec3 col = vec3(1.0, 0.22, 0.03) * (1.0 - 0.3 * holes) * (0.94 + 0.08 * vn(vRest * 1.3));
      float dv = (vRest.z > -1.0) ? ax - (5.2 + max(0.0, y - 121.0) * 0.17) : 99.0;  // distância à abertura da frente
      float st = smoothstep(1.05, 1.2, dv) * (1.0 - smoothstep(5.6, 5.75, dv));        // faixa limão VERTICAL ao lado da abertura
      if (st < 0.5 && vd > 1.15 && holes > 0.93) discard;                            // furos reais da tela (alfa)
      if (st > 0.0) { wMask = st; col = mix(col, vec3(0.80, 0.95, 0.06) * (0.9 + 0.1 * vn(vRest * 2.0)) * (1.0 - 0.06 * holes), st); }
      col = mix(col, vec3(0.008, 0.008, 0.01) * (0.8 + 0.4 * vn(vRest * 6.0)), 1.0 - smoothstep(0.95, 1.15, vd)); wMask = max(wMask, 1.0 - smoothstep(0.95, 1.15, vd)); // debrum preto
      col *= 0.88 + 0.12 * vn(vRest * 0.45);                                            // sujeira/variação
      diffuseColor.rgb = col;`,
    rough: 'roughnessFactor = mix(roughnessFactor, 0.42, wMask);',
  });
  const vestDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  vestDepth.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = vec3(position.x, position.z, -position.y);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\n' + VEST_GLSL).replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vestD(vRest) < 0.0) discard;');
  };
  vestDepth.customProgramCacheKey = () => 'vestDepth';
  const VEST_OFF = +(new URLSearchParams(location.search).get('voff') || 2.7); // folga (cm) do colete sobre o uniforme
  const vest = makeShell((x, y, z, arm) => (!arm || (y > 127 && Math.abs(x) < 18.5)) && y > 92 && y < 151 && Math.abs(x) < 19.5,
    (x, y, z) => VEST_OFF + (y > 134 ? 0.5 : 0) + (Math.abs(x) > 13 ? 0.4 : 0) + (z > 2 && y < 122 ? (122 - y) * 0.025 : 0) + Math.max(0, 100 - y) * 0.03, vestMat); // mais justo ao corpo
  vest.customDepthMaterial = vestDepth;
  vest.name = 'colete';

  const rest = new Map(skel.bones.map((b) => [b, b.quaternion.clone()]));
  const restPos = new Map(skel.bones.map((b) => [b, b.position.clone()]));
  group.updateMatrixWorld(true);
  const gq = group.getWorldQuaternion(new THREE.Quaternion());
  // holder preso ao osso com escala de mundo 1 e eixos do corpo (x = esquerda dela, y = cima, z = frente)
  function holderOn(bone) {
    const h = new THREE.Object3D(); bone.add(h); bone.updateWorldMatrix(true, false);
    const s = bone.getWorldScale(V3()), bq = bone.getWorldQuaternion(new THREE.Quaternion());
    h.quaternion.copy(bq.invert().multiply(gq)); h.scale.set(1 / s.x, 1 / s.y, 1 / s.z); return h;
  }
  const relTo = (bone, cm) => { const bp = bone.getWorldPosition(V3()); const wp = V3(cm[0], cm[1], cm[2]).applyMatrix4(fbx.matrixWorld); return wp.sub(bp).applyQuaternion(gq.clone().invert()); };

  // ── botina de segurança (substitui a bota de salto; malha rígida presa ao osso do pé) ──
  if (uniPants) try { const BM = await import('./worker_boots.js'); BM.buildBoots({ bones, group, floorY: group.getWorldPosition(V3()).y }); }
  catch (e) { console.warn('[worker] botina indisponível:', e); }

  // ── mangas dobradas: punho largo e fofo logo abaixo do cotovelo (dobras grandes e macias) ──
  const shirtM = inject(new THREE.MeshPhysicalMaterial({ color: 0xf1efea, roughness: 0.9, sheen: 0.35, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.7, side: THREE.DoubleSide }), {
    decl: NOISE, color: 'diffuseColor.rgb *= 0.9 + 0.12 * vn(vRest * 2.5);',
    normal: `{ vec3 cq = vRest * vec3(2.6, 0.9, 2.6); float e = 0.15;
      vec3 gr = vec3(vn(cq + vec3(e, 0, 0)) - vn(cq - vec3(e, 0, 0)), vn(cq + vec3(0, e, 0)) - vn(cq - vec3(0, e, 0)), vn(cq + vec3(0, 0, e)) - vn(cq - vec3(0, 0, e)));
      normal = normalize(normal - mat3(viewMatrix) * gr * 1.2); }` });
  function cuffGeo(R, L) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 40, 10, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ph = Math.atan2(z, x), h = y + 0.5;
      const r = R * (0.93 + 0.16 * Math.sin(Math.PI * h) + 0.05 * Math.sin(ph * 3 + 2.1 * h) + 0.04 * Math.sin(ph * 5 - 4 * h + 1.0))
        + 0.55 * Math.max(0, Math.sin(ph * 2 + 0.6)) * Math.sin(Math.PI * h); // dobra grande
      p.setXYZ(i, x * r, y * L, z * r); }
    g.computeVertexNormals();
    const lip = new THREE.TorusGeometry(R * 0.98, 0.75, 8, 40); lip.rotateX(Math.PI / 2);
    const ring = (yy, sc) => { const t = lip.clone(); t.scale(sc, 1, sc); t.translate(0, yy, 0); return t; };
    return [g, ring(L / 2, 1.0), ring(-L / 2, 0.97)];
  }
  if (!shirtF01) for (const sd of ['L', 'R']) {
    const fa = B[sd + '_Forearm'], h = holderOn(fa), sx = sd === 'L' ? 1 : -1;
    const ax = WRI.clone().sub(ELB), c = ELB.clone().add(ax.clone().multiplyScalar(0.2)); c.x *= sx;
    const dir = ax.normalize(); dir.x *= sx;
    const cuff = new THREE.Group(); cuff.position.copy(relTo(fa, [c.x, c.y, c.z])); cuff.quaternion.setFromUnitVectors(V3(0, 1, 0), dir); cuff.scale.setScalar(CM);
    for (const g of cuffGeo(5.1, 6.4)) { const m = new THREE.Mesh(g, shirtM); m.castShadow = true; m.receiveShadow = true; cuff.add(m); }
    h.add(cuff);
  }

  // ── gola aberta da camisa (abas deitadas sobre os ombros, pontas em V no peito) ──
  if (!shirtF01) { const hold = holderOn(B.Spine2);
    const pos = [], idx = [], NU = 26, NV = 4;
    for (const sx of [-1, 1]) {
      const base = new THREE.CatmullRomCurve3([V3(0, 147.6, -13.6), V3(4.6, 147.4, -12.0), V3(6.6, 147.0, -7.6), V3(6.6, 145.6, -3.0), V3(5.4, 142.8, 1.6), V3(3.6, 138.8, 6.0), V3(1.9, 134.6, 8.9)]);
      const off = pos.length / 3;
      for (let i = 0; i <= NU; i++) {
        const t = i / NU, pt = base.getPoint(t), tg = base.getTangent(t);
        const radial = V3(pt.x, 0, pt.z + 6.6).normalize(), front = Math.max(0, (t - 0.45) / 0.55);
        const outw = radial.clone().lerp(V3(1, -0.15, 0.55).normalize(), front).normalize();
        const stand = 2.6 * (1 - front) + 0.5 * front, span = 4.4 + 2.2 * Math.pow(front, 2);
        const nrmOut = tg.clone().cross(V3(0, 1, 0)).normalize(); if (nrmOut.dot(radial) < 0) nrmOut.negate();
        const rows = [pt.clone().addScaledVector(nrmOut, 0.5), pt.clone().addScaledVector(V3(0, 1, 0), stand).addScaledVector(nrmOut, 0.9),
          pt.clone().addScaledVector(V3(0, 1, 0), stand * 0.9).addScaledVector(outw, 1.6),
          pt.clone().addScaledVector(outw, span).addScaledVector(V3(0, -1, 0), 1.0 + 1.4 * front)];
        for (let r = 0; r < NV; r++) { const q = rows[r]; pos.push(q.x * sx, q.y, q.z); }
      }
      for (let i = 0; i < NU; i++) for (let r = 0; r < NV - 1; r++) { const a0 = off + i * NV + r, a1 = a0 + NV;
        if (sx > 0) idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1); else idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const collar = new THREE.Mesh(g, shirtM); collar.name = 'gola'; collar.castShadow = true; collar.receiveShadow = true;
    fbx.add(collar); fbx.updateMatrixWorld(true); hold.attach(collar);
  }

  // ── reservas de EPI na cabeça (se o ROSTO não substituir) ──
  const headH = holderOn(B.Head);
  const hp = (x, y, z) => relTo(B.Head, [x, y, z]);
  const earL = new THREE.Object3D(), earR = new THREE.Object3D(); earL.position.copy(hp(7.0, 159.0, -4.2)); earR.position.copy(hp(-7.0, 159.0, -4.2)); headH.add(earL, earR);
  if (!rep.has('helmet')) {
    const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
    const c0 = hp(0, 166.5, -3.5);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.128, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), white); shell.scale.set(0.9, 0.95, 1.08); shell.position.copy(c0); headH.add(shell);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.135, 0.006, 40, 1, false, -0.9, 1.8), white); brim.scale.set(0.95, 1, 1.3); brim.position.copy(c0).add(V3(0, 0, 0.012)); brim.rotation.x = -0.1; headH.add(brim);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.006, 6, 40), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })); band.rotation.x = Math.PI / 2; band.scale.set(0.8, 1.05, 1); band.position.copy(c0).add(V3(0, -0.006, 0)); headH.add(band);
    const strapM = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 });
    for (const sx of [-1, 1]) { const curve = new THREE.CatmullRomCurve3([hp(sx * 7.6, 165, -6), hp(sx * 7.4, 158, -7.5), hp(sx * 6.5, 151, -4), hp(sx * 3.5, 147.5, 2)]);
      headH.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0055, 5), strapM)); }
  }
  if (!rep.has('glasses')) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.042, 32, 1, true, -1.1, 2.2),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, roughness: 0.04, clearcoat: 1, specularIntensity: 1, side: THREE.DoubleSide, depthWrite: false }));
    lens.position.copy(hp(0, 160.6, -3.6)); headH.add(lens);
  }
  if (!rep.has('earplugs')) {
    const plugM = new THREE.MeshStandardMaterial({ color: 0xff7a1c, roughness: 0.95 });
    for (const e of [earL, earR]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0075, 0.016, 12), plugM); p.rotation.z = Math.PI / 2; p.position.x = Math.sign(e.position.x || 1) * 0.004; e.add(p); }
  }

  // ── âncoras do dosímetro (CONTRACT): preso pelo clipe na CAMISA (gola/vista, junto à clavícula), por dentro da abertura do
  //    colete; corpo do aparelho deitado sobre o peito (inclina ~20° para trás, acompanhando o tórax), microfone para cima,
  //    ponta do microfone a ~150–180 mm do canal auditivo do mesmo lado (zona auditiva NHO-01: 150 ± 50 mm) ──
  const chest = holderOn(B.Spine2);
  const mk = (par, pos, ry = 0, rx = 0, rz = 0) => { const o = new THREE.Object3D(); o.position.copy(pos); o.rotation.set(rx, ry, rz, 'YXZ'); par.add(o); return o; };
  const DOSI = { x: 6.0, y: 137.6, z: 7.2, ry: 0.2, rx: -0.32, rz: -0.16 }; // cm do modelo (repouso)
  const anchors = {
    shoulderL: mk(chest, relTo(B.Spine2, [DOSI.x, DOSI.y, DOSI.z]), DOSI.ry, DOSI.rx, DOSI.rz),
    shoulderR: mk(chest, relTo(B.Spine2, [-DOSI.x, DOSI.y, DOSI.z]), -DOSI.ry, DOSI.rx, -DOSI.rz),
    earL: head?.anchors?.earL || earL, earR: head?.anchors?.earR || earR,
    head: head?.anchors?.head || mk(headH, hp(0, 160, -3)),
  };

  // ── pose ──
  const tq = new THREE.Quaternion(), pq = new THREE.Quaternion();
  const wpos = (b) => b.getWorldPosition(V3());
  const W = (x, y, z) => V3(x, y, z).applyQuaternion(gq);  // direção no corpo → mundo
  function setWQ(bone, q) { bone.parent.getWorldQuaternion(pq); bone.quaternion.copy(pq.invert().multiply(q)); bone.updateMatrixWorld(true); }
  function aim(bone, child, target, k = 1) {
    const bp = wpos(bone), cur = wpos(child).sub(bp).normalize(), des = target.clone().sub(bp).normalize();
    const d = new THREE.Quaternion().setFromUnitVectors(cur, des); if (k < 1) d.slerp(new THREE.Quaternion(), 1 - k);
    bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(d));
  }
  function rotW(bone, axisW, ang) { bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(new THREE.Quaternion().setFromAxisAngle(axisW, ang))); }
  function ik(side, target, pole) {
    const ua = B[side + '_UpperArm'], fa = B[side + '_Forearm'], ha = B[side + '_Hand'];
    const s = wpos(ua), a = wpos(fa).distanceTo(s), b = wpos(ha).distanceTo(wpos(fa));
    const dv = target.clone().sub(s), d = Math.min(dv.length(), (a + b) * 0.985), dir = dv.normalize();
    const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
    const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    aim(ua, fa, s.clone().add(dir.clone().multiplyScalar(along)).add(perp.multiplyScalar(h)));
    aim(fa, ha, s.clone().add(dir.multiplyScalar(d)));
  }
  // Dedos: dobra no eixo LOCAL de cada falange (biped do Rocketbox: o eixo de flexão é o mesmo em todas), evitando a
  // "garra" que surgia com eixos calculados no mundo. Ângulos [proximal, média, distal] em rad.
  const _fq = new URLSearchParams(location.search);
  const F_AX = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) }[_fq.get('fax') || 'z'], F_SG = +(_fq.get('fsg') || 1);
  const T_AX = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) }[_fq.get('tax') || 'z'], T_SG = +(_fq.get('tsg') || 1);
  const _q = new THREE.Quaternion();
  function finger(side, f, angs, axis = F_AX, sg = F_SG) {
    ['', '1', '2'].forEach((k, i) => { const b = B[side + '_Finger' + f + k]; if (b && angs[i]) { b.quaternion.multiply(_q.setFromAxisAngle(axis, sg * angs[i])); } });
  }
  function handPose(side, point, k = 1) { // point: 1 = indicador apontando; 0 = mão relaxada
    const P = (a, r) => a.map((x, i) => (x * point + r[i] * (1 - point)) * k);
    finger(side, '1', P([0.12, 0.08, 0.05], [0.35, 0.45, 0.3]));        // indicador
    finger(side, '2', P([1.35, 1.45, 0.85], [0.45, 0.55, 0.35]));       // médio
    finger(side, '3', P([1.45, 1.5, 0.85], [0.5, 0.6, 0.35]));          // anelar
    finger(side, '4', P([1.5, 1.45, 0.8], [0.55, 0.6, 0.35]));          // mínimo
    finger(side, '0', P([0.35, 0.55, 0.35], [0.15, 0.25, 0.15]), T_AX, T_SG); // polegar recolhido sobre o médio
    B[side + '_Hand']?.updateMatrixWorld(true);
  }
  const headFwdLocal = V3(0, 0, 1).applyQuaternion(gq).applyQuaternion(B.Head.getWorldQuaternion(new THREE.Quaternion()).invert());
  const lidRest = ['LEyeBlinkTop', 'REyeBlinkTop'].map((n) => B[n]).filter(Boolean);

  function button() { const pb = app?.machines?.panelButton; if (pb?.isObject3D) return pb.getWorldPosition(V3()); if (pb?.isVector3) return pb.clone(); return BTN_DEFAULT.clone(); }
  // ── MOVIMENTO: ciclo de trabalho procedural (sem clips de animação), tudo misturado suavemente ──
  // fases: 'digitar' (mão vai de tecla em tecla e aperta), 'tela' (confere a tela), 'prensa' (baixa o braço, vira o tronco
  // e a cabeça para a prensa), 'apoio' (braços baixos, troca o apoio das pernas). Atividades: operando | parada | olhando.
  let activity = 'operando', t0 = 0, blinkT = 2.5, blink = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const KEYS = [[0, 0], [0.032, 0], [-0.03, -0.034], [0, -0.034], [0.032, -0.068], [-0.03, 0.03], [0.016, -0.1]];
  let phase = 'digitar', phaseT = 0, phaseDur = rnd(5, 7), keyI = 0, keyT = 0, keyDur = 0.7, pressK = 0;
  const S = { arm: 1, turn: 0, shift: 0, lookAt: V3(1.5, 1.6, 0.2), key: V3(), keyInit: false, idleLook: V3(1.5, 1.5, 0.3), idleT: 0 };
  function nextPhase() {
    const seq = { digitar: Math.random() < 0.6 ? 'tela' : 'prensa', tela: Math.random() < 0.5 ? 'digitar' : 'prensa', prensa: Math.random() < 0.25 ? 'apoio' : 'digitar', apoio: 'digitar' };
    phase = seq[phase] || 'digitar'; phaseT = 0;
    phaseDur = { digitar: rnd(4.5, 7.5), tela: rnd(1.8, 3.0), prensa: rnd(2.0, 3.2), apoio: rnd(2.0, 3.0) }[phase];
  }
  const sm = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
  const smV = (cur, tgt, rate, dt) => cur.lerp(tgt, 1 - Math.exp(-rate * dt));
  const PRESS_POS = V3(0.62, 1.12, 0.32);               // 'conferir': olha os seletores/botões de baixo do painel (rosto visível)
  function update(dt, t) {
    t0 += dt; dt = Math.min(dt, 0.1);
    for (const [b, qr] of rest) b.quaternion.copy(qr);
    for (const b of lidRest) b.position.copy(restPos.get(b));
    group.updateMatrixWorld(true);
    const op = activity === 'operando';
    // diretor de fases
    if (op) { phaseT += dt; if (phaseT > phaseDur) nextPhase(); } else phase = 'apoio';
    const armT = op && (phase === 'digitar' || phase === 'tela' || phase === 'prensa') ? 1 : 0; // na prensa só a cabeça vira; a mão fica no painel
    const turnT = op && phase === 'prensa' ? 1 : 0;
    S.arm = sm(S.arm, armT, armT ? 2.6 : 2.0, dt);
    S.turn = sm(S.turn, turnT, 1.8, dt);
    const shiftT = Math.sin(t0 * 2 * Math.PI / 9.5) * (phase === 'apoio' ? 1 : 0.45);
    S.shift = sm(S.shift, shiftT, 1.5, dt);
    const br = Math.sin(t0 * 2 * Math.PI / 4.3);
    const side = W(1, 0, 0), fwd = W(0, 0, 1), up = V3(0, 1, 0);
    const armW = S.arm, turn = S.turn;
    // tronco: giro para a câmera quando opera; para a prensa (esquerda, +yaw) quando confere a peça; troca de apoio (rolagem)
    rotW(B.Pelvis, up, -0.12 * armW + 0.05 * turn + 0.03 * Math.sin(t0 * 0.21));
    rotW(B.Pelvis, fwd, 0.035 * S.shift);
    rotW(B.Spine1, side, 0.03 + 0.06 * armW + br * 0.012);
    rotW(B.Spine1, up, -0.17 * armW + 0.05 * turn);
    rotW(B.Spine1, fwd, -0.028 * S.shift);
    rotW(B.Spine2, side, 0.02 + 0.03 * armW + br * 0.016);
    rotW(B.Spine2, up, -0.2 * armW + 0.08 * turn + Math.sin(t0 * 0.37) * 0.012);
    for (const [cal, sg] of [[B.L_Calf, 1], [B.R_Calf, -1]]) if (cal) rotW(cal, side, -0.07 * Math.max(0, sg * S.shift)); // joelho da perna sem apoio dobra
    if (B.R_Clavicle) rotW(B.R_Clavicle, W(0, 0, 1), -0.12 * armW + br * 0.006);
    if (B.L_Clavicle) rotW(B.L_Clavicle, W(0, 0, 1), br * 0.006);
    // aproxima do painel só o necessário para alcançar a tecla
    { const bx = button().x, shx = wpos(B.R_UpperArm).x;
      group.position.x = Math.max(0, Math.min(0.12, group.position.x + ((bx - 0.40 - shx)) * armW * Math.min(1, dt * 3))); group.updateMatrixWorld(true); }
    const btnL = button(); btnL.y = Math.min(btnL.y, 1.68);
    // olhar: tecla → tela → prensa; parada: passeia o olhar; olhando: câmera
    const look = V3();
    if (activity === 'olhando' && stage.camera) look.copy(stage.camera.position);
    else if (op && phase === 'digitar' && S.keyInit) look.copy(S.key).add(V3(0, 0.03, 0));
    else if (op && phase === 'tela') look.copy(btnL).addScaledVector(V3(0, 1, 0), 0.09);
    else if (op && phase === 'prensa') look.copy(PRESS_POS);
    else {
      S.idleT -= dt; if (S.idleT < 0) { S.idleT = rnd(1.5, 3.5); const opts = [V3(2.5, 1.5, 0.4), PRESS_POS, V3(2.0, 1.45, 2.2), V3(3.0, 1.55, -0.6), btnL];
        S.idleLook.copy(opts[Math.floor(Math.random() * opts.length)]); }
      look.copy(S.idleLook);
    }
    smV(S.lookAt, look, 4, dt); look.copy(S.lookAt);
    { const hp0 = wpos(B.Head).add(V3(0, 0.09, 0)), dv = look.clone().sub(hp0), hz = Math.hypot(dv.x, dv.z), mx = hz * Math.tan(0.24);
      if (dv.y > mx) look.y = hp0.y + mx;
      // giro horizontal limitado a ±70° em relação à frente do corpo (pescoço real)
      const bf = W(0, 0, 1); bf.y = 0; bf.normalize(); const h2 = V3(dv.x, 0, dv.z).normalize();
      const ang = Math.atan2(bf.x * h2.z - bf.z * h2.x, bf.dot(h2)), lim = 1.22;
      if (Math.abs(ang) > lim) { const r = h2.clone().applyAxisAngle(V3(0, 1, 0), -(ang - Math.sign(ang) * lim)); look.x = hp0.x + r.x * hz; look.z = hp0.z + r.z * hz; } }                                         // queixo quase nivelado: olhar sobe no máx. ~14°
    for (const [bone, k] of [[B.Neck, 0.25], [B.Head, 1]]) {
      const hpw = wpos(B.Head).add(V3(0, 0.09, 0));
      const fwdH = headFwdLocal.clone().applyQuaternion(B.Head.getWorldQuaternion(tq)).normalize();
      const d = new THREE.Quaternion().setFromUnitVectors(fwdH, look.clone().sub(hpw).normalize()); d.slerp(new THREE.Quaternion(), 1 - k);
      bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(d));
    }
    // braço esquerdo: relaxado; ao conferir a prensa, a mão sobe um pouco à frente (gesto de checar a peça)
    { const sl = wpos(B.L_UpperArm);
      aim(B.L_UpperArm, B.L_Forearm, sl.clone().add(W(0.12, -1, 0.04).normalize()));
      aim(B.L_Forearm, B.L_Hand, wpos(B.L_Forearm).add(W(0.08, -1, 0.28).normalize())); }
    // braço direito: mistura entre "baixo" e "na tecla atual" (IK)
    const btnP = button(), btn = btnP.clone(); btn.y = Math.min(btn.y, 1.68);
    const nOut = V3(0.4, 0, 0.18).sub(V3(btn.x, 0, btn.z)).normalize(); // da tecla para ela (normal aproximada da face do painel)
    const kRight = V3(0, 1, 0).cross(nOut).normalize(), kUp = V3(0, 1, 0);
    if (op && phase === 'digitar') {
      keyT += dt;
      if (keyT > keyDur) { keyT = 0; keyDur = rnd(0.45, 0.9); keyI = (keyI + 1 + Math.floor(Math.random() * 3)) % KEYS.length; }
      pressK = keyT > keyDur * 0.55 ? Math.sin(Math.min(1, (keyT - keyDur * 0.55) / (keyDur * 0.4)) * Math.PI) : 0;
    } else { pressK = sm(pressK, 0, 8, dt); }
    const [kx, ky] = phase === 'tela' ? [0.0, 0.02] : KEYS[keyI];
    const keyTarget = btn.clone().addScaledVector(kRight, kx).addScaledVector(kUp, ky).addScaledVector(nOut, -0.014 * pressK);
    if (!S.keyInit) { S.key.copy(keyTarget); S.keyInit = true; }
    smV(S.key, keyTarget, 9, dt);
    const fdir = V3(0.5, 0.85, -0.08).normalize();
    const wristUp = S.key.clone().sub(fdir.clone().multiplyScalar(0.165 * HAND_K));
    wristUp.y += Math.sin(t0 * 1.3) * 0.002;
    const sr = wpos(B.R_UpperArm), wristDown = sr.clone().add(W(-0.06, -0.5, 0.1));
    const wrist = wristDown.clone().lerp(wristUp, armW);
    if (armW > 0.02) wrist.y += Math.sin(Math.PI * armW) * 0.05;            // arco natural ao subir/descer
    ik('R', wrist, W(-0.55, -0.8, 0.15).lerp(W(-0.15, -0.2, -1), 1 - armW).normalize());
    if (armW <= 0.35) handPose('R', 0);
    handPose('L', 0);
    if (armW > 0.35) {
      aim(B.R_Hand, B.R_Finger1, S.key, Math.min(1, (armW - 0.35) / 0.4));
      handPose('R', Math.min(1, (armW - 0.35) / 0.4));
    }
    // piscar (desce as pálpebras superiores ~6 mm por 0,12 s)
    blinkT -= dt; if (blinkT < 0) { blink = 0.14; blinkT = 2.5 + Math.random() * 3.5; }
    if (blink > 0) { blink -= dt; const k = Math.sin(Math.max(0, blink) / 0.14 * Math.PI);
      for (const b of lidRest) { b.parent.updateWorldMatrix(true, false); const inv = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); const s = b.parent.getWorldScale(V3()).x;
        b.position.add(V3(0, -0.0055 * k, 0.001 * k).applyQuaternion(inv).divideScalar(s)); } }
    try { head?.update?.(dt, t); } catch (e) { /* módulo do rosto */ }
  }
  update(0, 0);

  return { group, anchors, update, setActivity(name) { activity = name; }, get phase() { return phase; },
    setPhase(p, hold = 99) { phase = p; phaseT = 0; phaseDur = hold; },
    debug: () => { // ponta do microfone (0,09 m acima do centro, +y local) × canal auditivo do mesmo lado (NHO-01: 100–200 mm)
      const r = {}; for (const s of ['L', 'R']) { const a = anchors['shoulder' + s]; a.updateWorldMatrix(true, false);
        const m = a.localToWorld(V3(0, 0.09, 0)), e = anchors['ear' + s].getWorldPosition(V3()), d = m.distanceTo(e);
        r[s] = { mic: m.toArray().map((v) => +v.toFixed(4)), ear: e.toArray().map((v) => +v.toFixed(4)), mm: Math.round(d * 1000), zona: d >= 0.1 && d <= 0.2 }; }
      return { mic: r.L.mic, ear: r.L.ear, d: r.L.mm / 1000, micEar_mm: r.L.mm, zonaAuditiva: r.L.zona, R: r.R }; } };
}
