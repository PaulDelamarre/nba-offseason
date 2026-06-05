// Moteur de validation de trade selon le CBA 2023.
//
// Évalue CHAQUE équipe séparément (le salary matching se calcule équipe par
// équipe), puis rend un verdict global. Implémente en v1 :
//   - salary matching par paliers (équipe sous le 1er apron)
//   - matching 100% pour les équipes au 1er / 2e apron (pas de coussin)
//   - absorption dans la cap room des équipes sous le cap
//   - hard cap au 1er apron si on reprend plus qu'on envoie (matching étendu)
//   - 2e apron : interdiction d'agréger, d'envoyer du cash, de reprendre plus
//   - limite de cash par trade, taille de roster
//
// Non encore modélisé (v2) : TPE pluriannuels, sign-and-trade, base-year
// compensation, exception minimum, règle des 2 mois, Stepien (picks).

import { capYear, capTier, capSummary } from './cap.js';
import { bracketMaxIncoming } from '../constants/cba.js';
import { ROSTER } from '../constants/cba.js';

const EPS = 1; // tolérance d'arrondi (1 $)
const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);

// Évalue une équipe dans le trade.
// team = { abbr, preSalary, rosterCount, outgoing:[{salary}], incoming:[{salary}], cashOut, cashIn }
export function evaluateTeam(team, year) {
  const Y = capYear(year);
  const outgoing = team.outgoing || [];
  const incoming = team.incoming || [];
  const cashOut = team.cashOut || 0;
  const cashIn = team.cashIn || 0;

  const outSalary = sum(outgoing, (p) => p.salary);
  const inSalary = sum(incoming, (p) => p.salary);
  // Exception minimum : un joueur entrant à SON minimum (selon son ancienneté
  // p.yos) est absorbé sans matching (disponible même au 2e apron).
  const minSal = (p) => Y.minSalaryByYOS?.[Math.min(p.yos ?? 2, 10)] ?? 0;
  const isMin = (p) => (p.salary || 0) > 0 && (p.salary || 0) <= minSal(p) + EPS;
  const inSalaryMatch = sum(incoming.filter((p) => !isMin(p)), (p) => p.salary);
  const minExcCount = incoming.filter(isMin).length;
  const preSalary = team.preSalary || 0;
  const postSalary = preSalary - outSalary + inSalary;
  const preTier = capTier(preSalary, year);
  const capRoom = Math.max(0, Y.salaryCap - preSalary);
  const overApron = preTier === 'apron1' || preTier === 'apron2';

  // Salaire entrant maximal autorisé par le matching (+ TPE disponible).
  const tpe = team.tpe || 0;
  let maxIncoming;
  if (overApron) {
    maxIncoming = outSalary;                                  // 100%, pas de coussin
  } else {
    maxIncoming = Math.max(capRoom + outSalary, bracketMaxIncoming(outSalary));
  }
  const nonTpeMax = maxIncoming;
  maxIncoming += tpe;
  // Part de la TPE réellement consommée par la reprise.
  const tpeUsed = Math.min(tpe, Math.max(0, inSalaryMatch - nonTpeMax));

  const errors = [];
  const warnings = [];
  const hardCaps = [];

  // 1) Salary matching (les joueurs au minimum ne comptent pas)
  const salaryLegal = inSalaryMatch <= maxIncoming + EPS;
  const overGap = Math.max(0, inSalaryMatch - maxIncoming);
  if (!salaryLegal) {
    errors.push(
      `Matching insuffisant : reprend ${fmt(inSalaryMatch)} (hors min.) mais ne peut absorber que ${fmt(maxIncoming)} ` +
      `(sortant ${fmt(outSalary)}). Manque ${fmt(overGap)}.`
    );
  }
  if (minExcCount > 0) warnings.push(`${minExcCount} joueur(s) au minimum acquis via l'exception minimum (sans matching).`);
  if (tpe > 0 && inSalaryMatch > maxIncoming - tpe + EPS) warnings.push(`Utilise une TPE de ${fmt(tpe)}.`);

  // 2) Hard cap au 1er apron si matching ÉTENDU (reprend > envoie via les
  // paliers, pas via une TPE — une absorption par TPE seule ne hard-cap pas).
  const usedExpandedMatching = capRoom === 0 && !overApron && inSalaryMatch > outSalary + EPS && inSalaryMatch > tpe + outSalary + EPS;
  if (usedExpandedMatching) {
    hardCaps.push('1er apron');
    if (postSalary > Y.firstApron + EPS) {
      errors.push(
        `Reprendre plus que l'envoyé pose un hard cap au 1er apron (${fmt(Y.firstApron)}), ` +
        `or la masse passerait à ${fmt(postSalary)}.`
      );
    }
  }

  // 3) Règles du 2e apron
  if (preTier === 'apron2') {
    if (outgoing.length >= 2 && inSalary > 0) {
      errors.push("2e apron : interdiction d'agréger deux salaires ou plus pour un même trade.");
    }
    if (cashOut > 0) {
      errors.push("2e apron : interdiction d'envoyer du cash dans un trade.");
    }
    if (inSalaryMatch > outSalary + EPS) {
      errors.push('2e apron : interdiction de reprendre plus de salaire que ce qui est envoyé.');
    }
  }

  // 3b) Sign-and-trade reçu : hard cap au 1er apron (et interdiction de le dépasser).
  if (team.signTradeIn) {
    hardCaps.push('1er apron (S&T)');
    if (postSalary > Y.firstApron + EPS) {
      errors.push(`Sign-and-trade : l'acquéreur ne peut pas dépasser le 1er apron (${fmt(Y.firstApron)}), or la masse passerait à ${fmt(postSalary)}.`);
    }
  }

  // 4) Cash dans la limite
  if (cashOut > Y.cashInTrade + EPS) {
    errors.push(`Cash envoyé (${fmt(cashOut)}) au-dessus de la limite annuelle (${fmt(Y.cashInTrade)}).`);
  }

  // 5) Taille de roster
  const postRoster = (team.rosterCount || 0) - outgoing.length + incoming.length;
  if (postRoster > ROSTER.max) warnings.push(`Roster à ${postRoster} joueurs (max ${ROSTER.max}) : il faudra libérer.`);
  if (postRoster < ROSTER.min) warnings.push(`Roster à ${postRoster} joueurs (min ${ROSTER.min}) : il faudra signer.`);

  // 6) Conséquences fiscales
  const pre = capSummary(preSalary, year);
  const post = capSummary(postSalary, year);
  if (post.taxBill > pre.taxBill) warnings.push(`Facture de luxury tax : ${fmt(pre.taxBill)} → ${fmt(post.taxBill)}.`);
  if (post.tier !== pre.tier) warnings.push(`Statut cap : ${pre.tierLabel} → ${post.tierLabel}.`);

  // TPE potentiellement généré (informationnel)
  const tpeGenerated = outSalary > inSalary + EPS ? outSalary - inSalary + 250_000 : 0;

  return {
    abbr: team.abbr,
    outSalary, inSalary, net: inSalary - outSalary,
    preSalary, postSalary, maxIncoming, overGap,
    preTier, postTier: post.tier, pre, post,
    salaryLegal, legal: errors.length === 0,
    hardCaps, errors, warnings, tpeGenerated, tpeUsed,
  };
}

// Évalue le trade complet (2 à 4 équipes).
export function evaluateTrade({ teams, year }) {
  const results = (teams || []).map((t) => evaluateTeam(t, year));
  const active = results.filter((r) => r.outSalary > 0 || r.inSalary > 0);
  const legal = active.length >= 2 && results.every((r) => r.legal);
  return {
    year,
    legal,
    empty: active.length < 2,
    teams: results,
  };
}

function fmt(v) {
  const n = Math.round(v || 0);
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}
