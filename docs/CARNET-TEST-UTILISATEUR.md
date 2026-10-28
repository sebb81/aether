# AETHER — carnet de test guidé

Version du carnet : 16 octobre 2026 · parcours prévu pour AETHER 0.6.0 sous Windows.

**Commencez par la préparation et la séance 1. Vous pouvez vous arrêter ensuite.** Les autres séances se font séparément, selon ce que vous voulez essayer. Les durées servent à réserver du temps ; elles ne garantissent pas la vitesse des modèles.

Ce fichier est à remplir avec vos observations. Faites-en une copie, par exemple `CARNET-TEST-2026-10-16.md`. Aucune case n'est validée à l'avance.

## Se faire accompagner, une étape à la fois

Pour utiliser ce carnet avec un assistant, transmettez-lui le fichier ou son chemin et ce message :

> Guide-moi avec le carnet de test utilisateur AETHER. Commence par la préparation, puis T01. Donne-moi une seule action à la fois, indique ce que je dois voir et attends mon observation avant de continuer. Si cela bloque, aide-moi à relever l'étape et le message exact. Ne coche aucun résultat sans mon retour. N'active aucun micro, cloud, observation ou fabrication à ma place.

Vous pouvez répondre simplement : « Je vois… », « Ça fonctionne », « Je suis bloqué à… » ou « Je reprendrai à… ». Le guide reporte le résultat et propose l'étape suivante. Ce carnet ne déclenche aucune action dans AETHER.

## Préparation — 5 minutes

- [ ] J'ai noté la date, le chemin du programme et sa version ci-dessous.
- [ ] Si une ancienne instance tourne, je l'ai quittée par le menu **Quitter AETHER** avant de lancer celle à tester.
- [ ] Je sais ouvrir le menu par clic droit sur ENTITY, la petite forme sur le bureau. Si elle est masquée, je passe par l'icône AETHER de la zone de notification Windows, éventuellement sous la flèche des icônes masquées.
- [ ] Pour cette séance, **Exploration autonome** est désactivée dans **CURIOSITY · journal…**. Je note son réglage précédent pour le rétablir à la fin si nécessaire.

Depuis ce dépôt, le programme principal est `C:\Dev\CRTHON10\aether\release\AETHER-win32-x64\AETHER.exe`. Sa version de fichier était **0.6.0** lors de la rédaction du carnet. Il existe aussi d'anciens paquets dans `release` : notez celui que vous lancez réellement. Un libellé de panneau comme « VOICE · 5.5 » désigne le module et ne suffit pas à identifier la version du programme.

| Informations de ma séance | À remplir |
| --- | --- |
| Date et heure | … |
| Programme lancé, chemin complet | … |
| Version du fichier AETHER.exe, via clic droit → Propriétés → Détails | … |
| Modèle MIND / modèle DEEP, si connus | … |
| Microphone / casque ou haut-parleurs, pour les séances vocales | … |
| Réglage initial d'Exploration autonome | … |

Les tests ajoutent des données identifiées comme des essais dans votre profil habituel. Pour ECHO et FORGE, créez uniquement de petits dossiers contenant des fichiers de test dans un emplacement local hors du dépôt AETHER et hors d'un dossier synchronisé. Leur préparation est expliquée dans les séances concernées.

## Choisir sa séance

| Séance | Ce que je veux vérifier | Tests | Temps à réserver | Avant de commencer |
| --- | --- | --- | --- | --- |
| **1 — Premier parcours** | AETHER répond, retient et retrouve mes données | T01–T04 | 15–20 min | Un modèle MIND disponible |
| 2 — Voix locale | Je parle, ma phrase est transcrite, j'entends la réponse | T05–T06 | 10–15 min | T02 réussi, fournisseurs audio locaux disponibles |
| 3 — Curiosité | Une réflexion locale laisse une trace consultable | T07 | 10 min | Modèle DEEP local disponible |
| 4 — Observation ECHO | AETHER observe une méthode que je lui montre | T08 | 15 min | Modèle DEEP local et dossier de test |
| 5 — Gemini LIVE, facultatif | Plusieurs échanges vocaux dans une même session | T09 | 10–15 min | Accès Gemini, consentements et microphone disponible |
| 6 — FORGE / MIRROR, facultatif | Un besoin devient un prototype puis une capacité réutilisable | T10–T12 | 25–40 min | DEEP local, Codex installé/authentifié et isolation Windows disponible |

**Pour noter un résultat :** `NT` = non testé ; `OK` = attendu observé ; `KO` = comportement différent ; `B` = bloqué par un prérequis ou un fournisseur ; `P` = partiellement testé. Un test bloqué reste à reprendre. Arrêtez les étapes qui en dépendent ; vous pouvez essayer une autre séance indépendante.

## Séance 1 — Premier parcours

### T01 — Trouver ENTITY et ses commandes

**À faire**

1. Lancez AETHER et repérez ENTITY sur le bureau.
2. Déplacez-la légèrement à la souris.
3. Faites un clic droit : ouvrez **Réglages…**, puis fermez les réglages.
4. Cliquez sur ENTITY pour ouvrir le dialogue.

**Attendu :** la présence se déplace, le menu et le dialogue s'ouvrent. Aucun démarrage de microphone, d'observation ECHO ou de fabrication n'est attendu de ces actions.

**Si cela bloque :** cherchez l'icône AETHER dans la zone de notification pour la rappeler. Notez le chemin du programme lancé et ce qui apparaît ; n'ouvrez pas plusieurs paquets successivement.

Résultat : `NT` · Ce que j'ai vu / difficulté : …

### T02 — Obtenir une réponse écrite réelle

**À faire**

1. Dans le dialogue, envoyez : **« Comment t'appelles-tu ? Réponds en une phrase. »**
2. Regardez l'état d'attente, puis lisez la réponse ou l'erreur.
3. Envoyez : **« Donne-moi deux idées pour organiser un dossier de travail. »**

**Attendu :** deux réponses en rapport avec vos messages. Le texte exact peut varier. Notez si le délai vous semble acceptable et s'il diffère entre le premier et le second échange.

**Si cela bloque :** ouvrez **Réglages… → MIND · Fournisseur IA**. Pour le parcours local, vérifiez **Ollama · local**, utilisez **Rechercher les modèles installés**, choisissez un modèle présent puis **Enregistrer l'IA**. Si Ollama est arrêté ou qu'aucun modèle n'est installé, notez `B` et le message. L'installation du fournisseur est un préalable distinct. Si une requête reste en attente, utilisez **Annuler** avant de recommencer.

Résultat : `NT` · Délai approximatif 1 / 2 : … / … s · Réponse ou erreur : …

### T03 — Enregistrer puis corriger un souvenir

**À faire**

1. Envoyez : **« Retiens que mon projet de test s'appelle Carnet AETHER et que son code est LUCIOLE-731. »**
2. Ouvrez **MEMORY…** par le menu d'ENTITY et recherchez `Carnet AETHER`.
3. Vérifiez que le souvenir contient le nom du projet et le code. Une réponse dans le dialogue ne suffit pas à prouver son enregistrement.
4. Sur ce souvenir, cliquez **Corriger**, remplacez seulement le code par `LUCIOLE-732`, puis **Enregistrer le souvenir**.
5. Retournez au dialogue et demandez : **« Quel est le code de mon projet de test Carnet AETHER ? »**

**Attendu :** le souvenir est consultable et corrigé dans MEMORY ; la réponse suivante utilise `LUCIOLE-732`.

**Si cela bloque :** notez séparément « souvenir absent », « correction impossible » ou « réponse utilisant l'ancien code ». Si vous utilisez **Ajouter** pour poursuivre, notez ce contournement : la mémorisation depuis le dialogue reste à vérifier.

Résultat : `NT` · Enregistrement / correction / rappel : … / … / …

### T04 — Retrouver après redémarrage, visiter SPACE, puis effacer

**À faire**

1. Quittez complètement via **Quitter AETHER**, puis relancez le même exécutable.
2. Dans **MEMORY…**, retrouvez `Carnet AETHER` avec le code corrigé. Demandez à nouveau son code dans le dialogue.
3. Fermez le dialogue, puis utilisez le menu **Entrer dans AETHER…** pour ouvrir SPACE.
4. Repérez le souvenir dans la zone MEMORY, consultez-le, essayez le déplacement du fond et le zoom. Revenez au bureau avec **Revenir au bureau**.
5. Dans MEMORY, supprimez uniquement le souvenir `Carnet AETHER`, puis **Confirmer la suppression**. Vérifiez qu'il disparaît de la recherche.
6. Dans un **Nouvel échange**, demandez : **« Quel est le code de mon projet de test Carnet AETHER ? »**, sans redonner le code.

**Attendu :** souvenir corrigé présent après redémarrage et visible dans SPACE. Après suppression, le code n'est plus rappelé depuis MEMORY ; AETHER indique qu'il lui manque l'information.

**Si cela bloque :** distinguez le stockage (« absent dans MEMORY après redémarrage »), le rappel (« présent mais mauvaise réponse »), SPACE et l'effacement. Notez un résultat partiel si une seule partie échoue.

Résultat : `NT` · Redémarrage / SPACE / suppression : … / … / …

**Point d'arrêt :** vous avez terminé le premier parcours. Vous pouvez remplir le bilan et reprendre une autre séance plus tard.

## Séance 2 — Voix locale

### T05 — Vérifier les fournisseurs et entendre la voix

**À faire**

1. Ouvrez **VOICE · réglages et consentement…** depuis le menu d'ENTITY. Cliquez **Vérifier les fournisseurs**.
2. Notez les états STT (reconnaissance de la parole) et TTS (synthèse vocale).
3. Vérifiez **Activer VOICE**, **Activer les réponses orales** et la politique **Seulement lorsque je lui parle**.
4. Sélectionnez le microphone que vous utilisez réellement. Si le périphérique enregistré est indisponible, choisissez un périphérique présent ou **Microphone par défaut de Windows**.
5. Cliquez **Enregistrer VOICE**, puis **Écouter cette voix**.

**Attendu :** vous entendez la voix locale. Ce bouton teste la sortie sonore ; la capture de votre parole sera testée en T06.

**Si cela bloque :** notez le message fournisseur ou vérifiez la sortie et le volume Windows. STT indisponible : T06 est bloqué, même si la voix de synthèse fonctionne. Ne changez pas les chemins Python/Whisper au hasard ; relevez le diagnostic affiché.

Résultat : `NT` · STT / TTS : … / … · Voix entendue : …

### T06 — Faire une vraie prise au micro et arrêter une réponse

**À faire**

1. Cliquez **Autoriser le microphone**. Vérifiez que le micro reste arrêté jusqu'à votre prise.
2. Cliquez **Parler au micro**, dites **« Comment t'appelles-tu ? »**, puis **Terminer la prise** si elle n'est pas déjà terminée par le silence.
3. Pendant votre parole, vérifiez que la jauge **Niveau micro** bouge. Notez ensuite la transcription, la réponse et ce que vous entendez.
4. Recommencez avec **« Explique en quelques phrases comment organiser un dossier. »** ; pendant la lecture, cliquez **Stop voix**.
5. À la fin, vérifiez **Microphone arrêté**. Vous pouvez **Refuser le microphone** pour révoquer l'autorisation.

**Attendu :** jauge active pendant la prise, transcription fidèle au sens, réponse pertinente et audible, lecture arrêtée à votre demande. Le premier traitement local peut prendre plusieurs dizaines de secondes : notez l'état visible pendant cette attente.

**Si cela bloque :** jauge immobile → vérifier le micro choisi ; jauge active mais texte absent → relever la notice STT ; texte correct mais pas de son → vérifier TTS et sortie. Un retour à « Microphone arrêté » sans transcription ni explication se note comme un échec. Le raccourci par défaut **Ctrl + Alt + V** peut être essayé après le bouton ; s'il échoue seul, notez-le séparément.

Résultat : `NT` · Jauge / transcription / son / arrêt : … / … / … / …

Temps approximatif entre fin de parole et premier son : … s · Bruit, coupures ou gêne : …

## Séance 3 — Curiosité locale

### T07 — Lancer une réflexion et retrouver sa trace

**À faire**

1. Dans **Réglages… → MODEL ROUTER**, vérifiez un profil **DEEP** local disponible. **Suivre FAST** convient si FAST utilise déjà un modèle Ollama local.
2. Ouvrez **CURIOSITY · journal… → Proposer une piste**. Titre : `TEST — rangement de fichiers`. Description : `Comparer le classement par date et par projet pour un petit dossier de travail.` Cliquez **Enregistrer la piste**.
3. Notez le budget actuel. Pour cet essai, réglez **Explorations par session** à `1` et enregistrez le budget. Fermez le dialogue avec ENTITY et laissez ECHO/FORGE arrêtés.
4. Activez **Exploration autonome**. Laissez une réflexion se terminer ; si elle ne démarre pas et que le bouton est disponible, cliquez **Explorer maintenant**. La piste choisie peut être un autre intérêt actif : notez lequel.
5. Consultez **Explorations**, puis les questions ou découvertes associées. Désactivez **Exploration autonome** après cet essai et rétablissez le budget initial.

**Attendu :** une tentative datée, avec sa piste, son modèle, son résultat ou son erreur. Une réflexion réussie produit un contenu consultable ; son intérêt et sa clarté sont à juger. Les découvertes sont des synthèses du modèle, sans vérification Web.

**Si cela bloque :** relevez l'état « budget épuisé », l'erreur DEEP ou le motif d'interruption. Un résultat refusé par le validateur reste un échec de production, même si le refus est explicite. Vous pouvez supprimer ensuite la piste de test et ses éléments liés, en lisant la confirmation.

Résultat : `NT` · Piste effectivement explorée / résultat utile / erreur : …

## Séance 4 — Montrer une méthode à ECHO

### T08 — Observer, interpréter, puis valider humainement

**Préparer :** dans un petit dossier local `AETHER-tests\echo`, créez `brouillon-a.txt` et `brouillon-b.txt`, avec quelques mots de test. Dans Explorer, affichez les extensions de fichiers pour vérifier les noms. Gardez une seule fenêtre/un seul onglet Explorer sur ce dossier pendant la démonstration.

**À faire**

1. Ouvrez **ECHO · Regarde comment je fais…**. Si nécessaire, cliquez **Préparer une session ECHO**, puis **Choisir le dossier de test** et sélectionnez `echo`.
2. Lisez et cochez le consentement pour cette session, puis **Démarrer l'observation**.
3. Remettez Explorer au premier plan dans `echo`. Vérifiez que le contexte est autorisé. Créez un sous-dossier `archives-test`, renommez `brouillon-a.txt` en `note-a.txt`, puis déplacez les deux fichiers dans `archives-test`. Espacez les gestes de quelques secondes.
4. Revenez au panneau ECHO et cliquez **Arrêter et comprendre**.
5. Comparez les événements observés à vos gestes, puis l'interprétation à votre méthode. Ne validez que si elle correspond : **Oui, retenir cette habitude**. Sinon choisissez **Non**, **Partiellement** ou **Corriger l'interprétation**.
6. Si vous avez confirmé ou validé une correction, vérifiez l'habitude dans MEMORY. Cliquez **Désactiver complètement ECHO** à la fin.

**Attendu :** observation limitée au contexte autorisé, événements reconnaissables, hypothèse avec ses observations citées. Une habitude durable exige votre validation ou votre correction validée. ECHO observe des changements de fichiers ; il ne voit pas vos clics ni le contenu des documents.

**Si cela bloque :** vérifiez d'abord le contexte Explorer. Des événements présents mais une interprétation refusée constituent un résultat partiel ; relevez le message sans confirmer une méthode incorrecte. Pour nettoyer l'essai, utilisez **Supprimer cette session** et lisez la confirmation : une habitude sans autre source sera aussi retirée de MEMORY.

Résultat : `NT` · Événements / interprétation / décision humaine / MEMORY : … / … / … / …

## Séance 5 — Gemini LIVE, facultatif

### T09 — Échanger, interrompre et fermer la session

**Avant :** un microphone disponible, une sortie testée et un accès Gemini utilisable. La clé se renseigne uniquement dans AETHER. Un casque peut faciliter le premier essai. Le traitement de l'audio utilise le cloud Gemini après consentement.

**À faire**

1. Dans **VOICE**, choisissez et enregistrez le microphone, puis autorisez-le. Ce choix est aussi utilisé pour LIVE.
2. Ouvrez **LIVE VOICE · Gemini…**. Activez Gemini Live, vérifiez modèle et voix, renseignez la clé si nécessaire et cliquez **Enregistrer LIVE**. Activez l'affichage de la transcription pour ce test.
3. Lisez le consentement cloud, puis **Autoriser Gemini Live** si vous l'acceptez. Cliquez **Démarrer LIVE**.
4. Dites **« Bonjour, réponds en une phrase. »**, puis **« Donne-moi trois idées de rangement. »** sans redémarrer la session. Si la réponse automatique est désactivée, utilisez **Répondre maintenant** après chaque prise de parole.
5. Pendant une réponse assez longue, dites **« Arrête, réponds seulement oui. »** et observez la coupure puis la nouvelle réponse.
6. Cliquez **Arrêter LIVE** et vérifiez l'arrêt de la session et du microphone. Pour retirer aussi l'autorisation cloud, utilisez **Révoquer le consentement cloud**.

**Attendu :** plusieurs tours audibles et transcrits dans la même session, interruption compréhensible, puis arrêt effectif. Notez les répétitions, coupures et bruits éventuels. Le micro reste ouvert pendant la session LIVE, y compris pendant les réponses.

**Si cela bloque :** relevez le message exact. Un refus de quota fournisseur se note `B` ; une connexion ouverte brièvement ne valide pas une conversation. Si vous entendez un bruit continu, arrêtez LIVE et notez micro, sortie et moment d'apparition. **Parler en LOCAL** permet un essai séparé. Après un arrêt, **Reconnecter LIVE** crée une nouvelle session.

Résultat : `NT` · Connexion / deux tours / interruption / arrêt : … / … / … / …

## Séance 6 — Fabriquer puis réutiliser une petite capacité

Ce parcours utilise un nouvel exemple simple de renommage. Le prototype WAV des recettes techniques peut se trouver dans un profil isolé ; sa présence dans votre profil personnel n'est pas supposée. Les confirmations de fabrication, d'installation et de modification de fichiers sont trois décisions distinctes dans l'application.

### T10 — Préparer une règle que je comprends

**À faire**

1. Ouvrez **FORGE / MIRROR…** et copiez ce besoin dans **Ce que la capacité doit faire** :

   > Dans le dossier de test choisi, ajouter TEST_ au nom des fichiers .txt placés directement à la racine. Ne pas toucher aux autres extensions, aux sous-dossiers ni aux fichiers déjà préfixés TEST_. Si la destination existe, y compris avec une casse différente sous Windows, laisser le fichier source intact. Ne rien écraser, supprimer ou lire du contenu. Produire la liste avant/après ; aucun changement si le dossier est vide. Sans dépendance externe, réseau ni commande système. Prévoir des tests pour chacune de ces règles.

2. Cliquez **Préparer la spécification avec MIND**. Répondez aux éventuelles demandes de précision.
3. Lisez **Spécification et permissions** et les tests d'acceptation. Vérifiez toutes les règles, notamment collisions et sous-dossiers. Des droits de lecture/écriture du dossier choisi peuvent être nécessaires au renommage.
4. Si la spécification est correcte, cliquez **Autoriser la fabrication Codex**, puis **Annuler** dans la confirmation pour vérifier ce premier point d'arrêt.

**Attendu :** une spécification à approuver ; après annulation, aucune fabrication n'a commencé et aucune capacité n'est installée. Si la règle est mal reformulée, arrêtez ici et notez ce qui doit être corrigé. L'éditeur avancé est du JSON : son utilisation peut demander un accompagnement.

Résultat : `NT` · Règle compréhensible / fidèle / annulation respectée : … / … / …

### T11 — Fabriquer et essayer le prototype sans modifier les originaux

**Préparer :** dans `AETHER-tests\forge-a`, créez ces fichiers de test, avec un contenu court. Le fichier Markdown peut être créé avec un éditeur de texte. Vérifiez les extensions réelles dans Explorer.

```text
forge-a/
  note.txt
  garder.md
  TEST_deja.txt
  occupe.txt
  TEST_occupe.txt
  archive/
    vieux.txt
```

**À faire**

1. Si vous décidez de lancer la génération, relisez la spécification T10, cliquez **Autoriser la fabrication Codex**, puis **Confirmer la fabrication**. Le compte Codex et ses quotas sont utilisés.
2. Observez la fabrication et les tests MIRROR. Consultez **Tests et tentatives**. **Tout arrêter** reste disponible ; si vous l'utilisez, notez l'essai comme interrompu.
3. Uniquement après **Prototype prêt**, cliquez **Essayer le prototype**, vérifiez les paramètres proposés et cliquez **Lancer l'essai**. Dans le sélecteur Windows, choisissez `forge-a`.
4. Comparez le tableau avant/après aux noms ci-dessus, puis vérifiez directement le dossier dans Explorer.

**Attendu :** tests réussis et un seul renommage proposé : `note.txt` → `TEST_note.txt`. `occupe.txt` reste intact car `TEST_occupe.txt` existe déjà ; tous les autres fichiers restent inchangés. Pendant cet aperçu, les originaux gardent leurs noms et leur contenu. La capacité reste un prototype tant que vous ne l'avez pas installée.

**Si cela bloque :** distinguez l'accès Codex, l'isolation indisponible, les tests échoués et l'aperçu incorrect. Ne passez pas à l'installation si un de ces contrôles échoue. Une nouvelle tentative demande une nouvelle confirmation.

Résultat : `NT` · Tests / aperçu exact / originaux intacts : … / … / …

### T12 — Installer, redémarrer et utiliser sur un nouveau dossier

**Avant :** T11 réussi. Cette étape installe la capacité et, si vous confirmez l'application du plan, renomme les fichiers du dossier de test choisi.

**À faire**

1. Si vous souhaitez acquérir cette capacité, cliquez **Installer cette capacité**, relisez les permissions, puis **Confirmer l'installation**. Vérifiez sa présence dans **Capacités acquises**.
2. Quittez complètement AETHER et relancez le même programme. Retrouvez la capacité, sa version et ses permissions.
3. Créez un **nouveau** dossier local `AETHER-tests\forge-b`, contenant `autre.txt` et `garder.md`.
4. Depuis la capacité acquise, cliquez **Essayer / prévisualiser**, puis **Lancer l'essai**, et choisissez `forge-b`. Vérifiez que seul `autre.txt` → `TEST_autre.txt` est proposé et que rien n'a encore changé.
5. Si ce plan vous convient, cliquez **Confirmer ces modifications dans le dossier choisi**. Vérifiez dans Explorer le nom `TEST_autre.txt`, son contenu conservé et `garder.md` inchangé. Si l'aperçu a expiré, relancez-le et relisez-le avant confirmation.
6. Cliquez **Désactiver** et confirmez la décision. Vérifiez l'état **Désactivée** et l'absence du bouton d'essai pour cette capacité. Vous pouvez ensuite la réactiver ou la désinstaller en confirmant la décision choisie.

**Attendu :** acquisition persistante après arrêt complet, nouvel aperçu correct sur de nouvelles données, renommage seulement après confirmation, puis désactivation. Une désinstallation ne remet pas les fichiers renommés à leur ancien nom.

**Si vous vous arrêtez avant installation ou écriture :** notez `P` et la dernière étape réalisée. Un prototype prêt ou une capacité seulement installée ne valide pas toute cette séquence.

Résultat : `NT` · Installation / reprise / nouvel usage / désactivation : … / … / … / …

## Repères sur les validations déjà documentées

Ces repères proviennent des recettes du dépôt datées du **15 octobre 2026** ; ils ne décrivent pas une nouvelle exécution sur votre poste :

- La recette globale après plantage comptait 15 parcours Electron réussis et deux échecs : ECHO et Gemini LIVE. Pour ECHO, un rejeu a notamment refusé une observation citée inexistante. Voir la [vérification après plantage](recette-j6/post-crash/verification.md).
- Le diagnostic Gemini avait relevé un ancien microphone absent et un refus fournisseur pour quota. L'accès Gemini doit être réessayé pour connaître son état actuel. Voir le [diagnostic daté](recette-live/gemini-startup-diagnostic.json).
- Le prototype Codex de référence avait réussi les tests MIRROR et l'essai sur copies ; adoption, redémarrage et réutilisation persistante restaient à valider. Voir la [recette J6](RECETTE-J6.md).
- La qualité au microphone et sur les haut-parleurs exige vos observations réelles. Les essais audio synthétiques des [recettes VOICE](RECETTE-J5.5-VOICE.md) et [LIVE](RECETTE-J5.6-LIVE.md) ne remplissent pas ces cases à votre place.

## Bilan à remplir et reprise

| Test | Résultat NT / OK / KO / B / P | Observation ou incident |
| --- | --- | --- |
| T01 — Présence et commandes | NT | … |
| T02 — Dialogue | NT | … |
| T03 — Souvenir et correction | NT | … |
| T04 — Redémarrage, SPACE et effacement | NT | … |
| T05 — Fournisseurs audio et voix | NT | … |
| T06 — Parole réelle et arrêt | NT | … |
| T07 — Curiosité | NT | … |
| T08 — ECHO | NT | … |
| T09 — Gemini LIVE | NT | … |
| T10 — Spécification FORGE | NT | … |
| T11 — Fabrication et aperçu | NT | … |
| T12 — Acquisition et nouvel usage | NT | … |

- Dernière étape terminée : …
- Prochaine étape à reprendre : …
- Ce qui m'est utile dans AETHER : …
- Ce que je ne comprends pas encore : …
- Difficulté prioritaire à corriger : …
- Réglages modifiés à rétablir, données de test à conserver ou retirer : …
- Avant de finir : LIVE arrêté, prise micro terminée, ECHO désactivé, aucune opération FORGE active ; autonomie rétablie selon mon choix initial.

### Fiche d'incident à copier si nécessaire

```text
Test et numéro d'action :
Date / heure :
Version et chemin AETHER.exe :
Action exacte effectuée / phrase de test :
Ce que j'attendais :
Ce que j'ai vu ou entendu :
Message d'erreur exact et état affiché :
Temps d'attente approximatif :
Micro / sortie / fournisseur / modèle concernés, si applicable :
Capture facultative, sans clé ni donnée personnelle :
Résultat après une reprise, si j'en ai fait une :
```

Conservez le premier résultat en cas de reprise. Ne copiez jamais de clé API dans ce carnet.
