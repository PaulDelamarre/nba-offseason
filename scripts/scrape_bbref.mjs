// Scraper Basketball-Reference -> dataset NBA unifié pour le jeu d'entresaison.
//
// Produit dans public/data/ :
//   - players.json : joueurs (stats 2025-26 + salaires pluriannuels fusionnés par id BBRef)
//   - teams.json   : 30 équipes + masse salariale engagée 2026-27
//   - meta.json    : saison, date de scrape, comptages
//
// Sources :
//   - stats per-game : /leagues/NBA_2026_per_game.html (table per_game_stats)
//   - stats advanced : /leagues/NBA_2026_advanced.html (table advanced)
//   - contrats       : /contracts/<ABBR>.html (table contracts, colonnes y1..y6)
//
// Le contrat d'une équipe fait foi pour le ROSTER + l'équipe actuelle ;
// les stats font foi pour la PRODUCTION. Fusion par id joueur BBRef.
//
// Cache disque (scripts/.cache) : un re-run ne re-frappe pas BBRef.
// Leviers (env) :
//   ONLY_TEAMS=BOS,LAL   -> restreint les pages contrats (debug)
//   SKIP_ADVANCED=1      -> ne fetch pas la page advanced
//   FORCE=1              -> ignore le cache et refetch

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAMS, canonAbbr } from '../src/constants/teams.js';
import { extractTable, parseRows, parseSalarySeasons, fetchCached, toNum } from './lib/bbref.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.cache');
const OUT_DIR = path.join(__dirname, '..', 'public', 'data');
const BASE = 'https://www.basketball-reference.com';
const SEASON = '2025-26';
const SEASON_TAG = 'NBA_2026';

const ONLY_TEAMS = (process.env.ONLY_TEAMS || '').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP_ADVANCED = process.env.SKIP_ADVANCED === '1';
const FORCE = process.env.FORCE === '1';
const log = (s) => console.log(s);

function cacheKey(name) { return FORCE ? `__force_${name}` : name; }
async function getPage(url, name) {
  const r = await fetchCached(url, cacheKey(name), { cacheDir: CACHE_DIR, log });
  return r.html;
}

const posGroupOf = (pos) => {
  const p = (pos || '').split('-')[0].trim();
  if (p === 'PG' || p === 'SG' || p === 'G') return 'G';
  if (p === 'SF' || p === 'PF' || p === 'F') return 'F';
  if (p === 'C') return 'C';
  return p || '?';
};

// ---- 1) Stats per-game -------------------------------------------------------
const PG_MAP = {
  name_display: 'name', age: 'ageSeason', team_name_abbr: 'statTeam', pos: 'pos',
  games: 'g', games_started: 'gs', mp_per_g: 'mpg',
  pts_per_g: 'pts', trb_per_g: 'trb', ast_per_g: 'ast', stl_per_g: 'stl',
  blk_per_g: 'blk', tov_per_g: 'tov', pf_per_g: 'pf',
  fg_per_g: 'fg', fga_per_g: 'fga', fg_pct: 'fgPct',
  fg3_per_g: 'fg3', fg3a_per_g: 'fg3a', fg3_pct: 'fg3Pct',
  ft_per_g: 'ft', fta_per_g: 'fta', ft_pct: 'ftPct', efg_pct: 'efgPct',
};
const NUM_PG = new Set(['ageSeason', 'g', 'gs', 'mpg', 'pts', 'trb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg', 'fga', 'fgPct', 'fg3', 'fg3a', 'fg3Pct', 'ft', 'fta', 'ftPct', 'efgPct']);

function parsePerGame(html) {
  const table = extractTable(html, 'per_game_stats');
  if (!table) throw new Error('Table per_game_stats introuvable');
  const rows = parseRows(table);
  const byId = new Map();
  for (const { playerId, cells } of rows) {
    if (!playerId) continue;
    const o = { id: playerId };
    for (const [k, v] of Object.entries(PG_MAP)) {
      let val = cells[k];
      if (NUM_PG.has(v)) val = toNum(val);
      o[v] = val ?? (NUM_PG.has(v) ? null : '');
    }
    // Joueur transféré : on garde la ligne au plus grand nb de matchs
    // (la ligne combinée 2TM/3TM = saison complète).
    const prev = byId.get(playerId);
    if (!prev || (o.g || 0) > (prev.g || 0)) byId.set(playerId, o);
  }
  return byId;
}

// ---- 2) Stats advanced -------------------------------------------------------
const ADV_MAP = { per: 'per', ts_pct: 'tsPct', usg_pct: 'usgPct', ws: 'ws', ws_per_48: 'ws48', bpm: 'bpm', obpm: 'obpm', dbpm: 'dbpm', vorp: 'vorp', mp: 'mpTotal', games: 'gAdv' };

function parseAdvanced(html) {
  const table = extractTable(html, 'advanced');
  if (!table) { log('  ! table advanced introuvable (skip)'); return new Map(); }
  const rows = parseRows(table);
  const byId = new Map();
  for (const { playerId, cells } of rows) {
    if (!playerId) continue;
    const o = { id: playerId };
    for (const [k, v] of Object.entries(ADV_MAP)) o[v] = toNum(cells[k]);
    const prev = byId.get(playerId);
    if (!prev || (o.gAdv || 0) > (prev.gAdv || 0)) byId.set(playerId, o);
  }
  return byId;
}

// ---- 3) Contrats par équipe --------------------------------------------------
function parseContracts(html, teamAbbr) {
  const table = extractTable(html, 'contracts');
  if (!table) { log(`  ! ${teamAbbr}: table contracts introuvable`); return { players: [], seasons: {} }; }
  const seasons = parseSalarySeasons(table); // { y1:'2025-26', ... }
  const rows = parseRows(table);
  const players = [];
  for (const { playerId, cells, csk, opts } of rows) {
    if (!playerId) continue; // saute les lignes Team Totals / Cap
    const salaries = {};
    const options = {}; // saison -> 'PO' | 'TO' | 'ETO' | 'NG'
    for (const yk of ['y1', 'y2', 'y3', 'y4', 'y5', 'y6']) {
      const season = seasons[yk];
      if (!season) continue;
      const val = csk[yk] != null ? toNum(csk[yk]) : toNum(cells[yk]);
      if (val != null && val > 0) {
        salaries[season] = val;
        if (opts && opts[yk]) options[season] = opts[yk];
      }
    }
    players.push({
      id: playerId,
      name: cells.player || '',
      ageToday: toNum(cells.age_today),
      remainGtd: toNum(cells.remain_gtd),
      notes: cells.notes || '',
      salaries,
      options,
    });
  }
  return { players, seasons };
}

// ---- 4) Roster (ancienneté / YOS, n° maillot, taille, fac) -------------------
function parseRoster(html) {
  const table = extractTable(html, 'roster');
  if (!table) return new Map();
  const rows = parseRows(table);
  const byId = new Map();
  for (const { playerId, cells } of rows) {
    if (!playerId) continue;
    const rawExp = (cells.years_experience || '').trim();
    const exp = rawExp === 'R' || rawExp === '' ? 0 : (toNum(rawExp) ?? 0);
    byId.set(playerId, {
      exp,
      number: cells.number || '',
      height: cells.height || '',
      weight: toNum(cells.weight),
      college: cells.college || '',
    });
  }
  return byId;
}

// ---- Orchestration -----------------------------------------------------------
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  log(`Scrape Basketball-Reference — saison ${SEASON}\n`);

  log('▶ Stats per-game');
  const perGame = parsePerGame(await getPage(`${BASE}/leagues/${SEASON_TAG}_per_game.html`, `leagues_${SEASON_TAG}_per_game.html`));
  log(`  ${perGame.size} joueurs (per-game)\n`);

  let advanced = new Map();
  if (!SKIP_ADVANCED) {
    log('▶ Stats advanced');
    advanced = parseAdvanced(await getPage(`${BASE}/leagues/${SEASON_TAG}_advanced.html`, `leagues_${SEASON_TAG}_advanced.html`));
    log(`  ${advanced.size} joueurs (advanced)\n`);
  }

  log('▶ Contrats (par équipe)');
  const teamsToFetch = ONLY_TEAMS.length ? TEAMS.filter((t) => ONLY_TEAMS.includes(t.abbr)) : TEAMS;
  const rosterById = new Map();   // id -> { team, ...contractRow }
  const failedTeams = [];
  let targetSeason = '2026-27';
  for (const t of teamsToFetch) {
    let html;
    try { html = await getPage(`${BASE}/contracts/${t.abbr}.html`, `contracts_${t.abbr}.html`); }
    catch (e) { log(`  ! ${t.abbr}: ${e.message}`); failedTeams.push(t.abbr); continue; }
    const { players, seasons } = parseContracts(html, t.abbr);
    if (seasons.y2) targetSeason = seasons.y2;
    for (const p of players) rosterById.set(p.id, { ...p, team: t.abbr });
    log(`  ${t.abbr}: ${players.length} contrats`);
  }
  log(`  saison cible (cap) = ${targetSeason}\n`);

  log('▶ Rosters (ancienneté / YOS)');
  const infoById = new Map();
  for (const t of teamsToFetch) {
    let html;
    try { html = await getPage(`${BASE}/teams/${t.abbr}/2026.html`, `teams_${t.abbr}_2026.html`); }
    catch (e) { log(`  ! ${t.abbr} roster: ${e.message}`); continue; }
    const info = parseRoster(html);
    for (const [id, v] of info) infoById.set(id, v);
  }
  log(`  ${infoById.size} joueurs avec ancienneté\n`);

  // ---- Fusion ----------------------------------------------------------------
  const allIds = new Set([...rosterById.keys(), ...perGame.keys()]);
  const players = [];
  for (const id of allIds) {
    const r = rosterById.get(id);
    const s = perGame.get(id);
    const a = advanced.get(id);
    const info = infoById.get(id);
    const rostered = !!r;
    const statTeam = s && /^[A-Z]{3}$/.test(s.statTeam || '') ? canonAbbr(s.statTeam) : null;
    const team = r ? r.team : statTeam || 'FA';
    const stats = s ? {
      g: s.g, gs: s.gs, mpg: s.mpg, pts: s.pts, trb: s.trb, ast: s.ast, stl: s.stl,
      blk: s.blk, tov: s.tov, fgPct: s.fgPct, fg3Pct: s.fg3Pct, ftPct: s.ftPct,
      efgPct: s.efgPct, fg3a: s.fg3a,
      per: a?.per ?? null, tsPct: a?.tsPct ?? null, usgPct: a?.usgPct ?? null,
      ws: a?.ws ?? null, bpm: a?.bpm ?? null, vorp: a?.vorp ?? null,
    } : null;
    const salaries = r ? r.salaries : {};
    players.push({
      id,
      name: (r && r.name) || (s && s.name) || id,
      team,
      rostered,
      status: rostered ? 'rostered' : 'free_agent',
      pos: (s && s.pos) || '',
      posGroup: posGroupOf(s && s.pos),
      age: (r && r.ageToday) ?? (s && s.ageSeason) ?? null,
      exp: info ? info.exp : null,
      college: info ? info.college : '',
      salaries,
      options: r ? r.options : {},
      salary2026: salaries[targetSeason] ?? null,
      onBooks2026: (salaries[targetSeason] ?? 0) > 0,
      contractEndsSeason: Object.keys(salaries).sort().slice(-1)[0] || null,
      stats,
    });
  }
  players.sort((x, y) => (y.stats?.pts ?? -1) - (x.stats?.pts ?? -1));

  // ---- Agrégats équipe -------------------------------------------------------
  const teamsOut = TEAMS.map((t) => {
    const roster = players.filter((p) => p.team === t.abbr && p.rostered);
    const committed2026 = roster.reduce((acc, p) => acc + (p.onBooks2026 ? p.salary2026 : 0), 0);
    return { ...t, rosterCount: roster.length, committed2026, targetSeason };
  });

  // ---- Écriture --------------------------------------------------------------
  const rosteredCount = players.filter((p) => p.rostered).length;
  const faCount = players.length - rosteredCount;
  const withStats = players.filter((p) => p.stats).length;
  fs.writeFileSync(path.join(OUT_DIR, 'players.json'), JSON.stringify(players));
  fs.writeFileSync(path.join(OUT_DIR, 'teams.json'), JSON.stringify(teamsOut, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify({
    season: SEASON, targetSeason, scrapedAt: new Date().toISOString(),
    counts: { total: players.length, rostered: rosteredCount, freeAgents: faCount, withStats },
    failedTeams,
  }, null, 2));

  log('▶ Résumé');
  log(`  total joueurs    : ${players.length}`);
  log(`  sous contrat     : ${rosteredCount}`);
  log(`  agents libres     : ${faCount}`);
  log(`  avec stats       : ${withStats}`);
  if (failedTeams.length) log(`  ! équipes échouées : ${failedTeams.join(', ')}`);
  log(`  -> ${path.relative(process.cwd(), OUT_DIR)}/players.json + teams.json + meta.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
