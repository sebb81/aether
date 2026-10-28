import { build as bundle } from 'esbuild';
import { build as buildRenderer } from 'vite';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { generateIcons } from './icons.mjs';

export async function buildMain() {
  await generateIcons();
  await mkdir('dist/assets', { recursive: true });
  await Promise.all(['icon.png', 'tray.png', 'icon.ico'].map(name => copyFile(`apps/desktop/assets/${name}`, `dist/assets/${name}`)));
  await Promise.all(['main', 'preload'].map(name => bundle({
    entryPoints: [`apps/desktop/${name}/index.ts`],
    outfile: `dist/main/${name}.cjs`, bundle: true, platform: 'node', format: 'cjs',
    target: 'node22', external: ['electron'], sourcemap: true,
    ...(name==='main'?{define:{'import.meta.url':'__aetherImportMetaURL'},banner:{js:"const __aetherImportMetaURL = require('node:url').pathToFileURL(__filename).href;"}}:{}),
  })));
  // Windows PowerShell 5.1 needs a BOM to read French literals as UTF-8.
  await writeFile('dist/main/echo-context.ps1','\ufeff'+await readFile('apps/desktop/main/echo-context.ps1','utf8'),'utf8');
  await writeFile('dist/main/voice-speech.ps1','\ufeff'+await readFile('apps/desktop/main/voice-speech.ps1','utf8'),'utf8');
  await copyFile('apps/desktop/main/voice-worker.py','dist/main/voice-worker.py');
  await copyFile('apps/desktop/main/live-audio-worker.py','dist/main/live-audio-worker.py');
  await bundle({entryPoints:['apps/desktop/main/gemini-live-worker.ts'],outfile:'dist/main/gemini-live-worker.cjs',bundle:true,platform:'node',format:'cjs',target:'node22',external:['electron']});
  await bundle({entryPoints:['apps/desktop/main/capability-worker.ts'],outfile:'dist/main/capability-worker.cjs',bundle:true,platform:'node',format:'cjs',target:'node22'});
  await mkdir('dist/audio', { recursive: true });
  await bundle({ entryPoints: ['apps/desktop/preload/live-audio.ts'], outfile: 'dist/main/live-audio-preload.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'] });
  await bundle({ entryPoints: ['apps/desktop/audio/live-audio.ts'], outfile: 'dist/audio/live-audio.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome140' });
  await Promise.all(['live-audio.html', 'capture-worklet.js'].map(name => copyFile('apps/desktop/audio/' + name, 'dist/audio/' + name)));
}
if (process.argv[1]?.endsWith('build.mjs')) {
  await buildMain();
  await buildRenderer();
}
