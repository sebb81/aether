import { useCallback, useEffect, useState } from 'react';
import type { DurableMemory, MemoryCategory, MemoryWrite } from '@aether/shared';

const CATEGORY_LABELS: Record<MemoryCategory, string> = { profile: 'Profil', preference: 'Préférence', project: 'Projet', knowledge: 'Connaissance', experience: 'Expérience' };
const EMPTY_DRAFT: MemoryWrite = { content: '', category: 'knowledge', origin: 'explicit', confidence: null };
export function Memory({embedded=false}:{embedded?:boolean}={}) {
  const [memories, setMemories] = useState<DurableMemory[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<MemoryWrite | null>(null);
  const [deletion, setDeletion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { setMemories(await window.aether.listMemories(query)); } catch (reason) { setError(String(reason)); } }, [query]);
  useEffect(() => {
    void refresh();
    const mind=window.aether.onMind(() => { void refresh(); }),echo=window.aether.onEcho(()=>{void refresh();});return ()=>{mind();echo();};
  }, [refresh]);
  return <main className={`memory-page ${embedded?'memory-embedded':''}`}>
    <header className="brand"><span className="brand-mark">◌</span><span>AETHER</span><span className="version">FIRST LIFE · 02</span></header>
    <section className="memory-intro"><p className="eyebrow">MEMORY</p><h1>Ce qu’ENTITY retient</h1><p className="subtle">Les souvenirs sont locaux. Une conversation n’est jamais transformée automatiquement en mémoire durable.</p></section>
    <div className="memory-toolbar"><input aria-label="Rechercher un souvenir" placeholder="Rechercher un souvenir…" maxLength={300} value={query} onChange={event => setQuery(event.target.value)} /><button className="secondary" onClick={() => { setDraft({ ...EMPTY_DRAFT }); setError(null); }}>Ajouter</button><button className="text-button" onClick={async () => { try { const result = await window.aether.exportMemories(); if (!result.ok) setError(result.error); } catch (reason) { setError(String(reason)); } }}>Exporter</button></div>
    {error && <p className="notice" role="alert">{error}</p>}{notice && <p className="saved-message" role="status">{notice}</p>}
    {draft && <form className="memory-editor" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError(null);
      try { const result = await window.aether.writeMemory(draft); if (result.ok) { setDraft(null); setNotice('Souvenir enregistré. Le contexte de conversation a été effacé pour utiliser la version actuelle.'); await refresh(); } else setError(result.error); }
      catch (reason) { setError(String(reason)); } finally { setBusy(false); }
    }}>
      <h2>{draft.id ? 'Corriger ce souvenir' : 'Ajouter un souvenir'}</h2><label htmlFor="memory-content">Contenu</label><textarea id="memory-content" rows={3} maxLength={4000} required value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} />
      <div className="memory-editor-options"><div><label htmlFor="memory-category">Catégorie</label><select id="memory-category" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as MemoryCategory })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
        <div><label htmlFor="memory-origin">Nature</label><select id="memory-origin" value={draft.origin} onChange={event => setDraft({ ...draft, origin: event.target.value as 'explicit' | 'inference', confidence: event.target.value === 'inference' ? 0.5 : null })}><option value="explicit">Information explicitement donnée</option><option value="inference">Hypothèse / déduction</option></select></div></div>
      {draft.origin === 'inference' && <><label htmlFor="memory-confidence">Confiance de l’hypothèse (0 à 1, estimation à renseigner)</label><input id="memory-confidence" type="number" min="0" max="1" step="0.05" value={draft.confidence ?? 0.5} onChange={event => setDraft({ ...draft, confidence: Number(event.target.value) })} /></>}
      <div className="memory-editor-actions"><button type="button" className="text-button" onClick={() => setDraft(null)}>Annuler</button><button type="submit" disabled={busy}>Enregistrer le souvenir</button></div>
    </form>}
    <p className="memory-count">{memories.length} souvenir{memories.length > 1 ? 's' : ''}{query ? ' trouvé(s)' : ' durable(s)'}</p>
    {!memories.length && <p className="memory-empty">{query ? 'Aucun souvenir ne correspond à cette recherche.' : 'Aucun souvenir durable. Vous pouvez en ajouter ici ou demander à ENTITY « Retiens que… ».'}</p>}
    <section className="memory-list" aria-label="Souvenirs durables">{memories.map(memory => <article className="memory-item" key={memory.id}>
      <div className="memory-meta"><span>{CATEGORY_LABELS[memory.category]}</span><span className={`origin-badge ${memory.origin}`}>{memory.origin === 'explicit' ? 'Donné explicitement' : `Hypothèse · confiance ${memory.confidence}`}</span></div>
      <p className="memory-content">{memory.content}</p><p className="memory-source">Créé le {new Date(memory.createdAt).toLocaleDateString('fr-FR')} · {memory.source}</p>
      {memory.updatedAt !== memory.createdAt && <p className="memory-source">Modifié le {new Date(memory.updatedAt).toLocaleString('fr-FR')}</p>}
      <div className="memory-item-actions">{memory.kind==='habit'?<button className="text-button" onClick={()=>void window.aether.command('echo')}>Corriger l’habitude dans ECHO</button>:<button className="text-button" onClick={() => { setError(null); setDraft({ id: memory.id, content: memory.content, category: memory.category, origin: memory.origin, confidence: memory.confidence }); }}>Corriger</button>}
        {deletion === memory.id ? <><span>Supprimer ce souvenir ?</span><button className="danger-button" onClick={async () => { setError(null); try { const result = await window.aether.removeMemory(memory.id); if (result.ok) { setDeletion(null); setNotice('Souvenir supprimé. Le contexte de conversation a été effacé.'); await refresh(); } else setError(result.error); } catch (reason) { setError(String(reason)); } }}>Confirmer la suppression</button><button className="text-button" onClick={() => setDeletion(null)}>Annuler</button></> : <button className="text-button" onClick={() => setDeletion(memory.id)}>Supprimer</button>}
      </div>
    </article>)}</section>
    <footer><p>Une correction ou suppression efface le contexte de l’échange en cours et annule une réponse pendante. Le prochain échange utilisera uniquement la mémoire actuelle.</p></footer>
  </main>;
}
