import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('function referenceHasInvoice('),b=html.indexOf('function render()',a);
assert.ok(a>=0&&b>a,'matching functions must exist');
const db={current:'c1',invoices:[]};
const ctx=vm.createContext({db,Math,Number,String});
vm.runInContext(html.slice(a,b)+';globalThis.referenceHasInvoice=referenceHasInvoice;globalThis.match=match;',ctx);
test('Invoice reference must not match longer invoice number',()=>{
 assert.equal(ctx.referenceHasInvoice('PAYMENT INV-100','INV-10'),false);
 assert.equal(ctx.referenceHasInvoice('PAYMENT INV-10','INV-10'),true);
});
test('Unique invoice matching requires exact amount and company',()=>{
 db.invoices=[{company:'c1',number:'INV-10',total:100},{company:'c2',number:'INV-12',total:100}];
 assert.equal(ctx.match({reference:'paid INV-10',amount:100})?.number,'INV-10');
 assert.equal(ctx.match({reference:'paid INV-10',amount:101}),null);
});
test('Ambiguous invoice references are never auto-selected',()=>{
 db.invoices=[{company:'c1',number:'INV-10',total:100},{company:'c1',number:'INV-11',total:100}];
 assert.equal(ctx.match({reference:'INV-10 INV-11',amount:100}),null);
});
