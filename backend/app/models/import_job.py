"""Import job model for tracking bulk student imports"""
from app import db
from datetime import datetime
import json

class ImportJob(db.Model):
    """Model to track bulk student import jobs"""
    __tablename__ = 'import_jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    total_records = db.Column(db.Integer, default=0)
    processed_records = db.Column(db.Integer, default=0)
    successful_records = db.Column(db.Integer, default=0)
    failed_records = db.Column(db.Integer, default=0)
    status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
    error_message = db.Column(db.Text, nullable=True)
    successes = db.Column(db.Text, nullable=True)  # JSON array of successful imports
    failures = db.Column(db.Text, nullable=True)  # JSON array of failed imports
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationship
    group = db.relationship('Group', backref='import_jobs')
    
    def to_dict(self):
        """Convert job to dictionary"""
        return {
            'id': self.id,
            'group_id': self.group_id,
            'filename': self.filename,
            'total_records': self.total_records,
            'processed_records': self.processed_records,
            'successful_records': self.successful_records,
            'failed_records': self.failed_records,
            'status': self.status,
            'error_message': self.error_message,
            'successes': json.loads(self.successes) if self.successes else [],
            'failures': json.loads(self.failures) if self.failures else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'progress_percentage': self.get_progress_percentage()
        }
    
    def get_progress_percentage(self):
        """Calculate progress percentage"""
        if self.total_records == 0:
            return 0
        return int((self.processed_records / self.total_records) * 100)
    
    def add_success(self, student_data):
        """Add a successful import to the job"""
        successes = json.loads(self.successes) if self.successes else []
        successes.append(student_data)
        self.successes = json.dumps(successes)
        self.successful_records += 1
        self.processed_records += 1
        self.updated_at = datetime.utcnow()
    
    def add_failure(self, failure_data):
        """Add a failed import to the job"""
        failures = json.loads(self.failures) if self.failures else []
        failures.append(failure_data)
        self.failures = json.dumps(failures)
        self.failed_records += 1
        self.processed_records += 1
        self.updated_at = datetime.utcnow()
    
    def mark_completed(self):
        """Mark job as completed"""
        self.status = 'completed'
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def mark_failed(self, error_message):
        """Mark job as failed"""
        self.status = 'failed'
        self.error_message = error_message
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
