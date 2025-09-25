from datetime import datetime, date
from app import db
from flask import current_app
import pytz
import uuid

class CameraEvent(db.Model):
    __tablename__ = 'camera_events'
    
    id = db.Column(db.Integer, primary_key=True)
    event_uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    student_id = db.Column(db.String(50), db.ForeignKey('students.student_id'), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False)
    local_date = db.Column(db.Date, nullable=False)  # Local date in Asia/Kolkata timezone
    event_type = db.Column(db.String(20), nullable=False)  # 'in' or 'out'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('UTC')))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('UTC')), 
                          onupdate=lambda: datetime.now(pytz.timezone('UTC')))
    modified_by = db.Column(db.String(50), nullable=True)  # For audit trail
    modification_reason = db.Column(db.String(255), nullable=True)  # For audit trail
    
    # Relationships
    student = db.relationship('Student', back_populates='camera_events')
    
    # Indices
    __table_args__ = (
        db.Index('idx_student_local_date', 'student_id', 'local_date'),
        db.Index('idx_timestamp', 'timestamp'),
        db.Index('idx_local_date', 'local_date'),
    )
    
    def __repr__(self):
        return f"<CameraEvent {self.student_id} on {self.local_date} {self.event_type}>"
    
    def to_dict(self):
        from app.services.attendance_service import AttendanceService
        return {
            'id': self.id,
            'event_uuid': self.event_uuid,
            'student_id': self.student_id,
            'timestamp': AttendanceService.format_datetime_ist(self.timestamp),
            'local_date': self.local_date.isoformat() if self.local_date else None,
            'event_type': self.event_type,
            'created_at': AttendanceService.format_datetime_ist(self.created_at),
            'updated_at': AttendanceService.format_datetime_ist(self.updated_at),
            'modified_by': self.modified_by,
            'modification_reason': self.modification_reason
        }