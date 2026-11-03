import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { ensureSchema } from '../lib/schema.mjs';
import { validateBooking, validateRange, localDay } from '../lib/booking.mjs';
import { PostgresStore, MemoryStore } from '../lib/store.mjs';
import { createHandler } from '../lib/handler.mjs';

const fixedNow = new Date('2026-11-02T06:00:00Z');
const input = extra => ({room:'big',name:'Test organiser',date:'2026-11-03',start:'09:00',duration:60,purpose:'Planning meeting',department:'Education',cancelToken:randomBytes(32).toString('hex'),...extra});
const booking = extra => validateBooking(input(extra),fixedNow);

test('date and duration validation respects Rundu time and overnight bookings',()=>{
  const result=booking({start:'23:30',duration:90});
  assert.equal(result.startAt,'2026-11-03T21:30:00.000Z');
  assert.equal(result.endAt,'2026-11-03T23:00:00.000Z');
  assert.equal(localDay(new Date(result.endAt)),'2026-11-04');
  for(const extra of [{date:'2026-02-30'},{start:'24:00'},{duration:0},{duration:16},{duration:1441},{name:'x'},{date:'2026-11-01'},{room:'third'},{cancelToken:'guess'}]) {
    assert.throws(()=>booking(extra));
  }
  assert.throws(()=>validateRange('2026-11-31','2026-12-01'));
  assert.throws(()=>validateRange('2025-01-01','2026-12-01'));
});

test('PostgreSQL constraints reject simultaneous overlaps while allowing adjacent bookings and separate rooms',async()=>{
  const db=new PGlite();
  try {
    const setup = {
      query:(text,args=[])=>({text,args}),
      transaction:queries=>db.transaction(async tx=>{for (const {text,args} of queries) await tx.query(text,args);})
    };
    await ensureSchema(setup);
    await ensureSchema(setup);
    const store=new PostgresStore({query:async(text,args)=>(await db.query(text,args)).rows});
    const first=booking();
    const results=await Promise.allSettled([store.create(first),store.create(booking({start:'09:30'}))]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
    const big=results.find(r=>r.status==='fulfilled').value;
    assert.equal((await store.create(first)).id,big.id,'retry returns the original booking');
    await store.create(booking({start:'10:00'}));
    await store.create(booking({room:'small'}));
    const listed=await store.list('2026-11-03','2026-11-03');
    assert.equal(listed.length,3);
    await db.exec("SET TIME ZONE 'Pacific/Honolulu'");
    assert.equal((await store.list('2026-11-03','2026-11-03')).length,3,'listing is independent of the database session time zone');
    assert.equal(JSON.stringify(listed).includes('cancel'),false,'public list never includes cancellation credentials');
    await assert.rejects(()=>store.cancel(big.id,randomBytes(32).toString('hex')),e=>e.status===404);
    await store.cancel(big.id,first.cancelToken);
    assert.equal((await store.list('2026-11-03','2026-11-03')).length,2);
    await store.create(booking({start:'09:00'}));
    await store.create(booking({date:'2026-11-04',name:"O'Brien <script>test</script>",start:'23:30',duration:90}));
    const overnight=await store.list('2026-11-05','2026-11-05');
    assert.equal(overnight.length,1);
    assert.equal(overnight[0].name,"O'Brien <script>test</script>");
    assert.equal((await store.list('2026-11-06','2026-11-06')).length,0);
  }finally {await db.close();}
});

function invoke(handler,{method='GET',url='/api/bookings',body,origin='http://localhost:3000',contentType='application/json'}={}) {
  return new Promise(resolve=>{
    const headers={};
    const req={method,url,body,headers:{host:'localhost:3000',origin,'content-type':contentType}};
    const res={setHeader:(key,value)=>headers[key]=value,status(code){this.statusCode=code;return this;},json(data){resolve({status:this.statusCode,data,headers});}};
    handler(req,res);
  });
}

test('public API creates, lists, blocks conflicts and permits only a matching cancellation link',async()=>{
  const handler=createHandler(async()=>newStore,{now:()=>fixedNow});
  const newStore=new MemoryStore();
  const payload=input();
  const created=await invoke(handler,{method:'POST',body:payload});
  assert.equal(created.status,201);
  assert.equal(created.data.booking.cancelToken,undefined);
  const conflict=await invoke(handler,{method:'POST',body:input({start:'09:30'})});
  assert.equal(conflict.status,409);
  const listed=await invoke(handler,{url:'/api/bookings?from=2026-11-03&to=2026-11-03'});
  assert.equal(listed.data.bookings.length,1);
  assert.equal(listed.headers['Cache-Control'],'no-store, max-age=0');
  assert.equal((await invoke(handler,{url:`/api/bookings?id=${created.data.booking.id}`})).data.booking.name,payload.name);
  const wrong=await invoke(handler,{method:'DELETE',body:{id:created.data.booking.id,cancelToken:randomBytes(32).toString('hex')}});
  assert.equal(wrong.status,404);
  const cancelled=await invoke(handler,{method:'DELETE',body:{id:created.data.booking.id,cancelToken:payload.cancelToken}});
  assert.equal(cancelled.status,200);
  assert.equal((await newStore.list('2026-11-03','2026-11-03')).length,0);
  assert.equal((await invoke(handler,{method:'POST',body:input(),origin:'https://other.example'})).status,403);
  assert.equal((await invoke(handler,{method:'POST',body:input(),contentType:'text/plain'})).status,415);
  assert.equal((await invoke(handler,{url:'/api/bookings?id=------------------------------------'})).status,400);
  assert.equal((await invoke(handler,{method:'PUT'})).status,405);
});

test('production endpoint refuses to pretend local data is a shared database',async()=>{
  const previous=process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const {default:handler}=await import('../api/bookings.js');
    const result=await invoke(handler);
    assert.equal(result.status,503);
    assert.equal(result.data.code,'DATABASE_REQUIRED');
    assert.equal(result.data.bookings,undefined);
  }finally {if(previous)process.env.DATABASE_URL=previous;}
});
