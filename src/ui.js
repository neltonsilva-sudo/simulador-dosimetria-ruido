// Interface + demonstração narrada — dono: UI/DEMO.
// Fluxo: explorar → Dosímetro (apresentação: operar + calibrar) → colocar na trabalhadora → iniciar dosimetria → parar + pós-cal → relatório.
import { STEPS, CHAPTERS, MOUNT_TEXT, CAPTIONS, fwDo, demoClock } from './demo.js';
import { createActivities } from './atividade.js';
import { createDoseLesson } from './ui_dose.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const f1 = (v) => (isFinite(v) ? v.toFixed(1) : '—');
const f0 = (v) => (isFinite(v) ? Math.round(v).toString() : '—');

export function createUI(root, app) {
  const S = app.state;
  root.innerHTML = '';
  // ── cabeçalho ──
  const top = h('div', 'ui-top glass', `<div class="ui-brand"><b>Dosimetria de Ruído</b><span>Simulador · NHO-01 · NR-15 Anexo 1</span></div>`);
  const live = h('div', 'ui-live glass', '');
  root.append(top, live);
  // ── visor ampliado ──
  const lcdWrap = h('div', 'ui-lcd glass hidden', '<div class="ui-cap ui-cap-toggle">Visor do dosímetro <span class="chev">▾</span></div>');
  // no celular o painel começa recolhido (não cobre a cena); toque no título abre/fecha
  let lcdUser = false;
  const narrow = () => innerWidth < 760;
  if (narrow()) lcdWrap.classList.add('collapsed');
  lcdWrap.querySelector('.ui-cap-toggle').onclick = () => { lcdUser = true; lcdWrap.classList.toggle('collapsed'); };
  // painel do visor em resolução nativa da tela (pixels de 128×160 ampliados por inteiro: 2× por px CSS × devicePixelRatio)
  const LDPR = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), LS = 2 * LDPR;
  const lcd = h('canvas'); lcd.width = Math.round(128 * LS); lcd.height = Math.round(160 * LS); lcdWrap.appendChild(lcd);
  // fontes do visor vetorial (Google Fonts no index.html); o canvas só as usa depois de carregadas
  try { for (const f of ['500 20px "Roboto Mono"', '700 20px "Roboto Mono"', '600 20px "Roboto Condensed"', '700 20px "Roboto Condensed"']) document.fonts?.load(f); } catch {}
  const keys = h('div', 'ui-keys');
  // Teclas do aparelho: toque curto ao soltar; pressão longa dispara sozinha aos 3 s com o dedo ainda no botão (como no DoseMax).
  const LONG = 3000;
  function makeKey(k, sym, tip, cls = '') {
    const b = h('button', 'ui-key ' + cls, `<span>${sym}</span><i class="hold"></i>`); b.title = tip;
    let t0 = 0, raf = 0, fired = false;
    const tick = () => {
      const e = performance.now() - t0; b.style.setProperty('--p', Math.min(1, e / LONG));
      if (e >= LONG && !fired) { fired = true; app.fw?.press?.(k, LONG + 1); for (const kk of k.split('+')) app.dosimeter?.pressAnim?.(kk); b.classList.add('fired'); }
      raf = requestAnimationFrame(tick);
    };
    const end = (send) => { if (!t0) return; cancelAnimationFrame(raf); const e = performance.now() - t0; t0 = 0;
      b.classList.remove('down', 'fired'); b.style.setProperty('--p', 0);
      if (send && !fired && e < LONG) { app.fw?.press?.(k, 0); for (const kk of k.split('+')) app.dosimeter?.pressAnim?.(kk); } };
    b.onpointerdown = (ev) => { ev.preventDefault(); b.setPointerCapture?.(ev.pointerId); app.audio?.start?.(); t0 = performance.now(); fired = false; b.classList.add('down'); tick(); };
    b.onpointerup = () => end(true);
    b.onpointercancel = () => end(false);
    return b;
  }
  for (const [k, sym, tip] of [['power', '⏻', 'Liga/desliga (segure 3 s)'], ['play', '▶❙❙', 'Play/pausa · sobe · aumenta'], ['stop', '■', 'Stop · desce · diminui'], ['menu', '☰', 'Menu (segure 3 s) · confirma']]) keys.appendChild(makeKey(k, sym, tip));
  lcdWrap.appendChild(keys);
  const lockRow = h('div', 'ui-lockrow'); lockRow.appendChild(makeKey('power+menu', '🔒 ⏻ + ☰', 'Bloquear/desbloquear teclado (segure 3 s)', 'wide'));
  lcdWrap.appendChild(lockRow);
  const ctxHelp = h('div', 'ui-ctx', ''); lcdWrap.appendChild(ctxHelp);
  lcdWrap.appendChild(h('div', 'ui-hint', 'Clique = toque curto · segure 3 s = pressão longa (o anel enche)'));
  root.appendChild(lcdWrap);
  // ── legenda/narração ──
  const cap = h('div', 'ui-caption glass hidden', '');
  root.appendChild(cap);
  // ── barra de ações ──
  const bar = h('div', 'ui-bar glass', '');
  root.appendChild(bar);
  // ── painel de dosimetria ──
  const dash = h('div', 'ui-dash glass hidden', '');
  root.appendChild(dash);
  // ── modal ──
  const modal = h('div', 'ui-modal hidden', '');
  root.appendChild(modal);

  // ── narração por voz (pt-BR) ──
  let voiceOn = true, voice = null;
  const pickVoice = () => { const vs = speechSynthesis?.getVoices?.() || []; voice = vs.find((v) => /francisca/i.test(v.name) && /natural|online/i.test(v.name)) || vs.find((v) => /francisca/i.test(v.name)) || vs.find((v) => /luciana/i.test(v.name)) || vs.find((v) => /^pt(-|_)BR/i.test(v.lang)) || vs.find((v) => /^pt/i.test(v.lang)) || null; };
  try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch {}
  // Narração gravada com a voz Francisca (assets/voz/<fnv1a(texto)>.mp3, gerada por tools/gen_tts.py) — funciona em
  // qualquer navegador. Sem o arquivo (texto novo/alterado), cai na síntese de voz do navegador.
  let vozMap = null, curAudio = null;
  fetch('assets/voz/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((m) => (vozMap = m)).catch(() => {});
  const fnv = (str) => { let x = 0x811c9dc5; for (const b of new TextEncoder().encode(str)) x = Math.imul(x ^ b, 0x01000193) >>> 0; return x.toString(16).padStart(8, '0'); };
  const duck = (b) => app.audio?.duck?.(b);
  function stopVoice() { duck(false); synthPaused = false; try { speechSynthesis.cancel(); } catch {} if (curAudio) { try { curAudio.pause(); } catch {} curAudio = null; } }
  const usingRecorded = () => !!vozMap;
  // pausa/retomada da narração (aula da Dose): pauseVoice() congela o áudio; resumeVoice() continua e resolve ao terminar
  let synthPaused = false;
  function pauseVoice() {
    if (curAudio && !curAudio.paused && !curAudio.ended) { try { curAudio.pause(); } catch {} return true; }
    try { if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); synthPaused = true; duck(false); return true; } } catch {}
    return false;
  }
  function resumeVoice() {
    return new Promise((res) => {
      const a = curAudio;
      if (a && a.paused && !a.ended) {
        let done = false; const fin = () => { if (!done) { done = true; res(true); } };
        a.addEventListener('ended', fin, { once: true }); a.addEventListener('error', fin, { once: true });
        const left = isFinite(a.duration) ? a.duration - a.currentTime : 20;
        setTimeout(fin, (left + 2) * 1000);
        a.play().catch(fin); return;
      }
      if (synthPaused) {
        synthPaused = false; duck(true); try { speechSynthesis.resume(); } catch {}
        const t0 = performance.now();
        const poll = () => { let sp = false; try { sp = speechSynthesis.speaking; } catch {} if (!sp || performance.now() - t0 > 30000) { duck(false); res(true); } else setTimeout(poll, 250); };
        return void setTimeout(poll, 300);
      }
      res(false);
    });
  }
  function say(text) {
    return new Promise((res) => {
      stopVoice();
      const clean = text.replace(/<[^>]+>/g, '');
      const spoken = clean.replace(/\bNHO[- ]?0?1\b/g, 'ene agá ó zero um').replace(/\bNHO\b/g, 'ene agá ó').replace(/dB\(A\)/g, 'decibéis A').replace(/\bNEN\b/g, 'ene é ene').replace(/\bNE\b/g, 'ene é').replace(/\bNR-15\b/g, 'ene erre quinze'); // sigla soletrada na voz do navegador
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      const synth = () => {
        if (!voiceOn || !window.speechSynthesis) return setTimeout(fin, Math.min(9000, 1200 + clean.length * 45));
        const u = new SpeechSynthesisUtterance(spoken); u.lang = 'pt-BR'; if (voice) u.voice = voice; u.rate = voice && /francisca/i.test(voice.name) ? 1.0 : 1.05; u.volume = Math.min(1, voiceVol() * 1.2);
        u.onstart = () => duck(true); u.onend = () => { duck(false); fin(); }; u.onerror = () => { duck(false); fin(); }; setTimeout(fin, 2500 + clean.length * 90); speechSynthesis.speak(u);
      };
      const file = vozMap?.[fnv(clean)];
      if (voiceOn && file) {
        const a = new Audio('assets/voz/' + file); curAudio = a; a.preload = 'auto'; a.volume = Math.min(1, voiceVol() * 1.2);
        a.onended = fin; a.onerror = () => { if (curAudio === a) { curAudio = null; synth(); } };
        // ruído do galpão um pouco mais baixo só enquanto a voz toca (pausa/fim/troca devolvem o volume)
        a.addEventListener('playing', () => { if (curAudio === a) duck(true); }); a.addEventListener('pause', () => { if (curAudio === a) duck(false); }); a.addEventListener('ended', () => { if (curAudio === a || !curAudio) duck(false); });
        setTimeout(fin, 4000 + clean.length * 110);
        a.play().catch(() => { if (curAudio === a) { curAudio = null; synth(); } });
        return;
      }
      synth();
    });
  }

  const dose = createDoseLesson({ root, app, h, say: (t) => say(t), stopVoice: () => stopVoice(), pauseVoice: () => pauseVoice(), resumeVoice: () => resumeVoice() });
  const doseBtn = (cls = 'big') => btn('📐 Dose', cls, () => dose.open(0));
  // avisos rápidos vindos da cena (ex.: toque curto na ⏻ do dosímetro desligado)
  const toastEl = h('div', 'ativ-toast info hidden', ''); root.appendChild(toastEl); let toastTm = 0;
  app.on('toast', (msg) => { toastEl.textContent = msg; toastEl.classList.remove('hidden'); clearTimeout(toastTm); toastTm = setTimeout(() => toastEl.classList.add('hidden'), 3500); });
  const ativ = createActivities({ root, app, h, say: (t) => say(t), stopVoice: () => stopVoice(), dose, fwDo });
  const ativBtn = (cls = 'big') => btn('📝 Atividade', cls, () => ativ.open());
  function btn(label, cls, fn) { const b = h('button', 'ui-btn ' + (cls || ''), label); b.onclick = fn; return b; }
  function setBar(items) { bar.innerHTML = ''; items.forEach((i) => i && bar.appendChild(i)); }
  // som: botão liga/desliga + barra de volume (máquinas, bipes, calibrador e narração)
  const volIcon = () => (app.audio?.muted || (app.audio?.volume ?? 0.7) === 0 ? '🔇' : (app.audio?.volume ?? 0.7) < 0.4 ? '🔈' : '🔊');
  const soundBtn = () => {
    const w = h('div', 'ui-vol');
    const b = h('button', 'ui-btn ghost ui-vol-btn', volIcon()); b.title = 'Som liga/desliga';
    const r = h('input'); r.type = 'range'; r.min = 0; r.max = 100; r.step = 1; r.value = Math.round((app.audio?.volume ?? 0.7) * 100); r.title = 'Volume'; r.setAttribute('aria-label', 'Volume');
    const paint = () => { r.style.setProperty('--v', r.value + '%'); b.textContent = volIcon(); };
    b.onclick = () => { app.audio?.start?.(); app.audio?.setMuted?.(!app.audio?.muted); applyVoiceVol(); paint(); };
    r.oninput = () => { app.audio?.start?.(); if (app.audio?.muted && +r.value > 0) app.audio.setMuted(false); app.audio?.setVolume?.(+r.value / 100); applyVoiceVol(); paint(); };
    paint(); w.append(b, r); return w;
  };
  const voiceVol = () => (app.audio?.muted ? 0 : app.audio?.volume ?? 0.7);
  function applyVoiceVol() { if (curAudio) curAudio.volume = Math.min(1, voiceVol() * 1.2); }
  const viewBtns = () => { const w = h('div', 'ui-seg'); for (const [v, l] of [['ref', 'Foto'], ['station', 'Posto'], ['overview', 'Galpão']]) w.appendChild(btn(l, 'seg', () => app.setView(v, { animate: true }))); return w; };

  // ── fases ──
  let stepIdx = 0, running = false, cancelled = false;
  function render() {
    const p = S.phase;
    lcdWrap.classList.remove('hidden'); if (narrow() && !lcdUser) lcdWrap.classList.toggle('collapsed', !['apresentacao'].includes(p));
    dash.classList.toggle('hidden', !['dosimetria', 'relatorio'].includes(p));
    if (p === 'explorar') {
      cap.classList.add('hidden');
      setBar([soundBtn(), viewBtns(), btn('🎓 Demonstração', 'big', openDemoChooser), doseBtn(), ativBtn(), btn('<span class="ic">◉</span> Dosímetro', 'primary big', () => startPresentation('tudo'))]);
    } else if (p === 'apresentacao') {
      setBar([soundBtn(), btn('◀ Anterior', '', () => goStep(stepIdx - 1)), btn(`Próximo ▶`, 'primary', () => goStep(stepIdx + 1)),
        btn(demoClock.paused ? '▶ Continuar' : '❙❙ Pausar', 'ghost' + (demoClock.paused ? ' on' : ''), toggleDemoPause),
        btn(app.audio?.quiet ? '🔉 Ruído baixo' : '🔊 Ruído normal', 'ghost', () => { app.audio?.setQuiet?.(!app.audio.quiet); render(); }),
        btn(voiceOn ? '🗣 Voz' : '🔈 Voz off', 'ghost', () => { voiceOn = !voiceOn; if (!voiceOn) stopVoice(); render(); }),
        btn('Pular demonstração ⏭', 'ghost', () => finishPresentation())]);
    } else if (p === 'pronto') {
      showCaption(CAPTIONS.pronto.title, CAPTIONS.pronto.text, `${steps.length}/${steps.length}`);
      setBar([soundBtn(), btn('🎓 Demonstração', 'ghost', openDemoChooser), btn('<span class="ic">⤴</span> Colocar o dosímetro na trabalhadora', 'primary big', mount)]);
    } else if (p === 'colocado') {
      setBar([soundBtn(), viewBtns(), btn('↩ Retirar', 'ghost', async () => { await app.unmountDosimeter(); app.setPhase('pronto'); }), btn('<span class="ic">▶</span> Iniciar dosimetria', 'primary big', start)]);
    } else if (p === 'dosimetria') {
      cap.classList.add('hidden');
      const sp = h('div', 'ui-seg'); for (const s of [60, 240, 960]) { const b = btn(s + '×', 'seg' + (S.speed === s ? ' on' : ''), () => { app.setSpeed(s); render(); }); sp.appendChild(b); }
      setBar([soundBtn(), viewBtns(), h('span', 'ui-lbl', 'Velocidade'), sp, btn(S.running ? '❙❙ Pausar simulação' : '▶ Continuar', 'ghost', () => { S.running ? app.pauseDosimetry() : (S.running = true); render(); }), btn('■ Encerrar e pós-calibrar', 'danger', stopAndReport)]);
    } else if (p === 'relatorio') {
      setBar([soundBtn(), btn('🎓 Demonstração', 'ghost', openDemoChooser), doseBtn('ghost'), ativBtn('ghost'), btn('📄 Ver relatório', 'primary', showReport), btn('↺ Nova avaliação', 'ghost', () => location.reload())]);
    }
  }
  function showCaption(title, text, count) {
    cap.classList.remove('hidden');
    cap.innerHTML = `<div class="ui-cap-h"><span>${count || ''}</span><b>${title}</b></div><div class="ui-cap-t">${text}</div>`;
  }

  let steps = STEPS, chapterId = 'tudo';
  let demoExpl = false;
  async function startPresentation(ch = 'tudo') {
    if (!demoExpl) { demoExpl = true; app.audio?.explaining?.(true); } // ruído baixo durante a explicação (opção)
    app.audio?.start?.(); modal.classList.add('hidden');
    chapterId = typeof ch === 'string' ? ch : 'tudo';
    steps = chapterId === 'tudo' ? STEPS : STEPS.filter((x) => x.chapter === chapterId);
    app.setPhase('apresentacao'); stepIdx = -1;
    if (chapterId !== 'tudo' && chapterId !== 'uso') { // capítulo avulso: aparelho já na mão, de frente
      app.setView('present', { animate: true, duration: 1.6 }); await app.present(app.dosimeter?.group, 'presentDevice', 1.2); await fwDo.powerOn(app); }
    await goStep(0);
  }
  function voiceName() { return voice ? voice.name.replace(/^Microsoft\s+/i, '').replace(/\s*-.*$/, '') : 'voz do sistema'; }
  function openDemoChooser() {
    const fr = usingRecorded() || (voice && /francisca/i.test(voice.name));
    modal.innerHTML = `<div class="ui-report glass ui-chooser"><button class="ui-x">✕</button><h2>Demonstração do dosímetro</h2>
      <p class="sub">Aprenda a usar, configurar e calibrar o aparelho, com o visor e as teclas reais e explicação por áudio.</p>
      <div class="ui-chapters">${CHAPTERS.map((c) => `<button class="ui-chap" data-ch="${c.id}"><b>${c.label}</b><span>${c.sub}</span><em>${(c.id === 'tudo' ? STEPS : STEPS.filter((x) => x.chapter === c.id)).length} passos</em></button>`).join('')}</div>
      <p class="voice ${fr ? 'ok' : ''}">🗣 Narração: <b>${usingRecorded() ? 'Francisca (gravada)' : voiceName()}</b>${fr ? '' : ' — a voz <b>Francisca</b> (Microsoft, natural) aparece ao abrir o simulador no navegador <b>Microsoft Edge</b>.'}</p></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('.ui-x').onclick = () => modal.classList.add('hidden');
    modal.querySelectorAll('.ui-chap').forEach((b) => (b.onclick = () => startPresentation(b.dataset.ch)));
  }
  let token = 0, resumeP = null;
  // ❙❙ Pausar: congela a fala, as ações do aparelho e o avanço; ▶ Continuar retoma do mesmo ponto
  const pwait = (ms) => new Promise((r) => { let left = ms, last = performance.now();
    const tick = () => { const now = performance.now(); if (!demoClock.paused) left -= now - last; last = now; if (left <= 0) r(); else setTimeout(tick, 50); }; setTimeout(tick, 50); });
  function toggleDemoPause() {
    if (demoClock.paused) { demoClock.paused = false; resumeP = resumeVoice(); }
    else { demoClock.paused = true; pauseVoice(); }
    render();
  }
  async function goStep(i) {
    demoClock.paused = false; resumeP = null;
    if (i < 0) i = 0;
    if (i >= steps.length) return finishPresentation();
    const my = ++token; stepIdx = i; const st = steps[i]; render();
    showCaption(st.title, st.text, `${i + 1}/${steps.length}`);
    app.dosimeter?.highlight?.(st.highlight || null);
    const speech = say(st.say || st.text);
    try { await st.run?.(app, { wait: pwait, alive: () => my === token }); } catch (e) { console.error('[demo]', e); }
    await speech;
    while (my === token && demoClock.paused) await new Promise((r) => setTimeout(r, 100));   // pausado: espera o Continuar
    if (resumeP) await resumeP;                                                                 // e a fala retomada terminar
    if (my === token && st.auto !== false && S.phase === 'apresentacao') { await pwait(900); if (my === token) goStep(i + 1); }
  }
  async function finishPresentation() {
    if (demoExpl) { demoExpl = false; app.audio?.explaining?.(false); }
    token++; stopVoice(); demoClock.paused = false;
    app.dosimeter?.highlight?.(null);
    await fwDo.ensureReady(app); // ligado + calibrado + espuma no lugar, calibrador guardado
    app.setPhase('pronto'); say(CAPTIONS.pronto.text);
  }
  async function mount() {
    showCaption('Instalação no trabalhador (NHO-01, item 6.3)', MOUNT_TEXT, '');
    say(MOUNT_TEXT.replace(/<li>/g, '. '));
    app.setView('shoulder', { animate: true, duration: 2 });
    app.worker?.setActivity?.('olhando');                 // fica parada olhando o avaliador enquanto o aparelho é preso
    await app.mountDosimeter({ side: 'L', duration: 1.8 });
    setTimeout(() => app.worker?.setActivity?.('operando'), 2500);
    app.setPhase('colocado');
  }
  async function start() {
    app.audio?.start?.();
    showCaption(CAPTIONS.iniciar.title, CAPTIONS.iniciar.text, ''); const fala = say(CAPTIONS.iniciar.text);
    S.clock = app.workday.start - 25; // 06:59:35
    await fwDo.startRecording(app);
    app.startDosimetry(); app.setView('ref', { animate: true, duration: 2.5 });
    fala.then(() => setTimeout(() => { if (S.phase === 'dosimetria') cap.classList.add('hidden'); }, 1500)); // legenda some quando a narração termina
  }
  async function stopAndReport() {
    app.pauseDosimetry();
    showCaption(CAPTIONS.poscal.title, CAPTIONS.poscal.text, ''); say(CAPTIONS.poscal.text);
    await fwDo.stopWithPostCal(app);
    app.setPhase('relatorio'); showReport();
  }
  app.on('workdayEnd', () => { if (S.phase === 'dosimetria') stopAndReport(); });

  // ── relatório ──
  function showReport() {
    const r = app.results(); if (!r) return;
    const D = app.DOSI, uc = userCrit(r), rows = ['NHO01', 'NR15', 'USER'].map((k) => {
      const s = r[k]; if (!s) return ''; const C = k === 'USER' ? { ...D.CRITERIA.USER, ...uc } : D.CRITERIA[k]; const v = D.verdict(s, C);
      return `<tr><td><b>${C.label}</b><small>${C.weighting || 'A'} · ${C.response === 'F' ? 'rápida' : 'lenta'} · CR ${C.CR} · NLI ${C.TL} · q = ${C.q}</small></td><td>${f0(s.dose)}%</td><td>${f0(s.projected)}%</td><td>${f1(s.lavg)}</td><td>${s.nen != null ? f1(s.nen) : '—'}</td><td>${f1(s.lmax)}</td><td><span class="tag" style="background:${v.color}">${v.label}</span></td></tr>`;
    }).join('');
    const cc = r.calCheck;
    const cal = cc ? `<p class="${cc.ok ? 'ok' : 'bad'}">Calibração: pré ${f1(cc.pre)} dB · pós ${f1(cc.post)} dB · diferença ${cc.diff >= 0 ? '+' : ''}${cc.diff.toFixed(1)} dB → ${cc.ok ? 'VÁLIDA (dentro de ±1 dB, NHO-01 6.3)' : 'INVÁLIDA — repetir a medição (fora de ±1 dB)'}</p>` : '<p>Pós-calibração não registrada.</p>';
    const hrs = r.NHO01 ? (r.NHO01.time / 3600).toFixed(2).replace('.', ',') : '—';
    modal.innerHTML = `<div class="ui-report glass"><button class="ui-x">✕</button><h2>Relatório de dosimetria de ruído</h2>
      <p class="sub">Trabalhadora: operadora de prensa · Posto: painel CNC da prensa excêntrica 80 t · Microfone: ombro esquerdo (lado mais exposto) · Tempo medido: ${hrs} h (almoço em pausa programada)</p>
      <table><thead><tr><th>Critério</th><th>Dose medida</th><th>Dose projetada (8 h)</th><th>Lavg / NE dB(A)</th><th>NEN dB(A)</th><th>Lmax dB(A)</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table>
      ${cal}
      <div class="ui-notes"><b>Interpretação didática</b><ul>
      <li>A mesma exposição gera doses diferentes: a NHO-01 usa incremento de duplicação de dose q = 3 (critério de igual energia); a NR-15 usa q = 5. Por isso a dose NHO-01 é maior.</li>
      <li>Nível de ação = dose 50% (NEN 82 dB(A) na NHO-01). Acima de 100% → limite de exposição excedido: medidas de controle (engenharia na fonte, enclausuramento da prensa, administrativas) e PCA; protetor auditivo como medida complementar.</li>
      <li>NR-15: acima do limite de tolerância caracteriza insalubridade (grau médio, Anexo 1); a neutralização depende de EPI eficaz comprovado.</li></ul></div>
      <div class="ui-row"><button class="ui-btn primary" onclick="window.print()">🖨 Imprimir</button></div></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('.ui-x').onclick = () => modal.classList.add('hidden');
  }


  // parâmetros do critério USER configurados no aparelho (menu Ajustes)
  function userCrit(r) { const u = r?.settings?.user || app.fw?.state?.settings?.user || {}; return { label: 'USER', CR: u.CR ?? 85, q: u.q ?? 3, TL: u.TL ?? 80, weighting: u.weighting || 'A', response: u.response || 'S' }; }
  // ajuda de contexto: o que cada tecla faz na tela atual do aparelho
  function keyHelp() {
    const f = app.fw?.state; if (!f) return '';
    const PAGE_T = { options: 'options', number: 'number', fields: 'fields' };
    if (f.power === 'off') return '<b>Desligado.</b> Segure ⏻ por 3 s para ligar.';
    if (f.power === 'boot') return 'Ligando…';
    if (f.locked) return '<b>Teclado bloqueado</b> (🔒). Segure ⏻ + ☰ por 3 s para desbloquear.';
    if (f.cal && f.cal.status === 'stab') return 'Calibrando… mantenha o calibrador acoplado e ligado.';
    if (f.popup) return `<b>${f.popup.type === 'precal' ? 'Pré calibrar' : 'Pós calibrar'}:</b> ▶❙❙ sobe · ■ desce · ☰ confirma (Não / 94 dB / 114 dB). Para calibrar, acople o calibrador antes.`;
    const path = f.menuPath || [];
    if (path.length) {
      const pg = f.page, key = pg?.key;
      const tips = { taxa: 'Taxa de troca = incremento de duplicação de dose <b>q</b> (3 NHO-01 · 5 NR-15 · 4).', criterio: 'Nível critério: 100% de dose em 8 h (NHO-01/NR-15: 85).',
        limiar: 'Nível limiar de integração (NHO-01/NR-15: 80).', pfreq: 'Ponderação: A (ocupacional), C (picos), Z (linear).', ptemp: 'Resposta: Lenta (S) exigida pela NHO-01 e NR-15.',
        duracao: 'Duração e horário de pausa: ☰ avança campo a campo.', calibrar: '▶❙❙ = 114 dB · ■ = 94 dB · ☰ calibra (acople o calibrador).', apagar: 'Cuidado: “Sim” apaga todos os registros.' };
      if (pg) { const t = { number: '▶❙❙ aumenta · ■ diminui · ☰ salva', options: '▶❙❙ sobe · ■ desce · ☰ salva', fields: '▶❙❙ + · ■ − · ☰ próximo campo', records: '▶❙❙ sobe · ■ desce · ☰ abre', info: 'qualquer tecla volta', calibrar: '' };
        return `${tips[key] ? tips[key] + '<br>' : ''}${t[pageType(key)] ?? ''}`; }
      const where = path[path.length - 1];
      return `Menu <b>${({ main: "principal", dosimetria: "Dosimetria", ajustes: "Ajustes", sistema: "Sistema" })[where] || where}</b>: ▶❙❙ sobe · ■ desce · ☰ entra. “Voltar” sobe um nível; ☰ por 3 s sai do menu.${where === 'ajustes' ? '<br>Ajustes valem só para o critério <b>USER</b> (NHO-01 e NR-15 são fixos).' : ''}`;
    }
    if (f.mode === 'run' || f.mode === 'pause') return `<b>${f.mode === 'run' ? 'Gravando' : 'Pausado'}.</b> ▶❙❙/■ trocam a tela · ▶❙❙ 3 s ${f.mode === 'run' ? 'pausa' : 'retoma'} · ■ 3 s para e pós-calibra. Menu bloqueado durante a dosimetria.`;
    if (f.mode === 'countdown') return 'Iniciando em instantes (indicador vermelho piscando).';
    return '▶❙❙/■ trocam a tela · <b>☰ 3 s abre o menu</b> (Ajustes: q, critério, limiar, ponderação…) · ▶❙❙ 3 s inicia a dosimetria.';
  }
  function pageType(key) { const t = { taxa: 'number', criterio: 'number', limiar: 'number', intervalo: 'number', pfreq: 'options', ptemp: 'options', agenda: 'options', apagar: 'options', filtros: 'options', idioma: 'options', duracao: 'fields', datahora: 'fields', tela: 'fields', registros: 'records', sobre: 'info', calibrar: 'calibrar' }; return t[key]; }
  // ── atualização contínua (visor ampliado, painel vivo, dashboard) ──
  const lctx = lcd.getContext('2d'); lctx.imageSmoothingEnabled = false;
  // grade fina entre os pixels (aspecto de LCD) só quando cada pixel tem ≥ 4 px físicos — fica nítida, sem chuvisco
  let gridPat = null;
  if (LS >= 4) { const g = document.createElement('canvas'); g.width = g.height = LS; const gx = g.getContext('2d');
    gx.fillStyle = 'rgba(0,0,0,0.32)'; gx.fillRect(LS - 1, 0, 1, LS); gx.fillRect(0, LS - 1, LS, 1); gridPat = lctx.createPattern(g, 'repeat'); }
  function drawPanelLCD() {
    const fw = app.fw, nc = fw?.nativeCanvas, W = lcd.width, H = lcd.height;
    if (!nc) { lctx.imageSmoothingEnabled = true; lctx.drawImage(fw.canvas, 0, 0, W, H); return; }
    if (fw.drawHi) { fw.drawHi(lctx, W / 128); return; } // vetorial: fonte real, linhas suaves, nítido em qualquer DPR
    const bl = fw.backlight ? fw.backlight() : 1;
    lctx.globalAlpha = 1; lctx.imageSmoothingEnabled = false; lctx.fillStyle = '#030405'; lctx.fillRect(0, 0, W, H);
    if (bl <= 0.001) return;
    lctx.drawImage(nc, 0, 0, W, H);
    if (gridPat) { lctx.fillStyle = gridPat; lctx.fillRect(0, 0, W, H); }
    if (bl < 0.999) { lctx.fillStyle = `rgba(3,4,5,${1 - bl})`; lctx.fillRect(0, 0, W, H); }
  }
  let acc = 0;
  app.stage.onFrame((dt) => {
    acc += dt; if (acc < 0.1) return; acc = 0;
    if (app.fw?.canvas && !lcdWrap.classList.contains('hidden')) { drawPanelLCD(); const kh = keyHelp(); if (ctxHelp.innerHTML !== kh) ctxHelp.innerHTML = kh; }
    const L = app.fieldLevel(app.micWorld());
    const act = S.running ? app.WD.activityAt(app.workday, S.clock) : null;
    live.innerHTML = `<div><span>Nível no microfone</span><b>${f1(app.instantLevel())} <small>dB(A)</small></b></div><div><span>Campo no posto</span><b>${f1(L)} <small>dB(A)</small></b></div><div><span>Horário</span><b>${app.fmtClock(S.clock)}</b></div>${act ? `<div class="wide"><span>Atividade</span><b>${act.label}</b></div>` : ''}`;
    if (!dash.classList.contains('hidden')) {
      const r = app.results(); if (!r) return;
      const bar2 = (s, c) => { const pct = Math.min(400, s?.dose || 0); return `<div class="dr"><div class="dl"><b>${c}</b><span>${f0(s?.dose)}%</span></div><div class="db"><i style="width:${pct / 4}%"></i><em style="left:12.5%"></em><em style="left:25%"></em></div><div class="dm">Lavg ${f1(s?.lavg)} · Lmax ${f1(s?.lmax)} · projetada ${f0(s?.projected)}%</div></div>`; };
      const prog = Math.max(0, Math.min(1, (S.clock - app.workday.start) / (app.workday.end - app.workday.start)));
      dash.innerHTML = `<div class="ui-cap">Dosimetria em andamento</div><div class="prog"><i style="width:${prog * 100}%"></i></div><div class="pt">07:00 ${app.fmtClock(S.clock)} 16:00</div>${bar2(r.NHO01, 'NHO-01 (q=3)')}${bar2(r.NR15, 'NR-15 (q=5)')}${r.USER ? bar2(r.USER, `USER (q=${userCrit(r).q}, CR ${userCrit(r).CR})`) : ''}<div class="legend"><em></em> nível de ação 50% · limite 100%</div>`;
    }
  });
  app.on('phase', render);
  render();
  return { render, showReport, say };
}
