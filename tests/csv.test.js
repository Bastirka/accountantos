import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const from=html.indexOf('function parseCSV(src)'),to=html.indexOf("$('#import').onclick",from);
assert.ok(from>=0,'CSV parser not found');
const ctx=vm.createContext({String,Set,Object,Error});
vm.runInContext(html.slice(from,to)+';globalThis.parseCSV=parseCSV',ctx);
const parse=x=>ctx.parseCSV(x);

test('CSV supports quoted delimiters, escaped quotes and multiline records',()=>{
 const rows=parse('date,description,amount,reference\r\n2026-11-18,"Service, fee\nsecond line",10.25,"INV-""100"""');
 assert.equal(rows.length,1);
 assert.equal(rows[0].description,'Service, fee\nsecond line');
 assert.equal(rows[0].reference,'INV-"100"');
});
test('CSV parses semicolon separated Latvian bank exports and BOM',()=>{
 const rows=parse('\uFEFFdate;description;amount;reference\r\n2026-11-18;Bankas maksa;1,50;REF');
 assert.equal(rows.length,1);
 assert.equal(rows[0].amount,'1,50');
});
test('CSV rejects unclosed quotes',()=>{
 assert.throws(()=>parse('date,description\n2026-11-18,"unfinished'),/neaizvērtas pēdiņas/);
});
test('CSV rejects missing or extra fields instead of silently shifting data',()=>{
 assert.throws(()=>parse('date,description,amount\n2026-11-18,payment'),/kolonnas/);
 assert.throws(()=>parse('date,description\n2026-11-18,payment,extra'),/kolonnas/);
});
test('CSV rejects duplicated headers',()=>{
 assert.throws(()=>parse('date,date\n2026-11-18,x'),/dublēti/);
});
test('Empty CSV has no data',()=>assert.equal(parse('  ').length,0));
