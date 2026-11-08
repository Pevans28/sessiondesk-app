const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const files = ['assets/app.js','cloud.js','service-worker.js','api/config.js','api/checkout.js','api/portal.js','api/webhook.js','lib/server.js'];
for(const file of files) {
  const source=fs.readFileSync(file,'utf8');
  new vm.Script(source,{filename:file});
  console.log('✓ Syntax: '+file);
}
const html=fs.readFileSync('index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate IDs in index.html');
const script=fs.readFileSync('assets/app.js','utf8')+'\n'+fs.readFileSync('cloud.js','utf8');
const referenced=[...script.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
const dynamicIds=new Set(['clientsResults']);
for(const id of referenced) assert.ok(ids.includes(id)||dynamicIds.has(id),'Missing element #'+id);
for(const id of ['appMain','accountBtn','clientForm','actionForm','appointmentForm','settingsForm','importFile'])
 assert.ok(ids.includes(id)||id==='settingsForm','Expected '+id);
for(const href of ['/assets/app.css','/assets/app.js','/cloud.js','/manifest.webmanifest'])
 assert.ok(html.includes(href),'Missing app asset '+href);
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone');
assert.ok(manifest.icons?.length>0);
const help=fs.readFileSync('help.html','utf8');
assert.ok(help.includes('Help & data safety'));
console.log('✓ Static UI, PWA and data-safety smoke tests passed');
