const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set and contain at least 32 characters.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

const roomPrices = { "Classic Double": 120, "Deluxe King": 165, "City Suite": 220 };
const roomNames = {
  "Classic Double": "Классический двухместный",
  "Deluxe King": "Делюкс с кроватью King",
  "City Suite": "Городской люкс"
};
const publicUser = row => ({
  id: Number(row.id), name: row.name, email: row.email,
  createdAt: row.created_at
});
const setAuthCookie = (res, token) => res.cookie("zombi3_trip_token", token, {
  httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true",
  maxAge: 7 * 24 * 60 * 60 * 1000, path: "/"
});
const signToken = user => jwt.sign({ sub: String(user.id), email: user.email }, JWT_SECRET, { expiresIn: "7d" });

async function auth(req, res, next) {
  const token = req.cookies.zombi3_trip_token;
  if (!token) return res.status(401).json({ error: "Войдите в аккаунт, чтобы продолжить." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await pool.query("SELECT id, name, email, created_at FROM users WHERE id = $1", [payload.sub]);
    if (!result.rowCount) return res.status(401).json({ error: "Сессия недействительна. Войдите снова." });
    req.user = publicUser(result.rows[0]);
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError")
      return res.status(401).json({ error: "Сессия истекла. Войдите снова." });
    next(error);
  }
}

app.get("/api/health", async (_req, res, next) => {
  try { await pool.query("SELECT 1"); res.json({ status: "ok", database: "connected" }); }
  catch (error) { next(error); }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "Имя должно содержать от 2 до 120 символов." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Укажите корректный адрес электронной почты." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Пароль должен содержать от 8 до 72 символов." });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,created_at",
      [name, email, passwordHash]
    );
    const user = publicUser(result.rows[0]);
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Аккаунт с такой почтой уже существует. Войдите в него." });
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const result = await pool.query("SELECT id,name,email,password_hash,created_at FROM users WHERE email=$1", [email]);
    if (!result.rowCount || !(await bcrypt.compare(password, result.rows[0].password_hash)))
      return res.status(401).json({ error: "Неверная почта или пароль." });
    const user = publicUser(result.rows[0]);
    setAuthCookie(res, signToken(user));
    res.json({ user });
  } catch (error) { next(error); }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("zombi3_trip_token", { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/" });
  res.json({ ok: true });
});
app.get("/api/auth/me", auth, (req, res) => res.json({ user: req.user }));

app.get("/api/bookings", auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id,name,email,room,checkin,checkout,guests,nights,total,status,created_at FROM bookings WHERE user_id=$1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json({ bookings: result.rows });
  } catch (error) { next(error); }
});

app.post("/api/bookings", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const room = String(req.body.room || "");
    const checkin = String(req.body.checkin || "");
    const checkout = String(req.body.checkout || "");
    const guests = Number(req.body.guests);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(checkin) ? Date.parse(checkin + "T00:00:00Z") : NaN;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(checkout) ? Date.parse(checkout + "T00:00:00Z") : NaN;
    const nights = Math.round((end - start) / 86400000);
    if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "Укажите имя (от 2 до 120 символов)." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Укажите корректную электронную почту." });
    if (!roomPrices[room]) return res.status(400).json({ error: "Выберите корректный тип номера." });
    if (!Number.isFinite(start) || !Number.isFinite(end) || nights < 1) return res.status(400).json({ error: "Дата выезда должна быть позже даты заезда." });
    if (!Number.isInteger(guests) || guests < 1 || guests > 4) return res.status(400).json({ error: "Количество гостей должно быть от 1 до 4." });
    let userId = null;
    const token = req.cookies.zombi3_trip_token;
    if (token) {
      try { const payload = jwt.verify(token, JWT_SECRET); userId = Number(payload.sub); } catch (_) {}
    }
    const total = roomPrices[room] * nights;
    const result = await pool.query(
      "INSERT INTO bookings(user_id,name,email,room,checkin,checkout,guests,nights,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,name,email,room,checkin,checkout,guests,nights,total,status,created_at",
      [userId, name, email, room, checkin, checkout, guests, nights, total]
    );
    res.status(201).json({ booking: result.rows[0], roomName: roomNames[room] });
  } catch (error) { next(error); }
});

app.use(express.static(path.join(__dirname, ".."), { index: "index.html", extensions: ["html"] }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Внутренняя ошибка сервера. Попробуйте позже." });
});

async function start() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  for (let attempt = 1; attempt <= 30; attempt++) {
    try { await pool.query(schema); break; }
    catch (error) {
      if (attempt === 30) throw error;
      console.log(`Waiting for PostgreSQL (${attempt}/30)...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Zombi3 Trip listening on port ${PORT}`));
}
start().catch(error => { console.error("Failed to start server:", error); process.exit(1); });
