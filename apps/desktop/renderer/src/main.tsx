import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PresenceSnapshot,PortalSnapshot } from '@aether/shared';
import { Entity } from './Entity';
import { Settings } from './Settings';
import { Dialogue } from './Dialogue';
import { Memory } from './Memory';
import { Curiosity } from './Curiosity';
import {Space} from './Space';
import {Echo} from './Echo';
import './echo.css';
import './space.css';
import './curiosity.css';
import './styles.css';

const view = window.location.hash.slice(1);
document.body.className = view === 'entity' ? 'entity-window' : view === 'dialogue' ? 'dialogue-window' : view==='space'?'space-window':'settings-window';
function App() {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portal,setPortal]=useState<PortalSnapshot|null>(null);
  useEffect(() => {
    if (!window.aether) { setError('Le pont desktop AETHER est indisponible. Relancez l’application.'); return; }
    const unsubscribe = window.aether.onSnapshot(setSnapshot);
    const unsubscribePortal=window.aether.onPortal(setPortal);void window.aether.getPortal().then(setPortal).catch(reason=>setError(String(reason)));
    void window.aether.getSnapshot().then(setSnapshot).catch(reason => setError(String(reason)));
    return ()=>{unsubscribe();unsubscribePortal();};
  }, []);
  if (error) return <p className="bootstrap-error" role="alert">{error}</p>;
  if (!snapshot) return null;
  return view === 'settings' ? <Settings snapshot={snapshot} /> : view === 'dialogue' ? <Dialogue /> : view === 'memory' ? <Memory /> : view==='curiosity'? <Curiosity/> : view==='echo'?<Echo/>:view==='space'?<Space presence={snapshot} portal={portal}/>:<Entity snapshot={snapshot} portalPhase={portal?.phase??'closed'} />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
