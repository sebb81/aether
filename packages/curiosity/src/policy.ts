import type { CuriositySettings, ExplorationAction, InterestWrite } from '@aether/shared';

export const DEFAULT_CURIOSITY_SETTINGS: CuriositySettings = { enabled: false, maxExplorations: 4, maxDurationSeconds: 240, minIntervalSeconds: 300 };
export function normalized(value: string) { return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
export function isBlocked(text: string, domains: readonly string[]) { const value = normalized(text); return domains.some(domain => value.includes(normalized(domain))); }
export function parseCuriositySettings(value: unknown): CuriositySettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Budget CURIOSITY invalide.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['enabled','maxExplorations','maxDurationSeconds','minIntervalSeconds'].includes(key)) || typeof input.enabled !== 'boolean') throw new Error('Réglages CURIOSITY invalides.');
  for (const [key, min, max] of [['maxExplorations',1,50],['maxDurationSeconds',1,3600],['minIntervalSeconds',1,86400]] as const) if (typeof input[key] !== 'number' || !Number.isInteger(input[key]) || input[key] < min || input[key] > max) throw new Error(`Budget invalide : ${key} doit être entre ${min} et ${max}.`);
  return { enabled: input.enabled, maxExplorations: input.maxExplorations as number, maxDurationSeconds: input.maxDurationSeconds as number, minIntervalSeconds: input.minIntervalSeconds as number };
}
export function uuid(value: unknown): asserts value is string { if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value)) throw new Error('Identifiant CURIOSITY invalide.'); }
export function text(value: unknown, name: string, max = 1200): string { if (typeof value !== 'string' || value.trim().length < 3 || value.length > max) throw new Error(`${name} invalide (3 à ${max} caractères).`); return value.trim(); }
export function parseInterestWrite(value: unknown): InterestWrite {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Intérêt invalide.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['id','title','description','level','status'].includes(key)) || !['active','dormant','abandoned'].includes(String(input.status)) || typeof input.level !== 'number' || !Number.isFinite(input.level) || input.level < 0 || input.level > 1) throw new Error('Priorité ou statut invalide.');
  if (input.id !== undefined) uuid(input.id);
  return { title: text(input.title, 'Titre', 160), description: text(input.description, 'Description'), level: input.level, status: input.status as InterestWrite['status'], ...(input.id ? { id: input.id as string } : {}) };
}
export interface ExplorationResult { decision: ExplorationAction; why: string; question: string; hypothesis: string; confidence: number; discovery: string; limits: string; nextQuestion: string; newInterest: { title: string; description: string; originKey: string | null } | null; connection: string | null; levelDelta: number }
export function parseExplorationResult(response: string): ExplorationResult {
  if (response.length > 20000) throw new Error('Réponse CURIOSITY trop longue.');
  let input: Record<string, unknown>;
  try { input = JSON.parse(response.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { throw new Error('Le modèle n’a pas fourni un objet JSON valide. Aucun résultat n’a été inventé.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || !['birth','deepen','connect','dormant','abandon','reactivate'].includes(String(input.decision))) throw new Error('Décision CURIOSITY invalide.');
  const allowed = ['decision','why','question','hypothesis','confidence','discovery','limits','nextQuestion','newInterest','connection','levelDelta'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Champ de résultat CURIOSITY non autorisé.');
  if (typeof input.confidence !== 'number' || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1 || typeof input.levelDelta !== 'number' || !Number.isFinite(input.levelDelta) || Math.abs(input.levelDelta) > 0.25) throw new Error('Confiance ou évolution de priorité invalide.');
  let newInterest: ExplorationResult['newInterest'] = null;
  if (input.newInterest !== null && input.newInterest !== undefined) {
    const value = input.newInterest as Record<string, unknown>;
    if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['title','description','originKey'].includes(key))) throw new Error('Nouvel intérêt invalide.');
    newInterest = { title: text(value.title, 'Titre', 160), description: text(value.description, 'Description'), originKey: typeof value.originKey === 'string' ? value.originKey.slice(0,150) : null };
  }
  return { decision: input.decision as ExplorationAction, why: text(input.why,'Motif'), question: text(input.question,'Question'), hypothesis: text(input.hypothesis,'Hypothèse'), confidence: input.confidence, discovery: text(input.discovery,'Découverte',2400), limits: text(input.limits,'Limites'), nextQuestion: text(input.nextQuestion,'Prolongement'), newInterest, connection: input.connection == null ? null : text(input.connection,'Connexion'), levelDelta: input.levelDelta };
}
