import { describe, it, expect } from 'vitest';
import { evaluateTeam, evaluateTrade } from './trade.js';

const Y = '2026-27'; // cap 165M, tax 201M, apron1 209M, apron2 222M
const p = (salary) => ({ id: String(salary), name: 'P', salary });

// Équipe au-dessus du cap mais sous le 1er apron (utilise les paliers de matching).
const overCap = (extra) => ({ abbr: 'X', preSalary: 180_000_000, rosterCount: 15, ...extra });

describe('salary matching — paliers (équipe sous le 1er apron)', () => {
  it('palier bas : sortant ≤ 7.5M → 200% + 250K', () => {
    // exemple vérifié : sortant 3,191,400 → reprise max 6,632,800
    const out = evaluateTeam(overCap({ outgoing: [p(3_191_400)], incoming: [p(6_632_800)] }), Y);
    expect(out.legal).toBe(true);
    const overByOne = evaluateTeam(overCap({ outgoing: [p(3_191_400)], incoming: [p(6_640_000)] }), Y);
    expect(overByOne.legal).toBe(false);
    expect(out.maxIncoming).toBeCloseTo(6_632_800, 0);
  });

  it('palier médian : 7.5M < sortant ≤ 29M → sortant + 7.5M', () => {
    const r = evaluateTeam(overCap({ outgoing: [p(9_450_000)] }), Y);
    expect(r.maxIncoming).toBeCloseTo(16_950_000, 0);
    expect(evaluateTeam(overCap({ outgoing: [p(9_450_000)], incoming: [p(16_950_000)] }), Y).legal).toBe(true);
    expect(evaluateTeam(overCap({ outgoing: [p(9_450_000)], incoming: [p(17_100_000)] }), Y).legal).toBe(false);
  });

  it('palier haut : sortant > 29M → 125% + 250K', () => {
    const r = evaluateTeam(overCap({ outgoing: [p(30_000_000)] }), Y);
    expect(r.maxIncoming).toBeCloseTo(37_750_000, 0);
  });
});

describe('équipe au 1er apron — matching 100% sans coussin', () => {
  const apron1 = (extra) => ({ abbr: 'A', preSalary: 210_000_000, rosterCount: 15, ...extra }); // entre 209M et 222M
  it('reprise max = sortant, pas de coussin', () => {
    expect(evaluateTeam(apron1({ outgoing: [p(20_000_000)], incoming: [p(20_000_000)] }), Y).legal).toBe(true);
    expect(evaluateTeam(apron1({ outgoing: [p(20_000_000)], incoming: [p(20_500_000)] }), Y).legal).toBe(false);
  });
});

describe('équipe au 2e apron — restrictions dures', () => {
  const apron2 = (extra) => ({ abbr: 'B', preSalary: 225_000_000, rosterCount: 15, ...extra }); // > 222M
  it("interdiction d'agréger 2 salaires", () => {
    const r = evaluateTeam(apron2({ outgoing: [p(10_000_000), p(10_000_000)], incoming: [p(19_000_000)] }), Y);
    expect(r.legal).toBe(false);
    expect(r.errors.some((e) => /agr[ée]ger/i.test(e))).toBe(true);
  });
  it("interdiction d'envoyer du cash", () => {
    const r = evaluateTeam(apron2({ outgoing: [p(10_000_000)], incoming: [p(9_000_000)], cashOut: 1_000_000 }), Y);
    expect(r.errors.some((e) => /cash/i.test(e))).toBe(true);
  });
  it('interdiction de reprendre plus que ce qui est envoyé', () => {
    const r = evaluateTeam(apron2({ outgoing: [p(15_000_000)], incoming: [p(16_000_000)] }), Y);
    expect(r.legal).toBe(false);
  });
});

describe('équipe sous le cap — absorption dans la room', () => {
  const underCap = (extra) => ({ abbr: 'U', preSalary: 150_000_000, rosterCount: 14, ...extra }); // room 15M
  it('absorbe un entrant dans la cap room sans rien envoyer', () => {
    expect(evaluateTeam(underCap({ incoming: [p(14_000_000)] }), Y).legal).toBe(true);
    expect(evaluateTeam(underCap({ incoming: [p(16_000_000)] }), Y).legal).toBe(false);
  });
});

describe('hard cap au 1er apron (matching étendu : reprend > envoie)', () => {
  it('hard cap signalé et bloque si la masse dépasse le 1er apron', () => {
    // équipe juste sous le 1er apron, reprend plus qu'elle n'envoie
    const r = evaluateTeam({ abbr: 'H', preSalary: 207_000_000, rosterCount: 15, outgoing: [p(10_000_000)], incoming: [p(14_000_000)] }, Y);
    expect(r.hardCaps).toContain('1er apron');
    expect(r.legal).toBe(false); // post = 211M > 209M
  });
  it('légal si la masse reste sous le 1er apron malgré le hard cap', () => {
    const r = evaluateTeam({ abbr: 'H', preSalary: 195_000_000, rosterCount: 15, outgoing: [p(10_000_000)], incoming: [p(14_000_000)] }, Y);
    expect(r.hardCaps).toContain('1er apron');
    expect(r.legal).toBe(true); // post = 199M < 209M
  });
});

describe('evaluateTrade — verdict global', () => {
  it('deux équipes, échange équilibré → légal', () => {
    const res = evaluateTrade({
      year: Y,
      teams: [
        { abbr: 'A', preSalary: 180_000_000, rosterCount: 15, outgoing: [p(20_000_000)], incoming: [p(22_000_000)] },
        { abbr: 'B', preSalary: 170_000_000, rosterCount: 15, outgoing: [p(22_000_000)], incoming: [p(20_000_000)] },
      ],
    });
    expect(res.legal).toBe(true);
    expect(res.teams).toHaveLength(2);
  });
  it('illégal si une seule équipe ne matche pas', () => {
    const res = evaluateTrade({
      year: Y,
      teams: [
        { abbr: 'A', preSalary: 180_000_000, rosterCount: 15, outgoing: [p(5_000_000)], incoming: [p(30_000_000)] },
        { abbr: 'B', preSalary: 170_000_000, rosterCount: 15, outgoing: [p(30_000_000)], incoming: [p(5_000_000)] },
      ],
    });
    expect(res.legal).toBe(false);
  });
});
