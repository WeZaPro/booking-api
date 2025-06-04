// ===== BACKEND (Node.js + Express + MySQL) =====
// server.js

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // แก้ให้ตรงกับเครื่องของคุณ
  database: "taxi_booking",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL");
});

// Create Booking
app.post("/api/bookings", (req, res) => {
  const { FullName, Phone, Email, Destination, Price } = req.body;
  const sql =
    "INSERT INTO bookings (FullName, Phone, Email, Destination, Price, timestamp) VALUES (?, ?, ?, ?, ?, NOW())";
  db.query(sql, [FullName, Phone, Email, Destination, Price], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send({ success: true, id: result.insertId });
  });
});

// Read All Bookings
app.get("/api/bookings", (req, res) => {
  db.query("SELECT * FROM bookings ORDER BY timestamp DESC", (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});

// Search Bookings
// app.get("/api/bookings/search", (req, res) => {
//   const keyword = `%${req.query.q}%`;
//   const sql =
//     "SELECT * FROM bookings WHERE FullName LIKE ? OR Phone LIKE ? OR Email LIKE ? OR Destination LIKE ?";
//   db.query(sql, [keyword, keyword, keyword, keyword], (err, results) => {
//     if (err) return res.status(500).send(err);
//     res.send(results);
//   });
// });

// แก้จาก GET เป็น POST และอ่าน keyword จาก req.body
// app.post("/api/bookings/search", (req, res) => {
//   const keyword = `%${req.body.keyword}%`;
//   const sql =
//     "SELECT * FROM bookings WHERE FullName LIKE ? OR Phone LIKE ? OR Email LIKE ? OR Destination LIKE ?";
//   db.query(sql, [keyword, keyword, keyword, keyword], (err, results) => {
//     if (err) return res.status(500).send(err);
//     res.send(results);
//   });
// });

app.post("/api/bookings/search", (req, res) => {
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
