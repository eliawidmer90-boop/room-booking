import { randomUUID } from 'node:crypto';
import { BookingError } from './booking.mjs';
import { tokenHash } from './store.mjs';
import { publicVehicleBooking, vehicleOverlaps } from './vehicle-booking.mjs';
import { vehicleColumns } from './vehicle-schema.mjs';

const conflict = () => new BookingError('That vehicle is already booked for part of this trip. Choose different dates or another vehicle.', 409, 'CONFLICT');
const notFound = () => new BookingError('Booking not found, already cancelled, or the cancellation link is incorrect.', 404, 'NOT_FOUND');

export class VehiclePostgresStore {
  constructor(sql) { this.sql = sql; }
  async get(id) { return (await this.sql.query(`SELECT ${vehicleColumns} FROM vehicle_bookings WHERE id = $1`, [id]))[0] || null; }
  async list(from, to) {
    return this.sql.query(`SELECT ${vehicleColumns} FROM vehicle_bookings
      WHERE start_at < (($2::date + interval '1 day') AT TIME ZONE 'Africa/Windhoek')
      AND end_at > ($1::date::timestamp AT TIME ZONE 'Africa/Windhoek') ORDER BY start_at, vehicle`, [from, to]);
  }
  async create(booking) {
    const hash = tokenHash(booking.cancelToken);
    try {
      const rows = await this.sql.query(`INSERT INTO vehicle_bookings
        (id, vehicle, name, driver, destination, purpose, start_at, end_at, cancel_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${vehicleColumns}`,
      [randomUUID(), booking.vehicle, booking.name, booking.driver, booking.destination, booking.purpose, booking.startAt, booking.endAt, hash]);
      return rows[0];
    } catch (error) {
      if (error.code === '23505' || error.code === '23P01') {
        // Retrying a request after a lost response returns the original reservation.
        const existing = await this.sql.query(`SELECT ${vehicleColumns} FROM vehicle_bookings WHERE cancel_hash = $1`, [hash]);
        if (existing.length) return existing[0];
        throw conflict();
      }
      throw error;
    }
  }
  async cancel(id, token) {
    const rows = await this.sql.query('DELETE FROM vehicle_bookings WHERE id = $1 AND cancel_hash = $2 RETURNING id', [id, tokenHash(token)]);
    if (!rows.length) throw notFound();
  }
}

export class VehicleMemoryStore {
  constructor(rows = []) { this.rows = rows; }
  async get(id) { const row = this.rows.find(booking => booking.id === id); return row ? publicVehicleBooking(row) : null; }
  async list(from, to) {
    const lower = Date.parse(`${from}T00:00:00+02:00`);
    const upper = Date.parse(`${to}T00:00:00+02:00`) + 86400000;
    return this.rows.filter(booking => Date.parse(booking.startAt) < upper && Date.parse(booking.endAt) > lower)
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)).map(publicVehicleBooking);
  }
  async create(booking) {
    const hash = tokenHash(booking.cancelToken);
    const existing = this.rows.find(row => row.cancelHash === hash);
    if (existing) return publicVehicleBooking(existing);
    if (this.rows.some(row => vehicleOverlaps(row, booking))) throw conflict();
    const row = { ...booking, cancelToken: undefined, cancelHash: hash, id: randomUUID(), createdAt: new Date().toISOString() };
    this.rows.push(row);
    this.save?.();
    return publicVehicleBooking(row);
  }
  async cancel(id, token) {
    const index = this.rows.findIndex(row => row.id === id && row.cancelHash === tokenHash(token));
    if (index === -1) throw notFound();
    this.rows.splice(index, 1);
    this.save?.();
  }
}
