import { spawn } from 'node:child_process';
import electron from 'electron';

export function launchElectron(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, ['.'], { stdio: 'inherit', env, windowsHide: true });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  return child;
}
