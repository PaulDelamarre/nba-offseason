import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { C } from './constants/palette.js';
import { useDataset } from './hooks/useDataset.js';
import { GMProvider } from './context/GMContext.jsx';
import HomePage from './pages/HomePage.jsx';
import TradePage from './pages/TradePage.jsx';
import TeamsPage from './pages/TeamsPage.jsx';
import PlayersPage from './pages/PlayersPage.jsx';
import GMPage from './pages/GMPage.jsx';

const NAV = [
  { to: '/', label: 'Accueil', icon: '🏠', end: true },
  { to: '/gm', label: 'Entresaison', icon: '📋' },
  { to: '/teams', label: 'Équipes', icon: '🏀' },
  { to: '/players', label: 'Joueurs', icon: '👤' },
];

function Sidebar() {
  return (
    <div style={{ width: 76, borderRight: `1px solid ${C.border}`, background: C.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, gap: 6, flexShrink: 0 }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>🏀</div>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end}
          style={({ isActive }) => ({
            width: 60, padding: '9px 4px', borderRadius: 8, textDecoration: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: isActive ? C.accent : C.muted,
            background: isActive ? 'rgba(239,125,58,0.12)' : 'transparent',
            border: `1.5px solid ${isActive ? C.accent : 'transparent'}`,
          })}>
          <span style={{ fontSize: 18 }}>{n.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>{n.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

function Center({ children, sub }) {
  return (
    <div style={{ width: '100vw', height: '100vh', background: C.bg, color: C.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      {children}
      {sub && <div style={{ color: C.muted, fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const { players, teams, meta, loading, error } = useDataset();

  if (loading) return (
    <Center sub="Chargement du dataset NBA…">
      <div style={{ width: 54, height: 54, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
    </Center>
  );
  if (error) return (
    <Center sub={String(error.message || error)}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>⚠ Données introuvables</div>
      <div style={{ color: C.muted, fontSize: 13, maxWidth: 460, textAlign: 'center' }}>
        Lance d'abord le scraping : <code style={{ color: C.accent }}>npm run scrape</code> (génère public/data/*.json).
      </div>
    </Center>
  );

  return (
    <GMProvider>
      <BrowserRouter>
        <div style={{ width: '100vw', height: '100vh', display: 'flex', background: C.bg, color: C.text, overflow: 'hidden' }}>
          <Sidebar />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<HomePage players={players} teams={teams} meta={meta} />} />
              <Route path="/trade" element={<TradePage players={players} teams={teams} />} />
              <Route path="/gm" element={<GMPage players={players} />} />
              <Route path="/teams" element={<TeamsPage players={players} teams={teams} />} />
              <Route path="/players" element={<PlayersPage players={players} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </GMProvider>
  );
}
