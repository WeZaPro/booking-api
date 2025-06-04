// ===== BACKEND (Node.js + Express + MySQL + Auth + CORS Restriction) =====
// server.js

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const port = 3000;
const JWT_SECRET = "your_secret_key";

// กำหนด whitelist ของเว็บที่อนุญาตเรียก API
const allowedOrigins = [
  "http://localhost:5500", // ตัวอย่าง frontend URL ที่อนุญาต (แก้ตามจริง)
  "http://localhost:3000",
  "https://happyevtaxi.com", // เพิ่ม domain ที่ต้องการอนุญาตได้
];

// ตั้งค่า cors เพื่อเช็ค origin
app.use(
  cors({
    origin: function (origin, callback) {
      // อนุญาต request ที่ไม่มี origin (เช่น Postman, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(bodyParser.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL");
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
  db.query(sql, [username, hashedPassword], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send({ success: true });
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], async (err, results) => {
    if (err || results.length === 0)
      return res.status(401).send({ error: "User not found" });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(403).send({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.send({ token });
  });
});

app.post("/api/destinations/bulk", (req, res) => {
  const destinations = req.body; // Expecting an array of { destination, price }

  if (!Array.isArray(destinations) || destinations.length === 0) {
    return res.status(400).send({ error: "Invalid input data" });
  }

  const values = destinations.map((d) => [d.destination, d.price]);

  const sql = "INSERT INTO destinations (destination, price) VALUES ?";
  db.query(sql, [values], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send({ success: true, inserted: result.affectedRows });
  });
});

app.get("/api/destinations", (req, res) => {
  const sql = "SELECT destination, price FROM destinations";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});

app.post("/api/bookings", (req, res) => {
  const { FullName, Phone, Email, Destination, Price } = req.body;
  const sql =
    "INSERT INTO bookings (FullName, Phone, Email, Destination, Price, timestamp) VALUES (?, ?, ?, ?, ?, NOW())";
  db.query(sql, [FullName, Phone, Email, Destination, Price], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send({ success: true, id: result.insertId });
  });
});

app.get("/api/bookings", authenticateToken, (req, res) => {
  db.query("SELECT * FROM bookings ORDER BY timestamp DESC", (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});

app.post("/api/bookings/search", authenticateToken, (req, res) => {
  const keyword = `%${req.body.keyword}%`;
  const sql = "SELECT * FROM bookings WHERE Destination LIKE ?";
  db.query(sql, [keyword], (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});

app.get("/", (req, res) => {
  res.send("API START");
});

// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
