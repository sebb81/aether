import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { EvolutionStore, FileBroker, ForgeEngine, Mirror } from '@aether/evolution';
import { WindowsCapabilityRuntime } from '../apps/desktop/main/evolution-runtime';
import { CodexProvider } from '../apps/desktop/main/codex-provider';

// Real generated source + production runtime/broker. Only controlled test files are created.
// No installation, no broker.apply and no generated source is implemented by this harness.
const repo=resolve('.'), profile=join(repo,'.aether-test-data','j6-reference-profile'), referenceEvidence=join(repo,'docs','recette-j6'), evidence=resolve(process.argv[2]??referenceEvidence);
mkdirSync(evidence,{recursive:true});
const approved=JSON.parse(readFileSync(join(referenceEvidence,'spec-reference.json'),'utf8'));
const store=new EvolutionStore(profile), request=store.request(approved.id);
assert.equal(request.status,'READY');assert.deepEqual(request.specification,approved.specification);assert.equal(store.capabilities().length,0);
const manifest=request.manifest!;
const engine=new ForgeEngine(store,new CodexProvider(),new Mirror(new WindowsCapabilityRuntime(join(store.root,'runtime'))));
const source=engine.source(manifest,false);
assert.equal(source,readFileSync(join(referenceEvidence,'generated-capability.js'),'utf8'));
if(process.argv.includes('--mirror')){
  const tests=JSON.parse(readFileSync(join(store.artifact(request.id,manifest.provenance.attempt),'tests.json'),'utf8'));
  const report=await engine.mirror.test(source,request.specification,tests,new AbortController().signal,()=>{});
  writeFileSync(join(evidence,'mirror-recheck.json'),JSON.stringify(report,null,2)+'\n');
  assert.equal(report.digest,manifest.validation.digest);assert.equal(report.passed,true);
}
const broker=new FileBroker(join(store.root,'previews'),[repo,profile]);
const testRoot=join(dirname(repo),'aether-j6-controlled-files');mkdirSync(testRoot,{recursive:true});
const folder=join(testRoot,randomUUID());mkdirSync(folder);
const date='2026-11-23', novel='prise-'+randomUUID().slice(0,8)+'.WAV';
// Minimal real PCM WAV, generated as a file fixture; no physical recording is claimed.
const wav=Buffer.alloc(46);wav.write('RIFF',0);wav.writeUInt32LE(38,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(2,40);
mkdirSync(join(folder,date));mkdirSync(join(folder,'archives'));
for(const name of [novel,'bloque.wav',date+'/bloque.wav','archives/ancien.wav'])writeFileSync(join(folder,name),wav,{flag:'wx'});
writeFileSync(join(folder,'notes.txt'),'Fichier de recette J6, hors des données personnelles.\n',{flag:'wx'});
function hashes(root:string):Record<string,string>{const result:Record<string,string>={};function walk(dir:string,prefix=''){for(const item of readdirSync(dir,{withFileTypes:true})){const path=prefix+item.name;if(item.isDirectory())walk(join(dir,item.name),path+'/');else result[path]=createHash('sha256').update(readFileSync(join(dir,item.name))).digest('hex');}}walk(root);return result;}
const before=hashes(folder), started=Date.now();
const preview=await broker.preview(manifest.id,manifest.version,folder,{date},input=>engine.run(request.id,input),manifest.permissions);
assert.deepEqual(preview.output,{summary:'Plan de classement WAV',renames:[{from:novel,to:date+'/'+novel}],data:null});
assert.deepEqual(hashes(folder),before);
const staged=join(store.root,'previews',preview.id,'copies');
assert.equal(existsSync(join(staged,novel)),false);assert.equal(hashes(staged)[date+'/'+novel],before[novel]);
for(const name of ['bloque.wav',date+'/bloque.wav','archives/ancien.wav','notes.txt'])assert.equal(hashes(staged)[name],before[name]);
assert.equal(store.capabilities().length,0);
const collisionInput={files:[{path:'PRISE.WAV',size:2,modifiedAt:'2026-10-15T00:00:00.000Z'},{path:date+'/prise.wav',size:2,modifiedAt:'2026-10-15T00:00:00.000Z'}],parameters:{date}};
let collisionOutput:unknown=null, collisionError:string|null=null;
try { collisionOutput=await engine.run(request.id,collisionInput); } catch(error) { collisionError=String(error); }
const collisionReview={at:new Date().toISOString(),attempt:manifest.provenance.attempt,input:collisionInput,output:collisionOutput,error:collisionError,passed:!collisionError&&JSON.stringify(collisionOutput)===JSON.stringify({summary:'Plan de classement WAV',renames:[],data:null})};
writeFileSync(join(evidence,`windows-collision-attempt-${manifest.provenance.attempt}.json`),JSON.stringify(collisionReview,null,2)+'\n');
const proof={at:new Date().toISOString(),result:collisionReview.passed?'PASS':'FAILED',profile:'isolated',requestId:request.id,attempt:manifest.provenance.attempt,capability:manifest.id,version:manifest.version,digest:manifest.validation.digest,generatedBy:manifest.provenance.provider,method:'Production ForgeEngine + Windows MXC/QuickJS + FileBroker, invoked by a test harness, without the native UI folder picker',durationMs:Date.now()-started,folder,preview,collisionReview,sourceHashesBefore:before,sourceHashesAfter:hashes(folder),copyHashesAfter:hashes(staged),originalFilesUnchanged:true,installation:false,originalFileApplication:false};
writeFileSync(join(evidence,'prototype-demo.json'),JSON.stringify(proof,null,2)+'\n');
copyFileSync(join(store.artifact(request.id,manifest.provenance.attempt),'capability.js'),join(evidence,'generated-capability.js'));
copyFileSync(join(store.artifact(request.id,manifest.provenance.attempt),'manifest.json'),join(evidence,'generated-manifest.json'));
writeFileSync(join(evidence,'prototype-review.md'),`# Prototype Classement WAV par date\n\nCode réellement produit par Codex, tentative ${manifest.provenance.attempt}, version ${manifest.version}.\n\nMIRROR : compilation et ${manifest.validation.report.checks.length-1} tests fonctionnels réussis.\n\nEssai réel sur des fichiers de recette créés à part :\n\n| Avant | Copie après essai |\n|---|---|\n| ${novel} | ${date}/${novel} |\n| bloque.wav, destination occupée | inchangé |\n| archives/ancien.wav | inchangé |\n| notes.txt | inchangé |\n\nLes empreintes confirment que les originaux sont intacts. Le code n'a reçu que les métadonnées et la date. L'essai appelle les modules de production depuis un script ; le sélecteur Windows n'a pas été utilisé pour cette démonstration.\n\nPermissions : filesystem.read et filesystem.write, médiées par le noyau sur le dossier sélectionné à chaque usage. Aucun réseau ni commande système.\n\nStatut : READY, aucune installation. L'adoption persistante et l'essai après redémarrage attendent une validation distincte.\n\nSHA-256 : ${manifest.validation.digest}\n\n[Code Codex](generated-capability.js), [manifeste et tests](generated-manifest.json), [preuves sur les fichiers](prototype-demo.json).\n`);
console.log(JSON.stringify({result:proof.result,checks:manifest.validation.report.checks.length,renames:preview.output.renames,originalFilesUnchanged:true,installed:store.capabilities().length}));
assert(collisionReview.passed,'La collision Windows avec casse différente doit être exclue du plan, sans échec du broker.');
