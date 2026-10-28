import { randomUUID, createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { CapabilityFile, CapabilityInput, CapabilityOutput, CapabilityPreview } from '@aether/shared';
import { safeRelative, validatePlan } from './policy';

interface Inventory { files: CapabilityFile[]; fingerprint: string; hashes: Record<string, string>; identity: string }
interface Pending { preview: CapabilityPreview; inventory: Inventory; folder: string; staged: string }
const inside = (parent: string, child: string) => { const path = relative(parent, child); return path === '' || (!path.startsWith('..') && !isAbsolute(path)); };
export function permittedFolder(folder: string, protectedRoots: string[]): string {
  const target = resolve(folder);
  if (!isAbsolute(folder) || target.startsWith('\\\\') || target === parse(target).root || target.toLowerCase() === homedir().toLowerCase()) throw new Error('Choisissez un dossier local précis.');
  for (const protectedRoot of [...protectedRoots, process.env.SystemRoot, process.env.APPDATA, process.env.LOCALAPPDATA].filter((p): p is string => Boolean(p))) {
    if (inside(resolve(protectedRoot), target) || inside(target, resolve(protectedRoot))) throw new Error('Dossier système, noyau ou données AETHER refusé.');
  }
  assertPlainPath(target); if (!lstatSync(target).isDirectory()) throw new Error('Dossier absent.'); return target;
}
function assertPlainPath(path: string) {
  let current = parse(path).root;
  for (const part of relative(current, path).split(/[\\/]/).filter(Boolean)) { current = join(current, part); if (!existsSync(current)) break; if (lstatSync(current).isSymbolicLink()) throw new Error('Lien symbolique/jonction refusé.'); }
  if (existsSync(path) && realpathSync(path).toLowerCase() !== resolve(path).toLowerCase()) throw new Error('Chemin redirigé refusé.');
}
function fingerprint(folder: string): Inventory {
  assertPlainPath(folder); const root = lstatSync(folder), files: CapabilityFile[] = [], hashes: Record<string, string> = {}; let total = 0;
  function walk(directory: string, depth: number) {
    if (depth > 10) throw new Error('Profondeur supérieure à 10.');
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(directory, entry.name), info = lstatSync(full); if (info.isSymbolicLink()) throw new Error('Lien/jonction détecté dans le dossier.');
      if (info.isDirectory()) walk(full, depth + 1);
      else if (info.isFile()) {
        if (info.nlink !== 1) throw new Error('Fichier à liens multiples refusé.');
        total += info.size; if (files.length >= 500 || total > 64 * 1024 * 1024) throw new Error('Dossier de test limité à 500 fichiers et 64 Mio.');
        const path = safeRelative(relative(folder, full)); files.push({ path, size: info.size, modifiedAt: info.mtime.toISOString() });
        hashes[path] = createHash('sha256').update(readFileSync(full)).digest('hex');
      } else throw new Error('Type de fichier non supporté.');
    }
  }
  walk(folder, 0); const identity = `${root.dev}:${root.ino}:${root.birthtimeMs}`;
  return { files, hashes, identity, fingerprint: createHash('sha256').update(JSON.stringify({ files, hashes, identity })).digest('hex') };
}
async function applyPlan(folder: string, output: CapabilityOutput, inventory: Inventory, signal:AbortSignal) {
  const now = fingerprint(folder); if (now.fingerprint !== inventory.fingerprint) throw new Error('Le dossier a changé depuis l’aperçu. Recommencez la prévisualisation.');
  const applied: { from: string; to: string }[] = [], created: string[] = [];
  try {
    for (const op of output.renames) {
      await new Promise<void>(done=>setImmediate(done));if(signal.aborted)throw new Error('Opération fichiers arrêtée.');
      const from = resolve(folder, safeRelative(op.from)), to = resolve(folder, safeRelative(op.to));
      if (!inside(folder, from) || !inside(folder, to)) throw new Error('Chemin hors du dossier choisi.');
      assertPlainPath(from); assertPlainPath(to);
      let parent = dirname(to); const absent: string[] = [];
      while (!existsSync(parent)) { absent.unshift(parent); parent = dirname(parent); }
      assertPlainPath(parent);
      for (const directory of absent) { mkdirSync(directory); created.push(directory); }
      copyFileSync(from, to, constants.COPYFILE_EXCL);
      const current = createHash('sha256').update(readFileSync(from)).digest('hex');
      if (current !== inventory.hashes[op.from]) { unlinkSync(to); throw new Error('Un fichier source a changé pendant l’opération.'); }
      try { unlinkSync(from); } catch (error) { unlinkSync(to); throw error; }
      applied.push({ from, to });
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const op of applied.reverse()) try { copyFileSync(op.to, op.from, constants.COPYFILE_EXCL); unlinkSync(op.to); } catch { rollbackErrors.push(op.from); }
    for (const directory of created.reverse()) try { rmdirSync(directory); } catch { /* Never recursively delete a user directory. */ }
    if (rollbackErrors.length) throw new Error(`Opération partielle : ${rollbackErrors.length} fichier(s) à restaurer depuis la copie de prévisualisation. Aucun écrasement forcé.`);
    throw error;
  }
}
export class FileBroker {
  private previews = new Map<string, Pending>();
  private operation:AbortController|null=null;
  constructor(readonly workspace: string, private protectedRoots: string[]) { mkdirSync(workspace, { recursive: true }); }
  async preview(id: string, version: string, folder: string, parameters: Record<string, unknown>, evaluate: (input: CapabilityInput) => Promise<CapabilityOutput>, permissions: readonly import('@aether/shared').CapabilityPermission[]): Promise<CapabilityPreview> {
    if(this.operation)throw new Error('Une opération fichiers est déjà active.');const controller=new AbortController();this.operation=controller;
    try{
    if (!permissions.includes('filesystem.read')) throw new Error('Cette capacité ne dispose pas de filesystem.read.');
    const root = permittedFolder(folder, [...this.protectedRoots, this.workspace]), inventory = fingerprint(root), previewId = randomUUID(), staged = join(this.workspace, previewId, 'copies');
    mkdirSync(staged, { recursive: true });
    for (const file of inventory.files) { await new Promise<void>(done=>setImmediate(done));if(controller.signal.aborted)throw new Error('Aperçu arrêté.');const to = join(staged, file.path); mkdirSync(dirname(to), { recursive: true }); copyFileSync(join(root, file.path), to, constants.COPYFILE_EXCL); }
    if(controller.signal.aborted)throw new Error('Aperçu arrêté.');const output = await evaluate({ files: inventory.files, parameters }); validatePlan({ files: inventory.files, parameters }, output, permissions);
    const stagedInventory = fingerprint(staged); await applyPlan(staged, output, stagedInventory,controller.signal);if(controller.signal.aborted)throw new Error('Aperçu arrêté.');
    if (fingerprint(root).fingerprint !== inventory.fingerprint) throw new Error('Dossier source modifié pendant l’aperçu.');
    const preview: CapabilityPreview = { id: previewId, capabilityId: id, version, folder: root, expiresAt: new Date(Date.now() + 120000).toISOString(), output, files: inventory.files, applied: false };
    this.previews.clear(); this.previews.set(previewId, { preview, inventory, folder: root, staged });
    writeFileSync(join(this.workspace, previewId, 'preview.json'), JSON.stringify(preview, null, 2)); return structuredClone(preview);
    }finally{this.operation=null;}
  }
  busy(){return this.operation!==null;}
  invalidate() { this.operation?.abort();this.previews.clear(); }
  async apply(id: string, confirmed: boolean, available: (id: string, version: string) => boolean) {
    if(this.operation)throw new Error('Une opération fichiers est déjà active.');
    if (confirmed !== true) throw new Error('Confirmez séparément l’application de cet aperçu.');
    const pending = this.previews.get(id); this.previews.delete(id);
    if (!pending || Date.parse(pending.preview.expiresAt) < Date.now()) throw new Error('Aperçu expiré ou déjà utilisé.');
    if (!available(pending.preview.capabilityId, pending.preview.version)) throw new Error('Capacité désactivée, retirée ou version remplacée.');
    const controller=new AbortController();this.operation=controller;try{
    permittedFolder(pending.folder, [...this.protectedRoots, this.workspace]); await applyPlan(pending.folder, pending.preview.output, pending.inventory,controller.signal); pending.preview.applied = true;
    writeFileSync(join(dirname(pending.staged), 'applied.json'), JSON.stringify({ ...pending.preview, appliedAt: new Date().toISOString() }, null, 2));
    }finally{this.operation=null;}
  }
}
