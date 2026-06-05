// Les 30 franchises NBA. `abbr` = code Basketball-Reference (sert aussi d'URL
// pour /contracts/<abbr>.html et de valeur `team_name_abbr` dans les stats).
// Attention aux codes BBRef non-évidents : Brooklyn=BRK, Charlotte=CHO,
// Phoenix=PHO. `colors` = [primaire, secondaire] pour l'UI.

export const TEAMS = [
  { abbr: 'ATL', name: 'Atlanta Hawks',          conf: 'East', colors: ['#e03a3e', '#26282a'] },
  { abbr: 'BOS', name: 'Boston Celtics',         conf: 'East', colors: ['#007a33', '#ba9653'] },
  { abbr: 'BRK', name: 'Brooklyn Nets',          conf: 'East', colors: ['#000000', '#ffffff'] },
  { abbr: 'CHO', name: 'Charlotte Hornets',      conf: 'East', colors: ['#1d1160', '#00788c'] },
  { abbr: 'CHI', name: 'Chicago Bulls',          conf: 'East', colors: ['#ce1141', '#000000'] },
  { abbr: 'CLE', name: 'Cleveland Cavaliers',    conf: 'East', colors: ['#860038', '#fdbb30'] },
  { abbr: 'DAL', name: 'Dallas Mavericks',       conf: 'West', colors: ['#00538c', '#002b5e'] },
  { abbr: 'DEN', name: 'Denver Nuggets',         conf: 'West', colors: ['#0e2240', '#fec524'] },
  { abbr: 'DET', name: 'Detroit Pistons',        conf: 'East', colors: ['#c8102e', '#1d42ba'] },
  { abbr: 'GSW', name: 'Golden State Warriors',  conf: 'West', colors: ['#1d428a', '#ffc72c'] },
  { abbr: 'HOU', name: 'Houston Rockets',        conf: 'West', colors: ['#ce1141', '#c4ced4'] },
  { abbr: 'IND', name: 'Indiana Pacers',         conf: 'East', colors: ['#002d62', '#fdbb30'] },
  { abbr: 'LAC', name: 'Los Angeles Clippers',   conf: 'West', colors: ['#c8102e', '#1d428a'] },
  { abbr: 'LAL', name: 'Los Angeles Lakers',     conf: 'West', colors: ['#552583', '#fdb927'] },
  { abbr: 'MEM', name: 'Memphis Grizzlies',      conf: 'West', colors: ['#5d76a9', '#12173f'] },
  { abbr: 'MIA', name: 'Miami Heat',             conf: 'East', colors: ['#98002e', '#f9a01b'] },
  { abbr: 'MIL', name: 'Milwaukee Bucks',        conf: 'East', colors: ['#00471b', '#eee1c6'] },
  { abbr: 'MIN', name: 'Minnesota Timberwolves', conf: 'West', colors: ['#0c2340', '#236192'] },
  { abbr: 'NOP', name: 'New Orleans Pelicans',   conf: 'West', colors: ['#0c2340', '#c8102e'] },
  { abbr: 'NYK', name: 'New York Knicks',        conf: 'East', colors: ['#006bb6', '#f58426'] },
  { abbr: 'OKC', name: 'Oklahoma City Thunder',  conf: 'West', colors: ['#007ac1', '#ef3b24'] },
  { abbr: 'ORL', name: 'Orlando Magic',          conf: 'East', colors: ['#0077c0', '#c4ced4'] },
  { abbr: 'PHI', name: 'Philadelphia 76ers',     conf: 'East', colors: ['#006bb6', '#ed174c'] },
  { abbr: 'PHO', name: 'Phoenix Suns',           conf: 'West', colors: ['#1d1160', '#e56020'] },
  { abbr: 'POR', name: 'Portland Trail Blazers',  conf: 'West', colors: ['#e03a3e', '#000000'] },
  { abbr: 'SAC', name: 'Sacramento Kings',       conf: 'West', colors: ['#5a2d81', '#63727a'] },
  { abbr: 'SAS', name: 'San Antonio Spurs',      conf: 'West', colors: ['#c4ced4', '#000000'] },
  { abbr: 'TOR', name: 'Toronto Raptors',        conf: 'East', colors: ['#ce1141', '#000000'] },
  { abbr: 'UTA', name: 'Utah Jazz',              conf: 'West', colors: ['#002b5c', '#00471b'] },
  { abbr: 'WAS', name: 'Washington Wizards',     conf: 'East', colors: ['#002b5c', '#e31837'] },
];

export const TEAM_BY_ABBR = Object.fromEntries(TEAMS.map((t) => [t.abbr, t]));

// Code ESPN (logos) par abréviation BBRef.
export const ESPN_CODE = {
  ATL: 'atl', BOS: 'bos', BRK: 'bkn', CHO: 'cha', CHI: 'chi', CLE: 'cle', DAL: 'dal',
  DEN: 'den', DET: 'det', GSW: 'gs', HOU: 'hou', IND: 'ind', LAC: 'lac', LAL: 'lal',
  MEM: 'mem', MIA: 'mia', MIL: 'mil', MIN: 'min', NOP: 'no', NYK: 'ny', OKC: 'okc',
  ORL: 'orl', PHI: 'phi', PHO: 'phx', POR: 'por', SAC: 'sac', SAS: 'sa', TOR: 'tor',
  UTA: 'utah', WAS: 'wsh',
};
export const teamLogoUrl = (abbr) => (ESPN_CODE[abbr] ? `https://a.espncdn.com/i/teamlogos/nba/500/${ESPN_CODE[abbr]}.png` : null);

// Alias d'abréviations qu'on peut croiser dans les stats (ligne combinée
// multi-équipes incluse) -> code canonique BBRef.
export const ABBR_ALIAS = {
  BKN: 'BRK', CHA: 'CHO', PHX: 'PHO',
};

export function canonAbbr(a) {
  if (!a) return a;
  return ABBR_ALIAS[a] || a;
}
