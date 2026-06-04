import { useMemo, useState } from 'react';
import { C } from '../constants/palette.js';
import { CAP_YEARS } from '../constants/cba.js';
import { fmtUSD } from '../utils/format.js';
import { teamSalary, rosterCount } from '../utils/players.js';
import { capSummary } from '../utils/cap.js';
import { TeamChip, TierBadge } from '../components/ui.jsx';

export default function TeamsPage({ players, teams }) {
  const [season, setSeason] = useState('2026-27');
  const rows = useMemo(() => teams.map((t) => {
    const salary = teamSalary(players, t.abbr, season);
    return { ...t, salary, count: rosterCount(players, t.abbr, season), sum: capSummary(salary, season) };
  }).sort((a, b) => b.salary - a.salary), [players, teams, season]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>🏀 Équipes</div>
        <select value={season} onChange={(e) => setSeason(e.target.value)} style={selStyle}>
          {Object.entries(CAP_YEARS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>cap {fmtUSD(CAP_YEARS[season].salaryCap)} · tax {fmtUSD(CAP_YEARS[season].luxuryTax)}</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 12, alignContent: 'start' }}>
        {rows.map((t) => (
          <div key={t.abbr} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, borderLeft: `4px solid ${t.colors[0]}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TeamChip abbr={t.abbr} size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{t.conf} · {t.count} joueurs sous contrat</div>
              </div>
              <TierBadge tier={t.sum.tier} />
            </div>
            <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(t.salary)}</div>
            <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (t.salary / CAP_YEARS[season].secondApron) * 100)}%`, height: '100%', background: t.colors[0] }} />
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
              <span>{t.sum.room > 0 ? `Room ${fmtUSD(t.sum.room)}` : `Over cap ${fmtUSD(t.sum.overCap)}`}</span>
              <span>{t.sum.taxBill > 0 ? `Tax ${fmtUSD(t.sum.taxBill)}` : 'Pas de tax'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const selStyle = { background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', fontSize: 12, cursor: 'pointer' };
