import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { CapabilityInput, CapabilityOutput, CapabilityRuntime } from '@aether/shared';
import { parseOutput } from '@aether/evolution';

export function filteredEnvironment(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) if (process.env[key]) result[key] = process.env[key]!;
  // Neither AETHER provider keys nor Node/Python injection options cross this boundary.
  result.ELECTRON_RUN_AS_NODE = '1'; return result;
}
export function findCodex(): string {
  try { const lines = execFileSync('where.exe', ['codex.exe'], { encoding: 'utf8', windowsHide: true, timeout: 3000 }).trim().split(/\r?\n/); if (lines[0] && existsSync(lines[0])) return lines[0]; } catch { /* Explorer PATH can omit the extension CLI. */ }
  const extensions = join(homedir(), '.vscode', 'extensions');
  if (existsSync(extensions)) for (const directory of readdirSync(extensions).filter(name => /^openai\.(chatgpt|codex)-/.test(name)).sort().reverse()) { const executable = join(extensions, directory, 'bin', 'windows-x86_64', 'codex.exe'); if (existsSync(executable)) return executable; }
  throw new Error('Codex CLI officiel introuvable. Installez/configurez Codex et authentifiez-vous avant FORGE.');
}
export function killTree(pid: number) {
  try { execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 3000, stdio: 'ignore' }); } catch { /* Already stopped. */ }
}
export class WindowsCapabilityRuntime implements CapabilityRuntime {
  constructor(private workspace: string, private worker = resolve(typeof __dirname==='string'?__dirname:'dist/main', 'capability-worker.cjs'), private codex: () => string = findCodex) { mkdirSync(workspace, { recursive: true }); }
  async evaluate(source: string, input: CapabilityInput, signal: AbortSignal, compileOnly = false): Promise<CapabilityOutput | null> {
    if (process.platform !== 'win32') throw new Error('Le runner J6 exige Windows MXC ; aucun repli non isolé.');
    if (signal.aborted) throw new Error('MIRROR arrêté.');
    const executable = this.codex(), worker = this.worker.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    if (!existsSync(worker)) throw new Error('Helper MIRROR absent du paquet.');
    const args = ['-c', 'windows.sandbox="mxc"', 'sandbox', '--include-managed-config', '--permission-profile', ':workspace', '-C', this.workspace, '--', process.execPath, '--max-old-space-size=128', worker];
    return new Promise((accept, reject) => {
      const child = spawn(executable, args, { cwd: this.workspace, env: filteredEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', done = false;
      const finish = (error?: Error, output?: CapabilityOutput | null) => { if (done) return; done = true; clearTimeout(timer); signal.removeEventListener('abort', abort); if (child.pid) killTree(child.pid); child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();child.unref();error ? reject(error) : accept(output ?? null); };
      const abort = () => finish(new Error('MIRROR arrêté.'));
      const timer = setTimeout(() => finish(new Error('Timeout MIRROR (15 s, démarrage inclus).')), 15000);
      signal.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', chunk => { stdout += String(chunk); if (stdout.length > 600000) finish(new Error('Sortie MIRROR trop volumineuse.')); });
      child.stderr.on('data', chunk => { stderr += String(chunk); if (stderr.length > 8000) stderr = stderr.slice(-8000); });
      child.on('error', () => finish(new Error('Démarrage du runner MXC impossible. Aucun code exécuté sans isolation.')));
      child.on('close', code => {
        if (done) return;
        try { const response = JSON.parse(stdout) as { ok: boolean; output?: unknown; error?: string }; if (code !== 0 || !response.ok) throw new Error(response.error ?? 'MIRROR a échoué.'); finish(undefined, compileOnly ? null : parseOutput(response.output)); }
        catch (error) { finish(new Error(stdout ? error instanceof Error ? error.message : 'Réponse MIRROR invalide.' : `MXC indisponible ou runner interrompu (code ${code}). ${stderr.slice(-600)}`)); }
      });
      child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify({ source, input, compileOnly })+'\n');
    });
  }
}
