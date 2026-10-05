import { isShortcut } from './preferences';

export interface ShortcutRegistrar { register(key: string, action: () => void): boolean; unregister(key: string): void }
export class ShortcutManager {
  private current: string | null = null;
  constructor(private readonly registrar: ShortcutRegistrar, private readonly recall: () => void) {}
  get registered(): boolean { return this.current !== null; }
  prepare(next: string): { commit(): void; rollback(): void } {
    if (!isShortcut(next)) throw new Error('Raccourci invalide.');
    if (next === this.current) return { commit() {}, rollback() {} };
    if (!this.registrar.register(next, this.recall)) throw new Error('Ce raccourci est déjà utilisé par une autre application. Le précédent est conservé.');
    const previous = this.current;
    let finished = false;
    return {
      commit: () => { if (finished) return; finished = true; this.current = next; if (previous) this.registrar.unregister(previous); },
      rollback: () => { if (finished) return; finished = true; this.registrar.unregister(next); },
    };
  }
  dispose(): void { if (this.current) this.registrar.unregister(this.current); this.current = null; }
}
