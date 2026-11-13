// Orquestrador — dono: ORQUESTRADOR. Liga cena ↔ máquinas ↔ trabalhadora ↔ dosímetro/firmware ↔ acústica ↔ áudio ↔ UI.
// Módulos carregados com import dinâmico protegido: um módulo quebrado não derruba o resto (erro aparece no console).
import * as THREE from 'three';
import * as DOSI from './dosimetry.js';
import * as WD from './workday.js';
import { levelAt, spectrumAt } from './acoustics.js';
import { MACHINES } from './layout_machines.js';
import { CAMS, TABLE, PRESENT } from './layout_cams.js';

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const boot = document.getElementById('boot');
const listeners = {};
const V = (a) => new THREE.Vector3(...a);

async function load(path) {
  try { return await import(path); } catch (e) { console.error(`[main] falha ao carregar ${path}:`, e); return null; }
}
async function safe(name, fn) {
  try { return await fn(); } catch (e) { console.error(`[main] ${name}:`, e); return null; }
}

const state = {
  phase: 'explorar',          // explorar | apresentacao | calibracao | colocacao | pronto | dosimetria | relatorio
  speed: +(qs.get('speed') || 240), // jornada acelerada (s simulados por s real)
  clock: WD.createWorkday({ seed: +(qs.get('seed') || 7) }).start - 15 * 60, // 06:45
  running: false, mounted: false,
  machinesOn: true,
  calDrift: +(qs.get('drift') || 0.2), // deriva de sensibilidade ao fim da jornada (dB) — >1 invalida (NHO-01)
  calibratorCoupled: false,
};

const app = {
  THREE, DOSI, WD, CAMS, TABLE, PRESENT, MACHINES, state,
  stage: null, hall: null, machines: null, worker: null, dosimeter: null, calibrator: null, kit: null, fw: null, audio: null, ui: null,
  workday: WD.createWorkday({ seed: +(qs.get('seed') || 7) }),
  on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => (listeners[ev] = listeners[ev].filter((f) => f !== fn)); },
  emit(ev, d) { (listeners[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); },
  setPhase(p) { state.phase = p; app.emit('phase', p); app.emit('change'); },
  setSpeed(s) { state.speed = s; app.emit('change'); },
  setView: (v, o) => app.stage?.setView(v, o),
  /** posição do microfone do dosímetro no mundo (ou ponto padrão junto ao ouvido esquerdo) */
  micWorld(out = new THREE.Vector3()) {
    const m = app.dosimeter?.mic; if (m) { m.updateWorldMatrix(true, false); return m.getWorldPosition(out); }
    return out.set(0.02, 1.45, -0.16);
  },
  running() { const r = {}; for (const m of MACHINES) r[m.id] = state.machinesOn && m.running !== false && (app.machines?.isRunning?.(m.id) ?? true); return r; },
  fieldLevel(p) { return levelAt(p || app.micWorld(), app.running()); },
  spectrum(p) { return spectrumAt(p || app.micWorld(), app.running()); },
  /** Nível instantâneo que chega ao microfone agora (calibrador acoplado domina). */
  instantLevel() {
    const cal = app.calibrator;
    if (state.calibratorCoupled && cal?.isOn?.()) return cal.level?.() ?? 114;
    if (state.running && state.mounted) return lastSimLevel ?? app.fieldLevel();
    const L = app.fieldLevel(); const t = performance.now() / 1000;
    return L + 1.2 * Math.sin(t * 2 * Math.PI / 1.5) ** 8 - 0.4 + 0.5 * Math.sin(t * 0.7);
  },
  setMachines(on) { state.machinesOn = on; app.machines?.setAll?.(on); app.audio?.setRunning?.(app.running()); app.emit('change'); },
  coupleCalibrator(b) { state.calibratorCoupled = b; app.emit('change'); },
  /** Coloca o dosímetro no ombro (anchor da trabalhadora). Anima o voo e reparenta. */
  async mountDosimeter({ side = 'L', duration = 1.6 } = {}) {
    const d = app.dosimeter, w = app.worker; if (!d || !w) return;
    const anchor = w.anchors?.[side === 'L' ? 'shoulderL' : 'shoulderR']; if (!anchor) return;
    d.setWindscreen?.(true);
    await flyObjectTo(d.group, anchor, duration);
    state.mounted = true; app.emit('mounted', side); app.emit('change');
  },
  async unmountDosimeter({ duration = 1.2 } = {}) {
    const d = app.dosimeter; if (!d || !d.home) return;
    await flyObjectTo(d.group, d.home, duration); state.mounted = false; app.emit('change');
  },
  /** Leva o aparelho (ou calibrador) para a pose de apresentação diante da câmera de PRESENT. */
  async present(obj = app.dosimeter?.group, anchorName = 'presentDevice', duration = 1.4) {
    if (!obj) return; await flyObjectTo(obj, anchors[anchorName], duration);
  },
  startDosimetry() { state.running = true; app.setPhase('dosimetria'); app.emit('started'); },
  pauseDosimetry() { state.running = false; app.worker?.setActivity?.('operando'); app.emit('change'); },
  results: () => app.fw?.results?.() ?? null,
  timeOfDay: () => state.clock,
  fmtClock: WD.fmtClock,
};
window.__sim = app;
const anchors = {};

// ─── tween de objeto entre âncoras (mantém pose de mundo e reparenta no fim) ───
function flyObjectTo(obj, anchor, duration) {
  return new Promise((resolve) => {
    if (!obj || !anchor) return resolve();
    const s = app.stage; const scene = s.scene;
    obj.updateWorldMatrix(true, true);
    scene.attach(obj); // passa a filho da cena preservando a pose de mundo
    const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
    const p1 = new THREE.Vector3(), q1 = new THREE.Quaternion(), sc = new THREE.Vector3();
    let t = 0;
    const off = s.onFrame((dt) => {
      anchor.updateWorldMatrix(true, false); anchor.matrixWorld.decompose(p1, q1, sc);
      t = Math.min(1, t + dt / duration); const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      obj.position.lerpVectors(p0, p1, e); obj.position.y += Math.sin(Math.PI * e) * 0.08;
      obj.quaternion.slerpQuaternions(q0, q1, e);
      if (t >= 1) { off?.(); anchor.attach(obj); obj.position.set(0, 0, 0); obj.quaternion.identity(); resolve(); }
    });
  });
}

// ─── simulação da jornada (tempo acelerado, passos de 1 s simulado) ───
let lastSimLevel = null, simAcc = 0;
const tmpMic = new THREE.Vector3();
function stepSimulation(dt) {
  const fw = app.fw;
  if (!state.running) { state.clock += dt; fw?.setClock?.(state.clock); return; } // relógio corre em tempo real fora da dosimetria
  simAcc += dt * state.speed;
  const field = app.fieldLevel(app.micWorld(tmpMic)); // geometria real: microfone no ombro
  let n = Math.floor(simAcc); simAcc -= n; n = Math.min(n, 4000);
  for (let i = 0; i < n; i++) {
    state.clock += 1;
    const L = WD.levelOnSchedule(app.workday, state.clock, field);
    fw?.setClock?.(state.clock);
    if (L != null) { lastSimLevel = L; fw?.feed?.(L, 1, state.clock); } else fw?.feed?.(null, 1, state.clock);
    if ((state.clock | 0) % 30 === 0) { const act = WD.activityAt(app.workday, state.clock)?.id; // movimento da trabalhadora segue a jornada
      app.worker?.setActivity?.(act === 'operando' || act === 'setup' ? 'operando' : 'parada'); }
    if (state.clock >= app.workday.end) { state.running = false; app.emit('workdayEnd'); app.emit('change'); break; }
  }
  app.emit('tick');
}

// ─── boot ───
(async () => {
  const sceneMod = await load('./scene.js');
  if (!sceneMod) { boot.textContent = 'ERRO AO CARREGAR A CENA'; return; }
  const stage = (app.stage = await sceneMod.createStage(canvas, { quality: qs.get('q') || 'high', app }));
  window.__stage = stage;

  const [hallM, machM, workM, dosiM, calM, fwM, audM, uiM] = await Promise.all(
    ['./hall.js', './machines.js', './worker.js', './dosimeter.js', './calibrator.js', './firmware.js', './audio.js', './ui.js'].map(load));

  app.hall = await safe('hall', () => hallM?.buildHall(stage, app));
  app.machines = await safe('machines', () => machM?.buildMachines(stage, app));
  app.fw = await safe('firmware', () => fwM?.createFirmware({ app, getInput }));
  app.dosimeter = await safe('dosimeter', () => dosiM?.buildDosimeter(stage, app.fw, app));
  app.calibrator = await safe('calibrator', () => calM?.buildCalibrator(stage, app));
  app.kit = await safe('kit', () => dosiM?.buildKit?.(stage, app));
  app.worker = await safe('worker', () => workM?.buildWorker(stage, app));
  app.audio = await safe('audio', () => audM?.createAudio(stage, app));
  // módulos extras de realismo (opcionais): colegas ao fundo e detalhes do ambiente
  const [crewM, propsM] = await Promise.all(['./crew.js', './props.js'].map(load));
  app.crew = await safe('crew', () => crewM?.buildCrew?.(stage, app));
  app.props = await safe('props', () => propsM?.buildProps?.(stage, app));

  // âncoras de apresentação (objetos vazios na cena)
  for (const [name, def] of [['presentDevice', PRESENT.device], ['presentCalibrator', PRESENT.calibrator]]) {
    const o = new THREE.Object3D(); o.name = name; o.position.copy(V(def.pos)); o.rotation.y = def.rotY || 0; stage.scene.add(o); anchors[name] = o;
  }
  app.anchors = anchors;

  stage.onFrame((dt, t) => {
    stepSimulation(dt);
    app.machines?.update?.(dt, t); app.worker?.update?.(dt, t); app.fw?.update?.(dt);
    app.dosimeter?.update?.(dt, t); app.calibrator?.update?.(dt, t); app.hall?.update?.(dt, t); app.audio?.update?.(dt, t); app.crew?.update?.(dt, t); app.props?.update?.(dt, t);
  });

  app.ui = await safe('ui', () => uiM?.createUI(document.getElementById('ui'), app));
  stage.setView(qs.get('cam') || 'ref');
  // atalhos para capturas/testes: ?mount=1 (já instalado), ?run=1 (dosimetria rodando), ?t=HH:MM (avança o relógio)
  if (qs.get('mount') === '1' && app.worker && app.dosimeter) await app.mountDosimeter({ duration: 0.01 });
  if (qs.get('run') === '1') { app.fw?.quickStart?.(); app.startDosimetry(); }
  if (qs.get('t')) { const [h, m] = qs.get('t').split(':').map(Number); const target = h * 3600 + (m || 0) * 60;
    if (state.running) { const sp = state.speed; state.speed = 1; while (state.clock < target - 1 && state.running) { simAcc = 0; stepSimulation(Math.max(1, Math.min(600, Math.ceil(target - state.clock)))); } state.speed = sp; } else state.clock = target; }
  if (qs.get('ui') === '0') document.getElementById('ui').style.display = 'none';
  boot.style.opacity = 0; setTimeout(() => boot.remove(), 700);
  app.emit('ready'); app.emit('change');
})();

/** Entrada do microfone para o firmware (nível A instantâneo, espectro, calibrador). */
function getInput() {
  return {
    L: app.instantLevel(),
    spectrum: state.calibratorCoupled && app.calibrator?.isOn?.() ? null : app.spectrum(),
    calibrator: { coupled: state.calibratorCoupled, on: !!app.calibrator?.isOn?.(), level: app.calibrator?.level?.() ?? 114 },
    calDrift: state.calDrift,
  };
}
