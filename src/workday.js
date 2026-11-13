// Jornada simulada da trabalhadora (dono: ORQUESTRADOR). Puro, determinístico (semente).
// Tempos em segundos desde 00:00. Medição 07:00–16:00 com pausa programada de almoço 11:00–12:00 (função
// "Horário de pausa" do DoseMax) → 8 h efetivas de medição.

export const ACTIVITIES = {
  dds:       { label: 'DDS / preparação do posto', offset: -11, var: 2.0 },
  operando:  { label: 'Operando a prensa (painel CNC)', offset: 0, var: 1.6, impacts: true },
  setup:     { label: 'Troca de ferramenta / ajuste', offset: -5, var: 3.0, impacts: true },
  cafe:      { label: 'Pausa para café (refeitório)', fixed: 66, var: 3.0 },
  limpeza:   { label: 'Limpeza e organização (5S)', offset: -8, var: 2.5 },
  almoco:    { label: 'Almoço — dosímetro em pausa', paused: true },
};

const H = (h, m = 0) => h * 3600 + m * 60;
export const DEFAULT_SCHEDULE = [
  [H(7, 0), H(7, 20), 'dds'],
  [H(7, 20), H(9, 30), 'operando'],
  [H(9, 30), H(9, 45), 'cafe'],
  [H(9, 45), H(10, 20), 'setup'],
  [H(10, 20), H(11, 0), 'operando'],
  [H(11, 0), H(12, 0), 'almoco'],
  [H(12, 0), H(14, 30), 'operando'],
  [H(14, 30), H(14, 45), 'cafe'],
  [H(14, 45), H(15, 35), 'operando'],
  [H(15, 35), H(16, 0), 'limpeza'],
];

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Cria a jornada: pré-calcula um passeio aleatório suave (1 valor por 10 s) para a flutuação do nível. */
export function createWorkday({ seed = 1, schedule = DEFAULT_SCHEDULE } = {}) {
  const start = schedule[0][0], end = schedule[schedule.length - 1][1];
  const rnd = mulberry32(seed);
  const n = Math.ceil((end - start) / 10) + 2, walk = new Float32Array(n);
  let v = 0; for (let i = 0; i < n; i++) { v = v * 0.96 + (rnd() - 0.5) * 0.9; walk[i] = v; }
  const spikes = new Uint8Array(n); for (let i = 0; i < n; i++) spikes[i] = rnd() < 0.012 ? 1 : 0; // eventos ruidosos raros
  return { seed, schedule, start, end, walk, spikes };
}
export function activityAt(wd, t) {
  for (const [a, b, id] of wd.schedule) if (t >= a && t < b) return { id, ...ACTIVITIES[id], from: a, to: b };
  return null;
}
/**
 * Nível (dB(A), resposta lenta, Leq de 1 s) na posição do microfone no instante t da jornada.
 * fieldLevel = nível de campo no posto calculado pelo modelo acústico (acoustics.js) com as máquinas ligadas.
 * Retorna null quando o dosímetro está em pausa (almoço).
 */
export function levelOnSchedule(wd, t, fieldLevel) {
  const a = activityAt(wd, t); if (!a || a.paused) return null;
  const i = Math.max(0, Math.min(wd.walk.length - 2, Math.floor((t - wd.start) / 10)));
  const f = (t - wd.start) / 10 - i, w = wd.walk[i] * (1 - f) + wd.walk[i + 1] * f;
  let L = (a.fixed ?? fieldLevel + (a.offset || 0)) + w * a.var;
  if (a.impacts) L += 0.6 * Math.sin(t * 2 * Math.PI / 1.5) ** 8; // golpes da prensa (40 gpm) após resposta lenta
  if (wd.spikes[i] && a.id !== 'cafe') L += 6; // ar comprimido / queda de peça
  return L;
}
export const fmtClock = (t) => { const h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60, s = Math.floor(t) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
