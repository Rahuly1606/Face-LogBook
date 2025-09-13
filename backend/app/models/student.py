from datetime import datetime
from app import db
import json
import numpy as np
import pickle
import os

class Student(db.Model):
    __tablename__ = 'students'
    
    student_id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    photo_path = db.Column(db.String(255), nullable=True)
    embedding = db.Column(db.LargeBinary, nullable=True)  # Changed to nullable=True
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    group = db.relationship('Group', back_populates='students')
    attendances = db.relationship('Attendance', back_populates='student', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f"<Student {self.student_id}: {self.name}>"
    
    def to_dict(self, with_embedding=False):
        try:
            data = {
                'student_id': self.student_id,
                'name': self.name,
                'group_id': self.group_id,
                'created_at': self.created_at.isoformat() if self.created_at else None
            }
            
            # Safely handle photo path and URL
            if self.photo_path:
                data['photo_path'] = self.photo_path
                try:
                    data['photo_url'] = f"/uploads/{os.path.basename(self.photo_path)}"
                except Exception as e:
                    import logging
                    logging.error(f"Error generating photo_url for {self.student_id}: {str(e)}")
                    data['photo_url'] = None
            else:
                data['photo_path'] = None
                data['photo_url'] = None
                
            # Optionally include embedding
            if with_embedding and self.embedding:
                try:
                    data['embedding'] = self.get_embedding().tolist()
                except Exception as e:
                    import logging
                    logging.error(f"Error processing embedding for {self.student_id}: {str(e)}")
            
            return data
        except Exception as e:
            import logging
            logging.error(f"Error in to_dict for student {self.student_id}: {str(e)}")
            # Return a minimal dict with just the ID and name to avoid breaking the API
            return {
                'student_id': self.student_id,
                'name': self.name,
                'group_id': self.group_id,
                'photo_url': None
            }
    
    def set_embedding(self, embedding_array):
        """Convert numpy array to binary for storage using pickle"""
        if isinstance(embedding_array, np.ndarray):
            # Normalize the vector for cosine similarity
            embedding_array = embedding_array / np.linalg.norm(embedding_array)
            # Serialize using pickle
            self.embedding = pickle.dumps(embedding_array.astype('float32'))
        else:
            raise TypeError("Embedding must be a numpy array")
    
    def get_embedding(self):
        """Convert stored binary back to numpy array"""
        if self.embedding:
            return pickle.loads(self.embedding)
        return None