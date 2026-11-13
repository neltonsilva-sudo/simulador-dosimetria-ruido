// DOSÍMETRO 3D — DoseMax (corpo TPE azul, moldura preta, visor 1,8" 128×160, 4 teclas, LED, microfone ½" com espuma,
// clipe de lapela, alça inferior, mini USB) + maleta do kit. Dono: DOSÍMETRO 3D. Geometria em mm dentro de um grupo ×0,001.
// Interação no canvas principal: clique/segure nas teclas → fw.press(key, heldMs); segurar ≥ 3 s dispara a pressão longa na
// hora (sem esperar soltar). ⏻+☰ juntos: segure as duas (multi-touch) OU Shift+clique em ⏻ ou ☰ → fw.press('power+menu').
import * as THREE from 'three';
import { TABLE } from './layout_cams.js';
import { extrudeSmooth, roundRectArc, mirroredShape, samplePath, iconShapes, sweepYZ, roundedSection } from './dosi_geo.js';
import { rubberMaps, foamMaps, grilleTex, canvasTex, FONT, getEnvFallback, h2 } from './dosi_tex.js';
import { buildKitImpl } from './dosi_kit.js';

const MM = 0.001;
export const BLUE = 0x1e86e0;
export const LED_COL = { red: 0xff2a1a, yellow: 0xffc21a, blue: 0x2a7bff, green: 0x30ff60 };

/** material TPE azul emborrachado (compartilhado com o calibrador) */
export function rubberMat(color = BLUE, rough = 0.62, uvRep = 1 / 9) {
  const m = rubberMaps();
  const n = m.normal.clone(); n.repeat.set(uvRep, uvRep); n.needsUpdate = true;
  const r = m.rough.clone(); r.repeat.set(uvRep / 6, uvRep / 6); r.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, roughnessMap: r, normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35),
    sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x9cc8ff), clearcoat: 0.08, clearcoatRoughness: 0.5 });
}
/** quadro da maleta → âncora de mundo (pos em mm no espaço da maleta, deitado com +y do aparelho para o fundo) */
export function kitHome(stage, local, name) {
  const o = new THREE.Object3D(); o.name = name;
  const base = new THREE.Vector3(TABLE.pos[0], TABLE.h, TABLE.pos[2]);
  o.position.copy(new THREE.Vector3(...local).multiplyScalar(MM).applyAxisAngle(new THREE.Vector3(0, 1, 0), TABLE.rotY || 0).add(base));
  o.rotation.set(-Math.PI / 2, TABLE.rotY || 0, 0, 'YXZ'); stage.scene.add(o); return o;
}
export const KIT_LOCAL = { dosimeter: [-115, 64.5, 5], calibrator: [-15, 66.5, 0] };

/** ambiente de reflexo de reserva enquanto a cena não tiver environment */
export function envGuard(stage, mats) {
  let fb = null, applied = false;
  if (!stage.scene.environment && stage.renderer) getEnvFallback(stage.renderer).then((t) => (fb = t)).catch(() => {});
  return () => {
    const has = !!stage.scene.environment;
    if (!has && fb && !applied) { mats.forEach((m) => { m.envMap = fb; m.envMapIntensity = 0.8; m.needsUpdate = true; }); applied = true; }
    if (has && applied) { mats.forEach((m) => { m.envMap = null; m.needsUpdate = true; }); applied = false; }
  };
}
/** contorno pulsante (casca invertida) para highlight */
function outlineOf(mesh, color = 0xffd54a, grow = 1.0) {
  const g = mesh.geometry; g.computeBoundingBox(); const bb = g.boundingBox, s = new THREE.Vector3(); bb.getSize(s);
  const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  o.scale.set((s.x + 2 * grow) / s.x, (s.y + 2 * grow) / s.y, (s.z + grow) / s.z); o.visible = false; o.renderOrder = 2; o.userData.noAO = true;
  mesh.add(o); return o;
}

export function buildDosimeter(stage, fw, app) {
  const group = new THREE.Group(); group.name = 'DoseMax';
  const B = new THREE.Group(); B.scale.setScalar(MM); group.add(B);
  const add = (geo, mat, parent = B, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };

  // ── corpo TPE azul (60 × 96 × 23 mm; ombros que abraçam a espuma; afina embaixo) ──
  const half = samplePath([
    [[0, -48], [10, -48]], [[10, -48], [20, -48], [24, -44], [25, -36]], [[25, -36], [27, -24], [30, -8], [30, 10]],
    [[30, 10], [30, 37]], [[30, 37], [30, 46], [28, 48], [21, 48]], [[21, 48], [17.5, 48]], [[17.5, 48], [14, 48], [12.5, 40], [0, 40]]], 16);
  const bodyMat = rubberMat();
  const body = add(extrudeSmooth(mirroredShape(half), 23, { bt: 4.2, bs: 3.6, seg: 7 }), bodyMat); body.name = 'corpo';
  // linha de partição (costura do molde) em volta do corpo
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x0f4f8f, roughness: 0.8 });

  // ── moldura preta frontal (serigrafia "DoseMax" + rótulo genérico) ──
  const bez = samplePath([[[0, -43.5], [9, -43.5]], [[9, -43.5], [16, -43.5], [19.5, -40], [20, -33]], [[20, -33], [20.6, 20]],
    [[20.6, 20], [20.6, 25.5], [19, 25.5], [15, 25.5]], [[15, 25.5], [0, 25.5]]], 12);
  const bezTex = canvasTex(412, 690, (g, w, h) => {
    g.fillStyle = '#16181b'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, 'rgba(255,255,255,0.04)'); grd.addColorStop(1, 'rgba(0,0,0,0.05)'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.font = `700 40px ${FONT}`; g.textBaseline = 'middle';
    const t1 = 'Dose', t2 = 'Max', w1 = g.measureText(t1).width, w2 = g.measureText(t2).width, x0 = w / 2 - (w1 + w2) / 2;
    g.fillStyle = '#f4f6f8'; g.fillText(t1, x0, 55); g.fillStyle = '#2f9bff'; g.fillText(t2, x0 + w1, 55);
    g.font = `700 25px ${FONT}`; g.fillStyle = '#eef1f4'; g.textAlign = 'center'; g.fillText('Dosímetro de Ruído', w / 2, 657);
  });
  const bezMat = new THREE.MeshPhysicalMaterial({ map: bezTex, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35 });
  const bezel = add(extrudeSmooth(mirroredShape(bez), 1.6, { bt: 0.55, bs: 0.7, seg: 4, uv: 'planar' }), bezMat); bezel.position.z = 12.0; bezel.name = 'moldura';
  const FRONT = 12.8;

  // ── lente do visor (vidro preto c/ clearcoat) + tela emissiva (fw.canvas) com grade de subpixels ──
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 });
  const lens = add(extrudeSmooth(roundRectArc(33, 42, 2.2), 0.8, { bt: 0.3, bs: 0.35, seg: 3 }), lensMat, B, false);
  lens.position.set(0.4, -4.3, FRONT - 0.15);
  const tex = fw?.canvas ? new THREE.CanvasTexture(fw.canvas) : null;
  if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; }
  const scrMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.0,
    clearcoat: 1, clearcoatRoughness: 0.03, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  scrMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `
      #ifdef USE_EMISSIVEMAP
        vec4 emC = texture2D( emissiveMap, vEmissiveMapUv );
        vec2 pp = vEmissiveMapUv * vec2(128.0, 160.0);
        vec2 fwp = fwidth(pp); float k = clamp(1.0 - (max(fwp.x, fwp.y) - 0.12) / 0.3, 0.0, 1.0);
        float sx = fract(pp.x) * 3.0; vec3 mask = vec3(1.0 - smoothstep(0.85, 1.05, sx), smoothstep(0.95, 1.1, sx) * (1.0 - smoothstep(1.9, 2.1, sx)), smoothstep(1.95, 2.15, sx));
        float gap = smoothstep(0.0, 0.12, fract(pp.y)) * smoothstep(1.0, 0.88, fract(pp.y));
        emC.rgb = mix(emC.rgb, emC.rgb * mask * 2.6 * gap, k * 0.75);
        totalEmissiveRadiance *= emC.rgb;
      #endif`);
  };
  const screen = add(new THREE.PlaneGeometry(28.6, 35.7), scrMat, B, false); screen.position.set(0.4, -4.3, FRONT + 0.27); screen.name = 'tela';

  // ── teclas de borracha com ícones em relevo ──
  const keyMat = rubberMat(0x1b7fe0, 0.5, 1 / 4);
  const icoMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.55 });
  const keyGeo = extrudeSmooth(roundRectArc(7.8, 7.8, 2.0), 2.6, { bt: 0.9, bs: 0.9, seg: 4 });
  const keys = {}, keyOutline = {}, keyRest = {};
  ['power', 'play', 'stop', 'menu'].forEach((k, i) => {
    const m = add(keyGeo, keyMat); m.position.set(-13.5 + i * 9, -31.7, FRONT + 0.95); m.name = 'tecla_' + k; m.userData.key = k;
    const ig = new THREE.ExtrudeGeometry(iconShapes(k, 0.95), { depth: 0.28, bevelEnabled: false, curveSegments: 16 });
    const ic = new THREE.Mesh(ig, icoMat); ic.position.z = 1.28; ic.userData.key = k; m.add(ic);
    keys[k] = m; keyRest[k] = m.position.z; keyOutline[k] = outlineOf(m, 0xffd54a, 0.9);
  });
  // ── LED ──
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.15, emissive: 0x000000, emissiveIntensity: 3, toneMapped: false });
  const led = add(new THREE.SphereGeometry(1.15, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), ledMat, B, false);
  led.rotation.x = Math.PI / 2; led.scale.set(1, 0.45, 1); led.position.set(16.2, 20.6, FRONT); led.name = 'led';

  // ── microfone ½" (colar preto + cápsula niquelada com grade) ──
  const colMat = new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.5, clearcoat: 0.2 });
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0xc4c8cc, metalness: 1, roughness: 0.28 });
  const prof = [[0, 36], [9.2, 36], [9.2, 41.5], [8.6, 43.2], [7.6, 44], [7.4, 45.5]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(prof, 40), colMat);
  const cap = add(new THREE.LatheGeometry([[0, 45.5], [6.35, 45.5], [6.35, 52.6], [6.1, 53.3], [5.6, 53.5]].map(([r, y]) => new THREE.Vector2(r, y)), 40), capMat);
  const grill = add(new THREE.CircleGeometry(5.6, 40), new THREE.MeshStandardMaterial({ map: grilleTex(), metalness: 0.8, roughness: 0.35 }), B, false);
  grill.rotation.x = -Math.PI / 2; grill.position.y = 53.5;
  const mic = new THREE.Object3D(); mic.name = 'mic'; mic.position.set(0, 0.0536, 0); group.add(mic);

  // ── espuma (windscreen) esférica com poros ──
  const fm = foamMaps();
  const fN = fm.normal.clone(); fN.repeat.set(2, 1); fN.needsUpdate = true; const fC = fm.color.clone(); fC.repeat.set(2, 1); fC.needsUpdate = true;
  const foamMat = new THREE.MeshPhysicalMaterial({ color: 0x8a8a8a, map: fC, normalMap: fN, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 1,
    sheen: 0.6, sheenRoughness: 0.9, sheenColor: new THREE.Color(0x3a3a3a), transparent: false });
  const fg = new THREE.SphereGeometry(13.6, 96, 64); { // silhueta orgânica (micro deslocamento)
    const p = fg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize();
      const d = 0.22 * (h2(Math.round(n.x * 40), Math.round(n.y * 40), Math.round(n.z * 40)) - 0.5); v.addScaledVector(n, d); p.setXYZ(i, v.x, v.y, v.z); }
    fg.computeVertexNormals(); }
  const foamPivot = new THREE.Group(); foamPivot.position.y = 53; B.add(foamPivot);
  const foam = add(fg, foamMat, foamPivot); foam.scale.set(1, 1.12, 1); foam.name = 'espuma';

  // ── alça inferior (argola preta) ──
  const loop = roundRectArc(28, 15, 3.2); loop.holes.push(roundRectArc(21.5, 6.5, 1.6, 0, -1.8, THREE.Path));
  const blackPl = new THREE.MeshPhysicalMaterial({ color: 0x111214, roughness: 0.45, clearcoat: 0.15 });
  const strap = add(extrudeSmooth(loop, 3, { bt: 0.8, bs: 0.8, seg: 3 }), blackPl); strap.position.set(0, -51.5, -2.5);

  // ── clipe de lapela metálico (traseiro) + bloco da mola ──
  const clipMat = new THREE.MeshPhysicalMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.3, anisotropy: 0.7 });
  const cpath = []; for (let i = 0; i <= 40; i++) { const t = i / 40; const y = 36 - t * 52; const z = -11.5 - 4.4 + 3.5 * t * t - (t > 0.92 ? (t - 0.92) * 28 : 0); cpath.push([y, z]); }
  add(sweepYZ(cpath, roundedSection(16, 0.9, 0.4, 3)), clipMat);
  const hinge = add(extrudeSmooth(roundRectArc(20, 9, 2.5), 5, { bt: 1.2, bs: 1.2, seg: 3 }), blackPl); hinge.position.set(0, 34, -13.2);
  const pin = add(new THREE.CylinderGeometry(1.1, 1.1, 22, 16), clipMat); pin.rotation.z = Math.PI / 2; pin.position.set(0, 37.2, -15.4);
  const clipAnchor = new THREE.Object3D(); clipAnchor.name = 'clipAnchor'; clipAnchor.position.set(0, 0.034, -0.016); group.add(clipAnchor);

  // ── porta mini USB (lateral direita) ──
  const usbHole = add(new THREE.BoxGeometry(1.4, 7.6, 3.4), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 }), B, false); usbHole.position.set(29.6, 28, 0);
  const usbT = add(new THREE.BoxGeometry(1.0, 5.2, 0.7), capMat, B, false); usbT.position.set(29.7, 28, 0.3);
  const usbRim = add(new THREE.TorusGeometry(3.2, 0.5, 6, 24), new THREE.MeshStandardMaterial({ color: 0x0f5aa0, roughness: 0.7 }), B, false);
  usbRim.rotation.y = Math.PI / 2; usbRim.scale.set(1, 1.35, 0.6); usbRim.position.set(29.9, 28, 0);

  // ── âncora "home" no berço da maleta ──
  const home = kitHome(stage, KIT_LOCAL.dosimeter, 'dosimeterHome'); home.add(group);

  // ─────────── estado / animações ───────────
  const press = { power: 0, play: 0, stop: 0, menu: 0 }; // 0..1 afundamento
  const held = new Map(); // pointerId → {key, t0, fired}
  let hl = null, hlT = 0, wsTarget = 1, ws = 1, ledPhase = 0;
  const pulses = {};
  function pressAnim(key) { (key === 'power+menu' ? ['power', 'menu'] : [key]).forEach((k) => { if (k in press) pulses[k] = 0.22; }); }
  const extraOutline = { screen: outlineOf(lens, 0xffd54a, 0.9), led: outlineOf(led, 0xffd54a, 0.8), mic: outlineOf(cap, 0xffd54a, 0.9), usb: outlineOf(usbHole, 0xffd54a, 1.2) };
  function highlight(key) {
    hl = key; Object.values(keyOutline).concat(Object.values(extraOutline)).forEach((o) => (o.visible = false));
    const list = key === 'power+menu' ? ['power', 'menu'] : key ? [key] : [];
    list.forEach((k) => { const o = keyOutline[k] || extraOutline[k]; if (o) o.visible = true; });
  }
  function setWindscreen(on) { wsTarget = on ? 1 : 0; }

  // ── interação por raycast ──
  const cv = stage.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const keyMeshes = Object.values(keys);
  function pick(e) {
    if (!stage.camera || !group.visible) return null; const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, stage.camera);
    const hit = ray.intersectObjects(keyMeshes, true).find((h) => h.object.userData.key); return hit ? hit.object.userData.key : null;
  }
  const holding = (k) => [...held.values()].some((h) => h.key === k && !h.fired);
  function fire(key, ms) { pressAnim(key); try { fw?.press?.(key, ms); } catch (err) { console.error('[dosimeter] fw.press', err); } app?.emit?.('change'); }
  if (cv) {
    cv.addEventListener('pointerdown', (e) => {
      const k = pick(e); if (!k) return;
      e.stopImmediatePropagation(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
      if (stage.controls) stage.controls.enabled = false;
      let key = k; if (e.shiftKey && (k === 'power' || k === 'menu')) key = 'power+menu';
      // multi-touch: a outra tecla do par já está segurada → combina
      const other = k === 'power' ? 'menu' : k === 'menu' ? 'power' : null;
      if (other && holding(other)) { for (const h of held.values()) if (h.key === other) h.key = 'power+menu'; key = 'power+menu'; }
      held.set(e.pointerId, { key, t0: performance.now(), fired: false });
    }, { capture: true });
    const up = (e) => {
      const h = held.get(e.pointerId); if (!h) return; held.delete(e.pointerId);
      if (!h.fired) { const ms = performance.now() - h.t0; if (h.key === 'power+menu' && holding('power+menu')) { /* espera a outra */ } else fire(h.key, ms); }
      for (const o of held.values()) if (o.key === 'power+menu' && h.key === 'power+menu') o.fired = true;
      if (!held.size && stage.controls) stage.controls.enabled = true;
    };
    cv.addEventListener('pointerup', up, { capture: true }); cv.addEventListener('pointercancel', up, { capture: true });
    let lastMove = 0;
    cv.addEventListener('pointermove', (e) => { const n = performance.now(); if (n - lastMove < 60 || held.size) return; lastMove = n;
      const k = pick(e); if (k) { cv.style.cursor = 'pointer'; cv.__dosiHover = true; } else if (cv.__dosiHover) { cv.style.cursor = ''; cv.__dosiHover = false; } });
  }

  const envTick = envGuard(stage, [bodyMat, bezMat, lensMat, scrMat, keyMat, capMat, clipMat, blackPl, colMat]);
  function update(dt = 0.016, t = performance.now() / 1000) {
    envTick();
    if (tex && fw?.dirty) { tex.needsUpdate = true; fw.dirty = false; }
    // pressão longa ao vivo (3 s)
    const now = performance.now();
    for (const h of held.values()) if (!h.fired && now - h.t0 >= 3000) {
      h.fired = true; if (h.key === 'power+menu') for (const o of held.values()) if (o.key === 'power+menu') o.fired = true; fire(h.key, 3000); }
    for (const k in press) {
      if (pulses[k] > 0) pulses[k] -= dt;
      const down = holding(k) || holding('power+menu') && (k === 'power' || k === 'menu') || pulses[k] > 0;
      press[k] += ((down ? 1 : 0) - press[k]) * Math.min(1, dt * 28);
      keys[k].position.z = keyRest[k] - press[k] * 0.95;
    }
    // LED (cor do firmware; pisca se o firmware indicar)
    const st = fw?.state || {}; const c = LED_COL[st.led];
    ledPhase += dt; const blink = st.ledBlink || st.blink ? Math.sin(ledPhase * Math.PI * 2) > 0 : true;
    if (c && blink) ledMat.emissive.setHex(c); else ledMat.emissive.setHex(0x000000);
    // highlight pulsante
    if (hl) { hlT += dt; const a = 0.45 + 0.45 * Math.sin(hlT * 6); Object.values(keyOutline).concat(Object.values(extraOutline)).forEach((o) => { if (o.visible) o.material.opacity = a; }); }
    // espuma sai/volta
    ws += (wsTarget - ws) * Math.min(1, dt * 5); if (Math.abs(ws - wsTarget) < 0.002) ws = wsTarget;
    foamPivot.visible = ws > 0.02; foamPivot.position.y = 53 + (1 - ws) * 34; foamPivot.rotation.z = (1 - ws) * 0.5;
    foamPivot.scale.setScalar(0.35 + 0.65 * ws);
  }
  update(0, 0);
  return { group, mic, keys, screen, home, clipAnchor, update, setWindscreen, pressAnim, highlight, led, foam };
}

export function buildKit(stage, app) { return buildKitImpl(stage, app); }
