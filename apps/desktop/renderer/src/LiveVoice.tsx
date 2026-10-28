import { useEffect, useState } from 'react';
import type { LiveSettingsWrite, LiveSnapshot, OperationResult } from '@aether/shared';

export const liveLabels = { idle: 'LIVE arrêté', LIVE_CONNECTING: 'Connexion Gemini…', LIVE_LISTENING: 'À votre écoute · Gemini Live', LIVE_THINKING: 'ENTITY prépare sa réponse…', LIVE_DEEP_THINKING: 'MIND · réflexion DEEP locale…', LIVE_SPEAKING: 'ENTITY parle · Gemini Live', LIVE_INTERRUPTED: 'Réponse interrompue', LIVE_ERROR: 'LIVE indisponible' };
export function useLive() {
  const [snapshot,setSnapshot] = useState<LiveSnapshot|null>(null), [error,setError] = useState<string|null>(null);
  useEffect(()=>{let active=true;const off=window.aether.onLive(setSnapshot);void window.aether.getLive().then(value=>{if(active)setSnapshot(value);}).catch(()=>{if(active)setError('LIVE VOICE indisponible.');});return()=>{active=false;off();};},[]);
  return {snapshot,error};
}
export function LiveControls() {
  const {snapshot,error}=useLive(),[failure,setFailure]=useState<string|null>(null);
  if(!snapshot)return error?<small>{error}</small>:null;
  const active=snapshot.sessionId!==null;
  return <div className="live-controls" data-live-state={snapshot.state}>
    <button type="button" className="secondary compact" onClick={()=>{void window.aether.liveControl(active?'stop':'start').then(result=>setFailure(result.ok?null:result.error)).catch(()=>setFailure('Commande LIVE impossible.'));}}>{active?'Arrêter LIVE':'Conversation LIVE'}</button>
    <button type="button" className="text-button" onClick={()=>{void window.aether.command('live');}}>Réglages LIVE</button>
    <small aria-live="polite">{liveLabels[snapshot.state]}</small>
    {(failure||snapshot.error)&&<p className="error-message" role="alert">{failure||snapshot.error} <button type="button" className="text-button" onClick={()=>{void window.aether.voiceControl('local');}}>Choisir LOCAL</button></p>}
  </div>;
}
export function LiveVoice({standalone=false}:{standalone?:boolean}) {
  const {snapshot,error}=useLive(), [draft,setDraft]=useState<LiveSettingsWrite|null>(null), [key,setKey]=useState(''), [notice,setNotice]=useState<string|null>(null), [failure,setFailure]=useState<string|null>(null), [saving,setSaving]=useState(false), [ack,setAck]=useState(false);
  useEffect(()=>{if(snapshot){const {schemaVersion:_schema,provider:_provider,cloudConsent:_consent,...write}=snapshot.settings;setDraft(write);}},[JSON.stringify(snapshot?.settings)]);
  async function act(action:Promise<OperationResult>) { setFailure(null);try{const result=await action;if(!result.ok)setFailure(result.error);else setNotice('Action effectuée.');}catch{setFailure('Action impossible. Vérifiez les réglages.');} }
  const content=<section className="ai-settings live-settings" aria-label="LIVE VOICE">
    <p className="eyebrow">LIVE VOICE</p><h2>La voix naturelle d’ENTITY</h2>
    <p className="subtle">Gemini fournit la conversation audio. La mémoire, les intérêts, ECHO et la réflexion DEEP restent dans AETHER.</p>
    {snapshot&&draft&&<>
      <p className="live-status" role="status">Gemini Live : {snapshot.keyConfigured?'configuré':'non configuré'} · {liveLabels[snapshot.state]} · voix configurée : {snapshot.settings.voice}{snapshot.source==='test-fixture'?' · audio synthétique de recette, aucun microphone':''}</p>
      <form onSubmit={async event=>{event.preventDefault();setSaving(true);setFailure(null);try{const result=await window.aether.saveLiveSettings({...draft,...(key?{apiKey:key}:{})});if(result.ok){setKey('');setNotice('Réglages LIVE enregistrés.');}else setFailure(result.error);}catch{setFailure('Enregistrement LIVE impossible.');}finally{setSaving(false);}}}>
        <label className="checkbox-row"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>Activer Gemini Live</label>
        <p>Provider : Gemini · cloud</p>
        <label htmlFor={standalone?'live-model-panel':'live-model-settings'}>Modèle LIVE</label><input id={standalone?'live-model-panel':'live-model-settings'} value={draft.model} maxLength={120} onChange={e=>setDraft({...draft,model:e.target.value})}/>
        <label htmlFor={standalone?'live-voice-panel':'live-voice-settings'}>Voix Gemini</label><input id={standalone?'live-voice-panel':'live-voice-settings'} value={draft.voice} maxLength={50} onChange={e=>setDraft({...draft,voice:e.target.value})}/><p className="helper">Nom de voix fourni par Gemini, par exemple Kore. Sa disponibilité est vérifiée à la connexion.</p>
        <label htmlFor={standalone?'live-key-panel':'live-key-settings'}>Clé API Gemini</label><input id={standalone?'live-key-panel':'live-key-settings'} type="password" autoComplete="off" value={key} maxLength={500} placeholder="Conserver la clé actuelle" onChange={e=>setKey(e.target.value)}/>
        <p className="helper">{snapshot.secureStorageAvailable?'Stockage chiffré Windows disponible.':'Stockage chiffré indisponible ; configurez la variable GEMINI_API_KEY.'} La clé n’est jamais affichée.</p>
        <label className="checkbox-row"><input type="checkbox" checked={draft.showTranscription} onChange={e=>setDraft({...draft,showTranscription:e.target.checked})}/>Afficher la transcription dans le dialogue</label>
        <label className="checkbox-row"><input type="checkbox" checked={draft.automaticResponse} onChange={e=>setDraft({...draft,automaticResponse:e.target.checked})}/>Réponse automatique après ma prise de parole</label>
        <label htmlFor={standalone?'live-diagnostic-panel':'live-diagnostic-settings'}>Niveau de diagnostic</label><select id={standalone?'live-diagnostic-panel':'live-diagnostic-settings'} value={draft.diagnostics} onChange={e=>setDraft({...draft,diagnostics:e.target.value as LiveSettingsWrite['diagnostics']})}><option value="off">Désactivé</option><option value="basic">Latences</option><option value="detailed">Latences et journal des fonctions</option></select>
        <h3>Mode vocal par défaut</h3><label htmlFor={standalone?'live-default-panel':'live-default-settings'}>Mode au raccourci vocal</label><select id={standalone?'live-default-panel':'live-default-settings'} value={draft.defaultMode} onChange={e=>setDraft({...draft,defaultMode:e.target.value as LiveSettingsWrite['defaultMode']})}><option value="LOCAL">LOCAL</option><option value="LIVE">LIVE</option><option value="ASK">Demander à chaque session</option></select>
        <div className="form-actions"><button type="submit" disabled={saving}>{saving?'Enregistrement…':'Enregistrer LIVE'}</button><button type="button" className="text-button" onClick={()=>{void act(window.aether.saveLiveSettings({...draft,removeKey:true}));}}>Supprimer la clé Gemini</button></div>
      </form>
      <section className="live-consent" aria-label="Consentement cloud Gemini">
        <h3>Consentement cloud · {snapshot.settings.cloudConsent==='granted'?'autorisé':snapshot.settings.cloudConsent==='denied'?'révoqué':'à décider'}</h3>
        <p>LIVE nécessite Internet. Votre audio est transmis à Google Gemini pendant toute la session active, y compris lorsque ENTITY parle. Les outils peuvent transmettre les souvenirs pertinents, des résumés d’intérêts et de découvertes, le statut d’AETHER/ECHO et le résultat d’une réflexion DEEP demandée. Aucune base complète n’est envoyée.</p>
        <p>La transcription reste un journal de conversation temporaire ; elle ne crée pas de souvenir. Le microphone exige aussi le consentement séparé de VOICE.</p>
        {snapshot.settings.cloudConsent!=='granted'&&<label className="checkbox-row"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>J’autorise explicitement l’audio et les données nécessaires des outils vers Gemini</label>}
        {snapshot.settings.cloudConsent!=='granted'&&<button type="button" disabled={!ack} onClick={()=>{void act(window.aether.liveConsent('grant'));}}>Autoriser Gemini Live</button>}
        <button type="button" className="secondary" onClick={()=>{setAck(false);void act(window.aether.liveConsent('deny'));}}>Révoquer le consentement cloud</button>
        <button type="button" className="text-button" onClick={()=>{void window.aether.command('voice');}}>Microphone et mode LOCAL</button>
      </section>
      <div className="form-actions"><button type="button" disabled={snapshot.sessionId!==null} onClick={()=>{void act(window.aether.liveControl('start'));}}>Démarrer LIVE</button><button type="button" className="secondary" onClick={()=>{void act(window.aether.liveControl('stop'));}}>Arrêter LIVE</button><button type="button" className="text-button" onClick={()=>{void act(window.aether.liveControl('reconnect'));}}>Reconnecter LIVE</button></div>
      {!snapshot.settings.automaticResponse&&snapshot.sessionId&&<button type="button" onClick={()=>{void act(window.aether.liveControl('respond'));}}>Répondre maintenant</button>}
      <button type="button" className="text-button" onClick={()=>{void window.aether.command('dialogue');}}>Lire le dialogue</button>
      <button type="button" className="text-button" onClick={()=>{void act(window.aether.voiceControl('local'));}}>Parler en LOCAL</button>
      {snapshot.pending.map(p=><section className="live-confirmation" key={p.id}><h3>{p.tool==='remember_explicitly'?'Confirmer ce souvenir':'Confirmer la suppression'}</h3><p>{p.content}</p><button type="button" onClick={()=>{void act(window.aether.liveConfirm(p.id,true));}}>{p.tool==='remember_explicitly'?'Confirmer la mémorisation':'Confirmer la suppression du souvenir'}</button><button type="button" className="secondary" onClick={()=>{void act(window.aether.liveConfirm(p.id,false));}}>Refuser</button></section>)}
      {snapshot.settings.diagnostics!=='off'&&<details className="live-diagnostics"><summary>Diagnostic LIVE</summary><p>Session : {snapshot.sessionId??'fermée'} · reconnexions : {snapshot.reconnects}</p><ul>{snapshot.metrics.slice(-15).map((m,i)=><li key={i}>{m.kind}{m.tool?` · ${m.tool}`:''} : {Math.round(m.durationMs)} ms · {m.success?'OK':'échec'}</li>)}</ul>{snapshot.settings.diagnostics==='detailed'&&<ul>{snapshot.audit.slice(-15).map(a=><li key={a.id}>{a.tool} · {a.status} · {Math.round(a.durationMs)} ms</li>)}</ul>}</details>}
    </>}
    {(failure||snapshot?.error||error)&&<p className="error-message" role="alert">{failure||snapshot?.error||error}</p>}{notice&&<p className="saved-message" role="status">{notice}</p>}
  </section>;
  return standalone?<main className="settings-page live-page">{content}</main>:content;
}
