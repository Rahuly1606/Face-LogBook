from datetime import datetime
from app import db

class Group(db.Model):
    __tablename__ = 'groups'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    students = db.relationship('Student', back_populates='group', foreign_keys='Student.group_id', overlaps="enrolled_students,groups")  # Legacy one-to-many (no cascade delete for multi-section support)
    enrolled_students = db.relationship('Student', secondary='student_groups', back_populates='groups', lazy='subquery', overlaps="students,group")  # New many-to-many
    attendances = db.relationship('Attendance', back_populates='group', cascade='all, delete-orphan')
    registration_links = db.relationship('RegistrationLink', back_populates='group', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f"<Group {self.id}: {self.name}>"
    
    def to_dict(self):
        # Use enrolled_students (many-to-many) for accurate count, fallback to legacy students
        student_count = len(self.enrolled_students) if self.enrolled_students else len(self.students) if self.students else 0
        return {
            'id': self.id,
            'name': self.name,
            'student_count': student_count,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }