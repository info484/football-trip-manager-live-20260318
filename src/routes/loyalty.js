const express = require("express");

const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [totalsResult, historyResult, peopleResult, matchesResult] = await Promise.all([
      db.query(
        `
        SELECT
          p.id,
          p.first_name,
          p.last_name,
          COALESCE(mp.match_points, 0)::int AS match_points,
          COALESCE(adj.adjustment_points, 0)::int AS adjustment_points,
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
        `
      ),
      db.query(
        `
        SELECT
          p.first_name,
          p.last_name,
          event_type,
          event_label,
          points,
          happened_at
        FROM (
          SELECT
            p.first_name,
            p.last_name,
            'wedstrijd'::text AS event_type,
            CONCAT(m.opponent, ' (', TO_CHAR(m.match_datetime, 'DD/MM/YYYY'), ')') AS event_label,
            CASE WHEN r.attendance = 'present' THEN m.points_value ELSE 0 END AS points,
            m.match_datetime AS happened_at
          FROM registrations r
          INNER JOIN people p ON p.id = r.person_id
          INNER JOIN matches m ON m.id = r.match_id

          UNION ALL

          SELECT
            p.first_name,
            p.last_name,
            'correctie'::text AS event_type,
            COALESCE(la.note, 'Manuele correctie') AS event_label,
            la.points,
            la.created_at AS happened_at
          FROM loyalty_adjustments la
          INNER JOIN people p ON p.id = la.person_id
        ) events
        ORDER BY happened_at DESC
        LIMIT 100
        `
      ),
      db.query("SELECT id, first_name, last_name FROM people ORDER BY last_name, first_name"),
      db.query("SELECT id, opponent, match_datetime FROM matches ORDER BY match_datetime DESC"),
    ]);

    res.render("loyalty/index", {
      title: "Loyalty",
      totals: totalsResult.rows,
      history: historyResult.rows,
      people: peopleResult.rows,
      matches: matchesResult.rows,
      message: req.query.message || null,
      messageType: req.query.type || "success",
    });
  })
);

router.post(
  "/adjustments",
  asyncHandler(async (req, res) => {
    const personId = Number(req.body.personId);
    const points = Number(req.body.points);
    const matchId = req.body.matchId ? Number(req.body.matchId) : null;
    const note = (req.body.note || "").trim() || null;

    if (Number.isNaN(personId) || Number.isNaN(points) || points === 0) {
      return res.redirect("/loyalty?type=error&message=Ongeldige%20correctie");
    }

    await db.query(
      `
      INSERT INTO loyalty_adjustments (person_id, match_id, points, note)
      VALUES ($1, $2, $3, $4)
      `,
      [personId, matchId, points, note]
    );

    return res.redirect("/loyalty?type=success&message=Correctie%20toegevoegd");
  })
);

module.exports = router;
