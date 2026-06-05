import { useState } from 'react';
import { Link } from 'react-router-dom';
import { C } from '../constants/palette.js';
import { TEAM_BY_ABBR } from '../constants/teams.js';
import { fmtUSD, num } from '../utils/format.js';
import { TeamChip, PlayerPhoto } from '../components/ui.jsx';
import PlayerModal from '../components/PlayerModal.jsx';

const ratingColor = (r) => (r >= 70 ? C.green : r >= 55 ? C.accent : r >= 45 ? C.yellow : C.muted);

export default function HomePage({ players, teams, meta }) {
  const [fiche, setFiche] = useState(null);

  const rated = players.filter((p) => p.stats && p.rating).sort((a, b) => b.rating - a.rating);
  const topRated = rated.slice(0, 6);
  const topFAs = players
    .filter((p) => num(p.salaries?.['2025-26']) > 0 && !(num(p.salaries?.['2026-27']) > 0))
    .map((p) => ({ ...p, _r: num(p.rating) }))
    .sort((a, b) => b._r - a._r)
    .slice(0, 6);
  const rostered = players.filter((p) => p.rostered).length;
  const faCount = players.filter((p) => num(p.salaries?.['2025-26']) > 0 && !(num(p.salaries?.['2026-27']) > 0)).length;

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {/* Hero */}
      <div style={{ position: 'relative', padding: '64px 40px 40px', background: `radial-gradient(900px 400px at 20% -10%, rgba(239,125,58,0.18), transparent), radial-gradient(700px 400px at 90% 0%, rgba(77,155,230,0.12), transparent)`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 13, color: C.accent, fontWeight: 800, letterSpacing: 1.5 }}>🏀 NBA OFFSEASON 2026 · CBA 2023</div>
          <h1 style={{ fontSize: 46, margin: '10px 0 8px', lineHeight: 1.05, maxWidth: 760 }}>Prends les commandes de ta franchise pour l'été 2026.</h1>
          <p style={{ color: C.muted, fontSize: 17, maxWidth: 620, margin: '0 0 26px' }}>
            Trades, free agency, draft, extensions — le tout validé par un vrai moteur de salary cap (luxury tax, aprons, Bird rights). Puis tu valides et tu obtiens ton récap.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/gm" style={{ ...btn, background: C.accent, color: C.ink, border: `2px solid ${C.accent}`, fontSize: 17, padding: '14px 28px', boxShadow: `0 0 20px -3px ${C.accent}` }}>▶ Commencer l'entresaison</Link>
            <Link to="/players" style={{ ...btn, fontSize: 16, padding: '14px 22px' }}>Parcourir les joueurs</Link>
          </div>

          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', marginTop: 34 }}>
            <Stat n={players.length} l="joueurs" />
            <Stat n={rostered} l="sous contrat" />
            <Stat n={faCount} l="agents libres 2026" />
            <Stat n={teams.length} l="équipes" />
            {meta && <Stat n={meta.season} l="stats source" />}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 40px 60px' }}>
        {/* Top notes */}
        <Section title="🔥 Meilleures notes" sub="Les joueurs les mieux notés de la saison 2025-26.">
          <Strip>
            {topRated.map((p) => <PlayerCard key={p.id} p={p} sub={`${num(p.stats.pts).toFixed(1)} pts`} onClick={() => setFiche(p)} />)}
          </Strip>
        </Section>

        {/* Agents libres */}
        <Section title="🎯 Agents libres 2026 en vue" sub="Les meilleurs profils disponibles cet été.">
          <Strip>
            {topFAs.map((p) => <PlayerCard key={p.id} p={p} sub={`${fmtUSD(p.salaries['2025-26'])} en 25-26`} onClick={() => setFiche(p)} />)}
          </Strip>
        </Section>

        {/* Modules */}
        <Section title="Le mode entresaison" sub="Tout se passe au même endroit, étape par étape.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
            <Feature to="/gm" icon="🔄" title="Trade Machine" desc="Échanges 2-4 équipes validés en direct (salary matching, aprons, Stepien) et exécutés dans ton GM." accent />
            <Feature to="/gm" icon="✍" title="Free Agency" desc="Signe dans les bonnes exceptions, re-signe via Bird rights, gère tes cap holds." />
            <Feature to="/gm" icon="🎟" title="Draft 2026 simulé" desc="La draft se déroule pick par pick sur l'ordre réel ; tu choisis quand c'est à toi." />
            <Feature to="/gm" icon="📊" title="Cap & Récap" desc="Feuille de paie pluriannuelle, waive & stretch, extensions, puis validation + récap." />
          </div>
        </Section>
      </div>

      {fiche && <PlayerModal player={fiche} players={players} onSelect={setFiche} onClose={() => setFiche(null)} />}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginBottom: 34 }}>
      <h2 style={{ fontSize: 20, margin: '0 0 2px' }}>{title}</h2>
      <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>{sub}</div>
      {children}
    </div>
  );
}

function Strip({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>{children}</div>;
}

function PlayerCard({ p, sub, onClick }) {
  const t = TEAM_BY_ABBR[p.team];
  const r = num(p.rating);
  const teamCol = t?.colors[0] || C.accent;
  return (
    <button onClick={onClick} className="tcard" style={{ '--card-accent': teamCol, '--card-glow': teamCol, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '18px 12px 14px', borderRadius: 14, cursor: 'pointer', color: C.text, marginTop: 8 }}>
      <span style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: ratingColor(r), color: C.ink, fontWeight: 700, fontSize: 13, borderRadius: 9, padding: '2px 10px', boxShadow: `0 0 12px -2px ${ratingColor(r)}`, fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5, whiteSpace: 'nowrap' }}>★ {r || '–'}</span>
      <PlayerPhoto player={p} size={74} round={false} />
      <div className="cond" style={{ fontWeight: 700, fontSize: 15, textAlign: 'center', lineHeight: 1.05, textTransform: 'uppercase' }}>{p.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
        <TeamChip abbr={p.team} size={16} /> {p.pos}
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
    </button>
  );
}

function Feature({ to, icon, title, desc, accent }) {
  const col = accent ? C.accent : C.border;
  return (
    <Link to={to} className="tcard" style={{ '--card-accent': col, '--card-glow': accent ? C.accent : 'transparent', textDecoration: 'none', color: C.text, padding: 18, borderRadius: 14, display: 'block' }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div className="cond" style={{ fontSize: 18, fontWeight: 700, marginTop: 8, textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{desc}</div>
    </Link>
  );
}

function Stat({ n, l }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{n}</div>
      <div style={{ color: C.muted, fontSize: 13 }}>{l}</div>
    </div>
  );
}

const btn = { textDecoration: 'none', color: C.text, background: C.surface2, border: `2px solid ${C.border}`, borderRadius: 11, padding: '11px 18px', display: 'inline-block', fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' };
