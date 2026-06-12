import { useMemo, useState } from 'react';
import { C } from '../constants/palette.js';
import { TEAMS, TEAM_BY_ABBR } from '../constants/teams.js';
import { CAP_YEARS } from '../constants/cba.js';
import { fmtUSD, num } from '../utils/format.js';
import { tradeableRoster, teamSalary, rosterCount, playerById } from '../utils/players.js';
import { yearsOfService } from '../utils/contracts.js';
import { evaluateTrade } from '../utils/trade.js';
import { tradeablePicks, anyPickLabel, isSlotPick, slotOf, slotPickLabel, stepienViolation } from '../utils/picks.js';
import { PROSPECT_BY_RANK } from '../utils/draft.js';
import { useGM } from '../context/GMContext.jsx';
import { TeamChip, TierBadge, PlayerAvatar } from '../components/ui.jsx';

export default function TradePage({ players, lockTeam }) {
  const gm = useGM();
  const owners = gm.slotOwners;       // override draft (trades exécutés)
  const moveMap = gm.moveMap;          // overlay joueurs (trades exécutés)
  const myTeam = gm.state.myTeam;
  const [season, setSeason] = useState('2026-27');
  const [teamAbbrs, setTeamAbbrs] = useState(() => {
    if (lockTeam) return [lockTeam, TEAMS.map((t) => t.abbr).find((a) => a !== lockTeam)];
    return ['BOS', 'LAL'];
  });
  const [assets, setAssets] = useState([]);       // { playerId, from, to }
  const [pickAssets, setPickAssets] = useState([]); // { pickId, from, to }
  const [stTeams, setStTeams] = useState(() => new Set()); // équipes recevant via sign-and-trade
  const toggleST = (abbr) => setStTeams((prev) => { const n = new Set(prev); n.has(abbr) ? n.delete(abbr) : n.add(abbr); return n; });

  const byId = useMemo(() => playerById(players), [players]);

  const evalInput = useMemo(() => ({
    year: season,
    teams: teamAbbrs.map((abbr) => {
      const outgoing = assets.filter((a) => a.from === abbr).map((a) => ({ id: a.playerId, salary: byId.get(a.playerId)?.salaries?.[season] || 0 }));
      const incoming = assets.filter((a) => a.to === abbr).map((a) => ({ id: a.playerId, salary: byId.get(a.playerId)?.salaries?.[season] || 0, yos: yearsOfService(byId.get(a.playerId)) }));
      const picksMoved = pickAssets.some((p) => p.from === abbr || p.to === abbr);
      return { abbr, preSalary: teamSalary(players, abbr, season, moveMap), rosterCount: rosterCount(players, abbr, season, moveMap), outgoing, incoming, picksMoved, tpe: abbr === myTeam ? gm.tpeTotal : 0, signTradeIn: stTeams.has(abbr) };
    }),
  }), [teamAbbrs, assets, pickAssets, season, players, byId, moveMap, myTeam, gm.tpeTotal, stTeams]);

  const result = useMemo(() => evaluateTrade(evalInput), [evalInput]);
  const resultByTeam = useMemo(() => Object.fromEntries(result.teams.map((t) => [t.abbr, t])), [result]);

  // Stepien : tient compte des picks futurs DÉJÀ échangés (gm.futureOwners).
  const stepien = useMemo(() => teamAbbrs.map((abbr) => stepienViolation(
    abbr,
    pickAssets.filter((p) => p.from === abbr).map((p) => p.pickId),
    pickAssets.filter((p) => p.to === abbr).map((p) => p.pickId),
    gm.futureOwners,
  )).filter(Boolean), [teamAbbrs, pickAssets, gm.futureOwners]);

  // Exécuter le trade dans le mode GM (seulement si MON équipe y participe).
  const myInvolved = !!myTeam && teamAbbrs.includes(myTeam)
    && (assets.some((a) => a.from === myTeam || a.to === myTeam) || pickAssets.some((p) => p.from === myTeam || p.to === myTeam));
  const canExecute = myInvolved && result.legal && stepien.length === 0;
  function executeTrade() {
    if (!canExecute) return;
    const playerMoves = assets.map((a) => ({ playerId: a.playerId, toTeam: a.to }));
    // Slots 2026 — y compris déjà draftés : transférer le slot = transférer les
    // droits du joueur sélectionné (il suit le slot, règle des draft rights).
    const pickMoves = pickAssets
      .filter((p) => isSlotPick(p.pickId))
      .map((p) => ({ slot: slotOf(p.pickId), toTeam: p.to }));
    // Picks futurs 2027+ : persistés pour que l'ownership suive (Stepien, listes).
    const futurePickMoves = pickAssets
      .filter((p) => !isSlotPick(p.pickId))
      .map((p) => ({ pickId: p.pickId, toTeam: p.to }));
    const inIds = assets.filter((a) => a.to === myTeam).map((a) => a.playerId);
    const outIds = assets.filter((a) => a.from === myTeam).map((a) => a.playerId);
    const myOut = assets.filter((a) => a.from === myTeam).reduce((s, a) => s + num(byId.get(a.playerId)?.salaries?.[season]), 0);
    const myIn = assets.filter((a) => a.to === myTeam).reduce((s, a) => s + num(byId.get(a.playerId)?.salaries?.[season]), 0);
    const tpeUsed = resultByTeam[myTeam]?.tpeUsed || 0;
    // On ne crée une TPE que si net-sortant ET aucune TPE n'a été consommée
    // (sinon on absorberait via une ancienne TPE ET on en créerait une nouvelle).
    const tpeCreated = (myOut > myIn && tpeUsed === 0) ? myOut - myIn + 250_000 : 0;
    gm.executeTrade({ partners: teamAbbrs.slice(), playerMoves, pickMoves, futurePickMoves, inIds, outIds, tpeCreated, tpeUsed });
    setAssets([]); setPickAssets([]);
  }

  function addAsset(playerId, from) {
    const to = teamAbbrs.find((a) => a !== from) || from;
    setAssets((prev) => (prev.some((a) => a.playerId === playerId) ? prev : [...prev, { playerId, from, to }]));
  }
  const removeAsset = (playerId) => setAssets((prev) => prev.filter((a) => a.playerId !== playerId));
  const setDest = (playerId, to) => setAssets((prev) => prev.map((a) => (a.playerId === playerId ? { ...a, to } : a)));

  function addPick(pickId, from) {
    const to = teamAbbrs.find((a) => a !== from) || from;
    setPickAssets((prev) => (prev.some((p) => p.pickId === pickId) ? prev : [...prev, { pickId, from, to }]));
  }
  const removePick = (pickId) => setPickAssets((prev) => prev.filter((p) => p.pickId !== pickId));
  const setPickDest = (pickId, to) => setPickAssets((prev) => prev.map((p) => (p.pickId === pickId ? { ...p, to } : p)));

  function changeTeam(idx, abbr) {
    const old = teamAbbrs[idx];
    setTeamAbbrs((prev) => prev.map((a, i) => (i === idx ? abbr : a)));
    setAssets((prev) => prev.filter((a) => a.from !== old && a.to !== old));
    setPickAssets((prev) => prev.filter((p) => p.from !== old && p.to !== old));
    setStTeams((prev) => { const n = new Set(prev); n.delete(old); return n; });
  }
  function addTeam() {
    const free = TEAMS.map((t) => t.abbr).find((a) => !teamAbbrs.includes(a));
    if (free && teamAbbrs.length < 4) setTeamAbbrs((prev) => [...prev, free]);
  }
  function removeTeam(abbr) {
    if (teamAbbrs.length <= 2) return;
    setTeamAbbrs((prev) => prev.filter((a) => a !== abbr));
    setAssets((prev) => prev.filter((a) => a.from !== abbr && a.to !== abbr));
    setPickAssets((prev) => prev.filter((p) => p.from !== abbr && p.to !== abbr));
    setStTeams((prev) => { const n = new Set(prev); n.delete(abbr); return n; });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>🔄 Trade Machine</div>
        <select value={season} onChange={(e) => setSeason(e.target.value)} style={selStyle}>
          {Object.entries(CAP_YEARS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {teamAbbrs.length < 4 && <button onClick={addTeam} style={btnStyle}>+ équipe</button>}
        {myTeam && teamAbbrs.includes(myTeam) && (
          <button onClick={executeTrade} disabled={!canExecute}
            title={!myInvolved ? `Ajoute des joueurs ou des picks de ${myTeam} au trade` : !canExecute ? 'Le trade doit être valide (verdict en bas)' : 'Commiter ce trade dans ton entresaison'}
            style={{ ...btnStyle, ...(canExecute ? { color: '#10120f', background: C.green, border: 'none', fontWeight: 800 } : { opacity: 0.45, cursor: 'not-allowed' }) }}>
            ✓ Exécuter pour {myTeam}
          </button>
        )}
        {!myTeam && <span style={{ fontSize: 11, color: C.muted }}>(choisis ton équipe dans « Mode GM » pour exécuter un trade)</span>}
        {gm.tpeTotal > 0 && <span style={{ fontSize: 11, color: C.blue, fontWeight: 700 }}>🎟 TPE {myTeam} : {fmtUSD(gm.tpeTotal)}</span>}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>
          cap {fmtUSD(CAP_YEARS[season].salaryCap)} · tax {fmtUSD(CAP_YEARS[season].luxuryTax)} · apron1 {fmtUSD(CAP_YEARS[season].firstApron)} · apron2 {fmtUSD(CAP_YEARS[season].secondApron)}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 12, padding: 12, overflow: 'auto' }}>
        {teamAbbrs.map((abbr, idx) => (
          <TeamPanel
            key={abbr} abbr={abbr} idx={idx} season={season} players={players} byId={byId}
            teamAbbrs={teamAbbrs} assets={assets} pickAssets={pickAssets} evalTeam={resultByTeam[abbr]} owners={owners} moveMap={moveMap}
            futureOwners={gm.futureOwners} draftPicks={gm.state.draftPicks}
            signTradeIn={stTeams.has(abbr)} onToggleST={() => toggleST(abbr)}
            onChangeTeam={changeTeam} onRemoveTeam={removeTeam}
            onAdd={addAsset} onRemove={removeAsset} onDest={setDest}
            onAddPick={addPick} onRemovePick={removePick} onPickDest={setPickDest}
          />
        ))}
      </div>

      <VerdictBar result={result} stepien={stepien} />
    </div>
  );
}

function TeamPanel({ abbr, idx, season, players, byId, teamAbbrs, assets, pickAssets, evalTeam, owners, moveMap, futureOwners, draftPicks, signTradeIn, onToggleST, onChangeTeam, onRemoveTeam, onAdd, onRemove, onDest, onAddPick, onRemovePick, onPickDest }) {
  const [q, setQ] = useState('');
  const [showPicks, setShowPicks] = useState(false);
  const roster = useMemo(() => tradeableRoster(players, abbr, season, moveMap), [players, abbr, season, moveMap]);
  const outgoing = assets.filter((a) => a.from === abbr);
  const incoming = assets.filter((a) => a.to === abbr);
  const outPicks = pickAssets.filter((p) => p.from === abbr);
  const inPicks = pickAssets.filter((p) => p.to === abbr);
  const sentPickIds = new Set(pickAssets.map((p) => p.pickId));
  const outIds = new Set(outgoing.map((a) => a.playerId));
  const filtered = roster.filter((p) => !outIds.has(p.id) && p.name.toLowerCase().includes(q.toLowerCase()));
  // Picks échangeables : slots 2026 (un slot déjà drafté = droits du joueur) +
  // picks futurs selon l'ownership courant (trades exécutés inclus).
  const ownedPicks = tradeablePicks(abbr, owners, futureOwners, draftPicks).filter((pk) => !sentPickIds.has(pk.id));
  // Libellé d'un pick dans les lignes ENVOIE/REÇOIT (droits du drafté inclus).
  const pickLabel = (pid) => {
    if (isSlotPick(pid)) {
      const rank = draftPicks?.[slotOf(pid)];
      const pr = rank != null ? PROSPECT_BY_RANK[rank] : null;
      if (pr) return `${slotPickLabel(slotOf(pid))} · droits ${pr.name}`;
    }
    return anyPickLabel(pid);
  };
  const others = teamAbbrs.filter((a) => a !== abbr);

  return (
    <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamChip abbr={abbr} />
          <select value={abbr} onChange={(e) => onChangeTeam(idx, e.target.value)} style={{ ...selStyle, flex: 1 }}>
            {TEAMS.map((t) => <option key={t.abbr} value={t.abbr} disabled={teamAbbrs.includes(t.abbr) && t.abbr !== abbr}>{t.name}</option>)}
          </select>
          {teamAbbrs.length > 2 && <button onClick={() => onRemoveTeam(abbr)} style={{ ...btnStyle, padding: '4px 8px' }}>✕</button>}
        </div>
        {evalTeam && <CapHeader e={evalTeam} />}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: signTradeIn ? C.blue : C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!signTradeIn} onChange={onToggleST} /> reçoit via sign-and-trade (hard cap 1er apron)
        </label>
      </div>

      {(outgoing.length > 0 || incoming.length > 0 || outPicks.length > 0 || inPicks.length > 0) && (
        <div style={{ padding: 10, borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8, background: C.bg }}>
          {(outgoing.length > 0 || outPicks.length > 0) && <AssetGroup title="ENVOIE ↑" color={C.red} items={outgoing} picks={outPicks} byId={byId} season={season} others={others} onRemove={onRemove} onDest={onDest} onRemovePick={onRemovePick} onPickDest={onPickDest} pickLabel={pickLabel} />}
          {(incoming.length > 0 || inPicks.length > 0) && <AssetGroup title="REÇOIT ↓" color={C.green} items={incoming} picks={inPicks} byId={byId} season={season} pickLabel={pickLabel} />}
        </div>
      )}

      <div style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer le roster…" style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => setShowPicks((s) => !s)} style={{ ...btnStyle, padding: '4px 8px', color: showPicks ? C.accent : C.text }}>🎟 picks</button>
      </div>

      {showPicks && (
        <div style={{ padding: '0 10px 8px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {ownedPicks.map((pk) => {
            const rights = pk.draftedRank != null ? PROSPECT_BY_RANK[pk.draftedRank] : null;
            const label = pk.slot
              ? `26 #${pk.slot}${rights ? ` · ${rights.name.split(' ').slice(-1)[0]}` : ''}`
              : `${pk.year} ${pk.round === 1 ? 'R1' : 'R2'}${pk.origTeam && pk.origTeam !== abbr ? ` (${pk.origTeam})` : ''}`;
            return (
              <button key={pk.id} onClick={() => onAddPick(pk.id, abbr)}
                title={rights ? `Droits de draft : ${rights.name} (sélectionné au #${pk.slot}) — l'échanger déplace le joueur, 0 $ au matching` : ''}
                style={{ ...pickChip, opacity: pk.round === 1 ? 1 : 0.7, ...(rights ? { borderColor: C.accent, color: C.accent } : {}) }}>
                {label}
              </button>
            );
          })}
          {!ownedPicks.length && <span style={{ fontSize: 11, color: C.muted }}>Aucun pick disponible.</span>}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
        {filtered.map((p) => (
          <div key={p.id} onClick={() => onAdd(p.id, abbr)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <PlayerAvatar player={p} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{p.pos} · {p.age} ans · {p.stats ? `${fmt1(p.stats.pts)}pts ${fmt1(p.stats.trb)}reb ${fmt1(p.stats.ast)}ast` : '—'}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: C.muted }}>{fmtUSD(p._salary)}</div>
          </div>
        ))}
        {!filtered.length && <div style={{ color: C.muted, fontSize: 12, padding: 10 }}>Aucun joueur.</div>}
      </div>
    </div>
  );
}

function CapHeader({ e }) {
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TierBadge tier={e.preTier} />
        <span style={{ color: C.muted, fontSize: 11 }}>→</span>
        <TierBadge tier={e.postTier} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>masse</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: C.muted }}>{fmtUSD(e.preSalary)} → <b style={{ color: C.text }}>{fmtUSD(e.postSalary)}</b></span>
        <span style={{ color: e.net > 0 ? C.red : e.net < 0 ? C.green : C.muted }}>{e.net > 0 ? '+' : ''}{fmtUSD(e.net)}</span>
      </div>
      {e.inSalary > 0 && (
        <div style={{ fontSize: 11, color: e.salaryLegal ? C.muted : C.red }}>
          reprend {fmtUSD(e.inSalary)} / max {fmtUSD(e.maxIncoming)} {e.salaryLegal ? '✓' : `✗ (−${fmtUSD(e.overGap)})`}
        </div>
      )}
    </div>
  );
}

function AssetGroup({ title, color, items, picks = [], byId, season, others, onRemove, onDest, onRemovePick, onPickDest, pickLabel = anyPickLabel }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: 0.5, marginBottom: 4 }}>{title}</div>
      {items.map((a) => {
        const p = byId.get(a.playerId);
        if (!p) return null;
        return (
          <div key={a.playerId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12 }}>
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: C.muted }}>{fmtUSD(p.salaries?.[season])}</span>
            {others && onDest && others.length > 1 && (
              <select value={a.to} onChange={(e) => onDest(a.playerId, e.target.value)} style={{ ...selStyle, padding: '1px 4px', fontSize: 11 }}>
                {others.map((o) => <option key={o} value={o}>→{o}</option>)}
              </select>
            )}
            {others && onDest && others.length === 1 && <span style={{ color: C.muted, fontSize: 11 }}>→{a.to}</span>}
            {onRemove && <button onClick={() => onRemove(a.playerId)} style={{ ...btnStyle, padding: '0 6px', color: C.muted }}>✕</button>}
          </div>
        );
      })}
      {picks.map((pa) => (
        <div key={pa.pickId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12 }}>
          <span style={{ flex: 1, color: C.accent }}>🎟 {pickLabel(pa.pickId)}</span>
          {others && onPickDest && others.length > 1 && (
            <select value={pa.to} onChange={(e) => onPickDest(pa.pickId, e.target.value)} style={{ ...selStyle, padding: '1px 4px', fontSize: 11 }}>
              {others.map((o) => <option key={o} value={o}>→{o}</option>)}
            </select>
          )}
          {others && onPickDest && others.length === 1 && <span style={{ color: C.muted, fontSize: 11 }}>→{pa.to}</span>}
          {onRemovePick && <button onClick={() => onRemovePick(pa.pickId)} style={{ ...btnStyle, padding: '0 6px', color: C.muted }}>✕</button>}
        </div>
      ))}
    </div>
  );
}

function VerdictBar({ result, stepien = [] }) {
  const errors = result.teams.flatMap((t) => t.errors.map((e) => ({ abbr: t.abbr, e })));
  const warnings = result.teams.flatMap((t) => t.warnings.map((w) => ({ abbr: t.abbr, w })));
  const hardCaps = result.teams.filter((t) => t.hardCaps.length).map((t) => ({ abbr: t.abbr, lines: t.hardCaps }));
  const ok = result.legal && stepien.length === 0;
  const color = result.empty ? C.muted : ok ? C.green : C.red;

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, background: C.surface, padding: '12px 20px', maxHeight: '32vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color }}>
          {result.empty ? '— Ajoute des joueurs ou des picks des deux côtés' : ok ? '✓ Trade valide' : '✗ Trade invalide'}
        </div>
        {!result.empty && (
          <div style={{ display: 'flex', gap: 8, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
            {result.teams.filter((t) => t.inSalary > 0 || t.outSalary > 0).map((t) => (
              <span key={t.abbr} style={{ padding: '2px 8px', borderRadius: 5, background: C.bg, border: `1px solid ${t.legal ? C.border : C.red}` }}>
                <b>{t.abbr}</b> out {fmtUSD(t.outSalary)} · in {fmtUSD(t.inSalary)} {t.legal ? '✓' : '✗'}
              </span>
            ))}
          </div>
        )}
      </div>
      {hardCaps.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.yellow }}>
          ⚠ Hard cap : {hardCaps.map((h) => `${h.abbr} (${h.lines.join(', ')})`).join(' · ')}
        </div>
      )}
      {stepien.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: C.yellow, fontSize: 12 }}>
          {stepien.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
      {errors.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: C.red, fontSize: 12 }}>
          {errors.map((x, i) => <li key={i}><b>{x.abbr}</b> — {x.e}</li>)}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: C.muted, fontSize: 12 }}>
          {warnings.map((x, i) => <li key={i}><b>{x.abbr}</b> — {x.w}</li>)}
        </ul>
      )}
    </div>
  );
}

const fmt1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const selStyle = { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', fontSize: 12, cursor: 'pointer' };
const btnStyle = { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer' };
const inputStyle = { width: '100%', background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 9px', fontSize: 12 };
const pickChip = { background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 7px', fontSize: 11, cursor: 'pointer' };
