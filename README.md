# Voetbal Wedstrijden App (Node + PostgreSQL)

Volledige webapp voor supportersinschrijvingen per wedstrijd met:

- persoonsgegevens
- aanwezig/afwezig
- zit/staan
- cash/overschrijving
- all-in of enkel bus
- loyalty punten (1/3/5 per wedstrijd)

## 1. Vereisten

- Node.js 20+
- PostgreSQL 14+

## 2. Database aanmaken

Voorbeeld in psql:

```sql
CREATE DATABASE football_trip_manager;
```

## 3. Environment instellen

Kopieer `.env.example` naar `.env` en pas aan:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/football_trip_manager
NODE_ENV=development
PGSSL=false
```

## 4. Installeren

```bash
npm install
```

## 5. Migratie uitvoeren

```bash
npm run db:migrate
```

## 6. (Optioneel) testdata laden

```bash
npm run db:seed
```

## 7. App starten

```bash
npm run dev
```

Ga naar `http://localhost:3000`.

## Kernregels in de app

- punten komen van de wedstrijd (`1`, `3` of `5`)
- punten tellen alleen bij `present`
- bedrag berekening:
  - `all_in` => `all_in_price`
  - `bus_only` => `bus_price`
  - `absent` => `0` (tenzij manuele override)
- standaard betaalstatus:
  - `cash` => `paid`
  - `transfer` => `open`

## Pagina's

- Dashboard
- Leden (CRUD)
- Wedstrijden (CRUD)
- Inschrijvingen per wedstrijd (CRUD)
- Loyalty overzicht + manuele punten-correcties

## Deploy op Heroku (optioneel)

1. Heroku app maken in EU-regio.
2. Heroku Postgres add-on koppelen.
3. `DATABASE_URL` wordt automatisch gezet.
4. `npm run db:migrate` uitvoeren op release phase of handmatig via one-off dyno.
