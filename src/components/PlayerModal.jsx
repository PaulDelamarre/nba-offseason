import { C, OPTION_COLORS, OPTION_LABEL } from '../constants/palette.js';
import { TEAM_BY_ABBR } from '../constants/teams.js';
import { fmtUSD, fmtStat, fmtPct, fmtPct3, num } from '../utils/format.js';
import { TeamChip, PlayerPhoto } from './ui.jsx';

const nextSeason = (s) => (s ? `${Number(s.slice(0, 4)) + 1}-${String((Number(s.slice(0, 4)) + 2) % 100).padStart(2, '0')}` : null);

// Fiche joueur : photo, identité, stats 2025-26, contrat (options + UFA).
export default function PlayerModal({ player, onClose }) {
  if (!player) return null;
  const s = player.stats;
  const t = TEAM_BY_ABBR[player.team];
  const seasons = Object.keys(player.salaries || {}).sort();
  const end = seasons.length ? seasons[seasons.length - 1] : null;
  const ufa = end ? nextSeason(end) : null;
  const total = seasons.reduce((a, k) => a + num(player.salaries[k]), 0);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="tcard" style={{ '--card-accent': t?.colors[0] || C.accent, '--card-glow': t?.colors[0] || C.accent, width: 'min(680px, 96vw)', maxHeight: '90vh', overflow: 'auto', borderRadius: 16 }}>
        {/* En-tête */}
        <div style={{ display: 'flex', gap: 16, padding: 18, borderBottom: `1px solid ${C.border}` }}>
          <PlayerPhoto player={player} size={92} round={false} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{player.name}</h2>
              <button onClick={onClose} style={{ marginLeft: 'auto', background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, color: C.muted, fontSize: 13 }}>
              <TeamChip abbr={player.team} size={22} /> {t?.name || player.team} · {player.pos || '—'} · {player.age} ans
              {player.exp != null && <span>· {player.exp} ans NBA</span>}
              {player.college && <span>· {player.college}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Note</div>
            <div className="cond" style={{ fontSize: 42, fontWeight: 700, color: ratingColor(num(player.rating)), textShadow: `0 0 16px ${ratingColor(num(player.rating))}55` }}>{num(player.rating) || '–'}</div>
          </div>
        </div>

        {/* Stats 2025-26 */}
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 8 }}>STATS 2025-26 {s && <span style={{ fontWeight: 400 }}>· {fmtStat(s.g, 0)} matchs · {fmtStat(s.mpg)} min</span>}</div>
          {s ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 8 }}>
              <StatTile label="PTS" value={fmtStat(s.pts)} big />
              <StatTile label="REB" value={fmtStat(s.trb)} big />
              <StatTile label="AST" value={fmtStat(s.ast)} big />
              <StatTile label="STL" value={fmtStat(s.stl)} />
              <StatTile label="BLK" value={fmtStat(s.blk)} />
              <StatTile label="FG%" value={fmtPct3(s.fgPct)} />
              <StatTile label="3P%" value={fmtPct3(s.fg3Pct)} />
              <StatTile label="FT%" value={fmtPct3(s.ftPct)} />
              <StatTile label="TS%" value={fmtPct(s.tsPct)} />
              <StatTile label="USG%" value={fmtPct(s.usgPct)} />
              <StatTile label="PER" value={fmtStat(s.per)} />
              <StatTile label="BPM" value={fmtStat(s.bpm)} />
              <StatTile label="VORP" value={fmtStat(s.vorp)} />
              <StatTile label="WS" value={fmtStat(s.ws)} />
            </div>
          ) : <div style={{ color: C.muted, fontSize: 13 }}>Pas de stats 2025-26 (rookie, peu de minutes ou blessé).</div>}
        </div>

        {/* Contrat */}
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 8 }}>CONTRAT</div>
          {seasons.length ? (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {seasons.map((k) => {
                const opt = player.options?.[k];
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ width: 70, color: C.muted, fontSize: 13 }}>{k}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.surface2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (num(player.salaries[k]) / 60_000_000) * 100)}%`, height: '100%', background: opt ? OPTION_COLORS[opt] : t?.colors[0] || C.accent }} />
                    </div>
                    {opt && <span style={{ fontSize: 10, fontWeight: 800, color: OPTION_COLORS[opt] }} title={OPTION_LABEL[opt]}>{opt}</span>}
                    <span style={{ width: 96, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(player.salaries[k])}</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', fontSize: 13 }}>
                <span style={{ flex: 1, color: C.muted }}>{ufa ? <>Agent libre en <b style={{ color: OPTION_COLORS.UFA }}>{ufa.slice(0, 4)}</b></> : ''}</span>
                <span style={{ color: C.muted }}>total&nbsp;</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(total)}</b>
              </div>
            </div>
          ) : <div style={{ color: OPTION_COLORS.UFA, fontWeight: 700, fontSize: 13 }}>Agent libre 2026 (pas de contrat 2026-27).</div>}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, big }) {
  return (
    <div style={{ background: C.bg, border: `2px solid ${C.border}`, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
      <div className="cond" style={{ fontSize: big ? 21 : 16, fontWeight: 700, color: big ? C.accent : C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function ratingColor(r) {
  return r >= 70 ? C.green : r >= 55 ? C.accent : r >= 45 ? C.yellow : C.muted;
}
