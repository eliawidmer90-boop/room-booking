import { createHash, randomUUID } from 'node:crypto';
import { BookingError, publicBooking, overlaps } from './booking.mjs';
import { publicColumns } from './schema.mjs';

export const tokenHash = token => createHash('sha256').update(token).digest('hex');

export class PostgresStore {
  constructor(sql) { this.sql = sql; }
  async get(id) { return (await this.sql.query(`SELECT ${publicColumns} FROM room_bookings WHERE id = $1`,[id]))[0] || null; }
  async list(from, to) {
    return this.sql.query(`SELECT ${publicColumns} FROM room_bookings
      WHERE start_at < (($2::date + interval '1 day') AT TIME ZONE 'Africa/Windhoek')
      AND end_at > ($1::date::timestamp AT TIME ZONE 'Africa/Windhoek') ORDER BY start_at`, [from, to]);
  }
  async create(booking) {
    const hash = tokenHash(booking.cancelToken);
    try {
      const rows = await this.sql.query(`INSERT INTO room_bookings
        (id,room,name,purpose,department,start_at,end_at,cancel_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${publicColumns}`,
      [randomUUID(),booking.room,booking.name,booking.purpose,booking.department,booking.startAt,booking.endAt,hash]);
      return rows[0];
    } catch (error) {
      // A client-generated token is also an idempotency key, so a lost response can
      // be retried without creating a second booking or losing cancellation access.
      if (error.code === '23505' || error.code === '23P01') {
        const existing = await this.sql.query(`SELECT ${publicColumns} FROM room_bookings WHERE cancel_hash = $1`, [hash]);
        if (existing.length) return existing[0];
        throw new BookingError('That room has just been booked for this time. Choose another time or the other room.', 409, 'CONFLICT');
      }
      throw error;
    }
  }
  async cancel(id, token) {
    const rows = await this.sql.query('DELETE FROM room_bookings WHERE id = $1 AND cancel_hash = $2 RETURNING id', [id, tokenHash(token)]);
    if (!rows.length) throw new BookingError('Booking not found, already cancelled, or the cancellation link is incorrect.', 404, 'NOT_FOUND');
  }
}

export class MemoryStore {
  constructor(rows = []) { this.rows = rows; }
  async get(id) { const row=this.rows.find(b=>b.id===id);return row ? publicBooking(row) : null; }
  async list(from, to) {
    const lower = Date.parse(`${from}T00:00:00+02:00`);
    const upper = Date.parse(`${to}T00:00:00+02:00`) + 86400000;
    return this.rows.filter(b => Date.parse(b.startAt) < upper && Date.parse(b.endAt) > lower).sort((a,b) => Date.parse(a.startAt)-Date.parse(b.startAt)).map(publicBooking);
  }
  async create(b) {
    const hash = tokenHash(b.cancelToken);
    const existing = this.rows.find(row => row.cancelHash === hash);
    if (existing) return publicBooking(existing);
    if (this.rows.some(row => overlaps(row,b))) throw new BookingError('That room is already booked for this time. Choose another time or the other room.',409,'CONFLICT');
    const row = { ...b, cancelToken: undefined, cancelHash: hash, id: randomUUID(), createdAt: new Date().toISOString() };
    this.rows.push(row);
    this.save?.();
    return publicBooking(row);
  }
  async cancel(id, token) {
    const index = this.rows.findIndex(row => row.id === id && row.cancelHash === tokenHash(token));
    if (index === -1) throw new BookingError('Booking not found, already cancelled, or the cancellation link is incorrect.',404,'NOT_FOUND');
    this.rows.splice(index,1);
    this.save?.();
  }
}
