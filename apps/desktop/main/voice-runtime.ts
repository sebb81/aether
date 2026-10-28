import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function environment(env: NodeJS.ProcessEnv, key: string): string {
  const name = Object.keys(env).find(name => name.toLowerCase() === key.toLowerCase());
  return name ? env[name] ?? '' : '';
}

// Explorer does not inherit an activated Conda environment. Persist an executable
// rather than the Microsoft Store alias so every launch uses the same runtime.
export function resolveVoicePython(configured: string, env: NodeJS.ProcessEnv = process.env): string {
  if (configured && !/^(python(?:3)?(?:\.exe)?)$/i.test(configured)) return configured;
  const candidates: string[] = [];
  for (const directory of environment(env, 'PATH').split(';').filter(Boolean)) {
    const folder = directory.replace(/^"|"$/g, '');
    if (/[\\/]Microsoft[\\/]WindowsApps(?:[\\/]|$)/i.test(folder)) continue;
    for (const name of ['python.exe', 'python3.exe']) candidates.push(join(folder, name));
  }
  for (const root of ['PROGRAMDATA', 'USERPROFILE', 'LOCALAPPDATA'].map(key => environment(env, key)).filter(Boolean)) {
    for (const distribution of ['anaconda3', 'miniconda3']) candidates.push(join(root, distribution, 'python.exe'));
  }
  const local = environment(env, 'LOCALAPPDATA');
  if (local) {
    const installations = join(local, 'Programs', 'Python');
    try { if (existsSync(installations)) {
      for (const entry of readdirSync(installations, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name))) {
        if (entry.isDirectory() && /^Python\d+$/.test(entry.name)) candidates.push(join(installations, entry.name, 'python.exe'));
      }
    } } catch { /* A non-readable installation directory is not a usable runtime. */ }
  }
  for (const candidate of candidates) {
    try { if (statSync(candidate).isFile()) return resolve(candidate); } catch { /* Try the next installed runtime. */ }
  }
  return configured || 'python';
}

export function audioWorkerExitError(code: number | null, signal: NodeJS.Signals | null): Error {
  if (code === 9009 || code === 127) return new Error('Python audio introuvable : Windows a lancé un alias sans moteur installé. Choisissez le fichier python.exe dans VOICE puis vérifiez les fournisseurs.');
  const cause = code === null ? signal ?? 'raison inconnue' : `code ${code}`;
  return new Error(`Le fournisseur audio s’est arrêté (${cause}). Vérifiez le Python choisi et ses dépendances avec « Vérifier les fournisseurs » dans VOICE.`);
}
