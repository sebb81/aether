# Sécurité — PRESENCE, MIND, MEMORY et CURIOSITY

MIND et MEMORY sont actifs depuis J2. J3 ajoute CURIOSITY locale et MODEL ROUTER. ECHO, FORGE, MIRROR, capacités, portail et voix ne sont pas implémentés. Leurs contrats ne donnent aucun accès système.

## Rendu et IPC

Chromium sandboxé, isolation du contexte, sans Node, navigation/webviews/popups interdits, permissions média et partage d’écran refusés. Le preload expose uniquement des méthodes nommées. Chaque IPC vérifie fenêtre connue, frame principal, URL, type, taille et champs. Configuration IA/router réservée aux réglages, messages au dialogue, mutations/export MEMORY à MEMORY, objets/exclusions CURIOSITY au journal. Une fenêtre étrangère avec le même preload est refusée.

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

| Fonction | J3 |
| --- | --- |
| Microphone / caméra / capture | Refusés |
| ECHO / observation de dossiers | Non implémenté |
| Ollama | Service loopback explicitement choisi |
| OpenAI | Consentement cloud et clé nécessaires |
| Fichiers et applications externes par le modèle | Refusés |
| Stockage AETHER / export volontaire | Commandes dédiées |
| CURIOSITY | Opt-in local, budget, interruption, journal inspectable |
| FORGE / MIRROR / adoption / portail | Non implémentés |

## Autonomie CURIOSITY

Activation explicite et persistante, désactivée initialement. Budget maximal par session, intervalle et temps total de calcul ; échecs/annulations comptent. OFF annule immédiatement et rejette une réponse tardive. Le dialogue humain a priorité. Le modèle n’a ni accès Web, ni commande, ni FORGE, ni accès externe aux fichiers. Les seuls appels sont le provider Ollama loopback choisi, à travers MODEL ROUTER ; une cible OpenAI est refusée pour toute exploration J3, même si le dialogue a un consentement cloud.

Un journal intellectuel durable peut être dérivé du dernier échange ou de souvenirs lorsque l’autonomie est autorisée. Les conversations brutes restent volatiles ; les questions, synthèses et origines issues d’une réflexion sont persistantes. Ce journal est distinct des déclarations de l’utilisateur. Les hypothèses portent une estimation, les découvertes portent une limite explicite de non-vérification. JSON malformé, provenance inconnue et répétition sont refusés, sans fallback de contenu.

Suppression d’un intérêt : invalidation des appels et du contexte, purge des objets liés et descendants de provenance, compaction. Suppression/correction d’un souvenir : purge des pistes qui en dépendent. Le registre de titres oubliés conserve seulement une empreinte, pour bloquer une recréation exacte automatique ; il ne garantit pas de reconnaître toutes les paraphrases. Une exclusion est un filtre d’expression normalisée avant et après l’appel, pas un classificateur sémantique : ajouter les variantes utiles. Sauvegardes/exports existants ne sont pas effacés par la suppression de la base active.

Electron protège le rendu et ne constitue pas un runner de code généré. EVOLUTION devra disposer d’une isolation vérifiée avant les expériences, sans documents personnels ni secrets, avec spécification, tests, inspection et adoption approuvés. Aucun plugin ou programme généré n’est chargé au J3.
