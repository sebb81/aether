import { newQuickJSWASMModuleFromVariant } from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-singlefile-cjs-release-sync';

// The guest receives serialized JSON only. No host function or module loader is installed.
async function main() {
  let raw = ''; for await (const chunk of process.stdin) { raw += String(chunk); if (raw.length > 800000) throw new Error('Entrée MIRROR trop volumineuse.'); if(raw.includes('\n')){raw=raw.slice(0,raw.indexOf('\n'));break;} }
  const input = JSON.parse(raw) as { source: string; input: unknown; compileOnly: boolean };
  const quickjs = await newQuickJSWASMModuleFromVariant(variant), runtime = quickjs.newRuntime();
  runtime.setMemoryLimit(32 * 1024 * 1024); runtime.setMaxStackSize(256 * 1024); const deadline = Date.now() + 2000; runtime.setInterruptHandler(() => Date.now() > deadline);
  const context = runtime.newContext();
  try {
    const program = `(function(){ "use strict"; const exports = Object.create(null);\n${input.source}\n; if(typeof exports.run !== 'function') throw new Error('La capacité doit exposer exports.run(input, api).'); return exports.run; })()`;
    const compiled = context.evalCode(program, 'capability.js', { compileOnly: true });
    if (compiled.error) { const failure = context.dump(compiled.error); compiled.error.dispose(); throw new Error('Compilation : ' + JSON.stringify(failure)); } compiled.value.dispose();
    if (input.compileOnly) { process.stdout.write(JSON.stringify({ ok: true, output: null })); return; }
    const execution = context.evalCode(`JSON.stringify((${program})(JSON.parse(${JSON.stringify(JSON.stringify(input.input))}), Object.freeze({schemaVersion:1, mode:"preview", permissions:Object.freeze([])})))`, 'run.js');
    if (execution.error) { const failure = context.dump(execution.error); execution.error.dispose(); throw new Error('Exécution : ' + JSON.stringify(failure)); }
    const json: unknown = context.dump(execution.value); execution.value.dispose();
    if (typeof json !== 'string' || json.length > 512000) throw new Error('Sortie absente, asynchrone ou trop volumineuse.');
    process.stdout.write(JSON.stringify({ ok: true, output: JSON.parse(json) }));
  } finally { context.dispose(); runtime.dispose(); }
}
void main().catch(error => { process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message.slice(0, 2000) : 'MIRROR a échoué.' })); process.exitCode = 1; });
