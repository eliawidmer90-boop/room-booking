import { BookingError, validDay } from './booking.mjs';
import { vehicles } from '../public/vehicle-catalog.js';

export function validateVehicleBooking(input, now = new Date()) {
  if (!input || typeof input !== 'object') throw new BookingError('Enter your booking details.');
  if (!vehicles.some(vehicle => vehicle.id === input.vehicle)) throw new BookingError('Choose a vehicle from the list.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 2 || name.length > 100) throw new BookingError('Enter your name (2–100 characters).');
  const fields = {};
  for (const [field, label, max] of [['driver', 'Driver name', 100], ['destination', 'Destination', 120], ['purpose', 'Purpose', 120]]) {
    const value = typeof input[field] === 'string' ? input[field].trim() : '';
    if (value.length > max) throw new BookingError(`${label} must be ${max} characters or fewer.`);
    fields[field] = value;
  }
  if (!validDay(input.departureDate) || !validDay(input.returnDate)) throw new BookingError('Choose valid departure and return dates.');
  const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && Number(value.slice(-2)) % 15 === 0;
  if (!validTime(input.departureTime) || !validTime(input.returnTime)) throw new BookingError('Choose departure and return times in 15-minute steps.');
  const start = new Date(`${input.departureDate}T${input.departureTime}:00+02:00`);
  const end = new Date(`${input.returnDate}T${input.returnTime}:00+02:00`);
  if (start.valueOf() < now.valueOf() - 60000) throw new BookingError('Choose a departure time in the future.');
  if (start.valueOf() > now.valueOf() + 366 * 86400000) throw new BookingError('Bookings can be made up to one year ahead.');
  if (end <= start) throw new BookingError('Return must be after departure.');
  if (end - start > 366 * 86400000) throw new BookingError('A vehicle booking can last up to one year.');
  if (typeof input.cancelToken !== 'string' || !/^[a-f0-9]{64}$/.test(input.cancelToken)) throw new BookingError('Please reopen the booking form and try again.');
  return { vehicle: input.vehicle, name, ...fields, startAt: start.toISOString(), endAt: end.toISOString(), cancelToken: input.cancelToken };
}

export function vehicleOverlaps(a, b) {
  return a.vehicle === b.vehicle && Date.parse(a.startAt) < Date.parse(b.endAt) && Date.parse(a.endAt) > Date.parse(b.startAt);
}

export function publicVehicleBooking({ id, vehicle, name, driver, destination, purpose, startAt, endAt, createdAt }) {
  return { id, vehicle, name, driver, destination, purpose, startAt, endAt, createdAt };
}
