import type { AetherEvents, EntityState, AvailableEntityState, Preferences, PresenceSnapshot } from '@aether/shared';
import { EventBus } from './events';

export const DENIED_PERMISSIONS = Object.freeze({
  microphone: false, camera: false, 'screen.capture': false, 'echo.observe': false,
  'files.read': false, 'files.write': false, network: false,
  'forge.generate': false, 'mirror.execute': false, 'capability.adopt': false,
} as const);
const FEATURES = Object.freeze({ presence: 'available', mind: 'not-implemented', echo: 'not-implemented', curiosity: 'not-implemented', memory: 'not-implemented', forge: 'not-implemented', mirror: 'not-implemented', portal: 'not-implemented', voice:'not-implemented', capabilities: 'not-implemented' } as const);

export class PresenceModel {
  readonly events = new EventBus<AetherEvents>();
  private state: AvailableEntityState = 'idle';
  private microphoneActive=false;
  private audioLevel=0;
  private notice: string | null = null;
  private shortcutRegistered = false;
  private cloudAllowed = false;
  private discoveryPending = false;
  private echoActive = false;
  constructor(private preferences: Preferences, private readonly mindAvailable = false, private readonly memoryAvailable = false, private readonly curiosityAvailable = false,private readonly portalAvailable=false,private readonly echoAvailable=false,private readonly voiceAvailable=false,private readonly liveAvailable=false,private readonly evolutionAvailable=false) {}
  snapshot(): PresenceSnapshot {
    return { state: this.state, microphoneActive:this.microphoneActive,audioLevel:this.audioLevel, preferences: structuredClone(this.preferences), notice: this.notice, discoveryPending:this.discoveryPending,echoActive:this.echoActive, shortcutRegistered: this.shortcutRegistered, features: { ...FEATURES, forge:this.evolutionAvailable?'available':'not-implemented',mirror:this.evolutionAvailable?'available':'not-implemented',capabilities:this.evolutionAvailable?'available':'not-implemented',mind: this.mindAvailable ? 'available' : 'not-implemented', memory: this.memoryAvailable ? 'available' : 'not-implemented',curiosity:this.curiosityAvailable?'available':'not-implemented',portal:this.portalAvailable?'available':'not-implemented',echo:this.echoAvailable?'available':'not-implemented',voice:this.voiceAvailable?'available':'not-implemented' }, permissions: { ...DENIED_PERMISSIONS, microphone:this.microphoneActive, network: this.cloudAllowed,'echo.observe':this.echoActive,'files.read':this.echoActive } };
  }
  setState(state: EntityState): void {
    if(this.evolutionAvailable&&['BUILDING','TESTING'].includes(state)){this.state=state as AvailableEntityState;this.publish();return;}
    if (this.liveAvailable && state.startsWith('LIVE_')) { this.state = state as AvailableEntityState; this.publish(); return; }
    if (state !== 'idle' && state !== 'attention' && !(this.mindAvailable && (state === 'thinking' || state === 'error')) && !(this.curiosityAvailable && state==='exploring') && !(this.echoAvailable && state==='observing') && !(this.voiceAvailable&&['listening','speaking','error'].includes(state))) throw new Error(`État ${state} indisponible : moteur non implémenté.`);
    this.state = state as AvailableEntityState; this.publish();
  }
  setPreferences(preferences: Preferences): void { this.preferences = structuredClone(preferences); this.publish(); }
  setNotice(notice: string | null): void { this.notice = notice; this.publish(); }
  setShortcutRegistered(registered: boolean): void { this.shortcutRegistered = registered; this.publish(); }
  setCloudAllowed(allowed: boolean): void { this.cloudAllowed = allowed; this.publish(); }
  setEchoActive(active:boolean):void{this.echoActive=this.echoAvailable&&active;this.publish();}
  setVoiceActivity(active:boolean,level:number):void{this.microphoneActive=this.voiceAvailable&&active;this.audioLevel=this.voiceAvailable?Math.max(0,Math.min(1,level)):0;this.publish();}
  setDiscoveryPending(pending: boolean): void { if(this.discoveryPending!==pending) {this.discoveryPending=pending;this.publish();} }
  private publish(): void { this.events.emit('presence.changed', this.snapshot()); }
}
