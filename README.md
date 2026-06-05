# NBA Offseason — Simulateur d'entresaison + Trade Machine

Jeu d'entresaison NBA (été 2026) avec une **trade machine** qui valide les échanges
selon les vraies règles du **CBA 2023** (salary cap, luxury tax, 1er/2e apron, hard cap).
Inspiré de [Fanspo](https://fanspo.com/nba/trade-machine). Même esprit que le projet
FootMercato, transposé au basket.

- **Front** : React 19 + Vite 8 + React Router 7 (100 % statique, pas de backend, pas d'auth)
- **Données** : scrapées depuis Basketball-Reference → `public/data/*.json`
- **Moteur CBA** : `src/utils/trade.js` (testé, 12 tests Vitest)

## Lancer

```bash
npm install
npm run scrape    # (re)génère public/data/*.json depuis Basketball-Reference (~2 min, poli)
npm run dev       # http://localhost:5173
```

Le dataset est déjà commité dans `public/data/`, donc `npm run dev` marche sans re-scraper.

## Déploiement (Vercel)

Front 100 % statique, **aucune variable d'environnement**, données servies depuis `public/data/` → déploiement direct.

**Via GitHub (recommandé)**
1. Pousser le dossier `nbamanager/` sur un repo GitHub (le dataset `public/data/*.json` doit être commité ; `scripts/.cache/` est ignoré).
2. Sur [vercel.com](https://vercel.com) → **Add New Project** → importer le repo.
3. Vercel auto-détecte **Vite**. Laisser : Build `npm run build`, Output `dist`. **Root Directory = `nbamanager`** si le repo contient le dossier parent `NBA/`.
4. **Deploy**.

**Via CLI** : `npm i -g vercel` puis `vercel` (puis `vercel --prod`) depuis `nbamanager/`.

Détails de config :
- `vercel.json` — fallback SPA : réécrit les routes **sans extension** (`/gm`, `/players`…) vers `index.html`, en laissant passer `/data/*.json` et `/assets/*`. Indispensable pour que le rafraîchissement d'une route profonde ne fasse pas un 404.
- `engines.node >= 20` (requis par Vite 8).
- `.vercelignore` exclut `scripts/.cache` (33 Mo de HTML brut, inutile en prod).
- Pas de scraping au déploiement : le build copie simplement `public/data/` dans `dist/`.

| Script            | Action                                                            |
|-------------------|-------------------------------------------------------------------|
| `npm run dev`     | Serveur de dev Vite (port 5173)                                   |
| `npm run scrape`  | Scrape BBRef (stats + contrats) → `public/data/players.json`…     |
| `npm run build`   | Build de prod dans `dist/`                                        |
| `npm run test`    | Tests Vitest (moteur de trade)                                    |

## Données (`npm run scrape`)

`scripts/scrape_bbref.mjs` assemble **un dataset unifié** :
- **Stats per-game + advanced** : `/leagues/NBA_2026_per_game.html` & `_advanced.html` (une page chacune, tous les joueurs).
- **Contrats pluriannuels** : `/contracts/<ABBR>.html` pour les 30 équipes (salaires 2025-26 → 2030-31).
- Fusion par **id joueur BBRef**. Le contrat fait foi pour l'équipe/roster, les stats pour la production.
- Cache disque (`scripts/.cache/`) + délai 3,5 s entre requêtes (respecte la limite ~20 req/min de BBRef).

Sorties : `players.json` (608 joueurs), `teams.json` (30 équipes + masse salariale 2026-27), `meta.json`.

## Le moteur CBA (`src/`)

- `constants/cba.js` — chiffres **vérifiés** : cap 2026-27 (~165 M$), tax, aprons, exceptions (MLE/BAE),
  minimums par ancienneté, et les **paliers de salary matching** (200%+250K / +7,5M / 125%+250K).
- `utils/cap.js` — statut fiscal d'une équipe + facture de luxury tax progressive.
- `utils/trade.js` — **validation d'un trade** équipe par équipe :
  - matching par paliers (équipe sous le 1er apron), 100 % au 1er apron, blocages du 2e apron,
  - absorption dans la cap room, hard cap au 1er apron (matching étendu),
  - limite de cash, taille de roster.

Chaque joueur a une **note 0-100 par percentile** (par poste, atténuée par les minutes — `src/utils/rating.js`), calculée au chargement et affichée partout (bulle colorée).

### Pages
- **Entresaison / Mode GM** (`/gm`) — le cœur du jeu : tu **choisis ta franchise**, tu fais tes mouvements de l'été, puis tu **valides** et obtiens un **récap**. 5 onglets :
  - *Effectif & Cap* : **terrain de basket** (5 majeur, **avec photos**), gestion des contrats (**waive & stretch**, **extensions**), **trades exécutés**, **TPE** générées, **sauvegarde/chargement** de scénarios nommés + **lien de partage**, résumé cap (dont **luxury tax récidiviste** + **charge de roster incomplet**), et **tableau de paie** joueur × saison avec **code couleur des options** (PO/TO/ETO/NG) et **année UFA**.
  - *Trades* : la **Trade Machine** (2-4 équipes, joueurs + picks + Stepien, verdict CBA live) verrouillée sur ton équipe → **« Exécuter »** commite le trade. Gère maintenant : **exception minimum** (joueur au min sans matching), **TPE** (créées/utilisées), **sign-and-trade** (hard cap 1er apron).
  - *Free Agency* : signe les FA dans les bonnes exceptions (cap room, MLE, BAE, min), re-signe via **Bird rights**, renonce aux cap holds.
  - *Draft 2026* : **simulation pick par pick** sur l'ordre réel (60 choix). Les CPU piochent le meilleur dispo ; tu choisis sur l'horloge ; rookie scale du slot au cap.
  - *Récap* : cap **avant → après**, tous les mouvements (trades, signatures, draft, waives, extensions), **effectif final** (note + masse), et bouton **« Valider l'entresaison »**.
- **Équipes** (`/teams`) — les 30 franchises, masse salariale, position vs cap/tax/apron.
- **Joueurs** (`/players`) — table triable avec **photo** + **logo d'équipe**, note + stats 25-26 + salaire 26-27, **code couleur des options** (PO/TO) et colonne **Contrat / année UFA**. **Filtres** : recherche, équipe, poste, statut, note min, âge max. **Clic → fiche** (photo, **archétype**, stats, contrat coloré, **profils similaires**). Fiche accessible partout (effectif, FA, accueil, nuage).
- **Compare** (`/compare`) — **comparateur 2 joueurs** : radar hexagonal (percentiles ligue) + table de stats côte à côte.
- **Nuage** (`/scatter`) — **scatter plot configurable** : 2 stats en X/Y, tous les joueurs en nuage cliquable → fiche.

> La Trade Machine reste accessible en solo via `/trade`, mais le parcours principal passe par l'onglet *Trades* du Mode GM.

## Limites connues (v1) & prochaines étapes
- Masse salariale = somme des salaires BBRef 2026-27 (inclut le non-garanti / options ; pas encore de distinction garanti vs cap hold).
- Free agency v1 : Bird rights simplifié (tout FA maison = Bird, sans distinguer Early-Bird/Non-Bird ni la tenure exacte) ; RFA détecté par heuristique (jeune + peu d'ancienneté) ; cap hold estimé (120/140 % du salaire précédent).
- Draft : la simulation CPU pioche le **meilleur disponible** du board. Ordre 2026 = mock ESPN réel ; picks **futurs** (2027-2031) = mécanisme de transfert prêt (`FUTURE_PICK_TRANSFERS`) mais vide par défaut (sources d'ownership réel gated → baseline « chaque équipe a ses tours »). Prospects enrichis (Tankathon/ESPN) : taille/poids/âge/PTS-REB-AST/TS%/scouting.
- CBA v2 (partiel) : **exception minimum**, **TPE**, **sign-and-trade** (hard cap 1er apron), **repeater tax**, **charge de roster incomplet** modélisés en v1 simplifié. Note par **archétype** (heuristique par poste, pas un vrai clustering K-means).
- Extensions v1 : hausses 8 %/an, max 4 ans, plafond = salaire max du joueur (sans distinguer extension désignée / Rose Rule / extend-and-trade).
- Trades exécutés = overlay sur MON équipe (les joueurs/picks sont réassignés via `moveMap`/`slotOwners` dérivés des trades, persistés) ; les rosters des autres équipes sont mis à jour côté trade machine mais leur gestion (cap, FA) n'est pas simulée. Un trade ne se commite que si TON équipe y participe.
- Non encore modélisé côté trade : TPE pluriannuels, sign-and-trade, base-year compensation, exception minimum (pas de matching).
- Note par percentile : éligibilité ≥ 20 matchs ET ≥ 500 min ; poids par groupe de poste (G/F/C), pas encore par archétype fin.
- Chiffres cap 2026-27 = **projections** (la NBA les fige fin juin/juillet).

> ⚠️ Scraping Basketball-Reference : usage perso/éducatif, à faible débit. Ne pas marteler le site.
