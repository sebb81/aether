import type { AetherEvents, EntityState, Preferences, PresenceSnapshot } from '@aether/shared';
import { EventBus } from './events';

export const DENIED_PERMISSIONS = Object.freeze({
  microphone: false, camera: false, 'screen.capture': false, 'echo.observe': false,
  'files.read': false, 'files.write': false, network: false,
  'forge.generate': false, 'mirror.execute': false, 'capability.adopt': false,
} as const);
const FEATURES = Object.freeze({ presence: 'available', mind: 'not-implemented', echo: 'not-implemented', curiosity: 'not-implemented', memory: 'not-implemented', forge: 'not-implemented', mirror: 'not-implemented', portal: 'not-implemented', capabilities: 'not-implemented' } as const);

export class PresenceModel {
  readonly events = new EventBus<AetherEvents>();
  private state: 'idle' | 'attention' | 'thinking' | 'exploring' | 'error' = 'idle';
  private notice: string | null = null;
  private shortcutRegistered = false;
  private cloudAllowed = false;
  private discoveryPending = false;
  constructor(private preferences: Preferences, private readonly mindAvailable = false, private readonly memoryAvailable = false, private readonly curiosityAvailable = false) {}
  snapshot(): PresenceSnapshot {
    return { state: this.state, preferences: structuredClone(this.preferences), notice: this.notice, discoveryPending:this.discoveryPending, shortcutRegistered: this.shortcutRegistered, features: { ...FEATURES, mind: this.mindAvailable ? 'available' : 'not-implemented', memory: this.memoryAvailable ? 'available' : 'not-implemented',curiosity:this.curiosityAvailable?'available':'not-implemented' }, permissions: { ...DENIED_PERMISSIONS, network: this.cloudAllowed } };
  }
  setState(state: EntityState): void {
    if (state !== 'idle' && state !== 'attention' && !(this.mindAvailable && (state === 'thinking' || state === 'error')) && !(this.curiosityAvailable && state==='exploring')) throw new Error(`État ${state} indisponible : moteur non implémenté.`);
    this.state = state; this.publish();
  }
  setPreferences(preferences: Preferences): void { this.preferences = structuredClone(preferences); this.publish(); }
  setNotice(notice: string | null): void { this.notice = notice; this.publish(); }
  setShortcutRegistered(registered: boolean): void { this.shortcutRegistered = registered; this.publish(); }
  setCloudAllowed(allowed: boolean): void { this.cloudAllowed = allowed; this.publish(); }
  setDiscoveryPending(pending: boolean): void { if(this.discoveryPending!==pending) {this.discoveryPending=pending;this.publish();} }
  private publish(): void { this.events.emit('presence.changed', this.snapshot()); }
}
