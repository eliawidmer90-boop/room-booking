export const TIME_ZONE = 'Africa/Windhoek';
export const ROOMS = ['big', 'small'];

export class BookingError extends Error {
  constructor(message, status = 400, code = 'INVALID_BOOKING') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function localDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function validDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const value = new Date(`${day}T12:00:00+02:00`);
  return !Number.isNaN(value.valueOf()) && localDay(value) === day;
}

export function validateRange(from, to) {
  if (!validDay(from) || !validDay(to) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 370) {
    throw new BookingError('Choose a valid date range of up to one year.');
  }
  return { from, to };
}

export function validateBooking(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BookingError('Please enter your booking details.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const purpose = typeof input.purpose === 'string' ? input.purpose.trim() : '';
  const department = typeof input.department === 'string' ? input.department.trim() : '';
  if (!ROOMS.includes(input.room)) throw new BookingError('Choose the Big or Small conference room.');
  if (name.length < 2 || name.length > 100) throw new BookingError('Enter your name (2–100 characters).');
  if (purpose.length > 120 || department.length > 100) throw new BookingError('Keep the meeting title and department under their character limits.');
  if (!validDay(input.date)) throw new BookingError('Choose a valid booking date.');
  if (typeof input.start !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start)) throw new BookingError('Choose a valid start time.');
  const duration = Number(input.duration);
  if (!Number.isInteger(duration) || duration < 15 || duration > 1440 || duration % 15) throw new BookingError('Choose a duration in 15-minute steps, up to 24 hours.');
  const start = new Date(`${input.date}T${input.start}:00+02:00`);
  const end = new Date(start.valueOf() + duration * 60000);
  if (start.valueOf() < now.valueOf() - 60000) throw new BookingError('Choose a start time in the future.');
  if (start.valueOf() > now.valueOf() + 366 * 86400000) throw new BookingError('Bookings can be made up to one year ahead.');
  if (typeof input.cancelToken !== 'string' || !/^[a-f0-9]{64}$/.test(input.cancelToken)) throw new BookingError('Please reopen the booking form and try again.');
  return { room: input.room, name, purpose, department, startAt: start.toISOString(), endAt: end.toISOString(), cancelToken: input.cancelToken };
}

export function overlaps(a, b) {
  return a.room === b.room && Date.parse(a.startAt) < Date.parse(b.endAt) && Date.parse(a.endAt) > Date.parse(b.startAt);
}

export function publicBooking({ id, room, name, purpose, department, startAt, endAt, createdAt }) {
  return { id, room, name, purpose, department, startAt, endAt, createdAt };
}
