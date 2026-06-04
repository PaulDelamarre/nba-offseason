import { describe, it, expect } from 'vitest';
import { rookieSalary, nextPick, bestAvailable, simulate, teamAt, picksOfTeam } from './draft.js';
import { minSalary, teamCapState } from './contracts.js';

const Y = '2026-27';

describe('rookie scale', () => {
  it('1er tour = barème, dégressif de 1 à 30', () => {
    expect(rookieSalary(1, Y)).toBe(14_517_000);
    expect(rookieSalary(30, Y)).toBe(2_881_000);
    expect(rookieSalary(1, Y)).toBeGreaterThan(rookieSalary(10, Y));
    expect(rookieSalary(10, Y)).toBeGreaterThan(rookieSalary(30, Y));
  });
  it('2e tour (rang > 30) = minimum recrue', () => {
    expect(rookieSalary(45, Y)).toBe(minSalary(0, Y));
  });
});

describe('intégration draft au cap', () => {
  const players = [{ id: 'a', team: 'XX', salaries: { '2026-27': 50_000_000 } }];
  it('le salaire rookie s’ajoute à la masse', () => {
    const st = teamCapState(players, 'XX', Y, { drafted: [{ rank: 1, salary: rookieSalary(1, Y) }] });
    expect(st.draftedSalary).toBe(14_517_000);
    expect(st.taxSalary).toBe(64_517_000);
  });
});

describe('moteur de simulation de draft', () => {
  it('ordre de draft réel (slots 1-2)', () => {
    expect(teamAt(1)).toBe('WAS');
    expect(teamAt(2)).toBe('UTA');
  });
  it('prochain pick et meilleur disponible', () => {
    expect(nextPick({})).toBe(1);
    expect(nextPick({ 1: 1 })).toBe(2);
    expect(bestAvailable({})).toBe(1);       // AJ Dybantsa
    expect(bestAvailable({ 1: 1 })).toBe(2);  // Darryn Peterson
  });
  it('simulate s’arrête au tour de mon équipe', () => {
    // stopTeam = UTA (pick #2) : la sim auto-pioche le #1 (WAS) puis s’arrête
    const r = simulate({}, 'UTA');
    expect(r[1]).toBe(1);                 // WAS a pris le meilleur dispo
    expect(nextPick(r)).toBe(2);          // au tour d’UTA
    expect(teamAt(nextPick(r))).toBe('UTA');
  });
  it('si je suis premier, simulate ne pioche rien', () => {
    const r = simulate({}, 'WAS');
    expect(nextPick(r)).toBe(1);
    expect(Object.keys(r)).toHaveLength(0);
  });
  it('picksOfTeam résout slot + salaire rookie scale', () => {
    const r = simulate({}, 'MEM');        // MEM pioche au #3 -> WAS#1, UTA#2 auto
    const was = picksOfTeam(r, 'WAS', Y);
    expect(was).toHaveLength(1);
    expect(was[0].pick).toBe(1);
    expect(was[0].salary).toBe(rookieSalary(1, Y));
  });
});
