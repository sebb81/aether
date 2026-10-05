import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PresenceSnapshot } from '@aether/shared';
import { Entity } from './Entity';
import { Settings } from './Settings';
import { Dialogue } from './Dialogue';
import { Memory } from './Memory';
import { Curiosity } from './Curiosity';
import './curiosity.css';
import './styles.css';

const view = window.location.hash.slice(1);
document.body.className = view === 'entity' ? 'entity-window' : view === 'dialogue' ? 'dialogue-window' : 'settings-window';
function App() {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!window.aether) { setError('Le pont desktop AETHER est indisponible. Relancez l’application.'); return; }
    const unsubscribe = window.aether.onSnapshot(setSnapshot);
    void window.aether.getSnapshot().then(setSnapshot).catch(reason => setError(String(reason)));
    return unsubscribe;
  }, []);
  if (error) return <p className="bootstrap-error" role="alert">{error}</p>;
  if (!snapshot) return null;
  return view === 'settings' ? <Settings snapshot={snapshot} /> : view === 'dialogue' ? <Dialogue /> : view === 'memory' ? <Memory /> : view==='curiosity'? <Curiosity/> : <Entity snapshot={snapshot} />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
