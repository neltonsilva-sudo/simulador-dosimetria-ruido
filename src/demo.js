// Roteiro da demonstração narrada (dono: UI/DEMO). Cada passo: título, texto (legenda/voz), destaque de tecla e ação.
// As ações operam o firmware pelas MESMAS teclas do manual do DoseMax (fw.press), com verificação de estado.
import * as THREE from 'three';
import { MENUS, PAGES } from './fw_core.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function press(app, key, hold = 0, after = 450) {
  app.dosimeter?.pressAnim?.(key); app.fw?.press?.(key, hold); await wait(after);
}
const st = (app) => app.fw?.state || {};
const isOn = (app) => (st(app).power || 'on') === 'on';
const mode = (app) => st(app).mode;

// ── acoplamento calibrador ↔ microfone (dono: ACOPLAMENTO) ──
// O microfone ½" (sem espuma) entra na cavidade do acoplador até o anel de borracha encostar no colar; o calibrador fica
// COAXIAL ao microfone, com a boca do acoplador voltada para a ponta do microfone e a FRENTE (visor/CalPro) para a câmera.
// A geometria vem do modelo em tempo de execução: posição de `cavity` no referencial do calibrador (eixo da boca =
// eixo dominante centro→cavidade). Eixo do microfone = +y do Object3D `mic` do dosímetro.
const MIC_INSERT = 0.0078;   // m de cápsula dentro do acoplador (cápsula 8 mm acima do colar; o anel para no colar)
const RING_SQUEEZE = 0.0007; // m de compressão do anel de borracha no encaixe
const PRE_H = 0.04, SLOW_H = 0.02;  // aproximação alinhada ao eixo: para a 4 cm, desce rápido até 2 cm e devagar no fim
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
function cavityInGroup(c) {
  const g = c.group, cav = c.cavity;
  if (!cav) return new THREE.Vector3(0, 0.0526, 0);
  g.updateWorldMatrix(true, true); cav.updateWorldMatrix(true, false);
  _m.copy(g.matrixWorld).invert().multiply(cav.matrixWorld);
  const p = new THREE.Vector3(); _m.decompose(p, _q, _s); return p;
}
function couplingAnchor(app) {
  const d = app.dosimeter, c = app.calibrator; if (!d?.mic || !c?.group) return null;
  let a = app.anchors.calCouple;
  if (!a) { a = new THREE.Object3D(); a.name = 'calCouple'; d.mic.add(a); app.anchors.calCouple = a; }
  const cp = cavityInGroup(c);
  const ax = [Math.abs(cp.x), Math.abs(cp.y), Math.abs(cp.z)], i = ax.indexOf(Math.max(...ax));
  const u = new THREE.Vector3(); u.setComponent(i, Math.sign(cp.getComponent(i)) || 1);          // boca do acoplador (ref. calibrador)
  const f = new THREE.Vector3(0, 0, 1); if (Math.abs(u.z) > 0.9) f.set(0, 1, 0);
  f.addScaledVector(u, -f.dot(u)).normalize();                                                      // frente ⟂ eixo
  const S = new THREE.Matrix4().makeBasis(f, u, new THREE.Vector3().crossVectors(f, u));
  const T = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0));
  a.quaternion.setFromRotationMatrix(T.multiply(S.transpose()));                                    // boca → −y do mic, frente → +z (câmera)
  a.position.set(0, -MIC_INSERT, 0).sub(cp.clone().applyQuaternion(a.quaternion));                  // boca a MIC_INSERT abaixo da ponta
  return a;
}
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
/** Pose de mundo do calibrador acoplado, deslocado `h` m ao longo do eixo do microfone (h > 0 = afastado). */
function couplePose(app, a, h) {
  return (p, q) => { const mic = app.dosimeter.mic; mic.updateWorldMatrix(true, false);
    p.copy(a.position); p.y += h; mic.localToWorld(p); mic.getWorldQuaternion(q).multiply(a.quaternion); };
}
const anchorPose = (o) => (p, q) => { o.updateWorldMatrix(true, false); o.matrixWorld.decompose(p, q, _s); };
/** Tween de pose de mundo (alvo recalculado a cada quadro; o objeto fica filho da cena durante o movimento). */
function tweenPose(app, obj, pose, dur, { ease = easeIO, arc = 0 } = {}) {
  return new Promise((res) => {
    const s = app.stage; if (!obj || !s) return res();
    obj.updateWorldMatrix(true, true); s.scene.attach(obj);
    const p0 = obj.position.clone(), q0 = obj.quaternion.clone(), p1 = new THREE.Vector3(), q1 = new THREE.Quaternion();
    let t = 0;
    const off = s.onFrame((dt) => {
      pose(p1, q1); t = Math.min(1, t + dt / dur); const e = ease(t);
      obj.position.lerpVectors(p0, p1, e); if (arc) obj.position.y += Math.sin(Math.PI * e) * arc;
      obj.quaternion.slerpQuaternions(q0, q1, e);
      if (t >= 1) { off?.(); res(); }
    });
  });
}
const settle = (parent, obj) => { parent.attach(obj); obj.position.set(0, 0, 0); obj.quaternion.identity(); };

// ── navegação real pelo menu do firmware (mesmas teclas do manual: ▶❙❙ sobe/aumenta, ■ desce/diminui, ☰ confirma) ──
const NAV_MS = 620;
const top = (app) => { const p = st(app).menuPath || []; return p[p.length - 1]; };
async function menuOpen(app, ctx) { if (!(st(app).menuPath || []).length) await press(app, 'menu', 3100, 1100); }
/** No menu atual, leva o cursor até o item cujo destino é `target` (null = Voltar) e confirma. */
async function menuGo(app, ctx, target) {
  const t = top(app), M = MENUS[t]; if (!M) return;
  const idx = M.items.findIndex((it) => it[1] === target); if (idx < 0) return;
  for (let guard = 0; guard < 12 && (st(app).menuSel?.[t] || 0) !== idx; guard++) {
    if (ctx && !ctx.alive()) return;
    await press(app, (st(app).menuSel?.[t] || 0) < idx ? 'stop' : 'play', 0, NAV_MS);
  }
  if (ctx && !ctx.alive()) return;
  await press(app, 'menu', 0, NAV_MS + 300);
}
/** Numa página de opções/número, leva a seleção até `value` (mostrando os valores intermediários) e confirma. */
async function pageSet(app, ctx, value, { confirm = true, showAll = false } = {}) {
  const pg = st(app).page; if (!pg) return; const P = PAGES[pg.key];
  const list = P.type === 'options' ? P.options : P.values; if (!list) return;
  let idx = typeof value === 'number' && P.type === 'options' ? value : list.indexOf(value); if (idx < 0) idx = pg.sel;
  if (showAll) { // percorre todas as opções para o aluno ver, depois volta ao valor
    for (let i = 0; i < list.length - 1; i++) { if (ctx && !ctx.alive()) return; await press(app, P.type === 'options' ? 'stop' : 'play', 0, NAV_MS + 250); }
  }
  for (let guard = 0; guard < 40 && st(app).page && st(app).page.sel !== idx; guard++) {
    if (ctx && !ctx.alive()) return;
    const up = P.type === 'options' ? st(app).page.sel > idx : st(app).page.sel < idx; // options: ▶❙❙ sobe; number: ▶❙❙ aumenta
    await press(app, up ? 'play' : 'stop', 0, NAV_MS);
  }
  if (confirm && (!ctx || ctx.alive())) await press(app, 'menu', 0, NAV_MS + 500);
}
/** Página de campos (Duração, Data/Hora, Tela): ☰ avança campo a campo sem alterar. */
async function fieldsWalk(app, ctx, n, dwell = 1100) { for (let i = 0; i < n; i++) { if (ctx && !ctx.alive()) return; await press(app, 'menu', 0, dwell); } }
async function menuExit(app) { if ((st(app).menuPath || []).length) await press(app, 'menu', 3100, 700); }

export const fwDo = {
  async powerOn(app) {
    if (isOn(app)) return;
    await press(app, 'power', 3100, 2600); // tela de abertura
  },
  async calibrate(app, level = 114) {
    const fw = app.fw; if (!fw) return;
    if (fw.calibrate) { await fw.calibrate(level); return; }
    // Menu ☰ 3 s → Dosimetria → Calibrar → nível → ☰
    await press(app, 'menu', 3100, 900);
    await press(app, 'menu', 0, 800);                 // Dosimetria
    for (let i = 0; i < 5; i++) await press(app, 'stop', 0, 280); // desce até Calibrar
    await press(app, 'menu', 0, 900);                 // entra em Calibração
    await press(app, level === 114 ? 'play' : 'stop', 0, 700); // ▶❙❙ = 114 dB · ■ = 94 dB
    await press(app, 'menu', 0, 600);                 // confirma → calibra (estabiliza ~4 s)
    await new Promise((res) => { let done = false; const off = fw.on?.('calibrated', () => { done = true; res(); }); setTimeout(() => { if (!done) res(); off?.(); }, 6500); });
    app.state.calibratedToday = true;
    await wait(1800);                                  // mostra "Calibrado 114.0"
    await fwDo.toHome(app);
  },
  async toHome(app) { if (st(app).menuPath?.length) await press(app, 'menu', 3100, 600); }, // ☰ longo sai do menu
  async startRecording(app) {
    const fw = app.fw; if (!fw) return;
    await fwDo.powerOn(app);
    if (fw.startRecording) { await fw.startRecording({ precal: 'nao' }); }
    else {
      await press(app, 'play', 3100, 900);   // "Pre Calibrar" (Nao/94dB/114dB) — cursor em "Nao"
      await press(app, 'menu', 0, 500);      // confirma "Nao" → indicador vermelho pisca 20 s
    }
    // aguarda a contagem de 20 s (tempo real) e o início da gravação
    const t0 = performance.now();
    while (performance.now() - t0 < 24000 && !['run', 'gravando', 'recording'].includes(mode(app))) await wait(250);
    if (!['run', 'gravando', 'recording'].includes(mode(app))) fw.quickStart?.();
  },
  stopWithPostCal(app) { // reentrante: fim da jornada (UI) e botão podem chamar juntos → uma só pós-calibração
    if (!postCalP) postCalP = postCalRun(app).finally(() => { postCalP = null; });
    return postCalP;
  },
  async couple(app, on) { // serializa: um acoplamento/desacoplamento termina antes do próximo começar
    const job = coupleQ.then(() => coupleRun(app, on)); coupleQ = job.catch(() => {}); return job;
  },
  async ensureReady(app) {
    await fwDo.powerOn(app);
    if (!app.state.calibratedToday) { app.dosimeter?.setWindscreen?.(false); await fwDo.couple(app, true); await fwDo.calibrate(app, 114); await fwDo.couple(app, false); }
    app.dosimeter?.setWindscreen?.(true);
  },
};

let postCalP = null, coupleQ = Promise.resolve();
async function postCalRun(app) {
  const fw = app.fw; if (!fw) return;
  // NHO-01 6.4.1 g: interromper a medição ANTES de retirar o microfone do trabalhador
  if (st(app).locked) await press(app, 'power+menu', 3100, 800);       // desbloqueia o teclado (⏻+☰ 3 s)
  if (['run', 'pause'].includes(mode(app))) await press(app, 'stop', 3100, 900); // ■ 3 s → "Pos Calibrar"
  app.setView('calib', { animate: true, duration: 1.8 });            // dosímetro + calibrador inteiros e em foco
  await app.present(app.dosimeter.group, 'presentDevice', 1.6); app.state.mounted = false; app.emit('change');
  app.dosimeter.setWindscreen?.(false); await wait(700);
  await fwDo.couple(app, true);
  if (st(app).popup?.type === 'postcal') {
    for (let g = 0; g < 6 && st(app).popup && st(app).popup.sel !== 2; g++) await press(app, 'stop', 0, 300); // desce até 114dB
    await press(app, 'menu', 0, 500);
    await new Promise((res) => { let done = false; const off = fw.on?.('postcal', () => { done = true; res(); }); setTimeout(() => { if (!done) res(); off?.(); }, 9000); });
  }
  await wait(800);
  await fwDo.couple(app, false);
  app.dosimeter.setWindscreen?.(true);
}
async function coupleRun(app, on) {
  const c = app.calibrator, d = app.dosimeter; if (!c?.group || !d?.mic) return;
  const a = couplingAnchor(app);
  if (on) {
    if (app.state.calibratorCoupled && c.group.parent === a) return;
    d.setWindscreen?.(false);                                    // acoplar só com o microfone sem espuma
    // 1) tira da maleta e mostra ao lado do aparelho, de frente; liga em 114 dB ANTES de acoplar
    const show = app.anchors.presentCalibrator;
    if (show) { await tweenPose(app, c.group, anchorPose(show), 1.3, { arc: 0.06 }); settle(show, c.group); }
    c.setLevel?.(114); c.setOn?.(true); await wait(1500);       // visor: "CalPro" → "114dB"
    // 2) gira coaxial ao microfone (boca para baixo, frente para a câmera) e para 4 cm acima da ponta
    await tweenPose(app, c.group, couplePose(app, a, PRE_H), 1.1, { arc: 0.006 });
    // 3) desce alinhado ao eixo; os últimos 2 cm devagar; o anel comprime e acomoda
    await tweenPose(app, c.group, couplePose(app, a, SLOW_H), 0.45, { ease: (t) => t * (2 - t) });
    await tweenPose(app, c.group, couplePose(app, a, -RING_SQUEEZE), 1.25, { ease: easeOut });
    await tweenPose(app, c.group, couplePose(app, a, 0), 0.3, { ease: easeIO });
    settle(a, c.group);
    app.coupleCalibrator(true); app.audio?.tone?.(true, c.level?.() ?? 114); // tom de 1 kHz só enquanto acoplado
  } else {
    if (!app.state.calibratorCoupled && c.group.parent !== a) { c.setOn?.(false); return; }
    app.audio?.tone?.(false); app.coupleCalibrator(false);
    // desacoplamento inverso: solta o anel, sobe 2 cm devagar ao longo do eixo, afasta, desliga e volta à maleta
    await tweenPose(app, c.group, couplePose(app, a, -RING_SQUEEZE * 0.5), 0.2, { ease: easeIO });
    await tweenPose(app, c.group, couplePose(app, a, SLOW_H), 0.9, { ease: (t) => t * t });
    await tweenPose(app, c.group, couplePose(app, a, PRE_H), 0.4, { ease: easeOut });
    c.setOn?.(false);
    if (c.home) { await tweenPose(app, c.group, anchorPose(c.home), 1.4, { arc: 0.07 }); settle(c.home, c.group); }
  }
}

export const MOUNT_TEXT = `Antes de instalar, a trabalhadora é informada: <ul><li>do objetivo da avaliação;</li><li>que deve manter a rotina normal de trabalho;</li><li>que o aparelho não grava conversas;</li><li>que só o avaliador pode retirar o equipamento;</li><li>que o microfone não pode ser tocado nem obstruído.</li></ul>O dosímetro é preso pelo clipe na vestimenta, sobre o ombro do lado mais exposto (o lado da prensa), com o microfone dentro da zona auditiva: raio de 150 ± 50 mm a partir da entrada do canal auditivo.`;

export const CHAPTERS = [
  { id: 'tudo', label: 'Demonstração completa', sub: 'Usar, configurar e calibrar' },
  { id: 'uso', label: '1. Como usar', sub: 'Partes, ligar, telas, iniciar/pausar/parar, bloqueio' },
  { id: 'config', label: '2. Como configurar', sub: 'Menu, NHO-01 × NR-15 × USER, q, critério, limiar…' },
  { id: 'cal', label: '3. Como calibrar', sub: 'Espuma, calibrador 114 dB, calibrar e conferir' },
];
export const STEPS = [
  { chapter: 'uso', title: 'O dosímetro de ruído', highlight: null,
    text: 'Este é um dosímetro de ruído de uso pessoal, o instrumento preferencial da NHO-01 para avaliar a exposição ocupacional. Ele integra o nível de pressão sonora durante a jornada e calcula a dose. Este modelo mede três critérios ao mesmo tempo: NHO-01, NR-15 e um critério editável, o USER.',
    run: async (app) => { app.setView('present', { animate: true, duration: 2 }); await app.present(app.dosimeter?.group, 'presentDevice', 1.6); } },
  { chapter: 'uso', title: 'Partes do aparelho', highlight: 'all',
    text: 'No topo fica o microfone de eletreto de meia polegada, protegido pela espuma. Na frente, o visor colorido de 1,8 polegada e quatro teclas: liga e desliga, play e pausa, stop, e menu. Atrás, o clipe de lapela para prender na roupa do trabalhador.',
    run: async (app, { wait }) => { for (const k of ['power', 'play', 'stop', 'menu']) { app.dosimeter?.highlight?.(k); await wait(1500); } app.dosimeter?.highlight?.(null); } },
  { chapter: 'uso', title: 'Ligar o aparelho', highlight: 'power',
    text: 'Para ligar, segure a tecla liga e desliga por três segundos, até aparecer a tela de abertura. Confira a carga da bateria no canto superior direito do visor: a NHO-01 invalida a medição se a bateria ficar abaixo do mínimo.',
    run: async (app) => { await fwDo.powerOn(app); } },
  { chapter: 'uso', title: 'Telas de visualização', highlight: 'stop',
    text: 'São seis telas: gráfico de nível, espectro, bandas de oitava, e os resultados de NHO-01, NR-15 e USER. A tecla stop avança e a tecla play volta. Na tela principal aparecem o nível instantâneo, a ponderação A e a resposta lenta S.',
    run: async (app) => { for (let i = 0; i < 6; i++) { await press(app, 'play', 0, 1300); } } },
  { chapter: 'uso', title: 'Iniciar, pausar e parar a dosimetria', highlight: 'play',
    text: 'Para iniciar uma dosimetria, segure a tecla play por três segundos: aparece Pré calibrar, com as opções Não, 94 e 114 dB. Escolhendo Não, vale a última calibração. O indicador vermelho pisca por 20 segundos e a gravação começa sozinha. Para pausar, segure play de novo: o indicador fica amarelo. Para encerrar, segure stop por três segundos e faça a pós-calibração: o indicador fica azul. Aqui vamos só simular o início e cancelar.',
    run: async (app, ctx) => { await fwDo.powerOn(app); await menuExit(app); if (!ctx.alive()) return; await press(app, 'play', 3100, 1600); if (!ctx.alive()) return;
      await press(app, 'menu', 0, 3500); if (['countdown'].includes(mode(app))) await press(app, 'stop', 3100, 1200); } },
  { chapter: 'uso', title: 'Bloqueio do teclado', highlight: 'menu',
    text: 'Durante a medição o teclado bloqueia sozinho 60 segundos depois do início, para ninguém alterar a programação. Para bloquear ou desbloquear manualmente, segure as teclas liga e desliga e menu ao mesmo tempo por três segundos: aparece um cadeado no visor.',
    run: async (app, ctx) => { await press(app, 'power+menu', 3100, 2600); if (ctx.alive() && st(app).locked) await press(app, 'power+menu', 3100, 900); } },
  // ───────── CONFIGURAÇÕES DO APARELHO (menu ☰) ─────────
  { chapter: 'config', title: 'Configurações: entrar no menu', highlight: 'menu',
    text: 'Agora vamos entrar nas configurações. Segure a tecla menu por três segundos. O menu principal tem quatro grupos: Dosimetria, Ajustes, Sistema e Sobre. Para navegar: a tecla play sobe, a tecla stop desce e a tecla menu confirma. O item Voltar retorna ao nível anterior.',
    run: async (app, ctx) => { await fwDo.powerOn(app); await menuExit(app); await menuOpen(app, ctx); for (let i = 0; i < 4 && ctx.alive(); i++) await press(app, 'stop', 0, 900); for (let i = 0; i < 4 && ctx.alive(); i++) await press(app, 'play', 0, 500); } },
  { chapter: 'config', title: 'Metodologias: NHO-01, NR-15 e USER', highlight: null,
    text: 'Este dosímetro não obriga a escolher uma só metodologia: ele mede três critérios ao mesmo tempo, na mesma medição. NHO-01 e NR-15 vêm configurados de fábrica e não podem ser alterados, o que evita erro de configuração. O terceiro, USER, é livre: você define circuito, resposta, limiar, critério e incremento. No relatório, usa-se o resultado do critério exigido: NHO-01 para a avaliação técnica de exposição e PGR, NR-15 para a caracterização de insalubridade, e USER para outro critério, por exemplo o da ACGIH ou o da OSHA.',
    run: async (app, ctx) => { await menuOpen(app, ctx); await menuGo(app, ctx, 'ajustes'); } },
  { chapter: 'config', title: 'Ajustes › Ponderação de frequência', highlight: 'menu',
    text: 'O menu Ajustes configura somente o critério USER. Primeiro item: ponderação em frequência, com as opções A, C e Z. O circuito A imita a sensibilidade do ouvido e é o exigido pela NHO-01 e pela NR-15 para ruído contínuo ou intermitente. O C é usado para picos e ruído de impacto, e o Z é linear, sem ponderação. Selecionamos A e confirmamos.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'pfreq'); await pageSet(app, ctx, 'A', { showAll: true }); } },
  { chapter: 'config', title: 'Ajustes › Ponderação no tempo', highlight: 'menu',
    text: 'Ponderação temporal, ou resposta do instrumento: lenta, S, ou rápida, F. A NHO-01 e o Anexo 1 da NR-15 pedem resposta lenta, slow, para ruído contínuo ou intermitente. Mantemos Lenta.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'ptemp'); await pageSet(app, ctx, 0, { showAll: true }); } },
  { chapter: 'config', title: 'Ajustes › Nível limiar', highlight: 'play',
    text: 'Nível limiar de integração: abaixo dele o som não entra no cálculo da dose. O ajuste vai de 60 a 90 dB, de 1 em 1. A tecla play aumenta e a tecla stop diminui. Na NHO-01 e na NR-15 o limiar é 80 dB(A). Ajustamos para 80 e confirmamos.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'limiar'); for (let i = 0; i < 3 && ctx.alive(); i++) await press(app, 'stop', 0, 520); await pageSet(app, ctx, 80); } },
  { chapter: 'config', title: 'Ajustes › Nível critério', highlight: 'play',
    text: 'Nível critério, ou critério de referência: é o nível que, mantido por 8 horas, corresponde a 100% de dose. Vai de 80 a 90 dB. NHO-01 e NR-15 usam 85 dB(A). Ajustamos 85.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'criterio'); for (let i = 0; i < 2 && ctx.alive(); i++) await press(app, 'play', 0, 520); await pageSet(app, ctx, 85); } },
  { chapter: 'config', title: 'Ajustes › Taxa de troca (incremento de duplicação de dose)', highlight: 'play',
    text: 'Taxa de troca, ou incremento de duplicação de dose, a letra q: quantos decibéis a mais dobram a dose. As opções são 3, 4 e 5. Com q igual a 3, critério de igual energia da NHO-01, cada 3 dB a mais dobra a dose e corta pela metade o tempo permitido. Com q igual a 5, da NR-15, isso só acontece a cada 5 dB. O q igual a 4 é usado por alguns critérios estrangeiros. Para o USER, inserimos q igual a 3.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'taxa'); await pageSet(app, ctx, 5, { confirm: false }); await wait(900); await pageSet(app, ctx, 3); } },
  { chapter: 'config', title: 'Ajustes › Filtros de oitava', highlight: 'menu',
    text: 'Filtros: liga a análise em bandas de oitava, de 63 hertz a 8 quilohertz, usada nas telas de Espectro e Oitavas. Ela ajuda a escolher o protetor auditivo e a medida de controle na fonte. Deixamos ligado. Depois, Voltar.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'filtros'); await pageSet(app, ctx, 0); await menuGo(app, ctx, null); } },
  { chapter: 'config', title: 'Dosimetria › Duração e horário de pausa', highlight: 'menu',
    text: 'No menu Dosimetria, o item Duração define o tempo de medição, aqui 8 horas, e o horário de pausa programada, usado no almoço: das 11 às 12 horas o aparelho não integra. A tecla menu avança de campo em campo: horas e minutos da duração, depois início e fim da pausa.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'dosimetria'); await menuGo(app, ctx, 'duracao'); await fieldsWalk(app, ctx, 6, 1000); } },
  { chapter: 'config', title: 'Dosimetria › Intervalo, Agenda e Registros', highlight: 'stop',
    text: 'Intervalo é de quanto em quanto tempo o aparelho grava um ponto do histórico, aqui 1 segundo. Agenda programa o início automático da medição. Registros lista as medições salvas, até 99 de 8 horas, e permite fazer a pós-calibração de uma medição já encerrada.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'intervalo'); await wait(900); await pageSet(app, ctx, 1); await menuGo(app, ctx, 'agenda'); await wait(900); await pageSet(app, ctx, 0); await menuGo(app, ctx, 'registros'); await wait(1600); for (let i = 0; i < 2 && ctx.alive(); i++) await press(app, 'stop', 0, 600); for (let i = 0; i < 3 && ctx.alive(); i++) await press(app, 'play', 0, 450); if (ctx.alive()) await press(app, 'menu', 0, 800); } }, // sobe até 'Voltar'
  { chapter: 'config', title: 'Dosimetria › Apagar e Calibrar', highlight: 'stop',
    text: 'Apagar exclui todas as medições da memória e pede confirmação; respondemos Não. Calibrar faz a calibração acústica pelo menu, que vamos usar daqui a pouco com o calibrador. Voltamos ao menu principal.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'apagar'); await wait(1400); await pageSet(app, ctx, 0); await menuGo(app, ctx, null); } },
  { chapter: 'config', title: 'Sistema: data/hora, tela e idioma', highlight: 'menu',
    text: 'Sistema. Data e hora precisam estar certas, porque aparecem no relatório e no registro da calibração. Tela ajusta o brilho e o tempo para o visor apagar, economizando bateria. Idioma: português, inglês ou espanhol.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'sistema'); await menuGo(app, ctx, 'datahora'); await fieldsWalk(app, ctx, 4, 700); await menuGo(app, ctx, 'tela'); await fieldsWalk(app, ctx, 2, 800); await menuGo(app, ctx, 'idioma'); await wait(800); await pageSet(app, ctx, 0); await menuGo(app, ctx, null); } },
  { chapter: 'config', title: 'Sobre e saída do menu', highlight: 'menu',
    text: 'Sobre mostra a versão do firmware, o número de série e as normas atendidas: IEC 61252, ANSI S1.25, NR-15 e NHO-01. O número de série vai no relatório e no certificado de calibração, que deve ser renovado anualmente. Para sair do menu, segure a tecla menu.',
    run: async (app, ctx) => { await menuGo(app, ctx, 'sobre'); await wait(2600); if (ctx.alive()) await press(app, 'menu', 0, 600); await menuExit(app); } },
  { chapter: 'cal', title: 'Calibração: retirar a espuma', highlight: null,
    text: 'Antes de cada medição o dosímetro deve ser calibrado com o calibrador acústico, de acordo com as instruções do fabricante. Primeiro retiramos a espuma do microfone.',
    run: async (app) => { const d = app.dosimeter; app.setView('calib', { animate: true, duration: 1.6 });
      if (d?.group && d.group.parent !== app.anchors.presentDevice) { await app.present(d.group, 'presentDevice', 1.4); app.state.mounted = false; app.emit('change'); }
      d?.setWindscreen?.(false); } },
  { chapter: 'cal', title: 'Acoplar o calibrador', highlight: null,
    text: 'O calibrador é ligado no nível de 114 decibéis a 1 quilohertz e encaixado no microfone, sem folga. O sinal de referência agora chega ao microfone.',
    run: async (app) => { if (app.stage?.view !== 'calib') app.setView('calib', { animate: true, duration: 1.2 }); await fwDo.couple(app, true); } },
  { chapter: 'cal', title: 'Calibrar', highlight: 'menu',
    text: 'No menu Dosimetria, opção Calibrar, selecionamos o mesmo nível aplicado pelo calibrador, 114 dB, e confirmamos. O aparelho ajusta a sensibilidade até ler 114,0 dB.',
    run: async (app) => { if (app.stage?.view !== 'calib') app.setView('calib', { animate: true, duration: 1.2 });
      if (!app.state.calibratorCoupled) await fwDo.couple(app, true); await fwDo.powerOn(app); await fwDo.calibrate(app, 114); } },
  { chapter: 'cal', title: 'Calibração concluída', highlight: null,
    text: 'Retiramos o calibrador e recolocamos a espuma. Ao final da jornada a calibração será aferida de novo: se a diferença passar de mais ou menos 1 dB, a NHO-01 manda invalidar a medição e repetir.',
    run: async (app) => { await fwDo.couple(app, false); app.dosimeter?.setWindscreen?.(true); } },
];
