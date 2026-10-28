import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('J6 real desktop: FORGE/SPACE ownership, visible confirmations and no implicit fabrication',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'aether-forge-ui-'));const env:NodeJS.ProcessEnv={...process.env,AETHER_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;delete env.GEMINI_API_KEY;
  const app=await electron.launch({args:[resolve('.')],env:env as Record<string,string>});
  try{
    const entity=await app.firstWindow();await entity.locator('.entity-stage').waitFor();const presence=await entity.evaluate(()=>window.aether.getSnapshot());expect(presence.features.forge).toBe('available');expect(presence.features.mirror).toBe('available');expect(presence.features.capabilities).toBe('available');expect(presence.permissions['forge.generate']).toBe(false);
    const denied=await entity.evaluate(()=>window.aether.prepareForge({description:'Build something'})).catch(error=>({ok:false,error:String(error)}));expect(denied.ok).toBe(false);
    await entity.evaluate(()=>window.aether.command('forge'));await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#forge'))).toBe(true);const forge=app.windows().find(p=>p.url().endsWith('#forge'))!;await expect(forge.getByRole('heading',{name:'Fabriquer une capacité',exact:true})).toBeVisible();expect((await forge.evaluate(()=>window.aether.getEvolution())).requests).toHaveLength(0);
    const before=await forge.evaluate(()=>window.aether.getEvolution());const refused=await forge.evaluate(()=>window.aether.evolutionAction('generate','00000000-0000-0000-0000-000000000000',false));expect(refused.ok).toBe(false);expect((await forge.evaluate(()=>window.aether.getEvolution())).requests).toEqual(before.requests);
    expect((await forge.evaluate(()=>window.aether.stopEvolution())).ok).toBe(true);
    await entity.evaluate(()=>window.aether.command('portal'));await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#space'))).toBe(true);const space=app.windows().find(p=>p.url().endsWith('#space'))!;await expect(space.locator('.portal-shell')).toHaveAttribute('data-portal-phase','open');await space.getByRole('navigation',{name:'Zones de SPACE'}).getByRole('button',{name:'FORGE / MIRROR',exact:true}).click();await expect(space.getByRole('heading',{name:'Fabriquer une capacité',exact:true})).toBeVisible();const snapshot=await space.evaluate(()=>window.aether.getSpace());expect(snapshot.data.evolution?.capabilities).toEqual([]);expect(snapshot.data.evolution?.requests).toEqual([]);
    await mkdir('docs/recette-j6',{recursive:true});await forge.screenshot({path:'docs/recette-j6/forge-empty.png',fullPage:true});await space.screenshot({path:'docs/recette-j6/space-forge.png'});await writeFile('docs/recette-j6/ui-evidence.json',JSON.stringify({at:new Date().toISOString(),profile:'isolated',ownerChecks:true,noGeneration:true,space:true},null,2));
  }finally{await app.close();await rm(profile,{recursive:true,force:true});}
});
test('J6 MIND uses the real local model to open a Forge preparation without generating or installing',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'aether-forge-mind-'));const env:NodeJS.ProcessEnv={...process.env,AETHER_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;delete env.GEMINI_API_KEY;
  const app=await electron.launch({args:[resolve('.')],env:env as Record<string,string>});
  try{
    const entity=await app.firstWindow();await entity.locator('.entity-stage').waitFor();
    await entity.evaluate(()=>window.aether.command('settings'));
    await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#settings'))).toBe(true);
    const settings=app.windows().find(p=>p.url().endsWith('#settings'))!;await settings.locator('.settings-page').waitFor();
    expect((await settings.evaluate(()=>window.aether.saveAiConfiguration({provider:'ollama',model:'qwen3.5:9b',ollamaUrl:'http://127.0.0.1:11434',cloudConsent:false}))).ok).toBe(true);
    await entity.evaluate(()=>window.aether.command('dialogue'));
    await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#dialogue'))).toBe(true);
    const dialogue=app.windows().find(p=>p.url().endsWith('#dialogue'))!;
    const description='Essaie de me construire un outil pour classer uniquement les fichiers WAV dans un sous-dossier date, avec un apercu avant modification. Ouvre FORGE pour preparer ma demande.';
    const result=await dialogue.evaluate(text=>window.aether.sendMessage(text),description);expect(result.ok,JSON.stringify(result)).toBe(true);
    const mind=await entity.evaluate(()=>window.aether.getMind());expect(mind.messages.at(-1)?.capability).toBe('forge.prepare');
    await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#forge'))).toBe(true);
    const forge=app.windows().find(p=>p.url().endsWith('#forge'))!;await expect(forge.getByLabel('Ce que la capacité doit faire')).toHaveValue(description);
    const state=await forge.evaluate(()=>window.aether.getEvolution());expect(state.requests).toEqual([]);expect(state.capabilities).toEqual([]);
    await writeFile('docs/recette-j6/mind-forge-evidence.json',JSON.stringify({at:new Date().toISOString(),provider:'actual Ollama qwen3.5:9b',action:mind.messages.at(-1)?.capability,descriptionProposed:state.suggestedDescription,generated:false,installed:false,modality:'text through the same MIND as VOICE LOCAL'},null,2));
  }finally{await app.close();await rm(profile,{recursive:true,force:true});}
});
