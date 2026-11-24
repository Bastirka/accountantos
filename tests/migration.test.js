import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../sql/normalize_workspace_v1.sql',import.meta.url),'utf8');

test('normalized migration is non-destructive and transactional',()=>{
 assert.match(sql,/\bbegin\s*;/i);
 assert.match(sql,/\bcommit\s*;/i);
 assert.doesNotMatch(sql,/\bdrop\s+table\b/i);
 assert.doesNotMatch(sql,/\bdelete\s+from\s+public\.workspaces\b/i);
 assert.doesNotMatch(sql,/\bupdate\s+public\.workspaces\b/i);
});
test('normalized migration creates and backfills every entity',()=>{
 for(const table of ['companies','transactions','invoices','documents']){
  assert.match(sql,new RegExp('create table if not exists public\\.'+table,'i'));
  assert.match(sql,new RegExp('insert into public\\.'+table,'i'));
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security','i'));
  assert.match(sql,new RegExp('revoke all on [^;]*public\\.'+table+'[^;]* from anon','i'));
 }
});
test('normalized child records keep user-scoped company foreign keys',()=>{
 const matches=sql.match(/foreign key \(user_id,company_id\) references public\.companies\(user_id,id\) on delete cascade/gi)||[];
 assert.equal(matches.length,3);
});
test('legacy workspace remains declared as migration source',()=>{
 assert.match(sql,/legacy_preserved',true/i);
 assert.match(sql,/'source','public\.workspaces'/i);
});
