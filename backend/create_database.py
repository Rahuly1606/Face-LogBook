#!/usr/bin/env python3
"""
Database Creation Script for Face Logbook Backend

Creates the 'face-logbook' database and schema from scratch without any sample data.
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



# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env file
load_dotenv()

def create_mysql_database():
    """Create the MySQL database if it doesn't exist"""
    try:
        # Hardcoded credentials from .env file
        host = os.getenv('MYSQL_HOST', 'localhost')
        port = int(os.getenv('MYSQL_PORT', '3306'))
        user = os.getenv('MYSQL_USER', 'root')
        password = os.getenv('MYSQL_PASSWORD', 'Rahul@1606')
        db_name = 'face-logbook'
        
        logger.info(f"Connecting to MySQL: {user}@{host}:{port}")
        
        # Connect to MySQL server without specifying a database
        connection = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            charset='utf8mb4'
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
        from app import create_app, db
        
        # Create Flask app
        app = create_app('dev')
        
        with app.app_context():
            logger.info("Creating tables...")
            db.create_all()
            logger.info("✅ All tables created successfully")
            
            # Verify tables
            from sqlalchemy import text
            tables = ['students', 'groups', 'attendance', 'users']
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
        return False

if __name__ == "__main__":
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
        sys.exit(1)

def get_database_credentials():
    """Extract database credentials from environment variables"""
    # First, check for individual environment variables (more reliable)
    mysql_host = os.getenv('MYSQL_HOST')
    mysql_port = os.getenv('MYSQL_PORT')
    mysql_user = os.getenv('MYSQL_USER')
    mysql_password = os.getenv('MYSQL_PASSWORD')
    
    # If all required individual variables are present, use them
    if mysql_host and mysql_user and mysql_password:
        logger.info(f"Using credentials from individual environment variables for user: {mysql_user}")
        return {
            'host': mysql_host,
            'port': int(mysql_port) if mysql_port else 3306,
            'user': mysql_user,
            'password': mysql_password,
            'db_name': 'face-logbook'
        }
    
    # Try to extract from connection string as fallback
    db_url = os.getenv('DEV_DATABASE_URL')
    if db_url and 'mysql+pymysql://' in db_url:
        try:
            # Print the URL for debugging (without password)
            # Hide the password for logging
            masked_url = db_url.replace(db_url.split('@')[0].split(':', 1)[1], '********')
            logger.info(f"Parsing database URL: {masked_url}")
            
            # Simple regex-free parsing
            # Extract username and password
            credentials_part = db_url.split('://')[1].split('@')[0]
            username_password = credentials_part.split(':')
            username = username_password[0]
            
            # Extract password (everything between first : and @)
            if ':' in credentials_part:
                password_part = credentials_part.split(':', 1)[1]
                password = urllib.parse.unquote(password_part)
            else:
                password = ''
            
            # Extract host, port and database name
            server_db_part = db_url.split('@')[1]
            server_part = server_db_part.split('/')[0]
            
            if ':' in server_part:
                host, port_str = server_part.split(':')
                port = int(port_str)
            else:
                host = server_part
                port = 3306
            
            # Extract database name
            if '/' in server_db_part:
                db_name = server_db_part.split('/', 1)[1]
                if '?' in db_name:  # Handle query parameters
                    db_name = db_name.split('?')[0]
            else:
                db_name = 'face-logbook'
            
            logger.info(f"Successfully parsed DEV_DATABASE_URL: user={username}, host={host}, port={port}, db={db_name}")
            return {
                'host': host,
                'port': port,
                'user': username,
                'password': password,
                'db_name': db_name
            }
        except Exception as e:
            logger.warning(f"Failed to parse DEV_DATABASE_URL: {str(e)}")
            logger.warning("URL format should be: mysql+pymysql://username:password@host:port/dbname")
    
    # Fallback to defaults
    logger.warning("Using default database credentials - this may not work!")
    return {
        'host': 'localhost',
        'port': 3306,
        'user': 'root',
        'password': 'Rahul@1606',  # Using the password from the .env file as fallback
        'db_name': 'face-logbook'
    }

def create_database_if_not_exists():
    """Create the 'face-logbook' database if it doesn't exist"""
    credentials = get_database_credentials()
    
    try:
        logger.info(f"Connecting to MySQL server: {credentials['user']}@{credentials['host']}:{credentials['port']}")
        
        # Connect to MySQL server (without specifying database)
        connection = pymysql.connect(
            host=credentials['host'],
            port=credentials['port'],
            user=credentials['user'],
            password=credentials['password'],
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # Create the face-logbook database
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{credentials['db_name']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            logger.info(f"✅ Database '{credentials['db_name']}' created or verified")
        
        connection.close()
        return True
            
    except OperationalError as e:
        error_code = e.args[0]
        error_message = e.args[1]
        
        if error_code == 1045:  # Access denied error
            logger.error(f"❌ MySQL access denied: {error_message}")
            logger.error("💡 Please check your MySQL credentials in the .env file")
            logger.error(f"   Current user: {credentials['user']}")
            logger.error(f"   Current host: {credentials['host']}")
            logger.error("   Verify that this user exists and has the correct password")
            logger.error("   You might need to run: ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';")
        else:
            logger.error(f"❌ MySQL connection error ({error_code}): {error_message}")
        
        return False
    except Exception as e:
        logger.error(f"❌ Error creating database: {str(e)}")
        logger.error("💡 Make sure your .env file contains the correct MySQL credentials")
        return False

def create_database():
    """Create database schema - tables, indexes, and relationships only"""
    # Dynamically import app modules after database is created
    # This ensures we're importing after confirming the database exists
    try:
        # Only import after we know the database exists
        from app import create_app, db
        from sqlalchemy import text

        # Step 1: Create the database if it doesn't exist
        if not create_database_if_not_exists():
            logger.error("Failed to create database")
            return False
        
        # Step 2: Create app and schema
        app = create_app('dev')
        
        with app.app_context():
            logger.info("Creating database schema...")
            
            # Create all tables
            db.create_all()
            logger.info("✅ All tables created successfully")
            
            # Create indexes for performance (MySQL compatible syntax)
            
            # Check if indexes exist before creating them (MySQL compatible approach)
            index_queries = [
                ("idx_students_group_id", "CREATE INDEX idx_students_group_id ON students(group_id)"),
                ("idx_students_created_at", "CREATE INDEX idx_students_created_at ON students(created_at)"),
                ("idx_attendance_student_date", "CREATE INDEX idx_attendance_student_date ON attendance(student_id, date)"),
                ("idx_attendance_group_date", "CREATE INDEX idx_attendance_group_date ON attendance(group_id, date)"),
                ("idx_attendance_date", "CREATE INDEX idx_attendance_date ON attendance(date)"),
                ("idx_attendance_status", "CREATE INDEX idx_attendance_status ON attendance(status)"),
                ("idx_groups_created_at", "CREATE INDEX idx_groups_created_at ON groups(created_at)"),
                ("idx_users_username", "CREATE INDEX idx_users_username ON users(username)"),
                ("idx_users_is_admin", "CREATE INDEX idx_users_is_admin ON users(is_admin)")
            ]
            
            for index_name, index_sql in index_queries:
                try:
                    # Check if index already exists
                    check_sql = text(f"SHOW INDEX FROM students WHERE Key_name = '{index_name}'")
                    if 'attendance' in index_sql:
                        check_sql = text(f"SHOW INDEX FROM attendance WHERE Key_name = '{index_name}'")
                    elif 'groups' in index_sql:
                        check_sql = text(f"SHOW INDEX FROM groups WHERE Key_name = '{index_name}'")
                    elif 'users' in index_sql:
                        check_sql = text(f"SHOW INDEX FROM users WHERE Key_name = '{index_name}'")
                    
                    result = db.session.execute(check_sql).fetchone()
                    if not result:
                        db.session.execute(text(index_sql))
                        logger.info(f"✅ Created index: {index_name}")
                    else:
                        logger.info(f"✅ Index already exists: {index_name}")
                except Exception as e:
                    logger.warning(f"Index creation warning for {index_name}: {str(e)}")
            
            db.session.commit()
            logger.info("✅ Indexes created successfully")
            
            # Verify tables exist
            tables = ['students', 'groups', 'attendance', 'users']
            for table in tables:
                result = db.session.execute(text(f"SHOW TABLES LIKE '{table}'"))
                if result.fetchone():
                    logger.info(f"✅ Table '{table}' exists")
                else:
                    logger.error(f"❌ Table '{table}' not found")
                    return False
            
            logger.info("🎉 Database schema created successfully!")
            logger.info("📋 Database: face-logbook")
            logger.info("📋 Created tables: students, groups, attendance, users")
            logger.info("🔗 All relationships and indexes are in place")
            return True
            
    except ImportError as e:
        logger.error(f"❌ Error importing modules: {str(e)}")
        logger.error("Make sure the virtual environment is activated and all dependencies are installed")
        logger.error("Try running: pip install -r requirements.txt")
        return False
    except Exception as e:
        logger.error(f"❌ Error creating database schema: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting database creation process...")
    try:
        # Check Python environment
        logger.info(f"Python version: {sys.version}")
        
        # Check if .env file exists
        if not os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')):
            logger.warning("⚠️ No .env file found. Using default environment variables.")
        else:
            logger.info("✅ .env file found")
        
        # Create the database with direct credentials
        success = create_database()
        
        if success:
            logger.info("✅ Database creation phase 1 completed successfully!")
            
            # Now try to import app modules and create the schema
            try:
                from app import create_app, db
                logger.info("Successfully imported app modules")
                
                app = create_app('dev')
                logger.info("Created app instance")
                
                with app.app_context():
                    logger.info("Creating database schema...")
                    
                    # Create all tables
                    db.create_all()
                    logger.info("✅ All tables created successfully")
                    
                    # Success message
                    logger.info("🎉 Database schema created successfully!")
                    sys.exit(0)
            except ImportError as e:
                logger.error(f"❌ Error importing application modules: {str(e)}")
                logger.error("Make sure your virtual environment is activated")
                sys.exit(1)
            except Exception as e:
                logger.error(f"❌ Error creating schema: {str(e)}")
                logger.error(f"Stack trace: {traceback.format_exc()}")
                sys.exit(1)
        else:
            logger.error("❌ Database creation failed.")
            sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Unhandled exception during database creation: {str(e)}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        sys.exit(1)
