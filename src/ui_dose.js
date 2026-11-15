// Aula "Dose de ruído" — dono: UI/DEMO. Botão 📐 Dose → painel com passos narrados (voz Francisca gravada por
// tools/gen_tts.py a partir dos campos `text:` deste arquivo — não alterar um texto sem regenerar o áudio), duas máquinas
// do galpão destacadas emitindo ruído (anéis no piso + etiqueta) e som solado de cada uma, fórmula da dose, NE/NEN,
// comparação NR-15 e parecer. Números calculados com o núcleo normativo (dosimetry.js), não digitados à mão.
import { CRITERIA, allowedMinutes, nr15AllowedMinutes } from './dosimetry.js';
import { MACHINES } from './layout_machines.js';
import { buildSLM } from './ui_slm.js';
import { buildSlmCal } from './slm_cal.js';

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
  { id: 'config', dur: 31.4, cam: 'meter', meter: 'm1', solo: ['prensa1'], focus: 'prensa1',
    title: 'Configuração do decibelímetro',
    text: 'Antes de medir, configuramos o decibelímetro. Ligamos o aparelho na tecla azul e conferimos a carga da bateria. Na tecla A barra C escolhemos a ponderação A, que imita a sensibilidade do ouvido humano e é a usada para avaliar a exposição ocupacional. Na tecla F barra S escolhemos a resposta lenta, slow, indicada para ruído contínuo. A função MAX fica desligada, para o visor mostrar o nível instantâneo, e a tecla LEVEL ajusta a faixa de medição, para que o valor lido não fique fora da escala.',
    init: (slm) => slm.setMode?.({ power: false, weight: 'C', resp: 'F', max: true, cal: false }),
    cues: [
      ['Ligamos o aparelho', (k) => { k.slm.highlight?.('power'); k.slm.press?.('power'); k.slm.setMode?.({ power: true }); k.mark('power') }],
      ['Na tecla A barra C', (k) => k.slm.highlight?.('ac')],
      ['escolhemos a ponderação A', (k) => { k.slm.press?.('ac'); k.slm.setMode?.({ weight: 'A' }); k.mark('ac') }],
      ['Na tecla F barra S', (k) => k.slm.highlight?.('fs')],
      ['escolhemos a resposta lenta', (k) => { k.slm.press?.('fs'); k.slm.setMode?.({ resp: 'S' }); k.mark('fs') }],
      ['A função MAX', (k) => { k.slm.highlight?.('maxmin'); k.slm.press?.('maxmin'); k.slm.setMode?.({ max: false }); k.mark('maxmin') }],
      ['a tecla LEVEL', (k) => { k.slm.highlight?.('level'); k.slm.press?.('level'); k.mark('level') }],
      ['fora da escala', (k) => k.slm.highlight?.(null)],
    ],
    html: () => `<div class="dz-keys">
        <div data-k="power"><kbd class="pw">⏻</kbd><span>Liga</span><b>Bateria OK</b></div>
        <div data-k="ac"><kbd>A/C</kbd><span>Ponderação</span><b>A · dB(A)</b></div>
        <div data-k="fs"><kbd>F/S</kbd><span>Resposta</span><b>Lenta (SLOW)</b></div>
        <div data-k="maxmin"><kbd>MAX/MIN</kbd><span>Retenção</span><b>Desligada</b></div>
        <div data-k="level"><kbd>LEVEL</kbd><span>Faixa</span><b>Valor dentro da escala</b></div></div>
      <div class="dz-live">Visor agora: <b data-live>--,-</b> <span data-unit>dB</span></div>` },
  { id: 'calib', dur: 41.5, cam: 'head', meter: 'm1', solo: [], focus: 'prensa1',
    title: 'Calibração com o calibrador acústico',
    text: 'Agora verificamos a calibração. Retiramos o protetor de espuma e encaixamos o calibrador acústico no microfone, até o anel de borracha assentar. Ligamos o calibrador: ele emite um tom puro de 1 quilohertz, com nível de 114 decibéis. Com o aparelho em modo de calibração, o visor deve indicar 114,0; como indicou 113,6, ajustamos até 114,0. Em seguida, conferimos também em 94 decibéis. Retiramos o calibrador, recolocamos a espuma e anotamos o resultado. Ao final das medições repetimos a verificação: se a diferença passar de 1 decibel, as medições devem ser refeitas.',
    init: (slm) => slm.setMode?.({ power: true, weight: 'A', resp: 'S', max: false, cal: false }),
    cues: [
      ['Retiramos o protetor', (k) => k.slm.setWindscreen?.(false)],
      ['encaixamos o calibrador', (k) => k.couple()],
      ['Ligamos o calibrador', (k) => { k.cal(114); k.slm.setMode?.({ cal: true }); k.slm.setTarget(113.6); k.mark('c114') }],
      ['ajustamos até 114,0', (k) => { k.slm.setTarget(114); k.mark('adj') }],
      ['conferimos também em 94', (k) => { k.cal(94); k.slm.setTarget(94); k.mark('c94') }],
      ['Retiramos o calibrador', (k) => { k.cal(0); k.slm.setMode?.({ cal: false }); k.uncouple() }],
      ['recolocamos a espuma', (k) => { k.slm.setWindscreen?.(true); k.slm.setTarget(SPOTS.m1.L); k.mark('ok') }],
    ],
    html: () => `<div class="dz-cards dz-cards3">
        <div style="--c:#5aa4ff"><span>Calibrador</span><b>Classe 1</b><small>IEC 60942 · acoplador ½"</small></div>
        <div style="--c:#5aa4ff"><span>Sinal de referência</span><b>1 kHz</b><small>114 dB e 94 dB</small></div>
        <div style="--c:#30a46c"><span>Critério</span><b>±1 dB</b><small>entre a verificação inicial e a final</small></div></div>
      <table class="dz-t dz-cal"><tr><th>Etapa</th><th>Calibrador</th><th>Visor</th><th></th></tr>
        <tr data-k="c114"><td>Leitura inicial</td><td>114,0 dB</td><td>113,6 dB</td><td>ajustar</td></tr>
        <tr data-k="adj"><td>Após o ajuste</td><td>114,0 dB</td><td>114,0 dB</td><td class="ok">✓</td></tr>
        <tr data-k="c94"><td>Conferência</td><td>94,0 dB</td><td>94,0 dB</td><td class="ok">✓</td></tr>
        <tr data-k="ok"><td>Verificação final</td><td colspan="3">repetir ao fim das medições</td></tr></table>
      <p class="dz-note">Em 1 kHz as ponderações A e C coincidem: o tom de 114 dB é lido como 114 dB(A).</p>
      <div class="dz-live">Visor agora: <b data-live>--,-</b> <span data-unit>dB</span></div>` },
  { id: 'medir', cam: 'spot', meter: 'm1', solo: ['prensa1'], focus: 'prensa1',
    title: 'Medição com o decibelímetro',
    text: 'Com o decibelímetro configurado e verificado, quantificamos o nível de ruído de cada posto. O microfone fica na zona auditiva do trabalhador, na altura do ouvido e voltado para a fonte, com o avaliador afastado para não interferir. Como o ruído é contínuo, lemos o valor estabilizado no visor. Se o ruído variasse ao longo da jornada, o mais indicado seria o dosímetro, que integra toda a exposição.',
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
  let active = false, idx = 0, token = 0, auto = new URLSearchParams(location.search).get('doseauto') !== '0', prevView = null; // ?doseauto=0: sem avanço automático (capturas)

  // ── decibelímetro no tripé ──
  const slm = buildSLM(THREE); app.stage.scene.add(slm.group); let slmAt = null;
  const tmpV = new THREE.Vector3();
  function spotCam(key, close) {
    const sp = SPOTS[key]; const bx = sp.pos[0] - sp.src[0], bz = sp.pos[1] - sp.src[1], bl = Math.hypot(bx, bz), b = [bx / bl, bz / bl], sd = [-b[1], b[0]];
    if (!close) return { pos: [sp.pos[0] + b[0] * 2.1 + sd[0] * 0.9, 1.85, sp.pos[1] + b[1] * 2.1 + sd[1] * 0.9], target: [(sp.pos[0] + sp.src[0]) / 2 - sd[0] * 0.8, 1.3, (sp.pos[1] + sp.src[1]) / 2 - sd[1] * 0.8], fov: 48 };
    const P = slm.lcdWorld(tmpV);
    return { pos: [P.x + b[0] * 0.4 + sd[0] * 0.06, P.y + 0.24, P.z + b[1] * 0.4 + sd[1] * 0.06], target: [P.x - b[0] * 0.3 - sd[0] * 0.13, P.y - 0.1, P.z - b[1] * 0.3 - sd[1] * 0.13], fov: 40 };
  }

  // close da cabeça do medidor (microfone + calibrador acoplado)
  function headCam(key) {
    const sp = SPOTS[key]; const bx = sp.pos[0] - sp.src[0], bz = sp.pos[1] - sp.src[1], bl = Math.hypot(bx, bz), b = [bx / bl, bz / bl], sd = [-b[1], b[0]];
    slm.group.updateWorldMatrix(true, true); const P = (slm.micTip || slm.mic).getWorldPosition(new THREE.Vector3());
    return { pos: [P.x + b[0] * 0.62 + sd[0] * 0.26, P.y + 0.1, P.z + b[1] * 0.62 + sd[1] * 0.26], target: [P.x - sd[0] * 0.03, P.y - 0.02, P.z - sd[1] * 0.03], fov: 38 };
  }

  // ── calibrador acústico da cena acoplado ao microfone do decibelímetro ──
  // (mesma geometria do acoplamento do dosímetro em demo.js: boca do acoplador coaxial à cápsula, inserção de ~8 mm)
  const CAL_RY = +(new URLSearchParams(location.search).get('calry') ?? -0.4); // giro do calibrador em torno do eixo do microfone (painel para a câmera)
  const MIC_INSERT = 0.0078; let calTween = null, calAnchor = null;
  function cavityLocal(c) {
    const g = c.group; g.updateWorldMatrix(true, true); c.cavity.updateWorldMatrix(true, false);
    const m = new THREE.Matrix4().copy(g.matrixWorld).invert().multiply(c.cavity.matrixWorld), p = new THREE.Vector3(); m.decompose(p, new THREE.Quaternion(), new THREE.Vector3()); return p;
  }
  function anchor(c) {
    const tip = slm.micTip || slm.mic; if (!tip || !c?.cavity) return null;
    if (!calAnchor) { calAnchor = new THREE.Object3D(); calAnchor.name = 'slmCalCouple'; tip.add(calAnchor); }
    const cp = cavityLocal(c), ax = [Math.abs(cp.x), Math.abs(cp.y), Math.abs(cp.z)], i = ax.indexOf(Math.max(...ax));
    const u = new THREE.Vector3(); u.setComponent(i, Math.sign(cp.getComponent(i)) || 1);
    const f = new THREE.Vector3(0, 0, 1); if (Math.abs(u.z) > 0.9) f.set(0, 1, 0); f.addScaledVector(u, -f.dot(u)).normalize();
    const S = new THREE.Matrix4().makeBasis(f, u, new THREE.Vector3().crossVectors(f, u));
    const T = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0));
    calAnchor.quaternion.setFromRotationMatrix(T.multiply(S.transpose()));
    calAnchor.position.set(0, -MIC_INSERT, 0).sub(cp.clone().applyQuaternion(calAnchor.quaternion));
    return calAnchor;
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  // calibrador próprio do decibelímetro (modelo cilíndrico, slm_cal.js) — o CalPro do kit do dosímetro não é mexido
  const scal = buildSlmCal(THREE); scal.group.visible = false;
  function slide(from, to, dur) { calTween = { t: 0, from, to, dur, c: scal }; } // desloca ao longo do eixo da cápsula (m, +afastado)
  function couple() {
    const a = anchor(scal); if (!a) return;
    a.add(scal.group); scal.group.position.set(0, 0.06, 0); scal.group.quaternion.identity(); scal.group.rotation.y = CAL_RY; scal.group.visible = true;
    slide(0.06, 0, 1.6);
  }
  function uncouple() { if (scal.group.visible) slide(0, 0.07, 1.1); }
  function calRelease() { calTween = null; app.audio?.tone?.(false); scal.setOn(false); scal.group.visible = false; }
  function calSet(lv) {
    if (!lv) { scal.press('power'); scal.setOn(false); app.audio?.tone?.(false); return; }
    if (!scal.isOn()) scal.press('power'); else scal.press(String(lv));
    scal.setOn(true); scal.setLevel(lv); app.audio?.tone?.(true, lv);
  }
  // ações sincronizadas com a fala: relógio que para quando a aula é pausada
  let cues = [], actT = 0, held = false;
  const cueCtx = { slm, couple, uncouple, cal: calSet, mark: (k) => { marked.add(k); applyMarks(); } };
  const marked = new Set(); const applyMarks = () => marked.forEach((k) => panel.querySelectorAll(`[data-k="${k}"]`).forEach((e) => e.classList.add('on')));
  const CPS = 14.2; // caracteres por segundo da voz gravada (Francisca, medido nos MP3)
  function resetRig() {
    calRelease(); slm.highlight?.(null); slm.setWindscreen?.(true);
    slm.setMode?.({ power: true, weight: 'A', resp: 'S', max: false, cal: false });
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
    if (!held) { actT += dt; while (cues.length && cues[0].t <= actT) cues.shift().fn(cueCtx); }
    if (calTween) { const k = calTween; k.t = Math.min(1, k.t + dt / k.dur); k.c.group.position.y = k.from + (k.to - k.from) * ease(k.t);
      if (k.t >= 1) { calTween = null; if (k.to > 0.065) { k.c.group.visible = false; } } }
    scal.update(dt); slm.update(dt, t); drawSlmPanel(); const un = panel.querySelector('[data-unit]'); if (un) un.textContent = slm.unit ? slm.unit() : 'dB';
    const lv = panel.querySelector('[data-live]'); if (lv && slm.group.visible) lv.textContent = slm.reading.toFixed(1).replace('.', ',');
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
  // ── visor do decibelímetro ampliado no canto esquerdo (como o "Visor do dosímetro") ──
  const SLM_KEYS = [['power', '⏻', 'pw'], ['fs', 'F/S'], ['ac', 'A/C'], ['maxmin', 'MAX/MIN'], ['level', 'LEVEL']];
  const slmPanel = h('div', 'ui-slmlcd glass hidden', `<div class="ui-cap">Visor do decibelímetro</div>`);
  const LDPR = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const slmCv = h('canvas'); slmCv.width = Math.round(256 * LDPR); slmCv.height = Math.round(240 * LDPR); slmPanel.appendChild(slmCv);
  const slmCtx = slmCv.getContext('2d');
  const slmInfo = h('div', 'sl-info', ''); slmPanel.appendChild(slmInfo);
  const slmKeys = h('div', 'sl-keys', SLM_KEYS.map(([k, t, c]) => `<span data-sk="${k}" class="${c || ''}">${t}</span>`).join('')); slmPanel.appendChild(slmKeys);
  host.appendChild(slmPanel);
  let slmRev = -1, slmHi = undefined, slmInfoTxt = '';
  function drawSlmPanel() {
    if (slmPanel.classList.contains('hidden')) return;
    if (slm.lcdCanvas && slm.lcdRev !== slmRev) {
      slmRev = slm.lcdRev; const W = slmCv.width, H = slmCv.height;
      slmCtx.drawImage(slm.lcdCanvas, 0, 0, W, H);
      const g = slmCtx.createLinearGradient(0, 0, W * 0.6, H); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.35, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      slmCtx.fillStyle = g; slmCtx.fillRect(0, 0, W, H);
    }
    const hi = slm.highlighted ?? null;
    if (hi !== slmHi) { slmHi = hi; slmKeys.querySelectorAll('[data-sk]').forEach((e) => e.classList.toggle('on', e.dataset.sk === hi)); }
    const m = slm.mode || {}, info = !m.power ? 'Desligado' : `Ponderação ${m.weight || 'A'} · resposta ${m.resp === 'F' ? 'rápida (FAST)' : 'lenta (SLOW)'}${m.max ? ' · MAX' : ''}${m.cal ? ' · CAL' : ''}`;
    if (info !== slmInfoTxt) { slmInfoTxt = info; slmInfo.textContent = info; }
  }
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
      else if (a === 'rep') go(idx); else if (a === 'auto') { auto = !auto; held = !auto; if (auto) resume(); else pauseVoice(); paint(); }
    }));
    applyMarks(); panel.scrollTop = 0;
  }
  function solo(ids) {
    const map = {}; for (const m of MACHINES) map[m.id] = ids.includes(m.id); app.audio?.setRunning?.(map);
  }
  async function go(i) {
    if (!active) return; i = Math.max(0, Math.min(DOSE_STEPS.length - 1, i));
    const my = ++token; idx = i; const st = DOSE_STEPS[i]; marked.clear(); paint();
    held = false; resetRig(); st.init?.(slm);
    slmPanel.classList.toggle('hidden', !(st.meter && ['meter', 'spot', 'head'].includes(st.cam))); slmRev = -1;
    actT = 0; cues = (st.cues || []).map(([mk, fn]) => ({ t: Math.max(0, st.text.indexOf(mk)) * (st.dur ? st.dur / st.text.length : 1 / CPS), fn })).sort((a, b) => a.t - b.t);
    for (const m of marks) m.focusOn = !st.focus || st.focus === m.c.id;
    solo(st.solo);
    if (st.meter) { slm.group.visible = true; if (slmAt !== st.meter) { slmAt = st.meter; slm.placeAt(SPOTS[st.meter].pos, SPOTS[st.meter].src); } slm.setTarget(SPOTS[st.meter].L); }
    else { slm.group.visible = false; slmAt = null; }
    if (st.cam === 'head') { app.stage.flyTo(headCam(st.meter), 2.2); app.stage.setFocus?.((slm.micTip || slm.mic).getWorldPosition(new THREE.Vector3())); }
    else if (st.cam === 'meter' || st.cam === 'spot') {
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
    if (!active) return; active = false; token++; stopVoice(); cues = []; resetRig(); slmPanel.classList.add('hidden');
    host.classList.remove('dose-on'); panel.classList.add('hidden'); group.visible = false; slm.group.visible = false; slmAt = null;
    for (const m of marks) m.lbl.classList.add('hidden');
    app.audio?.setRunning?.(app.running());
    app.setView(prevView === 'orbit' ? 'ref' : prevView || 'ref', { animate: true, duration: 2 });
  }
  addEventListener('keydown', (e) => { if (active && e.key === 'Escape') close(); });
  return { open, close, get active() { return active; } };
}
