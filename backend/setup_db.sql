-- SQL Script to set up face-logbook database and admin user

-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS face_logbook;

-- Switch to the face_logbook database
USE face_logbook;

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert admin user (if not exists)
INSERT INTO users (username, password_hash, is_admin, created_at)
SELECT 'admin', 
       'scrypt:32768:8:1$Z8aGoUEQ5VuE9KCy$83543c60cfe22f68e98f2e31b0cebe73287343dadbd38e776973a28bc32416882885910b3ff78ab1ebb096db42af8e93ba530ee302d5b1069b65a6c3510d18bb', 
       1, 
       NOW()
FROM dual
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = 'admin'
);

-- Display the users (to verify)
SELECT id, username, is_admin, created_at FROM users;