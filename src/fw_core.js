// Núcleo lógico do firmware do DoseMax — dono: FIRMWARE. PURO (sem DOM): testável em node (tools/fw_test.mjs).
// Fonte da verdade: docs/manual-dosemax.txt + refs/manual_p*.png.
//  • Liga/desliga: ⏻ 3 s (tela de abertura).  • Telas: ▶‖ / ■ alternam Nível, Espectro, Oitavas, NHO01, NR15, USER.
//  • Menu: ☰ 3 s; ▶‖ sobe, ■ desce, ☰ confirma. Níveis/tempos: ■ diminui, ▶‖ aumenta, ☰ confirma.
//  • Iniciar: ▶‖ 3 s → "Pre Calibrar" (Nao/94dB/114dB) → calibra → indicador vermelho pisca 20 s → inicia sozinho.
//  • Pausar/retomar: ▶‖ 3 s (indicador amarelo). Parar: ■ 3 s → "Pos Calibrar" → indicador azul.
//  • Bloqueio: automático 60 s após o início; ⏻+☰ 3 s bloqueia/desbloqueia (cadeado).
// Integração: createIntegrator de dosimetry.js para NHO01, NR15 e USER em paralelo (fórmulas NÃO reimplementadas aqui).
import { createIntegrator, CRITERIA, calibrationCheck, weighted, OCTAVES } from './dosimetry.js';

export const SENS_ERROR = 0.6;     // erro de sensibilidade do microfone antes da calibração (dB)
export const LONG_MS = 3000;       // pressão longa
export const CAL_STAB_S = 4;       // estabilização da calibração acústica
export const CAL_MAX_DIFF = 4;     // diferença máxima aceitável entre nível escolhido e sinal (dB)
export const COUNTDOWN_S = 20;     // indicador vermelho piscando antes de iniciar
export const AUTOLOCK_S = 60;      // bloqueio automático do teclado após o início
export const BOOT_S = 2.5;         // tela de abertura
export const MAX_RECORDS = 99;
export const RECORD_MIN = 480;     // cada registro: até 8 h
export const BATTERY_H = 20;       // autonomia
export const RANGE = [60, 140];    // faixa de medição (sub/sobrecarga fora dela)
export const SCREENS = ['Nivel', 'Espectro', 'Oitavas', 'NHO01', 'NR15', 'USER'];

// ── idioma (Sistema › Idioma). Chave = texto em português sem acento, como no visor. ──
const TR = {
  'Dosimetria': ['Dosimetry', 'Dosimetria'], 'Ajustes': ['Settings', 'Ajustes'], 'Sistema': ['System', 'Sistema'],
  'Sobre': ['About', 'Acerca'], 'Voltar': ['Back', 'Volver'], 'Duracao': ['Duration', 'Duracion'], 'Intervalo': ['Interval', 'Intervalo'],
  'Agenda': ['Schedule', 'Agenda'], 'Registro': ['Records', 'Registros'], 'Registros': ['Records', 'Registros'], 'Apagar': ['Erase', 'Borrar'],
  'Calibrar': ['Calibrate', 'Calibrar'], 'P. Frequencia': ['F. Weighting', 'P. Frecuencia'], 'P. Temporal': ['T. Weighting', 'P. Temporal'],
  'Nivel Limiar': ['Threshold', 'Nivel Umbral'], 'Nivel Criterio': ['Criterion', 'Nivel Criterio'], 'Taxa de Troca': ['Exch. Rate', 'Tasa Cambio'],
  'Filtros': ['Filters', 'Filtros'], 'Data/Hora': ['Date/Time', 'Fecha/Hora'], 'Tela': ['Display', 'Pantalla'], 'Idioma': ['Language', 'Idioma'],
  'Nao': ['No', 'No'], 'Sim': ['Yes', 'Si'], 'Pre Calibrar': ['Pre Calibr.', 'Pre Calibrar'], 'Pos Calibrar': ['Post Calibr.', 'Pos Calibrar'],
  'Calibracao': ['Calibration', 'Calibracion'], 'Nivel': ['Level', 'Nivel'], 'Espectro': ['Spectrum', 'Espectro'], 'Oitavas': ['Octaves', 'Octavas'],
  'Tempo (h/min)': ['Time (h/min)', 'Tiempo (h/min)'], 'Horario Pausa': ['Pause time', 'Horario Pausa'], 'Inicio': ['Start', 'Inicio'], 'Fim': ['End', 'Fin'],
  'Apagar todos': ['Erase all', 'Borrar todos'], 'os registros?': ['records?', 'los registros?'], 'Desligada': ['Off', 'Apagada'], 'Ligada': ['On', 'Activa'],
  'Ligado': ['On', 'Activo'], 'Desligado': ['Off', 'Apagado'], 'Lenta (S)': ['Slow (S)', 'Lenta (S)'], 'Rapida (F)': ['Fast (F)', 'Rapida (F)'],
  'Brilho': ['Brightness', 'Brillo'], 'Desligar (min)': ['Off after (min)', 'Apagar (min)'], 'Calibrando': ['Calibrating', 'Calibrando'],
  'Calibrado': ['Calibrated', 'Calibrado'], 'Sinal instavel': ['Unstable signal', 'Senal inestable'], 'Verifique calibrador': ['Check calibrator', 'Verifique calibrador'],
  'Teclado bloqueado': ['Keypad locked', 'Teclado bloqueado'], 'Teclado liberado': ['Keypad unlocked', 'Teclado libre'],
  'Dosimetria em curso': ['Dosimetry running', 'Dosimetria en curso'], 'Memoria cheia': ['Memory full', 'Memoria llena'],
  'Registros apagados': ['Records erased', 'Registros borrados'], 'Salvo': ['Saved', 'Guardado'], 'Cancelado': ['Cancelled', 'Cancelado'],
  'Oitavas 63Hz-8kHz': ['Octaves 63Hz-8kHz', 'Octavas 63Hz-8kHz'], 'Filtro desligado': ['Filter off', 'Filtro apagado'],
  'Usar ultima calib.': ['Using last calib.', 'Usa ultima calib.'], 'Sem registros': ['No records', 'Sin registros'], 'Portugues': ['Portugues', 'Portugues'],
  'Intervalo (s)': ['Interval (s)', 'Intervalo (s)'], 'Desligando': ['Shutting down', 'Apagando'], 'Fim da duracao': ['Duration reached', 'Fin duracion'],
};
export const tr = (txt, lang = 0) => (lang ? (TR[txt]?.[lang - 1] ?? txt) : txt);

// ── estrutura de menus (p12/p14 do manual) ──
export const MENUS = {
  main: { title: 'MENU', items: [['Dosimetria', 'dosimetria'], ['Ajustes', 'ajustes'], ['Sistema', 'sistema'], ['Sobre', 'sobre'], ['Voltar', null]] },
  dosimetria: { title: 'Dosimetria', items: [['Duracao', 'duracao'], ['Intervalo', 'intervalo'], ['Agenda', 'agenda'], ['Registro', 'registros'], ['Apagar', 'apagar'], ['Calibrar', 'calibrar'], ['Voltar', null]] },
  ajustes: { title: 'Ajustes', items: [['P. Frequencia', 'pfreq'], ['P. Temporal', 'ptemp'], ['Nivel Limiar', 'limiar'], ['Nivel Criterio', 'criterio'], ['Taxa de Troca', 'taxa'], ['Filtros', 'filtros'], ['Voltar', null]] },
  sistema: { title: 'Sistema', items: [['Data/Hora', 'datahora'], ['Tela', 'tela'], ['Idioma', 'idioma'], ['Voltar', null]] },
};
const clampI = (v, a, b) => Math.max(a, Math.min(b, v));
// Páginas-folha. options: ▶‖ sobe / ■ desce / ☰ confirma. number/fields: ■ diminui / ▶‖ aumenta / ☰ confirma (próximo campo).
export const PAGES = {
  duracao: { type: 'fields', title: 'Duracao',
    fields: [['durH', 0, 24, 1], ['durM', 0, 55, 5], ['piH', 0, 23, 1], ['piM', 0, 55, 5], ['pfH', 0, 23, 1], ['pfM', 0, 55, 5]],
    load: (st) => ({ durH: Math.floor(st.durationMin / 60), durM: st.durationMin % 60, piH: Math.floor(st.pauseStart / 60), piM: st.pauseStart % 60, pfH: Math.floor(st.pauseEnd / 60), pfM: st.pauseEnd % 60 }),
    save: (st, v) => { st.durationMin = clampI(v.durH * 60 + v.durM, 5, 1440); st.pauseStart = v.piH * 60 + v.piM; st.pauseEnd = v.pfH * 60 + v.pfM; } },
  intervalo: { type: 'number', title: 'Intervalo', label: 'Intervalo (s)', values: [1, 2, 5, 10, 15, 30, 60, 120, 300], get: (st) => st.interval, set: (st, v) => (st.interval = v) },
  agenda: { type: 'options', title: 'Agenda', options: ['Desligada', 'Ligada'], get: (st) => (st.agenda ? 1 : 0), set: (st, i) => (st.agenda = i === 1) },
  registros: { type: 'records', title: 'Registros' },
  apagar: { type: 'options', title: 'Apagar', confirm: true, options: ['Nao', 'Sim'], get: () => 0, set: null },
  calibrar: { type: 'calibrar', title: 'Calibracao' },
  pfreq: { type: 'options', title: 'P. Frequencia', options: ['A', 'C', 'Z'], get: (st) => 'ACZ'.indexOf(st.user.weighting), set: (st, i) => (st.user.weighting = 'ACZ'[i]) },
  ptemp: { type: 'options', title: 'P. Temporal', options: ['Lenta (S)', 'Rapida (F)'], get: (st) => (st.user.response === 'F' ? 1 : 0), set: (st, i) => (st.user.response = i ? 'F' : 'S') },
  limiar: { type: 'number', title: 'Nivel Limiar', label: 'dB', values: range(60, 90), get: (st) => st.user.TL, set: (st, v) => (st.user.TL = v) },
  criterio: { type: 'number', title: 'Nivel Criterio', label: 'dB', values: range(80, 90), get: (st) => st.user.CR, set: (st, v) => (st.user.CR = v) },
  taxa: { type: 'number', title: 'Taxa de Troca', label: 'q (dB)', values: [3, 4, 5], get: (st) => st.user.q, set: (st, v) => (st.user.q = v) },
  filtros: { type: 'options', title: 'Filtros', sub: 'Oitavas 63Hz-8kHz', options: ['Ligado', 'Desligado'], get: (st) => (st.octaves ? 0 : 1), set: (st, i) => (st.octaves = i === 0) },
  datahora: { type: 'fields', title: 'Data/Hora', fields: [['d', 1, 31, 1], ['m', 1, 12, 1], ['h', 0, 23, 1], ['mi', 0, 59, 1]] },
  tela: { type: 'fields', title: 'Tela', fields: [['bri', 1, 10, 1], ['off', 1, 9, 1]],
    load: (st) => ({ bri: st.brightness, off: st.screenOff }), save: (st, v) => { st.brightness = v.bri; st.screenOff = v.off; } },
  idioma: { type: 'options', title: 'Idioma', options: ['Portugues', 'English', 'Espanol'], get: (st) => st.lang, set: (st, i) => (st.lang = i) },
  sobre: { type: 'info', title: 'Sobre' },
};
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

export const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
export const hms = (t) => `${pad2(t / 3600)}:${pad2((t / 60) % 60)}:${pad2(t % 60)}`;
export const hhmm = (t) => { t = ((t % 86400) + 86400) % 86400; return `${pad2(t / 3600)}:${pad2((t / 60) % 60)}`; };

// 35 registros já gravados (o aparelho do técnico tem histórico) → "36/99" na primeira medição do simulador.
function seedRecords() {
  let r = 20261112; const rnd = () => ((r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296);
  const recs = []; const d0 = Date.UTC(2026, 0, 12);
  for (let i = 1; i <= 35; i++) {
    const day = new Date(d0 + Math.round(i * 8.6 + rnd() * 3) * 86400000);
    const start = 7 * 3600 + Math.round(rnd() * 8) * 600;
    recs.push({ n: i, date: `${pad2(day.getUTCDate())}/${pad2(day.getUTCMonth() + 1)}`, time: hhmm(start), startClock: start,
      durationMin: Math.round(300 + rnd() * 110), postCal: rnd() < 0.8 ? { level: 114, reading: 114 + Math.round((rnd() - 0.4) * 6) / 10 } : null });
  }
  return recs;
}

/**
 * createCore({getInput}) → núcleo. getInput() → {L, spectrum[8]|null, calibrator:{coupled,on,level}, calDrift}.
 * state.mode: 'idle' | 'countdown' (20 s piscando) | 'run' | 'pause' | 'stopped'.  state.popup: null | {type:'precal'|'postcal'|'regpostcal', sel, rec}.
 * state.cal: null | {kind:'pre'|'post'|'menu'|'regpost', level, t, status:'stab'|'ok'|'fail', msg, reading}.
 */
export function createCore({ getInput } = {}) {
  getInput ||= () => ({ L: 45, spectrum: null, calibrator: { coupled: false, on: false, level: 114 }, calDrift: 0 });
  const listeners = {};
  const emit = (ev, d) => { (listeners[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); };
  const settings = { durationMin: 480, pauseStart: 11 * 60, pauseEnd: 12 * 60, pauseOn: true, interval: 1, agenda: false, octaves: true,
    brightness: 10, screenOff: 9, lang: 0, user: { weighting: 'A', response: 'S', TL: 80, CR: 85, q: 3 } };
  const s = {
    power: 'off', mode: 'idle', screen: 0, menuPath: [], menuSel: {}, page: null, popup: null, cal: null, msg: null,
    locked: false, led: 'off', calOffset: 0, sensError: SENS_ERROR, preCal: null, postCal: null,
    lastCal: { kind: 'lab', level: 114, before: 114, reading: 114, date: '03/11', time: '08:10', clock: 8 * 3600 + 600 },
    records: seedRecords(), settings, date: { d: 12, m: 11 }, clock: 6 * 3600 + 45 * 60, clockOffset: 0,
    battery: 99.4, spl: 45, splShown: 45, over: 0, warn: false, history: [], spectrumShown: null, countdown: 0, bootT: 0,
    progPause: false, displayOff: false, idleReal: 0, blinkT: 0, rev: 1, run: null, lastRun: null,
  };
  let E = Math.pow(10, 4.5), shownT = 0, histT = 0, lastMin = -1;
  const bump = () => { s.rev++; };
  const say = (text, t = 2) => { s.msg = { text, t }; bump(); };
  const beep = (kind) => emit('beep', kind);
  const change = () => { bump(); emit('change', s); };
  const recording = () => s.mode === 'run' || s.mode === 'pause' || s.mode === 'countdown';
  const nowClock = () => s.clock + s.clockOffset;
  const driftNow = () => (s.run ? (getInput().calDrift || 0) * Math.min(1, s.run.simT / (RECORD_MIN * 60)) : 0);

  /** Nível que o aparelho "mede" a partir do nível verdadeiro (erro de sensibilidade + correção da calibração + deriva). */
  const measured = (Ltrue, withDrift = true) => Ltrue + s.sensError + s.calOffset + (withDrift ? driftNow() : 0);
  /** Converte nível A → ponderação W usando o espectro (para USER com C/Z). */
  function toWeighting(LA, W, spec) {
    if (W === 'A' || !spec) return LA;
    return LA + weighted(spec, W) - weighted(spec, 'A');
  }

  // ── liga / desliga ──
  function boot() { s.power = 'boot'; s.bootT = 0; s.led = 'blue'; beep('boot'); change(); }
  function powerOff() {
    if (recording()) { say(tr('Dosimetria em curso', settings.lang)); beep('error'); return; }
    s.power = 'off'; s.menuPath = []; s.page = null; s.popup = null; s.cal = null; s.msg = null; s.locked = false; s.led = 'off';
    beep('off'); change();
  }

  // ── início / pausa / parada ──
  function openPrecal() {
    if (s.records.length >= MAX_RECORDS) { say(tr('Memoria cheia', settings.lang)); beep('error'); return; }
    s.popup = { type: 'precal', sel: 0 }; change();
  }
  function startCountdown() { s.mode = 'countdown'; s.countdown = COUNTDOWN_S; s.blinkT = 0; beep('ok'); change(); }
  function beginRun() {
    const u = settings.user;
    const userCrit = { ...CRITERIA.USER, CR: u.CR, q: u.q, TL: u.TL, weighting: u.weighting, response: u.response };
    const n = s.records.length + 1;
    const rec = { n, date: `${pad2(s.date.d)}/${pad2(s.date.m)}`, time: hhmm(nowClock()), startClock: s.clock, durationMin: 0, running: true, postCal: null };
    s.records.push(rec);
    s.run = { n, rec, startClock: s.clock, stopClock: null, pauses: [], realT: 0, simT: 0, autoLocked: false, userCrit,
      its: { NHO01: createIntegrator(CRITERIA.NHO01), NR15: createIntegrator(CRITERIA.NR15), USER: createIntegrator(userCrit) },
      preCal: s.preCal, postCal: null, g: { e: 0, n: 0 }, stopReason: null };
    s.postCal = null; s.mode = 'run'; s.progPause = false; s.history = []; s.blinkT = 0;
    beep('start'); change(); emit('started', { record: n, clock: s.clock, preCal: s.preCal });
  }
  function setPause(on, kind = 'manual') {
    const run = s.run; if (!run) return;
    if (on) run.pauses.push({ from: s.clock, to: null, kind });
    else { const p = run.pauses.findLast?.((x) => x.to == null && x.kind === kind) ?? [...run.pauses].reverse().find((x) => x.to == null && x.kind === kind); if (p) p.to = s.clock; }
    change(); emit('paused', { paused: on, kind, clock: s.clock });
  }
  function stopRun(reason = 'manual') {
    const run = s.run; if (!run) return;
    if (s.mode === 'countdown') return;
    run.stopClock = s.clock; run.stopReason = reason;
    for (const p of run.pauses) if (p.to == null) p.to = s.clock;
    run.rec.durationMin = Math.round(run.its.NHO01.time / 60); run.rec.running = false;
    s.mode = 'stopped'; s.progPause = false;
    s.popup = { type: 'postcal', sel: 0 };
    beep('stop'); change(); emit('stopped', results());
  }
  function finishPost() {
    s.popup = null; s.cal = null;
    if (s.run) { s.run.postCal = s.postCal; s.run.rec.postCal = s.postCal; s.run.rec.results = snapshots(s.run); }
    change(); emit('postcal', s.postCal);
  }

  // ── calibração acústica (pré, pós, menu e pós de registros) ──
  function startCal(kind, level, extra = {}) { s.cal = { kind, level, t: 0, status: 'stab', msg: '', reading: null, hold: 0, ...extra }; beep('cal'); change(); }
  function updateCal(dt) {
    const c = s.cal; if (!c) return;
    const inp = getInput();
    if (c.status === 'stab') {
      c.t += dt;
      const sig = inp.calibrator?.coupled && inp.calibrator?.on;
      if (!sig) c.bad = (c.bad || 0) + dt; else c.bad = 0;
      c.reading = s.splShown;
      if (c.t >= CAL_STAB_S || c.bad > 2.2) {
        const Lin = inp.L;
        if (!sig) return calFail('Sinal instavel');
        if (Math.abs(Lin - c.level) > CAL_MAX_DIFF) return calFail('Verifique calibrador');
        const now = { clock: s.clock, date: `${pad2(s.date.d)}/${pad2(s.date.m)}`, time: hhmm(nowClock()) };
        if (c.kind === 'pre' || c.kind === 'menu') {
          const before = round1(measured(Lin, false));
          s.calOffset = c.level - (Lin + s.sensError);
          const rec = { kind: c.kind, level: c.level, before, reading: round1(measured(Lin, false)), offset: s.calOffset, ...now };
          s.lastCal = rec; if (c.kind === 'pre') s.preCal = rec;
          E = Math.pow(10, measured(Lin, false) / 10);
          c.reading = rec.reading; emit('calibrated', rec);
        } else {
          // pós-calibração: o aparelho mede o calibrador com a deriva acumulada da jornada
          const reading = round1(Lin + s.sensError + s.calOffset + (inp.calDrift || 0));
          const rec = { kind: c.kind, level: c.level, reading, diff: round1(reading - c.level), ...now };
          c.reading = reading;
          if (c.kind === 'post') s.postCal = rec;
          else if (c.rec) c.rec.postCal = rec;
        }
        c.status = 'ok'; c.hold = 0; c.msg = 'Calibrado'; beep('ok'); change();
      } else if (Math.floor(c.t * 4) !== Math.floor((c.t - dt) * 4)) bump();
    } else {
      c.hold += dt;
      if (c.hold >= (c.status === 'ok' ? 1.6 : 2.6)) {
        if (c.status === 'fail') { s.cal = null; change(); return; }        // volta às opções (popup) / página
        if (c.kind === 'pre') { s.popup = null; s.cal = null; startCountdown(); }
        else if (c.kind === 'post') finishPost();
        else if (c.kind === 'regpost') { s.popup = null; s.cal = null; change(); emit('postcal', c.rec?.postCal); }
        // 'menu': fica mostrando o resultado até ☰
      }
    }
  }
  function calFail(msg) { const c = s.cal; c.status = 'fail'; c.msg = msg; c.hold = 0; beep('error'); change(); }
  const round1 = (v) => Math.round(v * 10) / 10;

  // ── teclas ──
  function press(key, holdMs = 0) {
    const long = holdMs >= LONG_MS;
    s.idleReal = 0;
    if (s.power === 'off') { if (key === 'power' && long) boot(); return; }
    if (s.power === 'boot') return;
    if (s.displayOff) { s.displayOff = false; change(); return; }        // 1ª tecla só acende o visor
    if (key === 'power+menu') {
      if (!long) return;
      s.locked = !s.locked; say(tr(s.locked ? 'Teclado bloqueado' : 'Teclado liberado', settings.lang), 1.5); beep('long'); change(); return;
    }
    if (s.locked) { say(tr('Teclado bloqueado', settings.lang), 1.5); beep('error'); return; }
    if (s.cal && s.cal.status !== 'ok' && !(s.cal.kind === 'menu')) { if (s.cal.status === 'stab') beep('error'); return; }
    if (key === 'power') { if (long) powerOff(); return; }
    beep(long ? 'long' : 'key');
    if (s.popup) return popupKey(key, long);
    if (s.menuPath.length) return menuKey(key, long);
    mainKey(key, long);
  }
  function mainKey(key, long) {
    if (!long) {
      if (key === 'play') s.screen = (s.screen + 1) % 6;
      else if (key === 'stop') s.screen = (s.screen + 5) % 6;
      return change();
    }
    if (key === 'play') {
      if (s.mode === 'idle' || s.mode === 'stopped') openPrecal();
      else if (s.mode === 'run') { s.mode = 'pause'; setPause(true, 'manual'); }
      else if (s.mode === 'pause') { s.mode = 'run'; setPause(false, 'manual'); }
    } else if (key === 'stop') {
      if (s.mode === 'run' || s.mode === 'pause') stopRun('manual');
      else if (s.mode === 'countdown') { s.mode = 'idle'; s.countdown = 0; say(tr('Cancelado', settings.lang)); change(); }
    } else if (key === 'menu') {
      if (recording()) { say(tr('Dosimetria em curso', settings.lang)); beep('error'); return; }
      s.menuPath = ['main']; s.menuSel.main = 0; change();
    }
  }
  function popupKey(key, long) {
    const p = s.popup; if (long) return;
    if (s.cal) return; // calibrando: teclas ignoradas
    if (key === 'play') p.sel = (p.sel + 2) % 3;
    else if (key === 'stop') p.sel = (p.sel + 1) % 3;
    else if (key === 'menu') {
      const level = [null, 94, 114][p.sel];
      if (p.type === 'precal') {
        if (level == null) { s.preCal = { kind: 'pre', skipped: true, usedLast: { ...s.lastCal }, clock: s.clock }; s.popup = null; startCountdown(); return; }
        startCal('pre', level);
      } else if (p.type === 'postcal') {
        if (level == null) { s.postCal = { kind: 'post', skipped: true, clock: s.clock }; finishPost(); return; }
        startCal('post', level);
      } else if (p.type === 'regpostcal') {
        if (level == null) { s.popup = null; return change(); }
        startCal('regpost', level, { rec: p.rec });
      }
      return;
    }
    change();
  }
  function openPage(key) {
    const P = PAGES[key]; const pg = { key, sel: 0, field: 0, values: null, level: 114 };
    if (P.type === 'options') pg.sel = Math.max(0, P.get(settings));
    else if (P.type === 'number') pg.sel = Math.max(0, P.values.indexOf(P.get(settings)));
    else if (P.type === 'fields') {
      if (key === 'datahora') { const t = nowClock(); pg.values = { d: s.date.d, m: s.date.m, h: Math.floor(t / 3600) % 24, mi: Math.floor(t / 60) % 60 }; }
      else pg.values = P.load(settings);
    } else if (P.type === 'records') pg.sel = 0;
    s.menuPath.push(key); s.page = pg; change();
  }
  function closePage() { s.menuPath.pop(); s.page = null; if (s.cal?.kind === 'menu') s.cal = null; change(); }
  function menuKey(key, long) {
    const top = s.menuPath[s.menuPath.length - 1];
    if (long && key === 'menu') { s.menuPath = []; s.page = null; s.cal = null; return change(); }
    if (long) return;
    const M = MENUS[top];
    if (M) {
      const n = M.items.length; let sel = s.menuSel[top] || 0;
      if (key === 'play') sel = (sel + n - 1) % n;
      else if (key === 'stop') sel = (sel + 1) % n;
      else if (key === 'menu') {
        const target = M.items[sel][1];
        if (!target) { s.menuPath.pop(); return change(); }
        if (MENUS[target]) { s.menuPath.push(target); s.menuSel[target] = 0; return change(); }
        return openPage(target);
      }
      s.menuSel[top] = sel; return change();
    }
    pageKey(PAGES[top], s.page, key);
  }
  function pageKey(P, pg, key) {
    if (P.type === 'info') return closePage();
    if (P.type === 'options') {
      const n = P.options.length;
      if (key === 'play') pg.sel = (pg.sel + n - 1) % n;
      else if (key === 'stop') pg.sel = (pg.sel + 1) % n;
      else {
        if (P.confirm) { if (pg.sel === 1) { s.records = []; say(tr('Registros apagados', settings.lang)); beep('ok'); } }
        else { P.set(settings, pg.sel); say(tr('Salvo', settings.lang), 1); }
        return closePage();
      }
      return change();
    }
    if (P.type === 'number') {
      const n = P.values.length;
      if (key === 'play') pg.sel = Math.min(n - 1, pg.sel + 1);
      else if (key === 'stop') pg.sel = Math.max(0, pg.sel - 1);
      else { P.set(settings, P.values[pg.sel]); say(tr('Salvo', settings.lang), 1); return closePage(); }
      return change();
    }
    if (P.type === 'fields') {
      const [k, mn, mx, st] = P.fields[pg.field];
      if (key === 'play') pg.values[k] = pg.values[k] + st > mx ? mn : pg.values[k] + st;
      else if (key === 'stop') pg.values[k] = pg.values[k] - st < mn ? mx - ((mx - mn) % st) : pg.values[k] - st;
      else {
        pg.field++;
        if (pg.field >= P.fields.length) {
          if (pg.key === 'datahora') {
            const v = pg.values; s.date = { d: v.d, m: v.m };
            const want = v.h * 3600 + v.mi * 60, cur = Math.floor(s.clock) % 86400;
            s.clockOffset = want - (cur - (cur % 60));
          } else P.save(settings, pg.values);
          say(tr('Salvo', settings.lang), 1); return closePage();
        }
      }
      return change();
    }
    if (P.type === 'records') {
      const n = s.records.length + 1; // + Voltar
      if (key === 'play') pg.sel = (pg.sel + n - 1) % n;
      else if (key === 'stop') pg.sel = (pg.sel + 1) % n;
      else {
        if (pg.sel >= s.records.length) return closePage();
        const rec = s.records[s.records.length - 1 - pg.sel];
        if (rec.running) { beep('error'); return; }
        s.popup = { type: 'regpostcal', sel: 0, rec };
      }
      return change();
    }
    if (P.type === 'calibrar') {
      if (s.cal && s.cal.kind === 'menu') {
        if (s.cal.status === 'stab') return;
        if (key === 'menu') return closePage();
        s.cal = null; return change();
      }
      if (key === 'play') pg.level = 114;
      else if (key === 'stop') pg.level = 94;
      else return startCal('menu', pg.level);
      return change();
    }
  }

  // ── integração (passos de tempo simulado) ──
  function inDevicePause(clock) {
    if (!settings.pauseOn || settings.pauseEnd <= settings.pauseStart) return false;
    const m = ((clock + s.clockOffset) % 86400) / 60;
    return m >= settings.pauseStart && m < settings.pauseEnd;
  }
  function feed(L, dt, clock) {
    if (clock != null) setClock(clock);
    const run = s.run;
    if (!run || !(dt > 0)) return;
    if (s.mode !== 'run') return;
    run.simT += dt;
    s.battery = Math.max(0, s.battery - (dt * 100) / (BATTERY_H * 3600));
    if (!run.autoLocked && run.simT >= AUTOLOCK_S) autoLock();
    const paused = L == null || inDevicePause(s.clock);
    if (paused) { if (!s.progPause) { s.progPause = true; setPause(true, 'prog'); } return; }
    if (s.progPause) { s.progPause = false; setPause(false, 'prog'); }
    const Lm = measured(L);
    run.its.NHO01.add(Lm, dt); run.its.NR15.add(Lm, dt);
    const spec = getInput().spectrum;
    run.its.USER.add(toWeighting(Lm, run.userCrit.weighting, spec), dt);
    // gráfico de nível: 1 ponto por minuto medido (média energética)
    run.g.e += Math.pow(10, Lm / 10) * dt; run.g.n += dt;
    if (run.g.n >= 60) { pushHist(10 * Math.log10(run.g.e / run.g.n)); run.g.e = 0; run.g.n = 0; }
    run.rec.durationMin = run.its.NHO01.time / 60;
    if (run.its.NHO01.time >= settings.durationMin * 60) { say(tr('Fim da duracao', settings.lang)); stopRun('duracao'); return; }
    bump();
  }
  function pushHist(v) { s.history.push(v); if (s.history.length > 100) s.history.shift(); }
  function autoLock() { s.run.autoLocked = true; if (!s.locked) { s.locked = true; change(); } }
  function setClock(sec) {
    s.clock = sec; const m = Math.floor((sec + s.clockOffset) / 60);
    if (m !== lastMin) { lastMin = m; bump(); }
  }

  // ── atualização em tempo real (visor, LED, temporizadores) ──
  function update(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.25);
    if (s.power === 'off') { if (s.led !== 'off') { s.led = 'off'; bump(); } return; }
    if (s.power === 'boot') {
      s.bootT += dt;
      if (s.bootT >= BOOT_S) { s.power = 'on'; s.mode = s.run && s.mode !== 'idle' ? s.mode : 'idle'; s.screen = 0; s.led = 'off'; change(); }
      return;
    }
    const inp = getInput();
    // resposta temporal (S τ = 1 s, F τ = 0,125 s) sobre a energia
    const tau = settings.user.response === 'F' ? 0.125 : 1;
    let Lin = measured(inp.L, s.mode === 'run' || s.mode === 'pause');
    Lin = toWeighting(Lin, settings.user.weighting, inp.spectrum);
    const a = 1 - Math.exp(-dt / tau);
    E += (Math.pow(10, Lin / 10) - E) * a;
    s.spl = 10 * Math.log10(Math.max(E, 1e-3));
    shownT += dt;
    if (shownT >= 0.5) { // visor atualiza o número 2×/s
      shownT = 0;
      const v = Math.min(RANGE[1], s.spl);
      s.over = s.spl > RANGE[1] ? 1 : s.spl < RANGE[0] ? -1 : 0;
      s.warn = s.spl >= settings.user.CR || (s.run?.its.NHO01.dose ?? 0) >= 100;
      s.splShown = round1(v);
      if (inp.spectrum) {
        const W = settings.user.weighting, off = s.sensError + s.calOffset;
        const wt = W === 'A' ? [-26.2, -16.1, -8.6, -3.2, 0, 1.2, 1.0, -1.1] : W === 'C' ? [-0.8, -0.2, 0, 0, 0, -0.2, -0.8, -3.0] : [0, 0, 0, 0, 0, 0, 0, 0];
        s.spectrumShown = inp.spectrum.map((l, i) => l + wt[i] + off);
      } else if (inp.calibrator?.coupled && inp.calibrator?.on) s.spectrumShown = OCTAVES.map((f) => (f === 1000 ? s.splShown : 25));
      else s.spectrumShown = null;
      bump();
    }
    // gráfico de nível fora da dosimetria: 1 ponto a cada 0,5 s
    if (!(s.mode === 'run' || s.mode === 'pause')) { histT += dt; if (histT >= 0.5) { histT = 0; pushHist(s.spl); } }
    // bateria (tempo real fora da dosimetria; durante a dosimetria o feed desconta o tempo simulado)
    if (s.mode !== 'run') s.battery = Math.max(0, s.battery - (dt * 100) / (BATTERY_H * 3600));
    // calibração
    if (s.cal) updateCal(dt);
    // contagem regressiva de 20 s (indicador vermelho piscando)
    if (s.mode === 'countdown') {
      const before = Math.ceil(s.countdown * 4); s.countdown -= dt;
      if (Math.ceil(s.countdown * 4) !== before) bump();
      if (s.countdown <= 0) beginRun();
    }
    // bloqueio automático 60 s após o início (tempo real ou simulado, o que vier primeiro)
    if (s.run && (s.mode === 'run' || s.mode === 'pause')) { s.run.realT += dt; if (!s.run.autoLocked && s.run.realT >= AUTOLOCK_S) autoLock(); }
    // mensagens temporárias
    if (s.msg) { s.msg.t -= dt; if (s.msg.t <= 0) { s.msg = null; bump(); } }
    // desligamento automático do visor (Sistema › Tela)
    s.idleReal += dt;
    if (!s.displayOff && s.idleReal > settings.screenOff * 60 && !s.cal && !s.popup) { s.displayOff = true; change(); }
    // LED
    const prevBlink = Math.floor(s.blinkT * 4); s.blinkT += dt;
    let led = 'off';
    if (s.mode === 'countdown') led = (s.blinkT * 2.5) % 1 < 0.5 ? 'red' : 'off';
    else if (s.mode === 'run') led = s.progPause ? 'yellow' : (s.blinkT % 1.5) < 0.18 ? 'red' : 'off';
    else if (s.mode === 'pause') led = 'yellow';
    else if (s.mode === 'stopped') led = s.popup || s.cal ? 'off' : 'blue';
    if (led !== s.led) { s.led = led; }
    if (Math.floor(s.blinkT * 4) !== prevBlink && (s.mode === 'countdown' || s.mode === 'run')) bump();
  }

  // ── resultados ──
  function snapshots(run) {
    if (!run) return { NHO01: null, NR15: null, USER: null };
    return { NHO01: run.its.NHO01.snapshot(), NR15: run.its.NR15.snapshot(), USER: { ...run.its.USER.snapshot(), criterion: run.userCrit } };
  }
  function results() {
    const run = s.run; const sn = snapshots(run);
    const pre = run?.preCal ?? s.preCal;
    const preRef = pre?.skipped ? pre.usedLast : pre;
    const post = run?.postCal ?? (run ? null : s.postCal);
    const calCheck = post && !post.skipped && preRef ? calibrationCheck(preRef.reading, post.reading) : null;
    let valid = null, reason = '';
    if (run && s.mode === 'stopped' && !s.popup && !s.cal) {
      if (!calCheck) { valid = false; reason = 'Sem pós-calibração (NHO-01 exige aferição antes e depois)'; }
      else { valid = calCheck.ok; reason = calCheck.ok ? 'Aferição dentro de ±1 dB' : `Aferição variou ${calCheck.diff.toFixed(1)} dB (> ±1 dB) — invalidar (NHO-01)`; }
    }
    return {
      ...sn, preCal: pre ?? null, postCal: post ?? null, calCheck, usedLastCal: !!pre?.skipped,
      start: run?.startClock ?? null, stop: run?.stopClock ?? null, pauses: run ? run.pauses.map((p) => ({ ...p })) : [],
      measuredSec: run ? run.its.NHO01.time : 0, record: run?.n ?? null, mode: s.mode, valid, validReason: reason,
      stopReason: run?.stopReason ?? null, settings: { ...settings, user: { ...settings.user } },
    };
  }

  function quickStart() {
    s.power = 'on'; s.bootT = BOOT_S; s.menuPath = []; s.page = null; s.popup = null; s.cal = null; s.msg = null; s.displayOff = false;
    s.calOffset = -s.sensError;
    const rec = { kind: 'pre', level: 114, before: round1(114 + s.sensError), reading: 114, offset: s.calOffset, clock: s.clock,
      date: `${pad2(s.date.d)}/${pad2(s.date.m)}`, time: hhmm(nowClock()), quick: true };
    s.lastCal = rec; s.preCal = rec;
    E = Math.pow(10, measured(getInput().L, false) / 10);
    emit('calibrated', rec);
    beginRun();
  }

  return {
    state: s, settings, press, update, feed, setClock, quickStart, results,
    on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => (listeners[ev] = listeners[ev].filter((f) => f !== fn)); },
    // auxiliares para o visor/testes
    measuredTime: () => (s.run ? s.run.its.NHO01.time : 0),
    memPercent: () => Math.round((s.records.reduce((a, r) => a + Math.min(RECORD_MIN, r.durationMin || 0), 0) / (MAX_RECORDS * RECORD_MIN)) * 100),
    clockShown: nowClock,
    live: () => snapshots(s.run),
    tr: (t) => tr(t, settings.lang),
  };
}
