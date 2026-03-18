CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  address TEXT,
  birth_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  match_datetime TIMESTAMPTZ NOT NULL,
  opponent TEXT NOT NULL,
  location TEXT NOT NULL,
  match_type TEXT,
  points_value SMALLINT NOT NULL CHECK (points_value IN (1, 3, 5)),
  bus_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (bus_price >= 0),
  all_in_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (all_in_price >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_datetime, opponent)
);

CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  match_id INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  attendance TEXT NOT NULL CHECK (attendance IN ('present', 'absent')),
  seat_type TEXT NOT NULL CHECK (seat_type IN ('sit', 'stand')),
  package_type TEXT NOT NULL CHECK (package_type IN ('all_in', 'bus_only')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  payment_status TEXT NOT NULL DEFAULT 'open' CHECK (payment_status IN ('open', 'paid', 'partial')),
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, match_id)
);

CREATE TABLE IF NOT EXISTS loyalty_adjustments (
  id SERIAL PRIMARY KEY,
  person_id INT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  match_id INT REFERENCES matches(id) ON DELETE SET NULL,
  points INT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_datetime ON matches(match_datetime);
CREATE INDEX IF NOT EXISTS idx_registrations_match_id ON registrations(match_id);
CREATE INDEX IF NOT EXISTS idx_registrations_person_id ON registrations(person_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_adjustments_person_id ON loyalty_adjustments(person_id);

CREATE OR REPLACE VIEW loyalty_totals AS
SELECT
  p.id AS person_id,
  p.first_name,
  p.last_name,
  COALESCE(mp.match_points, 0)::int AS match_points,
  COALESCE(adj.adjustment_points, 0)::int AS adjustment_points,
  (COALESCE(mp.match_points, 0) + COALESCE(adj.adjustment_points, 0))::int AS total_points
FROM people p
LEFT JOIN (
  SELECT
    r.person_id,
    SUM(CASE WHEN r.attendance = 'present' THEN m.points_value ELSE 0 END)::int AS match_points
  FROM registrations r
  INNER JOIN matches m ON m.id = r.match_id
  GROUP BY r.person_id
) mp ON mp.person_id = p.id
LEFT JOIN (
  SELECT
    person_id,
    SUM(points)::int AS adjustment_points
  FROM loyalty_adjustments
  GROUP BY person_id
) adj ON adj.person_id = p.id;
