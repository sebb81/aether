import { createServer } from 'vite';
import { buildMain } from './build.mjs';
import { launchElectron } from './launch.mjs';

await buildMain();
const server = await createServer(); await server.listen();
server.printUrls();
const child = launchElectron({ AETHER_RENDERER_URL: 'http://127.0.0.1:5177' });
child.on('exit', async code => { await server.close(); process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill());
