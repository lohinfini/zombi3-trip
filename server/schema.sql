CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  room VARCHAR(40) NOT NULL CHECK (room IN ('Classic Double', 'Deluxe King', 'City Suite')),
  checkin DATE NOT NULL,
  checkout DATE NOT NULL,
  guests SMALLINT NOT NULL CHECK (guests BETWEEN 1 AND 4),
  nights INTEGER NOT NULL CHECK (nights > 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (checkout > checkin)
);

CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_email_idx ON bookings(email);
