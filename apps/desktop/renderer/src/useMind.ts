import { useEffect, useState } from 'react';
import type { MindSnapshot } from '@aether/shared';

export function useMind() {
  const [snapshot, setSnapshot] = useState<MindSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const unsubscribe = window.aether.onMind(setSnapshot);
    void window.aether.getMind().then(setSnapshot).catch(reason => setError(String(reason)));
    return unsubscribe;
  }, []);
  return { snapshot, error };
}
