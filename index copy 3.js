// ===== BACKEND (Node.js + Express + MySQL + Auth) =====
// server.js

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
const JWT_SECRET = "your_secret_key";

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "taxi_booking",
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

app.post("/api/bookings", authenticateToken, (req, res) => {
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

// app.get("/api/destinations", (req, res) => {
//   console.log("destination ");
//   const sql = "SELECT name, price FROM destinations";
//   db.query(sql, (err, results) => {
//     if (err) return res.status(500).send(err);
//     console.log("destination ", results);
//     res.send(results);
//   });
// });

app.post("/api/bookings/search", authenticateToken, (req, res) => {
  const keyword = `%${req.body.keyword}%`;
  const sql = "SELECT * FROM bookings WHERE Destination LIKE ?";
  db.query(sql, [keyword], (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
