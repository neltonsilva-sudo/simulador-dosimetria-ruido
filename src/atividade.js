// Atividades práticas avaliadas — dono: UI/ATIVIDADES.
// Atividade 1 (decibelímetro): configurar, calibrar (com erro de sensibilidade real até ajustar no CAL), medir 3 máquinas,
// calcular dose / NE / NEN (NHO-01) e dar o parecer. Atividade 2 (dosímetro): escolher a metodologia (NHO-01 ou NR-15
// Anexo 1), ligar e calibrar pelo menu, configurar os Ajustes, instalar na trabalhadora, iniciar, encerrar com
// pós-calibração e dar o parecer. Cada etapa vale pontos; ao entregar sai o boletim com a nota (0–10) e a correção.
// Os cálculos do aluno são corrigidos a partir das PRÓPRIAS leituras dele (erro não se propaga), as leituras contra o real.
import { CRITERIA, allowedMinutes } from './dosimetry.js';

const f1 = (n, d = 1) => (n == null || !isFinite(n) ? '—' : (+n).toFixed(d).replace('.', ','));
const num = (v) => { const s = String(v ?? '').trim().replace(/\s|%|dB\(A\)|dB/gi, '').replace(',', '.'); return s === '' ? NaN : +s; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function rng(seed) { let x = (seed >>> 0) % 2147483647 || 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const hm = (min) => `${Math.floor(min / 60)} h${min % 60 ? ' ' + String(Math.round(min % 60)).padStart(2, '0') + ' min' : ''}`;

// ── NHO-01 / NR-15 ──
const doseNHO = (Ls, Cs) => Ls.reduce((a, L, i) => a + Cs[i] / allowedMinutes(L, CRITERIA.NHO01), 0) * 100;
const neFrom = (D, TE) => 10 * Math.log10((480 / TE) * (D / 100)) + 85;
const nenFrom = (NE, TE) => NE + 10 * Math.log10(TE / 480);
// resolução passo a passo (NHO-01) com os níveis informados
function resolucaoHTML(nomes, Ls, Cs, TE) {
  const T = Ls.map((L) => allowedMinutes(L, CRITERIA.NHO01)), fr = Cs.map((C, i) => C / T[i]), D = fr.reduce((a, b) => a + b, 0) * 100;
  const NE = neFrom(D, TE), NEN = nenFrom(NE, TE), F = (n, d = 1) => f1(n, d);
  const frac = (a, b) => `<span class="fr"><span>${a}</span><span>${b}</span></span>`;
  return `<h4>1. Tempo máximo permitido para cada nível (NHO-01: q = 3, CR = 85 dB(A))</h4>
    <div class="eq big">T<sub>n</sub> = ${frac('480', '2<sup>(L<sub>n</sub> − 85)/3</sup>')}</div>
    ${Ls.map((L, i) => `<div class="eq">T<sub>${i + 1}</sub> = ${frac('480', `2<sup>(${F(L)} − 85)/3</sup>`)} = ${frac('480', F(Math.pow(2, (L - 85) / 3), 3))} = <b>${F(T[i])} min</b> <small>(${esc(nomes[i])})</small></div>`).join('')}
    <h4>2. Dose diária</h4>
    <div class="eq big">D = (${Cs.map((_, i) => frac(`C<sub>${i + 1}</sub>`, `T<sub>${i + 1}</sub>`)).join(' + ')}) × 100</div>
    <div class="eq">D = (${Cs.map((C, i) => frac(C, F(T[i]))).join(' + ')}) × 100</div>
    <div class="eq">D = (${fr.map((x) => F(x, 3)).join(' + ')}) × 100 = <b class="res">${F(D)} %</b></div>
    <h4>3. Nível de exposição (NE)</h4>
    <div class="eq big">NE = 10 · log[${frac('480', 'TE')} · ${frac('D', '100')}] + 85</div>
    <div class="eq">NE = 10 · log[${frac('480', TE)} · ${frac(F(D), '100')}] + 85 = 10 · log(${F((480 / TE) * (D / 100), 3)}) + 85 = <b class="res">${F(NE)} dB(A)</b></div>
    <h4>4. Nível de exposição normalizado (NEN)</h4>
    <div class="eq big">NEN = NE + 10 · log${'(' + frac('TE', '480') + ')'}</div>
    <div class="eq">NEN = ${F(NE)} + 10 · log(${frac(TE, '480')}) = ${F(NE)} + ${F(10 * Math.log10(TE / 480), 2)} = <b class="res">${F(NEN)} dB(A)</b></div>
    <h4>5. Classificação (NHO-01)</h4><p class="dz-p">Dose ${F(D)} % · NEN ${F(NEN)} dB(A) → <b>${CLS_NHO[clsNHO(D)]}</b></p>`;
}
const clsNHO = (D) => (D <= 50 ? 0 : D <= 80 ? 1 : D <= 100 ? 2 : 3);
const clsNR15 = (D) => (D <= 50 ? 0 : D <= 100 ? 1 : 2);
const CLS_NHO = ['Aceitável', 'Acima do nível de ação', 'Região de incerteza', 'Acima do limite de exposição'];
const CLS_NR15 = ['Abaixo do nível de ação', 'Entre o nível de ação e o limite de tolerância', 'Acima do limite de tolerância (insalubre)'];
const MEAS = [['fonte', 'Controle na fonte / proteção coletiva (enclausuramento, manutenção, amortecimento)'], ['adm', 'Medidas administrativas (reduzir o tempo de exposição, rodízio)'],
  ['epi', 'Protetor auricular com CA válido e atenuação adequada'], ['pca', 'Programa de conservação auditiva e audiometrias (PCMSO)'], ['monit', 'Manter monitoramento / reavaliação periódica']];
function measScore(cls, sel, nr15) { // 0..1 — coerência das medidas com a classificação
  const has = (k) => sel.has(k);
  const top = nr15 ? 2 : 3;
  if (cls === 0) return has('epi') || has('fonte') ? 0.5 : 1;
  if (cls === top) return (has('fonte') + has('epi') + has('pca')) / 3;
  if (!nr15 && cls === 2) return ((has('fonte') || has('adm')) + has('pca') + has('monit')) / 3;
  return (has('pca') + has('monit')) / 2;
}

// máquinas da atividade 1 (pontos de medição em ui_dose.js SPOTS)
const A1 = [{ key: 'm1', id: 'prensa1', nome: 'Prensa excêntrica 80 t', Ls: [88, 89, 90, 91, 92] },
  { key: 'm2', id: 'prensa4', nome: 'Prensa hidráulica 150 t', Ls: [83, 84, 85, 86, 87] },
  { key: 'm3', id: 'esmeril1', nome: 'Esmerilhamento (bancada)', Ls: [90, 91, 92, 93, 94] }];
const A1_TIMES = [[180, 180, 120], [240, 120, 120], [180, 120, 180], [120, 240, 120], [210, 150, 120], [150, 210, 120], [240, 180, 60], [180, 240, 60]]; // sempre 8 h (480 min)
const RANGES_LO_HI = (r) => String(r || '30–130').split('–').map(Number);


// Orientações faladas (voz Francisca gravada por tools/gen_tts.py a partir dos campos `text:` — não mudar sem regenerar)
const ORIENT = {
  a1i: { text: 'Atividade avaliativa com o decibelímetro. Realize as etapas de 1 a 5. Ao terminar, clique em Entregar.' },
  a2i: { text: 'Atividade avaliativa com o dosímetro. Realize as etapas de 1 a 6. Ao terminar, clique em Entregar.' },
};

export function createActivities({ root, app, h, say, stopVoice, dose, fwDo }) {
  const host = root;
  const THREE = app.stage.THREE;
  let cur = null; // atividade em andamento
  const panel = h('div', 'ui-dose ui-ativ glass hidden', ''); host.appendChild(panel);
  const modal = h('div', 'ui-modal ativ-modal hidden', ''); host.appendChild(modal);
  const toast = h('div', 'ativ-toast hidden', ''); host.appendChild(toast);
  let toastT = 0;
  function warn(msg) { toast.textContent = msg; toast.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.add('hidden'), 3800); }
  let aluno = ''; try { aluno = localStorage.getItem('ativ.aluno') || ''; } catch {}
  // orientação falada: toca ao abrir a atividade e ao entrar em cada etapa (🔊 repete, 🔇 silencia)
  let voz = true; try { voz = localStorage.getItem('ativ.voz') !== '0'; } catch {}
  let sayTok = 0;
  function orient(intro) {
    if (!cur || !say) return; ++sayTok;
    if (!voz) { stopVoice?.(); return; }
    say(intro || (cur.kind === 1 ? ORIENT.a1i : ORIENT.a2i).text);
  }

  // ── escolha da atividade ──
  function chooser() {
    modal.innerHTML = `<div class="ui-report glass ativ-choose"><button class="ui-x">✕</button><h2>📝 Atividade prática avaliada</h2>
      <p class="sub">Realize todas as etapas e entregue para ver a nota (0 a 10).</p>
      <label class="ativ-name">Nome do aluno <input type="text" maxlength="60" value="${esc(aluno)}" placeholder="Digite seu nome"></label>
      <div class="ui-chapters">
        <button class="ui-chap" data-a="1"><b>Atividade 1 · Decibelímetro</b><span>Avaliação prática com o decibelímetro.</span><em>5 etapas · 10 pontos</em></button>
        <button class="ui-chap" data-a="2"><b>Atividade 2 · Dosímetro</b><span>Avaliação prática com o dosímetro.</span><em>6 etapas · 10 pontos</em></button>
      </div></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('.ui-x').onclick = () => modal.classList.add('hidden');
    modal.querySelectorAll('.ui-chap').forEach((b) => (b.onclick = () => {
      aluno = modal.querySelector('.ativ-name input').value.trim(); try { localStorage.setItem('ativ.aluno', aluno); } catch {}
      if (!aluno) { warn('Digite o nome do aluno para começar.'); modal.querySelector('.ativ-name input').focus(); return; }
      modal.classList.add('hidden'); b.dataset.a === '1' ? startA1() : startA2();
    }));
  }
  const CRIT1 = [['1. Configuração do decibelímetro', 'Ponderação A, resposta lenta (SLOW), MAX desligado e faixa que contenha o valor, conferidos em cada leitura registrada', 1],
    ['2. Calibração', 'Retirar a espuma, acoplar e ligar o calibrador, ajustar no modo CAL até o visor igualar o calibrador, desacoplar e recolocar a espuma antes de medir', 2],
    ['3. Medição das 3 máquinas', 'Leitura registrada no ponto de cada máquina, com espuma, até ±0,3 dB do nível real (0,5 ponto por máquina)', 1.5],
    ['4. Cálculos (NHO-01)', 'Dose (2,0), NE (1,0) e NEN (1,0), corrigidos a partir das suas leituras', 4],
    ['5. Parecer técnico', 'Classificação pela NHO-01 (1,0) e medidas coerentes (0,5)', 1.5]];
  const CRIT2 = [['1. Ligar o dosímetro', 'Tecla ⏻ por 3 s', 0.5], ['2. Calibração inicial', 'Espuma retirada, calibrador acoplado, Menu › Dosimetria › Calibrar concluído; calibrador desacoplado e espuma recolocada antes de instalar', 2],
    ['3. Configuração', 'Ajustes conforme a metodologia escolhida: P. Frequência, P. Temporal, Nível limiar, Nível critério e Taxa de troca (0,4 cada)', 2],
    ['4. Instalação e início', 'Instalar no ombro do lado mais exposto (1,0) e iniciar a dosimetria com o aparelho instalado (1,0)', 2],
    ['5. Encerramento e pós-calibração', 'Parar a medição e fazer a pós-calibração com o calibrador acoplado', 1],
    ['6. Parecer técnico', 'Dose (1,0), nível de exposição (0,75), validade da medição (0,25) e classificação/medidas (0,5) pela metodologia escolhida', 2.5]];
  const critTable = () => [['Atividade 1 · Decibelímetro', CRIT1], ['Atividade 2 · Dosímetro', CRIT2]].map(([t, rows]) =>
    `<h4>${t}</h4><table class="dz-t"><tr><th>Etapa</th><th>O que é avaliado</th><th>Pontos</th></tr>${rows.map(([a, b, p]) => `<tr><td>${a}</td><td>${b}</td><td><b>${f1(p, 1)}</b></td></tr>`).join('')}</table>`).join('');

  // ── moldura comum do painel ──
  function frame({ title, tabs, tab, body, caseHtml }) {
    panel.innerHTML = `<div class="dz-h"><span>📝 ${title} · ${esc(aluno)}</span><button class="ui-x dz-x" title="Sair da atividade">✕</button></div>
      ${caseHtml || ''}
      <div class="ativ-tabs">${tabs.map((t, i) => `<button data-t="${i}" class="${i === tab ? 'on' : ''}${cur.done?.[i] ? ' ok' : ''}">${i + 1}. ${t}</button>`).join('')}</div>
      <div class="ativ-voz"><button class="ui-btn ghost" data-v="ouvir">🔊 Ouvir</button><button class="ui-btn ghost" data-v="mudo">${voz ? '🔇 Silenciar' : '🔈 Ativar voz'}</button></div>
      <div class="ativ-body">${body}</div>
      <div class="dz-nav"><button class="ui-btn" data-n="prev">◀ Etapa anterior</button><button class="ui-btn" data-n="next">Próxima etapa ▶</button><button class="ui-btn primary" data-n="send">Entregar ✓</button></div>`;
    panel.querySelector('.dz-x').onclick = () => { if (confirm('Sair da atividade? O progresso será perdido.')) exit(); };
    panel.querySelectorAll('.ativ-tabs button').forEach((b) => (b.onclick = () => cur.goTab(+b.dataset.t)));
    panel.querySelector('[data-n="prev"]').onclick = () => cur.goTab(Math.max(0, cur.tab - 1));
    panel.querySelector('[data-n="next"]').onclick = () => cur.goTab(Math.min(tabs.length - 1, cur.tab + 1));
    panel.querySelector('[data-v="ouvir"]').onclick = () => { if (!voz) { voz = true; try { localStorage.setItem('ativ.voz', '1'); } catch {} cur.rerender?.(); } orient(); };
    panel.querySelector('[data-v="mudo"]').onclick = () => { voz = !voz; try { localStorage.setItem('ativ.voz', voz ? '1' : '0'); } catch {} if (!voz) stopVoice?.(); else orient(); cur.rerender?.(); };
    panel.querySelector('[data-n="send"]').onclick = () => { if (confirm('Entregar a atividade e ver a nota?')) cur.submit(); };
    panel.classList.remove('hidden');
  }
  function enter(cls) { stopVoice?.(); host.classList.add('ativ-on', cls); modal.classList.add('hidden'); }
  function exit() {
    if (!cur) return; cur.cleanup?.(); cur = null; sayTok++; stopVoice?.();
    host.classList.remove('ativ-on', 'ativ1', 'ativ2'); panel.classList.add('hidden'); panel.innerHTML = '';
    app.setView('ref', { animate: true, duration: 1.6 });
  }
  const bindInputs = (store) => panel.querySelectorAll('[data-in]').forEach((el) => {
    const k = el.dataset.in;
    if (el.type === 'radio') { el.checked = store[k] === el.value; el.onchange = () => (store[k] = el.value); }
    else if (el.type === 'checkbox') { el.checked = store.meas.has(el.value); el.onchange = () => (el.checked ? store.meas.add(el.value) : store.meas.delete(el.value)); }
    else { el.value = store[k] ?? ''; el.oninput = () => (store[k] = el.value); }
  });

  // ════════════════════ ATIVIDADE 1 — DECIBELÍMETRO ════════════════════
  function startA1() {
    const rig = dose.rig; if (!rig) return warn('Decibelímetro indisponível.');
    const seed = (Date.now() ^ (aluno.length * 2654435761)) >>> 0, r = rng(seed);
    const Ls = A1.map((m) => pick(r, m.Ls)), Cs = pick(r, A1_TIMES), TE = Cs.reduce((a, b) => a + b, 0);
    const err0 = pick(r, [-1.4, -1.2, -0.9, 0.8, 1.1, 1.3]);
    A1.forEach((m, i) => (rig.SPOTS[m.key].Lact = Ls[i]));
    const S = { seed, Ls, Cs, TE, err0, foam: true, regs: {}, cal: { foamOffAtCouple: null, signal: false, calMode: false, blind: false, adjusted: false },
      ans: { dose: '', ne: '', nen: '', cls: '', meas: new Set(), texto: '' }, readings: A1.map(() => '') };
    const TABS = ['Configurar', 'Calibrar', 'Medir', 'Calcular', 'Parecer'];
    enter('ativ1');
    rig.enable(true); rig.place('m1'); rig.setErr(err0);
    if (/[?&]debug=1/.test(location.search)) window.__rig = rig; // testes automatizados
    rig.slm.setMode({ power: true, weight: 'C', resp: 'F', max: true, cal: false, range: '80–130' }); // configuração "errada" de fábrica: o aluno ajusta
    rig.solo(['prensa1']); app.audio?.start?.();
    cur = { kind: 1, tab: 0, done: {}, S };
    // nível no microfone (calibrador acoplado domina) → visor = nível + erro de sensibilidade
    const offFrame = app.stage.onFrame(() => {
      if (!cur || cur.kind !== 1) return;
      const sc = rig.scal; let L;
      if (rig.coupled) L = sc.isOn() ? sc.level() : 41; else if (rig.at) L = rig.SPOTS[rig.at].Lact; else L = 60;
      rig.target(L);
      if (rig.slm.mode.cal && rig.coupled && sc.isOn()) S.cal.signal = true;
      const live = panel.querySelector('[data-live1]'); if (live) live.textContent = rig.slm.mode.power ? f1(rig.slm.reading) : '—';
      const cs = panel.querySelector('[data-calst]'); if (cs) cs.textContent = `${rig.coupled ? 'acoplado' : 'não acoplado'} · ${sc.isOn() ? 'ligado em ' + sc.level() + ' dB' : 'desligado'}`;
    });
    cur.cleanup = () => { offFrame?.(); rig.enable(false); A1.forEach((m) => delete rig.SPOTS[m.key].Lact); app.audio?.setRunning?.(app.running()); };
    const caseHtml = () => `<div class="ativ-case"><b>Situação:</b> um operador trabalha em 3 postos durante a jornada (ruído contínuo). Meça o nível em cada posto e avalie a exposição pela NHO-01.
      <table class="dz-t"><tr><th>Posto</th><th>Máquina</th><th>Tempo de exposição</th></tr>${A1.map((m, i) => `<tr><td>${i + 1}</td><td>${m.nome}</td><td><b>${hm(Cs[i])}</b> (${Cs[i]} min)</td></tr>`).join('')}
      <tr><td></td><td>Jornada (TE)</td><td><b>${hm(TE)}</b> (${TE} min)</td></tr></table></div>`;
    const focusOn = (o) => { try { app.stage.setFocus?.(o ? o.getWorldPosition(new THREE.Vector3()) : null); } catch {} };
    const camHead = () => { app.stage.flyTo(rig.headCam(rig.at || 'm1'), 1.8); focusOn(rig.slm.micTip || rig.slm.mic); };
    const camLcd = () => { app.stage.flyTo(rig.spotCam(rig.at || 'm1', true), 1.8); app.stage.setFocus?.(rig.slm.lcdWorld(new THREE.Vector3())); };
    const camSpot = () => { app.stage.flyTo(rig.spotCam(rig.at || 'm1', false), 1.8); app.stage.setFocus?.(null); };
    cur.goTab = (t) => {
      cur.tab = t; render();
      if (t === 1) camHead(); else if (t === 0) camLcd(); else if (t === 2) camSpot();
      else { app.stage.flyTo({ pos: [3.2, 3.6, 4.6], target: [-2.2, 1.0, -5.0], fov: 52 }, 1.8); app.stage.setFocus?.(null); }
    };
    function render() {
      const t = cur.tab; let body = '';
      if (t === 0) body = `<h3>Configurar o decibelímetro</h3>`;
      else if (t === 1) body = `<h3>Calibrar o decibelímetro</h3>
        <div class="ativ-act">
          <div><span>Microfone</span><button class="ui-btn" data-a="foam" ${S.foam ? '' : 'disabled'}>Retirar a espuma</button></div>
          <div><span>Calibrador</span><button class="ui-btn" data-a="couple">${rig.coupled ? 'Desacoplar' : 'Acoplar ao microfone'}</button>
            <button class="ui-btn" data-a="cpow">⏻</button><button class="ui-btn" data-a="c94">94 dB</button><button class="ui-btn" data-a="c114">114 dB</button></div>
          <div><span>Decibelímetro</span><button class="ui-btn ${rig.slm.mode.cal ? 'on' : ''}" data-a="cal">CAL ${rig.slm.mode.cal ? 'ligado' : 'desligado'}</button>
            <button class="ui-btn" data-a="dn">− 0,1</button><button class="ui-btn" data-a="up">+ 0,1</button></div>
          <div><span>Microfone</span><button class="ui-btn" data-a="foam" ${S.foam ? 'disabled' : ''}>Recolocar a espuma</button></div></div>`;
      else if (t === 2) body = `<h3>Medir o ruído das 3 máquinas</h3>
        <table class="dz-t ativ-med"><tr><th>Posto</th><th>Levar o medidor</th><th>Leitura (dB)</th><th></th></tr>${A1.map((m, i) => `<tr class="${rig.at === m.key ? 'here' : ''}"><td>${i + 1}. ${m.nome}</td>
          <td><button class="ui-btn" data-go="${m.key}">${rig.at === m.key ? '📍 Aqui' : 'Ir até lá'}</button></td>
          <td><input data-rd="${i}" inputmode="decimal" placeholder="ex.: 87,4" value="${esc(S.readings[i])}"></td>
          <td><button class="ui-btn ${S.regs[m.key] ? 'ok' : ''}" data-reg="${i}">${S.regs[m.key] ? '✓ Registrado' : 'Registrar'}</button></td></tr>`).join('')}</table>`;
      else if (t === 3) body = `<h3>Calcular a dose, o NE e o NEN (NHO-01)</h3>
        <table class="dz-t"><tr><th>Posto</th><th>L registrado</th><th>C (min)</th></tr>${A1.map((m, i) => `<tr><td>${i + 1}. ${m.nome}</td><td><b>${S.regs[m.key] ? f1(S.regs[m.key].val) + ' dB(A)' : '—'}</b></td><td>${Cs[i]}</td></tr>`).join('')}</table>
        <div class="ativ-formulas"><h4>Fórmulas (NHO-01)</h4>
          <div class="eq">T<sub>n</sub> = 480 / 2<sup>(L<sub>n</sub> − 85)/3</sup></div>
          <div class="eq">D = (C<sub>1</sub>/T<sub>1</sub> + C<sub>2</sub>/T<sub>2</sub> + C<sub>3</sub>/T<sub>3</sub>) × 100</div>
          <div class="eq">NE = 10 · log[(480/TE) · (D/100)] + 85</div>
          <div class="eq">NEN = NE + 10 · log(TE/480)</div></div>
        <div class="ativ-form"><label>Dose diária (%)<input data-in="dose" inputmode="decimal"></label>
          <label>NE (dB(A))<input data-in="ne" inputmode="decimal"></label>
          <label>NEN (dB(A))<input data-in="nen" inputmode="decimal"></label></div>
        <div class="ativ-resol"><button class="ui-btn" data-a="resol">📐 Resolução</button></div>`;
      else body = `<h3>Parecer técnico (NHO-01)</h3>
        <h4>Classificação</h4><div class="ativ-radio">${CLS_NHO.map((c, i) => `<label><input type="radio" name="cls1" data-in="cls" value="${i}"> ${c}</label>`).join('')}</div>
        <h4>Medidas recomendadas</h4><div class="ativ-check">${MEAS.map(([k, l]) => `<label><input type="checkbox" data-in="meas" value="${k}"> ${l}</label>`).join('')}</div>
        <label class="ativ-text">Parecer técnico<textarea data-in="texto" rows="3"></textarea></label>`;
      frame({ title: 'Atividade 1 · Decibelímetro', tabs: TABS, tab: t, body, caseHtml: caseHtml() });
      // calibração só ANTES da 1ª medição: depois de registrar a primeira leitura ela fica encerrada e vale para as demais
      if (t === 1 && S.firstRegErr) {
        panel.querySelectorAll('.ativ-act [data-a]').forEach((b) => { if (!(b.dataset.a === 'foam' && !S.foam && b.textContent.includes('Recolocar'))) b.disabled = true; });
        panel.querySelector('.ativ-act').insertAdjacentHTML('beforebegin', '<p class="ativ-lock">🔒 Calibração encerrada — a calibração feita antes da 1ª medição vale para as demais medições.</p>');
      }
      bindInputs(S.ans);
      panel.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => act(b.dataset.a)));
      panel.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => goSpot(b.dataset.go)));
      panel.querySelectorAll('[data-rd]').forEach((el) => (el.oninput = () => (S.readings[+el.dataset.rd] = el.value)));
      panel.querySelectorAll('[data-reg]').forEach((b) => (b.onclick = () => register(+b.dataset.reg)));
    }
    function act(a) {
      const sc = rig.scal;
      if (a === 'resol') return showResol(); // professor: disponível a qualquer momento
      if (S.firstRegErr && a !== 'foam') return warn('Ação não permitida neste momento.');
      if (a === 'foam') { if (!S.foam && rig.coupled) return warn('Ação não permitida neste momento.'); S.foam = !S.foam; rig.slm.setWindscreen(S.foam); }
      else if (a === 'couple') {
        if (rig.coupled) { if (sc.isOn()) rig.calSet(0); rig.uncouple(); } // desliga o calibrador ao retirar
        else { if (S.foam) return warn('Ação não permitida neste momento.'); if (rig.at && rig.SPOTS[rig.at]) camHead(); S.cal.foamOffAtCouple = true; rig.couple(); }
      } else if (a === 'cpow') rig.calSet(sc.isOn() ? 0 : sc.level());
      else if (a === 'c94' || a === 'c114') rig.calSet(a === 'c94' ? 94 : 114);
      else if (a === 'cal') rig.slm.setMode({ cal: !rig.slm.mode.cal });
      else if (a === 'up' || a === 'dn') {
        if (!rig.slm.mode.cal) { app.audio?.beep?.('err'); return; } // sem CAL a tecla não ajusta (sem dica)
        if (!(rig.coupled && sc.isOn())) S.cal.blind = true; // ajuste sem sinal de referência
        S.cal.adjusted = true; rig.setErr(Math.round((rig.err + (a === 'up' ? 0.1 : -0.1)) * 10) / 10);
      }
      app.audio?.beep?.('key'); setTimeout(render, a === 'couple' ? 1700 : 0);
    }
    function goSpot(k) {
      if (rig.coupled) return warn('Ação não permitida neste momento.');
      rig.place(k); rig.solo([A1.find((m) => m.key === k).id]); camSpot(); render();
    }
    function register(i) {
      const m = A1[i]; if (rig.at !== m.key) return warn('O medidor não está neste posto.');
      const val = num(S.readings[i]); if (!isFinite(val)) return warn('Digite a leitura do visor (ex.: 87,4).');
      const md = rig.slm.mode, [lo, hi] = RANGES_LO_HI(md.range);
      S.regs[m.key] = { val, weight: md.weight, resp: md.resp, max: md.max, cal: md.cal, inRange: m.key && Ls[i] + rig.err >= lo && Ls[i] + rig.err <= hi,
        foam: S.foam, coupled: rig.coupled, err: rig.err, power: md.power };
      if (S.firstRegErr == null) S.firstRegErr = { err: rig.err, foam: S.foam, coupled: rig.coupled, calOff: !md.cal };
      app.audio?.beep?.('ok'); render();
    }
    function showResol() {
      const Lst = A1.map((m, i) => S.regs[m.key]?.val ?? Ls[i]);
      resolModal(`Resolução — dose, NE e NEN (NHO-01)`, `<p class="sub">Calculado com os níveis registrados por você${A1.some((m) => !S.regs[m.key]) ? ' (postos sem registro usam o nível real)' : ''}.</p>${resolucaoHTML(A1.map((m) => m.nome), Lst, Cs, TE)}
        ${Lst.some((L, i) => Math.abs(L - Ls[i]) > 0.05) ? `<h4>Com os níveis reais</h4><p class="dz-p">Dose ${f1(doseNHO(Ls, Cs))} % · NE ${f1(neFrom(doseNHO(Ls, Cs), TE))} dB(A) · NEN ${f1(nenFrom(neFrom(doseNHO(Ls, Cs), TE), TE))} dB(A)</p>` : ''}`);
    }
    cur.showResol = showResol;
    cur.submit = () => {
      cur.submitted = true; render();
      const rows = []; const add = (et, item, pts, max, obs = '') => rows.push({ et, item, pts: Math.max(0, Math.min(max, pts)), max, obs });
      // 1. configuração (média das leituras registradas)
      const regs = A1.map((m) => S.regs[m.key]).filter(Boolean);
      const cfg = (k) => (regs.length ? regs.filter(k).length / regs.length : 0);
      add('Configuração', 'Ponderação A', 0.4 * cfg((g) => g.weight === 'A'), 0.4, regs.length ? '' : 'nenhuma leitura registrada');
      add('Configuração', 'Resposta lenta (SLOW)', 0.3 * cfg((g) => g.resp === 'S'), 0.3);
      add('Configuração', 'MAX desligado', 0.15 * cfg((g) => !g.max), 0.15);
      add('Configuração', 'Faixa contém o valor (sem OVER/UNDER)', 0.15 * cfg((g) => g.inRange), 0.15);
      // 2. calibração
      const fe = S.firstRegErr, errAbs = Math.abs(fe ? fe.err : rig.err);
      add('Calibração', 'Espuma retirada antes de acoplar', S.cal.foamOffAtCouple ? 0.25 : 0, 0.25);
      add('Calibração', 'Calibrador acoplado e ligado com o CAL ativo', S.cal.signal ? 0.25 : 0, 0.25);
      add('Calibração', 'Ajuste feito com o sinal do calibrador', S.cal.adjusted && !S.cal.blind && S.cal.signal ? 0.25 : 0, 0.25, S.cal.blind ? 'houve ajuste sem o calibrador ligado/acoplado' : '');
      add('Calibração', `Visor igual ao calibrador (erro final ${f1(fe ? fe.err : rig.err)} dB)`, errAbs <= 0.1 ? 1 : errAbs <= 0.3 ? 0.5 : 0, 1, `erro inicial do aparelho: ${f1(err0)} dB`);
      add('Calibração', 'CAL desligado, calibrador desacoplado e espuma recolocada antes de medir', fe && fe.foam && !fe.coupled && fe.calOff ? 0.25 : 0, 0.25);
      // 3. medições
      A1.forEach((m, i) => { const g = S.regs[m.key]; const d = g ? Math.abs(g.val - Ls[i]) : Infinity;
        add('Medição', `${m.nome}: ${g ? f1(g.val) : '—'} dB (real ${f1(Ls[i])})`, !g ? 0 : (d <= 0.3 ? 0.5 : d <= 1 ? 0.25 : 0) * (g.foam ? 1 : 0.5), 0.5, g && !g.foam ? 'medido sem espuma' : ''); });
      // 4. cálculos (a partir das leituras do aluno)
      const Lst = A1.map((m, i) => S.regs[m.key]?.val ?? Ls[i]);
      const Dx = doseNHO(Lst, Cs), NEx = neFrom(Dx, TE), NENx = nenFrom(NEx, TE);
      const D = num(S.ans.dose), NE = num(S.ans.ne), NEN = num(S.ans.nen);
      const rel = Math.abs(D - Dx) / Dx;
      add('Cálculos', `Dose: ${f1(D)} % (esperado ${f1(Dx)} %)`, rel <= 0.01 || Math.abs(D - Dx) <= 0.5 ? 2 : rel <= 0.05 ? 1 : 0, 2);
      add('Cálculos', `NE: ${f1(NE)} dB(A) (esperado ${f1(NEx)})`, Math.abs(NE - NEx) <= 0.2 ? 1 : Math.abs(NE - NEx) <= 0.5 ? 0.5 : 0, 1);
      add('Cálculos', `NEN: ${f1(NEN)} dB(A) (esperado ${f1(NENx)})`, Math.abs(NEN - NENx) <= 0.2 ? 1 : Math.abs(NEN - NENx) <= 0.5 ? 0.5 : 0, 1);
      // 5. parecer
      const cx = clsNHO(Dx), cs = S.ans.cls === '' ? -1 : +S.ans.cls;
      add('Parecer', `Classificação: ${cs >= 0 ? CLS_NHO[cs].split(' —')[0] : '—'} (esperado: ${CLS_NHO[cx].split(' —')[0]})`, cs === cx ? 1 : Math.abs(cs - cx) === 1 ? 0.25 : 0, 1);
      add('Parecer', 'Medidas coerentes com a classificação', 0.5 * measScore(cx, S.ans.meas, false), 0.5);
      boletim({ titulo: 'Atividade 1 · Decibelímetro (NHO-01)', rows, extra: `<p><b>Caso:</b> ${A1.map((m, i) => `${m.nome} — ${f1(Ls[i])} dB(A), ${Cs[i]} min`).join(' · ')} · TE ${TE} min.
        Gabarito com os níveis reais: dose ${f1(doseNHO(Ls, Cs))} %, NE ${f1(neFrom(doseNHO(Ls, Cs), TE))} dB(A), NEN ${f1(nenFrom(neFrom(doseNHO(Ls, Cs), TE), TE))} dB(A).</p>
        ${S.ans.texto ? `<p><b>Parecer do aluno:</b> ${esc(S.ans.texto)}</p>` : ''}` });
    };
    cur.rerender = render; render(); camLcd(); orient(ORIENT.a1i.text);
  }

  // ════════════════════ ATIVIDADE 2 — DOSÍMETRO ════════════════════
  function startA2() {
    const fw = app.fw, core = fw?.core; if (!fw || !core) return warn('Dosímetro indisponível.');
    const S = { method: '', poweredOn: false, cal: null, calFoamOff: false, start: null, side: null, post: null, ended: false, foam: true,
      ans: { dose: '', nivel: '', nen: '', cls: '', valida: '', meas: new Set(), texto: '' } };
    const TABS = ['Metodologia', 'Ligar e calibrar', 'Configurar', 'Instalar e medir', 'Pós-calibrar', 'Parecer'];
    enter('ativ2'); app.audio?.start?.();
    // o aparelho vem configurado para outro uso: o aluno precisa ajustar tudo conforme a metodologia
    const userSaved = { ...core.settings.user }; Object.assign(core.settings.user, { weighting: 'C', response: 'F', TL: 70, CR: 90, q: 4 });
    cur = { kind: 2, tab: 0, done: {}, S };
    const offCal = fw.on('calibrated', (rec) => { if ((rec.kind === 'menu' || rec.kind === 'pre') && !S.start) { S.cal = { ...rec }; S.calFoamOff = !S.foam; render(); } });
    let lastMode = core.state.mode;
    const offFrame = app.stage.onFrame(() => {
      if (!cur || cur.kind !== 2) return;
      const st = core.state;
      if (st.power === 'on') S.poweredOn = true;
      if (st.mode !== lastMode) {
        if (st.mode === 'run' && !S.start) {
          S.start = { mounted: app.state.mounted, side: S.side, coupled: app.state.calibratorCoupled, foam: S.foam, user: { ...core.settings.user }, cal: S.cal, preCal: st.preCal ? { ...st.preCal } : null };
          app.state.running = true; app.emit('change'); render();
        }
        if (st.mode === 'stopped') { app.state.running = false; S.ended = true; app.emit('change'); render(); }
        lastMode = st.mode;
      }
      // medição em andamento (mesmo se começou antes de abrir a atividade): a jornada simulada corre e acelera
      if (['run', 'pause'].includes(st.mode) && !app.state.running && app.state.clock < app.workday.end) {
        if (!S.start) S.start = { mounted: app.state.mounted, side: S.side, coupled: app.state.calibratorCoupled, foam: S.foam, user: { ...core.settings.user }, cal: S.cal, preCal: st.preCal ? { ...st.preCal } : null };
        app.state.running = true; app.emit('change');
      }
      if (st.postCal && !st.postCal.skipped && !S.post) { S.post = { ...st.postCal }; render(); }
      const ck = panel.querySelector('[data-clock]'); if (ck) ck.textContent = app.fmtClock ? app.fmtClock(app.state.clock) : '';
      const us = panel.querySelector('[data-user]'); if (us) { const u = core.settings.user; us.textContent = `P. Frequência ${u.weighting} · P. Temporal ${u.response === 'F' ? 'Rápida (F)' : 'Lenta (S)'} · Limiar ${u.TL} dB · Critério ${u.CR} dB · Taxa de troca q = ${u.q} dB`; }
    });
    const offEnd = app.on('workdayEnd', () => { if (cur?.kind === 2) { warn('Fim da jornada.'); render(); } });
    cur.cleanup = () => { offCal?.(); offFrame?.(); offEnd?.(); app.state.running = false; Object.assign(core.settings.user, userSaved); app.emit('change'); };
    const present = async () => { if (app.state.mounted) return; app.setView('calib', { animate: true, duration: 1.6 }); await app.present(app.dosimeter.group, 'presentDevice', 1.4); };
    cur.goTab = (t) => { cur.tab = t; render();
      if (t === 1 || t === 2 || (t === 4 && !app.state.mounted)) present();
      else if (t === 3) app.setView(app.state.mounted ? 'shoulder' : 'station', { animate: true, duration: 1.6 }); };
    const methodName = () => (S.method === 'NR15' ? 'NR-15, Anexo 1' : S.method === 'NHO01' ? 'NHO-01 (Fundacentro)' : '— escolha na etapa 1 —');
    function render() {
      const t = cur.tab, st = core.state; let body = '';
      const chip = (ok, txt) => `<span class="ativ-chip ${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${txt}</span>`;
      if (t === 0) body = `<h3>Metodologia de avaliação</h3>
        <div class="ativ-radio"><label><input type="radio" name="met" value="NHO01" ${S.method === 'NHO01' ? 'checked' : ''}> <b>NHO-01</b> (Fundacentro)</label>
        <label><input type="radio" name="met" value="NR15" ${S.method === 'NR15' ? 'checked' : ''}> <b>NR-15, Anexo 1</b></label></div>`;
      else if (t === 1) body = `<h3>Ligar e calibrar o dosímetro</h3>
        <div class="ativ-act"><div><span>Microfone</span><button class="ui-btn" data-a="foam" ${S.foam ? '' : 'disabled'}>Retirar a espuma</button></div>
          <div><span>Calibrador</span><button class="ui-btn" data-a="couple">${app.state.calibratorCoupled ? 'Desacoplar' : 'Acoplar ao microfone'}</button></div>
          <div><span>Microfone</span><button class="ui-btn" data-a="foam" ${S.foam ? 'disabled' : ''}>Recolocar a espuma</button></div></div>`;
      else if (t === 2) body = `<h3>Configurar o dosímetro</h3>`;
      else if (t === 3) body = `<h3>Instalar na trabalhadora e medir</h3>
        <div class="ativ-act"><div><span>Instalação</span>${app.state.mounted ? `<b>Instalado no ombro ${S.side === 'L' ? 'esquerdo' : 'direito'}</b>` : '<button class="ui-btn" data-side="L">Ombro esquerdo</button><button class="ui-btn" data-side="R">Ombro direito</button>'}</div>
          <div><span>Jornada</span>${[60, 240, 960].map((s) => `<button class="ui-btn ${app.state.speed === s ? 'on' : ''}" data-sp="${s}">${s}×</button>`).join('')} <b data-clock></b></div></div>`;
      else if (t === 4) body = `<h3>Encerrar e pós-calibrar</h3>
        <div class="ativ-act"><div><span>Dosímetro</span><button class="ui-btn" data-a="unmount" ${app.state.mounted ? '' : 'disabled'}>Retirar da trabalhadora</button></div>
          <div><span>Microfone</span><button class="ui-btn" data-a="foam" ${S.foam ? '' : 'disabled'}>Retirar a espuma</button></div>
          <div><span>Calibrador</span><button class="ui-btn" data-a="couple">${app.state.calibratorCoupled ? 'Desacoplar' : 'Acoplar ao microfone'}</button></div>
          <div><span>Microfone</span><button class="ui-btn" data-a="foam" ${S.foam ? 'disabled' : ''}>Recolocar a espuma</button></div></div>`;
      else {
        const nr = S.method === 'NR15', CL = nr ? CLS_NR15 : CLS_NHO;
        body = `<h3>Parecer técnico — ${methodName()}</h3>
        <div class="ativ-form"><label>Dose (%)<input data-in="dose" inputmode="decimal"></label><label>NE (dB(A))<input data-in="nivel" inputmode="decimal"></label>${nr ? '' : '<label>NEN (dB(A))<input data-in="nen" inputmode="decimal"></label>'}</div>
        <h4>A medição é válida?</h4><div class="ativ-radio row"><label><input type="radio" name="val" data-in="valida" value="sim"> Sim</label><label><input type="radio" name="val" data-in="valida" value="nao"> Não</label></div>
        <h4>Classificação</h4><div class="ativ-radio">${CL.map((c, i) => `<label><input type="radio" name="cls2" data-in="cls" value="${i}"> ${c}</label>`).join('')}</div>
        <h4>Medidas recomendadas</h4><div class="ativ-check">${MEAS.map(([k, l]) => `<label><input type="checkbox" data-in="meas" value="${k}"> ${l}</label>`).join('')}</div>
        <label class="ativ-text">Parecer técnico<textarea data-in="texto" rows="3"></textarea></label>`;
      }
      const caseHtml = `<div class="ativ-case"><b>Situação:</b> avaliar a exposição da operadora da prensa durante a jornada com o dosímetro. Metodologia: <b>${methodName()}</b></div>`;
      frame({ title: 'Atividade 2 · Dosímetro', tabs: TABS, tab: t, body, caseHtml });
      bindInputs(S.ans);
      panel.querySelectorAll('input[name="met"]').forEach((el) => (el.onchange = () => { if (S.start) return warn('A dosimetria já começou.'); S.method = el.value; render(); }));
      panel.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => act(b.dataset.a)));
      panel.querySelectorAll('[data-side]').forEach((b) => (b.onclick = () => mount(b.dataset.side)));
      panel.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => { app.setSpeed(+b.dataset.sp); if (!app.state.running) warn('A aceleração vale durante a medição.'); render(); }));
    }
    async function act(a) {
      if (a === 'foam') {
        if (S.foam && app.state.mounted) return warn('Ação não permitida neste momento.');
        if (!S.foam && app.state.calibratorCoupled) return warn('Ação não permitida neste momento.');
        S.foam = !S.foam; app.dosimeter?.setWindscreen?.(S.foam);
      } else if (a === 'couple') {
        if (app.state.mounted) return warn('Ação não permitida neste momento.');
        if (!app.state.calibratorCoupled && S.foam) return warn('Ação não permitida neste momento.');
        render(); await fwDo.couple(app, !app.state.calibratorCoupled);
      } else if (a === 'unmount') {
        if (['run', 'pause', 'countdown'].includes(core.state.mode)) return warn('Ação não permitida neste momento.');
        app.setView('calib', { animate: true, duration: 1.6 }); await app.present(app.dosimeter.group, 'presentDevice', 1.4); app.state.mounted = false; app.emit('change');
      }
      render();
    }
    async function mount(side) {
      if (!S.method) return warn('Etapa 1 não concluída.');
      if (app.state.calibratorCoupled) return warn('Ação não permitida neste momento.');
      if (!S.foam) return warn('Ação não permitida neste momento.');
      S.side = side; app.setView('shoulder', { animate: true, duration: 2 }); app.worker?.setActivity?.('olhando');
      await app.mountDosimeter({ side, duration: 1.8 }); setTimeout(() => app.worker?.setActivity?.('operando'), 2500); render();
    }
    cur.submit = () => {
      const rows = []; const add = (et, item, pts, max, obs = '') => rows.push({ et, item, pts: Math.max(0, Math.min(max, pts)), max, obs });
      const met = S.method || 'NHO01', nr = met === 'NR15';
      add('Ligar', 'Dosímetro ligado (⏻ 3 s)', S.poweredOn ? 0.5 : 0, 0.5);
      const sc = S.start;
      add('Calibração inicial', 'Calibração feita pelo aparelho com o calibrador', S.cal ? 1 : 0, 1, S.cal ? `${S.cal.kind === 'pre' ? 'pré-calibração ao iniciar' : 'Menu › Calibrar'} em ${S.cal.level} dB` : 'sem calibração');
      add('Calibração inicial', 'Espuma retirada durante a calibração', S.cal && S.calFoamOff ? 0.5 : 0, 0.5);
      add('Calibração inicial', 'Calibrador desacoplado e espuma recolocada antes de medir', sc && !sc.coupled && sc.foam ? 0.5 : 0, 0.5);
      const want = { weighting: 'A', response: 'S', TL: 80, CR: 85, q: nr ? 5 : 3 }, u = sc?.user || core.settings.user;
      const lbl = { weighting: 'P. Frequência', response: 'P. Temporal', TL: 'Nível limiar', CR: 'Nível critério', q: 'Taxa de troca' };
      const fmt = (k, v) => (k === 'response' ? (v === 'F' ? 'Rápida' : 'Lenta') : k === 'weighting' ? v : `${v} dB`);
      for (const k of Object.keys(want)) add('Configuração', `${lbl[k]}: ${fmt(k, u[k])} (esperado ${fmt(k, want[k])})`, u[k] === want[k] ? 0.4 : 0, 0.4, sc ? '' : 'conferido sem a medição iniciada');
      add('Instalação', `Ombro ${S.side === 'L' ? 'esquerdo' : S.side === 'R' ? 'direito' : '—'} (lado mais exposto: esquerdo)`, S.side === 'L' ? 1 : S.side === 'R' ? 0.5 : 0, 1);
      add('Início', 'Dosimetria iniciada com o aparelho instalado', sc ? (sc.mounted ? 1 : 0.5) : 0, 1, sc && !sc.mounted ? 'iniciada fora da trabalhadora' : '');
      add('Pós-calibração', 'Medição encerrada e pós-calibração com o calibrador', S.post ? 1 : S.ended ? 0.25 : 0, 1);
      const res = app.results?.() || {}, snap = res[nr ? 'NR15' : 'NHO01'];
      const Dr = snap?.dose, NEr = snap?.lavg, NENr = snap?.nen;
      const D = num(S.ans.dose), NV = num(S.ans.nivel), NN = num(S.ans.nen);
      const okD = snap && isFinite(D) && (Math.abs(D - Dr) <= 1 || Math.abs(D - Dr) / Dr <= 0.02);
      add('Parecer', `Dose: ${f1(D)} % (aparelho ${f1(Dr)} %)`, okD ? 1 : snap && Math.abs(D - Dr) / Dr <= 0.08 ? 0.5 : 0, 1, snap ? '' : 'sem resultado de medição');
      let lv = 0; if (snap) { const dNE = Math.abs(NV - NEr); lv = dNE <= 0.3 ? 1 : dNE <= 0.8 ? 0.5 : 0;
        if (!nr) { const dN = Math.abs(NN - NENr); lv = (lv + (dN <= 0.3 ? 1 : dN <= 0.8 ? 0.5 : 0)) / 2; } }
      add('Parecer', nr ? `NE (Lavg): ${f1(NV)} (aparelho ${f1(NEr)})` : `NE ${f1(NV)} / NEN ${f1(NN)} (aparelho ${f1(NEr)} / ${f1(NENr)})`, 0.75 * lv, 0.75);
      const validReal = res.calCheck ? res.calCheck.ok : null;
      add('Parecer', `Validade da medição: ${S.ans.valida || '—'} (aferição ${res.calCheck ? (res.calCheck.ok ? 'dentro' : 'fora') + ' de ±1 dB' : 'sem pós-calibração → inválida'})`,
        (S.ans.valida === 'sim') === (validReal === true) && S.ans.valida ? 0.25 : 0, 0.25);
      const cx = snap ? (nr ? clsNR15(Dr) : clsNHO(Dr)) : -9, cs = S.ans.cls === '' ? -1 : +S.ans.cls, CL = nr ? CLS_NR15 : CLS_NHO;
      add('Parecer', `Classificação: ${cs >= 0 ? CL[cs].split(' —')[0] : '—'}${cx >= 0 ? ` (esperado: ${CL[cx].split(' —')[0]})` : ''}`, cs === cx ? 0.3 : 0, 0.3);
      add('Parecer', 'Medidas coerentes', cx >= 0 ? 0.2 * measScore(cx, S.ans.meas, nr) : 0, 0.2);
      boletim({ titulo: `Atividade 2 · Dosímetro (${nr ? 'NR-15, Anexo 1' : 'NHO-01'})`, rows,
        extra: `${snap ? `<p><b>Resultado do aparelho (${nr ? 'NR-15' : 'NHO-01'}):</b> dose ${f1(Dr)} %, NE ${f1(NEr)} dB(A)${nr ? '' : `, NEN ${f1(NENr)} dB(A)`}; tempo medido ${hm(Math.round((res.measuredSec || 0) / 60))}.</p>` : '<p>Sem medição registrada.</p>'}
          ${S.ans.texto ? `<p><b>Parecer do aluno:</b> ${esc(S.ans.texto)}</p>` : ''}` });
    };
    cur.rerender = render; render(); present(); orient(ORIENT.a2i.text);
  }

  // ── resolução (modal) ──
  let lastBoletim = null;
  function resolModal(titulo, html) {
    modal.innerHTML = `<div class="ui-report glass ativ-bol ativ-res"><button class="ui-x">✕</button><h2>${titulo}</h2><div class="ui-dose ativ-inline">${html}</div>
      <div class="ativ-bol-nav">${lastBoletim ? '<button class="ui-btn" data-b="bol">◀ Boletim</button>' : ''}<button class="ui-btn primary" data-b="close">Fechar</button></div></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('.ui-x').onclick = modal.querySelector('[data-b="close"]').onclick = () => modal.classList.add('hidden');
    const bb = modal.querySelector('[data-b="bol"]'); if (bb) bb.onclick = () => boletim(lastBoletim);
  }
  // ── boletim ──
  function boletim({ titulo, rows, extra }) {
    const tot = rows.reduce((a, r) => a + r.pts, 0), max = rows.reduce((a, r) => a + r.max, 0), nota = Math.round((tot / max) * 100) / 10;
    const groups = []; for (const r of rows) { let g = groups.find((x) => x.et === r.et); if (!g) groups.push((g = { et: r.et, pts: 0, max: 0, rows: [] })); g.pts += r.pts; g.max += r.max; g.rows.push(r); }
    const data = new Date().toLocaleString('pt-BR');
    modal.innerHTML = `<div class="ui-report glass ativ-bol"><button class="ui-x">✕</button>
      <h2>Boletim — ${titulo}</h2><p class="sub">Aluno: <b>${esc(aluno)}</b> · ${data}</p>
      <div class="ativ-nota ${nota >= 6 ? 'ok' : 'bad'}"><span>Nota</span><b>${f1(nota, 1)}</b><small>de 10</small></div>
      <table class="dz-t ativ-tab"><tr><th>Etapa / item</th><th>Pontos</th><th>Observação</th></tr>
      ${groups.map((g) => `<tr class="grp"><td>${g.et}</td><td><b>${f1(g.pts, 2)} / ${f1(g.max, 2)}</b></td><td></td></tr>${g.rows.map((r) => `<tr><td>${r.pts >= r.max - 1e-6 ? '✓' : r.pts > 0 ? '◐' : '✗'} ${r.item}</td><td>${f1(r.pts, 2)} / ${f1(r.max, 2)}</td><td>${r.obs || ''}</td></tr>`).join('')}`).join('')}
      </table>${extra || ''}
      <div class="ativ-bol-nav">${cur?.showResol ? '<button class="ui-btn" data-b="resol">📐 Resolução</button>' : ''}<button class="ui-btn" data-b="print">🖨 Imprimir / PDF</button><button class="ui-btn" data-b="back">Voltar à atividade</button><button class="ui-btn primary" data-b="end">Encerrar</button></div></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('.ui-x').onclick = () => modal.classList.add('hidden');
    modal.querySelector('[data-b="back"]').onclick = () => modal.classList.add('hidden');
    const rb = modal.querySelector('[data-b="resol"]'); if (rb) rb.onclick = () => cur.showResol();
    lastBoletim = { titulo, rows, extra };
    modal.querySelector('[data-b="print"]').onclick = () => { document.body.classList.add('print-ativ'); window.print(); setTimeout(() => document.body.classList.remove('print-ativ'), 500); };
    modal.querySelector('[data-b="end"]').onclick = () => { modal.classList.add('hidden'); exit(); };
  }

  return { open: chooser, get active() { return !!cur; }, exit };
}
