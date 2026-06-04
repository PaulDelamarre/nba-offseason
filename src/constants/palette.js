// Thème « carte collector / arcade » : base parquet sombre + accents néon,
// bordures épaisses, esprit carte NBA / NBA Jam.
export const C = {
  bg: '#140f08',        // parquet sombre (bois chaud quasi noir)
  surface: '#221a10',   // panneau / carte
  surface2: '#2e2415',  // surélevé
  border: '#43341e',    // bordure bois chaude
  text: '#f7f1e3',      // blanc cassé chaud
  muted: '#ab9c80',     // gris chaud
  accent: '#ff7a18',    // orange néon (ballon)
  blue: '#27d3ee',      // cyan néon
  green: '#a3e635',     // vert lime néon
  yellow: '#ffce3a',    // jaune néon
  red: '#ff3b6b',       // magenta néon
  purple: '#c084fc',    // violet néon
  ink: '#140f08',       // texte foncé sur fond néon (pastilles)
};

// Code couleur des options de contrat (cellules de salaire) + départ en UFA.
export const OPTION_COLORS = {
  PO: '#27d3ee',   // player option (le joueur peut partir)
  TO: '#ff7a18',   // team option
  ETO: '#c084fc',  // early termination option
  NG: '#ab9c80',   // non-garanti
  UFA: '#ff3b6b',  // année de départ en agence libre
};
export const OPTION_LABEL = {
  PO: 'Player option', TO: 'Team option', ETO: 'ETO', NG: 'Non-garanti', UFA: 'UFA',
};

// Statut financier d'une équipe selon les lignes du CBA.
export const CAP_STATUS_COLORS = {
  under: '#a3e635',       // sous le cap (room)
  over: '#ffce3a',        // au-dessus du cap
  tax: '#ff7a18',         // au-dessus de la luxury tax
  apron1: '#ff3b6b',      // 1er apron
  apron2: '#e11d48',      // 2e apron
};
