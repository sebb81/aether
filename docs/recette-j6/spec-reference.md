# Spécification de la première capacité J6 — à approuver

**Classement WAV par date** — scénario contrôlé, sans données personnelles ni habitude ECHO revendiquée.

- Entrée : un dossier de test choisi dans Windows et une date fournie en paramètre.
- Résultat : un aperçu proposant de déplacer les fichiers WAV de la racine dans un sous-dossier portant cette date, en conservant leurs noms. Exemple : `prise.wav` → `2026-10-15/prise.wav`.
- Les autres formats et les fichiers déjà dans un sous-dossier restent intacts. Une destination occupée est exclue, sans écrasement.
- Permissions : lecture des métadonnées et écritures limitées au dossier sélectionné. Aucun accès réseau, périphérique, processus ou dépendance externe.
- Codex recevra cette spécification et le contrat de capacité ; aucun fichier personnel, souvenir ni clé AETHER.
- MIRROR exécutera le code dans QuickJS/WebAssembly sous Windows MXC. Six tests d'acceptation couvrent le cas nominal, un dossier vide, un fichier déjà classé, une autre source, une collision et une nouvelle date avec extension majuscule.
- Le code de cette fonctionnalité n'existe pas encore : il devra être produit par le vrai Codex.
- L'acceptation de cette spécification autorise seulement la fabrication et les essais dans le profil de recette. L'installation et toute modification d'un dossier feront l'objet de confirmations distinctes.

La proposition initiale a été générée par MIND/Qwen local, puis relue : deux tests incohérents et des descriptions de champs ont été corrigés avant présentation. Les versions originales et les corrections sont conservées à côté de ce document. La spécification structurée exacte est dans [spec-reference.json](spec-reference.json).

Identifiant : `44fa75ee-c15d-4cad-8ecb-870126afe9a0`. État : `DRAFT`, zéro génération, zéro capacité installée.
