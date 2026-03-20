const express = require("express");

const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { calculateAmount, defaultPaymentStatus } = require("../utils/calculations");

const router = express.Router();

const attendanceOptions = ["present", "absent"];
const seatOptions = ["sit", "stand"];
const paymentMethodOptions = ["cash", "transfer"];
const paymentStatusOptions = ["open", "paid", "partial"];
const packageOptions = ["all_in", "bus_only"];
const matchStatusOptions = ["open", "closed"];

function requireDeveloperMode(req, res, next) {
  if (req.appMode === "developer") {
    return next();
  }

  return res.status(403).render("partials/error", {
    title: "Geen toegang",
    message: "Deze beheeractie is alleen beschikbaar in de ontwikkelaarsomgeving.",
  });
}

function parseMatchInput(body) {
  return {
    matchDatetime: body.matchDatetime,
    opponent: (body.opponent || "").trim(),
    location: (body.location || "").trim(),
    matchType: (body.matchType || "").trim() || null,
    pointsValue: Number(body.pointsValue),
    busPrice: Number(body.busPrice),
    allInPrice: Number(body.allInPrice),
    status: body.status || "open",
  };
}

function validateMatchInput(match) {
  const errors = [];

  if (!match.matchDatetime) {
    errors.push("Datum en uur zijn verplicht.");
  }

  if (!match.opponent) {
    errors.push("Tegenstander is verplicht.");
  }

  if (!match.location) {
    errors.push("Locatie is verplicht.");
  }

  if (![1, 3, 5].includes(match.pointsValue)) {
    errors.push("Puntenwaarde moet 1, 3 of 5 zijn.");
  }

  if (Number.isNaN(match.busPrice) || match.busPrice < 0) {
    errors.push("Busprijs moet een positief getal zijn.");
  }

  if (Number.isNaN(match.allInPrice) || match.allInPrice < 0) {
    errors.push("All-in prijs moet een positief getal zijn.");
  }

  if (!matchStatusOptions.includes(match.status)) {
    errors.push("Ongeldige wedstrijdstatus.");
  }

  return errors;
}

function parseRegistrationInput(body) {
  return {
    personId: Number(body.personId),
    attendance: body.attendance,
    seatType: body.seatType,
    packageType: body.packageType,
    paymentMethod: body.paymentMethod,
    paymentStatus: body.paymentStatus,
    manualAmount: body.manualAmount,
    notes: (body.notes || "").trim() || null,
  };
}

function validateRegistrationInput(input) {
  const errors = [];

  if (Number.isNaN(input.personId)) {
    errors.push("Kies een geldig lid.");
  }
  if (!attendanceOptions.includes(input.attendance)) {
    errors.push("Kies een geldige aanwezigheid.");
  }
  if (!seatOptions.includes(input.seatType)) {
    errors.push("Kies een geldige plaats.");
  }
  if (!packageOptions.includes(input.packageType)) {
    errors.push("Kies een geldig pakket.");
  }
  if (!paymentMethodOptions.includes(input.paymentMethod)) {
    errors.push("Kies een geldige betaalmethode.");
  }
  if (input.paymentStatus && !paymentStatusOptions.includes(input.paymentStatus)) {
    errors.push("Kies een geldige betaalstatus.");
  }

  return errors;
}

async function getMatchById(matchId) {
  const result = await db.query("SELECT * FROM matches WHERE id = $1", [matchId]);
  return result.rows[0] || null;
}

async function getPeople() {
  const result = await db.query(
    "SELECT id, first_name, last_name FROM people ORDER BY last_name ASC, first_name ASC"
  );
  return result.rows;
}

async function getMatchRegistrations(matchId) {
  const [registrationsResult, summaryResult] = await Promise.all([
    db.query(
      `
      SELECT
        r.id,
        r.person_id,
        r.match_id,
        r.attendance,
        r.seat_type,
        r.package_type,
        r.payment_method,
        r.payment_status,
        r.amount,
        r.notes,
        p.first_name,
        p.last_name
      FROM registrations r
      INNER JOIN people p ON p.id = r.person_id
      WHERE r.match_id = $1
      ORDER BY p.last_name ASC, p.first_name ASC
      `,
      [matchId]
    ),
    db.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN attendance = 'present' THEN 1 ELSE 0 END), 0)::int AS present_count,
        COALESCE(SUM(CASE WHEN attendance = 'absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
        COALESCE(SUM(CASE WHEN package_type = 'all_in' THEN 1 ELSE 0 END), 0)::int AS all_in_count,
        COALESCE(SUM(CASE WHEN package_type = 'bus_only' THEN 1 ELSE 0 END), 0)::int AS bus_only_count,
        COALESCE(SUM(CASE WHEN payment_status <> 'paid' THEN amount ELSE 0 END), 0)::numeric(10,2) AS unpaid_amount,
        COALESCE(SUM(amount), 0)::numeric(10,2) AS total_amount
      FROM registrations
      WHERE match_id = $1
      `,
      [matchId]
    ),
  ]);

  return {
    registrations: registrationsResult.rows,
    summary: summaryResult.rows[0],
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status;
    const values = [];
    let where = "";

    if (status && matchStatusOptions.includes(status)) {
      values.push(status);
      where = "WHERE m.status = $1";
    }

    const result = await db.query(
      `
      SELECT
        m.id,
        m.match_datetime,
        m.opponent,
        m.location,
        m.match_type,
        m.points_value,
        m.bus_price,
        m.all_in_price,
        m.status,
        COALESCE(COUNT(r.id), 0)::int AS registrations
      FROM matches m
      LEFT JOIN registrations r ON r.match_id = m.id
      ${where}
      GROUP BY m.id
      ORDER BY m.match_datetime DESC
      `,
      values
    );

    res.render("matches/index", {
      title: "Wedstrijden",
      matches: result.rows,
      selectedStatus: status || "",
      message: req.query.message || null,
      messageType: req.query.type || "success",
    });
  })
);

router.get("/new", requireDeveloperMode, (req, res) => {
  res.render("matches/form", {
    title: "Nieuwe wedstrijd",
    match: {
      status: "open",
      pointsValue: 1,
      busPrice: 0,
      allInPrice: 0,
    },
    errors: [],
    formAction: "/matches",
    method: "POST",
    matchStatusOptions,
  });
});

router.post(
  "/",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    const matchInput = parseMatchInput(req.body);
    const errors = validateMatchInput(matchInput);

    if (errors.length > 0) {
      return res.status(400).render("matches/form", {
        title: "Nieuwe wedstrijd",
        match: matchInput,
        errors,
        formAction: "/matches",
        method: "POST",
        matchStatusOptions,
      });
    }

    await db.query(
      `
      INSERT INTO matches (match_datetime, opponent, location, match_type, points_value, bus_price, all_in_price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        matchInput.matchDatetime,
        matchInput.opponent,
        matchInput.location,
        matchInput.matchType,
        matchInput.pointsValue,
        matchInput.busPrice,
        matchInput.allInPrice,
        matchInput.status,
      ]
    );

    return res.redirect("/matches?type=success&message=Wedstrijd%20toegevoegd");
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const match = await getMatchById(req.params.id);

    if (!match) {
      return res.redirect("/matches?type=error&message=Wedstrijd%20niet%20gevonden");
    }

    const data = await getMatchRegistrations(req.params.id);

    res.render("matches/detail", {
      title: "Wedstrijd details",
      match,
      registrations: data.registrations,
      summary: data.summary,
      message: req.query.message || null,
      messageType: req.query.type || "success",
    });
  })
);

router.get(
  "/:id/edit",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    const match = await getMatchById(req.params.id);

    if (!match) {
      return res.redirect("/matches?type=error&message=Wedstrijd%20niet%20gevonden");
    }

    res.render("matches/form", {
      title: "Wedstrijd bewerken",
      match: {
        id: match.id,
        matchDatetime: new Date(match.match_datetime).toISOString().slice(0, 16),
        opponent: match.opponent,
        location: match.location,
        matchType: match.match_type,
        pointsValue: match.points_value,
        busPrice: match.bus_price,
        allInPrice: match.all_in_price,
        status: match.status,
      },
      errors: [],
      formAction: `/matches/${match.id}?_method=PUT`,
      method: "POST",
      matchStatusOptions,
    });
  })
);

router.put(
  "/:id",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    const matchInput = parseMatchInput(req.body);
    const errors = validateMatchInput(matchInput);

    if (errors.length > 0) {
      return res.status(400).render("matches/form", {
        title: "Wedstrijd bewerken",
        match: {
          ...matchInput,
          id: req.params.id,
        },
        errors,
        formAction: `/matches/${req.params.id}?_method=PUT`,
        method: "POST",
        matchStatusOptions,
      });
    }

    await db.query(
      `
      UPDATE matches
      SET match_datetime = $1,
          opponent = $2,
          location = $3,
          match_type = $4,
          points_value = $5,
          bus_price = $6,
          all_in_price = $7,
          status = $8
      WHERE id = $9
      `,
      [
        matchInput.matchDatetime,
        matchInput.opponent,
        matchInput.location,
        matchInput.matchType,
        matchInput.pointsValue,
        matchInput.busPrice,
        matchInput.allInPrice,
        matchInput.status,
        req.params.id,
      ]
    );

    return res.redirect(`/matches/${req.params.id}?type=success&message=Wedstrijd%20bijgewerkt`);
  })
);

router.delete(
  "/:id",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    await db.query("DELETE FROM matches WHERE id = $1", [req.params.id]);
    return res.redirect("/matches?type=success&message=Wedstrijd%20verwijderd");
  })
);

router.get(
  "/:id/registrations/new",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    const [match, people] = await Promise.all([getMatchById(req.params.id), getPeople()]);

    if (!match) {
      return res.redirect("/matches?type=error&message=Wedstrijd%20niet%20gevonden");
    }

    res.render("matches/registration-form", {
      title: "Inschrijving toevoegen",
      match,
      people,
      registration: {
        attendance: "present",
        seatType: "sit",
        packageType: "all_in",
        paymentMethod: "cash",
        paymentStatus: "paid",
      },
      errors: [],
      formAction: `/matches/${match.id}/registrations`,
      method: "POST",
      attendanceOptions,
      seatOptions,
      packageOptions,
      paymentMethodOptions,
      paymentStatusOptions,
    });
  })
);

router.post(
  "/:id/registrations",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    const [match, people] = await Promise.all([getMatchById(req.params.id), getPeople()]);

    if (!match) {
      return res.redirect("/matches?type=error&message=Wedstrijd%20niet%20gevonden");
    }

    const input = parseRegistrationInput(req.body);
    input.paymentStatus = defaultPaymentStatus(input.paymentMethod, input.paymentStatus);

    const errors = validateRegistrationInput(input);

    if (errors.length > 0) {
      return res.status(400).render("matches/registration-form", {
        title: "Inschrijving toevoegen",
        match,
        people,
        registration: input,
        errors,
        formAction: `/matches/${match.id}/registrations`,
        method: "POST",
        attendanceOptions,
        seatOptions,
        packageOptions,
        paymentMethodOptions,
        paymentStatusOptions,
      });
    }

    const amount = calculateAmount({
      attendance: input.attendance,
      packageType: input.packageType,
      match,
      manualAmount: input.manualAmount,
    });

    try {
      await db.query(
        `
        INSERT INTO registrations (person_id, match_id, attendance, seat_type, package_type, payment_method, payment_status, amount, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          input.personId,
          match.id,
          input.attendance,
          input.seatType,
          input.packageType,
          input.paymentMethod,
          input.paymentStatus,
          amount,
          input.notes,
        ]
      );
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).render("matches/registration-form", {
          title: "Inschrijving toevoegen",
          match,
          people,
          registration: input,
          errors: ["Dit lid is al ingeschreven voor deze wedstrijd."],
          formAction: `/matches/${match.id}/registrations`,
          method: "POST",
          attendanceOptions,
          seatOptions,
          packageOptions,
          paymentMethodOptions,
          paymentStatusOptions,
        });
      }
      throw error;
    }

    return res.redirect(`/matches/${match.id}?type=success&message=Inschrijving%20toegevoegd`);
  })
);

router.get(
  "/:id/registrations/:registrationId/edit",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    const [match, people, registrationResult] = await Promise.all([
      getMatchById(req.params.id),
      getPeople(),
      db.query("SELECT * FROM registrations WHERE id = $1 AND match_id = $2", [req.params.registrationId, req.params.id]),
    ]);

    if (!match || registrationResult.rowCount === 0) {
      return res.redirect(`/matches/${req.params.id}?type=error&message=Inschrijving%20niet%20gevonden`);
    }

    const registration = registrationResult.rows[0];

    res.render("matches/registration-form", {
      title: "Inschrijving bewerken",
      match,
      people,
      registration: {
        id: registration.id,
        personId: registration.person_id,
        attendance: registration.attendance,
        seatType: registration.seat_type,
        packageType: registration.package_type,
        paymentMethod: registration.payment_method,
        paymentStatus: registration.payment_status,
        manualAmount: registration.amount,
        notes: registration.notes,
      },
      errors: [],
      formAction: `/matches/${match.id}/registrations/${registration.id}?_method=PUT`,
      method: "POST",
      attendanceOptions,
      seatOptions,
      packageOptions,
      paymentMethodOptions,
      paymentStatusOptions,
    });
  })
);

router.put(
  "/:id/registrations/:registrationId",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    const [match, people] = await Promise.all([getMatchById(req.params.id), getPeople()]);

    if (!match) {
      return res.redirect("/matches?type=error&message=Wedstrijd%20niet%20gevonden");
    }

    const input = parseRegistrationInput(req.body);
    input.paymentStatus = defaultPaymentStatus(input.paymentMethod, input.paymentStatus);

    const errors = validateRegistrationInput(input);

    if (errors.length > 0) {
      return res.status(400).render("matches/registration-form", {
        title: "Inschrijving bewerken",
        match,
        people,
        registration: {
          ...input,
          id: req.params.registrationId,
        },
        errors,
        formAction: `/matches/${match.id}/registrations/${req.params.registrationId}?_method=PUT`,
        method: "POST",
        attendanceOptions,
        seatOptions,
        packageOptions,
        paymentMethodOptions,
        paymentStatusOptions,
      });
    }

    const amount = calculateAmount({
      attendance: input.attendance,
      packageType: input.packageType,
      match,
      manualAmount: input.manualAmount,
    });

    await db.query(
      `
      UPDATE registrations
      SET person_id = $1,
          attendance = $2,
          seat_type = $3,
          package_type = $4,
          payment_method = $5,
          payment_status = $6,
          amount = $7,
          notes = $8
      WHERE id = $9 AND match_id = $10
      `,
      [
        input.personId,
        input.attendance,
        input.seatType,
        input.packageType,
        input.paymentMethod,
        input.paymentStatus,
        amount,
        input.notes,
        req.params.registrationId,
        match.id,
      ]
    );

    return res.redirect(`/matches/${match.id}?type=success&message=Inschrijving%20bijgewerkt`);
  })
);

router.delete(
  "/:id/registrations/:registrationId",
  requireDeveloperMode,
  asyncHandler(async (req, res) => {
    await db.query("DELETE FROM registrations WHERE id = $1 AND match_id = $2", [
      req.params.registrationId,
      req.params.id,
    ]);

    return res.redirect(`/matches/${req.params.id}?type=success&message=Inschrijving%20verwijderd`);
  })
);

module.exports = router;
