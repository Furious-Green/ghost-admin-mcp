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
  try{assert.throws(()=>prepare({...input,base64:'A'.repeat(6990509)}),/Invalid Ghost image upload/)}finally{Buffer.from=original}
  assert.equal(decoded,0);
});
