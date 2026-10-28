import {useEffect,useState} from 'react';
import type {VoiceSnapshot} from '@aether/shared';
import { LiveControls } from './LiveVoice';

export const voiceLabels={idle:'Microphone arrêté',starting:'Ouverture du micro…',listening:'À votre écoute · micro actif',transcribing:'Transcription locale…',processing:'ENTITY réfléchit…',synthesizing:'Préparation de la voix…',speaking:'ENTITY parle',error:'VOICE interrompue'};
export function useVoice(){
  const [snapshot,setSnapshot]=useState<VoiceSnapshot|null>(null);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{let active=true;const off=window.aether.onVoice(setSnapshot);void window.aether.getVoice().then(value=>{if(active)setSnapshot(value);}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;off();};},[]);
  return {snapshot,error};
}
export function VoiceControls(){
  const {snapshot,error}=useVoice();
  const busy=snapshot&&!['idle','error'].includes(snapshot.state);
  return <div className="voice-controls" data-voice-state={snapshot?.state??'idle'} data-microphone-active={snapshot?.microphoneActive?'true':'false'}>
    <button type="button" className={`secondary compact ${snapshot?.microphoneActive?'microphone-on':''}`} onClick={()=>{void window.aether.voiceControl('local');}}>{snapshot?.state==='listening'?'Terminer la prise':busy?'Interrompre':'Parler au micro'}</button>
    {busy&&<button type="button" className="text-button" onClick={()=>{void window.aether.voiceControl('stop');}}>Stop voix</button>}
    <button type="button" className="text-button" onClick={()=>{void window.aether.command('voice');}}>VOICE</button>
    <small aria-live="polite">{snapshot?voiceLabels[snapshot.state]:'VOICE'}{snapshot?.source==='test-fixture'?' · échantillon de test':''}</small>
    {snapshot?.microphoneActive&&<label className="voice-input-level">Niveau micro <meter aria-label="Niveau du microphone" min="0" max="1" value={Math.sqrt(snapshot.audioLevel)}/></label>}
    {snapshot?.notice&&<p className="voice-notice" role="status">{snapshot.notice}</p>}
    {snapshot?.state==='transcribing'&&<p className="voice-notice" role="status">Le traitement local peut prendre plusieurs dizaines de secondes à la première prise.</p>}
    {(snapshot?.error||error)&&<p className="error-message" role="alert">{snapshot?.error||error}</p>}
    <LiveControls />
  </div>;
}
