# Prototype Classement WAV par date

Code réellement produit par Codex, tentative 3, version 1.0.0.

MIRROR : compilation et 12 tests fonctionnels réussis.

Essai réel sur des fichiers de recette créés à part :

| Avant | Copie après essai |
|---|---|
| prise-c5f29929.WAV | 2026-11-23/prise-c5f29929.WAV |
| bloque.wav, destination occupée | inchangé |
| archives/ancien.wav | inchangé |
| notes.txt | inchangé |

Les empreintes confirment que les originaux sont intacts. Le code n'a reçu que les métadonnées et la date. L'essai appelle les modules de production depuis un script ; le sélecteur Windows n'a pas été utilisé pour cette démonstration.

Permissions : filesystem.read et filesystem.write, médiées par le noyau sur le dossier sélectionné à chaque usage. Aucun réseau ni commande système.

Statut : READY, aucune installation. L'adoption persistante et l'essai après redémarrage attendent une validation distincte.

SHA-256 : a7c16aeaa8c0b9f05f3e32fec7b7c6f1e35b0b69aca4d65595a8eebec5f0f79f

[Code Codex](generated-capability.js), [manifeste et tests](generated-manifest.json), [preuves sur les fichiers](prototype-demo.json).
