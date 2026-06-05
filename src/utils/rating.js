// Note joueur 0-100 par percentile, calculée par groupe de poste (G/F/C),
// pondérée par des poids spécifiques au poste, puis atténuée par les minutes
// jouées (faible échantillon → tirée vers le niveau « remplaçant »).
// Esprit identique à la note de FootMercato, adapté au basket.
import { num } from './format.js';

// Stat -> poids par groupe (1 mineur … 5 cœur du rôle) + inverse éventuel.
// Les métriques avancées (BPM, VORP, WS, PER, TS%) portent la valeur globale ;
// les stats par match dessinent le rôle.
const STAT_DEFS = {
  bpm: { w: { G: 5, F: 5, C: 5 } },
  vorp: { w: { G: 4, F: 4, C: 4 } },
  ws: { w: { G: 3, F: 3, C: 3 } },
  per: { w: { G: 3, F: 3, C: 3 } },
  pts: { w: { G: 4, F: 4, C: 3 } },
  tsPct: { w: { G: 3, F: 3, C: 3 } },
  ast: { w: { G: 4, F: 2, C: 1 } },
  trb: { w: { G: 1, F: 3, C: 4 } },
  stl: { w: { G: 3, F: 2, C: 1 } },
  blk: { w: { G: 1, F: 2, C: 4 } },
  tov: { w: { G: 2, F: 2, C: 1 }, inverse: true },
};

const groupOf = (p) => (['G', 'F', 'C'].includes(p.posGroup) ? p.posGroup : 'F');
const statVal = (p, stat) => {
  const v = p.stats?.[stat];
  return v == null || v === '' ? null : num(v);
};
const totalMinutes = (p) => num(p.stats?.g) * num(p.stats?.mpg);
export const isEligible = (p) => !!p.stats && num(p.stats.g) >= 20 && totalMinutes(p) >= 500;

// fraction de valeurs <= v dans un tableau trié croissant (0..1)
function percentile(sorted, v) {
  if (!sorted.length) return 0.5;
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= v) lo = mid + 1; else hi = mid; }
  return lo / sorted.length;
}

// Atténuation par les minutes : confiance 0.2 (≤300 min) → 1.0 (≥1500 min).
function confidence(min) {
  if (min >= 1500) return 1;
  if (min <= 300) return 0.2;
  return 0.2 + 0.8 * ((min - 300) / 1200);
}
const SHRINK_TARGET = 40; // niveau « remplaçant »

// Calcule p.rating (0-100) pour tous les joueurs. Mute et renvoie le tableau.
export function attachRatings(players) {
  const pool = { G: [], F: [], C: [] };
  for (const p of players) if (isEligible(p)) pool[groupOf(p)].push(p);

  // tableaux triés par (groupe, stat) pour les percentiles
  const sorted = {};
  for (const g of ['G', 'F', 'C']) {
    sorted[g] = {};
    for (const stat of Object.keys(STAT_DEFS)) {
      sorted[g][stat] = pool[g].map((p) => statVal(p, stat)).filter((v) => v != null).sort((a, b) => a - b);
    }
  }

  // Note de TOUS les joueurs. Les non-éligibles (peu de minutes) sont notés
  // contre la distribution des éligibles MAIS fortement atténués vers 40 par la
  // confiance (≤0.2 sous 300 min) : volontaire — un rôle player blessé affiche
  // ~35-45 plutôt qu'un 0 trompeur.
  for (const p of players) {
    p.rating = ratePlayer(p, sorted);
    p.archetype = assignArchetype(p);
  }
  return players;
}

// Archétype tactique (heuristique par groupe de poste sur le profil de stats).
export function assignArchetype(p) {
  const s = p.stats;
  if (!s) return null;
  const g = groupOf(p);
  const pts = num(s.pts), ast = num(s.ast), trb = num(s.trb), blk = num(s.blk),
    stl = num(s.stl), fg3a = num(s.fg3a), usg = num(s.usgPct);
  if (g === 'G') {
    if (ast >= 6) return 'Meneur créateur';
    if (fg3a >= 5 && stl >= 1.2 && usg < 0.22) return '3&D';
    if (pts >= 18) return 'Arrière scoreur';
    return 'Combo guard';
  }
  if (g === 'F') {
    if (pts >= 20 || usg >= 0.26) return 'Ailier scoreur';
    if (fg3a >= 4 && trb >= 6) return 'Ailier-fort stretch';
    if (fg3a >= 3.5 && stl >= 0.9) return '3&D ailier';
    if (trb >= 7) return 'Ailier rebondeur';
    return 'Ailier polyvalent';
  }
  if (blk >= 1.3) return 'Pivot protecteur';
  if (fg3a >= 2) return 'Pivot stretch';
  return 'Pivot intérieur';
}

function ratePlayer(p, sorted) {
  if (!p.stats) return 0;
  const g = groupOf(p);
  let wsum = 0, acc = 0;
  for (const [stat, def] of Object.entries(STAT_DEFS)) {
    const v = statVal(p, stat);
    if (v == null) continue;
    const w = def.w[g] || 0;
    if (!w) continue;
    let pc = percentile(sorted[g][stat], v);
    if (def.inverse) pc = 1 - pc;
    acc += pc * 100 * w;
    wsum += w;
  }
  if (!wsum) return 0;
  const raw = acc / wsum;
  const conf = confidence(totalMinutes(p));
  const final = raw * conf + SHRINK_TARGET * (1 - conf);
  return Math.max(0, Math.min(99, Math.round(final)));
}
