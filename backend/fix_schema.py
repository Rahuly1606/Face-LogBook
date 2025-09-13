"""
Reset and initialize the database schema to make embedding nullable
"""
from app import db, create_app
from app.models.group import Group
from app.models.student import Student
from app.models.attendance import Attendance
from app.models.user import User

app = create_app()

with app.app_context():
    # Backup existing data (optional)
    try:
        print("Backing up data...")
        groups = [{'id': g.id, 'name': g.name} for g in Group.query.all()]
        students = [{
            'student_id': s.student_id,
            'name': s.name,
            'photo_path': s.photo_path,
            'group_id': s.group_id,
            'created_at': s.created_at
        } for s in Student.query.all()]
        print(f"Backed up {len(groups)} groups and {len(students)} students")
    except Exception as e:
        print(f"Error backing up data: {str(e)}")
        groups = []
        students = []
    
    # Drop all tables
    print("Dropping tables...")
    db.drop_all()
    
    # Create all tables with updated schema
    print("Creating tables with updated schema...")
    db.create_all()
    
    # Restore data if available
    if groups or students:
        print("Restoring data...")
        try:
            # Restore groups
            for g in groups:
                group = Group(id=g['id'], name=g['name'])
                db.session.add(group)
            db.session.commit()
            
            # Restore students (without embeddings)
            for s in students:
                student = Student(
                    student_id=s['student_id'],
                    name=s['name'],
                    photo_path=s['photo_path'],
                    group_id=s['group_id'],
                    created_at=s['created_at']
                )
                db.session.add(student)
            db.session.commit()
            
            print(f"Restored {len(groups)} groups and {len(students)} students")
        except Exception as e:
            print(f"Error restoring data: {str(e)}")
    
    print("Database schema has been reset and recreated successfully with nullable embedding field.")