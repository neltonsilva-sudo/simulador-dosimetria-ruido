// Palco (CENÁRIO): renderer físico, sombras suaves, IBL do próprio galpão, pós-processamento (scene_post.js),
// vistas com transição suave, DOF por foco, resolução dinâmica e window.__fps.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMS, PRESENT, HALL } from './layout_cams.js';
import { createPost } from './scene_post.js';

function buildEnv(renderer) {
  // ambiente do galpão para IBL: caixa escura, faixas claras no teto (claraboias), fundo quente enevoado
  const s = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 42), new THREE.MeshBasicMaterial({ color: 0x23272a, side: THREE.BackSide }));
  box.position.set(-8, 5, -14); s.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 42), new THREE.MeshBasicMaterial({ color: 0x3a3632 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-8, 0.02, -14); s.add(floor);
  for (const k of HALL.skylights) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(k.hw * 2.4, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.97, 0.9).multiplyScalar(9) }));
    m.rotation.x = Math.PI / 2; m.position.set(k.x, 9.8, -14); s.add(m);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(36, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.65).multiplyScalar(1.6) }));
  back.position.set(-8, 4, -34.8); s.add(back);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(42, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.9, 1.0).multiplyScalar(2.2) }));
  side.rotation.y = -Math.PI / 2; side.position.set(9.9, 5.6, -14); s.add(side);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.035, 0.1, 100).texture; pm.dispose();
  return tex;
}

export async function createStage(canvas, { quality = 'high', app } = {}) {
  const qs = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // tone mapping (AgX) feito no pós
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1d20);
  scene.environment = buildEnv(renderer); scene.environmentIntensity = 0.62;

  // luzes: chave vinda das claraboias (com sombra) + preenchimento frio do lado da câmera + hemisférica
  const sunDir = new THREE.Vector3(...HALL.sun).normalize();
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.copy(sunDir).multiplyScalar(30).add(new THREE.Vector3(-2, 0, -4)); key.target.position.set(-2, 0, -4);
  key.castShadow = true; key.shadow.mapSize.set(quality === 'low' ? 1024 : 2048, quality === 'low' ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 5, far: 60 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xf4f0ea, 1.15); fill.position.set(4, 3.5, 4.5); scene.add(fill);
  const hemi = new THREE.HemisphereLight(0xe4e6e2, 0x56524c, 0.3); scene.add(hemi);
  // bolsões de luz quente no fundo (luminárias de vapor de sódio / janelas ao sol)
  for (const [x, y, z, i] of [[-3.2, 3.2, -12.5, 9], [3.5, 4.5, -19, 14], [-8, 4, -24, 12]]) { const pl = new THREE.PointLight(0xffd2a0, i * 0.6, 14, 1.6); pl.position.set(x, y, z); scene.add(pl); }

  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 160);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.15, maxDistance: 32, maxPolarAngle: Math.PI * 0.93, rotateSpeed: 0.6, zoomSpeed: 0.8, panSpeed: 0.7 });

  // parâmetros do pós (ajustáveis em __stage.post.P)
  const P = {
    quality, ao: quality === 'low' ? 0 : 0.8, aoRadius: 0.8, fogDens: 0.0009, fogK: 0.07,
    fogCool: new THREE.Vector3(0.035, 0.05, 0.055), fogWarm: new THREE.Vector3(0.36, 0.29, 0.20),
    beamDens: quality === "low" ? 0 : 0.003, beamCol: new THREE.Vector3(1.0, 0.9, 0.74),
    bloomThr: 2.5, bloom: 0.3, exposure: 1.38, ca: 0.6, vignette: 0.2, sat: 0.82, contrast: 0.2,
    lift: new THREE.Vector3(0.0, 0.002, 0.005), gain: new THREE.Vector3(0.012, 0.007, -0.002),
    grain: 0.022, smaa: true, dofMax: 22, dofNear: 0.4, tonemap: qs.get('tmo') || 'aces',
  };
  const stage = { THREE, renderer, scene, camera, controls, canvas, quality, P, hallBounds: HALL, key, fill, hemi, _dof: { amount: 0, dist: 2, target: null, want: 0 } };

  let post = null;
  try { post = createPost(stage, P); } catch (e) { console.error('[scene] pós-processamento indisponível:', e); }
  stage.post = post;

  // ── tamanho + resolução dinâmica ──
  const basePR = Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : quality === 'med' ? 1.5 : 2); // 'high': até 2× (teclas e textos nítidos em close)
  // Resolução dinâmica SEM piscar: (1) o redimensionamento é adiado para o início do próximo quadro, antes de desenhar
  // (redimensionar depois do render limpava o canvas e o navegador mostrava um quadro vazio); (2) histerese: só baixa após
  // 3 medições seguidas abaixo de 40 fps e só sobe após 8 s seguidos acima de 58 fps; nada nos primeiros 8 s (carga/shaders).
  let dyn = 1, lastDynT = 0, pendingResize = false, lowN = 0, highN = 0;
  const dynOn = qs.get('dynres') !== '0';
  let stage_fitFov = null;
  const baseFovRef = () => { try { return baseFov; } catch { return null; } };
  const tweenRef = () => { try { return tween; } catch { return null; } };
  function resize() { window.__resizes = (window.__resizes || 0) + 1;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; const pr = basePR * dyn;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; if (stage_fitFov && baseFovRef() != null && !tweenRef()) camera.fov = stage_fitFov(baseFovRef()); camera.updateProjectionMatrix();
    post?.setSize(w, h, pr);
  }
  addEventListener('resize', resize); resize();

  // ── vistas ──
  const views = { ...CAMS, present: PRESENT.cam };
  stage.views = views;
  let tween = null, firstView = true;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  function orbitView(str) {
    const [ang = 35, h = 2, r = 4, tx = 0, ty = 1.2, tz = 0, fov = 45] = (str || '').split(',').map(Number);
    const a = (ang * Math.PI) / 180;
    return { pos: [tx + r * Math.sin(a), h, tz + r * Math.cos(a)], target: [tx, ty, tz], fov };
  }
  // As vistas foram enquadradas para tela 3:2. Em tela mais estreita (celular em pé), abre o campo vertical para manter
  // ~85% da largura do enquadramento original (limite 64°), em vez de cortar a cena dos lados.
  let baseFov = null;
  function fitFov(f) {
    const asp = camera.aspect || 1.5; if (asp >= 1.45) return f;
    const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(f) / 2) * 1.5 * 0.85);
    return Math.min(64, Math.max(f, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hf / 2) / asp))));
  }
  stage_fitFov = fitFov;
  function flyTo(v, duration = 1.6) {
    const pos = new THREE.Vector3(...(v.pos.isVector3 ? v.pos.toArray() : v.pos));
    const target = new THREE.Vector3(...(v.target.isVector3 ? v.target.toArray() : v.target));
    baseFov = v.fov ?? baseFov ?? camera.fov; const fov = fitFov(baseFov);
    if (tween) { tween.resolve(); tween = null; }
    if (!duration || duration <= 0.01) {
      camera.position.copy(pos); controls.target.copy(target); camera.fov = fov; camera.updateProjectionMatrix(); controls.update();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      tween = { t: 0, d: duration, p0: camera.position.clone(), t0: controls.target.clone(), f0: camera.fov, p1: pos, t1: target, f1: fov, resolve };
    });
  }
  function setFocus(o) {
    const D = stage._dof;
    if (o == null) { D.target = null; D.want = 0; return; }
    D.target = o; if (D.want === 0) D.want = 0.25;
  }
  function setView(name, { animate = true, duration = 1.6, orbit } = {}) {
    let v = name === 'orbit' ? orbitView(orbit || qs.get('orbit')) : views[name];
    if (!v) { console.warn('[scene] vista desconhecida', name); return Promise.resolve(); }
    stage.view = name;
    const D = stage._dof;
    if (v.focus && v.dof) { D.target = new THREE.Vector3(...v.focus); D.want = v.dof; } else if (name !== 'orbit') { D.target = null; D.want = 0; }
    const p = flyTo(v, animate && !firstView ? duration : 0); firstView = false; return p;
  }
  controls.addEventListener('start', () => { if (tween) { tween.resolve(); tween = null; } });

  const fns = new Set();
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  function updateDof(dt) {
    const D = stage._dof;
    let want = D.want, dist = D.dist;
    if (D.target) {
      const t = D.target.isVector3 ? tmp.copy(D.target) : (D.target.updateWorldMatrix?.(true, false), D.target.getWorldPosition(tmp));
      camera.getWorldDirection(fwd); dist = Math.max(0.1, tmp.sub(camera.position).dot(fwd));
    } else want = 0;
    const k = 1 - Math.exp(-dt * 6);
    D.dist += (dist - D.dist) * k; D.amount += (want - D.amount) * k;
  }
  function clampCam() {
    const b = HALL, p = camera.position, t = controls.target;
    p.x = THREE.MathUtils.clamp(p.x, b.x0 + 0.4, b.x1 - 0.4); p.z = THREE.MathUtils.clamp(p.z, b.z0 + 0.4, b.z1 - 0.4);
    p.y = THREE.MathUtils.clamp(p.y, 0.15, b.eave - 0.3); t.y = Math.max(0, t.y);
  }

  const clock = new THREE.Clock(); let fc = 0, ft = 0, tAll = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.1, clock.getDelta()); tAll += dt;
    if (pendingResize) { pendingResize = false; resize(); }
    for (const f of [...fns]) { try { f(dt, tAll); } catch (e) { console.error('[scene] onFrame:', e); fns.delete(f); } }
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.d); const e = ease(tween.t);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      const lift = Math.sin(Math.PI * e) * Math.min(0.6, tween.p0.distanceTo(tween.p1) * 0.08); camera.position.y += lift;
      camera.fov = tween.f0 + (tween.f1 - tween.f0) * e; camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
      if (tween.t >= 1) { const r = tween.resolve; tween = null; controls.update(); r(); }
    } else { controls.update(); clampCam(); }
    updateDof(dt);
    if (post) post.render(tAll); else renderer.render(scene, camera);
    fc++; ft += dt;
    if (ft > 0.5) {
      window.__fps = Math.round(fc / ft); fc = 0; ft = 0;
      if (dynOn && tAll > 8 && !document.hidden) {
        lowN = window.__fps < 40 ? lowN + 1 : 0; highN = window.__fps > 58 ? highN + 1 : 0;
        if (lowN >= 3 && dyn > 0.6 && tAll - lastDynT > 3) { dyn = Math.max(0.6, dyn - 0.1); pendingResize = true; lastDynT = tAll; lowN = 0; }
        else if (highN >= 16 && dyn < 1 && tAll - lastDynT > 8) { dyn = Math.min(1, dyn + 0.1); pendingResize = true; lastDynT = tAll; highN = 0; }
      }
    }
  });

  Object.assign(stage, {
    onFrame(fn) { fns.add(fn); return () => fns.delete(fn); },
    setView, flyTo, setFocus,
    setExposure(v) { P.exposure = v; },
    resize,
  });
  return stage;
}
