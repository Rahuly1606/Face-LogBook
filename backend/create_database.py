#!/usr/bin/env python3
"""
Database Creation Script for Face Logbook Backend - Improved Version

Creates the 'face-logbook' database and schema from scratch.
This script creates the database, tables, indexes, and relationships.

Usage:
    python create_database.py
"""

import os
import sys
import logging
from dotenv import load_dotenv
import traceback
import pymysql
from pymysql.err import OperationalError
import urllib.parse
import tempfile

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Ensure backend directory is in the Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
    logger.info(f"Added backend directory to sys.path: {backend_dir}")

# Load environment variables from .env file
load_dotenv()

# Initialize SSL for Aiven if configured
def setup_aiven_ssl():
    """Set up SSL for Aiven MySQL connection."""
    # If AIVEN_CA_PEM is provided, write it to a temporary file
    if os.getenv('AIVEN_CA_PEM'):
        logger.info("Using CA certificate from AIVEN_CA_PEM environment variable")
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pem') as ca_file:
                ca_file.write(os.getenv('AIVEN_CA_PEM').encode())
                ca_path = ca_file.name
            
            # Set AIVEN_CA_PATH environment variable for other components to use
            os.environ['AIVEN_CA_PATH'] = ca_path
            logger.info(f"CA certificate written to temporary file: {ca_path}")
            return ca_path
        except Exception as e:
            logger.error(f"Failed to write CA certificate to temporary file: {str(e)}")
    
    # Return existing CA path if provided
    return os.getenv('AIVEN_CA_PATH')

def create_mysql_database():
    """Create the MySQL database if it doesn't exist"""
    try:
        # Set up Aiven SSL if configured
        ca_path = setup_aiven_ssl()
        ssl_config = {"ca": ca_path} if ca_path else None
        
        # Check if Aiven MySQL is configured
        if all([os.getenv(var) for var in ['AIVEN_HOST', 'AIVEN_PORT', 'AIVEN_USER', 'AIVEN_PASSWORD', 'AIVEN_DB']]):
            # Use Aiven MySQL credentials
            host = os.getenv('AIVEN_HOST')
            port = int(os.getenv('AIVEN_PORT'))
            user = os.getenv('AIVEN_USER')
            password = os.getenv('AIVEN_PASSWORD')
            db_name = os.getenv('AIVEN_DB')
            
            logger.info(f"Using Aiven MySQL: {user}@{host}:{port}")
        else:
            # Fallback to local MySQL credentials
            host = os.getenv('MYSQL_HOST', 'localhost')
            port = int(os.getenv('MYSQL_PORT', '3306'))
            user = os.getenv('MYSQL_USER', 'root')
            password = os.getenv('MYSQL_PASSWORD', 'Rahul@1606')
            db_name = 'face-logbook'
            
            logger.info(f"Using local MySQL: {user}@{host}:{port}")
        
        # Connect to MySQL server without specifying a database
        connection = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            charset='utf8mb4',
            ssl=ssl_config
        )
        
        with connection.cursor() as cursor:
            # Create the database if it doesn't exist
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            logger.info(f"✅ Database '{db_name}' created or verified")
        
        connection.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating MySQL database: {str(e)}")
        return False

def create_schema():
    """Create the database schema using SQLAlchemy"""
    try:
        # Pre-import flask_cors to ensure it's loaded correctly
        try:
            import flask_cors
            logger.info(f"Flask-CORS found at: {flask_cors.__file__}")
        except ImportError as e:
            logger.error(f"Could not import flask_cors: {e}")
            logger.error("Please install flask-cors: pip install flask-cors==3.0.10")
            return False
            
        # Import app and models
        from app import create_app, db
        
        # Import all models to ensure they're registered with SQLAlchemy
        from app.models.student import Student
        from app.models.group import Group
        from app.models.attendance import Attendance
        from app.models.user import User
        try:
            from app.models.camera_event import CameraEvent
            logger.info("Camera Event model imported successfully")
        except ImportError as e:
            logger.warning(f"Could not import CameraEvent model: {e}")
            logger.warning("Camera events functionality will not be available")
        
        # Create Flask app
        app = create_app('dev')
        
        with app.app_context():
            logger.info("Creating tables...")
            db.create_all()
            logger.info("✅ All tables created successfully")
            
            # Verify tables
            from sqlalchemy import text
            tables = ['students', 'groups', 'attendance', 'users', 'camera_events']
            for table in tables:
                result = db.session.execute(text(f"SHOW TABLES LIKE '{table}'"))
                if result.fetchone():
                    logger.info(f"✅ Table '{table}' exists")
                else:
                    logger.error(f"❌ Table '{table}' not found")
            
            logger.info("🎉 Database schema created successfully!")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating schema: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    logger.info("Starting database creation process...")
    try:
        # Step 1: Create the MySQL database
        if not create_mysql_database():
            logger.error("❌ Failed to create MySQL database")
            sys.exit(1)
        
        # Step 2: Create the schema
        if not create_schema():
            logger.error("❌ Failed to create schema")
            sys.exit(1)
        
        logger.info("✅ Database setup completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Unhandled exception: {str(e)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        sys.exit(1)