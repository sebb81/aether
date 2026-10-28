import { isDeepStrictEqual } from 'node:util';
import type { CapabilityRuntime, CapabilityTest, ForgeSpecification, MirrorCheck, MirrorReport } from '@aether/shared';
import { digest } from './store';
import { parseInput, parseOutput, validatePlan } from './policy';

export const ISOLATION = 'QuickJS/WebAssembly sans API hôte ; processus Windows MXC ; 32 Mio de mémoire JavaScript, 2 s par calcul, sortie 512 Ko ; aucun processus enfant créé par la capacité.';
export class Mirror {
  constructor(readonly runtime: CapabilityRuntime) {}
  async test(source: string, spec: ForgeSpecification, generatedTests: CapabilityTest[], signal: AbortSignal, event: (phase: string, detail: string) => void): Promise<MirrorReport> {
    const started = Date.now(), checks: MirrorCheck[] = [];
    const check = async (name: string, fn: () => Promise<void>) => {
      if (signal.aborted) throw new Error('MIRROR arrêté.');
      const at = Date.now(); try { await fn(); checks.push({ name, passed: true, detail: 'Réussi', durationMs: Date.now() - at }); }
      catch (error) { if (signal.aborted) throw error; checks.push({ name, passed: false, detail: error instanceof Error ? error.message : 'Échec', durationMs: Date.now() - at }); }
      event('test', `${name} : ${checks.at(-1)!.passed ? 'réussi' : 'échoué'}`);
    };
    await check('Compilation JavaScript QuickJS', async () => { await this.runtime.evaluate(source, { files: [], parameters: {} }, signal, true); });
    if (checks[0]!.passed) {
      const tests = [...spec.acceptanceTests.map(t => ({ ...t, name: 'Critère approuvé : ' + t.name })), ...generatedTests.map(t => ({ ...t, name: 'Test Codex : ' + t.name }))];
      for (const test of tests) await check(test.name, async () => {
        const input = parseInput(test.input), actual = parseOutput(await this.runtime.evaluate(source, input, signal));
        validatePlan(input, actual, spec.permissions);
        if (!isDeepStrictEqual(actual, test.expected)) throw new Error('Sortie différente. Attendu : '+JSON.stringify(test.expected).slice(0,1200)+' ; reçu : '+JSON.stringify(actual).slice(0,1200));
      });
    }
    return { at: new Date().toISOString(), passed: checks.length > 1 && checks.every(c => c.passed), digest: digest(source), checks, isolation: ISOLATION, durationMs: Date.now() - started };
  }
}
