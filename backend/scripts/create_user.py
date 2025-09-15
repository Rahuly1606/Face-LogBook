#!/usr/bin/env python


import os
import sys
import argparse

# In-file defaults for implicit run (no args)
DEFAULT_ADMIN_USERNAME = "rahul"
DEFAULT_ADMIN_PASSWORD = "admin12"
DEFAULT_IS_ADMIN = True

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.user import User

def create_user(username, password, is_admin=False):
    """Create or update a user in the database (plain password to match current schema)."""
    app = create_app(os.getenv('FLASK_ENV', 'dev'))
    
    with app.app_context():
        # Check if user exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            # Update password and admin flag if exists
            existing_user.password = password
            existing_user.is_admin = bool(is_admin)
            db.session.commit()
            print(f"User '{username}' updated successfully.")
            return

        # Create the user
        user = User(
            username=username,
            password=password,
            is_admin=is_admin
        )
        
        # Add to database
        db.session.add(user)
        db.session.commit()
        
        print(f"User '{username}' created successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create or update a user in the database")
    parser.add_argument("--username", "-u", help="Username for the user")
    parser.add_argument("--password", "-p", help="Password for the user")
    parser.add_argument("--admin", "-a", action="store_true", help="Make the user an admin")
    
    # If no arguments provided, use in-file defaults
    if len(sys.argv) == 1:
        username = DEFAULT_ADMIN_USERNAME
        password = DEFAULT_ADMIN_PASSWORD
        is_admin = DEFAULT_IS_ADMIN
    else:
        args = parser.parse_args()
        username = args.username or DEFAULT_ADMIN_USERNAME
        password = args.password or DEFAULT_ADMIN_PASSWORD
        # If any args were provided and --admin omitted, keep flag as provided (False)
        is_admin = args.admin if (args.username or args.password or args.admin) else DEFAULT_IS_ADMIN
    
    print(f"Creating/updating user: {username} (admin={is_admin})")
    create_user(username, password, is_admin)