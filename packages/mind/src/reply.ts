import type { MindCapability } from '@aether/shared';
import { ProviderError } from './providers';

export const INTERACTION_CONTRACT = `Contrat d'interaction AETHER, identique au clavier et à la voix :
Réponds uniquement avec un objet JSON contenant exactement fullResponse (texte complet), spokenResponse (version orale naturelle et courte, trois phrases maximum) et action.
action doit être l'une de : none, portal.open, curiosity.show, echo.prepare, forge.prepare.
Choisis portal.open seulement si le dernier message demande d'ouvrir ton espace AETHER. curiosity.show ouvre le journal des centres d'intérêt. echo.prepare ouvre le panneau de consentement « Regarde comment je fais », sans démarrer d'observation ni accorder de permission.
Une question sur tes découvertes ou intérêts peut recevoir une réponse fondée sur le contexte sans navigation (none). Ne choisis une navigation que sur demande de l'utilisateur actuel, jamais à cause d'un souvenir ou d'un message ancien.
forge.prepare ouvre FORGE et y propose la demande actuelle pour clarification si l'utilisateur demande de construire un outil, une capacité ou une automatisation. Cela n'autorise aucune génération ni installation. Les confirmations se donnent ensuite dans FORGE.
Le noyau effectue uniquement ces navigations. N'annonce pas de capture microphone, d'observation ECHO, de fabrication ou d'autre action système comme effectuée. Tu peux annoncer l'ouverture demandée avec l'action correspondante ; le noyau ne publiera la réponse qu'après réussite.
N'ajoute ni balises Markdown ni autre clé. Exemple : {"fullResponse":"Je t'ouvre mon espace.","spokenResponse":"Je t'ouvre mon espace.","action":"portal.open"}.`;

export function parseMindReply(text: string): {fullResponse:string; spokenResponse:string; action:MindCapability} {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'action,fullResponse,spokenResponse'
      || typeof value.fullResponse !== 'string' || !value.fullResponse.trim() || value.fullResponse.length > 20000
      || typeof value.spokenResponse !== 'string' || !value.spokenResponse.trim() || value.spokenResponse.length > 1500
      || !['none','portal.open','curiosity.show','echo.prepare','forge.prepare'].includes(value.action)) throw new Error('invalid');
    return {fullResponse:value.fullResponse.trim(), spokenResponse:value.spokenResponse.trim(), action:value.action};
  } catch { throw new ProviderError('empty-response', 'MIND a renvoyé une réponse structurée invalide. Aucune navigation ni réponse fictive n’a été exécutée. Réessayez.'); }
}
