#!/usr/bin/env python3
"""
Database Creation Script for Face Logbook Backend

Creates the 'face-logbook' database and schema from scratch without any sample data.
This script creates the database, tables, indexes, and relationships.

Requires .env file with MySQL credentials:
    MYSQL_HOST=localhost
    MYSQL_PORT=3306
    MYSQL_USER=your_username
    MYSQL_PASSWORD=your_password

Note: Passwords containing '@' work fine with pymysql (no encoding needed).

Usage:
    python create_database.py
"""

import os
import sys
import logging
from dotenv import load_dotenv

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
import pymysql

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_database_if_not_exists():
    """Create the 'face-logbook' database if it doesn't exist"""
    try:
        # Get MySQL credentials from environment variables
        mysql_host = os.getenv('MYSQL_HOST', 'localhost')
        mysql_port = int(os.getenv('MYSQL_PORT', '3306'))
        mysql_user = os.getenv('MYSQL_USER', 'root')
        mysql_password = os.getenv('MYSQL_PASSWORD', '')
        
        # Note: pymysql doesn't need URL encoding, '@' characters are fine in passwords
        # URL encoding is only needed for connection strings in URLs
        
        logger.info(f"Connecting to MySQL server: {mysql_user}@{mysql_host}:{mysql_port}")
        
        # Connect to MySQL server (without specifying database)
        connection = pymysql.connect(
            host=mysql_host,
            port=mysql_port,
            user=mysql_user,
            password=mysql_password,
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # Create the face-logbook database
            cursor.execute("CREATE DATABASE IF NOT EXISTS `face-logbook` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            logger.info("✅ Database 'face-logbook' created or verified")
        
        connection.close()
        return True
            
    except Exception as e:
        logger.error(f"❌ Error creating database: {str(e)}")
        logger.error("💡 Make sure your .env file contains the correct MySQL credentials:")
        logger.error("   MYSQL_HOST=localhost")
        logger.error("   MYSQL_PORT=3306")
        logger.error("   MYSQL_USER=your_username")
        logger.error("   MYSQL_PASSWORD=your_password")
        logger.error("   Note: Passwords with '@' characters work fine with pymysql")
        return False

def create_database():
    """Create database schema - tables, indexes, and relationships only"""
    try:
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
            from sqlalchemy import text
            
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
            
    except Exception as e:
        logger.error(f"❌ Error creating database schema: {str(e)}")
        return False

if __name__ == "__main__":
    success = create_database()
    if not success:
        sys.exit(1)
