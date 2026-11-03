import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createHandler } from '../lib/handler.mjs';
import { MemoryStore } from '../lib/store.mjs';
import { VehicleMemoryStore } from '../lib/vehicle-store.mjs';
import { validateVehicleBooking } from '../lib/vehicle-booking.mjs';

const root = resolve(import.meta.dirname,'..');
let handler;
let vehicleHandler;
if (process.env.DATABASE_URL) {
  handler = (await import('../api/bookings.js')).default;
  vehicleHandler = (await import('../api/vehicle-bookings.js')).default;
} else {
  const directory = resolve(root,'.local-data');
  mkdirSync(directory,{recursive:true});
  const file = resolve(directory,'bookings.json');
  const store = new MemoryStore(existsSync(file) ? JSON.parse(readFileSync(file,'utf8')) : []);
  store.save = () => writeFileSync(file,JSON.stringify(store.rows,null,2));
  handler = createHandler(async()=>store,{demo:true});
  const vehicleFile = resolve(directory,'vehicle-bookings.json');
  const vehicleStore = new VehicleMemoryStore(existsSync(vehicleFile) ? JSON.parse(readFileSync(vehicleFile,'utf8')) : []);
  vehicleStore.save = () => writeFileSync(vehicleFile,JSON.stringify(vehicleStore.rows,null,2));
  vehicleHandler = createHandler(async()=>vehicleStore,{demo:true,validate:validateVehicleBooking});
}
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const publicRoot = resolve(root,'public');
const responseHeaders = JSON.parse(readFileSync(resolve(root,'vercel.json'),'utf8')).headers[0].headers;
const server = createServer(async(req,res)=>{
  for (const {key,value} of responseHeaders) res.setHeader(key,value);
  const url = new URL(req.url,'http://localhost');
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)); };
  if (url.pathname === '/api/bookings' || url.pathname === '/api/vehicle-bookings') {
    try {
      let data = '';
      for await (const chunk of req) { data += chunk; if (data.length > 16384) { res.status(413).json({error:'Booking details are too long.'}); return; } }
      req.body = data ? JSON.parse(data) : undefined;
    } catch { res.status(400).json({error:'Invalid booking details.'}); return; }
    await (url.pathname === '/api/bookings' ? handler : vehicleHandler)(req,res);
    return;
  }
  let file;
  try { file = resolve(publicRoot,`.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`); } catch { res.statusCode=400;res.end();return; }
  if (!file.startsWith(publicRoot+sep) || !existsSync(file)) {res.statusCode=404;res.end('Not found');return;}
  res.setHeader('Content-Type',types[extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  try { res.end(readFileSync(file)); } catch { res.statusCode=404;res.end('Not found'); }
});
const port = Number(process.env.PORT || 3000);
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://localhost:${port}\n${process.env.DATABASE_URL ? 'Connected to the shared database.' : 'Local preview: bookings are saved only on this computer. No example bookings are preloaded.'}`));
