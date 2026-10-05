import { test,expect,_electron as electron,type ElectronApplication,type Page } from '@playwright/test';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import type { CuriositySnapshot } from '@aether/shared';

async function launch(profile:string) {
  const env:Record<string,string>={};
  for(const [key,value] of Object.entries(process.env)) if(typeof value==='string')env[key]=value;
  delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;env.AETHER_TEST_PROFILE=profile;
  const application=await electron.launch({args:[resolve('.')],env}),entity=await application.firstWindow();
  await expect(entity.getByRole('button',{name:'ENTITY — cliquer ou déplacer'})).toBeVisible();
  expect((await entity.evaluate(()=>window.aether.getSnapshot())).features.curiosity).toBe('available');
  return {application,entity};
}
async function open(application:ElectronApplication,entity:Page,name:'curiosity'|'settings'|'dialogue') {
  expect((await entity.evaluate(command=>window.aether.command(command),name)).ok).toBe(true);
  await expect.poll(()=>application.windows().some(page=>page.url().endsWith(`#${name}`))).toBe(true);
  const page=application.windows().find(page=>page.url().endsWith(`#${name}`))!;
  await page.waitForLoadState('domcontentloaded');
  return page;
}
async function budget(page:Page,count:number,duration=240) {
  await page.getByLabel('Explorations par session',{exact:true}).fill(String(count));
  await page.getByLabel('Temps de calcul par session (secondes)',{exact:true}).fill(String(duration));
  await page.getByLabel('Intervalle minimal (secondes)',{exact:true}).fill('1');
  await page.getByRole('button',{name:'Enregistrer le budget',exact:true}).click();
  await expect.poll(async()=>(await page.evaluate(()=>window.aether.getCuriosity())).settings.maxExplorations).toBe(count);
}
async function completed(page:Page,count:number):Promise<CuriositySnapshot> {
  await expect.poll(async()=>{
    const snapshot=await page.evaluate(()=>window.aether.getCuriosity());
    return snapshot.sessionAttempts===count&&snapshot.state!=='exploring';
  },{timeout:130000,intervals:[250,500,1000]}).toBe(true);
  const snapshot=await page.evaluate(()=>window.aether.getCuriosity());
  expect(snapshot.error,JSON.stringify(snapshot.explorations,null,2)).toBeNull();
  expect(snapshot.explorations[0]!.status).toBe('succeeded');
  expect(snapshot.explorations[0]!.route).toEqual({requested:'DEEP',selected:'DEEP',provider:'ollama',model:'qwen3.5:9b',fallback:false});
  return snapshot;
}

test('J3 A–F: real local birth/restart, continuity, connection, autonomous journal, deletion and disabled limits',async()=>{
  test.setTimeout(600000);
  const profile=await mkdtemp(join(tmpdir(),'aether-j3-real-'));
  const evidence:Record<string,unknown>={startedAt:new Date().toISOString(),provider:'ollama',FAST:'qwen3.5:9b',DEEP:'qwen3.5:9b',mock:false};
  let application:ElectronApplication|undefined;
  try {
    let launched=await launch(profile);application=launched.application;let entity=launched.entity;
    expect((await entity.evaluate(()=>window.aether.saveModelRouter({DEEP:null,VISION:null}))).ok).toBe(false);
    expect((await entity.evaluate(()=>window.aether.writeInterest({title:'Piste interdite depuis ENTITY',description:'Cette fenêtre ne peut pas modifier le journal.',level:.5,status:'active'}))).ok).toBe(false);
    expect((await entity.evaluate(()=>window.aether.blockDomain('robotique',true))).ok).toBe(false);
    const settings=await open(application,entity,'settings');
    await settings.getByLabel('Fournisseur',{exact:true}).selectOption('ollama');
    await settings.getByLabel('Modèle',{exact:true}).fill('qwen3.5:9b');
    await settings.getByRole('button',{name:'Enregistrer l’IA',exact:true}).click();
    await expect(settings.getByRole('status').filter({hasText:'Configuration IA enregistrée.'})).toBeVisible();
    await settings.getByLabel('Fournisseur DEEP',{exact:true}).selectOption('ollama');
    await settings.getByLabel('Modèle DEEP',{exact:true}).fill('qwen3.5:9b');
    await settings.getByRole('button',{name:'Enregistrer les profils',exact:true}).click();
    await expect(settings.locator('.router-settings')).toContainText('Profils enregistrés.');
    expect((await entity.evaluate(()=>window.aether.getModelRouter())).DEEP?.model).toBe('qwen3.5:9b');
    await settings.screenshot({path:'test-results/j3-model-router.png',fullPage:true});
    let journal=await open(application,entity,'curiosity');
    expect((await journal.evaluate(()=>window.aether.getCuriosity())).interests).toHaveLength(0);
    await budget(journal,1,120);
    await journal.getByRole('checkbox',{name:'Exploration autonome',exact:true}).check();
    await expect(entity.locator('.entity-stage')).toHaveAttribute('data-state','exploring');
    await entity.screenshot({path:'test-results/j3-exploring.png',omitBackground:true});
    const first=await completed(journal,1),interest=first.interests[0]!;
    expect(first.interests).toHaveLength(1);expect(interest.origin.kind).toBe('autonomous');expect(first.items).toHaveLength(3);
    expect((await entity.evaluate(()=>window.aether.getMind())).messages).toHaveLength(0);
    await expect(entity.locator('.entity-stage')).toHaveAttribute('data-discovery-pending','true');
    evidence.A_birth=first;
    await journal.screenshot({path:'test-results/j3-birth.png',fullPage:true});
    await journal.getByRole('checkbox',{name:'Exploration autonome',exact:true}).uncheck();
    await application.close();application=undefined;
    launched=await launch(profile);application=launched.application;entity=launched.entity;journal=await open(application,entity,'curiosity');
    const restarted=await journal.evaluate(()=>window.aether.getCuriosity());
    expect(restarted.interests).toEqual(first.interests);expect(restarted.items).toEqual(first.items);expect(restarted.history).toEqual(first.history);
    expect(restarted.settings.enabled).toBe(false);expect(restarted.sessionAttempts).toBe(0);evidence.A_restart=restarted;
    // B: the next scheduled job targets the persisted interest, rather than starting over.
    await journal.getByRole('checkbox',{name:'Exploration autonome',exact:true}).check();
    const continuity=await completed(journal,1);
    expect(continuity.explorations[0]!.targets).toEqual([interest.id]);
    const questions=continuity.items.filter(item=>item.kind==='question'&&item.interestId===interest.id);
    expect(questions).toHaveLength(2);expect(questions[0]!.content).not.toBe(questions[1]!.content);evidence.B_continuity=continuity;
    await journal.getByRole('checkbox',{name:'Exploration autonome',exact:true}).uncheck();
    // C: introduce a second inspectable interest in the actual journal UI.
    await journal.getByRole('button',{name:'Proposer une piste',exact:true}).click();
    await journal.getByLabel('Titre de la piste',{exact:true}).fill('Acoustique des résonateurs');
    await journal.getByLabel('Description de la piste',{exact:true}).fill('Comprendre comment les résonateurs transforment les vibrations en timbres sonores.');
    await journal.getByRole('button',{name:'Enregistrer la piste',exact:true}).click();
    // The model may have made the first track dormant; the user can explicitly reactivate it.
    const current=(await journal.evaluate(()=>window.aether.getCuriosity())).interests.find(item=>item.id===interest.id)!;
    if(current.status!=='active') {
      await journal.locator(`[data-interest-id="${interest.id}"]`).getByRole('button',{name:'Modifier',exact:true}).click();
      await journal.getByLabel('Statut de la piste',{exact:true}).selectOption('active');
      await journal.getByRole('button',{name:'Enregistrer la piste',exact:true}).click();
    }
    await budget(journal,2);
    await journal.getByRole('checkbox',{name:'Exploration autonome',exact:true}).check();
    const connection=await completed(journal,2);
    expect(connection.connections).toHaveLength(1);expect(connection.explorations[0]!.action).toBe('connect');
    expect(connection.explorations[0]!.targets).toHaveLength(2);evidence.C_connection=connection;
    await journal.getByRole('button',{name:'Connexions',exact:true}).click();
    await expect(journal.locator('.connection-card')).toHaveCount(1);
    await journal.screenshot({path:'test-results/j3-connection.png',fullPage:true});
    // D: raising the budget authorizes another timer-driven reflection, without a message or manual launch.
    await budget(journal,3,360);const autonomous=await completed(journal,3);
    expect(autonomous.explorations.filter(item=>item.status==='succeeded')).toHaveLength(4);
    expect((await entity.evaluate(()=>window.aether.getMind())).messages).toHaveLength(0);evidence.D_autonomy=autonomous;
    await journal.getByRole('checkbox',{name:'Exploration autonome',exact:true}).uncheck();
    await journal.getByRole('button',{name:'Ce que j’ai découvert',exact:true}).click();
    await expect(journal.locator('.journal-limit').first()).toContainText('sans vérification externe');
    await journal.screenshot({path:'test-results/j3-discoveries.png',fullPage:true});
    // Actual FAST model can explain its own persisted result, with the human dialogue taking priority.
    const dialogue=await open(application,entity,'dialogue');
    await expect(dialogue.locator('.curiosity-notice')).toBeVisible();
    await dialogue.getByText('Pourquoi cette piste ?', {exact:true}).click();
    const original=dialogue.getByLabel('Détail de la réflexion',{exact:true});
    await expect(original).toContainText(autonomous.explorations[0]!.reason);
    await expect(original).toContainText(autonomous.explorations[0]!.nextQuestion!);
    await dialogue.screenshot({path:'test-results/j3-sharing-journal.png'});
    await dialogue.getByRole('textbox',{name:'Message à ENTITY',exact:true}).fill('Explique brièvement ta dernière exploration : pourquoi ce sujet, ce que tu as découvert et ta prochaine question.');
    await dialogue.getByRole('button',{name:'Envoyer',exact:true}).click();
    await expect.poll(async()=>(await dialogue.evaluate(()=>window.aether.getMind())).messages.at(-1)?.role,{timeout:125000,intervals:[250,500,1000]}).toBe('assistant');
    const explanation=(await dialogue.evaluate(()=>window.aether.getMind())).messages.at(-1)!;
    expect(explanation.model).toBe('qwen3.5:9b');expect(explanation.content.length).toBeGreaterThan(30);evidence.explanation=explanation;
    await dialogue.screenshot({path:'test-results/j3-sharing.png'});
    await journal.getByRole('button',{name:'Marquer les découvertes comme lues',exact:false}).click();
    await expect(entity.locator('.entity-stage')).toHaveAttribute('data-discovery-pending','false');
    // E: inspect and delete the original interest through the native journal.
    await journal.getByRole('button',{name:'Ce qui m’intéresse',exact:true}).click();
    await journal.locator(`[data-interest-id="${interest.id}"]`).getByRole('button',{name:'Supprimer',exact:true}).click();
    await journal.getByRole('button',{name:'Confirmer la suppression',exact:true}).click();
    await expect(journal.locator(`[data-interest-id="${interest.id}"]`)).toHaveCount(0);
    const deleted=await journal.evaluate(()=>window.aether.getCuriosity());
    expect(deleted.interests.some(item=>item.id===interest.id)).toBe(false);expect(deleted.items.some(item=>item.interestId===interest.id)).toBe(false);
    expect(deleted.explorations.some(item=>item.targets.includes(interest.id))).toBe(false);expect((await entity.evaluate(()=>window.aether.getMind())).messages).toHaveLength(0);evidence.E_deletion=deleted;
    // F: disabled mode rejects explicit launches and creates no journal entries beyond the configured interval.
    const before=deleted.explorations.length;
    expect((await journal.evaluate(()=>window.aether.curiosityControl('explore'))).ok).toBe(false);
    await journal.waitForTimeout(2500);
    const disabled=await journal.evaluate(()=>window.aether.getCuriosity());
    expect(disabled.state).toBe('disabled');expect(disabled.explorations).toHaveLength(before);evidence.F_disabled=disabled;
    // Additional transparency controls persist; their mutations go through the approved journal window.
    await journal.getByLabel('Domaine ou expression à exclure',{exact:true}).fill('robotique');
    await journal.getByRole('button',{name:'Exclure ce domaine',exact:true}).click();
    await expect(journal.locator('.blocked-domain')).toContainText('robotique');
    await journal.getByRole('button',{name:'Autoriser de nouveau',exact:true}).click();await expect(journal.locator('.blocked-domain')).toHaveCount(0);
    await expect(entity.locator('.entity-stage')).toHaveAttribute('data-discovery-pending','false');
    evidence.completedAt=new Date().toISOString();
    await writeFile('test-results/j3-real-evidence.json',JSON.stringify(evidence,null,2));
    console.log(JSON.stringify({A:interest.title,B:questions.map(item=>item.content),C:connection.connections[0]!.description,D:autonomous.explorations[0]!.reason,E:'deleted',F:'disabled',explanation:explanation.content}));
  }finally{await application?.close();await rm(profile,{recursive:true,force:true});}
});
