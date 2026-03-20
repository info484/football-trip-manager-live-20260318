const express = require("express");

const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [memberCount, openMatchesCount, registrationsCount, upcomingMatches, topLoyalty] = await Promise.all([
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
      db.query(
        `
          SELECT
            p.first_name,
            p.last_name,
            (COALESCE(mp.match_points, 0) + COALESCE(adj.adjustment_points, 0))::int AS total_points
          FROM people p
          LEFT JOIN (
            SELECT r.person_id, SUM(CASE WHEN r.attendance = 'present' THEN m.points_value ELSE 0 END)::int AS match_points
            FROM registrations r
            INNER JOIN matches m ON m.id = r.match_id
            GROUP BY r.person_id
          ) mp ON mp.person_id = p.id
          LEFT JOIN (
            SELECT person_id, SUM(points)::int AS adjustment_points
            FROM loyalty_adjustments
            GROUP BY person_id
          ) adj ON adj.person_id = p.id
          ORDER BY total_points DESC, p.last_name ASC, p.first_name ASC
          LIMIT 10
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
      topLoyalty: topLoyalty.rows,
      message: req.query.message || null,
      messageType: req.query.type || "success",
    });
  })
);

module.exports = router;
