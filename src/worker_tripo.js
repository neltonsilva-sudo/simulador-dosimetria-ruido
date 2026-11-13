// TRABALHADORA — avatar Tripo (assets/operadora/modelo_mulher_operadora_rig.glb), gerado a partir da foto de referência.
// Integração mínima: preserva malha, esqueleto, skinning, materiais e proporções do GLB. Aplica só uma POSTURA estática
// (a da foto — não é animação): tronco girado ~15° para a câmera (+z), braço direito em L até app.machines.panelButton
// (IK de 2 ossos + distribuição do giro do punho nos twist bones), braço esquerdo baixo, cabeça olhando o ponto tocado
// (pitch ≤ 15°). Sem respiração/balanço procedural: um AnimationMixer toca os clips 'idle'/'walk' se existirem no GLB.
// Gancho de materiais: src/worker_tripo_mat.js → upgradeTripo({THREE, stage, app, root, skinned, bones, headBone}).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const URL_GLB = new URL('../assets/operadora/modelo_mulher_operadora_rig.glb', import.meta.url).href;
const HEIGHT = 1.65;
const BTN_DEFAULT = new THREE.Vector3(0.5, 1.64, 0.14);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// pontos anatômicos no espaço da malha (altura normalizada 0..1, frente +x, direita dela +z) — medidos no GLB
const EAR = V3(-0.006, 0.893, 0.052);      // entrada do canal auditivo (lado direito; esquerdo = z negado)
const SHOULDER = V3(0.036, 0.798, 0.068);  // centro do aparelho preso à frente da costura do ombro do colete
const SHOULDER_YAW = 0.42;                 // tela do aparelho voltada para frente-fora

export async function buildWorkerTripo(stage, app) {
  const gltf = await new GLTFLoader().loadAsync(URL_GLB);
  const root = gltf.scene;
  let skinned = null; root.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  if (!skinned) throw new Error('GLB sem SkinnedMesh');
  const geo = skinned.geometry; geo.computeBoundingBox();
  const bb = geo.boundingBox, rawH = bb.max.y - bb.min.y;

  const group = new THREE.Group(); group.name = 'trabalhadora_tripo';
  group.scale.setScalar(HEIGHT / rawH);
  root.position.y = -bb.min.y; // pés no piso
  group.add(root);
  group.updateMatrixWorld(true);

  const skel = skinned.skeleton;
  const bones = {}; for (const b of skel.bones) bones[b.name] = b;
  const B = (n) => bones[n];
  const headBone = B('Head');
  const rest = skel.bones.map((b) => [b, b.quaternion.clone()]);
  const gq = skinned.getWorldQuaternion(new THREE.Quaternion()); // eixos do corpo (espaço da malha) no mundo
  const M2W = (p) => p.clone().applyMatrix4(skinned.matrixWorld);
  const D2W = (d) => d.clone().applyQuaternion(gq).normalize();

  // ── medidas do próprio GLB: comprimento da mão (punho → ponta dos dedos) por lado ──
  const P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const handLen = {};
  for (const sd of ['L', 'R']) {
    const hi = skel.bones.indexOf(B(sd + '_Hand')), fi = skel.bones.indexOf(B(sd + '_Forearm'));
    const hp = B(sd + '_Hand').getWorldPosition(V3()), dir = hp.clone().sub(B(sd + '_Forearm').getWorldPosition(V3())).normalize();
    let mx = 0; const v = V3();
    for (let i = 0; i < P.count; i++) {
      let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; bi = SI.getComponent(i, k); } }
      if (bi !== hi && bi !== fi) continue;
      v.fromBufferAttribute(P, i).applyMatrix4(skinned.matrixWorld); mx = Math.max(mx, v.sub(hp).dot(dir));
    }
    handLen[sd] = mx || 0.17;
  }

  // ── gancho de MATERIAIS (outro agente): em pose de repouso, para poder prender cabelo/EPI aos ossos ──
  let mat = null;
  try { const MM = await import('./worker_tripo_mat.js'); mat = await MM.upgradeTripo({ THREE, stage, app, root, skinned, bones, headBone }); }
  catch (e) { mat = null; if (!/Failed to fetch|Cannot find|404|dynamically imported/i.test(String(e))) console.warn('[worker_tripo] materiais:', e); }

  // ── âncoras (CONTRACT): objetos presos aos ossos, escala de mundo 1 ──
  function anchorOn(bone, meshPt, yaw = 0) {
    const o = new THREE.Object3D(); bone.updateWorldMatrix(true, false);
    o.position.copy(bone.worldToLocal(M2W(meshPt)));
    const bq = bone.getWorldQuaternion(new THREE.Quaternion()), s = bone.getWorldScale(V3());
    o.quaternion.copy(bq.invert().multiply(gq).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), yaw)));
    o.scale.set(1 / s.x, 1 / s.y, 1 / s.z); bone.add(o); return o;
  }
  const mirror = (p) => V3(p.x, p.y, -p.z);
  // +z da âncora = para fora do corpo: frente (+x da malha) girada para o lado do ombro
  const anchors = {
    shoulderR: anchorOn(B('Spine02'), SHOULDER, Math.PI / 2 - SHOULDER_YAW),
    shoulderL: anchorOn(B('Spine02'), mirror(SHOULDER), Math.PI / 2 + SHOULDER_YAW),
    earR: anchorOn(headBone, EAR, Math.PI / 2), earL: anchorOn(headBone, mirror(EAR), Math.PI / 2),
    head: anchorOn(headBone, V3(0.0, 0.9, 0), Math.PI / 2),
  };
  for (const [k, o] of Object.entries(anchors)) o.name = 'anchor_' + k;
  if (mat?.anchors) for (const k of ['earL', 'earR', 'head']) if (mat.anchors[k]) anchors[k] = mat.anchors[k];

  // ── AnimationMixer: toca 'idle'/'walk' se o GLB tiver (hoje não tem) ──
  const mixer = new THREE.AnimationMixer(root);
  const clip = (re) => gltf.animations.find((c) => re.test(c.name));
  const clips = { idle: clip(/idle/i), walk: clip(/walk/i) };
  let action = null;
  function play(name) {
    const c = clips[name]; if (!c) return false; const a = mixer.clipAction(c);
    if (action && action !== a) a.crossFadeFrom(action, 0.4, false); a.reset().play(); action = a; return true;
  }
  play('idle');

  // ── ferramentas de pose (espaço do mundo) ──
  const tq = new THREE.Quaternion(), pq = new THREE.Quaternion();
  const wpos = (b) => b.getWorldPosition(V3());
  function setWQ(bone, q) { bone.parent.getWorldQuaternion(pq); bone.quaternion.copy(pq.invert().multiply(q)); bone.updateMatrixWorld(true); }
  function rotW(bone, axisW, ang) { bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(new THREE.Quaternion().setFromAxisAngle(axisW, ang))); }
  function aim(bone, child, target) {
    const bp = wpos(bone), cur = wpos(child).sub(bp).normalize(), des = target.clone().sub(bp).normalize();
    bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(new THREE.Quaternion().setFromUnitVectors(cur, des)));
  }
  function ik2(sd, wrist, pole) {
    const ua = B(sd + '_Upperarm'), fa = B(sd + '_Forearm'), ha = B(sd + '_Hand');
    const s = wpos(ua), a = wpos(fa).distanceTo(s), b = wpos(ha).distanceTo(wpos(fa));
    const dv = wrist.clone().sub(s), d = Math.min(dv.length(), (a + b) * 0.995), dir = dv.normalize();
    const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
    const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    aim(ua, fa, s.clone().addScaledVector(dir, along).addScaledVector(perp, h));
    aim(fa, ha, s.clone().addScaledVector(dir, d));
  }
  // base ortonormal (dedos f, normal da palma n) → quaternion; usada no bind e no alvo (mesma quiralidade)
  const basisQ = (f, n) => { const z = f.clone().normalize(), x = n.clone().sub(z.clone().multiplyScalar(n.dot(z))).normalize(), y = z.clone().cross(x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
  // mão no bind (T-pose do GLB): dedos ao longo do braço (±z da malha), palma para a frente (+x)
  const handBind = {};
  for (const sd of ['L', 'R']) handBind[sd] = { q: B(sd + '_Hand').getWorldQuaternion(new THREE.Quaternion()), f: D2W(V3(0, 0, sd === 'R' ? 1 : -1)), n: D2W(V3(1, 0, 0)) };
  const twistAxis = new THREE.Vector3(0, 1, 0); // eixo do osso (filhos ao longo de +y local)
  function orientHand(sd, fW, nW) {
    const hb = handBind[sd], ha = B(sd + '_Hand'), fa = B(sd + '_Forearm');
    const qBind = basisQ(hb.f, hb.n), qDes = basisQ(fW, nW);
    const qW = qDes.multiply(qBind.invert()).multiply(hb.q);
    // giro do punho em torno do antebraço → metade vai para os twist bones (antebraço acompanha a pele, sem "bala de papel")
    fa.getWorldQuaternion(tq); const loc = tq.clone().invert().multiply(qW);
    const p = V3(loc.x, loc.y, loc.z).projectOnVector(twistAxis);
    let ang = 2 * Math.atan2(p.dot(twistAxis), loc.w); if (ang > Math.PI) ang -= 2 * Math.PI; if (ang < -Math.PI) ang += 2 * Math.PI;
    for (const [n, k] of [[sd + '_ForearmTwist01', 0.25], [sd + '_ForearmTwist02', 0.6]]) { const b = B(n); if (b) { b.quaternion.setFromAxisAngle(twistAxis, ang * k); b.updateMatrixWorld(true); } }
    setWQ(ha, qW);
  }

  function button() { const pb = app?.machines?.panelButton; if (pb?.isObject3D) return pb.getWorldPosition(V3()); if (pb?.isVector3) return pb.clone(); return BTN_DEFAULT.clone(); }
  const headFwdLocal = D2W(V3(1, 0, 0)).applyQuaternion(headBone.getWorldQuaternion(new THREE.Quaternion()).invert());
  const UP = V3(0, 1, 0);
  const FR = V3(0.5, 0.85, -0.12).normalize(); // dedos da mão direita ao tocar (para cima/frente)

  // braço do GLB é curto (úmero 0,205 m, antebraço 0,177 m; anatômico p/ 1,65 m ≈ 0,29/0,235): alonga os ossos
  // transladando cotovelo/punho e os twist bones intermediários (estica a pele de modo uniforme, sem cisalhamento)
  const EXT = { U: 1.24, F: 1.18 };
  const lenRest = [];
  for (const sd of ['L', 'R']) for (const [n, k] of [['_Forearm', EXT.U], ['_UpperarmTwist02', EXT.U], ['_Hand', EXT.F], ['_ForearmTwist02', EXT.F]]) {
    const b = B(sd + n); if (b) lenRest.push([b, b.position.clone(), k]);
  }
  // alvo do toque: tecla do teclado de membrana uma fileira abaixo do panelButton (mesma face do console)
  function touchPoint() {
    const pb = app?.machines?.panelButton;
    if (pb?.isObject3D && pb.parent) { pb.parent.updateWorldMatrix(true, false); return pb.parent.localToWorld(pb.position.clone().add(V3(0, -0.026, 0))); }
    return button();
  }
  function screenPoint() { // centro da tela do console (para onde ela olha)
    const pb = app?.machines?.panelButton;
    if (pb?.isObject3D && pb.parent) return pb.parent.localToWorld(V3(-0.1, 0.185, 0.058));
    return button();
  }

  let activity = 'operando', dirty = true, lastBtn = V3(1e9, 0, 0), lastCam = V3(1e9, 0, 0);
  function pose() {
    if (!action) for (const [b, q] of rest) b.quaternion.copy(q);
    for (const [b, p, k] of lenRest) b.position.copy(p).multiplyScalar(k);
    group.position.set(0, 0, 0); group.updateMatrixWorld(true);
    const op = activity === 'operando';
    const fwd = D2W(V3(1, 0, 0)), side = D2W(V3(0, 0, 1)); // frente e direita dela
    // tronco ereto: ~15° para a câmera (+z), repartido entre cintura e coluna; ~5° para o painel ao operar
    const yaw = op ? -0.27 : -0.1;
    rotW(B('Waist'), UP, yaw * 0.25); rotW(B('Spine01'), UP, yaw * 0.35); rotW(B('Spine02'), UP, yaw * 0.4);
    if (op) { rotW(B('Waist'), side, -0.035); rotW(B('Spine01'), side, -0.03); rotW(B('Spine02'), side, -0.025); }
    // folga ao gabinete do painel: ela não avança além de XMAX (frente do corpo ~0,15 m da base); se o braço não alcança
    // com o úmero a ~14°, o tronco inclina um pouco mais para o painel (pés plantados, giro só da cintura para cima)
    const XMAX = -0.05, TH = THREE.MathUtils.degToRad(14);
    const needX = () => { const btn = touchPoint(), wrist = btn.clone().addScaledVector(FR, -handLen.R * 0.97);
      const sh = wpos(B('R_Upperarm')), ua = sh.distanceTo(wpos(B('R_Forearm'))), fa = wpos(B('R_Forearm')).distanceTo(wpos(B('R_Hand')));
      const eY = sh.y + ua * Math.sin(TH), dyF = Math.min(fa * 0.97, Math.max(0, wrist.y - eY));
      const Dh = ua * Math.cos(TH) + Math.sqrt(fa * fa - dyF * dyF), dz = wrist.z - sh.z;
      return wrist.x - sh.x - Math.sqrt(Math.max(0.01, Dh * Dh - dz * dz)); };
    if (op) { const ex = needX() - XMAX; if (ex > 0) { const ang = Math.min(0.16, Math.asin(Math.min(1, ex / 0.34)));
      rotW(B('Waist'), side, -ang * 0.45); rotW(B('Spine01'), side, -ang * 0.35); rotW(B('Spine02'), side, -ang * 0.2); } }

    // braço esquerdo: baixo e relaxado junto ao corpo, palma para a coxa
    const fL = side.clone().negate();
    { const s = wpos(B('L_Upperarm'));
      ik2('L', s.clone().addScaledVector(UP, -0.36).addScaledVector(fwd, 0.06).addScaledVector(fL, 0.035), fwd.clone().negate().addScaledVector(fL, 0.4));
      orientHand('L', UP.clone().negate().addScaledVector(fwd, 0.15), side.clone()); }

    const look = V3();
    if (op) {
      const btn = touchPoint();
      if (B('R_Clavicle')) rotW(B('R_Clavicle'), UP, 0.16); // ombro avança um pouco ao estender o braço (sem encolher)
      // dedo indicador para cima/frente até o ponto tocado; punho logo abaixo
      const fR = FR, wrist = btn.clone().addScaledVector(fR, -handLen.R * 0.97);
      // distância ao painel escolhida para o úmero sair ~14° acima da horizontal e o antebraço subir até a tela
      group.position.x = THREE.MathUtils.clamp(needX(), -0.15, XMAX); group.updateMatrixWorld(true);
      ik2('R', wrist, V3(-0.2, -1, 0.35).normalize());
      orientHand('R', fR, V3(1, -0.5, 0.05).normalize());                         // palma voltada para o painel
      look.copy(screenPoint()).lerp(btn, 0.35);
    } else {
      const s = wpos(B('R_Upperarm'));
      ik2('R', s.clone().addScaledVector(UP, -0.36).addScaledVector(fwd, 0.06).addScaledVector(side, 0.035), fwd.clone().negate().addScaledVector(side, 0.4));
      orientHand('R', UP.clone().negate().addScaledVector(fwd, 0.15), side.clone().negate());
      if (activity === 'olhando' && stage.camera) look.copy(stage.camera.position); else look.copy(wpos(headBone)).addScaledVector(fwd, 2);
    }
    // cabeça: pescoço 25 % + 33 %, cabeça o resto; pitch limitado a 12°
    const eye = wpos(headBone).addScaledVector(UP, 0.12), dv = look.clone().sub(eye), hz = Math.hypot(dv.x, dv.z);
    const maxUp = hz * Math.tan(THREE.MathUtils.degToRad(12)); if (dv.y > maxUp) look.y = eye.y + maxUp;
    if (dv.y < -hz * 0.6) look.y = eye.y - hz * 0.6;
    for (const [bn, k] of [['NeckTwist01', 0.25], ['NeckTwist02', 0.33], ['Head', 1]]) {
      const bone = B(bn); if (!bone) continue;
      const f = headFwdLocal.clone().applyQuaternion(headBone.getWorldQuaternion(tq)).normalize();
      const e = wpos(headBone).addScaledVector(UP, 0.12);
      const d = new THREE.Quaternion().setFromUnitVectors(f, look.clone().sub(e).normalize()); d.slerp(new THREE.Quaternion(), 1 - k);
      bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(d));
    }
    group.updateMatrixWorld(true);
  }

  stage.scene.add(group);
  function update(dt, t) {
    if (action) { mixer.update(dt); dirty = true; }
    const btn = activity === 'operando' ? touchPoint() : null;
    if (btn && btn.distanceToSquared(lastBtn) > 1e-8) { lastBtn.copy(btn); dirty = true; }
    if (activity === 'olhando' && stage.camera && stage.camera.position.distanceToSquared(lastCam) > 1e-6) { lastCam.copy(stage.camera.position); dirty = true; }
    if (dirty) { pose(); dirty = false; }
    try { mat?.update?.(dt, t); } catch (e) { /* módulo de materiais */ }
  }
  update(0, 0);

  return {
    group, anchors, update, mixer, bones, headBone, skinned, avatar: 'tripo', materials: mat,
    setActivity(name) { if (name === activity) return; activity = name; dirty = true; if (clips.walk && name === 'andando') play('walk'); else if (clips.idle) play('idle'); },
    debug: () => {
      const m = anchors.shoulderL.localToWorld(V3(0, 0.09, 0)), e = anchors.earL.getWorldPosition(V3());
      const mR = anchors.shoulderR.localToWorld(V3(0, 0.09, 0)), eR = anchors.earR.getWorldPosition(V3());
      const rh = B('R_Hand'), hb = handBind.R, tip = wpos(rh).addScaledVector(hb.f.clone().applyQuaternion(rh.getWorldQuaternion(new THREE.Quaternion()).multiply(hb.q.clone().invert())), handLen.R);
      return { micL: m.toArray(), earL: e.toArray(), dL: m.distanceTo(e), dR: mR.distanceTo(eR), btn: button().toArray(), tipApprox: tip.toArray(),
        handLen, pos: group.position.toArray(), clips: gltf.animations.map((c) => c.name) };
    },
  };
}
