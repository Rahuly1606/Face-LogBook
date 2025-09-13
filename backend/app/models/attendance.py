from datetime import datetime, date
from app import db

class Attendance(db.Model):
    __tablename__ = 'attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), db.ForeignKey('students.student_id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)
    date = db.Column(db.Date, nullable=False, default=date.today)
    in_time = db.Column(db.DateTime, nullable=True)
    out_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='present')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    student = db.relationship('Student', back_populates='attendances')
    group = db.relationship('Group', back_populates='attendances')
    
    # Indices
    __table_args__ = (
        db.Index('idx_student_date', 'student_id', 'date'),
        db.Index('idx_group_date', 'group_id', 'date'),
    )
    
    def __repr__(self):
        return f"<Attendance {self.student_id} on {self.date}>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'group_id': self.group_id,
            'date': self.date.isoformat() if self.date else None,
            'in_time': self.in_time.isoformat() if self.in_time else None,
            'out_time': self.out_time.isoformat() if self.out_time else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }