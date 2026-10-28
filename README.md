# AETHER

**AETHER 0.6.0 — Jalon 6 : FORGE + MIRROR.** Spécifications à approuver, adaptateur Codex officiel, tests isolés et registre de capacités. La recette fondatrice et les validations humaines sont suivies dans [RECETTE-J6](docs/RECETTE-J6.md) ; une interface ou des tests avec doubles ne valent pas preuve de génération réelle. Les jalons précédents sont considérés validés par le brief J6 ; leurs recettes datées sont conservées.

## Tester AETHER pas à pas

Le [carnet de test utilisateur guidé](docs/CARNET-TEST-UTILISATEUR.md) propose une première séance de 15 à 20 minutes, puis des séances séparées pour la voix, CURIOSITY, ECHO, Gemini LIVE et FORGE/MIRROR. Chaque test indique les actions, le résultat attendu, les points d'arrêt et les observations à noter. Commencez par la préparation puis T01 ; les résultats restent à remplir par l'utilisateur.

## Utiliser FORGE / MIRROR

Ouvrir **FORGE / MIRROR** depuis SPACE, les réglages ou le menu d'ENTITY. Une demande vocale de construction peut ouvrir ce même panneau et y proposer le besoin. Décrire la règle précise, puis **Préparer la spécification avec MIND**. Cette étape utilise DEEP/Ollama local et peut demander des précisions. La spécification reste modifiable ; elle contient les entrées, sorties, droits, contraintes et tests d'acceptation. Les données incohérentes sont refusées.

Après lecture, **Autoriser la fabrication Codex**, puis confirmer. La spécification et le contrat de capacité sont transmis au compte Codex authentifié. La génération produit du vrai JavaScript dans un workspace séparé ; les étapes et les erreurs proviennent des opérations réelles. **Tout arrêter** annule préparation, génération, MIRROR et aperçu. Un échec ne crée aucune capacité acquise ; une nouvelle tentative demande une nouvelle confirmation.

MIRROR compile le JavaScript et exécute les tests approuvés et ceux de Codex dans QuickJS/WebAssembly, sous Windows MXC. Les noms de fichiers et paramètres sont des données JSON, sans API hôte. Dépendances externes, réseau, processus et périphériques sont refusés au J6. Codex CLI doit être installé/authentifié (`codex login`), et MXC disponible ; aucun repli vers une exécution Node non isolée n'existe. Node/Electron est requis pour le helper fiable, pas comme API du code généré.

**Essayer le prototype** utilise un dossier choisi dans Windows, sur des copies : 500 fichiers, 64 Mio et profondeur 10 maximum. Les propositions de déplacement sont contrôlées par le noyau (chemins relatifs, sources présentes, collisions, liens et droits). Pour un calcul sans permission fichiers, les paramètres JSON suffisent. L'aperçu ne modifie pas les originaux.

**Installer cette capacité**, puis confirmer, inscrit l'artefact testé et ses permissions au registre. Après installation, **Essayer / prévisualiser** produit un nouvel aperçu ; un autre bouton confirme ensuite les écritures dans le dossier choisi. Un aperçu expire après deux minutes et devient invalide si le dossier, la capacité ou sa version change. Désactivation, désinstallation et version précédente sont accessibles dans FORGE. La désinstallation conserve les données utilisateur et l'historique.

Les propositions CURIOSITY et opportunités d'une habitude ECHO confirmée répétée sont consultables dans FORGE, avec leur origine. Les accepter prépare seulement une spécification. Aucun de ces moteurs n'autorise Codex, l'installation ou l'écriture à la place de l'utilisateur.

Stockage sous `%APPDATA%\AETHER\evolution` : registre JSON versionné écrit atomiquement, `forge/<UUID>/attempt-N` (spécification, code, tests et rapport), `installed/<id>/<version>` et copies d'aperçu. Le code n'est pas stocké dans MEMORY. Les empreintes sont revérifiées avant installation et exécution. Les limites et les preuves exactes figurent dans la recette et [SECURITE](docs/SECURITE.md).

## Utiliser LIVE VOICE

Ouvrez **Réglages → LIVE VOICE**, ou le menu **LIVE VOICE · Gemini** d'ENTITY. Activez Gemini Live, saisissez la clé (chiffrement Windows) puis enregistrez. En développement, la variable `GEMINI_API_KEY` peut être héritée par AETHER ; aucune clé n'est à placer dans Git ou SQLite. Modèle et voix se configurent dans ce panneau ; le nom de modèle par défaut est centralisé dans `packages/live/src/configuration.ts`.

Lisez et autorisez explicitement le consentement cloud Gemini, puis donnez séparément le consentement microphone dans VOICE. Choisissez le bon périphérique et lancez **Démarrer LIVE**. Ces consentements et réglages n'ouvrent pas automatiquement un micro. Pendant LIVE, le micro reste ouvert jusqu'à l'arrêt, même pendant la réponse audio ; un casque évite que la sortie sonore soit recapturée. **Arrêter LIVE**, fermer son panneau, masquer ENTITY, révoquer le cloud ou le micro et quitter arrêtent les flux. Une erreur propose LOCAL ; aucun changement de canal n'est automatique.

Le choix du mode au raccourci vocal est LOCAL, LIVE ou demander à chaque session. Les boutons LOCAL/LIVE permettent un choix explicite à tout moment. La transcription est consultable dans le dialogue, temporaire et distincte de MEMORY. Les mutations MEMORY demandées par un outil nécessitent une confirmation humaine dans LIVE VOICE ; ECHO ouvre toujours son workflow existant de consentement.

Le diagnostic affiche connexion, réception du premier audio après fin de parole détectée, fonctions, DEEP, interruptions et erreurs de reconnexion. Les chiffres ne sont pas une mesure acoustique d'un haut-parleur. Reconnecter ouvre explicitement une nouvelle session ; le contexte Gemini précédent n'est pas restauré.

Correctif haut-parleurs du 8 octobre : LIVE utilise maintenant l'annulation d'écho Chromium et un tampon de lecture de 180 ms. Le bruit du micro ne coupe plus à lui seul la réponse ; l'interruption de parole reconnue par Gemini reste active. La voix Gemini et une réponse complète ont été testées réellement avec une entrée synthétique et la sortie native. Le résultat avec votre micro/haut-parleurs reste à confirmer.

```powershell
npm run typecheck
npm test
npm run test:e2e
# Avec GEMINI_API_KEY hérité ou la clé chiffrée configurée dans AETHER :
npx playwright test tests/e2e/live-real.spec.ts
```

La recette cloud utilise un profil temporaire avec des données fictives et une entrée Windows TTS synthétique ; Gemini et la sortie PortAudio sont réels. Elle n'ouvre aucun microphone physique. Sans clé, ce test est explicitement ignoré et aucune réussite Gemini n'est déclarée. La recette humaine reste distincte.

## Démarrer sous Windows

Ouvrez `release\AETHER-win32-x64\AETHER.exe`. Le dossier entier contient le programme et son runtime ; copiez-le en entier. Node/npm ne sont pas nécessaires à l’exécution. Paquet Windows x64, sans installateur ni signature de distribution.

Le paquet principal **0.5.6** intègre les correctifs audio du 6 octobre. Pour mettre à jour une instance ancienne, quittez-la par clic droit sur ENTITY → « Quitter AETHER », puis lancez `release\AETHER-win32-x64\AETHER.exe`. VOICE détecte le véritable Python local et enregistre son chemin absolu ; le lancement par double-clic ne dépend plus d’un terminal Anaconda activé. Sur ce poste : `C:\ProgramData\anaconda3\python.exe`. Un chemin Python choisi explicitement reste conservé.

Une jauge montre le niveau réellement reçu pendant la prise ; les prises silencieuses et transcriptions vides affichent leur cause. Les signaux faibles sont transmis à Whisper avec un gain borné. Le premier traitement local peut prendre environ une minute sur ce poste. Dans VOICE, choisissez explicitement « Headset (Poly V4320 Series) » si vous parlez dans ce casque, puis vérifiez la jauge pendant une prise.

Développement : Windows 11 x64, Node 24 recommandé (validé avec 24.18.1), npm. Internet sert à installer les dépendances et Electron ; Ollama utilise ensuite un modèle déjà installé.

```powershell
cd C:\Dev\CRTHON10\aether
npm ci
npm run dev
```

Vite : `http://127.0.0.1:5177`. Après modification du main/preload, quittez puis relancez. Rendu compilé et packaging :

```powershell
npm run build
npm start
# Après avoir quitté AETHER :
npm run package:win
& ".\release\AETHER-win32-x64\AETHER.exe"
```

Les scripts npm retirent `ELECTRON_RUN_AS_NODE` du lancement enfant. Si cette variable existe dans votre terminal, retirez-la avant un lancement direct de l’exécutable Electron.

## Utiliser ENTITY

- Glissez la forme lumineuse ; la position est conservée après redémarrage.
- Cliquez pour ouvrir son petit échange. Entrée/Envoyer envoie ; Maj + Entrée insère une ligne. Échap/× ferme et annule une réponse pendante.
- La réflexion correspond à l’appel réel ; réponse/erreur ont des indications discrètes. « Annuler » interrompt l’attente ; « Nouvel échange » efface la conversation, en gardant MEMORY.
- Essayez « Comment t’appelles-tu ? ». Pour conserver : « Retiens que mon projet de démonstration s’appelle Luciole. » Le reçu de sauvegarde vient de SQLite.
- MEMORY permet de consulter, rechercher, ajouter, corriger, supprimer et exporter. Suppression confirmée ; correction/suppression effacent l’échange et annulent une réponse pendante.
- CURIOSITY s’ouvre depuis le dialogue, le tray ou les réglages : intérêts et historique, questions/hypothèses, découvertes, connexions et tentatives. Activez **Exploration autonome** pour autoriser les réflexions locales ; budget et domaines exclus se règlent dans ce journal.
- Clic droit et icône de notification : masquer, rappeler, replacer, réglages, quitter. Windows peut ranger l’icône derrière la flèche des icônes masquées.
- **Ctrl + Alt + Espace** rappelle sans prendre le focus. Choisissez une autre combinaison dans les réglages puis Enregistrer ; un conflit conserve l’ancienne.
- **Double clic sur ENTITY**, menu « Entrer dans AETHER… » ou **Ctrl + Alt + A** ouvre SPACE. Ce raccourci se règle séparément sous PORTAL. **Échap**, « Revenir au bureau » ou le même raccourci rétracte le portail et retrouve la position d’ENTITY.
- Mouvement réduit et paramètre Windows respectés. Masquer garde le tray actif ; « Quitter AETHER » ferme complètement.

ENTITY : fenêtre nominale 160 × 160 DIP, disque central interactif, marges traversantes. Dialogue séparé 420 × 490 DIP, près d’elle et borné à l’écran. SPACE couvre la zone de travail de l’écran d’ENTITY pendant votre visite, puis sa fenêtre est détruite.

## Explorer SPACE

Glissez le fond pour vous déplacer ; la molette zoome autour du pointeur. Les boutons −/+ et « Revenir au centre » restent accessibles. Les flèches déplacent la vue quand le fond a le focus, Home ou 0 recentre. Tab parcourt les objets et Entrée sélectionne une connexion. Recherche par titre/sujet, Entrée pour rejoindre une piste. Les grandes constellations se parcourent par groupes de 60 pistes.

MEMORY affiche vos souvenirs actuels et réutilise leur éditeur pour ajouter, corriger, supprimer et exporter. Les pistes CURIOSITY donnent accès à leur origine, priorité, historique, questions, résultats et explorations ; une liaison explique la relation conservée et son exploration source. Le noyau ENTITY ouvre le dialogue. ACTIVITY distingue les événements depuis l’entrée précédente, issus des dates enregistrées, et les échanges volatils de la session. CAPABILITIES présente les fonctions disponibles et celles encore futures.

Caméra, zoom, libellés, profondeur, sélection et dernière visite sont conservés. « Affichage » réduit la profondeur ou masque les libellés. Les animations réduites remplacent le trajet par un court fondu. Aucune piste de démonstration n’est ajoutée au profil personnel.

## Montrer une méthode à ECHO

Dans le dialogue, écrivez **« Regarde comment je fais. »**, ou ouvrez ECHO depuis le menu d’ENTITY, le tray, les réglages ou SPACE. Cette phrase ouvre le panneau de consentement et n’enregistre rien à elle seule.

1. Préparez une session, choisissez un **petit dossier de test local** et cochez l’autorisation pour cette session.
2. Démarrez, puis placez Explorer au premier plan dans ce dossier. Renommez et déplacez des fichiers, créez des sous-dossiers. Le halo doré et « ECHO » sur ENTITY indiquent la session active. Le panneau précise si le contexte permet la capture.
3. « Arrêter et comprendre » coupe immédiatement la perception puis demande une interprétation au modèle DEEP local. Pause interrompt la capture ; les opérations en pause sont ignorées. Fermer le panneau ou désactiver ECHO termine aussi la perception.
4. Examinez les événements cités et répondez Oui, Non, Partiellement ou Corriger. **Seule une confirmation ou une correction validée crée une habitude dans MEMORY.** Une hypothèse refusée reste invalidée. Partiellement demande une précision et ne crée pas de souvenir.
5. Une procédure proche dans le même dossier rejoint l’habitude existante avec une nouvelle occurrence et d’éventuelles variations à valider. Le modèle propose une intention ; il ne peut pas la connaître avec certitude.

ECHO conserve des changements de noms/chemins relatifs, types, tailles et dates, ainsi que le titre et le dossier d’une fenêtre Explorer autorisée. Il ne lit pas le contenu des fichiers et ne capture ni clics, sélection, clavier, écran, vidéo ou audio. Les notifications de fichiers ne prouvent pas leur auteur. Un contexte inconnu, exclu ou ambigu suspend la capture ; utilisez une fenêtre/un onglet Explorer clairement identifiable. Les événements très rapprochés peuvent être regroupés.

Les exclusions se règlent dans le panneau : dossiers, processus, mots dans les titres. Les navigateurs et gestionnaires de mots de passe sont exclus initialement ; les autres applications restent hors périmètre. Ajouter une exclusion arrête la session et retire les sessions touchées ainsi que leurs souvenirs dépendants. Supprimer une session efface ses événements et interprétations ; une habitude sans autre source disparaît de MEMORY et de son index de recherche. Les sauvegardes manuelles existantes restent sous votre contrôle.

Limites : 15 minutes/session, 600 événements, 5 000 entrées/dossier, profondeur 20, 200 sessions. Réseau, racines trop larges, données AETHER, Windows, AppData, liens et jonctions refusés. Les sessions restent locales dans SQLite jusqu’à suppression ; aucun consentement n’est conservé pour un futur lancement. La zone ECHO de SPACE expose sessions, hypothèses, habitudes, variations et liens vers MEMORY. MIND référence uniquement les habitudes confirmées. ECHO ne déclenche aucune exploration CURIOSITY ni génération FORGE/MIRROR.

## Parler avec ENTITY

Ouvrez **VOICE** depuis le clic droit sur ENTITY, les réglages, le tray ou le dialogue. Au premier usage, choisissez votre microphone puis **Autoriser le microphone**. Ce consentement ne commence pas une prise. Cliquez ensuite sur **Parler au micro**, ou pressez **Ctrl + Alt + V**. Une seconde pression termine la prise ; un silence la termine aussi. Pendant une réponse, le même raccourci l’interrompt. « Stop voix » ou un clic sur ENTITY arrêtent la lecture.

Le halo d’écoute et **● MICRO** correspondent à la capture native active. La transcription apparaît dans l’échange habituel, avec **VOIX**, puis ENTITY répond oralement. Dans SPACE, les mêmes contrôles utilisent cette conversation. « Ouvre ton espace » et « Regarde comment je fais » passent par MIND : ils ouvrent SPACE ou le panneau ECHO ; aucune observation n’est autorisée par ces phrases.

Le panneau règle langue (fr-FR initialement), raccourci, voix, vitesse, volume et réponses **Toujours / Seulement lorsque je lui parle / Jamais**. Le défaut est **Seulement lorsque je lui parle**. **Écouter cette voix** réalise un essai local sans appeler MIND. Refuser le microphone, désactiver VOICE ou arrêter une prise reste possible à tout moment. Wake word « Aether » et interruption par la voix : interfaces préparées, extensions futures désactivées.

Sur ce poste, VOICE utilise **faster-whisper 1.2.1**, le modèle **medium déjà présent**, CTranslate2 CPU int8, PortAudio/sounddevice et **Microsoft Hortense Desktop** (System.Speech). Python est nécessaire à l’audio, même dans le paquet Electron : `C:\ProgramData\anaconda3\python.exe` est actuellement disponible. Le panneau permet de choisir l’exécutable Python et le dossier d’un autre modèle faster-whisper complet (`model.bin`, `config.json`, `tokenizer.json`). Aucun téléchargement automatique. Un autre poste doit disposer de Python, faster-whisper, sounddevice, NumPy, SciPy, d’un modèle local et d’une voix Windows installée.

STT/TTS ne transmettent rien à un service externe. Si vous choisissez MIND/OpenAI avec son consentement existant, la transcription et le contexte pertinent suivent ce choix comme un message écrit. Aucun fichier audio par défaut. Le diagnostic de latence est optionnel ; conserver les prises exige un second choix explicite, au maximum cinq WAV temporaires, expiration de dix minutes vérifiée chaque minute et suppression immédiate accessible. [Recette, mesures et limites VOICE](docs/RECETTE-J5.5-VOICE.md).

## Choisir l’IA

Réglages → MIND : fournisseur, modèle, puis **Enregistrer l’IA**, distinct du bouton des préférences PRESENCE.

**Ollama local** : démarrez Ollama, URL `http://127.0.0.1:11434`, puis « Rechercher les modèles installés ». Choisissez le nom exact d’un modèle conversationnel présent. AETHER n’en télécharge aucun. Le poste utilise `qwen3.5:9b` pour J3 ; la recette J2 continue de vérifier `llama3.1:8b`. Un nouveau profil reste désactivé jusqu’à ce choix.

**OpenAI cloud** : clé, modèle accessible au compte, consentement explicite à l’envoi des messages et souvenirs pertinents. Clé chiffrée Windows, jamais renvoyée ni dans le JSON. L’adaptateur est implémenté et testé au niveau protocole ; aucun appel cloud avec une clé réelle n’a été validé ici.

**Aucun — désactivé** garde PRESENCE et MEMORY utilisables sans modèle. Configuration manquante, fournisseur arrêté, modèle absent, texte vide ou délai produisent une erreur explicite. Aucun fallback ni faux message assistant, aucun choix cloud automatique.

**MODEL ROUTER**, sous MIND : FAST reprend le fournisseur/modèle du dialogue. DEEP est configurable séparément ; « Suivre FAST » utilise FAST seulement en l’absence de configuration DEEP. Un modèle DEEP configuré mais indisponible produit une erreur. VISION peut être renseigné, mais reste réservé aux futurs traitements visuels et n’exécute rien. Une cible cloud exige le consentement de MIND ; CURIOSITY et ECHO exigent une cible Ollama locale.

## Exploration autonome

Ouvrez CURIOSITY puis activez le mode. Aucun intérêt n’est pré-écrit. Le moteur choisit une piste dans l’historique, demande une réflexion DEEP structurée, valide le résultat et conserve les objets liés, leur origine et le modèle réellement utilisé. Il peut revenir sur un sujet, relier deux intérêts, modifier leur priorité, les rendre dormants ou les abandonner. Le journal permet aussi de modifier/réactiver une piste.

Budget initial : **4 essais par session, 240 secondes de calcul au total, 300 secondes entre les départs**. Un essai échoué ou annulé compte. Désactiver/réactiver ne remet pas le budget à zéro ; une nouvelle session correspond à un redémarrage complet. L’intervalle reste respecté après redémarrage. « Explorer maintenant » suit les mêmes limites. Désactiver annule l’appel en cours ; quitter arrête le moteur. Un dialogue ouvert ou une réponse humaine en cours diffère les réflexions autonomes.

Pendant un appel, ENTITY affiche `exploring`. Une découverte non lue renforce légèrement son signal visuel, sans popup. Ouvrez l’échange pour voir l’indication et demander pourquoi ce sujet, le résultat et la prochaine question. Ces réponses s’appuient sur le journal réel. Les découvertes restent des **synthèses du modèle, non vérifiées**. Aucun Web, outil, accès aux documents ni code externe n’est exécuté.

Supprimer un intérêt retire ses questions, découvertes, connexions, explorations liées et pistes dérivées dont la provenance dépend de lui. Le contexte et les appels en cours sont invalidés. Les questions, découvertes et explorations peuvent aussi être supprimées individuellement. Exclure un domaine filtre les expressions avant sélection et après génération, en ignorant casse/accents ; les synonymes ne sont pas garantis.

## Données locales

| Fichier dans `%APPDATA%\AETHER` | Données |
| --- | --- |
| `preferences.json` | Position, visibilité, raccourci, mouvement réduit |
| `ai-settings.json` | Fournisseur, modèle, URL, consentement ; sans clé |
| `router-settings.json` | Cibles DEEP et VISION ; FAST suit MIND |
| `portal-settings.json` | Raccourci distinct de PORTAL, version 1 |
| `space-state.json` | Caméra, zoom, préférences visuelles, sélection, dernière visite ; version 1 |
| `voice-settings.json` | Consentement microphone, périphérique, langue, fournisseurs, voix, raccourci et diagnostics |
| `openai-key.encrypted` | Clé chiffrée Windows si saisie |
| `memory.sqlite` | Souvenirs/FTS5, journal CURIOSITY et sessions/habitudes ECHO, schéma v3 |

Conversation immédiate en RAM, effacée à la fermeture complète. Souvenirs utilisateur seulement sur demande explicite ou ajout manuel. Avec l’autonomie autorisée, une réflexion peut utiliser le dernier échange et des souvenirs comme origine d’une piste durable dans CURIOSITY ; elle ne crée pas de nouveau souvenir utilisateur. Hypothèses de curiosité étiquetées comme propositions avec confiance estimée, jamais confirmations.

Sauvegarde/restauration : quittez AETHER puis copiez/remplacez ces fichiers. Sur un autre compte Windows, la clé peut nécessiter une nouvelle saisie. Export MEMORY en JSON via dialogue système. Souvenirs/exports non chiffrés. JSON invalide conservé en `.invalid-<date>` avec notice ; base incompatible préservée.

Microphone uniquement pendant une prise VOICE déclenchée et autorisée. ECHO observe uniquement les métadonnées de son dossier consenti. Caméra, capture d’écran et exécution de code généré indisponibles. MIND peut ouvrir seulement SPACE, CURIOSITY et le panneau ECHO ; il ne peut pas ouvrir vos fichiers/applications. Curseur consulté seulement pour les interactions, sans historique.

## Vérifier

```powershell
npm run typecheck
npm test
npm run test:e2e
```

`npm run check` regroupe les contrôles. **86 tests unitaires et huit parcours Electron** couvrent J1–J5 et VOICE : providers, consentement, annulation, mémoire persistante, navigation et confidentialité. Le parcours VOICE emploie des échantillons audio synthétiques identifiés comme tels, avec STT/MIND/TTS/lecture locaux réels. La parole humaine est vérifiée séparément. Résultats courants et incidents dans [RECETTE-J5.5-VOICE](docs/RECETTE-J5.5-VOICE.md) ; historique dans [RECETTE-J5](docs/RECETTE-J5.md).

**Ollama actif, `llama3.1:8b` pour J2 et `qwen3.5:9b` pour J3 ; aucune simulation dans les recettes réelles.** Les doubles restent dans les tests unitaires. La recette native déplace le curseur et presse les raccourcis. Quittez l’instance personnelle pour libérer le raccourci avant les tests. Profils temporaires isolés ; captures, preuve JSON et traces dans `test-results/`, exclu de Git.

## Documents et limites

- [CDC](docs/CDC.md), transcription du Word conservé dans `docs/`.
- [PLAN](PLAN.md), [ARCHITECTURE](ARCHITECTURE.md), [Sécurité](docs/SECURITE.md).
- [Recette J1](docs/RECETTE-J1.md), [recette J2](docs/RECETTE-J2.md), [recette J3](docs/RECETTE-J3.md), [recette J4 et preuves A–H](docs/RECETTE-J4.md), [recette J5 et preuves A–J](docs/RECETTE-J5.md).

Recherche mémoire lexicale, six souvenirs maximum ; certaines paraphrases peuvent manquer. Conversation bornée à 12 messages, réponses non streamées, précision dépendante du modèle. Le profil ne garantit pas l’absence d’erreurs du LLM. Les autres configurations physiques multi-écrans/DPI restent à vérifier au-delà du poste à 150 %.

La réception FIRST LIFE entière dépend de la recette fondatrice J6 et des validations humaines consignées dans RECETTE-J6. J7 sera proposé après cette réception ; aucun jalon suivant ne démarre automatiquement.
