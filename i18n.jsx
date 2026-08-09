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
