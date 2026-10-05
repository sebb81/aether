import { useEffect,useState } from 'react';
import type { CuriositySnapshot } from '@aether/shared';
export function useCuriosity() {
  const [snapshot,setSnapshot]=useState<CuriositySnapshot|null>(null),[error,setError]=useState<string|null>(null);
  useEffect(()=>{const unsubscribe=window.aether.onCuriosity(setSnapshot);void window.aether.getCuriosity().then(setSnapshot).catch(reason=>setError(String(reason)));return unsubscribe;},[]);
  return {snapshot,error};
}
