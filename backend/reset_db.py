"""
Script to reset the database and recreate all tables
This script will drop all tables and recreate them from scratch
"""
import os
from app import create_app, db
from app.models.student import Student
from app.models.group import Group
from app.models.attendance import Attendance

app = create_app()

with app.app_context():
    print("Resetting database...")
    
    # Drop all tables
    try:
        db.drop_all()
        print("All tables dropped successfully.")
    except Exception as e:
        print(f"Error dropping tables: {str(e)}")
    
    # Create all tables
    try:
        db.create_all()
        print("All tables recreated successfully.")
    except Exception as e:
        print(f"Error creating tables: {str(e)}")
    
    # Create default group
    try:
        default_group = Group(name="Default Group", description="Default group for students")
        db.session.add(default_group)
        db.session.commit()
        print(f"Created default group with ID: {default_group.id}")
    except Exception as e:
        print(f"Error creating default group: {str(e)}")
    
    print("Database reset complete!")