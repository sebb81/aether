import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {openLocalDatabase} from '@aether/memory';
import type {CuriositySnapshot} from '@aether/shared';

/** Copies the preserved real J3 receipt only into a disposable test profile. */
export function importJ3Receipt(profile:string):CuriositySnapshot {
  const snapshot=JSON.parse(readFileSync('docs/recette-j4/source-j3.json','utf8')).snapshot as CuriositySnapshot,db=openLocalDatabase(join(profile,'memory.sqlite'));
  try{db.exec('BEGIN IMMEDIATE');
    for(const item of snapshot.interests)db.prepare('INSERT INTO curiosity_interests VALUES(?,?,?,?,?,?,?,?)').run(item.id,item.title,item.description,item.createdAt,item.updatedAt,item.level,JSON.stringify(item.origin),item.status);
    for(const item of snapshot.explorations)db.prepare('INSERT INTO curiosity_explorations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(item.id,item.interestId,JSON.stringify(item.targets),item.action,item.createdAt,item.completedAt,item.status,item.reason,item.model,item.route?JSON.stringify(item.route):null,item.error,item.nextQuestion,Number(item.unread));
    for(const item of snapshot.items)db.prepare('INSERT INTO curiosity_items VALUES(?,?,?,?,?,?,?,?,?)').run(item.id,item.interestId,item.explorationId,item.kind,item.content,item.createdAt,item.confidence,item.limits,item.status);
    for(const item of snapshot.connections)db.prepare('INSERT INTO curiosity_connections VALUES(?,?,?,?,?,?)').run(item.id,item.fromId,item.toId,item.explorationId,item.description,item.createdAt);
    for(const item of snapshot.history)db.prepare('INSERT INTO curiosity_history VALUES(?,?,?,?,?,?,?,?,?,?)').run(item.id,item.interestId,item.explorationId,item.createdAt,item.action,item.reason,item.previousLevel,item.level,item.previousStatus,item.status);
    db.prepare('INSERT INTO curiosity_settings VALUES(1,?)').run(JSON.stringify({enabled:false,maxExplorations:1,maxDurationSeconds:120,minIntervalSeconds:1}));
    db.exec('COMMIT');return snapshot;
  }catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
}
