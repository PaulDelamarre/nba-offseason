import { useMemo, useState } from 'react';
import { C } from '../constants/palette.js';
import { CAP_YEARS } from '../constants/cba.js';
import { fmtUSD } from '../utils/format.js';
import { teamSalary, rosterCount, tradeableRoster } from '../utils/players.js';
import { capSummary } from '../utils/cap.js';
import { TeamChip, TierBadge, PlayerAvatar } from '../components/ui.jsx';
import PlayerModal from '../components/PlayerModal.jsx';

export default function TeamsPage({ players, teams }) {
  const [season, setSeason] = useState('2026-27');
  const [selected, setSelected] = useState(null); // abbr de l'équipe affichée à droite
  const [fiche, setFiche] = useState(null);       // joueur dont on ouvre la fiche

  const rows = useMemo(() => teams.map((t) => {
    const salary = teamSalary(players, t.abbr, season);
    return { ...t, salary, count: rosterCount(players, t.abbr, season), sum: capSummary(salary, season) };
  }).sort((a, b) => b.salary - a.salary), [players, teams, season]);

  const roster = useMemo(() => (selected ? tradeableRoster(players, selected, season) : []), [players, selected, season]);
  const selTeam = selected ? rows.find((t) => t.abbr === selected) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>🏀 Équipes</div>
        <select value={season} onChange={(e) => setSeason(e.target.value)} style={selStyle}>
          {Object.entries(CAP_YEARS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: C.muted }}>Clique une équipe pour voir son effectif →</span>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>cap {fmtUSD(CAP_YEARS[season].salaryCap)} · tax {fmtUSD(CAP_YEARS[season].luxuryTax)}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Grille des équipes (sélectionnable) */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12, alignContent: 'start' }}>
          {rows.map((t) => {
            const active = t.abbr === selected;
            return (
              <div key={t.abbr} onClick={() => setSelected(t.abbr)}
                style={{ background: active ? C.surface2 : C.surface, border: `1px solid ${active ? t.colors[0] : C.border}`, borderRadius: 12, padding: 14, borderLeft: `4px solid ${t.colors[0]}`, cursor: 'pointer', boxShadow: active ? `0 0 0 2px ${t.colors[0]}66` : 'none', transition: 'box-shadow 0.1s' }}>
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
            );
          })}
        </div>

        {/* Panneau latéral : effectif de l'équipe sélectionnée */}
        {selTeam && (
          <RosterPanel team={selTeam} roster={roster} season={season} onClose={() => setSelected(null)} onPlayer={setFiche} />
        )}
      </div>

      {fiche && <PlayerModal player={fiche} players={players} onSelect={setFiche} onClose={() => setFiche(null)} />}
    </div>
  );
}

function RosterPanel({ team, roster, season, onClose, onPlayer }) {
  const total = roster.reduce((a, p) => a + (p._salary || 0), 0);
  return (
    <div style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${C.border}`, background: C.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, borderTop: `4px solid ${team.colors[0]}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TeamChip abbr={team.abbr} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{team.name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{team.conf} · {roster.length} joueurs</div>
          </div>
          <button onClick={onClose} title="Fermer" style={closeBtn}>✕</button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TierBadge tier={team.sum.tier} />
          <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(total)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{team.sum.room > 0 ? `Room ${fmtUSD(team.sum.room)}` : `Over ${fmtUSD(team.sum.overCap)}`}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px 12px' }}>
        {roster.map((p) => (
          <div key={p.id} onClick={() => onPlayer(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', borderRadius: 8 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <PlayerAvatar player={p} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{p.pos} · {p.age} ans</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(p._salary)}</div>
          </div>
        ))}
        {!roster.length && <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Aucun joueur sous contrat {season}.</div>}
      </div>
    </div>
  );
}

const selStyle = { background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', fontSize: 12, cursor: 'pointer' };
const closeBtn = { background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, padding: '3px 9px', fontSize: 13, cursor: 'pointer' };
