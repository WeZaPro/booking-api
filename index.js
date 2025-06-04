const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "http://localhost:5500",
  "http://localhost:3000",
  "https://happyevtaxi.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error("CORS not allowed from this origin."), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(bodyParser.json());

let db;
(async () => {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    console.log("✅ Connected to MySQL");
  } catch (err) {
    console.error("❌ MySQL connection failed:", err);
  }
})();

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

// Register
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [result] = await db.execute(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );
    res.send({ success: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.status(500).send(err);
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [results] = await db.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    if (results.length === 0)
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
  } catch (err) {
    res.status(500).send(err);
  }
});

// Create destinations (bulk)
app.post("/api/destinations/bulk", async (req, res) => {
  const destinations = req.body;

  if (!Array.isArray(destinations) || destinations.length === 0) {
    return res.status(400).send({ error: "Invalid input data" });
  }

  const values = destinations.map((d) => [d.destination, d.price]);

  try {
    const [result] = await db.query(
      "INSERT INTO destinations (destination, price) VALUES ?",
      [values]
    );
    res.send({ success: true, inserted: result.affectedRows });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Read destinations
app.get("/api/destinations", async (req, res) => {
  try {
    const [results] = await db.execute(
      "SELECT destination, price FROM destinations"
    );
    res.send(results);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Bookings
app.post("/api/bookings", async (req, res) => {
  const { FullName, Phone, Email, Destination, Price } = req.body;

  try {
    const [result] = await db.execute(
      "INSERT INTO bookings (FullName, Phone, Email, Destination, Price, timestamp) VALUES (?, ?, ?, ?, ?, NOW())",
      [FullName, Phone, Email, Destination, Price]
    );
    res.send({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/api/bookings", authenticateToken, async (req, res) => {
  try {
    const [results] = await db.execute(
      "SELECT * FROM bookings ORDER BY timestamp DESC"
    );
    res.send(results);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post("/api/bookings/search", authenticateToken, async (req, res) => {
  const keyword = `%${req.body.keyword}%`;
  try {
    const [results] = await db.execute(
      "SELECT * FROM bookings WHERE Destination LIKE ?",
      [keyword]
    );
    res.send(results);
  } catch (err) {
    res.status(500).send(err);
  }
});

// CRUD Users
app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT id, username, status FROM users");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, username, status FROM users WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/users", async (req, res) => {
  const { id, username, password, status } = req.body;

  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (!username && !password && status === undefined) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const fields = [];
    const values = [];

    if (username) {
      fields.push("username = ?");
      values.push(username);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      fields.push("password = ?");
      values.push(hashedPassword);
    }
    if (status !== undefined) {
      fields.push("status = ?");
      values.push(status);
    }

    values.push(id); // ID เป็น parameter สุดท้ายใน WHERE

    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    const [result] = await db.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User updated" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/users", async (req, res) => {
  try {
    const [result] = await db.execute("DELETE FROM users WHERE id = ?", [
      req.body.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Root
app.get("/", (req, res) => {
  res.send("API START");
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
