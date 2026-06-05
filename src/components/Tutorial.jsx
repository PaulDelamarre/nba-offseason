import { Link } from 'react-router-dom';
import { C } from '../constants/palette.js';

const STEPS = [
  { icon: '🏀', title: 'Choisis ta franchise', desc: 'Dans « Entresaison », prends les commandes d\'une des 30 équipes.' },
  { icon: '🔄', title: 'Fais tes mouvements', desc: 'Trades (validés par le moteur CBA), free agency, draft simulée — tout au même endroit.' },
  { icon: '📊', title: 'Valide & récap', desc: 'Quand tu as fini, valide ton entresaison et obtiens le récap (cap avant/après, effectif final).' },
];

export default function Tutorial({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="tcard" style={{ '--card-accent': C.accent, '--card-glow': C.accent, width: 'min(560px, 96vw)', borderRadius: 16, padding: 26 }}>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 800, letterSpacing: 1.2 }}>🏀 BIENVENUE</div>
        <h1 style={{ fontSize: 30, margin: '6px 0 4px', textTransform: 'uppercase' }}>Simulateur d'entresaison NBA</h1>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 0 }}>Trois étapes pour gérer l'été 2026 de ta franchise :</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '18px 0' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.surface2, border: `2px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div className="cond" style={{ fontWeight: 700, fontSize: 16, textTransform: 'uppercase' }}>{i + 1}. {s.title}</div>
                <div style={{ fontSize: 13, color: C.muted }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/gm" onClick={onClose} style={{ flex: 1, textAlign: 'center', textDecoration: 'none', background: C.accent, color: C.ink, fontWeight: 800, padding: '12px', borderRadius: 10, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: 0.5, boxShadow: `0 0 18px -4px ${C.accent}` }}>▶ Commencer l'entresaison</Link>
          <button onClick={onClose} style={{ background: C.surface2, color: C.text, border: `2px solid ${C.border}`, borderRadius: 10, padding: '12px 18px', cursor: 'pointer', fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase' }}>Explorer</button>
        </div>
      </div>
    </div>
  );
}
