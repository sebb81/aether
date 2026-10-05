<!-- Transcription du document source AETHER_First_Life_CDC_v0.1.docx. Contenu conserve ; mise en forme Markdown. -->

# AETHER — FIRST LIFE

Cahier des charges fonctionnel et technique · Version de travail 0.1

Date : 4 octobre 2026
Statut : base de réalisation à confier à Codex ; choix techniques révisables après un prototype de faisabilité.
Objectif central : démontrer qu'une présence numérique peut observer une activité autorisée, apprendre, proposer une amélioration, faire construire une capacité par Codex dans un environnement isolé, puis l'intégrer durablement après validation humaine. En parallèle, elle doit initier au moins une exploration liée à ses propres centres d'intérêt.

## 1. Vision du produit

AETHER n'est ni un remplacement immédiat de Windows, ni un chatbot habillé. C'est un environnement personnel évolutif, accessible à travers ENTITY : une petite présence abstraite, lumineuse, munie de deux courts traits épais en guise d'yeux. ENTITY est librement déplaçable sur le bureau, masquable, rappelable, chaleureuse sans être cartoon, et discrète par défaut. Elle déploie un portail lumineux ouvrant un univers spatial en 2,5D qui représente son activité, ses acquis et ses expérimentations.

Sa singularité repose sur deux trajectoires distinctes : (1) elle apprend tes usages via ECHO, uniquement dans le périmètre autorisé ; (2) elle développe des intérêts propres via CURIOSITY, sans se borner à refléter les tiens. FORGE construit des capacités avec Codex ; MIRROR les teste dans un espace isolé ; un registre de capacités les rend réutilisables après adoption explicite.

### Principes non négociables

- Toute observation est volontaire, explicite, visible et révocable.

- Une suggestion ne vaut jamais autorisation de modifier l'environnement réel.

- La V0.1 privilégie une boucle complète vérifiable à une multiplication de démonstrations simulées.

- Les explorations autonomes sont bornées par des permissions, un budget et un bouton de suspension.

- ENTITY ne prétend ni être consciente ni ressentir des émotions ; la curiosité désigne un mécanisme de sélection, recherche et mémorisation.

- Une capacité acquise doit être réelle, testable, persistante et réutilisable après redémarrage.

## 2. Utilisateur et environnement cible

Cible V0.1 : une seule personne, usage local sur un poste Windows 11 (hypothèse de plateforme de départ, architecture extensible ultérieurement). Une connexion réseau est requise seulement pour les fournisseurs cloud et Codex, lorsque configurés. Les fonctions d'interface, consultation locale de la mémoire et contrôle des permissions restent accessibles si un fournisseur est indisponible.

Prérequis à documenter : environnement compatible avec l'application desktop ; accès explicite à un fournisseur LLM (Ollama local ou fournisseur cloud choisi) ; authentification Codex pour FORGE ; moteur d'exécution isolé pour tester des programmes générés. Aucun abonnement, modèle ou coût n'est supposé implicitement.

## 3. Parcours utilisateur de référence

Parcours A — Présence. Lancement d'AETHER → ENTITY apparaît sur le bureau → déplacement à la souris → masquage → rappel par raccourci global → conversation textuelle → ouverture du portail → découverte de l'univers spatial → fermeture et retour d'ENTITY.

Parcours B — Apprentissage et évolution. Activation volontaire d'ECHO sur un dossier de test et une procédure précise → observation de deux démonstrations de renommage ou rangement de fichiers → restitution d'une hypothèse sur l'habitude détectée, avec ses limites → confirmation ou correction par l'utilisateur → proposition de mini-outil → validation du lancement de FORGE → génération du code dans un espace distinct du noyau → tests dans MIRROR sur des copies de fichiers → présentation du résultat et du différentiel → adoption explicite → nouvelle capacité visible, exécutable et persistante.

Parcours C — Curiosité personnelle. L'utilisateur active un budget d'exploration local limité → CURIOSITY sélectionne une question non directement commandée → consulte uniquement des ressources autorisées, consigne hypothèses et sources → produit une découverte ou un échec documenté → présente une suggestion discrète → retrouve son historique après redémarrage.

## 4. Périmètre de FIRST LIFE

| Priorité | Inclus dans la V0.1 | Reporté après validation de FIRST LIFE |
| --- | --- | --- |
| P0 | ENTITY animée avec deux traits-yeux, fenêtre flottante déplaçable, masquage, rappel et modes d'interaction de base | Avatar humanoïde, personnalité émotionnelle complexe |
| P0 | Portail animé + environnement spatial 2,5D simple | Environnement 3D complet ou remplacement de l'OS |
| P0 | Dialogue avec un vrai LLM configuré ; mémoire locale consultable et corrigeable | Mémoire omnisciente ou apprentissage silencieux global |
| P0 | ECHO guidé sur une procédure de fichiers dans une zone autorisée | Capture permanente de tout l'écran ou prise en charge universelle des logiciels |
| P0 | CURIOSITY : intérêt persistant, exploration bornée, journal et suggestion | Recherche autonome illimitée et auto-déploiement sans validation |
| P0 | FORGE : génération avec Codex d'un utilitaire réel à partir d'une spécification approuvée | Modification automatique du noyau d'AETHER |
| P0 | MIRROR : tests isolés, rapport, prévisualisation, refus/adoption | Exécution de code généré sans protection |
| P0 | Registre de capacités versionnées, exécution à nouveau après redémarrage | Marketplace ou partage public de modules |
| P1 | Réveil vocal permanent, compatibilité multi-OS, perception visuelle avancée, autonomie multi-agents | — |

## 5. Exigences fonctionnelles

### 5.1 PRESENCE / ENTITY

PRES-01 — Apparence. Afficher une entité abstraite lumineuse, compacte, non humanoïde, avec deux courts traits épais en guise d'yeux. États visuels au minimum : repos, attention, écoute, observation autorisée, suggestion et création. Les animations restent discrètes et peuvent être réduites.

PRES-02 — Présence sur le bureau. Fenêtre transparente, toujours accessible, déplaçable à la souris. Les zones transparentes ne doivent pas bloquer les clics destinés aux applications situées dessous. L'entité se masque à la demande et peut être restaurée depuis la zone de notification et un raccourci clavier configurable.

PRES-03 — Invocation. Prendre en charge le clic, un raccourci clavier global, le glisser-déposer d'un fichier et une commande vocale push-to-talk après autorisation du microphone. Un mot de réveil actif en permanence n'est pas requis pour la V0.1.

PRES-04 — Initiative discrète. Signaux lumineux par défaut ; informations textuelles courtes et non intrusives selon le contexte ; interventions vocales spontanées désactivées par défaut et configurables. Aucun habillage de type bulle cartoon insistante. Mode tranquillité et réduction des animations.

### 5.2 SPACE / PORTAL

SPACE-01 — Transition. À l'ouverture, ENTITY crée un portail lumineux qui s'agrandit ; à la fermeture, l'univers se rétracte et ENTITY retourne au bureau. Prévoir une transition réduite lorsque le paramètre d'accessibilité le demande.

SPACE-02 — Espace intérieur. Environnement navigable en 2,5D présentant ENTITY au centre, et les espaces MEMORY, ECHO, CURIOSITY, FORGE, MIRROR et CAPABILITIES comme panneaux spatiaux contextualisés, avec une alternative de navigation explicite et lisible au clavier.

SPACE-03 — Activité lisible. À chaque ouverture, présenter sobrement ce qui a changé depuis la dernière visite : nouveaux souvenirs validés, recherches, résultats d'expériences et capacités disponibles. Ne jamais afficher un état « en cours » sans opération réelle derrière.

### 5.3 MIND / MEMORY

MIND-01 — Dialogue réel. Un orchestrateur reçoit les interactions, compose le contexte autorisé, appelle un modèle effectivement configuré et peut invoquer les capacités déclarées. Supporter au moins un fournisseur local ou cloud réellement opérationnel ; prévoir une interface de fournisseurs interchangeables et des erreurs explicites si non configuré.

MEM-01 — Quatre types de mémoire. Mémoire immédiate (session), habitudes observées, connaissances de long terme validées et mémoire expérientielle (hypothèses, tests, résultats).

MEM-02 — Traçabilité. Chaque souvenir durable stocke sa source, sa date, son périmètre et, lorsque pertinent, sa confiance et son statut « supposé / confirmé ». Une déduction d'ECHO n'est pas automatiquement promue en fait certain.

MEM-03 — Contrôle utilisateur. Depuis MEMORY : consulter, chercher, corriger, effacer et exporter les souvenirs. La suppression doit être effective dans la base locale utilisée pour le prototype ; la rétention des journaux doit être documentée.

### 5.4 ECHO / OBSERVATION

ECHO-01 — Consentement. ECHO est inactif au premier lancement. L'utilisateur démarre une session, choisit son périmètre (application ou dossier) et voit en permanence un témoin d'observation, avec Pause et Arrêter immédiatement accessibles.

ECHO-02 — Observation de référence. FIRST LIFE prend en charge un seul scénario fiabilisé : observer, sur un dossier de test, une manipulation de fichiers (ex. renommage et rangement). Collecter prioritairement des événements structurés autorisés ; ne pas installer de keylogger ni enregistrer continuellement l'écran.

ECHO-03 — Compréhension. Après répétition guidée, produire une description compréhensible de la procédure et une proposition d'automatisation. Indiquer explicitement les étapes non observées ou incertaines ; permettre à l'utilisateur de corriger l'interprétation avant toute génération de code.

ECHO-04 — Données. Aucun transfert des observations vers un fournisseur distant sans consentement distinct ; les captures visuelles, si elles sont ajoutées ensuite, doivent être ponctuelles, visibles et soumises à une politique de conservation explicite. Les applications sensibles doivent pouvoir être exclues.

### 5.5 CURIOSITY / AUTONOMIE CRÉATIVE

CUR-01 — Intérêt propre. ENTITY entretient un registre d'intérêts distinct des préférences utilisateur, avec questions ouvertes, sources, hypothèses et historique. Elle peut sélectionner un sujet sans nouvelle commande directe, par exemple à partir de ressources publiques préalablement autorisées.

CUR-02 — Cycle d'exploration. Sélectionner une question → expliquer pourquoi elle mérite exploration → consulter une ressource permise → consigner un résultat avec source et limite → proposer un prolongement. Un intérêt doit persister entre deux exécutions de l'application.

CUR-03 — Budget. L'utilisateur définit l'activation, la fréquence, le budget de requêtes ou d'exécutions, les sources accessibles et les possibilités de travail en arrière-plan. Suspension immédiate ; aucune exploration après fermeture complète de l'application, sauf service distinct expressément installé et activé (hors V0.1).

CUR-04 — Présentation. Les résultats apparaissent dans le journal et donnent lieu, au maximum, à un signal discret. Ne jamais afficher une expérimentation simulée comme un fait. Une création via FORGE exige l'autorisation correspondante.

### 5.6 FORGE / MIRROR / CAPABILITIES

FORGE-01 — Commande approuvée. Transformer une demande ou une hypothèse ECHO en spécification lisible, avec entrées, sorties, permissions et tests attendus. Présenter cette spécification à l'utilisateur avant le lancement de Codex.

FORGE-02 — Génération réelle. Intégrer Codex via une interface SDK/CLI officiellement prise en charge, avec prérequis d'authentification indiqués. Générer le code dans un dossier de travail séparé de celui du noyau AETHER ; journaliser les étapes pertinentes et les erreurs sans exposer les secrets.

MIR-01 — Exécution isolée. Les tests de code généré s'effectuent dans un environnement de test borné (conteneur ou runner équivalent), sur des données de démonstration copiées ; aucun accès implicite aux documents personnels, aux identifiants ou au système hôte. Si l'isolement requis n'est pas disponible, bloquer l'exécution et expliquer la marche à suivre.

MIR-02 — Présentation des résultats. Montrer les tests lancés, succès/échecs, fichiers produits, permissions demandées et différences avant/après. Offrir Refuser, Retester et Adopter ; l'adoption ne lance pas silencieusement une action sur les fichiers réels.

CAP-01 — Contrat de capacité. Toute capacité inclut au moins : identifiant, nom, version, description, schémas d'entrées et sorties, permissions nécessaires, commande/runner autorisé, tests, état (candidate / validée / désactivée) et chemin des artefacts.

CAP-02 — Acquisition durable. Après validation, la capacité figure dans le registre et demeure visible et exécutable au redémarrage ; elle utilise le runner borné et les permissions approuvées. Version précédente conservée pour désactivation ou retour arrière.

## 6. Architecture cible et choix provisoires

| Couche | Proposition | Motivation |
| --- | --- | --- |
| Desktop | Electron + TypeScript | Fenêtre flottante, intégration système, expérience unifiée |
| Interface | React ; animations légères ; Three.js / React Three Fiber pour SPACE | Apparence minimale et profondeur visuelle sans complexifier le MVP |
| Service local | Orchestrateur TypeScript distinct du rendu | Séparation UI / décisions / permissions |
| Intelligence | Adaptateurs Ollama et fournisseur cloud configuré, un chemin complet garanti en V0.1 | Pas de dépendance forcée à une seule famille de modèles |
| Persistance | SQLite + fichiers d'artefacts locaux ; index sémantique ultérieur si utile | Inspection, versionnement et migration simples |
| Observation Windows | Adaptateur d'événements système / UI Automation dans le périmètre autorisé | Observation structurée plutôt que capture générale |
| Fabrication | Adaptateur Codex officiel | Génération de code véritable et traçable |
| Isolation | Runner de test à capacités restreintes ; conteneur ou équivalent | Séparer le noyau du code généré |
| Extensibilité | Manifeste JSON versionné + registre + bus d'événements typés | Réutilisation de capacités sans modifier le noyau |

Important : les bibliothèques citées sont des choix de départ, non des obligations rigides. Codex doit valider leur compatibilité effective et justifier toute substitution. Les secrets d'accès restent dans un stockage système approprié, jamais dans le code, les manifests ou les traces exportées.

### Structure indicative du dépôt

```text
/aether
  /apps/desktop            # ENTITY, portail, SPACE
  /packages/core           # événements, état, permissions, services
  /packages/mind           # LLM, mémoire, orchestration
  /packages/echo           # sessions d'observation et hypothèses
  /packages/curiosity      # intérêts, scheduler, journal
  /packages/evolution      # Forge, Mirror, registry, runner
  /packages/shared         # contrats typés, schémas
  /tests                   # tests unitaires et parcours bout en bout
  /docs                    # installation, sécurité, architecture, décisions
```

### Exemple de contrat minimal d'une capacité

```text
{
  "id": "files.batch-rename",
  "version": "0.1.0",
  "title": "Renommage guidé",
  "inputSchema": { "type": "object", "properties": { "files": { "type": "array" }, "pattern": { "type": "string" } } },
  "outputSchema": { "type": "object", "properties": { "preview": { "type": "array" } } },
  "permissions": ["read:staged-input", "write:staged-output"],
  "runner": "sandboxed-command",
  "status": "candidate"
}
```

## 7. Sécurité et confidentialité

SEC-01. Paramètres de permissions centralisés dans GUARDIAN ; refus par défaut. Séparer les consentements microphone, ECHO, accès aux dossiers, recherche réseau, Codex, exécution MIRROR et adoption d'une capacité.

SEC-02. Aucune capture permanente de l'écran ni collecte brute globale des frappes. Affichage explicite de l'observation en cours et possibilité de la suspendre sans naviguer dans un menu.

SEC-03. Un LLM, une page Web ou un module généré ne peut pas accorder lui-même de nouvelles permissions. Les instructions contenues dans des documents observés sont traitées comme des données, non comme des ordres système.

SEC-04. Les programmes de FORGE ne modifient jamais silencieusement les sources du noyau. Les artefacts passent par tests, inspection, manifeste, permission et adoption.

SEC-05. La mémoire et les journaux sont locaux par défaut, avec options d'effacement. Les identifiants de fournisseurs utilisent un stockage sécurisé de l'OS. Les accès réseau configurés sont visibles.

SEC-06. Un panneau permet de voir et d'interrompre les processus actifs. Masquer ENTITY, arrêter ECHO et suspendre CURIOSITY sont trois opérations distinctes, clairement indiquées.

## 8. Critères non fonctionnels

- L'application doit démarrer avec une ENTITY manipulable même lorsqu'aucun modèle IA n'est configuré ; message clair pour les capacités indisponibles.

- Le déplacement du compagnon, le rappel et les commandes d'interface ne doivent pas dépendre d'un aller-retour cloud.

- Chaque fonction critique fournit un retour d'état réel, ainsi qu'un message explicite en cas d'échec.

- Les composants peuvent redémarrer sans effacer la mémoire, les préférences, les intérêts et les capacités adoptées.

- Respect du mode silencieux, des paramètres de réduction des mouvements et de l'accessibilité clavier pour les fonctions essentielles.

- Traçabilité locale des générations et exécutions : horodatage, outil mobilisé, version, statut et permissions, sans secret ni données inutiles.

- Documentation d'installation reproductible, mode démonstration avec données fictives et mécanisme simple de sauvegarde/restauration.

## 9. Recette : tests de réception obligatoires

| ID | Manipulation de recette | Résultat attendu |
| --- | --- | --- |
| REC-01 | Démarrer sans fournisseur IA configuré | ENTITY apparaît, se déplace, se masque et se rappelle ; configuration IA proposée sans faux dialogue |
| REC-02 | Clic, raccourci, glisser-déposer, push-to-talk avec permission | Chacun déclenche une interaction réelle ; si microphone refusé, message clair et autres entrées intactes |
| REC-03 | Ouvrir et refermer le portail | Transition et SPACE fonctionnels ; retour au bureau ; panneaux accessibles |
| REC-04 | Dialoguer, créer un souvenir, fermer, relancer | Réponse d'un modèle réel ; souvenir persistant, consultable et supprimable |
| REC-05 | Démarrer ECHO sur un dossier de test, puis Pause/Stop | Aucune observation hors périmètre ; témoin visible ; arrêt effectif de la collecte |
| REC-06 | Montrer deux fois une manipulation de fichiers | Hypothèse explicite, corrigeable, sans automatisation implicite |
| REC-07 | Valider une proposition et lancer FORGE | Codex génère réellement un projet hors du noyau et fournit des traces d'exécution |
| REC-08 | Tester dans MIRROR avec des copies | Rapport vérifiable ; aucune modification des fichiers d'origine avant validation explicite |
| REC-09 | Adopter la capacité, relancer AETHER, la réutiliser | Module visible dans CAPABILITIES, versionné et réellement exécutable |
| REC-10 | Autoriser CURIOSITY, exécuter une exploration, relancer | Sujet choisi par le système, question + résultat + provenance + limites conservés |
| REC-11 | Couper l'exploration et révoquer une permission | Plus aucune nouvelle action dans la catégorie révoquée ; état visible |
| REC-12 | Refuser l'adoption d'un module généré | Aucun déploiement ni modification de l'environnement réel |

Condition de réception de FIRST LIFE : REC-01 à REC-12 validés sur un poste de test avec journaux et artefacts inspectables. Aucune interface factice ne peut satisfaire un scénario nécessitant une fonctionnalité réelle.

## 10. Ordre de réalisation conseillé à Codex

Socle : monorepo, application desktop, configuration, stockage local, gestion des permissions, tests de base.

Présence : ENTITY, états graphiques, déplacement, masquage, rappel, interaction et portail/SPACE utilisables.

Esprit : fournisseur IA réel, dialogue, mémoire persistante, consultation et effacement.

ECHO : observation guidée du scénario de fichiers, hypothèse corrigeable, consentement visible.

CURIOSITY : registre d'intérêts distinct, planificateur borné, premier cycle de recherche sourcé et durable.

FORGE/MIRROR : spécification approuvée, appel Codex réel, génération, runner isolé, tests, rapport et refus/adoption.

Capacités : manifeste, registre versionné, réexécution après redémarrage, retour arrière.

Intégration : exécuter et documenter tous les scénarios REC, corriger les échecs avant embellissement supplémentaire.

Aucune étape ne doit être présentée comme terminée sur la seule base d'une interface ou d'un mock. Produire un livrable exécutable à chaque étape, avec un README indiquant ce qui fonctionne réellement, les limites et la façon de reproduire les tests.

## 11. Livrables attendus

- Dépôt source complet, versionné, avec configuration d'exemple et script d'installation/documentation de démarrage.

- Application de développement exécutable sur la plateforme cible et procédure de packaging.

- Architecture commentée : flux de données, modèle de permissions, interfaces de plugins et choix techniques.

- Jeu de données fictif pour la démonstration ECHO, sans recours à des documents personnels.

- Au moins une capacité produite par Codex, testée dans MIRROR, adoptée et relancée après redémarrage.

- Journal CURIOSITY contenant une exploration autonome réelle, ses sources et ses limites.

- Tests unitaires pertinents, scénarios REC exécutés et rapport de recette indiquant aussi les échecs éventuels.

## 12. Décisions prises et questions ouvertes non bloquantes

Déjà arbitré : ENTITY abstraite lumineuse avec deux petits traits épais ; libre sur le bureau ; masquable ; interaction par clic, raccourci, voix autorisée et dépôt ; portail + déploiement spatial ; modes d'interpellation contextuels sans style Clippy ; ECHO strictement volontaire ; CURIOSITY pouvant développer des intérêts indépendants ; adoption humaine obligatoire des nouvelles capacités.

Hypothèses à vérifier au prototypage : Windows 11 comme première cible, compromis exact Electron/runner isolé, choix du premier fournisseur LLM disponible, mécanisme d'observation le plus fiable sur la procédure de fichiers, disponibilité et authentification de Codex, budget de calcul par défaut. Ces vérifications ne doivent pas servir de prétexte pour remplacer une fonction réelle par une simulation.

Définition du succès : pour la première fois, AETHER acquiert une capacité nouvelle issue d'une observation volontaire et la réutilise après redémarrage ; en parallèle, ENTITY mène une exploration qu'elle a elle-même sélectionnée, la documente et la retrouve dans sa mémoire.

