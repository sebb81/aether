import { access } from 'node:fs/promises';
import { launchElectron } from './launch.mjs';

try { await access('dist/main/main.cjs'); await access('dist/renderer/index.html'); }
catch { console.error('Compilez d’abord avec npm run build.'); process.exit(1); }
const child = launchElectron();
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill());
