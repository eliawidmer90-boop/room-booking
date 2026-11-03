// One range constraint per room makes the overlap rule atomic across all visitors.
// Separate constraints avoid requiring the btree_gist extension on the database.
export const schema = `
CREATE TABLE IF NOT EXISTS room_bookings (
  id uuid PRIMARY KEY,
  room text NOT NULL CHECK (room IN ('big', 'small')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  purpose text NOT NULL DEFAULT '' CHECK (char_length(purpose) <= 120),
  department text NOT NULL DEFAULT '' CHECK (char_length(department) <= 100),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  cancel_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at AND end_at <= start_at + interval '24 hours'),
  CONSTRAINT big_room_no_overlap EXCLUDE USING gist
    (tstzrange(start_at, end_at, '[)') WITH &&) WHERE (room = 'big'),
  CONSTRAINT small_room_no_overlap EXCLUDE USING gist
    (tstzrange(start_at, end_at, '[)') WITH &&) WHERE (room = 'small')
);
CREATE INDEX IF NOT EXISTS room_bookings_start_idx ON room_bookings (start_at);
`;

export const publicColumns = `id, room, name, purpose, department,
  start_at AS "startAt", end_at AS "endAt", created_at AS "createdAt"`;

export async function ensureSchema(sql) {
  // The transaction-scoped lock serializes initialization across cold starts.
  await sql.transaction([
    sql.query('SELECT pg_advisory_xact_lock(803040261)'),
    ...schema.split(';').map(s=>s.trim()).filter(Boolean).map(s=>sql.query(s))
  ]);
}
