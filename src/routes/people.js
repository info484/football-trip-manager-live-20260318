const express = require("express");

const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

function getPersonInput(body) {
  return {
    firstName: (body.firstName || "").trim(),
    lastName: (body.lastName || "").trim(),
    phone: (body.phone || "").trim() || null,
    email: (body.email || "").trim() || null,
    address: (body.address || "").trim() || null,
    birthDate: (body.birthDate || "").trim() || null,
    notes: (body.notes || "").trim() || null,
  };
}

function validatePerson(person) {
  const errors = [];
  if (!person.firstName) {
    errors.push("Voornaam is verplicht.");
  }
  if (!person.lastName) {
    errors.push("Achternaam is verplicht.");
  }
  return errors;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const people = await db.query(
      `
        SELECT id, first_name, last_name, phone, email, address, birth_date, notes
        FROM people
        ORDER BY last_name ASC, first_name ASC
      `
    );

    res.render("people/index", {
      title: "Leden",
      people: people.rows,
      message: req.query.message || null,
      messageType: req.query.type || "success",
    });
  })
);

router.get("/new", (req, res) => {
  res.render("people/form", {
    title: "Nieuw lid",
    person: {},
    errors: [],
    formAction: "/people",
    method: "POST",
  });
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const person = getPersonInput(req.body);
    const errors = validatePerson(person);

    if (errors.length > 0) {
      return res.status(400).render("people/form", {
        title: "Nieuw lid",
        person,
        errors,
        formAction: "/people",
        method: "POST",
      });
    }

    try {
      await db.query(
        `
          INSERT INTO people (first_name, last_name, phone, email, address, birth_date, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [person.firstName, person.lastName, person.phone, person.email, person.address, person.birthDate, person.notes]
      );
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).render("people/form", {
          title: "Nieuw lid",
          person,
          errors: ["Email bestaat al."],
          formAction: "/people",
          method: "POST",
        });
      }
      throw error;
    }

    return res.redirect("/people?type=success&message=Lid%20toegevoegd");
  })
);

router.get(
  "/:id/edit",
  asyncHandler(async (req, res) => {
    const personResult = await db.query("SELECT * FROM people WHERE id = $1", [req.params.id]);

    if (personResult.rowCount === 0) {
      return res.redirect("/people?type=error&message=Lid%20niet%20gevonden");
    }

    const person = personResult.rows[0];

    res.render("people/form", {
      title: "Lid bewerken",
      person: {
        id: person.id,
        firstName: person.first_name,
        lastName: person.last_name,
        phone: person.phone,
        email: person.email,
        address: person.address,
        birthDate: person.birth_date ? person.birth_date.toISOString().split("T")[0] : "",
        notes: person.notes,
      },
      errors: [],
      formAction: `/people/${person.id}?_method=PUT`,
      method: "POST",
    });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const person = getPersonInput(req.body);
    const errors = validatePerson(person);

    if (errors.length > 0) {
      return res.status(400).render("people/form", {
        title: "Lid bewerken",
        person: {
          ...person,
          id: req.params.id,
        },
        errors,
        formAction: `/people/${req.params.id}?_method=PUT`,
        method: "POST",
      });
    }

    try {
      await db.query(
        `
          UPDATE people
          SET first_name = $1,
              last_name = $2,
              phone = $3,
              email = $4,
              address = $5,
              birth_date = $6,
              notes = $7
          WHERE id = $8
        `,
        [
          person.firstName,
          person.lastName,
          person.phone,
          person.email,
          person.address,
          person.birthDate,
          person.notes,
          req.params.id,
        ]
      );
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).render("people/form", {
          title: "Lid bewerken",
          person: {
            ...person,
            id: req.params.id,
          },
          errors: ["Email bestaat al."],
          formAction: `/people/${req.params.id}?_method=PUT`,
          method: "POST",
        });
      }
      throw error;
    }

    return res.redirect("/people?type=success&message=Lid%20bijgewerkt");
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      await db.query("DELETE FROM people WHERE id = $1", [req.params.id]);
      return res.redirect("/people?type=success&message=Lid%20verwijderd");
    } catch (error) {
      if (error.code === "23503") {
        return res.redirect(
          "/people?type=error&message=Verwijderen%20niet%20mogelijk%2C%20lid%20is%20gekoppeld%20aan%20inschrijvingen"
        );
      }
      throw error;
    }
  })
);

module.exports = router;
