// Page « Règles » : explique les règles CBA modélisées par le moteur, avec
// exemples chiffrés. Les montants sont lus DIRECTEMENT depuis les constantes /
// fonctions du moteur (cba.js, cap.js…) → toujours synchronisés avec le jeu.
import { C } from '../constants/palette.js';
import { fmtUSD } from '../utils/format.js';
import { CAP_YEARS, MATCH, ROSTER, TAX_BRACKETS, TAX_BASE_RATE_ABOVE_20M, bracketMaxIncoming } from '../constants/cba.js';

const SEASON = '2026-27';
const Y = CAP_YEARS[SEASON];

/* ---------- petits composants ---------- */
const STATUS = {
  ok: { label: 'Modélisé', color: C.green },
  partial: { label: 'Simplifié', color: C.accent },
  no: { label: 'Non modélisé', color: C.red },
};
function Pill({ s }) {
  const st = STATUS[s] || STATUS.ok;
  return <span style={{ fontSize: 10, fontWeight: 800, color: C.ink, background: st.color, borderRadius: 5, padding: '2px 7px', letterSpacing: 0.4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{st.label}</span>;
}
function Section({ icon, title, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, textTransform: 'uppercase', letterSpacing: 0.6, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span> {title}
      </h2>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </div>
  );
}
function Rule({ title, status = 'ok', children, example }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, flex: 1 }}>{title}</h3>
        <Pill s={status} />
      </div>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>{children}</div>
      {example && (
        <div style={{ marginTop: 10, background: C.bg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.accent}`, borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: C.muted }}>
          <span style={{ color: C.accent, fontWeight: 800, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, marginRight: 6 }}>Exemple</span>
          {example}
        </div>
      )}
    </div>
  );
}
const b = (t) => <b style={{ color: C.text }}>{t}</b>;
const red = (t) => <b style={{ color: C.red }}>{t}</b>;
const grn = (t) => <b style={{ color: C.green }}>{t}</b>;

/* ---------- la page ---------- */
export default function RulesPage() {
  // valeurs d'exemple calculées par le VRAI moteur de matching
  const ex1Out = 5_000_000, ex1Max = bracketMaxIncoming(ex1Out);
  const ex2Out = 20_000_000, ex2Max = bracketMaxIncoming(ex2Out);
  const ex3Out = 35_000_000, ex3Max = bracketMaxIncoming(ex3Out);
  const stretchSal = 9_200_000, stretchYears = 1, stretchSpan = 2 * stretchYears + 1;

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 24px 80px' }}>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 30, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Règles du jeu — CBA 2023</h1>
        <p style={{ color: C.muted, fontSize: 13.5, lineHeight: 1.6, marginTop: 8 }}>
          Toutes les règles que le moteur applique pour valider tes trades et signatures, avec exemples chiffrés.
          Les montants sont ceux de la saison <b style={{ color: C.text }}>{Y.label}</b>. Chaque carte indique si la règle est
          pleinement <span style={{ color: C.green, fontWeight: 700 }}>modélisée</span>, <span style={{ color: C.accent, fontWeight: 700 }}>simplifiée</span>, ou <span style={{ color: C.red, fontWeight: 700 }}>non modélisée</span>.
        </p>

        {/* échelle des lignes de cap */}
        <CapScale />

        {/* ============ LES 5 ZONES ============ */}
        <Section icon="📊" title="Les 5 zones de masse salariale">
          <Rule title="Sous le cap, au-dessus du cap, tax, 1er apron, 2e apron">
            La masse salariale d'une équipe la place dans une « zone » qui détermine ce qu'elle a le droit de faire :
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              <li><b style={{ color: C.text }}>Sous le cap</b> (&lt; {fmtUSD(Y.salaryCap)}) : peut signer dans sa <i>cap room</i> + Room MLE.</li>
              <li><b style={{ color: C.text }}>Au-dessus du cap</b> : plus de cap room → signe via exceptions (MLE, BAE, min) et trade par <i>matching</i>.</li>
              <li><b style={{ color: C.text }}>Luxury tax</b> (≥ {fmtUSD(Y.luxuryTax)}) : paie la taxe progressive sur chaque dollar au-dessus.</li>
              <li><b style={{ color: C.accent }}>1er apron</b> (≥ {fmtUSD(Y.firstApron)}) : perd le coussin de matching, MLE réduite (taxpayer), risque de <i>hard cap</i>.</li>
              <li><b style={{ color: C.red }}>2e apron</b> (≥ {fmtUSD(Y.secondApron)}) : restrictions les plus dures (voir section Trades).</li>
            </ul>
          </Rule>
        </Section>

        {/* ============ TRADES — MATCHING ============ */}
        <Section icon="🔄" title="Trades — salary matching">
          <Rule
            title="Paliers de matching (équipe au-dessus du cap, sous le 1er apron)"
            status="ok"
            example={<>
              Tu envoies un joueur à {b(fmtUSD(ex2Out))} → tu peux reprendre jusqu'à {grn(fmtUSD(ex2Max))} (palier médian : {fmtUSD(ex2Out)} + {fmtUSD(MATCH.midCushion)}).
            </>}
          >
            Une équipe au-dessus du cap ne peut pas absorber un salaire « gratuitement » : ce qu'elle <b style={{ color: C.text }}>reprend</b> doit
            rester proche de ce qu'elle <b style={{ color: C.text }}>envoie</b>, selon 3 paliers (montants fixes du CBA) :
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
              <tbody>
                <Row a={`Sortant ≤ ${fmtUSD(MATCH.lowBracketMax)}`} v={`200 % + ${fmtUSD(MATCH.cushion)}`} ex={`${fmtUSD(ex1Out)} → ${fmtUSD(ex1Max)}`} />
                <Row a={`${fmtUSD(MATCH.lowBracketMax)} – ${fmtUSD(MATCH.midBracketMax)}`} v={`sortant + ${fmtUSD(MATCH.midCushion)}`} ex={`${fmtUSD(ex2Out)} → ${fmtUSD(ex2Max)}`} />
                <Row a={`Sortant > ${fmtUSD(MATCH.midBracketMax)}`} v={`125 % + ${fmtUSD(MATCH.cushion)}`} ex={`${fmtUSD(ex3Out)} → ${fmtUSD(ex3Max)}`} />
              </tbody>
            </table>
          </Rule>

          <Rule title="Équipe sous le cap : absorption dans la cap room" status="ok"
            example={<>Avec {b(fmtUSD(12_000_000))} de cap room, tu peux absorber un contrat entrant de {fmtUSD(12_000_000)} sans rien renvoyer (le matching ne s'applique qu'au-dessus du cap).</>}>
            Une équipe sous le cap n'a pas besoin de matching : elle « avale » le salaire entrant dans sa place libre (cap room),
            puis le matching classique s'ajoute pour le surplus.
          </Rule>

          <Rule title="Équipe au 1er / 2e apron : matching 100 %" status="ok"
            example={<>Au 1er apron, envoyer {b(fmtUSD(20_000_000))} ne permet de reprendre que {fmtUSD(20_000_000)} — plus de coussin de {fmtUSD(MATCH.midCushion)}.</>}>
            Dès le 1er apron, le coussin disparaît : tu ne peux reprendre <b style={{ color: C.text }}>que</b> ce que tu envoies (100 %, pas un dollar de plus).
          </Rule>
        </Section>

        {/* ============ TRADES — APRONS ============ */}
        <Section icon="🚧" title="Trades — restrictions des aprons">
          <Rule title="Hard cap au 1er apron (matching étendu)" status="ok"
            example={<>Si tu utilises les paliers pour reprendre plus que tu n'envoies, tu te poses un <b style={{ color: C.text }}>hard cap</b> : ta masse ne pourra plus dépasser {b(fmtUSD(Y.firstApron))} de toute la saison.</>}>
            Reprendre plus de salaire que l'envoyé (via les paliers) déclenche un <b style={{ color: C.text }}>plafond dur</b> au 1er apron.
            Impossible de le franchir ensuite, même par une autre opération.
          </Rule>

          <Rule title="2e apron — un seul joueur agrégé (pas de combinaison)" status="ok"
            example={<>Au 2e apron, tu ne peux PAS combiner {red('deux contrats sortants')} (ex. {fmtUSD(15_000_000)} + {fmtUSD(10_000_000)}) pour absorber un joueur à {fmtUSD(25_000_000)}. Un seul salaire sortant à la fois.</>}>
            C'est <b style={{ color: C.text }}>la</b> règle « 1 joueur max » : une équipe au 2e apron a {red("interdiction d'agréger")} deux salaires
            ou plus dans un même trade pour matcher un gros contrat entrant.
          </Rule>

          <Rule title="2e apron — pas de cash, pas de surplus repris" status="ok"
            example={<>Au 2e apron : interdiction d'{red('envoyer du cash')} dans un trade, et interdiction de {red('reprendre plus')} de salaire que l'envoyé (matching 100 % strict).</>}>
            Deux interdictions supplémentaires au 2e apron : aucun cash envoyé, et aucune reprise nette positive (tu ne peux pas grossir ta masse via un trade).
          </Rule>

          <Rule title="1er / 2e apron — acquisition par sign-and-trade interdite" status="ok"
            example={<>Une équipe déjà <b style={{ color: C.text }}>au-dessus du 1er apron</b> ne peut pas recevoir un joueur par sign-and-trade, même si l'échange est équilibré → le moteur {red('bloque')}.</>}>
            Au-dessus du 1er apron, impossible d'<b style={{ color: C.text }}>acquérir un joueur par sign-and-trade</b> (le S&T hard-cape au 1er apron, donc une équipe déjà au-dessus est exclue).
          </Rule>

          <Rule title="2e apron — gel du 1er tour de draft à 7 ans" status="no">
            Rester au 2e apron gèle ton 1er tour de draft 7 ans plus tard (impossible à échanger). <b style={{ color: C.text }}>Non modélisé</b> : la conséquence vise 2033+, hors de la fenêtre 2027-2031 simulée ici.
          </Rule>
        </Section>

        {/* ============ TRADES — AUTRES ============ */}
        <Section icon="🎟" title="Trades — autres mécanismes">
          <Rule title="Exception minimum" status="ok"
            example={<>Acquérir un vétéran à son salaire minimum ({fmtUSD(Y.minSalaryByYOS[10])}) ne consomme aucun matching — possible même au 2e apron.</>}>
            Un joueur entrant à <b style={{ color: C.text }}>son</b> minimum (selon son ancienneté) est absorbé sans matching, dans toutes les zones de cap.
          </Rule>

          <Rule title="TPE (Traded Player Exception)" status="partial"
            example={<>Tu envoies {b(fmtUSD(15_000_000))} et ne reprends que {fmtUSD(5_000_000)} → tu génères une TPE de ~{grn(fmtUSD(15_000_000 - 5_000_000 + 250_000))} réutilisable pour absorber un futur salaire.</>}>
            Envoyer plus que tu ne reprends crée une <b style={{ color: C.text }}>exception</b> (un « bon d'achat » de salaire) réutilisable plus tard.
            <i> Simplifié</i> : pas d'expiration à 1 an, montant approché (net + {fmtUSD(MATCH.cushion)}).
          </Rule>

          <Rule title="Sign-and-trade" status="ok"
            example={<>Recevoir un joueur par sign-and-trade pose un <b style={{ color: C.text }}>hard cap au 1er apron</b> ({fmtUSD(Y.firstApron)}) ; une équipe déjà au-dessus de l'apron ne peut pas l'utiliser du tout.</>}>
            Signer-puis-échanger un FA : l'équipe qui reçoit le joueur est <b style={{ color: C.text }}>hard-capée au 1er apron</b> (et exclue si elle y est déjà).
          </Rule>

          <Rule title="Limite de cash & taille de roster" status="ok"
            example={<>Cash max envoyé/reçu par saison : {b(fmtUSD(Y.cashInTrade))}. Roster : entre {ROSTER.min} et {ROSTER.max} joueurs (sinon il faudra signer/libérer).</>}>
            Le cash échangeable est plafonné par saison ; le roster doit rester entre {ROSTER.min} et {ROSTER.max} joueurs (avertissement, pas blocage).
          </Rule>
        </Section>

        {/* ============ PICKS ============ */}
        <Section icon="🎯" title="Choix de draft (picks)">
          <Rule title="Règle Stepien — pas deux 1ers tours d'affilée" status="ok"
            example={<>Si tu échanges tes 1ers tours {b('2027')} et {b('2028')} (dans le même trade ou via deux trades successifs), le moteur {red('bloque')} : interdiction de se retrouver sans 1er tour deux années consécutives.</>}>
            Tu ne peux jamais te retrouver <b style={{ color: C.text }}>sans 1er tour deux drafts de suite</b> (sur les picks futurs 2027→2031).
            Le moteur vérifie la <b style={{ color: C.text }}>propriété effective</b> (trades déjà exécutés inclus) : acquérir le 1er tour d'une autre équipe pour une année « vide » te remet en règle.
          </Rule>

          <Rule title="Trades 100 % picks" status="ok"
            example={<>Échanger {b('2026 #27')} contre {b('2027 R2')} sans aucun joueur est un trade {grn('valide')} — aucun salary matching à vérifier (les picks n'ont pas de salaire).</>}>
            Comme en NBA, un trade peut ne contenir <b style={{ color: C.text }}>que des picks</b> (ou des picks contre joueurs). Le verdict CBA et l'exécution fonctionnent sans salaire des deux côtés.
          </Rule>

          <Rule title="Droits de draft (pick utilisé)" status="ok"
            example={<>Tu as drafté {b('AJ Dybantsa')} au #1 ? Le chip devient {b('« 26 #1 · Dybantsa »')} : l'échanger transfère <b style={{ color: C.text }}>le joueur avec le pick</b>, pour {grn('0 $')} au salary matching.</>}>
            Comme en NBA, un joueur sélectionné mais pas encore signé s'échange via ses <b style={{ color: C.text }}>droits de draft</b> :
            le pick utilisé reste échangeable, le drafté suit son slot (dans les deux sens — tu peux aussi <b style={{ color: C.text }}>acquérir</b> les droits d'un drafté d'une autre équipe), et il compte 0 $ dans le matching. Son salaire rookie compte au cap de l'équipe qui le détient.
          </Rule>

          <Rule title="Échange / transfert de picks 2026 (slots réels)" status="ok"
            example={<>Échanger le slot {b('#27')} contre le slot {b('#40')} change le propriétaire dans l'ordre de draft — la simulation de draft 2026 en tient compte.</>}>
            Les 60 slots réels de la draft 2026 ont un propriétaire ; un trade de pick transfère ce slot et <b style={{ color: C.text }}>modifie l'ordre</b> de la simulation de draft.
          </Rule>

          <Rule title="Picks futurs (2027-2031) : propriété persistée" status="ok"
            example={<>Tu cèdes ton {b('2027 R1')} à LAL : il disparaît de tes picks échangeables, apparaît chez LAL avec la mention {b('2027 R1 (BOS)')}, et la règle Stepien en tient compte pour tes prochains trades.</>}>
            Chaque équipe possède ses 1ers/2es tours 2027→2031 ; un trade exécuté <b style={{ color: C.text }}>transfère durablement</b> la propriété (listes et Stepien suivent).
          </Rule>

          <Rule title="Swap de picks 2026 (échange de positions)" status="ok"
            example={<>Swap {b('#5 ⇄ #20')} favorable à BOS : BOS prend le {grn('#5')}, l'autre équipe hérite du #20. L'ordre de la draft 2026 se met à jour ; aucun pick n'est retiré (pas d'impact Stepien).</>}>
            Un <b style={{ color: C.text }}>swap</b> échange des <b style={{ color: C.text }}>positions</b> de draft : le détenteur prend le meilleur des deux slots, l'autre le moins bon.
            Comme l'ordre 2026 est connu, c'est résolu immédiatement (encart « 🔄 Swaps de picks 2026 » de la Trade Machine).
          </Rule>

          <Rule title="Swaps futurs (2027+) & protections de picks" status="no">
            Un swap sur une année <b style={{ color: C.text }}>future</b> dépend du classement à venir (meilleur/moins bon), non simulé ici faute de projection des saisons 2027-2031.
            Les <b style={{ color: C.text }}>protections</b> (top-4…) et l'ownership réel initial des picks 2027+ ne sont pas chargés non plus.
          </Rule>
        </Section>

        {/* ============ FREE AGENCY ============ */}
        <Section icon="✍️" title="Free agency — exceptions de signature">
          <Rule title="Quelle exception selon ta zone de cap ?" status="ok">
            Le moteur propose automatiquement les bonnes méthodes selon ta masse salariale :
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
              <thead>
                <tr style={{ color: C.muted, textAlign: 'left' }}>
                  <th style={th}>Méthode</th><th style={{ ...th, textAlign: 'right' }}>Montant max/an</th><th style={{ ...th, textAlign: 'center' }}>Années</th><th style={th}>Condition</th><th style={th}>Hard cap</th>
                </tr>
              </thead>
              <tbody>
                <FA m="Bird rights" amt={`jusqu'au max`} yrs={5} cond="Tes propres FA" hc="—" />
                <FA m="Cap room" amt={`jusqu'au max`} yrs={4} cond="Sous le cap" hc="—" />
                <FA m="Room MLE" amt={fmtUSD(Y.exceptions.roomMLE)} yrs={3} cond="Sous le cap" hc="—" />
                <FA m="Non-taxpayer MLE" amt={fmtUSD(Y.exceptions.nonTaxpayerMLE)} yrs={4} cond="Au-dessus du cap" hc="1er apron" />
                <FA m="Bi-annual (BAE)" amt={fmtUSD(Y.exceptions.biAnnual)} yrs={2} cond="Au-dessus du cap" hc="1er apron" />
                <FA m="Taxpayer MLE" amt={fmtUSD(Y.exceptions.taxpayerMLE)} yrs={2} cond="Au 1er apron" hc="2e apron" />
                <FA m="Minimum" amt={fmtUSD(Y.minSalaryByYOS[10])} yrs={2} cond="Toujours" hc="—" />
              </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>
              ⚠️ Au <b style={{ color: C.red }}>2e apron</b> : {red('aucune MLE')} disponible, uniquement le minimum.
            </div>
          </Rule>

          <Rule title="Hard cap respecté à la signature" status="ok"
            example={<>Au-dessus du cap à {b(fmtUSD(200_000_000))}, signer la {b('Non-taxpayer MLE')} ({fmtUSD(Y.exceptions.nonTaxpayerMLE)}) porterait la masse à ~{fmtUSD(215_000_000)} → {red('signature bloquée')} (dépasse le 1er apron {fmtUSD(Y.firstApron)}).</>}>
            Quand tu signes via une exception qui pose un hard cap (Non-taxpayer MLE & BAE → 1er apron, Taxpayer MLE → 2e apron), le moteur <b style={{ color: C.text }}>refuse la signature</b> si elle ferait franchir cette ligne.
          </Rule>

          <Rule title="RFA — droit de match de l'équipe d'origine" status="partial"
            example={<>Signer un {b('agent libre restreint')} (RFA) d'une autre équipe affiche un avertissement : son équipe peut s'aligner sur ton offre.</>}>
            Un FA <b style={{ color: C.text }}>restreint</b> (jeune, ≤ 4 ans d'ancienneté) peut être re-signé par son équipe d'origine qui <b style={{ color: C.text }}>s'aligne</b> sur ton offre. <i>Signalé</i> par un avertissement ; la décision de match de l'IA n'est pas simulée.
          </Rule>

          <Rule title="Bird rights (re-signer ses propres joueurs)" status="ok"
            example={<>Tu peux re-signer ton propre FA <b style={{ color: C.text }}>au-dessus du cap</b>, jusqu'à son max et sur 5 ans — d'où l'avantage de garder « ses » joueurs.</>}>
            En conservant un joueur plusieurs saisons, tu obtiens ses « Bird rights » : tu peux le re-signer même en étant déjà au-dessus du cap, jusqu'à son salaire max et sur la plus longue durée (5 ans).
          </Rule>

          <Rule title="Salaire maximum (selon l'ancienneté)" status="ok"
            example={<>Un joueur de 8 ans d'expérience plafonne à {b(fmtUSD(Y.maxSalary['7-9']))}/an cette saison.</>}>
            Le salaire max dépend de l'ancienneté : {b(`0–6 ans : ${fmtUSD(Y.maxSalary['0-6'])}`)} · {b(`7–9 ans : ${fmtUSD(Y.maxSalary['7-9'])}`)} · {b(`10 ans + : ${fmtUSD(Y.maxSalary['10+'])}`)}.
          </Rule>

          <Rule title="Salaire minimum (selon l'ancienneté) & cap holds" status="ok"
            example={<>Un rookie au minimum : {b(fmtUSD(Y.minSalaryByYOS[0]))} ; un vétéran 10 ans + : {b(fmtUSD(Y.minSalaryByYOS[10]))}.</>}>
            Le minimum monte avec l'ancienneté. Tant qu'un de tes FA n'est pas re-signé ou abandonné, il occupe un <b style={{ color: C.text }}>cap hold</b> (charge fictive ≈ 120–140 % de son ancien salaire) qui mange ta cap room.
          </Rule>
        </Section>

        {/* ============ LUXURY TAX ============ */}
        <Section icon="💸" title="Luxury tax (taxe de luxe)">
          <Rule title="Barème progressif + récidiviste" status="ok"
            example={<>À {b(fmtUSD(Y.luxuryTax + 12_000_000))} de masse (12 M$ au-dessus de la tax), la facture grimpe par paliers ; une équipe récidiviste paie {red('+1.00')} sur chaque palier.</>}>
            Chaque dollar au-dessus de la ligne de tax ({fmtUSD(Y.luxuryTax)}) est taxé à un taux qui augmente par tranche de 5 M$ :
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
              <tbody>
                {TAX_BRACKETS.map((br, i) => (
                  <Row key={i} a={`Tranche ${i + 1} (${fmtUSD(i * 5_000_000)} – ${fmtUSD(br.upTo)})`} v={`× ${br.rate.toFixed(2)}`} ex="" />
                ))}
                <Row a={`Au-delà de ${fmtUSD(20_000_000)}`} v={`× ${TAX_BASE_RATE_ABOVE_20M.toFixed(2)} puis +0,50 / 5 M$`} ex="" />
              </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>Récidiviste = équipe taxée 3 des 4 dernières saisons : {red('+1.00')} sur chaque palier.</div>
          </Rule>
        </Section>

        {/* ============ WAIVE & STRETCH ============ */}
        <Section icon="✂️" title="Libérer un joueur (waive & stretch)">
          <Rule title="Waive (couper sec) vs Stretch (étaler)" status="ok"
            example={<>Joueur à {b(fmtUSD(stretchSal))} (1 an garanti) : en <b style={{ color: C.text }}>waive</b> il pèse {fmtUSD(stretchSal)} d'un coup ; en <b style={{ color: C.text }}>stretch</b> il pèse {grn(fmtUSD(Math.round(stretchSal / stretchSpan)))} / an pendant {stretchSpan} ans (2 × {stretchYears} + 1).</>}>
            Couper un joueur garanti laisse de la <b style={{ color: C.text }}>dead money</b> au cap. <b style={{ color: C.text }}>Waive</b> = montant plein sur les années restantes.
            <b style={{ color: C.text }}> Stretch</b> = total étalé sur <b style={{ color: C.text }}>(2 × années restantes + 1)</b> saisons → impact annuel plus faible, mais plus long.
          </Rule>
        </Section>

        {/* ============ NON MODÉLISÉ ============ */}
        <Section icon="🚫" title="Ce qui reste non modélisé">
          <Rule title="Règles nécessitant des données par joueur (absentes du dataset)" status="no">
            Ces règles dépendent d'infos contractuelles individuelles qu'on ne scrape pas (clauses, bonus, statut base-year) :
            <b style={{ color: C.text }}> trade kicker</b> (bonus de trade), <b style={{ color: C.text }}>no-trade clause</b>,
            <b style={{ color: C.text }}> base-year compensation</b>, <b style={{ color: C.text }}>poison pill</b> (extension recrue).
          </Rule>
          <Rule title="Règles hors périmètre du simulateur d'un seul été" status="no">
            <b style={{ color: C.text }}>Expiration des TPE</b> (1 an : sans objet dans un seul été), <b style={{ color: C.text }}>gel des picks au 2e apron</b> (vise 2033+),
            et le <b style={{ color: C.text }}>match d'une offre RFA par l'IA</b> (seul l'avertissement est affiché).
            La <b style={{ color: C.text }}>règle des 2 mois</b> (un FA signé n'est pas échangeable de suite) est, elle, respectée <i>par construction</i> : les joueurs signés cet été n'apparaissent pas comme actifs échangeables.
          </Rule>
        </Section>

        <div style={{ marginTop: 28, fontSize: 11, color: C.muted, textAlign: 'center' }}>
          Chiffres {Y.official ? 'officiels' : 'projetés'} {Y.label} · sources : Larry Coon CBA FAQ, Hoops Rumors, Spotrac.
        </div>
      </div>
    </div>
  );
}

const th = { padding: '5px 8px', fontWeight: 600, borderBottom: `1px solid ${C.border}` };
function Row({ a, v, ex }) {
  return (
    <tr style={{ borderTop: `1px solid ${C.border}` }}>
      <td style={{ padding: '5px 8px', color: C.muted }}>{a}</td>
      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</td>
      {ex !== undefined && <td style={{ padding: '5px 8px', textAlign: 'right', color: C.green, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{ex}</td>}
    </tr>
  );
}
function FA({ m, amt, yrs, cond, hc }) {
  return (
    <tr style={{ borderTop: `1px solid ${C.border}` }}>
      <td style={{ padding: '5px 8px', fontWeight: 700 }}>{m}</td>
      <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{amt}</td>
      <td style={{ padding: '5px 8px', textAlign: 'center' }}>{yrs}</td>
      <td style={{ padding: '5px 8px', color: C.muted }}>{cond}</td>
      <td style={{ padding: '5px 8px', color: hc === '—' ? C.muted : C.accent, fontWeight: hc === '—' ? 400 : 700 }}>{hc}</td>
    </tr>
  );
}

/* échelle visuelle des lignes de cap */
function CapScale() {
  const lines = [
    { k: 'Cap', v: Y.salaryCap, c: C.blue },
    { k: 'Luxury tax', v: Y.luxuryTax, c: C.yellow },
    { k: '1er apron', v: Y.firstApron, c: C.accent },
    { k: '2e apron', v: Y.secondApron, c: C.red },
  ];
  const maxV = Y.secondApron * 1.04;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 18 }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, fontFamily: "'Oswald', sans-serif" }}>Les lignes {Y.label}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {lines.map((l) => (
          <div key={l.k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ width: 86, color: C.muted }}>{l.k}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.bg, overflow: 'hidden' }}>
              <div style={{ width: `${(l.v / maxV) * 100}%`, height: '100%', background: l.c }} />
            </div>
            <b style={{ width: 84, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: l.c }}>{fmtUSD(l.v)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
