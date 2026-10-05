import { useEffect, useState } from 'react';
import type { AiConfigurationView } from '@aether/shared';

export function AiSettings() {
  const [configuration, setConfiguration] = useState<AiConfigurationView | null>(null);
  const [key, setKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [result, setResult] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void window.aether.getAiConfiguration().then(setConfiguration).catch(reason => setResult({ error: true, text: String(reason) })); }, []);
  async function save(removeKey = false) {
    if (!configuration) return;
    setBusy(true); setResult(null);
    // Clear the field immediately. The persisted secret is never returned to the renderer.
    const enteredKey = removeKey ? '' : key; setKey('');
    try {
      const response = await window.aether.saveAiConfiguration({ provider: configuration.provider, model: configuration.model, ollamaUrl: configuration.ollamaUrl, cloudConsent: configuration.cloudConsent, ...(enteredKey ? { apiKey: enteredKey } : {}), ...(removeKey ? { removeKey: true } : {}) });
      if (response.ok) { setConfiguration(await window.aether.getAiConfiguration()); setResult({ error: false, text: 'Configuration IA enregistrée. Elle sera conservée au redémarrage.' }); }
      else setResult({ error: true, text: response.error });
    } catch (reason) { setResult({ error: true, text: String(reason) }); }
    finally { setBusy(false); }
  }
  return <section className="ai-settings" aria-labelledby="ai-title"><h2 id="ai-title">MIND · Fournisseur IA</h2><p className="subtle">Le dialogue utilise uniquement le fournisseur choisi. Aucune réponse n’est simulée.</p>
    {configuration && <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <label htmlFor="ai-provider">Fournisseur</label><select id="ai-provider" value={configuration.provider} onChange={event => { const provider = event.target.value as AiConfigurationView['provider']; setConfiguration({ ...configuration, provider, model: provider === configuration.provider ? configuration.model : provider === 'openai' ? 'gpt-6-astra' : provider === 'ollama' ? 'llama3.1:8b' : '' }); setModels([]); }}>
        <option value="disabled">Aucun — désactivé</option><option value="ollama">Ollama · local</option><option value="openai">OpenAI · cloud</option>
      </select>
      {configuration.provider === 'ollama' && <><label htmlFor="ollama-url">Adresse locale Ollama</label><input id="ollama-url" value={configuration.ollamaUrl} onChange={event => setConfiguration({ ...configuration, ollamaUrl: event.target.value })} /><button type="button" className="secondary model-discovery" disabled={busy} onClick={async () => {
        setBusy(true); setResult(null);
        try { const response = await window.aether.listOllamaModels(configuration.ollamaUrl); if (response.ok) { setModels(response.models); setResult({ error: !response.models.length, text: response.models.length ? `${response.models.length} modèles installés trouvés.` : 'Aucun modèle installé. Installez un modèle dans Ollama.' }); } else setResult({ error: true, text: response.error }); }
        catch (reason) { setResult({ error: true, text: String(reason) }); } finally { setBusy(false); }
      }}>Rechercher les modèles installés</button></>}
      {configuration.provider !== 'disabled' && <><label htmlFor="ai-model">Modèle</label><input id="ai-model" list="installed-models" value={configuration.model} onChange={event => setConfiguration({ ...configuration, model: event.target.value })} /><datalist id="installed-models">{models.map(model => <option key={model} value={model} />)}</datalist></>}
      {configuration.provider === 'openai' && <><label htmlFor="openai-key">Clé API OpenAI</label><input id="openai-key" type="password" autoComplete="off" spellCheck={false} value={key} placeholder={configuration.keyConfigured ? 'Clé déjà configurée · saisir pour remplacer' : 'Saisir une clé API'} onChange={event => setKey(event.target.value)} />
        <p className="helper">{configuration.secureStorageAvailable ? 'La clé saisie est chiffrée par le système Windows. Elle ne sera jamais affichée à nouveau.' : 'Stockage sécurisé indisponible : aucune clé ne sera enregistrée en clair.'}</p>
        {configuration.keyConfigured && <button type="button" className="text-button" disabled={busy} onClick={() => { void save(true); }}>Supprimer la clé configurée</button>}
        <label className="cloud-consent"><input id="cloud-consent" type="checkbox" checked={configuration.cloudConsent} onChange={event => setConfiguration({ ...configuration, cloudConsent: event.target.checked })} /><span>J’autorise l’envoi de mes messages et des souvenirs pertinents à OpenAI pour les réponses.</span></label>
      </>}
      <div className="form-actions"><p className={result?.error ? 'error-message' : 'saved-message'} role={result?.error ? 'alert' : 'status'}>{result?.text ?? ''}</p><button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer l’IA'}</button></div>
    </form>}
    {!configuration && result && <p role="alert" className="error-message">{result.text}</p>}
  </section>;
}
