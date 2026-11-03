import { neon } from '@neondatabase/serverless';
import { schema } from '../lib/schema.mjs';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in .env.local before running database setup. See README.md.');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
// Statements contain only the fixed schema source; no user input.
for (const statement of schema.split(';').map(s=>s.trim()).filter(Boolean)) await sql.query(statement);
console.log('The shared room-booking database is ready.');
