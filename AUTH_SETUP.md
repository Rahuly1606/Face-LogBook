# Face-LogBook Authentication Setup Guide

This guide outlines how to set up the simplified authentication system for the Face-LogBook application. This implementation uses plain text passwords stored directly in MySQL for simplicity.

## Database Setup

### Creating the Database and Admin User

1. Open MySQL command line or MySQL Workbench:
   ```
   mysql -u root -p
   ```

2. Enter your MySQL root password when prompted.

3. Execute the following SQL commands to create the database and admin user:

```sql
-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS face_logbook;

-- Switch to the face_logbook database
USE face_logbook;

-- Create users table with plain text password
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert admin user with plain text password
INSERT INTO users (username, password, is_admin, created_at)
VALUES ('admin', 'admin123', 1, NOW());
```

Alternatively, you can run the SQL script provided in `setup_database.sql`:

```
mysql -u root -p < setup_database.sql
```

## Backend Configuration

The backend is already configured to use this simplified authentication method. The authentication endpoint checks for plain text password matches against the database.

### Database Connection

Ensure your database connection details in `app/config.py` are correct:

```python
SQLALCHEMY_DATABASE_URI = os.getenv(
    'DEV_DATABASE_URL', 
    'mysql+pymysql://root:YOUR_PASSWORD@localhost/face_logbook'
)
```

Replace `YOUR_PASSWORD` with your actual MySQL root password.

## Starting the Application

1. Start the backend server:
   ```
   cd backend
   python run.py
   ```

2. Start the frontend development server:
   ```
   cd frontend
   npm run dev
   ```

## Login Credentials

After setup, you can log in with:
- Username: `admin`
- Password: `admin123`

## Adding More Users

To add more users, you can execute SQL commands directly in MySQL:

```sql
-- Add a new admin user
INSERT INTO users (username, password, is_admin) 
VALUES ('newadmin', 'password123', 1);

-- Add a regular user
INSERT INTO users (username, password, is_admin) 
VALUES ('user', 'userpassword', 0);
```

## Security Considerations

This implementation uses plain text passwords for simplicity. In a production environment, consider implementing proper password hashing for security reasons.