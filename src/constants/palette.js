// Palette sombre, accent orange « ballon » + bleu secondaire.
export const C = {
  bg: '#0e0f12',
  surface: '#16181c',
  surface2: '#1c1f24',
  border: '#2a2e34',
  text: '#eceef2',
  muted: '#838893',
  accent: '#ef7d3a',     // orange basket
  blue: '#4d9be6',
  green: '#4cc38a',
  yellow: '#e6c84d',
  red: '#e0604f',
  purple: '#a98be0',
};

// Code couleur des options de contrat (cellules de salaire) + départ en UFA.
export const OPTION_COLORS = {
  PO: '#4d9be6',   // player option (le joueur peut partir)
  TO: '#ef7d3a',   // team option
  ETO: '#a98be0',  // early termination option
  NG: '#838893',   // non-garanti
  UFA: '#e0604f',  // année de départ en agence libre
};
export const OPTION_LABEL = {
  PO: 'Player option', TO: 'Team option', ETO: 'ETO', NG: 'Non-garanti', UFA: 'UFA',
};

// Statut financier d'une équipe selon les lignes du CBA.
export const CAP_STATUS_COLORS = {
  under: '#4cc38a',       // sous le cap (room)
  over: '#e6c84d',        // au-dessus du cap
  tax: '#ef7d3a',         // au-dessus de la luxury tax
  apron1: '#e0604f',      // 1er apron
  apron2: '#c0392b',      // 2e apron
};
