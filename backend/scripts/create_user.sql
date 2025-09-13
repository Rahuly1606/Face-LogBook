-- SQL Commands to Manually Create a User in the Database
-- Replace the values with your desired username and password

-- Option 1: Create a user with a plain text password (not recommended for production)
-- This is simpler but less secure
INSERT INTO users (username, password_hash, is_admin, created_at) 
VALUES ('your_username', 'your_plain_password', 1, NOW());

-- Option 2: Create a user with a hashed password (recommended)
-- You'll need to generate the password hash and then insert it
-- Example using MySQL's PASSWORD function (not as secure as Werkzeug's hashing)
INSERT INTO users (username, password_hash, is_admin, created_at) 
VALUES ('your_username', PASSWORD('your_secure_password'), 1, NOW());

-- Option 3: Using a pre-generated Werkzeug password hash
-- This is the most secure option - generate the hash using Python first
-- Then use the hash in your SQL (example with a pre-generated hash):
INSERT INTO users (username, password_hash, is_admin, created_at) 
VALUES ('admin', 'pbkdf2:sha256:600000$abc123def456$abcdef1234567890...', 1, NOW());

-- List all users to verify
SELECT * FROM users;

-- Update an existing user to admin status
UPDATE users SET is_admin = 1 WHERE username = 'your_username';

-- Delete a user if needed
DELETE FROM users WHERE username = 'your_username';