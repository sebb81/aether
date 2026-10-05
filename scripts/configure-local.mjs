import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const model=process.argv[2];
if(!model || !/^[a-zA-Z0-9_./:-]{1,120}$/.test(model)) throw new Error('Usage : node scripts/configure-local.mjs <modele-ollama-installe>');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.AETHER_TEST_PROFILE;delete env.AETHER_RENDERER_URL;
const application=await _electron.launch({args:[resolve('.')],env});
try {
  const entity=await application.firstWindow();await entity.getByRole('button',{name:'ENTITY — cliquer ou déplacer'}).waitFor();
  const before=await entity.evaluate(async()=>({preferences:(await window.aether.getSnapshot()).preferences,memories:await window.aether.listMemories(),journal:await window.aether.getCuriosity(),configuration:await window.aether.getAiConfiguration()}));
  assert.equal(before.journal.settings.enabled,false,'Le script ne modifie pas une autonomie déjà activée.');
  assert.equal(before.configuration.cloudConsent,false,'La configuration locale conserve le cloud désactivé.');
  assert.equal((await entity.evaluate(()=>window.aether.command('settings'))).ok,true);
  const settings=application.windows().find(page=>page.url().endsWith('#settings'));assert(settings);
  await settings.getByLabel('Fournisseur',{exact:true}).selectOption('ollama');
  await settings.getByLabel('Adresse locale Ollama',{exact:true}).fill('http://127.0.0.1:11434');
  await settings.getByLabel('Modèle',{exact:true}).fill(model);
  await settings.getByRole('button',{name:'Enregistrer l’IA',exact:true}).click();
  await settings.getByRole('status').filter({hasText:'Configuration IA enregistrée.'}).waitFor();
  await settings.getByLabel('Fournisseur DEEP',{exact:true}).selectOption('ollama');
  await settings.getByLabel('Modèle DEEP',{exact:true}).fill(model);
  await settings.getByRole('button',{name:'Enregistrer les profils',exact:true}).click();
  await settings.getByText('Profils enregistrés.',{exact:true}).waitFor();
  const after=await entity.evaluate(async()=>({preferences:(await window.aether.getSnapshot()).preferences,memories:await window.aether.listMemories(),journal:await window.aether.getCuriosity(),configuration:await window.aether.getAiConfiguration(),router:await window.aether.getModelRouter()}));
  assert.deepEqual(after.preferences,before.preferences);assert.deepEqual(after.memories,before.memories);assert.deepEqual(after.journal,before.journal);
  assert.equal(after.configuration.model,model);assert.equal(after.configuration.cloudConsent,false);assert.equal(after.router.DEEP.model,model);
  console.log(JSON.stringify({model,router:after.router,preferencesPreserved:true,memoriesPreserved:true,memoryCount:after.memories.length,interestCount:after.journal.interests.length,autonomyEnabled:after.journal.settings.enabled},null,2));
}finally{await application.close();}
