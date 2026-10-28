import type { LiveToolCall, LiveToolDeclaration, LiveToolResult } from '@aether/shared';

const declarations = [
  ['get_entity_status', 'État réel d’ENTITY, capacités, autonomie, ECHO et CURIOSITY.', null],
  ['search_memory', 'Recherche les seuls souvenirs locaux pertinents, en lecture seule.', 'query'],
  ['remember_explicitly', 'Propose un souvenir demandé explicitement ; confirmation humaine obligatoire.', 'content'],
  ['forget_memory', 'Propose de supprimer un souvenir par son identifiant réel ; confirmation humaine obligatoire.', 'id'],
  ['get_curiosity_summary', 'Résumé concis des intérêts, questions, explorations et découvertes persistants.', null],
  ['get_interest_details', 'Historique borné d’un intérêt identifié dans le résumé.', 'id'],
  ['open_space', 'Ouvre réellement PORTAL et SPACE.', null],
  ['close_space', 'Ferme réellement SPACE et revient au bureau.', null],
  ['start_echo_guided', 'Ouvre le workflow ECHO de consentement ; ne démarre jamais une observation.', null],
  ['stop_echo', 'Arrête la session ECHO existante.', null],
  ['delegate_deep_reasoning', 'Demande à MIND une réflexion approfondie via DEEP et Qwen local.', 'prompt'],
  ['prepare_forge_request', 'Ouvre FORGE avec la demande explicite actuelle pour clarification. Ne lance aucune fabrication ni installation.', 'description'],
] as const;
export const LIVE_TOOLS: LiveToolDeclaration[] = declarations.map(([name, description, argument]) => ({ name, description, parameters: { type: 'object', properties: argument ? { [argument]: { type: 'string', description: argument } } : {}, required: argument ? [argument] : [], additionalProperties: false } }));
export interface ToolBridgePorts {
  allowed(): boolean;
  invoke(name: string, args: Record<string, string>, signal: AbortSignal): Promise<LiveToolResult>;
}
export class AetherToolBridge {
  constructor(private readonly ports: ToolBridgePorts) {}
  async call(call: LiveToolCall, signal: AbortSignal): Promise<LiveToolResult> {
    if (!this.ports.allowed() || signal.aborted) return { status: 'denied', reason: 'Session ou consentement LIVE absent.' };
    const declaration = LIVE_TOOLS.find(d => d.name === call.name);
    if (!declaration || !call.id || call.id.length > 200 || !call.args || typeof call.args !== 'object' || Array.isArray(call.args)) return { status: 'denied', reason: 'Outil ou arguments non autorisés.' };
    const args = call.args as Record<string, unknown>;
    if (Object.keys(args).some(k => !declaration.parameters.required.includes(k)) || declaration.parameters.required.some(k => typeof args[k] !== 'string' || !(args[k] as string).trim() || (args[k] as string).length > (k === 'query' ? 300 : k === 'id' ? 36 : 4000))) return { status: 'denied', reason: 'Arguments invalides.' };
    if ('id' in args && !/^[a-f0-9-]{36}$/.test(String(args.id))) return { status: 'denied', reason: 'Identifiant invalide.' };
    try {
      const result = await this.ports.invoke(call.name, args as Record<string, string>, signal);
      if (signal.aborted || !this.ports.allowed()) return { status: 'denied', reason: 'Session révoquée ou appel interrompu.' };
      if (JSON.stringify(result).length > 18000) return { status: 'error', reason: 'Résultat trop volumineux ; aucune donnée transmise.' };
      return result;
    } catch { return { status: 'error', reason: 'La fonction AETHER a échoué. Aucune réussite ne peut être annoncée.' }; }
  }
}
