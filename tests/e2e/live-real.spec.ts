import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { importJ3Receipt } from './space-fixture';

const encryptedKey=join(process.env.APPDATA??'', 'AETHER','gemini-key.encrypted');
async function synth(text:string):Promise<Buffer>{return new Promise((ok,no)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('dist/main/voice-speech.ps1'),'-Operation','synthesize'],{windowsHide:true});let output='';child.stdout.setEncoding('utf8');child.stdout.on('data',v=>output+=v);child.stderr.on('data',()=>{});child.on('error',no);child.on('exit',code=>{try{const value=JSON.parse(output);if(code||value.error)throw new Error('Synthèse de recette impossible.');ok(Buffer.from(value.wav,'base64'));}catch(error){no(error);}});child.stdin.end(JSON.stringify({text,voice:'Microsoft Hortense Desktop',language:'fr-FR',speed:1}));});}
async function panel(app:ElectronApplication,entity:Page,name:'live'|'voice'|'memory'|'dialogue'){await entity.evaluate(name=>window.aether.command(name),name);await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#'+name))).toBe(true);return app.windows().find(p=>p.url().endsWith('#'+name))!;}

test('Gemini Live actual cloud recipe A-H/K: continuous PCM, native audio, interruption and actual AETHER tools',async()=>{
  test.skip(!process.env.GEMINI_API_KEY&&!existsSync(encryptedKey),'No Gemini credential configured; no cloud success claimed.');test.setTimeout(600000);
  const root=await mkdtemp(join(tmpdir(),'aether-live-real-')),profile=join(root,'profile'),fixtures=join(root,'audio'),proofFolder=resolve('test-results/live-real');await mkdir(profile);await mkdir(fixtures);await mkdir(proofFolder,{recursive:true});
  importJ3Receipt(profile);
  await writeFile(join(profile,'ai-settings.json'),JSON.stringify({schemaVersion:1,provider:'ollama',model:'qwen3.5:9b',ollamaUrl:'http://127.0.0.1:11434',cloudConsent:false}));
  await writeFile(join(profile,'router-settings.json'),JSON.stringify({schemaVersion:1,profiles:{DEEP:{provider:'ollama',model:'qwen3.5:9b'},VISION:null}}));
  if(!process.env.GEMINI_API_KEY){await copyFile(encryptedKey,join(profile,'gemini-key.encrypted'));const localState=JSON.parse(await readFile(join(process.env.APPDATA!,'AETHER','Local State'),'utf8'));await writeFile(join(profile,'Local State'),JSON.stringify({os_crypt:localState.os_crypt}));}
  const env:NodeJS.ProcessEnv={...process.env,AETHER_TEST_PROFILE:profile,AETHER_TEST_LIVE_FIXTURES:fixtures};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;
  const app=await electron.launch({args:[resolve('.')],env:env as Record<string,string>});
  const proof:Record<string,unknown>={date:new Date().toISOString(),provider:'Gemini Live real cloud, fixture input synthesized with Windows TTS; native output PortAudio, no physical microphone.',personalData:false};
  let index=0;
  try{
    const entity=await app.firstWindow();await entity.locator('.entity-stage').waitFor();const voice=await panel(app,entity,'voice');await voice.getByRole('button',{name:'Autoriser le microphone',exact:true}).click();
    const memories=await panel(app,entity,'memory');await memories.getByRole('button',{name:'Ajouter',exact:true}).click();await memories.getByLabel('Contenu',{exact:true}).fill('Le projet fictif de recette LIVE s’appelle Luciole-LIVE-56.');await memories.getByRole('button',{name:'Enregistrer le souvenir',exact:true}).click();
    const live=await panel(app,entity,'live');await live.getByLabel('Activer Gemini Live',{exact:true}).check();await live.getByLabel('Niveau de diagnostic',{exact:true}).selectOption('detailed');await live.getByRole('button',{name:'Enregistrer LIVE',exact:true}).click();await live.getByLabel('J’autorise explicitement l’audio et les données nécessaires des outils vers Gemini',{exact:true}).check();await live.getByRole('button',{name:'Autoriser Gemini Live',exact:true}).click();
    expect((await live.evaluate(()=>window.aether.liveControl('start'))).ok).toBe(true);const id=(await live.evaluate(()=>window.aether.getLive())).sessionId;expect(id).not.toBeNull();expect((await live.evaluate(()=>window.aether.getLive())).source).toBe('test-fixture');expect((await live.evaluate(()=>window.aether.getLive())).microphoneActive).toBe(false);
    async function send(text:string,tool?:string){
      const previousAnswer=(await entity.evaluate(()=>window.aether.getMind())).messages.filter(m=>m.role==='assistant'&&m.modality==='live').at(-1)?.id;
      const audits=(await live.evaluate(()=>window.aether.getLive())).audit.length;
      const name=String(++index).padStart(3,'0'),temp=join(fixtures,name+'.tmp');await writeFile(temp,await synth(text));await rename(temp,join(fixtures,name+'.wav'));
      if(tool)await expect.poll(async()=>(await live.evaluate(()=>window.aether.getLive())).audit.slice(audits).some(a=>a.tool===tool),{timeout:150000}).toBe(true);
      await expect.poll(async()=>(await entity.evaluate(()=>window.aether.getMind())).messages.filter(m=>m.role==='assistant'&&m.modality==='live').at(-1)?.id,{timeout:150000}).not.toBe(previousAnswer);
      await expect.poll(async()=>(await live.evaluate(()=>window.aether.getLive())).state,{timeout:90000}).toBe('LIVE_LISTENING');
      expect((await live.evaluate(()=>window.aether.getLive())).sessionId).toBe(id);
      return (await entity.evaluate(()=>window.aether.getMind())).messages.filter(m=>m.role==='assistant'&&m.modality==='live').at(-1)?.content;
    }
    proof.A=await send('Bonjour Aether.');proof.B=await send('Comment t’appelles-tu ?');
    proof.status=await send('Quel est ton état actuel, avec tes capacités et ton autonomie ? Consulte les données Aether.','get_entity_status');
    proof.D=await send('Qu’est-ce qui t’intéresse en ce moment ?','get_curiosity_summary');
    proof.details=await send('Parle-moi de ton intérêt pour la causalité structurelle.','get_interest_details');
    proof.E=await send('Quel est le nom du projet fictif de recette LIVE enregistré dans ta mémoire ?','search_memory');expect(String(proof.E)).toMatch(/Luciole/i);
    proof.remember=await send('Retiens que la fleur fictive de la recette vocale est un tournesol.','remember_explicitly');
    expect((await entity.evaluate(()=>window.aether.listMemories(''))).some(m=>/tournesol/i.test(m.content))).toBe(false);
    await live.getByRole('button',{name:'Confirmer la mémorisation',exact:true}).click();
    await expect.poll(async()=>(await entity.evaluate(()=>window.aether.listMemories(''))).some(m=>/tournesol/i.test(m.content))).toBe(true);proof.humanRememberConfirmed=true;
    proof.F=await send('Aether, ouvre ton espace.','open_space');await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#space'))).toBe(true);
    proof.G=await send('Regarde comment je fais.','start_echo_guided');await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#echo'))).toBe(true);expect((await entity.evaluate(()=>window.aether.getEcho())).activeSessionId).toBeNull();
    proof.H=await send('Réfléchis vraiment avant de répondre : comment tester expérimentalement un lien entre acoustique et causalité structurelle, avec deux hypothèses et leurs limites ?','delegate_deep_reasoning');
    expect((await live.evaluate(()=>window.aether.getLive())).metrics.some(m=>m.kind==='deep'&&m.success)).toBe(true);
    // Start a deliberately longer answer, then inject new speech while native output plays.
    const first=String(++index).padStart(3,'0');await writeFile(join(fixtures,first+'.tmp'),await synth('Raconte-moi en détail une histoire imaginaire sur un résonateur acoustique.'));await rename(join(fixtures,first+'.tmp'),join(fixtures,first+'.wav'));
    await expect.poll(async()=>(await live.evaluate(()=>window.aether.getLive())).state,{timeout:60000}).toBe('LIVE_SPEAKING');const previous=(await live.evaluate(()=>window.aether.getLive())).metrics.filter(m=>m.kind==='interruption').length;
    proof.C=await send('Attends. Parle-moi uniquement de l’acoustique, en une phrase.');expect((await live.evaluate(()=>window.aether.getLive())).metrics.filter(m=>m.kind==='interruption').length).toBeGreaterThan(previous);
    proof.closeSpace=await send('Ferme ton espace et reviens au bureau.','close_space');await expect.poll(()=>app.windows().some(p=>p.url().endsWith('#space'))).toBe(false);
    proof.stopEcho=await send('Arrête ECHO et annule son observation.','stop_echo');expect((await entity.evaluate(()=>window.aether.getEcho())).activeSessionId).toBeNull();
    proof.forget=await send('Oublie le souvenir concernant tournesol dans ta mémoire. Cherche son identifiant si nécessaire.','forget_memory');
    expect((await entity.evaluate(()=>window.aether.listMemories(''))).some(m=>/tournesol/i.test(m.content))).toBe(true);
    proof.final=await live.evaluate(()=>window.aether.getLive());await live.screenshot({path:join(proofFolder,'live-connected.png'),fullPage:true});const dialogue=await panel(app,entity,'dialogue');await dialogue.screenshot({path:join(proofFolder,'live-dialogue.png')});
    await live.getByRole('button',{name:'Confirmer la suppression du souvenir',exact:true}).click();
    await expect.poll(async()=>(await entity.evaluate(()=>window.aether.listMemories(''))).some(m=>/tournesol/i.test(m.content))).toBe(false);expect((await live.evaluate(()=>window.aether.getLive())).sessionId).toBeNull();proof.humanForgetConfirmed=true;
    await live.evaluate(()=>window.aether.liveConsent('deny'));expect((await live.evaluate(()=>window.aether.getLive())).sessionId).toBeNull();expect((await live.evaluate(()=>window.aether.liveControl('start'))).ok).toBe(false);proof.revoked=true;
    await writeFile(join(proofFolder,'cloud-evidence.json'),JSON.stringify(proof,null,2)+'\n');
  }finally{await app.close();await rm(root,{recursive:true,force:true});}
});
