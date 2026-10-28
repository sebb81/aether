import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('LIVE real Electron settings, owner checks, consent persistence, no-key failover and LOCAL preservation',async()=>{
  const profile=await mkdtemp(join(tmpdir(),'aether-live-ui-')),folder=resolve('test-results/live');await mkdir(folder,{recursive:true});
  const env:NodeJS.ProcessEnv={...process.env,AETHER_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.GEMINI_API_KEY;delete env.OPENAI_API_KEY;
  const app=await electron.launch({args:[resolve('.')],env:env as Record<string,string>});
  const proof:Record<string,unknown>={date:new Date().toISOString(),provider:'No cloud provider simulated; real Electron and local configuration only.'};
  try{
    const entity=await app.firstWindow();await entity.getByRole('button',{name:'ENTITY — cliquer ou déplacer'}).waitFor();
    const initial=await entity.evaluate(()=>window.aether.getLive());expect(initial.state).toBe('idle');expect(initial.settings.defaultMode).toBe('LOCAL');expect(initial.settings.cloudConsent).toBe('prompt');expect(initial.microphoneActive).toBe(false);
    const denied=await entity.evaluate(()=>window.aether.liveConsent('grant')).catch(String);expect(denied).toMatch(/consentement Gemini/);proof.ownerCheck=denied;
    await entity.evaluate(()=>window.aether.command('live'));await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#live'))).toBe(true);const panel=app.windows().find(p=>p.url().endsWith('#live'))!;await panel.locator('.live-page').waitFor();
    await expect(panel.getByRole('button',{name:'Autoriser Gemini Live',exact:true})).toBeDisabled();
    await panel.getByLabel('Activer Gemini Live',{exact:true}).check();await panel.getByLabel('Niveau de diagnostic',{exact:true}).selectOption('detailed');await panel.getByRole('button',{name:'Enregistrer LIVE',exact:true}).click();await expect.poll(async()=>(await panel.evaluate(()=>window.aether.getLive())).settings.enabled).toBe(true);
    await panel.getByLabel('J’autorise explicitement l’audio et les données nécessaires des outils vers Gemini',{exact:true}).check();await panel.getByRole('button',{name:'Autoriser Gemini Live',exact:true}).click();await expect.poll(async()=>(await panel.evaluate(()=>window.aether.getLive())).settings.cloudConsent).toBe('granted');
    expect((await panel.evaluate(()=>window.aether.getLive())).microphoneActive).toBe(false);proof.grantedWithoutCapture=true;
    await entity.evaluate(()=>window.aether.command('voice'));await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#voice'))).toBe(true);const voice=app.windows().find(p=>p.url().endsWith('#voice'))!;await voice.getByRole('button',{name:'Autoriser le microphone',exact:true}).click();
    const opening=await panel.evaluate(()=>window.aether.liveControl('start'));expect(opening.ok).toBe(false);const failed=await panel.evaluate(()=>window.aether.getLive());expect(failed.state).toBe('LIVE_ERROR');expect(failed.error).toMatch(/clé/);expect(failed.microphoneActive).toBe(false);expect(failed.sessionId).toBeNull();expect((await entity.evaluate(()=>window.aether.getVoice())).settings.microphoneConsent).toBe('granted');proof.noKeyFailover=failed;
    await panel.getByRole('button',{name:'Révoquer le consentement cloud',exact:true}).click();await expect.poll(async()=>(await panel.evaluate(()=>window.aether.getLive())).settings.cloudConsent).toBe('denied');expect((await panel.evaluate(()=>window.aether.getLive())).state).toBe('idle');
    const saved=JSON.parse(await readFile(join(profile,'live-settings.json'),'utf8'));expect(saved.cloudConsent).toBe('denied');expect(saved.apiKey).toBeUndefined();expect(saved.defaultMode).toBe('LOCAL');proof.saved=saved;
    expect((await entity.evaluate(()=>window.aether.getModelRouter())).CODE).toBeNull();expect((await entity.evaluate(()=>window.aether.getModelRouter())).LIVE?.provider).toBe('gemini');
    await panel.screenshot({path:join(folder,'live-settings.png'),fullPage:true});await entity.screenshot({path:join(folder,'entity-local.png')});
    // An intentionally invalid isolated credential exercises the real SDK/WebSocket error,
    // encrypted vault and process cleanup. It is never a simulated successful provider.
    const {schemaVersion:_schema,provider:_provider,cloudConsent:_consent,...configuration}=saved;
    expect((await panel.evaluate(value=>window.aether.saveLiveSettings({...value,apiKey:'invalid-aether-recipe-credential'}),configuration)).ok).toBe(true);
    expect((await panel.evaluate(()=>window.aether.getLive())).keyConfigured).toBe(true);
    expect((await readFile(join(profile,'gemini-key.encrypted'))).includes(Buffer.from('invalid-aether-recipe-credential'))).toBe(false);
    await panel.evaluate(()=>window.aether.liveConsent('grant'));
    const actualFailure=await panel.evaluate(()=>window.aether.liveControl('start'));expect(actualFailure.ok).toBe(false);
    const failedProvider=await panel.evaluate(()=>window.aether.getLive());expect(failedProvider.state).toBe('LIVE_ERROR');expect(failedProvider.microphoneActive).toBe(false);expect(failedProvider.sessionId).toBeNull();expect(JSON.stringify(failedProvider)).not.toContain('invalid-aether-recipe-credential');proof.actualInvalidCredentialFailure={state:failedProvider.state,error:failedProvider.error,microphoneActive:failedProvider.microphoneActive,sessionId:failedProvider.sessionId,transportOpened:failedProvider.metrics.some(m=>m.kind==='transport-open')};
    await panel.evaluate(value=>window.aether.saveLiveSettings({...value,removeKey:true}),configuration);await panel.evaluate(()=>window.aether.liveConsent('deny'));
    await panel.close();expect((await entity.evaluate(()=>window.aether.getLive())).microphoneActive).toBe(false);proof.panelClosureStops=true;
    await writeFile(join(folder,'ui-evidence.json'),JSON.stringify(proof,null,2)+'\n');
  }finally{await app.close();await rm(profile,{recursive:true,force:true});}
});
