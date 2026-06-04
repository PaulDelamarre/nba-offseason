import { describe, it, expect } from 'vitest';
import { ownedSlots2026, stepienViolation, slotPickId } from './picks.js';
import { teamAt, simulate, nextPick } from './draft.js';

describe('réconciliation picks ↔ draft', () => {
  it("l'override d'ownership change le détenteur du slot", () => {
    expect(teamAt(1)).toBe('WAS');
    expect(teamAt(1, { 1: 'BOS' })).toBe('BOS');
  });

  it("un slot échangé change qui est sur l'horloge en simulation", () => {
    // Sans override, BOS pioche tard (#27). Avec override, BOS possède le #1.
    const r = simulate({}, 'BOS', { 1: 'BOS' });
    expect(nextPick(r)).toBe(1);
    expect(Object.keys(r)).toHaveLength(0); // s'arrête immédiatement au #1
  });

  it("ownedSlots2026 suit l'override", () => {
    expect(ownedSlots2026('WAS').some((p) => p.slot === 1)).toBe(true);
    expect(ownedSlots2026('BOS', { 1: 'BOS' }).some((p) => p.slot === 1)).toBe(true);
    expect(ownedSlots2026('WAS', { 1: 'BOS' }).some((p) => p.slot === 1)).toBe(false);
  });

  it('Stepien ignore les slots 2026 et flag 2 firsts futurs consécutifs', () => {
    const v = stepienViolation('BOS', [slotPickId(1), 'BOS-2027-R1', 'BOS-2028-R1'], []);
    expect(v).toMatch(/Stepien/);
  });

  it('Stepien : pas de violation si une seule année future cédée', () => {
    expect(stepienViolation('BOS', ['BOS-2027-R1'], [])).toBeNull();
  });
});
