import { vehicles } from '../public/vehicle-catalog.js';

// Fixed catalog values only. Separate partial GiST constraints need no extensions.
const constraints = vehicles.map(vehicle => `CONSTRAINT ${vehicle.id.replaceAll('-', '_')}_no_overlap EXCLUDE USING gist
  (tstzrange(start_at, end_at, '[)') WITH &&) WHERE (vehicle = '${vehicle.id}')`);
export const vehicleSchema = `
CREATE TABLE IF NOT EXISTS vehicle_bookings (
  id uuid PRIMARY KEY,
  vehicle text NOT NULL CHECK (vehicle IN (${vehicles.map(vehicle => `'${vehicle.id}'`).join(', ')})),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  driver text NOT NULL DEFAULT '' CHECK (char_length(driver) <= 100),
  destination text NOT NULL DEFAULT '' CHECK (char_length(destination) <= 120),
  purpose text NOT NULL DEFAULT '' CHECK (char_length(purpose) <= 120),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  cancel_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at AND end_at <= start_at + interval '366 days'),
  ${constraints.join(',\n  ')}
);
CREATE INDEX IF NOT EXISTS vehicle_bookings_start_idx ON vehicle_bookings (start_at);
`;
export const vehicleColumns = `id, vehicle, name, driver, destination, purpose,
  start_at AS "startAt", end_at AS "endAt", created_at AS "createdAt"`;

export async function ensureVehicleSchema(sql) {
  await sql.transaction([
    sql.query('SELECT pg_advisory_xact_lock(803040262)'),
    ...vehicleSchema.split(';').map(statement => statement.trim()).filter(Boolean).map(statement => sql.query(statement))
  ]);
}
