import { neon } from '@neondatabase/serverless';
import { ensureSchema } from '../lib/schema.mjs';
import { ensureVehicleSchema } from '../lib/vehicle-schema.mjs';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in .env.local before running database setup. See README.md.');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
await ensureSchema(sql);
await ensureVehicleSchema(sql);
console.log('The shared room and vehicle booking database is ready.');
