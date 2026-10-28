# Recette J6 — FORGE + MIRROR

15 octobre 2026. Version 0.6.0. **Codex a réellement produit le prototype ; MIRROR et l'essai sur copies réussissent. L'adoption persistante attend la validation humaine distincte. J6 n'est pas déclaré validé.** Le brief J6 considère les jalons précédents validés et autorise ce jalon uniquement. Aucun développement J7, commit ou push.

## Préparation et état initial

CDC intégral, PLAN, ARCHITECTURE, recettes J1 à J5.6 et code existant relus. Le dépôt contenait déjà des modifications locales J5.5/J5.6 : elles sont conservées. Avant J6, `npm run check` a produit 114 unitaires réussis et 12 parcours Electron réussis, avec trois échecs : absence de nouvelle transcription assistant pendant un tour cloud Gemini, clic natif traversant et double clic PORTAL. [État initial](recette-j6/baseline.json). Les deux parcours natifs réussissent ensuite ensemble en 29 s, sans modifier leurs assertions ni les fixtures : [reprise](recette-j6/native-regression.log). La cause des premiers échecs n'est donc pas attribuée à J6.

Codex CLI 0.162.0-alpha.17.2 est installé et authentifié ChatGPT. Le SDK officiel `@openai/codex-sdk` 0.162.1 est verrouillé. Docker est installé, mais son moteur n'est pas lancé. La sonde native `codex -c windows.sandbox=mxc sandbox --include-managed-config --permission-profile :workspace -- cmd.exe /d /c echo MXC_OK` réussit. QuickJS 0.32.0 est utilisé avec son module WASM inclus dans le helper, sans téléchargement au lancement.

## Architecture et formats

`packages/evolution` contient ForgeEngine, Mirror, CapabilityRegistry, EvolutionStore, validation et FileBroker ; aucun import Electron/React. Les types partagés définissent ForgeRequest, ForgeSpecification, ExperimentProposal, CapabilityManifest v1, API v1 et les événements. Le main fournit les adaptateurs Codex/Windows et les contrôles de fenêtres IPC. Le rendu ne reçoit pas d'API de shell, chemin libre ou secret.

ForgeRequest conserve UUID, objectif, description, entrées/sorties, contraintes, droits, dépendances, critères et tests, origine USER/ECHO/CURIOSITY/MIND, dates, approbation et tentatives. MIND prépare en local ; une demande vague donne des questions et aucun appel Codex. Une révision retire l'approbation et le manifeste candidat.

CodexProvider utilise le SDK officiel avec la CLI disponible, un répertoire de travail dédié, un environnement filtré, sandbox lecture seule, outils shell/multi-agent et recherche Web désactivés. Seuls la spécification approuvée, le contrat et les éventuels échecs de tests sont fournis au modèle. La sortie structurée contient le JavaScript et des tests, que FORGE écrit dans son workspace. Il n'existe aucune implémentation précodée du classement WAV dans le programme.

L'authentification propre à Codex est copiée temporairement dans un home de fournisseur distinct, sans configuration, instructions, MEMORY ou clés AETHER, puis le fichier d'authentification est retiré en `finally`. Cette copie sert à la connexion du client, pas aux entrées du modèle ni de la capacité. Le répertoire local reste soumis aux droits du compte Windows. Les erreurs brutes du SDK sont masquées dans l'interface afin de ne pas exposer d'en-têtes/chemins d'authentification.

La capacité expose `exports.run(input, api)` synchrone. `input` contient `files:[{path,size,modifiedAt}]` et `parameters:{...}`. `api` v1 est figé et n'expose aucune fonction hôte ; son tableau `permissions:[]` décrit cette absence d'accès direct, pas les permissions du plan contrôlées séparément par le noyau. Sortie exacte : `{summary,renames:[{from,to}],data}`. Les chemins sont relatifs et les sorties bornées. Les permissions système prises en charge sont uniquement `filesystem.read` et `filesystem.write`, exercées par le broker sur un dossier choisi ; les autres sont explicitement refusées. Le contrat Codex explicite maintenant les métadonnées valides des tests et les collisions Windows sans distinction de casse. La réponse brute du modèle est conservée dans `codex-result.json`, même si son format est refusé.

Le manifeste contient identité/version, description, entrées/sorties, permissions, point d'entrée, compatibilité API/runtime/Windows, provenance complète et validation avec SHA-256 et rapport. Le registre conserve état, date d'installation, dernière utilisation, permissions accordées et version précédente. Les étapes sont DRAFT → génération → TESTING → READY → INSTALLED, avec refus, échec et annulation visibles. Les versions antérieures restent disponibles pour désactivation/retour arrière ; la désinstallation retire le registre actif sans effacer les fichiers utilisateur.

## MIRROR et garanties d'isolation

Le helper fiable est un processus distinct, lancé par le sandbox Windows MXC avec environnement filtré. Le code non fiable tourne exclusivement dans QuickJS compilé en WebAssembly : aucune fonction hôte, aucun loader de module, Node, filesystem, réseau, variable d'environnement ou création de processus n'est exposé au langage invité. Limites : 32 Mio pour QuickJS, pile 256 Kio, interruption après 2 s de calcul, timeout externe de 15 s démarrage compris, sortie 512 Ko. Une fabrication complète est bornée à cinq minutes, dix tentatives maximum ; une seule opération est active par moteur.

Les vérifications natives exécutent du vrai JavaScript, tentent `process`, `require`, `fetch` et un accès par constructeur, et interrompent une boucle infinie ainsi qu'une exécution annulée. Ces essais réussissent. Cela ne constitue pas une preuve formelle d'absence de faille dans QuickJS/WASM, MXC, Node ou Windows. Le profil MXC `:workspace` peut laisser des lectures hôte au helper fiable ; c'est l'absence d'API hôte dans le langage invité qui borne les accès du code généré. Aucun sandbox n'est présenté comme hermétique. Sans MXC, le runner échoue sans exécuter directement le code dans Node.

Compilation : QuickJS compile réellement le programme JavaScript avant les essais ; J6 ne nécessite ni transpilation ni dépendance externe pour les capacités. Chaque test invoque la vraie fonction et compare la sortie structurée attendue. Un plan est validé indépendamment par le noyau. Les doubles de provider/runtime sont limités aux tests unitaires de cycles/échecs ; le test natif et la recette réelle doivent rester distincts.

FileBroker choisit un dossier via Windows, refuse racines larges, données AETHER/noyau/système, liens/jonctions, fichiers à liens multiples et collisions. Il inventorie/hache au plus 500 fichiers et 64 Mio, profondeur 10, puis applique le plan sur des copies. Les originaux restent intacts jusqu'à une confirmation distincte. Avant écriture, identité du dossier, fichiers et empreintes sont revérifiées. Les copies sont exclusives, sans écrasement. En cas d'échec, les opérations terminées sont annulées si les sources peuvent être restaurées sans écrasement ; un échec de restauration est signalé explicitement. Des modifications concurrentes hostiles sous le même compte ne sont pas une frontière de sécurité garantie ; le broker rend la main entre deux opérations et vérifie l annulation ; une opération disque atomique en cours ne peut pas être interrompue en son milieu. Le calcul invité reste arrêtable dans son processus.

## Interface et intégrations

FORGE est accessible depuis le menu, les réglages et une vraie zone SPACE. Quatre listes : en cours, prototypes, acquises, échecs/historique. Les événements et tests sont inspectables, sans pourcentage fictif. BUILDING et TESTING proviennent d'opérations réelles et respectent la priorité des conversations. Un contrôle visible arrête les opérations. Les confirmations de fabrication, d'installation et d'écriture sont distinctes.

MIND/VOICE LOCAL peuvent ouvrir une préparation ; Gemini dispose de `prepare_forge_request`, sans outil d'autorisation ou d'installation. Une proposition CURIOSITY est produite par le modèle local depuis un intérêt réel ; elle doit être acceptée avant une ForgeRequest. ECHO exige une opportunité existante et une habitude confirmée répétée ; identifiants, raison et origine restent dans la provenance. Les capacités désactivées/retirées sortent du contexte MIND. L'historique reste dans EVOLUTION ; aucune mémorisation automatique du code ou copie du code dans MEMORY.

## Scénario fondateur — prototype réel, adoption en attente

[Spécification présentée](recette-j6/spec-reference.md), [données exactes](recette-j6/spec-reference.json), [proposition initiale MIND](recette-j6/spec-reference-mind-initial.json) et [revue](recette-j6/spec-review.json). Scénario contrôlé USER, sans prétendre avoir observé une habitude personnelle. MIND a réellement produit un brouillon ; la revue a corrigé des sources absentes de tests et des descriptions de champs incohérentes. La validation a été renforcée pour refuser ces cas.

L'utilisateur a explicitement répondu **« Autoriser la fabrication et les tests »** pour cette spécification dans le profil isolé, sans installation ni modification de fichiers personnels. Les clics du script `scripts/j6-recipe.mjs generate` exécutent cet accord reçu ; ils ne remplacent pas une décision humaine.

Trois appels réels au SDK officiel ont été conservés dans l'historique de la demande `44fa75ee-c15d-4cad-8ecb-870126afe9a0` :

1. Réponse Codex reçue, puis refusée : ses tests additionnels contenaient des dates de modification vides et des chemins interdits par le schéma. Aucun artefact adopté. [Tentative 1](recette-j6/generation-attempt-1.json).
2. Compilation et six critères approuvés + six tests Codex réussis. La revue supplémentaire a révélé une collision Windows avec casse différente : le noyau refusait le plan, sans écrasement, au lieu d'exclure la destination. [Tentative 2](recette-j6/generation-attempt-2.json), [contrôle supplémentaire échoué](recette-j6/windows-collision-attempt-2.json).
3. Codex a régénéré le code après précision du contrat, sans modifier la spécification approuvée. Compilation + six critères approuvés + six tests additionnels réussis, dont les collisions de casse et fichier/dossier. Le contrôle indépendant de casse réussit également. [Tentative 3 et rapport](recette-j6/generation-attempt-3.json), [contrôle indépendant](recette-j6/windows-collision-attempt-3.json).

Le code de la capacité a exclusivement été écrit par Codex. Le développeur a corrigé le contrat et l'orchestration, sans réparer manuellement la fonction produite. Un prototype READY peut être régénéré après une nouvelle confirmation, en conservant sa spécification et les tentatives précédentes.

[Présentation du prototype](recette-j6/prototype-review.md), [code réellement généré](recette-j6/generated-capability.js), [manifeste et tests](recette-j6/generated-manifest.json), [capture MIRROR](recette-j6/mirror-result.png). L'essai utilise les vrais modules ForgeEngine, Windows MXC/QuickJS et FileBroker depuis `scripts/j6-demo.ts`. Des fichiers PCM WAV de recette sont créés dans un dossier distinct `C:\Dev\CRTHON10\aether-j6-controlled-files\<UUID>`, puis traités sur des copies : nom inédit, date différente, destination occupée, TXT et WAV déjà dans un sous-dossier. Les empreintes prouvent que les originaux sont intacts. Aucun enregistrement physique ni passage par le sélecteur natif n'est revendiqué pour ce script. [Preuves des fichiers](recette-j6/prototype-demo.json).

À ce stade : READY, zéro capacité installée dans le profil isolé et le profil personnel. Une seconde validation est nécessaire pour l'adoption, le redémarrage et la réutilisation persistante. Aucun succès de ces étapes n'est déduit des tests unitaires.

## Vérifications

- Typage et compilation réussis à leurs derniers passages.
- 127 tests unitaires réussis : [journal](recette-j6/final-unit.log). Treize tests J6, dont le runner natif, arrêt fichiers, origines ECHO/CURIOSITY et régénération explicite d'un prototype. Cinq tests Python réussis : [journal](recette-j6/python-check.log).
- Deux parcours Electron J6 réussis : IPC/confirmations/SPACE et intention FORGE choisie par le vrai Qwen local, sans génération. Une reprise a révélé une attente manquante dans le script de test lors de l'ouverture des réglages ; il attend maintenant la fenêtre et son contenu, sans modifier les assertions fonctionnelles. [Journal](recette-j6/final-ui.log), [incident du script](recette-j6/ui-window-race.log), [preuve UI](recette-j6/ui-evidence.json), [MIND réel](recette-j6/mind-forge-evidence.json).
- Suite globale : typage/compilation et 124 unitaires à ce passage ; 15 parcours Electron réussis, un échec Gemini cloud par attente de transcription après un tour. Ce parcours échouait déjà avant J6 ; sa cause n est pas attribuée au nouveau module et aucune réussite globale n est revendiquée. [Journal complet](recette-j6/final-check.log). Les deux unitaires ajoutés ensuite et le broker final ont été rejoués séparément, puis dans la suite à 126.
- Paquet Windows 0.6.0 construit et réellement exécuté : helper hors ASAR, empreintes conformes, vraie exécution QuickJS/MXC depuis AETHER.exe (calcul de contrôle, pas capacité de référence), absence de process/fetch dans le langage invité, zéro génération/installation. Profil personnel : un intérêt conservé, aucun souvenir ajouté, réglages/autonomie inchangés. [Preuve du paquet](recette-j6/package-evidence.json), [compilation](recette-j6/package-build.log).
- Sauvegarde personnelle : `%APPDATA%\AETHER\backup-before-j6-20261015-125039` (nom horodaté UTC). Ancien exécutable conservé sous `release/AETHER-win32-x64-before-j6`.
- Génération Codex et démonstration sur copies réalisées ; adoption, arrêt/redémarrage de la capacité installée et usage acquis sur nouveau dossier encore à effectuer. Aucun succès déduit des tests avec doubles.

## Limites et suite

J6 fournit des calculs JSON et plans de fichiers JavaScript synchrones, pas un environnement général de scripts Windows, d'applications natives ou de dépendances arbitraires. Pas de marketplace, téléchargement de capacités tierces, fabrication nocturne autonome, modification du noyau ou propagation à d'autres machines. Les copies d'essai, journaux et artefacts sont locaux, non chiffrés, et conservés dans EVOLUTION. Les sauvegardes existantes restent séparées des suppressions actives.

Après réception J6 seulement : proposer J7 pour consolider le registre/runtime et la recette FIRST LIFE globale. Aucun travail J7 commencé.

Sources primaires : [SDK Codex officiel](https://learn.chatgpt.com/docs/codex-sdk), [sandbox Windows MXC](https://learn.chatgpt.com/docs/windows/windows-sandbox), [QuickJS/WebAssembly](https://github.com/justjake/quickjs-emscripten).

## Matrice de réception A-L

| Test | Etat actuel |
|---|---|
| A Refus | Unitaires et IPC : pas de génération sans confirmation |
| B Echec Codex | Provider double unitaire ; réponse réelle malformée refusée à la tentative 1 ; aucune installation |
| C Compilation | Refus réel de JavaScript invalide dans QuickJS/MXC |
| D Echec fonctionnel | Comparaison/installation refusée testées unitairement ; revue réelle tentative 2 refusée par le noyau ; correction Codex vérifiée à la tentative 3 |
| E Permissions | Refus de droits non supportés, plans non autorisés et accès hôte invités vérifiés |
| F Persistance | Registre/artefacts relus en unitaires ; capacité Codex réelle après redémarrage en attente |
| G Désactivation | Registre actif et exécution refusée testés |
| H Désinstallation | Retrait actif sans effacement des artefacts/données testé |
| I Provenance | Vrai prototype présenté avec USER, UUID, tentative, fournisseur, manifeste, SHA-256 et tests ; date d'acquisition encore absente |
| J CURIOSITY | Proposition acceptée vers DRAFT testée avec modèle double ; jamais de démarrage autonome |
| K Sécurité | Tests natifs MXC/QuickJS et broker, timeout/arrêt et empreintes réussis |
| L Non-régression | Unitaires/Python/J6/natif/LOCAL réussis ; un parcours Gemini cloud reste en échec |

## Contrôle après le plantage du PC

Le 15 octobre 2026, le code et les artefacts J6 sont retrouvés. Le prototype READY est relu, son empreinte est conforme, les 13 contrôles MIRROR et l'essai sur de nouvelles copies réussissent à nouveau. Les 127 unitaires, cinq Python et deux parcours Electron J6 passent. Le paquet Windows 0.6.0 est réellement relancé et vérifié, données/réglages existants préservés. La suite Electron globale obtient 15 réussites sur 17 : échec ECHO sur la formulation du modèle, puis sur une référence d'observation invalide lors du rejeu isolé ; attente de transcription Gemini également en échec. Aucun de ces échecs n'est attribué au plantage ou à J6 sans preuve. L'adoption demeure non autorisée et non réalisée. Le bilan détaillé figure dans [Vérification après plantage](recette-j6/post-crash/verification.md).
