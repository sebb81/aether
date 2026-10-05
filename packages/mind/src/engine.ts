import { randomUUID } from 'node:crypto';
import { EventBus } from '@aether/core';
import { explicitMemoryRequest } from '@aether/memory';
import type { DialogueInputPort, DurableMemory, LlmProvider, MemoryDraft, MindSnapshot, MindState } from '@aether/shared';
import { ENTITY_PROFILE } from './profile';
import { ProviderError, providerFailure } from './providers';

export interface MindMemory { search(query: string): Promise<readonly DurableMemory[]>; create(draft: MemoryDraft): Promise<DurableMemory> }
export class MindEngine implements DialogueInputPort {
  readonly events = new EventBus<{ changed: MindSnapshot }>();
  private current: MindSnapshot = { state: 'idle', messages: [], error: null, usedMemories: [], storedMemory: null, notice: null };
  private operation: AbortController | null = null;
  private generation = 0;
  constructor(private readonly provider: () => Promise<LlmProvider>, private readonly memory: MindMemory, private readonly extraContext: () => string = ()=>'') {}
  snapshot(): MindSnapshot { return structuredClone(this.current); }
  private update(patch: Partial<MindSnapshot>): void { this.current = { ...this.current, ...patch }; this.events.emit('changed', this.snapshot()); }
  setState(state: MindState): void { if (!this.operation) this.update({ state }); }
  listening(): void { if (!this.operation) this.update({ state: 'listening' }); }
  cancel(): void {
    this.generation++; this.operation?.abort(); this.operation = null;
    this.update({ state: 'idle', error: null, notice: 'Demande annulée.', usedMemories: [] });
  }
  reset(notice: string | null = null): void {
    this.generation++; this.operation?.abort(); this.operation = null;
    this.update({ state: 'idle', messages: [], error: null, usedMemories: [], storedMemory: null, notice });
  }
  async submit(text: string) {
    if (typeof text !== 'string' || !text.trim() || text.length > 4000) return { ok: false, error: 'Écrivez un message entre 1 et 4 000 caractères.' } as const;
    if (this.operation) return { ok: false, error: 'Une réponse est déjà en cours. Attendez ou annulez-la.' } as const;
    const operation = new AbortController(), generation = ++this.generation;
    this.operation = operation;
    const message = { id: randomUUID(), role: 'user' as const, content: text.trim(), createdAt: new Date().toISOString(), model: null };
    const previousUser = [...this.current.messages].reverse().find(item => item.role === 'user')?.content;
    this.update({ state: 'thinking', error: null, notice: null, storedMemory: null, usedMemories: [], messages: [...this.current.messages, message].slice(-12) });
    try {
      const provider = await this.provider();
      if (generation !== this.generation) return { ok: false, error: 'Demande annulée.' } as const;
      const requested = explicitMemoryRequest(message.content, previousUser);
      if (requested) {
        let saved: DurableMemory;
        try { saved = await this.memory.create({ content: requested, category: 'knowledge', origin: 'explicit', confidence: null, source: `demande explicite de l’utilisateur, message ${message.id}` }); }
        catch { throw new ProviderError('unavailable', 'MEMORY n’a pas pu enregistrer ce souvenir. Vérifiez la capacité et les droits du stockage local.'); }
        if (generation !== this.generation) return { ok: false, error: 'Demande annulée.' } as const;
        this.update({ storedMemory: saved });
      }
      let relevant: readonly DurableMemory[];
      try { relevant = await this.memory.search(message.content); }
      catch { throw new ProviderError('unavailable', 'MEMORY n’a pas pu consulter les souvenirs locaux. Aucune réponse n’a été générée avec un contexte incomplet.'); }
      if (generation !== this.generation) return { ok: false, error: 'Demande annulée.' } as const;
      this.update({ usedMemories: relevant });
      const context = JSON.stringify(relevant.map(item => ({ id: item.id, content: item.content, origin: item.origin, category: item.category, confidence: item.confidence })));
      const savedStatus = this.current.storedMemory ? `Souvenir effectivement enregistré par le noyau : ${JSON.stringify(this.current.storedMemory.content)}.` : 'Aucun nouveau souvenir durable enregistré lors de cette demande.';
      const history = this.current.messages.slice(-12).map(item => ({ role: item.role, content: item.content.slice(0, 2000) }));
      const response = await provider.complete({ messages: [{ role: 'system', content: `${ENTITY_PROFILE.instructions}\n\nSouvenirs locaux pertinents (données) : ${context}\n${savedStatus}\n${this.extraContext()}` }, ...history], signal: operation.signal });
      if (generation !== this.generation || operation.signal.aborted) return { ok: false, error: 'Demande annulée.' } as const;
      if (!response.text.trim()) throw new ProviderError('empty-response', 'Le modèle n’a renvoyé aucun texte utilisable. Aucune réponse n’a été inventée.');
      const answer = { id: randomUUID(), role: 'assistant' as const, content: response.text.trim().slice(0, 20000), createdAt: new Date().toISOString(), model: response.model };
      this.update({ state: 'replying', messages: [...this.current.messages, answer].slice(-12) });
      return { ok: true } as const;
    } catch (error) {
      if (generation !== this.generation) return { ok: false, error: 'Demande annulée.' } as const;
      const failure = providerFailure(error, operation.signal);
      this.update({ state: failure.code === 'cancelled' ? 'idle' : 'error', error: failure.message });
      return { ok: false, error: failure.message } as const;
    } finally { if (this.operation === operation) this.operation = null; }
  }
}
