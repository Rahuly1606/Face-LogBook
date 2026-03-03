"""
FaceEmbedding model — stores one 512-d embedding per pose per student.

Instead of averaging 3 poses into one vector (which loses pose-specific
information), we keep each embedding separately:

  front  → row with pose='front'
  left   → row with pose='left'
  right  → row with pose='right'

All 3 rows are added to the FAISS index mapped to the same student_id.
During recognition, the top-k FAISS search naturally retrieves the best
matching pose, giving us pose-robust identification without any extra logic.

Advantages over averaged embedding:
  • Pose robustness:  a student turning slightly still hits his/her left or
    right embedding rather than missing the averaged centre vector.
  • Lower false-rejection rate (FRR):  any one of the 3 embeddings being a
    strong match counts as a recognition.
  • Accuracy:  InsightFace embeddings are already L2-normalised unit vectors;
    averaging introduces a bias toward the origin that can degrade cosine
    similarity metrics.
"""
from datetime import datetime
import pickle
import numpy as np
from app import db


VALID_POSES = ('front', 'left', 'right')


class FaceEmbedding(db.Model):
    __tablename__ = 'face_embeddings'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(
        db.String(50),
        db.ForeignKey('students.student_id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    pose = db.Column(db.String(10), nullable=False)          # 'front' | 'left' | 'right'
    embedding = db.Column(db.LargeBinary, nullable=False)    # pickle-serialised float32 ndarray
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship back to student
    student = db.relationship('Student', back_populates='face_embeddings')

    __table_args__ = (
        db.UniqueConstraint('student_id', 'pose', name='uq_student_pose'),
        db.Index('idx_face_embeddings_student', 'student_id'),
    )

    def __repr__(self):
        return f"<FaceEmbedding student={self.student_id} pose={self.pose}>"

    # ------------------------------------------------------------------
    # Serialisation helpers
    # ------------------------------------------------------------------

    def set_embedding(self, array: np.ndarray):
        """L2-normalise then pickle-serialise a numpy float32 array."""
        if not isinstance(array, np.ndarray):
            raise TypeError("Embedding must be a numpy array")
        norm = np.linalg.norm(array)
        if norm == 0:
            raise ValueError("Zero-norm embedding — invalid face vector")
        array = (array / norm).astype('float32')
        self.embedding = pickle.dumps(array)

    def get_embedding(self) -> np.ndarray | None:
        """Deserialise stored embedding back to a numpy array."""
        if self.embedding:
            return pickle.loads(self.embedding)
        return None

    def to_dict(self, with_vector: bool = False) -> dict:
        d = {
            'id': self.id,
            'student_id': self.student_id,
            'pose': self.pose,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if with_vector:
            vec = self.get_embedding()
            d['embedding'] = vec.tolist() if vec is not None else None
        return d
