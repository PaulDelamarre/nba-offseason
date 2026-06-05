import { useMemo, useState } from 'react';
import { C, OPTION_COLORS, OPTION_LABEL } from '../constants/palette.js';
import { TEAMS } from '../constants/teams.js';
import { fmtUSD, num } from '../utils/format.js';
import { salaryFor } from '../utils/players.js';
import { TeamChip, PlayerAvatar } from '../components/ui.jsx';
import PlayerModal from '../components/PlayerModal.jsx';

// Saison suivante : "2027-28" -> "2028-29" (année de départ en UFA).
function nextSeason(s) {
  if (!s) return null;
  const y = Number(s.slice(0, 4));
  return `${y + 1}-${String((y + 2) % 100).padStart(2, '0')}`;
}

const SEASON = '2026-27';
const COLS = [
  { key: '_rating', label: 'NOTE', w: 50, num: true },
  { key: 'pts', label: 'PTS', w: 56, num: true, stat: true },
  { key: 'trb', label: 'REB', w: 56, num: true, stat: true },
  { key: 'ast', label: 'AST', w: 56, num: true, stat: true },
  { key: 'bpm', label: 'BPM', w: 56, num: true, stat: true },
  { key: '_salary', label: '2026-27', w: 90, num: true },
];

export default function PlayersPage({ players }) {
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');
  const [pos, setPos] = useState('');
  const [status, setStatus] = useState('');
  const [ratingMin, setRatingMin] = useState(0);
  const [ageMax, setAgeMax] = useState(0);
  const [sort, setSort] = useState('_rating');
  const [sel, setSel] = useState(null);

  const rows = useMemo(() => players
    .map((p) => ({ ...p, _rating: num(p.rating), _salary: salaryFor(p, SEASON) }))
    .filter((p) =>
      (!team || p.team === team)
      && (!pos || pos5(p) === pos)
      && (ratingMin <= 0 || p._rating >= ratingMin)
      && (!ageMax || num(p.age) <= ageMax)
      && matchStatus(p, status)
      && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => valOf(b, sort) - valOf(a, sort)), [players, q, team, pos, status, ratingMin, ageMax, sort]);

  const hasFilters = team || pos || status || ratingMin > 0 || ageMax > 0 || q;
  const resetFilters = () => { setQ(''); setTeam(''); setPos(''); setStatus(''); setRatingMin(0); setAgeMax(0); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginRight: 4 }}>👤 Joueurs</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" style={{ ...inputStyle, width: 160 }} />
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={selStyle}>
          <option value="">Toutes équipes</option>
          {TEAMS.map((t) => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}
        </select>
        <select value={pos} onChange={(e) => setPos(e.target.value)} style={selStyle}>
          <option value="">Tous postes</option>
          {['PG', 'SG', 'SF', 'PF', 'C'].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={selStyle}>
          <option value="">Tout statut</option>
          <option value="rostered">Sous contrat 26-27</option>
          <option value="fa">Agent libre 2026</option>
          <option value="expiring">Contrat expirant</option>
          <option value="po">A une player option</option>
          <option value="to">A une team option</option>
        </select>
        <label style={lblStyle}>Note ≥ <input type="number" min={0} max={99} value={ratingMin || ''} onChange={(e) => setRatingMin(num(e.target.value))} style={numStyle} /></label>
        <label style={lblStyle}>Âge ≤ <input type="number" min={0} max={50} value={ageMax || ''} onChange={(e) => setAgeMax(num(e.target.value))} style={numStyle} /></label>
        {hasFilters && <button onClick={resetFilters} style={selStyle}>↺ reset</button>}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: C.muted }}>
          {['PO', 'TO', 'UFA'].map((k) => <span key={k} style={{ color: OPTION_COLORS[k], fontWeight: 700 }}>■ {OPTION_LABEL[k]}</span>)}
          <span>{rows.length} joueurs</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, background: C.surface, zIndex: 1 }}>
            <tr style={{ color: C.muted, textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', fontWeight: 600 }}>Joueur</th>
              <th style={{ padding: '10px 8px', fontWeight: 600 }}>Équipe</th>
              <th style={{ padding: '10px 8px', fontWeight: 600 }}>Pos</th>
              {COLS.map((c) => (
                <th key={c.key} onClick={() => setSort(c.key)} style={{ padding: '10px 8px', textAlign: 'right', cursor: 'pointer', width: c.w, color: sort === c.key ? C.accent : C.muted, fontWeight: 600 }}>{c.label}</th>
              ))}
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>Contrat</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 400).map((p) => (
              <tr key={p.id} onClick={() => setSel(p)} style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '6px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PlayerAvatar player={p} size={32} />
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: C.muted, fontSize: 11 }}>{p.age}a</span>
                  </div>
                </td>
                <td style={{ padding: '6px 8px' }}><TeamChip abbr={p.team} size={24} /></td>
                <td style={{ padding: '6px 8px', color: C.muted }}>{p.pos || '—'}</td>
                {COLS.map((c) => {
                  if (c.key === '_salary') {
                    const opt = p.options?.[SEASON];
                    return (
                      <td key={c.key} title={opt ? OPTION_LABEL[opt] : ''} style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: opt ? 700 : 400, color: p._salary ? (opt ? OPTION_COLORS[opt] : C.text) : C.muted, background: opt ? `${OPTION_COLORS[opt]}22` : 'transparent' }}>
                        {p._salary ? <>{fmtUSD(p._salary)}{opt && <sup style={{ fontSize: 8 }}>{opt}</sup>}</> : '—'}
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.muted }}>{cellVal(p, c)}</td>
                  );
                })}
                <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{contractCell(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 400 && <div style={{ padding: 12, color: C.muted, fontSize: 12, textAlign: 'center' }}>… {rows.length - 400} de plus (affine la recherche)</div>}
      </div>
      {sel && <PlayerModal player={sel} players={players} onSelect={setSel} onClose={() => setSel(null)} />}
    </div>
  );
}

const pos5 = (p) => (p.pos || '').split('-')[0].trim();
function matchStatus(p, status) {
  if (!status) return true;
  const on26 = num(p.salaries?.['2026-27']) > 0;
  if (status === 'rostered') return on26;
  if (status === 'fa') return !on26;
  if (status === 'expiring') return on26 && p.contractEndsSeason === '2026-27';
  if (status === 'po') return Object.values(p.options || {}).includes('PO');
  if (status === 'to') return Object.values(p.options || {}).includes('TO');
  return true;
}

function contractCell(p) {
  const has26 = num(p.salaries?.['2026-27']) > 0;
  if (!has26) return <span style={{ color: OPTION_COLORS.UFA, fontWeight: 700, fontSize: 11 }}>FA 2026</span>;
  const end = p.contractEndsSeason;
  const lastOpt = p.options?.[end];
  const ufa = nextSeason(end);
  return (
    <span style={{ fontSize: 11 }}>
      <span style={{ color: lastOpt ? OPTION_COLORS[lastOpt] : C.muted }} title={lastOpt ? OPTION_LABEL[lastOpt] : ''}>→ {end}{lastOpt ? ` ${lastOpt}` : ''}</span>
      {ufa && <span style={{ color: OPTION_COLORS.UFA, marginLeft: 5 }}>UFA {ufa.slice(0, 4)}</span>}
    </span>
  );
}

function valOf(p, key) {
  if (key === '_rating' || key === '_salary') return p[key] || 0;
  return Number(p.stats?.[key]) || -999;
}
function cellVal(p, c) {
  if (c.key === '_salary') return p._salary ? fmtUSD(p._salary) : '—';
  if (c.key === '_rating') return p._rating || '–';
  const v = p.stats?.[c.key];
  return v == null ? '—' : Number(v).toFixed(1);
}

const selStyle = { background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 8px', fontSize: 12, cursor: 'pointer' };
const inputStyle = { background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 9px', fontSize: 12 };
const lblStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted };
const numStyle = { background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 6px', fontSize: 12, width: 52 };
