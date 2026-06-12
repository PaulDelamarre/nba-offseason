// Modèle de propriété des choix de draft.
//
// 2026 (l'année draftée) : on utilise les VRAIS slots 1-60 de l'ordre de draft
// (DRAFT_ORDER_2026). Chaque slot a un propriétaire ; les trades de picks
// appliqués (override `owners`) changent ce propriétaire — et donc l'ordre de
// la simulation de draft.
//
// 2027 → 2031 : modèle simplifié (chaque équipe possède ses propres 1ers/2es
// tours), faute de données d'échanges réels.
import { TEAMS } from '../constants/teams.js';
import { DRAFT_ORDER_2026 } from '../constants/draft.js';

export const PICK_YEARS = [2027, 2028, 2029, 2030, 2031]; // picks futurs (baseline)
export const FIRST_FUTURE_YEAR = 2027;                     // la règle Stepien vise les drafts à venir

// --- Slots réels 2026 ---------------------------------------------------------
const DEFAULT_SLOT_OWNER = Object.fromEntries(DRAFT_ORDER_2026.map((d) => [d.pick, d.team]));
export const SLOT_PREFIX = 'S26';
export const slotPickId = (n) => `${SLOT_PREFIX}-${n}`;
export const isSlotPick = (id) => typeof id === 'string' && id.startsWith(`${SLOT_PREFIX}-`);
export const slotOf = (id) => Number(id.split('-')[1]);
export const slotRound = (n) => (n <= 30 ? 1 : 2);
export const slotOwner = (n, owners) => (owners && owners[n]) || DEFAULT_SLOT_OWNER[n];
export const slotPickLabel = (n) => `2026 #${n} (${slotRound(n) === 1 ? 'R1' : 'R2'})`;

// Slots 2026 possédés par une équipe (selon l'override d'ownership courant).
// `draftPicks` (map { slot: prospectRank }) : un slot déjà UTILISÉ reste
// échangeable en tant que DROITS DE DRAFT du joueur sélectionné (règle NBA :
// un drafté non signé s'échange via ses droits, 0 $ au matching). Le champ
// `draftedRank` indique alors le prospect concerné — l'échanger déplace le joueur.
export function ownedSlots2026(team, owners, draftPicks) {
  const out = [];
  for (let n = 1; n <= 60; n++) {
    if (slotOwner(n, owners) === team) {
      const rank = draftPicks ? draftPicks[n] : null;
      out.push({ id: slotPickId(n), slot: n, round: slotRound(n), draftedRank: rank ?? null });
    }
  }
  return out;
}

// --- Picks futurs (baseline) --------------------------------------------------
export function pickId(origTeam, year, round) { return `${origTeam}-${year}-R${round}`; }
export function parsePick(id) {
  const [origTeam, year, round] = id.split('-');
  return { origTeam, year: Number(year), round: Number(round.replace('R', '')) };
}
export function baselinePicks(teamAbbr) {
  const out = [];
  for (const year of PICK_YEARS) for (const round of [1, 2]) out.push({ id: pickId(teamAbbr, year, round), origTeam: teamAbbr, year, round });
  return out;
}
export const ALL_TEAM_PICKS = Object.fromEntries(TEAMS.map((t) => [t.abbr, baselinePicks(t.abbr)]));

// Transferts réels de picks FUTURS (2027-2031). { origTeam, year, round, owner }
// = le 1er/2e tour d'origTeam pour cette année est détenu par `owner`.
// (Vide par défaut : les sources d'ownership réel sont gated. Mécanisme prêt à
// peupler — le baseline « chaque équipe a ses propres tours » s'applique sinon.)
export const FUTURE_PICK_TRANSFERS = [];
const TRANSFER_MAP = new Map(FUTURE_PICK_TRANSFERS.map((t) => [`${t.origTeam}-${t.year}-R${t.round}`, t.owner]));
export function pickOwner(origTeam, year, round) {
  return TRANSFER_MAP.get(`${origTeam}-${year}-R${round}`) || origTeam;
}
// Propriétaire effectif d'un pick futur : override des trades exécutés en jeu
// (`futureOwners` : { pickId -> abbr }), sinon transferts réels, sinon l'équipe d'origine.
export function effectivePickOwner(origTeam, year, round, futureOwners) {
  const id = pickId(origTeam, year, round);
  return (futureOwners && futureOwners[id]) || pickOwner(origTeam, year, round);
}

// Picks futurs détenus par une équipe (transferts réels + trades exécutés appliqués).
export function futurePicksOwnedBy(team, futureOwners) {
  const out = [];
  for (const t of TEAMS) for (const year of PICK_YEARS) for (const round of [1, 2]) {
    if (effectivePickOwner(t.abbr, year, round, futureOwners) === team) out.push({ id: pickId(t.abbr, year, round), origTeam: t.abbr, year, round });
  }
  return out;
}

// Libellé générique d'un pick (slot 2026 ou futur).
export function anyPickLabel(id) {
  if (isSlotPick(id)) return slotPickLabel(slotOf(id));
  const p = parsePick(id);
  return `${p.year} ${p.round === 1 ? 'R1' : 'R2'} (${p.origTeam})`;
}

// Picks échangeables d'une équipe = slots 2026 possédés NON UTILISÉS + picks
// futurs détenus (transferts réels + trades exécutés appliqués).
export function tradeablePicks(team, owners, futureOwners, draftPicks) {
  return [...ownedSlots2026(team, owners, draftPicks), ...futurePicksOwnedBy(team, futureOwners)];
}

// --- Règle Stepien (uniquement sur les 1ers tours FUTURS, 2027+) --------------
// Basée sur la PROPRIÉTÉ EFFECTIVE : tient compte des trades de picks déjà
// exécutés (`futureOwners`), pas seulement du trade en cours.
export function stepienViolation(teamAbbr, outgoingIds, incomingIds, futureOwners) {
  const out = new Set(outgoingIds.filter((id) => !isSlotPick(id)));
  const inc = incomingIds.filter((id) => !isSlotPick(id)).map(parsePick).filter((p) => p.round === 1);
  const hasFirst = {};
  for (const year of PICK_YEARS) {
    // Possède-t-il encore AU MOINS un 1er tour cette année-là après le trade ?
    const keepsOne = TEAMS.some((t) =>
      effectivePickOwner(t.abbr, year, 1, futureOwners) === teamAbbr && !out.has(pickId(t.abbr, year, 1)));
    const getsOne = inc.some((p) => p.year === year);
    hasFirst[year] = keepsOne || getsOne;
  }
  for (let i = 0; i < PICK_YEARS.length - 1; i++) {
    if (!hasFirst[PICK_YEARS[i]] && !hasFirst[PICK_YEARS[i + 1]]) {
      return `Règle Stepien : ${teamAbbr} serait sans 1er tour en ${PICK_YEARS[i]} ET ${PICK_YEARS[i + 1]} (interdit deux ans de suite).`;
    }
  }
  return null;
}
