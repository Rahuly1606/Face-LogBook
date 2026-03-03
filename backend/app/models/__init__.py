from app import db
from sqlalchemy import Table, Column, Integer, String, DateTime, ForeignKey
from datetime import datetime

# Association table for many-to-many relationship between students and groups
student_groups = Table('student_groups', db.Model.metadata,
    Column('student_id', String(50), ForeignKey('students.student_id', ondelete='CASCADE'), primary_key=True),
    Column('group_id', Integer, ForeignKey('groups.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime, default=datetime.utcnow, nullable=False)
)

# Import models to make them available
from .student import Student
from .attendance import Attendance
from .group import Group
from .user import User
from .setting import Setting
from .registration_link import RegistrationLink
from .face_embedding import FaceEmbedding
from .recognition_log import RecognitionLog