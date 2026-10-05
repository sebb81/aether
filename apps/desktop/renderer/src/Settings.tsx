import { useEffect, useState } from 'react';
import type { PresenceSnapshot } from '@aether/shared';
import { EntityShape } from './Entity';
import { AiSettings } from './AiSettings';
import { RouterSettings } from './RouterSettings';

const displayShortcut = (value: string) => value.replace('CommandOrControl', 'Ctrl').replace('Control', 'Ctrl').replace('Super', 'Windows').replace('Space', 'Espace').split('+').join(' + ');
export function Settings({ snapshot }: { snapshot: PresenceSnapshot }) {
  const [shortcut, setShortcut] = useState(snapshot.preferences.recallShortcut);
  const [reducedMotion, setReducedMotion] = useState(snapshot.preferences.reducedMotion);
  const [result, setResult] = useState<{ error: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setShortcut(snapshot.preferences.recallShortcut); setReducedMotion(snapshot.preferences.reducedMotion); }, [snapshot.preferences.recallShortcut, snapshot.preferences.reducedMotion]);
  return <main className={`settings-page ${reducedMotion ? 'reduce-motion' : ''}`}>
    <header className="brand"><span className="brand-mark">◌</span><span>AETHER</span><span className="version">FIRST LIFE · 03</span></header>
    <section className="presence-intro">
      <div className="mini-entity"><EntityShape id="settings" /></div>
      <div><p className="eyebrow">PRÉSENCE</p><h1>ENTITY, sur votre bureau</h1><p className="subtle">Une présence discrète, que vous gardez sous votre contrôle.</p></div>
    </section>
    {snapshot.notice && <p className="notice" role="alert">{snapshot.notice}</p>}
    <section className="status-row" aria-label="État de la présence">
      <span><span className={`status-dot ${snapshot.preferences.visible ? '' : 'hidden'}`} />{snapshot.preferences.visible ? 'ENTITY est présente' : 'ENTITY est masquée'}</span>
      <button type="button" className="secondary compact" onClick={() => { void window.aether.command(snapshot.preferences.visible ? 'hide' : 'recall'); }}>{snapshot.preferences.visible ? 'Masquer' : 'Rappeler'}</button>
    </section>
    <form onSubmit={async event => {
      event.preventDefault(); setSaving(true); setResult(null);
      try { const response = await window.aether.saveSettings({ recallShortcut: shortcut, reducedMotion }); setResult(response.ok ? { error: false, text: 'Réglages enregistrés.' } : { error: true, text: response.error }); }
      catch (error) { setResult({ error: true, text: error instanceof Error ? error.message : 'Enregistrement impossible.' }); }
      finally { setSaving(false); }
    }}>
      <section className="setting-section">
        <label className="setting-title" htmlFor="recall-shortcut">Raccourci de rappel</label>
        <p className="subtle">Cliquez dans le champ, puis appuyez sur la combinaison souhaitée.</p>
        <input id="recall-shortcut" aria-describedby="shortcut-help" readOnly value={displayShortcut(shortcut)} onKeyDown={event => {
          if (event.key === 'Tab') return;
          event.preventDefault();
          const modifiers = [event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Super'].filter(Boolean);
          const key = event.code === 'Space' ? 'Space' : /^(Key[A-Z]|Digit[0-9])$/.test(event.code) ? event.code.replace(/^(Key|Digit)/, '') : /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.key) ? event.key : null;
          if (key && modifiers.some(modifier => modifier !== 'Shift')) { setShortcut([...modifiers, key].join('+')); setResult(null); }
        }} />
        <p id="shortcut-help" className="helper">Ctrl, Alt ou Windows + une touche. {snapshot.shortcutRegistered ? 'Le raccourci enregistré est actif.' : 'Raccourci indisponible : le tray reste accessible.'}</p>
      </section>
      <section className="setting-section motion-setting">
        <div><label className="setting-title" htmlFor="reduced-motion">Réduire les animations</label><p className="subtle">Une présence immobile, avec une réaction douce au clic.<br />Le réglage de mouvement de Windows est aussi respecté.</p></div>
        <input id="reduced-motion" type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} />
      </section>
      <div className="form-actions"><p role={result?.error ? 'alert' : 'status'} className={result?.error ? 'error-message' : 'saved-message'}>{result?.text ?? ''}</p><button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></div>
    </form>
    <AiSettings />
    <RouterSettings />
    <section className="memory-link-row"><div><h2>CURIOSITY · Histoire intellectuelle</h2><p className="subtle">Intérêts, questions, connexions et contrôle de l’autonomie locale.</p></div><button className="secondary" onClick={()=>{void window.aether.command('curiosity');}}>Ouvrir CURIOSITY</button></section>
    <section className="memory-link-row"><div><h2>MEMORY · Souvenirs locaux</h2><p className="subtle">Consulter, corriger, supprimer ou exporter ce qu’ENTITY retient.</p></div><button className="secondary" onClick={() => { void window.aether.command('memory'); }}>Ouvrir MEMORY</button></section>
    <section className="usage"><h2>À portée de main</h2><p>Glissez ENTITY pour la déplacer. Un clic ouvre l’échange ; un clic droit ouvre ses commandes. L’icône AETHER de la zone de notification permet toujours de la rappeler ou de quitter.</p></section>
    <footer><p><span className="local-indicator">●</span> MIND, MEMORY et CURIOSITY · aucune observation active</p><p className="unavailable">ECHO, FORGE, MIRROR, voix, portail et capacités : non implémentés dans ce jalon.</p></footer>
  </main>;
}
