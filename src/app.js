const path = require("path");
const express = require("express");
const methodOverride = require("method-override");
const dotenv = require("dotenv");

dotenv.config();

const dashboardRoutes = require("./routes/dashboard");
const peopleRoutes = require("./routes/people");
const matchRoutes = require("./routes/matches");
const loyaltyRoutes = require("./routes/loyalty");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.query = req.query;
  next();
});

app.use("/", dashboardRoutes);
app.use("/people", peopleRoutes);
app.use("/matches", matchRoutes);
app.use("/loyalty", loyaltyRoutes);

app.use((req, res) => {
  res.status(404).render("partials/error", {
    title: "Pagina niet gevonden",
    message: "Deze pagina bestaat niet.",
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("partials/error", {
    title: "Interne fout",
    message: err.message || "Er ging iets mis.",
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Server gestart op http://localhost:${port}`);
});
