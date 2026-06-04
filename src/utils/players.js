// Enrichissement + regroupement des joueurs pour l'UI.
// La note (p.rating, 0-100) est calculée par percentile dans utils/rating.js
// et attachée au chargement du dataset (useDataset).
import { num } from './format.js';

// Salaire du joueur pour la saison donnée (clé "2026-27" etc.).
export function salaryFor(player, season) {
  return num(player.salaries?.[season]);
}

// Photo (headshot Basketball-Reference) depuis l'id BBRef. null pour les ids
// synthétiques (prospects draftés « dft-… »).
export function photoUrl(id) {
  if (!id || id.includes('-')) return null;
  return `https://www.basketball-reference.com/req/202106291/images/headshots/${id}.jpg`;
}

// Équipe EFFECTIVE du joueur = sa destination si un trade exécuté l'a déplacé
// (overlay `moveMap` : { playerId -> team }), sinon son équipe d'origine.
export function effectiveTeam(p, moveMap) {
  return (moveMap && moveMap[p.id]) || p.team;
}

// Joueurs échangeables d'une équipe pour la saison (sous contrat cette saison-là).
export function tradeableRoster(players, abbr, season, moveMap) {
  return players
    .filter((p) => effectiveTeam(p, moveMap) === abbr && salaryFor(p, season) > 0)
    .map((p) => ({ ...p, _salary: salaryFor(p, season), _rating: num(p.rating) }))
    .sort((a, b) => b._salary - a._salary);
}

// Masse salariale engagée d'une équipe pour la saison.
export function teamSalary(players, abbr, season, moveMap) {
  return players.reduce((acc, p) => (effectiveTeam(p, moveMap) === abbr ? acc + salaryFor(p, season) : acc), 0);
}

export function rosterCount(players, abbr, season, moveMap) {
  return players.filter((p) => effectiveTeam(p, moveMap) === abbr && salaryFor(p, season) > 0).length;
}

export function playerById(players) {
  const m = new Map();
  for (const p of players) m.set(p.id, p);
  return m;
}
