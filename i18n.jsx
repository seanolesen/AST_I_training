import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

// ============================================================================
// All translatable UI strings live here. English is the source of truth; the
// French (fr-CA) column can be edited freely without touching component code.
// The 273-question bank and trainer content are intentionally NOT translated.
// NOTE: avalanche-specific French terms should be reviewed by a qualified
// francophone before being relied upon.
// ============================================================================
export const STRINGS = {
  en: {
    "lang.en": "EN", "lang.fr": "FR",
    "common.cancel": "Cancel",

    "nav.allTools": "← All tools",
    "auth.localMode": "Local mode",
    "auth.signOut": "Sign out",
    "auth.emailPlaceholder": "you@email.com",
    "auth.signIn": "Sign in to sync",
    "auth.enterEmail": "Enter your email",
    "auth.sending": "Sending…",
    "auth.errorPrefix": "Error: ",
    "auth.checkEmail": "Check your email for the link",

    "home.choose": "Choose a tool",
    "home.signedIn": "Signed in as {email} — your runs sync across devices.",
    "home.localSub": "Local mode — sign in above to sync your history across devices.",

    "tool.slope.name": "Slope-Angle Trainer",
    "tool.slope.desc": "Train your eye to call above vs. below the 30-degree avalanche threshold.",
    "tool.card.name": "Crystal Card Trainer",
    "tool.card.desc": "Read snow grains off a to-scale BCA card — size crystals against the grid and classify grain type, from new snow to surface hoar.",
    "tool.ast1.name": "AST 1 Practice",
    "tool.ast1.desc": "273 questions across terrain, snowpack, weather, forecasting, trip planning, companion rescue, and human factors.",
    "tool.ast2.name": "AST 2 Practice",
    "tool.ast2.desc": "Advanced curriculum — snowpack tests, avalanche problems, terrain & ATES, decision-making, and more.",
    "tool.perf.name": "Performance analysis",
    "tool.perf.desc": "Accuracy across every tool — broken down by subject, format, and difficulty, with filters.",
    "tool.admin.name": "Site analytics",
    "tool.admin.desc": "Admin: all users, engagement stats, and click-into performance.",

    "intro.eyebrow": "Before you start",
    "intro.title": "A study aid, not the real thing",
    "intro.p1": "These tools help you prepare for AST 1 and AST 2, but they are not a substitute for a certified course or for real-world judgment. Questions are original study material, not official exam content, and the 80% figure is a self-study benchmark, not a pass mark.",
    "intro.p2": "Avalanche terrain is dangerous. Take a course, carry a transceiver, probe, and shovel, check the local bulletin, and make decisions with trained partners.",
    "intro.ok": "I understand",

    "account.title": "Account & privacy",
    "account.h1": "Your account and your data",
    "account.accountLabel": "Account",
    "account.signedInAs": "Signed in as {email}",
    "account.syncNote": "Your practice history syncs to this account across devices.",
    "account.guest": "You’re in guest / local mode — history is stored only on this device. Sign in from the top bar to sync across devices.",
    "account.storedLabel": "What’s stored",
    "account.storedSignedIn": "Your email address, used only to send magic sign-in links, and your practice history (exam runs and trainer attempts), so your progress and analytics follow you across devices.",
    "account.storedGuest": "Only your practice history, kept in this browser’s local storage on this device. Nothing is sent to a server while you’re in guest mode.",
    "account.storedFooter": "No ads, no trackers, and your data is never sold. This is a personal study project.",
    "account.exportLabel": "Export my data",
    "account.exportDesc": "Download everything stored for you — every recorded run and all trainer history — as a JSON file you keep.",
    "account.exportBtn": "Export my data (JSON)",
    "account.exportedOne": "Exported {n} recorded run plus trainer history.",
    "account.exportedMany": "Exported {n} recorded runs plus trainer history.",
    "account.exportFail": "Export failed: {msg}",
    "account.deleteLabel": "Delete my data",
    "account.deleteDescSignedIn": "Permanently remove all of your practice history from this account and this device. This can’t be undone.",
    "account.deleteDescGuest": "Permanently remove all of your practice history from this device. This can’t be undone.",
    "account.deleteEmailNote": "Your sign-in email itself stays with the login provider; deleting it entirely isn’t something the app can do from here.",
    "account.deleteBtn": "Delete all my practice data",
    "account.confirmWarn": "This will permanently erase your entire practice history. Consider exporting first. Continue?",
    "account.confirmYes": "Yes, delete everything",
    "account.deletedDone": "✓ Deleted. You may want to reload the app.",
    "account.deletedMsg": "Your practice data has been deleted.",
    "account.deletePartial": "Some data could not be deleted: {error} — if you’re signed in, make sure the updated schema.sql (with delete policies) has been run in Supabase.",
    "account.deleteFail": "Delete failed: {msg}",

    "exam.setup.title": "Set up your exam",
    "exam.record.on": "Recording this run",
    "exam.record.off": "Guest run — not recorded",
    "exam.record.onSub": "Results will count toward your history and trend.",
    "exam.record.offSub": "Let someone else practice without affecting your stats.",
    "exam.rec.title": "Recommended next session",
    "exam.rec.focusPre": "Focus on ",
    "exam.rec.focusPost": " — your weakest area at {pct}% over {n} seen.",
    "exam.rec.load": "Tap to load: {label} · {diff} · {mode} · {count} questions →",
    "exam.mode.label": "Session type",
    "exam.mode.sub": "Study shows the explanation after every question and drops the pass/fail framing. Test grades you against the study target.",
    "exam.mode.test": "Test",
    "exam.mode.study": "Study",
    "exam.diff.label": "Difficulty",
    "exam.diff.sub": "Scales both recall depth and scenario complexity — Easy leans on definitions, Hard on multi-factor judgment calls.",
    "exam.diff.easy": "Easy",
    "exam.diff.moderate": "Moderate",
    "exam.diff.hard": "Hard",
    "exam.sel.label": "Question selection",
    "exam.sel.sub": "Adaptive starts at your chosen difficulty, then steps harder after a correct answer and easier after a miss — the set tracks your level as you go. Fixed keeps the difficulty mix constant.",
    "exam.sel.fixed": "Fixed",
    "exam.sel.adaptive": "Adaptive",
    "exam.count.label": "Number of questions",
    "exam.count.allSuffix": " (all)",
    "exam.count.help": "In steps of 5, up to {max} available under the current topic filter.",
    "exam.topic.label": "Topic focus",
    "exam.topic.help": "Drill one area, or keep the whole curriculum in play.",
    "exam.topic.all": "All topics",
    "exam.fb.label": "Feedback",
    "exam.fb.sub": "Immediate grades each question as you answer it. At end hides results until the review screen — closer to a real sitting.",
    "exam.fb.immediate": "Immediate",
    "exam.fb.end": "At end",
    "exam.start.study": "Start study set →",
    "exam.start.test": "Start exam →",
    "exam.setup.footer": "Original study questions covering the AST 1 learning outcomes — not official Avalanche Canada exam content. AST 1 certification comes from course participation, not a written test; the benchmark here is a self-study target only.",
    "exam.fmt.mc": "Multiple choice",
    "exam.fmt.tf": "True / False",
    "exam.fmt.match": "Matching",
    "exam.guest": "GUEST",
    "exam.conf.label": "Confidence",
    "exam.conf.low": "Low",
    "exam.conf.med": "Med",
    "exam.conf.high": "High",
    "exam.tf.true": "True",
    "exam.tf.false": "False",
    "exam.reveal.correct": "Correct",
    "exam.reveal.wrong": "Not quite",
    "exam.reveal.reference": "Reference · ",
    "exam.btn.check": "Check answer",
    "exam.btn.next": "Next →",
    "exam.btn.finish": "Finish exam",
    "exam.match.continue": "Match all rows to continue",
    "exam.match.choose": "Choose a match…",
    "exam.match.correctPrefix": "Correct: ",
    "exam.results.title": "Results",
    "exam.results.summary": "{diff} difficulty · {topic}",
    "exam.results.guestSuffix": " · guest run (not saved)",
    "exam.results.studyLabel": "Study session",
    "exam.results.studySub": "· explanations shown per question; no pass/fail",
    "exam.results.above": "Above",
    "exam.results.below": "Below",
    "exam.results.targetSuffix": " the 80% self-study target",
    "exam.results.targetNote": "· a study benchmark, not an official AST pass mark",
    "exam.results.byTopic": "This run, by topic",
    "exam.results.loading": "Loading your history…",
    "exam.results.trendOne": "Trend over {n} recorded run",
    "exam.results.trendMany": "Trend over {n} recorded runs",
    "exam.results.weighted": "recency-weighted accuracy (recent runs count more)",
    "exam.results.weakest": "Weakest topics so far:",
    "exam.results.seen": "({n} seen)",
    "exam.results.firstRun": "This is your first recorded run — trends appear once you have a couple saved.",
    "exam.review.show": "Review",
    "exam.review.hide": "Hide",
    "exam.review.allSuffix": " all {n} questions",
    "exam.results.drill": "Drill my weak spot: {topic} ({pct}%) →",
    "exam.results.retry": "Retry these settings",
    "exam.results.new": "New setup",
    "exam.review.skipped": "— (skipped)",
    "exam.review.matchRows": "see rows below",
    "exam.review.yourAnswer": "Your answer: ",
    "exam.review.shouldBeLabel": "should be:",
  },
  fr: {
    "lang.en": "EN", "lang.fr": "FR",
    "common.cancel": "Annuler",

    "nav.allTools": "← Tous les outils",
    "auth.localMode": "Mode local",
    "auth.signOut": "Déconnexion",
    "auth.emailPlaceholder": "vous@courriel.com",
    "auth.signIn": "Se connecter pour synchroniser",
    "auth.enterEmail": "Entrez votre courriel",
    "auth.sending": "Envoi…",
    "auth.errorPrefix": "Erreur : ",
    "auth.checkEmail": "Vérifiez votre courriel pour le lien de connexion",

    "home.choose": "Choisissez un outil",
    "home.signedIn": "Connecté comme {email} — vos résultats se synchronisent sur vos appareils.",
    "home.localSub": "Mode local — connectez-vous ci-dessus pour synchroniser votre historique sur vos appareils.",

    "tool.slope.name": "Entraîneur d’angle de pente",
    "tool.slope.desc": "Entraînez votre œil à juger si une pente est au-dessus ou en dessous du seuil avalancheux de 30 degrés.",
    "tool.card.name": "Entraîneur de carte à cristaux",
    "tool.card.desc": "Lisez les grains de neige sur une carte BCA à l’échelle — mesurez les cristaux sur la grille et classez le type de grain, de la neige fraîche au givre de surface.",
    "tool.ast1.name": "AST 1 — Pratique",
    "tool.ast1.desc": "273 questions sur le terrain, le manteau neigeux, la météo, la prévision, la planification de sortie, le sauvetage de compagnon et les facteurs humains.",
    "tool.ast2.name": "AST 2 — Pratique",
    "tool.ast2.desc": "Programme avancé — tests de manteau neigeux, problèmes d’avalanche, terrain et ATES, prise de décision, et plus encore.",
    "tool.perf.name": "Analyse de performance",
    "tool.perf.desc": "Votre précision sur chaque outil — répartie par sujet, format et difficulté, avec filtres.",
    "tool.admin.name": "Statistiques du site",
    "tool.admin.desc": "Admin : tous les utilisateurs, statistiques d’engagement, et détail par utilisateur.",

    "intro.eyebrow": "Avant de commencer",
    "intro.title": "Une aide à l’étude, pas la réalité",
    "intro.p1": "Ces outils vous aident à préparer l’AST 1 et l’AST 2, mais ne remplacent pas un cours certifié ni le jugement sur le terrain. Les questions sont du matériel d’étude original, pas le contenu officiel de l’examen, et le seuil de 80 % est un repère d’auto-évaluation, pas une note de passage.",
    "intro.p2": "Le terrain avalancheux est dangereux. Suivez un cours, portez un émetteur-récepteur (DVA), une sonde et une pelle, consultez le bulletin local, et prenez vos décisions avec des partenaires formés.",
    "intro.ok": "J’ai compris",

    "account.title": "Compte et confidentialité",
    "account.h1": "Votre compte et vos données",
    "account.accountLabel": "Compte",
    "account.signedInAs": "Connecté en tant que {email}",
    "account.syncNote": "Votre historique de pratique se synchronise sur vos appareils.",
    "account.guest": "Vous êtes en mode invité / local — l’historique est stocké uniquement sur cet appareil. Connectez-vous depuis la barre du haut pour synchroniser.",
    "account.storedLabel": "Ce qui est stocké",
    "account.storedSignedIn": "Votre adresse courriel, utilisée uniquement pour envoyer les liens de connexion, et votre historique de pratique (séries d’examen et essais d’entraînement), afin que votre progression vous suive sur vos appareils.",
    "account.storedGuest": "Uniquement votre historique de pratique, conservé dans le stockage local de ce navigateur, sur cet appareil. Rien n’est envoyé à un serveur en mode invité.",
    "account.storedFooter": "Aucune publicité, aucun traceur, et vos données ne sont jamais vendues. C’est un projet d’étude personnel.",
    "account.exportLabel": "Exporter mes données",
    "account.exportDesc": "Téléchargez tout ce qui est stocké pour vous — chaque série enregistrée et tout l’historique d’entraînement — dans un fichier JSON que vous conservez.",
    "account.exportBtn": "Exporter mes données (JSON)",
    "account.exportedOne": "{n} série enregistrée exportée, plus l’historique d’entraînement.",
    "account.exportedMany": "{n} séries enregistrées exportées, plus l’historique d’entraînement.",
    "account.exportFail": "Échec de l’exportation : {msg}",
    "account.deleteLabel": "Supprimer mes données",
    "account.deleteDescSignedIn": "Supprimez définitivement tout votre historique de pratique de ce compte et de cet appareil. Cette action est irréversible.",
    "account.deleteDescGuest": "Supprimez définitivement tout votre historique de pratique de cet appareil. Cette action est irréversible.",
    "account.deleteEmailNote": "Votre courriel de connexion reste chez le fournisseur d’authentification ; l’application ne peut pas le supprimer complètement d’ici.",
    "account.deleteBtn": "Supprimer toutes mes données de pratique",
    "account.confirmWarn": "Cela effacera définitivement tout votre historique de pratique. Pensez à exporter d’abord. Continuer ?",
    "account.confirmYes": "Oui, tout supprimer",
    "account.deletedDone": "✓ Supprimé. Vous pourriez vouloir recharger l’application.",
    "account.deletedMsg": "Vos données de pratique ont été supprimées.",
    "account.deletePartial": "Certaines données n’ont pas pu être supprimées : {error} — si vous êtes connecté, assurez-vous d’avoir exécuté le schema.sql à jour (avec les politiques de suppression) dans Supabase.",
    "account.deleteFail": "Échec de la suppression : {msg}",

    "exam.setup.title": "Configurez votre examen",
    "exam.record.on": "Enregistrement de cette série",
    "exam.record.off": "Série invité — non enregistrée",
    "exam.record.onSub": "Les résultats compteront dans votre historique et votre tendance.",
    "exam.record.offSub": "Laissez quelqu’un d’autre s’exercer sans affecter vos statistiques.",
    "exam.rec.title": "Séance suivante recommandée",
    "exam.rec.focusPre": "Concentrez-vous sur ",
    "exam.rec.focusPost": " — votre point faible, à {pct} % sur {n} vus.",
    "exam.rec.load": "Touchez pour charger : {label} · {diff} · {mode} · {count} questions →",
    "exam.mode.label": "Type de séance",
    "exam.mode.sub": "Étude affiche l’explication après chaque question et retire la notion de réussite/échec. Test vous évalue selon la cible d’étude.",
    "exam.mode.test": "Test",
    "exam.mode.study": "Étude",
    "exam.diff.label": "Difficulté",
    "exam.diff.sub": "Ajuste la profondeur de mémorisation et la complexité des scénarios — Facile s’appuie sur les définitions, Difficile sur des jugements à facteurs multiples.",
    "exam.diff.easy": "Facile",
    "exam.diff.moderate": "Modéré",
    "exam.diff.hard": "Difficile",
    "exam.sel.label": "Sélection des questions",
    "exam.sel.sub": "Adaptatif commence à la difficulté choisie, puis monte après une bonne réponse et descend après une erreur — la série suit votre niveau. Fixe garde un mélange de difficulté constant.",
    "exam.sel.fixed": "Fixe",
    "exam.sel.adaptive": "Adaptatif",
    "exam.count.label": "Nombre de questions",
    "exam.count.allSuffix": " (toutes)",
    "exam.count.help": "Par tranches de 5, jusqu’à {max} disponibles selon le filtre de sujet actuel.",
    "exam.topic.label": "Sujet ciblé",
    "exam.topic.help": "Ciblez un domaine, ou gardez tout le programme en jeu.",
    "exam.topic.all": "Tous les sujets",
    "exam.fb.label": "Rétroaction",
    "exam.fb.sub": "Immédiate corrige chaque question au fur et à mesure. À la fin cache les résultats jusqu’à l’écran de révision — plus proche d’un vrai examen.",
    "exam.fb.immediate": "Immédiate",
    "exam.fb.end": "À la fin",
    "exam.start.study": "Commencer la série d’étude →",
    "exam.start.test": "Commencer l’examen →",
    "exam.setup.footer": "Questions d’étude originales couvrant les objectifs d’apprentissage de l’AST 1 — pas le contenu officiel de l’examen d’Avalanche Canada. La certification AST 1 vient de la participation au cours, pas d’un test écrit; le seuil ici n’est qu’une cible d’auto-évaluation.",
    "exam.fmt.mc": "Choix multiple",
    "exam.fmt.tf": "Vrai / Faux",
    "exam.fmt.match": "Appariement",
    "exam.guest": "INVITÉ",
    "exam.conf.label": "Confiance",
    "exam.conf.low": "Faible",
    "exam.conf.med": "Moy.",
    "exam.conf.high": "Élevée",
    "exam.tf.true": "Vrai",
    "exam.tf.false": "Faux",
    "exam.reveal.correct": "Correct",
    "exam.reveal.wrong": "Pas tout à fait",
    "exam.reveal.reference": "Référence · ",
    "exam.btn.check": "Vérifier la réponse",
    "exam.btn.next": "Suivant →",
    "exam.btn.finish": "Terminer l’examen",
    "exam.match.continue": "Appariez toutes les lignes pour continuer",
    "exam.match.choose": "Choisissez une correspondance…",
    "exam.match.correctPrefix": "Correct : ",
    "exam.results.title": "Résultats",
    "exam.results.summary": "difficulté {diff} · {topic}",
    "exam.results.guestSuffix": " · série invité (non enregistrée)",
    "exam.results.studyLabel": "Séance d’étude",
    "exam.results.studySub": "· explications affichées par question; sans réussite/échec",
    "exam.results.above": "Au-dessus de",
    "exam.results.below": "Sous",
    "exam.results.targetSuffix": " la cible d’auto-évaluation de 80 %",
    "exam.results.targetNote": "· un repère d’étude, pas une note de passage AST officielle",
    "exam.results.byTopic": "Cette série, par sujet",
    "exam.results.loading": "Chargement de votre historique…",
    "exam.results.trendOne": "Tendance sur {n} série enregistrée",
    "exam.results.trendMany": "Tendance sur {n} séries enregistrées",
    "exam.results.weighted": "précision pondérée par récence (les séries récentes comptent plus)",
    "exam.results.weakest": "Points faibles jusqu’ici :",
    "exam.results.seen": "({n} vus)",
    "exam.results.firstRun": "C’est votre première série enregistrée — les tendances apparaissent une fois quelques-unes sauvegardées.",
    "exam.review.show": "Réviser",
    "exam.review.hide": "Masquer",
    "exam.review.allSuffix": " les {n} questions",
    "exam.results.drill": "Travaillez votre point faible : {topic} ({pct} %) →",
    "exam.results.retry": "Reprendre ces réglages",
    "exam.results.new": "Nouvelle configuration",
    "exam.review.skipped": "— (ignorée)",
    "exam.review.matchRows": "voir les lignes ci-dessous",
    "exam.review.yourAnswer": "Votre réponse : ",
    "exam.review.shouldBeLabel": "devrait être :",
  },
};

const SUPPORTED = ["en", "fr"];
const STORE_KEY = "avy_lang";

function detectLang() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch (e) { /* ignore */ }
  try {
    const nav = (navigator.language || "en").toLowerCase();
    if (nav.startsWith("fr")) return "fr";
  } catch (e) { /* ignore */ }
  return "en";
}

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);
  useEffect(() => { try { localStorage.setItem(STORE_KEY, lang); } catch (e) {} }, [lang]);
  const setLang = (l) => { if (SUPPORTED.includes(l)) setLangState(l); };
  const t = useMemo(() => {
    return (key, vars) => {
      const table = STRINGS[lang] || STRINGS.en;
      let s = table[key];
      if (s == null) s = STRINGS.en[key];
      if (s == null) return key; // visible fallback: shows the missing key
      if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
      return s;
    };
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

// Safe even if a component renders outside the provider (falls back to English).
export function useLang() {
  const ctx = useContext(LangContext);
  if (ctx) return ctx;
  const t = (key, vars) => {
    let s = STRINGS.en[key];
    if (s == null) return key;
    if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
    return s;
  };
  return { lang: "en", setLang: () => {}, t };
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  const base = { padding: "6px 9px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
    background: "#141c26", color: "#9fb0c0", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" };
  const on = { ...base, borderColor: "#7cc4ff", color: "#e8eef4" };
  return (
    <span style={{ display: "inline-flex", gap: 4 }} role="group" aria-label="Language">
      {SUPPORTED.map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} style={lang === l ? on : base}>
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
