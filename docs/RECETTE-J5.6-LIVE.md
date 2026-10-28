# Recette J5.6 — LIVE VOICE / Gemini Live

8 octobre 2026. Version 0.5.6. **Connexion/réponse Gemini réelles validées avec entrée synthétique ; réception humaine et commandes cloud encore ouvertes.** Aucun succès cloud n'est déduit des tests avec doubles. J1–J5.5 restent dans le périmètre de non-régression. FORGE et MIRROR ne sont pas développés.

## Architecture et configuration

Micro → Chromium/WebRTC avec AEC → PCM16 mono 16 kHz → main → SDK Google GenAI 2.28.0 dans un processus dédié → session WSS persistante → audio natif Gemini PCM16/24 kHz → WebAudio, tampon 180 ms. Le port PortAudio demeure pour les fixtures de recette. Function calling → AETHER TOOL BRIDGE → services existants et MIND/MODEL ROUTER DEEP local → résultat borné → Gemini. Aucun STT/TTS intermédiaire dans LIVE ; LOCAL garde Whisper/MIND/Qwen/Windows Speech.

## Correctif des coupures sur haut-parleurs

L'utilisateur confirme entendre Gemini, mais signale des interruptions répétées alors qu'il reste silencieux, avec les haut-parleurs du PC. Le port PortAudio initial n'avait pas d'AEC et chaque dépassement d'énergie pouvait couper immédiatement la sortie. La recapture de la voix est la cause probable ; aucune trace acoustique humaine n'a été retenue pour l'attribuer définitivement.

Correctif : capture et lecture dans une fenêtre audio Chromium dédiée, annulation d'écho requise/vérifiée, réduction du bruit, entrée continue, lecture sur une horloge commune avec 180 ms de tampon. Le seul niveau micro ne coupe plus la réponse ; l'événement d'interruption de parole Gemini reste opérant. La fenêtre audio ne reçoit aucune clé et les fenêtres visibles ne reçoivent aucun PCM ; l'IPC audio privé est réservé à son propriétaire. La caméra reste refusée.

Contrôles : 111 unitaires réussis ; test natif Chromium avec entrée virtuelle, PCM en rafales et une seule séquence de lecture continue ; test **Gemini réel** utilisant une copie chiffrée de la clé et uniquement les métadonnées `os_crypt` nécessaires dans un profil isolé, sans MEMORY personnelle. Réponse audio complète, AEC activée et **zéro interruption parasite**. Premier passage : connexion 798 ms ; fin de parole détectée → premier PCM reçu 1 291 ms. Preuves : `aec-native-evidence.json`, `aec-playback-timing.json`, `aec-gemini-evidence.json`. Entrée synthétique et sortie Windows réelles : cela ne valide pas encore le micro/haut-parleurs physiques de l'utilisateur.

### Signalement du « tuuuuut » pendant la voix

Un nouveau bruit continu est signalé par l'utilisateur. Le processus personnel actif ne possède aucun argument de micro simulé ; aucun oscillateur n'est présent dans le produit. L'origine acoustique exacte n'a pas été enregistrée ni reproduite. Mesure corrective : le contexte de capture 16 kHz est routé vers une sortie silencieuse `sinkId: {type: 'none'}`, vérifiée au démarrage, et un gain de monitoring nul. Seul le contexte de lecture Gemini ouvre la sortie Windows. Le contexte silencieux continue de traiter le microphone, conformément à la [documentation Chromium](https://developer.chrome.com/blog/audiocontext-setsinkid/#render_audio_with_a_muted_audiocontext).

Le parcours natif confirme capture active, sortie de capture silencieuse, tampon continu et caméra refusée. Une nouvelle réponse **Gemini réelle** avec microphone synthétique réussit : connexion 778 ms, premier PCM 724 ms après la fin de parole détectée, aucune interruption. Les tests de tonalité de la file utilisent désormais un volume nul pour ne pas émettre de bips sur le PC pendant les vérifications. Cela ne prouve pas encore la disparition du bruit entendu par l'utilisateur ; un nouvel essai avec ses haut-parleurs reste nécessaire.

Modèle par défaut central : `gemini-3.8-live`, configurable dans LIVE VOICE ; voix configurée Kore, validée réellement à la connexion. Le modèle n'est pas remplacé silencieusement si le compte n'y a pas accès. Identité commune ENTITY_PROFILE.identity, instructions de canal spécifiques, aucune base MEMORY/CURIOSITY au setup. Configuration du SDK : AUDIO, transcription entrée/sortie, VAD avec interruption, compression de contexte, déclarations typées des onze outils. Reconnexion explicite vers une nouvelle session ; pas de reprise silencieuse ni de rejeu de fonctions.

La clé se saisit dans LIVE VOICE/réglages, puis est chiffrée par safeStorage Windows dans `%APPDATA%\AETHER\gemini-key.encrypted`. Développement : GEMINI_API_KEY héritée par le processus. Aucune clé dans Git, SQLite, JSON de réglages, logs ou rendu. Deux consentements séparés : micro local et cloud Gemini. Révoquer coupe les processus/audio avant la persistance du refus ; une nouvelle connexion revérifie le refus.

## Données et permissions

| Fonction | Données envoyées / contrôle |
| --- | --- |
| get_entity_status | État, capacités disponibles, autonomie, statut ECHO/CURIOSITY ; aucun journal brut |
| search_memory | Cinq souvenirs pertinents maximum, 1 400 caractères par contenu, origine/catégorie/confiance ; pas de chemins ni sources complètes |
| remember_explicitly | Proposition seulement ; clic humain requis dans LIVE VOICE, mécanisme MEMORY existant |
| forget_memory | Proposition et contenu à confirmer ; suppression via contrôleur existant et fermeture du contexte Gemini |
| get_curiosity_summary | Huit intérêts actifs, cinq questions, quatre explorations, cinq découvertes ; synthèses et limites |
| get_interest_details | Intérêt identifié, six éléments d'historique, huit objets, quatre explorations ; tailles bornées |
| open_space / close_space | Vrai PORTAL/SPACE ; aucun accès Windows arbitraire |
| start_echo_guided / stop_echo | Panneau de consentement normal / arrêt ; aucune autorisation fournie par Gemini |
| delegate_deep_reasoning | MIND → DEEP explicite Ollama local → résultat, modèle et route réels ; refus si DEEP absent/cloud |

Tous les arguments et noms sont validés. Session/consentement sont revérifiés après appel ; résultats limités à 18 000 caractères. Journal borné en RAM (nom, statut, durée seulement). Annulation et génération empêchent le retour tardif d'un résultat après interruption/révocation. Les transcriptions sont des messages temporaires dans MIND, jamais des souvenirs automatiques.

## Résultats initiaux, avant configuration de la clé

- Typage et compilation réussis. 110 tests TypeScript réussis à ce stade, dont le vrai worker Python/PortAudio LIVE en source test-fixture. Les tests locaux existants conservent cinq tests Python réussis. Les contrôles du correctif AEC sont décrits ci-dessus.
- Session continue, interruption, état DEEP, validation, déduplication, révocation, nettoyage, failover, minimisation et séparation de LIVE/CODE vérifiés avec un provider double dans les tests automatisés.
- Vraie instance Electron : fenêtre dédiée, consentement explicite et persistant, IPC refusé depuis ENTITY pour une décision sensible, choix LOCAL par défaut, absence de capture sans clé, retrait de clé chiffrée, fermeture propre.
- Appel réseau Gemini réel avec un identifiant volontairement invalide dans un profil temporaire : le WebSocket a réellement été ouvert puis refusé, sans capture et sans réponse inventée. Cette preuve vérifie un échec réel ; elle ne valide pas une conversation cloud.
- Pont sur les vrais services AETHER : données SQLite persistantes de recette, résumés CURIOSITY minimisés, intérêt « Causalité structurelle », mémorisation/suppression après confirmation, PORTAL/SPACE natif, consentement ECHO normal. Le provider LIVE de ce test est un double, explicitement indiqué dans la preuve.
- Délégation du pont vers **DEEP / Ollama / qwen3.5:9b**, sans fallback, avec une réponse réelle Qwen. Premier contrôle : environ **13,1 s** jusqu'au résultat ; dernier contrôle ciblé : **10,0 s** (outil : 8,98 s). Cela valide l'exécution locale, pas la justesse scientifique du texte généré ni une latence Gemini.
- VOICE LOCAL a été rejoué avec Whisper, Qwen, Windows TTS et PortAudio réels, entrée synthétique sans micro humain. PRESENCE et SPACE ont passé les parcours Windows natifs après correction du niveau topmost Electron ; le test de réflexion MIND a été désambiguïsé pour distinguer ses statuts des notices VOICE.

Dernier `npm run check` : typage, 109 tests unitaires, compilation et **12 parcours Electron réussis en 5,2 min** ; un parcours Gemini positif explicitement ignoré sans clé. Paquet Windows 0.5.6 construit puis exécuté avec `app.isPackaged=true` : cinq helpers présents et identiques aux fichiers compilés, worker SDK réel ouvrant WSS puis rejetant la clé fictive, LOCAL par défaut et micro arrêté. Souvenirs, intérêts et réglages personnels inchangés pendant le contrôle ; sauvegarde préalable `%APPDATA%\AETHER\backup-before-j56-20261008-104851`. AETHER est ensuite ouvert dans LIVE VOICE pour configuration par l'utilisateur. Aucune latence parole → audio Gemini positive n'est disponible tant qu'une clé valide n'est pas configurée.

Après cette suite globale, correction d'une interruption pendant la lecture des derniers échantillons d'un tour déjà terminé côté serveur : la réponse suivante reste audible même sans événement `interrupted` du serveur. Les transcriptions tardives ne remettent pas le tour terminé en cours. 110 tests unitaires réussis, puis 17 tests LIVE et deux parcours Electron ciblés réussis. Le paquet a été reconstruit, ses main/preload et cinq helpers comparés aux fichiers compilés, exécuté et relancé dans LIVE VOICE. La recette positive élargie aux onze fonctions a été vérifiée par le typage, puis explicitement ignorée faute de clé ; elle n'est pas annoncée réussie.

## Matrice A–L

| Scénario | Résultat et niveau de preuve |
| --- | --- |
| A Connexion/réponse native | Échecs réels validés ; réponse audio Gemini positive validée avec entrée synthétique/Chromium ; prise humaine à confirmer |
| B Conversation continue | Contrat de session persistante validé automatiquement ; cloud réel à exécuter |
| C Interruption orale | File PCM/PortAudio et WebAudio réelles ; annulation d'écho et garde contre les coupures d'énergie testées ; barge-in humain à confirmer |
| D CURIOSITY | Pont réel sur données persistantes validé, compréhension Gemini à exécuter |
| E MEMORY | Recherche réelle et minimisation validées, compréhension Gemini à exécuter |
| F SPACE | Ouverture native par le pont et régression PORTAL validées, commande Gemini à exécuter |
| G ECHO | Consentement normal par le pont et régression ECHO validés, commande Gemini à exécuter |
| H DEEP | MIND/DEEP/Qwen réel par le pont validé ; restitution Gemini à exécuter |
| I Internet indisponible | Nettoyage/lifecycle en erreur automatisés ; échec fournisseur réel validé ; coupure Internet pendant une conversation positive à exécuter |
| J Consentement absent | Aucun socket/capture dans les gardes automatisées ; absence de flux et persistance du refus dans Electron |
| K Données minimales | Projections et pont réel inspectés ; pas de base complète au setup ; capture du contenu fourni à Gemini en recette positive à exécuter |
| L Non-régression | Suite globale : 109 unitaires et 12 parcours Electron ; après correctif : 110 unitaires et deux parcours LIVE ciblés réussis ; cloud ignoré sans clé |

## Exécuter la recette Gemini positive

Configurer la clé dans LIVE VOICE puis enregistrement chiffré, ou fournir GEMINI_API_KEY au terminal de développement. La recette suivante crée un profil temporaire et utilise uniquement des données fictives/de recette et de l'audio Windows TTS synthétique. Gemini et la sortie native sont réels ; aucun microphone humain ne s'ouvre. L'accès au modèle et les coûts/quota suivent le compte configuré.

```powershell
npm run build
npx playwright test tests/e2e/live-real.spec.ts
```

Le test est explicitement ignoré sans clé. Il couvre plusieurs tours sur le même identifiant, les phrases naturelles du brief, l'ouverture SPACE/ECHO, MEMORY/CURIOSITY, DEEP, interruption de l'audio et révocation. Ses preuves sont écrites dans `test-results/live-real` seulement si le parcours réussit. Une présence de clé ne constitue pas une preuve de réussite du modèle.

Recette humaine distincte : ouvrir LIVE VOICE, choisir le micro dans VOICE, lire et autoriser les deux consentements, activer/configurer puis démarrer. Dire « Bonjour Aether », enchaîner plusieurs échanges, interrompre une réponse et vérifier qu'elle s'arrête ; demander les intérêts, la causalité structurelle, un souvenir, l'ouverture de SPACE, ECHO et DEEP. Confirmer/refuser les mutations MEMORY dans le panneau. Couper Internet pendant une session consentie, vérifier que le micro/la sortie s'arrêtent et que LOCAL est proposé. Révoquer le cloud et vérifier que toute nouvelle connexion est refusée. Conserver uniquement les mesures et statuts utiles ; aucun audio retenu par défaut.

`node scripts/live-human.mjs` ouvre le vrai paquet et observe pendant dix minutes les états, outils et métriques, sans transcript, clé, contenu de données ni audio. L'utilisateur démarre/arrête lui-même la capture et donne les consentements dans l'interface. `human-session.json` constitue une trace de fonctionnement, pas une attestation de qualité audio ou de réception humaine.

## Latences et limites

| Mesure | État |
| --- | --- |
| Connexion positive Gemini | Non mesurée, clé valide absente |
| Parole → premier audio Gemini | Non mesurée, aucune réponse positive |
| DEEP local | ~13,1 s au premier contrôle, 10,0 s au passage final ; exécution Qwen réelle, qualité du texte non évaluée |
| Function calls | Mesurés dans tool-evidence.json, sans contenu dans le journal normal |
| Interruption PortAudio | Flux réel testé, vidage de file et arrêt ; pas de mesure acoustique ni de voix humaine |

LIVE utilise désormais l'annulation d'écho Chromium ; son efficacité acoustique dépend du micro, du volume et de la pièce, et reste à confirmer humainement. Le niveau du micro ne déclenche plus une coupure à lui seul. Le micro reste actif pendant toute une session LIVE explicitement ouverte. Une file audio saturée arrête la session avec une erreur au lieu d'accumuler plusieurs secondes de retard. Pas de caméra, vidéo, partage d'écran, mémoire cloud, FORGE ou MIRROR. Reconnexion vers une nouvelle session explicite, sans restauration du contexte précédent.

Preuves conservées sous `docs/recette-live/` : `ui-evidence.json`, `tool-evidence.json`, `package-evidence.json`, `validation-evidence.json`, régression SPACE et captures des réglages. Sources officielles : [Live API](https://ai.google.dev/gemini-api/docs/live-api), [capacités et formats](https://ai.google.dev/gemini-api/docs/live-api/capabilities), [outils Live](https://ai.google.dev/gemini-api/docs/live-api/tools), [SDK](https://googleapis.github.io/js-genai/release_docs/classes/live.Session.html).

Prochain jalon proposé **après validation humaine et Gemini de J5.6 : J6 FORGE + MIRROR**, avec spécification approuvée, fabrication isolée, essai sur copies et adoption humaine distincte. Aucun développement de ce jalon ne commence ici.
