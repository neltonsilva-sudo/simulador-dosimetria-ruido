// Aula "Dose de ruído" — dono: UI/DEMO. Botão 📐 Dose → painel com passos narrados (voz Francisca gravada por
// tools/gen_tts.py a partir dos campos `text:` deste arquivo — não alterar um texto sem regenerar o áudio), duas máquinas
// do galpão destacadas emitindo ruído (anéis no piso + etiqueta) e som solado de cada uma, fórmula da dose, NE/NEN,
// comparação NR-15 e parecer. Números calculados com o núcleo normativo (dosimetry.js), não digitados à mão.
import { CRITERIA, allowedMinutes, nr15AllowedMinutes } from './dosimetry.js';
import { MACHINES } from './layout_machines.js';
import { buildSLM } from './ui_slm.js';

// Caso pedido pelo usuário: ruído contínuo, 4 h a 90 dB(A) + 4 h a 85 dB(A)
export const DOSE_CASE = [
  { id: 'prensa1', n: 1, nome: 'Prensa excêntrica 80 t', L: 90, h: 4, color: '#ff7043', labelY: 3.3 },
  { id: 'prensa4', n: 2, nome: 'Prensa hidráulica 150 t', L: 85, h: 4, color: '#ffca28', labelY: 3.6 },
];
// pontos de medição com o decibelímetro (tripé no piso, microfone na altura do ouvido voltado para a máquina)
const SPOTS = { m1: { pos: [-0.87, -0.62], src: [-1.3, -1.95], L: 90 }, m2: { pos: [-5.24, -1.92], src: [-6.8, -4.0], L: 85 } };
const C1 = DOSE_CASE[0].h * 60, C2 = DOSE_CASE[1].h * 60;
const T1 = allowedMinutes(DOSE_CASE[0].L, CRITERIA.NHO01), T2 = allowedMinutes(DOSE_CASE[1].L, CRITERIA.NHO01);
const d1 = C1 / T1, d2 = C2 / T2, D = (d1 + d2) * 100;
const NE = 85 + 10 * Math.log10((480 / 480) * (D / 100)), NEN = NE + 10 * Math.log10(480 / 480);
const R1 = nr15AllowedMinutes(DOSE_CASE[0].L), R2 = nr15AllowedMinutes(DOSE_CASE[1].L);
const DR = (C1 / R1 + C2 / R2) * 100, NE5 = 85 + 16.61 * Math.log10(DR / 100);
const MAX1 = (1 - d2) * T1; // tempo máximo na máquina 1 mantidas as 4 h na máquina 2 (dose = 100 %)

const f = (n, d = 1) => n.toFixed(d).replace('.', ',');
const fr = (a, b) => `<span class="fr"><span>${a}</span><span>${b}</span></span>`;
const P = (s) => `<span class="par">(</span>${s}<span class="par">)</span>`;
const sub = (s, i) => `${s}<sub>${i}</sub>`;
const hm = (min) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`;

function doseBar() {
  const max = 250, w = (v) => (v / max) * 100;
  return `<div class="dz-bar"><div class="dz-track"><i style="width:${w(d1 * 100)}%;background:${DOSE_CASE[0].color}"></i><i style="left:${w(d1 * 100)}%;width:${w(d2 * 100)}%;background:${DOSE_CASE[1].color}"></i>
    <em style="left:${w(50)}%"></em><em class="lim" style="left:${w(100)}%"></em></div>
    <div class="dz-scale"><span style="left:0">0</span><span style="left:${w(50)}%">50 % ação</span><span style="left:${w(100)}%">100 % limite</span><span style="left:${w(200)}%">200 %</span></div>
    <div class="dz-leg"><span><i style="background:${DOSE_CASE[0].color}"></i>Máquina 1: ${f(d1 * 100)} %</span><span><i style="background:${DOSE_CASE[1].color}"></i>Máquina 2: ${f(d2 * 100)} %</span></div></div>`;
}
const caseTable = () => `<table class="dz-t"><tr><th></th><th>Máquina</th><th>Nível</th><th>Tempo</th></tr>${DOSE_CASE.map((m) =>
  `<tr><td><i class="dot" style="background:${m.color}"></i></td><td>${m.n} · ${m.nome}</td><td><b>${m.L} dB(A)</b></td><td>${m.h} h (${m.h * 60} min)</td></tr>`).join('')}</table>
  <p class="dz-note">Ruído contínuo · jornada de 8 h (480 min) · critério NHO-01: CR = 85 dB(A), q = 3 dB</p>`;

export const DOSE_STEPS = [
  { id: 'intro', meter: null, cam: 'both', solo: ['prensa1', 'prensa4'], focus: null,
    title: 'O que é a dose de ruído',
    text: 'A dose de ruído é a porcentagem da exposição diária máxima permitida que o trabalhador já recebeu. Cem por cento significa que o limite de exposição foi atingido. Cada nível de ruído tem um tempo máximo permitido, e cada minuto de exposição consome uma parte desse tempo. Quando há mais de um nível na jornada, somamos as frações de cada um. Neste galpão, o trabalhador fica 4 horas na máquina 1 e 4 horas na máquina 2.',
    html: () => `<div class="eq big">D = ${P(`${fr(sub('C', 1), sub('T', 1))} + ${fr(sub('C', 2), sub('T', 2))} + … + ${fr(sub('C', 'n'), sub('T', 'n'))}`)} × 100 %</div>
      <ul class="dz-leg2"><li><b>D</b> = dose diária (%)</li><li><b>C<sub>n</sub></b> = tempo real de exposição ao nível n</li><li><b>T<sub>n</sub></b> = tempo máximo permitido para o nível n</li></ul>${caseTable()}` },
  { id: 'medir', cam: 'spot', meter: 'm1', solo: ['prensa1'], focus: 'prensa1',
    title: 'Medição com o decibelímetro',
    text: 'Antes de calcular a dose, quantificamos o nível de ruído de cada posto com o decibelímetro, o medidor de nível de pressão sonora. Ele é verificado com o calibrador acústico antes e depois da medição. Com a tecla A barra C selecionamos o circuito de ponderação A, e com a tecla F barra S, a resposta lenta. O microfone fica na zona auditiva do trabalhador, na altura do ouvido e voltado para a fonte, com o avaliador afastado para não interferir. Como o ruído é contínuo, lemos o valor estabilizado no visor.',
    html: () => `<div class="dz-cards dz-cards3">
        <div style="--c:#5aa4ff"><span>Ponderação</span><b>A · dB(A)</b><small>tecla A/C</small></div>
        <div style="--c:#5aa4ff"><span>Resposta</span><b>Lenta (S)</b><small>tecla F/S</small></div>
        <div style="--c:#5aa4ff"><span>Posição</span><b>Zona auditiva</b><small>altura do ouvido, raio de 150 mm</small></div>
        <div style="--c:#30a46c"><span>Verificação</span><b>Calibrador</b><small>94/114 dB, antes e depois</small></div>
        <div style="--c:#30a46c"><span>Leitura</span><b>Valor estável</b><small>ruído contínuo</small></div>
        <div style="--c:#f5a524"><span>Ruído variável</span><b>Dosímetro</b><small>integra a jornada toda</small></div></div>
      <div class="dz-live">Visor agora: <b data-live>--,-</b> dB(A)</div>` },
  { id: 'm1', cam: 'meter', meter: 'm1', solo: ['prensa1'], focus: 'prensa1',
    title: 'Máquina 1 — prensa excêntrica: 90 dB(A) por 4 horas',
    text: 'Com o decibelímetro na zona auditiva, junto à máquina 1, a prensa excêntrica, o visor estabiliza em 90 dB(A). O trabalhador fica 4 horas nesse posto, então o tempo de exposição C1 é de 240 minutos. Escute o ruído só desta máquina.',
    html: () => `<div class="dz-live">Leitura no decibelímetro: <b data-live>--,-</b> dB(A) <small>(A, lenta)</small></div><div class="dz-cards"><div style="--c:${DOSE_CASE[0].color}"><span>Nível L<sub>1</sub></span><b>90 dB(A)</b></div><div style="--c:${DOSE_CASE[0].color}"><span>Exposição C<sub>1</sub></span><b>4 h = 240 min</b></div></div>` },
  { id: 'm2', cam: 'meter', meter: 'm2', solo: ['prensa4'], focus: 'prensa4',
    title: 'Máquina 2 — prensa hidráulica: 85 dB(A) por 4 horas',
    text: 'Levamos o decibelímetro para a máquina 2, a prensa hidráulica. O visor estabiliza em 85 dB(A), e o trabalhador fica 4 horas nesse posto. O tempo de exposição C2 é de 240 minutos. Parece só 5 decibéis a menos, mas a escala é logarítmica: a cada 3 decibéis a energia sonora dobra, então 90 dB(A) carrega cerca de três vezes a energia de 85 dB(A).',
    html: () => `<div class="dz-live">Leitura no decibelímetro: <b data-live>--,-</b> dB(A) <small>(A, lenta)</small></div><div class="dz-cards"><div style="--c:${DOSE_CASE[1].color}"><span>Nível L<sub>2</sub></span><b>85 dB(A)</b></div><div style="--c:${DOSE_CASE[1].color}"><span>Exposição C<sub>2</sub></span><b>4 h = 240 min</b></div></div>
      <div class="eq">${fr('E<sub>90</sub>', 'E<sub>85</sub>')} = 10<sup>(90 − 85)/10</sup> = ${f(Math.pow(10, 0.5), 2)} ≈ 3 vezes mais energia</div>` },
  { id: 'tp', meter: 'm2', cam: 'both', solo: ['prensa1', 'prensa4'], focus: null,
    title: 'Tempo máximo permitido (NHO-01)',
    text: 'Pela NHO-01, o critério de referência é 85 dB(A) para 8 horas, e o incremento de duplicação de dose é 3 decibéis: a cada 3 decibéis a mais, o tempo permitido cai pela metade. Para 90 dB(A), o tempo máximo é de 151 minutos, cerca de 2 horas e 31 minutos. Para 85 dB(A), são 480 minutos, as 8 horas completas.',
    html: () => `<div class="eq big">T<sub>n</sub> = ${fr('480', `2<sup>(L<sub>n</sub> − 85) / 3</sup>`)} <small>min</small></div>
      <div class="eq" style="--c:${DOSE_CASE[0].color}">T<sub>1</sub> = ${fr('480', '2<sup>(90 − 85)/3</sup>')} = ${fr('480', `2<sup>${f(5 / 3, 3)}</sup>`)} = ${fr('480', f(Math.pow(2, 5 / 3), 3))} = <b>${f(T1)} min</b> <small>(${hm(T1)})</small></div>
      <div class="eq" style="--c:${DOSE_CASE[1].color}">T<sub>2</sub> = ${fr('480', '2<sup>(85 − 85)/3</sup>')} = ${fr('480', '2<sup>0</sup>')} = <b>${f(T2, 0)} min</b> <small>(8 h)</small></div>` },
  { id: 'dose', meter: 'm2', cam: 'both', solo: ['prensa1', 'prensa4'], focus: null,
    title: 'Cálculo da dose (NHO-01)',
    text: 'Agora aplicamos a fórmula da dose. Na máquina 1, 240 dividido por 151,2 dá 1,587, ou seja, 158,7 por cento. Na máquina 2, 240 dividido por 480 dá 0,5, ou seja, 50 por cento. Somando, a dose da jornada é de 208,7 por cento: mais que o dobro do limite.',
    html: () => `<div class="eq">D = ${P(`${fr(sub('C', 1), sub('T', 1))} + ${fr(sub('C', 2), sub('T', 2))}`)} × 100</div>
      <div class="eq">D = ${P(`${fr('240', f(T1))} + ${fr('240', '480')}`)} × 100</div>
      <div class="eq">D = (${f(d1, 3)} + ${f(d2, 3)}) × 100 = <b class="res">${f(D)} %</b></div>${doseBar()}` },
  { id: 'nen', cam: 'both', meter: 'm2', solo: ['prensa1', 'prensa4'], focus: null,
    title: 'Nível de exposição a partir da dose (NE e NEN)',
    text: 'Agora calculamos o nível de exposição a partir da dose. O NE é o nível médio que, mantido constante durante o tempo de exposição, daria a mesma dose. Pela NHO-01, NE é igual a 10 vezes o logaritmo de 480 sobre TE vezes D sobre 100, mais 85. A jornada tem 480 minutos, então 480 sobre 480 é 1. A dose de 208,7 por cento dividida por 100 dá 2,087. O logaritmo de 2,087 é 0,320; vezes 10 dá 3,2; somando 85, o NE é de 88,2 dB(A). Como a exposição foi de 8 horas, o nível normalizado, NEN, também é 88,2 dB(A): acima do limite de 85 e do nível de ação de 82 dB(A).',
    html: () => `<div class="eq big">NE = 10 · log${P(`${fr('480', 'TE')} · ${fr('D', '100')}`)} + 85</div>
      <ol class="dz-pass">
        <li><span>Tempo de exposição</span><div class="eq">${fr('480', 'TE')} = ${fr('480', '480')} = 1</div></li>
        <li><span>Dose em fração</span><div class="eq">${fr('D', '100')} = ${fr(f(D), '100')} = ${f(D / 100, 3)}</div></li>
        <li><span>Logaritmo</span><div class="eq">log(1 × ${f(D / 100, 3)}) = ${f(Math.log10(D / 100), 3)}</div></li>
        <li><span>× 10 + 85</span><div class="eq">10 × ${f(Math.log10(D / 100), 3)} + 85 = ${f(10 * Math.log10(D / 100), 2)} + 85 = <b class="res">${f(NE)} dB(A)</b></div></li>
        <li><span>Normalização para 8 h</span><div class="eq">NEN = NE + 10 · log${P(fr('TE', '480'))} = ${f(NE)} + 10 · log(1) = <b class="res">${f(NEN)} dB(A)</b></div></li></ol>
      <div class="dz-chips"><span class="bad">NEN ${f(NEN)} dB(A)</span><span>Limite 85 dB(A)</span><span>Nível de ação 82 dB(A)</span></div>
      <p class="dz-note">Conferência: um ruído constante de ${f(NE)} dB(A) por 8 h daria T = 480 / 2<sup>(${f(NE)} − 85)/3</sup> = ${f(480 / Math.pow(2, (NE - 85) / 3))} min → dose = 480 / ${f(480 / Math.pow(2, (NE - 85) / 3))} = ${f(D)} %.</p>` },
  { id: 'nr15', meter: 'm2', cam: 'both', solo: ['prensa1', 'prensa4'], focus: null,
    title: 'Comparação pela NR-15 (Anexo 1)',
    text: 'Pela NR-15, o incremento é de 5 decibéis e os tempos vêm do Quadro do Anexo 1: 90 dB(A) permite 4 horas e 85 dB(A) permite 8 horas. A dose é 4 sobre 4 mais 4 sobre 8, igual a 1,5, ou seja, 150 por cento. Também passa de 100 por cento, o que caracteriza insalubridade em grau médio.',
    html: () => `<table class="dz-t"><tr><th>Nível</th><th>Máxima exposição diária permissível (Quadro do Anexo 1)</th></tr><tr><td>85 dB(A)</td><td>8 horas</td></tr><tr><td>90 dB(A)</td><td>4 horas</td></tr></table>
      <div class="eq">D = ${P(`${fr('4 h', '4 h')} + ${fr('4 h', '8 h')}`)} × 100 = (1,00 + 0,50) × 100 = <b class="res">${f(DR)} %</b></div>
      <div class="eq">NE<sub>(q=5)</sub> = 16,61 · log${P(fr('D', '100'))} + 85 = <b>${f(NE5)} dB(A)</b></div>
      <p class="dz-note">A NHO-01 (q = 3) é mais protetiva que a NR-15 (q = 5): a mesma jornada dá ${f(D)} % contra ${f(DR)} %.</p>` },
  { id: 'parecer', meter: 'm2', cam: 'both', solo: ['prensa1', 'prensa4'], focus: null,
    title: 'Parecer técnico da exposição',
    text: 'Parecer: a exposição ao ruído está acima do limite de exposição. Pela NHO-01, a dose é de 208,7 por cento e o NEN de 88,2 dB(A), o que exige a adoção imediata de medidas corretivas. Pela NR-15, a dose de 150 por cento caracteriza a atividade como insalubre em grau médio. Medidas recomendadas: controle na fonte, como enclausuramento e manutenção da prensa; redução do tempo na máquina 1, que, mantidas as 4 horas na máquina 2, poderia ser de no máximo 75 minutos; protetor auricular com atenuação adequada; e inclusão no programa de conservação auditiva, com audiometrias pelo PCMSO.',
    html: () => `<div class="dz-verd">ACIMA DO LIMITE DE EXPOSIÇÃO</div>
      <table class="dz-t"><tr><th>Critério</th><th>Dose</th><th>NE / NEN</th><th>Situação</th></tr>
        <tr><td>NHO-01 (q = 3)</td><td><b>${f(D)} %</b></td><td>${f(NEN)} dB(A)</td><td class="bad">Adoção imediata de medidas corretivas</td></tr>
        <tr><td>NR-15 (q = 5)</td><td><b>${f(DR)} %</b></td><td>${f(NE5)} dB(A)</td><td class="bad">Insalubre — grau médio (20 %)</td></tr></table>
      <table class="dz-t dz-crit"><tr><th>Dose (NHO-01)</th><th>NEN</th><th>Consideração técnica</th></tr>
        <tr><td>0 a 50 %</td><td>até 82</td><td>Aceitável</td></tr><tr><td>50 a 80 %</td><td>82 a 84</td><td>Acima do nível de ação — medidas preventivas</td></tr>
        <tr><td>80 a 100 %</td><td>84 a 85</td><td>Região de incerteza — medidas preventivas e corretivas</td></tr>
        <tr class="on"><td>acima de 100 %</td><td>acima de 85</td><td>Acima do limite — medidas corretivas imediatas</td></tr></table>
      <ol class="dz-med"><li><b>Fonte:</b> enclausuramento acústico, amortecimento e manutenção da prensa excêntrica.</li>
        <li><b>Organização:</b> com 4 h na máquina 2 (${f(d2 * 100, 0)} %), a máquina 1 poderia ocupar no máximo (1 − ${f(d2, 2)}) × ${f(T1)} ≈ <b>${Math.floor(MAX1)} min</b>.</li>
        <li><b>EPI:</b> protetor auricular com atenuação adequada (CA válido), treinamento e fiscalização do uso.</li>
        <li><b>Saúde:</b> programa de conservação auditiva e audiometrias pelo PCMSO (NR-7).</li></ol>` },
];

// vistas da câmera (mundo: trabalhadora em 0,0,0; prensa1 em −1,3/−1,95; prensa4 em −6,8/−4,0)
const CAMS = {
  both: { pos: [2.6, 3.4, 5.6], target: [-2.4, 1.2, -4.4], fov: 50 },
  m1: { pos: [0.6, 2.8, 3.8], target: [0.2, 1.3, -2.6], fov: 52 },
  m2: { pos: [-2.4, 2.7, 1.8], target: [-5.4, 1.5, -4.8], fov: 50 },
};

export function createDoseLesson({ root, app, h, say, stopVoice, pauseVoice = () => false, resumeVoice = async () => false }) {
  const THREE = app.stage.THREE;
  const host = root.parentElement ? root : document.body;
  let active = false, idx = 0, token = 0, auto = true, prevView = null;

  // ── decibelímetro no tripé ──
  const slm = buildSLM(THREE); app.stage.scene.add(slm.group); let slmAt = null;
  const tmpV = new THREE.Vector3();
  function spotCam(key, close) {
    const sp = SPOTS[key]; const bx = sp.pos[0] - sp.src[0], bz = sp.pos[1] - sp.src[1], bl = Math.hypot(bx, bz), b = [bx / bl, bz / bl], sd = [-b[1], b[0]];
    if (!close) return { pos: [sp.pos[0] + b[0] * 2.1 + sd[0] * 0.9, 1.85, sp.pos[1] + b[1] * 2.1 + sd[1] * 0.9], target: [(sp.pos[0] + sp.src[0]) / 2 - sd[0] * 0.8, 1.3, (sp.pos[1] + sp.src[1]) / 2 - sd[1] * 0.8], fov: 48 };
    const P = slm.lcdWorld(tmpV);
    return { pos: [P.x + b[0] * 0.4 + sd[0] * 0.06, P.y + 0.24, P.z + b[1] * 0.4 + sd[1] * 0.06], target: [P.x - b[0] * 0.3 - sd[0] * 0.13, P.y - 0.1, P.z - b[1] * 0.3 - sd[1] * 0.13], fov: 40 };
  }

  // ── marcadores 3D: anéis de ruído no piso (ondas) ──
  const group = new THREE.Group(); group.name = 'dose-markers'; group.visible = false; app.stage.scene.add(group);
  const marks = DOSE_CASE.map((c) => {
    const m = MACHINES.find((x) => x.id === c.id); const g = new THREE.Group(); g.position.set(m.pos[0], 0.025, m.pos[2]); group.add(g);
    const rings = [0, 1, 2, 3].map((k) => {
      const mat = new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
      const r = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96), mat); r.rotation.x = -Math.PI / 2; r.userData.noAO = true; r.renderOrder = 5; g.add(r); return { r, mat, k };
    });
    const base = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    base.rotation.x = -Math.PI / 2; base.userData.noAO = true; g.add(base);
    const lbl = h('div', 'ui-dose-lbl hidden', `<i style="background:${c.color}"></i><div><b>MÁQUINA ${c.n}</b><span>${c.nome}</span><em>${c.L} dB(A) · ${c.h} h</em></div><u class="w" style="color:${c.color}">)))</u>`);
    host.appendChild(lbl);
    return { c, g, rings, base, lbl, world: new THREE.Vector3(m.pos[0], c.labelY, m.pos[2]), on: 1 };
  });
  const v = new THREE.Vector3();
  app.stage.onFrame((dt, t) => {
    if (!active) return;
    slm.update(dt, t); const lv = panel.querySelector('[data-live]'); if (lv && slm.group.visible) lv.textContent = slm.reading.toFixed(1).replace('.', ',');
    const cam = app.stage.camera, W = innerWidth, H = innerHeight;
    for (const m of marks) {
      const want = m.focusOn ? 1 : 0.28; m.on += (want - m.on) * Math.min(1, dt * 4);
      for (const { r, mat, k } of m.rings) {
        const ph = (t * (m.c.L >= 90 ? 0.55 : 0.4) + k / 4) % 1;            // máquina mais ruidosa pulsa mais rápido
        const s = 1.2 + ph * (m.c.L >= 90 ? 3.8 : 2.8); r.scale.setScalar(s);
        mat.opacity = Math.sin(ph * Math.PI) * 0.75 * m.on;
      }
      m.base.material.opacity = 0.12 * m.on;
      v.copy(m.world).project(cam);
      const vis = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      m.lbl.classList.toggle('hidden', !vis);
      if (vis) { m.lbl.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px) translate(-50%, -100%)`; m.lbl.style.opacity = (0.45 + 0.55 * m.on).toFixed(2); }
    }
  });

  // ── painel ──
  const panel = h('div', 'ui-dose glass hidden', '');
  host.appendChild(panel);
  function paint() {
    const st = DOSE_STEPS[idx];
    panel.innerHTML = `<div class="dz-h"><span>📐 Dose de ruído · passo ${idx + 1}/${DOSE_STEPS.length}</span><button class="ui-x dz-x" title="Fechar">✕</button></div>
      <h3>${st.title}</h3><p class="dz-p">${st.text}</p><div class="dz-calc">${st.html()}</div>
      <div class="dz-dots">${DOSE_STEPS.map((s, i) => `<button data-i="${i}" class="${i === idx ? 'on' : i < idx ? 'done' : ''}" title="${s.title}"></button>`).join('')}</div>
      <div class="dz-nav"><button class="ui-btn" data-a="prev">◀ Anterior</button><button class="ui-btn ghost" data-a="auto">${auto ? '⏸ Pausar' : '▶ Continuar'}</button>
        <button class="ui-btn ghost" data-a="rep">🔁 Ouvir</button><button class="ui-btn primary" data-a="next">${idx === DOSE_STEPS.length - 1 ? 'Concluir ✓' : 'Próximo ▶'}</button></div>`;
    panel.querySelector('.dz-x').onclick = close;
    panel.querySelectorAll('.dz-dots button').forEach((b) => (b.onclick = () => go(+b.dataset.i)));
    panel.querySelectorAll('.dz-nav button').forEach((b) => (b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'prev') go(idx - 1); else if (a === 'next') (idx === DOSE_STEPS.length - 1 ? close() : go(idx + 1));
      else if (a === 'rep') go(idx); else if (a === 'auto') { auto = !auto; if (auto) resume(); else pauseVoice(); paint(); }
    }));
    panel.scrollTop = 0;
  }
  function solo(ids) {
    const map = {}; for (const m of MACHINES) map[m.id] = ids.includes(m.id); app.audio?.setRunning?.(map);
  }
  async function go(i) {
    if (!active) return; i = Math.max(0, Math.min(DOSE_STEPS.length - 1, i));
    const my = ++token; idx = i; const st = DOSE_STEPS[i]; paint();
    for (const m of marks) m.focusOn = !st.focus || st.focus === m.c.id;
    solo(st.solo);
    if (st.meter) { slm.group.visible = true; if (slmAt !== st.meter) { slmAt = st.meter; slm.placeAt(SPOTS[st.meter].pos, SPOTS[st.meter].src); } slm.setTarget(SPOTS[st.meter].L); }
    else { slm.group.visible = false; slmAt = null; }
    if (st.cam === 'meter' || st.cam === 'spot') {
      const v2 = spotCam(st.meter, st.cam === 'meter'); app.stage.flyTo(v2, 2.2);
      if (st.cam === 'meter') app.stage.setFocus?.(slm.lcdWorld(new THREE.Vector3())); else app.stage.setFocus?.(null);
    } else { app.stage.flyTo(CAMS[st.cam], 2.2); app.stage.setFocus?.(null); }
    await say(st.text);
    if (my !== token || !active || !auto || idx >= DOSE_STEPS.length - 1) return;
    await new Promise((r) => setTimeout(r, 1400));
    if (my === token && active && auto) go(idx + 1);
  }
  // ▶ Continuar: retoma a fala de onde parou e, ao terminar, segue para o próximo passo
  async function resume() {
    const my = token;
    const wasPaused = await resumeVoice();
    if (my !== token || !active || !auto || idx >= DOSE_STEPS.length - 1) return;
    await new Promise((r) => setTimeout(r, wasPaused ? 1400 : 600));
    if (my === token && active && auto) go(idx + 1);
  }
  function open(start = 0) {
    if (active) return go(start);
    app.audio?.start?.(); active = true; prevView = app.stage.view || 'ref';
    host.classList.add('dose-on'); panel.classList.remove('hidden'); group.visible = true;
    app.stage.setFocus?.(null); app.dosimeter?.highlight?.(null);
    go(start);
  }
  function close() {
    if (!active) return; active = false; token++; stopVoice();
    host.classList.remove('dose-on'); panel.classList.add('hidden'); group.visible = false; slm.group.visible = false; slmAt = null;
    for (const m of marks) m.lbl.classList.add('hidden');
    app.audio?.setRunning?.(app.running());
    app.setView(prevView === 'orbit' ? 'ref' : prevView || 'ref', { animate: true, duration: 2 });
  }
  addEventListener('keydown', (e) => { if (active && e.key === 'Escape') close(); });
  return { open, close, get active() { return active; } };
}
