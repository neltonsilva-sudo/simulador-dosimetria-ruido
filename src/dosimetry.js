// Núcleo normativo de dosimetria de ruído — dono: ORQUESTRADOR. Puro (sem THREE). Testes: node tools/dosi_test.mjs
// NHO-01 (Fundacentro, 2001): CR 85 dB(A), q = 3, NLI 80 dB(A), resposta lenta, nível de ação dose 50% / NEN 82, teto 115.
// NR-15 Anexo 1: 85 dB(A) / 8 h, q = 5 (Quadro do Anexo 1), limiar 80 dB(A), circuito A, resposta lenta, teto 115 dB(A).
// USER: norma editável do DoseMax (Ajustes: P. Frequência A/C/Z, P. Temporal F/S, limiar 60–90, critério 80–90, q 3/4/5).

export const CRITERIA = {
  NHO01: { id: 'NHO01', label: 'NHO 01', CR: 85, q: 3, TL: 80, Tc: 8, weighting: 'A', response: 'S', actionDose: 50, actionLevel: 82 },
  NR15: { id: 'NR15', label: 'NR-15', CR: 85, q: 5, TL: 80, Tc: 8, weighting: 'A', response: 'S', actionDose: 50, actionLevel: 80 },
  USER: { id: 'USER', label: 'USER', CR: 85, q: 3, TL: 80, Tc: 8, weighting: 'A', response: 'S', actionDose: 50, actionLevel: 82 },
};
export const CEILING_DBA = 115; // LE-VT / NR-15 item 5 e 7: risco grave e iminente sem proteção
export const CAL_TOLERANCE_DB = 1; // NHO-01 6.3: invalida se a aferição variar fora de ±1 dB

// Quadro do Anexo 1 da NR-15 (nível dB(A) → minutos)
export const NR15_TABLE = [
  [85, 480], [86, 420], [87, 360], [88, 300], [89, 270], [90, 240], [91, 210], [92, 180], [93, 160], [94, 135], [95, 120],
  [96, 105], [98, 75], [100, 60], [102, 45], [104, 35], [105, 30], [106, 25], [108, 20], [110, 15], [112, 10], [114, 8], [115, 7],
];
/** NR-15 item 4: nível intermediário → máxima exposição do nível imediatamente mais elevado. Retorna minutos (Infinity < 85). */
export function nr15AllowedMinutes(L) {
  if (L < 85) return Infinity;
  if (L > 115) return 0;
  for (const [l, t] of NR15_TABLE) if (l >= L - 1e-9) return t;
  return 0;
}
/** Tempo máximo diário (min) pela fórmula contínua: Tc·60 / 2^((L−CR)/q). NHO-01 Tabela 1: 80 dB → 1523,90 min. */
export function allowedMinutes(L, c = CRITERIA.NHO01) { return (c.Tc * 60) / Math.pow(2, (L - c.CR) / c.q); }
/** Dose por fases (NR-15 item 6 / NHO-01 5.1.1.2): Σ Cn/Tn × 100 (%). phases = [{L, min}]; método NR-15 usa o Quadro. */
export function phaseDose(phases, c = CRITERIA.NHO01, { table = false } = {}) {
  let d = 0;
  for (const p of phases) {
    if (p.L < c.TL) continue;
    const T = table && c.id === 'NR15' ? nr15AllowedMinutes(p.L) : allowedMinutes(p.L, c);
    d += T === 0 ? Infinity : p.min / T;
  }
  return d * 100;
}
/** Nível médio (Lavg / NE) a partir da dose D (%) medida em T horas: CR + q/log10(2)·log10(D/100 · Tc/T). */
export function lavgFromDose(D, Th, c) { return D <= 0 ? -Infinity : c.CR + (c.q / Math.log10(2)) * Math.log10((D / 100) * (c.Tc / Th)); }
/** NEN = NE + 10·log10(TE/480) (NHO-01 5.1.2). */
export function nen(NE, TEmin) { return NE + 10 * Math.log10(TEmin / 480); }
/** TWA (8 h) = CR + q/log10(2)·log10(D8h/100). */
export function twaFromDose(D8, c) { return D8 <= 0 ? -Infinity : c.CR + (c.q / Math.log10(2)) * Math.log10(D8 / 100); }

/**
 * Integrador de um critério (como o DoseMax faz em paralelo para NHO01, NR15 e USER).
 * add(L, dt): L = nível ponderado (A, slow) no intervalo, dt em segundos.
 */
export function createIntegrator(c) {
  const k = Math.log10(2) / c.q;
  let doseFrac = 0, t = 0, eSum = 0, lmax = -Infinity, overCeil = 0;
  return {
    criterion: c,
    add(L, dt) {
      if (!(dt > 0) || !isFinite(L)) return;
      t += dt; eSum += Math.pow(10, L / 10) * dt; if (L > lmax) lmax = L;
      if (L > CEILING_DBA) overCeil += dt;
      if (L >= c.TL) doseFrac += (dt / (c.Tc * 3600)) * Math.pow(10, (L - c.CR) * k);
    },
    get time() { return t; },
    get dose() { return doseFrac * 100; },                     // % no tempo medido
    get lavg() { return t > 0 ? lavgFromDose(doseFrac * 100, t / 3600, c) : -Infinity; }, // Lavg (q=3 → NE / LAeq c/ limiar)
    get laeq() { return t > 0 ? 10 * Math.log10(eSum / t) : -Infinity; },   // sem limiar
    get lmax() { return lmax; },
    get overCeilingSec() { return overCeil; },
    projectedDose(Tjmin = c.Tc * 60) { return t > 0 ? doseFrac * 100 * (Tjmin * 60) / t : 0; },
    twa() { return twaFromDose(doseFrac * 100 * (c.Tc * 3600) / Math.max(t, 1e-9), c); },
    snapshot() {
      const D = doseFrac * 100, Th = t / 3600, NE = this.lavg;
      return { id: c.id, label: c.label, time: t, dose: D, lavg: NE, laeq: this.laeq, lmax, projected: this.projectedDose(),
        twa: this.twa(), nen: c.q === 3 ? nen(NE, Math.max(t, 1) / 60) : null, overCeilingSec: overCeil, hours: Th };
    },
    reset() { doseFrac = 0; t = 0; eSum = 0; lmax = -Infinity; overCeil = 0; },
  };
}

/** Classificação didática do resultado (dose projetada para a jornada). */
export function verdict(snap, c = CRITERIA[snap.id] || CRITERIA.NHO01) {
  const D = snap.projected;
  if (snap.overCeilingSec > 0) return { key: 'teto', label: `Acima de ${CEILING_DBA} dB(A) — risco grave e iminente`, color: '#d4202c' };
  if (D > 100) return { key: 'acima', label: 'Acima do limite de exposição (dose > 100%)', color: '#e5484d' };
  if (D >= c.actionDose) return { key: 'acao', label: 'Acima do nível de ação (dose ≥ 50%)', color: '#f5a524' };
  return { key: 'ok', label: 'Abaixo do nível de ação', color: '#30a46c' };
}

/** Verificação de calibração NHO-01: |pós − pré| ≤ 1 dB. */
export function calibrationCheck(pre, post) {
  const d = post - pre;
  return { pre, post, diff: d, ok: Math.abs(d) <= CAL_TOLERANCE_DB };
}

// ── ponderação em frequência (IEC 61672) nas bandas de oitava do DoseMax ──
export const OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
export const A_WEIGHT = [-26.2, -16.1, -8.6, -3.2, 0, 1.2, 1.0, -1.1];
export const C_WEIGHT = [-0.8, -0.2, 0, 0, 0, -0.2, -0.8, -3.0];
export function sumDb(levels) { let s = 0; for (const l of levels) if (isFinite(l)) s += Math.pow(10, l / 10); return s > 0 ? 10 * Math.log10(s) : -Infinity; }
export function weighted(spectrumZ, w = 'A') { const W = w === 'A' ? A_WEIGHT : w === 'C' ? C_WEIGHT : OCTAVES.map(() => 0); return sumDb(spectrumZ.map((l, i) => l + W[i])); }
