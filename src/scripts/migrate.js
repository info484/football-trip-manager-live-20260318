const fs = require("fs");
const path = require("path");

const db = require("../db");

async function migrate() {
  const schemaPath = path.join(__dirname, "../../db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  await db.query(sql);
  console.log("Migratie uitgevoerd.");
  await db.pool.end();
}

migrate().catch((error) => {
  console.error("Migratie gefaald:", error);
  db.pool.end();
  process.exit(1);
});
