import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
// Clear only this project's generated output directory.
if (output !== resolve(root,'dist')) throw new Error('Unexpected build directory');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(resolve(root,'public'),output,{recursive:true});
console.log(`Built ${ (await readdir(output)).length } entries into dist/. Vercel serves api/bookings.js separately.`);
