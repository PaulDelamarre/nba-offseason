// Parser Basketball-Reference, sans dépendance externe.
// Les tables BBRef sont générées automatiquement : chaque cellule porte un
// attribut `data-stat="..."` stable, ce qui rend un parsing par regex fiable.
// Certaines tables secondaires sont planquées dans des commentaires HTML
// (<!-- ... -->) pour le lazy-load : on « décommente » tout par sécurité.

import fs from 'node:fs';
import path from 'node:path';

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function uncomment(html) {
  return html.replace(/<!--/g, '').replace(/-->/g, '');
}

// Décode les quelques entités HTML qu'on croise dans les noms.
function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;|&apos;/g, "'")
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü')
    .replace(/&ntilde;/g, 'ñ').replace(/&#\d+;/g, '');
}

function stripTags(s) {
  return decode(String(s).replace(/<[^>]*>/g, '')).trim();
}

// Isole le <table id="..."> ... </table> demandé (après décommentage).
export function extractTable(html, tableId) {
  const clean = uncomment(html);
  const marker = `id="${tableId}"`;
  const idIdx = clean.indexOf(marker);
  if (idIdx === -1) return null;
  const tableStart = clean.lastIndexOf('<table', idIdx);
  const tableEnd = clean.indexOf('</table>', idIdx);
  if (tableStart === -1 || tableEnd === -1) return null;
  return clean.slice(tableStart, tableEnd + 8);
}

// Mappe les en-têtes de colonnes salariales y1..y6 -> libellé de saison
// (ex. { y1: '2025-26', y2: '2026-27', ... }). Robuste au changement d'année.
export function parseSalarySeasons(tableHtml) {
  const out = {};
  const re = /data-stat="(y[1-6])"[^>]*>\s*(\d{4}-\d{2})\s*</g;
  let m;
  while ((m = re.exec(tableHtml))) out[m[1]] = m[2];
  return out;
}

const CELL_RE = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/g;
const TR_RE = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/g;

// Parse les lignes <tr> d'une table en objets { playerId, cells:{stat:text},
// csk:{stat:rawNumber} }. Saute les lignes d'en-tête répétées (class thead).
export function parseRows(tableHtml) {
  let body = tableHtml;
  const tb = tableHtml.indexOf('<tbody>');
  if (tb !== -1) {
    const tbe = tableHtml.indexOf('</tbody>', tb);
    body = tableHtml.slice(tb, tbe === -1 ? undefined : tbe);
  }
  const rows = [];
  let m;
  TR_RE.lastIndex = 0;
  while ((m = TR_RE.exec(body))) {
    const trAttrs = m[1] || '';
    if (/class="[^"]*thead/.test(trAttrs)) continue;
    const rowHtml = m[2];
    const cells = {};
    const csk = {};
    const opts = {}; // stat -> 'PO' | 'TO' | 'ETO' | 'NG' (classe salary-pl/tm/et/ng)
    let playerId = null;
    let cm;
    CELL_RE.lastIndex = 0;
    while ((cm = CELL_RE.exec(rowHtml))) {
      const attrs = cm[2] || '';
      const inner = cm[3] || '';
      const ds = /data-stat="([^"]+)"/.exec(attrs);
      if (!ds) continue;
      const stat = ds[1];
      cells[stat] = stripTags(inner);
      const cskM = /csk="([^"]*)"/.exec(attrs);
      if (cskM) csk[stat] = cskM[1];
      const optM = /salary-(pl|tm|et|ng)/.exec(attrs);
      if (optM) opts[stat] = { pl: 'PO', tm: 'TO', et: 'ETO', ng: 'NG' }[optM[1]];
      if (!playerId) {
        const ac = /data-append-csv="([^"]+)"/.exec(attrs);
        if (ac) playerId = ac[1];
      }
      if (!playerId) {
        const href = /href=['"]\/players\/[a-z]\/([a-z0-9]+)\.html['"]/.exec(inner);
        if (href) playerId = href[1];
      }
      // Pages contrats : l'id joueur est aussi dans csk="<id>" du <th> "player".
      if (!playerId && stat === 'player' && cskM && /[a-z]/i.test(cskM[1])) {
        playerId = cskM[1];
      }
    }
    if (!Object.keys(cells).length) continue;
    rows.push({ playerId, cells, csk, opts });
  }
  return rows;
}

// Récupère une page avec cache disque (re-runs sans re-frapper BBRef) et délai
// poli avant tout vrai appel réseau. BBRef tolère ~20 req/min : 3.5 s entre
// deux requêtes réseau garde une marge confortable.
export async function fetchCached(url, cacheKey, { cacheDir, delayMs = 3500, log = () => {} } = {}) {
  const file = path.join(cacheDir, cacheKey);
  if (fs.existsSync(file)) {
    log(`  cache  ${cacheKey}`);
    return { html: fs.readFileSync(file, 'utf8'), cached: true };
  }
  await new Promise((r) => setTimeout(r, delayMs));
  log(`  fetch  ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(file, html);
  return { html, cached: false };
}

export const toNum = (v) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};
