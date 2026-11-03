import { neon } from '@neondatabase/serverless';
import { BookingError } from '../lib/booking.mjs';
import { createHandler } from '../lib/handler.mjs';
import { validateVehicleBooking } from '../lib/vehicle-booking.mjs';
import { VehiclePostgresStore } from '../lib/vehicle-store.mjs';
import { ensureVehicleSchema } from '../lib/vehicle-schema.mjs';

let store;
let ready;
export default createHandler(async () => {
  if (!process.env.DATABASE_URL) throw new BookingError('The booking service is being set up. Please try again later.', 503, 'DATABASE_REQUIRED');
  if (!store) {
    const sql = neon(process.env.DATABASE_URL);
    ready ||= ensureVehicleSchema(sql).catch(error => { ready = undefined; throw error; });
    await ready;
    store = new VehiclePostgresStore(sql);
  }
  return store;
}, { validate: validateVehicleBooking });
