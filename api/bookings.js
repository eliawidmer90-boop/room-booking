import { neon } from '@neondatabase/serverless';
import { BookingError } from '../lib/booking.mjs';
import { PostgresStore } from '../lib/store.mjs';
import { createHandler } from '../lib/handler.mjs';
import { ensureSchema } from '../lib/schema.mjs';

let store;
let ready;
export default createHandler(async () => {
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new BookingError('The booking service is being set up. Please try again later.',503,'DATABASE_REQUIRED');
  if (!store) {
    const sql = neon(connection);
    ready ||= ensureSchema(sql).catch(error => { ready = undefined; throw error; });
    await ready;
    store = new PostgresStore(sql);
  }
  return store;
});
