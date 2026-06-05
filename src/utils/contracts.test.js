import { describe, it, expect } from 'vitest';
import { minSalary, maxSalary, isFreeAgent, capHold, availableMethods, teamCapState, deadMoneyFor, canExtend, extensionSchedule, maxExtensionYears, teamGuaranteedByYear } from './contracts.js';

const Y = '2026-27';
const keys = (ms) => ms.map((m) => m.key);

describe('min / max salary par ancienneté', () => {
  it('minimum par YOS (avec plafond à 10 ans)', () => {
    expect(minSalary(0, Y)).toBe(1_358_084);
    expect(minSalary(10, Y)).toBe(3_877_445);
    expect(minSalary(15, Y)).toBe(3_877_445); // clampé à 10
  });
  it('max par palier 25/30/35%', () => {
    expect(maxSalary(3, Y)).toBe(41_250_000);
    expect(maxSalary(8, Y)).toBe(49_500_000);
    expect(maxSalary(12, Y)).toBe(57_750_000);
  });
});

describe('détection FA + cap hold', () => {
  const fa = { salaries: { '2025-26': 10_000_000 }, exp: 6, age: 28 };
  const signed = { salaries: { '2025-26': 10_000_000, '2026-27': 12_000_000 } };
  it('FA = salaire 25-26 mais pas 26-27', () => {
    expect(isFreeAgent(fa)).toBe(true);
    expect(isFreeAgent(signed)).toBe(false);
  });
  it('cap hold borné entre min et max', () => {
    const h = capHold(fa, Y);
    expect(h).toBeGreaterThanOrEqual(minSalary(6, Y));
    expect(h).toBeLessThanOrEqual(maxSalary(6, Y));
    expect(h).toBeCloseTo(14_000_000, -5); // ~140% de 10M
  });
});

describe('méthodes de signature selon la position cap', () => {
  const player = { exp: 6, age: 28, salaries: { '2025-26': 8_000_000 } };
  it('sous le cap : room + room MLE + min (+ bird si maison)', () => {
    const ms = availableMethods({ taxSalary: 140_000_000, capRoomAvail: 30_000_000 }, player, false, Y);
    expect(keys(ms)).toEqual(expect.arrayContaining(['room', 'roomMLE', 'min']));
    const own = availableMethods({ taxSalary: 140_000_000, capRoomAvail: 30_000_000 }, player, true, Y);
    expect(keys(own)).toContain('bird');
  });
  it('au-dessus du cap (sous apron) : MLE + BAE + min', () => {
    const ms = availableMethods({ taxSalary: 180_000_000, capRoomAvail: 0 }, player, false, Y);
    expect(keys(ms)).toEqual(['mle', 'bae', 'min']);
  });
  it('1er apron : taxpayer MLE + min', () => {
    const ms = availableMethods({ taxSalary: 212_000_000, capRoomAvail: 0 }, player, false, Y);
    expect(keys(ms)).toEqual(['taxMLE', 'min']);
  });
  it('2e apron : minimum seulement (+ bird si maison)', () => {
    const ms = availableMethods({ taxSalary: 225_000_000, capRoomAvail: 0 }, player, false, Y);
    expect(keys(ms)).toEqual(['min']);
    const own = availableMethods({ taxSalary: 225_000_000, capRoomAvail: 0 }, player, true, Y);
    expect(keys(own)).toEqual(['bird', 'min']);
  });
});

describe('teamCapState — cap room avec holds et renoncements', () => {
  const players = [
    { id: 'a', team: 'XX', salaries: { '2026-27': 50_000_000 } },
    { id: 'b', team: 'XX', salaries: { '2025-26': 10_000_000 }, exp: 6, age: 28 }, // FA maison
  ];
  it('le cap hold du FA maison réduit la cap room', () => {
    const st = teamCapState(players, 'XX', Y, { signings: [], renounced: new Set() });
    expect(st.baseCommitted).toBe(50_000_000);
    expect(st.holds).toBeGreaterThan(0);
    expect(st.capRoomAvail).toBeCloseTo(165_000_000 - 50_000_000 - st.holds - st.rosterCharge, 0);
  });
  it('renoncer au FA libère sa cap room', () => {
    const st = teamCapState(players, 'XX', Y, { signings: [], renounced: new Set(['b']) });
    expect(st.holds).toBe(0);
    expect(st.capRoomAvail).toBe(165_000_000 - 50_000_000 - st.rosterCharge);
  });
});

describe('waive & stretch — dead money', () => {
  it('waive = salaire de la saison ; stretch = total / (2×années + 1)', () => {
    const p1 = { salaries: { '2026-27': 9_000_000 } }; // 1 an restant
    expect(deadMoneyFor(p1, 'waive', Y)).toBe(9_000_000);
    expect(deadMoneyFor(p1, 'stretch', Y)).toBe(3_000_000); // 9M / 3
    const p2 = { salaries: { '2026-27': 10_000_000, '2027-28': 10_000_000 } }; // 2 ans
    expect(deadMoneyFor(p2, 'waive', Y)).toBe(10_000_000);   // saison courante
    expect(deadMoneyFor(p2, 'stretch', Y)).toBe(4_000_000);  // 20M / 5
  });

  it('le stretch réduit la masse de la saison, pas le waive sec (contrat 1 an)', () => {
    const players = [
      { id: 'a', team: 'XX', salaries: { '2026-27': 50_000_000 } },
      { id: 'b', team: 'XX', salaries: { '2026-27': 9_000_000 } },
    ];
    const waive = teamCapState(players, 'XX', Y, { waived: [{ playerId: 'b', mode: 'waive' }] });
    expect(waive.baseCommitted).toBe(50_000_000);
    expect(waive.deadMoney).toBe(9_000_000);
    expect(waive.taxSalary).toBe(59_000_000); // inchangé : waive sec ne fait pas gagner d'argent

    const stretch = teamCapState(players, 'XX', Y, { waived: [{ playerId: 'b', mode: 'stretch' }] });
    expect(stretch.deadMoney).toBe(3_000_000);
    expect(stretch.taxSalary).toBe(53_000_000); // 6M économisés cette saison
  });
});

describe('extensions de contrat', () => {
  const p2yr = { id: 'x', team: 'XX', salaries: { '2026-27': 18_000_000, '2027-28': 19_000_000 }, exp: 6, age: 28 };
  const pFull = { id: 'y', team: 'XX', salaries: { '2026-27': 1, '2027-28': 1, '2028-29': 1, '2029-30': 1, '2030-31': 1 } };
  it('éligibilité : extensible si de la place dans l’horizon', () => {
    expect(canExtend(p2yr)).toBe(true);
    expect(canExtend(pFull)).toBe(false); // garanti jusqu’en 2030-31
  });
  it('années max = horizon restant après la fin du contrat', () => {
    expect(maxExtensionYears(p2yr)).toBe(3); // fin 2027-28 -> 2028-29..2030-31
  });
  it('échéancier : démarre après le contrat, +8%/an', () => {
    const s = extensionSchedule(p2yr, { years: 3, startSalary: 20_000_000 });
    expect(s['2028-29']).toBe(20_000_000);
    expect(s['2029-30']).toBe(21_600_000);
    expect(s['2030-31']).toBe(23_200_000);
  });
  it('paie pluriannuelle : l’extension gonfle les saisons futures', () => {
    const players = [p2yr];
    const base = teamGuaranteedByYear(players, 'XX', []);
    expect(base.find((y) => y.season === '2028-29').total).toBe(0);
    const withExt = teamGuaranteedByYear(players, 'XX', [{ playerId: 'x', years: 2, startSalary: 20_000_000 }]);
    expect(withExt.find((y) => y.season === '2028-29').total).toBe(20_000_000);
    expect(withExt.find((y) => y.season === '2026-27').total).toBe(18_000_000); // inchangé
  });
});

describe('régressions revue de code', () => {
  it('apron tient compte des cap holds (capRoomBasis) — 41M de holds → 2e apron, min seulement', () => {
    // taxSalary 200M (sous le 2e apron 222M) mais 241M holds inclus → apron2
    const player = { exp: 6, age: 28, salaries: { '2025-26': 8_000_000 } };
    const ms = availableMethods({ taxSalary: 200_000_000, capRoomAvail: 0, capRoomBasis: 241_000_000 }, player, false, Y);
    expect(keys(ms)).toEqual(['min']);
  });
  it('deadMoneyFor = 0 (waive ET stretch) si rien de garanti la saison courante', () => {
    const p = { salaries: { '2027-28': 10_000_000, '2028-29': 10_000_000 } }; // rien en 2026-27
    expect(deadMoneyFor(p, 'waive', Y)).toBe(0);
    expect(deadMoneyFor(p, 'stretch', Y)).toBe(0);
  });
});

import { effectiveTeam } from './players.js';
describe('trades dans le mode GM — roster effectif', () => {
  const players = [
    { id: 'a', team: 'XX', salaries: { '2026-27': 50_000_000 } }, // à moi
    { id: 'b', team: 'YY', salaries: { '2026-27': 30_000_000 } }, // autre équipe
  ];
  it('effectiveTeam suit la destination du trade', () => {
    expect(effectiveTeam(players[0])).toBe('XX');
    expect(effectiveTeam(players[0], { a: 'YY' })).toBe('YY');
  });
  it('un trade ajoute l’acquis et retire le cédé du cap', () => {
    const before = teamCapState(players, 'XX', Y, {});
    expect(before.baseCommitted).toBe(50_000_000);
    // j'envoie a (->YY) et je reçois b (->XX)
    const after = teamCapState(players, 'XX', Y, { moveMap: { a: 'YY', b: 'XX' } });
    expect(after.baseCommitted).toBe(30_000_000); // a part, b arrive
  });
});

import { luxuryTaxBill } from './cap.js';
describe('CBA v2 — repeater tax & charge de roster', () => {
  it('repeater tax > tax standard quand au-dessus de la tax', () => {
    const std = luxuryTaxBill(220_000_000, Y, false);
    const rep = luxuryTaxBill(220_000_000, Y, true);
    expect(rep).toBeGreaterThan(std);
    expect(luxuryTaxBill(150_000_000, Y, true)).toBe(0); // sous la tax -> 0
  });
  it('charge de roster incomplet réduit la cap room', () => {
    const players = [{ id: 'a', team: 'XX', salaries: { '2026-27': 50_000_000 } }]; // 1 slot rempli
    const st = teamCapState(players, 'XX', Y, {});
    expect(st.rosterCharge).toBeGreaterThan(0); // 11 slots vides * min recrue
    expect(st.capRoomBasis).toBe(50_000_000 + st.rosterCharge);
  });
});
