const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');

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

test('stdio fixture honors an extracted working directory rather than testing the repository executable',async t=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'ghost-missing-build-'));
  t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const cli=await require('./helpers/stdioHarness.cjs').startCli(t,{cwd});
  await assert.rejects(cli.request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'artifact-test',version:'1'}}),/CLI closed/);
  await cli.stop();assert.equal(cli.requests.length,0);
});

test('artifact gate refuses tracked changes and preserves existing outputs',t=>{
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'ghost-artifact-preflight-'));
  t.after(()=>fs.rmSync(fixture,{recursive:true,force:true}));
  fs.mkdirSync(path.join(fixture,'scripts'));
  const script=path.resolve('scripts/verify-artifacts.cjs');
  assert.ok(fs.existsSync(script),'artifact verification command must exist');
  fs.copyFileSync(script,path.join(fixture,'scripts/verify-artifacts.cjs'));
  const run=(command,args)=>spawnSync(command,args,{cwd:fixture,encoding:'utf8',timeout:10000});
  assert.equal(run('git',['init','-q']).status,0);
  fs.writeFileSync(path.join(fixture,'tracked'),'original');
  run('git',['add','.']);
  assert.equal(run('git',['-c','user.name=Artifact test','-c','user.email=artifact@example.invalid','commit','-qm','fixture']).status,0);
  fs.writeFileSync(path.join(fixture,'tracked'),'changed');
  const dirty=run(process.execPath,['scripts/verify-artifacts.cjs']);
  assert.notEqual(dirty.status,0);assert.match(dirty.stderr,/tracked changes/i);
  fs.writeFileSync(path.join(fixture,'tracked'),'original');
  const sha=run('git',['rev-parse','HEAD']).stdout.trim(),output=path.join(fixture,'dist',sha);
  fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'keep'),'untouched');
  const existing=run(process.execPath,['scripts/verify-artifacts.cjs']);
  assert.notEqual(existing.status,0);assert.match(existing.stderr,/already exists/i);
  assert.equal(fs.readFileSync(path.join(output,'keep'),'utf8'),'untouched');
});
