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
