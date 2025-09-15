-- SQL Commands to Manually Create or Update a User in the Database
-- Adjust values as needed

-- Create a user with plain text password (matches current schema)
INSERT INTO users (username, password, is_admin, created_at)
VALUES ('admin', 'yourStrongPassword', 1, NOW());

-- Update an existing user's password and admin flag
UPDATE users SET password = 'yourNewPassword', is_admin = 1 WHERE username = 'admin';

-- List all users to verify
SELECT id, username, is_admin, created_at FROM users;

-- Delete a user if needed
DELETE FROM users WHERE username = 'admin';