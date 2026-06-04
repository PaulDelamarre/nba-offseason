// Logique draft : salaire rookie scale d'un choix, pool de prospects, et
// moteur de SIMULATION (déroulé pick par pick, équipe par équipe).
import { ROOKIE_SCALE_2026, PROSPECTS_2026, DRAFT_ORDER_2026 } from '../constants/draft.js';
import { minSalary } from './contracts.js';

export const PROSPECT_BY_RANK = Object.fromEntries(PROSPECTS_2026.map((p) => [p.rank, p]));
export const TEAM_AT_PICK = Object.fromEntries(DRAFT_ORDER_2026.map((d) => [d.pick, d.team]));
export const LAST_PICK = DRAFT_ORDER_2026.length; // 60

// Salaire année 1 d'un choix selon le SLOT (1er tour = rookie scale, 2e tour
// = minimum recrue).
export function rookieSalary(pickSlot, year = '2026-27') {
  if (pickSlot >= 1 && pickSlot <= 30) return ROOKIE_SCALE_2026[pickSlot];
  return minSalary(0, year);
}

// Équipe qui pioche au slot `pick`. `owners` = override d'ownership (issu des
// trades de picks appliqués) ; sinon l'ordre réel par défaut.
export function teamAt(pick, owners) { return (owners && owners[pick]) || TEAM_AT_PICK[pick] || null; }

export function prospectPosGroup(pos) {
  const p = (pos || '').split('/')[0].trim();
  if (p === 'PG' || p === 'SG' || p === 'G') return 'G';
  if (p === 'SF' || p === 'PF' || p === 'F') return 'F';
  if (p === 'C') return 'C';
  return p || '?';
}

// --- Moteur de simulation -----------------------------------------------------
// `picks` = map { [pickNum]: prospectRank } des sélections déjà faites.

// Prochain choix non encore effectué (ou null si draft terminée).
export function nextPick(picks) {
  for (let i = 1; i <= LAST_PICK; i++) if (picks[i] == null) return i;
  return null;
}

export function takenRanks(picks) {
  return new Set(Object.values(picks));
}

// Meilleur prospect encore disponible (plus petit rang non pris).
export function bestAvailable(picks) {
  const taken = takenRanks(picks);
  for (const p of PROSPECTS_2026) if (!taken.has(p.rank)) return p.rank;
  return null;
}

// Auto-pick d'un seul choix (le prochain) : meilleur disponible.
export function autoOne(picks) {
  const np = nextPick(picks);
  if (np == null) return picks;
  const ba = bestAvailable(picks);
  if (ba == null) return picks;
  return { ...picks, [np]: ba };
}

// Simule (auto-pick CPU = meilleur disponible) jusqu'à ce que ce soit au tour
// de `stopTeam` de choisir, ou jusqu'à la fin de la draft.
export function simulate(picks, stopTeam, owners) {
  let cur = { ...picks };
  let guard = 0;
  while (guard++ < LAST_PICK + 1) {
    const np = nextPick(cur);
    if (np == null) break;                       // draft terminée
    if (teamAt(np, owners) === stopTeam) break;   // à toi de jouer
    cur = autoOne(cur);
  }
  return cur;
}

// Sélections faites par une équipe : [{ pick, rank, salary }].
export function picksOfTeam(picks, team, year = '2026-27', owners) {
  const out = [];
  for (const [pickStr, rank] of Object.entries(picks)) {
    const pick = Number(pickStr);
    if (teamAt(pick, owners) === team) out.push({ pick, rank, salary: rookieSalary(pick, year) });
  }
  return out.sort((a, b) => a.pick - b.pick);
}
