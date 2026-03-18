const express = require("express");

const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [memberCount, openMatchesCount, registrationsCount, upcomingMatches] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS count FROM people"),
      db.query("SELECT COUNT(*)::int AS count FROM matches WHERE status = 'open'"),
      db.query("SELECT COUNT(*)::int AS count FROM registrations"),
      db.query(
        `
          SELECT
            m.id,
            m.match_datetime,
            m.opponent,
            m.location,
            m.points_value,
            m.status,
            COALESCE(SUM(CASE WHEN r.attendance = 'present' THEN 1 ELSE 0 END), 0)::int AS present_count,
            COALESCE(SUM(CASE WHEN r.attendance = 'absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
            COALESCE(SUM(r.amount), 0)::numeric(10,2) AS total_amount
          FROM matches m
          LEFT JOIN registrations r ON r.match_id = m.id
          GROUP BY m.id
          ORDER BY m.match_datetime ASC
          LIMIT 12
        `
      ),
    ]);

    res.render("dashboard", {
      title: "Dashboard",
      stats: {
        members: memberCount.rows[0].count,
        openMatches: openMatchesCount.rows[0].count,
        registrations: registrationsCount.rows[0].count,
      },
      upcomingMatches: upcomingMatches.rows,
      message: req.query.message || null,
      messageType: req.query.type || "success",
    });
  })
);

module.exports = router;
