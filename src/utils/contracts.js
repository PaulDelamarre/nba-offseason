// Logique contrats / free agency / Bird rights (CBA 2023, simplifié v1).
import { capYear } from './cap.js';
import { num } from './format.js';
import { effectiveTeam } from './players.js';

const PREV = '2025-26'; // saison de référence pour le salaire précédent / cap holds
export const SEASONS = ['2026-27', '2027-28', '2028-29', '2029-30', '2030-31'];

// Argent garanti restant à partir d'une saison (incluse).
export function guaranteedRemaining(p, fromSeason = '2026-27') {
  const start = SEASONS.indexOf(fromSeason);
  const seasons = SEASONS.slice(start < 0 ? 0 : start).filter((s) => num(p.salaries?.[s]) > 0);
  const total = seasons.reduce((a, s) => a + num(p.salaries?.[s]), 0);
  return { years: seasons.length, total, seasons };
}

// --- Extensions de contrat (simplifié v1) -------------------------------------
export function lastGuaranteedSeason(p) {
  const g = guaranteedRemaining(p, '2026-27');
  return g.seasons.length ? g.seasons[g.seasons.length - 1] : null;
}
// Indice (dans SEASONS) de la 1re saison ajoutable par extension.
export function extensionStartIndex(p) {
  const last = lastGuaranteedSeason(p);
  return (last ? SEASONS.indexOf(last) : -1) + 1;
}
export function canExtend(p) {
  return num(p.salaries?.['2026-27']) > 0 && extensionStartIndex(p) < SEASONS.length;
}
// Échéancier d'une extension : { saison: salaire } avec hausses annuelles.
export function extensionSchedule(p, ext) {
  const start = extensionStartIndex(p);
  const raise = ext.raisePct ?? 0.08; // hausse type extension Bird (8%)
  const out = {};
  for (let y = 0; y < ext.years; y++) {
    const season = SEASONS[start + y];
    if (!season) break;
    out[season] = Math.round(ext.startSalary * (1 + raise * y));
  }
  return out;
}
// Nombre d'années d'extension encore possibles (max 4, borné par l'horizon).
export function maxExtensionYears(p) {
  return Math.max(0, Math.min(4, SEASONS.length - extensionStartIndex(p)));
}

// Engagements garantis par saison pour une équipe, extensions incluses.
export function teamGuaranteedByYear(players, myTeam, extensions = [], moveMap) {
  const extMap = new Map(extensions.map((e) => [e.playerId, e]));
  const roster = players.filter((p) => effectiveTeam(p, moveMap) === myTeam);
  return SEASONS.map((season) => {
    let total = 0;
    for (const p of roster) {
      total += num(p.salaries?.[season]);
      const e = extMap.get(p.id);
      if (e) total += extensionSchedule(p, e)[season] || 0;
    }
    return { season, total };
  });
}

// Dead money imputé à la saison `season` si on libère ce joueur.
// mode 'waive' : tout le salaire garanti de la saison reste au cap.
// mode 'stretch' : on étale le garanti restant sur (2 × années + 1) saisons.
export function deadMoneyFor(p, mode, season = '2026-27') {
  const g = guaranteedRemaining(p, season);
  const thisSeason = num(p.salaries?.[season]);
  if (g.total <= 0 || thisSeason <= 0) return 0; // rien de garanti cette saison → pas de dead money
  if (mode === 'stretch') return Math.round(g.total / (2 * g.years + 1));
  return Math.round(thisSeason);
}

// Ancienneté (YOS) : valeur scrapée, sinon estimée via l'âge (FA hors roster).
export function yearsOfService(p) {
  if (p?.exp != null) return num(p.exp);
  return Math.max(0, Math.min(15, num(p?.age) - 19));
}

export function minSalary(yos, year) {
  const Y = capYear(year);
  const k = Math.max(0, Math.min(10, num(yos)));
  return Y.minSalaryByYOS[k] ?? Y.minSalaryByYOS[0];
}

export function maxSalary(yos, year) {
  const Y = capYear(year);
  const y = num(yos);
  const tier = y <= 6 ? '0-6' : y <= 9 ? '7-9' : '10+';
  return Y.maxSalary[tier];
}

export function isFreeAgent(p) {
  return num(p.salaries?.[PREV]) > 0 && !(num(p.salaries?.['2026-27']) > 0);
}

// Type d'agent libre (heuristique v1 : RFA si jeune et peu d'ancienneté).
export function faType(p) {
  const exp = yearsOfService(p);
  const age = num(p.age);
  return exp > 0 && exp <= 4 && age <= 25 ? 'RFA' : 'UFA';
}

// Cap hold : charge fictive au cap tant que le FA n'est pas re-signé/renoncé.
// Estimation : 120% du salaire précédent (gros salaires) ou 140% (petits),
// bornée entre min et max. (Le vrai barème dépend du statut Bird.)
export function capHold(p, year) {
  const Y = capYear(year);
  const prev = num(p.salaries?.[PREV]);
  const yos = yearsOfService(p);
  const minS = minSalary(yos, year);
  const maxS = maxSalary(yos, year);
  if (prev <= 0) return minS;
  const avg = Y.salaryCap * 0.085;
  const factor = prev >= avg ? 1.2 : 1.4;
  return Math.round(Math.min(maxS, Math.max(minS, prev * factor)));
}

// Méthodes de signature disponibles pour MON équipe sur un FA donné, selon la
// position cap. Chaque méthode = { key, label, maxSalary, maxYears, hardCap }.
export function availableMethods({ taxSalary, capRoomAvail, capRoomBasis }, player, isOwnFA, year) {
  const Y = capYear(year);
  const methods = [];
  const yos = yearsOfService(player);
  const playerMax = maxSalary(yos, year);
  const minS = minSalary(yos, year);

  // 1) Bird rights — uniquement sur ses PROPRES FA, dépasse le cap, jusqu'au max.
  if (isOwnFA) {
    methods.push({ key: 'bird', label: 'Bird rights', maxSalary: playerMax, maxYears: 5, hardCap: null });
  }

  // 2) Cap room — si l'équipe a de la place sous le cap.
  const underCap = capRoomAvail > minS;
  if (underCap) {
    methods.push({ key: 'room', label: 'Cap room', maxSalary: Math.min(playerMax, capRoomAvail), maxYears: 4, hardCap: null });
    methods.push({ key: 'roomMLE', label: 'Room MLE', maxSalary: Y.exceptions.roomMLE, maxYears: 3, hardCap: null });
  } else {
    // 3) Équipe au-dessus du cap : exceptions selon l'apron.
    // Les cap holds comptent pour la tax/apron : on teste sur le salaire
    // incluant les holds (capRoomBasis) si fourni, sinon taxSalary.
    const apronSalary = capRoomBasis ?? taxSalary;
    const tier = apronSalary >= Y.secondApron ? 'apron2' : apronSalary >= Y.firstApron ? 'apron1' : 'over';
    if (tier === 'over') {
      methods.push({ key: 'mle', label: 'Non-taxpayer MLE', maxSalary: Y.exceptions.nonTaxpayerMLE, maxYears: 4, hardCap: '1er apron' });
      methods.push({ key: 'bae', label: 'Bi-annual (BAE)', maxSalary: Y.exceptions.biAnnual, maxYears: 2, hardCap: '1er apron' });
    } else if (tier === 'apron1') {
      methods.push({ key: 'taxMLE', label: 'Taxpayer MLE', maxSalary: Y.exceptions.taxpayerMLE, maxYears: 2, hardCap: '2e apron' });
    }
    // tier apron2 : aucune MLE
  }

  // 4) Minimum — toujours disponible.
  methods.push({ key: 'min', label: 'Minimum', maxSalary: minS, maxYears: 2, hardCap: null });

  return methods;
}

// État cap complet de MON équipe pour la saison, en tenant compte des FA,
// des cap holds non renoncés et des signatures en cours.
// gm = { signings:[{playerId,salary,years,method}], renounced:Set<id> }
export function teamCapState(players, myTeam, year, gm) {
  const Y = capYear(year);
  const roster = players.filter((p) => effectiveTeam(p, gm?.moveMap) === myTeam);

  const signings = gm?.signings || [];
  const renounced = gm?.renounced || new Set();
  const waived = gm?.waived || [];
  const drafted = gm?.drafted || []; // [{ rank, salary }] — salaire rookie scale résolu par l'appelant
  const signedIds = new Set(signings.map((s) => s.playerId));
  const waivedMap = new Map(waived.map((w) => [w.playerId, w.mode]));
  const signedSalary = signings.reduce((a, s) => a + num(s.salary), 0);
  const draftedSalary = drafted.reduce((a, d) => a + num(d.salary), 0);

  // Salaire garanti 2026-27 des joueurs sous contrat NON libérés.
  const baseCommitted = roster.reduce((a, p) => (waivedMap.has(p.id) ? a : a + num(p.salaries?.['2026-27'])), 0);

  // Dead money des joueurs libérés (waive = plein salaire, stretch = étalé).
  let deadMoney = 0;
  for (const p of roster) {
    if (waivedMap.has(p.id)) deadMoney += deadMoneyFor(p, waivedMap.get(p.id), '2026-27');
  }

  // Cap holds des FA maison non encore signés/renoncés.
  const ownFAs = roster.filter((p) => isFreeAgent(p));
  let holds = 0;
  let holdCount = 0;
  for (const fa of ownFAs) {
    if (signedIds.has(fa.id) || renounced.has(fa.id)) continue;
    holds += capHold(fa, year);
    holdCount += 1;
  }

  // Charge de roster incomplet : sous 12 « slots » remplis (joueurs sous
  // contrat + signatures + recrues + cap holds), chaque slot vide = minimum recrue.
  const ROSTER_CHARGE_SLOTS = 12;
  const filledSlots = roster.filter((p) => num(p.salaries?.['2026-27']) > 0 && !waivedMap.has(p.id)).length
    + signings.length + drafted.length + holdCount;
  const rosterCharge = filledSlots < ROSTER_CHARGE_SLOTS ? (ROSTER_CHARGE_SLOTS - filledSlots) * minSalary(0, year) : 0;

  const taxSalary = baseCommitted + signedSalary + draftedSalary + deadMoney; // pour tax/apron
  const capRoomBasis = taxSalary + holds + rosterCharge;          // pour la cap room
  const capRoomAvail = Math.max(0, Y.salaryCap - capRoomBasis);

  return { baseCommitted, signedSalary, draftedSalary, deadMoney, holds, rosterCharge, taxSalary, capRoomBasis, capRoomAvail, ownFAs };
}
