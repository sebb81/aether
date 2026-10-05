import {useEffect,useState} from 'react';
import type {SpaceSnapshot} from '@aether/shared';
export function useSpace(){
  const [snapshot,setSnapshot]=useState<SpaceSnapshot|null>(null),[error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let alive=true,timer:ReturnType<typeof setTimeout>|undefined,request=0;
    async function load(){const id=++request;try{const value=await window.aether.getSpace();if(alive&&id===request){setSnapshot(value);setError(null);}}catch(reason){if(alive)setError(String(reason));}}
    function schedule(){if(timer)return;timer=setTimeout(()=>{timer=undefined;void load();},40);}
    void load();const unsubscribe=[window.aether.onSpaceChanged(schedule),window.aether.onMind(schedule),window.aether.onCuriosity(schedule),window.aether.onSnapshot(schedule)];
    return ()=>{alive=false;if(timer)clearTimeout(timer);unsubscribe.forEach(callback=>callback());};
  },[]);
  return {snapshot,error};
}
