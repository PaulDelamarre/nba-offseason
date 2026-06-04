import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { simulate, autoOne } from '../utils/draft.js';

// État du « mode GM » : l'équipe gérée + les mouvements d'entresaison.
const STORAGE_KEY = 'nbagm_v1';

const INITIAL = {
  myTeam: null,                 // abbr de l'équipe gérée
  season: '2026-27',
  signings: [],                 // { playerId, salary, years, method }
  renounced: [],                // ids de FA maison renoncés (libère la cap room)
  waived: [],                   // { playerId, mode: 'waive' | 'stretch' }
  extensions: [],               // { playerId, years, startSalary }
  draftPicks: {},               // { [pickNum]: prospectRank } — déroulé de la draft
  trades: [],                   // trades exécutés : { id, partners, playerMoves:[{playerId,toTeam}], pickMoves:[{slot,toTeam}], summary }
  tradeSeq: 0,                  // compteur d'id de trade (déterministe)
  finalized: false,             // entresaison validée (récap figé)
  lineup: {},                   // 5 majeur : { PG, SG, SF, PF, C } -> playerId
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TEAM':
      return { ...INITIAL, myTeam: action.abbr };
    case 'SIGN': {
      const { playerId } = action.payload;
      const signings = [...state.signings.filter((s) => s.playerId !== playerId), action.payload];
      return { ...state, signings, renounced: state.renounced.filter((id) => id !== playerId) };
    }
    case 'UNSIGN':
      return { ...state, signings: state.signings.filter((s) => s.playerId !== action.playerId) };
    case 'RENOUNCE':
      return { ...state, renounced: [...new Set([...state.renounced, action.playerId])] };
    case 'UNRENOUNCE':
      return { ...state, renounced: state.renounced.filter((id) => id !== action.playerId) };
    case 'WAIVE': {
      const waived = [...state.waived.filter((w) => w.playerId !== action.playerId), { playerId: action.playerId, mode: action.mode }];
      return { ...state, waived };
    }
    case 'UNWAIVE':
      return { ...state, waived: state.waived.filter((w) => w.playerId !== action.playerId) };
    case 'EXTEND': {
      const extensions = [...state.extensions.filter((e) => e.playerId !== action.payload.playerId), action.payload];
      return { ...state, extensions };
    }
    case 'UNEXTEND':
      return { ...state, extensions: state.extensions.filter((e) => e.playerId !== action.playerId) };
    case 'SET_DRAFT':
      return { ...state, draftPicks: action.draftPicks };
    case 'EXECUTE_TRADE':
      return { ...state, trades: [...state.trades, { id: state.tradeSeq, ...action.payload }], tradeSeq: state.tradeSeq + 1 };
    case 'UNDO_TRADE':
      return { ...state, trades: state.trades.filter((t) => t.id !== action.id) };
    case 'CLEAR_TRADES':
      return { ...state, trades: [] };
    case 'SET_LINEUP_SLOT': {
      // un joueur ne peut occuper qu'un poste : on le retire de tout autre slot
      const lineup = { ...state.lineup };
      if (action.playerId) for (const k of Object.keys(lineup)) if (lineup[k] === action.playerId) delete lineup[k];
      if (action.playerId) lineup[action.pos] = action.playerId; else delete lineup[action.pos];
      return { ...state, lineup };
    }
    case 'FINALIZE':
      return { ...state, finalized: true };
    case 'UNFINALIZE':
      return { ...state, finalized: false };
    case 'RESET':
      return { ...INITIAL, myTeam: state.myTeam };
    default:
      return state;
  }
}

const GMContext = createContext(null);

// Overlays dérivés des trades exécutés.
function tradeMoveMap(trades) {
  const moveMap = {}; // playerId -> équipe de destination
  const slotOwners = {}; // slot de draft -> équipe propriétaire
  for (const t of trades) {
    for (const pm of t.playerMoves || []) moveMap[pm.playerId] = pm.toTeam;
    for (const pk of t.pickMoves || []) slotOwners[pk.slot] = pk.toTeam;
  }
  return { moveMap, slotOwners };
}

export function GMProvider({ children }) {
  const init = (() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return { ...INITIAL, ...JSON.parse(raw) }; } catch { /* ignore */ }
    return INITIAL;
  })();
  const [state, dispatch] = useReducer(reducer, init);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const value = useMemo(() => {
    const { moveMap, slotOwners } = tradeMoveMap(state.trades);
    return {
      state,
      moveMap,            // overlay joueurs (trades exécutés)
      slotOwners,         // overlay picks (trades exécutés) -> ordre de draft
      renouncedSet: new Set(state.renounced),
      setTeam: (abbr) => dispatch({ type: 'SET_TEAM', abbr }),
      sign: (payload) => dispatch({ type: 'SIGN', payload }),
      unsign: (playerId) => dispatch({ type: 'UNSIGN', playerId }),
      renounce: (playerId) => dispatch({ type: 'RENOUNCE', playerId }),
      unrenounce: (playerId) => dispatch({ type: 'UNRENOUNCE', playerId }),
      waive: (playerId, mode) => dispatch({ type: 'WAIVE', playerId, mode }),
      unwaive: (playerId) => dispatch({ type: 'UNWAIVE', playerId }),
      extend: (payload) => dispatch({ type: 'EXTEND', payload }),
      unextend: (playerId) => dispatch({ type: 'UNEXTEND', playerId }),
      draftSelect: (pick, rank) => dispatch({ type: 'SET_DRAFT', draftPicks: { ...state.draftPicks, [pick]: rank } }),
      autoPick: () => dispatch({ type: 'SET_DRAFT', draftPicks: autoOne(state.draftPicks) }),
      simDraft: (stopTeam) => dispatch({ type: 'SET_DRAFT', draftPicks: simulate(state.draftPicks, stopTeam, slotOwners) }),
      undoDraftPick: (pick) => { const n = { ...state.draftPicks }; delete n[pick]; dispatch({ type: 'SET_DRAFT', draftPicks: n }); },
      resetDraft: () => dispatch({ type: 'SET_DRAFT', draftPicks: {} }),
      executeTrade: (payload) => dispatch({ type: 'EXECUTE_TRADE', payload }),
      undoTrade: (id) => dispatch({ type: 'UNDO_TRADE', id }),
      clearTrades: () => dispatch({ type: 'CLEAR_TRADES' }),
      finalize: () => dispatch({ type: 'FINALIZE' }),
      unfinalize: () => dispatch({ type: 'UNFINALIZE' }),
      setLineupSlot: (pos, playerId) => dispatch({ type: 'SET_LINEUP_SLOT', pos, playerId }),
      reset: () => dispatch({ type: 'RESET' }),
    };
  }, [state]);

  return <GMContext.Provider value={value}>{children}</GMContext.Provider>;
}

export function useGM() {
  const ctx = useContext(GMContext);
  if (!ctx) throw new Error('useGM must be used inside GMProvider');
  return ctx;
}
