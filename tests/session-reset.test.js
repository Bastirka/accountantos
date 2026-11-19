import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('sign-out clears sensitive and unsaved form state before another user signs in',()=>{
 const start=html.slice(html.indexOf('async function start(u)'),html.indexOf("$('authform').onsubmit"));
 for(const id of ['email','password','companyName','csv']){
  assert.match(start,new RegExp("\\$\\('"+id+"'\\)\\.value=''"));
 }
});
