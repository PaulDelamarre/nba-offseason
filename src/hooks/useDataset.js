import { useEffect, useState } from 'react';
import { attachRatings } from '../utils/rating.js';

// Charge le dataset statique (scrapé par `npm run scrape`) depuis public/data.
// Renvoie { players, teams, meta, loading, error }.
export function useDataset() {
  const [state, setState] = useState({ players: [], teams: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [players, teams, meta] = await Promise.all([
          fetch('/data/players.json').then((r) => { if (!r.ok) throw new Error('players.json ' + r.status); return r.json(); }),
          fetch('/data/teams.json').then((r) => { if (!r.ok) throw new Error('teams.json ' + r.status); return r.json(); }),
          fetch('/data/meta.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        attachRatings(players); // calcule p.rating (0-100) par percentile
        if (alive) setState({ players, teams, meta, loading: false, error: null });
      } catch (error) {
        if (alive) setState((s) => ({ ...s, loading: false, error }));
      }
    })();
    return () => { alive = false; };
  }, []);

  return state;
}
