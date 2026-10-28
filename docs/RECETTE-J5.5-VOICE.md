# Recette J5.5 — VOICE

Version 0.5.5, Windows 11 x64, 5 octobre 2026. Ollama local FAST/DEEP `qwen3.5:9b`, faster-whisper medium CPU int8, Windows Speech/Hortense, PortAudio/sounddevice. Aucun appel audio cloud, aucun téléchargement de modèle. Les composants préexistaient sur ce poste.

La recette distingue les échantillons connus synthétisés par Windows de la parole humaine au microphone. Un STT/TTS réel ne suffit pas à prouver la capture de la voix de l’utilisateur. **La recette humaine est encore à réaliser avec l’utilisateur ; A et le mot exact « wombat » dans B ne sont pas déclarés validés au micro.**

## Implémentation et commandes

Bouton « Parler au micro » dans le dialogue et SPACE, clic droit ENTITY/tray, raccourci configurable Ctrl + Alt + V. Le premier usage ouvre VOICE ; autoriser ne capture rien. Choisir le micro puis déclencher une prise. Seconde pression termine la prise ; silence de 1,4 s après parole, 8 s sans parole et maximum de 60 s. Pendant la synthèse/lecture, raccourci, stop et clic sur ENTITY interrompent. Wake word et barge-in vocal : ports futurs, OFF, aucune écoute de fond.

Une seule fonction de soumission, un seul MindEngine, même FAST et mêmes règles MEMORY. MIND détermine les ouvertures SPACE/CURIOSITY/ECHO dans un JSON fermé et validé. ECHO ne commence pas à observer quand son panneau s’ouvre. Ses permissions restent distinctes. La réponse complète est affichée ; sa version orale est courte et bornée. Fournisseur TTS absent : le texte réel reste accessible, sans audio fabriqué.

Le panneau expose voix installées, vitesse, volume, politique toujours/voix seulement/jamais, STT/TTS, chemins locaux Python/modèle, langue et diagnostic. Fournisseurs cloud non sélectionnables. Microphone réellement actif signalé par halo et « ● MICRO », jamais à cause du focus d’un champ texte. Amplitude réelle des buffers natifs, événements tardifs invalidés après arrêt.

## Composants et formats

- STT : faster-whisper 1.2.1/CTranslate2 4.6.1, medium en cache local, CPU int8, huit threads, beam 5, Silero VAD. La dictée Windows installée a été testée puis écartée : erreurs sur la question d’identité et le souvenir wombat. Whisper reconnaît mieux ces demandes courantes, au prix du chargement initial et de la mémoire du modèle.
- TTS : System.Speech et Microsoft Hortense Desktop fr-FR, également Zira/David en-US sur ce poste. Synthèse locale en MemoryStream ; aucun WAV temporaire pour la sortie. Voix intelligible et stable, rendu moins naturel qu’un moteur neuronal récent.
- Entrée : mono float32 à la fréquence native, rééchantillonnage SciPy en WAV PCM16 mono 16 kHz en RAM. Sortie : WAV PCM16 Windows, rééchantillonné à la fréquence de sortie par défaut, volume appliqué au PCM, lecture native PortAudio. NDJSON/base64 par canaux hérités, pas de socket audio.
- Python local : `C:\ProgramData\anaconda3\python.exe`. Choix de Python et du dossier modèle possible dans VOICE. Dépendances audio/modèle requises sur chaque poste, non incluses dans le paquet Electron. Modèle local complet requis avant capture ; aucune récupération automatique réseau.

Changer de voix : sélectionner une voix Windows installée, enregistrer, « Écouter cette voix ». Changer de modèle : choisir un autre dossier faster-whisper complet, conserver sa langue, enregistrer puis vérifier. Les interfaces de providers permettent d’ajouter un autre moteur sans modifier MIND/PRESENCE ; le panneau n’annonce actuellement que les deux adaptateurs effectivement implémentés. Pour un futur provider cloud, ajouter son consentement, sa configuration et son label avant de permettre une requête.

## Vérifications automatiques et scénarios

86 tests unitaires réussis : états/providers/permissions, silence et texte vide, erreurs micro/STT/MIND/TTS, annulation, événements tardifs, routage commun, politiques, JSON/capacités fermées, réglages persistants, absence d’audio par défaut et expiration/suppression opt-in.

Le parcours Electron VOICE emploie seulement une capture de fixture dans son profil isolé non empaqueté. Les fichiers contrôlés sont synthétisés par le vrai TTS Windows puis transcrits par le vrai Whisper ; le vrai Ollama traite les transcriptions et le vrai TTS/PortAudio lit les réponses. La production empaquetée ignore les fixtures. Preuve : [chaîne locale](recette-voice/electron.json), captures du panneau et du dialogue dans ce dossier.

| Scénario | Preuve automatique | Validation humaine |
|---|---|---|
| A PTT identité | Raccourci natif, transcription « Comment t’appelles-tu ? », vraie réponse ENTITY, vrai premier son | À faire : capture de la voix humaine et indicateur natif actif |
| B MEMORY/redémarrage | Souvenir explicite issu de STT, même UUID retrouvé après fermeture complète | À faire pour « wombat » exactement : Hortense → Whisper produit « bomba » |
| C clavier/voix/clavier | Modalités successives dans la même conversation MIND, sans nouveau cerveau | Parcours commun vérifié |
| D SPACE | MIND choisit `portal.open`, vraie fenêtre SPACE et conversation conservée | Prononciation humaine à faire |
| E ECHO | MIND choisit `echo.prepare`, panneau réel, ECHO OFF sans session active | Prononciation humaine à faire |
| F interruption | Vraie lecture native, stop observé en 15 ms au contrôleur, état idle et niveau nul | Clic/raccourci utilisateur à essayer |
| G refus | Consentement refusé, aucun appel capture ; grant IPC refusé hors panneau | Micro Windows refusé/occupé testé par erreurs de providers, sans imposer un refus OS au poste |
| H TTS absent | Fournisseur désactivé, réponse réelle MIND conservée en texte, erreur explicite | Composant Windows présent, retrait simulé par configuration |
| I confidentialité | Aucun fichier WAV/MP3/WebM/OGG/FLAC dans le profil après plusieurs échanges ; rétention OFF | Vérification finale du profil personnel à faire après prises humaines |
| J non-régression | 86 tests unitaires et huit parcours Electron validés à leurs derniers passages | J1–J5 conservés ; incidents et reprises détaillés ci-dessous |

## Mesures constatées

Mesures de la dernière chaîne Electron, échantillons synthétiques ; elles ne représentent pas une durée de parole humaine ni une mesure acoustique. `firstSoundMs` part du déclenchement, capture comprise ; délai après fin de prise = premier son − capture. Le début du son est donné par l’horloge DAC PortAudio et le premier PCM non silencieux.

| Demande | Capture | STT | MIND | TTS | Démarrage sortie | Premier son depuis activation |
|---|---:|---:|---:|---:|---:|---:|
| Identité, worker initial | 403 ms | 9 699 ms | 1 245 ms | 475 ms | 338 ms | 12 163 ms |
| Rappel après redémarrage | 407 ms | 9 716 ms | 824 ms | 496 ms | 380 ms | 11 825 ms |
| Ouvrir SPACE, modèle chargé | 409 ms | 3 542 ms | 1 186 ms | 544 ms | 322 ms | 6 004 ms |

Le tout premier essai autonome du fournisseur avait pris 36 156 ms en STT (chargements Python/modèle/bibliothèques), puis 2 547–2 862 ms avec beam 3. La configuration finale beam 5 privilégie la transcription et les essais complets mesurés ci-dessus utilisent ce réglage. Annuler tue le worker ; le prochain échange recharge son modèle. Aucun objectif artificiel de latence atteint annoncé.

## Confidentialité et limitations

Audio en RAM, sans persistance par défaut. Seule la transcription rejoint l’échange temporaire ; les demandes « Retiens que » rejoignent MEMORY comme au clavier. MIND/OpenAI, s’il est configuré avec son consentement, traite le texte de la transcription comme n’importe quel message écrit ; STT/TTS restent locaux. Diagnostic audio optionnel et séparé : cinq prises WAV maximum, expiration dix minutes contrôlée chaque minute et à la consultation, suppression manuelle ou à la désactivation. Pas de sortie TTS conservée.

Limites connues : mot rare « wombat » mal reconnu sur la prononciation synthétique d’Hortense, nom AETHER imparfait dans l’essai initial (noms AETHER/ENTITY donnés ensuite comme contexte, sans insérer les réponses de recette), micro très faible/bruit continu susceptibles de perturber les seuils d’énergie, latence de chargement initial, vitesse Windows quantifiée, sortie audio suivant le périphérique Windows par défaut. Vérifier la transcription avant de s’appuyer sur un souvenir ; correction possible dans MEMORY. Français principal vérifié, autres langues exposées mais non validées par une recette humaine.

## Paquet et recette supervisée

Paquet construit et réellement vérifié : `release/AETHER-win32-x64/AETHER.exe`, version 0.5.5, lancement/visibilité, isolation du rendu, réponse Qwen réelle, transitions SPACE, perception ECHO avec son helper empaqueté, inventaire VOICE, lecture TTS native puis stop. Preuve dans [paquet-verifie.json](recette-voice/paquet-verifie.json). Microphone arrêté au démarrage, consentement encore à demander, aucune capture effectuée pendant ce contrôle. Un intérêt conservé, aucun souvenir ajouté par les contrôles automatiques ; autonomie utilisateur maintenue (15 → 16 tentatives selon son réglage existant). Sauvegarde personnelle préalable : `%APPDATA%\AETHER\backup-before-voice-20261005-161153`.

Incidents et reprises : le premier passage complet a exposé une fermeture pendant le chargement d’une fenêtre : son annulation affichait une erreur de démarrage modale qui bloquait la sortie. Le main ignore désormais ce chargement annulé pendant une sortie normale ; tests développement/PRESENCE/SPACE repassés. Un pilotage Explorer a perdu le renommage du second fichier : le helper de recette vérifie le focus et le résultat réel, avec pauses entre actions. Un autre passage ECHO a produit deux signatures de procédure différentes à cause des noms transitoires observés ; les actions restent espacées pour laisser la perception réellement les enregistrer. Une interprétation modèle ECHO a ensuite été refusée par la validation ; aucune hypothèse de remplacement n’a été inventée. Le dernier parcours ECHO A–I a réussi en 1,5 min sans utiliser le retry autorisé au lanceur. Sept autres parcours sont passés ensemble, dont VOICE en 1,6 min. Ces reprises sont conservées dans les traces `test-results/` ; les nouvelles preuves J4/ECHO sont copiées dans [non-regression](recette-voice/non-regression/echo.json) sans remplacer les artefacts historiques J4.

`node scripts/voice-human.mjs` lance le vrai paquet sur le profil personnel et recueille uniquement les transitions/transcriptions de recette, sans autoriser ni ouvrir le microphone. L’utilisateur choisit/autorise et déclenche chaque prise. Le superviseur peut demander `restart`, `snapshot`, `quit` sur stdin ; la preuve sera [human.json](recette-voice/human.json). Tant que cette preuve ne montre pas de capture microphone réelle, les scénarios humains restent ouverts.

## Correctif audio — 6 octobre 2026

Lancement utilisateur par double-clic : « Le fournisseur audio s’est arrêté ». Reproduction avec le PATH enregistré de Windows : `python` désigne l’alias Microsoft Store et termine avec le code 9009. Anaconda n’est pas présent dans ce PATH ; les recettes précédentes héritaient du terminal Anaconda activé. Le même worker lancé par `C:\ProgramData\anaconda3\python.exe` fonctionne avec le PATH Windows standard.

VOICE résout maintenant les noms Python génériques vers un exécutable installé, ignore les alias WindowsApps et persiste ce chemin absolu dans les réglages existants. Les chemins choisis explicitement restent inchangés. La migration conserve toutes les autres options et le consentement ; une erreur d’écriture ne requalifie pas un réglage valide en fichier corrompu. Une sortie de worker indique son code, avec une explication particulière de l’alias sans Python installé.

Validation : compilation et typage réussis, 88 tests unitaires dont deux régressions de lancement/persistance ; les 19 tests VOICE repassés après le contrôle de préservation en cas d’erreur d’écriture. Un parcours Electron avec PATH Windows standard, sans activation Conda : migration du chemin, inventaire STT/TTS/micro, lecture native réelle et retour idle réussis, aucun micro ouvert ni fichier audio. Whisper du helper empaqueté transcrit « Comment t’appelles-tu ? » depuis une synthèse Windows conservée en RAM, en 30 120 ms à froid. Preuves : [lancement Windows](recette-voice/correctif-runtime.json), [Whisper sans activation Conda](recette-voice/correctif-whisper.json), [contrôle du paquet](recette-voice/correctif-paquet.json).

Paquet corrigé : `release/AETHER-win32-x64-voice-corrige/AETHER.exe`, version 0.5.5. Il doit être lancé après avoir quitté l’instance actuellement ouverte. Le contrôle de fenêtres Windows était indisponible dans cette session (« native pipe unavailable ») ; l’application utilisateur n’a pas été fermée de force. La recette humaine reste à faire après redémarrage.

## Correctif microphone — 6 octobre 2026

Retour utilisateur : après parole, VOICE revient « Microphone arrêté », sans transcription ni erreur visible. Le code rejetait les prises sous un seuil RMS de 0,009 avant d’appeler Whisper ; sa calibration initiale pouvait aussi apprendre le début de la voix comme du bruit. Le prétraitement STT rejetait les pics sous 0,002. Les notices de silence/transcription vide étaient présentes dans l’état mais absentes du rendu. Ces défauts ont été vérifiés dans le code ; la cause précise de la prise physique de l’utilisateur reste à confirmer avec la jauge.

La capture distingue désormais l’arrêt sur silence de l’admissibilité de l’extrait au STT : un signal PCM faible peut atteindre Whisper/Silero, un zéro numérique ou une composante continue pure restent écartés. Un gain borné à 20, limité par le pic, relève les prises faibles en RAM. L’entrée conserve le canal réel le plus actif pour éviter un premier canal silencieux ou une annulation par moyenne. Le périphérique Windows par défaut utilise désormais l’entrée WASAPI annoncée dans la liste ; le pilote choisit la taille de buffer et une latence de capture moins fragile. Les indications d’amplitude sont limitées à environ 12 mises à jour par seconde.

Le dialogue, SPACE et VOICE affichent les notices et une jauge pendant le microphone réellement actif. Une prise sans signal propose de vérifier le périphérique et le volume d’entrée ; une transcription vide le signale ; le chargement initial indique qu’il peut durer plusieurs dizaines de secondes. Rien n’est soumis à MIND si la transcription reste vide.

Validation : typage/compilation et 88 tests TypeScript réussis ; cinq tests Python (capture faible sur canal secondaire avec fermeture avant STT, signal faible, silence/composante continue, canal silencieux/phases inversées et endpoint Windows cohérent). Les paramètres des deux entrées WASAPI Intel/Poly ont été vérifiés sans ouverture de micro. Le parcours Electron d’un échantillon Windows atténué à un pic de 32/32768, inférieur à l’ancien seuil STT, a transcrit « Comment t’appelles-tu ? », obtenu une réponse réelle Qwen et lu cette réponse ; la prise nulle suivante a affiché sa notice, sans message MIND. STT froid : 56 021 ms dans ce parcours. Preuves : [voix faible](recette-voice/correctif-micro-faible.json), [notice visible](recette-voice/silence-visible.png), [paquets](recette-voice/correctif-micro-paquet.json). Le premier contrôle de lecture isolée avait été interrompu avant l’état speaking sans erreur ; sa reprise ciblée a réussi en 8,8 secondes. Aucun nouveau comportement de remplacement n’a été ajouté pour masquer cet incident.

Les deux chemins `release/AETHER-win32-x64/AETHER.exe` et `release/AETHER-win32-x64-voice-corrige/AETHER.exe` contiennent le même correctif. La version principale est ouverte sur le profil personnel, VOICE prêt et micro arrêté, pour la prise physique demandée à l’utilisateur. La sauvegarde préalable des réglages est `%APPDATA%\AETHER\backup-before-micro-fix-20261006-124542`. Le casque Poly V4320 et le micro intégré Intel sont présents ; Windows choisit actuellement Intel. La preuve physique éventuelle est [micro-human.json](recette-voice/micro-human.json) ; tant qu’elle n’a pas de prise microphone réelle, la validation humaine reste ouverte. Le superviseur ne déclenche pas de prise, ne conserve pas d’audio et cesse d’observer les transcriptions après dix minutes.

API des endpoints et formats supportés : [documentation officielle sounddevice](https://python-sounddevice.readthedocs.io/en/latest/api/checking-hardware.html). VAD du fournisseur local : [faster-whisper](https://github.com/SYSTRAN/faster-whisper).

Prochain jalon proposé après validation VOICE : J6 FORGE + MIRROR, spécification approuvée, fabrication et essai isolés, puis adoption distincte. Aucun travail J6 commencé.
