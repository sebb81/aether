# Recette du jalon PRESENCE

Livraison du 5 octobre 2026. Poste : Windows 11 Professionnel x64, version 10.0.26200 ; affichage à 150 %. Node 24.18.1, Electron 44.5.1, React 19.3.0 et TypeScript 7.0.2. Les versions des dépendances sont verrouillées dans `package-lock.json`.

**Résultat : J1 livré, compilation et vérifications réussies.** Ce résultat couvre la présence sur le bureau demandée dans le brief. Il ne constitue pas la réception complète FIRST LIFE du CDC.

## Vérifications exécutées

| Vérification | Résultat et preuve |
| --- | --- |
| `npm run typecheck` | Réussi, typage strict du main, preload, rendu, noyau, contrats et tests |
| `npm test` | 12 tests réussis, 0 échec : coordonnées négatives, écran disparu, limites de travail, hit testing, validation, états réels, permissions, bus, raccourci transactionnel, persistance, récupération et refus d'écrasement |
| `npm run test:e2e` | 2 parcours réussis : développement Vite et recette native Electron Windows ; environ 11 secondes pour l'ensemble |
| `npm run package:win` | Réussi ; dossier `release/AETHER-win32-x64` avec `AETHER.exe` |
| `node scripts/verify-package.mjs` | Réussi ; lancement de l'exécutable produit, `app.isPackaged = true`, chargement depuis `resources/app.asar`, présence et réglages utilisables, raccourci enregistré, permissions refusées |
| Inspection du paquet | 14 entrées : compilation, images et package.json ; aucun source applicatif non compilé, test, SDK LLM/Codex ou node_modules de développement |
| Contrôle visuel | Captures ENTITY et réglages examinées : forme lumineuse, deux traits-yeux, fond transparent, labels et contrôles lisibles, indication des moteurs non implémentés |

Le test de l'exécutable utilise le profil AETHER normal et rappelle ENTITY ; il est distinct des tests e2e, qui utilisent des profils temporaires. Les captures de contrôle restent dans `test-results/` et ne sont pas nécessaires au fonctionnement.

## Comportements réellement contrôlés

- Démarrage sans IA, sans connexion fournisseur et sans clé.
- Rendu 160 × 160 unités logiques ; fenêtre native compacte malgré les arrondis Windows de DPI. Transparence mesurée : coin alpha nul, centre opaque.
- Un vrai clic Windows dans une marge transparente atteint le bouton d'une autre fenêtre placée dessous. La marge ne bloque donc pas le bureau.
- Un clic Windows sur ENTITY déclenche attention, puis repos. Le glissement natif modifie la position ; le fichier de préférences contient les coordonnées résultantes.
- Réglage du raccourci par la fenêtre dédiée et activation de la réduction des animations.
- Conflit avec un raccourci réellement enregistré dans Windows : échec explicite, ancien raccourci et préférences conservés.
- Masquage effectif de la fenêtre, rappel par un événement clavier global Windows et stabilité du rectangle après six rappels successifs.
- Redémarrage : position, raccourci et réduction des animations restaurés. Deuxième redémarrage après masquage : présence initialement masquée, puis rappel réussi.
- Aucun accès `require` ou `process` depuis le rendu. Demande de microphone refusée ; nouvelle fenêtre externe refusée.
- Une fenêtre étrangère chargée avec le même preload ne peut pas obtenir le snapshot via IPC.
- Demande de portail : erreur explicite « pas encore implémenté », sans animation de fonctionnement simulé.
- Création réelle du tray Windows avec une icône valide et son menu. L'exécutable démarre sans erreur de création du tray.

## Parcours manuel complémentaire

Lancez `AETHER.exe`, vérifiez l'icône dans la zone de notification (éventuellement parmi les icônes masquées), puis cliquez dessus. Avec son menu, masquez/rappeler ENTITY, ouvrez les réglages et quittez AETHER. Vérifiez que sa fenêtre reste discrète au-dessus de vos logiciels habituels. Ce parcours couvre le rangement et l'affichage du tray propres à votre configuration Windows ; il n'est pas présenté comme un test visuel automatisé du shell Windows.

Une validation physique avec débranchement d'un second écran, changement de DPI entre écrans, bureau virtuel et application exclusive en plein écran reste à effectuer sur ces configurations. Le repositionnement hors écran et les coordonnées multi-écrans sont testés dans le noyau ; la recette native a utilisé un seul écran à 150 %.

## État de la réception du CDC complet

| Scénario | État à l'issue de J1 |
| --- | --- |
| REC-01 | Présence sans IA validée ; configuration d'un fournisseur reportée à J2 |
| REC-02 | Clic et raccourci réels validés ; dépôt de fichier et voix non implémentés |
| REC-03 | Portail et SPACE non implémentés |
| REC-04 | Dialogue et MEMORY non implémentés |
| REC-05 / REC-06 | ECHO non implémenté, aucune observation active |
| REC-07 / REC-08 / REC-12 | FORGE et MIRROR non implémentés, aucun code généré exécuté |
| REC-09 | Registre de capacités non implémenté |
| REC-10 / REC-11 | CURIOSITY et révocation de permissions actives non implémentées ; permissions sensibles refusées au J1 |

## Limites et prochaine étape

Repos et attention sont les seuls états actifs. Pas de conversation, microphone, caméra, capture d'écran, observation de fichiers, curiosité autonome ou capacité dynamique. Les contrats de ces moteurs sont disponibles dans `packages/shared`, sans implémentation simulée.

Le livrable Windows est un dossier x64 exécutable avec runtime, sans installateur ni signature de distribution. Le profil conserve sa visibilité : un redémarrage après masquage peut laisser uniquement le tray visible. La réduction du mouvement arrête respiration et clignements ; elle conserve un changement d'opacité au clic.

Suite recommandée : J2, fournisseur LLM effectivement configuré et MEMORY SQLite avec provenance et contrôle utilisateur. Aucun code de J2 n'a été commencé.
