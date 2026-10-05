# Plan de développement AETHER

Date de lancement : 5 octobre 2026. Source : [CDC](docs/CDC.md), transcrit intégralement depuis le document Word conservé dans `docs/`, et brief de lancement. Le dépôt initial contient uniquement le README et ce document Word ; aucun code existant à reprendre. Node 24 et npm sont disponibles sur le poste.

Le premier jalon est autorisé immédiatement par le brief. La réception complète FIRST LIFE (REC-01 à REC-12) reste un objectif des jalons suivants et ne doit pas être confondue avec cette livraison.

## Jalons fonctionnels

| Jalon | Livraison et réception | Statut |
| --- | --- | --- |
| J1 PRESENCE | Application Windows, ENTITY animée et compacte, déplacement, position persistante, transparence laissant passer les clics, zone de notification, masquage/rappel, raccourci configurable, réglages d'accessibilité. Contrats des futurs moteurs. | Livré et validé sur Windows 11 |
| J2 MIND et MEMORY | Fournisseur Ollama réellement configuré, dialogue, erreurs explicites, mémoire SQLite sourcée, consultation/correction/suppression/export. REC-04. | Livré et validé par l'utilisateur |
| J3 CURIOSITY + MODEL ROUTER | Intérêts propres, questions, hypothèses, découvertes, connexions et explorations persistantes ; autonomie locale bornée ; FAST/DEEP/VISION. REC-10/11. | Livré et validé par l'utilisateur |
| J4 PORTAL et SPACE | Portail et espace 2,5D utilisables, navigation clavier, contenu issu des opérations réelles. REC-03. | Livré et validé par l'utilisateur |
| J5 ECHO | Consentement distinct, perception Explorer et dossier choisi, pause/arrêt, interprétation sourcée, validation humaine, habitudes et répétitions. REC-05/06. | Implémenté ; résultats et preuves dans RECETTE-J5 |
| J6 EVOLUTION | Spécification approuvée, SDK Codex officiel, FORGE hors noyau, runner MIRROR isolé, copies de données, rapport et adoption explicite. REC-07/08/12. | À développer |
| J7 CAPABILITIES et recette | Registre versionné, runner borné, persistance et retour arrière ; validation de REC-01 à REC-12 sur Windows. | À développer |

J1 à J4 sont validés par l’utilisateur. Le brief J5 autorise ECHO. Aucun jalon suivant ne démarre automatiquement.

## Checklist J1

- [x] Lire l'intégralité du CDC et examiner le dépôt.
- [x] Documenter l'architecture, les dépendances, les frontières de confiance et les jalons.
- [x] Créer le socle Electron/React/TypeScript et les contrats partagés.
- [x] Afficher ENTITY et implémenter repos/attention, clic et animations réduites.
- [x] Déplacer ENTITY, enregistrer/restaurer sa position et gérer les changements d'écran.
- [x] Vérifier les clics traversants dans les marges transparentes.
- [x] Implémenter tray, masquage/rappel, réglages et raccourci global transactionnel.
- [x] Tester le noyau, la persistance et les parcours dans une vraie instance Electron.
- [x] Compiler, produire un exécutable Windows et documenter la recette et les limitations.

## Dépendances du socle J1

Electron fournit fenêtres, tray, raccourcis et sandbox du rendu. React/React DOM fournissent uniquement le rendu. TypeScript, Vite et esbuild assurent typage et compilation. `tsx` exécute les tests unitaires Node ; Playwright pilote Electron pour la recette. `@electron/packager` produit un dossier Windows exécutable sans installer un service. Versions exactes verrouillées dans `package-lock.json`.

Pas de bibliothèque d'animation, de moteur 3D, de SDK LLM/Codex, de base vectorielle ou de SQLite au J1. Les seules données persistantes sont des préférences locales versionnées ; SQLite sera introduit avec MEMORY, quand une véritable base de souvenirs sera nécessaire.

## Validation

Tests pertinents : restauration hors écran et multi-écrans, limites de la zone interactive, permissions refusées, rejet d'états indisponibles, corruption/récupération des préférences, changement de raccourci avec conflit, drag/clic, masquage/rappel, absence d'accès Node dans le rendu et refus des demandes média. Rapport final dans `docs/RECETTE-J1.md` avec distinction des contrôles automatisés et manuels.

Historique J1 : typage et compilation réussis, 12 tests unitaires et 2 parcours Electron réussis, paquet Windows x64 généré et lancé (`app.isPackaged = true`). Captures contrôlées. Clics traversants, souris, raccourci, conflit système, rejet IPC et redémarrages sur Windows 11 à 150 % validés. Le développement avait été arrêté à J1 avant l'autorisation de J2.

## Plan du jalon 2 avant développement

Périmètre autorisé : MIND et MEMORY uniquement. Maintenir les interactions, positions, préférences, transparence, tray et raccourcis J1. ECHO, CURIOSITY, FORGE, MIRROR, portail et voix ne seront pas implémentés.

- [x] Relire CDC, plan, architecture et code réellement présent.
- [x] Vérifier les fournisseurs disponibles : aucune clé OpenAI dans l'environnement ; Ollama local répond et expose notamment `llama3.1:8b`.
- [x] Créer `packages/mind` : orchestration indépendante d'Electron/React, identité centralisée, contexte borné, annulation et états réels.
- [x] Fournisseurs : OpenAI Responses via SDK officiel ; Ollama local pour disposer d'un chemin réel sur ce poste. Aucun provider de simulation dans le programme ; doubles uniquement dans les tests.
- [x] Stocker les secrets via `safeStorage` Windows et les paramètres non secrets dans un fichier local versionné. OpenAI exige un consentement cloud explicite ; le rendu n'a aucun accès réseau direct.
- [x] Créer `packages/memory` avec `node:sqlite` et une migration versionnée. Contexte de conversation volatile, souvenirs durables sourcés et distinguant faits explicites/inférences.
- [x] Mémorisation uniquement sur demande explicite ou enregistrement manuel. Toute suppression/correction invalide le contexte en cours et les appels pendants pour éviter la réapparition d'un souvenir supprimé.
- [x] Petite interface de dialogue ancrée près d'ENTITY, fermeture par Échap ; gestion MEMORY séparée et réglages IA fonctionnels.
- [x] Relier les états MIND aux animations PRESENCE. Préparer des ports de dialogue/voix sans capture ni synthèse vocale.
- [x] Maintenir la recette J1 et tester MIND, mémoire, sécurité des secrets, annulation, erreurs et refus de réponses factices.
- [x] Exécuter A à E avec un modèle réellement disponible, dont mémorisation/redémarrage/suppression ; documenter les résultats exacts dans `docs/RECETTE-J2.md`.
- [x] Compiler, produire et lancer le programme Windows ; mettre à jour la documentation et s'arrêter à J2.

Choix SQLite : utiliser le module intégré `node:sqlite`, disponible avec le Node de développement ; vérifier aussi le runtime Electron. Cela évite un addon natif à recompiler pour Electron. Ajouter uniquement le SDK OpenAI et les packages internes nécessaires.

Résultat J2, 5 octobre 2026 : typage/compilation réussis, 25 tests unitaires et 4 parcours Electron réussis, dont J1 natif et A–E sans mock avec `llama3.1:8b`. SQLite et chiffrement Windows vérifiés sous Electron. Paquet 0.2.0 construit et testé avec un appel Ollama réel ; profil personnel configuré sans cloud, sans clé et sans données de démonstration. Preuves et limites dans [RECETTE-J2](docs/RECETTE-J2.md). OpenAI implémenté, contrat testé, accès réel non validé faute de clé ; llama.cpp et agents/outils restent des extensions futures. Arrêt à J2.

## Plan J3 avant développement

Périmètre : CURIOSITY et MODEL ROUTER ; aucune implémentation d'ECHO, FORGE, MIRROR, PORTAL, SPACE ou voix. Même présence, même mémoire utilisateur, même fournisseur réellement disponible.

- [x] Relire CDC, plan, architecture, recettes J1/J2 et code existant.
- [x] Router central : FAST pour MIND, DEEP pour CURIOSITY, VISION configurable mais réservé ; fallback uniquement DEEP non configuré → FAST, refus explicite sans modèle ou cloud non autorisé. Aucun modèle nommé dans CURIOSITY.
- [x] Migration SQLite v1 → v2 non destructive : intérêts, questions, hypothèses, découvertes, connexions, explorations et historique ; provenance et modèle réel, aucune pseudo-vérification externe.
- [x] Moteur indépendant : sélection déterministe d'une piste, résultat structuré réellement généré par le modèle, continuité, sérendipité, priorités et cycle de vie des intérêts.
- [x] Ordonnanceur opt-in local : nombre d'essais par session, durée totale, intervalle minimal, annulation immédiate, aucun travail après fermeture ; priorité aux échanges humains.
- [x] Origines : conversation, mémoire, MIND, intérêt, connexion et exploration passée. Domaines interdits persistants, exclusion vérifiée avant et après appel, suppression avec invalidation des opérations pendantes et des objets dépendants.
- [x] Journal accessible depuis ENTITY/tray/réglages : intérêts, questions/hypothèses, découvertes, connexions, explorations, historique, suppression et blocage d'un domaine.
- [x] PRESENCE exploring pendant un appel réel ; signal discret de découverte en attente et explication contextualisée à l'ouverture, sans popup ni faux message assistant.
- [x] Conserver et rejouer J1/J2 ; tests router, migrations, sélection, lifecycle, connexions, budgets, annulation/suppression, désactivation et profils locaux/cloud.
- [x] Recette A–F avec Ollama réel dans un profil temporaire ; preuves dans docs/RECETTE-J3.md ; compilation/packaging/lancement normal en 0.3.0.
- [x] Mettre à jour architecture/README/sécurité, livrer puis arrêter à J3.

Choix utilisateur pour la livraison : **FAST = DEEP = Ollama / qwen3.5:9b**, confirmé pendant le développement. L'autonomie reste désactivée par défaut sur le profil personnel. Le J3 impose des appels locaux pour l'exploration même si le dialogue FAST est configuré sur le cloud. Les découvertes sont des synthèses/hypothèses du modèle, avec provenance et limites, jamais des faits vérifiés par Internet ou par une expérience exécutée.

Résultat J3, 5 octobre 2026 : `npm run check` réussi, **44 tests unitaires et 5 parcours Electron** (55,9 s), recettes J1/J2 conservées et A–F J3 sans mock. Intérêt autonome « Causalité structurelle », reprise après redémarrage, question distincte, connexion avec l'acoustique, exploration sans message, suppression et arrêt vérifiés. Paquet Windows **0.3.0** construit ; `app.isPackaged=true`, modèle choisi et réponse locale réels vérifiés. Préférences/souvenirs préservés après sauvegarde préalable, aucune donnée de démonstration personnelle, cloud et autonomie désactivés. Preuves et limites dans [RECETTE-J3](docs/RECETTE-J3.md). Proposition suivante : J4 PORTAL + SPACE. Développement arrêté à J3.

## Plan J4 avant développement

Périmètre : PORTAL + SPACE uniquement. Le brief J4 est l'autorisation de développer. Aucun ECHO, FORGE, MIRROR, plugin dynamique, observation ou accès système supplémentaire.

- [x] Relire CDC, architecture, plan et recettes ; inspecter le code et les données du profil existant.
- [x] PORTAL : double clic, menu et raccourci configurable séparé du rappel J1 ; halo puis expansion courte depuis la position réelle d'ENTITY ; rétraction inverse, Échap/bouton/raccourci, retour exact au bureau. Respect des mouvements réduits et arrêt/destroy à la fermeture.
- [x] SPACE : rendu React/SVG/CSS 2.5D, profondeur légère, zoom/pan/selection/recentrage et accès clavier. Ce choix garde les objets accessibles et évite un moteur WebGL ou une boucle GPU permanente.
- [x] Une projection indépendante des données MEMORY/CURIOSITY/MIND : constellation avec arêtes réelles, détails et provenance ; panneaux spatiaux, historique, questions, résultats et capacités réellement disponibles.
- [x] Réutiliser les validations et mutations MEMORY J2, avec les mêmes règles d'annulation/purge. Journal d'activité reconstruit depuis les objets réels ; échanges de session volatils, aucun nouveau journal brut de conversations.
- [x] État SPACE minimal versionné : caméra/zoom, préférences visuelles, sélection et date de visite. Charge utile validée, écriture atomique, IPC depuis les seules fenêtres autorisées. Aucun ancien souvenir supprimé ni donnée de recette réintroduit dans le profil personnel.
- [x] Données en direct et contexte « depuis ma dernière visite », filtrage/recherche/pagination pour les grandes constellations. L'absence de données reste explicite, sans exemples pré-écrits.
- [x] Tests unitaires adaptés : transitions et annulation, géométrie/navigation, projection et liens, persistance, visite, rejet des états invalides. Conserver tous les contrôles J1/J2/J3 ; adapter seulement le portail désormais disponible.
- [x] Parcours Electron A–H avec base isolée contenant des données J3 réellement générées et une nouvelle exploration Ollama avant ouverture ; captures, provenance des fixtures, preuve du retour/du redémarrage et des mutations MEMORY.
- [x] Documenter `RECETTE-J4`, architecture/rendu/état/IPC, README et limites ; produire/vérifier/lancer 0.4.0, proposer J5 puis arrêter.

Le profil personnel observé contient un intérêt et quatre tentatives, sans souvenir, avec l'autonomie activée par l'utilisateur. Préserver ce réglage et ces données après sauvegarde préalable. SPACE ne charge jamais les exemples de recette en production. Les tests peuvent reprendre la preuve J3 existante pour examiner « Causalité structurelle » et sa connexion réelle à l'acoustique, dans leur propre base, sans inventer le contenu.

Résultat J4, 5 octobre 2026 : typage et compilation réussis, **52 tests unitaires et six parcours Electron** réussis ; recettes A–H et fermeture/ouverture concurrentes vérifiées avec données J3 réelles et une nouvelle exploration Ollama. Paquet Windows **0.4.0** construit, vérifié sur le profil personnel avec réponse Qwen réelle, puis relancé normalement (ENTITY visible et processus répondant). Intérêts, souvenirs et réglage d’autonomie conservés ; aucune donnée de recette importée dans ce profil. Preuves dans [RECETTE-J4](docs/RECETTE-J4.md). Proposition suivante : J5 ECHO, après validation. Développement arrêté à J4.

## Plan J5 avant développement

Le brief autorise l’implémentation et la recette. Sauvegarder le profil existant et conserver ses réglages. ECHO revient OFF à chaque démarrage ; aucun consentement permanent.

- Session explicite : choix natif d’un dossier local borné, consentement distinct, Explorer uniquement, arrêt/pause/désactivation immédiats et indicateur ENTITY.
- Perception : notifications fichiers et différences de métadonnées (identité, chemins relatifs, type, taille, date), contexte Explorer au premier plan via Win32/Shell. Aucun contenu, clavier, écran, audio ou capture vidéo. Les notifications ne prouvent pas quel processus a modifié un fichier.
- Exclusions vérifiées avant parcours, enregistrement, interprétation et confirmation. Refus des jonctions, chemins réseau et racines trop larges ; limites de taille, durée et nombre d’événements.
- MIND/DEEP local : interprétation JSON sourcée par identifiants d’événements réels, confiance estimée, erreur explicite sans réponse simulée. Validation humaine obligatoire avant MEMORY.
- SQLite v3 : sessions, événements, interprétations et décisions, habitudes, invalidations et opportunités ; liens et suppressions transactionnels avec MEMORY/FTS. Rapprochement des procédures répétées et variations à valider.
- Panneau ECHO, zone SPACE et habitudes dans MEMORY/MIND ; aucun déclenchement CURIOSITY à partir des données ECHO, aucune génération FORGE/MIRROR.
- Tests des frontières de consentement, annulation, exclusions, validation, répétition et suppression ; rejouer J1–J4 et exécuter A–J avec fichiers et modèle locaux réels. Compiler, vérifier le paquet 0.5.0, documenter les preuves et limites, proposer J6 puis arrêter.

## Résultat J5

- [x] ECHO OFF au démarrage, choix natif, consentement par session, contexte Explorer borné et indicateur ENTITY.
- [x] Événements structurés réels, pauses/arrêt/désactivation, exclusions et annulation des résultats tardifs.
- [x] Interprétation locale DEEP sourcée, validation humaine, HABITS/MEMORY/SPACE, répétitions et variations mesurées.
- [x] Suppression coordonnée des sessions, habitudes et souvenirs dérivés ; CURIOSITY sans graines ECHO.
- [x] Recette A–J : typage/compilation, 69 tests unitaires et sept parcours Electron ; dernière recette ECHO avec DEEP explicite sans fallback.
- [x] Paquet Windows 0.5.0 vérifié, dont helper ECHO embarqué, vraie réponse Ollama et préservation du profil personnel.
- [x] Documentation des sources, confidentialité, consentement, UIA, stockage, limites et preuves.

Sauvegarde personnelle créée avant J5 dans `%APPDATA%\AETHER\backup-before-j5-20261005-132125`. Souvenirs et intérêt existants préservés ; autonomie choisie par l’utilisateur conservée. La session vide de vérification du paquet est supprimée, sans importer les données de recette. Les réponses du modèle restent non déterministes ; un résultat CURIOSITY refusé au premier passage et sa reprise réussie sont documentés.

Preuves : [RECETTE-J5](docs/RECETTE-J5.md). Proposition suivante : **J6 FORGE + MIRROR**, spécification approuvée puis fabrication/essai isolés et adoption distincte. Aucun développement J6 commencé. Arrêt à J5.
