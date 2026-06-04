import { describe, it, expect } from 'vitest';
import { attachRatings, isEligible } from './rating.js';

// Joueur synthétique du groupe meneur/arrière (G), éligible par défaut.
function G(stats, over = {}) {
  return { posGroup: 'G', stats: { g: 70, mpg: 30, ...stats }, ...over };
}
const ELITE = { bpm: 9, vorp: 5, ws: 11, per: 27, pts: 30, tsPct: 0.62, ast: 8, trb: 6, stl: 1.8, blk: 0.5, tov: 2.5 };
const WEAK = { bpm: -4, vorp: -1, ws: 0.5, per: 9, pts: 5, tsPct: 0.48, ast: 1, trb: 2, stl: 0.4, blk: 0.1, tov: 1.5 };

describe('note par percentile', () => {
  it("classe l'élite au-dessus du faible", () => {
    const players = [G(ELITE), G(WEAK), G({ bpm: 1, vorp: 1, ws: 4, per: 15, pts: 14, tsPct: 0.55, ast: 4, trb: 4, stl: 1, blk: 0.3, tov: 2 })];
    attachRatings(players);
    expect(players[0].rating).toBeGreaterThan(players[2].rating);
    expect(players[2].rating).toBeGreaterThan(players[1].rating);
    expect(players[0].rating).toBeGreaterThan(70);
  });

  it('atténuation : mêmes stats, peu de minutes → note plus basse', () => {
    const highMin = G(ELITE);
    const lowMin = G(ELITE, {}); lowMin.stats = { ...ELITE, g: 20, mpg: 13 }; // 260 min, non éligible
    const players = [highMin, lowMin, G(WEAK), G(WEAK)];
    attachRatings(players);
    expect(isEligible(highMin)).toBe(true);
    expect(isEligible(lowMin)).toBe(false);
    expect(highMin.rating).toBeGreaterThan(lowMin.rating);
  });

  it('éligibilité : ≥ 20 matchs ET ≥ 500 minutes', () => {
    expect(isEligible(G({ g: 70, mpg: 30 }))).toBe(true);
    expect(isEligible(G({ g: 10, mpg: 30 }))).toBe(false); // trop peu de matchs
    expect(isEligible(G({ g: 70, mpg: 5 }))).toBe(false);  // 350 min < 500
    expect(isEligible({ posGroup: 'G' })).toBe(false);     // pas de stats
  });
});
