from datetime import datetime
from app import db
import json
import numpy as np

class Student(db.Model):
    __tablename__ = 'students'
    
    student_id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    photo_path = db.Column(db.String(255), nullable=True)
    embedding = db.Column(db.LargeBinary, nullable=True)  # Stored as binary
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    attendances = db.relationship('Attendance', back_populates='student', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f"<Student {self.student_id}: {self.name}>"
    
    def to_dict(self, with_embedding=False):
        data = {
            'student_id': self.student_id,
            'name': self.name,
            'photo_path': self.photo_path,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if with_embedding and self.embedding:
            data['embedding'] = self.get_embedding().tolist()
        return data
    
    def set_embedding(self, embedding_array):
        """Convert numpy array to binary for storage"""
        if isinstance(embedding_array, np.ndarray):
            # Normalize the vector for cosine similarity
            embedding_array = embedding_array / np.linalg.norm(embedding_array)
            self.embedding = embedding_array.tobytes()
        else:
            raise TypeError("Embedding must be a numpy array")
    
    def get_embedding(self):
        """Convert stored binary back to numpy array"""
        if self.embedding:
            return np.frombuffer(self.embedding, dtype=np.float32)
        return None