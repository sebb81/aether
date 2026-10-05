import type { MemoryDraft, MemoryWrite } from '@aether/shared';

export const MEMORY_CATEGORIES = ['profile', 'preference', 'project', 'knowledge', 'experience'] as const;
export function validateMemoryDraft(value: unknown): MemoryDraft {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Souvenir invalide.');
  const input = value as Record<string, unknown>;
  if (typeof input.content !== 'string' || input.content.trim().length < 3 || input.content.length > 4000
    || !MEMORY_CATEGORIES.includes(input.category as never) || !['explicit', 'inference'].includes(String(input.origin))
    || typeof input.source !== 'string' || !input.source.trim() || input.source.length > 300) throw new Error('Contenu, catégorie ou provenance du souvenir invalide (3 à 4 000 caractères).');
  if (input.origin === 'inference' && (typeof input.confidence !== 'number' || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)) throw new Error('Une hypothèse doit indiquer une confiance entre 0 et 1.');
  if (input.origin === 'explicit' && input.confidence !== null) throw new Error('Un fait explicitement donné ne reçoit pas de score de confiance inventé.');
  return { content: input.content.trim(), category: input.category as MemoryDraft['category'], origin: input.origin as MemoryDraft['origin'], confidence: input.confidence as number | null, source: input.source.trim() };
}
export function parseMemoryWrite(value: unknown): MemoryWrite {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Modification de souvenir invalide.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['id', 'content', 'category', 'origin', 'confidence'].includes(key))) throw new Error('Champ de mémoire non autorisé.');
  if (input.id !== undefined && (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id))) throw new Error('Identifiant de souvenir invalide.');
  const { content, category, origin, confidence } = validateMemoryDraft({ ...input, source: 'gestion MEMORY par l’utilisateur' });
  return { content, category, origin, confidence, ...(input.id ? { id: input.id as string } : {}) };
}
export function explicitMemoryRequest(message: string, previousUserMessage?: string): string | null {
  // This recognizes only direct retention requests. No assistant-generated tool call can save a memory.
  const instruction = /\b(?:retiens|m[ée]morise|souviens[- ]toi|garde en m[ée]moire)\b/iu.exec(message);
  if (!instruction) return null;
  const before = message.slice(0, instruction.index).replace(/[\s,;:—-]+$/, '').trim();
  const after = message.slice(instruction.index + instruction[0].length)
    .replace(/^(?:[-\s]*(?:le|la|cela|ça|ceci|cette information|bien)\b)?\s*[:,.!]?\s*(?:que\s+)?/iu, '').trim();
  // A negated request cannot create a durable memory.
  if (/\b(?:ne|pas|jamais)\s*$/iu.test(before) || /\b(?:ne\s+(?:le\s+|la\s+)?)?(?:retiens|m[ée]morise)\s+(?:pas|jamais)\b/iu.test(message)) return null;
  const preamble = /^(?:s['’]il (?:te|vous) plaît|merci|je (?:voudrais|veux|souhaite) que tu|peux[- ]tu|tu peux)$/iu.test(before);
  const candidate = before.length >= 8 && !preamble ? before : after.replace(/[.!?]+$/, '').trim();
  if (candidate.length >= 8) return candidate.slice(0, 4000);
  if (previousUserMessage && previousUserMessage.trim().length >= 8) return previousUserMessage.trim().slice(0, 4000);
  return null;
}
