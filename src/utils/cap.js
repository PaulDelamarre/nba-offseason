// Position d'une équipe vis-à-vis des lignes du cap + facture de luxury tax.
import { CAP_YEARS, TAX_BRACKETS, TAX_BRACKET_STEP, TAX_BASE_RATE_ABOVE_20M, TAX_RATE_INCREMENT } from '../constants/cba.js';

export function capYear(year) {
  return CAP_YEARS[year] || CAP_YEARS['2026-27'];
}

// Statut d'une masse salariale : 'under' (room) | 'over' | 'tax' | 'apron1' | 'apron2'.
export function capTier(salary, year) {
  const Y = capYear(year);
  if (salary >= Y.secondApron) return 'apron2';
  if (salary >= Y.firstApron) return 'apron1';
  if (salary >= Y.luxuryTax) return 'tax';
  if (salary > Y.salaryCap) return 'over';
  return 'under';
}

const TIER_LABEL = {
  under: 'Sous le cap',
  over: 'Au-dessus du cap',
  tax: 'Au-dessus de la luxury tax',
  apron1: 'Au-dessus du 1er apron',
  apron2: 'Au-dessus du 2e apron',
};

// Bilan financier complet d'une masse salariale pour une saison.
export function capSummary(salary, year) {
  const Y = capYear(year);
  const tier = capTier(salary, year);
  return {
    salary,
    tier,
    tierLabel: TIER_LABEL[tier],
    cap: Y.salaryCap,
    tax: Y.luxuryTax,
    firstApron: Y.firstApron,
    secondApron: Y.secondApron,
    room: Math.max(0, Y.salaryCap - salary),          // place sous le cap
    overCap: Math.max(0, salary - Y.salaryCap),
    overTax: Math.max(0, salary - Y.luxuryTax),
    toFirstApron: Y.firstApron - salary,               // distance (négatif = au-dessus)
    toSecondApron: Y.secondApron - salary,
    taxBill: luxuryTaxBill(salary, year),
  };
}

// Facture de luxury tax (barème progressif non-récidiviste).
export function luxuryTaxBill(salary, year) {
  const Y = capYear(year);
  let over = salary - Y.luxuryTax;
  if (over <= 0) return 0;
  let bill = 0;
  for (const b of TAX_BRACKETS) {
    if (over <= 0) break;
    const amt = Math.min(over, TAX_BRACKET_STEP);
    bill += amt * b.rate;
    over -= amt;
  }
  // au-delà de 20 M$ : 3.75, puis +0.50 par tranche de 5 M$
  let rate = TAX_BASE_RATE_ABOVE_20M;
  while (over > 0) {
    const amt = Math.min(over, TAX_BRACKET_STEP);
    bill += amt * rate;
    over -= amt;
    rate += TAX_RATE_INCREMENT;
  }
  return Math.round(bill);
}
