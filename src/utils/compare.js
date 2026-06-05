// Percentiles pour le comparateur (radar). Comparaison directe ligue entière
// (joueurs éligibles), pour que les deux joueurs soient mesurés à la même aune.
import { num } from './format.js';
import { isEligible } from './rating.js';

export const RADAR = [
  { key: 'pts', label: 'Scoring', get: (s) => num(s.pts) },
  { key: 'trb', label: 'Rebond', get: (s) => num(s.trb) },
  { key: 'ast', label: 'Passe', get: (s) => num(s.ast) },
  { key: 'def', label: 'Défense', get: (s) => num(s.stl) + num(s.blk) },
  { key: 'ts', label: 'Efficacité', get: (s) => num(s.tsPct) },
  { key: 'bpm', label: 'Impact', get: (s) => num(s.bpm) },
];

// Tableau de stats comparées (valeur brute + sens « plus haut = mieux »).
export const COMPARE_STATS = [
  { key: 'pts', label: 'Points', fmt: (v) => v?.toFixed(1) },
  { key: 'trb', label: 'Rebonds', fmt: (v) => v?.toFixed(1) },
  { key: 'ast', label: 'Passes', fmt: (v) => v?.toFixed(1) },
  { key: 'stl', label: 'Interceptions', fmt: (v) => v?.toFixed(1) },
  { key: 'blk', label: 'Contres', fmt: (v) => v?.toFixed(1) },
  { key: 'fg3Pct', label: '3 pts %', fmt: (v) => (v != null ? `${(v * 100).toFixed(1)}%` : '—') },
  { key: 'tsPct', label: 'True Shooting %', fmt: (v) => (v != null ? `${(v * 100).toFixed(1)}%` : '—') },
  { key: 'usgPct', label: 'Usage %', fmt: (v) => (v != null ? `${(v * 100).toFixed(1)}%` : '—') },
  { key: 'per', label: 'PER', fmt: (v) => v?.toFixed(1) },
  { key: 'bpm', label: 'BPM', fmt: (v) => v?.toFixed(1) },
  { key: 'ws', label: 'Win Shares', fmt: (v) => v?.toFixed(1) },
  { key: 'vorp', label: 'VORP', fmt: (v) => v?.toFixed(1) },
];

export function buildPools(players) {
  const pool = players.filter((p) => p.stats && isEligible(p));
  const pools = {};
  for (const r of RADAR) {
    pools[r.key] = pool.map((p) => r.get(p.stats)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  }
  return pools;
}

function pct(sorted, v) {
  if (!sorted || !sorted.length) return 0.5;
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= v) lo = m + 1; else hi = m; }
  return lo / sorted.length;
}

export function playerRadar(player, pools) {
  if (!player?.stats) return RADAR.map((r) => ({ key: r.key, label: r.label, pct: 0 }));
  return RADAR.map((r) => ({ key: r.key, label: r.label, pct: pct(pools[r.key], r.get(player.stats)) }));
}

// Joueurs au profil similaire (même groupe de poste), distance sur le vecteur
// de percentiles. Renvoie [{ player, sim }] trié, top n.
export function findSimilar(target, players, n = 8) {
  if (!target?.stats) return [];
  const pools = buildPools(players);
  const tv = playerRadar(target, pools).map((r) => r.pct);
  const out = [];
  for (const p of players) {
    if (p.id === target.id || !p.stats || p.posGroup !== target.posGroup || !isEligible(p)) continue;
    const v = playerRadar(p, pools).map((r) => r.pct);
    let d = 0;
    for (let i = 0; i < v.length; i++) d += (v[i] - tv[i]) ** 2;
    out.push({ player: p, sim: Math.max(0, Math.round((1 - Math.sqrt(d / v.length)) * 100)) });
  }
  return out.sort((a, b) => b.sim - a.sim).slice(0, n);
}
