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

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((item) => {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) return;
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  });

  return cookies;
}

const VALID_MODES = ["developer", "user"];

app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const requestedMode = req.query.mode;

  if (VALID_MODES.includes(requestedMode)) {
    res.append("Set-Cookie", `app_mode=${requestedMode}; Path=/; Max-Age=2592000; SameSite=Lax`);
  }

  const cookieMode = cookies.app_mode;
  const appMode = VALID_MODES.includes(requestedMode)
    ? requestedMode
    : VALID_MODES.includes(cookieMode)
      ? cookieMode
      : "user";

  req.appMode = appMode;
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.appMode = appMode;
  res.locals.isDeveloper = appMode === "developer";
  res.locals.isUser = appMode === "user";
  next();
});

function requireDeveloper(req, res, next) {
  if (req.appMode === "developer") {
    return next();
  }

  return res.status(403).render("partials/error", {
    title: "Geen toegang",
    message: "Deze pagina is alleen beschikbaar in de ontwikkelaarsomgeving.",
  });
}

function readOnlyForUsers(req, res, next) {
  if (req.appMode === "developer") {
    return next();
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return next();
  }

  return res.status(403).render("partials/error", {
    title: "Alleen-lezen modus",
    message: "In de gebruikersomgeving kan je geen gegevens wijzigen.",
  });
}

app.use("/", dashboardRoutes);
app.use("/people", requireDeveloper, peopleRoutes);
app.use("/matches", readOnlyForUsers, matchRoutes);
app.use("/loyalty", readOnlyForUsers, loyaltyRoutes);

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
