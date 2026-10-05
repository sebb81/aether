export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<(payload: never) => void>>();
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    let group = this.listeners.get(event);
    if (!group) { group = new Set(); this.listeners.set(event, group); }
    group.add(listener as (payload: never) => void);
    return () => { group.delete(listener as (payload: never) => void); };
  }
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload as never);
  }
}
