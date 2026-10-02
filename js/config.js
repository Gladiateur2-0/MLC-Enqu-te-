/* =====================================================================
   CONFIGURATION — Enquête de satisfaction Mercure Logistics Congo
   =====================================================================
   1) BACKEND_URL : collez ici l'URL de déploiement de votre Google Apps
      Script (voir README.md, section « Collecte des réponses »).
      Tant qu'elle est vide, le site fonctionne en MODE DÉMO : les réponses
      restent dans le navigateur de la personne qui répond (utile pour
      tester, inutile pour une vraie campagne).

   2) Identifiants administrateur :
      - En mode Google Apps Script, le mot de passe est vérifié CÔTÉ SERVEUR
        (propriété ADMIN_PASSWORD du script). C'est la seule protection réelle.
      - En mode démo, la vérification est faite dans le navigateur via
        l'empreinte SHA-256 ci-dessous.
      Identifiants par défaut :  admin  /  MLC@2026!
      Pour changer le mot de passe démo : ouvrez admin.html, onglet
      « Paramètres », l'outil calcule la nouvelle empreinte à coller ici.
   ===================================================================== */
window.MLC_CONFIG = {
  BACKEND_URL: "",

  ADMIN_USER: "admin",
  // SHA-256 de "MLC@2026!"
  ADMIN_PASS_SHA256: "d553d171d10690d3abda00e08abb9674e17178c2eb063527937f1c2bed348820",

  COMPANY: {
    name: "Mercure Logistics Congo",
    short: "MLC",
    phone: "+242 06 467 64 64",
    email: "info@mercure-logistics.com",
    site: "https://www.mercure-logistics.com",
    addresses: [
      "366, Avenue Jacques Opangault, Pointe-Noire",
      "Boulevard Denis Sassou Nguesso, Brazzaville"
    ]
  },

  SURVEY_TITLE: "Enquête de satisfaction clients 2026"
};
