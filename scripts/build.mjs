import { build as bundle } from 'esbuild';
import { build as buildRenderer } from 'vite';
import { mkdir, copyFile } from 'node:fs/promises';
import { generateIcons } from './icons.mjs';

export async function buildMain() {
  await generateIcons();
  await mkdir('dist/assets', { recursive: true });
  await Promise.all(['icon.png', 'tray.png', 'icon.ico'].map(name => copyFile(`apps/desktop/assets/${name}`, `dist/assets/${name}`)));
  await Promise.all(['main', 'preload'].map(name => bundle({
    entryPoints: [`apps/desktop/${name}/index.ts`],
    outfile: `dist/main/${name}.cjs`, bundle: true, platform: 'node', format: 'cjs',
    target: 'node22', external: ['electron'], sourcemap: true,
  })));
}
if (process.argv[1]?.endsWith('build.mjs')) {
  await buildMain();
  await buildRenderer();
}
