const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ontbreekt. Zet deze in je .env bestand.");
}

const useSsl = process.env.PGSSL === "true" || process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
