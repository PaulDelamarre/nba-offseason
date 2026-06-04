export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// "$58.5M", "$850K", "$0" — compact, pour les cartes et totaux.
export const fmtUSD = (v) => {
  const n = num(v);
  const s = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  if (a === 0) return '$0';
  return `${s}$${a}`;
};

// "$58,456,566" — montant exact (fiche contrat).
export const fmtUSDfull = (v) => {
  const n = Math.round(num(v));
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US')}`;
};

// Pourcentage de tir : 0.487 -> ".487" (convention basket, sans le 0).
export const fmtPct3 = (v) => {
  if (v == null || v === '') return '—';
  const n = num(v);
  return n.toFixed(3).replace(/^0/, '');
};

// "48.7%" pour TS%, USG%… (stockés en fraction 0-1 chez BBRef).
export const fmtPct = (v, decimals = 1) => {
  if (v == null || v === '') return '—';
  return `${(num(v) * 100).toFixed(decimals)}%`;
};

export const fmtStat = (v, decimals = 1) => {
  if (v == null || v === '') return '—';
  return num(v).toFixed(decimals);
};
