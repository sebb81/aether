# Recette J5 — ECHO

Date : 5 octobre 2026. Version : **AETHER 0.5.0**, Windows 11 x64, écran à 150 %. FAST et DEEP : **Ollama `qwen3.5:9b`**, local, sans clé ni cloud. J1 à J4 restent disponibles. FORGE et MIRROR restent à développer.

Résultat : typage et compilation réussis, **69 tests unitaires et sept parcours Electron réussis** ; suite Electron complète en 2,9 minutes. Les ajustements visuels et la fixture DEEP ont ensuite été revérifiés avec [la recette ECHO finale](recette-j5/echo-final.log), utilisant DEEP explicitement configuré, sans fallback. Recettes A–J exécutées ; paquet Windows réellement lancé et vérifié.

## Utilisation

Dire « Regarde comment je fais. » dans le dialogue ouvre le panneau ECHO. Le menu d’ENTITY, le tray et les réglages donnent aussi accès au panneau. Cette ouverture ne démarre aucune perception.

1. Préparer une session, choisir un dossier local de test dans le sélecteur Windows.
2. Cocher l’autorisation et démarrer. Le halo et l’indicateur ECHO d’ENTITY signalent l’observation.
3. Mettre la fenêtre Explorer de ce dossier au premier plan et effectuer la procédure.
4. Arrêter et comprendre. Le watcher et le helper s’arrêtent avant l’appel à MIND.
5. Examiner l’hypothèse et ses preuves, puis choisir Oui, Non, Partiellement ou Corriger.

Chaque nouvelle session demande un nouveau choix et une nouvelle validation. ECHO est OFF à chaque lancement. Pause/reprise gardent le consentement de la session courante, pendant au plus 15 minutes ; la fermeture du panneau désactive ECHO. Arrêt et désactivation restent accessibles depuis le tray.

## Recette réelle A–J

Les données complètes, réponses du modèle, décisions, sources et résultats sont dans [preuve-reelle.json](recette-j5/preuve-reelle.json). Les fichiers de démonstration et le profil temporaire sont supprimés après le test ; les preuves restent disponibles.

| Test | Vérification réellement exécutée | Preuve |
| --- | --- | --- |
| A — Consentement | OFF au lancement ; aucun objet session après le choix seul ; démarrage désactivé avant la case ; demande depuis ENTITY refusée ; démarrage après validation. | [Panneau avant consentement](recette-j5/A-consent.png), objet `A` du JSON |
| B — Observation | Explorer renomme deux fichiers `.wav`, crée puis renomme un sous-dossier daté et y déplace les deux fichiers. Événements `renamed`, `created` et `moved` réellement enregistrés. | [Explorer après procédure](recette-j5/B-explorer.png), [indicateur ENTITY](recette-j5/B-entity-active.png), objet `B` |
| C — Compréhension | Appel DEEP local à Qwen ; interprétation du classement daté et des noms ; références aux UUID d’événements existants. Aucun souvenir avant approbation. | [Hypothèse](recette-j5/C-hypothesis.png), objet `C` avec route, réponse et preuves |
| D — Validation | Oui explicite ; une habitude confirmée, un souvenir `kind:habit`, origine explicite et source ECHO ; même UUID dans SPACE et relation visuelle à MEMORY. | [SPACE / ECHO](recette-j5/D-space.png), objet `D` |
| E — Répétition | Seconde procédure sur le même dossier, avec `2026-10-08` dans les noms ; même Habit, deux occurrences, variation datée calculée depuis les événements réels. | Objet `E` : Habit, seconde session et UUID de preuves |
| F — Correction | La méthode décrite par le modèle ne donne pas la finalité réelle d’export client. L’utilisateur corrige cette interprétation incomplète ; proposition originale invalidée, intention humaine retenue. | [Correction](recette-j5/F-correction.png), objet `F` avant/après |
| G — Suppression | Suppression de la deuxième session ; événements/hypothèses propres retirés, une occurrence restante ; la correction de la source supprimée disparaît aussi du souvenir. | Objet `G`, identifiant supprimé et état restant |
| H — Désactivation | OFF puis renommage natif d’un nouveau fichier ; sessions et événements strictement identiques avant/après. | Objet `H` |
| I — Exclusion | Dossier `private` ajouté via le sélecteur natif ; un fichier y est renommé pendant une session ; zéro événement, aucune nouvelle mémoire ; arrêt sans appel MIND pour cette session vide. | Objet `I` |
| J — Non-régression | Typage, 69 tests unitaires et les sept parcours Electron : PRESENCE native, développement, MIND/MEMORY, chiffrement Windows, CURIOSITY, PORTAL/SPACE et ECHO. | [Vérification](recette-j5/verification.log), [reprise J3](recette-j5/non-regression-j3.log) |

Le scénario E répète réellement les opérations pendant la recette ; les noms portent des dates différentes. Il ne prétend pas qu’une attente de trois jours a eu lieu. Le redémarrage vérifie ensuite que sessions et habitude persistent, avec ECHO OFF.

Pour F, la correction saisie est : « Je prépare des lots WAV datés pour un export client. Ce classement temporaire ne décrit pas ma bibliothèque audio personnelle. » Les propositions originales complètes restent inspectables et invalidées. Cette recette vérifie une correction d’intention, sans fabriquer une réponse erronée de fournisseur pour provoquer le scénario.

## Données et sources

Perception du programme : `fs.watch` récursif, inventaire de métadonnées et différences par identité de fichier (`dev`, `ino`, date de création). Contexte réel de la fenêtre au premier plan via Win32 et `Shell.Application`, échantillonné toutes les 250 ms. Seul Explorer est admissible. La visibilité et l’unicité du dossier Shell sont vérifiées ; une ambiguïté suspend la capture.

Un événement conserve UUID, session, date UTC, action, chemins relatifs actuel/précédent, type fichier/dossier, taille, source, application Explorer, titre et dossier autorisés. L’inventaire utilise aussi la date de modification. ECHO ne lit pas le contenu, la sélection, les touches, le presse-papiers, les clics, les pixels, l’audio ou la vidéo. Les données du contexte refusé ne rejoignent pas le journal.

Les notifications fichiers ne donnent pas l’identité du processus auteur. Un événement sous contexte Explorer ne prouve donc pas que celui-ci est son auteur. Le système ne peut pas déduire l’intention avec certitude à partir de ces métadonnées. La validation humaine reste nécessaire.

UI Automation a été étudié, mais n’est pas une source active de J5. Les fournisseurs UI ne rendent pas tous les contrôles accessibles ; les applications élevées et les bureaux sécurisés ont des limites spécifiques. Aucun contournement UAC, aucune élévation et aucune capture de secours. Voir [ARCHITECTURE](../ARCHITECTURE.md) et les références Microsoft qui y sont liées.

## Consentement, exclusions et stockage

Le sélecteur natif fournit un jeton consommable pendant deux minutes ; seul le panneau ECHO peut démarrer avec `consent:true`. Aucun consentement persistant. Refus des racines de volumes/profil, chemins réseau, données AETHER, Windows, AppData, liens et jonctions. L’identité et le chemin canonique de la racine sont revérifiés pendant les inventaires.

Exclusions de dossiers, processus et mots de titres. Navigateurs, gestionnaires de mots de passe et Outlook exclus initialement ; toute application autre qu’Explorer reste inadmissible. Les sous-arbres exclus sont ignorés avant inventaire. Les frontières sont revérifiées avant enregistrement et confirmation. Ajouter une exclusion arrête les opérations et retire les sessions touchées avec leurs souvenirs dépendants.

Bornes : 15 minutes, 600 événements, 5 000 entrées, profondeur 20 et 200 sessions. Les changements très rapprochés peuvent être regroupés ou manquer. Un contexte périmé après 1,5 seconde ferme l’accès à la capture ; une différence devenue incertaine après changement de contexte est abandonnée. Utiliser une fenêtre Explorer dont le dossier est clairement identifiable ; les configurations d’onglets ambiguës échouent sans capture.

SQLite commun `memory.sqlite`, schéma v3, migration transactionnelle de J1–J4. Session : début/fin, durée, application, ressources, événements, statut, résumé et hypothèses. Habit : nom, description, contexte, applications, déclencheurs, étapes sourcées, dates, occurrences, confiance, état et provenance. Hypothèses et décisions sont distinctes des souvenirs confirmés.

Suppression : cascades SQL et reconstruction depuis les sources restantes. Sans autre source, l’habitude, le souvenir, son index FTS et l’opportunité disparaissent ; compaction de la base. Les refus conservent une empreinte SHA-256 et une raison générique pour éviter les repropositions. Les sauvegardes externes restent sous le contrôle de l’utilisateur. La base locale n’est pas chiffrée ; noms et chemins peuvent être sensibles malgré l’absence de lecture de contenu.

## MIND, HABITS et systèmes voisins

MIND reçoit au plus 30 événements sourcés et cinq habitudes candidates via DEEP avec `localOnly:true`. JSON contrôlé : preuves réelles, actions correspondantes, confiance entre 0 et 1 et candidats connus. Les erreurs sont visibles ; aucune hypothèse de secours pré-écrite. La confiance est une estimation du modèle, pas un score de précision mesuré.

Oui et Corriger explicitement promeuvent l’habitude dans MEMORY. Non invalide ; Partiellement reste à préciser. Une correction remplace aussi les attributs dérivés d’intention, tout en reconstruisant les étapes depuis les événements réels. Une proposition pendante ne remplace pas une intention déjà approuvée.

Même dossier et similarité de signature ≥ 0,6 pour rapprocher les procédures ; les occurrences viennent des sessions distinctes. Les variations du registre sont des différences mesurées de dates et de nombres d’événements, avec sessions et preuves. Les variations spéculatives du modèle restent dans sa proposition étiquetée.

SPACE expose observations, hypothèses, habitudes et variations ; les arêtes MEMORY correspondent aux vrais identifiants. MIND peut consulter au plus cinq habitudes confirmées. ECHO ne crée aucune graine ou exploration CURIOSITY ; le réglage d’autonomie choisi auparavant est conservé. `AutomationOpportunity` prépare seulement une suggestion pour une habitude confirmée répétée, avec `executionAllowed:false`.

## Méthode de test et incidents

Les recettes Electron utilisent des profils temporaires isolés. Les deux fichiers `.wav` sont des fixtures dont le contenu n’est jamais lu. Les gestes de démonstration sont effectués dans le vrai Explorer par F2, Ctrl+Maj+N et couper/coller. L’adaptateur de perception du programme et Ollama sont réellement utilisés ; aucun mock de perception ou de modèle dans cette recette.

Le sélecteur Windows est réellement ouvert et validé. Une fixture définit seulement son dossier initial ; elle ne remplace pas son résultat. Les helpers de test manipulent uniquement ces fenêtres et fichiers dédiés. Les captures ponctuelles ci-dessus servent de preuves de recette et ne font pas partie du programme ECHO. Les doubles de modèle et d’observateur restent dans les tests unitaires.

Le canal natif du plugin Computer Use était indisponible dans cette session. La recette a utilisé les helpers Windows du dépôt. Des essais initiaux de focus/gestes ont échoué ; les gestes natifs complets réussissent ensuite. Lors du premier passage complet, CURIOSITY a rejeté un résultat pour « Confiance ou évolution de priorité invalide ». Le nouveau parcours J3 complet réussit ; le validateur et la visibilité des erreurs restent en place. Le [journal du premier passage](recette-j5/verification-premier-passage.log) conserve cet incident. Une réponse locale reste non déterministe et peut être refusée par le contrat.

Commandes : `npm run check`, `npm run package:win`, `node scripts/verify-package.mjs`. Le paquet vérifie aussi le helper PowerShell sorti de l’ASAR et une session vide avec consentement/contexte Explorer réels, ensuite supprimée. Le profil personnel n’importe aucune habitude ni donnée de démonstration.

[Preuve du paquet](recette-j5/paquet-verifie.json), [SPACE dans le paquet](recette-j5/paquet-space.png), [réglages personnels conservés](recette-j5/paquet-reglages.png), [lancement normal](recette-j5/lancement-normal.json). L’intérêt existant, les souvenirs et l’opt-in CURIOSITY restent en place. Les tentatives autonomes peuvent continuer conformément à cet opt-in ; leur nombre peut donc augmenter pendant la vérification. Sauvegarde préalable : `%APPDATA%\AETHER\backup-before-j5-20261005-132125`.

## Prochain jalon proposé

**J6 FORGE + MIRROR** : transformer une opportunité en spécification à approuver, fabriquer hors noyau, tester dans un runner isolé sur copies avec droits/budgets explicites, présenter résultats et différences, puis demander une adoption distincte. J6 n’est pas commencé ; arrêt du développement à J5.
