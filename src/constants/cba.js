// Paramètres du CBA 2023 (convention collective NBA) — chiffres recherchés et
// vérifiés de façon contradictoire (sources : Hoops Rumors, CBA Guide, NBC
// Sports, Larry Coon, Spotrac).
//
// Saison d'opération par défaut = 2026-27 (l'entresaison qu'on simule). Les
// montants 2026-27 sont des PROJECTIONS (cap ~165 M$, +7 %) — la NBA ne fige
// les chiffres officiels que fin juin/début juillet. Les chiffres 2025-26 sont
// OFFICIELS et fournis en repli.

export const CAP_YEARS = {
  '2026-27': {
    label: '2026-27 (projection)',
    official: false,
    salaryCap: 165_000_000,
    luxuryTax: 201_000_000,
    firstApron: 209_000_000,
    secondApron: 222_000_000,
    maxSalary: { '0-6': 41_250_000, '7-9': 49_500_000, '10+': 57_750_000 },
    exceptions: {
      nonTaxpayerMLE: 15_048_000,
      taxpayerMLE: 6_065_000,
      roomMLE: 9_369_000,
      biAnnual: 5_478_000,
    },
    // Salaire minimum par années d'ancienneté (YOS). 10 = 10 ans et +.
    minSalaryByYOS: {
      0: 1_358_084, 1: 2_185_633, 2: 2_450_000, 3: 2_538_126, 4: 2_626_248,
      5: 2_846_555, 6: 3_066_868, 7: 3_287_176, 8: 3_507_488, 9: 3_524_948, 10: 3_877_445,
    },
    cashInTrade: 8_497_000, // ~7,964,000 (25-26) indexé sur le cap
  },
  '2025-26': {
    label: '2025-26 (officiel)',
    official: true,
    salaryCap: 154_647_000,
    luxuryTax: 187_895_000,
    firstApron: 195_945_000,
    secondApron: 207_824_000,
    maxSalary: { '0-6': 38_661_750, '7-9': 46_394_100, '10+': 54_126_450 },
    exceptions: {
      nonTaxpayerMLE: 14_104_000,
      taxpayerMLE: 5_685_000,
      roomMLE: 8_781_000,
      biAnnual: 5_134_000,
    },
    minSalaryByYOS: {
      0: 1_272_870, 1: 2_046_900, 2: 2_296_274, 3: 2_378_870, 4: 2_461_463,
      5: 2_667_947, 6: 2_874_430, 7: 3_080_913, 8: 3_287_397, 9: 3_303_771, 10: 3_634_153,
    },
    cashInTrade: 7_964_000,
  },
};

export const DEFAULT_CAP_YEAR = '2026-27';

// --- Paliers de luxury tax (équipe non-récidiviste) ----------------------------
// Taux marginal par tranche de 5 M$ au-dessus de la tax line.
// (Récidiviste = +1.00 sur chaque palier ; non modélisé en v1.)
export const TAX_BRACKETS = [
  { upTo: 5_000_000, rate: 1.5 },
  { upTo: 10_000_000, rate: 1.75 },
  { upTo: 15_000_000, rate: 2.5 },
  { upTo: 20_000_000, rate: 3.25 },
  // au-delà : 3.75 puis +0.50 par tranche de 5 M$ supplémentaire
];
export const TAX_BRACKET_STEP = 5_000_000;
export const TAX_BASE_RATE_ABOVE_20M = 3.75;
export const TAX_RATE_INCREMENT = 0.5;

// --- Salary matching (trades) --------------------------------------------------
// Seuils FIXES du CBA 2023 (ne bougent pas avec le cap).
export const MATCH = {
  lowBracketMax: 7_500_000,     // sortant <= 7.5M -> 200% + 250k
  midBracketMax: 29_000_000,    // 7.5M < sortant <= 29M -> sortant + 7.5M
  cushion: 250_000,             // +250k (supprimé si l'équipe est au 1er apron)
  midCushion: 7_500_000,        // +7.5M (tranche médiane)
  lowMultiplier: 2.0,
  highMultiplier: 1.25,
};

// Salaire entrant maximal autorisé par le salary matching, pour une équipe AU-
// DESSUS DU CAP et SOUS le 1er apron, en fonction du salaire sortant agrégé.
export function bracketMaxIncoming(outgoing) {
  if (outgoing <= MATCH.lowBracketMax) return outgoing * MATCH.lowMultiplier + MATCH.cushion;
  if (outgoing <= MATCH.midBracketMax) return outgoing + MATCH.midCushion;
  return outgoing * MATCH.highMultiplier + MATCH.cushion;
}

export const ROSTER = { min: 14, max: 15, twoWayMax: 3 };
