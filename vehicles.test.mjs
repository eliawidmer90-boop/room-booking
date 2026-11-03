import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { vehicles } from '../public/vehicle-catalog.js';
import { validateBooking } from '../lib/booking.mjs';
import { ensureSchema } from '../lib/schema.mjs';
import { PostgresStore } from '../lib/store.mjs';
import { createHandler } from '../lib/handler.mjs';
import { validateVehicleBooking } from '../lib/vehicle-booking.mjs';
import { ensureVehicleSchema } from '../lib/vehicle-schema.mjs';
import { VehicleMemoryStore, VehiclePostgresStore } from '../lib/vehicle-store.mjs';

const fixedNow = new Date('2026-11-03T06:00:00Z');
const token = () => randomBytes(32).toString('hex');
const input = extra => ({ vehicle: 'single-cab-1', name: 'Test organiser', departureDate: '2026-11-04', departureTime: '09:00', returnDate: '2026-11-06', returnTime: '16:00', driver: 'Test driver', destination: 'School visit', purpose: 'Inspections', cancelToken: token(), ...extra });
const booking = extra => validateVehicleBooking(input(extra), fixedNow);

test('vehicle validation accepts multi-day trips in Namibia time and rejects invalid details', () => {
  const result = booking();
  assert.equal(result.startAt, '2026-11-04T07:00:00.000Z');
  assert.equal(result.endAt, '2026-11-06T14:00:00.000Z');
  assert.equal(vehicles.length, 5);
  assert.equal(vehicles.at(-1).name, 'Bus (13-seater)');
  for (const extra of [
    { vehicle: 'unknown' }, { name: 'x' }, { departureDate: '2026-02-30' }, { departureDate: '2026-11-01' },
    { returnDate: '2026-11-03' }, { returnDate: '2026-11-04', returnTime: '09:00' },
    { returnTime: '24:00' }, { departureTime: '09:01' }, { returnTime: '16:05' },
    { cancelToken: 'guess' }, { destination: 'x'.repeat(121) }, { driver: 'x'.repeat(101) },
    { departureDate: '2028-01-01', returnDate: '2028-01-02' }, { returnDate: '2028-01-01' }
  ]) assert.throws(() => booking(extra), undefined, JSON.stringify(extra));
});

test('adding vehicles preserves existing room records; PostgreSQL blocks overlaps for each of the five vehicles', async () => {
  const db = new PGlite();
  try {
    const setup = {
      query: (text, args = []) => ({ text, args }),
      transaction: queries => db.transaction(async tx => { for (const { text, args } of queries) await tx.query(text, args); })
    };
    const sql = { query: async (text, args) => (await db.query(text, args)).rows };
    await ensureSchema(setup);
    const rooms = new PostgresStore(sql);
    const roomToken = token();
    const originalRoom = await rooms.create(validateBooking({ room: 'big', name: 'Existing room organiser', date: '2026-11-04', start: '09:00', duration: 60, cancelToken: roomToken }, fixedNow));
    await ensureVehicleSchema(setup);
    await ensureVehicleSchema(setup);
    const store = new VehiclePostgresStore(sql);
    for (const vehicle of vehicles) {
      const request = booking({ vehicle: vehicle.id });
      const results = await Promise.allSettled([
        store.create(request),
        store.create(booking({ vehicle: vehicle.id, departureDate: '2026-11-05', returnDate: '2026-11-05' }))
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, vehicle.name);
      assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
      const first = results.find(result => result.status === 'fulfilled').value;
      assert.equal((await store.create(request)).id, first.id, 'safe retry');
      assert.equal((await store.get(first.id)).name, request.name);
      await assert.rejects(() => store.cancel(first.id, token()), error => error.status === 404);
      await store.create(booking({ vehicle: vehicle.id, departureDate: '2026-11-06', departureTime: '16:00', returnDate: '2026-11-06', returnTime: '17:00' }));
    }
    assert.equal((await store.list('2026-11-05', '2026-11-05')).length, 5, 'multi-day trips appear on the middle day');
    assert.equal((await store.list('2026-11-06', '2026-11-06')).length, 10, 'separate vehicles can be booked at the same time');
    await db.exec("SET TIME ZONE 'Pacific/Honolulu'");
    assert.equal((await store.list('2026-11-05', '2026-11-05')).length, 5, 'database session timezone does not affect the schedule');
    assert.equal((await store.list('2026-11-07', '2026-11-07')).length, 0);
    const midnight = await store.create(booking({ vehicle: 'bus-13-seater', departureDate: '2026-11-08', departureTime: '23:45', returnDate: '2026-11-09', returnTime: '00:00' }));
    assert.equal((await store.list('2026-11-09', '2026-11-09')).length, 0, 'a trip ending at midnight does not occupy the following day');
    assert.equal(JSON.stringify(await store.list('2026-11-04', '2026-11-09')).includes('cancel'), false, 'public reads contain no cancellation credentials');
    assert.equal((await rooms.get(originalRoom.id)).name, 'Existing room organiser');
    await rooms.cancel(originalRoom.id, roomToken);
    assert.equal(await rooms.get(originalRoom.id), null, 'existing room cancellation keys still work');
    assert.ok(await store.get(midnight.id), 'room cancellation does not delete vehicle bookings');
    const special = booking({ vehicle: 'single-cab-1', name: "O'Brien <script>test</script>", departureDate: '2026-11-10', returnDate: '2026-11-10' });
    const created = await store.create(special);
    await store.cancel(created.id, special.cancelToken);
    assert.equal(await store.get(created.id), null);
  } finally { await db.close(); }
});

function invoke(handler, { method = 'GET', url = '/api/vehicle-bookings', body, origin = 'http://localhost:3000', contentType = 'application/json' } = {}) {
  return new Promise(resolve => {
    const headers = {};
    handler({ method, url, body, headers: { host: 'localhost:3000', origin, 'content-type': contentType } }, {
      setHeader: (key, value) => { headers[key] = value; },
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data, headers }); }
    });
  });
}

test('vehicle API supports public reads, conflict responses, retries and private cancellation', async () => {
  const store = new VehicleMemoryStore();
  const handler = createHandler(async () => store, { now: () => fixedNow, validate: validateVehicleBooking });
  const payload = input();
  const created = await invoke(handler, { method: 'POST', body: payload });
  assert.equal(created.status, 201);
  assert.equal((await invoke(handler, { method: 'POST', body: payload })).data.booking.id, created.data.booking.id);
  assert.equal((await invoke(handler, { method: 'POST', body: input() })).status, 409);
  assert.equal((await invoke(handler, { method: 'POST', body: input({ vehicle: 'double-cab-2' }) })).status, 201);
  const listed = await invoke(handler, { url: '/api/vehicle-bookings?from=2026-11-05&to=2026-11-05' });
  assert.equal(listed.data.bookings.length, 2);
  assert.equal(listed.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(JSON.stringify(listed.data).includes('cancel'), false);
  assert.equal((await invoke(handler, { url: `/api/vehicle-bookings?id=${created.data.booking.id}` })).data.booking.name, payload.name);
  assert.equal((await invoke(handler, { method: 'DELETE', body: { id: created.data.booking.id, cancelToken: token() } })).status, 404);
  assert.equal((await invoke(handler, { method: 'DELETE', body: { id: created.data.booking.id, cancelToken: payload.cancelToken } })).status, 200);
  assert.equal((await invoke(handler, { url: `/api/vehicle-bookings?id=${created.data.booking.id}` })).status, 404);
  assert.equal((await invoke(handler, { method: 'POST', body: input(), origin: 'https://other.example' })).status, 403);
  assert.equal((await invoke(handler, { method: 'POST', body: input(), contentType: 'text/plain' })).status, 415);
  assert.equal((await invoke(handler, { method: 'POST', body: input({ vehicle: 'unknown' }) })).status, 400);
  assert.equal((await invoke(handler, { method: 'PATCH' })).status, 405);
});

test('production vehicle endpoint requires DATABASE_URL instead of using local data', async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const { default: handler } = await import('../api/vehicle-bookings.js');
    const result = await invoke(handler);
    assert.equal(result.status, 503);
    assert.equal(result.data.code, 'DATABASE_REQUIRED');
  } finally { if (original !== undefined) process.env.DATABASE_URL = original; }
});
