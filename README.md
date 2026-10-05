# AETHER

**AETHER 0.5.0 — Jalon 5 : ECHO apprend vos méthodes avec votre accord.** Vous choisissez un dossier de test dans Explorer, montrez une procédure, arrêtez l’observation et validez l’hypothèse avant MEMORY. ECHO revient OFF à chaque démarrage. PRESENCE, MIND, MEMORY, CURIOSITY, PORTAL et SPACE sont conservés. Sur ce poste : **Ollama local, FAST et DEEP = `qwen3.5:9b`**, sans clé. Le réglage d’autonomie existant reste conservé.

## Démarrer sous Windows

Ouvrez `release\AETHER-win32-x64\AETHER.exe`. Le dossier entier contient le programme et son runtime ; copiez-le en entier. Node/npm ne sont pas nécessaires à l’exécution. Paquet Windows x64, sans installateur ni signature de distribution.

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
| `openai-key.encrypted` | Clé chiffrée Windows si saisie |
| `memory.sqlite` | Souvenirs/FTS5, journal CURIOSITY et sessions/habitudes ECHO, schéma v3 |

Conversation immédiate en RAM, effacée à la fermeture complète. Souvenirs utilisateur seulement sur demande explicite ou ajout manuel. Avec l’autonomie autorisée, une réflexion peut utiliser le dernier échange et des souvenirs comme origine d’une piste durable dans CURIOSITY ; elle ne crée pas de nouveau souvenir utilisateur. Hypothèses de curiosité étiquetées comme propositions avec confiance estimée, jamais confirmations.

Sauvegarde/restauration : quittez AETHER puis copiez/remplacez ces fichiers. Sur un autre compte Windows, la clé peut nécessiter une nouvelle saisie. Export MEMORY en JSON via dialogue système. Souvenirs/exports non chiffrés. JSON invalide conservé en `.invalid-<date>` avec notice ; base incompatible préservée.

Aucune voix, caméra, capture, observation de dossier ou exécution de code généré. Le modèle ne peut pas ouvrir vos fichiers/applications. Curseur consulté seulement pour les interactions, sans historique.

## Vérifier

```powershell
npm run typecheck
npm test
npm run test:e2e
```

`npm run check` regroupe les contrôles. **69 tests unitaires et sept parcours Electron**, dont J1 natif, J2 Ollama réel A–E, coffre Windows, J3 réel A–F, J4 PORTAL/SPACE et ECHO A–I : perception native, hypothèses locales, habitudes, répétition, correction, suppression, OFF et exclusions. Résultats et incidents de recette dans [RECETTE-J5](docs/RECETTE-J5.md).

**Ollama actif, `llama3.1:8b` pour J2 et `qwen3.5:9b` pour J3 ; aucune simulation dans les recettes réelles.** Les doubles restent dans les tests unitaires. La recette native déplace le curseur et presse les raccourcis. Quittez l’instance personnelle pour libérer le raccourci avant les tests. Profils temporaires isolés ; captures, preuve JSON et traces dans `test-results/`, exclu de Git.

## Documents et limites

- [CDC](docs/CDC.md), transcription du Word conservé dans `docs/`.
- [PLAN](PLAN.md), [ARCHITECTURE](ARCHITECTURE.md), [Sécurité](docs/SECURITE.md).
- [Recette J1](docs/RECETTE-J1.md), [recette J2](docs/RECETTE-J2.md), [recette J3](docs/RECETTE-J3.md), [recette J4 et preuves A–H](docs/RECETTE-J4.md), [recette J5 et preuves A–J](docs/RECETTE-J5.md).

Recherche mémoire lexicale, six souvenirs maximum ; certaines paraphrases peuvent manquer. Conversation bornée à 12 messages, réponses non streamées, précision dépendante du modèle. Le profil ne garantit pas l’absence d’erreurs du LLM. Les autres configurations physiques multi-écrans/DPI restent à vérifier au-delà du poste à 150 %.

La réception FIRST LIFE entière reste à terminer : voix, dépôt de fichier et EVOLUTION restent futurs. Prochain jalon proposé : **J6 FORGE + MIRROR**, avec spécification validée et essais isolés avant adoption. Aucun développement suivant ne démarre automatiquement.
