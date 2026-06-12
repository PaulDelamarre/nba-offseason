import { describe, it, expect } from 'vitest';
import { ownedSlots2026, stepienViolation, slotPickId, futurePicksOwnedBy, tradeablePicks } from './picks.js';
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

describe('picks — règles NBA (slots utilisés, picks futurs persistés)', () => {
  it('un slot 2026 déjà utilisé reste échangeable en tant que droits de draft', () => {
    expect(ownedSlots2026('WAS').find((p) => p.slot === 1)?.draftedRank).toBeNull();
    // slot #1 utilisé (prospect rank 5) : toujours listé, annoté avec le drafté
    const used = ownedSlots2026('WAS', undefined, { 1: 5 }).find((p) => p.slot === 1);
    expect(used).toBeTruthy();
    expect(used.draftedRank).toBe(5);
    // les slots non utilisés restent sans annotation
    expect(ownedSlots2026('WAS', undefined, { 1: 5 }).find((p) => p.slot === 51)?.draftedRank).toBeNull();
  });

  it('futurePicksOwnedBy suit les trades de picks futurs exécutés', () => {
    // baseline : BOS possède son 2027 R1
    expect(futurePicksOwnedBy('BOS').some((p) => p.id === 'BOS-2027-R1')).toBe(true);
    // après trade exécuté : LAL le détient
    const fo = { 'BOS-2027-R1': 'LAL' };
    expect(futurePicksOwnedBy('BOS', fo).some((p) => p.id === 'BOS-2027-R1')).toBe(false);
    expect(futurePicksOwnedBy('LAL', fo).some((p) => p.id === 'BOS-2027-R1')).toBe(true);
    expect(tradeablePicks('LAL', undefined, fo).some((p) => p.id === 'BOS-2027-R1')).toBe(true);
  });

  it('Stepien tient compte des trades déjà exécutés (futureOwners)', () => {
    // BOS a DÉJÀ cédé son 2027 R1 → céder maintenant le 2028 R1 = violation
    const fo = { 'BOS-2027-R1': 'LAL' };
    expect(stepienViolation('BOS', ['BOS-2028-R1'], [], fo)).toMatch(/Stepien/);
    // mais s'il a acquis le 2027 R1 de LAL entre-temps, pas de violation
    const fo2 = { 'BOS-2027-R1': 'LAL', 'LAL-2027-R1': 'BOS' };
    expect(stepienViolation('BOS', ['BOS-2028-R1'], [], fo2)).toBeNull();
  });
});
