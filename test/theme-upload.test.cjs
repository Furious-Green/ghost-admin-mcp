const {test,after}=require('node:test');
const assert=require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const fixtures=require('./helpers/zipFixtures.cjs');
function prepare(value){return require('../build/schemas/themes.js').prepareThemeUpload(value)}
function reject(bytes){assert.throws(()=>prepare(fixtures.input({bytes})),/Invalid Ghost theme upload/)}

test('theme ZIP accepts classic stored deflate UTF8 descriptors/comments without modifying bytes',()=>{
  for(const archive of [fixtures.zip(),fixtures.zip([{name:'theme/',data:''},{name:'theme/é.hbs',data:'Hello',method:8}],'comment'),
    fixtures.zip([{name:'index.hbs',data:'Hi',method:8,descriptor:true}]),fixtures.zip([{name:'index.hbs',descriptor:true,signed:false}])]){
    const input=fixtures.input(archive),original=structuredClone(input);assert.deepEqual(prepare(input),{input,bytes:archive.bytes});assert.deepEqual(input,original);
  }
});

test('theme ZIP rejects unsafe paths, special files, aliases, unsupported variants and metadata limits',()=>{
  for(const name of ['../escape','/abs','C:/abs','a\\b','a/../b','a/./b','a//b','a\x00b','a\nb','a./b','a /b','CON.txt','a/NUL','x'.repeat(1025)])reject(fixtures.zip([{name}]).bytes);
  for(const files of [[{name:'a'},{name:'A'}],[{name:'a/',data:''},{name:'a'}],[{name:'a'},{name:'a/b'}],[{name:'empty/',data:''}],
    [{name:'symlink',mode:0xa1ff}],[{name:'pipe',mode:0x11a4}],[{name:'enc',flags:1}],[{name:'badmethod',method:12}],
    [{name:'zip64',extra:Buffer.from('01000000','hex')}],[{name:'unicode',extra:Buffer.from('75700000','hex')}],
    [{name:'badextra',extra:Buffer.from([1])}],Array.from({length:2001},(_,i)=>({name:`file${i}`,data:''}))])reject(fixtures.zip(files).bytes);
  const big=fixtures.zip([{name:'bomb',method:8}]);big.bytes.writeUInt32LE(100*1024*1024+1,big.entries[0].central+24);reject(big.bytes);
  const invalidUtf=fixtures.zip([{name:'x',flags:0x800}]);invalidUtf.bytes[30]=0xff;invalidUtf.bytes[invalidUtf.entries[0].central+46]=0xff;reject(invalidUtf.bytes);
});

test('theme ZIP rejects truncated, overlapping, prefixed and contradictory central/local records',()=>{
  const archive=fixtures.zip([{name:'one',data:'A'},{name:'two',method:8,descriptor:true}]);
  const corrupt=(offset,value,width=4)=>{const bytes=Buffer.from(archive.bytes);bytes[width===2?'writeUInt16LE':'writeUInt32LE'](value,offset);reject(bytes)};
  for(const length of [0,1,21,30,archive.bytes.length-1])reject(archive.bytes.subarray(0,length));
  reject(Buffer.concat([archive.bytes,Buffer.from('trailing')]));reject(Buffer.concat([Buffer.from('prefix'),archive.bytes]));
  corrupt(archive.eocd+4,1,2);corrupt(archive.eocd+8,1,2);corrupt(archive.eocd+12,1);corrupt(archive.eocd+16,0xffffffff);
  const c=archive.entries[0].central,l=archive.entries[0].local;
  corrupt(c,0);corrupt(c+20,0xffffffff);corrupt(c+34,1,2);corrupt(c+42,1);
  corrupt(l,0);corrupt(l+6,8,2);corrupt(l+8,8,2);corrupt(l+14,0);corrupt(l+18,999);corrupt(l+26,65535,2);
  corrupt(archive.entries[1].central+42,0);corrupt(archive.entries[1].dataEnd+4,0);
});

test('theme contract enforces ten MiB before decode, rejects unknowns and requires explicit safe activation name',()=>{
  const max=10*1024*1024,overhead=fixtures.zip([{name:'index.hbs',data:''}]).bytes.length;
  const archive=fixtures.zip([{name:'index.hbs',data:Buffer.alloc(max-overhead)}]);assert.equal(archive.bytes.length,max);assert.equal(prepare(fixtures.input(archive)).bytes.length,max);
  for(const extra of [{filename:'../theme.zip'},{filename:'theme.png'},{mime_type:'application/zip'},{ref:'a'},{activate:true},{url:'https://x.invalid'}, {base64:'AB=='},{base64:'data:zip;base64,AAAA'}])assert.throws(()=>prepare({...fixtures.input(),...extra}),/Invalid Ghost theme upload/);
  const original=Buffer.from;let decoded=0;Buffer.from=function(...args){if(args[1]==='base64')decoded++;return Reflect.apply(original,this,args)};
  try{assert.throws(()=>prepare({filename:'x.zip',base64:'A'.repeat(13981017)}),/Invalid Ghost theme upload/)}finally{Buffer.from=original}assert.equal(decoded,0);
  const activate=require('../build/schemas/themes.js').prepareThemeActivate;
  assert.deepEqual(activate({name:'my-theme'}),{name:'my-theme'});
  for(const value of [{},{name:' '},{name:'../x'},{name:'x/y'},{name:'x%20y'},{name:'x',activate:true}])assert.throws(()=>activate(value),/Invalid Ghost theme activate/);
});

async function setup(t){const r=require('./helpers/recordingClient.cjs').makeRecordingClient();const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(r.client);t.after(m.close);return {...r,...m,call:(op,args)=>m.mcpClient.callTool({name:`themes_${op}`,arguments:structuredClone(args)})}}

test('theme upload multipart and activation stay separate and retain actual active state and validation metadata',async t=>{
  const r=await setup(t),archive=fixtures.zip(),input=fixtures.input(archive),meta={unknown:{zero:0}};
  const theme={name:'returned-name',active:true,package:{name:'Package'},templates:[],warnings:[{rule:'warning',details:'inspect'}],errors:[{rule:'non-fatal'}]};
  r.enqueueResponse({themes:[theme],meta});
  assert.deepEqual(JSON.parse((await r.call('upload',input)).content[0].text),{data:theme,meta});assert.equal(r.requests.length,1);
  const request=r.requests[0],boundary=request.headers['Content-Type'].split('boundary=')[1];
  assert.match(boundary,/^[0-9a-f]{48}$/);assert.match(request.url,/\/themes\/upload\/$/);assert.equal(request.method,'POST');
  assert.deepEqual(Buffer.from(request.data),Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="my-theme.zip"\r\nContent-Type: application/zip\r\n\r\n`),
    archive.bytes,Buffer.from(`\r\n--${boundary}--\r\n`),
  ]));assert.equal(request.headers['Content-Length'],String(request.data.length));assert.match(request.headers.Authorization,/^Ghost /);
  r.enqueueResponse({themes:[{...theme,active:false}],meta:{}});
  assert.deepEqual(JSON.parse((await r.call('activate',{name:'café theme'})).content[0].text),{data:{...theme,active:false},meta:{}});
  assert.equal(r.requests.length,2);assert.match(r.requests[1].url,/\/themes\/caf%C3%A9%20theme\/activate\/$/);
  assert.equal(r.requests[1].method,'PUT');assert.equal(r.requests[1].data,undefined);assert.equal(r.requests[1].headers['Content-Type'],undefined);
});

test('theme MCP and direct input rejection is strict, bounded and protects permissive injected clients',async t=>{
  const r=await setup(t);let called=0;const fn=async()=>{called++;return {data:{name:'wrong',active:true}}};
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness({...r.client,themes:{upload:fn,activate:fn}});t.after(m.close);
  const marker='PRIVATE_THEME_MARKER_'+'x'.repeat(10000);
  for(const [op,args]of [['upload',{...fixtures.input(),base64:'AB=='}],['upload',{...fixtures.input(),url:'https://bad.invalid'}],
    ['upload',{...fixtures.input(),[marker]:true}],['upload',{...fixtures.input(),filename:'../x.zip'}],
    ['activate',{}],['activate',{name:'../x'}],['activate',{name:'x',activate:true}],['activate',{name:{[marker]:true}}]]){
    await assert.rejects(r.client.themes[op](args),/Invalid Ghost theme/);
    const result=await m.mcpClient.callTool({name:`themes_${op}`,arguments:args}).catch(error=>({isError:true,content:[{text:error.message}]}));
    assert.equal(result.isError,true);assert.ok(JSON.stringify(result).length<1024);assert.ok(!JSON.stringify(result).includes('PRIVATE_THEME_MARKER_'));
  }
  for(const options of [null,[],{name:'bad'},{headers:{}}])for(const op of ['upload','activate'])await assert.rejects(r.client.themes[op](op==='upload'?fixtures.input():{name:'x'},options),/Invalid Ghost theme/);
  assert.equal(called,0);assert.equal(r.requests.length,0);
  const input=fixtures.input(),copy=structuredClone(input);r.enqueueResponse({themes:[{name:'actual',active:false}]});await r.client.themes.upload(input,{});assert.deepEqual(input,copy);
});

test('theme malformed replies and validation failures remain errors without leaking gscan paths or retrying',async t=>{
  const r=await setup(t);
  for(const body of [{},{themes:[]},{themes:[{},{}]},{themes:[{}]},{themes:[{name:'x'}]},{themes:[{name:' ',active:false}]},{themes:[{name:'x',active:'true'}]},{themes:[{name:'x',active:true}],meta:null}]){
    r.enqueueResponse(body);const result=await r.call('activate',{name:'requested'});assert.equal(result.isError,true);assert.match(result.content[0].text,/Unexpected Ghost themes response/);
  }
  const error=require('./helpers/fixtures.cjs').permissionError();error.response.status=422;
  error.response.data.errors=[{type:'ThemeValidationError',message:'PRIVATE_SERVER_PATH /tmp/theme',details:fixtures.input().base64}];
  for(const op of ['upload','activate']){
    r.enqueueError(error);const before=r.requests.length;const output=await r.call(op,op==='upload'?fixtures.input():{name:'requested'});
    assert.equal(output.isError,true);assert.match(output.content[0].text,/HTTP 422/);assert.match(output.content[0].text,/ThemeValidationError/);
    assert.ok(!JSON.stringify(output).includes('PRIVATE_SERVER_PATH'));assert.equal(r.requests.length,before+1);
  }
});

test('theme success and failure use no local filesystem or extraction',async()=>{
  const r=require('./helpers/recordingClient.cjs').makeRecordingClient(),input=fixtures.input();
  const targets=[require('node:fs'),require('node:fs/promises')],saved=[];
  for(const target of targets)for(const name of ['open','openSync','readFile','readFileSync','writeFile','writeFileSync','mkdtemp','mkdtempSync','unlink','unlinkSync','createReadStream','createWriteStream'])if(typeof target[name]==='function'){saved.push([target,name,target[name]]);target[name]=()=>{throw new Error('Unexpected filesystem operation')}}
  try{
    r.enqueueResponse({themes:[{name:'x',active:false}]});await r.client.themes.upload(input);
    r.enqueueError(new Error('transport lost'));await assert.rejects(r.client.themes.upload(input),/request failed/);
    r.enqueueResponse({themes:[{name:'x',active:true}]});await r.client.themes.activate({name:'x'});
    await assert.rejects(r.client.themes.upload({...input,base64:'bad'}),/Invalid Ghost theme/);
  }finally{for(const [target,name,original]of saved)target[name]=original}
  assert.equal(r.requests.length,3);
});
