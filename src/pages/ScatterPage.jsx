import { useMemo, useState } from 'react';
import { C } from '../constants/palette.js';
import { TEAMS } from '../constants/teams.js';
import { num } from '../utils/format.js';
import { isEligible } from '../utils/rating.js';
import PlayerModal from '../components/PlayerModal.jsx';

const STATS = [
  { key: 'pts', label: 'Points' }, { key: 'trb', label: 'Rebonds' }, { key: 'ast', label: 'Passes' },
  { key: 'stl', label: 'Interceptions' }, { key: 'blk', label: 'Contres' },
  { key: 'fg3Pct', label: '3 pts %' }, { key: 'tsPct', label: 'TS %' }, { key: 'usgPct', label: 'Usage %' },
  { key: 'per', label: 'PER' }, { key: 'bpm', label: 'BPM' }, { key: 'vorp', label: 'VORP' },
  { key: 'ws', label: 'Win Shares' }, { key: 'mpg', label: 'Minutes' }, { key: 'rating', label: 'Note' },
];
const getVal = (p, key) => (key === 'rating' ? num(p.rating) : (p.stats?.[key] != null ? num(p.stats[key]) : null));
const ratingColor = (r) => (r >= 70 ? C.green : r >= 55 ? C.accent : r >= 45 ? C.yellow : C.muted);

const W = 640, H = 440, PAD = 48;

export default function ScatterPage({ players }) {
  const [x, setX] = useState('pts');
  const [y, setY] = useState('tsPct');
  const [team, setTeam] = useState('');
  const [fiche, setFiche] = useState(null);

  const pts = useMemo(() => players.filter((p) => p.stats && isEligible(p) && (!team || p.team === team)
    && getVal(p, x) != null && getVal(p, y) != null), [players, x, y, team]);

  const dom = useMemo(() => {
    const xs = pts.map((p) => getVal(p, x)), ys = pts.map((p) => getVal(p, y));
    const ext = (a) => { const mn = Math.min(...a), mx = Math.max(...a); const pad = (mx - mn) * 0.05 || 1; return [mn - pad, mx + pad]; };
    return { x: xs.length ? ext(xs) : [0, 1], y: ys.length ? ext(ys) : [0, 1] };
  }, [pts, x, y]);

  const sx = (v) => PAD + ((v - dom.x[0]) / (dom.x[1] - dom.x[0])) * (W - 2 * PAD);
  const sy = (v) => H - PAD - ((v - dom.y[0]) / (dom.y[1] - dom.y[0])) * (H - 2 * PAD);
  const xl = STATS.find((s) => s.key === x)?.label, yl = STATS.find((s) => s.key === y)?.label;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>📈 Nuage de points</h2>
        <label style={lbl}>X <select value={x} onChange={(e) => setX(e.target.value)} style={sel}>{STATS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
        <label style={lbl}>Y <select value={y} onChange={(e) => setY(e.target.value)} style={sel}>{STATS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={sel}>
          <option value="">Toutes équipes</option>
          {TEAMS.map((t) => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>{pts.length} joueurs · clique un point</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 20 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 860, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          {/* axes */}
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={C.border} strokeWidth="1.5" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={C.border} strokeWidth="1.5" />
          <text x={W / 2} y={H - 12} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.muted}>{xl}</text>
          <text x={16} y={H / 2} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.muted} transform={`rotate(-90 16 ${H / 2})`}>{yl}</text>
          {/* points */}
          {pts.map((p) => (
            <circle key={p.id} cx={sx(getVal(p, x))} cy={sy(getVal(p, y))} r="4" fill={ratingColor(num(p.rating))} fillOpacity="0.8" stroke={C.bg} strokeWidth="0.5" style={{ cursor: 'pointer' }} onClick={() => setFiche(p)}>
              <title>{p.name} ({p.team}) — {xl}: {getVal(p, x)} · {yl}: {getVal(p, y)}</title>
            </circle>
          ))}
        </svg>
      </div>

      {fiche && <PlayerModal player={fiche} players={players} onSelect={setFiche} onClose={() => setFiche(null)} />}
    </div>
  );
}

const sel = { background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', fontSize: 12, cursor: 'pointer' };
const lbl = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted };
