const {test,after}=require('node:test');
const assert=require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const fixtures=require('./helpers/imageFixtures.cjs');
function prepare(input){return require('../build/schemas/images.js').prepareImageUpload(input)}

test('image contract preserves four header-identified types and opaque reference without mutation',()=>{
  for(const image of fixtures.images){
    const input={...fixtures.input(image),ref:'reference:你好'},original=structuredClone(input);
    const parsed=prepare(input);assert.deepEqual(parsed.input,input);assert.deepEqual(parsed.bytes,image.bytes);
    assert.deepEqual(input,original);
  }
  assert.equal(prepare({...fixtures.input(fixtures.images[0]),filename:'Photo.JPEG'}).input.filename,'Photo.JPEG');
  assert.equal(prepare({...fixtures.input(fixtures.images[2]),base64:Buffer.from('GIF87a').toString('base64')}).bytes.toString(),'GIF87a');
});

test('image contract rejects noncanonical base64, unsupported fields and mismatched metadata/signatures',()=>{
  const valid=fixtures.input();
  for(const base64 of ['',valid.base64+'\n','data:image/png;base64,'+valid.base64,'____','iVBORw0KGgo','a===','AB==','ABC=','====','!@#$','A','AA=']){
    assert.throws(()=>prepare({...valid,base64}),/Invalid Ghost image upload/);
  }
  for(const extra of [
    {filename:'../pixel.png'},{filename:'/pixel.png'},{filename:'C:\\pixel.png'},{filename:'.pixel.png'},
    {filename:'p\r\nx.png'},{filename:'p".png'},{filename:'p%.png'},{filename:'p'.repeat(121)+'.png'},
    {filename:'x.jpg'},{mime_type:'image/svg+xml'},{mime_type:'image/jpeg'},
    {base64:Buffer.from('<svg>not an image</svg>').toString('base64')},{ref:''},{ref:' '},{ref:'bad\nref'},
    {ref:'x'.repeat(1025)},{path:'/etc/passwd'},{url:'https://external.invalid/x'},{headers:{x:'y'}},{usage:'icon'},
  ])assert.throws(()=>prepare({...valid,...extra}),/Invalid Ghost image upload/);
  for(const value of [null,[],undefined,{},42])assert.throws(()=>prepare(value),/Invalid Ghost image upload/);
  const highBits=Buffer.from('GIF89a');for(let i=0;i<highBits.length;i++)highBits[i]|=0x80;
  assert.throws(()=>prepare({...fixtures.input(fixtures.images[2]),base64:highBits.toString('base64')}),/Invalid Ghost image upload/);
});

test('image contract accepts exact five MiB and rejects over-limit before decoding',()=>{
  const max=5*1024*1024,bytes=Buffer.alloc(max);fixtures.images[1].bytes.copy(bytes);
  const input={...fixtures.input(),base64:bytes.toString('base64')};
  assert.equal(prepare(input).bytes.length,max);
  const over=Buffer.concat([bytes,Buffer.from([0])]).toString('base64');
  assert.throws(()=>prepare({...input,base64:over}),/Invalid Ghost image upload/);
  const original=Buffer.from;let decoded=0;
  Buffer.from=function(...args){if(args[1]==='base64')decoded++;return Reflect.apply(original,this,args)};
  try{
    assert.throws(()=>prepare({...input,base64:'A'.repeat(6990509)}),/Invalid Ghost image upload/);
    assert.throws(()=>prepare({...input,base64:over}),/Invalid Ghost image upload/);
  }finally{Buffer.from=original}
  assert.equal(decoded,0);
});

async function setup(t){
  const r=require('./helpers/recordingClient.cjs').makeRecordingClient();
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(r.client);t.after(m.close);
  return {...r,...m,call:input=>m.mcpClient.callTool({name:'images_upload',arguments:input})};
}

test('MCP upload maps exact multipart bytes and preserves returned URL/ref/meta literally',async t=>{
  const r=await setup(t),{config}=require('./helpers/fixtures.cjs');
  for(const image of fixtures.images){
    const input={...fixtures.input(image),ref:'opaque:你好'},meta={unknown:{zero:0}};
    r.enqueueResponse({images:[{url:'https://storage.invalid/renamed',ref:null,extra:false}],meta});
    const result=await r.call(input);assert.notEqual(result.isError,true,result.content[0].text);
    assert.deepEqual(JSON.parse(result.content[0].text),{data:{url:'https://storage.invalid/renamed',ref:null,extra:false},meta});
    const request=r.requests.at(-1),boundary=request.headers['Content-Type'].split('boundary=')[1];
    assert.match(boundary,/^[0-9a-f]{48}$/);assert.equal(request.url,config.url+'/ghost/api/admin/images/upload/');
    assert.equal(request.method,'POST');assert.deepEqual(request.params,{});assert.match(request.headers.Authorization,/^Ghost /);
    const expected=Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${image.filename}"\r\nContent-Type: ${image.mime_type}\r\n\r\n`),
      image.bytes,Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="ref"\r\n\r\nopaque:你好\r\n--${boundary}--\r\n`),
    ]);
    assert.deepEqual(Buffer.from(request.data),expected);assert.equal(request.headers['Content-Length'],String(expected.length));
  }
  assert.equal(new Set(r.requests.map(x=>x.headers['Content-Type'])).size,4);
  r.enqueueResponse({images:[{url:'/relative/image.png'}]});
  assert.deepEqual(JSON.parse((await r.call(fixtures.input())).content[0].text),{data:{url:'/relative/image.png'}});
  assert.ok(!Buffer.from(r.requests.at(-1).data).includes(Buffer.from('name="ref"')));
});

test('direct/MCP/injected upload rejects invalid input and options before dispatch',async t=>{
  const r=await setup(t);let called=0;
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness({...r.client,images:{upload:async()=>{called++;return {data:{url:'bad'}}}}});t.after(m.close);
  for(const extra of [{base64:'AB=='},{filename:'../a.png'},{mime_type:'image/gif'},{base64:'A'.repeat(6990509)},{url:'https://external.invalid'}, {ref:'bad\r\nref'}]){
    const input={...fixtures.input(),...extra};await assert.rejects(r.client.images.upload(input),/Invalid Ghost image upload/);
    const output=await m.mcpClient.callTool({name:'images_upload',arguments:input}).catch(error=>({isError:true}));assert.equal(output.isError,true);
  }
  for(const options of [null,[],{source:'file'},{headers:{}}])await assert.rejects(r.client.images.upload(fixtures.input(),options),/Invalid Ghost image upload/);
  assert.equal(called,0);assert.equal(r.requests.length,0);
  const input=fixtures.input(),original=structuredClone(input),options={};
  r.enqueueResponse({images:[{url:'/image.png',ref:'returned-not-requested'}],meta:{}});
  assert.deepEqual(await r.client.images.upload(input,options),{data:{url:'/image.png',ref:'returned-not-requested'},meta:{}});
  assert.deepEqual(input,original);assert.deepEqual(options,{});
});

test('upload rejects malformed image replies and safely reports one HTTP error without payload echoes',async t=>{
  const r=await setup(t);
  for(const body of [{}, {images:[]},{images:[{},{}]}, {images:[{}]},{images:[{url:null}]},{images:[{url:' '}]},
    {images:[{url:'/x',ref:42}]},{images:[{url:'/x'}],meta:[]},{images:[{url:'/x'}],meta:null}]){
    r.enqueueResponse(body);const result=await r.call(fixtures.input());assert.equal(result.isError,true);assert.match(result.content[0].text,/Unexpected Ghost images response/);
  }
  const {config,permissionError}=require('./helpers/fixtures.cjs');
  const error=permissionError();error.response.data.errors[0].message=fixtures.input().base64+config.key;
  r.enqueueError(error);const before=r.requests.length,result=await r.call(fixtures.input());
  assert.equal(result.isError,true);assert.match(result.content[0].text,/HTTP 403/);assert.equal(r.requests.length,before+1);
  assert.ok(!JSON.stringify(result).includes(config.key));assert.ok(!JSON.stringify(result).includes(fixtures.input().base64));
});

test('image upload uses no local file operations on success, error or invalid input',async()=>{
  const r=require('./helpers/recordingClient.cjs').makeRecordingClient();
  const fs=require('node:fs'),promises=require('node:fs/promises'),saved=[];
  for(const target of [fs,promises])for(const name of ['open','openSync','readFile','readFileSync','writeFile','writeFileSync','mkdtemp','mkdtempSync','unlink','unlinkSync','createReadStream','createWriteStream']){
    if(typeof target[name]==='function'){saved.push([target,name,target[name]]);target[name]=()=>{throw new Error('Unexpected local filesystem operation')}}
  }
  try{
    r.enqueueResponse({images:[{url:'/image.png'}]});await r.client.images.upload(fixtures.input());
    r.enqueueError(new Error('network lost'));await assert.rejects(r.client.images.upload(fixtures.input()),/request failed/);
    await assert.rejects(r.client.images.upload({...fixtures.input(),base64:'invalid'}),/Invalid Ghost image upload/);
  }finally{for(const [target,name,original]of saved)target[name]=original}
  assert.equal(r.requests.length,2);
});

test('internal multipart is restricted to the upload route and bounded before HTTP',async()=>{
  const {config}=require('./helpers/fixtures.cjs');let called=0;
  const send=require('../build/client/nativeAdmin.js').createNativeAdminRequest(config,async()=>{called++});
  const boundary='a'.repeat(48);
  for(const input of [{}, {body:{}}, {multipart:{body:'wrong',boundary}},
    {multipart:{body:Buffer.alloc(5*1024*1024+8193),boundary}}, {multipart:{body:Buffer.from('x'),boundary:'bad\r\n'}},
    {multipart:{body:Buffer.from('x'),boundary},query:{url:'bad'}}])await assert.rejects(send('images.upload',input));
  await assert.rejects(send('tiers.add',{multipart:{body:Buffer.from('x'),boundary}}));
  assert.equal(called,0);
});
