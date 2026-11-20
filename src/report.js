// Relatório de dosimetria no formato do software do dosímetro — dono: UI/RELATÓRIO.
// Pág. 1: Identificação (campos editáveis que mudam a cada avaliação, salvos no navegador), Configuração de medição
// (NR15 · NHO01 · User), Resultados da avaliação e Duração. Pág. 2: gráficos (nível × tempo, histograma, oitavas Z/A/C).
// Pág. 3+: tabela de registros (ID · hora · nível). Cabeçalho com aparelho, nº de série e versões; assinatura do avaliador.
import { CRITERIA, OCTAVES, A_WEIGHT, C_WEIGHT } from './dosimetry.js';

const DEV = { nome: 'DoseMax', ns: '200101003018', fw: '1.0.2', sw: '2.31' };
const FIELDS = [
  ['empresaAval', 'Empresa do Avaliador', ''], ['avaliador', 'Nome do Avaliador', ''], ['empresa', 'Empresa Avaliada', ''],
  ['jornada', 'Jornada de Trabalho (hh:mm)', '08:00'], ['funcionario', 'Funcionário Avaliado', ''], ['setor', 'Setor do Funcionário Avaliado', ''],
  ['funcao', 'Função/Atividade Avaliada (GHE)', ''],
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n2 = (v) => (v == null || !isFinite(v) ? '—' : (+v).toFixed(2));
const p2 = (v) => String(v).padStart(2, '0');
const hms = (sec) => { sec = Math.max(0, Math.round(sec || 0)); return `${p2(Math.floor(sec / 3600))}:${p2(Math.floor(sec / 60) % 60)}:${p2(sec % 60)}`; };

export function createReport({ root, app, h }) {
  const modal = h('div', 'ui-modal rp-modal hidden', ''); root.appendChild(modal);
  let ident = {}; try { ident = JSON.parse(localStorage.getItem('dosi.ident') || '{}'); } catch {}
  const close = () => { modal.classList.add('hidden'); modal.innerHTML = ''; document.body.classList.remove('print-rp'); };

  // ── 1) identificação (muda a cada avaliação) ──
  function form() {
    modal.innerHTML = `<div class="ui-report glass rp-form"><button class="ui-x">✕</button><h2>Identificação da avaliação</h2>
      <p class="sub">Esses dados vão para o cabeçalho do relatório e ficam salvos neste navegador para a próxima avaliação.</p>
      <div class="rp-grid">${FIELDS.map(([k, l, d]) => `<label>${l}<input data-k="${k}" value="${esc(ident[k] ?? d)}"${k === 'jornada' ? ' placeholder="hh:mm"' : ''}></label>`).join('')}</div>
      <div class="ui-row"><button class="ui-btn primary" data-b="ok">📄 Gerar relatório</button></div></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('.ui-x').onclick = close;
    modal.querySelector('[data-b="ok"]').onclick = () => {
      modal.querySelectorAll('[data-k]').forEach((i) => (ident[i.dataset.k] = i.value.trim()));
      try { localStorage.setItem('dosi.ident', JSON.stringify(ident)); } catch {}
      render();
    };
    modal.querySelector('[data-k="avaliador"]').focus();
  }

  // ── 2) relatório ──
  function render() {
    const r = app.results(); if (!r) return;
    const log = app.log || {}, st = app.fw?.state || {};
    const year = new Date().getFullYear(), d = st.date || { d: new Date().getDate(), m: new Date().getMonth() + 1 };
    const dt = (clock) => (clock == null ? '—' : `${p2(d.d)}/${p2(d.m)}/${year} ${hms(clock % 86400)}`);
    const dtShort = (clock) => `${p2(d.d)}/${p2(d.m)}/${String(year).slice(2)} ${hms(clock % 86400).slice(0, 5)}`;
    const u = r.settings?.user || { weighting: 'A', response: 'S', TL: 80, CR: 85, q: 3 };
    const cfg = { NR15: { w: 'A', resp: 'S', TL: CRITERIA.NR15.TL ?? 80, CR: CRITERIA.NR15.CR, q: CRITERIA.NR15.q },
      NHO01: { w: 'A', resp: 'S', TL: CRITERIA.NHO01.TL ?? 80, CR: CRITERIA.NHO01.CR, q: CRITERIA.NHO01.q },
      USER: { w: u.weighting, resp: u.response, TL: u.TL, CR: u.CR, q: u.q } };
    const title = { NR15: 'Dosímetro NR15', NHO01: 'Dosímetro NHO01', USER: 'Dosímetro User' };
    const kv = (k, v) => `<div><b>${k}:</b> ${v}</div>`;
    const cfgBox = (id) => { const c = cfg[id]; return `<div class="rp-box"><h4>${title[id]}</h4>${kv('Curva de Ponderação', c.w)}${kv('Ponderação Temporal', c.resp === 'F' ? 'FAST' : 'SLOW')}
      ${kv('Nível limiar', c.TL + 'dB')}${kv('Critério de referência', c.CR + 'dB')}${kv('Taxa de troca(Q)', c.q)}${kv('Curva de Ponderação de Pico', 'A')}</div>`; };
    const resBox = (id) => { const s = r[id]; const lab = id === 'NHO01' ? 'LAeq' : 'Lavg';
      if (!s) return `<div class="rp-box"><h4>${title[id]}</h4><div>Sem medição.</div></div>`;
      const nen = s.twa; // NE normalizado para 8 h com o tempo medido (como o software do aparelho)
      return `<div class="rp-box"><h4>${title[id]}</h4>${kv('Dose', n2(s.dose) + '%')}${kv('Dose Projetada', n2(s.projected) + '%')}${kv(lab, n2(id === 'NHO01' ? (s.laeq ?? s.lavg) : s.lavg) + 'dB')}
        ${kv('NE', n2(s.lavg) + 'dB')}${kv('NEN', n2(nen) + 'dB')}${kv('TWA', n2(s.twa) + 'dB')}${kv('LMin', n2(log.lmin) + 'dB')}${kv('LMax', n2(s.lmax) + 'dB')}${kv('LAPk', n2(log.peak) + 'dB')}</div>`; };
    const meas = r.NHO01?.time ?? r.measuredSec ?? 0;
    const pause = (r.pauses || []).reduce((a, p) => a + Math.max(0, (p.to ?? r.stop ?? app.state.clock) - p.from), 0);
    const head = `<div class="rp-head"><b>${DEV.nome}</b><b>NS: ${DEV.ns}</b><b>F: ${DEV.fw}</b><b>V: ${DEV.sw}</b></div>`;
    const sign = (pg) => `<div class="rp-foot"><div class="rp-sign"><span>_________________________</span>${esc(ident.avaliador || '')}</div><span>${pg}</span></div>`;
    const jor = (ident.jornada || '08:00').replace(/^(\d{1,2}):(\d{2})$/, (m, a, b) => `${p2(a)}:${b}:00`);
    const page1 = `<section class="rp-page">${head}
      <div class="rp-sec"><h3>Identificação</h3>
        ${kv('Empresa do Avaliador', esc(ident.empresaAval))}${kv('Nome do Avaliador', esc(ident.avaliador))}${kv('Data da Avaliação', dt(r.start))}
        ${kv('Empresa Avaliada', esc(ident.empresa))}${kv('Jornada de Trabalho (hh:mm)', esc(jor))}${kv('Funcionário Avaliado', esc(ident.funcionario))}
        ${kv('Setor do Funcionário Avaliado', esc(ident.setor))}${kv('Função/Atividade Avaliada (GHE)', esc(ident.funcao))}</div>
      <div class="rp-sec"><h3>Configuração de medição</h3><div class="rp-3">${cfgBox('NR15')}${cfgBox('NHO01')}${cfgBox('USER')}</div></div>
      <div class="rp-sec"><h3>Resultados da avaliação</h3><div class="rp-3">${resBox('NR15')}${resBox('NHO01')}${resBox('USER')}</div></div>
      <div class="rp-sec"><h3>Duração (s):</h3>${kv('Duração (s)', hms(meas))}${kv('Início', dt(r.start))}${kv('Ocorrência de picos de 115 dB', log.p115 ?? 0)}
        ${kv('Tempo em pausa (s)', hms(pause))}${kv('Fim', dt(r.stop ?? app.state.clock))}</div>
      ${sign(1)}</section>`;
    const series = log.series || [];
    const page2 = `<section class="rp-page">${head}<div class="rp-sec rp-charts"><h3>Gráficos</h3>
      <h5>Gráfico Nível de Ruído X Tempo</h5>${lineChart(series, u)}
      <h5>Histograma</h5>${histChart(series)}
      <h5>Gráfico de Oitavas</h5>${octChart(log.spec)}</div>${sign(2)}</section>`;
    // tabela de registros: 1 linha a cada 5 min (60 por página)
    const rows = series.filter((_, i) => i % 5 === 4 || i === series.length - 1);
    const pages3 = []; for (let i = 0; i < Math.max(1, rows.length); i += 60) pages3.push(rows.slice(i, i + 60));
    const tablePages = pages3.map((chunk, pi) => `<section class="rp-page">${head}<table class="rp-tab"><tr><th>ID</th><th>Hora:</th><th>Nível: (dB)</th></tr>
      ${chunk.length ? chunk.map((x, i) => `<tr><td>${pi * 60 + i + 1}</td><td>${dtShort(x.t)}</td><td>${n2(x.L)}</td></tr>`).join('') : '<tr><td colspan="3">Sem registros.</td></tr>'}</table>
      <p class="rp-note">Intervalo de registro: 5 min (nível equivalente do intervalo, dB(A)).</p>${sign(3 + pi)}</section>`).join('');
    modal.innerHTML = `<div class="rp-wrap"><div class="rp-bar"><b>Relatório de dosimetria</b><span></span>
        <button class="ui-btn" data-b="id">✎ Identificação</button><button class="ui-btn primary" data-b="print">🖨 Imprimir / PDF</button><button class="ui-btn" data-b="x">✕ Fechar</button></div>
      <div class="rp-doc">${page1}${page2}${tablePages}</div></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('[data-b="x"]').onclick = close;
    modal.querySelector('[data-b="id"]').onclick = form;
    modal.querySelector('[data-b="print"]').onclick = () => { document.body.classList.add('print-rp'); window.print(); setTimeout(() => document.body.classList.remove('print-rp'), 800); };
  }

  // ── gráficos SVG (fundo branco, como o relatório do software) ──
  function axes(W, H, m, ymin, ymax, step) {
    let g = ''; for (let v = ymin; v <= ymax + 1e-6; v += step) { const y = m.t + (H - m.t - m.b) * (1 - (v - ymin) / (ymax - ymin));
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="#e6e6e6"/><text x="${m.l - 6}" y="${y + 3}" text-anchor="end" font-size="9">${v}</text>`; }
    return g;
  }
  function lineChart(series, u) {
    const W = 760, H = 230, m = { l: 34, r: 10, t: 26, b: 28 };
    if (series.length < 2) return '<p class="rp-note">Sem dados suficientes.</p>';
    const t0 = series[0].t, t1 = series[series.length - 1].t, Ls = series.map((s) => s.L);
    const ymin = Math.floor(Math.min(...Ls) / 5) * 5 - 5, ymax = Math.ceil(Math.max(...Ls) / 5) * 5 + 5;
    const X = (t) => m.l + (W - m.l - m.r) * (t - t0) / Math.max(1, t1 - t0), Y = (v) => m.t + (H - m.t - m.b) * (1 - (v - ymin) / (ymax - ymin));
    // pausa (almoço) = sem registro: a linha é interrompida em vez de ligar os pontos
    const segs = []; let cur = []; series.forEach((s, i) => { if (i && s.t - series[i - 1].t > 150) { segs.push(cur); cur = []; } cur.push(s); }); segs.push(cur);
    const off = u.weighting === 'C' ? 2.5 : 0;
    const lines = (dl, col, w) => segs.map((sg) => `<polyline points="${sg.map((s) => `${X(s.t).toFixed(1)},${Y(s.L + dl).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}"/>`).join('');
    let xt = ''; const span = t1 - t0, stepT = span > 6 * 3600 ? 3600 : span > 2 * 3600 ? 1800 : 600;
    for (let t = Math.ceil(t0 / stepT) * stepT; t <= t1; t += stepT) xt += `<text x="${X(t)}" y="${H - 8}" text-anchor="middle" font-size="10" font-weight="700">${hms(t % 86400).slice(0, 5)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="rp-svg">${axes(W, H, m, ymin, ymax, 5)}
      <rect x="${W / 2 - 70}" y="6" width="10" height="10" fill="#4cb648"/><text x="${W / 2 - 56}" y="15" font-size="10">SPLA</text>
      <rect x="${W / 2 - 10}" y="6" width="10" height="10" fill="#29a3dc"/><text x="${W / 2 + 4}" y="15" font-size="10">SPLA User</text>
      ${lines(0, '#4cb648', 1.2)}${lines(off, '#29a3dc', 1)}${xt}</svg>`;
  }
  function histChart(series) {
    const bins = ['< 50 dB', '50-55 dB', '55-60 dB', '60-65 dB', '65-70 dB', '70-75 dB', '75-80 dB', '80-85 dB', '85-90 dB', '90-95 dB', '> 95 dB'], c = new Array(11).fill(0);
    for (const s of series) c[s.L < 50 ? 0 : s.L >= 95 ? 10 : 1 + Math.floor((s.L - 50) / 5)]++;
    const top = Math.max(...c) * 1.15, stp = [1, 2, 5, 10, 20, 25, 50, 100, 200].find((v) => top / v <= 6) || 500, mx = Math.max(stp, Math.ceil(top / stp) * stp);
    const W = 760, H = 210, m = { l: 40, r: 10, t: 26, b: 30 }, bw = (W - m.l - m.r) / 11;
    const Y = (v) => m.t + (H - m.t - m.b) * (1 - v / mx);
    let g = axes(W, H, m, 0, mx, stp);
    c.forEach((v, i) => { const x = m.l + i * bw + bw * 0.12, w = bw * 0.76; g += `<rect x="${x}" y="${Y(v)}" width="${w}" height="${Y(0) - Y(v)}" fill="#4cb648"/>
      <text x="${x + w / 2}" y="${Y(v) - 4}" text-anchor="middle" font-size="9">${v}</text><text x="${x + w / 2}" y="${H - 12}" text-anchor="middle" font-size="9.5">${bins[i]}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" class="rp-svg"><rect x="${W / 2 - 60}" y="6" width="10" height="10" fill="#4cb648"/><text x="${W / 2 - 46}" y="15" font-size="10">Gráfico Histograma</text>
      <text x="12" y="${H / 2}" font-size="9" font-weight="700" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">Ocorrências</text>${g}</svg>`;
  }
  function octChart(spec) {
    if (!spec) return '<p class="rp-note">Sem dados de oitavas.</p>';
    const Z = spec, A = Z.map((v, i) => v + A_WEIGHT[i]), C = Z.map((v, i) => v + C_WEIGHT[i]);
    const W = 760, H = 262, m = { l: 34, r: 10, t: 26, b: 64 }, mx = 100, gw = (W - m.l - m.r) / OCTAVES.length, Y = (v) => m.t + (H - m.t - m.b) * (1 - Math.max(0, v) / mx);
    let g = axes(W, H, m, 0, mx, 10);
    OCTAVES.forEach((f, i) => { [[C[i], '#a24fe0'], [A[i], '#29a3dc'], [Z[i], '#4cb648']].forEach(([v, col], k) => {
      const w = gw * 0.26, x = m.l + i * gw + gw * 0.1 + k * w; g += `<rect x="${x}" y="${Y(v)}" width="${w - 2}" height="${Y(0) - Y(v)}" fill="${col}"/>
        <text x="${x + w / 2}" y="${Y(v) - 3}" font-size="8" transform="rotate(-90 ${x + w / 2} ${Y(v) - 3})">${n2(v)}</text>`; });
      g += `<text x="${m.l + i * gw + gw / 2 - 4}" y="${H - m.b + 8}" font-size="10" font-weight="700" transform="rotate(90 ${m.l + i * gw + gw / 2 - 4} ${H - m.b + 8})">${f}Hz</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" class="rp-svg"><rect x="${W / 2 - 200}" y="6" width="10" height="10" fill="#4cb648"/><text x="${W / 2 - 186}" y="15" font-size="10">Oitavas Z</text>
      <rect x="${W / 2 - 120}" y="6" width="10" height="10" fill="#29a3dc"/><text x="${W / 2 - 106}" y="15" font-size="10">Oitavas Ganho de Filtro A</text>
      <rect x="${W / 2 + 20}" y="6" width="10" height="10" fill="#a24fe0"/><text x="${W / 2 + 34}" y="15" font-size="10">Oitavas Ganho de Filtro C</text>${g}</svg>`;
  }

  return { open: form, render };
}
