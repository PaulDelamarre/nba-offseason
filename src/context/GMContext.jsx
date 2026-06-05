import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { simulate, autoOne } from '../utils/draft.js';

// État du « mode GM » : l'équipe gérée + les mouvements d'entresaison.
const STORAGE_KEY = 'nbagm_v1';
const SAVES_KEY = 'nbagm_saves_v1';
const readSaves = () => { try { return JSON.parse(localStorage.getItem(SAVES_KEY) || '{}'); } catch { return {}; } };
const writeSaves = (s) => { try { localStorage.setItem(SAVES_KEY, JSON.stringify(s)); } catch { /* ignore */ } };

const INITIAL = {
  myTeam: null,                 // abbr de l'équipe gérée
  season: '2026-27',
  signings: [],                 // { playerId, salary, years, method }
  renounced: [],                // ids de FA maison renoncés (libère la cap room)
  waived: [],                   // { playerId, mode: 'waive' | 'stretch' }
  extensions: [],               // { playerId, years, startSalary }
  draftPicks: {},               // { [pickNum]: prospectRank } — déroulé de la draft
  trades: [],                   // trades exécutés : { id, partners, playerMoves:[{playerId,toTeam}], pickMoves:[{slot,toTeam}], summary }
  tpes: [],                     // traded player exceptions : { id, amount }
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
    case 'EXECUTE_TRADE': {
      const id = state.tradeSeq;
      const before = state.tpes; // snapshot pour pouvoir annuler
      // Consomme la TPE utilisée (plus anciennes d'abord), puis ajoute la créée.
      let remaining = action.payload.tpeUsed || 0;
      let tpes = state.tpes.map((t) => {
        if (remaining <= 0) return t;
        const take = Math.min(t.amount, remaining);
        remaining -= take;
        return { ...t, amount: t.amount - take };
      }).filter((t) => t.amount > 0);
      if (action.payload.tpeCreated > 0) tpes = [...tpes, { id, amount: action.payload.tpeCreated }];
      const trade = { id, ...action.payload, tpesBefore: before };
      return { ...state, trades: [...state.trades, trade], tpes, tradeSeq: id + 1 };
    }
    case 'UNDO_TRADE': {
      const t = state.trades.find((x) => x.id === action.id);
      return { ...state, trades: state.trades.filter((x) => x.id !== action.id), tpes: t?.tpesBefore ?? state.tpes };
    }
    case 'CLEAR_TRADES':
      return { ...state, trades: [], tpes: [] };
    case 'LOAD_STATE':
      return { ...INITIAL, ...action.payload };
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
    try {
      const shared = new URLSearchParams(window.location.search).get('gm');
      if (shared) {
        const st = JSON.parse(decodeURIComponent(escape(atob(shared))));
        window.history.replaceState({}, '', window.location.pathname);
        return { ...INITIAL, ...st };
      }
      const raw = localStorage.getItem(STORAGE_KEY); if (raw) return { ...INITIAL, ...JSON.parse(raw) };
    } catch { /* ignore */ }
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
      tpes: state.tpes,
      tpeTotal: state.tpes.reduce((a, t) => a + t.amount, 0),
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
      // Sauvegardes nommées + partage
      listScenarios: () => Object.keys(readSaves()).sort(),
      saveScenario: (name) => { const s = readSaves(); s[name] = state; writeSaves(s); },
      loadScenario: (name) => { const s = readSaves(); if (s[name]) dispatch({ type: 'LOAD_STATE', payload: s[name] }); },
      deleteScenario: (name) => { const s = readSaves(); delete s[name]; writeSaves(s); },
      shareLink: () => `${window.location.origin}${window.location.pathname}?gm=${btoa(unescape(encodeURIComponent(JSON.stringify(state))))}`,
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
