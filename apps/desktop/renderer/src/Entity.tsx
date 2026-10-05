import { useRef } from 'react';
import type { PresenceSnapshot,PortalPhase } from '@aether/shared';

export function EntityShape({ id = 'entity' }: { id?: string }) {
  return <svg className="entity-shape" viewBox="0 0 160 160" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}-body`} cx="38%" cy="27%" r="80%">
        <stop offset="0" stopColor="#fff9dc" /><stop offset="0.48" stopColor="#d7f1dd" /><stop offset="1" stopColor="#8fc9c8" />
      </radialGradient>
      <radialGradient id={`${id}-halo`}><stop offset="0.35" stopColor="#d4ecd6" stopOpacity="0.26" /><stop offset="1" stopColor="#b2dfcf" stopOpacity="0" /></radialGradient>
    </defs>
    <circle className="entity-halo" cx="80" cy="80" r="73" fill={`url(#${id}-halo)`} />
    <g className="entity-body">
      <path d="M80 34 C105 33 125 49 125 75 C128 103 106 125 81 125 C56 127 35 108 35 83 C33 57 52 34 80 34Z" fill={`url(#${id}-body)`} />
      <path className="entity-highlight" d="M49 60 C55 47 67 43 78 43" fill="none" stroke="#fffce7" strokeWidth="2" strokeLinecap="round" opacity="0.52" />
      <g className="entity-eyes" stroke="#345554" strokeWidth="6.5" strokeLinecap="round">
        <path d="M67 73 L67 84" /><path d="M93 73 L93 84" />
      </g>
    </g>
  </svg>;
}
export function Entity({ snapshot,portalPhase='closed' }: { snapshot: PresenceSnapshot;portalPhase?:PortalPhase }) {
  const dragging = useRef(false);
  function end(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    window.aether.drag('end');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <main className={`entity-stage ${snapshot.preferences.reducedMotion ? 'reduce-motion' : ''}`} data-state={snapshot.state} data-echo-active={snapshot.echoActive?'true':'false'} data-portal-phase={portalPhase} data-discovery-pending={snapshot.discoveryPending?'true':'false'}>
    <EntityShape />
    {snapshot.echoActive&&<span className="entity-echo-indicator" role="status">ECHO</span>}
    <button className="entity-target" aria-label="ENTITY — cliquer ou déplacer" title="Cliquez pour parler · Double clic pour entrer dans AETHER · Glissez pour déplacer"
      onPointerDown={event => {
        if (event.button !== 0) return;
        dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); window.aether.drag('start');
      }}
      onPointerMove={() => { if (dragging.current) window.aether.drag('move'); }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { if (dragging.current) { dragging.current = false; window.aether.drag('end'); } }}
      onClick={event => { if (event.detail === 0) void window.aether.command('interact'); }}
      onDoubleClick={()=>{void window.aether.command('portal');}}
      onContextMenu={event => { event.preventDefault(); void window.aether.command('menu'); }}
      onKeyDown={event => { if (event.key === 'Escape') void window.aether.command('hide'); }}
    />
  </main>;
}
