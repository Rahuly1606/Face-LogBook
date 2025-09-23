#!/usr/bin/env python3
"""
Create admin user using Aiven MySQL connection
"""

import os
import sys
import tempfile
from dotenv import load_dotenv

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Load environment variables
load_dotenv()

# Force Aiven environment variables
os.environ['USING_AIVEN'] = 'true'

# Make sure all required Aiven environment variables are set
required_vars = ['AIVEN_HOST', 'AIVEN_PORT', 'AIVEN_USER', 'AIVEN_PASSWORD', 'AIVEN_DB']
missing_vars = [var for var in required_vars if not os.getenv(var)]

if missing_vars:
    print(f"Error: Missing Aiven environment variables: {', '.join(missing_vars)}")
    print("Please set all required Aiven environment variables in .env file.")
    sys.exit(1)

# Now import the app modules
from app import create_app, db
from app.models.user import User
from app.utils.aiven_ssl import setup_aiven_ssl

def create_admin_user():
    """Create or update admin user in the database"""
    # Set up SSL for Aiven
    setup_aiven_ssl()
    
    # Admin credentials
    username = 'admin'
    password = 'admin123'
    is_admin = True
    
    print(f"Creating admin user: {username}")
    
    # Create Flask app with Aiven configuration
    app = create_app('dev')
    
    with app.app_context():
        # Check if user exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            # Update password and admin flag if exists
            existing_user.password = password
            existing_user.is_admin = is_admin
            db.session.commit()
            print(f"Admin user '{username}' updated successfully.")
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
        
        print(f"Admin user '{username}' created successfully.")

if __name__ == "__main__":
    print(f"Using Aiven MySQL at {os.getenv('AIVEN_HOST')}:{os.getenv('AIVEN_PORT')}")
    create_admin_user()