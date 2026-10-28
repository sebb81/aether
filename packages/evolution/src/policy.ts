import type { CapabilityInput, CapabilityOutput, CapabilityPermission, CapabilityTest, ForgeSpecification } from '@aether/shared';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objet structuré attendu.');
  return value as Record<string, unknown>;
}
export function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !(key in value))) throw new Error('Champs manquants ou non autorisés.');
}
export function textValue(value: unknown, max = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new Error('Texte absent ou trop long.');
  return value.trim();
}
export function strings(value: unknown, max = 20): string[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('Liste trop longue ou invalide.');
  return value.map(item => textValue(item, 1200));
}
export function safeRelative(value: unknown): string {
  const path = textValue(value, 240).replace(/\\/g, '/');
  if (path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) throw new Error('Chemin relatif non autorisé.');
  return path;
}
export function permissions(value: unknown): CapabilityPermission[] {
  const list = strings(value, 7);
  if (new Set(list).size !== list.length || list.some(p => !['filesystem.read', 'filesystem.write'].includes(p))) throw new Error('Permission non supportée au J6 : seuls filesystem.read et filesystem.write sont disponibles. Réseau et processus refusés.');
  if (list.includes('filesystem.write') && !list.includes('filesystem.read')) throw new Error('Une écriture exige la lecture du périmètre sélectionné.');
  return list as CapabilityPermission[];
}
export function parseInput(value: unknown): CapabilityInput {
  if (JSON.stringify(value).length > 512000) throw new Error('Entrées trop volumineuses.');
  const input = object(value); exact(input, ['files', 'parameters']);
  if (!Array.isArray(input.files) || input.files.length > 500) throw new Error('Au plus 500 fichiers.');
  return { files: input.files.map(item => { const file = object(item); exact(file, ['path', 'size', 'modifiedAt']); if (typeof file.size !== 'number' || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.modifiedAt !== 'string' || !Number.isFinite(Date.parse(file.modifiedAt))) throw new Error('Métadonnées invalides.'); return { path: safeRelative(file.path), size: file.size, modifiedAt: file.modifiedAt }; }), parameters: object(input.parameters) };
}
export function parseOutput(value: unknown): CapabilityOutput {
  if (JSON.stringify(value).length > 512000) throw new Error('Sortie trop volumineuse.');
  const result = object(value); exact(result, ['summary', 'renames', 'data']);
  if (!Array.isArray(result.renames) || result.renames.length > 500) throw new Error('Trop d’opérations proposées.');
  return { summary: textValue(result.summary), renames: result.renames.map(item => { const op = object(item); exact(op, ['from', 'to']); return { from: safeRelative(op.from), to: safeRelative(op.to) }; }), data: result.data };
}
export function parseTests(value: unknown): CapabilityTest[] {
  if (!Array.isArray(value) || !value.length || value.length > 30) throw new Error('Entre 1 et 30 tests fonctionnels sont requis.');
  return value.map((item, index) => {
    const test = object(item); exact(test, ['name', 'input', 'expected']); const name = textValue(test.name, 200);
    try { return { name, input: parseInput(test.input), expected: parseOutput(test.expected) }; }
    catch (error) { throw new Error(`Test ${index + 1} (${name}) invalide : ${error instanceof Error ? error.message : 'schéma invalide'}`); }
  });
}
export function parseSpecification(value: unknown): ForgeSpecification {
  const spec = object(value); exact(spec, ['title', 'objective', 'description', 'inputs', 'outputs', 'constraints', 'permissions', 'dependencies', 'successCriteria', 'acceptanceTests']);
  const dependencies = strings(spec.dependencies);
  if (dependencies.length) throw new Error('J6 exécute du JavaScript sans dépendances externes. Aucune installation ou téléchargement implicite.');
  const inputs = strings(spec.inputs), outputs = strings(spec.outputs), successCriteria = strings(spec.successCriteria);
  if (!inputs.length || !outputs.length || !successCriteria.length) throw new Error('Précisez les entrées, sorties et critères de réussite.');
  const granted=permissions(spec.permissions),acceptanceTests=parseTests(spec.acceptanceTests);
  for(const test of acceptanceTests)try{validatePlan(test.input,test.expected,granted);}catch(error){throw new Error(`Test d’acceptation incohérent (${test.name}) : ${error instanceof Error?error.message:'plan invalide'}`);}
  return { title: textValue(spec.title, 160), objective: textValue(spec.objective), description: textValue(spec.description), inputs, outputs, constraints: strings(spec.constraints), permissions: granted, dependencies, successCriteria, acceptanceTests };
}
export function validatePlan(input: CapabilityInput, output: CapabilityOutput, granted: readonly CapabilityPermission[]) {
  if (input.files.length && !granted.includes('filesystem.read')) throw new Error('Lecture non autorisée.');
  if (output.renames.length && !granted.includes('filesystem.write')) throw new Error('Écriture non autorisée.');
  const sources = new Set<string>(), targets = new Set<string>(), existing = new Set(input.files.map(file => file.path.toLowerCase()));
  for (const op of output.renames) {
    const from = safeRelative(op.from), to = safeRelative(op.to), src = from.toLowerCase(), dest = to.toLowerCase();
    if (!existing.has(src) || !input.files.some(f => f.path === from) || src === dest || sources.has(src) || targets.has(dest) || existing.has(dest)) throw new Error('Plan refusé : source inconnue, doublon ou collision.');
    if (input.files.some(f => f.path.toLowerCase().startsWith(dest + '/') || dest.startsWith(f.path.toLowerCase() + '/'))) throw new Error('Plan refusé : conflit fichier/dossier.');
    sources.add(src); targets.add(dest);
  }
}
