import { useMemo, useState } from 'react';
import { C } from '../constants/palette.js';
import { TEAM_BY_ABBR } from '../constants/teams.js';
import { num } from '../utils/format.js';
import { buildPools, playerRadar, RADAR, COMPARE_STATS } from '../utils/compare.js';
import { TeamChip, PlayerPhoto } from '../components/ui.jsx';

const A_COL = C.accent;   // joueur A = orange
const B_COL = C.blue;     // joueur B = cyan

export default function ComparePage({ players }) {
  const rated = useMemo(() => players.filter((p) => p.stats && p.rating).sort((a, b) => b.rating - a.rating), [players]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const pools = useMemo(() => buildPools(players), [players]);

  const [idA, setIdA] = useState(rated[0]?.id || '');
  const [idB, setIdB] = useState(rated[1]?.id || '');
  const A = byId.get(idA);
  const B = byId.get(idB);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>📊 Comparateur</h2>
        <PlayerPicker players={rated} value={idA} onChange={setIdA} color={A_COL} />
        <span style={{ color: C.muted, fontWeight: 800 }}>VS</span>
        <PlayerPicker players={rated} value={idB} onChange={setIdB} color={B_COL} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Radar */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, textAlign: 'center' }}>
            <Radar a={A} b={B} pools={pools} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 6, fontSize: 12 }}>
              <span style={{ color: A_COL, fontWeight: 700 }}>■ {A?.name.split(' ').slice(-1)[0] || '—'}</span>
              <span style={{ color: B_COL, fontWeight: 700 }}>■ {B?.name.split(' ').slice(-1)[0] || '—'}</span>
            </div>
          </div>

          {/* En-têtes joueurs + table de stats */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <PlayerHead p={A} color={A_COL} />
              <PlayerHead p={B} color={B_COL} />
            </div>
            <div style={{ marginTop: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {COMPARE_STATS.map((s) => {
                const va = A?.stats?.[s.key];
                const vb = B?.stats?.[s.key];
                const aWin = va != null && vb != null && va > vb;
                const bWin = va != null && vb != null && vb > va;
                return (
                  <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 1fr', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ textAlign: 'right', padding: '8px 12px', fontWeight: aWin ? 800 : 500, color: aWin ? A_COL : C.text, fontVariantNumeric: 'tabular-nums' }}>{va != null ? s.fmt(va) : '—'}</div>
                    <div style={{ textAlign: 'center', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
                    <div style={{ textAlign: 'left', padding: '8px 12px', fontWeight: bWin ? 800 : 500, color: bWin ? B_COL : C.text, fontVariantNumeric: 'tabular-nums' }}>{vb != null ? s.fmt(vb) : '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerPicker({ players, value, onChange, color }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ background: C.surface2, color: C.text, border: `2px solid ${color}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer', maxWidth: 240 }}>
      {players.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.team} ({num(p.rating)})</option>)}
    </select>
  );
}

function PlayerHead({ p, color }) {
  if (!p) return <div />;
  const t = TEAM_BY_ABBR[p.team];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: `2px solid ${color}`, borderRadius: 12, padding: 12 }}>
      <PlayerPhoto player={p} size={52} round={false} />
      <div style={{ minWidth: 0 }}>
        <div className="cond" style={{ fontWeight: 700, fontSize: 16, textTransform: 'uppercase', lineHeight: 1.05 }}>{p.name}</div>
        <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}><TeamChip abbr={p.team} size={15} /> {p.pos} · {p.age} ans · <b style={{ color }}>{num(p.rating)}</b></div>
      </div>
    </div>
  );
}

/* Radar hexagonal comparant 2 joueurs (percentiles ligue). */
function Radar({ a, b, pools }) {
  const CX = 150, CY = 150, R = 105;
  const ra = a ? playerRadar(a, pools) : null;
  const rb = b ? playerRadar(b, pools) : null;
  const pt = (i, frac) => {
    const ang = (-90 + i * 60) * Math.PI / 180;
    return [CX + Math.cos(ang) * R * frac, CY + Math.sin(ang) * R * frac];
  };
  const poly = (radar) => radar.map((r, i) => pt(i, r.pct).join(',')).join(' ');

  return (
    <svg viewBox="0 0 300 300" style={{ width: '100%', maxWidth: 300 }}>
      {/* grille */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={RADAR.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke={C.border} strokeWidth="1" />
      ))}
      {RADAR.map((r, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.18);
        return (
          <g key={r.key}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke={C.border} strokeWidth="1" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={C.muted}>{r.label}</text>
          </g>
        );
      })}
      {rb && <polygon points={poly(rb)} fill={`${B_COL}33`} stroke={B_COL} strokeWidth="2" />}
      {ra && <polygon points={poly(ra)} fill={`${A_COL}33`} stroke={A_COL} strokeWidth="2" />}
    </svg>
  );
}
