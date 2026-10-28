import {useEffect,useState} from 'react';
import type {VoiceInventory,VoiceSettingsWrite} from '@aether/shared';
import {useVoice,VoiceControls} from './VoiceControls';

export function Voice(){
  const {snapshot,error}=useVoice();
  const [draft,setDraft]=useState<VoiceSettingsWrite|null>(null);
  const [inventory,setInventory]=useState<VoiceInventory|null>(null);
  const [result,setResult]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const settingsKey=JSON.stringify(snapshot?.settings);
  useEffect(()=>{if(snapshot){const {schemaVersion:_,microphoneConsent:__,...write}=snapshot.settings;setDraft(write);}},[settingsKey]);
  async function refresh(){try{setInventory(await window.aether.getVoiceInventory());}catch(reason){setResult(String(reason));}}
  useEffect(()=>{void refresh();},[]);
  function patch<K extends keyof VoiceSettingsWrite>(key:K,value:VoiceSettingsWrite[K]){setDraft(current=>current?{...current,[key]:value}:current);setResult(null);}
  async function save(){if(!draft)return false;setSaving(true);try{const reply=await window.aether.saveVoiceSettings(draft);setResult(reply.ok?'Réglages VOICE enregistrés.':reply.error);return reply.ok;}catch(reason){setResult(String(reason));return false;}finally{setSaving(false);}}
  async function consent(decision:'grant'|'deny'){if(decision==='grant'&&!await save())return;const reply=await window.aether.voiceConsent(decision);setResult(reply.ok?(decision==='grant'?'Microphone autorisé. Cliquez sur « Parler au micro » pour démarrer une prise.':'Microphone refusé. Aucune capture autorisée.'):reply.error);}
  async function choose(kind:'python'|'model'){const reply=await window.aether.chooseVoiceResource(kind);if(reply.path)patch(kind==='python'?'pythonPath':'modelPath',reply.path);}
  if(!snapshot||!draft)return <p role="status">{error??'Chargement de VOICE…'}</p>;
  const microphoneMissing=inventory!==null&&draft.microphone!=='default'&&!inventory.microphones.some(device=>device.id===draft.microphone);
  return <main className="voice-page" data-voice-state={snapshot.state} data-microphone-active={snapshot.microphoneActive?'true':'false'}>
    <header className="settings-header"><span className="wordmark">AETHER</span><span className="version">VOICE · 5.5</span></header>
    <p className="eyebrow">UNE VOIX, LA MÊME PRÉSENCE</p><h1>Parler avec ENTITY</h1><p className="subtle">Votre voix rejoint la conversation, les souvenirs et la curiosité d’ENTITY. Traitement audio local.</p>
    <section className="voice-consent" aria-label="Consentement microphone"><h2>Votre microphone, votre choix</h2><p>Une prise commence uniquement avec le bouton ou le raccourci. Elle se termine sur votre action, après un silence ou au plus tard après 60 secondes. Aucun extrait audio conservé par défaut.</p>
      <p className="helper">Autorisation : {snapshot.settings.microphoneConsent==='granted'?'accordée':snapshot.settings.microphoneConsent==='denied'?'refusée':'à demander'}. Microphone : {snapshot.microphoneActive?'ACTIF':'arrêté'}.</p>
      <div className="voice-actions"><button disabled={saving} onClick={()=>{void consent('grant');}}>Autoriser le microphone</button><button className="secondary" onClick={()=>{void consent('deny');}}>Refuser le microphone</button></div>
    </section>
    <VoiceControls/>
    <form onSubmit={event=>{event.preventDefault();void save();}}>
      <section className="setting-section"><h2>Entrée</h2>
        <label className="voice-check"><input type="checkbox" checked={draft.enabled} onChange={event=>patch('enabled',event.target.checked)}/>Activer VOICE</label>
        <label htmlFor="voice-microphone">Microphone</label><select id="voice-microphone" value={draft.microphone} onChange={event=>patch('microphone',event.target.value)}><option value="default">Microphone par défaut de Windows</option>{microphoneMissing&&<option value={draft.microphone}>Microphone enregistré indisponible</option>}{inventory?.microphones.map(device=><option key={device.id} value={device.id}>{device.name} · {device.host}</option>)}</select>
        {microphoneMissing&&<p className="error-message" role="alert">Le microphone enregistré n’est plus disponible. Reconnectez-le ou choisissez « Microphone par défaut de Windows », puis enregistrez VOICE.</p>}
        <div className="voice-grid"><label>Langue<input aria-label="Langue VOICE" value={draft.language} maxLength={20} onChange={event=>patch('language',event.target.value)}/></label><label>Raccourci push-to-talk<input aria-label="Raccourci VOICE" readOnly value={draft.shortcut} onKeyDown={event=>{if(event.key==='Tab')return;event.preventDefault();const mods=[event.ctrlKey&&'Control',event.altKey&&'Alt',event.shiftKey&&'Shift',event.metaKey&&'Super'].filter(Boolean);const key=/^(Key[A-Z]|Digit[0-9])$/.test(event.code)?event.code.replace(/^(Key|Digit)/,''):event.code==='Space'?'Space':/^F\d{1,2}$/.test(event.key)?event.key:null;if(key&&mods.some(m=>m!=='Shift'))patch('shortcut',[...mods,key].join('+'));}}/></label></div>
        <p className="helper">Une pression démarre ; une autre termine la prise. Pendant la réponse, le raccourci l’interrompt. {snapshot.shortcutRegistered?'Raccourci actif.':'Raccourci indisponible.'}</p>
        <label className="voice-check"><input type="checkbox" checked={false} disabled/>Wake word « Aether » · extension suivante</label><p className="helper">Aucune écoute permanente. L’interruption par la voix reste une extension future.</p>
      </section>
      <section className="setting-section"><h2>Sortie</h2><label className="voice-check"><input type="checkbox" checked={draft.ttsEnabled} onChange={event=>patch('ttsEnabled',event.target.checked)}/>Activer les réponses orales</label>
        <label htmlFor="voice-voice">Voix locale</label><select id="voice-voice" value={draft.voice} onChange={event=>patch('voice',event.target.value)}><option value="">Selon la langue</option>{draft.voice&&!inventory?.voices.some(v=>v.id===draft.voice)&&<option value={draft.voice}>{draft.voice}</option>}{inventory?.voices.map(v=><option key={v.id} value={v.id}>{v.name} · {v.language}</option>)}</select>
        <div className="voice-grid"><label>Vitesse · {draft.speed.toFixed(2)}<input aria-label="Vitesse VOICE" type="range" min="0.6" max="1.6" step="0.05" value={draft.speed} onChange={event=>patch('speed',Number(event.target.value))}/></label><label>Volume · {Math.round(draft.volume*100)} %<input aria-label="Volume VOICE" type="range" min="0" max="1" step="0.05" value={draft.volume} onChange={event=>patch('volume',Number(event.target.value))}/></label></div>
        <label htmlFor="voice-policy">Réponses vocales</label><select id="voice-policy" value={draft.responsePolicy} onChange={event=>patch('responsePolicy',event.target.value as VoiceSettingsWrite['responsePolicy'])}><option value="voice-only">Seulement lorsque je lui parle</option><option value="always">Toujours</option><option value="never">Jamais</option></select>
        <button type="button" className="secondary" onClick={async()=>{if(await save())void window.aether.voiceControl('test-voice');}}>Écouter cette voix</button>
      </section>
      <section className="setting-section"><h2>Fournisseurs et confidentialité</h2><p className="helper">STT et TTS restent sur ce poste. Aucun fournisseur audio cloud configuré.</p>
        <div className="voice-grid"><label>Fournisseur STT<select aria-label="Fournisseur STT" value={draft.sttProvider} onChange={event=>patch('sttProvider',event.target.value as VoiceSettingsWrite['sttProvider'])}><option value="faster-whisper">faster-whisper · local</option><option value="disabled">Aucun fournisseur STT</option></select></label><label>Fournisseur TTS<select aria-label="Fournisseur TTS" value={draft.ttsProvider} onChange={event=>patch('ttsProvider',event.target.value as VoiceSettingsWrite['ttsProvider'])}><option value="windows-speech">Windows Speech · local</option><option value="disabled">Aucun fournisseur TTS</option></select></label></div>
        <label>Python local<input aria-label="Python VOICE" value={draft.pythonPath} onChange={event=>patch('pythonPath',event.target.value)}/></label><button type="button" className="text-button" onClick={()=>{void choose('python');}}>Choisir Python…</button>
        <label>Modèle Whisper local<input aria-label="Modèle Whisper" value={draft.modelPath} onChange={event=>patch('modelPath',event.target.value)}/></label><button type="button" className="text-button" onClick={()=>{void choose('model');}}>Choisir le dossier du modèle…</button>
        <p className="helper">Aucun téléchargement automatique. Le moteur Python doit disposer de faster-whisper, sounddevice, NumPy et SciPy.</p><button type="button" className="secondary compact" onClick={()=>{void refresh();}}>Vérifier les fournisseurs</button>
        {inventory&&<p className="helper">STT : {inventory.sttAvailable?'modèle local trouvé':'indisponible'} · TTS : {inventory.ttsAvailable?'voix installées':'indisponible'} · {inventory.microphones.length} microphone(s)</p>}{inventory?.errors.map((message,i)=><p className="error-message" key={i}>{message}</p>)}
        <label className="voice-check"><input type="checkbox" checked={draft.diagnostics} onChange={event=>patch('diagnostics',event.target.checked)}/>Afficher les mesures de latence</label>
        <label className="voice-check"><input type="checkbox" checked={draft.retainDiagnosticAudio} onChange={event=>patch('retainDiagnosticAudio',event.target.checked)}/>Conserver temporairement les prises pour diagnostic</label><p className="helper">Option explicite : au maximum 5 prises, supprimées après 10 minutes. Désactiver efface les extraits existants.</p>
        {snapshot.diagnostics.length>0&&<div><p>{snapshot.diagnostics.length} extrait(s) temporaire(s)</p><button type="button" className="secondary" onClick={()=>{void window.aether.voiceControl('clear-diagnostics');}}>Supprimer les extraits audio</button></div>}
      </section>
      <div className="form-actions"><p role="status">{result??''}</p><button disabled={saving} type="submit">Enregistrer VOICE</button></div>
    </form>
    {snapshot.settings.diagnostics&&snapshot.metrics&&<section className="setting-section"><h2>Dernière chaîne vocale</h2><dl className="voice-metrics">{Object.entries(snapshot.metrics).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value===null?'—':`${value} ms`}</dd></div>)}</dl><p className="helper">Le premier son est mesuré depuis le déclenchement de la prise, selon l’horloge de sortie audio. La capture inclut votre temps de parole.</p></section>}
    {snapshot.transcription&&<p className="voice-transcription">Transcription : {snapshot.transcription}</p>}
    <footer><p className="helper">Hortense est la voix française Windows disponible sur ce poste. Changez de voix selon vos préférences ; aucune imitation ou détection émotionnelle.</p></footer>
  </main>;
}
