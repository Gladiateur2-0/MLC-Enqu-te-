/* =====================================================================
   QUESTIONNAIRE PAR DÉFAUT
   Ces questions sont utilisées tant qu'aucune version modifiée n'a été
   enregistrée depuis l'espace administrateur.

   Types de questions disponibles :
     single  : choix unique            (options)
     multi   : choix multiples         (options)
     rating  : note de 1 à 5 étoiles
     nps     : recommandation 0 à 10   (Net Promoter Score)
     matrix  : plusieurs critères notés de 1 à 5 (items)
     text    : réponse libre (court)
     longtext: commentaire libre (long)
   showIf : affiche la question seulement si une autre réponse correspond
            { q: "id_question", includes: "Option" }  (pour multi)
            { q: "id_question", equals: "Option" }    (pour single)
   role   : sert au rapport → "csat" (satisfaction globale), "nps",
            "services" (prestations utilisées)
   ===================================================================== */
window.MLC_DEFAULT_SURVEY = {
  version: 1,
  sections: [
    {
      id: "profil",
      title: "Votre profil",
      intro: "Quelques informations pour mieux comprendre vos besoins.",
      questions: [
        { id: "entreprise", type: "text", label: "Nom de votre entreprise ou organisation", help: "Facultatif : vous pouvez répondre de façon anonyme.", required: false },
        { id: "secteur", type: "single", label: "Votre secteur d'activité", required: true,
          options: ["Pétrole, gaz & services pétroliers", "Armateur / agent maritime", "ONG / organisation internationale / ambassade", "Commerce & distribution", "Industrie, BTP & équipements", "Télécoms & médias", "Administration / entreprise publique", "Autre"] },
        { id: "pays", type: "multi", label: "Vers quels pays MLC achemine-t-elle vos marchandises ?", required: true,
          options: ["République du Congo", "République Centrafricaine (RCA)", "République Démocratique du Congo (RDC)", "Cabinda (Angola)", "Autre pays"] },
        { id: "anciennete", type: "single", label: "Depuis combien de temps travaillez-vous avec MLC ?", required: true,
          options: ["Moins de 6 mois", "6 mois à 1 an", "1 à 3 ans", "Plus de 3 ans"] },
        { id: "frequence", type: "single", label: "À quelle fréquence faites-vous appel à nos services ?", required: true,
          options: ["Chaque semaine", "Chaque mois", "Chaque trimestre", "Ponctuellement (projet)"] }
      ]
    },
    {
      id: "services",
      title: "Les prestations utilisées",
      intro: "Sélectionnez toutes les prestations MLC dont vous avez bénéficié au cours des 12 derniers mois.",
      questions: [
        { id: "services", type: "multi", role: "services", label: "Quelles prestations avez-vous utilisées ?", required: true,
          options: ["Transport routier", "Entreposage", "Formalités douanières", "Logistique portuaire", "Transport multimodal (rail / route)", "Transport fluvial (barges)", "Commissionnaire de transport / fret aérien", "Projet cargo", "Gestion de port sec"] }
      ]
    },
    {
      id: "evaluation",
      title: "Évaluation de chaque prestation",
      intro: "Notez chaque critère de 1 (très insatisfait) à 5 (très satisfait). Seules les prestations que vous avez cochées apparaissent.",
      questions: [
        { id: "m_routier", type: "matrix", label: "Transport routier", showIf: { q: "services", includes: "Transport routier" }, required: true,
          items: ["Respect des délais de livraison", "État et fiabilité des camions", "Sécurité de la marchandise", "Professionnalisme des chauffeurs", "Suivi par géolocalisation"] },
        { id: "m_entreposage", type: "matrix", label: "Entreposage (5 entrepôts, 20 000 m² en zone portuaire)", showIf: { q: "services", includes: "Entreposage" }, required: true,
          items: ["Organisation et propreté des entrepôts", "Sécurité et gardiennage", "Disponibilité de l'espace", "Gestion des stocks et inventaires", "Rapidité des entrées / sorties"] },
        { id: "m_douane", type: "matrix", label: "Formalités douanières", showIf: { q: "services", includes: "Formalités douanières" }, required: true,
          items: ["Rapidité du dédouanement", "Conformité et fiabilité des déclarations", "Clarté des documents et des frais", "Qualité du conseil réglementaire"] },
        { id: "m_portuaire", type: "matrix", label: "Logistique portuaire (Port de Pointe-Noire)", showIf: { q: "services", includes: "Logistique portuaire" }, required: true,
          items: ["Rapidité d'enlèvement des conteneurs", "Coordination avec le port et les armateurs", "Qualité de la manutention", "Gestion des BL / BLD"] },
        { id: "m_multimodal", type: "matrix", label: "Transport multimodal", showIf: { q: "services", includes: "Transport multimodal (rail / route)" }, required: true,
          items: ["Fluidité des transferts entre modes", "Délai de bout en bout", "Suivi de la marchandise", "Intégrité de l'unité de chargement"] },
        { id: "m_fluvial", type: "matrix", label: "Transport fluvial (Brazzaville, Kinshasa, Bangui…)", showIf: { q: "services", includes: "Transport fluvial (barges)" }, required: true,
          items: ["Ponctualité des barges", "Sécurité pendant la navigation", "État de la marchandise à l'arrivée", "Information sur l'avancement"] },
        { id: "m_commissionnaire", type: "matrix", label: "Commissionnaire de transport / fret aérien", showIf: { q: "services", includes: "Commissionnaire de transport / fret aérien" }, required: true,
          items: ["Réactivité", "Compétitivité des tarifs", "Fiabilité des délais", "Gestion documentaire"] },
        { id: "m_projet", type: "matrix", label: "Projet cargo (colis lourds / hors gabarit)", showIf: { q: "services", includes: "Projet cargo" }, required: true,
          items: ["Étude et planification", "Adéquation des équipements spéciaux", "Respect des règles de sécurité", "Coordination du projet"] },
        { id: "m_portsec", type: "matrix", label: "Gestion de port sec", showIf: { q: "services", includes: "Gestion de port sec" }, required: true,
          items: ["Disponibilité des équipements de manutention", "Délais de traitement", "Sécurité du site", "Qualité de l'accueil"] }
      ]
    },
    {
      id: "relation",
      title: "Relation client",
      intro: "MLC vous désigne un interlocuteur unique. Comment évaluez-vous notre relation ?",
      questions: [
        { id: "m_relation", type: "matrix", label: "Évaluez notre relation commerciale", required: true,
          items: ["Disponibilité de votre interlocuteur unique", "Réactivité aux demandes et réclamations", "Qualité des rapports personnalisés", "Clarté et exactitude de la facturation", "Rapport qualité / prix", "Respect des engagements"] },
        { id: "canal", type: "single", label: "Par quel canal préférez-vous être informé de l'avancement de vos opérations ?", required: false,
          options: ["E-mail", "WhatsApp", "Appel téléphonique", "Plateforme de suivi en ligne", "Rapport hebdomadaire"] }
      ]
    },
    {
      id: "digital",
      title: "Services en ligne",
      intro: "MLC propose plusieurs outils sur son site web.",
      questions: [
        { id: "outils", type: "multi", label: "Quels services en ligne avez-vous utilisés ?", required: true,
          options: ["E-Cotation", "E-Ordre de transport", "E-Ordre de transit", "E-Ordre de transport fluvial", "Tracking (suivi)", "Aucun"] },
        { id: "note_outils", type: "rating", label: "Votre satisfaction vis-à-vis de ces outils en ligne", required: true,
          showIf: { q: "outils", notIncludesOnly: "Aucun" } }
      ]
    },
    {
      id: "qhse",
      title: "Qualité, sécurité & environnement",
      intro: "",
      questions: [
        { id: "note_qhse", type: "rating", label: "Comment percevez-vous l'engagement de MLC en matière de sécurité et de conformité (QHSE) ?", required: true },
        { id: "incident", type: "single", label: "Avez-vous constaté un incident (retard important, avarie, perte) au cours des 12 derniers mois ?", required: true,
          options: ["Non", "Oui"] },
        { id: "incident_gestion", type: "rating", label: "Si oui, comment l'incident a-t-il été géré par MLC ?", required: true,
          showIf: { q: "incident", equals: "Oui" } },
        { id: "incident_detail", type: "longtext", label: "Pouvez-vous décrire brièvement l'incident ?", required: false,
          showIf: { q: "incident", equals: "Oui" } }
      ]
    },
    {
      id: "global",
      title: "Votre avis global",
      intro: "Dernière étape, merci pour votre temps !",
      questions: [
        { id: "csat", type: "rating", role: "csat", label: "Globalement, quel est votre niveau de satisfaction vis-à-vis de MLC ?", required: true },
        { id: "nps", type: "nps", role: "nps", label: "Quelle est la probabilité que vous recommandiez MLC à un partenaire ?", required: true },
        { id: "priorites", type: "multi", label: "Quelles devraient être nos priorités d'amélioration ?", help: "Trois choix maximum conseillés.", required: false,
          options: ["Délais de livraison", "Tarifs", "Communication et suivi", "État du matériel roulant", "Rapidité douanière", "Outils numériques", "Couverture géographique", "Sécurité des marchandises"] },
        { id: "commentaire", type: "longtext", label: "Avez-vous une suggestion ou un message pour l'équipe MLC ?", required: false },
        { id: "recontact", type: "single", label: "Souhaitez-vous être recontacté par votre interlocuteur MLC ?", required: true,
          options: ["Oui", "Non"] },
        { id: "email", type: "text", label: "Votre e-mail ou téléphone", required: true,
          showIf: { q: "recontact", equals: "Oui" } }
      ]
    }
  ]
};
