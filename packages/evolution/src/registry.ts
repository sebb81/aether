import type { InstalledCapability } from '@aether/shared';
import { EvolutionStore } from './store';

/** Registry metadata never grants a new API. The runtime and file broker enforce each access. */
export class CapabilityRegistry {
  constructor(private store: EvolutionStore) {}
  list(): InstalledCapability[] { return structuredClone(this.store.capabilities()); }
  active(id: string): InstalledCapability {
    const value = this.store.capabilities().find(c => c.manifest.id === id && c.state === 'INSTALLED');
    if (!value) throw new Error('Capacité absente ou désactivée.'); return value;
  }
  add(value: InstalledCapability) {
    this.store.capabilityId(value.manifest.id, value.manifest.version);
    if (this.store.capabilities().some(c => c.manifest.id === value.manifest.id && c.manifest.version === value.manifest.version)) throw new Error('Version déjà inscrite au registre.');
    this.store.capabilities().push(value);
  }
}
