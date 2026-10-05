# Recette J4 — PORTAL + SPACE

Livraison AETHER **0.4.0**, Windows 11 x64, 5 octobre 2026. J1 à J3 validés par l’utilisateur avant ce jalon. Rendu React/SVG/CSS 2.5D, sans moteur 3D supplémentaire. FAST et DEEP : Ollama local **qwen3.5:9b** ; aucun cloud ou faux résultat dans la recette.

## Données et provenance

Le profil personnel contenait un intérêt, quatre explorations réussies, aucun souvenir et l’autonomie activée par l’utilisateur avant J4. Une sauvegarde préalable est conservée dans `%APPDATA%\AETHER\backup-before-j4-20261005-105625`. Le réglage d’autonomie est préservé. Les explorations autorisées peuvent continuer pendant l’utilisation normale, selon le budget J3.

« Causalité structurelle » et sa connexion à « Acoustique des résonateurs » appartiennent à la recette J3 isolée, pas au profil personnel. Pour les scénarios D/E, [source-j3.json](recette-j4/source-j3.json) conserve le snapshot réel `D_autonomy` extrait de [la preuve J3](recette-j3/preuve-reelle.json), avec UUID, dates, texte et provenance, référence du fichier et empreinte SHA-256 vérifiée. Le premier intérêt et la relation ont été générés par Ollama ; la piste acoustique a été proposée explicitement dans le journal J3. L’import se fait seulement dans un profil temporaire créé par le test, puis supprimé. Le paquet exclut les tests, sources et reçus. Aucune réintroduction dans la base personnelle.

Le scénario C ajoute un souvenir volontairement dans l’interface MEMORY de ce profil isolé, puis le corrige et le supprime depuis SPACE. Le scénario F réalise une **nouvelle exploration Ollama**, identifiée par un nouvel UUID, avant la première ouverture du portail. Cette exploration ne vient pas du reçu importé.

## Résultats A–H

| Scénario | Vérification réalisée | Preuve |
| --- | --- | --- |
| A — Entrée | Double clic Windows natif sur ENTITY ; animation CSS `portal-reveal` active, origine issue de la position réelle ; SPACE ouvert et ENTITY de bureau temporairement masquée. | [Portail pendant l’entrée](recette-j4/A-portal.png), [SPACE](recette-j4/A-space.png), événements et origine dans le JSON |
| B — Sortie | Échap, bouton et raccourci configuré referment SPACE ; transition inverse et fenêtre détruite ; mêmes coordonnées x/y pour ENTITY. | `B_exit` et `A_B_transitionEvents` dans [preuve-reelle.json](recette-j4/preuve-reelle.json) |
| C — Données | Souvenir affiché identique au repository ; intérêts identiques au journal. Correction puis suppression depuis l’éditeur intégré, actualisation de SPACE et base vide après suppression. | `C_data` et `C_memoryMutation` dans le JSON |
| D — Intérêt | « Causalité structurelle » : historique, questions et relations présents, comparés aux UUID et données du journal. | [Intérêt](recette-j4/D-interest.png), `D_interest` |
| E — Connexion | Arête sélectionnable au clavier ; relation conservée et deux extrémités consultables, accès à l’exploration source. | [Connexion](recette-j4/E-connection.png), `E_connection` |
| F — Journal | La nouvelle exploration locale réussie avant ouverture apparaît dans ACTIVITY avec sa raison exacte, UUID et route DEEP réelle. | [Activité](recette-j4/F-activity.png), `F_explorationBeforePortal` |
| G — Persistance | Arrêt complet puis relance : mêmes items et connexions, caméra/zoom/profondeur/sélection restaurés, date de visite précédente présente. | [Redémarrage](recette-j4/G-restart.png), `G_restart` |
| H — Non-régression | Typage, compilation, 52 tests unitaires et six parcours Electron réussis, dont J1 natif, J2 A–E et coffre Windows, J3 A–F et J4. | [Journal de vérification](recette-j4/verification.log), [résumé](recette-j4/verification.json) |

Contrôles supplémentaires : pan par souris, zoom molette, flèches, réglage séparé du raccourci PORTAL et conflit OS sans perdre l’ancien ; refus des mutations de vue depuis ENTITY, des réglages PORTAL depuis ENTITY et d’une caméra invalide ; absence de Node dans le rendu ; transition réduite à 90 ms ; fermeture/ouverture concurrentes sans seconde fenêtre restante. Les tests unitaires couvrent les tokens tardifs, inversions, géométrie, zoom ancré, plages/charges utiles, stockage atomique, conservation d’un fichier corrompu, projection réelle et suppression d’une sélection orpheline. Projection de 500 pistes vérifiée ; le DOM de constellation est limité à 60 pistes à la fois.

Les appels de non-régression ont aussi leurs reçus actualisés : [J2](recette-j4/regression-j2.json), [J3](recette-j4/regression-j3.json). Les preuves historiques des anciens jalons restent conservées.

## Paquet et lancement réel

`npm run package:win` produit `release\AETHER-win32-x64\AETHER.exe`. `node scripts/verify-package.mjs` lance ce **paquet réel** sur le profil personnel : version 0.4.0 et `app.isPackaged=true`, réponse Qwen réelle, configuration locale, absence de clé dans la configuration publique, permissions sensibles refusées, ouverture/fermeture de SPACE et préservation des souvenirs, intérêts antérieurs et réglage d’autonomie. Il attend la fin d’une exploration déjà autorisée avant l’échange de contrôle.

Preuves : [paquet-verifie.json](recette-j4/paquet-verifie.json), [SPACE personnel](recette-j4/paquet-space.png), [réglages](recette-j4/paquet-reglages.png). Après cette vérification, AETHER est relancé normalement, sans contrôleur Playwright attaché : [lancement-normal.json](recette-j4/lancement-normal.json). ENTITY est laissée sur le bureau, SPACE fermé.

Une cinquième exploration locale réussie s’est ajoutée pendant le premier lancement de contrôle, conformément à l’autonomie existante. Le contrôle final retrouve un intérêt, cinq tentatives et aucun souvenir ; les anciens UUID et le budget sont préservés. Ces compteurs peuvent encore évoluer pendant le lancement normal autorisé.

## Architecture et usage

Voir [ARCHITECTURE](../ARCHITECTURE.md), [PLAN](../PLAN.md), [README](../README.md) et [sécurité](SECURITE.md). PORTAL utilise un cycle avec token, une animation CSS et un délai de secours ; SPACE relit les snapshots après les événements existants. Les mutations MEMORY réutilisent les validations/purges J2/J3. Les seuls nouveaux fichiers persistants sont `portal-settings.json` et `space-state.json` ; SQLite reste au schéma v2.

Double clic, menu ou **Ctrl + Alt + A** pour entrer ; Échap, bouton ou même raccourci pour sortir. **Ctrl + Alt + Espace** reste le rappel. Pan du fond, molette, boutons de zoom, Home/0, flèches, recherche et navigation Tab/Entrée. « Affichage » conserve libellés et profondeur. Un noyau ENTITY et son indicateur d’état restent accessibles ; un clic ouvre le dialogue existant.

## Limites et suite

SPACE est une projection 2.5D, sans interactions complexes entre objets. La zone de travail conserve la barre des tâches. Les configurations physiques autres que le poste à 150 % nécessitent une recette complémentaire ; les utilitaires multi-écrans J1 restent testés. Le rectangle natif d’ENTITY peut être arrondi entre 160 et 164 DIP ; le retour vérifie les coordonnées, et la forme conserve 160 DIP.

ACTIVITY reconstruit l’histoire des objets encore présents et les réponses de la session en RAM. Supprimer un objet retire ses traces projetées ; aucune conservation additionnelle de contenu supprimé. Les journaux sont lus intégralement, avec pagination du rendu : pas de pagination SQL ni benchmark FPS sur de très grands historiques. Les découvertes sont des synthèses non vérifiées du modèle ; leurs limites restent consultables. OpenAI conserve sa limitation de validation réelle des jalons précédents.

**J5 proposé : ECHO**, avec consentement séparé, dossier de test explicitement choisi, observation structurée, pause/arrêt et correction des hypothèses. J4 s’arrête ici : aucun ECHO, FORGE, MIRROR, plugin dynamique, capacité générée ou accès système supplémentaire développé.
