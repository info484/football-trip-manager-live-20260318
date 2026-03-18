const db = require("../db");

async function seed() {
  const people = await db.query(
    `
    INSERT INTO people (first_name, last_name, phone, email)
    VALUES
      ('Tom', 'Peeters', '+32470111222', 'tom.peeters@example.com'),
      ('Lotte', 'Janssens', '+32470222333', 'lotte.janssens@example.com'),
      ('Yassin', 'El Amrani', '+32470333444', 'yassin.elamrani@example.com')
    ON CONFLICT (email) DO NOTHING
    RETURNING id, first_name
    `
  );

  const matches = await db.query(
    `
    INSERT INTO matches (match_datetime, opponent, location, match_type, points_value, bus_price, all_in_price, status)
    VALUES
      (NOW() + INTERVAL '7 day', 'Club Brugge', 'Uit - Jan Breydel', 'Competitie', 3, 25, 60, 'open'),
      (NOW() + INTERVAL '14 day', 'Anderlecht', 'Thuis - Bosuil', 'Competitie', 5, 30, 70, 'open')
    ON CONFLICT (match_datetime, opponent) DO NOTHING
    RETURNING id, opponent
    `
  );

  const peopleRows = await db.query("SELECT id, first_name FROM people ORDER BY id ASC LIMIT 3");
  const matchRows = await db.query("SELECT id FROM matches ORDER BY match_datetime ASC LIMIT 2");

  if (peopleRows.rowCount >= 2 && matchRows.rowCount >= 1) {
    await db.query(
      `
      INSERT INTO registrations (person_id, match_id, attendance, seat_type, package_type, payment_method, payment_status, amount)
      VALUES
        ($1, $3, 'present', 'sit', 'all_in', 'cash', 'paid', 60),
        ($2, $3, 'present', 'stand', 'bus_only', 'transfer', 'open', 25)
      ON CONFLICT (person_id, match_id) DO NOTHING
      `,
      [peopleRows.rows[0].id, peopleRows.rows[1].id, matchRows.rows[0].id]
    );
  }

  console.log("Seed uitgevoerd.");
  if (people.rowCount > 0) {
    console.log(`Toegevoegde leden: ${people.rowCount}`);
  }
  if (matches.rowCount > 0) {
    console.log(`Toegevoegde wedstrijden: ${matches.rowCount}`);
  }

  await db.pool.end();
}

seed().catch((error) => {
  console.error("Seed gefaald:", error);
  db.pool.end();
  process.exit(1);
});
