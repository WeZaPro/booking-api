-- // ===== DATABASE SQL =====
CREATE DATABASE taxi_booking;
USE taxi_booking;
CREATE TABLE bookings (
   id INT AUTO_INCREMENT PRIMARY KEY,
   FullName VARCHAR(100),
   Phone VARCHAR(20),
   Email VARCHAR(100),
   Destination VARCHAR(100),
   Price DECIMAL(10,2),
   timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
 );


 CREATE TABLE users (
   id INT AUTO_INCREMENT PRIMARY KEY,
   username VARCHAR(100) UNIQUE,
   password VARCHAR(255)
 );


 CREATE TABLE destinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  destination TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL
);
