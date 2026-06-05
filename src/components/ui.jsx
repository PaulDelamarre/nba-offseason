import { useState } from 'react';
import { C, CAP_STATUS_COLORS } from '../constants/palette.js';
import { TEAM_BY_ABBR, teamLogoUrl } from '../constants/teams.js';
import { fmtUSD, num } from '../utils/format.js';
import { photoUrl } from '../utils/players.js';

// Photo headshot (BBRef) avec repli sur les initiales si absente/erreur.
export function PlayerPhoto({ player, size = 40, round = true }) {
  const [err, setErr] = useState(false);
  const url = photoUrl(player?.id);
  const radius = round ? '50%' : 8;
  const frame = `2px solid ${C.border}`;
  if (!url || err) {
    const initials = (player?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return (
      <div style={{ width: size, height: size, borderRadius: radius, background: C.surface2, color: C.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 800, flexShrink: 0, border: frame }}>{initials}</div>
    );
  }
  return <img src={url} onError={() => setErr(true)} alt={player?.name || ''} loading="lazy" style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', objectPosition: 'top', background: C.surface2, flexShrink: 0, border: frame }} />;
}

// Photo + petite pastille de note (pour les listes de joueurs).
export function PlayerAvatar({ player, size = 36 }) {
  const r = num(player?.rating);
  const col = r >= 70 ? C.green : r >= 55 ? C.accent : r >= 45 ? C.yellow : C.muted;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <PlayerPhoto player={player} size={size} />
      <span style={{ position: 'absolute', bottom: -3, right: -5, background: col, color: '#10120f', fontSize: Math.max(9, size * 0.3), fontWeight: 800, borderRadius: 7, padding: '0 3px', border: `1.5px solid ${C.bg}` }}>{r || '–'}</span>
    </div>
  );
}

// Logo de l'équipe (ESPN) avec repli sur une pastille colorée si indispo.
export function TeamChip({ abbr, size = 30 }) {
  const [err, setErr] = useState(false);
  const t = TEAM_BY_ABBR[abbr];
  const col = t ? t.colors[0] : C.border;
  const url = teamLogoUrl(abbr);
  if (url && !err) {
    return <img src={url} onError={() => setErr(true)} alt={abbr} loading="lazy" style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, verticalAlign: 'middle' }} />;
  }
  return (
    <span style={{
      width: size, height: size, borderRadius: 7, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: col, color: '#fff', fontSize: size * 0.36, fontWeight: 800,
      border: `1px solid rgba(255,255,255,0.15)`, letterSpacing: 0.3,
    }}>{abbr}</span>
  );
}

const TIER_LABEL = {
  under: 'ROOM', over: 'OVER CAP', tax: 'TAX', apron1: '1er APRON', apron2: '2e APRON',
};

// Badge de statut fiscal d'une équipe.
export function TierBadge({ tier }) {
  const col = CAP_STATUS_COLORS[tier] || C.muted;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5,
      color: col, background: `${col}1f`, border: `1px solid ${col}55`, letterSpacing: 0.4,
    }}>{TIER_LABEL[tier] || tier}</span>
  );
}

export function Money({ value, strong, color }) {
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : 500, color: color || 'inherit' }}>{fmtUSD(value)}</span>;
}

// Petite bulle d'indice d'impact (0-99).
export function ImpactBubble({ score, size = 26 }) {
  const col = score >= 70 ? C.green : score >= 55 ? C.accent : score >= 45 ? C.yellow : C.muted;
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, color: '#10120f',
      background: col,
    }}>{score || '–'}</span>
  );
}

export function Panel({ children, style }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>{children}</div>;
}
