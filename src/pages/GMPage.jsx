import { useMemo, useState, useEffect } from 'react';
import { C, OPTION_COLORS, OPTION_LABEL } from '../constants/palette.js';
import { TEAMS, TEAM_BY_ABBR } from '../constants/teams.js';
import { CAP_YEARS, ROSTER } from '../constants/cba.js';
import { fmtUSD, fmtUSDfull, num } from '../utils/format.js';
import {
  isFreeAgent, faType, capHold, availableMethods, teamCapState, signingHardCap,
  minSalary, maxSalary, yearsOfService, deadMoneyFor, guaranteedRemaining,
  canExtend, extensionSchedule, maxExtensionYears, teamCommitmentsByYear, lastGuaranteedSeason,
  deadMoneyByYear,
} from '../utils/contracts.js';
import { effectiveTeam } from '../utils/players.js';
import { nextPick, teamAt, takenRanks, picksOfTeam, LAST_PICK, rookieSalary, prospectPosGroup } from '../utils/draft.js';
import { anyPickLabel, slotPickLabel } from '../utils/picks.js';
import { PROSPECTS_2026, PROSPECT_STATS } from '../constants/draft.js';
import { capSummary } from '../utils/cap.js';
import { useGM } from '../context/GMContext.jsx';
import { TeamChip, TierBadge, ImpactBubble, PlayerAvatar } from '../components/ui.jsx';
import PlayerModal from '../components/PlayerModal.jsx';
import TradePage from './TradePage.jsx';

export default function GMPage({ players }) {
  const gm = useGM();
  const { myTeam, season } = gm.state;
  if (!myTeam) return <TeamPicker onPick={gm.setTeam} />;
  return <GMDashboard players={players} gm={gm} myTeam={myTeam} season={season} />;
}

function TeamPicker({ onPick }) {
  return (
    <div style={{ overflow: 'auto', padding: 40 }}>
      <h1 style={{ fontSize: 28 }}>Choisis ta franchise</h1>
      <p style={{ color: C.muted }}>Tu gères cette équipe pour l'entresaison 2026 : free agency, re-signatures, waive &amp; stretch, cap.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 10, marginTop: 20 }}>
        {TEAMS.map((t) => (
          <button key={t.abbr} onClick={() => onPick(t.abbr)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, cursor: 'pointer', background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderLeft: `4px solid ${t.colors[0]}`, textAlign: 'left' }}>
            <TeamChip abbr={t.abbr} /> <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GMDashboard({ players, gm, myTeam, season }) {
  const [tab, setTab] = useState('roster'); // 'roster' | 'trade' | 'fa' | 'draft' | 'recap'
  const [fiche, setFiche] = useState(null); // fiche joueur (modal)
  const draftedResolved = useMemo(() => picksOfTeam(gm.state.draftPicks, myTeam, season, gm.slotOwners), [gm.state.draftPicks, myTeam, season, gm.slotOwners]);
  const cap = useMemo(
    () => teamCapState(players, myTeam, season, { signings: gm.state.signings, renounced: gm.renouncedSet, waived: gm.state.waived, drafted: draftedResolved, moveMap: gm.moveMap }),
    [players, myTeam, season, gm.state.signings, gm.renouncedSet, gm.state.waived, draftedResolved, gm.moveMap],
  );
  const taxSum = capSummary(cap.taxSalary, season);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header équipe + cap */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
        <TeamChip abbr={myTeam} size={34} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{TEAM_BY_ABBR[myTeam]?.name}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Mode GM · {CAP_YEARS[season].label}</div>
        </div>
        <div style={{ display: 'flex', gap: 18, marginLeft: 24, flexWrap: 'wrap' }}>
          <Metric label="Cap room" value={fmtUSD(cap.capRoomAvail)} color={cap.capRoomAvail > 0 ? C.green : C.muted} />
          <Metric label="Masse (tax)" value={fmtUSD(cap.taxSalary)} />
          <Metric label="Cap holds" value={fmtUSD(cap.holds)} color={C.muted} />
          {cap.draftedSalary > 0 && <Metric label="Recrues" value={fmtUSD(cap.draftedSalary)} color={C.blue} />}
          {cap.deadMoney > 0 && <Metric label="Dead money" value={fmtUSD(cap.deadMoney)} color={C.red} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: C.muted }}>Statut</span>
            <TierBadge tier={taxSum.tier} />
          </div>
        </div>
        <SavesBar gm={gm} />
        <button onClick={() => gm.setTeam(null)} style={btn}>changer d'équipe</button>
        <button onClick={gm.reset} style={btn}>↺ reset été</button>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={() => setTab('roster')} style={tabStyle(tab === 'roster')}>📋 Effectif &amp; Cap</button>
        <button onClick={() => setTab('trade')} style={tabStyle(tab === 'trade')}>🔄 Trades</button>
        <button onClick={() => setTab('fa')} style={tabStyle(tab === 'fa')}>✍ Free Agency</button>
        <button onClick={() => setTab('draft')} style={tabStyle(tab === 'draft')}>🎟 Draft 2026</button>
        <button onClick={() => setTab('recap')} style={tabStyle(tab === 'recap')}>📊 Récap</button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'roster' && <RosterTab players={players} gm={gm} myTeam={myTeam} season={season} cap={cap} openFiche={setFiche} />}
        {tab === 'trade' && <TradePage players={players} lockTeam={myTeam} />}
        {tab === 'fa' && <FreeAgencyTab players={players} gm={gm} myTeam={myTeam} season={season} cap={cap} openFiche={setFiche} />}
        {tab === 'draft' && <DraftTab gm={gm} season={season} myTeam={myTeam} />}
        {tab === 'recap' && <RecapTab players={players} gm={gm} myTeam={myTeam} season={season} cap={cap} />}
      </div>

      {fiche && <PlayerModal player={fiche} players={players} onSelect={setFiche} onClose={() => setFiche(null)} />}
    </div>
  );
}

/* ----------------------------- Onglet Effectif ----------------------------- */
function RosterTab({ players, gm, myTeam, season, cap, openFiche }) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const waivedMap = new Map(gm.state.waived.map((w) => [w.playerId, w.mode]));

  const contract = useMemo(() => players
    .filter((p) => effectiveTeam(p, gm.moveMap) === myTeam && num(p.salaries?.['2026-27']) > 0)
    .map((p) => ({ ...p, _rating: num(p.rating), _sal: num(p.salaries['2026-27']), _acquired: gm.moveMap[p.id] === myTeam && p.team !== myTeam }))
    .sort((a, b) => b._sal - a._sal), [players, myTeam, gm.moveMap]);

  const signings = gm.state.signings;
  const [extendSel, setExtendSel] = useState(null);
  const extMap = new Map(gm.state.extensions.map((e) => [e.playerId, e]));
  const payrollByYear = teamCommitmentsByYear(players, myTeam, gm.state.extensions, gm.moveMap, gm.state.waived);

  // 5 majeur : joueurs disponibles = roster effectif (non libéré) + recrues FA + recrues draft.
  const myDraft = picksOfTeam(gm.state.draftPicks, myTeam, season, gm.slotOwners);
  // Les rookies draftés ne sont pas dans le dataset : on fabrique un « joueur »
  // synthétique (id dft-<pick>) pour qu'ils apparaissent au banc / sur le terrain.
  const draftRookies = useMemo(() => myDraft.map((d) => {
    const pr = PROSPECTS_2026.find((p) => p.rank === d.rank);
    return {
      id: `dft-${d.pick}`,
      name: pr?.name || `Pick #${d.pick}`,
      pos: pr?.pos || '',
      posGroup: prospectPosGroup(pr?.pos),
      age: pr?.age ?? null,
      rating: 0,
      _rating: 0,
      _draft: true,
      _pick: d.pick,
      _sal: d.salary,
      salaries: { '2026-27': d.salary },
    };
  }), [gm.state.draftPicks, gm.slotOwners, myTeam, season]);
  const lineupRoster = useMemo(() => {
    const seen = new Set();
    const list = [...contract.filter((p) => !waivedMap.has(p.id))];
    for (const s of signings) { const p = byId.get(s.playerId); if (p) list.push({ ...p, _rating: num(p.rating), _signed: true }); }
    for (const r of draftRookies) list.push(r);
    return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [contract, signings, byId, gm.state.waived, draftRookies]);
  // Décompte de l'effectif par poste (PG/SG/SF/PF/C), + non classés.
  const posCounts = useMemo(() => {
    const c = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0, '?': 0 };
    for (const p of lineupRoster) { const pos = pos5Of(p) || '?'; (c[pos] != null ? c[pos]++ : c['?']++); }
    return c;
  }, [lineupRoster]);
  // Liste « Sous contrat » unifiée = joueurs du dataset + signatures FA + rookies
  // draftés, triés par salaire. Chaque ligne porte un _kind pour adapter les actions.
  const rosterRows = useMemo(() => {
    const seen = new Set();
    const rows = contract.map((p) => { seen.add(p.id); return { ...p, _kind: p._acquired ? 'trade' : 'contract' }; });
    for (const s of signings) {
      if (seen.has(s.playerId)) continue;
      const p = byId.get(s.playerId);
      if (!p) continue;
      seen.add(s.playerId);
      const endYear = PAY_SEASONS[Math.min(s.years, PAY_SEASONS.length) - 1] || season;
      rows.push({ ...p, _kind: 'signed', _rating: num(p.rating), _sal: num(s.salary), _endYear: endYear, _signMethod: s.method });
    }
    for (const r of draftRookies) rows.push({ ...r, _kind: 'draft', _endYear: season });
    return rows.sort((a, b) => num(b._sal) - num(a._sal));
  }, [contract, signings, byId, draftRookies, season]);
  const payroll = useMemo(() => buildPayroll(players, myTeam, gm, byId, myDraft), [players, myTeam, gm.moveMap, gm.state.extensions, gm.state.signings, gm.state.waived, gm.state.draftPicks, gm.slotOwners]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Décompte par poste */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px' }}>
        <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.6, fontFamily: "'Oswald', sans-serif" }}>Effectif par poste</span>
        {['PG', 'SG', 'SF', 'PF', 'C'].map((pos) => (
          <span key={pos} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, opacity: posCounts[pos] ? 1 : 0.4 }}>
            <b style={{ background: posCounts[pos] ? C.accent : C.border, color: posCounts[pos] ? C.ink : C.muted, borderRadius: 6, padding: '1px 8px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 18, textAlign: 'center' }}>{posCounts[pos]}</b>
            {pos}
          </span>
        ))}
        {posCounts['?'] > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: C.muted }}>
            <b style={{ background: C.border, color: C.muted, borderRadius: 6, padding: '1px 8px', fontWeight: 800 }}>{posCounts['?']}</b> n.c.
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, fontWeight: 600 }}>{lineupRoster.length} joueurs</span>
      </div>

      <CourtLineup roster={lineupRoster} lineup={gm.state.lineup} onSet={gm.setLineupSlot} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignContent: 'start' }}>
      {/* Joueurs sous contrat */}
      <div>
        <SectionTitle color={C.text}>Sous contrat 2026-27 ({rosterRows.length})</SectionTitle>
        {rosterRows.map((p) => {
          // Recrues (FA signée / rookie draftée) : ligne simplifiée + bouton « retirer ».
          if (p._kind === 'signed' || p._kind === 'draft') {
            const isDraft = p._kind === 'draft';
            const badge = isDraft ? { label: 'draft', color: C.accent } : { label: 'signé', color: C.blue };
            const sub = isDraft ? `pick #${p._pick}` : (p._signMethod ? `signé ${p._signMethod} · jusqu'en ${p._endYear}` : `jusqu'en ${p._endYear}`);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderBottom: `1px solid ${C.border}` }}>
                <div onClick={() => !isDraft && openFiche(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: isDraft ? 'default' : 'pointer' }}>
                  <PlayerAvatar player={p} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name} <span style={{ color: badge.color, fontSize: 10, fontWeight: 800 }}>● {badge.label}</span></div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.pos}{p.age ? ` · ${p.age} ans` : ''} · {sub}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 70 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(p._sal)}</div>
                </div>
                <button onClick={() => (isDraft ? gm.undoDraftPick(p._pick) : gm.unsign(p.id))} style={miniBtn}>retirer</button>
              </div>
            );
          }
          // Joueurs du dataset sous contrat (ou acquis via trade) : actions complètes.
          const mode = waivedMap.get(p.id);
          const ext = extMap.get(p.id);
          const g = guaranteedRemaining(p, '2026-27');
          const endSeason = ext ? Object.keys(extensionSchedule(p, ext)).slice(-1)[0] : (g.seasons.slice(-1)[0] || season);
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderBottom: `1px solid ${C.border}`, opacity: mode ? 0.6 : 1 }}>
              <div onClick={() => openFiche(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <PlayerAvatar player={p} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: mode ? 'line-through' : 'none' }}>{p.name} {p._acquired && <span style={{ color: C.green, fontSize: 10, fontWeight: 700 }}>● acquis</span>} {ext && <span style={{ color: C.purple, fontSize: 10, fontWeight: 700 }}>● prolongé</span>}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{p.pos} · {p.age} ans · jusqu'en {endSeason}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 70 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(p._sal)}</div>
              </div>
              {mode
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>{mode === 'stretch' ? 'STRETCH' : 'WAIVE'} · {fmtUSD(deadMoneyFor(p, mode, season))}</span>
                    <button onClick={() => gm.unwaive(p.id)} style={miniBtn}>annuler</button>
                  </div>
                : <div style={{ display: 'flex', gap: 4 }}>
                    {ext
                      ? <button onClick={() => gm.unextend(p.id)} style={{ ...miniBtn, color: C.purple, borderColor: C.purple }}>✓ ext</button>
                      : canExtend(p) && <button onClick={() => setExtendSel(p)} style={{ ...miniBtn, color: C.purple, borderColor: C.purple }}>prolonger</button>}
                    <button onClick={() => gm.waive(p.id, 'waive')} title={`Dead money ${fmtUSD(deadMoneyFor(p, 'waive', season))}`} style={miniBtn}>waive</button>
                    <button onClick={() => gm.waive(p.id, 'stretch')} title={`Dead money étalé ${fmtUSD(deadMoneyFor(p, 'stretch', season))}/an`} style={miniBtn}>stretch</button>
                  </div>}
            </div>
          );
        })}
      </div>

      {/* Récap cap + signatures + paie pluriannuelle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {extendSel && <ExtendPanel key={extendSel.id} player={extendSel} season={season} onExtend={(payload) => { gm.extend(payload); setExtendSel(null); }} onClose={() => setExtendSel(null)} />}

        <ActiveRulesPanel cap={cap} season={season} rosterSize={lineupRoster.length} signings={signings} />

        <CapHoldsManager players={players} gm={gm} myTeam={myTeam} season={season} myDraft={myDraft} openFiche={openFiche} />

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
          <SectionTitle color={C.text}>Feuille de paie 2026-27</SectionTitle>
          <CapLine label="Salaires garantis" value={cap.baseCommitted} />
          {cap.signedSalary > 0 && <CapLine label="Signatures (FA)" value={cap.signedSalary} color={C.green} />}
          {cap.draftedSalary > 0 && <CapLine label="Recrues draft" value={cap.draftedSalary} color={C.blue} />}
          {cap.deadMoney > 0 && <CapLine label="Dead money" value={cap.deadMoney} color={C.red} />}
          {cap.holds > 0 && <CapLine label="Cap holds" value={cap.holds} color={C.muted} />}
          {cap.rosterCharge > 0 && <CapLine label="Charge roster incomplet" value={cap.rosterCharge} color={C.muted} />}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8 }}>
            <CapLine label="Masse (tax)" value={cap.taxSalary} strong />
            <CapLine label="Cap room" value={cap.capRoomAvail} color={cap.capRoomAvail > 0 ? C.green : C.muted} strong />
            {capSummary(cap.taxSalary, season).taxBill > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                <span style={{ color: C.muted }}>Luxury tax</span>
                <b style={{ color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(capSummary(cap.taxSalary, season).taxBill)} <span style={{ color: C.muted, fontWeight: 400 }}>(récid. {fmtUSD(capSummary(cap.taxSalary, season).repeaterBill)})</span></b>
              </div>
            )}
          </div>
        </div>

        {gm.state.trades.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
            <SectionTitle color={C.green}>Trades exécutés ({gm.state.trades.length})</SectionTitle>
            {gm.state.trades.map((t) => (
              <div key={t.id} style={{ borderBottom: `1px solid ${C.border}`, padding: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
                  <span style={{ flex: 1 }}>avec {(t.partners || []).filter((a) => a !== myTeam).join(', ')}</span>
                  <button onClick={() => gm.undoTrade(t.id)} style={miniBtn}>annuler</button>
                </div>
                {(t.inIds || []).length > 0 && <div style={{ fontSize: 12, color: C.green }}>↓ {(t.inIds).map((id) => byId.get(id)?.name || id).join(', ')}</div>}
                {(t.outIds || []).length > 0 && <div style={{ fontSize: 12, color: C.red }}>↑ {(t.outIds).map((id) => byId.get(id)?.name || id).join(', ')}</div>}
                {(() => {
                  const swapSlots = new Set((t.swapMoves || []).flatMap((s) => [s.better, s.worse]));
                  const pks = [
                    ...(t.pickMoves || []).filter((pm) => !swapSlots.has(pm.slot)).map((pm) => ({ label: slotPickLabel(pm.slot), to: pm.toTeam })),
                    ...(t.futurePickMoves || []).map((fp) => ({ label: anyPickLabel(fp.pickId), to: fp.toTeam })),
                  ];
                  const pIn = pks.filter((p) => p.to === myTeam);
                  const pOut = pks.filter((p) => p.to !== myTeam);
                  return <>
                    {pIn.length > 0 && <div style={{ fontSize: 12, color: C.green }}>↓ 🎟 {pIn.map((p) => p.label).join(', ')}</div>}
                    {pOut.length > 0 && <div style={{ fontSize: 12, color: C.red }}>↑ 🎟 {pOut.map((p) => `${p.label} →${p.to}`).join(', ')}</div>}
                    {(t.swapMoves || []).map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: C.accent }}>🔄 Swap : #{s.better} ⇄ #{s.worse} → {s.holder} prend #{s.better}{s.swapped ? '' : ' (sans effet)'}</div>
                    ))}
                  </>;
                })()}
              </div>
            ))}
          </div>
        )}

        {/* Engagements pluriannuels (extensions incluses) */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
          <SectionTitle color={C.purple}>Engagements garantis</SectionTitle>
          {payrollByYear.map((y) => {
            const cap0 = CAP_YEARS[season].salaryCap;
            const livePct = Math.max(0, Math.min(100, (y.live / cap0) * 100));
            const deadPct = Math.max(0, Math.min(100 - livePct, (y.dead / cap0) * 100));
            return (
              <div key={y.season} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '2px 0' }} title={`Salaires ${fmtUSD(y.live)}${y.dead ? ` + dead money ${fmtUSD(y.dead)}` : ''}`}>
                <span style={{ width: 56, color: C.muted }}>{y.season}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.bg, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${livePct}%`, height: '100%', background: C.purple }} />
                  <div style={{ width: `${deadPct}%`, height: '100%', background: C.red }} />
                </div>
                <b style={{ width: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: y.total > cap0 ? C.accent : C.text }}>{fmtUSD(y.total)}</b>
              </div>
            );
          })}
          <div style={{ marginTop: 6, fontSize: 10, color: C.muted, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <span><span style={{ color: C.purple }}>■</span> salaires <span style={{ color: C.red }}>■</span> dead money</span>
            <span>vs cap {fmtUSD(CAP_YEARS[season].salaryCap)} (réf. {season})</span>
          </div>
        </div>

        {signings.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
            <SectionTitle color={C.green}>Recrues ({signings.length})</SectionTitle>
            {signings.map((s) => {
              const p = byId.get(s.playerId);
              return (
                <div key={s.playerId} style={row}>
                  <span style={{ flex: 1 }}>{p?.name || s.playerId}</span>
                  <span style={{ color: C.muted, fontSize: 11 }}>{s.method} · {s.years}a</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(s.salary)}</b>
                  <button onClick={() => gm.unsign(s.playerId)} style={miniBtn}>✕</button>
                </div>
              );
            })}
          </div>
        )}

        {myDraft.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
            <SectionTitle color={C.accent}>Recrues draft ({myDraft.length})</SectionTitle>
            {myDraft.map((d) => {
              const pr = PROSPECTS_2026.find((p) => p.rank === d.rank);
              return (
                <div key={d.pick} style={row}>
                  <span style={{ flex: 1 }}>{pr?.name || `pick #${d.pick}`}</span>
                  <span style={{ color: C.muted, fontSize: 11 }}>#{d.pick} · {pr?.pos || '—'}</span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(d.salary)}</b>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      <PayrollTable payroll={payroll} season={season} />
    </div>
  );
}

/* ----- Restrictions actives (selon la situation cap courante) -------------- */
// Calcule les règles qui s'appliquent MAINTENANT et bloquent/limitent trades & FA.
// Réactif : recalculé à chaque mouvement (cap + signings changent).
function computeActiveRules(cap, season, rosterSize, signings) {
  const sum = capSummary(cap.taxSalary, season);
  const tier = sum.tier; // under | over | tax | apron1 | apron2
  const out = [];
  const add = (sev, text) => out.push({ sev, text });

  if (tier === 'apron2') {
    add('red', "2e apron — interdit d'agréger 2 salaires ou + dans un trade (1 sortant max par reprise).");
    add('red', "2e apron — interdit d'envoyer du cash dans un trade.");
    add('red', "2e apron — interdit de reprendre plus de salaire que l'envoyé (matching 100 % strict).");
    add('red', "2e apron — signatures : minimum uniquement (aucune MLE).");
    add('red', "2e apron — interdit d'acquérir un joueur par sign-and-trade.");
  } else if (tier === 'apron1') {
    add('orange', "1er apron — matching de trade à 100 % (plus de coussin de reprise).");
    add('orange', "1er apron — signatures : Taxpayer MLE + minimum seulement (pas de MLE complète ni BAE).");
    add('orange', "1er apron — interdit d'acquérir un joueur par sign-and-trade.");
  } else if (tier === 'tax') {
    add('yellow', `Luxury tax due : ${fmtUSDfull(sum.taxBill)} (récidiviste ${fmtUSDfull(sum.repeaterBill)}).`);
    add('muted', "Au-dessus du cap : signatures via exceptions (MLE complète, BAE, min). Trade par paliers de matching.");
  } else if (tier === 'over') {
    add('muted', "Au-dessus du cap : plus de cap room → signatures via exceptions (MLE complète, BAE, min).");
    add('muted', "Trade : reprise limitée par les paliers de matching.");
  } else { // sous le cap
    if (cap.capRoomAvail > minSalary(0, season)) {
      add('green', `Sous le cap : ${fmtUSDfull(cap.capRoomAvail)} de cap room → tu peux absorber des salaires et signer dans la room (+ Room MLE).`);
    } else if (cap.holds > 0) {
      add('orange', `Cap holds (${fmtUSDfull(cap.holds)}) : ils consomment toute ta cap room (room ${fmtUSDfull(cap.capRoomAvail)}) → tu es limité aux petites exceptions / au minimum.`);
      add('muted', "Utilise « Cap holds » ci-dessous pour y renoncer et libérer de la cap room.");
    } else {
      add('muted', `Sous le cap mais cap room nulle (${fmtUSDfull(cap.capRoomAvail)}) — signatures via exceptions / minimum.`);
    }
  }

  // Hard cap déclenché par une exception déjà utilisée cette intersaison.
  if (signings?.some((s) => s.method === 'mle' || s.method === 'bae')) {
    add('orange', `Hard cap au 1er apron ACTIF (MLE/BAE utilisée) : masse plafonnée à ${fmtUSDfull(sum.firstApron)}.`);
  }
  if (signings?.some((s) => s.method === 'taxMLE')) {
    add('orange', `Hard cap au 2e apron ACTIF (Taxpayer MLE utilisée) : masse plafonnée à ${fmtUSDfull(sum.secondApron)}.`);
  }

  // Taille de roster.
  if (rosterSize >= ROSTER.max) add('red', `Roster plein (${rosterSize}/${ROSTER.max}) : libère un joueur avant d'en ajouter un.`);
  else if (rosterSize < ROSTER.min) add('orange', `Roster incomplet (${rosterSize}/${ROSTER.min} min) : tu dois encore signer ${ROSTER.min - rosterSize} joueur(s).`);

  return { tier, tierLabel: sum.tierLabel, rules: out };
}

const SEV_COLOR = { red: C.red, orange: C.accent, yellow: C.yellow, green: C.green, muted: C.muted };
const TIER_DOT = { under: C.green, over: C.muted, tax: C.yellow, apron1: C.accent, apron2: C.red };

function ActiveRulesPanel({ cap, season, rosterSize, signings }) {
  const { tier, tierLabel, rules } = computeActiveRules(cap, season, rosterSize, signings);
  const blocking = rules.filter((r) => r.sev === 'red' || r.sev === 'orange').length;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <SectionTitle color={C.text}>Règles actives</SectionTitle>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: TIER_DOT[tier] }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: TIER_DOT[tier] }} /> {tierLabel}
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
        {blocking > 0 ? `${blocking} restriction(s) limitent tes mouvements actuellement.` : 'Aucune restriction d\'apron : marge de manœuvre maximale.'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rules.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.4 }}>
            <span style={{ color: SEV_COLOR[r.sev], fontWeight: 800, flexShrink: 0, marginTop: -1 }}>
              {r.sev === 'red' ? '⛔' : r.sev === 'orange' ? '⚠' : r.sev === 'yellow' ? '💸' : r.sev === 'green' ? '✅' : '•'}
            </span>
            <span style={{ color: r.sev === 'muted' ? C.muted : C.text }}>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----- Gestion des cap holds (renoncer pour libérer de la cap room) -------- */
function CapHoldsManager({ players, gm, myTeam, season, myDraft, openFiche }) {
  const signedIds = new Set(gm.state.signings.map((s) => s.playerId));
  const ownFAs = players
    .filter((p) => effectiveTeam(p, gm.moveMap) === myTeam && isFreeAgent(p))
    .map((p) => ({ ...p, _hold: capHold(p, season), _ren: gm.renouncedSet.has(p.id), _signed: signedIds.has(p.id) }))
    .sort((a, b) => b._hold - a._hold);
  if (!ownFAs.length) return null;

  const active = ownFAs.filter((p) => !p._ren && !p._signed); // holds qui pèsent encore
  const totalActive = active.reduce((a, p) => a + p._hold, 0);
  const renouncedCount = ownFAs.filter((p) => p._ren).length;

  // Cap room disponible si on renonçait à TOUS les holds restants.
  const allRenounce = new Set([...gm.state.renounced, ...ownFAs.filter((p) => !p._signed).map((p) => p.id)]);
  const potential = teamCapState(players, myTeam, season, { signings: gm.state.signings, renounced: allRenounce, waived: gm.state.waived, drafted: myDraft, moveMap: gm.moveMap });

  const renounceAll = () => active.forEach((p) => gm.renounce(p.id));
  const restoreAll = () => ownFAs.filter((p) => p._ren).forEach((p) => gm.unrenounce(p.id));

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <SectionTitle color={C.text}>Cap holds ({active.length})</SectionTitle>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: totalActive > 0 ? C.muted : C.green, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(totalActive)}</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
        Renonce à un agent libre maison pour <b style={{ color: C.text }}>retirer son hold</b> et libérer de la cap room.
        {active.length > 0 && <> Si tu renonces à tout : <b style={{ color: C.green }}>{fmtUSD(potential.capRoomAvail)}</b> de cap room.</>}
      </div>

      {(active.length > 0 || renouncedCount > 0) && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {active.length > 0 && <button onClick={renounceAll} style={{ ...miniBtn, color: C.accent, borderColor: C.accent }}>↧ Tout renoncer</button>}
          {renouncedCount > 0 && <button onClick={restoreAll} style={miniBtn}>↩ Tout rétablir ({renouncedCount})</button>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflow: 'auto' }}>
        {ownFAs.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', borderBottom: `1px solid ${C.border}`, opacity: p._ren || p._signed ? 0.55 : 1 }}>
            <span onClick={() => openFiche(p)} style={{ cursor: 'pointer' }}><PlayerAvatar player={p} size={26} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textDecoration: p._ren ? 'line-through' : 'none' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{p.pos} · hold {fmtUSD(p._hold)}{p._signed ? ' · re-signé' : ''}</div>
            </div>
            {p._signed
              ? <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>signé</span>
              : p._ren
                ? <button onClick={() => gm.unrenounce(p.id)} style={miniBtn}>rétablir</button>
                : <button onClick={() => gm.renounce(p.id)} style={{ ...miniBtn, color: C.accent, borderColor: C.accent }}>renoncer</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----- Terrain : 5 majeur -------------------------------------------------- */
const COURT_SPOTS = [
  { pos: 'PG', x: 150, y: 300, label: 'Meneur' },
  { pos: 'SG', x: 248, y: 232, label: 'Arrière' },
  { pos: 'SF', x: 52, y: 232, label: 'Ailier' },
  { pos: 'PF', x: 210, y: 150, label: 'Ailier fort' },
  { pos: 'C', x: 110, y: 132, label: 'Pivot' },
];
const pos5Of = (p) => {
  const t = (p.pos || '').split('-')[0].trim();
  return ['PG', 'SG', 'SF', 'PF', 'C'].includes(t) ? t : null;
};

function CourtLineup({ roster, lineup, onSet }) {
  const [active, setActive] = useState(null);
  // Index par id construit depuis le roster (inclut FA signés et rookies draftés,
  // qui ne sont pas dans le dataset global).
  const rosterById = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const rosterIds = useMemo(() => new Set(roster.map((p) => p.id)), [roster]);
  const used = new Set(Object.values(lineup).filter(Boolean));
  // Recrues d'abord (rookies draftés, puis signatures FA) pour qu'une nouvelle
  // acquisition soit visible en haut du banc et jamais cachée sous le scroll.
  const benchRank = (p) => (p._draft ? 0 : p._signed ? 1 : 2);
  const bench = roster
    .filter((p) => !used.has(p.id))
    .sort((a, b) => benchRank(a) - benchRank(b) || num(b._rating ?? b.rating) - num(a._rating ?? a.rating));

  function assign(p) {
    const target = active || pos5Of(p) || COURT_SPOTS.find((s) => !lineup[s.pos])?.pos || 'PG';
    onSet(target, p.id);
    setActive(null);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div>
        <SectionTitle color={C.text}>5 majeur</SectionTitle>
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <svg viewBox="0 0 300 340" style={{ width: '100%', display: 'block' }}>
            <rect x="6" y="6" width="288" height="328" rx="8" fill="#1c1208" stroke={C.border} />
            <rect x="110" y="6" width="80" height="120" fill="none" stroke="#5a4a2f" strokeWidth="1.5" />
            <circle cx="150" cy="126" r="28" fill="none" stroke="#5a4a2f" strokeWidth="1.5" />
            <circle cx="150" cy="30" r="9" fill="none" stroke="#e0743b" strokeWidth="2" />
            <line x1="130" y1="18" x2="170" y2="18" stroke="#5a4a2f" strokeWidth="2" />
            <path d="M30,6 L30,150 A120,120 0 0,0 270,150 L270,6" fill="none" stroke="#5a4a2f" strokeWidth="1.5" />
          </svg>
          {COURT_SPOTS.map((s) => {
            const pid = lineup[s.pos];
            const p = (pid && rosterIds.has(pid)) ? rosterById.get(pid) : null;
            const isActive = active === s.pos;
            return (
              <div key={s.pos} onClick={() => (p ? onSet(s.pos, null) : setActive(isActive ? null : s.pos))}
                style={{ position: 'absolute', left: `${(s.x / 300) * 100}%`, top: `${(s.y / 340) * 100}%`, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', width: 56 }}>
                {p
                  ? <PlayerAvatar player={p} size={42} />
                  : <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px dashed ${isActive ? C.accent : C.border}`, background: isActive ? 'rgba(239,125,58,0.22)' : 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? C.accent : C.muted, fontWeight: 800, fontSize: 12 }}>{s.pos}</div>}
                {p && <span style={{ fontSize: 9, color: '#fff', marginTop: 3, whiteSpace: 'nowrap', textShadow: '0 1px 3px #000' }}>{p.name.split(' ').slice(-1)[0]}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
          {active ? `Choisis un joueur pour le poste ${active} →` : 'Clique un poste vide, puis un joueur ; clique un joueur placé pour le retirer.'}
        </div>
      </div>

      {/* banc */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <SectionTitle color={C.muted}>Banc ({bench.length})</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start', overflow: 'auto', maxHeight: 290 }}>
          {bench.map((p) => {
            const tag = p._draft ? { label: 'DRAFT', color: C.accent } : p._signed ? { label: 'FA', color: C.blue } : null;
            return (
              <button key={p.id} onClick={() => assign(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', background: C.surface2, color: C.text, border: `1px solid ${tag ? tag.color : C.border}` }}>
                <PlayerAvatar player={p} size={22} />
                <span style={{ fontSize: 12 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: C.muted }}>{pos5Of(p) || p.posGroup}</span>
                {tag && <span style={{ fontSize: 8, fontWeight: 800, color: C.ink, background: tag.color, borderRadius: 4, padding: '1px 4px', letterSpacing: 0.4 }}>{tag.label}</span>}
              </button>
            );
          })}
          {!bench.length && <div style={{ fontSize: 12, color: C.muted }}>Tout le monde est sur le terrain ou non disponible.</div>}
        </div>
      </div>
    </div>
  );
}

/* ----- Tableau payroll (joueur × saison) ----------------------------------- */
const PAY_SEASONS = ['2026-27', '2027-28', '2028-29', '2029-30', '2030-31'];

function ufaFromByYear(byYear) {
  let last = -1;
  PAY_SEASONS.forEach((s, i) => { if (byYear[s] > 0) last = i; });
  return last >= 0 && last + 1 < PAY_SEASONS.length ? PAY_SEASONS[last + 1] : null;
}

function buildPayroll(players, myTeam, gm, byId, myDraft) {
  const waivedMap = new Map(gm.state.waived.map((w) => [w.playerId, w.mode]));
  const extMap = new Map(gm.state.extensions.map((e) => [e.playerId, e]));
  const rows = [];
  for (const p of players) {
    if (effectiveTeam(p, gm.moveMap) !== myTeam) continue;
    if (waivedMap.has(p.id)) {
      const mode = waivedMap.get(p.id);
      const byYear = deadMoneyByYear(p, mode);
      if (PAY_SEASONS.some((s) => byYear[s] > 0)) {
        rows.push({ id: p.id, name: p.name, kind: 'dead', deadMode: mode, byYear, opts: {}, ufa: null });
      }
      continue;
    }
    const e = extMap.get(p.id);
    const sch = e ? extensionSchedule(p, e) : {};
    const byYear = {}; let any = false;
    for (const s of PAY_SEASONS) { const v = num(p.salaries?.[s]) + (sch[s] || 0); byYear[s] = v; if (v > 0) any = true; }
    const opts = {};
    for (const s of PAY_SEASONS) if (p.options?.[s]) opts[s] = p.options[s];
    if (any) rows.push({ id: p.id, name: p.name, kind: gm.moveMap[p.id] === myTeam && p.team !== myTeam ? 'trade' : 'contrat', byYear, opts, ufa: ufaFromByYear(byYear) });
  }
  for (const s of gm.state.signings) {
    const byYear = {};
    PAY_SEASONS.forEach((sea, i) => { byYear[sea] = i < s.years ? num(s.salary) : 0; });
    rows.push({ id: s.playerId, name: byId.get(s.playerId)?.name || s.playerId, kind: 'signé', byYear, opts: {}, ufa: ufaFromByYear(byYear) });
  }
  for (const d of myDraft) {
    const byYear = {}; PAY_SEASONS.forEach((sea) => { byYear[sea] = 0; }); byYear['2026-27'] = d.salary;
    rows.push({ id: `dft-${d.pick}`, name: PROSPECTS_2026.find((p) => p.rank === d.rank)?.name || `pick #${d.pick}`, kind: 'draft', byYear, opts: {}, ufa: null });
  }
  // Deux sous-groupes : joueurs encore là (active) puis dead money.
  const activeRows = rows.filter((r) => r.kind !== 'dead').sort((a, b) => b.byYear['2026-27'] - a.byYear['2026-27']);
  const deadRows = rows.filter((r) => r.kind === 'dead').sort((a, b) => b.byYear['2026-27'] - a.byYear['2026-27']);
  const sumBy = (list) => { const t = {}; PAY_SEASONS.forEach((s) => { t[s] = list.reduce((a, r) => a + r.byYear[s], 0); }); return t; };
  const liveTotals = sumBy(activeRows);
  const deadTotals = sumBy(deadRows);
  const totals = {};
  PAY_SEASONS.forEach((s) => { totals[s] = liveTotals[s] + deadTotals[s]; });
  return { activeRows, deadRows, liveTotals, deadTotals, totals };
}

const KIND_DOT = { contrat: C.muted, trade: C.green, signé: C.blue, draft: C.accent, dead: C.red };

function PayrollRow({ r }) {
  const isDead = r.kind === 'dead';
  return (
    <tr style={{ borderTop: `1px solid ${C.border}` }}>
      <td style={{ padding: '5px 8px', color: isDead ? C.red : C.text }}>
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: KIND_DOT[r.kind], marginRight: 6 }} />
        <span style={{ textDecoration: isDead ? 'line-through' : 'none' }}>{r.name}</span>
        {isDead && <span style={{ fontSize: 9, fontWeight: 800, color: C.red, marginLeft: 6, letterSpacing: 0.3 }}>{r.deadMode === 'stretch' ? 'STRETCH' : 'COUPÉ'}</span>}
      </td>
      {PAY_SEASONS.map((s) => {
        const v = r.byYear[s];
        const opt = r.opts[s];
        const isUfa = s === r.ufa;
        const tint = isDead ? C.red : opt ? OPTION_COLORS[opt] : isUfa ? OPTION_COLORS.UFA : null;
        return (
          <td key={s} title={isDead ? `Dead money (${r.deadMode === 'stretch' ? 'étalé' : 'waive'})` : opt ? OPTION_LABEL[opt] : isUfa ? 'Départ en agence libre (UFA)' : ''}
            style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', background: tint && !isDead ? `${tint}22` : 'transparent', color: isDead ? (v ? C.red : C.border) : v ? (opt ? OPTION_COLORS[opt] : C.text) : (isUfa ? OPTION_COLORS.UFA : C.border), fontWeight: opt || isUfa ? 700 : 400 }}>
            {v ? <>{fmtUSD(v)}{opt && <sup style={{ fontSize: 8, marginLeft: 1 }}>{opt}</sup>}</> : (isUfa ? 'UFA' : '—')}
          </td>
        );
      })}
    </tr>
  );
}

function PayrollTable({ payroll, season }) {
  const Y = CAP_YEARS[season];
  const { activeRows, deadRows, deadTotals, totals } = payroll;
  const hasDead = deadRows.length > 0;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <SectionTitle color={C.text}>Tableau de paie ({activeRows.length} joueurs{hasDead ? ` + ${deadRows.length} dead money` : ''})</SectionTitle>
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.muted, textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Joueur</th>
              {PAY_SEASONS.map((s) => <th key={s} style={{ padding: '6px 8px', fontWeight: 600 }}>{s}</th>)}
            </tr>
          </thead>
          {/* Sous-groupe 1 : joueurs encore là */}
          <tbody>
            {activeRows.map((r) => <PayrollRow key={r.id} r={r} />)}
          </tbody>
          {/* Sous-groupe 2 : dead money (joueurs libérés) */}
          {hasDead && (
            <tbody>
              <tr>
                <td colSpan={PAY_SEASONS.length + 1} style={{ padding: '8px 8px 3px', borderTop: `2px solid ${C.border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: C.red, fontFamily: "'Oswald', sans-serif" }}>● Dead money</span>
                </td>
              </tr>
              {deadRows.map((r) => <PayrollRow key={r.id} r={r} />)}
              <tr style={{ fontWeight: 700, color: C.red }}>
                <td style={{ padding: '4px 8px' }}>Sous-total dead money</td>
                {PAY_SEASONS.map((s) => <td key={s} style={{ padding: '4px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: deadTotals[s] ? C.red : C.border }}>{deadTotals[s] ? fmtUSD(deadTotals[s]) : '—'}</td>)}
              </tr>
            </tbody>
          )}
          <tfoot>
            <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 800 }}>
              <td style={{ padding: '7px 8px' }}>Total{hasDead ? ' (avec dead money)' : ''}</td>
              {PAY_SEASONS.map((s) => {
                const over = totals[s] > Y.luxuryTax;
                return <td key={s} style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: over ? C.accent : C.text }}>{fmtUSD(totals[s])}</td>;
              })}
            </tr>
            <tr style={{ color: C.muted, fontSize: 11 }}>
              <td style={{ padding: '2px 8px' }}>vs cap {fmtUSD(Y.salaryCap)}</td>
              {PAY_SEASONS.map((s) => <td key={s} style={{ padding: '2px 8px', textAlign: 'right' }}>{totals[s] > Y.salaryCap ? `+${fmtUSD(totals[s] - Y.salaryCap)}` : `${fmtUSD(Y.salaryCap - totals[s])} room`}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: C.muted, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <span><span style={{ color: KIND_DOT.contrat }}>●</span> contrat <span style={{ color: KIND_DOT.trade }}>●</span> acquis <span style={{ color: KIND_DOT.signé }}>●</span> signé <span style={{ color: KIND_DOT.draft }}>●</span> draft <span style={{ color: KIND_DOT.dead }}>●</span> dead money</span>
        <span style={{ display: 'flex', gap: 10 }}>
          {['PO', 'TO', 'ETO', 'NG', 'UFA'].map((k) => (
            <span key={k} style={{ color: OPTION_COLORS[k], fontWeight: 700 }}>■ {OPTION_LABEL[k]}</span>
          ))}
        </span>
      </div>
    </div>
  );
}

function ExtendPanel({ player, season, onExtend, onClose }) {
  const maxY = maxExtensionYears(player);
  const ceil = maxSalary(yearsOfService(player), season);
  const floor = minSalary(yearsOfService(player), season);
  const cur = num(player.salaries?.[lastGuaranteedSeason(player)] || player.salaries?.['2026-27']);
  const [years, setYears] = useState(Math.min(maxY, 3));
  const [startSalary, setStartSalary] = useState(Math.min(ceil, Math.max(floor, Math.round(cur * 1.1))));
  const schedule = extensionSchedule(player, { years, startSalary });
  const total = Object.values(schedule).reduce((a, v) => a + v, 0);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.purple}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <SectionTitle color={C.purple}>Prolonger {player.name}</SectionTitle>
        <button onClick={onClose} style={{ ...miniBtn, marginLeft: 'auto' }}>✕</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
        <span style={{ color: C.muted }}>Salaire de départ</span>
        <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSDfull(startSalary)}</b>
      </div>
      <input type="range" min={floor} max={ceil} step={250000} value={startSalary} onChange={(e) => setStartSalary(num(e.target.value))} style={{ width: '100%', accentColor: C.purple }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, marginTop: 6 }}>
        <span style={{ color: C.muted }}>Années (+8%/an)</span>
        <select value={years} onChange={(e) => setYears(num(e.target.value))} style={selStyle}>
          {Array.from({ length: maxY }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: C.muted }}>~{fmtUSD(total)} total</span>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>
        {Object.entries(schedule).map(([s, v]) => <div key={s} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{s}</span><span>{fmtUSD(v)}</span></div>)}
      </div>
      <button onClick={() => onExtend({ playerId: player.id, years, startSalary })}
        style={{ marginTop: 12, width: '100%', padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer', background: C.purple, color: '#10120f', fontWeight: 800, fontSize: 13 }}>
        Prolonger {years} an{years > 1 ? 's' : ''}
      </button>
    </div>
  );
}

/* ---------------------------- Onglet Free Agency --------------------------- */
function FreeAgencyTab({ players, gm, myTeam, season, cap, openFiche }) {
  const [scope, setScope] = useState('all');
  const [q, setQ] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');
  const [sel, setSel] = useState(null);

  const faPool = useMemo(() => players.filter(isFreeAgent).map((p) => ({
    ...p, _rating: num(p.rating), _prev: num(p.salaries?.['2025-26']), _hold: capHold(p, season), _type: faType(p), _own: p.team === myTeam,
  })), [players, season, myTeam]);

  const signedIds = new Set(gm.state.signings.map((s) => s.playerId));
  // Pool filtré par scope + recherche (avant le filtre de poste, pour les comptes).
  const scoped = faPool.filter((p) => (scope === 'mine' ? p._own : true) && !signedIds.has(p.id) && p.name.toLowerCase().includes(q.toLowerCase()));
  const posCount = (pos) => scoped.filter((p) => pos5Of(p) === pos).length;
  const list = scoped
    .filter((p) => posFilter === 'ALL' || pos5Of(p) === posFilter)
    .sort((a, b) => b._rating - a._rating);

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setScope('all')} style={pill(scope === 'all')}>Tous les FA ({faPool.length})</button>
            <button onClick={() => setScope('mine')} style={pill(scope === 'mine')}>Mes FA ({faPool.filter((p) => p._own).length})</button>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" style={{ ...input, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginRight: 2 }}>Poste</span>
            <button onClick={() => setPosFilter('ALL')} style={pill(posFilter === 'ALL')}>Tous ({scoped.length})</button>
            {['PG', 'SG', 'SF', 'PF', 'C'].map((pos) => (
              <button key={pos} onClick={() => setPosFilter(pos)} disabled={posCount(pos) === 0}
                style={{ ...pill(posFilter === pos), opacity: posCount(pos) === 0 ? 0.4 : 1, cursor: posCount(pos) === 0 ? 'default' : 'pointer' }}>
                {pos} ({posCount(pos)})
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {list.map((p) => (
            <div key={p.id} onClick={() => setSel(p)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: sel?.id === p.id ? C.surface2 : 'transparent' }}>
              <span onClick={(e) => { e.stopPropagation(); openFiche(p); }} title="Voir la fiche"><PlayerAvatar player={p} size={32} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name} {p._own && <span style={{ color: C.accent, fontSize: 10 }}>● maison</span>}</div>
                <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>{p.pos} · {p.age} ans · {yearsOfService(p)} ans NBA · <TeamChip abbr={p.team} size={14} /></div>
              </div>
              <span style={{ fontSize: 10, color: p._type === 'RFA' ? C.yellow : C.muted, fontWeight: 700 }}>{p._type}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{fmtUSD(p._prev)}</div>
                <div style={{ fontSize: 10, color: C.muted }}>hold {fmtUSD(p._hold)}</div>
              </div>
            </div>
          ))}
          {!list.length && <div style={{ padding: 16, color: C.muted, fontSize: 13 }}>Aucun agent libre.</div>}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 320, overflow: 'auto' }}>
        {sel
          ? <SignPanel key={sel.id} player={sel} cap={cap} season={season} myTeam={myTeam} onSign={(payload) => { gm.sign(payload); setSel(null); }} onClose={() => setSel(null)} />
          : <div style={{ padding: 20, color: C.muted, fontSize: 13 }}>← Sélectionne un agent libre pour le signer.</div>}
      </div>
    </div>
  );
}

function SignPanel({ player, cap, season, myTeam, onSign, onClose }) {
  const isOwn = player.team === myTeam;
  const methods = useMemo(() => availableMethods({ taxSalary: cap.taxSalary, capRoomAvail: cap.capRoomAvail, capRoomBasis: cap.capRoomBasis }, player, isOwn, season), [cap, player, isOwn, season]);
  const [methodKey, setMethodKey] = useState(methods[0]?.key);
  const method = methods.find((m) => m.key === methodKey) || methods[0];
  const minS = minSalary(yearsOfService(player), season);
  const [salary, setSalary] = useState(Math.min(method?.maxSalary || minS, Math.max(minS, player._prev || minS)));
  const [years, setYears] = useState(Math.min(method?.maxYears || 1, 3));

  useEffect(() => {
    if (!method) return;
    setSalary((s) => Math.min(method.maxSalary, Math.max(minS, s)));
    setYears((y) => Math.min(method.maxYears, y));
  }, [methodKey]); // eslint-disable-line

  if (!method) return <div style={{ padding: 20, color: C.red, fontSize: 13 }}>Aucune méthode de signature disponible (2e apron ?).</div>;
  const total = salary * years;
  // Hard cap : si la méthode en pose un, la signature ne peut pas franchir l'apron.
  const hold = isOwn ? capHold(player, season) : 0;
  const hc = signingHardCap(method, salary, cap.taxSalary, hold, season);
  const isRFA = (player._type || faType(player)) === 'RFA' && !isOwn;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PlayerAvatar player={player} size={34} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{player.name}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{player.pos} · {player.age} ans · {yearsOfService(player)} ans NBA · {player._type}{isOwn ? ' · maison (Bird)' : ''}</div>
        </div>
        <button onClick={onClose} style={btn}>✕</button>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: C.muted }}>MÉTHODE</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {methods.map((m) => (
          <button key={m.key} onClick={() => setMethodKey(m.key)} style={chip(methodKey === m.key)}>
            {m.label} <span style={{ opacity: 0.7 }}>≤{fmtUSD(m.maxSalary)}</span>
          </button>
        ))}
      </div>
      {method.hardCap && <div style={{ marginTop: 6, fontSize: 11, color: C.yellow }}>⚠ Cette exception pose un hard cap au {method.hardCap}.</div>}
      {isRFA && <div style={{ marginTop: 4, fontSize: 11, color: C.blue }}>ℹ RFA : son équipe d'origine peut s'aligner sur ton offre (droit de match).</div>}

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: C.muted }}>Salaire annuel</span>
        <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSDfull(salary)}</b>
      </div>
      <input type="range" min={minS} max={Math.max(minS, method.maxSalary)} step={250000} value={salary} onChange={(e) => setSalary(num(e.target.value))} style={{ width: '100%', accentColor: C.accent }} />

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
        <span style={{ color: C.muted }}>Durée</span>
        <select value={years} onChange={(e) => setYears(num(e.target.value))} style={selStyle}>
          {Array.from({ length: method.maxYears }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{y} an{y > 1 ? 's' : ''}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: C.muted }}>~{fmtUSD(total)} total</span>
      </div>

      {hc.breach && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.red, fontWeight: 600, background: 'rgba(255,59,107,0.10)', border: `1px solid ${C.red}`, borderRadius: 8, padding: '8px 10px' }}>
          🚫 Hard cap dépassé : avec cette signature la masse passerait à {fmtUSD(hc.projected)}, au-dessus du {method.hardCap} ({fmtUSD(hc.limit)}). Baisse le salaire ou choisis une autre méthode.
        </div>
      )}
      <button onClick={() => !hc.breach && onSign({ playerId: player.id, salary, years, method: method.key })} disabled={hc.breach}
        style={{ marginTop: 14, width: '100%', padding: '10px', borderRadius: 9, border: 'none', cursor: hc.breach ? 'not-allowed' : 'pointer', background: hc.breach ? C.border : C.accent, color: hc.breach ? C.muted : '#10120f', fontWeight: 800, fontSize: 14, opacity: hc.breach ? 0.7 : 1 }}>
        {hc.breach ? '🚫 Signature interdite (hard cap)' : <>✍ Signer {player.name.split(' ').slice(-1)[0]} — {fmtUSD(salary)}/an × {years}</>}
      </button>
    </div>
  );
}

/* ------------------------------- Onglet Draft ------------------------------ */
function DraftTab({ gm, season, myTeam }) {
  const picks = gm.state.draftPicks;
  const owners = gm.slotOwners;
  const tradedSlots = Object.keys(owners).length;
  const np = nextPick(picks);
  const done = np == null;
  const onClock = done ? null : teamAt(np, owners);
  const isMyTurn = onClock === myTeam;
  const taken = takenRanks(picks);
  const available = PROSPECTS_2026.filter((p) => !taken.has(p.rank));
  const myPicks = picksOfTeam(picks, myTeam, season, owners);
  const totalRookie = myPicks.reduce((a, x) => a + x.salary, 0);
  const madePickNums = Object.keys(picks).map(Number);
  const lastPickNum = madePickNums.length ? Math.max(...madePickNums) : null;
  const prospectByRank = (r) => PROSPECTS_2026.find((p) => p.rank === r);
  const [prospect, setProspect] = useState(null); // fiche prospect (modal)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Barre de contrôle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: isMyTurn ? 'rgba(239,125,58,0.10)' : 'transparent' }}>
        {done
          ? <div style={{ fontWeight: 800, color: C.green }}>✓ Draft 2026 terminée</div>
          : <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>Au tour de</span>
              <TeamChip abbr={onClock} size={26} />
              <span style={{ fontWeight: 800 }}>Pick #{np}</span>
              {isMyTurn && <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, background: 'rgba(239,125,58,0.18)', padding: '2px 8px', borderRadius: 5 }}>À TOI DE CHOISIR ↓</span>}
            </div>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {!done && !isMyTurn && <button onClick={() => gm.simDraft(myTeam)} style={primaryBtn}>▶ Simuler jusqu'à mon pick</button>}
          {!done && <button onClick={gm.autoPick} style={btn}>auto-pick ce choix</button>}
          {lastPickNum && <button onClick={() => gm.undoDraftPick(lastPickNum)} style={btn}>↶ annuler #{lastPickNum}</button>}
          {madePickNums.length > 0 && <button onClick={gm.resetDraft} style={btn}>↺ reset draft</button>}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Tableau des sélections (ordre de draft) */}
        <div style={{ flex: 1.1, overflow: 'auto', borderRight: `1px solid ${C.border}` }}>
          <SectionTitle color={C.text}><div style={{ padding: '10px 14px 0' }}>Ordre de draft {tradedSlots > 0 && <span style={{ color: C.accent, fontSize: 11 }}>· {tradedSlots} slot(s) échangé(s) via trade</span>}</div></SectionTitle>
          {Array.from({ length: LAST_PICK }, (_, i) => i + 1).map((pk) => {
            const team = teamAt(pk, owners);
            const rank = picks[pk];
            const pr = rank != null ? prospectByRank(rank) : null;
            const mine = team === myTeam;
            const current = pk === np;
            return (
              <div key={pk} onClick={() => pr && setProspect(pr)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderBottom: `1px solid ${C.border}`, cursor: pr ? 'pointer' : 'default', background: current ? 'rgba(239,125,58,0.12)' : mine ? 'rgba(239,125,58,0.05)' : 'transparent' }}>
                <span style={{ width: 26, color: C.muted, fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{pk}</span>
                <TeamChip abbr={team} size={22} />
                {pr
                  ? <><span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{pr.name}</span><span style={{ fontSize: 11, color: C.muted }}>{pr.pos} · {pr.team}</span></>
                  : <span style={{ flex: 1, fontSize: 12, color: current ? C.accent : C.muted }}>{current ? 'sur l’horloge…' : 'à venir'}</span>}
              </div>
            );
          })}
        </div>

        {/* Disponibles + mes recrues */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 800 }}>
            Disponibles ({available.length}) <span style={{ color: C.muted, fontWeight: 600 }}>— clique pour voir la fiche{isMyTurn ? ' / drafter' : ''}</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {available.map((p) => (
              <div key={p.rank}
                onClick={() => setProspect(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.surface2; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ width: 26, color: C.muted, fontSize: 12, fontWeight: 700 }}>{p.rank}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{p.pos} · {p.team}{p.ht ? ` · ${fmtHeight(p.ht)}` : ''}{p.age ? ` · ${p.age}a` : ''}</div>
                </div>
                {PROSPECT_STATS[p.name] && <span style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{PROSPECT_STATS[p.name].pts.toFixed(1)} · {PROSPECT_STATS[p.name].reb.toFixed(1)} · {PROSPECT_STATS[p.name].ast.toFixed(1)}</span>}
                <span style={{ fontSize: 11, color: isMyTurn ? C.accent : C.muted, fontWeight: 700 }}>{isMyTurn ? 'draft ›' : 'fiche ›'}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: 12 }}>
            <SectionTitle color={C.blue}>Mes recrues ({myPicks.length})</SectionTitle>
            {myPicks.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Aucune pour l’instant.</div>}
            {myPicks.map((mp) => {
              const pr = prospectByRank(mp.rank);
              return (
                <div key={mp.pick} style={row}>
                  <span style={{ color: C.muted, fontSize: 11, width: 26 }}>#{mp.pick}</span>
                  <span style={{ flex: 1 }}>{pr?.name || '—'} <span style={{ color: C.muted, fontSize: 11 }}>{pr?.pos}</span></span>
                  <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(mp.salary)}</b>
                </div>
              );
            })}
            {myPicks.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: C.muted }}>Total rookie scale</span>
                <b style={{ color: C.blue }}>{fmtUSD(totalRookie)}</b>
              </div>
            )}
          </div>
        </div>
      </div>

      {prospect && (
        <ProspectModal
          prospect={prospect}
          pickSlot={isMyTurn ? np : null}
          onDraft={() => { gm.draftSelect(np, prospect.rank); setProspect(null); }}
          onClose={() => setProspect(null)}
        />
      )}
    </div>
  );
}

/* ----- Fiche prospect (avant de drafter) ----------------------------------- */
const fmtHeight = (inches) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : '—');
const ARCHETYPE = { PG: 'Meneur', SG: 'Arrière', SF: 'Ailier', PF: 'Ailier-fort', C: 'Pivot' };

function ProspectModal({ prospect, pickSlot, onDraft, onClose }) {
  if (!prospect) return null;
  const r = prospect.rank;
  const tier = r <= 5 ? 'Top 5' : r <= 14 ? 'Loterie' : r <= 30 ? '1er tour' : '2e tour';
  const tierCol = r <= 5 ? C.red : r <= 14 ? C.accent : r <= 30 ? C.blue : C.muted;
  const salary = rookieSalary(pickSlot || r, '2026-27');
  const initials = prospect.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const st = PROSPECT_STATS[prospect.name];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="tcard" style={{ '--card-accent': tierCol, '--card-glow': tierCol, width: 'min(420px, 96vw)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 70, height: 70, borderRadius: 12, border: `2px solid ${C.border}`, background: C.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: C.muted, fontFamily: "'Oswald', sans-serif", flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 22, textTransform: 'uppercase' }}>{prospect.name}</h2>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{prospect.pos} · {prospect.team}</div>
          </div>
          <button onClick={onClose} style={{ ...btn, padding: '4px 10px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Info label="Taille" value={fmtHeight(prospect.ht)} />
          <Info label="Poids" value={prospect.wt ? `${prospect.wt} lb` : '—'} />
          <Info label="Âge" value={prospect.age ? `${prospect.age} ans` : '—'} />
        </div>

        {st && (
          <>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, margin: '14px 0 6px', fontFamily: "'Oswald', sans-serif" }}>Stats 2025-26 ({prospect.team})</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Info label="PTS" value={st.pts.toFixed(1)} color={C.accent} />
              <Info label="REB" value={st.reb.toFixed(1)} color={C.accent} />
              <Info label="AST" value={st.ast.toFixed(1)} color={C.accent} />
              {st.ts != null && <Info label="TS%" value={`${st.ts}`} color={C.accent} />}
            </div>
          </>
        )}

        <div style={{ marginTop: 10, fontSize: 13, color: C.text, lineHeight: 1.45, fontStyle: 'italic' }}>
          « {prospect.note || `${ARCHETYPE[prospect.pos] || 'Joueur'}, profil ${tier.toLowerCase()}.`} »
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Info label="Projeté" value={`#${r}`} />
          <Info label="Tier" value={tier} color={tierCol} />
          <Info label={pickSlot ? `Salaire au #${pickSlot}` : 'Rookie scale est.'} value={fmtUSD(salary)} color={C.blue} />
        </div>

        {pickSlot ? (
          <button onClick={onDraft} style={{ marginTop: 18, width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: C.accent, color: C.ink, fontWeight: 800, fontSize: 15, fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5, textTransform: 'uppercase', boxShadow: `0 0 18px -4px ${C.accent}` }}>
            ✓ Drafter au #{pickSlot}
          </button>
        ) : (
          <div style={{ marginTop: 16, fontSize: 12, color: C.muted, textAlign: 'center' }}>Ce n'est pas ton tour — « Simuler jusqu'à mon pick » pour drafter.</div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: C.bg, border: `2px solid ${C.border}`, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
      <div className="cond" style={{ fontSize: 15, fontWeight: 700, color: color || C.text }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}

/* ------------------------------- Onglet Récap ------------------------------ */
function RecapTab({ players, gm, myTeam, season, cap }) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const finalized = gm.state.finalized;
  const before = useMemo(() => teamCapState(players, myTeam, season, {}), [players, myTeam, season]);
  const myDraft = picksOfTeam(gm.state.draftPicks, myTeam, season, gm.slotOwners);
  const waivedIds = new Set(gm.state.waived.map((w) => w.playerId));

  // Effectif final = roster effectif (non libéré) + recrues FA + recrues draft.
  const rosterPlayers = players
    .filter((p) => effectiveTeam(p, gm.moveMap) === myTeam && num(p.salaries?.['2026-27']) > 0 && !waivedIds.has(p.id))
    .map((p) => ({ name: p.name, rating: num(p.rating), salary: num(p.salaries['2026-27']), kind: gm.moveMap[p.id] === myTeam && p.team !== myTeam ? 'trade' : 'contrat' }));
  const signed = gm.state.signings.map((s) => ({ name: byId.get(s.playerId)?.name || s.playerId, rating: num(byId.get(s.playerId)?.rating), salary: num(s.salary), kind: 'signé' }));
  const drafted = myDraft.map((d) => ({ name: PROSPECTS_2026.find((p) => p.rank === d.rank)?.name || `pick #${d.pick}`, rating: 0, salary: d.salary, kind: 'draft' }));
  const finalRoster = [...rosterPlayers, ...signed, ...drafted].sort((a, b) => b.salary - a.salary);
  const totalSalary = finalRoster.reduce((a, x) => a + x.salary, 0);
  const moveCount = gm.state.trades.length + gm.state.signings.length + myDraft.length + gm.state.waived.length + gm.state.extensions.length + gm.state.renounced.length;

  const KIND_COLOR = { contrat: C.muted, trade: C.green, signé: C.blue, draft: C.accent };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 20 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Bandeau validation */}
        {finalized ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, background: 'rgba(76,195,138,0.12)', border: `1px solid ${C.green}`, marginBottom: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>✓ Entresaison validée</div>
            <div style={{ color: C.muted, fontSize: 13, flex: 1 }}>{moveCount} mouvement{moveCount > 1 ? 's' : ''} · effectif final {finalRoster.length} joueurs · masse {fmtUSD(totalSalary)}</div>
            <button onClick={gm.unfinalize} style={btn}>✎ modifier</button>
            <button onClick={() => { if (confirm('Démarrer une nouvelle entresaison ? Tous tes mouvements seront effacés.')) gm.reset(); }} style={btn}>↺ nouvelle entresaison</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: 24, margin: 0 }}>Récap de l'entresaison</h1>
              <div style={{ color: C.muted, fontSize: 13 }}>{TEAM_BY_ABBR[myTeam]?.name} · {moveCount} mouvement{moveCount > 1 ? 's' : ''}</div>
            </div>
            <button onClick={gm.finalize} disabled={moveCount === 0} style={{ marginLeft: 'auto', padding: '11px 20px', borderRadius: 10, border: 'none', cursor: moveCount ? 'pointer' : 'not-allowed', background: moveCount ? C.green : C.surface2, color: moveCount ? '#10120f' : C.muted, fontWeight: 800, fontSize: 15 }}>
              ✓ Valider l'entresaison
            </button>
          </div>
        )}

        {/* Cap avant / après */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
          <RecapStat label="Masse avant" value={fmtUSD(before.taxSalary)} sub={capSummary(before.taxSalary, season).tierLabel} />
          <RecapStat label="Masse après" value={fmtUSD(cap.taxSalary)} sub={cap.post?.tierLabel || capSummary(cap.taxSalary, season).tierLabel} color={cap.taxSalary > before.taxSalary ? C.red : C.green} />
          <RecapStat label="Cap room" value={fmtUSD(cap.capRoomAvail)} sub={cap.capRoomAvail > 0 ? 'disponible' : 'au-dessus du cap'} color={cap.capRoomAvail > 0 ? C.green : C.muted} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Mouvements */}
          <div>
            <SectionTitle color={C.text}>Mouvements</SectionTitle>
            <RecapMoveList title="Trades" color={C.green} count={gm.state.trades.length}
              items={gm.state.trades.map((t) => `${(t.partners || []).filter((a) => a !== myTeam).join(', ')} — ${(t.inIds || []).map((id) => byId.get(id)?.name).filter(Boolean).join(', ') || '—'} ↔ ${(t.outIds || []).map((id) => byId.get(id)?.name).filter(Boolean).join(', ') || '—'}`)} />
            <RecapMoveList title="Signatures (FA)" color={C.blue} count={gm.state.signings.length}
              items={gm.state.signings.map((s) => `${byId.get(s.playerId)?.name || s.playerId} — ${fmtUSD(s.salary)}/an × ${s.years} (${s.method})`)} />
            <RecapMoveList title="Draft" color={C.accent} count={myDraft.length}
              items={myDraft.map((d) => `#${d.pick} ${PROSPECTS_2026.find((p) => p.rank === d.rank)?.name || ''} — ${fmtUSD(d.salary)}`)} />
            <RecapMoveList title="Extensions" color={C.purple} count={gm.state.extensions.length}
              items={gm.state.extensions.map((e) => `${byId.get(e.playerId)?.name || e.playerId} — +${e.years} an${e.years > 1 ? 's' : ''} dès ${fmtUSD(e.startSalary)}`)} />
            <RecapMoveList title="Waive / stretch" color={C.red} count={gm.state.waived.length}
              items={gm.state.waived.map((w) => `${byId.get(w.playerId)?.name || w.playerId} — ${w.mode}`)} />
            <RecapMoveList title="Cap holds renoncés" color={C.muted} count={gm.state.renounced.length}
              items={gm.state.renounced.map((id) => byId.get(id)?.name || id)} />
            {moveCount === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Aucun mouvement pour l'instant. Va dans Trades / Free Agency / Draft.</div>}
          </div>

          {/* Effectif final */}
          <div>
            <SectionTitle color={C.text}>Effectif final ({finalRoster.length}) · {fmtUSD(totalSalary)}</SectionTitle>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8 }}>
              {finalRoster.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderBottom: i < finalRoster.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <ImpactBubble score={p.rating} size={22} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: KIND_COLOR[p.kind], fontWeight: 700 }}>{p.kind}</span>
                  <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: C.muted, width: 60, textAlign: 'right' }}>{fmtUSD(p.salary)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecapStat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
    </div>
  );
}

function RecapMoveList({ title, color, count, items }) {
  if (!count) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color }}>{title} ({count})</div>
      {items.map((it, i) => <div key={i} style={{ fontSize: 12, color: C.muted, padding: '1px 0 1px 8px' }}>{it}</div>)}
    </div>
  );
}

function SavesBar({ gm }) {
  const [, bump] = useState(0);
  const saves = gm.listScenarios();
  function save() {
    const name = window.prompt('Nom de la sauvegarde :');
    if (name && name.trim()) { gm.saveScenario(name.trim()); bump((n) => n + 1); }
  }
  function del(name) {
    if (window.confirm(`Supprimer « ${name} » ?`)) { gm.deleteScenario(name); bump((n) => n + 1); }
  }
  function share() {
    const url = gm.shareLink();
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => window.alert('Lien de partage copié !')).catch(() => window.prompt('Copie ce lien :', url));
    else window.prompt('Copie ce lien :', url);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
      <button onClick={save} style={btn}>💾 sauver</button>
      {saves.length > 0 && (
        <select onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v === '__none') return; if (v.startsWith('del:')) del(v.slice(4)); else if (v) gm.loadScenario(v); }} value="__none" style={selStyle}>
          <option value="__none">charger…</option>
          {saves.map((n) => <option key={n} value={n}>📂 {n}</option>)}
          <option disabled>──────</option>
          {saves.map((n) => <option key={`d${n}`} value={`del:${n}`}>🗑 {n}</option>)}
        </select>
      )}
      <button onClick={share} style={btn}>🔗 partager</button>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: color || C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
function CapLine({ label, value, color, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
      <span style={{ color: C.muted }}>{label}</span>
      <b style={{ fontVariantNumeric: 'tabular-nums', color: color || C.text, fontWeight: strong ? 800 : 600 }}>{fmtUSD(value)}</b>
    </div>
  );
}
function SectionTitle({ children, color }) {
  return <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: color || C.text, marginBottom: 8, letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</div>;
}

const btn = { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer' };
const primaryBtn = { background: C.accent, color: '#10120f', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 800 };
const miniBtn = { background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '1px 7px', fontSize: 11, cursor: 'pointer' };
const selStyle = { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 8px', fontSize: 12, cursor: 'pointer' };
const input = { background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 9px', fontSize: 12 };
const row = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, borderBottom: `1px solid ${C.border}` };
const pill = (active) => ({ background: active ? C.accent : C.surface2, color: active ? '#10120f' : C.text, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 });
const chip = (active) => ({ background: active ? 'rgba(239,125,58,0.18)' : C.surface2, color: active ? C.accent : C.text, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 7, padding: '5px 9px', fontSize: 11, cursor: 'pointer' });
const tabStyle = (active) => ({ background: active ? C.surface2 : 'transparent', color: active ? C.accent : C.muted, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 700 });
