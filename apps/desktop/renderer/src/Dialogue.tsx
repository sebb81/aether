import { useEffect, useRef, useState } from 'react';
import type { AiConfigurationView } from '@aether/shared';
import { useMind } from './useMind';
import { CuriosityNotice } from './CuriosityNotice';

const STATE_LABEL = { idle: 'À votre écoute', listening: 'À votre écoute', thinking: 'Réflexion en cours', replying: 'Réponse reçue', error: 'Échange interrompu' };
export function Dialogue() {
  const { snapshot, error } = useMind();
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [configuration, setConfiguration] = useState<AiConfigurationView | null>(null);
  const scrollEnd = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const thinking = snapshot?.state === 'thinking';
  useEffect(() => {
    void window.aether.getAiConfiguration().then(setConfiguration).catch(reason => setSendError(String(reason)));
  }, [snapshot?.notice]);
  useEffect(() => { scrollEnd.current?.scrollIntoView({ block: 'end' }); }, [snapshot?.messages, snapshot?.error, snapshot?.storedMemory]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === 'Escape') void window.aether.command('close-dialogue'); }
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, []);
  async function submit() {
    if (!message.trim() || thinking) return;
    const text = message; setMessage(''); setSendError(null);
    try { const result = await window.aether.sendMessage(text); if (!result.ok) setSendError(result.error); }
    catch (reason) { setSendError(String(reason)); }
    finally { input.current?.focus(); }
  }
  return <main className="dialogue-page" data-mind-state={snapshot?.state ?? 'idle'}>
    <header className="dialogue-header"><div><span className="dialogue-spark">◌</span><strong>ENTITY</strong><span className="dialogue-state">{STATE_LABEL[snapshot?.state ?? 'idle']}</span></div><button className="icon-button" aria-label="Fermer l’échange" onClick={() => { void window.aether.command('close-dialogue'); }}>×</button></header>
    <div className="dialogue-tools"><span>{configuration?.provider === 'ollama' ? `Ollama local · ${configuration.model}` : configuration?.provider === 'openai' ? `OpenAI · ${configuration.model}` : 'IA non configurée'}</span><button className="text-button" onClick={() => { void window.aether.command('settings'); }}>Réglages</button><button className="text-button" onClick={() => { void window.aether.command('memory'); }}>MEMORY</button></div>
    <section className="dialogue-content" aria-label="Échange avec ENTITY" aria-live="polite">
      <CuriosityNotice />
      {!snapshot?.messages.length && <div className="dialogue-empty"><p>Un moment avec ENTITY</p><span>Posez une question, ou confiez une information avec « Retiens que… ».</span><small>Les échanges restent temporaires. MEMORY conserve vos souvenirs ; CURIOSITY conserve ses réflexions autorisées.</small></div>}
      {snapshot?.notice && <p className="dialogue-notice">{snapshot.notice}</p>}
      {snapshot?.messages.map(item => <article className={`dialogue-message ${item.role}`} key={item.id}><span className="message-author">{item.role === 'user' ? 'VOUS' : 'ENTITY'}</span><p>{item.content}</p>{item.model && <small className="model-source">{item.model}</small>}</article>)}
      {snapshot?.storedMemory && <p className="memory-receipt">Souvenir enregistré localement : {snapshot.storedMemory.content}</p>}
      {thinking && <p className="thinking-indicator" role="status"><span />Le modèle prépare sa réponse…</p>}
      {(snapshot?.error || sendError || error) && <p className="dialogue-error" role="alert">{snapshot?.error || sendError || error}</p>}
      {!!snapshot?.usedMemories.length && <p className="context-receipt">{snapshot.usedMemories.length} souvenir{snapshot.usedMemories.length > 1 ? 's' : ''} utilisé{snapshot.usedMemories.length > 1 ? 's' : ''} pour cette réponse.</p>}
      <div ref={scrollEnd} />
    </section>
    <form className="dialogue-compose" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <textarea ref={input} aria-label="Message à ENTITY" placeholder="Écrire à ENTITY…" maxLength={4000} value={message} disabled={thinking} rows={2}
        onFocus={() => { if (!thinking) void window.aether.mindControl('listening'); }}
        onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} />
      <div className="compose-actions"><button type="button" className="text-button" disabled={thinking} onClick={() => { setSendError(null); void window.aether.mindControl('new-conversation'); }}>Nouvel échange</button><span>Échap pour fermer</span>{thinking ? <button type="button" className="secondary" onClick={() => { void window.aether.mindControl('cancel'); }}>Annuler</button> : <button type="submit" disabled={!message.trim()}>Envoyer</button>}</div>
    </form>
  </main>;
}
