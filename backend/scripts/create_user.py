#!/usr/bin/env python
"""
Script to create a user in the database from the command line.
Run this script from the backend directory:

# Create an admin user
python scripts/create_user.py --username admin --password your_password --admin

# Create a regular user
python scripts/create_user.py --username user1 --password user_password
"""

import os
import sys
import argparse
from flask import Flask
from werkzeug.security import generate_password_hash

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.user import User

def create_user(username, password, is_admin=False):
    """Create a new user in the database"""
    app = create_app(os.getenv('FLASK_ENV', 'dev'))
    
    with app.app_context():
        # Check if user exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            print(f"User '{username}' already exists.")
            return

        # Create the password hash
        password_hash = generate_password_hash(password)
        
        # Create the user
        user = User(
            username=username,
            password_hash=password_hash,
            is_admin=is_admin
        )
        
        # Add to database
        db.session.add(user)
        db.session.commit()
        
        print(f"User '{username}' created successfully.")
        print(f"Generated password hash: {password_hash}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a user in the database")
    parser.add_argument("--username", "-u", required=True, help="Username for the new user")
    parser.add_argument("--password", "-p", required=True, help="Password for the new user")
    parser.add_argument("--admin", "-a", action="store_true", help="Make the user an admin")
    
    args = parser.parse_args()
    
    create_user(args.username, args.password, args.admin)