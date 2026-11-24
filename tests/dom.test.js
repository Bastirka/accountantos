import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('DOM identifiers are unique',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 const counts=new Map();
 for(const id of ids)counts.set(id,(counts.get(id)||0)+1);
 const duplicates=[...counts].filter(([,count])=>count>1).map(([id])=>id);
 assert.deepEqual(duplicates,[]);
});
