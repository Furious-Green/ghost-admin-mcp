const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('patched direct dependency versions and affected transitive floors match the installed lock graph',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
  for(const [name,version]of Object.entries({'@modelcontextprotocol/sdk':'1.32.1',axios:'1.20.0',zod:'3.25.76'})){
    assert.equal(pkg.dependencies[name],version,name);assert.equal(lock.packages[''].dependencies[name],version,name);
    assert.equal(lock.packages[`node_modules/${name}`].version,version,name);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json'),'utf8')).version,version,name);
  }
  assert.equal(lock.packages['node_modules/@tryghost/admin-api'].version,'1.13.13');
  const floors={'body-parser':'2.3.0','follow-redirects':'1.16.0','form-data':'4.0.6',jws:'3.2.3','path-to-regexp':'8.4.0','proxy-addr':'2.0.8',qs:'6.16.0'};
  const atLeast=(actual,min)=>{const a=actual.split('.').map(Number),b=min.split('.').map(Number);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i]}return true};
  for(const [name,min]of Object.entries(floors)){
    const matches=Object.entries(lock.packages).filter(([key])=>key===`node_modules/${name}`||key.endsWith(`/node_modules/${name}`));
    assert.ok(matches.length,name);
    for(const [location,entry]of matches){
      assert.ok(atLeast(entry.version,min),`${name}@${entry.version} < ${min}`);
      assert.equal(JSON.parse(fs.readFileSync(path.join(root,location,'package.json'),'utf8')).version,entry.version,location);
      assert.match(entry.integrity,/^sha512-/);
    }
  }
});
