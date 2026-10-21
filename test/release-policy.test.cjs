const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('fork manifest prevents accidental upstream-scope publication and matches the lock',()=>{
  const pkg=require('../package.json'),lock=require('../package-lock.json');
  assert.equal(pkg.name,'ghost-admin-mcp');
  assert.equal(pkg.private,true);
  assert.equal(pkg.publishConfig,undefined);
  assert.equal(lock.name,pkg.name);assert.equal(lock.packages[''].name,pkg.name);
  assert.equal(pkg.bin['ghost-mcp'],'build/server.js');
  assert.equal(pkg.license,'MIT');assert.match(pkg.author,/Fanyang Meng/);
  assert.match(fs.readFileSync('LICENSE','utf8'),/2025 Fanyang Meng/);
  assert.equal(pkg.repository.url,'https://github.com/Furious-Green/ghost-admin-mcp.git');
});
