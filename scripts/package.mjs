import { packager } from '@electron/packager';
import { readFile } from 'node:fs/promises';

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const paths = await packager({
  dir: '.', name: 'AETHER', platform: 'win32', arch: 'x64', out: 'release', overwrite: true,
  icon: 'apps/desktop/assets/icon.ico', appVersion: version, prune: true,
  asar: { unpack: '**/echo-context.ps1' },
  ignore: [/^\/apps(?:\/|$)/, /^\/packages(?:\/|$)/, /^\/tests(?:\/|$)/, /^\/docs(?:\/|$)/, /^\/scripts(?:\/|$)/, /^\/test-results(?:\/|$)/, /^\/playwright-report(?:\/|$)/, /^\/.aether-test-data(?:\/|$)/, /^\/.git(?:\/|$)/, /^\/node_modules(?:\/|$)/, /^\/\.gitignore$/, /\.map$/, /\.md$/, /\.config\.ts$/, /^\/tsconfig\.json$/],
  win32metadata: { CompanyName: 'AETHER', FileDescription: 'AETHER — ENTITY', ProductName: 'AETHER', InternalName: 'AETHER' },
});
for (const path of paths) console.log(`Exécutable Windows : ${path}/AETHER.exe`);
