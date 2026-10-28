import type { CuriositySnapshot, DurableMemory } from '@aether/shared';
const short = (text: string, limit = 500) => text.slice(0, limit);
export function memoryProjection(memories: readonly DurableMemory[]) {
  return memories.slice(0, 5).map(item => ({ id: item.id, content: short(item.content, 1400), origin: item.origin, category: item.category, confidence: item.confidence }));
}
export function curiosityProjection(c: CuriositySnapshot) {
  return {
    state: c.state,
    interests: c.interests.filter(i => i.status === 'active').sort((a,b) => b.level-a.level).slice(0, 8).map(i => ({ id: i.id, title: short(i.title, 120), description: short(i.description, 280), level: i.level })),
    questions: c.items.filter(i => i.kind === 'question' && i.status === 'open').slice(-5).map(i => ({ interestId: i.interestId, content: short(i.content) })),
    explorations: c.explorations.filter(e => e.status === 'succeeded').slice(-4).map(e => ({ interestId: e.interestId, reason: short(e.reason), model: e.model, nextQuestion: e.nextQuestion ? short(e.nextQuestion) : null })),
    discoveries: c.items.filter(i => i.kind === 'discovery').slice(-5).map(i => ({ interestId: i.interestId, content: short(i.content), limits: i.limits ? short(i.limits, 200) : null })),
    limits: 'Synthèses du modèle local, pas des faits vérifiés sur Internet.',
  };
}
