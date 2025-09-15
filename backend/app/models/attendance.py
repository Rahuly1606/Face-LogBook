from datetime import datetime, date
from app import db
from flask import current_app
import pytz

class Attendance(db.Model):
    __tablename__ = 'attendance'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), db.ForeignKey('students.student_id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)
    date = db.Column(db.Date, nullable=False, default=date.today)
    in_time = db.Column(db.DateTime, nullable=True)
    out_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='absent')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Asia/Kolkata')))
    
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
        from app.services.attendance_service import AttendanceService
        return {
            'id': self.id,
            'student_id': self.student_id,
            'group_id': self.group_id,
            'date': self.date.isoformat() if self.date else None,
            'in_time': AttendanceService.format_datetime_ist(self.in_time),
            'out_time': AttendanceService.format_datetime_ist(self.out_time),
            'status': self.status,
            'created_at': AttendanceService.format_datetime_ist(self.created_at)
        }