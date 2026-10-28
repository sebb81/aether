import { _electron as electron } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// This harness always uses an isolated profile. It never grants consent in the personal profile.
const phase=process.argv[2]??'prepare', profile=resolve('.aether-test-data/j6-reference-profile'), evidence=resolve('docs/recette-j6');
await mkdir(profile,{recursive:true});await mkdir(evidence,{recursive:true});
if(phase==='prepare'){
  await writeFile(join(profile,'ai-settings.json'),JSON.stringify({schemaVersion:1,provider:'ollama',model:'qwen3.5:9b',ollamaUrl:'http://127.0.0.1:11434',cloudConsent:false}));
  await writeFile(join(profile,'router-settings.json'),JSON.stringify({schemaVersion:1,profiles:{DEEP:{provider:'ollama',model:'qwen3.5:9b'},VISION:null}}));
}
const env={...process.env,AETHER_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.OPENAI_API_KEY;delete env.GEMINI_API_KEY;
const app=await electron.launch({args:[resolve('.')],env});
const errors=[];app.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
async function waitFor(predicate,ms=180000){const until=Date.now()+ms;while(Date.now()<until){const value=await predicate();if(value)return value;await new Promise(r=>setTimeout(r,250));}throw new Error('Recipe timeout');}
try{
  const entity=await app.firstWindow();await entity.locator('.entity-stage').waitFor();
  const forbidden=await entity.evaluate(()=>window.aether.evolutionAction('generate','00000000-0000-0000-0000-000000000000',true)).catch(error=>({error:String(error)}));
  await entity.evaluate(()=>window.aether.command('forge'));const panel=await waitFor(()=>app.windows().find(p=>p.url().endsWith('#forge')));await panel.getByRole('heading',{name:'Fabriquer une capacité',exact:true}).waitFor();
  if(phase==='prepare'){
    const description='Créer une capacité de classement WAV par date. Scénario contrôlé, aucune habitude personnelle revendiquée. Entrée : métadonnées des fichiers du dossier explicitement choisi et parameters.date au format AAAA-MM-JJ (exemple 2026-10-15). Pour chaque fichier WAV du dossier racine seulement (extension insensible à la casse), proposer son déplacement dans le sous-dossier portant cette date, en gardant son nom original. Ne pas déplacer les fichiers non WAV ni les fichiers déjà dans un sous-dossier. Ne pas écraser un fichier existant. Retourner un plan et un résumé court stable, data=null. Droits filesystem.read et filesystem.write sur ce seul dossier. Aucune dépendance ni réseau. Fournir des tests acceptation : un WAV et un TXT, dossier vide, WAV déjà classé. La date doit pouvoir changer lors de réutilisation. Le champ summary de chaque sortie doit valoir exactement Plan de classement WAV. Aucun traitement du contenu. Un sous-dossier cible existant peut recevoir un autre fichier dont le nom est libre. Reponses de clarification : le dossier sera choisi au moment de chaque essai dans le selecteur Windows, il est la racine relative implicite. Aucun chemin cible reel n est necessaire pour generer le code. La date fournie en parametre est utilisee telle quelle apres validation du format AAAA-MM-JJ, sans deduction depuis les metadonnees. Aucune fabrication avant confirmation.';
    await panel.getByLabel('Ce que la capacité doit faire').fill(description);await panel.getByRole('button',{name:'Préparer la spécification avec MIND',exact:true}).click();
    const state=await waitFor(async()=>{const s=await panel.evaluate(()=>window.aether.getEvolution());if(s.requests.length)return s;const alert=await panel.getByRole('alert').textContent().catch(()=>null);if(alert)throw new Error(alert);return null;});
    await writeFile(join(evidence,'spec-reference.json'),JSON.stringify(state.requests[0],null,2)+'\n');await writeFile(join(evidence,'prepare-evidence.json'),JSON.stringify({at:new Date().toISOString(),profile:'isolated',provider:'Ollama qwen3.5:9b, actual local MIND specification',requestId:state.requests[0].id,generatedCode:false,entityMutationDenied:forbidden},null,2)+'\n');
    await panel.screenshot({path:join(evidence,'specification.png'),fullPage:true});console.log(JSON.stringify({phase,requestId:state.requests[0].id,status:state.requests[0].status,title:state.requests[0].specification.title,errors}));
  } else if(phase==='generate'){
    const stored=JSON.parse(await readFile(join(evidence,'spec-reference.json'),'utf8'));
    const card=panel.locator(`[data-forge-id="${stored.id}"]`);await card.getByRole('button',{name:/Autoriser (la fabrication Codex|une nouvelle tentative)/}).click();await panel.getByRole('button',{name:'Confirmer la fabrication',exact:true}).click();
    const state=await waitFor(async()=>{const s=await panel.evaluate(()=>window.aether.getEvolution()),r=s.requests.find(r=>r.id===stored.id);return r&&['READY','FAILED','CANCELLED'].includes(r.status)?s:null;},330000);
    const request=state.requests.find(r=>r.id===stored.id),proof=JSON.stringify({at:new Date().toISOString(),profile:'isolated',actualCodex:true,request,installed:state.capabilities.length,errors},null,2)+'\n';await writeFile(join(evidence,'generation-evidence.json'),proof);await writeFile(join(evidence,`generation-attempt-${request.attempts.at(-1).number}.json`),proof);await panel.screenshot({path:join(evidence,'mirror-result.png'),fullPage:true});console.log(JSON.stringify({phase,status:request.status,lastError:request.attempts.at(-1)?.error,tests:request.attempts.at(-1)?.report?.checks,installed:state.capabilities.length}));
  } else {
    const state=await panel.evaluate(()=>window.aether.getEvolution());await writeFile(join(evidence,'spec-reference.json'),JSON.stringify(state.requests[0],null,2)+'\n');await panel.screenshot({path:join(evidence,'specification.png'),fullPage:true});console.log(JSON.stringify({phase,requests:state.requests.map(r=>({id:r.id,title:r.specification.title,status:r.status})),capabilities:state.capabilities.map(c=>({id:c.manifest.id,version:c.manifest.version,state:c.state})),errors}));
  }
}finally{await app.close();}
