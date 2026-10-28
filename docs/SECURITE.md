# Sécurité — AETHER J6

## LIVE VOICE

Gemini est un canal cloud opt-in, distinct de VOICE LOCAL et de son consentement microphone. Aucun socket ni capture LIVE sans activation, clé, consentement Gemini et consentement micro. Accorder un consentement ou choisir LIVE par défaut n'ouvre pas une session. Une révocation arrête immédiatement le SDK et l'audio, puis persiste le refus. Chaque nouvelle ouverture revérifie les permissions. Fermer LIVE, masquer ENTITY, crash de rendu ou quitter coupe les flux ; fermer le dialogue pour ouvrir SPACE conserve la session explicitement active dans son panneau LIVE.

Le SDK Google n'accède pas aux bases AETHER. Le pont expose douze fonctions déclarées depuis J6, valide arguments/types/tailles, borne les projections et n'accorde aucune permission. MEMORY/CURIOSITY ne sont pas copiées au setup. Les écritures MEMORY proposées par Gemini restent en attente (120 s, cinq propositions maximum), et nécessitent un clic humain dans LIVE VOICE/réglages. Les confirmations tardives ou hors session sont refusées. La suppression efface les dépendances existantes et ferme la session cloud. ECHO requiert son dossier et son consentement habituels, jamais un argument « consent » fourni par Gemini. DEEP reste local et ne remplace pas le provider par un cloud.

Clé Gemini : chiffrement safeStorage Windows hors Git ; variable GEMINI_API_KEY en développement. Même coffre générique que MIND avec un nom de variable distinct. Aucune clé en paramètres de lancement, JSON de réglages, SQLite, logs ou réponses IPC. Le processus SDK reçoit la clé uniquement dans son canal hérité privé ; son environnement ne reçoit pas les autres clés. Messages SDK/URL/erreurs brutes sont masqués. Réponses audio et journaux complets ne sont pas stockés sur disque. Le journal de fonctions garde seulement nom/statut/durée, en RAM et avec une limite de 100 lignes.

Les fenêtres visibles gardent les permissions média refusées. L'unique fenêtre audio LIVE privée utilise sa propre partition : seule une demande audio depuis sa frame principale, son URL locale attendue et une session encore consentie est autorisée. Vidéo/caméra et partage d'écran restent refusés, y compris dans cette fenêtre. Son preload expose seulement le PCM et les commandes audio privées ; aucun Node, SDK ou secret. La fermeture/révocation détruit ce rendu et ses tracks. Python LOCAL ne reçoit aucun secret et ne possède aucun code réseau. Les processus enfants gardent les droits Windows de l'utilisateur : cette séparation n'est pas un sandbox OS. Les interruptions annulent DEEP et les réponses tardives, sans rejouer les mutations.

Les fixtures audio LIVE existent uniquement avec AETHER_TEST_PROFILE dans un exécutable non empaqueté. Leur source apparaît comme test-fixture et n'est jamais présentée comme un microphone humain. Les tests utilisent des données fictives et leur propre profil, supprimé après la recette.

MIND et MEMORY sont actifs depuis J2. J3 ajoute CURIOSITY locale et MODEL ROUTER, J4 PORTAL et SPACE, J5 ECHO limité à une session consentie dans un dossier Explorer. J5.5 ajoute VOICE, microphone explicite et STT/TTS locaux. FORGE/MIRROR et le registre sont ajoutés au J6 avec des confirmations distinctes et un contrat borné, sans droit ambiant supplémentaire.

## Rendu et IPC

Chromium sandboxé, isolation du contexte, sans Node, navigation/webviews/popups interdits. Les fenêtres visibles refusent média et partage d'écran ; l'exception audio LIVE privée est décrite ci-dessus. Le preload expose uniquement des méthodes nommées. Chaque IPC vérifie fenêtre connue, frame principal, URL, type, taille et champs. Configuration IA/router/PORTAL réservée aux réglages, messages au dialogue, mutations/export MEMORY à MEMORY ou SPACE, objets/exclusions CURIOSITY au journal. Vue SPACE et fin de transition PORTAL réservées à SPACE. Une fenêtre étrangère avec le même preload est refusée.

HTTP/HTTPS/WebSocket bloqués depuis le rendu en production ; seule l’origine Vite exacte est autorisée en développement. CSP sans scripts/styles inline en production. Les fournisseurs utilisent Node dans le main : les adaptateurs gardent leurs vérifications propres.

Le raccourci global ne collecte pas les frappes. Seule la position instantanée du curseur est consultée tant qu’ENTITY est visible. Aucun historique du bureau, aucune lecture des applications voisines.

## Fournisseur et secrets

Sur un nouveau profil, MIND est désactivé. Ce poste est configuré sur Ollama local à la demande de l’utilisateur. L’adaptateur accepte seulement HTTP loopback sans identifiant, chemin ou redirection. Il ne télécharge aucun modèle. Le service Ollama reste administré séparément sur le poste.

OpenAI exige fournisseur/modèle choisis, clé disponible et consentement explicite à l’envoi des messages et souvenirs pertinents. Sans consentement, aucun appel. `store:false` ne promet pas l’absence de toute rétention côté fournisseur. Aucun basculement automatique local/cloud.

La clé saisie existe temporairement dans le champ mot de passe, vidé à l’enregistrement, puis passe par une IPC dédiée au main. La clé persistante est chiffrée par `safeStorage` Windows (DPAPI), jamais dans le JSON, le dépôt, les manifests, les réponses ou les traces applicatives. Le rendu reçoit seulement un booléen. Aucun fallback en clair si le coffre est indisponible. Une variable `OPENAI_API_KEY` préexistante peut être lue dans le main, sans être recopiée dans les paramètres publics.

Le coffre protège le fichier au repos selon les garanties Windows ; il ne protège pas contre une application malveillante sous le même compte. Souvenirs, journal CURIOSITY et exports sont locaux mais **non chiffrés** ; leur accès dépend des droits du profil. Le chiffrement de clé n’est pas un chiffrement de MEMORY.

Les erreurs IA sont assainies, sans réponse brute, requête ou clé dans les messages/logs. Aucun texte assistant inventé lors d’erreur, réponse vide, délai ou configuration manquante.

## Mémoire et contexte

Conversations en RAM seulement, limitées à 12 messages, sans table ni journal durable. Les captures/traces de tests peuvent contenir les seuls exemples de recette ; elles sont exclues de Git et ne sont pas activées pour l’utilisateur.

Souvenirs sur demande directe ou ajout volontaire, sans extraction automatique de toute conversation. Provenance calculée par le noyau, déclarations distinguées des hypothèses, confiance obligatoire pour celles-ci. Le modèle ne peut pas appeler une commande de sauvegarde ou s’octroyer des droits. Un souvenir ne devient jamais une instruction système.

Correction/suppression annulent les générations et effacent le contexte ; les réponses tardives sont rejetées. Suppression SQLite/FTS en transaction, `secure_delete`, optimisation, compaction. Le souvenir quitte la base active ; les anciennes sauvegardes/exports détenus par l’utilisateur restent des copies distinctes. Réinitialiser les préférences ne supprime pas MEMORY.

Export JSON via dialogue de sauvegarde Windows choisi par l’utilisateur. Il contient les souvenirs personnels. Aucun accès général aux documents du poste.

## Permissions et suite

| Fonction | J5 |
| --- | --- |
| Microphone | VOICE seulement, prise déclenchée et consentie ; média Chromium refusé |
| Caméra / capture d’écran | Refusées |
| ECHO / observation de dossiers | OFF au lancement, jeton de dossier et consentement distinct par session, Explorer uniquement |
| Ollama | Service loopback explicitement choisi |
| OpenAI | Consentement cloud et clé nécessaires |
| Fichiers et applications externes par le modèle | Refusés |
| Stockage AETHER / export volontaire | Commandes dédiées |
| CURIOSITY | Opt-in local, budget, interruption, journal inspectable |
| PORTAL / SPACE | Navigation interne, projection des données AETHER |
| FORGE / MIRROR / adoption | Spécification approuvée, Codex distinct, QuickJS/MXC, tests et acceptation humaine |

## Frontière de perception ECHO

Un consentement explicite autorise uniquement les métadonnées du dossier choisi, jamais un accès général aux fichiers ni leurs contenus. Un helper caché lit le contexte Win32/Shell pendant la session ; il ne pilote aucune application et n’enregistre aucune saisie. Un watcher fichiers observe seulement le dossier autorisé. Les autres processus, les zones exclues et les contextes ambigus restent fermés à la capture. La liste initiale exclut navigateurs, messagerie et gestionnaires de mots de passe ; les autres applications sont déjà hors de la liste admissible. Le helper s’arrête si son parent disparaît. Aucun microphone, caméra, capture vidéo, capture d’écran ou UAC.

Le dossier est canonique et borné, sans jonctions ni liens. Les exclusions sont appliquées avant lecture de métadonnées et à nouveau avant journalisation, interprétation et confirmation. Les événements n’autorisent aucun acte ; leur auteur reste indéterminé. Les règles de confidentialité ne sont pas une reconnaissance sémantique de tout contenu sensible : le périmètre choisi et les exclusions explicites restent essentiels.

Interprétation locale DEEP uniquement. Les noms de fichiers sont des données non fiables, séparées des instructions, sans outils. Une hypothèse ne devient jamais une mémoire à la seule initiative du modèle. Seules Oui/correction validée écrivent le souvenir sourcé, avec FTS et provenance en transaction. Non conserve une invalidation ; Partiellement attend une précision. La suppression/exclusion coupe les opérations et rejette les réponses tardives. Les sessions affectées et leurs dépendances sont supprimées, avec reconstruction depuis les autres sources valides ; la correction d’une session supprimée ne survit pas indirectement.

SQLite et les événements locaux ne sont pas chiffrés. Les anciennes sauvegardes/exportations restent des copies séparées. Les captures ponctuelles de recette ne sont pas une fonction de perception du programme. Les données ECHO ne servent pas de graines CURIOSITY ; les appels MIND qui référencent des habitudes confirmées sont écartés de ces graines. L’enregistrement `AutomationOpportunity` ne donne aucun droit à FORGE/MIRROR.

## VOICE

Consentement et réglages dans le seul panneau VOICE. La sauvegarde de réglages ne peut pas fabriquer de consentement. Autoriser n’ouvre aucun flux ; bouton/raccourci le déclenche. Refus/désactivation/arrêt/fermeture du contrôle/quitter interrompent les opérations. Pas de wake word ni écoute permanente. Le modèle local est vérifié avant capture. Indicateur natif actif indépendant d’ECHO. Les trames d’amplitude tardives ne peuvent pas réactiver un état.

Python/PortAudio, faster-whisper offline et Windows System.Speech traitent l’audio local en RAM, via canaux hérités sans socket. Aucun audio sur disque par défaut. Option de conservation explicite en mode diagnostic, bornée à cinq WAV, TTL de dix minutes contrôlé chaque minute, effaçable et effacée à la désactivation. Les WAV opt-in héritent des accès du dossier utilisateur et ne sont pas chiffrés. Le worker n’est pas un sandbox OS, il utilise les droits du compte. Un futur provider externe exigera un consentement propre ; aucune configuration cloud STT/TTS n’existe au J5.5.

La transcription suit le MIND déjà configuré : avec Ollama elle reste locale ; avec OpenAI elle suit son consentement cloud existant, comme un message tapé. Les seules actions proposées par MIND sont ouvrir SPACE, CURIOSITY ou le panneau ECHO. Aucune permission ECHO accordée, aucun code/fichier/contrôle Windows arbitraire. La version empaquetée ignore les captures de recette et overrides de profil. Les preuves de recette peuvent conserver les transcriptions demandées ; la conversation normale demeure en RAM.

## Autonomie CURIOSITY conservée

Activation explicite et persistante, désactivée initialement. Budget maximal par session, intervalle et temps total de calcul ; échecs/annulations comptent. OFF annule immédiatement et rejette une réponse tardive. Le dialogue humain a priorité. Le modèle n’a ni accès Web, ni commande, ni FORGE, ni accès externe aux fichiers. Les seuls appels sont le provider Ollama loopback choisi, à travers MODEL ROUTER ; une cible OpenAI est refusée pour toute exploration J3, même si le dialogue a un consentement cloud.

Un journal intellectuel durable peut être dérivé du dernier échange ou de souvenirs lorsque l’autonomie est autorisée. Les conversations brutes restent volatiles ; les questions, synthèses et origines issues d’une réflexion sont persistantes. Ce journal est distinct des déclarations de l’utilisateur. Les hypothèses portent une estimation, les découvertes portent une limite explicite de non-vérification. JSON malformé, provenance inconnue et répétition sont refusés, sans fallback de contenu.

Suppression d’un intérêt : invalidation des appels et du contexte, purge des objets liés et descendants de provenance, compaction. Suppression/correction d’un souvenir : purge des pistes qui en dépendent. Le registre de titres oubliés conserve seulement une empreinte, pour bloquer une recréation exacte automatique ; il ne garantit pas de reconnaître toutes les paraphrases. Une exclusion est un filtre d’expression normalisée avant et après l’appel, pas un classificateur sémantique : ajouter les variantes utiles. Sauvegardes/exports existants ne sont pas effacés par la suppression de la base active.

Electron protège le rendu et ne constitue pas un runner de code généré. EVOLUTION devra disposer d’une isolation vérifiée avant les expériences, sans documents personnels ni secrets, avec spécification, tests, inspection et adoption approuvés. Aucun plugin ou programme généré n’est chargé au J3.

## FORGE / MIRROR J6

La spécification est préparée par MIND local puis doit être approuvée avant Codex. ECHO et CURIOSITY proposent seulement. Le fournisseur Codex utilise son authentification propre dans un home temporaire distinct, pas les clés, bases ou cookies AETHER. Environnement enfant filtré, outils shell/multi-agent et recherche Web désactivés, workspace séparé, sorties structurées, budget et annulation. Aucune capacité n est substituée lors d un échec du fournisseur.

MIRROR exécute uniquement le JavaScript invité dans QuickJS/WebAssembly, sans API hôte ni modules Node. Le helper fiable tourne dans un processus Windows MXC, sans repli non isolé. Mémoire QuickJS 32 Mio, pile 256 Kio, calcul 2 s, processus 15 s, sortie bornée. Les tests natifs refusent des accès fichiers/réseau/environnement et interrompent une boucle. Le helper peut posséder des droits de lecture hôte que le langage invité n expose pas : ce système ne constitue pas une preuve formelle d un sandbox hermétique.

Le noyau valide les plans de fichiers, les permissions et le dossier choisi via Windows. Preview sur copies, empreintes avant application, pas d écrasement, refus des chemins absolus, traversées, liens/jonctions et destinations occupées. Après installation, les écritures exigent encore une confirmation distincte. Un arrêt invalide les aperçus et annule les opérations entre deux étapes ; une opération disque atomique en cours se termine avant prise en compte. Registre/artefacts/copies sont locaux et non chiffrés ; les versions, rapports et empreintes restent inspectables. Une capacité désactivée ou retirée sort du contexte MIND. Aucun code dans MEMORY, aucune suppression automatique des données utilisateur à la désinstallation. Détails et limites : [RECETTE-J6](RECETTE-J6.md).
